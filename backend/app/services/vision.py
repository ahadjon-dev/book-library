import base64
import json
import re
from typing import Any
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings


class DetectedSpine(BaseModel):
    title: str
    author: str | None = None
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _detect_mime_type(image_bytes: bytes) -> str:
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


async def extract_spines(image_bytes: bytes) -> list[DetectedSpine]:
    """
    Use Google Gemini Vision with structured JSON output to identify bookshelf/spine titles.
    Reads multi-lingual text (Uzbek, Russian, English, etc.) oriented horizontally, vertically, or rotated.
    """
    key = settings.gemini_api_key
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured on the server.")

    requested_model = settings.vision_model or "gemini-3.5-flash"
    if "2.5" in requested_model:
        requested_model = "gemini-3.5-flash"

    candidate_models = [requested_model]
    for fallback in ("gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"):
        if fallback not in candidate_models:
            candidate_models.append(fallback)

    mime_type = _detect_mime_type(image_bytes)
    b64_data = base64.b64encode(image_bytes).decode("utf-8")

    prompt = (
        "You are an expert bookshelf OCR system. Analyze this bookshelf or book stack photo carefully.\n"
        "1. Detect all clearly visible book spines or covers.\n"
        "2. Read vertical, rotated, or horizontal text accurately.\n"
        "3. Book titles may be in Uzbek (Latin or Cyrillic), Russian, English, or other languages.\n"
        "4. For each detected book, output 'title', 'author' (or null if unreadable), and your 'confidence' score between 0.0 and 1.0.\n"
        "5. Do not hallucinate or guess books that are completely blurry or not in the photo.\n"
        "6. Return ONLY a JSON array of objects conforming to the requested schema."
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_data,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING"},
                        "author": {"type": "STRING", "nullable": True},
                        "confidence": {"type": "NUMBER"},
                    },
                    "required": ["title"],
                },
            },
        },
    }

    last_error = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in candidate_models:
            url = GEMINI_GENERATE_URL.format(model=model) + f"?key={key}"
            try:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        return []

                    text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if not text_content:
                        return []

                    parsed_json = json.loads(text_content)
                    if not isinstance(parsed_json, list):
                        return []

                    results: list[DetectedSpine] = []
                    for item in parsed_json:
                        if isinstance(item, dict) and item.get("title"):
                            results.append(
                                DetectedSpine(
                                    title=str(item["title"]).strip(),
                                    author=str(item["author"]).strip() if item.get("author") else None,
                                    confidence=float(item.get("confidence", 0.8)),
                                )
                            )
                    return results

                # If status is not 200 (e.g. 404 deprecated or 503 overloaded), try next fallback
                last_error = f"Gemini API ({model}) returned status {resp.status_code}: {resp.text}"
            except Exception as exc:
                last_error = f"Gemini API ({model}) exception: {exc}"

    raise RuntimeError(last_error or "Gemini API failed across all available models.")
