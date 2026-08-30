import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight, Filter, X } from "lucide-react";

import { fetchGenres, fetchShelves, fetchTags } from "@/api/books";
import { useTranslation } from "@/lib/LanguageContext";
import { useStatusOptions } from "@/lib/statusLabels";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { BookFilters } from "@/types/book";

interface FilterSidebarProps {
  filters: BookFilters;
  onChange: (filters: BookFilters) => void;
}

function CollapsibleSection({
  title,
  activeLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  activeLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || Boolean(activeLabel));

  return (
    <div className="border-b border-line py-3 first:pt-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {activeLabel && (
            <span className="max-w-20 truncate rounded-full bg-surface-hover px-2 py-0.5 text-xs text-ink">
              {activeLabel}
            </span>
          )}
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected?: string;
  onSelect: (val: string | undefined) => void;
}) {
  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelect(undefined)}
        className={`block w-full rounded-md px-2 py-1 text-left text-xs ${
          !selected ? "bg-surface-hover font-medium text-ink" : "text-ink-secondary hover:text-ink"
        }`}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt === selected ? undefined : opt)}
          className={`block w-full truncate rounded-md px-2 py-1 text-left text-xs ${
            selected === opt
              ? "bg-surface-hover font-medium text-ink"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const { t } = useTranslation();
  const statusOptions = useStatusOptions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(filters.search ?? "");
  const [author, setAuthor] = useState(filters.author ?? "");
  const [yearMin, setYearMin] = useState(filters.year_min?.toString() ?? "");
  const [yearMax, setYearMax] = useState(filters.year_max?.toString() ?? "");

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedAuthor = useDebouncedValue(author, 300);
  const debouncedYearMin = useDebouncedValue(yearMin, 300);
  const debouncedYearMax = useDebouncedValue(yearMax, 300);

  const { data: genres = [] } = useQuery({ queryKey: ["genres"], queryFn: fetchGenres });
  const { data: shelves = [] } = useQuery({ queryKey: ["shelves"], queryFn: fetchShelves });
  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });

  useEffect(() => {
    onChange({
      ...filters,
      search: debouncedSearch || undefined,
      author: debouncedAuthor || undefined,
      year_min: debouncedYearMin ? Number(debouncedYearMin) : undefined,
      year_max: debouncedYearMax ? Number(debouncedYearMax) : undefined,
      offset: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedAuthor, debouncedYearMin, debouncedYearMax]);

  const activeCount = [
    filters.search,
    filters.author,
    filters.genre,
    filters.shelf,
    filters.tag,
    filters.status,
    filters.year_min,
    filters.year_max,
  ].filter(Boolean).length;

  function clearAll() {
    setSearch("");
    setAuthor("");
    setYearMin("");
    setYearMax("");
    onChange({ limit: filters.limit, offset: 0 });
  }

  const body = (
    <div className="space-y-4 text-xs">
      <div>
        <label className="mb-1 block font-semibold uppercase tracking-wide text-ink-muted">
          Search
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("filters.searchPlaceholder")}
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </div>

      <CollapsibleSection title={t("filters.genre")} activeLabel={filters.genre}>
        <OptionList
          options={genres}
          selected={filters.genre}
          onSelect={(genre) => onChange({ ...filters, genre, offset: 0 })}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("filters.shelf")} activeLabel={filters.shelf}>
        <OptionList
          options={shelves}
          selected={filters.shelf}
          onSelect={(shelf) => onChange({ ...filters, shelf, offset: 0 })}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("filters.tags")} activeLabel={filters.tag}>
        <OptionList
          options={tags}
          selected={filters.tag}
          onSelect={(tag) => onChange({ ...filters, tag, offset: 0 })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={t("filters.readingStatus")}
        activeLabel={statusOptions.find((o) => o.value === filters.status)?.label}
      >
        <div className="space-y-0.5">
          <button
            onClick={() => onChange({ ...filters, status: undefined, offset: 0 })}
            className={`block w-full rounded-md px-2 py-1 text-left text-xs ${
              !filters.status
                ? "bg-surface-hover font-medium text-ink"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            All
          </button>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onChange({
                  ...filters,
                  status: filters.status === opt.value ? undefined : opt.value,
                  offset: 0,
                })
              }
              className={`block w-full rounded-md px-2 py-1 text-left text-xs ${
                filters.status === opt.value
                  ? "bg-surface-hover font-medium text-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Author" activeLabel={filters.author}>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author name…"
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={t("filters.year")}
        activeLabel={
          filters.year_min || filters.year_max
            ? `${filters.year_min ?? "…"} - ${filters.year_max ?? "…"}`
            : undefined
        }
      >
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
            placeholder={t("filters.min")}
            className="w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
          />
          <span className="text-ink-muted">-</span>
          <input
            type="number"
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
            placeholder={t("filters.max")}
            className="w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
          />
        </div>
      </CollapsibleSection>

      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="w-full rounded-md border border-line py-1 text-center text-xs text-ink-secondary hover:bg-surface-hover hover:text-ink"
        >
          {t("filters.clearFilters")} ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="sm:hidden">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-sm"
        >
          <Filter className="h-4 w-4 text-accent" />
          <span>{t("filters.filters")}</span>
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <aside className="hidden w-56 shrink-0 sm:sticky sm:top-4 sm:block sm:max-h-[calc(100dvh-2rem)] sm:min-h-0 sm:overflow-y-auto sm:pr-1">
        {body}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-xs overflow-y-auto bg-canvas p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-secondary">
                <Filter className="h-4 w-4 text-accent" />
                <span>{t("filters.filters")}</span>
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-hover hover:text-ink"
                aria-label={t("filters.closeFilters")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {body}
          </div>
        </div>
      )}
    </>
  );
}
