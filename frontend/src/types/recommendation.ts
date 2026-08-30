import type { Book } from "@/types/book";

export interface RecommendationItem {
  book: Book;
  match_score: number;
  reason: string;
  mood_tags: string[];
}

export interface RecommendNextResponse {
  recommendations: RecommendationItem[];
  unread_pool_size: number;
  criteria_summary: string;
}
