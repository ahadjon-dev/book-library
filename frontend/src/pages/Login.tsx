import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import { LANGUAGES, useTranslation, type Language } from "@/lib/LanguageContext";

export function Login() {
  const { login } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError(t("login.invalidCredentials"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("login.myLibrary")}</h1>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-md border border-line bg-surface-hover px-2 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
            aria-label={t("nav.language")}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-ink-secondary">{t("login.email")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-ink-secondary">{t("login.password")}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-surface-hover px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? t("login.signingIn") : t("login.signIn")}
        </button>
      </form>
    </div>
  );
}
