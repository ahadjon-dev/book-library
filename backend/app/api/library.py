import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.library import Library
from app.models.user import ROLE_OWNER, User
from app.schemas.library import InviteOut, LibraryOut, LibraryUpdate, MemberOut

router = APIRouter(prefix="/library", tags=["library"])


def _require_owner(current_user: User) -> None:
    if current_user.role != ROLE_OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the library owner can do this",
        )


def _to_library_out(db: Session, library: Library, current_user: User) -> LibraryOut:
    members = db.query(User).filter(User.library_id == library.id).order_by(User.id).all()
    return LibraryOut(
        id=library.id,
        name=library.name,
        my_role=current_user.role,
        members=[MemberOut.model_validate(m) for m in members],
    )


def _to_invite_out(library: Library) -> InviteOut:
    if library.invite_code is None:
        return InviteOut(invite_code=None, join_path=None)
    return InviteOut(invite_code=library.invite_code, join_path=f"/join/{library.invite_code}")


@router.get("", response_model=LibraryOut)
def get_library(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryOut:
    return _to_library_out(db, current_user.library, current_user)


@router.patch("", response_model=LibraryOut)
def rename_library(
    payload: LibraryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryOut:
    _require_owner(current_user)
    library = current_user.library
    library.name = payload.name.strip()
    db.commit()
    db.refresh(library)
    return _to_library_out(db, library, current_user)


@router.get("/invite", response_model=InviteOut)
def get_invite(
    current_user: User = Depends(get_current_user),
) -> InviteOut:
    _require_owner(current_user)
    return _to_invite_out(current_user.library)


@router.post("/invite", response_model=InviteOut)
def rotate_invite(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InviteOut:
    _require_owner(current_user)
    library = current_user.library
    for _ in range(5):
        code = secrets.token_urlsafe(8)
        taken = db.query(Library).filter(Library.invite_code == code).first()
        if taken is None:
            library.invite_code = code
            db.commit()
            return _to_invite_out(library)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique invite code",
    )


@router.delete("/invite", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_owner(current_user)
    current_user.library.invite_code = None
    db.commit()
