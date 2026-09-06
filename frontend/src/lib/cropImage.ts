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

export async function getCroppedCanvasImg(
  image: HTMLImageElement,
  crop?: { x: number; y: number; width: number; height: number } | null
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const hasCrop = crop && crop.width > 0 && crop.height > 0;

  const pixelX = hasCrop ? Math.round(crop.x * scaleX) : 0;
  const pixelY = hasCrop ? Math.round(crop.y * scaleY) : 0;
  const pixelWidth = hasCrop ? Math.round(crop.width * scaleX) : image.naturalWidth;
  const pixelHeight = hasCrop ? Math.round(crop.height * scaleY) : image.naturalHeight;

  canvas.width = Math.max(pixelWidth, 1);
  canvas.height = Math.max(pixelHeight, 1);

  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    pixelX,
    pixelY,
    pixelWidth,
    pixelHeight,
    0,
    0,
    canvas.width,
    canvas.height
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
