import type { Firestore } from "firebase-admin/firestore";
import { sudahWaktunya } from "./waktu";

/**
 * Giliran pekerjaan berat bersama untuk cron VPS dan semua tab operator.
 * Berapa pun tab yang terbuka, pekerjaan hanya jalan sekali per `jedaMs`
 * (hemat kuota baca Firestore). Biaya: 1 baca + 1 tulis per pemanggilan.
 *
 * Sengaja bukan transaksi: transaksi mengulang otomatis saat Firestore membalas
 * RESOURCE_EXHAUSTED (kuota habis) sampai ~60 detik dan menahan koneksi cron.
 * ponytail: dua pemanggil yang tepat bersamaan bisa sama-sama lolos (pekerjaan jalan dua kali);
 * aman karena semua pekerjaannya idempoten.
 */
export async function ambilGiliran(
  db: Firestore,
  kunci: "tick" | "statistik" | "prakiraan",
  jedaMs: number,
  sekarangMs = Date.now(),
): Promise<boolean> {
  const ref = db.collection("statistik").doc("jadwal");
  const terakhir: number | undefined = (await ref.get()).data()?.[kunci];
  if (!sudahWaktunya(terakhir, sekarangMs, jedaMs)) return false;
  await ref.set({ [kunci]: sekarangMs }, { merge: true });
  return true;
}
