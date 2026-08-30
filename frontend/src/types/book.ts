export type ReadStatus = "unread" | "reading" | "finished" | "abandoned";

export interface MyStatus {
  status: ReadStatus;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface Book {
  id: number;
  title: string;
  subtitle: string | null;
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  language: string | null;
  page_count: number | null;
  cover_image_path: string | null;
  description: string | null;
  genre: string | null;
  owned: boolean;
  shelf: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  authors: string[];
  tags: string[];
  my_status: MyStatus | null;
  created_at: string;
  updated_at: string;
}

export interface StatusCounts {
  total: number;
  unread: number;
  reading: number;
  finished: number;
  abandoned: number;
}

export interface BookListResponse {
  items: Book[];
  total: number;
  limit: number;
  offset: number;
  status_counts: StatusCounts;
}

export interface BookFilters {
  search?: string;
  genre?: string;
  tag?: string;
  author?: string;
  shelf?: string;
  status?: ReadStatus;
  year_min?: number;
  year_max?: number;
  owned?: boolean;
  limit?: number;
  offset?: number;
}

export interface BookFormValues {
  title: string;
  subtitle: string | null;
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  language: string | null;
  page_count: number | null;
  description: string | null;
  genre: string | null;
  owned: boolean;
  purchase_date: string | null;
  purchase_price: number | null;
  authors: string[];
  tags: string[];
  shelf: string | null;
  cover_url?: string | null;
}

export interface StatusUpdate {
  status?: ReadStatus;
  rating?: number | null;
  notes?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}
