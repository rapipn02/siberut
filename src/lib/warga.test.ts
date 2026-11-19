import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { LoadShiftSession, ParticipationRequest } from "./types";
import {
  jamEmasHariIni,
  klaimSaya,
  sesiBeranda,
  ringkasKontribusi,
  statusHadiah,
  stokPerHadiah,
  statusWarga,
  titikTerdekat,
  statusKirimBukti,
  urutSesiWarga,
  urutTerbaru,
} from "./warga";

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Timestamp;

function sesi(
  id: string,
  status: LoadShiftSession["status"],
  mulai?: number,
  selesai?: number,
): LoadShiftSession {
  return {
    id,
    date: "19 November 2026",
    startTime: "10:00",
    endTime: "14:00",
    status,
    targetSavingKwh: 0,
    capacityKw: 0,
    currentLoadKw: 0,
    participantCount: 0,
    startAt: mulai === undefined ? undefined : ts(mulai),
    endAt: selesai === undefined ? undefined : ts(selesai),
  };
}

describe("statusKirimBukti", () => {
  it("boleh saat ACTIVE dan di dalam rentang", () => {
    expect(statusKirimBukti(sesi("a", "ACTIVE", 1000, 5000), 3000)).toEqual({
      boleh: true,
      alasan: "",
    });
  });

  it("tidak boleh saat ACTIVE tapi endAt sudah lewat (cron telat)", () => {
    const h = statusKirimBukti(sesi("a", "ACTIVE", 1000, 5000), 6000);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain("berakhir");
  });

  it("tidak boleh saat UPCOMING, alasan menyebut jam mulai", () => {
    const h = statusKirimBukti(sesi("a", "UPCOMING", 5000, 9000), 3000);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain("10:00");
  });

  it("tidak boleh saat ENDED", () => {
    const h = statusKirimBukti(sesi("a", "ENDED", 1000, 5000), 3000);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain("berakhir");
  });

  it("tidak boleh bila jadwal tanpa startAt/endAt", () => {
    expect(statusKirimBukti(sesi("a", "ACTIVE"), 3000).boleh).toBe(false);
  });
});

describe("urutSesiWarga", () => {
  it("ACTIVE dulu, UPCOMING terdekat, lalu ENDED terbaru", () => {
    const ended = sesi("ended", "ENDED", 100, 200);
    const endedLama = sesi("endedLama", "ENDED", 10, 20);
    const up1 = sesi("up1", "UPCOMING", 5000, 6000);
    const up2 = sesi("up2", "UPCOMING", 8000, 9000);
    const active = sesi("active", "ACTIVE", 1000, 4000);
    const hasil = urutSesiWarga([endedLama, ended, up2, active, up1]);
    expect(hasil.map((s) => s.id)).toEqual([
      "active",
      "up1",
      "up2",
      "ended",
      "endedLama",
    ]);
  });
});

describe("urutTerbaru", () => {
  it("mengurutkan dari waktu terbaru, waktu kosong (sedang ditulis) paling atas", () => {
    const items = [
      { id: "lama", t: ts(100) },
      { id: "kosong", t: undefined },
      { id: "baru", t: ts(900) },
    ];
    expect(urutTerbaru(items, (i) => i.t).map((i) => i.id)).toEqual([
      "kosong",
      "baru",
      "lama",
    ]);
  });
});

describe("klaimSaya", () => {
  const sesiIni = sesi("s1", "ACTIVE", 1000, 5000);
  const req = (
    status: "PENDING" | "APPROVED" | "REJECTED",
    t: number | undefined,
    windowId?: string,
  ) =>
    ({
      id: `${status}-${t}`,
      userId: "u",
      userName: "U",
      status,
      timestamp: t === undefined ? undefined : ts(t),
      windowId,
    }) as unknown as ParticipationRequest;

  it("disetujui bila ada APPROVED dengan windowId sesi ini", () => {
    expect(klaimSaya([req("APPROVED", 2000, "s1")], sesiIni)).toBe("disetujui");
  });

  it("menunggu bila ada PENDING yang dikirim dalam rentang sesi", () => {
    expect(klaimSaya([req("PENDING", 2000)], sesiIni)).toBe("menunggu");
  });

  it("menunggu bila PENDING baru saja dikirim (timestamp belum dari server)", () => {
    expect(klaimSaya([req("PENDING", undefined)], sesiIni)).toBe("menunggu");
  });

  it("ditinjau bila PENDING sudah dinilai Mata AI dan ditahan untuk operator", () => {
    const ditahan = { ...req("PENDING", 2000), aiAnalisis: { alasan: "foto layar" } };
    expect(klaimSaya([ditahan as unknown as ParticipationRequest], sesiIni)).toBe("ditinjau");
  });

  it("null bila hanya ada penolakan atau pengajuan sesi lain", () => {
    expect(
      klaimSaya(
        [req("REJECTED", 2000, "s1"), req("APPROVED", 9000, "s2"), req("PENDING", 9000)],
        sesiIni,
      ),
    ).toBeNull();
  });
});

describe("statusHadiah", () => {
  it("habis bila stok 0, walau poin cukup", () => {
    expect(statusHadiah(500, 120, 0)).toBe("habis");
  });
  it("kurang-poin bila saldo di bawah harga", () => {
    expect(statusHadiah(100, 120, 5)).toBe("kurang-poin");
  });
  it("bisa bila poin pas dan stok ada", () => {
    expect(statusHadiah(120, 120, 1)).toBe("bisa");
  });
});

describe("titikTerdekat", () => {
  const p = (jam: string, waktuMs?: number) => ({ jam, beban: 1, plts: 1, deficit: false, waktuMs });
  it("memilih titik yang waktunya paling dekat dengan sekarang", () => {
    const hasil = titikTerdekat([p("10:00", 1000), p("11:00", 4600), p("12:00", 8200)], 4000);
    expect(hasil?.jam).toBe("11:00");
  });
  it("mengabaikan titik tanpa waktu, null bila kosong", () => {
    expect(titikTerdekat([p("10:00")], 4000)).toBeNull();
  });
});

describe("ringkasKontribusi", () => {
  it("menghitung aksi disetujui dan total poin, mengabaikan yang lain", () => {
    const r = (status: string, poinDiberikan?: number) =>
      ({ status, poinDiberikan }) as unknown as ParticipationRequest;
    expect(
      ringkasKontribusi([r("APPROVED", 30), r("APPROVED", 25), r("REJECTED", 0), r("PENDING"), r("APPROVED")]),
    ).toEqual({ aksi: 3, poin: 55 });
  });
});

describe("stokPerHadiah", () => {
  it("menghitung kode tersedia per hadiah tanpa membawa kodenya", () => {
    // Dokumen voucher_stock utuh, termasuk kode rahasianya.
    const dokumen = [
      { reward_id: "a", is_used: false, code: "RAHASIA-1" },
      { reward_id: "a", is_used: false, code: "RAHASIA-2" },
      { reward_id: "a", is_used: true, code: "RAHASIA-3" },
      { reward_id: "b", is_used: false, code: "RAHASIA-4" },
      { reward_id: "", is_used: false, code: "RAHASIA-5" },
    ];
    const hasil = stokPerHadiah(dokumen);
    expect(hasil).toEqual({ a: 2, b: 1 });
    expect(JSON.stringify(hasil)).not.toContain("RAHASIA");
  });
});

describe("statusWarga", () => {
  it("SURPLUS bila surya melebihi beban di jam ini", () => {
    expect(statusWarga({ plts: 40, beban: 30 }, "ALERT")).toBe("SURPLUS");
  });
  it("memakai status grid bila tidak surplus", () => {
    expect(statusWarga({ plts: 10, beban: 30 }, "WARNING")).toBe("WARNING");
  });
  it("status di luar enum (data ML tak terduga) jadi NORMAL, bukan crash", () => {
    expect(statusWarga(null, "UNKNOWN")).toBe("NORMAL");
    expect(statusWarga(null, undefined)).toBe("NORMAL");
  });
});

describe("jamEmasHariIni", () => {
  const p = (jam: string, beban: number, plts: number) => ({ jam, beban, plts, deficit: false });
  it("dari prakiraan: rentang surplus terpanjang", () => {
    expect(jamEmasHariIni([p("10:00", 30, 50), p("11:00", 30, 60), p("12:00", 40, 20)], {})).toEqual({
      mulai: "10:00",
      selesai: "12:00",
      surplusKw: 30,
    });
  });
  it("cadangan dari system_status bila prakiraan tidak punya surplus", () => {
    expect(
      jamEmasHariIni([p("19:00", 70, 0)], { golden_hour_start: "10:00", golden_hour_end: "14:00" }),
    ).toEqual({ mulai: "10:00", selesai: "14:00", surplusKw: null });
  });
  it("null bila tidak ada keduanya", () => {
    expect(jamEmasHariIni([], null)).toBeNull();
  });
});

describe("sesiBeranda", () => {
  const HARI = 86_400_000;
  const KINI = 100 * HARI;
  it("menampilkan sesi berjalan & mendatang, dan sesi selesai paling lama 7 hari, maks 3", () => {
    const hasil = sesiBeranda(
      [
        sesi("lama", "ENDED", KINI - 90 * HARI, KINI - 90 * HARI + 3600_000), // Agustus: disembunyikan
        sesi("kemarin", "ENDED", KINI - HARI, KINI - HARI + 3600_000),
        sesi("aktif", "ACTIVE", KINI - 3600_000, KINI + 3600_000),
        sesi("besok", "UPCOMING", KINI + HARI, KINI + HARI + 3600_000),
      ],
      KINI,
    );
    expect(hasil.map((s) => s.id)).toEqual(["aktif", "besok", "kemarin"]);
  });

  it("kosong bila semua sesi sudah lama berakhir", () => {
    expect(sesiBeranda([sesi("lama", "ENDED", 10, 20)], KINI)).toEqual([]);
  });
});
