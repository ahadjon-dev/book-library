export interface ReadingGoal {
  year: number;
  target_books: number;
  books_read: number;
  pages_read: number;
  percentage_complete: number;
  books_remaining: number;
  pace_status: "completed" | "ahead" | "on_track" | "behind";
  expected_books_by_now: number;
}
