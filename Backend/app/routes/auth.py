from fastapi import APIRouter, status, Depends, Response, Cookie, HTTPException

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
    ValidateResetTokenRequest,
    DeleteAccountRequest,
    DeleteAccountResponse,
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
    refresh_token_service,
    logout_service,
    validate_reset_token_service,
    delete_account_service,
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
@router.post("/login", status_code=status.HTTP_200_OK)
def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    result = login_service(request, db)

    access_token = result.pop("access_token")
    refresh_token = result.pop("refresh_token")

    response.set_cookie(
        key ="access_token",
        value = access_token,
        httponly=True,
        secure = False,
        samesite="lax",
        max_age= 7* 60,
        path = "/",
    )
    response.set_cookie(
        key ="refresh_token",
        value = refresh_token,
        httponly = True,
        secure = False,
        samesite="lax",
        max_age = 7 * 24 * 60 *60,
        path ="/",
    )

    return result


# REFRESH TOKEN
@router.post("/refresh", status_code=status.HTTP_200_OK)
def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default = None),
):
    if not refresh_token:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing",
        )
    result = refresh_token_service(refresh_token, db)

    access_token = result.pop("access_token")
    new_refresh_token = result.pop("refresh_token")

    response.set_cookie(
        key = "access_token",
        value = access_token,
        httponly = True,
        secure = False,
        samesite = "lax",
        max_age = 7* 60,
        path ="/",
    )

    response.set_cookie(
        key = "refresh_token",
        value = new_refresh_token,
        httponly = True,
        secure = False,
        samesite = "lax",
        max_age = 7* 24* 60 *60,
        path ="/",
    )

    return {"message": "Token refreshed successfully"}


# LOGOUT
@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if refresh_token:
        logout_service(refresh_token, db)

    response.delete_cookie(
        key = "access_token",
        path = "/",
        httponly=True,
        secure = False,
        samesite ="lax",
    )

    response.delete_cookie(
        key = "refresh_token",
        path = "/",
        httponly=True,
        secure = False,
        samesite ="lax",
    )
    return {"message": "Logout successful"}


# FORGOIT PASSWORD
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):

    return forgot_password_service(request, db)


# reset password
@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):

    return reset_password_service(request, db)


# gets the current user's profile
@router.get("/me", response_model=CurrentUserResponse)
def get_current_user_detail(
    current_user=Depends(get_current_user),
):
    return get_current_user_service(current_user)


# updates the profile
@router.patch("/me", response_model=UpdateProfileResponse)
def update_profile_user(
    request: UpdateProfileRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_profile_service(request, current_user, db)


# chnages the password
@router.patch("/me/change-password")
def change_current_user_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return change_password_service(request, current_user, db)


@router.post("/validate-reset-token", status_code=status.HTTP_200_OK)
def validate_reset_token(
    request: ValidateResetTokenRequest, db: Session = Depends(get_db)
):
    return validate_reset_token_service(request, db)


#delete the user
@router.delete("/me", response_model = DeleteAccountResponse)
def delete_current_user_account(
    request: DeleteAccountRequest,
    response: Response,
    current_user= Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = delete_account_service(request, current_user, db)

    response.delete_cookie(
        key="access_token",
        path = "/",
        httponly=True,
        secure=False,
        samesite="lax",
    )

    response.delete_cookie(
        key="refresh_token",
        path = "/",
        httponly=True,
        secure= False,
        samesite="lax",

    )

    return result
