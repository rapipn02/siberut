import { describe, expect, it } from "vitest";
import { angkaBriefing, briefingSegar, isBriefingAi, rentangJam, type BriefingAi } from "./analisAi";

const contoh: BriefingAi = {
  ringkasan: "Defisit malam ini pukul 17:00–21:00.",
  risiko: [{ jam: "17:00", tingkat: "tinggi", sebab: "Surya habis, beban memuncak." }],
  jadwalPltd: "Nyalakan PLTD penuh 17:00–22:00.",
  jamEmasSaran: "10:00–14:00",
  drafImbauan: { judul: "Geser pemakaian ke siang", isi: "Nyalakan pompa jam 10–14." },
};

describe("isBriefingAi", () => {
  it("menerima briefing lengkap", () => {
    expect(isBriefingAi(contoh)).toBe(true);
  });
  it("menolak tingkat risiko asing atau draf kosong", () => {
    expect(isBriefingAi({ ...contoh, risiko: [{ jam: "1", tingkat: "kiamat", sebab: "" }] })).toBe(false);
    expect(isBriefingAi({ ...contoh, drafImbauan: { judul: "x" } })).toBe(false);
  });
});

describe("angkaBriefing", () => {
  const t = (jam: string, beban: number, plts: number) => ({
    jam,
    beban,
    plts,
    deficit: beban > plts + 50,
  });

  it("menghitung angka dengan kode, bukan oleh AI", () => {
    const a = angkaBriefing(
      [t("10:00", 30, 60), t("11:00", 30, 70), t("18:00", 75, 0), t("19:00", 80, 0)],
      50,
    );
    expect(a.bebanPuncakKw).toBe(80);
    expect(a.jamPuncak).toBe("19:00");
    expect(a.jamDefisit).toEqual(["18:00", "19:00"]);
    expect(a.jamEmas).toBe("10:00 sampai 12:00");
    // Kekurangan surya (beban - plts) dipikul PLTD: 30*0 + 0 + 75 + 80 = 155 kWh × 0,3 L
    expect(a.literPltd).toBe(46.5);
  });

  it("tetap aman tanpa data", () => {
    expect(angkaBriefing([], 50)).toMatchObject({ bebanPuncakKw: 0, jamDefisit: [], jamEmas: null });
  });
});

describe("briefingSegar", () => {
  it("segar bila dibuat kurang dari 2 jam lalu", () => {
    expect(briefingSegar(1000, 1000 + 3600_000)).toBe(true);
    expect(briefingSegar(1000, 1000 + 3 * 3600_000)).toBe(false);
    expect(briefingSegar(undefined, 5)).toBe(false);
  });
});

describe("rentangJam", () => {
  it("menggabungkan jam berurutan jadi rentang dengan jam akhir +1", () => {
    expect(rentangJam(["17:00", "18:00", "19:00", "20:00", "21:00"])).toBe("17:00 sampai 22:00");
  });
  it("beberapa rentang dipisah koma, jam tunggal tetap 1 jam", () => {
    expect(rentangJam(["06:00", "17:00", "18:00", "23:00"])).toBe(
      "06:00 sampai 07:00, 17:00 sampai 19:00, 23:00 sampai 00:00",
    );
  });
  it("rentang yang mulai lagi di jam lebih awal ditandai (besok)", () => {
    expect(rentangJam(["17:00", "18:00", "21:00", "18:00", "19:00"])).toBe(
      "17:00 sampai 19:00, 21:00 sampai 22:00, 18:00 sampai 20:00 (besok)",
    );
  });
  it("hari ketiga dalam jendela 48 jam ditandai (lusa)", () => {
    expect(rentangJam(["19:00", "20:00", "18:00", "19:00", "18:00"])).toBe(
      "19:00 sampai 21:00, 18:00 sampai 20:00 (besok), 18:00 sampai 19:00 (lusa)",
    );
  });
  it("kosong bila tidak ada jam", () => {
    expect(rentangJam([])).toBe("");
  });
});
