from fastapi import APIRouter,HTTPException,status,Depends
from app.Schema.auth import SignupRequest,SignupResponse
from pwdlib import PasswordHash
from app.database import get_db
from sqlalchemy.orm import Session
from app.models import Users


router = APIRouter()


password_hash = PasswordHash.recommended()           #here i am creating password hasher


@router.post("/signup",response_model=SignupResponse,status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest,db:Session=Depends(get_db)):

    existing_user = db.query(Users).filter(Users.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

    if request.password != request.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
    
    hashed_password = password_hash.hash(request.password)

    new_user = Users(
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Signup successful",
        "email": request.email,
        
    }