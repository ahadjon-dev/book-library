import { NavLink } from "react-router-dom";
import { Library, Sparkles, Plus, BarChart3, Menu } from "lucide-react";
import { useTranslation } from "@/lib/LanguageContext";

interface Props {
  onOpenRecommend: () => void;
  onOpenAddHub: () => void;
  onOpenMore: () => void;
}

export function BottomNav({ onOpenRecommend, onOpenAddHub, onOpenMore }: Props) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-line bg-surface/95 backdrop-blur-md px-2 py-1.5 md:hidden shadow-lg safe-area-inset-bottom">
      {/* 1. Library */}
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition ${
            isActive ? "text-accent" : "text-ink-secondary hover:text-ink"
          }`
        }
      >
        <Library className="h-5 w-5 mb-0.5" />
        <span>{t("nav.library")}</span>
      </NavLink>

      {/* 2. AI Picks */}
      <button
        onClick={onOpenRecommend}
        className="flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold text-ink-secondary hover:text-accent transition"
      >
        <Sparkles className="h-5 w-5 mb-0.5" />
        <span>AI Picks</span>
      </button>

      {/* 3. Center Add Button */}
      <button
        onClick={onOpenAddHub}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-accent/25 hover:scale-105 active:scale-95 transition -mt-5 border-4 border-surface"
        title={t("addHub.title")}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* 4. Stats */}
      <NavLink
        to="/stats"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition ${
            isActive ? "text-accent" : "text-ink-secondary hover:text-ink"
          }`
        }
      >
        <BarChart3 className="h-5 w-5 mb-0.5" />
        <span>{t("nav.stats")}</span>
      </NavLink>

      {/* 5. More */}
      <button
        onClick={onOpenMore}
        className="flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold text-ink-secondary hover:text-ink transition"
      >
        <Menu className="h-5 w-5 mb-0.5" />
        <span>More</span>
      </button>
    </nav>
  );
}
