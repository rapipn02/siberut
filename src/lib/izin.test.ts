import { describe, expect, it } from "vitest";
import { ambilBearer, keputusanManual, operatorSah } from "./izin";

describe("ambilBearer", () => {
  it("mengambil token dari header Authorization", () => {
    expect(ambilBearer("Bearer abc.def")).toBe("abc.def");
  });
  it("null bila header kosong atau bukan Bearer", () => {
    expect(ambilBearer(null)).toBeNull();
    expect(ambilBearer("Basic xyz")).toBeNull();
    expect(ambilBearer("Bearer   ")).toBeNull();
  });
});

describe("operatorSah", () => {
  const admin = { aktif: true, role: "admin_bumdes" };
  const teknisi = { aktif: true, role: "teknisi_pltd" };

  it("operator aktif lolos untuk aksi umum", () => {
    expect(operatorSah(teknisi, false)).toBe(true);
  });
  it("aksi khusus admin menolak teknisi", () => {
    expect(operatorSah(teknisi, true)).toBe(false);
    expect(operatorSah(admin, true)).toBe(true);
  });
  it("menolak operator nonaktif atau dokumen kosong", () => {
    expect(operatorSah({ ...admin, aktif: false }, false)).toBe(false);
    expect(operatorSah(undefined, false)).toBe(false);
  });
});

describe("keputusanManual", () => {
  it("menyetujui pengajuan PENDING: tambah poin sesi", () => {
    expect(keputusanManual({ status: "PENDING", poin: 0 }, true, 30)).toEqual({
      ubah: true,
      status: "APPROVED",
      poin: 30,
      selisihPoin: 30,
    });
  });

  it("membalik penolakan mesin: tambah poin", () => {
    expect(keputusanManual({ status: "REJECTED", poin: 0 }, true, 25).selisihPoin).toBe(25);
  });

  it("membatalkan persetujuan: poin yang sudah diberikan ditarik kembali", () => {
    expect(keputusanManual({ status: "APPROVED", poin: 30 }, false, 30)).toEqual({
      ubah: true,
      status: "REJECTED",
      poin: 0,
      selisihPoin: -30,
    });
  });

  it("keputusan sama dengan status sekarang tidak mengubah apa pun (klik ganda)", () => {
    expect(keputusanManual({ status: "APPROVED", poin: 30 }, true, 30).ubah).toBe(false);
    expect(keputusanManual({ status: "REJECTED", poin: 0 }, false, 30).ubah).toBe(false);
  });
});
