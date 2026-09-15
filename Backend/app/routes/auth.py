from fastapi import APIRouter, HTTPException, status, Depends

from app.Schema.auth import (
    SignupRequest,
    SignupResponse,
    LoginRequest,
    LoginResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from pwdlib import PasswordHash

from app.database import get_db
from sqlalchemy.orm import Session
from app.models import Users

import os
from dotenv import load_dotenv

import jwt
from datetime import datetime, timedelta, timezone

import hmac
import hashlib

router = APIRouter(prefix="/auth", tags=["Authentication"])
password_hash = PasswordHash.recommended()  # here i am creating password hashing object

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
RESET_SECRET_KEY = os.getenv("RESET_SECRET_KEY")


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
@router.post(
    "/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED
)
def signup(request: SignupRequest, db: Session = Depends(get_db)):

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

    hashed_password = password_hash.hash(request.password)

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
@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User Not found"
        )

    if not password_hash.verify(request.password, user.password_hash):
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
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):

    user = db.query(Users).filter(Users.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email is not registered"
        )
    reset_token = create_reset_token(user.user_id, user.password_hash)
    password_reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    return {
        "message": "Password reset instructions sent to your email",
        "reset_link": password_reset_link,
    }


# reset password
@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):

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

        new_hashed_password = password_hash.hash(request.new_password)
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
