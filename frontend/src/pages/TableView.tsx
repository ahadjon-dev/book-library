import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ChevronUp, ChevronDown } from "lucide-react";

import { exportBooksExcel, fetchBooks } from "@/api/books";
import { coverUrl } from "@/api/client";
import { FilterSidebar } from "@/components/FilterSidebar";
import { useTranslation } from "@/lib/LanguageContext";
import { useStatusLabels } from "@/lib/statusLabels";
import { useToast } from "@/lib/ToastContext";
import type { Book, BookFilters } from "@/types/book";

const columnHelper = createColumnHelper<Book>();

const PAGE_SIZE = 50;

export function TableView() {
  const { t } = useTranslation();
  const statusLabels = useStatusLabels();
  const [filters, setFilters] = useState<BookFilters>({ limit: PAGE_SIZE, offset: 0 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const { showToast } = useToast();

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
            <img src={cover} alt="" className="h-14 w-10 rounded object-cover" />
          ) : (
            <div className="h-14 w-10 rounded bg-surface-hover" />
          );
        },
      }),
      columnHelper.accessor("title", {
        header: t("table.title"),
        cell: (info) => (
          <Link to={`/books/${info.row.original.id}`} className="font-medium hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => row.authors.join(", "), {
        id: "authors",
        header: t("table.author"),
      }),
      columnHelper.accessor("publication_year", { header: t("table.year") }),
      columnHelper.accessor("genre", { header: t("table.genre") }),
      columnHelper.accessor((row) => row.my_status?.rating ?? null, {
        id: "rating",
        header: t("table.rating"),
        cell: (info) => (info.getValue() ? `${info.getValue()}/10` : t("common.dash")),
      }),
      columnHelper.accessor((row) => row.my_status?.status ?? "unread", {
        id: "status",
        header: t("table.read"),
        cell: (info) => statusLabels[info.getValue()] ?? info.getValue(),
      }),
      columnHelper.accessor("shelf", {
        header: t("table.shelf"),
        cell: (info) => info.getValue() ?? t("common.dash"),
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
  const counts = data?.status_counts;
  const [exporting, setExporting] = useState(false);

  function goToOffset(next: number) {
    setFilters({ ...filters, offset: next });
  }

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

  return (
    <div className="flex h-full flex-col gap-4 sm:flex-row sm:gap-6">
      <FilterSidebar filters={filters} onChange={(f) => setFilters({ ...f, limit: PAGE_SIZE, offset: 0 })} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <p className="text-sm text-ink-secondary">{t("table.booksCount", { count: total })}</p>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? t("table.exporting") : t("table.exportToExcel")}</span>
          </button>
        </div>
        {isLoading ? (
          <p className="text-ink-muted">{t("common.loading")}</p>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line-strong">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-canvas">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-line-strong text-left text-ink-secondary">
                      {headerGroup.headers.map((header) => {
                        const isSorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            onClick={header.column.getToggleSortingHandler()}
                            className="cursor-pointer select-none whitespace-nowrap border-r border-line-strong px-3 py-2 font-medium last:border-r-0"
                          >
                            <div className="inline-flex items-center gap-1">
                              <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                              {isSorted === "asc" && <ChevronUp className="h-3.5 w-3.5 text-accent" />}
                              {isSorted === "desc" && <ChevronDown className="h-3.5 w-3.5 text-accent" />}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-line-strong hover:bg-surface-hover">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="whitespace-nowrap border-r border-line-strong px-3 py-2 last:border-r-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex shrink-0 flex-col gap-2 border-t border-line pt-3 text-sm text-ink-secondary sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  {t("table.total")}
                  <span className="text-ink">{counts?.total ?? 0}</span>
                </span>
                <span>
                  {t("table.unreadLabel")}
                  <span className="text-ink">{counts?.unread ?? 0}</span>
                </span>
                <span>
                  {t("table.readingLabel")}
                  <span className="text-ink">{counts?.reading ?? 0}</span>
                </span>
                <span>
                  {t("table.finishedLabel")}
                  <span className="text-ink">{counts?.finished ?? 0}</span>
                </span>
                <span>
                  {t("table.abandonedLabel")}
                  <span className="text-ink">{counts?.abandoned ?? 0}</span>
                </span>
              </div>

              {total > PAGE_SIZE && (
                <div className="flex items-center gap-3">
                  <button
                    disabled={offset === 0}
                    onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="rounded-md border border-line-strong px-2 py-1 disabled:opacity-30"
                  >
                    {t("common.prev")}
                  </button>
                  <span>
                    {t("bookGrid.paginationRange", {
                      start: offset + 1,
                      end: Math.min(offset + PAGE_SIZE, total),
                      total,
                    })}
                  </span>
                  <button
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => goToOffset(offset + PAGE_SIZE)}
                    className="rounded-md border border-line-strong px-2 py-1 disabled:opacity-30"
                  >
                    {t("common.next")}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
