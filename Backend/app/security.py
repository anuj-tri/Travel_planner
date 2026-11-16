from fastapi import Depends, HTTPException, status, Cookie

import os
import jwt

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Users


load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail = "Access token is missing",
        )

    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = int(payload["sub"])

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access Token has expired",
        )

    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Access Token",
        )

    user = db.query(Users).filter(Users.user_id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Access Token",
        )

    return user
