import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchMe, login as loginRequest, register as registerRequest, type Me } from "@/api/auth";
import { clearToken, getToken, setToken } from "@/api/client";

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, inviteCode?: string | null) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const token = await loginRequest(email, password);
    setToken(token);
    const me = await fetchMe();
    setUser(me);
  }

  async function register(email: string, password: string, displayName: string, inviteCode?: string | null) {
    const token = await registerRequest(email, password, displayName, inviteCode);
    setToken(token);
    const me = await fetchMe();
    setUser(me);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
