from app.services.email_service import send_reset_password_email

from fastapi import HTTPException, status

from app.Schema.auth import (
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
)

from pwdlib import PasswordHash

from sqlalchemy.orm import Session
from app.models import Users

import os
from dotenv import load_dotenv

import jwt
from datetime import datetime, timedelta, timezone

import hmac
import hashlib

password_hash = PasswordHash.recommended()  # here i am creating password hashing object

load_dotenv()

PASSWORD_PEPPER = os.getenv("PASSWORD_PEPPER")

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
        "exp": datetime.now(timezone.utc) + timedelta(minutes=180),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return token


def create_reset_token(
    user_id: int, password_hash: str
):  # here i am generating the token for reset password and setting the expiry time of 15 minutes

    password_state = hmac.new(
        RESET_SECRET_KEY.encode(), password_hash.encode(), hashlib.sha256
    ).hexdigest()

    payload = {
        "sub": str(user_id),
        "purpose": "password_reset",
        "password_state": password_state,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=7),
    }

    token = jwt.encode(payload, RESET_SECRET_KEY, algorithm=ALGORITHM)
    return token


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

    return {
        "message": "Login successful",
        "email": request.email,
        "access_token": access_token,
    }


# FORGOIT PASSWORD
def forgot_password_service(request: ForgotPasswordRequest, db: Session):

    user = db.query(Users).filter(Users.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email is not registered"
        )

    reset_token = create_reset_token(user.user_id, user.password_hash)

    password_reset_link = f"http://localhost:4200/reset-password?token={reset_token}"

    try:
        send_reset_password_email(user.email, password_reset_link)
    except Exception as e:
        print("Email sending failed:", e)

    return {
        "message": "Password reset instructions sent to your email",
        "reset_link": password_reset_link,
    }


# reset password
def reset_password_service(request: ResetPasswordRequest, db: Session):

    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match"
        )

    try:
        payload = jwt.decode(request.token, RESET_SECRET_KEY, algorithms=[ALGORITHM])
        print("TOKEN DECODED SUCCESSFULLY")

        user_id = int(
            payload["sub"]
        )  # suppose the token conatins "sub":"1" then we get user_id = 1

        user = (
            db.query(Users).filter(Users.user_id == user_id).first()
        )  # its ask the postgres to find the user with user_id = 1 and result store in user

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        current_password_state = hmac.new(
            RESET_SECRET_KEY.encode(), user.password_hash.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(payload["password_state"], current_password_state):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or aleready used reset token",
            )

        new_hashed_password = hash_password(request.new_password)
        user.password_hash = new_hashed_password
        db.commit()

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link has expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token"
        )

    return {"message": "Password reset successful"}


def get_current_user_service(current_user):
    return {
        "user_id": current_user.user_id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "is_active": current_user.is_active,
    }


def update_profile_service(request: UpdateProfileRequest, current_user, db: Session):
    current_user.first_name = request.first_name
    current_user.last_name = request.last_name

    db.commit()
    db.refresh(current_user)

    return {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
    }


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
