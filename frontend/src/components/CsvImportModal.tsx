import { useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { importBooksCsv } from "@/api/books";
import type { ImportSummary } from "@/types/import";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CsvImportModal({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  if (!isOpen) return null;

  async function handleImport() {
    if (!file) return;
    try {
      setImporting(true);
      const data = await importBooksCsv(file);
      setResult(data);
      showToast(
        t("import.summary", { imported: data.imported, skipped: data.skipped })
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl transition">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-ink">{t("import.title")}</h2>
          </div>
          <button
            onClick={handleReset}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <p className="text-xs text-ink-secondary">{t("import.supportsGoodreads")}</p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
              }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                file ? "border-accent bg-accent/5" : "border-line hover:border-accent/50 bg-canvas"
              }`}
            >
              <FileSpreadsheet className="h-10 w-10 text-accent mb-2" />
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-ink">{file.name}</p>
                  <p className="text-xs text-ink-secondary mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-ink">{t("import.dragDrop")}</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setFile(e.target.files[0]);
                    }}
                    className="mt-3 block w-full text-xs text-ink-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-on-accent hover:file:bg-accent-hover cursor-pointer"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || importing}
                onClick={handleImport}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
              >
                {importing ? t("import.importing") : t("import.importButton")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-line bg-canvas p-4">
                <span className="block text-2xl font-bold text-ink">{result.total_rows}</span>
                <span className="text-xs text-ink-secondary">Total Rows</span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <span className="block text-2xl font-bold text-emerald-400">{result.imported}</span>
                <span className="text-xs text-emerald-400/80">Imported</span>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-4">
                <span className="block text-2xl font-bold text-ink-secondary">{result.skipped}</span>
                <span className="text-xs text-ink-secondary">Skipped</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300 space-y-1">
                <p className="font-semibold">Notice/Warnings:</p>
                {result.errors.map((err, idx) => (
                  <p key={idx}>• {err}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-line">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
