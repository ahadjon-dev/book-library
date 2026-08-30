import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/LanguageContext";

export function Carousel({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  // Re-check on every render (cheap) so newly-loaded rows and container
  // resizes both correctly show/hide the affordance buttons.
  useEffect(() => {
    updateScrollState();
  });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function slide(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateScrollState}
        className="scrollbar-hide flex gap-3 overflow-x-auto scroll-smooth pb-1"
      >
        {children}
      </div>
      {canScrollLeft && (
        <button
          aria-label={t("scanner.scrollLeft")}
          onClick={() => slide(-1)}
          className="absolute left-0 top-0 hidden h-full w-9 items-center justify-center bg-gradient-to-r from-canvas to-transparent text-xl text-ink-secondary hover:text-ink sm:flex"
        >
          ‹
        </button>
      )}
      {canScrollRight && (
        <button
          aria-label={t("scanner.scrollRight")}
          onClick={() => slide(1)}
          className="absolute right-0 top-0 hidden h-full w-9 items-center justify-center bg-gradient-to-l from-canvas to-transparent text-xl text-ink-secondary hover:text-ink sm:flex"
        >
          ›
        </button>
      )}
    </div>
  );
}
