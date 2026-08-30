import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { createBook, fetchBook, fetchBooks, fetchShelves, lookupIsbn, updateBook, uploadCover } from "@/api/books";
import { coverUrl } from "@/api/client";
import { compressImage } from "@/lib/compressImage";
import { useTranslation } from "@/lib/LanguageContext";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useToast } from "@/lib/ToastContext";
import { ShelfPhotoScanner } from "@/components/ShelfPhotoScanner";
import type { Book, BookFormValues } from "@/types/book";
import type { IsbnLookupMatch } from "@/types/lookup";

// Lazy-loaded: @zxing/browser adds ~400KB and most page loads never open the scanner.
const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
);

const EMPTY_FORM: BookFormValues = {
  title: "",
  subtitle: null,
  isbn: null,
  publisher: null,
  publication_year: null,
  language: null,
  page_count: null,
  description: null,
  genre: null,
  owned: true,
  purchase_date: null,
  purchase_price: null,
  authors: [],
  tags: [],
  shelf: null,
};

function toInputList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function BookForm({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const bookId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { data: existing } = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => fetchBook(bookId!),
    enabled: mode === "edit" && bookId !== undefined,
  });
  const { data: shelves = [] } = useQuery({ queryKey: ["shelves"], queryFn: fetchShelves });

  const [form, setForm] = useState<BookFormValues>(() => ({
    ...EMPTY_FORM,
    owned: searchParams.get("owned") !== "false",
  }));
  const [authorsInput, setAuthorsInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupMatch, setLookupMatch] = useState<IsbnLookupMatch | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showShelfScanner, setShowShelfScanner] = useState(false);
  const [titleMatch, setTitleMatch] = useState<Book | null>(null);
  const debouncedTitle = useDebouncedValue(form.title, 400);

  useEffect(() => {
    const query = debouncedTitle.trim();
    if (mode !== "create" || query.length < 3) {
      setTitleMatch(null);
      return;
    }

    let cancelled = false;
    fetchBooks({ search: query, limit: 5 }).then((result) => {
      if (cancelled) return;
      const match = result.items.find((b) => b.title.trim().toLowerCase() === query.toLowerCase());
      setTitleMatch(match ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedTitle, mode]);

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        subtitle: existing.subtitle,
        isbn: existing.isbn,
        publisher: existing.publisher,
        publication_year: existing.publication_year,
        language: existing.language,
        page_count: existing.page_count,
        description: existing.description,
        genre: existing.genre,
        owned: existing.owned,
        purchase_date: existing.purchase_date,
        purchase_price: existing.purchase_price,
        authors: existing.authors,
        tags: existing.tags,
        shelf: existing.shelf,
      });
      setAuthorsInput(existing.authors.join(", "));
      setTagsInput(existing.tags.join(", "));
      setCoverPreview(coverUrl(existing.cover_image_path));
    }
  }, [existing]);

  function set<K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const compressed = await compressImage(file);
    setCoverFile(compressed);
    setCoverPreview(URL.createObjectURL(compressed));
  }

  async function handleLookup(isbn: string) {
    const clean = isbn.trim();
    if (!clean) return;

    setLookupLoading(true);
    setLookupMessage(null);
    setLookupMatch(null);

    try {
      const result = await lookupIsbn(clean);
      if (!result.found) {
        setLookupMessage(t("bookForm.noIsbnMatch"));
        return;
      }

      setForm((prev) => ({
        ...prev,
        title: result.title ?? prev.title,
        subtitle: result.subtitle ?? prev.subtitle,
        publisher: result.publisher ?? prev.publisher,
        publication_year: result.publication_year ?? prev.publication_year,
        page_count: result.page_count ?? prev.page_count,
        isbn: clean,
        cover_url: result.cover_url ?? undefined,
      }));
      if (result.authors.length > 0) {
        setAuthorsInput(result.authors.join(", "));
      }
      if (result.cover_url && !coverFile) {
        setCoverPreview(result.cover_url);
      }
      setLookupMatch(result.already_in_library);
    } catch {
      setLookupMessage(t("bookForm.lookupServiceError"));
    } finally {
      setLookupLoading(false);
    }
  }

  function handleScanned(code: string) {
    setShowScanner(false);
    set("isbn", code);
    handleLookup(code);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: BookFormValues = {
      ...form,
      authors: toInputList(authorsInput),
      tags: toInputList(tagsInput),
    };

    try {
      const book = mode === "create" ? await createBook(payload) : await updateBook(bookId!, payload);
      if (coverFile) {
        await uploadCover(book.id, coverFile);
      }
      showToast(mode === "create" ? t("bookForm.bookAdded") : t("bookForm.bookUpdated"));
      navigate(`/books/${book.id}`);
    } catch {
      setError(t("bookForm.saveError"));
      showToast(t("bookForm.saveErrorToast"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 pb-8">
      <h1 className="text-xl font-semibold">{mode === "create" ? t("bookForm.addBook") : t("bookForm.editBook")}</h1>

      <div className="space-y-2 rounded-lg border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("bookForm.lookupByIsbn")}</p>
        <div className="flex gap-2">
          <input
            value={form.isbn ?? ""}
            onChange={(e) => set("isbn", e.target.value || null)}
            placeholder={t("bookForm.isbnPlaceholder")}
            className={inputClass}
          />
          <button
            type="button"
            disabled={lookupLoading || !form.isbn}
            onClick={() => handleLookup(form.isbn ?? "")}
            className="shrink-0 rounded-md border border-line-strong px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-40"
          >
            {lookupLoading ? t("bookForm.lookingUp") : t("bookForm.lookUp")}
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="shrink-0 rounded-md border border-line-strong px-3 py-2 text-sm hover:bg-surface-hover"
          >
            {t("bookForm.scan")}
          </button>
          <button
            type="button"
            onClick={() => setShowShelfScanner(true)}
            className="shrink-0 rounded-md bg-accent/10 border border-accent/30 text-accent px-3 py-2 text-sm hover:bg-accent/20 transition font-medium"
          >
            📸 1-Photo Shelf Scan
          </button>
        </div>
        {lookupMessage && <p className="text-sm text-ink-secondary">{lookupMessage}</p>}
        {lookupMatch && (
          <p className="text-sm text-amber-400">
            {t("bookForm.alreadyMatch", {
              where: lookupMatch.owned ? t("bookForm.alreadyInLibrary") : t("bookForm.alreadyOnWishlist"),
            })}
            <Link to={`/books/${lookupMatch.id}`} className="underline">
              {t("bookForm.viewIt")}
            </Link>
          </p>
        )}
      </div>

      {showScanner && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-sm text-neutral-400">
              {t("bookForm.loadingScanner")}
            </div>
          }
        >
          <BarcodeScanner onDetected={handleScanned} onClose={() => setShowScanner(false)} />
        </Suspense>
      )}

      <ShelfPhotoScanner
        isOpen={showShelfScanner}
        onClose={() => setShowShelfScanner(false)}
        onSuccess={() => navigate("/")}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <div className="mx-auto w-32 shrink-0 sm:mx-0">
          <div className="aspect-[2/3] overflow-hidden rounded-md border border-line bg-surface">
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                {t("bookForm.noCover")}
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleCoverChange}
            className="mt-2 w-full text-xs"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <Field label={t("bookForm.title")} required>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={inputClass}
            />
          </Field>
          {titleMatch && (
            <p className="text-sm text-amber-400">
              {t("bookForm.possibleMatch", { title: titleMatch.title })}
              {titleMatch.authors.length > 0 && t("bookForm.byAuthors", { authors: titleMatch.authors.join(", ") })}
              {" — "}
              <Link to={`/books/${titleMatch.id}`} className="underline">
                {t("bookForm.viewIt")}
              </Link>
            </p>
          )}
          <Field label={t("bookForm.subtitle")}>
            <input value={form.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value || null)} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={form.owned}
              onChange={(e) => set("owned", e.target.checked)}
              className="h-4 w-4 rounded border-line-strong bg-surface-hover"
            />
            {t("bookForm.iOwnThisBook")}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("bookForm.authorsCommaSeparated")}>
              <input value={authorsInput} onChange={(e) => setAuthorsInput(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("bookForm.tagsCommaSeparated")}>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("bookForm.genre")}>
          <input value={form.genre ?? ""} onChange={(e) => set("genre", e.target.value || null)} className={inputClass} />
        </Field>
        <Field label={t("bookForm.publicationYear")}>
          <input
            type="number"
            value={form.publication_year ?? ""}
            onChange={(e) => set("publication_year", e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          />
        </Field>
        <Field label={t("bookForm.language")}>
          <input value={form.language ?? ""} onChange={(e) => set("language", e.target.value || null)} className={inputClass} />
        </Field>
        <Field label={t("bookForm.publisher")}>
          <input value={form.publisher ?? ""} onChange={(e) => set("publisher", e.target.value || null)} className={inputClass} />
        </Field>
        <Field label={t("bookForm.pageCount")}>
          <input
            type="number"
            value={form.page_count ?? ""}
            onChange={(e) => set("page_count", e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          />
        </Field>
        <Field label={t("bookForm.shelf")}>
          <input
            list="shelf-options"
            value={form.shelf ?? ""}
            onChange={(e) => set("shelf", e.target.value || null)}
            className={inputClass}
          />
          <datalist id="shelf-options">
            {shelves.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label={t("bookForm.purchaseDate")}>
          <input
            type="date"
            value={form.purchase_date ?? ""}
            onChange={(e) => set("purchase_date", e.target.value || null)}
            className={inputClass}
          />
        </Field>
        <Field label={t("bookForm.purchasePrice")}>
          <input
            type="number"
            step="0.01"
            value={form.purchase_price ?? ""}
            onChange={(e) => set("purchase_price", e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={t("bookForm.description")}>
        <textarea
          rows={4}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          className={inputClass}
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50 sm:w-auto"
      >
        {submitting ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-ink-secondary">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  );
}
