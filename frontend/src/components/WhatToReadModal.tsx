import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Zap, Brain, Coffee, Flame, BookOpen, X } from "lucide-react";
import { recommendNextBooks, updateMyStatus } from "@/api/books";
import { coverUrl } from "@/api/client";
import type { RecommendNextResponse } from "@/types/recommendation";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatToReadModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState<RecommendNextResponse | null>(null);

  if (!isOpen) return null;

  async function handleRecommend(moodStr: string, maxPages?: number) {
    try {
      setLoading(true);
      const data = await recommendNextBooks({
        mood: moodStr,
        max_pages: maxPages,
        custom_prompt: customPrompt.trim() || undefined,
      });
      setResult(data);
    } catch (err: any) {
      console.error("Recommendation failed", err);
      showToast(err.response?.data?.detail || "Failed to generate recommendations");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartReading(bookId: number) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await updateMyStatus(bookId, { status: "reading", started_at: today });
      showToast("Marked as currently reading!");
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to update reading status");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-2xl transition">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t("recommend.title")}</h2>
              <p className="text-xs text-ink-secondary">{t("recommend.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mood Presets */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            Pick your vibe / mood:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleRecommend("fast-paced thriller")}
              className="flex flex-col items-start rounded-xl border border-line bg-canvas p-3 text-left hover:border-accent hover:bg-surface-hover transition text-xs font-medium text-ink group"
            >
              <Zap className="h-4 w-4 text-amber-400 mb-1 group-hover:scale-110 transition" />
              <span>{t("recommend.thrillerMood")}</span>
            </button>
            <button
              onClick={() => handleRecommend("mind-expanding science and philosophy")}
              className="flex flex-col items-start rounded-xl border border-line bg-canvas p-3 text-left hover:border-accent hover:bg-surface-hover transition text-xs font-medium text-ink group"
            >
              <Brain className="h-4 w-4 text-purple-400 mb-1 group-hover:scale-110 transition" />
              <span>{t("recommend.scienceMood")}</span>
            </button>
            <button
              onClick={() => handleRecommend("short weekend read", 250)}
              className="flex flex-col items-start rounded-xl border border-line bg-canvas p-3 text-left hover:border-accent hover:bg-surface-hover transition text-xs font-medium text-ink group"
            >
              <Coffee className="h-4 w-4 text-orange-400 mb-1 group-hover:scale-110 transition" />
              <span>{t("recommend.shortMood")}</span>
            </button>
            <button
              onClick={() => handleRecommend("epic fantasy")}
              className="flex flex-col items-start rounded-xl border border-line bg-canvas p-3 text-left hover:border-accent hover:bg-surface-hover transition text-xs font-medium text-ink group"
            >
              <Flame className="h-4 w-4 text-rose-400 mb-1 group-hover:scale-110 transition" />
              <span>{t("recommend.epicMood")}</span>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRecommend(customPrompt);
            }}
            className="flex gap-2 pt-1"
          >
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t("recommend.customPromptPlaceholder")}
              className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !customPrompt.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
            >
              {t("recommend.findNext")}
            </button>
          </form>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto mt-4 pt-4 border-t border-line space-y-3">
          {loading ? (
            <div className="text-center py-8 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent mx-auto" />
              <p className="text-xs text-ink-secondary">{t("recommend.searching")}</p>
            </div>
          ) : result ? (
            result.recommendations.length === 0 ? (
              <p className="text-xs text-ink-secondary text-center py-8">{t("recommend.noUnread")}</p>
            ) : (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-ink-secondary">
                  Top Matches ({result.unread_pool_size} unread books on shelf):
                </span>

                {result.recommendations.map(({ book, match_score, reason, mood_tags }) => {
                  const cover = coverUrl(book.cover_image_path);
                  return (
                    <div
                      key={book.id}
                      className="flex gap-4 p-4 rounded-xl border border-line bg-canvas hover:border-line-strong transition"
                    >
                      <div className="h-20 w-14 shrink-0 rounded-lg bg-surface overflow-hidden border border-line">
                        {cover ? (
                          <img src={cover} alt={book.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-ink-muted">
                            <BookOpen className="h-5 w-5 text-ink-muted" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to={`/books/${book.id}`}
                              onClick={onClose}
                              className="font-bold text-sm text-ink hover:text-accent transition truncate"
                            >
                              {book.title}
                            </Link>
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {t("recommend.matchScore", { score: match_score })}
                            </span>
                          </div>
                          <p className="text-xs text-ink-secondary truncate">
                            {book.authors.join(", ")} {book.page_count ? `• ${book.page_count} pages` : ""}
                          </p>
                          <p className="text-xs text-ink mt-1.5 italic bg-surface/60 p-2 rounded-lg border border-line">
                            "{reason}"
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {mood_tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-md text-[10px] bg-surface text-ink-secondary border border-line"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => handleStartReading(book.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent hover:bg-accent-hover transition shrink-0"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>{t("recommend.startReading")}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <p className="text-xs text-ink-secondary text-center py-6">
              Select a mood or type a prompt above to see your top personalized picks.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
