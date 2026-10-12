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


# current user response model

class CurrentUserResponse(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: EmailStr
    is_active: bool


# to change the first name and last name

class UpdateProfileRequest(BaseModel):
    first_name: str = Field(
        min_length=1,
        max_length=15,
        pattern= r"^[A-Za-z]+$"
        )
    last_name: str = Field(
        min_length=1,
        max_length=15,
        pattern= r"^[A-Za-z]+$"
        )


class UpdateProfileResponse(BaseModel):
    first_name: str
    last_name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str
