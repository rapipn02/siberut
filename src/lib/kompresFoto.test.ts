import { describe, expect, it } from "vitest";
import { muatBatas, ukuranTarget } from "./kompresFoto";

describe("ukuranTarget", () => {
  it("mengecilkan foto lanskap ke sisi terpanjang 1024", () => {
    expect(ukuranTarget(4000, 3000)).toEqual({ lebar: 1024, tinggi: 768 });
  });

  it("mengecilkan foto potret ke sisi terpanjang 1024", () => {
    expect(ukuranTarget(3000, 4000)).toEqual({ lebar: 768, tinggi: 1024 });
  });

  it("tidak membesarkan foto kecil", () => {
    expect(ukuranTarget(800, 600)).toEqual({ lebar: 800, tinggi: 600 });
  });
});

describe("muatBatas", () => {
  it("menolak total di atas 700 KB", () => {
    expect(muatBatas(["A".repeat((800 * 1024 * 4) / 3)])).toBe(false);
  });

  it("menolak gabungan beberapa foto yang totalnya lewat batas", () => {
    const foto400kb = "A".repeat((400 * 1024 * 4) / 3);
    expect(muatBatas([foto400kb, foto400kb])).toBe(false);
  });

  it("menerima foto kecil", () => {
    expect(muatBatas(["/9j/AAAA"])).toBe(true);
  });
});
