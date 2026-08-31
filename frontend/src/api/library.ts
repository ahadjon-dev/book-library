import { api } from "@/api/client";
import type { InviteInfo, InvitePreview, LibraryInfo } from "@/types/library";

export async function fetchLibrary(): Promise<LibraryInfo> {
  const { data } = await api.get<LibraryInfo>("/library");
  return data;
}

export async function renameLibrary(name: string): Promise<LibraryInfo> {
  const { data } = await api.patch<LibraryInfo>("/library", { name });
  return data;
}

export async function fetchInvite(): Promise<InviteInfo> {
  const { data } = await api.get<InviteInfo>("/library/invite");
  return data;
}

export async function rotateInvite(): Promise<InviteInfo> {
  const { data } = await api.post<InviteInfo>("/library/invite");
  return data;
}

export async function revokeInvite(): Promise<void> {
  await api.delete("/library/invite");
}

export async function fetchInvitePreview(code: string): Promise<InvitePreview> {
  const { data } = await api.get<InvitePreview>(`/auth/invite/${encodeURIComponent(code)}`);
  return data;
}
