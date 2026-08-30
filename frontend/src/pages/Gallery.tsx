import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { fetchBooks, fetchGenres } from "@/api/books";
import { BookCard } from "@/components/BookCard";
import { BookGrid } from "@/components/BookGrid";
import { Carousel } from "@/components/Carousel";
import { FilterSidebar } from "@/components/FilterSidebar";
import { WhatToReadModal } from "@/components/WhatToReadModal";
import { ShelfPhotoScanner } from "@/components/ShelfPhotoScanner";
import { ShareShelfModal } from "@/components/ShareShelfModal";
import { useTranslation } from "@/lib/LanguageContext";
import type { Book, BookFilters } from "@/types/book";

const ROW_LIMIT = 20;

function isFilterActive(filters: BookFilters): boolean {
  return Boolean(
    filters.search ||
      filters.genre ||
      filters.tag ||
      filters.author ||
      filters.shelf ||
      filters.status ||
      filters.year_min ||
      filters.year_max
  );
}

function Row({ title, books }: { title: string; books: Book[] }) {
  if (books.length === 0) return null;
  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <Carousel>
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </Carousel>
    </section>
  );
}

function GenreRows() {
  const { t } = useTranslation();
  const { data: genres = [] } = useQuery({ queryKey: ["genres"], queryFn: fetchGenres });

  const recentQuery = useQuery({
    queryKey: ["books", "recent"],
    queryFn: () => fetchBooks({ limit: ROW_LIMIT, offset: 0 }),
  });
  const unreadQuery = useQuery({
    queryKey: ["books", "unread"],
    queryFn: () => fetchBooks({ status: "unread", limit: ROW_LIMIT, offset: 0 }),
  });

  const genreQueries = useQueries({
    queries: genres.map((genre) => ({
      queryKey: ["books", "genre", genre],
      queryFn: () => fetchBooks({ genre, limit: ROW_LIMIT, offset: 0 }),
      enabled: genres.length > 0,
    })),
  });

  return (
    <div className="space-y-8">
      <Row title={t("gallery.recentlyAdded")} books={recentQuery.data?.items ?? []} />
      <Row title={t("status.unread")} books={unreadQuery.data?.items ?? []} />
      {genres.map((genre, i) => (
        <Row key={genre} title={genre} books={genreQueries[i]?.data?.items ?? []} />
      ))}
    </div>
  );
}

function FilteredGrid({ filters, onChangePage }: { filters: BookFilters; onChangePage: (offset: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["books", "filtered", filters],
    queryFn: () => fetchBooks(filters),
  });

  return <BookGrid data={data} isLoading={isLoading} filters={filters} onChangePage={onChangePage} />;
}

type GalleryView = "home" | "all";

export function Gallery() {
  const { t } = useTranslation();
  const [view, setView] = useState<GalleryView>("home");
  const [filters, setFilters] = useState<BookFilters>({ limit: 50, offset: 0 });
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const filtered = useMemo(() => isFilterActive(filters), [filters]);
  const showGrid = view === "all" || filtered;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <FilterSidebar filters={filters} onChange={setFilters} />
      <div className="min-w-0 flex-1 space-y-4">
        {/* Gallery View Tabs & Quick Action Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setView("home")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "home" ? "bg-accent text-on-accent" : "bg-surface-hover text-ink-secondary hover:brightness-110"
              }`}
            >
              {t("gallery.home")}
            </button>
            <button
              onClick={() => setView("all")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "all" ? "bg-accent text-on-accent" : "bg-surface-hover text-ink-secondary hover:brightness-110"
              }`}
            >
              {t("gallery.allBooks")}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRecommendOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/30 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition shadow-sm"
            >
              🎯 <span>{t("recommend.title")}</span>
            </button>
            <button
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover transition"
            >
              📸 <span>Scan Shelf</span>
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover transition"
            >
              🔗 <span>Share</span>
            </button>
          </div>
        </div>

        {showGrid ? (
          <FilteredGrid filters={filters} onChangePage={(offset) => setFilters({ ...filters, offset })} />
        ) : (
          <GenreRows />
        )}
      </div>

      <WhatToReadModal isOpen={recommendOpen} onClose={() => setRecommendOpen(false)} />
      <ShelfPhotoScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onSuccess={() => window.location.reload()} />
      <ShareShelfModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
