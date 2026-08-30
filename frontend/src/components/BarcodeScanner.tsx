import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/LanguageContext";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | null = null;
    let detected = false;
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current ?? undefined,
        (result, _err, scannerControls) => {
          controls = scannerControls;
          if (result && !detected && !cancelled) {
            detected = true;
            scannerControls.stop();
            onDetected(result.getText());
          }
        }
      )
      .catch(() => {
        if (!cancelled) setError(t("scanner.cameraError"));
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // Run once on mount only — re-running would restart the camera stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{t("scanner.scanBarcode")}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-white"
            aria-label={t("scanner.closeScanner")}
          >
            ✕
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <video ref={videoRef} muted playsInline className="w-full rounded-lg bg-black" />
        )}
        <p className="text-center text-xs text-neutral-500">{t("scanner.pointCamera")}</p>
      </div>
    </div>
  );
}
