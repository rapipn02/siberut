/** Format waktu WIB (Asia/Jakarta) — Siberut di WIB, apa pun zona perangkat/server. */

const ZONA = "Asia/Jakarta";

export const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function bagian(d: Date, opsi: Intl.DateTimeFormatOptions) {
  const p = new Intl.DateTimeFormat("en-GB", { ...opsi, timeZone: ZONA }).formatToParts(d);
  return (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "";
}

/** "HH:MM" */
export function jamWib(d: Date): string {
  const a = bagian(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${a("hour")}:${a("minute")}`;
}

/** "19 November 2026" — format `date` sesi yang dibaca aplikasi warga. */
export function tanggalPanjangWib(d: Date): string {
  const a = bagian(d, { day: "numeric", month: "numeric", year: "numeric" });
  return `${Number(a("day"))} ${BULAN_ID[Number(a("month")) - 1]} ${a("year")}`;
}

/** "19 Nov 2026" */
export function tanggalWib(d: Date): string {
  const a = bagian(d, { day: "numeric", month: "numeric", year: "numeric" });
  return `${Number(a("day"))} ${BULAN_ID[Number(a("month")) - 1].slice(0, 3)} ${a("year")}`;
}

/** "2026-11-19" menurut WIB — kunci dokumen harian (kuota AI). */
export function kunciTanggalWib(d: Date): string {
  const a = bagian(d, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${a("year")}-${a("month")}-${a("day")}`;
}
