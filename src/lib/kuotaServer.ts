import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { kunciTanggalWib } from "./waktu";
import { kuotaTersisa } from "./alatWarga";

/** Batas panggilan AI per pengguna per hari (WIB) — melindungi kuota Gemini bersama. */
export const BATAS_HARIAN = { label: 10, asisten: 25 } as const;

/**
 * Ambil satu jatah. `false` bila jatah hari ini habis. Transaksi, jadi klik
 * beruntun tidak bisa melewati batas.
 */
export async function pakaiKuota(
  db: Firestore,
  uid: string,
  jenis: keyof typeof BATAS_HARIAN,
): Promise<{ boleh: boolean; sisa: number }> {
  const ref = db.collection("ai_kuota").doc(`${uid}_${jenis}_${kunciTanggalWib(new Date())}`);
  return db.runTransaction(async (tx) => {
    const terpakai: number = (await tx.get(ref)).data()?.terpakai ?? 0;
    const sisa = kuotaTersisa(terpakai, BATAS_HARIAN[jenis]);
    if (sisa <= 0) return { boleh: false, sisa: 0 };
    tx.set(ref, { terpakai: FieldValue.increment(1), uid, jenis }, { merge: true });
    return { boleh: true, sisa: sisa - 1 };
  });
}
