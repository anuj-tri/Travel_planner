from fastapi import APIRouter, status, Depends

from app.Schema.auth import (
    SignupRequest,
    SignupResponse,
    LoginRequest,
    LoginResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    CurrentUserResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    ChangePasswordRequest,
)

from app.database import get_db
from sqlalchemy.orm import Session

from app.services.auth_service import (
    signup_service,
    login_service,
    forgot_password_service,
    reset_password_service,
    get_current_user_service,
    update_profile_service,
    change_password_service,
)

from app.security import get_current_user

router = APIRouter(tags=["Authentication"])


# SIGNUP
@router.post(
    "/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED
)
def signup(request: SignupRequest, db: Session = Depends(get_db)):

    return signup_service(request, db)


# LOGIN
@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(request: LoginRequest, db: Session = Depends(get_db)):

    return login_service(request, db)


# FORGOIT PASSWORD
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):

    return forgot_password_service(request, db)


# reset password
@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):

    return reset_password_service(request, db)


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user_detail(
    current_user=Depends(get_current_user),
):
    return get_current_user_service(current_user)


@router.patch("/me", response_model=UpdateProfileResponse)
def update_profile_user(
    request: UpdateProfileRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_profile_service(request, current_user, db)


@router.patch("/me/change-password")
def change_current_user_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return change_password_service(request, current_user, db)
