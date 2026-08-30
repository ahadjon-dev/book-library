import { useQuery } from "@tanstack/react-query";

import { fetchStats } from "@/api/books";
import { useTranslation } from "@/lib/LanguageContext";
import type { ReadingAverages } from "@/types/stats";
import { ReadingGoalCard } from "@/components/ReadingGoalCard";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-stat p-4 text-stat-ink">
      <p className="text-xs text-stat-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
    </div>
  );
}

function PeriodTile({ label, books, pages }: { label: string; books: number; pages: number }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-line bg-stat p-4 text-stat-ink">
      <p className="text-xs text-stat-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {books} <span className="text-sm font-normal text-stat-muted">{t("stats.books")}</span>
      </p>
      <p className="text-sm text-stat-muted">
        {pages.toLocaleString()} {t("stats.pages")}
      </p>
    </div>
  );
}

function AveragesTable({ averages }: { averages: ReadingAverages }) {
  const { t } = useTranslation();
  const rows: { label: string; books: number; pages: number }[] = [
    { label: t("stats.perDay"), books: averages.books_per_day, pages: averages.pages_per_day },
    { label: t("stats.perWeek"), books: averages.books_per_week, pages: averages.pages_per_week },
    { label: t("stats.perMonth"), books: averages.books_per_month, pages: averages.pages_per_month },
    { label: t("stats.perYear"), books: averages.books_per_year, pages: averages.pages_per_year },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th className="px-3 py-2 font-medium">{t("stats.average")}</th>
            <th className="px-3 py-2 font-medium">{t("stats.booksColumn")}</th>
            <th className="px-3 py-2 font-medium">{t("stats.pagesColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-0">
              <td className="px-3 py-2 text-ink-secondary">{row.label}</td>
              <td className="px-3 py-2 text-ink">{row.books.toFixed(row.books < 10 ? 2 : 1)}</td>
              <td className="px-3 py-2 text-ink">{row.pages.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarList({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-ink-secondary">{item.label}</span>
          <div className="h-3 flex-1 rounded-full bg-surface-hover">
            <div className="h-3 rounded-full bg-accent" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-ink-secondary">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export function Stats() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

  if (isLoading || !data) return <p className="text-ink-muted">{t("common.loading")}</p>;

  const sc = data.status_counts;
  const dash = t("common.dash");

  return (
    <div className="max-w-4xl space-y-8 pb-8">
      {/* Annual Reading Goal */}
      <ReadingGoalCard />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label={t("stats.booksOwned")} value={data.total_books} />
        <StatTile label={t("stats.unread")} value={sc.unread} />
        <StatTile label={t("stats.reading")} value={sc.reading} />
        <StatTile label={t("stats.finished")} value={sc.finished} />
        <StatTile label={t("stats.totalPages")} value={data.total_pages.toLocaleString()} />
        <StatTile label={t("stats.avgPublicationYear")} value={data.avg_publication_year ?? dash} />
        <StatTile label={t("stats.mostCommonAuthor")} value={data.most_common_author ?? dash} />
        <StatTile label={t("stats.mostCommonGenre")} value={data.most_common_genre ?? dash} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("stats.readingPace")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <PeriodTile
            label={t("stats.thisWeek")}
            books={data.reading_this_week.books}
            pages={data.reading_this_week.pages}
          />
          <PeriodTile
            label={t("stats.thisMonth")}
            books={data.reading_this_month.books}
            pages={data.reading_this_month.pages}
          />
          <PeriodTile
            label={t("stats.thisYear")}
            books={data.reading_this_year.books}
            pages={data.reading_this_year.pages}
          />
          <StatTile label={t("stats.totalPagesRead")} value={data.pages_read_total.toLocaleString()} />
        </div>

        {data.reading_averages ? (
          <AveragesTable averages={data.reading_averages} />
        ) : (
          <p className="text-sm text-ink-muted">{t("stats.pacePrompt")}</p>
        )}
      </section>

      {data.genre_counts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("stats.booksByGenre")}</h2>
          <BarList items={data.genre_counts.map((g) => ({ label: g.genre, count: g.count }))} />
        </section>
      )}

      {data.decade_counts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("stats.booksByDecade")}</h2>
          <BarList items={data.decade_counts.map((d) => ({ label: d.decade, count: d.count }))} />
        </section>
      )}
    </div>
  );
}
