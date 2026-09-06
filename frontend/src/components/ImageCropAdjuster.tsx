import { useState, useRef, useEffect } from "react";
import ReactCrop, {
  type Crop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  RotateCw,
  RotateCcw,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  Maximize2,
  Square,
  RectangleHorizontal,
  Move,
  Scan,
} from "lucide-react";
import { rotateImage, getCroppedCanvasImg, type CropArea } from "@/lib/cropImage";
import { useTranslation } from "@/lib/LanguageContext";

interface ImageCropAdjusterProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
  onChangePhoto?: () => void;
  isProcessing?: boolean;
}

type AspectPreset = "free" | "16:9" | "4:3" | "1:1";

export function ImageCropAdjuster({
  imageSrc,
  onConfirm,
  onCancel,
  onChangePhoto,
  isProcessing = false,
}: ImageCropAdjusterProps) {
  const { t } = useTranslation();

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [rotation, setRotation] = useState(0);
  const [aspectMode, setAspectMode] = useState<AspectPreset>("free");
  const [crop, setCrop] = useState<Crop>();
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  // Sync with prop when a new image is selected
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
    setRotation(0);
    setAspectMode("free");
    setCurrentCropArea(null);
  }, [imageSrc]);

  function getAspectValue(mode: AspectPreset): number | undefined {
    switch (mode) {
      case "16:9":
        return 16 / 9;
      case "4:3":
        return 4 / 3;
      case "1:1":
        return 1;
      case "free":
      default:
        return undefined;
    }
  }

  function initCrop(img: HTMLImageElement, mode: AspectPreset) {
    const { width, height } = img;
    const aspect = getAspectValue(mode);

    let initial: Crop;
    if (aspect) {
      initial = centerCrop(
        makeAspectCrop(
          {
            unit: "%",
            width: 90,
          },
          aspect,
          width,
          height
        ),
        width,
        height
      );
    } else {
      // Freeform: default to 95% centered bounding box with full width & height adjustability
      initial = {
        unit: "%",
        x: 2.5,
        y: 2.5,
        width: 95,
        height: 95,
      };
    }
    setCrop(initial);
    setCurrentCropArea(initial as CropArea);
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    initCrop(e.currentTarget, aspectMode);
  }

  const handleAspectChange = (mode: AspectPreset) => {
    setAspectMode(mode);
    if (imgRef.current) {
      initCrop(imgRef.current, mode);
    }
  };

  const handleSelectFull = () => {
    setAspectMode("free");
    const fullCrop: Crop = {
      unit: "%",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    setCrop(fullCrop);
    setCurrentCropArea(fullCrop as CropArea);
  };

  const handleRotate = async (deltaDegrees: number) => {
    try {
      setIsRotating(true);
      const newRot = ((rotation + deltaDegrees) % 360 + 360) % 360;
      setRotation(newRot);
      const rotatedSrc = await rotateImage(imageSrc, newRot);
      setCurrentImageSrc(rotatedSrc);
    } catch (err) {
      console.error("Failed to rotate image", err);
    } finally {
      setIsRotating(false);
    }
  };

  const handleReset = async () => {
    setIsRotating(true);
    setRotation(0);
    setAspectMode("free");
    setCurrentImageSrc(imageSrc);
    if (imgRef.current) {
      initCrop(imgRef.current, "free");
    }
    setIsRotating(false);
  };

  const handleConfirm = async () => {
    if (!imgRef.current) return;
    try {
      const cropToUse = currentCropArea || (crop as CropArea) || null;
      const croppedBlob = await getCroppedCanvasImg(imgRef.current, cropToUse);
      onConfirm(croppedBlob);
    } catch (err) {
      console.error("Failed to extract cropped image", err);
    }
  };

  const aspect = getAspectValue(aspectMode);

  return (
    <div className="flex flex-col h-full w-full space-y-3">
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
            disabled={isProcessing || isRotating}
            className="text-xs font-medium text-accent hover:underline px-2 py-1 rounded transition"
          >
            {t("shelfScanner.changePhoto")}
          </button>
        )}
      </div>

      {/* Interactive Resizable Crop Container */}
      <div className="relative w-full h-[380px] sm:h-[480px] lg:h-[520px] bg-neutral-950/95 rounded-2xl overflow-hidden border border-line shadow-inner flex items-center justify-center p-3">
        {isRotating ? (
          <div className="flex flex-col items-center gap-2 text-ink-secondary">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-xs font-medium">Rotating image…</span>
          </div>
        ) : (
          <div className="max-h-full max-w-full flex items-center justify-center overflow-auto custom-cropper-wrapper">
            <ReactCrop
              crop={crop}
              onChange={(_pixelCrop, percentCrop) => {
                setCrop(percentCrop);
                setCurrentCropArea(percentCrop as CropArea);
              }}
              onComplete={(pixelCrop, percentCrop) => {
                setCurrentCropArea(percentCrop as CropArea || pixelCrop as CropArea);
              }}
              aspect={aspect}
              className="max-h-[360px] sm:max-h-[460px] lg:max-h-[500px] shadow-2xl"
            >
              <img
                ref={imgRef}
                src={currentImageSrc}
                alt="Shelf crop"
                onLoad={onImageLoad}
                className="max-h-[360px] sm:max-h-[460px] lg:max-h-[500px] w-auto max-w-full object-contain block select-none rounded"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
        )}
      </div>

      {/* Adjustments & Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-canvas border border-line rounded-xl">
        {/* Preset & Aspect Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-ink-secondary mr-1 flex items-center gap-1">
            <Move className="h-3 w-3" />
            <span>Resize & Frame:</span>
          </span>

          <button
            type="button"
            onClick={() => handleAspectChange("free")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              aspectMode === "free"
                ? "bg-accent text-on-accent border-accent shadow-sm"
                : "bg-surface hover:bg-surface-hover text-ink-secondary hover:text-ink border-line"
            }`}
            title="Freely adjust width and height handles"
          >
            {t("shelfScanner.aspectFree")}
          </button>

          <button
            type="button"
            onClick={handleSelectFull}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-hover text-ink-secondary hover:text-ink border border-line transition"
            title="Select 100% of the photo"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>{t("shelfScanner.aspectFull")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleAspectChange("16:9")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              aspectMode === "16:9"
                ? "bg-accent text-on-accent border-accent shadow-sm"
                : "bg-surface hover:bg-surface-hover text-ink-secondary hover:text-ink border-line"
            }`}
            title="16:9 Wide Shelf Ratio"
          >
            <RectangleHorizontal className="h-3.5 w-3.5" />
            <span>{t("shelfScanner.aspect16_9")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleAspectChange("4:3")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              aspectMode === "4:3"
                ? "bg-accent text-on-accent border-accent shadow-sm"
                : "bg-surface hover:bg-surface-hover text-ink-secondary hover:text-ink border-line"
            }`}
            title="4:3 Standard Camera Ratio"
          >
            <Scan className="h-3.5 w-3.5" />
            <span>4:3</span>
          </button>

          <button
            type="button"
            onClick={() => handleAspectChange("1:1")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              aspectMode === "1:1"
                ? "bg-accent text-on-accent border-accent shadow-sm"
                : "bg-surface hover:bg-surface-hover text-ink-secondary hover:text-ink border-line"
            }`}
            title="1:1 Square Ratio"
          >
            <Square className="h-3.5 w-3.5" />
            <span>{t("shelfScanner.aspect1_1")}</span>
          </button>
        </div>

        {/* Rotate and Reset Controls */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => handleRotate(-90)}
            disabled={isRotating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition"
            title="Rotate Counter-Clockwise (-90°)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>-90°</span>
          </button>
          <button
            type="button"
            onClick={() => handleRotate(90)}
            disabled={isRotating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition"
            title="Rotate Clockwise (+90°)"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>+90°</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isRotating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition"
            title="Reset All Adjustments"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t("shelfScanner.reset")}</span>
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing || isRotating}
          className="rounded-xl border border-line px-5 py-2.5 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
        >
          {t("common.cancel")}
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isProcessing || isRotating}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-xs font-semibold text-on-accent shadow-md hover:bg-accent-hover transition disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />
              <span>{t("shelfScanner.scanningButton")}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>{t("shelfScanner.confirmAndScan")}</span>
            </>
          )}
        </button>
      </div>

      {/* Enhanced Styling for ReactCrop drag handles & selection */}
      <style>{`
        .custom-cropper-wrapper .ReactCrop__crop-selection {
          border: 2.5px solid #6366f1 !important;
          box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.65) !important;
        }
        .custom-cropper-wrapper .ReactCrop__drag-handle {
          width: 14px !important;
          height: 14px !important;
          background-color: #ffffff !important;
          border: 2.5px solid #6366f1 !important;
          border-radius: 9999px !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5) !important;
        }
        .custom-cropper-wrapper .ReactCrop__drag-handle:hover,
        .custom-cropper-wrapper .ReactCrop__drag-handle:active {
          transform: scale(1.3);
          background-color: #e0e7ff !important;
        }
        .custom-cropper-wrapper .ReactCrop__drag-bar {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
