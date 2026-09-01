"""AI enrichment for books: mood tags and semantic embeddings.

Runs once per book. The embedding powers the recommendation engine;
the mood tags are shown in the UI. Both calls tolerate failure —
a book without enrichment still works everywhere.
"""
import asyncio
import json
from typing import Any

import httpx

from app.core.config import settings

GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"
GEMINI_BATCH_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"

TIMEOUT_SECONDS = 15.0
BATCH_TIMEOUT_SECONDS = 60.0
EMBED_BATCH_SIZE = 25  # sized for the free tier's per-minute token limit

TAGS_PROMPT = (
    "You are a librarian who labels books with mood and theme tags, like StoryGraph.\n"
    "Given the book metadata below, return 4 to 6 short tags that describe how the book feels "
    "and what it is about: mood (e.g. dark, funny, tense, cozy), pace (fast-paced, slow-paced), "
    "and core themes. Use the language the book is written in for half of the tags and English "
    "for the other half. Lowercase, 1-3 words per tag. Return ONLY JSON per the schema.\n\n"
    "Book metadata:\n{text}"
)


def book_text(
    title: str,
    authors: list[str] | None = None,
    genre: str | None = None,
    tags: list[str] | None = None,
    description: str | None = None,
) -> str:
    """One text blob per book; input for both tags and embedding."""
    parts = [title]
    if authors:
        parts.append("by " + ", ".join(authors))
    if genre:
        parts.append(f"genre: {genre}")
    if tags:
        parts.append("tags: " + ", ".join(tags))
    if description:
        parts.append(description[:1000])
    return "\n".join(parts)


async def _post_json(
    url: str, payload: dict[str, Any], timeout: float = TIMEOUT_SECONDS
) -> dict[str, Any] | None:
    key = settings.gemini_api_key
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, params={"key": key}, json=payload)
            if resp.status_code != 200:
                return None
            return resp.json()
    except (httpx.RequestError, httpx.TimeoutException):
        return None


async def embed_texts(
    texts: list[str], pace_seconds: float = 0.0
) -> list[list[float] | None] | None:
    """Embed documents in batches.

    Returns one vector per input text. On a mid-run API failure the
    vectors collected so far are returned, so callers keep partial
    progress. Returns None only when nothing succeeded.
    """
    if not texts:
        return []
    model = settings.embedding_model
    vectors: list[list[float] | None] = []
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        if start and pace_seconds:
            await asyncio.sleep(pace_seconds)
        chunk = texts[start : start + EMBED_BATCH_SIZE]
        payload = {
            "requests": [
                {
                    "model": f"models/{model}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": "RETRIEVAL_DOCUMENT",
                    "outputDimensionality": settings.embedding_dimensions,
                }
                for text in chunk
            ]
        }
        data = await _post_json(
            GEMINI_BATCH_EMBED_URL.format(model=model), payload, timeout=BATCH_TIMEOUT_SECONDS
        )
        if data is None:
            break
        embeddings = data.get("embeddings", [])
        if len(embeddings) != len(chunk):
            break
        vectors.extend(e.get("values") for e in embeddings)
    return vectors or None


async def embed_query(text: str) -> list[float] | None:
    """Embed one user query."""
    model = settings.embedding_model
    payload = {
        "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_QUERY",
        "outputDimensionality": settings.embedding_dimensions,
    }
    data = await _post_json(GEMINI_EMBED_URL.format(model=model), payload)
    if data is None:
        return None
    return (data.get("embedding") or {}).get("values")


async def generate_mood_tags(text: str) -> list[str] | None:
    """One structured-output call producing 4-6 mood/theme tags."""
    model = settings.vision_model or "gemini-2.5-flash"
    payload = {
        "contents": [{"parts": [{"text": TAGS_PROMPT.format(text=text)}]}],
        "generationConfig": {
            "temperature": 0.2,
            # Thinking models spend output tokens on reasoning before the JSON
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "mood_tags": {"type": "ARRAY", "items": {"type": "STRING"}}
                },
                "required": ["mood_tags"],
            },
        },
    }
    data = await _post_json(GEMINI_GENERATE_URL.format(model=model), payload)
    if data is None:
        return None
    try:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        tags = json.loads(content).get("mood_tags", [])
        cleaned = [t.strip().lower() for t in tags if isinstance(t, str) and t.strip()]
        return cleaned[:8] or None
    except (KeyError, IndexError, json.JSONDecodeError, AttributeError):
        return None
