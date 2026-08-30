import { BookCard } from "@/components/BookCard";
import { useTranslation } from "@/lib/LanguageContext";
import type { Book, BookFilters, BookListResponse } from "@/types/book";

interface BookGridProps {
  data: BookListResponse | undefined;
  isLoading: boolean;
  filters: BookFilters;
  onChangePage: (offset: number) => void;
  emptyMessage?: string;
}

export function BookGrid({ data, isLoading, filters, onChangePage, emptyMessage }: BookGridProps) {
  const { t } = useTranslation();

  if (isLoading) return <p className="text-ink-muted">{t("common.loading")}</p>;

  const items: Book[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  if (items.length === 0) {
    return <p className="text-ink-muted">{emptyMessage ?? t("bookGrid.noMatch")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {items.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
      {total > limit && (
        <div className="flex items-center gap-3 text-sm text-ink-secondary">
          <button
            disabled={offset === 0}
            onClick={() => onChangePage(Math.max(0, offset - limit))}
            className="rounded-md border border-line-strong px-2 py-1 disabled:opacity-30"
          >
            {t("common.prev")}
          </button>
          <span>
            {t("bookGrid.paginationRange", { start: offset + 1, end: Math.min(offset + limit, total), total })}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => onChangePage(offset + limit)}
            className="rounded-md border border-line-strong px-2 py-1 disabled:opacity-30"
          >
            {t("common.next")}
          </button>
        </div>
      )}
    </div>
  );
}
