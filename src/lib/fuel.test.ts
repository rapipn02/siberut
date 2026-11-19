import { describe, it, expect } from "vitest";
import { FUEL, dampakKwh, hitungHemat, literPenuhPerHari, ringkasDampak } from "./fuel";

describe("literPenuhPerHari", () => {
  it("dihitung dari defisit rata-rata x jam potensi x konsumsi genset", () => {
    expect(literPenuhPerHari()).toBe(
      FUEL.defisitRataRataKw *
        FUEL.jamPotensiPergeseranPerHari *
        FUEL.literPerKwhGenset,
    );
    expect(literPenuhPerHari()).toBe(75);
  });
});

describe("hitungHemat", () => {
  it("50% kepatuhan menghasilkan angka yang berdasar fisika genset", () => {
    const h = hitungHemat(50);
    expect(h.liter).toBe(38);
    expect(h.biaya).toBe(380_000);
    expect(h.co2).toBe(102);
    expect(h.literTahun).toBe(13_870);
  });

  it("pohon dihitung dari serapan TAHUNAN, bukan harian", () => {
    const h = hitungHemat(50);
    expect(h.co2Tahun).toBe(37_172);
    expect(h.pohonTahun).toBe(Math.round(h.co2Tahun / FUEL.co2SerapPohonPerTahun));
    expect(h.pohonTahun).toBe(1_770);
  });

  it("skala linear terhadap kepatuhan", () => {
    expect(hitungHemat(80).liter).toBe(60);
    expect(hitungHemat(20).liter).toBe(15);
    expect(hitungHemat(0).liter).toBe(0);
  });

  it("clamp di luar 0..100", () => {
    expect(hitungHemat(-10).liter).toBe(0);
    expect(hitungHemat(150).liter).toBe(75);
  });
});

describe("dampakKwh", () => {
  it("mengonversi kWh tergeser jadi liter solar, rupiah, dan CO2", () => {
    // 10 kWh × 0,3 L/kWh = 3 L; 3 L × Rp10.000 = Rp30.000; 3 L × 2,68 = 8,04 kg
    expect(dampakKwh(10)).toEqual({ kwh: 10, liter: 3, rupiah: 30_000, co2Kg: 8 });
  });
  it("0 untuk nilai kosong/negatif", () => {
    expect(dampakKwh(-5)).toEqual({ kwh: 0, liter: 0, rupiah: 0, co2Kg: 0 });
  });
});

describe("ringkasDampak", () => {
  const HARI = 86_400_000;
  const SEKARANG = 100 * HARI;
  it("menjumlahkan kWh pengajuan disetujui, total dan 7 hari terakhir", () => {
    const r = ringkasDampak(
      [
        { estimasiKwh: 0.25, waktuMs: SEKARANG - 1 * HARI },
        { estimasiKwh: 0.35, waktuMs: SEKARANG - 3 * HARI },
        { estimasiKwh: 1.5, waktuMs: SEKARANG - 30 * HARI },
        { waktuMs: SEKARANG - 2 * HARI },
      ],
      SEKARANG,
    );
    expect(r).toEqual({ kwh7Hari: 0.6, aksi7Hari: 3, kwhTotal: 2.1, aksiTotal: 4 });
  });
});
