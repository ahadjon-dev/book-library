import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { LANGUAGES, useTranslation, type Language } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { THEMES, useTheme, type Theme } from "@/lib/ThemeContext";
import { CsvImportModal } from "@/components/CsvImportModal";
import { ProfileModal } from "@/components/ProfileModal";
import { ShelfPhotoScanner } from "@/components/ShelfPhotoScanner";
import { WhatToReadModal } from "@/components/WhatToReadModal";
import { ShareShelfModal } from "@/components/ShareShelfModal";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-surface-hover text-ink" : "text-ink-secondary hover:text-ink"
  }`;

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const navigate = useNavigate();

  const [importOpen, setImportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <nav className="flex shrink-0 items-center gap-2 border-b border-line bg-canvas px-3 py-2 text-ink sm:px-6 sm:py-3">
        <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-2">
          <span className="mr-1 shrink-0 whitespace-nowrap text-base font-semibold sm:mr-4 sm:text-lg">
            📚 <span className="hidden sm:inline">{t("nav.myLibrary")}</span>
          </span>
          <NavLink to="/" end className={linkClass}>
            {t("nav.gallery")}
          </NavLink>
          <NavLink to="/table" className={linkClass}>
            {t("nav.table")}
          </NavLink>
          <NavLink to="/stats" className={linkClass}>
            {t("nav.stats")}
          </NavLink>
          <NavLink to="/loans" className={linkClass}>
            {t("loans.title")}
          </NavLink>
          <NavLink to="/wishlist" className={linkClass}>
            {t("nav.wishlist")}
          </NavLink>
          <NavLink to="/books/new" className={linkClass}>
            {t("nav.addBook")}
          </NavLink>

          <button
            onClick={() => setRecommendOpen(true)}
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10 transition"
          >
            🎯 {t("recommend.title")}
          </button>

          <button
            onClick={() => setScannerOpen(true)}
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink transition"
          >
            📸 Scan Shelf
          </button>

          <button
            onClick={() => setShareOpen(true)}
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink transition"
          >
            🔗 {t("shareShelf.title")}
          </button>

          <button
            onClick={() => setImportOpen(true)}
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink transition"
          >
            📥 {t("import.importButton")}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-ink-secondary sm:gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:border-line-strong focus:outline-none"
            aria-label={t("nav.language")}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:border-line-strong focus:outline-none"
            aria-label={t("nav.theme")}
          >
            {THEMES.map((th) => (
              <option key={th.value} value={th.value}>
                {th.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setProfileOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-surface-hover hover:text-ink font-medium transition"
            title="User Profile & Settings"
          >
            👤 <span>{user?.display_name}</span>
          </button>
          <button
            onClick={handleLogout}
            className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 hover:bg-surface-hover hover:text-ink"
          >
            {t("nav.logout")}
          </button>
        </div>
      </nav>

      {/* Feature Modals */}
      <CsvImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => window.location.reload()}
      />

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <ShelfPhotoScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={() => window.location.reload()}
      />

      <WhatToReadModal
        isOpen={recommendOpen}
        onClose={() => setRecommendOpen(false)}
      />

      <ShareShelfModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
