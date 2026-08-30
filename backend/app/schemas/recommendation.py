from pydantic import BaseModel
from app.schemas.book import BookOut


class RecommendNextRequest(BaseModel):
    mood: str | None = None
    max_pages: int | None = None
    preferred_genre: str | None = None
    custom_prompt: str | None = None


class RecommendationItem(BaseModel):
    book: BookOut
    match_score: int
    reason: str
    mood_tags: list[str] = []


class RecommendNextResponse(BaseModel):
    recommendations: list[RecommendationItem]
    unread_pool_size: int
    criteria_summary: str
