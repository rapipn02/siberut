/** Logika murni otorisasi API — bagian yang menyentuh Firebase ada di authServer.ts. */

export function ambilBearer(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function operatorSah(data: unknown, perluAdmin: boolean): boolean {
  if (typeof data !== "object" || data === null) return false;
  const { aktif, role } = data as { aktif?: unknown; role?: unknown };
  if (aktif !== true) return false;
  if (perluAdmin) return role === "admin_bumdes";
  return role === "admin_bumdes" || role === "teknisi_pltd";
}

type StatusPengajuan = "PENDING" | "APPROVED" | "REJECTED";

export interface HasilKeputusanManual {
  ubah: boolean;
  status: StatusPengajuan;
  poin: number;
  /** Perubahan saldo warga: positif saat disetujui, negatif saat persetujuan dibatalkan. */
  selisihPoin: number;
}

/** Operator menimpa keputusan mesin. Tidak pernah memberi/menarik poin dua kali. */
export function keputusanManual(
  sekarang: { status: StatusPengajuan; poin: number },
  setujui: boolean,
  poinSesi: number,
): HasilKeputusanManual {
  const tujuan: StatusPengajuan = setujui ? "APPROVED" : "REJECTED";
  if (sekarang.status === tujuan) {
    return { ubah: false, status: tujuan, poin: sekarang.poin, selisihPoin: 0 };
  }
  if (setujui) {
    return { ubah: true, status: "APPROVED", poin: poinSesi, selisihPoin: poinSesi };
  }
  const ditarik = sekarang.status === "APPROVED" ? sekarang.poin : 0;
  return { ubah: true, status: "REJECTED", poin: 0, selisihPoin: -ditarik };
}
