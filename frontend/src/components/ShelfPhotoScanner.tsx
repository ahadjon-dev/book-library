import { useState } from "react";
import { Camera, BookOpen, X, UploadCloud } from "lucide-react";
import { scanShelfImage, bulkAddBooks } from "@/api/books";
import type { ShelfScanItem, ShelfScanResult } from "@/types/scanner";
import { compressImage } from "@/lib/compressImage";
import { ImageCropAdjuster } from "@/components/ImageCropAdjuster";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ShelfPhotoScanner({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [result, setResult] = useState<ShelfScanResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  if (!isOpen) return null;

  function handleFileChange(selectedFile: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }

  async function handleConfirmCrop(croppedBlob: Blob) {
    try {
      setScanning(true);
      // High-resolution 1600px compression to preserve spine typography
      const compressed = await compressImage(croppedBlob as File, 1600);
      const data = await scanShelfImage(compressed);
      setResult(data);

      // Default-select: matched && !already_in_library && confidence >= 0.7
      const validIndices = data.items
        .map((item: ShelfScanItem, idx: number) => {
          if (item.already_in_library) return null;
          if (item.matched || item.confidence >= 0.7) return idx;
          return null;
        })
        .filter((idx: number | null): idx is number => idx !== null);

      setSelectedIndices(validIndices.length > 0 ? validIndices : data.items.map((_: ShelfScanItem, i: number) => i));
    } catch (err: any) {
      console.error("Shelf scan failed", err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 503) {
        showToast(t("shelfScanner.notConfigured"), "error");
      } else {
        showToast(detail || "Failed to analyze bookshelf photo", "error");
      }
    } finally {
      setScanning(false);
    }
  }

  function toggleIndex(idx: number) {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  function toggleAll() {
    if (!result) return;
    if (selectedIndices.length === result.items.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(result.items.map((_: ShelfScanItem, i: number) => i));
    }
  }

  async function handleBulkAdd() {
    if (!result || selectedIndices.length === 0) return;
    try {
      setAdding(true);
      const selected = selectedIndices.map((i) => result.items[i]);
      const res = await bulkAddBooks(selected);
      showToast(t("shelfScanner.booksAdded", { count: res.added_count }));
      if (onSuccess) onSuccess();
      handleReset();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to add books to library", "error");
    } finally {
      setAdding(false);
    }
  }

  function handleReset() {
    setResult(null);
    setImageSrc(null);
    setSelectedIndices([]);
    onClose();
  }

  function handleResetPhoto() {
    setImageSrc(null);
    setResult(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl lg:max-w-5xl h-[92vh] sm:h-[88vh] sm:max-h-[820px] flex flex-col rounded-2xl border border-line bg-surface p-6 sm:p-7 shadow-2xl transition">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t("shelfScanner.title")}</h2>
              <p className="text-xs text-ink-secondary">{t("shelfScanner.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!result ? (
          imageSrc ? (
            <div className="flex-1 overflow-y-auto min-h-0 py-1">
              <ImageCropAdjuster
                imageSrc={imageSrc}
                onConfirm={handleConfirmCrop}
                onCancel={handleResetPhoto}
                onChangePhoto={handleResetPhoto}
                isProcessing={scanning}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                }}
                className="w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line hover:border-accent/50 bg-canvas p-12 text-center transition cursor-pointer"
              >
                <UploadCloud className="h-14 w-14 text-accent mb-3" />
                <p className="text-base font-semibold text-ink mb-1">{t("shelfScanner.dropzone")}</p>
                <p className="text-xs text-ink-secondary mb-5">PNG, JPG, WEBP photos up to 10MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                  }}
                  className="block text-xs text-ink-secondary file:mr-4 file:rounded-xl file:border-0 file:bg-accent file:px-5 file:py-2.5 file:text-xs file:font-semibold file:text-on-accent hover:file:bg-accent-hover cursor-pointer shadow-sm"
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">
                {t("shelfScanner.detected", { count: result.items.length })}
              </span>
              <button
                onClick={toggleAll}
                className="text-xs text-accent hover:underline font-medium"
              >
                {selectedIndices.length === result.items.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid sm:grid-cols-2 gap-2.5 pr-1">
              {result.items.map((item, idx) => {
                const isSelected = selectedIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleIndex(idx)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "border-accent bg-accent/5"
                        : "border-line bg-canvas hover:bg-surface-hover"
                    } ${!item.matched ? "border-dashed" : ""}`}
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
                        alt={item.title}
                        className="h-12 w-8 object-cover rounded shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-8 bg-surface-hover rounded flex items-center justify-center text-[10px] text-ink-secondary shrink-0">
                        <BookOpen className="h-4 w-4 text-ink-muted" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-ink truncate">{item.title}</p>
                        {item.already_in_library && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            {t("shelfScanner.alreadyInLibrary")}
                          </span>
                        )}
                        {!item.matched && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-500/10 text-ink-secondary border border-line shrink-0">
                            {t("shelfScanner.unmatched")}
                          </span>
                        )}
                        {item.confidence < 0.6 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                            {t("shelfScanner.lowConfidence")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-secondary truncate">
                        {item.authors.join(", ") || item.detected_author || "Unknown Author"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono text-ink-secondary">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
              >
                {t("shelfScanner.scanAnother")}
              </button>
              <button
                type="button"
                disabled={adding || selectedIndices.length === 0}
                onClick={handleBulkAdd}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
              >
                {adding
                  ? t("common.saving")
                  : t("shelfScanner.addSelected", { count: selectedIndices.length })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
