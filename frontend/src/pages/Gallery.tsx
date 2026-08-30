import { useQueries, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Rows3,
  LayoutGrid,
  Table as TableIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Share2,
  BookOpen,
} from "lucide-react";

import { exportBooksExcel, fetchBooks, fetchGenres } from "@/api/books";
import { coverUrl } from "@/api/client";
import { BookCard } from "@/components/BookCard";
import { BookGrid } from "@/components/BookGrid";
import { Carousel } from "@/components/Carousel";
import { FilterSidebar } from "@/components/FilterSidebar";
import { WhatToReadModal } from "@/components/WhatToReadModal";
import { AddBooksHubModal } from "@/components/AddBooksHubModal";
import { ShareShelfModal } from "@/components/ShareShelfModal";
import { useTranslation } from "@/lib/LanguageContext";
import { useStatusLabels } from "@/lib/statusLabels";
import { useToast } from "@/lib/ToastContext";
import type { Book, BookFilters } from "@/types/book";

const ROW_LIMIT = 20;
const columnHelper = createColumnHelper<Book>();

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

function FilteredGrid({
  filters,
  onChangePage,
}: {
  filters: BookFilters;
  onChangePage: (offset: number) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["books", "filtered", filters],
    queryFn: () => fetchBooks(filters),
  });

  return <BookGrid data={data} isLoading={isLoading} filters={filters} onChangePage={onChangePage} />;
}

function TableSection({
  filters,
  onChangePage,
}: {
  filters: BookFilters;
  onChangePage: (offset: number) => void;
}) {
  const { t } = useTranslation();
  const statusLabels = useStatusLabels();
  const { showToast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["books", "table", filters],
    queryFn: () => fetchBooks(filters),
  });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "cover",
        header: "",
        cell: (info) => {
          const cover = coverUrl(info.row.original.cover_image_path);
          return cover ? (
            <img src={cover} alt="" className="h-12 w-8 rounded object-cover" />
          ) : (
            <div className="h-12 w-8 rounded bg-surface-hover flex items-center justify-center text-[10px]">
              <BookOpen className="h-4 w-4 text-ink-muted" />
            </div>
          );
        },
      }),
      columnHelper.accessor("title", {
        header: t("table.title"),
        cell: (info) => (
          <Link to={`/books/${info.row.original.id}`} className="font-semibold text-ink hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => row.authors.join(", "), {
        id: "authors",
        header: t("table.author"),
        cell: (info) => <span className="text-ink-secondary">{info.getValue() || "—"}</span>,
      }),
      columnHelper.accessor("genre", {
        header: t("table.genre"),
        cell: (info) => <span className="text-ink-secondary">{info.getValue() || "—"}</span>,
      }),
      columnHelper.accessor("publication_year", {
        header: t("table.year"),
        cell: (info) => <span className="text-ink-secondary">{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor((row) => row.my_status?.rating ?? null, {
        id: "rating",
        header: t("table.rating"),
        cell: (info) =>
          info.getValue() ? (
            <span className="font-semibold text-amber-400">★ {info.getValue()}</span>
          ) : (
            <span className="text-ink-muted">—</span>
          ),
      }),
      columnHelper.accessor((row) => row.my_status?.status ?? "unread", {
        id: "status",
        header: t("table.read"),
        cell: (info) => {
          const val = info.getValue();
          const label = statusLabels[val] ?? val;
          const badgeClass =
            val === "finished"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : val === "reading"
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-surface text-ink-secondary border-line";
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
              {label}
            </span>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, statusLabels]
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const total = data?.total ?? 0;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportBooksExcel(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `library-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(t("table.exportDownloaded"));
    } catch {
      showToast(t("table.exportFailed"), "error");
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <p className="text-ink-muted py-8">{t("common.loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-secondary font-medium">
          {t("table.booksCount", { count: total })}
        </span>
        <button
          onClick={handleExport}
          disabled={exporting || total === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover transition disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5 text-ink-secondary" />
          <span>{exporting ? t("table.exporting") : t("table.exportToExcel")}</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-line bg-canvas/50 text-ink-muted text-xs font-semibold">
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-2.5 cursor-pointer select-none hover:text-ink transition"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface-hover/50 transition">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between text-xs pt-2">
          <button
            disabled={offset === 0}
            onClick={() => onChangePage(Math.max(0, offset - limit))}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 font-medium disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>{t("common.prev")}</span>
          </button>
          <span className="text-ink-secondary">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => onChangePage(offset + limit)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 font-medium disabled:opacity-40"
          >
            <span>{t("common.next")}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

type GalleryView = "shelves" | "grid" | "table";

export function Gallery() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial view from query param or localStorage
  const initialView = (searchParams.get("view") as GalleryView) || "shelves";
  const [view, setView] = useState<GalleryView>(initialView);
  const [filters, setFilters] = useState<BookFilters>({ limit: 50, offset: 0 });

  const [recommendOpen, setRecommendOpen] = useState(false);
  const [addHubOpen, setAddHubOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const filtered = useMemo(() => isFilterActive(filters), [filters]);

  function handleViewChange(nextView: GalleryView) {
    setView(nextView);
    const newParams = new URLSearchParams(searchParams);
    if (nextView === "shelves") {
      newParams.delete("view");
    } else {
      newParams.set("view", nextView);
    }
    setSearchParams(newParams, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <FilterSidebar filters={filters} onChange={setFilters} />
      <div className="min-w-0 flex-1 space-y-4">
        {/* Header Segmented Control & Quick Actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Segmented View Mode Switcher */}
          <div className="flex p-1 rounded-xl bg-surface border border-line">
            <button
              onClick={() => handleViewChange("shelves")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "shelves" && !filtered
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <Rows3 className="h-3.5 w-3.5" />
              <span>{t("gallery.shelves")}</span>
            </button>
            <button
              onClick={() => handleViewChange("grid")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "grid" || (view === "shelves" && filtered)
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{t("gallery.grid")}</span>
            </button>
            <button
              onClick={() => handleViewChange("table")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "table"
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>{t("gallery.table")}</span>
            </button>
          </div>

          {/* Quick Action Pill Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRecommendOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/30 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t("recommend.title")}</span>
            </button>
            <button
              onClick={() => setAddHubOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("addHub.title")}</span>
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover transition"
            >
              <Share2 className="h-3.5 w-3.5 text-ink-secondary" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Dynamic View Body */}
        {view === "table" ? (
          <TableSection filters={filters} onChangePage={(offset) => setFilters({ ...filters, offset })} />
        ) : view === "grid" || filtered ? (
          <FilteredGrid filters={filters} onChangePage={(offset) => setFilters({ ...filters, offset })} />
        ) : (
          <GenreRows />
        )}
      </div>

      <WhatToReadModal isOpen={recommendOpen} onClose={() => setRecommendOpen(false)} />
      <AddBooksHubModal isOpen={addHubOpen} onClose={() => setAddHubOpen(false)} onSuccess={() => window.location.reload()} />
      <ShareShelfModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
