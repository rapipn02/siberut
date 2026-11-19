import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ringkasHari, type StatHarian } from "./statistikIklim";
export { daftarTanggal } from "./statistikIklim";
import { kunciTanggalWib } from "./waktu";

const HARI_MS = 86_400_000;

/** Awal hari WIB (00:00 +07:00) untuk "YYYY-MM-DD". */
function awalHariWib(tanggal: string): number {
  return Date.parse(`${tanggal}T00:00:00+07:00`);
}

/** Hitung & simpan `statistik_harian/{tanggal}` dari partisipasi, prakiraan, dan sesi hari itu. */
export async function hitungStatistikHari(db: Firestore, tanggal: string): Promise<StatHarian> {
  const mulai = Timestamp.fromMillis(awalHariWib(tanggal));
  const selesai = Timestamp.fromMillis(awalHariWib(tanggal) + HARI_MS);

  // Satu field range per query → tidak butuh composite index. Tanpa foto (select).
  const [disetujui, prakiraan, sesi] = await Promise.all([
    db
      .collection("participation_requests")
      .where("verifiedAt", ">=", mulai)
      .where("verifiedAt", "<", selesai)
      .select("status", "estimasiKwh")
      .get(),
    db
      .collection("power_forecasts")
      .where("timestamp", ">=", mulai)
      .where("timestamp", "<", selesai)
      .get(),
    db
      .collection("load_shift_sessions")
      .where("startAt", ">=", mulai)
      .where("startAt", "<", selesai)
      .select("status")
      .get(),
  ]);

  const stat = ringkasHari(
    tanggal,
    disetujui.docs
      .filter((d) => d.data().status === "APPROVED")
      .map((d) => ({ estimasiKwh: d.data().estimasiKwh })),
    prakiraan.docs.map((d) => {
      const v = d.data();
      return {
        jam: "",
        beban: v.projected_load_kw ?? 0,
        plts: v.predicted_plts_kw ?? 0,
        deficit: Boolean(v.deficit_flag),
      };
    }),
    sesi.size,
  );
  await db
    .collection("statistik_harian")
    .doc(tanggal)
    .set({ ...stat, diperbarui: Timestamp.now() });
  return stat;
}

/** Hari ini + kemarin — dipanggil cron tiap jalan. */
export async function hitungStatistikTerkini(db: Firestore, sekarangMs = Date.now()) {
  const hariIni = kunciTanggalWib(new Date(sekarangMs));
  const kemarin = kunciTanggalWib(new Date(sekarangMs - HARI_MS));
  return Promise.all([hitungStatistikHari(db, kemarin), hitungStatistikHari(db, hariIni)]);
}
