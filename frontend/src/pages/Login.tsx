import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, LogIn, UserPlus } from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { LANGUAGES, useTranslation, type Language } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

type Mode = "login" | "register";

export function Login() {
  const { login, register } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register") {
      if (!displayName.trim()) {
        setError("Please enter your name");
        return;
      }
      if (password.length < 8) {
        setError(t("login.passwordMinLength"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("login.passwordsDontMatch"));
        return;
      }

      setSubmitting(true);
      try {
        await register(email.trim(), password, displayName.trim());
        showToast(t("login.registrationSuccess"));
        navigate("/");
      } catch (err: any) {
        setError(err.response?.data?.detail || "Registration failed");
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitting(true);
      try {
        await login(email.trim(), password);
        navigate("/");
      } catch {
        setError(t("login.invalidCredentials"));
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-bold text-ink">{t("login.myLibrary")}</h1>
              <p className="text-[11px] text-ink-secondary">
                {mode === "login" ? "Welcome back!" : "Create your private library"}
              </p>
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-lg border border-line bg-surface-hover px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
            aria-label={t("nav.language")}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 border border-line mb-5">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              mode === "login"
                ? "bg-surface text-ink shadow-sm border border-line"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{t("login.signIn")}</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              mode === "register"
                ? "bg-surface text-ink shadow-sm border border-line"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{t("login.signUp")}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
                {t("login.displayName")} *
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none transition"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
              {t("login.email")} *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
              {t("login.password")} *
            </label>
            <input
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none transition"
            />
            {mode === "register" && (
              <p className="text-[10px] text-ink-muted">Min. 8 characters</p>
            )}
          </div>

          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
                {t("login.confirmPassword")} *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none transition"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50 shadow-md shadow-accent/20"
          >
            {submitting ? (
              <span>{mode === "login" ? t("login.signingIn") : t("login.signingUp")}</span>
            ) : (
              <span>{mode === "login" ? t("login.signIn") : t("login.createAccount")}</span>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="text-xs text-ink-secondary hover:text-accent font-medium transition"
          >
            {mode === "login" ? t("login.dontHaveAccount") : t("login.alreadyHaveAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
