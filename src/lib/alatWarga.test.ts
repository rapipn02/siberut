import { describe, expect, it } from "vitest";
import { isHasilLabel, kuotaTersisa, rencanaHemat, wattWajar } from "./alatWarga";

describe("isHasilLabel", () => {
  const ok = { terbaca: true, nama: "Pompa air", merek: "Shimizu", watt: 250, alasan: "Label jelas." };
  it("menerima hasil baca label yang lengkap", () => {
    expect(isHasilLabel(ok)).toBe(true);
  });
  it("menolak hasil cacat", () => {
    expect(isHasilLabel({ ...ok, watt: "250W" })).toBe(false);
    expect(isHasilLabel({ ...ok, terbaca: "ya" })).toBe(false);
  });
});

describe("wattWajar", () => {
  it("menerima 1–5000 W, membulatkan", () => {
    expect(wattWajar(249.6)).toBe(250);
    expect(wattWajar(0)).toBeNull();
    expect(wattWajar(90000)).toBeNull();
    expect(wattWajar(Number.NaN)).toBeNull();
  });
});

describe("rencanaHemat", () => {
  const alat = [
    { id: "a", nama: "Pompa air", watt: 250 },
    { id: "b", nama: "Setrika", watt: 350 },
    { id: "c", nama: "Mesin cuci", watt: 400 },
  ];

  it("menjadwalkan tiap alat 1 jam berurutan di Jam Emas", () => {
    const r = rencanaHemat(alat, { mulai: "10:00", selesai: "12:00" });
    expect(r.jadwal.map((j) => [j.alat.nama, j.jam])).toEqual([
      ["Pompa air", "10:00–11:00"],
      ["Setrika", "11:00–12:00"],
      ["Mesin cuci", "10:00–11:00"], // Jam Emas hanya 2 jam → kembali ke awal
    ]);
  });

  it("menghitung kWh total & solar yang dihemat desa", () => {
    const r = rencanaHemat(alat, { mulai: "10:00", selesai: "15:00" });
    expect(r.kwh).toBe(1);
    expect(r.liter).toBe(0.3);
    expect(r.rupiah).toBe(3000);
  });

  it("tanpa Jam Emas → tidak ada jadwal", () => {
    expect(rencanaHemat(alat, null).jadwal).toEqual([]);
  });
});

describe("kuotaTersisa", () => {
  it("sisa = batas - terpakai, tidak pernah negatif", () => {
    expect(kuotaTersisa(3, 10)).toBe(7);
    expect(kuotaTersisa(12, 10)).toBe(0);
  });
});
