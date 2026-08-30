import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { deleteBook, fetchBook, updateBook, updateMyStatus } from "@/api/books";
import { coverUrl } from "@/api/client";
import { useTranslation } from "@/lib/LanguageContext";
import { useStatusOptions } from "@/lib/statusLabels";
import { useToast } from "@/lib/ToastContext";
import type { ReadStatus, StatusUpdate } from "@/types/book";
import { LendBookModal } from "@/components/LendBookModal";

export function BookDetail() {
  const { id } = useParams();
  const bookId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const statusOptions = useStatusOptions();
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [lendOpen, setLendOpen] = useState(false);

  const { data: book, isLoading } = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => fetchBook(bookId),
  });

  const statusMutation = useMutation({
    mutationFn: (update: StatusUpdate) => updateMyStatus(bookId, update),
    onSuccess: (updated) => {
      queryClient.setQueryData(["book", bookId], updated);
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      showToast(t("bookDetail.bookDeleted"));
      navigate("/");
    },
    onError: () => showToast(t("bookDetail.couldNotDeleteBook"), "error"),
  });

  const ownedMutation = useMutation({
    mutationFn: () => updateBook(bookId, { owned: true }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["book", bookId], updated);
      queryClient.invalidateQueries({ queryKey: ["books"] });
      showToast(t("bookDetail.markedAsOwned"));
    },
  });

  if (isLoading || !book) return <p className="text-ink-muted">{t("common.loading")}</p>;

  const cover = coverUrl(book.cover_image_path);
  const status = book.my_status?.status ?? "unread";
  const rating = book.my_status?.rating ?? null;
  const notes = notesDraft ?? book.my_status?.notes ?? "";

  function handleDelete() {
    if (confirm(t("bookDetail.deleteConfirm", { title: book!.title }))) {
      deleteMutation.mutate();
    }
  }

  function handleStatusClick(value: ReadStatus) {
    const update: StatusUpdate = { status: value };
    const today = new Date().toISOString().slice(0, 10);
    if (value === "reading" && !book!.my_status?.started_at) {
      update.started_at = today;
    }
    if (value === "finished" && !book!.my_status?.finished_at) {
      update.finished_at = today;
    }
    statusMutation.mutate(update);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-8 sm:flex-row sm:gap-8">
      <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-56">
        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line bg-surface">
          {cover ? (
            <img src={cover} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-ink-muted">
              {book.title}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            to={`/books/${book.id}/edit`}
            className="flex-1 rounded-md border border-line-strong px-3 py-2 text-center text-sm hover:bg-surface-hover"
          >
            {t("common.edit")}
          </Link>
          <button
            onClick={handleDelete}
            className="flex-1 rounded-md border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950"
          >
            {t("common.delete")}
          </button>
        </div>
        <button
          onClick={() => setLendOpen(true)}
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-center text-sm font-medium text-ink hover:bg-surface-hover transition"
        >
          🤝 {t("loans.lendBook")}
        </button>
      </div>

      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                book.owned ? "bg-emerald-900/60 text-emerald-300" : "bg-surface-hover text-ink-secondary"
              }`}
            >
              {book.owned ? t("bookDetail.owned") : t("bookDetail.wishlist")}
            </span>
            {!book.owned && (
              <button
                onClick={() => ownedMutation.mutate()}
                disabled={ownedMutation.isPending}
                className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
              >
                {ownedMutation.isPending ? t("bookDetail.marking") : t("bookDetail.markAsOwned")}
              </button>
            )}
          </div>
          <h1 className="text-2xl font-semibold">{book.title}</h1>
          {book.subtitle && <p className="text-ink-secondary">{book.subtitle}</p>}
          {book.authors.length > 0 && (
            <p className="mt-1 text-ink-secondary">{t("bookDetail.by", { authors: book.authors.join(", ") })}</p>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-ink-secondary sm:grid-cols-2">
          {book.publisher && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.publisher")}</dt>
              <dd className="inline text-ink-secondary">{book.publisher}</dd>
            </div>
          )}
          {book.publication_year && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.year")}</dt>
              <dd className="inline text-ink-secondary">{book.publication_year}</dd>
            </div>
          )}
          {book.genre && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.genre")}</dt>
              <dd className="inline text-ink-secondary">{book.genre}</dd>
            </div>
          )}
          {book.page_count && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.pages")}</dt>
              <dd className="inline text-ink-secondary">{book.page_count}</dd>
            </div>
          )}
          {book.shelf && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.shelf")}</dt>
              <dd className="inline text-ink-secondary">{book.shelf}</dd>
            </div>
          )}
          {book.isbn && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.isbn")}</dt>
              <dd className="inline text-ink-secondary">{book.isbn}</dd>
            </div>
          )}
          {book.purchase_date && (
            <div>
              <dt className="inline text-ink-muted">{t("bookDetail.purchased")}</dt>
              <dd className="inline text-ink-secondary">
                {book.purchase_price != null
                  ? t("bookDetail.purchasedWithPrice", { date: book.purchase_date, price: book.purchase_price })
                  : book.purchase_date}
              </dd>
            </div>
          )}
        </dl>

        {book.description && <p className="text-sm leading-relaxed text-ink-secondary">{book.description}</p>}

        {book.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {book.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-ink-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}

        {book.owned && (
        <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{t("bookDetail.yourStatus")}</h2>

          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusClick(opt.value)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  status === opt.value ? "bg-accent text-on-accent" : "bg-surface-hover text-ink-secondary hover:brightness-110"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {status !== "unread" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs text-ink-muted">{t("bookDetail.started")}</p>
                <input
                  type="date"
                  value={book.my_status?.started_at ?? ""}
                  onChange={(e) => statusMutation.mutate({ started_at: e.target.value || null })}
                  className="w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              {(status === "finished" || status === "abandoned") && (
                <div>
                  <p className="mb-1 text-xs text-ink-muted">{t("bookDetail.finished")}</p>
                  <input
                    type="date"
                    value={book.my_status?.finished_at ?? ""}
                    onChange={(e) => statusMutation.mutate({ finished_at: e.target.value || null })}
                    className="w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-1 text-xs text-ink-muted">{t("bookDetail.rating")}</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => statusMutation.mutate({ rating: rating === n ? null : n })}
                  className={`flex h-8 w-8 items-center justify-center rounded text-xs ${
                    rating != null && n <= rating ? "bg-amber-400 text-neutral-900" : "bg-surface-hover text-ink-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-ink-muted">{t("bookDetail.notes")}</p>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                if (notesDraft === null) return;
                statusMutation.mutate(
                  { notes: notesDraft },
                  { onSuccess: () => showToast(t("bookDetail.notesSaved")) }
                );
              }}
              placeholder={t("bookDetail.notesPlaceholder")}
              className="w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        )}
      </div>

      <LendBookModal
        isOpen={lendOpen}
        bookId={book.id}
        bookTitle={book.title}
        onClose={() => setLendOpen(false)}
      />
    </div>
  );
}
