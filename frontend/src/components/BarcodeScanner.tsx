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
    let controls: IScannerControls | undefined;
    let stream: MediaStream | undefined;
    let isMounted = true;

    async function startScanner() {
      try {
        const reader = new BrowserMultiFormatReader();

        // 1. Try to obtain camera stream with environment (back) camera preference
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!isMounted) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
        }

        if (!isMounted) return;

        controls = await reader.decodeFromVideoElement(
          videoRef.current!,
          (result, err) => {
            if (result && isMounted) {
              onDetected(result.getText());
            }
            if (err && err.name !== "NotFoundException" && isMounted) {
              // Ignore standard frame-level decode misses
            }
          }
        );
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (isMounted) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setError("Camera permission denied. Please allow camera access in your browser settings.");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setError("No camera found on this device.");
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            setError("Camera is currently in use by another app.");
          } else {
            setError(t("scanner.cameraError"));
          }
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      controls?.stop();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
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
