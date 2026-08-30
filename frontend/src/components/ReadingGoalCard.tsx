import { useEffect, useState } from "react";
import { fetchReadingGoal, setReadingGoal } from "@/api/goals";
import type { ReadingGoal } from "@/types/goal";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

export function ReadingGoalCard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const currentYear = new Date().getFullYear();

  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("25");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoal();
  }, []);

  async function loadGoal() {
    try {
      setLoading(true);
      const data = await fetchReadingGoal(currentYear);
      setGoal(data);
      setTargetInput(String(data.target_books));
    } catch (err) {
      console.error("Failed to load reading goal", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(targetInput, 10);
    if (isNaN(num) || num < 1) return;

    try {
      setSaving(true);
      const updated = await setReadingGoal(currentYear, num);
      setGoal(updated);
      setEditing(false);
      showToast(t("goals.goalUpdated"));
    } catch (err) {
      console.error("Failed to update reading goal", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !goal) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 animate-pulse">
        <div className="h-6 w-48 bg-line rounded mb-4" />
        <div className="h-4 w-full bg-line rounded" />
      </div>
    );
  }

  const getPaceBadge = () => {
    switch (goal.pace_status) {
      case "completed":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{t("goals.completedBadge")}</span>;
      case "ahead":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{t("goals.aheadBadge")}</span>;
      case "on_track":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">{t("goals.onTrackBadge")}</span>;
      case "behind":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">{t("goals.behindBadge")}</span>;
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-6 transition shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent font-bold">
            🎯
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">
              {t("goals.title")} ({goal.year})
            </h3>
            <p className="text-xs text-ink-secondary">
              {t("goals.readSoFar", { read: goal.books_read, target: goal.target_books })} • {goal.pages_read.toLocaleString()} {t("stats.pages")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getPaceBadge()}
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            {editing ? t("common.save") : t("goals.editGoal")}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSaveGoal} className="mt-4 flex items-center gap-3">
          <label className="text-xs text-ink-secondary">{t("goals.target")}:</label>
          <input
            type="number"
            min="1"
            max="500"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            className="w-24 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </form>
      ) : (
        <div className="space-y-2 mt-3">
          <div className="flex justify-between text-xs text-ink-secondary font-medium">
            <span>{Math.min(goal.percentage_complete, 100)}%</span>
            <span>
              {goal.books_remaining > 0
                ? `${goal.books_remaining} ${t("stats.books")} remaining`
                : "Target Reached!"}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-canvas border border-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(goal.percentage_complete, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
