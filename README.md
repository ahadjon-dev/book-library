# My Library

A personal book library — gallery + table views, search/filter, per-user reading status/rating/notes for a shared household collection.

## Run it

```bash
cp .env.example .env   # set a real JWT_SECRET
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000 (docs at /docs)

On first run, the backend applies migrations automatically. Then create your accounts:

```bash
docker compose exec backend python -m scripts.seed_users \
  you@example.com "Your Name" \
  wife@example.com "Her Name"
```

You'll be prompted for a password for each account (typed, not passed as an argument, so it never ends up in shell history).

## Bulk-import your existing collection

If you have ~300 books to bootstrap, put them in a CSV (see `backend/scripts/sample_books.csv` for the expected columns) and run:

```bash
docker compose exec backend python -m scripts.import_csv scripts/your_books.csv
```

Re-running the script is safe — it skips books that already exist (matched on title + authors).

## What's here

- Manual add/edit with cover image upload (auto-compressed client-side before it's sent)
- ISBN lookup on add — type an ISBN or scan the barcode with your phone camera to auto-fill title/author/year/pages/cover (via Open Library's free API); warns if the book's already in your library or wishlist, and warns on likely duplicate titles too
- Gallery view (Netflix-style genre rows, swipeable) and a full-text Table view with sticky header and pagination
- Wishlist — track books you don't own yet; "Mark as owned" moves one straight into your library
- Export the (optionally filtered) table to an `.xlsx` file
- Stats dashboard — totals, status breakdown, genre/decade charts
- Search + sidebar filters: genre, tag, author, shelf, status, year range — collapsible, debounced search
- Per-user reading status, 1-10 rating, and notes — shared library, independent progress for each account
- Installable as a PWA (add to home screen) for a native-feeling mobile experience
- Mobile-responsive throughout: collapsible filter drawer, sticky nav, touch-friendly controls
- 7 themes (Dark, Onyx, Sky, Plum, Blue, Light, Lime), switchable per person, no page reload
- English and Uzbek (Latin) — switchable from the nav bar or the login screen

Not built yet: OCR bulk import (photograph a shelf, auto-detect covers), collections (custom groupings beyond genre/tags), a borrowing tracker.

## Documentation

For how any of this actually works under the hood — data model, API
reference, the theming/i18n architecture, and step-by-step maintenance
guides — see:

- [`docs/BACKEND.md`](docs/BACKEND.md)
- [`docs/FRONTEND.md`](docs/FRONTEND.md)
