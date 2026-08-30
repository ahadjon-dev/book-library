# Backend Documentation

This is the reference for maintaining the FastAPI backend. It assumes no prior
context — if you're picking this project back up after a while, start here.

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | [FastAPI](https://fastapi.tiangolo.com/) | Async-capable, generates OpenAPI docs (`/docs`) for free, Pydantic-native |
| ORM | [SQLAlchemy 2.0](https://docs.sqlalchemy.org/) (declarative, typed `Mapped[...]` style) | Standard, well-documented, works with Alembic |
| Migrations | [Alembic](https://alembic.sqlalchemy.org/) | Standard SQLAlchemy migration tool |
| Database | PostgreSQL (via `psycopg` v3 driver) | Needed for real concurrent writes — you and your wife share one library |
| Validation / serialization | [Pydantic v2](https://docs.pydantic.dev/) | FastAPI's request/response layer is built on it |
| Auth | JWT (`python-jose`) + `passlib[bcrypt]` for password hashing | Simple stateless auth, no session store needed for a 2-user app |
| Spreadsheet export | `openpyxl` | Generates real `.xlsx` files server-side |
| External metadata | [Open Library API](https://openlibrary.org/dev/docs/api/books) via `urllib` (no extra dependency) | Free, no API key, used for both ISBN lookup and cover images |

No ORM query builder abstraction beyond SQLAlchemy itself, no background task
queue, no caching layer — the whole thing is a straightforward synchronous
FastAPI app. That's a deliberate choice: this is a 2-person household app, not
a high-traffic service, so there was no reason to add that complexity.

## 2. Project structure

```
backend/
  app/
    main.py              # FastAPI app instance, CORS, static /uploads mount, router registration
    core/
      config.py          # Settings (env vars) — see § 3
      security.py        # password hashing + JWT create/decode
    db/
      base.py             # SQLAlchemy declarative Base
      session.py          # engine + SessionLocal + get_db() FastAPI dependency
    models/                # SQLAlchemy ORM models — one file per table (see § 4)
      user.py
      book.py              # also defines the book_authors / book_tags association tables
      author.py
      tag.py
      shelf.py
      user_book_status.py  # also defines the ReadStatus enum
    schemas/               # Pydantic request/response models — one file per API surface
      auth.py
      book.py              # the biggest one: BookCreate/Update/Out, StatusUpdate, IsbnLookup*, StatusCounts
      lookup.py            # generic NameOut (currently unused directly, kept for future lookup endpoints)
      stats.py
    api/                   # FastAPI routers — one file per resource
      deps.py              # get_current_user() — the auth dependency every protected route uses
      auth.py               # POST /auth/login, GET /auth/me
      books.py              # everything under /books — the largest, most important file (see § 6)
      lookups.py            # GET /authors, /tags, /shelves, /genres (autocomplete/filter sources)
      stats.py              # GET /stats
    services/               # business logic that isn't a thin DB query, reused across routes
      image_storage.py      # save an uploaded or downloaded cover image to disk
      isbn_lookup.py         # talk to Open Library, parse its response, download cover bytes
  alembic/
    env.py                  # Alembic runtime config — points at Settings.database_url, imports all models
    versions/
      0001_initial.py        # users, authors, tags, shelves, books, book_authors, book_tags, user_book_status
      0002_add_owned.py       # adds books.owned (wishlist support)
  scripts/
    seed_users.py            # create the household accounts (no public signup — see § 9)
    import_csv.py             # bulk-import books from a CSV
    sample_books.csv           # example CSV showing the expected columns
  Dockerfile
  pyproject.toml               # dependencies (see § 1) — no requirements.txt, this is the single source
  alembic.ini
```

## 3. Configuration & running locally

All settings are in `app/core/config.py`, read from environment variables (or
a `.env` file) via `pydantic-settings`:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://library:library@db:5432/library` | SQLAlchemy connection string. Point this at SQLite (`sqlite:////path/to.db`) for local testing without Docker. |
| `JWT_SECRET` | `change-me` | **Must** be overridden in any real deployment — signs every login token. Set via the root `.env` file (see `.env.example`). |
| `JWT_ALGORITHM` | `HS256` | Rarely needs changing. |
| `JWT_EXPIRES_MINUTES` | 20160 (14 days) | How long a login session lasts before the user has to log in again. |
| `UPLOADS_DIR` | `/app/uploads` | Where cover images are stored on disk. In Docker this is a mounted volume (`uploads_data` in `docker-compose.yml`) so covers survive container restarts. |

**Running via Docker (the normal path):** `docker compose up --build` from the
repo root brings up Postgres + backend + frontend together. The backend's
`Dockerfile` CMD runs `alembic upgrade head` before starting `uvicorn`, so
migrations are always applied automatically on startup — you never run them
by hand in the container.

**Running standalone (for debugging/scripting):** create a venv, `pip install
-e .` from `backend/`, set `DATABASE_URL` to a local Postgres or SQLite
instance, run `python -m alembic upgrade head`, then
`python -m uvicorn app.main:app --reload`. This is how the backend was
smoke-tested throughout development — see § 10.

## 4. Data model

Seven tables. The two decisions that shape everything else:

1. **Reading status is per-user, not per-book.** `user_book_status` is a
   separate table keyed by `(user_id, book_id)`, not a column on `books`.
   This is *the* central design decision of the whole schema: you and your
   wife share one physical library (one `books` row per physical book), but
   each of you tracks your own read/unread/rating/notes independently. If
   status lived on `books`, there would be no way to represent "finished for
   me, unread for her" on the same book.
2. **`owned` is a plain boolean on `books`, not a separate wishlist table.**
   A wishlist entry has exactly the same shape as an owned book (title,
   author, cover, genre, ...) — duplicating the model for "book you don't
   own yet" would just be two copies of the same thing to keep in sync.
   `GET /books` defaults to `owned=true`; the Wishlist page explicitly
   requests `owned=false`.

```
users               authors              tags                 shelves
  id                   id                   id                   id
  email                name                 name                 name
  password_hash
  display_name       (many-to-many with books via book_authors / book_tags)

books
  id, title, subtitle, isbn, publisher, publication_year, language,
  page_count, cover_image_path, description, genre, owned,
  shelf_id (FK → shelves, nullable), purchase_date, purchase_price,
  created_at, updated_at

user_book_status                              (unique on user_id+book_id)
  id, user_id (FK), book_id (FK),
  status (enum: unread/reading/finished/abandoned),
  rating (1-10, nullable, CHECK constraint enforces the range),
  notes (text, nullable),
  started_at, finished_at (dates, nullable),
  updated_at
```

Relationships (all defined in `app/models/`, see `book.py` for the
association tables):
- `Book.authors` / `Book.tags` — many-to-many via `book_authors` / `book_tags`.
- `Book.shelf` — many-to-one, `ON DELETE SET NULL` (deleting a shelf doesn't
  delete the books on it).
- `Book.statuses` — one-to-many to `UserBookStatus`, `cascade="all,
  delete-orphan"` (deleting a book cleans up everyone's status rows for it).
- `UserBookStatus.user_id` / `.book_id` — both `ON DELETE CASCADE`.

**A book with no `user_book_status` row for a given user is implicitly
"unread"** for that user — there's no row created eagerly on book creation.
This is why the status-filtering logic (§ 6) has a special case for the
`unread` filter: it has to mean "explicitly unread OR no row at all", not
just "row exists with status=unread".

## 5. Authentication

Flow: `POST /auth/login` with `{email, password}` → looks up the `User` by
email, verifies the password with `passlib` (bcrypt) → on success, signs a
JWT (`app/core/security.py::create_access_token`) with the user's email as
the `sub` claim and a 14-day expiry → returns `{access_token, token_type:
"bearer"}`.

Every protected route depends on `get_current_user` (`app/api/deps.py`):
it reads the `Authorization: Bearer <token>` header, decodes the JWT,
looks up the `User` by the `sub` (email) claim, and raises `401` if the
header is missing, the token is invalid/expired, or the user no longer
exists. There is **no public signup endpoint** — accounts are created via
`scripts/seed_users.py` only (§ 9), because this is a 2-person household app,
not a public product.

There's no token refresh mechanism — when a token expires, the frontend's
axios interceptor (see `docs/FRONTEND.md` § 6) catches the `401` and redirects
to `/login`. The user just logs in again for another 14 days.

## 6. API reference

Base URL in development: `http://localhost:8000`. Interactive docs (Swagger
UI) are always available at `/docs` while the server is running — that's the
fastest way to explore request/response shapes hands-on.

### `auth.py`
| Method & path | Auth? | Purpose |
|---|---|---|
| `POST /auth/login` | No | `{email, password}` → `{access_token, token_type}` |
| `GET /auth/me` | Yes | Returns the current user's `{id, email, display_name}` |

### `books.py` — the core resource
All routes are prefixed `/books` and require auth. **Route ordering matters
here**: `/books/lookup` and `/books/export` are registered *before*
`/books/{book_id}` in the file, because FastAPI/Starlette matches routes in
declaration order and `{book_id}: int` would otherwise try (and fail) to
parse `"lookup"`/`"export"` as an integer.

| Method & path | Purpose | Notes |
|---|---|---|
| `GET /books` | List/search/filter books, paginated | See "Filtering" below. Returns `BookListOut`: `items`, `total`, `limit`, `offset`, and `status_counts` (a breakdown of unread/reading/finished/abandoned for the *current user*, computed over whatever the filters match — used for the Table page's footer). |
| `POST /books` | Create a book | Body: `BookCreate`. If `cover_url` is set (from an ISBN lookup) and no file is uploaded separately, the server downloads that image and stores it — see § 7.3. |
| `GET /books/lookup?isbn=...` | Look up metadata by ISBN | Calls Open Library, returns `IsbnLookupResult`. Also checks your own DB for a duplicate (by ISBN, or by title+author if the ISBN itself doesn't match) — see § 7.2. |
| `GET /books/export` | Export the (filtered) list as `.xlsx` | Same filter params as `GET /books`, no pagination — exports every matching row. Returns a binary `Response` with `Content-Disposition: attachment`. |
| `GET /books/{id}` | Get one book | 404 if not found. |
| `PATCH /books/{id}` | Update a book | Body: `BookUpdate` (all fields optional; only fields explicitly sent are changed, via Pydantic's `exclude_unset`). Same `cover_url` handling as create. |
| `DELETE /books/{id}` | Delete a book | Cascades to `user_book_status` rows and the author/tag association rows. |
| `POST /books/{id}/cover` | Upload a cover image file | Multipart upload, max 10MB, must be jpeg/png/webp. |
| `PATCH /books/{id}/status` | Upsert *your* reading status for this book | Body: `StatusUpdate` (status/rating/notes/started_at/finished_at, all optional). Creates the `user_book_status` row if one doesn't exist yet. |

**Filtering** (shared by `GET /books` and `GET /books/export` via
`_apply_common_filters` + `_filter_by_status`):

| Query param | Behavior |
|---|---|
| `search` | Case-insensitive substring match across title, subtitle, ISBN, publisher, author names, and tag names |
| `genre` | Exact match |
| `shelf` | Exact match on shelf name |
| `author` / `tag` | Exact match against any linked author/tag |
| `year_min` / `year_max` | Inclusive range on `publication_year` |
| `owned` | `true` (default — the main Gallery/Table), `false` (Wishlist page) |
| `status` | The *current user's* status for that book. `unread` is special-cased: it means "explicitly marked unread, OR no status row exists at all" (see § 4) |

Author/tag/shelf/search filters are implemented with SQLAlchemy's
`.any()`/`.has()` relationship comparators (correlated `EXISTS` subqueries)
rather than explicit `.join()` calls. This was a deliberate fix during
development: explicit joins meant that combining, say, an `author` filter
with a `search` filter tried to join `Book.authors` twice, which either
duplicated rows or broke the SQL outright. `.any()`/`.has()` sidesteps that
entirely and also avoids needing `.distinct()` to dedupe join fan-out.

### `lookups.py` — filter/autocomplete sources
| Method & path | Purpose |
|---|---|
| `GET /authors` | All author names, sorted |
| `GET /tags` | All tag names, sorted |
| `GET /shelves` | All shelf names, sorted |
| `GET /genres` | Distinct genre values currently in use across `books` |

These back the sidebar filter facets and the autocomplete `<datalist>` on the
book form. They're intentionally simple — no pagination, since even a large
personal library has at most a few hundred distinct values here.

### `stats.py`
| Method & path | Purpose |
|---|---|
| `GET /stats` | Everything on the Stats page — see § 7.5 for how each number is derived |

## 7. Key business logic, explained

### 7.1 Per-user status isolation
Every place a `Book` is serialized to `BookOut`, the caller separately loads
the current user's `UserBookStatus` row (via `_load_statuses`, which batches
by `book_id IN (...)` rather than querying once per book) and attaches it as
`my_status`. There is no ORM relationship traversal like `book.my_status` —
it's always assembled explicitly per-request, per-user, precisely so that
one user's status can never leak into another's response.

### 7.2 ISBN lookup & duplicate detection (`services/isbn_lookup.py`, `books.py::lookup_isbn`)
1. Strip dashes/spaces from the input ISBN.
2. Query your own DB for a `Book` with that exact ISBN. If found, that's
   `already_in_library` immediately.
3. Call Open Library's `GET /api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`.
   This single endpoint returns title, subtitle, authors, publisher,
   publish_date, page count, and a cover image URL all at once — chosen over
   the plainer `/isbn/{isbn}.json` endpoint specifically because it avoids a
   second round-trip to resolve author names.
4. `fetch_isbn_metadata`/`download_cover_bytes` retry up to 3 times with a
   short delay — this was added after observing real, intermittent
   connection resets to Open Library during development. A flaky external
   API shouldn't make the whole lookup feature flaky.
5. If the ISBN wasn't already in your DB but the *title* (case-insensitive)
   matches an existing book AND the author overlaps (or the lookup found no
   author info at all), that's also treated as a duplicate — this catches
   the case where you already own a different edition of the same book
   under a different ISBN.
6. The response includes a `cover_url` (pointing at Open Library's CDN, not
   your own server) purely for the frontend to show a preview before saving.

### 7.3 Cover images (`services/image_storage.py`)
Two entry points, one storage function:
- `save_cover_image(file, contents)` — validates content-type (jpeg/png/webp
  only), used by the direct file-upload endpoint.
- `save_cover_bytes(content, extension)` — the lower-level primitive, also
  called directly by `create_book`/`update_book` when a `cover_url` was
  supplied (from ISBN lookup) instead of an uploaded file.

Either way, the image is written to `{UPLOADS_DIR}/covers/{uuid}.{ext}` and
`Book.cover_image_path` stores the relative path (`covers/xxxx.jpg`) — never
the external URL. This is deliberate: once a cover is fetched, it's copied
into your own storage so the library keeps working even if Open Library is
down or the image disappears from their CDN later ("own your data").

### 7.4 Excel export
`export_books` reuses the exact same filter functions as `GET /books` (no
duplicated filter logic), just without pagination — `.all()` instead of
`.offset().limit()`. Builds an `openpyxl.Workbook` in memory (never touches
disk), bolds the header row, auto-sizes column widths based on the longest
value in each column (capped between 10–40 characters), and returns it as a
raw `Response` with the `.xlsx` MIME type and a `Content-Disposition:
attachment` header so the browser downloads it directly rather than trying
to render it.

### 7.5 Reading-pace statistics (`stats.py`)
The trickiest part: **`pages_read_total`** counts every book you've marked
`finished`, regardless of whether it has a `finished_at` date — but the
**period breakdowns** (`reading_this_week/month/year`) and the **averages**
only use entries that *do* have a `finished_at` date, because an undated
"finished" book can't be placed into a specific week/month/year bucket or
contribute meaningfully to a time-based rate. This means `pages_read_total`
can legitimately be higher than what the averages/periods would suggest if
you have older books marked finished without a date attached.

Averages are all derived from a single per-day rate
(`books_per_day = count / days_since_first_dated_finish`) and then scaled by
7 / 30.44 / 365.25 — not computed independently per period — so they stay
internally consistent (e.g. `books_per_year` is always exactly
`books_per_day × 365.25`, never a separately-rounded number that could
contradict it).

## 8. Database migrations

Two migrations exist today:
- `0001_initial.py` — the full v1 schema (all seven tables).
- `0002_add_owned.py` — adds the `books.owned` boolean column
  (`server_default=true`, so every pre-existing row is treated as owned)
  when the wishlist feature was added.

**To add a new migration:** add/modify the SQLAlchemy model, then either
hand-write a migration (as both existing ones are — no autogenerate was used,
to keep full control over the exact SQL) following the same pattern:
`upgrade()`/`downgrade()`, a fixed `revision` string, `down_revision` pointing
at the previous one. Run `alembic upgrade head` locally against your dev
database to verify it applies cleanly before committing. In Docker, the next
`docker compose up` applies it automatically.

## 9. Scripts

Run these via `docker compose exec backend python -m scripts.<name>` (or
directly with the venv if running standalone).

- **`seed_users.py <email> <name> [<email> <name> ...]`** — creates one or
  more accounts. Prompts for each password interactively (never as a CLI
  arg, so it never ends up in shell history). This is the *only* way to
  create accounts — there's no signup form or API endpoint.
- **`import_csv.py <path.csv>`** — bulk-loads books from a CSV (see
  `sample_books.csv` for the expected columns: title, subtitle, authors,
  isbn, publisher, publication_year, language, page_count, description,
  genre, tags, shelf, purchase_date, purchase_price — `authors`/`tags` are
  semicolon-separated). Safe to re-run: it skips rows that already match an
  existing book by title+author before inserting.

## 10. How this backend has been tested

There's no formal `pytest` suite checked into the repo. Instead, correctness
has been verified throughout development with standalone smoke-test scripts
using FastAPI's `TestClient` against a temporary SQLite database — creating
users, logging in, exercising every endpoint, and specifically asserting the
per-user isolation behavior (e.g. two accounts marking the same book with
different statuses and confirming neither leaks into the other's view). If
you're adding a new endpoint or changing filter logic, the fastest way to
verify it is the same pattern: spin up `TestClient(app)` against a fresh
SQLite file, migrate it, seed a couple of users, and hit the API directly.

## 11. Common maintenance tasks

**Add a new field to `Book`:**
1. Add the column to `app/models/book.py`.
2. Write a new Alembic migration (`alembic/versions/000N_description.py`)
   adding that column, following the pattern in `0002_add_owned.py`.
3. Add the field to `BookBase` (so it's on both create and read) or
   `BookOut` only (if it's server-computed) in `app/schemas/book.py`.
4. If it should be settable via `PATCH`, also add it to `BookUpdate`.
5. Update `_to_book_out` in `books.py` to include it.
6. Update the frontend's `Book`/`BookFormValues` types and the relevant form
   field (see `docs/FRONTEND.md`).

**Add a new filter to `GET /books`:**
1. Add the query parameter to `list_books` (and `export_books`, if it should
   apply to exports too — it almost always should).
2. Add the filtering logic to `_apply_common_filters` (or `_filter_by_status`
   if it's per-user like reading status).
3. Both `list_books` and `export_books` call the same shared function, so
   you only write the SQL once.

**Reset a user's password:** there's no "forgot password" flow. Log into the
container/venv and hash a new password with
`app.core.security.hash_password`, then update the `users.password_hash`
column directly (or just re-run `seed_users.py` — it skips existing emails,
so you'd need to delete the row first, or add a small one-off script).

**Change how long login sessions last:** `JWT_EXPIRES_MINUTES` in the
environment (see § 3) — no code change needed.
