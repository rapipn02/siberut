import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { TOOL_AWAL, angkaArg, bacaArgumen, type Peran } from "./asisten";
import { angkaBriefing } from "./analisAi";
import { dampakKwh, hitungHemat } from "./fuel";
import { jamEmasHariIni, statusWarga, stokPerHadiah, titikTerdekat } from "./warga";
import { rencanaHemat } from "./alatWarga";
import { jamWib, tanggalWib } from "./waktu";
import type { ForecastPoint } from "./types";

type Hasil = Record<string, unknown>;
type Konteks = { db: Firestore; uid: string; sekarang: number };
type Penangan = (k: Konteks, args: Record<string, unknown>) => Promise<Hasil>;

export async function prakiraan(db: Firestore, sekarang: number, jam: number): Promise<ForecastPoint[]> {
  const snap = await db
    .collection("power_forecasts")
    .where("timestamp", ">=", Timestamp.fromMillis(sekarang - 3600_000))
    .where("timestamp", "<", Timestamp.fromMillis(sekarang + jam * 3600_000))
    .orderBy("timestamp", "asc")
    .limit(jam + 1)
    .get();
  return snap.docs.map((d) => {
    const v = d.data();
    const t: Date = v.timestamp.toDate();
    return {
      jam: jamWib(t),
      beban: Math.round(v.projected_load_kw ?? 0),
      plts: Math.round(v.predicted_plts_kw ?? 0),
      deficit: Boolean(v.deficit_flag),
      waktuMs: t.getTime(),
    };
  });
}

export async function statusGrid(db: Firestore) {
  return (await db.collection("system_status").doc("siberut_grid").get()).data() ?? {};
}

async function stok(db: Firestore) {
  const snap = await db.collection("voucher_stock").where("is_used", "==", false).select("reward_id", "is_used").get();
  return stokPerHadiah(snap.docs.map((d) => d.data()));
}

const WARGA: Record<string, Penangan> = {
  async kondisiListrikSekarang({ db, sekarang }) {
    const [titik, s] = await Promise.all([prakiraan(db, sekarang, 3), statusGrid(db)]);
    const kini = titikTerdekat(titik, sekarang);
    return {
      status: statusWarga(kini, s.current_operating_status ?? s.current_status),
      jam: kini?.jam ?? null,
      bebanKw: kini?.beban ?? null,
      suryaKw: kini?.plts ?? null,
    };
  },
  async jamEmasHariIni({ db, sekarang }) {
    const [titik, s] = await Promise.all([prakiraan(db, sekarang, 24), statusGrid(db)]);
    return { jamEmas: jamEmasHariIni(titik, s) };
  },
  async sesiJamEmas({ db, sekarang }) {
    const snap = await db
      .collection("load_shift_sessions")
      .where("endAt", ">", Timestamp.fromMillis(sekarang))
      .orderBy("endAt", "asc")
      .limit(5)
      .get();
    return {
      sesi: snap.docs.map((d) => {
        const v = d.data();
        return { tanggal: v.date, mulai: v.startTime, selesai: v.endTime, status: v.status, poin: v.poin_per_partisipasi ?? 25 };
      }),
    };
  },
  async saldoDanRiwayatSaya({ db, uid }) {
    const [saldo, ikut, tukar] = await Promise.all([
      db.collection("BUMDes_rewards").doc(uid).get(),
      db.collection("participation_requests").where("userId", "==", uid).select("status", "goldenHourRange", "poinDiberikan", "timestamp").get(),
      db.collection("redemption_history").where("user_id", "==", uid).select("nama_hadiah", "biaya_poin", "timestamp").get(),
    ]);
    // 5 terbaru; `t` hanya kunci urut, tidak dikirim ke model.
    const urut = <T,>(a: { t: number; data: T }[]) =>
      a.sort((x, y) => y.t - x.t).slice(0, 5).map((x) => x.data);
    return {
      saldoPoin: saldo.data()?.total_poin ?? 0,
      partisipasiTerakhir: urut(
        ikut.docs.map((d) => {
          const v = d.data();
          const t = v.timestamp?.toMillis?.() ?? 0;
          return {
            t,
            data: { tanggal: t ? tanggalWib(new Date(t)) : "-", jam: v.goldenHourRange, status: v.status, poin: v.poinDiberikan ?? 0 },
          };
        }),
      ),
      penukaranTerakhir: urut(
        tukar.docs.map((d) => {
          const v = d.data();
          return { t: v.timestamp?.toMillis?.() ?? 0, data: { hadiah: v.nama_hadiah, biayaPoin: v.biaya_poin } };
        }),
      ),
    };
  },
  async katalogHadiah({ db }) {
    const [katalog, sisa] = await Promise.all([db.collection("reward_catalog").get(), stok(db)]);
    return {
      hadiah: katalog.docs
        .filter((d) => d.data().aktif !== false)
        .map((d) => ({ nama: d.data().name, poin: d.data().pointsRequired, stok: sisa[d.id] ?? 0 })),
    };
  },
  async alatSayaDanRencana({ db, uid, sekarang }) {
    const [alatSnap, titik, s] = await Promise.all([
      db.collection("users").doc(uid).collection("alat").get(),
      prakiraan(db, sekarang, 24),
      statusGrid(db),
    ]);
    const alat = alatSnap.docs.map((d) => ({ id: d.id, nama: String(d.data().nama), watt: Number(d.data().watt) }));
    const r = rencanaHemat(alat, jamEmasHariIni(titik, s));
    return {
      alat: alat.map(({ nama, watt }) => ({ nama, watt })),
      jadwal: r.jadwal.map((j) => ({ alat: j.alat.nama, jam: j.jam })),
      totalKwh: r.kwh,
      solarDihematLiter: r.liter,
    };
  },
};

const OPERATOR: Record<string, Penangan> = {
  async ringkasanPrakiraan({ db, sekarang }, args) {
    const jam = angkaArg(args, "jam", 1, 48, 24);
    const [titik, s] = await Promise.all([prakiraan(db, sekarang, jam), statusGrid(db)]);
    return { rentangJam: jam, ...angkaBriefing(titik, s.total_pltd_capacity_kw ?? 50), statusSistem: s.current_status };
  },
  async statistikPartisipasi({ db }) {
    const [semua, sesi] = await Promise.all([
      db.collection("participation_requests").select("status", "aiAnalisis").get(),
      db.collection("load_shift_sessions").orderBy("startAt", "desc").limit(5).get(),
    ]);
    const hitung = { menunggu: 0, ditinjau: 0, disetujui: 0, ditolak: 0 };
    for (const d of semua.docs) {
      const v = d.data();
      if (v.status === "APPROVED") hitung.disetujui++;
      else if (v.status === "REJECTED") hitung.ditolak++;
      else if (v.aiAnalisis) hitung.ditinjau++;
      else hitung.menunggu++;
    }
    return {
      pengajuan: hitung,
      sesiTerakhir: sesi.docs.map((d) => {
        const v = d.data();
        return { tanggal: v.date, jam: `${v.startTime}-${v.endTime}`, status: v.status, peserta: v.participantCount ?? 0, kwhTergeser: v.kwhTergeser ?? 0 };
      }),
    };
  },
  async peringkatWarga({ db }, args) {
    const n = angkaArg(args, "n", 1, 20, 5);
    const snap = await db.collection("BUMDes_rewards").orderBy("total_poin", "desc").limit(n).get();
    return { peringkat: snap.docs.map((d, i) => ({ urutan: i + 1, nama: d.data().nama_warga ?? "(tanpa nama)", poin: d.data().total_poin ?? 0 })) };
  },
  async simulasiBbm(_k, args) {
    const p = angkaArg(args, "kepatuhanPersen", 0, 100, 50);
    return { kepatuhanPersen: p, ...hitungHemat(p), catatan: "Simulasi berbasis asumsi defisit rata-rata, bukan data meteran." };
  },
  async stokVoucher({ db }) {
    const [katalog, sisa] = await Promise.all([db.collection("reward_catalog").get(), stok(db)]);
    return { stok: katalog.docs.map((d) => ({ hadiah: d.data().name, aktif: d.data().aktif !== false, sisa: sisa[d.id] ?? 0 })) };
  },
  async dampakNyata({ db }) {
    const d = (await db.collection("statistik").doc("dampak").get()).data();
    if (!d) return { tersedia: false };
    return { tujuhHari: { aksi: d.aksi7Hari, ...dampakKwh(d.kwh7Hari) }, total: { aksi: d.aksiTotal, ...dampakKwh(d.kwhTotal) } };
  },
  async briefingTerbaru({ db }) {
    const b = (await db.collection("ai_briefing").doc("terbaru").get()).data();
    if (!b) return { tersedia: false };
    return { angka: b.angka, ringkasan: b.ai?.ringkasan ?? null, jadwalPltd: b.ai?.jadwalPltd ?? null };
  },
};

/** Jalankan satu tool. Peran menentukan daftar tool — warga tidak bisa memanggil tool operator. */
export async function jalankanTool(
  peran: Peran,
  nama: string,
  argsJson: string,
  konteks: Konteks,
): Promise<Hasil> {
  const penangan = (peran === "warga" ? WARGA : OPERATOR)[nama];
  if (!penangan) return { error: `Tool "${nama}" tidak tersedia.` };
  try {
    return await penangan(konteks, bacaArgumen(argsJson));
  } catch (err) {
    console.error(`tool ${nama} gagal:`, err instanceof Error ? err.message : err);
    return { error: "Data sedang tidak dapat dibaca." };
  }
}

/** Jalankan semua TOOL_AWAL secara paralel → `{ namaTool: hasil }` untuk prompt. */
export async function dataAwal(peran: Peran, konteks: Konteks): Promise<Record<string, Hasil>> {
  const nama = TOOL_AWAL[peran];
  const hasil = await Promise.all(nama.map((n) => jalankanTool(peran, n, "{}", konteks)));
  return Object.fromEntries(nama.map((n, i) => [n, hasil[i]]));
}
