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

export async function register(email: string, password: string, displayName: string): Promise<string> {
  const { data } = await api.post<{ access_token: string }>("/auth/register", {
    email,
    password,
    display_name: displayName,
  });
  return data.access_token;
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/auth/me");
  return data;
}

export async function updateProfile(displayName: string): Promise<Me> {
  const { data } = await api.patch<Me>("/auth/profile", { display_name: displayName });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}
