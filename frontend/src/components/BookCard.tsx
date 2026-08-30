import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coverUrl } from "@/api/client";
import { updateMyStatus } from "@/api/books";
import { useStatusLabels } from "@/lib/statusLabels";
import { useToast } from "@/lib/ToastContext";
import type { Book, ReadStatus, StatusUpdate } from "@/types/book";

export function BookCard({ book }: { book: Book }) {
  const statusLabels = useStatusLabels();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cover = coverUrl(book.cover_image_path);
  const status: ReadStatus = book.my_status?.status ?? "unread";
  const rating = book.my_status?.rating;

  // Status & Rating Mutation
  const statusMutation = useMutation({
    mutationFn: (update: StatusUpdate) => updateMyStatus(book.id, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      showToast("Failed to update status", "error");
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    }
    if (statusMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [statusMenuOpen]);

  function handleStatusSelect(newStatus: ReadStatus, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setStatusMenuOpen(false);

    const today = new Date().toISOString().slice(0, 10);
    const update: StatusUpdate = { status: newStatus };
    if (newStatus === "reading" && !book.my_status?.started_at) {
      update.started_at = today;
    } else if (newStatus === "finished" && !book.my_status?.finished_at) {
      update.finished_at = today;
    }

    statusMutation.mutate(update);
    showToast(`Updated to ${statusLabels[newStatus]}`);
  }

  function handleRatingClick(starIdx: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Map 1-5 stars to 2, 4, 6, 8, 10
    const targetRating = (starIdx + 1) * 2;
    const currentFiveStar = rating ? Math.round(rating / 2) : 0;
    const newRating = starIdx + 1 === currentFiveStar ? null : targetRating;

    statusMutation.mutate({ rating: newRating });
    if (newRating) {
      showToast(`Rated ${starIdx + 1}/5 ★`);
    } else {
      showToast("Rating cleared");
    }
  }

  const statusColor =
    status === "finished"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
      : status === "reading"
      ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
      : status === "abandoned"
      ? "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25"
      : "bg-surface-hover/80 text-ink-secondary border-line hover:bg-surface-hover";

  const statusEmoji: Record<ReadStatus, string> = {
    unread: "⏳",
    reading: "📖",
    finished: "✅",
    abandoned: "🚫",
  };

  return (
    <div className="group relative block w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-surface text-ink transition hover:border-line-strong hover:shadow-lg sm:w-36 md:w-44 flex flex-col">
      <Link to={`/books/${book.id}`} className="block flex-1">
        {/* Cover Image */}
        <div className="relative aspect-[2/3] w-full bg-surface-hover overflow-hidden">
          {cover ? (
            <img
              src={cover}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
              <span className="text-2xl mb-1">📖</span>
              <span className="text-xs font-semibold text-ink line-clamp-2">{book.title}</span>
            </div>
          )}

          {/* Wishlist badge */}
          {!book.owned && (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-semibold text-amber-300 border border-amber-500/30 shadow-sm">
              ⭐ Wishlist
            </span>
          )}
        </div>

        {/* Title & Author */}
        <div className="p-2.5 pb-1.5">
          <p className="truncate text-xs sm:text-sm font-semibold text-ink leading-snug" title={book.title}>
            {book.title}
          </p>
          <p className="truncate text-[11px] text-ink-secondary mt-0.5">
            {book.authors.join(", ") || "Unknown"}
          </p>
        </div>
      </Link>

      {/* Quick Interactive Actions Footer */}
      <div className="px-2.5 pb-2.5 pt-0 mt-auto space-y-1.5">
        {/* Interactive 5-Star Rating */}
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-0.5" title="Click to rate 1-5 stars">
            {[0, 1, 2, 3, 4].map((idx) => {
              const currentStar = rating ? Math.round(rating / 2) : 0;
              const isFilled = idx < currentStar;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleRatingClick(idx, e)}
                  className={`text-sm transition hover:scale-125 focus:outline-none ${
                    isFilled ? "text-amber-400" : "text-ink-muted hover:text-amber-300"
                  }`}
                  aria-label={`Rate ${idx + 1} stars`}
                >
                  ★
                </button>
              );
            })}
          </div>
          {rating ? (
            <span className="text-[10px] font-bold text-amber-400/90">{rating}/10</span>
          ) : (
            <span className="text-[10px] text-ink-muted">—</span>
          )}
        </div>

        {/* 1-Tap Quick Status Pill with Popover */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setStatusMenuOpen(!statusMenuOpen);
            }}
            className={`w-full flex items-center justify-between gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition ${statusColor}`}
          >
            <span className="truncate">
              {statusEmoji[status]} {statusLabels[status]}
            </span>
            <span className="text-[9px] opacity-70">▾</span>
          </button>

          {/* Status Selection Popover */}
          {statusMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-line bg-surface p-1 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-100">
              {(["unread", "reading", "finished", "abandoned"] as ReadStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={(e) => handleStatusSelect(st, e)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-left transition ${
                    st === status
                      ? "bg-accent text-on-accent font-semibold"
                      : "text-ink hover:bg-surface-hover"
                  }`}
                >
                  <span>{statusEmoji[st]}</span>
                  <span className="truncate">{statusLabels[st]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
