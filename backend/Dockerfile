FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*

# Layer caching for Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir setuptools && pip install --no-cache-dir -e . 2>/dev/null || true

COPY . .
RUN pip install --no-cache-dir . && mkdir -p /app/uploads

# Run container as non-root user for defense-in-depth
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 --no-create-home appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
