const DEFAULT_MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.90;

export async function compressImage(file: File | Blob, maxDimension: number = DEFAULT_MAX_DIMENSION): Promise<File> {
  const fileName = (file as File).name || "shelf-scan.jpg";
  const cleanName = fileName.replace(/\.\w+$/, "") + ".jpg";

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file instanceof File ? file : new File([file], cleanName, { type: "image/jpeg" });
    }

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) {
      return file instanceof File ? file : new File([file], cleanName, { type: "image/jpeg" });
    }

    return new File([blob], cleanName, { type: "image/jpeg" });
  } catch {
    return file instanceof File ? file : new File([file], cleanName, { type: "image/jpeg" });
  }
}
