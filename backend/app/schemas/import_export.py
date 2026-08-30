from pydantic import BaseModel


class ImportSummary(BaseModel):
    total_rows: int
    imported: int
    skipped: int
    errors: list[str]
