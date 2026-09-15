from datetime import date
from pydantic import BaseModel, EmailStr, Field


# SIGNUP REQUEST AND RESPONSE MODELS
class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    confirm_password: str


class SignupResponse(BaseModel):
    message: str
    email: EmailStr


# LOGIN REQUEST AND RESPONSE MODELS
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    message: str
    email: EmailStr
    access_token: str


# FORGOT PASSWORD REQUEST MODEL
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# reset password response model
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str
