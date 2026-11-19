/**
 * "Analis AI" — briefing operator dari prakiraan 48 jam.
 * Angka (puncak, jam defisit, liter solar) dihitung KODE di sini; Gemini hanya
 * menyusun narasi, saran jadwal, dan draf imbauan berdasarkan angka tersebut.
 */
import type { ForecastPoint } from "./types";
import { findGreenWindow } from "./greenHours";
import { FUEL } from "./fuel";

export const TINGKAT_RISIKO = ["rendah", "sedang", "tinggi"] as const;

export interface BriefingAi {
  ringkasan: string;
  risiko: { jam: string; tingkat: (typeof TINGKAT_RISIKO)[number]; sebab: string }[];
  jadwalPltd: string;
  jamEmasSaran: string;
  drafImbauan: { judul: string; isi: string };
}

export const SKEMA_BRIEFING = {
  nama: "briefing_operator",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ringkasan", "risiko", "jadwalPltd", "jamEmasSaran", "drafImbauan"],
    properties: {
      ringkasan: { type: "string" },
      risiko: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["jam", "tingkat", "sebab"],
          properties: {
            jam: { type: "string" },
            tingkat: { type: "string", enum: [...TINGKAT_RISIKO] },
            sebab: { type: "string" },
          },
        },
      },
      jadwalPltd: { type: "string" },
      jamEmasSaran: { type: "string" },
      drafImbauan: {
        type: "object",
        additionalProperties: false,
        required: ["judul", "isi"],
        properties: { judul: { type: "string" }, isi: { type: "string" } },
      },
    },
  },
};

export function isBriefingAi(x: unknown): x is BriefingAi {
  if (typeof x !== "object" || x === null) return false;
  const v = x as Record<string, unknown>;
  const draf = v.drafImbauan as Record<string, unknown> | undefined;
  return (
    typeof v.ringkasan === "string" &&
    Array.isArray(v.risiko) &&
    v.risiko.every((r) => {
      const o = r as Record<string, unknown>;
      return (
        typeof o?.jam === "string" &&
        typeof o.sebab === "string" &&
        (TINGKAT_RISIKO as readonly unknown[]).includes(o.tingkat)
      );
    }) &&
    typeof v.jadwalPltd === "string" &&
    typeof v.jamEmasSaran === "string" &&
    typeof draf?.judul === "string" &&
    typeof draf?.isi === "string"
  );
}

export interface AngkaBriefing {
  bebanPuncakKw: number;
  jamPuncak: string | null;
  jamDefisit: string[];
  jamEmas: string | null;
  /** Energi yang tidak tertutup surya × konsumsi genset — perkiraan solar PLTD. */
  literPltd: number;
}

export function angkaBriefing(titik: ForecastPoint[], kapasitasPltdKw: number): AngkaBriefing {
  let puncak: ForecastPoint | null = null;
  let kekuranganKwh = 0;
  for (const t of titik) {
    if (!puncak || t.beban > puncak.beban) puncak = t;
    kekuranganKwh += Math.max(0, t.beban - t.plts);
  }
  const hijau = findGreenWindow(titik);
  return {
    bebanPuncakKw: Math.round(puncak?.beban ?? 0),
    jamPuncak: puncak?.jam ?? null,
    jamDefisit: titik
      .filter((t) => t.deficit || t.beban > kapasitasPltdKw + t.plts)
      .map((t) => t.jam),
    jamEmas: hijau ? `${hijau.mulai} sampai ${hijau.selesai}` : null,
    literPltd: Math.round(kekuranganKwh * FUEL.literPerKwhGenset * 10) / 10,
  };
}

/** Briefing dibuat ulang paling sering tiap 2 jam (hemat kuota; ML memperbarui tiap 3 jam). */
export const UMUR_BRIEFING_MS = 2 * 3600_000;

export function briefingSegar(dibuatMs: number | undefined, sekarangMs: number): boolean {
  return dibuatMs !== undefined && sekarangMs - dibuatMs < UMUR_BRIEFING_MS;
}

export function promptBriefing(
  titik: ForecastPoint[],
  angka: AngkaBriefing,
  kapasitas: { pltsKwp: number; pltdKw: number; kk: number },
): string {
  const tabel = titik
    .map((t) => `${t.jam} beban ${Math.round(t.beban)} kW, surya ${Math.round(t.plts)} kW${t.deficit ? " DEFISIT" : ""}`)
    .join("\n");
  return `Kamu analis kelistrikan untuk operator BUMDes/PLTD Pulau Siberut (microgrid terisolasi).
Kapasitas: PLTS ${kapasitas.pltsKwp} kWp, PLTD ${kapasitas.pltdKw} kW, ${kapasitas.kk} rumah tangga.

Angka resmi (sudah dihitung sistem, JANGAN mengubah atau mengarang angka lain):
- Beban puncak: ${angka.bebanPuncakKw} kW pukul ${angka.jamPuncak ?? "-"}
- Jam defisit: ${angka.jamDefisit.join(", ") || "tidak ada"}
- Jam Emas (surya > beban): ${angka.jamEmas ?? "tidak ada"}
- Perkiraan solar PLTD untuk menutup kekurangan: ${angka.literPltd} liter

Prakiraan per jam (WIB):
${tabel}

Tulis dalam bahasa Indonesia yang ringkas untuk operator:
- ringkasan: 2–3 kalimat kondisi 24–48 jam ke depan.
- risiko: maks 4 jam paling rawan beserta sebabnya.
- jadwalPltd: saran kapan PLTD perlu siaga/beban penuh.
- jamEmasSaran: rentang jam terbaik warga menyalakan alat berat.
- drafImbauan: pesan push untuk warga (judul ≤ 40 karakter, isi ≤ 160 karakter, ramah, ajakan konkret, sebut poin BUMDes).
Tulis rentang jam dengan kata "sampai" (mis. "10:00 sampai 14:00"), jangan memakai tanda pisah atau em dash.`;
}

/**
 * ["17:00","18:00","19:00"] → "17:00 sampai 20:00". Jam yang berurutan dalam daftar
 * digabung; jam akhir = jam terakhir + 1 (prakiraan per jam). Rentang dipisah koma.
 */
export function rentangJam(jam: string[]): string {
  const ke = (j: string) => Number(j.slice(0, 2));
  const fmt = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  // [mulai, akhir, hariKe]. Daftar urut waktu (48 jam): rentang yang mulai di jam
  // lebih awal/sama dari rentang sebelumnya berarti sudah hari berikutnya.
  const rentang: [number, number, number][] = [];
  for (const j of jam) {
    const h = ke(j);
    const akhir = rentang[rentang.length - 1];
    if (akhir && (akhir[1] + 1) % 24 === h) akhir[1] = h;
    else rentang.push([h, h, akhir ? akhir[2] + (h <= akhir[0] ? 1 : 0) : 0]);
  }
  const HARI = ["", " (besok)", " (lusa)"];
  return rentang
    .map(([a, b, hari]) => `${fmt(a)} sampai ${fmt(b + 1)}${HARI[Math.min(hari, 2)]}`)
    .join(", ");
}
