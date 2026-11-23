import { describe, expect, it } from "vitest";
import { jamWib, kunciTanggalWib, sudahWaktunya, tanggalPanjangWib, tanggalWib } from "./waktu";

// 2026-11-19 08:05 UTC = 15:05 WIB
const T = new Date("2026-11-19T08:05:00Z");
// 2026-11-19 20:30 UTC = 20 Nov 03:30 WIB (melewati tengah malam)
const MALAM = new Date("2026-11-19T20:30:00Z");

describe("waktu WIB", () => {
  it("jamWib memakai zona Asia/Jakarta, bukan zona perangkat", () => {
    expect(jamWib(T)).toBe("15:05");
    expect(jamWib(MALAM)).toBe("03:30");
  });
  it("tanggalPanjangWib berganti hari mengikuti WIB", () => {
    expect(tanggalPanjangWib(T)).toBe("19 November 2026");
    expect(tanggalPanjangWib(MALAM)).toBe("20 November 2026");
  });
  it("kunciTanggalWib YYYY-MM-DD menurut WIB (untuk kuota harian)", () => {
    expect(kunciTanggalWib(T)).toBe("2026-11-19");
    expect(kunciTanggalWib(MALAM)).toBe("2026-11-20");
  });

  it("tanggalWib bentuk singkat", () => {
    expect(tanggalWib(T)).toBe("19 Nov 2026");
  });
});

describe("sudahWaktunya (giliran pekerjaan berat di server)", () => {
  const MENIT = 60_000;
  it("belum pernah jalan → boleh", () => {
    expect(sudahWaktunya(undefined, 0, 5 * MENIT)).toBe(true);
  });
  it("baru jalan 2 menit lalu dengan jeda 4 menit → lewati", () => {
    expect(sudahWaktunya(0, 2 * MENIT, 4 * MENIT)).toBe(false);
  });
  it("tepat atau lewat jeda → boleh", () => {
    expect(sudahWaktunya(0, 4 * MENIT, 4 * MENIT)).toBe(true);
    expect(sudahWaktunya(0, 30 * MENIT, 4 * MENIT)).toBe(true);
  });
});
