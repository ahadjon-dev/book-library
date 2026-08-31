import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.library import Library
from app.models.user import ROLE_MEMBER, ROLE_OWNER, User
from app.schemas.library import InvitePreview
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MeResponse,
    MessageResponse,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(
    request: Request, payload: RegisterRequest, db: Session = Depends(get_db)
) -> TokenResponse:
    email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    display_name = payload.display_name.strip()

    if payload.invite_code:
        library = (
            db.query(Library).filter(Library.invite_code == payload.invite_code.strip()).first()
        )
        if library is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or revoked invite code",
            )
        role = ROLE_MEMBER
    else:
        # Generate an initial share slug from display_name (e.g. ahadjon-dev)
        base_slug = re.sub(r"[^a-zA-Z0-9-_]", "", display_name.lower())
        slug = base_slug if base_slug else None
        if slug:
            slug_taken = db.query(Library).filter(Library.share_slug == slug).first()
            if slug_taken:
                slug = f"{slug}-{uuid.uuid4().hex[:4]}"

        library = Library(name=display_name, share_slug=slug)
        db.add(library)
        db.flush()
        role = ROLE_OWNER

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=display_name,
        library_id=library.id,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    return TokenResponse(access_token=token)


@router.get("/invite/{code}", response_model=InvitePreview)
@limiter.limit("20/minute")
def preview_invite(request: Request, code: str, db: Session = Depends(get_db)) -> InvitePreview:
    library = db.query(Library).filter(Library.invite_code == code.strip()).first()
    if library is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or revoked invite code",
        )
    member_count = db.query(User).filter(User.library_id == library.id).count()
    return InvitePreview(library_name=library.name, member_count=member_count)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(subject=user.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/profile", response_model=MeResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    current_user.display_name = payload.display_name.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return MessageResponse(message="Password changed successfully")
