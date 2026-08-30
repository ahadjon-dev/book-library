import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BookOpen, Library, Handshake, BarChart3, Bookmark, Sparkles, Plus, Share2 } from "lucide-react";

import { useTranslation } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { AddBooksHubModal } from "@/components/AddBooksHubModal";
import { ProfileModal } from "@/components/ProfileModal";
import { WhatToReadModal } from "@/components/WhatToReadModal";
import { ShareShelfModal } from "@/components/ShareShelfModal";
import { UserMenuDropdown } from "@/components/UserMenuDropdown";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-surface-hover text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
  }`;

export function Navbar() {
  const { logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [addHubOpen, setAddHubOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <nav className="flex shrink-0 items-center justify-between border-b border-line bg-canvas px-3 py-2 text-ink sm:px-6 sm:py-3">
        {/* Left: Brand & Desktop Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <NavLink to="/" className="mr-2 sm:mr-4 flex items-center gap-2 shrink-0 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent group-hover:bg-accent/20 transition">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="text-base font-bold text-ink tracking-tight hidden sm:inline">
              {t("nav.myLibrary")}
            </span>
          </NavLink>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              <Library className="h-4 w-4" />
              <span>{t("nav.library")}</span>
            </NavLink>
            <NavLink to="/loans" className={linkClass}>
              <Handshake className="h-4 w-4" />
              <span>{t("loans.title")}</span>
            </NavLink>
            <NavLink to="/stats" className={linkClass}>
              <BarChart3 className="h-4 w-4" />
              <span>{t("nav.stats")}</span>
            </NavLink>
            <NavLink to="/wishlist" className={linkClass}>
              <Bookmark className="h-4 w-4" />
              <span>{t("nav.wishlist")}</span>
            </NavLink>

            <button
              onClick={() => setRecommendOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10 transition"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t("recommend.title")}</span>
            </button>
          </div>
        </div>

        {/* Right: Actions & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Primary Add Books Button (Desktop) */}
          <button
            onClick={() => setAddHubOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-on-accent hover:bg-accent-hover transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{t("addHub.title")}</span>
          </button>

          {/* Share Button */}
          <button
            onClick={() => setShareOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs sm:text-sm font-medium text-ink hover:bg-surface-hover transition"
          >
            <Share2 className="h-4 w-4" />
            <span>{t("shareShelf.title")}</span>
          </button>

          {/* User & Settings Dropdown */}
          <UserMenuDropdown
            onOpenProfile={() => setProfileOpen(true)}
            onOpenShare={() => setShareOpen(true)}
            onLogout={handleLogout}
          />
        </div>
      </nav>

      {/* Feature Modals */}
      <AddBooksHubModal
        isOpen={addHubOpen}
        onClose={() => setAddHubOpen(false)}
        onSuccess={() => window.location.reload()}
      />

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
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
