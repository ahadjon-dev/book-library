export function rotateImage(imageSrc: string, degree: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const normalizedDegree = ((degree % 360) + 360) % 360;
    if (normalizedDegree === 0) {
      resolve(imageSrc);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }

      const rad = (normalizedDegree * Math.PI) / 180;
      const is90or270 = normalizedDegree === 90 || normalizedDegree === 270;

      canvas.width = is90or270 ? img.height : img.width;
      canvas.height = is90or270 ? img.width : img.height;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: "%" | "px";
}

export async function getCroppedCanvasImg(
  image: HTMLImageElement,
  crop?: CropArea | null
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;

  let pixelX = 0;
  let pixelY = 0;
  let pixelWidth = naturalWidth;
  let pixelHeight = naturalHeight;

  if (crop && crop.width > 0 && crop.height > 0) {
    if (crop.unit === "%" || (!crop.unit && crop.width <= 100 && crop.height <= 100)) {
      pixelX = Math.round((crop.x / 100) * naturalWidth);
      pixelY = Math.round((crop.y / 100) * naturalHeight);
      pixelWidth = Math.round((crop.width / 100) * naturalWidth);
      pixelHeight = Math.round((crop.height / 100) * naturalHeight);
    } else {
      const renderedWidth = image.clientWidth || image.width || naturalWidth;
      const renderedHeight = image.clientHeight || image.height || naturalHeight;
      const scaleX = naturalWidth / renderedWidth;
      const scaleY = naturalHeight / renderedHeight;
      pixelX = Math.round(crop.x * scaleX);
      pixelY = Math.round(crop.y * scaleY);
      pixelWidth = Math.round(crop.width * scaleX);
      pixelHeight = Math.round(crop.height * scaleY);
    }
  }

  // Clamp within image bounds to guarantee valid canvas draw
  pixelX = Math.max(0, Math.min(pixelX, naturalWidth - 1));
  pixelY = Math.max(0, Math.min(pixelY, naturalHeight - 1));
  pixelWidth = Math.max(1, Math.min(pixelWidth, naturalWidth - pixelX));
  pixelHeight = Math.max(1, Math.min(pixelHeight, naturalHeight - pixelY));

  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    pixelX,
    pixelY,
    pixelWidth,
    pixelHeight,
    0,
    0,
    pixelWidth,
    pixelHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.95
    );
  });
}
