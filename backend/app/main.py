from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, books, lookups, stats
from app.core.config import settings

app = FastAPI(title="Book Library API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(lookups.router)
app.include_router(stats.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
