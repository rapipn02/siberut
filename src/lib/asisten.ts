/**
 * Asisten berbasis data (warga & operator) — definisi tool dan penjaga masukan.
 * Model hanya boleh menjawab dari hasil tool; implementasi tool ada di asistenServer.ts.
 */
import type { DefinisiTool } from "./llm";

export type Peran = "warga" | "operator";

const tanpaArg = { type: "object", properties: {} };

function tool(name: string, description: string, parameters: object = tanpaArg): DefinisiTool {
  return { type: "function", function: { name, description, parameters } };
}

const TOOLS_WARGA: DefinisiTool[] = [
  tool("kondisiListrikSekarang", "Status grid desa saat ini dan perbandingan beban vs produksi surya jam ini."),
  tool("jamEmasHariIni", "Rentang Jam Emas hari ini (surya melimpah): waktu terbaik menyalakan alat berat."),
  tool("sesiJamEmas", "Sesi Jam Emas yang sedang berjalan dan yang akan datang, beserta poin per partisipasi."),
  tool("saldoDanRiwayatSaya", "Saldo poin BUMDes warga yang bertanya, riwayat partisipasi, dan riwayat penukaran."),
  tool("katalogHadiah", "Daftar hadiah yang bisa ditukar, harga poin, dan sisa stok."),
  tool("alatSayaDanRencana", "Alat listrik yang didaftarkan warga dan jadwal pakai yang disarankan di Jam Emas."),
];

const TOOLS_OPERATOR: DefinisiTool[] = [
  tool("ringkasanPrakiraan", "Ringkasan prakiraan beban & surya: puncak, jam defisit, Jam Emas, solar PLTD.", {
    type: "object",
    properties: { jam: { type: "number", description: "Rentang jam ke depan, 1–48 (bawaan 24)." } },
  }),
  tool("statistikPartisipasi", "Jumlah pengajuan menunggu/ditinjau/disetujui/ditolak dan ringkasan sesi terakhir."),
  tool("peringkatWarga", "Warga dengan poin terbanyak.", {
    type: "object",
    properties: { n: { type: "number", description: "Jumlah warga, 1–20 (bawaan 5)." } },
  }),
  tool("simulasiBbm", "Simulasi hemat solar, biaya, dan emisi bila sekian persen warga ikut menggeser beban.", {
    type: "object",
    properties: { kepatuhanPersen: { type: "number", description: "0–100." } },
    required: ["kepatuhanPersen"],
  }),
  tool("stokVoucher", "Sisa stok kode voucher per hadiah."),
  tool("dampakNyata", "Total kWh yang benar-benar digeser warga (perkiraan Mata AI) dan penghematan solarnya."),
  tool("briefingTerbaru", "Ringkasan briefing Analis AI terakhir."),
];

/**
 * Tool tanpa argumen yang hasilnya diambil server SEBELUM memanggil model dan
 * ditaruh di prompt. Model bisa langsung menjawab dalam satu panggilan; tool
 * tetap tersedia untuk pertanyaan yang butuh argumen (mis. simulasiBbm).
 */
export const TOOL_AWAL: Record<Peran, string[]> = {
  warga: ["kondisiListrikSekarang", "jamEmasHariIni", "sesiJamEmas", "saldoDanRiwayatSaya", "katalogHadiah", "alatSayaDanRencana"],
  operator: ["ringkasanPrakiraan", "statistikPartisipasi", "peringkatWarga", "stokVoucher", "dampakNyata", "briefingTerbaru"],
};

export function toolsUntuk(peran: Peran): DefinisiTool[] {
  return peran === "warga" ? TOOLS_WARGA : TOOLS_OPERATOR;
}

export function promptSistem(
  peran: Peran,
  nama: string,
  tanggal: string,
  dataAwal?: Record<string, unknown>,
): string {
  const siapa =
    peran === "warga"
      ? `warga Pulau Siberut bernama ${nama}. Jawab dengan bahasa sederhana, hangat, dan singkat (maks 4 kalimat).`
      : `operator BUMDes/PLTD bernama ${nama}. Jawab ringkas, teknis bila perlu, gunakan poin-poin.`;
  return `Kamu "Asisten ListrikSiberut", asisten program hemat listrik desa di Pulau Siberut, Mentawai.
Kamu sedang membantu ${siapa}
Hari ini ${tanggal} (WIB).

Aturan:
- Angka (kW, kWh, poin, liter, rupiah, jam) HANYA boleh dari hasil tool. Jangan menebak atau mengarang angka.
- Bila pertanyaan butuh data, panggil tool yang sesuai dulu.
- Bila data tidak tersedia di tool, katakan terus terang.
- Tolak dengan sopan pertanyaan di luar topik listrik desa, Jam Emas, poin, hadiah, dan program BUMDes.
- Jangan pernah mengungkap data pribadi warga lain.
- Gunakan bahasa Indonesia. Jangan memakai em dash; tulis rentang jam dengan kata "sampai".${
    dataAwal
      ? `

Data terkini (hasil tool, sudah diambil). Bila cukup, jawab langsung dari sini tanpa memanggil tool;
panggil tool hanya untuk data yang belum ada atau butuh argumen lain:
${JSON.stringify(dataAwal)}`
      : ""
  }`;
}

export interface PesanObrolan {
  role: "user" | "assistant";
  content: string;
}

/** Riwayat dari klien tidak dipercaya: saring peran, potong panjang, ambil N terakhir. */
export function potongRiwayat(masukan: unknown, maks = 8, maksKar = 800): PesanObrolan[] {
  if (!Array.isArray(masukan)) return [];
  const bersih = masukan
    .filter(
      (m): m is PesanObrolan =>
        typeof m === "object" &&
        m !== null &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== "",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, maksKar) }));
  const akhir = bersih.slice(-maks);
  while (akhir.length && akhir[0].role !== "user") akhir.shift();
  return akhir;
}

export function bacaArgumen(json: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(json);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function angkaArg(
  args: Record<string, unknown>,
  kunci: string,
  min: number,
  maks: number,
  bawaan: number,
): number {
  const n = args[kunci];
  if (typeof n !== "number" || !Number.isFinite(n)) return bawaan;
  return Math.min(maks, Math.max(min, Math.round(n)));
}
