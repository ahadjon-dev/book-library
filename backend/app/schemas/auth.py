from pydantic import BaseModel, EmailStr, Field

from app.schemas.library import LibraryBrief


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=100)
    # Joins an existing household library instead of creating a new one
    invite_code: str | None = Field(default=None, max_length=32)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    library: LibraryBrief

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="New password with minimum 8 characters")


class MessageResponse(BaseModel):
    message: str
