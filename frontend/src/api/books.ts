import { api } from "@/api/client";
import type {
  Book,
  BookFilters,
  BookFormValues,
  BookListResponse,
  StatusUpdate,
} from "@/types/book";
import type { IsbnLookupResult } from "@/types/lookup";
import type { Stats } from "@/types/stats";

export async function fetchBooks(filters: BookFilters): Promise<BookListResponse> {
  const { data } = await api.get<BookListResponse>("/books", { params: filters });
  return data;
}

export async function fetchBook(id: number): Promise<Book> {
  const { data } = await api.get<Book>(`/books/${id}`);
  return data;
}

export async function createBook(values: BookFormValues): Promise<Book> {
  const { data } = await api.post<Book>("/books", values);
  return data;
}

export async function updateBook(id: number, values: Partial<BookFormValues>): Promise<Book> {
  const { data } = await api.patch<Book>(`/books/${id}`, values);
  return data;
}

export async function deleteBook(id: number): Promise<void> {
  await api.delete(`/books/${id}`);
}

export async function uploadCover(id: number, file: File): Promise<Book> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<Book>(`/books/${id}/cover`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateMyStatus(id: number, update: StatusUpdate): Promise<Book> {
  const { data } = await api.patch<Book>(`/books/${id}/status`, update);
  return data;
}

export async function fetchAuthors(): Promise<string[]> {
  const { data } = await api.get<string[]>("/authors");
  return data;
}

export async function fetchTags(): Promise<string[]> {
  const { data } = await api.get<string[]>("/tags");
  return data;
}

export async function fetchShelves(): Promise<string[]> {
  const { data } = await api.get<string[]>("/shelves");
  return data;
}

export async function fetchGenres(): Promise<string[]> {
  const { data } = await api.get<string[]>("/genres");
  return data;
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>("/stats");
  return data;
}

export async function lookupIsbn(isbn: string): Promise<IsbnLookupResult> {
  const { data } = await api.get<IsbnLookupResult>("/books/lookup", { params: { isbn } });
  return data;
}

export async function exportBooksExcel(filters: BookFilters): Promise<Blob> {
  const { data } = await api.get("/books/export", { params: filters, responseType: "blob" });
  return data;
}

export async function importBooksCsv(file: File): Promise<{
  total_rows: number;
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/books/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
