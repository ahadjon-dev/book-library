# 📚 Book Library SaaS

A modern, multi-tenant Book Library SaaS platform built with **FastAPI**, **PostgreSQL**, **React 18**, **TypeScript**, and **Tailwind CSS**. Features AI-powered camera shelf scanning, Goodreads/CSV migration, personalized public shareable collections, book loan tracking, and interactive reading goals.

---

## ✨ Features

- 👤 **Multi-Tenant SaaS & Data Isolation**: Self-serve sign-up with isolated private libraries, shelves, tags, stats, and loans.
- ⚡ **1-Tap Progress & Rating**: Instantly toggle reading status (⏳ Unread ➔ 📖 Reading ➔ ✅ Finished) and set star ratings directly from gallery book cards.
- 📸 **AI Shelf Photo Scanner**: Photograph your physical bookshelf to auto-extract titles and match metadata against Open Library via AI vision.
- 📥 **CSV & Goodreads Importer**: Migrate existing libraries in seconds with native CSV or Goodreads export format auto-detection.
- 🤖 **AI "Recommend Next" Engine**: Unread shelf book recommendations matched to your mood and time constraints.
- 🤝 **Lending & Loan Tracker**: Track books borrowed by friends with due dates and overdue calculations.
- 🎯 **Yearly Reading Goals**: Set annual book targets with real-time pace tracking (*Ahead*, *On Track*, *Behind*).
- 🌐 **Public Shareable Shelves**: Share your curated library with friends via custom vanity slugs (e.g. `/public/your-name`) with sensitive notes hidden.
- 📱 **Installable PWA**: Offline-ready Progressive Web App with mobile barcode camera scanning.
- 🎨 **7 Visual Themes & Multilingual**: Dark, Onyx, Sky, Plum, Blue, Light, and Lime palettes with English (`en`) and Uzbek (`uz`) support.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Configure Environment

```bash
cp .env.example .env
```

### 2. Launch with Docker Compose

```bash
docker compose up --build
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **PostgreSQL**: `localhost:5433` (`library` / `library`)

You can register your account directly from the frontend Sign Up tab or seed users via CLI:

```bash
docker compose exec backend python -m scripts.seed_users \
  admin@example.com "Admin User"
```

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default / Example | Required |
|---|---|---|:---:|
| `JWT_SECRET` | Secret key used to sign authentication tokens | *Change in production!* | **Yes** |
| `DATABASE_URL` | SQLAlchemy async/sync connection string | `postgresql+psycopg://library:library@db:5432/library` | **Yes** |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173` | **Yes** |
| `POSTGRES_USER` | PostgreSQL superuser username | `library` | No |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `library` | No |
| `POSTGRES_DB` | PostgreSQL primary database name | `library` | No |
| `OPENAI_API_KEY` | Key for Vision spine extraction & recommendation LLM | `sk-...` | Optional |
| `DATABASE_POOL_SIZE` | Connection pool size for PostgreSQL engine | `10` | No |
| `DATABASE_MAX_OVERFLOW` | Maximum overflow connections above pool size | `20` | No |

---

## 🧪 Testing & Code Coverage

The backend maintains **94%+ statement coverage** across all API routes, data isolation barriers, and services.

```bash
# Run full test suite with coverage report
docker compose exec backend pytest -v --cov=app --cov-report=term-missing

# Test frontend production build
docker compose exec frontend npm run build
```

---

## 🚢 Production Deployment

### Frontend (Static SPA with Nginx)
The production `frontend/Dockerfile` uses a multi-stage build that compiles Vite assets and serves them via Nginx with Brotli/Gzip compression and client-side SPA routing (`nginx.conf`).

### Backend (FastAPI with Uvicorn)
- Set a cryptographically secure `JWT_SECRET` (`openssl rand -hex 32`).
- Configure explicit `CORS_ORIGINS` matching your production domain.
- Set up persistent volume mounts for `/app/uploads` (book cover storage).

---

## 📖 Architecture & Documentation

- [Backend Architecture & Schema Reference](docs/BACKEND.md)
- [Frontend Architecture, Theming & i18n Guide](docs/FRONTEND.md)

