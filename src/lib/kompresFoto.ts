import { totalUkuranKb, ukuranKb } from "./photo";

/** Batas total foto per pengajuan — Firestore maks 1 MiB per dokumen. */
export const BATAS_FOTO_KB = 700;
export const MAKS_FOTO = 3;

const SISI_MAKS = 1024;
const TARGET_PER_FOTO_KB = Math.floor(BATAS_FOTO_KB / MAKS_FOTO);
const KUALITAS = [0.6, 0.45, 0.3];

export function ukuranTarget(
  lebar: number,
  tinggi: number,
  maks = SISI_MAKS,
): { lebar: number; tinggi: number } {
  const skala = Math.min(1, maks / Math.max(lebar, tinggi));
  return { lebar: Math.round(lebar * skala), tinggi: Math.round(tinggi * skala) };
}

export function muatBatas(fotos: string[], batasKb = BATAS_FOTO_KB): boolean {
  return totalUkuranKb(fotos) <= batasKb;
}

/**
 * Kompres foto kamera HP (2–5 MB) jadi JPEG kecil, kembalikan Base64 mentah
 * tanpa awalan `data:` — format yang diharapkan `participation_requests`.
 * Kualitas diturunkan bertahap sampai muat ~1/3 batas total.
 */
export async function kompresFoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { lebar, tinggi } = ukuranTarget(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pengolahan foto.");
  ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
  bitmap.close();

  let hasil = "";
  for (const q of KUALITAS) {
    hasil = canvas.toDataURL("image/jpeg", q).split(",")[1] ?? "";
    if (ukuranKb(hasil) <= TARGET_PER_FOTO_KB) break;
  }
  if (!hasil) throw new Error("Foto tidak bisa dibaca.");
  return hasil;
}
