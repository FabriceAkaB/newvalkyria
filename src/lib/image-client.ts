"use client";

/** Recadrage carré + compression côté client avant l'envoi (section 4) —
 *  vise une image utilisable comme miniature de fiche joueuse, pas un
 *  fichier source haute résolution. Canvas natif, aucune dépendance. */
export async function cropSquareAndCompress(file: File, targetSize = 480, quality = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas indisponible");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, targetSize, targetSize);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Compression de l'image échouée");

  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
