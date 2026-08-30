# Frontend Documentation

This is the reference for maintaining the React frontend. It assumes no prior
context — if you're picking this project back up after a while, start here.
For the API this talks to, see `docs/BACKEND.md`.

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript | Standard, typed |
| Build tool | Vite | Fast dev server, simple config, first-class PWA plugin |
| Styling | Tailwind CSS (utility classes) | No component library — every visual element is hand-built with Tailwind, wired to a themeable token system (§ 6) |
| Server state | TanStack Query (`@tanstack/react-query`) | Caching, refetching, and cache invalidation for all API data — no manual `useEffect` fetch code anywhere |
| Table | TanStack Table (`@tanstack/react-table`) | Powers the sortable Table view |
| HTTP client | axios | Interceptors for auth header injection + 401 handling (§ 5) |
| Routing | react-router-dom v6 | Client-side routing, all routes in `App.tsx` |
| Barcode scanning | `@zxing/browser` | Decodes EAN-13 barcodes from the phone camera — lazy-loaded (§ 8) since it's ~400KB and most sessions never open the scanner |
| PWA | `vite-plugin-pwa` | Installable app, service worker, manifest — only active in production builds |

No component library (no MUI/Chakra/shadcn), no Redux/Zustand — app-wide
state is a handful of small React Contexts (§ 5), and there's no dedicated
form library either — forms are plain controlled `useState`. All of this is
deliberate: the app is small enough that these dependencies would add more
overhead than value.

## 2. Project structure

```
frontend/
  src/
    main.tsx              # Entrypoint — mounts React, wraps the app in every provider (order matters, see § 5)
    App.tsx                # All routes + the AppLayout shell (Navbar + scrollable <main>)
    index.css               # Tailwind directives + all theme CSS variables (§ 6)
    vite-env.d.ts             # Vite's ambient types

    pages/                    # One file per route — see § 9
      Login.tsx
      Gallery.tsx
      TableView.tsx
      Stats.tsx
      BookForm.tsx             # shared by "Add book" and "Edit book"
      BookDetail.tsx
      Wishlist.tsx

    components/                # Reusable pieces used by 2+ pages — see § 8
      Navbar.tsx
      FilterSidebar.tsx
      BookCard.tsx
      BookGrid.tsx               # paginated grid of BookCards, used by Gallery + Wishlist
      Carousel.tsx                # horizontally-scrolling row with slide buttons, used by Gallery's genre rows
      BarcodeScanner.tsx           # camera barcode scanner modal, lazy-loaded
      ProtectedRoute.tsx            # redirects to /login if not authenticated

    api/                          # Thin wrappers around the backend — one function per endpoint
      client.ts                    # axios instance, auth header injection, 401 handling, cover URL helper
      auth.ts                      # login, fetchMe
      books.ts                     # everything under /books, /stats, /authors, /tags, /shelves, /genres

    lib/                           # App-wide state & small utilities — see § 5-7
      AuthContext.tsx
      ThemeContext.tsx
      LanguageContext.tsx
      ToastContext.tsx
      statusLabels.ts                # single source of truth for translated status labels (§ 7)
      useDebouncedValue.ts
      compressImage.ts                # client-side cover image resize before upload
      i18n/
        en.ts
        uz.ts

    types/                          # TypeScript types mirroring the backend's Pydantic schemas
      book.ts
      stats.ts
      lookup.ts

  index.html                        # theme-color/apple-touch-icon meta tags, body carries the base canvas/ink classes
  vite.config.ts                     # path alias (@/ → src/), PWA plugin config
  tailwind.config.js                  # maps theme tokens to CSS variables (§ 6)
  package.json
```

## 3. Running locally

**Via Docker (normal path):** `docker compose up --build` from the repo root
runs this alongside the backend, served at `http://localhost:5173`. The
`VITE_API_URL` environment variable (defaulting to `http://localhost:8000` in
`api/client.ts`) tells it where the backend lives.

**Standalone (faster iteration):** `npm install && npm run dev` inside
`frontend/` — starts the Vite dev server with hot module reload. Point it at
any running backend via `VITE_API_URL`. `npm run build` produces the
production bundle (and, critically, the PWA service worker — see § 10, which
never gets generated in dev mode). `npx tsc -b --noEmit` typechecks without
building — run this after any change, it's fast and catches almost every
mistake before you even open a browser.

## 4. Routing

All routes are declared in `App.tsx`. Every route except `/login` is wrapped
in `<ProtectedRoute>` (redirects to `/login` if not authenticated) and
`<AppLayout>` (the persistent shell: a fixed-height `Navbar` + a single
scrollable `<main>` — see the layout note in § 9's Gallery/TableView
description for why this matters).

| Path | Page | Notes |
|---|---|---|
| `/login` | `Login` | Redirects to `/` if already authenticated |
| `/` | `Gallery` | Home/genre-row view, or a flat grid when filtered/"All Books" |
| `/table` | `TableView` | Sortable, paginated, exportable |
| `/stats` | `Stats` | KPI tiles, reading pace, genre/decade breakdown |
| `/wishlist` | `Wishlist` | Same components as Gallery, filtered to `owned=false` |
| `/books/new` | `BookForm` (mode="create") | Accepts `?owned=false` to preset the wishlist checkbox |
| `/books/:id` | `BookDetail` | View + status/rating/notes editor |
| `/books/:id/edit` | `BookForm` (mode="edit") | Same component as create, prefilled |
| `*` (anything else) | redirects to `/` | |

## 5. State management

Two distinct kinds of state, handled two different ways:

**Server state (anything that lives in the database)** — always TanStack
Query. Every page fetches via `useQuery` and mutates via `useMutation`. Query
keys follow a simple array convention: `["books", "table", filters]`,
`["book", bookId]`, `["stats"]`, `["genres"]`, etc. — the filters/params
object is included directly in the key so changing a filter automatically
triggers a refetch (React Query treats a different key as a different cache
entry). Mutations call `queryClient.invalidateQueries({queryKey: ["books"]})`
after success to force every book-list view to refetch, and often also
`queryClient.setQueryData(["book", id], updated)` to update the single-book
cache immediately without waiting for a refetch.

**App-wide UI state (not server data)** — four separate React Contexts,
each with one job, each following the exact same shape (a `Provider`
component + a `useXyz()` hook that throws if called outside the provider):

| Context | File | Persists to | Purpose |
|---|---|---|---|
| `AuthContext` | `lib/AuthContext.tsx` | JWT in `localStorage` (via `api/client.ts`) | Current user, login/logout |
| `ThemeContext` | `lib/ThemeContext.tsx` | `localStorage["library_theme"]` | Selected theme, sets `<html data-theme>` |
| `LanguageContext` | `lib/LanguageContext.tsx` | `localStorage["library_language"]` | Selected language, the `t()` translator function |
| `ToastContext` | `lib/ToastContext.tsx` | Not persisted (ephemeral) | `showToast(message, kind?)` — renders a stack of auto-dismissing toasts |

They're deliberately **separate** contexts rather than one big "app state"
context — each is small, independently testable, and a component that only
needs `useTranslation()` doesn't have to know `useTheme()` or `useAuth()`
exist. Provider nesting order in `main.tsx` is
`QueryClientProvider → BrowserRouter → ThemeProvider → LanguageProvider →
AuthProvider → ToastProvider → App`. The only order dependency that actually
matters: `ThemeProvider`/`LanguageProvider` must be above `App` since
`Navbar` (rendered inside `App`) uses both.

## 6. API layer (`src/api/`)

`client.ts` is the foundation everything else builds on:
- `api` — a shared axios instance with `baseURL: API_URL`.
- A request interceptor attaches `Authorization: Bearer <token>` to every
  request if a token is stored.
- A response interceptor watches for `401` — on any unauthorized response, it
  clears the stored token and hard-redirects to `/login` (via
  `window.location.href`, not React Router, since at that point the app's
  auth state is invalid anyway).
- `coverUrl(path)` — turns the backend's relative `cover_image_path`
  (`"covers/xxxx.jpg"`) into a full URL against `API_URL`.

`auth.ts` and `books.ts` are thin — each function is a one-line axios call
returning a typed response. `books.ts` also holds `exportBooksExcel()`,
which is the one exception: it requests `responseType: "blob"` since the
response is a binary `.xlsx` file, not JSON, and the frontend triggers a
browser download from the blob manually (see `TableView.tsx`'s
`handleExport`).

## 7. Theming system

The visual language is entirely driven by CSS custom properties, not
hardcoded Tailwind colors. This is what makes 7 themes (and adding an 8th)
cheap.

**The architecture:**
1. `index.css` defines 13 `--color-*` custom properties under `:root` (the
   default — currently "Dark") and one `:root[data-theme="X"] { ... }` block
   per other theme, each overriding all 13.
2. `tailwind.config.js` maps each token to a Tailwind color name via
   `rgb(var(--color-x) / <alpha-value>)` — the `<alpha-value>` placeholder is
   what lets Tailwind's opacity modifiers (`bg-canvas/80`) keep working even
   though the actual color is a runtime CSS variable.
3. `ThemeContext` sets `document.documentElement.dataset.theme = theme` —
   that's the *only* thing that changes at runtime; the CSS variables do the
   rest via the cascade.
4. Every component uses the Tailwind classes generated from those tokens
   (`bg-canvas`, `bg-surface`, `border-line`, `text-ink-secondary`,
   `bg-accent text-on-accent`, ...) — never a raw Tailwind color like
   `bg-neutral-800`.

**The 10 (+3) tokens and their job:**

| Token | Role |
|---|---|
| `canvas` | Page background |
| `surface` | Card/panel background |
| `surface-hover` | Hover/active state for things sitting on `surface` (nav links, sidebar buttons, table row hover) |
| `line` / `line-strong` | Decorative divider vs. a more visible border (inputs, checkboxes, table grid lines) |
| `ink` / `ink-secondary` / `ink-muted` | Three text-prominence tiers |
| `accent` / `accent-hover` | Primary action color (buttons, active nav item, links) and its hover state |
| `on-accent` | Text color to use *on top of* `accent`/`accent-hover` — chosen per-theme based on actual contrast, not assumed |
| `stat` / `stat-ink` / `stat-ink-muted` | A special override used only by the Stats page's KPI tiles — see below |

**What's deliberately *not* themed:** delete/danger actions stay `red-*`,
the "owned" badge stays `emerald-*`, and rating stars stay `amber-*` in
every theme — these are universal status/meaning colors, not decorative
branding, so they don't shift with the cosmetic theme. Modal scrims
(the barcode scanner overlay, the mobile filter drawer backdrop) also stay a
fixed `bg-black/60`–`/90` regardless of theme, since a dark overlay behind a
dialog is a convention, not a brand color.

**The `stat` token exists because of a specific request:** the Plum and Lime
themes give their Stats-page KPI cards (`StatTile`/`PeriodTile` in
`Stats.tsx`) a distinctly darker background than the rest of the UI — Plum
uses the palette's Royal Indigo, Lime uses a dark olive *derived* at the same
hue as its bright accent (since that palette had nothing dark enough given).
Every other theme just sets `stat-surface`/`stat-ink`/`stat-ink-muted` equal
to the regular `surface`/`ink`/`ink-muted`, so this is a no-op for them.

**Every theme's exact token values were derived from real hex codes the user
supplied**, and every text/background and accent/on-accent pairing was
verified against WCAG contrast ratios (computed via the relative-luminance
formula, not eyeballed) before being committed — see the git history/commit
messages around the theming work for the specific numbers. When a given
palette's colors were too close in lightness to serve as a visible border,
they were still used (borders are treated as purely decorative, no strict
contrast requirement) — but when a color was too light to pair with white
button text, dark text was used on it instead (this is why Sky, Seaside*, and
Plum's buttons use dark text while Blue and Light's use white).

**To add a new theme:**
1. Pick/derive hex values for all 13 tokens (reuse an existing theme's
   `stat-*` = `surface`/`ink`/`ink-muted` unless you specifically want a
   distinct Stats-page look).
2. Add a `:root[data-theme="yourtheme"] { ... }` block to `index.css` with
   all 13 `--color-*` properties as space-separated `R G B` triples (not
   hex — that's the format Tailwind's `rgb(var(...) / <alpha-value>)`
   pattern needs).
3. Add `{ value: "yourtheme", label: "Your Theme" }` to the `THEMES` array in
   `ThemeContext.tsx`.
4. That's it — every component picks it up automatically, since none of them
   reference theme names directly.

## 8. i18n system

Two languages today: English (`en`) and Uzbek Latin (`uz`), in
`src/lib/i18n/en.ts` / `uz.ts`. Hand-rolled rather than a library like
`react-i18next` — the app's translatable surface (UI chrome only, not your
book data) doesn't need pluralization rules or ICU message format, so a
small custom context was simpler and lighter than a full i18n library.

**How it works:**
- Each dictionary is a nested plain object, namespaced by feature
  (`nav.gallery`, `bookForm.saveError`, `stats.thisWeek`, ...).
- `uz.ts` is typed as `const uz: typeof en = {...}` — this is the important
  bit: TypeScript will refuse to compile if the Uzbek dictionary is missing a
  key, has an extra one, or nests something differently than `en.ts`. A
  translation typo becomes a compile error, not a silently-broken string in
  production.
- `LanguageContext.tsx` derives a `TranslationKey` type — a recursive
  `Path<T>` utility type that walks the `en` object's shape and produces the
  literal union of every valid dot-path (`"nav.gallery" | "bookForm.saveError"
  | ...`). `t()` is typed to only accept keys from that union, so
  `t("nav.gallry")` (typo) is also a compile error, not a runtime "shows the
  raw key" bug.
- Interpolation is simple `{name}` placeholder substitution (not ICU
  pluralization) — e.g. `bookGrid.paginationRange: "{start}-{end} of
  {total}"`, called as `t("bookGrid.paginationRange", {start, end, total})`.
  Uzbek's word order for the same string is genuinely different
  (`"{total} tadan {start}-{end}"`), which is exactly why templates live in
  the dictionary rather than being assembled in component code.
- Selecting a language sets `document.documentElement.lang` and persists to
  `localStorage`, mirroring the theme system exactly.

**Duplicated status labels were consolidated**: `"Unread"/"Reading"/
"Finished"/"Abandoned"` used to be defined independently in four different
files. `lib/statusLabels.ts` now provides `useStatusLabels()` (a
`Record<ReadStatus, string>` lookup) and `useStatusOptions()` (a
`{value, label}[]` list for dropdowns/buttons) — every component that needs
status labels uses one of these instead of its own copy.

**To add a new translated string:** add the key to `en.ts`, add the matching
key (same nesting) to `uz.ts` — tsc will fail loudly if you forget or
mis-nest it — then use `t("your.new.key")` in the component (via
`const { t } = useTranslation()`).

**To add a third language:** add `frontend/src/lib/i18n/xx.ts` typed as
`const xx: typeof en = {...}`, import it into `LanguageContext.tsx`, add it
to the `DICTIONARIES` record and the `LANGUAGES` array.

**Not translated, by design:** your actual library data — book titles,
author names, genres, tags, notes — is your content, in whatever language you
entered it. Only UI chrome (labels, buttons, messages) goes through `t()`.

## 9. Pages reference

- **`Login.tsx`** — email/password form. Includes its own small language
  switcher (in addition to the one in `Navbar`) since the Navbar isn't
  rendered pre-login.
- **`Gallery.tsx`** — two views toggled by local state: "Home" (genre-row
  carousels, built by fetching `/genres` then one parallel query per genre
  via `useQueries`, plus "Recently Added" and "Unread" rows) and "All Books"
  (a flat `BookGrid`). Switches to the flat grid automatically whenever any
  sidebar filter is active, regardless of which tab is selected.
- **`TableView.tsx`** — TanStack Table with client-side sorting on the
  currently-loaded page (sorting doesn't refetch — see § notes below),
  server-side pagination (50/page), a sticky header, and full grid borders
  (`border-line-strong` on every cell, not just row dividers). The
  columns array is built with `useMemo` *inside* the component (not at
  module scope) specifically because column headers need `t()` — hooks
  can't be called from module-level code.
- **`Stats.tsx`** — `StatTile` (single number), `PeriodTile` (books+pages for
  a time period), `AveragesTable`, and `BarList` (genre/decade breakdown,
  plain CSS-width bars, no chart library). See `docs/BACKEND.md` § 7.5 for
  how the numbers are computed.
- **`BookForm.tsx`** — shared by create and edit (`mode` prop). The largest
  page: ISBN lookup (manual entry + camera scan), duplicate-title detection
  (debounced search-as-you-type against `GET /books`), client-side cover
  compression before upload, and the full field set. `BarcodeScanner` is
  `React.lazy`-loaded specifically to keep it out of the main bundle (see
  § 1) — wrapped in `<Suspense>` with a loading fallback.
- **`BookDetail.tsx`** — view + the per-user status editor (status buttons,
  started/finished date pickers, 1-10 rating, notes textarea). Clicking
  "Reading" or "Finished" auto-stamps today's date into `started_at`/
  `finished_at` *only if not already set* — the date inputs remain directly
  editable afterward for backdating. The status/rating/notes section is
  hidden entirely for wishlist (non-owned) books, replaced by a "Mark as
  owned" button.
- **`Wishlist.tsx`** — same `FilterSidebar`/`BookGrid` as Gallery, hardcoded
  to `owned=false` (the filter-change handler re-asserts `owned: false` on
  every change so "Clear filters" can't accidentally show owned books here).

**Layout note applying to `Gallery`/`TableView`/`Wishlist`:** the app shell
(`AppLayout` in `App.tsx`) is `h-dvh` with `overflow-hidden`, and `<main>` is
the *only* scrolling element (`overflow-y-auto`). `TableView` additionally
makes its own root `h-full` with an internal `overflow-auto` region around
just the `<table>`, so the sticky header and footer/pagination stay pinned
while only the rows scroll — this was a deliberate fix for the table
otherwise growing the whole page and losing the footer off-screen.

## 10. Key components reference

- **`Navbar.tsx`** — nav links, language `<select>`, theme `<select>`, user
  name, logout. Horizontally scrollable on narrow screens (`overflow-x-auto`
  with `scrollbar-hide`) rather than collapsing into a hamburger menu.
- **`FilterSidebar.tsx`** — shared by Gallery/TableView/Wishlist. Static
  sidebar on `sm+` screens, a slide-in drawer behind a "Filters" button
  (with an active-filter-count badge) on mobile. Each facet (Genre, Reading
  status, Shelf, Tags, Year) is a `CollapsibleSection` — collapsed by default
  except Reading status, since genre/tag lists can get long on a real
  library. The search input is locally debounced (300ms via
  `useDebouncedValue`) before it's pushed into the parent's `filters` state,
  so typing doesn't fire a request per keystroke.
- **`BookCard.tsx`** — the gallery/grid tile: cover image (or a text
  fallback if no cover), title, star rating, status label, and a "Wishlist"
  badge overlay when `!book.owned`.
- **`BookGrid.tsx`** — `BookCard`s in a wrapping flex grid + Prev/Next
  pagination. Takes the already-fetched `data`/`isLoading` as props rather
  than fetching itself, so Gallery and Wishlist each own their own query but
  share the rendering.
- **`Carousel.tsx`** — the horizontally-scrolling row behind Gallery's genre
  rows. Native touch/swipe scrolling (it's a real scrollable `overflow-x-auto`
  div) *plus* optional slide arrow buttons on `sm+` screens for mouse users.
  The arrows only render when there's actually more to scroll in that
  direction (`canScrollLeft`/`canScrollRight`, tracked via scroll position +
  a `ResizeObserver`) — this was a deliberate fix: showing a "scroll left"
  affordance/gradient when already at the start of the row was visually
  obscuring the first card.
- **`BarcodeScanner.tsx`** — full-screen camera modal using
  `@zxing/browser`'s `decodeFromConstraints` with `facingMode: "environment"`
  (prefers the rear camera). Stops the camera stream (`controls.stop()`) both
  on successful detection and on unmount/close, so the camera is never left
  running in the background.
- **`ProtectedRoute.tsx`** — the auth gate. Shows a loading state while
  `AuthContext` is still resolving the stored token, then either renders
  `children` or redirects to `/login`.

## 11. PWA setup

Configured via `vite-plugin-pwa` in `vite.config.ts` (`registerType:
"autoUpdate"`), with a manifest (name, theme color matching the Dark theme's
canvas, two generated icon sizes in `public/icons/`) and `index.html`'s
`apple-touch-icon`/`theme-color`/`apple-mobile-web-app-*` meta tags for iOS
"Add to Home Screen" support.

**Important:** the service worker and manifest are only generated by
`npm run build` (production mode) — `npm run dev` will never show an install
prompt or register a service worker, by design (dev mode doesn't precache
anything meaningful). To actually test PWA installability, run
`npm run build && npm run preview`, or use the real Docker deployment.

## 12. Common maintenance tasks

**Add a new page:** create `pages/YourPage.tsx`, add a `<Route>` in
`App.tsx` wrapped in `<ProtectedRoute><AppLayout>...</AppLayout></ProtectedRoute>`
(unless it's a pre-login page like `Login`), add a nav link in `Navbar.tsx`
using `t("nav.yourPage")` (add that key to both `en.ts` and `uz.ts` first).

**Add a new field to the book form:** add it to `BookFormValues` in
`types/book.ts`, add a `<Field>` in `BookForm.tsx`'s JSX, add the
corresponding translation key(s), and make sure the backend's
`BookCreate`/`BookUpdate`/`BookOut` schemas already support it (see
`docs/BACKEND.md`).

**Add a new translated string:** see § 8.

**Add a new theme:** see § 7.

**Add a new API call:** add a typed function to the relevant file in
`src/api/` (following the existing one-function-per-endpoint pattern), add
any new response type to `src/types/`, then call it via `useQuery`/
`useMutation` in the page/component that needs it — never call `api.get/post`
directly from a component.
