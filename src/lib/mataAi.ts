/**
 * "Mata AI" — logika murni penilaian foto bukti partisipasi oleh Gemini Vision.
 * Pemanggilan model ada di route verify-participation; di sini hanya skema,
 * validasi keluaran, dan keputusan gabungan aturan + AI.
 */
import type { HasilVerifikasi } from "./verification";

export const INDIKASI_KECURANGAN = [
  "tidak",
  "foto_layar",
  "bukan_alat_listrik",
  "gambar_internet",
  "tidak_jelas",
] as const;

export interface AnalisisFoto {
  alat: { nama: string; estimasiWatt: number }[];
  tampakDigunakan: boolean;
  indikasiKecurangan: (typeof INDIKASI_KECURANGAN)[number];
  keyakinan: number;
  alasan: string;
}

export const SKEMA_ANALISIS_FOTO = {
  nama: "analisis_foto_bukti",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["alat", "tampakDigunakan", "indikasiKecurangan", "keyakinan", "alasan"],
    properties: {
      alat: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nama", "estimasiWatt"],
          properties: {
            nama: { type: "string" },
            estimasiWatt: { type: "number" },
          },
        },
      },
      tampakDigunakan: { type: "boolean" },
      indikasiKecurangan: { type: "string", enum: [...INDIKASI_KECURANGAN] },
      keyakinan: { type: "number" },
      alasan: { type: "string" },
    },
  },
};

export const PROMPT_ANALISIS_FOTO = `Kamu pemeriksa bukti program hemat listrik desa di Pulau Siberut, Mentawai.
Warga diminta memotret alat listrik berdaya besar yang SEDANG mereka nyalakan saat Jam Emas
(siang hari ketika listrik tenaga surya melimpah), misalnya pompa air, setrika, mesin cuci,
mesin es/freezer, penanak nasi, atau mesin pertukangan.

Nilai foto berikut dan isi JSON:
- alat: alat listrik yang terlihat beserta perkiraan daya (watt) yang wajar untuk alat rumah tangga tersebut.
- tampakDigunakan: true bila ada tanda alat sedang dipakai/menyala (lampu indikator, air mengalir, uap, kabel tersambung, sedang dioperasikan).
- indikasiKecurangan: "foto_layar" bila memotret layar HP/monitor, "gambar_internet" bila tampak foto katalog/stok,
  "bukan_alat_listrik" bila tidak ada alat listrik, "tidak_jelas" bila foto terlalu gelap/buram, selain itu "tidak".
- keyakinan: 0 sampai 1.
- alasan: satu kalimat bahasa Indonesia yang mudah dipahami warga, tanpa em dash.`;

export function isAnalisisFoto(x: unknown): x is AnalisisFoto {
  if (typeof x !== "object" || x === null) return false;
  const v = x as Record<string, unknown>;
  return (
    Array.isArray(v.alat) &&
    v.alat.every(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as { nama?: unknown }).nama === "string" &&
        typeof (a as { estimasiWatt?: unknown }).estimasiWatt === "number",
    ) &&
    typeof v.tampakDigunakan === "boolean" &&
    (INDIKASI_KECURANGAN as readonly unknown[]).includes(v.indikasiKecurangan) &&
    typeof v.keyakinan === "number" &&
    typeof v.alasan === "string"
  );
}

/** Di bawah ini AI dianggap ragu → keputusan diserahkan ke operator. */
export const AMBANG_KEYAKINAN = 0.6;

export interface KeputusanAkhir {
  status: "APPROVED" | "REJECTED" | "PENDING";
  poin: number;
  windowId: string | null;
  reason: string;
  reasonCode: HasilVerifikasi["reasonCode"] | "OK_APPROVED_AI" | "AI_PERLU_TINJAUAN";
}

/**
 * Aturan waktu tetap gerbang pertama. AI hanya menilai pengajuan yang lolos
 * aturan: yakin asli → disetujui; curiga/ragu → ditahan untuk operator
 * (tidak pernah langsung menolak warga hanya karena AI); AI tidak tersedia →
 * keputusan aturan berlaku seperti sebelum ada AI.
 */
export function keputusanAkhir(
  aturan: HasilVerifikasi,
  ai: AnalisisFoto | null,
): KeputusanAkhir {
  if (aturan.status !== "APPROVED" || !ai) return { ...aturan };

  const curiga =
    ai.indikasiKecurangan !== "tidak" ||
    !ai.tampakDigunakan ||
    ai.keyakinan < AMBANG_KEYAKINAN;
  if (curiga) {
    return {
      status: "PENDING",
      poin: 0,
      windowId: aturan.windowId,
      reason: `Perlu tinjauan operator: ${ai.alasan}`,
      reasonCode: "AI_PERLU_TINJAUAN",
    };
  }

  const alat = ai.alat.map((a) => a.nama).join(", ") || "alat listrik";
  return {
    ...aturan,
    reason: `Terverifikasi AI: ${alat} tampak digunakan dalam jendela imbauan.`,
    reasonCode: "OK_APPROVED_AI",
  };
}

/** Asumsi konservatif: tiap partisipasi = alat dipakai 1 jam di Jam Emas. */
export const JAM_PEMAKAIAN_ASUMSI = 1;
const WATT_MAKS_PER_ALAT = 3000;

export function estimasiKwh(ai: AnalisisFoto | null): number {
  if (!ai) return 0;
  const watt = ai.alat.reduce(
    (t, a) => t + Math.min(Math.max(0, a.estimasiWatt), WATT_MAKS_PER_ALAT),
    0,
  );
  return Math.round((watt / 1000) * JAM_PEMAKAIAN_ASUMSI * 100) / 100;
}
