import { Link } from "react-router-dom";

import { coverUrl } from "@/api/client";
import { useTranslation } from "@/lib/LanguageContext";
import { useStatusLabels } from "@/lib/statusLabels";
import type { Book } from "@/types/book";

export function BookCard({ book }: { book: Book }) {
  const { t } = useTranslation();
  const statusLabels = useStatusLabels();
  const cover = coverUrl(book.cover_image_path);
  const status = book.my_status?.status ?? "unread";
  const rating = book.my_status?.rating;

  return (
    <Link
      to={`/books/${book.id}`}
      className="group block w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-surface text-ink transition hover:border-line-strong sm:w-36 md:w-40"
    >
      <div className="relative aspect-[2/3] w-full bg-surface-hover">
        {cover ? (
          <img
            src={cover}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-ink-muted">
            {book.title}
          </div>
        )}
        {!book.owned && (
          <span className="absolute right-1 top-1 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] font-medium text-ink">
            {t("bookCard.wishlist")}
          </span>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-sm font-medium">{book.title}</p>
        {rating ? (
          <p className="text-xs text-amber-400">{"★".repeat(Math.round(rating / 2))}</p>
        ) : (
          <p className="text-xs text-ink-muted">{t("bookCard.notRated")}</p>
        )}
        <p className="text-xs text-ink-muted">{statusLabels[status]}</p>
      </div>
    </Link>
  );
}
