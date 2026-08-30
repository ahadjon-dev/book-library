import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/lib/LanguageContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-ink-secondary">{t("common.loading")}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
