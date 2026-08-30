export interface PublicBook {
  id: number;
  title: string;
  subtitle: string | null;
  authors: string[];
  genre: string | null;
  publication_year: number | null;
  page_count: number | null;
  cover_image_path: string | null;
  shelf: string | null;
  tags: string[];
  status: string;
  rating: number | null;
}

export interface PublicLibraryResponse {
  owner_name: string;
  total_books: number;
  books: PublicBook[];
}

export interface ShareLinkConfig {
  share_slug: string | null;
  is_public_shelf: boolean;
  share_url: string;
}
