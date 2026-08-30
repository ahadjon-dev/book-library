import { api } from "@/api/client";

export interface Me {
  id: number;
  email: string;
  display_name: string;
}

export async function login(email: string, password: string): Promise<string> {
  const { data } = await api.post<{ access_token: string }>("/auth/login", { email, password });
  return data.access_token;
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/auth/me");
  return data;
}
