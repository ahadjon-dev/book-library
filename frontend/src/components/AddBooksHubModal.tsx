import { useState, lazy, Suspense, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  scanShelfImage,
  bulkAddBooks,
  lookupIsbn,
  createBook,
  uploadCover,
  importBooksCsv,
  fetchShelves,
} from "@/api/books";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import type { ShelfScanResult } from "@/types/scanner";
import type { IsbnLookupMatch } from "@/types/lookup";
import type { ImportSummary } from "@/types/import";
import type { BookFormValues } from "@/types/book";

const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "shelf" | "barcode" | "manual" | "import";
  onSuccess?: () => void;
}

type TabType = "shelf" | "barcode" | "manual" | "import";

export function AddBooksHubModal({ isOpen, onClose, initialTab = "shelf", onSuccess }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // --- Tab 1: Shelf Scanner State ---
  const [scanningShelf, setScanningShelf] = useState(false);
  const [shelfResult, setShelfResult] = useState<ShelfScanResult | null>(null);
  const [selectedShelfIndices, setSelectedShelfIndices] = useState<number[]>([]);
  const [addingShelfBooks, setAddingShelfBooks] = useState(false);

  // --- Tab 2: Barcode / ISBN State ---
  const [isbnInput, setIsbnInput] = useState("");
  const [lookingUpIsbn, setLookingUpIsbn] = useState(false);
  const [isbnResult, setIsbnResult] = useState<any | null>(null);
  const [isbnMatch, setIsbnMatch] = useState<IsbnLookupMatch | null>(null);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [addingIsbnBook, setAddingIsbnBook] = useState(false);

  // --- Tab 3: Manual Form State ---
  const { data: shelves = [] } = useQuery({ queryKey: ["shelves"], queryFn: fetchShelves });
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthors, setManualAuthors] = useState("");
  const [manualGenre, setManualGenre] = useState("");
  const [manualShelf, setManualShelf] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualPages, setManualPages] = useState("");
  const [manualCoverFile, setManualCoverFile] = useState<File | null>(null);
  const [manualCoverPreview, setManualCoverPreview] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  // --- Tab 4: CSV Import State ---
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportSummary | null>(null);

  if (!isOpen) return null;

  // ----------------------------------------------------
  // Handlers for Tab 1: Shelf Scanner
  // ----------------------------------------------------
  async function handleShelfFile(file: File) {
    try {
      setScanningShelf(true);
      const data = await scanShelfImage(file);
      setShelfResult(data);
      const unowned = data.items
        .map((item: any, idx: number) => (!item.already_in_library ? idx : null))
        .filter((idx: number | null): idx is number => idx !== null);
      setSelectedShelfIndices(unowned);
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to scan bookshelf");
    } finally {
      setScanningShelf(false);
    }
  }

  async function handleBulkAddShelf() {
    if (!shelfResult || selectedShelfIndices.length === 0) return;
    try {
      setAddingShelfBooks(true);
      const toAdd = selectedShelfIndices.map((idx) => {
        const item = shelfResult.items[idx];
        return {
          title: item.title,
          authors: item.authors,
          isbn: item.isbn,
          publisher: item.publisher,
          publication_year: item.publication_year,
          page_count: item.page_count,
          genre: item.genre,
          owned: true,
          cover_url: item.cover_url,
        };
      });
      const res = await bulkAddBooks(toAdd);
      showToast(t("shelfScanner.booksAdded", { count: res.added_count }));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to add books");
    } finally {
      setAddingShelfBooks(false);
    }
  }

  // ----------------------------------------------------
  // Handlers for Tab 2: ISBN Lookup
  // ----------------------------------------------------
  async function handleIsbnLookup(code: string) {
    const clean = code.trim();
    if (!clean) return;
    try {
      setLookingUpIsbn(true);
      setIsbnResult(null);
      setIsbnMatch(null);
      const res = await lookupIsbn(clean);
      if (!res.found) {
        showToast(t("bookForm.noIsbnMatch"));
        return;
      }
      setIsbnResult(res);
      setIsbnMatch(res.already_in_library);
    } catch {
      showToast(t("bookForm.lookupServiceError"));
    } finally {
      setLookingUpIsbn(false);
    }
  }

  async function handleAddIsbnBook() {
    if (!isbnResult) return;
    try {
      setAddingIsbnBook(true);
      const newBook = await createBook({
        title: isbnResult.title || "Untitled",
        subtitle: isbnResult.subtitle || null,
        isbn: isbnInput.trim() || null,
        authors: isbnResult.authors || [],
        publisher: isbnResult.publisher || null,
        publication_year: isbnResult.publication_year || null,
        page_count: isbnResult.page_count || null,
        genre: isbnResult.genre || null,
        owned: true,
        cover_url: isbnResult.cover_url || undefined,
        tags: [],
        shelf: null,
        language: null,
        description: null,
        purchase_date: null,
        purchase_price: null,
      });
      showToast(t("bookForm.bookAdded"));
      if (onSuccess) onSuccess();
      onClose();
      navigate(`/books/${newBook.id}`);
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to add book");
    } finally {
      setAddingIsbnBook(false);
    }
  }

  // ----------------------------------------------------
  // Handlers for Tab 3: Manual Entry
  // ----------------------------------------------------
  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    try {
      setSavingManual(true);
      const payload: BookFormValues = {
        title: manualTitle.trim(),
        authors: manualAuthors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        genre: manualGenre.trim() || null,
        shelf: manualShelf.trim() || null,
        publication_year: manualYear ? parseInt(manualYear, 10) : null,
        page_count: manualPages ? parseInt(manualPages, 10) : null,
        owned: true,
        tags: [],
        subtitle: null,
        isbn: null,
        publisher: null,
        language: null,
        description: null,
        purchase_date: null,
        purchase_price: null,
      };
      const created = await createBook(payload);
      if (manualCoverFile) {
        await uploadCover(created.id, manualCoverFile);
      }
      showToast(t("bookForm.bookAdded"));
      if (onSuccess) onSuccess();
      onClose();
      navigate(`/books/${created.id}`);
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to save book");
    } finally {
      setSavingManual(false);
    }
  }

  // ----------------------------------------------------
  // Handlers for Tab 4: CSV Import
  // ----------------------------------------------------
  async function handleCsvImport() {
    if (!csvFile) return;
    try {
      setImportingCsv(true);
      const res = await importBooksCsv(csvFile);
      setCsvResult(res);
      showToast(t("import.summary", { imported: res.imported, skipped: res.skipped }));
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Import failed");
    } finally {
      setImportingCsv(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-2xl h-[85vh] sm:h-[580px] flex flex-col rounded-t-3xl sm:rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-2xl transition">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">➕</span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t("addHub.title")}</h2>
              <p className="text-xs text-ink-secondary hidden sm:block">
                Choose how you want to add books to your personal collection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            ✕
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-canvas border border-line overflow-x-auto scrollbar-hide mb-4 shrink-0">
          <button
            onClick={() => setActiveTab("shelf")}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-semibold transition text-center truncate ${
              activeTab === "shelf"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink hover:bg-surface-hover"
            }`}
          >
            {t("addHub.tabShelf")}
          </button>
          <button
            onClick={() => setActiveTab("barcode")}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-semibold transition text-center truncate ${
              activeTab === "barcode"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink hover:bg-surface-hover"
            }`}
          >
            {t("addHub.tabBarcode")}
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-semibold transition text-center truncate ${
              activeTab === "manual"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink hover:bg-surface-hover"
            }`}
          >
            {t("addHub.tabManual")}
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-semibold transition text-center truncate ${
              activeTab === "import"
                ? "bg-accent text-on-accent shadow-sm"
                : "text-ink-secondary hover:text-ink hover:bg-surface-hover"
            }`}
          >
            {t("addHub.tabImport")}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* TAB 1: SHELF SCANNER */}
          {activeTab === "shelf" && (
            <div className="space-y-4">
              <p className="text-xs text-ink-secondary">{t("addHub.shelfDesc")}</p>

              {!shelfResult ? (
                <div className="py-6 flex flex-col items-center justify-center">
                  {scanningShelf ? (
                    <div className="text-center space-y-3 py-8">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
                      <p className="text-sm font-semibold text-ink">{t("shelfScanner.scanning")}</p>
                      <p className="text-xs text-ink-secondary">Vision AI is analyzing book spines...</p>
                    </div>
                  ) : (
                    <label className="w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line hover:border-accent bg-canvas p-8 text-center transition cursor-pointer group">
                      <span className="text-4xl mb-3 group-hover:scale-110 transition">📸</span>
                      <p className="text-sm font-semibold text-ink mb-1">
                        Snap Photo or Upload Image
                      </p>
                      <p className="text-xs text-ink-secondary mb-4">
                        Tap here to open your mobile camera or pick photo
                      </p>
                      <span className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent group-hover:bg-accent-hover transition">
                        Open Camera / Gallery
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleShelfFile(e.target.files[0]);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">
                      {t("shelfScanner.detected", { count: shelfResult.items.length })}
                    </span>
                    <button
                      onClick={() => {
                        if (selectedShelfIndices.length === shelfResult.items.length) {
                          setSelectedShelfIndices([]);
                        } else {
                          setSelectedShelfIndices(shelfResult.items.map((_, i) => i));
                        }
                      }}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      {selectedShelfIndices.length === shelfResult.items.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {shelfResult.items.map((item, idx) => {
                      const isSelected = selectedShelfIndices.includes(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedShelfIndices((prev) =>
                              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                            );
                          }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? "border-accent bg-accent/5"
                              : "border-line bg-canvas hover:bg-surface-hover"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-line text-accent focus:ring-accent"
                          />
                          {item.cover_url ? (
                            <img
                              src={item.cover_url}
                              alt=""
                              className="h-10 w-7 object-cover rounded shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-7 bg-surface-hover rounded flex items-center justify-center text-[10px] text-ink-secondary shrink-0">
                              📖
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-ink truncate">{item.title}</p>
                              {item.already_in_library && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                  {t("shelfScanner.alreadyInLibrary")}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-secondary truncate">
                              {item.authors.join(", ") || "Unknown Author"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setShelfResult(null)}
                      className="text-xs text-ink-secondary hover:text-ink"
                    >
                      Scan Another Photo
                    </button>
                    <button
                      type="button"
                      disabled={addingShelfBooks || selectedShelfIndices.length === 0}
                      onClick={handleBulkAddShelf}
                      className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
                    >
                      {addingShelfBooks
                        ? t("common.saving")
                        : t("shelfScanner.addSelected", { count: selectedShelfIndices.length })}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BARCODE / ISBN LOOKUP */}
          {activeTab === "barcode" && (
            <div className="space-y-4">
              <p className="text-xs text-ink-secondary">{t("addHub.barcodeDesc")}</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={isbnInput}
                  onChange={(e) => setIsbnInput(e.target.value)}
                  placeholder="e.g. 9780547928227"
                  className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  disabled={lookingUpIsbn || !isbnInput.trim()}
                  onClick={() => handleIsbnLookup(isbnInput)}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50 shrink-0"
                >
                  {lookingUpIsbn ? t("bookForm.lookingUp") : t("bookForm.lookUp")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLiveScanner(true)}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-surface-hover transition shrink-0"
                >
                  📷 {t("bookForm.scan")}
                </button>
              </div>

              {isbnResult && (
                <div className="p-4 rounded-xl border border-line bg-canvas space-y-3">
                  <div className="flex gap-3">
                    {isbnResult.cover_url ? (
                      <img
                        src={isbnResult.cover_url}
                        alt=""
                        className="h-20 w-14 object-cover rounded shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-14 bg-surface-hover rounded flex items-center justify-center text-xs text-ink-secondary shrink-0">
                        📖
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-ink truncate">{isbnResult.title}</h4>
                      <p className="text-xs text-ink-secondary truncate">
                        {isbnResult.authors?.join(", ") || "Unknown Author"}
                      </p>
                      <p className="text-xs text-ink-muted mt-1">
                        {isbnResult.publisher ? `${isbnResult.publisher} • ` : ""}
                        {isbnResult.publication_year ? `${isbnResult.publication_year} • ` : ""}
                        {isbnResult.page_count ? `${isbnResult.page_count} pages` : ""}
                      </p>
                      {isbnMatch && (
                        <p className="text-[11px] text-amber-400 mt-1">
                          Already in your collection!{" "}
                          <Link to={`/books/${isbnMatch.id}`} className="underline">
                            View
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-line">
                    <button
                      type="button"
                      disabled={addingIsbnBook}
                      onClick={handleAddIsbnBook}
                      className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
                    >
                      {addingIsbnBook ? t("common.saving") : "Add Book to Library"}
                    </button>
                  </div>
                </div>
              )}

              {showLiveScanner && (
                <Suspense fallback={<div className="text-xs text-ink-secondary">Loading camera...</div>}>
                  <BarcodeScanner
                    onDetected={(code) => {
                      setShowLiveScanner(false);
                      setIsbnInput(code);
                      handleIsbnLookup(code);
                    }}
                    onClose={() => setShowLiveScanner(false)}
                  />
                </Suspense>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL FORM */}
          {activeTab === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <p className="text-xs text-ink-secondary">{t("addHub.manualDesc")}</p>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Book Title"
                  required
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Authors (comma separated)
                </label>
                <input
                  type="text"
                  value={manualAuthors}
                  onChange={(e) => setManualAuthors(e.target.value)}
                  placeholder="e.g. Frank Herbert, Brian Herbert"
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Genre
                  </label>
                  <input
                    type="text"
                    value={manualGenre}
                    onChange={(e) => setManualGenre(e.target.value)}
                    placeholder="e.g. Sci-Fi, Fiction"
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Shelf
                  </label>
                  <input
                    type="text"
                    value={manualShelf}
                    onChange={(e) => setManualShelf(e.target.value)}
                    placeholder="e.g. Living Room Shelf"
                    list="shelf-suggestions"
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <datalist id="shelf-suggestions">
                    {shelves.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    placeholder="2024"
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Pages
                  </label>
                  <input
                    type="number"
                    value={manualPages}
                    onChange={(e) => setManualPages(e.target.value)}
                    placeholder="350"
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Cover Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setManualCoverFile(e.target.files[0]);
                      setManualCoverPreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="block w-full text-xs text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent hover:file:bg-accent/20 cursor-pointer"
                />
                {manualCoverPreview && (
                  <img
                    src={manualCoverPreview}
                    alt=""
                    className="h-16 w-11 object-cover rounded mt-2 border border-line"
                  />
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingManual || !manualTitle.trim()}
                  className="rounded-lg bg-accent px-6 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
                >
                  {savingManual ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: CSV / GOODREADS IMPORT */}
          {activeTab === "import" && (
            <div className="space-y-4">
              <p className="text-xs text-ink-secondary">{t("addHub.importDesc")}</p>

              {!csvResult ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) setCsvFile(e.dataTransfer.files[0]);
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                      csvFile ? "border-accent bg-accent/5" : "border-line bg-canvas"
                    }`}
                  >
                    <span className="text-3xl mb-2">📄</span>
                    {csvFile ? (
                      <div>
                        <p className="text-sm font-semibold text-ink">{csvFile.name}</p>
                        <p className="text-xs text-ink-secondary mt-1">
                          {(csvFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-ink">{t("import.dragDrop")}</p>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            if (e.target.files?.[0]) setCsvFile(e.target.files[0]);
                          }}
                          className="mt-3 block w-full text-xs text-ink-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-on-accent hover:file:bg-accent-hover cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={!csvFile || importingCsv}
                      onClick={handleCsvImport}
                      className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
                    >
                      {importingCsv ? t("import.importing") : t("import.importButton")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <span className="block text-xl font-bold text-ink">{csvResult.total_rows}</span>
                      <span className="text-[11px] text-ink-secondary">Total Rows</span>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <span className="block text-xl font-bold text-emerald-400">
                        {csvResult.imported}
                      </span>
                      <span className="text-[11px] text-emerald-400/80">Imported</span>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <span className="block text-xl font-bold text-ink-secondary">
                        {csvResult.skipped}
                      </span>
                      <span className="text-[11px] text-ink-secondary">Skipped</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvResult(null);
                        onClose();
                      }}
                      className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
