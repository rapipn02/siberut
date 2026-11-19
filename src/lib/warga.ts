import type {
  LoadShiftSession,
  ParticipationRequest,
  SessionStatus,
} from "./types";

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
  if (sesi.status === "UPCOMING" || sekarangMs < mulai) {
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
): "disetujui" | "menunggu" | null {
  if (riwayat.some((r) => r.status === "APPROVED" && r.windowId === sesi.id)) {
    return "disetujui";
  }
  const mulai = sesi.startAt?.toMillis?.() ?? 0;
  const selesai = sesi.endAt?.toMillis?.() ?? 0;
  const menunggu = riwayat.some((r) => {
    if (r.status !== "PENDING") return false;
    const t = r.timestamp?.toMillis?.();
    return t === undefined || (t >= mulai && t <= selesai);
  });
  return menunggu ? "menunggu" : null;
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
