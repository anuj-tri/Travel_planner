from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    confirm_password: str

class SignupResponse(BaseModel):
    message: str
    email: EmailStr
    