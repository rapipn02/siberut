/**
 * "Pindai Label Alat" — warga memotret label/nameplate, Gemini membaca daya (watt).
 * Rencana hemat dihitung deterministik di sini; AI hanya membaca label.
 */
import { FUEL } from "./fuel";

export interface AlatWarga {
  id: string;
  nama: string;
  watt: number;
  merek?: string;
  sumber?: "ai" | "manual";
}

export interface HasilLabel {
  terbaca: boolean;
  nama: string;
  merek: string;
  watt: number;
  alasan: string;
}

export const SKEMA_LABEL = {
  nama: "baca_label_alat",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["terbaca", "nama", "merek", "watt", "alasan"],
    properties: {
      terbaca: { type: "boolean" },
      nama: { type: "string" },
      merek: { type: "string" },
      watt: { type: "number" },
      alasan: { type: "string" },
    },
  },
};

export const PROMPT_LABEL = `Foto ini adalah label/nameplate atau badan alat listrik rumah tangga milik warga desa.
Baca jenis alat (dalam bahasa Indonesia, mis. "Pompa air", "Setrika", "Mesin cuci", "Rice cooker"),
merek bila terlihat, dan daya listrik dalam WATT.
- Bila label menulis ampere saja, hitung watt = ampere × 220.
- Bila label tidak terbaca tetapi jenis alat jelas, isi watt dengan perkiraan umum alat tersebut dan terbaca=false.
- Bila bukan alat listrik, terbaca=false, watt=0.
alasan: satu kalimat singkat untuk warga, tanpa em dash.`;

export function isHasilLabel(x: unknown): x is HasilLabel {
  if (typeof x !== "object" || x === null) return false;
  const v = x as Record<string, unknown>;
  return (
    typeof v.terbaca === "boolean" &&
    typeof v.nama === "string" &&
    typeof v.merek === "string" &&
    typeof v.watt === "number" &&
    typeof v.alasan === "string"
  );
}

/** Daya alat rumah tangga yang masuk akal (1–5000 W), dibulatkan; selain itu null. */
export function wattWajar(watt: number): number | null {
  if (!Number.isFinite(watt) || watt < 1 || watt > 5000) return null;
  return Math.round(watt);
}

function keMenit(jam: string): number {
  const [h, m] = jam.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function keJam(menit: number): string {
  const h = Math.floor(menit / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(menit % 60).padStart(2, "0")}`;
}

export interface RencanaHemat {
  jadwal: { alat: Pick<AlatWarga, "id" | "nama" | "watt">; jam: string; kwh: number }[];
  kwh: number;
  liter: number;
  rupiah: number;
}

/**
 * Tiap alat dijadwalkan 1 jam berurutan di dalam Jam Emas (berputar bila alat
 * lebih banyak dari jam). Penghematan = solar PLTD yang tidak perlu dibakar
 * karena beban pindah ke jam surya.
 */
export function rencanaHemat(
  alat: Pick<AlatWarga, "id" | "nama" | "watt">[],
  jamEmas: { mulai: string; selesai: string } | null,
): RencanaHemat {
  if (!jamEmas || alat.length === 0) return { jadwal: [], kwh: 0, liter: 0, rupiah: 0 };
  const mulai = keMenit(jamEmas.mulai);
  let durasi = keMenit(jamEmas.selesai) - mulai;
  if (durasi <= 0) durasi += 24 * 60;
  const slot = Math.max(1, Math.floor(durasi / 60));

  const jadwal = alat.map((a, i) => {
    const awal = mulai + (i % slot) * 60;
    return { alat: a, jam: `${keJam(awal)}–${keJam(awal + 60)}`, kwh: a.watt / 1000 };
  });
  const kwh = Math.round(jadwal.reduce((t, j) => t + j.kwh, 0) * 100) / 100;
  const liter = Math.round(kwh * FUEL.literPerKwhGenset * 100) / 100;
  return { jadwal, kwh, liter, rupiah: Math.round(liter * FUEL.hargaSolarPerLiter) };
}

export function kuotaTersisa(terpakai: number, batas: number): number {
  return Math.max(0, batas - terpakai);
}
