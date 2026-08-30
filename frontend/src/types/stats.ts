import type { StatusCounts } from "@/types/book";

export interface GenreCount {
  genre: string;
  count: number;
}

export interface DecadeCount {
  decade: string;
  count: number;
}

export interface ReadingPeriodCounts {
  books: number;
  pages: number;
}

export interface ReadingAverages {
  books_per_day: number;
  books_per_week: number;
  books_per_month: number;
  books_per_year: number;
  pages_per_day: number;
  pages_per_week: number;
  pages_per_month: number;
  pages_per_year: number;
}

export interface Stats {
  total_books: number;
  status_counts: StatusCounts;
  total_pages: number;
  avg_publication_year: number | null;
  most_common_author: string | null;
  most_common_genre: string | null;
  genre_counts: GenreCount[];
  decade_counts: DecadeCount[];
  pages_read_total: number;
  reading_this_week: ReadingPeriodCounts;
  reading_this_month: ReadingPeriodCounts;
  reading_this_year: ReadingPeriodCounts;
  reading_averages: ReadingAverages | null;
}
