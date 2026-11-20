from app.services.email_service import send_reset_password_email

from fastapi import HTTPException, status

from app.services.encryption_service import decrypt_password, InvalidCiphertextError

from app.Schema.auth import (
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
    ValidateResetTokenRequest,
    DeleteAccountRequest,
)

from pwdlib import PasswordHash

from sqlalchemy.orm import Session
from app.models import (
    Users,
    RefreshToken,
    Trip,
    TripPreference,
    Itinerary,
    ItineraryPlace,
)

import os
from dotenv import load_dotenv

import jwt
from datetime import datetime, timedelta, timezone

import hmac
import hashlib
import secrets

from app.redis_client import redis_client

import logging

logger = logging.getLogger(__name__)

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


def decrypt_request_password(encrypted_password: str) -> str:
    try:
        return decrypt_password(encrypted_password)

    except InvalidCiphertextError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid encrypted password"
        )


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

    # decrypt the password received from angular
    password = decrypt_request_password(request.password)
    confirm_password = decrypt_request_password(request.confirm_password)

    # comparing the decrypt passwords
    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Password do not match"
        )

    # hash the decrypted password usiung existing Argon2id logic
    hashed_password = hash_password(password)

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
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    password = decrypt_request_password(request.password)

    # verify the decrypt password against the existing argon2id hash
    if not verify_password(password, user.password_hash):
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

    # return tokens internally so the route can set HttpOnly cookies.
    # the route must remove these value from the HTTP response body.
    return {
        "message": "Login successful",
        "email": user.email,
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


# Refresh service
def refresh_token_service(refresh_token: str, db: Session):

    now = datetime.now(timezone.utc)

    try:
        payload = jwt.decode(
            refresh_token,
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
    token_hash = hash_refresh_token(refresh_token)

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
            detail="Refresh token is invalid, expired, or revoked",
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
def logout_service(refresh_token: str, db: Session):

    token_hash = hash_refresh_token(refresh_token)

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
    return {"message": "Logout successful"}


# FORGOT PASSWORD
def forgot_password_service(request: ForgotPasswordRequest, db: Session):

    user = db.query(Users).filter(Users.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email is not registered"
        )

    reset_token = create_reset_token(user.user_id)

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

    password_reset_link = (
        f"{FRONTEND_URL.rstrip('/')}/reset-password?token={reset_token}"
    )

    try:
        send_reset_password_email(user.email, password_reset_link)

    except Exception:
        # inavildat eteh token if sending is failed

        token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()

        with redis_client.pipeline(transaction=True) as pipe:
            pipe.delete(f"reset:token:{token_hash}")
            pipe.delete(f"reset:user:{user.user_id}")
            pipe.execute()

        logger.exception("Email sending failed")

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

    # decrypt both password received from angular

    new_password = decrypt_request_password(request.new_password)
    confirm_password = decrypt_request_password(request.confirm_password)

    # compare the decrypt passwords
    if new_password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match"
        )

    raw_token = request.token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used reset link",
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

        user.password_hash = hash_password(new_password)
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


# Changing the password of the current user
def change_password_service(request: ChangePasswordRequest, current_user, db: Session):
    # STEP 1: Decrypt all three encrypted password fields
    current_password = decrypt_request_password(request.current_password)

    new_password = decrypt_request_password(request.new_password)

    confirm_new_password = decrypt_request_password(request.confirm_new_password)

    # STEP 2: Verify the current password using Argon2
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # STEP 3: Check that the new password differs from current password
    if verify_password(new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password",
        )

    # STEP 4: Check that new password and confirmation match
    if new_password != confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match.",
        )

    # STEP 5: Hash the new password using Argon2
    new_hashed_password = hash_password(new_password)

    # STEP 6: Update the password in the database
    current_user.password_hash = new_hashed_password

    db.commit()
    db.refresh(current_user)

    return {"message": "Password changed successfully"}


# delete the current user's account
def delete_account_service(request: DeleteAccountRequest, current_user, db: Session):
    # 1.decrypt the current password received from angular
    current_password = decrypt_request_password(request.current_password)

    # 2. Lock and fetch the user record
    user = (
        db.query(Users)
        .filter(Users.user_id == current_user.user_id)
        .with_for_update()
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User account not found"
        )

    # 3. Verify the current password
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    user_id = user.user_id

    try:
        # 4. fetch all trips belonging to this user
        trip_ids = [
            trip_id
            for (trip_id,) in (
                db.query(Trip.trip_id).filter(Trip.user_id == user_id).all()
            )
        ]

        if trip_ids:

            # 5. fetch itinerary_ids belonging to those trips
            itinerary_ids = [
                itinerary_id
                for (itinerary_id,) in (
                    db.query(Itinerary.itinerary_id)
                    .filter(Itinerary.trip_id.in_(trip_ids))
                    .all()
                )
            ]

            # 6. delete itinerary-place mappings
            if itinerary_ids:
                db.query(ItineraryPlace).filter(
                    ItineraryPlace.itinerary_id.in_(itinerary_ids)
                ).delete(synchronize_session=False)

                # 7. Delete itineraries
                db.query(Itinerary).filter(
                    Itinerary.itinerary_id.in_(itinerary_ids)
                ).delete(synchronize_session=False)

            # 8. Delete trip-preference mappings
            db.query(TripPreference).filter(
                TripPreference.trip_id.in_(trip_ids)
            ).delete(synchronize_session=False)

            # 9. Delete trips
            db.query(Trip).filter(Trip.trip_id.in_(trip_ids)).delete(
                synchronize_session=False
            )

        # 10. Delete all refresh tokens belonging to the user
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(
            synchronize_session=False
        )

        # 11. delete the user account
        db.delete(user)

        # 12. commit all database deletions together
        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        logger.exception("Account deletion failed for user_id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete the account. Please try again",
        )

    # 13. Clean up password-reset tokens in Redis
    # this happens after the database transaction succeeds.

    try:
        user_key = f"reset:user:{user_id}"

        previous_hash = redis_client.get(user_key)

        if previous_hash:
            if isinstance(previous_hash, bytes):
                previous_hash = previous_hash.decode("utf-8")

            token_key = f"reset:token:{previous_hash}"

            with redis_client.pipeline(transaction=True) as pipe:
                pipe.delete(token_key)
                pipe.delete(user_key)
                pipe.execute()

    except Exception:
        # account deleteion has already succeded in the database.
        # redis cleanup failure should not reverse that success.
        logger.exception("Redis password-reset cleanup failed for user_id=%s", user_id)
    return {"message": "Account deleted successfully"}
