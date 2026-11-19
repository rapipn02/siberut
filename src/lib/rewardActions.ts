import {
  addDoc,
  collection,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { RewardCatalogItem } from "./types";

export async function saveInsentifPoin(poin: number) {
  await setDoc(
    doc(db, "settings", "notifikasi"),
    { poin_per_partisipasi: poin },
    { merge: true },
  );
}

export async function setAutoBroadcast(aktif: boolean) {
  await setDoc(
    doc(db, "settings", "notifikasi"),
    { auto_broadcast_aktif: aktif },
    { merge: true },
  );
}

export async function tambahHadiah(
  data: Omit<RewardCatalogItem, "id">,
): Promise<string> {
  const ref = await addDoc(collection(db, "reward_catalog"), data);
  return ref.id;
}

export async function ubahAktifHadiah(id: string, aktif: boolean) {
  await updateDoc(doc(db, "reward_catalog", id), { aktif });
}

export async function tambahVoucherMassal(
  rewardId: string,
  teksKode: string,
): Promise<number> {
  const kodeList = Array.from(
    new Set(
      teksKode
        .split(/\r?\n/)
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  );
  if (kodeList.length === 0) return 0;

  const POTONG = 400;
  for (let i = 0; i < kodeList.length; i += POTONG) {
    const batch = writeBatch(db);
    for (const code of kodeList.slice(i, i + POTONG)) {
      batch.set(doc(collection(db, "voucher_stock")), {
        reward_id: rewardId,
        code,
        is_used: false,
      });
    }
    await batch.commit();
  }
  return kodeList.length;
}
