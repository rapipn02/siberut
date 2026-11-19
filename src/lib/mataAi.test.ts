import { describe, expect, it } from "vitest";
import {
  estimasiKwh,
  isAnalisisFoto,
  keputusanAkhir,
  type AnalisisFoto,
} from "./mataAi";
import type { HasilVerifikasi } from "./verification";

const asli: AnalisisFoto = {
  alat: [{ nama: "pompa air", estimasiWatt: 250 }],
  tampakDigunakan: true,
  indikasiKecurangan: "tidak",
  keyakinan: 0.9,
  alasan: "Pompa air menyala, kabel tersambung.",
};

const lolosAturan: HasilVerifikasi = {
  status: "APPROVED",
  poin: 30,
  windowId: "s1",
  reason: "Terverifikasi: dikirim dalam jendela imbauan aktif.",
  reasonCode: "OK_APPROVED",
};

const gagalAturan: HasilVerifikasi = {
  status: "REJECTED",
  poin: 0,
  windowId: null,
  reason: "Dikirim di luar jendela imbauan yang aktif.",
  reasonCode: "ERR_OUTSIDE_WINDOW",
};

describe("isAnalisisFoto", () => {
  it("menerima keluaran AI yang lengkap", () => {
    expect(isAnalisisFoto(asli)).toBe(true);
  });
  it("menolak keluaran yang cacat", () => {
    expect(isAnalisisFoto({ ...asli, keyakinan: "tinggi" })).toBe(false);
    expect(isAnalisisFoto({ ...asli, indikasiKecurangan: "mungkin" })).toBe(false);
    expect(isAnalisisFoto({ ...asli, alat: [{ nama: "x" }] })).toBe(false);
    expect(isAnalisisFoto(null)).toBe(false);
  });
});

describe("keputusanAkhir", () => {
  it("aturan gagal tetap ditolak, AI tidak dipakai", () => {
    expect(keputusanAkhir(gagalAturan, asli)).toMatchObject({
      status: "REJECTED",
      reasonCode: "ERR_OUTSIDE_WINDOW",
    });
  });

  it("aturan lolos + AI yakin foto asli → disetujui dengan alasan AI", () => {
    const k = keputusanAkhir(lolosAturan, asli);
    expect(k).toMatchObject({ status: "APPROVED", poin: 30, reasonCode: "OK_APPROVED_AI" });
    expect(k.reason).toContain("pompa air");
  });

  it("AI curiga foto layar → ditahan untuk operator, tanpa poin", () => {
    const k = keputusanAkhir(lolosAturan, { ...asli, indikasiKecurangan: "foto_layar" });
    expect(k).toMatchObject({ status: "PENDING", poin: 0, reasonCode: "AI_PERLU_TINJAUAN" });
  });

  it("AI ragu (keyakinan rendah) atau alat tidak tampak dipakai → ditahan", () => {
    expect(keputusanAkhir(lolosAturan, { ...asli, keyakinan: 0.4 }).status).toBe("PENDING");
    expect(keputusanAkhir(lolosAturan, { ...asli, tampakDigunakan: false }).status).toBe(
      "PENDING",
    );
  });

  it("AI tidak tersedia → keputusan aturan tetap berlaku", () => {
    expect(keputusanAkhir(lolosAturan, null)).toMatchObject({
      status: "APPROVED",
      reasonCode: "OK_APPROVED",
    });
  });
});

describe("estimasiKwh", () => {
  it("menjumlahkan watt semua alat dengan asumsi 1 jam pemakaian", () => {
    expect(
      estimasiKwh({
        ...asli,
        alat: [
          { nama: "pompa air", estimasiWatt: 250 },
          { nama: "setrika", estimasiWatt: 350 },
        ],
      }),
    ).toBe(0.6);
  });

  it("membatasi watt tak masuk akal per alat (maks 3000 W)", () => {
    expect(estimasiKwh({ ...asli, alat: [{ nama: "?", estimasiWatt: 90000 }] })).toBe(3);
  });

  it("0 bila AI tidak ada", () => {
    expect(estimasiKwh(null)).toBe(0);
  });
});
