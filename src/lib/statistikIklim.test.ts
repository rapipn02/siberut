import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { ParticipationRequest } from "./types";
import { daftarTanggal, dampakPribadi, kelompokkan, ringkasHari, type StatHarian } from "./statistikIklim";

const titik = (beban: number, plts: number, deficit = false) => ({ jam: "00:00", beban, plts, deficit });

describe("ringkasHari", () => {
  it("menghitung dampak partisipasi dan porsi surya dari prakiraan", () => {
    const s = ringkasHari(
      "2026-11-19",
      [{ estimasiKwh: 0.25 }, { estimasiKwh: 0.35 }, {}],
      [titik(40, 60), titik(50, 30), titik(70, 0, true)],
      2,
    );
    expect(s).toMatchObject({
      tanggal: "2026-11-19",
      aksi: 3,
      kwhDigeser: 0.6,
      literSolarDihemat: 0.2, // 0,6 kWh x 0,3 L/kWh = 0,18 -> 0,2
      co2DicegahKg: 0.5, // 0,18 L x 2,68
      suryaTerpakaiKwh: 70, // min(40,60) + min(50,30) + min(70,0)
      bebanKwh: 160,
      porsiSuryaPersen: 44, // 70 / 160
      jamDefisit: 1,
      literPltdPerkiraan: 27, // (0 + 20 + 70) x 0,3
      sesi: 2,
    });
  });

  it("hari tanpa data tetap aman, porsi surya 0", () => {
    expect(ringkasHari("2026-11-19", [], [], 0)).toMatchObject({ aksi: 0, bebanKwh: 0, porsiSuryaPersen: 0 });
  });
});

describe("kelompokkan", () => {
  const hari = (tanggal: string, kwh: number, beban = 100, surya = 50): StatHarian =>
    ({ ...ringkasHari(tanggal, [], [], 0), tanggal, kwhDigeser: kwh, co2DicegahKg: kwh, literSolarDihemat: kwh, aksi: 1, bebanKwh: beban, suryaTerpakaiKwh: surya }) as StatHarian;

  it("per minggu ISO (Senin sampai Minggu) dan menghitung ulang porsi surya", () => {
    // 16 Nov 2026 Senin, 22 Nov Minggu, 23 Nov Senin minggu berikutnya
    const g = kelompokkan([hari("2026-11-16", 1), hari("2026-11-22", 2), hari("2026-11-23", 4, 100, 100)], "minggu");
    expect(g.map((x) => [x.kunci, x.kwhDigeser, x.aksi, x.porsiSuryaPersen])).toEqual([
      ["2026-W47", 3, 2, 50],
      ["2026-W48", 4, 1, 100],
    ]);
    expect(g[0].label).toBe("16 Nov");
  });

  it("per bulan kalender", () => {
    const g = kelompokkan([hari("2026-10-31", 1), hari("2026-11-01", 2), hari("2026-11-30", 3)], "bulan");
    expect(g.map((x) => [x.kunci, x.label, x.kwhDigeser])).toEqual([
      ["2026-10", "Okt 2026", 1],
      ["2026-11", "Nov 2026", 5],
    ]);
  });

  it("per hari urut naik dengan label tanggal pendek", () => {
    const g = kelompokkan([hari("2026-11-19", 1), hari("2026-11-18", 2)], "hari");
    expect(g.map((x) => x.label)).toEqual(["18 Nov", "19 Nov"]);
  });
});

describe("dampakPribadi", () => {
  const ts = (iso: string) => ({ toMillis: () => Date.parse(iso) }) as unknown as Timestamp;
  const req = (iso: string, status: string, estimasiKwh?: number) =>
    ({ status, estimasiKwh, timestamp: ts(iso) }) as unknown as ParticipationRequest;

  it("menjumlahkan aksi disetujui minggu ini dan bulan ini (WIB)", () => {
    const sekarang = Date.parse("2026-11-19T08:00:00Z"); // Kamis 19 Nov 15:00 WIB
    const d = dampakPribadi(
      [
        req("2026-11-18T03:00:00Z", "APPROVED", 0.25), // minggu ini
        req("2026-11-10T03:00:00Z", "APPROVED", 0.4), // bulan ini, minggu lalu
        req("2026-10-30T03:00:00Z", "APPROVED", 1), // bulan lalu
        req("2026-11-18T04:00:00Z", "REJECTED", 2), // ditolak
      ],
      sekarang,
    );
    expect(d.mingguIni).toMatchObject({ aksi: 1, kwh: 0.25 });
    expect(d.bulanIni).toMatchObject({ aksi: 2, kwh: 0.65 });
  });
});

describe("daftarTanggal", () => {
  const KINI = Date.parse("2026-11-19T08:00:00Z"); // 19 Nov 15:00 WIB
  it("dari tanggal awal sampai hari ini (WIB), inklusif", () => {
    expect(daftarTanggal("2026-11-16", KINI)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
  });
  it("dibatasi jumlah hari maksimum", () => {
    expect(daftarTanggal("2026-01-01", KINI, 3)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });
  it("melewati pergantian bulan", () => {
    expect(daftarTanggal("2026-10-30", Date.parse("2026-11-01T05:00:00Z"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});
