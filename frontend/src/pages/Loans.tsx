import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Handshake, Check, CheckCircle2, Trash2 } from "lucide-react";
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
        <div className="rounded-2xl border border-line bg-surface p-12 text-center flex flex-col items-center justify-center">
          <Handshake className="h-12 w-12 text-ink-muted mb-3" />
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
              className="rounded-2xl border border-line bg-surface p-5 space-y-4 hover:border-line-strong transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/books/${loan.book_id}`}
                    className="font-bold text-sm text-ink hover:text-accent transition line-clamp-2"
                  >
                    {loan.book_title}
                  </Link>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      loan.is_returned
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : loan.is_overdue
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}
                  >
                    {loan.is_returned
                      ? t("loans.returnedBadge")
                      : loan.is_overdue
                      ? t("loans.overdueBadge")
                      : t("loans.active")}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-ink-secondary bg-canvas/60 p-3 rounded-xl border border-line">
                  <p>
                    <span className="text-ink-muted">{t("loans.borrower")}:</span>{" "}
                    <strong className="text-ink">{loan.borrower_name}</strong>
                  </p>
                  {loan.borrower_contact && (
                    <p>
                      <span className="text-ink-muted">Contact:</span> {loan.borrower_contact}
                    </p>
                  )}
                  {loan.created_by && (
                    <p>
                      <span className="text-ink-muted">{t("loans.lentBy")}</span> {loan.created_by}
                    </p>
                  )}
                  <p>
                    <span className="text-ink-muted">{t("loans.loanDate")}:</span> {loan.loan_date}
                  </p>
                  {loan.due_date && (
                    <p>
                      <span className="text-ink-muted">{t("loans.dueDate")}:</span> {loan.due_date}
                    </p>
                  )}
                  {loan.returned_at && (
                    <p className="text-emerald-400">
                      <span>{t("loans.returnedAt")}:</span> {loan.returned_at}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-line">
                {!loan.is_returned ? (
                  <button
                    onClick={() => handleReturn(loan.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t("loans.markReturned")}</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </span>
                )}

                <button
                  onClick={() => handleDelete(loan.id)}
                  className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-rose-400 transition p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t("common.delete")}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
