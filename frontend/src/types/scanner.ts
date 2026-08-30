export interface ShelfScanItem {
  detected_title: string;
  detected_author: string | null;
  confidence: number;
  matched: boolean;
  title: string;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  page_count: number | null;
  genre: string | null;
  cover_url: string | null;
  already_in_library: boolean;
  existing_book_id: number | null;
}

export interface ShelfScanResult {
  detected_count: number;
  matched_count: number;
  items: ShelfScanItem[];
}
