import { useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { RotateCw, RotateCcw, ZoomIn, ZoomOut, RefreshCw, Image as ImageIcon, Sparkles } from "lucide-react";
import { getCroppedImg } from "@/lib/cropImage";
import { useTranslation } from "@/lib/LanguageContext";

interface ImageCropAdjusterProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
  onChangePhoto?: () => void;
  isProcessing?: boolean;
}

export function ImageCropAdjuster({
  imageSrc,
  onConfirm,
  onCancel,
  onChangePhoto,
  isProcessing = false,
}: ImageCropAdjusterProps) {
  const { t } = useTranslation();

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onConfirm(croppedBlob);
    } catch (err) {
      console.error("Failed to crop image", err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-accent" />
            <span>{t("shelfScanner.adjustTitle")}</span>
          </h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            {t("shelfScanner.adjustSubtitle")}
          </p>
        </div>
        {onChangePhoto && (
          <button
            type="button"
            onClick={onChangePhoto}
            disabled={isProcessing}
            className="text-xs font-medium text-accent hover:underline px-2 py-1 rounded transition"
          >
            {t("shelfScanner.changePhoto")}
          </button>
        )}
      </div>

      {/* Interactive Crop Container */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-neutral-950 rounded-xl overflow-hidden border border-line shadow-inner">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={undefined}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          showGrid={true}
          classes={{
            containerClassName: "rounded-xl",
            cropAreaClassName: "border-2 border-accent shadow-2xl rounded-lg",
          }}
        />
      </div>

      {/* Adjustment Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-canvas border border-line rounded-xl">
        {/* Zoom Control */}
        <div className="flex items-center gap-2 min-w-[180px] flex-1">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(prev - 0.2, 1))}
            className="p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover rounded-lg transition"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-1.5 bg-line-strong rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(prev + 0.2, 3))}
            className="p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover rounded-lg transition"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-mono text-ink-muted w-10 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Rotate and Reset Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRotateLeft}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition"
            title="Rotate Counter-Clockwise (90°)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>-90°</span>
          </button>
          <button
            type="button"
            onClick={handleRotateRight}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition"
            title="Rotate Clockwise (90°)"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>+90°</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition"
            title="Reset All Adjustments"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t("shelfScanner.reset")}</span>
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="rounded-xl border border-line px-4 py-2.5 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
        >
          {t("common.cancel")}
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-on-accent shadow hover:bg-accent-hover transition disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />
              <span>{t("shelfScanner.scanningButton")}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t("shelfScanner.confirmAndScan")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
