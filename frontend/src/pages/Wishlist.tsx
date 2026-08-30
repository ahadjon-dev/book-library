import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { fetchBooks } from "@/api/books";
import { BookGrid } from "@/components/BookGrid";
import { FilterSidebar } from "@/components/FilterSidebar";
import { useTranslation } from "@/lib/LanguageContext";
import type { BookFilters } from "@/types/book";

export function Wishlist() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<BookFilters>({ owned: false, limit: 50, offset: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ["books", "wishlist", filters],
    queryFn: () => fetchBooks(filters),
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <FilterSidebar filters={filters} onChange={(f) => setFilters({ ...f, owned: false })} />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t("wishlist.title")}</h1>
          <Link
            to="/books/new?owned=false"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            {t("wishlist.addToWishlist")}
          </Link>
        </div>
        <BookGrid
          data={data}
          isLoading={isLoading}
          filters={filters}
          onChangePage={(offset) => setFilters({ ...filters, offset })}
          emptyMessage={t("wishlist.empty")}
        />
      </div>
    </div>
  );
}
