import { useState } from "react";
import { Handshake, X } from "lucide-react";
import { createLoan } from "@/api/loans";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  bookId: number;
  bookTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LendBookModal({ isOpen, bookId, bookTitle, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerContact, setBorrowerContact] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleLendBook(e: React.FormEvent) {
    e.preventDefault();
    if (!borrowerName.trim()) return;

    try {
      setSaving(true);
      await createLoan({
        book_id: bookId,
        borrower_name: borrowerName.trim(),
        borrower_contact: borrowerContact.trim() || undefined,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
      showToast(t("loans.loanCreated"));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to record loan", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl transition space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Handshake className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t("loans.lendBook")}</h2>
              <p className="text-xs text-ink-secondary truncate max-w-xs">{bookTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleLendBook} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              {t("loans.borrower")} *
            </label>
            <input
              type="text"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              {t("loans.borrowerContact")}
            </label>
            <input
              type="text"
              value={borrowerContact}
              onChange={(e) => setBorrowerContact(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              placeholder="e.g. john@example.com or +1 234..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              {t("loans.dueDate")}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              {t("bookDetail.notes")}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none resize-none"
              placeholder="Any details about condition, meetup..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !borrowerName.trim()}
              className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("loans.lendBook")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
