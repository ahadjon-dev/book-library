from pydantic import BaseModel, Field


class LibraryBrief(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    id: int
    display_name: str
    role: str

    model_config = {"from_attributes": True}


class LibraryOut(BaseModel):
    id: int
    name: str
    my_role: str
    members: list[MemberOut]


class LibraryUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class InviteOut(BaseModel):
    invite_code: str | None
    join_path: str | None


class InvitePreview(BaseModel):
    library_name: str
    member_count: int
