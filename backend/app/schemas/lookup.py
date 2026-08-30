from pydantic import BaseModel


class NameOut(BaseModel):
    name: str
