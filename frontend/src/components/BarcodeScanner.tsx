import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

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
    let controls: IScannerControls | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          onDetected(result.getText());
        }
        if (err && err.name !== "NotFoundException") {
          setError(t("scanner.cameraError"));
        }
      })
      .then((c) => {
        controls = c;
      })
      .catch(() => {
        setError(t("scanner.cameraError"));
      });

    return () => {
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{t("scanner.scanBarcode")}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-white"
            aria-label={t("scanner.closeScanner")}
          >
            <X className="h-5 w-5" />
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
