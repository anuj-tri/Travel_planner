from app.services.email_service import send_reset_password_email

from fastapi import HTTPException, status

from app.Schema.auth import (
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
    RefreshTokenRequest,
    LogoutRequest,
    ValidateResetTokenRequest,
)

from pwdlib import PasswordHash

from sqlalchemy.orm import Session
from app.models import Users, RefreshToken

import os
from dotenv import load_dotenv

import jwt
from datetime import datetime, timedelta, timezone

import hmac
import hashlib
import secrets

from app.redis_client import redis_client

password_hash = PasswordHash.recommended()  # here i am creating password hashing object

load_dotenv()

PASSWORD_PEPPER = os.getenv("PASSWORD_PEPPER")

REFRESH_SECRET_KEY = os.getenv("REFRESH_SECRET_KEY")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
RESET_SECRET_KEY = os.getenv("RESET_SECRET_KEY")


def pepper_password(password: str):

    return hmac.new(
        PASSWORD_PEPPER.encode(), password.encode(), hashlib.sha256
    ).hexdigest()


def hash_password(password: str):
    peppered_password = pepper_password(password)

    return password_hash.hash(peppered_password)


def verify_password(password: str, hashed_password: str) -> bool:

    peppered_password = pepper_password(password)

    return password_hash.verify(peppered_password, hashed_password)


# here i am creating secret key for jwt token
def create_access_token(user_id: int):
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=7),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return token


def create_refresh_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(
        payload,
        REFRESH_SECRET_KEY,
        algorithm=ALGORITHM,
    )


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_reset_token(user_id: int) -> str:

    # generates a cryptographically secure random token
    raw_token = secrets.token_urlsafe(32)

    # storing only the SHA-256 hash of the token in redis.
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    user_key = f"reset:user:{user_id}"
    token_key = f"reset:token:{token_hash}"

    # invalidate any previous reset token for this user
    previous_hash = redis_client.get(user_key)

    with redis_client.pipeline(transaction=True) as pipe:
        if previous_hash:
            pipe.delete(f"reset:token:{previous_hash}")

        # token expire automatically after 420 secods.
        pipe.set(token_key, str(user_id), ex=420)
        pipe.set(user_key, token_hash, ex=420)
        pipe.execute()
    return raw_token


# SIGNUP
def signup_service(request: SignupRequest, db: Session):

    existing_user = db.query(Users).filter(Users.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match"
        )

    hashed_password = hash_password(request.password)

    new_user = Users(
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        password_hash=hashed_password,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Signup successful",
        "email": request.email,
    }


# LOGIN
def login_service(request: LoginRequest, db: Session):

    user = db.query(Users).filter(Users.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User Not found"
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Generate access token (you can use JWT or any other method)
    access_token = create_access_token(user.user_id)
    refresh_token = create_refresh_token(user.user_id)

    now = datetime.now(timezone.utc)

    try:
        token_record = RefreshToken(
            user_id=user.user_id,
            token_hash=hash_refresh_token(refresh_token),
            created_at=now,
            expire_at=now + timedelta(days=7),
        )

        db.add(token_record)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Login successful",
        "email": request.email,
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


# Refresh service
def refresh_token_service(request: RefreshTokenRequest, db: Session):

    now = datetime.now(timezone.utc)

    try:
        payload = jwt.decode(
            request.refresh_token,
            REFRESH_SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        user_id = int(payload["sub"])

    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    token_hash = hash_refresh_token(request.refresh_token)

    token_record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )

    if (
        not token_record
        or token_record.user_id != user_id
        or token_record.revoked_at is not None
        or token_record.expire_at <= now
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is unavailable",
        )
    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)

    try:
        token_record.revoked_at = now

        new_token_record = RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(new_refresh_token),
            created_at=now,
            expire_at=now + timedelta(days=7),
        )

        db.add(new_token_record)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


# logout service


def logout_service(request: LogoutRequest, db: Session):

    token_hash = hash_refresh_token(request.refresh_token)

    token_record = (
        db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    )

    if token_record and token_record.revoked_at is None:
        token_record.revoked_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
    return {"message": "Logout successfully"}


# FORGOIT PASSWORD
def forgot_password_service(request: ForgotPasswordRequest, db: Session):

    user = db.query(Users).filter(Users.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email is not registered"
        )

    reset_token = create_reset_token(user.user_id)

    password_reset_link = (
        f"http://localhost:4200/reset-password" f"?token={reset_token}"
    )

    try:
        send_reset_password_email(user.email, password_reset_link)
    except Exception as e:
        # inavildat eteh token if sending is failed

        token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()

        with redis_client.pipeline(transaction=True) as pipe:
            pipe.delete(f"reset:token:{token_hash}")
            pipe.delete(f"reset:user:{user.user_id}")
            pipe.execute()

        print("Email sending failed:", e)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send password reset email",
        )

    return {
        "message": "Password reset instructions sent to your email",
    }


def validate_reset_token_service(request: ValidateResetTokenRequest, db: Session):
    raw_token = request.token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    user_id = redis_client.get(f"reset:token:{token_hash}")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used reset link",
        )

    # confirm that this token is still the user's current token.
    current_hash = redis_client.get(f"reset:user:{user_id}")

    if current_hash != token_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid , expired , or alredy used reset link",
        )

    user = db.query(Users).filter(Users.user_id == int(user_id)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid , expired , or already used reset link",
        )
    return {"valid": True}


# reset password
def reset_password_service(request: ResetPasswordRequest, db: Session):

    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match"
        )

    raw_token = request.token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            details="Invalid, expired, or already used reset link",
        )

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    token_key = f"reset:token:{token_hash}"
    lock_key = f"reset:lock:{token_hash}"
    lock_value = secrets.token_urlsafe(16)

    if not redis_client.set(lock_key, lock_value, nx=True, ex=60):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reset request is already in progress. Please try again.",
        )

    try:
        user_id = redis_client.get(token_key)

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid, expired, or already used reset link",
            )
        user_key = f"reset:user:{user_id}"

        if redis_client.get(user_key) != token_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid, expired, or already used reset link",
            )

        # lock the users datatbase row during the password update.

        user = (
            db.query(Users)
            .filter(Users.user_id == int(user_id))
            .with_for_update()
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid, expired, or already used reset link",
            )

        if (
            redis_client.get(token_key) != str(user.user_id)
            or redis_client.get(user_key) != token_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid, expired, or already used reset link",
            )

        # consume the token before commiting the password update.
        # if the Db commit fialss, the user can request a new link.

        with redis_client.pipeline(transaction=True) as pipe:
            pipe.delete(token_key)
            pipe.delete(user_key)
            pipe.execute()

        user.password_hash = hash_password(request.new_password)
        db.commit()

        return {"message": "Password reset successful"}

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reset password Please request a new link.",
        )
    finally:
        redis_client.eval(
            """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """,
            1,
            lock_key,
            lock_value,
        )


# getting the current user datails
def get_current_user_service(current_user):
    return {
        "user_id": current_user.user_id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "is_active": current_user.is_active,
    }


# updating first and lastname of user
def update_profile_service(request: UpdateProfileRequest, current_user, db: Session):
    current_user.first_name = request.first_name
    current_user.last_name = request.last_name

    db.commit()
    db.refresh(current_user)

    return {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
    }


# chnaging the password of current user
def change_password_service(request: ChangePasswordRequest, current_user, db: Session):

    # verify the current password
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # check the new password is different from current password
    if verify_password(request.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password",
        )

    # check the new password and confirm password match
    if request.new_password != request.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match.",
        )

    # hash the new password
    new_hashed_password = hash_password(request.new_password)

    # updating it in the db
    current_user.password_hash = new_hashed_password

    db.commit()  # save the new password to db

    db.refresh(current_user)  # refrsh the db with latest database values..

    return {"message": "Password changed successfully"}
