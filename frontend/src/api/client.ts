import axios from "axios";

// Runtime config is injected by docker-entrypoint.sh into /env-config.js
// which sets window.__RUNTIME_CONFIG__.VITE_API_URL at container start.
// Falls back to build-time VITE_API_URL, then localhost for local dev.
const _runtimeConfig = (window as any).__RUNTIME_CONFIG__ ?? {};
export const API_URL: string =
  _runtimeConfig.VITE_API_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

const TOKEN_KEY = "library_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return `${API_URL}/uploads/${path}`;
}
