import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicLibrary } from "@/api/public";
import { coverUrl } from "@/api/client";
import type { PublicLibraryResponse } from "@/types/public";
import { THEMES, useTheme, type Theme } from "@/lib/ThemeContext";

export function PublicView() {
  const { slug } = useParams<{ slug: string }>();
  const { theme, setTheme } = useTheme();

  const [data, setData] = useState<PublicLibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    if (slug) loadLibrary();
  }, [slug, selectedGenre]);

  async function loadLibrary() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPublicLibrary(slug!, {
        genre: selectedGenre || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error("Failed to load public library", err);
      setError(err.response?.data?.detail || "This library is private or doesn't exist.");
    } finally {
      setLoading(false);
    }
  }

  const allGenres = Array.from(
    new Set(data?.books.map((b) => b.genre).filter(Boolean) as string[])
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Public Header */}
      <header className="border-b border-line bg-surface/50 backdrop-blur-md px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className="text-base font-bold text-ink">
              {data ? `${data.owner_name}'s Bookshelf` : "Public Library"}
            </h1>
            <p className="text-xs text-ink-secondary">
              {data ? `${data.total_books} curated books` : "Shared Library"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
          >
            {THEMES.map((th) => (
              <option key={th.value} value={th.value}>
                {th.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="aspect-[2/3] rounded-xl bg-surface border border-line" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-line bg-surface p-12 text-center max-w-md mx-auto mt-12">
            <span className="text-4xl block mb-2">🔒</span>
            <h3 className="text-lg font-bold text-ink">Library Unavailable</h3>
            <p className="text-xs text-ink-secondary mt-1">{error}</p>
          </div>
        ) : data && data.books.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-12 text-center">
            <span className="text-4xl block mb-2">📖</span>
            <h3 className="text-base font-semibold text-ink">No books found in this view.</h3>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Genre Filter Chips */}
            {allGenres.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedGenre(null)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition shrink-0 ${
                    selectedGenre === null
                      ? "bg-accent text-on-accent"
                      : "border border-line bg-surface text-ink-secondary hover:text-ink"
                  }`}
                >
                  All Genres
                </button>
                {allGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre === selectedGenre ? null : genre)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition shrink-0 ${
                      selectedGenre === genre
                        ? "bg-accent text-on-accent"
                        : "border border-line bg-surface text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}

            {/* Book Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {data!.books.map((book) => {
                const cover = coverUrl(book.cover_image_path);
                return (
                  <div
                    key={book.id}
                    className="flex flex-col rounded-xl border border-line bg-surface overflow-hidden shadow-sm hover:border-line-strong transition group"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden bg-canvas relative">
                      {cover ? (
                        <img
                          src={cover}
                          alt={book.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center p-3 text-center text-xs text-ink-muted">
                          {book.title}
                        </div>
                      )}
                      {book.rating && (
                        <span className="absolute top-2 right-2 rounded-md bg-black/70 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          ★ {book.rating}
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-semibold text-xs text-ink line-clamp-1">{book.title}</h4>
                        <p className="text-[11px] text-ink-secondary line-clamp-1 mt-0.5">
                          {book.authors.join(", ")}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-muted">
                        <span>{book.genre || "General"}</span>
                        <span>{book.page_count ? `${book.page_count}p` : ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
