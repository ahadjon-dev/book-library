from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=72)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    display_name: str = Field(..., min_length=1, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    email: str
    display_name: str

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., max_length=72)
    new_password: str = Field(..., min_length=8, max_length=72, description="New password with minimum 8 and max 72 characters")


class MessageResponse(BaseModel):
    message: str
