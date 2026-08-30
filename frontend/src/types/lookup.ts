export interface IsbnLookupMatch {
  id: number;
  owned: boolean;
}

export interface IsbnLookupResult {
  found: boolean;
  title: string | null;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publication_year: number | null;
  page_count: number | null;
  cover_url: string | null;
  already_in_library: IsbnLookupMatch | null;
}
