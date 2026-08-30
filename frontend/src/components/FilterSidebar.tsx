import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
          <span className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`}>›</span>
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
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onSelect(selected === option ? undefined : option)}
          className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
            selected === option ? "bg-surface-hover text-ink" : "text-ink-secondary hover:text-ink"
          }`}
        >
          {option}
        </button>
      ))}
    </>
  );
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const { t } = useTranslation();
  const statuses = useStatusOptions();
  const [open, setOpen] = useState(false);
  const { data: genres = [] } = useQuery({ queryKey: ["genres"], queryFn: fetchGenres });
  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });
  const { data: shelves = [] } = useQuery({ queryKey: ["shelves"], queryFn: fetchShelves });

  function set<K extends keyof BookFilters>(key: K, value: BookFilters[K]) {
    onChange({ ...filters, [key]: value, offset: 0 });
  }

  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? "")) {
      set("search", debouncedSearch || undefined);
    }
    // Only re-run when the debounced value itself settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  const activeCount = [
    filters.genre,
    filters.status,
    filters.shelf,
    filters.tag,
    filters.search,
    filters.year_min,
    filters.year_max,
  ].filter(Boolean).length;

  const statusLabel = statuses.find((s) => s.value === filters.status)?.label;
  const yearLabel =
    filters.year_min || filters.year_max
      ? t("filters.yearRange", { min: filters.year_min ?? "…", max: filters.year_max ?? "…" })
      : undefined;

  const body = (
    <div>
      <input
        type="search"
        placeholder={t("filters.searchPlaceholder")}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="mb-3 w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />

      {genres.length > 0 && (
        <CollapsibleSection title={t("filters.genre")} activeLabel={filters.genre}>
          <OptionList options={genres} selected={filters.genre} onSelect={(v) => set("genre", v)} />
        </CollapsibleSection>
      )}

      <CollapsibleSection title={t("filters.readingStatus")} activeLabel={statusLabel} defaultOpen>
        <OptionList
          options={statuses.map((s) => s.label)}
          selected={statusLabel}
          onSelect={(label) => set("status", statuses.find((s) => s.label === label)?.value)}
        />
      </CollapsibleSection>

      {shelves.length > 0 && (
        <CollapsibleSection title={t("filters.shelf")} activeLabel={filters.shelf}>
          <OptionList options={shelves} selected={filters.shelf} onSelect={(v) => set("shelf", v)} />
        </CollapsibleSection>
      )}

      {tags.length > 0 && (
        <CollapsibleSection title={t("filters.tags")} activeLabel={filters.tag}>
          <OptionList options={tags} selected={filters.tag} onSelect={(v) => set("tag", v)} />
        </CollapsibleSection>
      )}

      <CollapsibleSection title={t("filters.year")} activeLabel={yearLabel}>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={t("filters.min")}
            value={filters.year_min ?? ""}
            onChange={(e) => set("year_min", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-md border border-line-strong bg-surface-hover px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
          <input
            type="number"
            placeholder={t("filters.max")}
            value={filters.year_max ?? ""}
            onChange={(e) => set("year_max", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-md border border-line-strong bg-surface-hover px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </CollapsibleSection>

      {activeCount > 0 && (
        <button
          onClick={() => onChange({ limit: filters.limit, offset: 0 })}
          className="mt-3 text-sm text-ink-muted underline hover:text-ink"
        >
          {t("filters.clearFilters")}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="sm:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        >
          <span>{t("filters.filters")}</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-medium text-on-accent">
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">
                {t("filters.filters")}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-hover hover:text-ink"
                aria-label={t("filters.closeFilters")}
              >
                ✕
              </button>
            </div>
            {body}
          </div>
        </div>
      )}
    </>
  );
}
