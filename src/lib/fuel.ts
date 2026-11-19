export const FUEL = {
  hargaSolarPerLiter: 10_000,
  co2PerLiter: 2.68,
  co2SerapPohonPerTahun: 21,
  defisitRataRataKw: 25,
  jamPotensiPergeseranPerHari: 10,
  literPerKwhGenset: 0.3,
};

export function literPenuhPerHari(): number {
  return (
    FUEL.defisitRataRataKw *
    FUEL.jamPotensiPergeseranPerHari *
    FUEL.literPerKwhGenset
  );
}

export interface HasilHemat {
  liter: number;
  literBulan: number;
  literTahun: number;
  biaya: number;
  biayaBulan: number;
  co2: number;
  co2Tahun: number;
  pohonTahun: number;
}

export function hitungHemat(kepatuhanPersen: number): HasilHemat {
  const p = Math.max(0, Math.min(100, kepatuhanPersen));
  const liter = Math.round(literPenuhPerHari() * (p / 100));
  const biaya = liter * FUEL.hargaSolarPerLiter;
  const co2 = Math.round(liter * FUEL.co2PerLiter);
  const literTahun = liter * 365;
  const co2Tahun = Math.round(literTahun * FUEL.co2PerLiter);
  const pohonTahun = Math.round(co2Tahun / FUEL.co2SerapPohonPerTahun);
  return {
    liter,
    literBulan: liter * 30,
    literTahun,
    biaya,
    biayaBulan: biaya * 30,
    co2,
    co2Tahun,
    pohonTahun,
  };
}

/** Penghematan nyata dari kWh yang sudah digeser warga (bukan proyeksi slider). */
export function dampakKwh(kwh: number) {
  const k = Math.max(0, kwh);
  const liter = Math.round(k * FUEL.literPerKwhGenset * 10) / 10;
  return {
    kwh: Math.round(k * 100) / 100,
    liter,
    rupiah: Math.round(liter * FUEL.hargaSolarPerLiter),
    co2Kg: Math.round(liter * FUEL.co2PerLiter),
  };
}

export interface RingkasanDampak {
  kwh7Hari: number;
  aksi7Hari: number;
  kwhTotal: number;
  aksiTotal: number;
}

/** Ringkas pengajuan yang disetujui. `estimasiKwh` kosong = disetujui tanpa Mata AI. */
export function ringkasDampak(
  disetujui: Array<{ estimasiKwh?: number; waktuMs?: number }>,
  sekarangMs: number,
): RingkasanDampak {
  const batas7 = sekarangMs - 7 * 86_400_000;
  const r = { kwh7Hari: 0, aksi7Hari: 0, kwhTotal: 0, aksiTotal: 0 };
  for (const d of disetujui) {
    const kwh = d.estimasiKwh ?? 0;
    r.kwhTotal += kwh;
    r.aksiTotal++;
    if ((d.waktuMs ?? 0) >= batas7) {
      r.kwh7Hari += kwh;
      r.aksi7Hari++;
    }
  }
  const bulat = (n: number) => Math.round(n * 100) / 100;
  return { ...r, kwh7Hari: bulat(r.kwh7Hari), kwhTotal: bulat(r.kwhTotal) };
}
