import { NavLink } from "react-router-dom";
import { Handshake, Bookmark, Share2, Settings, Palette, Languages, LogOut, X, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { THEMES, useTheme, type Theme } from "@/lib/ThemeContext";
import { LANGUAGES, useTranslation, type Language } from "@/lib/LanguageContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenShare: () => void;
  onOpenLibrary: () => void;
  onLogout: () => void;
}

export function MobileMoreDrawer({ isOpen, onClose, onOpenProfile, onOpenShare, onOpenLibrary, onLogout }: Props) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 md:hidden animate-in fade-in duration-200">
      <div className="w-full max-h-[85vh] flex flex-col rounded-t-3xl border-t border-line bg-surface p-5 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent shadow-sm">
              {(user?.display_name || "U")[0].toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-bold text-ink truncate">{user?.display_name}</p>
              <p className="text-xs text-ink-secondary truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links */}
        <div className="space-y-1 mb-4">
          <NavLink
            to="/loans"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive ? "bg-accent/10 text-accent font-semibold" : "text-ink hover:bg-surface-hover"
              }`
            }
          >
            <Handshake className="h-5 w-5 text-accent" />
            <span>{t("loans.title")}</span>
          </NavLink>

          <NavLink
            to="/wishlist"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive ? "bg-accent/10 text-accent font-semibold" : "text-ink hover:bg-surface-hover"
              }`
            }
          >
            <Bookmark className="h-5 w-5 text-amber-400" />
            <span>{t("nav.wishlist")}</span>
          </NavLink>

          <button
            onClick={() => {
              onClose();
              onOpenLibrary();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-ink hover:bg-surface-hover transition text-left"
          >
            <Users className="h-5 w-5 text-accent" />
            <span>{t("library.title")}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenShare();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-ink hover:bg-surface-hover transition text-left"
          >
            <Share2 className="h-5 w-5 text-blue-400" />
            <span>{t("shareShelf.title")}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-ink hover:bg-surface-hover transition text-left"
          >
            <Settings className="h-5 w-5 text-ink-secondary" />
            <span>Profile & Password</span>
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-3 mb-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              <Palette className="h-4 w-4" />
              <span>{t("nav.theme")}</span>
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {THEMES.map((th) => (
                <option key={th.value} value={th.value}>
                  {th.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              <Languages className="h-4 w-4" />
              <span>{t("nav.language")}</span>
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-line pt-2">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="h-5 w-5" />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
