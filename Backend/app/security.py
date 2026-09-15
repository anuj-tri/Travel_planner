from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import os
from dotenv import load_dotenv

from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Users

import jwt
load_dotenv()


SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

security = HTTPBearer()

def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db : Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = int(payload["sub"])

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail = "Token has expired"
        )

    except jwt.InvalidTokenErrorError:
            raise HTTPException(
                status_code= status.HTTP_401_UNAUTHORIZED,
                detail = "Invalid Token"
            )

    user = db.query(Users).filter(
         Users.user_id == user_id
    ).first()

    if not user:
         raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid Token"
        )

    return user
         