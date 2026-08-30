import { api } from "@/api/client";
import type { PublicLibraryResponse, ShareLinkConfig } from "@/types/public";

export async function fetchPublicLibrary(
  slugOrId: string,
  params?: { genre?: string; tag?: string; status?: string; min_rating?: number }
): Promise<PublicLibraryResponse> {
  const { data } = await api.get<PublicLibraryResponse>(`/public/library/${slugOrId}`, { params });
  return data;
}

export async function fetchMyShareLink(): Promise<ShareLinkConfig> {
  const { data } = await api.get<ShareLinkConfig>("/public/my-share-link");
  return data;
}

export async function updateMyShareLink(payload: {
  share_slug?: string | null;
  is_public_shelf: boolean;
}): Promise<ShareLinkConfig> {
  const { data } = await api.post<ShareLinkConfig>("/public/my-share-link", payload);
  return data;
}
