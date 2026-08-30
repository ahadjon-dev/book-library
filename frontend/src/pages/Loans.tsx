import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLoans, returnLoan, deleteLoan } from "@/api/loans";
import type { BookLoan } from "@/types/loan";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

export function Loans() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<"active" | "returned" | "all">("active");
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoans();
  }, [filter]);

  async function loadLoans() {
    try {
      setLoading(true);
      const data = await fetchLoans(filter);
      setLoans(data);
    } catch (err) {
      console.error("Failed to load loans", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReturn(loanId: number) {
    try {
      await returnLoan(loanId);
      showToast(t("loans.loanReturned"));
      loadLoans();
    } catch (err) {
      console.error("Failed to mark loan as returned", err);
    }
  }

  async function handleDelete(loanId: number) {
    if (!confirm("Delete this loan record?")) return;
    try {
      await deleteLoan(loanId);
      showToast(t("loans.loanDeleted"));
      setLoans((prev) => prev.filter((l) => l.id !== loanId));
    } catch (err) {
      console.error("Failed to delete loan", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{t("loans.title")}</h1>
          <p className="text-xs text-ink-secondary mt-1">
            Track books you have lent to friends and family
          </p>
        </div>

        {/* Status Tabs */}
        <div className="flex rounded-xl border border-line bg-surface p-1">
          <button
            onClick={() => setFilter("active")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              filter === "active"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {t("loans.active")}
          </button>
          <button
            onClick={() => setFilter("returned")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              filter === "returned"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {t("loans.returned")}
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              filter === "all"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {t("loans.all")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-xl border border-line bg-surface p-6" />
          ))}
        </div>
      ) : loans.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center">
          <span className="text-4xl block mb-2">🤝</span>
          <h3 className="text-base font-semibold text-ink">{t("loans.noLoans")}</h3>
          <p className="text-xs text-ink-secondary mt-1">
            Open any book in your library and click "Lend Book" to track it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:border-line-strong space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/books/${loan.book_id}`}
                    className="font-bold text-sm text-ink hover:text-accent transition truncate"
                  >
                    {loan.book_title}
                  </Link>
                  {loan.is_returned ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t("loans.returnedBadge")}
                    </span>
                  ) : loan.is_overdue ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                      {t("loans.overdueBadge")}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Active
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs text-ink-secondary">
                  <p>
                    <strong className="text-ink font-medium">{t("loans.borrower")}:</strong>{" "}
                    {loan.borrower_name}
                  </p>
                  {loan.borrower_contact && (
                    <p>
                      <strong className="text-ink font-medium">Contact:</strong>{" "}
                      {loan.borrower_contact}
                    </p>
                  )}
                  <p>
                    <strong className="text-ink font-medium">{t("loans.loanDate")}:</strong>{" "}
                    {loan.loan_date}
                  </p>
                  {loan.due_date && (
                    <p className={loan.is_overdue ? "text-rose-400 font-semibold" : ""}>
                      <strong className="text-ink font-medium">{t("loans.dueDate")}:</strong>{" "}
                      {loan.due_date}
                    </p>
                  )}
                  {loan.returned_at && (
                    <p>
                      <strong className="text-ink font-medium">{t("loans.returnedAt")}:</strong>{" "}
                      {loan.returned_at}
                    </p>
                  )}
                  {loan.notes && (
                    <p className="italic bg-canvas p-2 rounded-lg border border-line mt-2 text-[11px]">
                      "{loan.notes}"
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-line">
                {!loan.is_returned ? (
                  <button
                    onClick={() => handleReturn(loan.id)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover transition"
                  >
                    ✓ {t("loans.markReturned")}
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-medium">✓ Completed</span>
                )}

                <button
                  onClick={() => handleDelete(loan.id)}
                  className="text-xs text-ink-secondary hover:text-rose-400 transition p-1"
                >
                  ✕ {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
