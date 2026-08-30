import { useState, useRef, useEffect } from "react";
import { Share2, Settings, Palette, Languages, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { THEMES, useTheme, type Theme } from "@/lib/ThemeContext";
import { LANGUAGES, useTranslation, type Language } from "@/lib/LanguageContext";

interface Props {
  onOpenProfile: () => void;
  onOpenShare: () => void;
  onLogout: () => void;
}

export function UserMenuDropdown({ onOpenProfile, onOpenShare, onLogout }: Props) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const initials = (user?.display_name || user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 sm:px-2.5 sm:py-1.5 border border-line bg-surface hover:bg-surface-hover transition focus:outline-none"
        title="User & Settings"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent shadow-sm">
          {initials}
        </span>
        <span className="hidden sm:inline text-xs font-semibold text-ink max-w-[100px] truncate">
          {user?.display_name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-muted hidden sm:inline transition duration-200" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* User Info Header */}
          <div className="px-3 py-2 border-b border-line mb-1.5">
            <p className="text-xs font-bold text-ink truncate">{user?.display_name}</p>
            <p className="text-[11px] text-ink-secondary truncate">{user?.email}</p>
          </div>

          {/* Quick Actions */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenShare();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-surface-hover transition text-left"
            >
              <Share2 className="h-4 w-4 text-accent" />
              <span>{t("shareShelf.title")}</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-surface-hover transition text-left"
            >
              <Settings className="h-4 w-4 text-ink-secondary" />
              <span>Profile & Password</span>
            </button>
          </div>

          <div className="my-1.5 border-t border-line" />

          {/* Preferences */}
          <div className="px-3 py-1.5 space-y-2.5">
            {/* Theme Selector */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                <Palette className="h-3 w-3" />
                <span>{t("nav.theme")}</span>
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {THEMES.map((th) => (
                  <option key={th.value} value={th.value}>
                    {th.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Selector */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                <Languages className="h-3 w-3" />
                <span>{t("nav.language")}</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="my-1.5 border-t border-line" />

          {/* Logout */}
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition text-left"
          >
            <LogOut className="h-4 w-4 text-red-400" />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
