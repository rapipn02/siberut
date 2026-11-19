/**
 * Statistik dampak iklim per hari / minggu / bulan (WIB).
 * - Dari partisipasi disetujui: kWh digeser (perkiraan Mata AI) → solar dihemat → CO₂ dicegah.
 * - Dari prakiraan ML: energi surya terpakai, porsi surya, jam defisit, solar PLTD perkiraan.
 * Semua angka prakiraan adalah perkiraan model, bukan pembacaan meteran.
 */
import { FUEL } from "./fuel";
import { BULAN_ID, kunciTanggalWib } from "./waktu";
import type { ForecastPoint, ParticipationRequest } from "./types";

export interface StatHarian {
  tanggal: string; // YYYY-MM-DD (WIB)
  aksi: number;
  kwhDigeser: number;
  literSolarDihemat: number;
  co2DicegahKg: number;
  suryaTerpakaiKwh: number;
  bebanKwh: number;
  porsiSuryaPersen: number;
  jamDefisit: number;
  literPltdPerkiraan: number;
  sesi: number;
}

const bulat = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function dampak(kwh: number) {
  const liter = kwh * FUEL.literPerKwhGenset;
  return { liter: bulat(liter, 1), co2: bulat(liter * FUEL.co2PerLiter, 1) };
}

export function ringkasHari(
  tanggal: string,
  disetujui: Array<{ estimasiKwh?: number }>,
  prakiraan: ForecastPoint[],
  jumlahSesi: number,
): StatHarian {
  const kwh = disetujui.reduce((t, d) => t + (d.estimasiKwh ?? 0), 0);
  let surya = 0;
  let beban = 0;
  let kurang = 0;
  let defisit = 0;
  for (const p of prakiraan) {
    surya += Math.min(p.plts, p.beban);
    beban += p.beban;
    kurang += Math.max(0, p.beban - p.plts);
    if (p.deficit) defisit++;
  }
  const d = dampak(kwh);
  return {
    tanggal,
    aksi: disetujui.length,
    kwhDigeser: bulat(kwh, 2),
    literSolarDihemat: d.liter,
    co2DicegahKg: d.co2,
    suryaTerpakaiKwh: Math.round(surya),
    bebanKwh: Math.round(beban),
    porsiSuryaPersen: beban > 0 ? Math.round((surya / beban) * 100) : 0,
    jamDefisit: defisit,
    literPltdPerkiraan: bulat(kurang * FUEL.literPerKwhGenset, 1),
    sesi: jumlahSesi,
  };
}

export type Periode = "hari" | "minggu" | "bulan";

export interface StatKelompok extends Omit<StatHarian, "tanggal"> {
  kunci: string;
  label: string;
}

function tanggalUtc(t: string): Date {
  const [y, m, d] = t.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const pendek = (d: Date) => `${d.getUTCDate()} ${BULAN_ID[d.getUTCMonth()].slice(0, 3)}`;

/** Minggu ISO (Senin sebagai awal): kunci "2026-W47", label tanggal Senin. */
function mingguIso(t: string): { kunci: string; senin: Date } {
  const d = tanggalUtc(t);
  const hari = (d.getUTCDay() + 6) % 7; // Senin = 0
  const senin = new Date(d.getTime() - hari * 86_400_000);
  const kamis = new Date(senin.getTime() + 3 * 86_400_000);
  const tahun = kamis.getUTCFullYear();
  const minggu = Math.ceil(((kamis.getTime() - Date.UTC(tahun, 0, 1)) / 86_400_000 + 1) / 7);
  return { kunci: `${tahun}-W${String(minggu).padStart(2, "0")}`, senin };
}

function kunciDan(t: string, periode: Periode): { kunci: string; label: string } {
  if (periode === "hari") return { kunci: t, label: pendek(tanggalUtc(t)) };
  if (periode === "minggu") {
    const { kunci, senin } = mingguIso(t);
    return { kunci, label: pendek(senin) };
  }
  const d = tanggalUtc(t);
  return {
    kunci: t.slice(0, 7),
    label: `${BULAN_ID[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`,
  };
}

const JUMLAHKAN = [
  "aksi",
  "kwhDigeser",
  "literSolarDihemat",
  "co2DicegahKg",
  "suryaTerpakaiKwh",
  "bebanKwh",
  "jamDefisit",
  "literPltdPerkiraan",
  "sesi",
] as const;

/** Gabungkan ringkasan harian per hari/minggu/bulan, urut naik. Porsi surya dihitung ulang. */
export function kelompokkan(harian: StatHarian[], periode: Periode): StatKelompok[] {
  const peta = new Map<string, StatKelompok>();
  for (const h of [...harian].sort((a, b) => a.tanggal.localeCompare(b.tanggal))) {
    const { kunci, label } = kunciDan(h.tanggal, periode);
    let g = peta.get(kunci);
    if (!g) {
      g = { kunci, label, ...Object.fromEntries(JUMLAHKAN.map((k) => [k, 0])) } as StatKelompok;
      g.porsiSuryaPersen = 0;
      peta.set(kunci, g);
    }
    for (const k of JUMLAHKAN) g[k] += h[k] ?? 0;
  }
  return [...peta.values()].map((g) => ({
    ...g,
    kwhDigeser: bulat(g.kwhDigeser, 2),
    literSolarDihemat: bulat(g.literSolarDihemat, 1),
    co2DicegahKg: bulat(g.co2DicegahKg, 1),
    literPltdPerkiraan: bulat(g.literPltdPerkiraan, 1),
    porsiSuryaPersen: g.bebanKwh > 0 ? Math.round((g.suryaTerpakaiKwh / g.bebanKwh) * 100) : 0,
  }));
}

export interface DampakRingkas {
  aksi: number;
  kwh: number;
  liter: number;
  co2Kg: number;
}

/** Dampak warga sendiri: aksi disetujui minggu ini & bulan ini (WIB). */
export function dampakPribadi(
  riwayat: ParticipationRequest[],
  sekarangMs: number,
): { mingguIni: DampakRingkas; bulanIni: DampakRingkas } {
  const hariIni = kunciTanggalWib(new Date(sekarangMs));
  const mingguKini = mingguIso(hariIni).kunci;
  const bulanKini = hariIni.slice(0, 7);
  const kosong = () => ({ aksi: 0, kwh: 0, liter: 0, co2Kg: 0 });
  const minggu = kosong();
  const bulan = kosong();
  for (const r of riwayat) {
    const ms = r.timestamp?.toMillis?.();
    if (r.status !== "APPROVED" || ms === undefined) continue;
    const t = kunciTanggalWib(new Date(ms));
    const kwh = r.estimasiKwh ?? 0;
    if (t.slice(0, 7) === bulanKini) {
      bulan.aksi++;
      bulan.kwh += kwh;
    }
    if (mingguIso(t).kunci === mingguKini) {
      minggu.aksi++;
      minggu.kwh += kwh;
    }
  }
  const selesai = (x: DampakRingkas): DampakRingkas => {
    const d = dampak(x.kwh);
    return { aksi: x.aksi, kwh: bulat(x.kwh, 2), liter: d.liter, co2Kg: d.co2 };
  };
  return { mingguIni: selesai(minggu), bulanIni: selesai(bulan) };
}

/** Daftar tanggal WIB dari `dari` sampai hari ini (inklusif), maks `batas` hari. */
export function daftarTanggal(dari: string, sekarangMs: number, batas = 120): string[] {
  const hariIni = kunciTanggalWib(new Date(sekarangMs));
  const hasil: string[] = [];
  // Mulai siang WIB agar kunci tanggal tidak tergeser zona waktu.
  for (let ms = Date.parse(`${dari}T12:00:00+07:00`); hasil.length < batas; ms += 86_400_000) {
    const t = kunciTanggalWib(new Date(ms));
    if (t > hariIni) break;
    hasil.push(t);
  }
  return hasil;
}
