import warnings
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://library:library@db:5432/library"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 14
    uploads_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    gemini_api_key: str | None = None
    vision_model: str = "gemini-2.5-flash"
    google_books_api_key: str | None = None
    database_pool_size: int = 10
    database_max_overflow: int = 20

    def model_post_init(self, __context) -> None:
        if self.jwt_secret == "change-me":
            warnings.warn(
                "⚠️  JWT_SECRET is set to the insecure default 'change-me'. "
                "Set a strong JWT_SECRET environment variable before deploying to production.",
                stacklevel=2,
            )


settings = Settings()
