import type {
  LoadShiftSession,
  ParticipationRequest,
  SessionStatus,
} from "./types";
import type { ForecastPoint } from "./types";
import { findGreenWindow } from "./greenHours";

export interface StatusKirim {
  boleh: boolean;
  alasan: string;
}

/**
 * Apakah warga boleh mengirim bukti untuk sesi ini sekarang.
 * Status di Firestore bisa tertinggal bila cron `sessions/tick` telat,
 * jadi rentang waktu `startAt`–`endAt` ikut dicek.
 */
export function statusKirimBukti(
  sesi: LoadShiftSession,
  sekarangMs: number,
): StatusKirim {
  const mulai = sesi.startAt?.toMillis?.();
  const selesai = sesi.endAt?.toMillis?.();
  if (!mulai || !selesai) {
    return { boleh: false, alasan: "Jadwal sesi tidak lengkap." };
  }
  if (sesi.status === "ENDED" || sekarangMs > selesai) {
    return { boleh: false, alasan: "Sesi sudah berakhir." };
  }
  // Ikut jam, bukan status: status UPCOMING→ACTIVE baru diperbarui tick tiap ±5 menit,
  // sedangkan server verifikasi juga menilai berdasarkan jam sesi.
  if (sekarangMs < mulai) {
    return { boleh: false, alasan: `Sesi dibuka pukul ${sesi.startTime} WIB.` };
  }
  return { boleh: true, alasan: "" };
}

const PERINGKAT: Record<SessionStatus, number> = {
  ACTIVE: 0,
  UPCOMING: 1,
  ENDED: 2,
};

export function urutSesiWarga(sesi: LoadShiftSession[]): LoadShiftSession[] {
  const mulai = (s: LoadShiftSession) => s.startAt?.toMillis?.() ?? 0;
  return [...sesi].sort((a, b) => {
    const beda = PERINGKAT[a.status] - PERINGKAT[b.status];
    if (beda !== 0) return beda;
    // Mendatang: yang paling dekat dulu. Lainnya: yang terbaru dulu.
    return a.status === "UPCOMING" ? mulai(a) - mulai(b) : mulai(b) - mulai(a);
  });
}

/**
 * Urut terbaru dulu. Waktu kosong = `serverTimestamp()` yang belum
 * dikonfirmasi server (dokumen baru saja dikirim) → taruh paling atas.
 */
export function urutTerbaru<T>(
  items: T[],
  waktu: (item: T) => { toMillis(): number } | null | undefined,
): T[] {
  const ms = (i: T) => waktu(i)?.toMillis?.() ?? Number.POSITIVE_INFINITY;
  return [...items].sort((a, b) => ms(b) - ms(a));
}

/**
 * Posisi klaim warga untuk satu sesi: sudah dapat poin, buktinya masih
 * menunggu verifikasi, atau belum ada (boleh kirim). Pengajuan PENDING belum
 * punya `windowId`, jadi dicocokkan lewat waktu kirim dalam rentang sesi.
 */
export function klaimSaya(
  riwayat: ParticipationRequest[],
  sesi: LoadShiftSession,
): "disetujui" | "menunggu" | "ditinjau" | null {
  if (riwayat.some((r) => r.status === "APPROVED" && r.windowId === sesi.id)) {
    return "disetujui";
  }
  const mulai = sesi.startAt?.toMillis?.() ?? 0;
  const selesai = sesi.endAt?.toMillis?.() ?? 0;
  const pending = riwayat.find((r) => {
    if (r.status !== "PENDING") return false;
    const t = r.timestamp?.toMillis?.();
    return t === undefined || (t >= mulai && t <= selesai);
  });
  if (!pending) return null;
  // Sudah dinilai Mata AI tapi ditahan → menunggu keputusan operator.
  return pending.aiAnalisis ? "ditinjau" : "menunggu";
}

export type StatusHadiah = "bisa" | "kurang-poin" | "habis";

export function statusHadiah(poin: number, biaya: number, stok: number): StatusHadiah {
  if (stok <= 0) return "habis";
  if (poin < biaya) return "kurang-poin";
  return "bisa";
}

/** Titik prakiraan yang jamnya paling dekat dengan `sekarangMs`. */
export function titikTerdekat<T extends { waktuMs?: number }>(
  titik: T[],
  sekarangMs: number,
): T | null {
  let terbaik: T | null = null;
  for (const t of titik) {
    if (t.waktuMs === undefined) continue;
    if (
      !terbaik ||
      Math.abs(t.waktuMs - sekarangMs) < Math.abs((terbaik.waktuMs as number) - sekarangMs)
    ) {
      terbaik = t;
    }
  }
  return terbaik;
}

export function ringkasKontribusi(riwayat: ParticipationRequest[]): {
  aksi: number;
  poin: number;
} {
  const ok = riwayat.filter((r) => r.status === "APPROVED");
  return { aksi: ok.length, poin: ok.reduce((t, r) => t + (r.poinDiberikan ?? 0), 0) };
}

/** Jumlah kode voucher tersedia per hadiah — hanya angka, kode tidak ikut. */
export function stokPerHadiah(
  voucher: Array<{ reward_id?: string; is_used?: boolean }>,
): Record<string, number> {
  const stok: Record<string, number> = {};
  for (const v of voucher) {
    if (!v.reward_id || v.is_used) continue;
    stok[v.reward_id] = (stok[v.reward_id] ?? 0) + 1;
  }
  return stok;
}

export type StatusWarga = "SURPLUS" | "NORMAL" | "WARNING" | "ALERT";

const STATUS_GRID_SAH = new Set(["NORMAL", "WARNING", "ALERT"]);

/** Status untuk warga: SURPLUS bila surya > beban jam ini, selain itu status grid (aman dari nilai tak dikenal). */
export function statusWarga(
  kini: { plts: number; beban: number } | null,
  statusGrid: string | undefined,
): StatusWarga {
  if (kini && kini.plts > kini.beban) return "SURPLUS";
  return statusGrid && STATUS_GRID_SAH.has(statusGrid)
    ? (statusGrid as StatusWarga)
    : "NORMAL";
}

export interface JamEmas {
  mulai: string;
  selesai: string;
  /** Surplus surya maksimum (kW); null bila dari cadangan system_status. */
  surplusKw: number | null;
}

/** Jam Emas 24 jam ke depan dari prakiraan; cadangan `golden_hour_*` di system_status. */
export function jamEmasHariIni(
  titik: ForecastPoint[],
  status: { golden_hour_start?: string; golden_hour_end?: string } | null,
): JamEmas | null {
  const w = findGreenWindow(titik.slice(0, 25));
  if (w) return { mulai: w.mulai, selesai: w.selesai, surplusKw: w.surplusKw };
  if (status?.golden_hour_start && status.golden_hour_end) {
    return { mulai: status.golden_hour_start, selesai: status.golden_hour_end, surplusKw: null };
  }
  return null;
}

const MAKS_HARI_SESI_SELESAI = 7;
const MAKS_SESI_SELESAI = 3;

/**
 * Sesi untuk Beranda warga: yang berjalan dan mendatang, lalu sesi selesai yang
 * berakhir ≤ 7 hari lalu (maks 3). Sesi berbulan-bulan lalu tidak relevan bagi warga.
 */
export function sesiBeranda(sesi: LoadShiftSession[], sekarangMs: number): LoadShiftSession[] {
  const batas = sekarangMs - MAKS_HARI_SESI_SELESAI * 86_400_000;
  const urut = urutSesiWarga(sesi);
  const berjalan = urut.filter((s) => s.status !== "ENDED");
  const baruSelesai = urut
    .filter((s) => s.status === "ENDED" && (s.endAt?.toMillis?.() ?? 0) >= batas)
    .slice(0, MAKS_SESI_SELESAI);
  return [...berjalan, ...baruSelesai];
}
