"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { urutTerbaru } from "@/lib/warga";
import type { ParticipationRequest, RedemptionHistoryItem } from "@/lib/types";
import type { AlatWarga } from "@/lib/alatWarga";

/** Saldo poin warga. Dokumen belum ada (warga baru) → 0. */
export function useSaldo(uid: string | undefined) {
  const [poin, setPoin] = useState(0);
  const [loading, setLoading] = useState(Boolean(uid) && isFirebaseConfigured);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) return;
    return onSnapshot(
      doc(db, "BUMDes_rewards", uid),
      (snap) => {
        const nilai = snap.data()?.total_poin;
        setPoin(typeof nilai === "number" ? nilai : 0);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { poin, loading };
}

const MAKS_RIWAYAT = 20;

/**
 * Dokumen milik warga, terbaru dulu, maks 20 — `participation_requests` membawa
 * foto Base64 (s.d. ~0,9 MB/dokumen), jadi jangan unduh semuanya.
 * Butuh composite index (lihat firestore.indexes.json). Selama index belum
 * dibuat, Firestore menolak query → kembali ke query tanpa urutan/batas.
 * Filter `where` wajib ada: rules hanya mengizinkan warga membaca miliknya.
 */
function useMilikSaya<T extends { id: string }>(
  koleksi: string,
  fieldPemilik: string,
  uid: string | undefined,
  waktu: (item: T) => { toMillis(): number } | null | undefined,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(uid) && isFirebaseConfigured);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) return;
    const milik = where(fieldPemilik, "==", uid);
    let lepas: () => void = () => {};

    const dengar = (terbatas: boolean) => {
      lepas = onSnapshot(
        terbatas
          ? query(collection(db, koleksi), milik, orderBy("timestamp", "desc"), limit(MAKS_RIWAYAT))
          : query(collection(db, koleksi), milik),
        (snap) => {
          const data = snap.docs.map(
            (d) =>
              ({
                id: d.id,
                ...d.data({ serverTimestamps: "estimate" }),
              }) as T,
          );
          setItems(urutTerbaru(data, waktu).slice(0, MAKS_RIWAYAT));
          setLoading(false);
        },
        (err) => {
          if (terbatas && err.code === "failed-precondition") {
            console.warn(`Index ${koleksi} (${fieldPemilik}, timestamp desc) belum dibuat.`);
            dengar(false);
            return;
          }
          setLoading(false);
        },
      );
    };
    dengar(true);
    return () => lepas();
    // `waktu` dianggap stabil (fungsi modul), tidak masuk dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [koleksi, fieldPemilik, uid]);

  return { items, loading };
}

const waktuPengajuan = (p: ParticipationRequest) => p.timestamp;
const waktuTukar = (r: RedemptionHistoryItem) => r.timestamp;

export function useRiwayatKontribusi(uid: string | undefined) {
  return useMilikSaya<ParticipationRequest>(
    "participation_requests",
    "userId",
    uid,
    waktuPengajuan,
  );
}

export function useRiwayatTukar(uid: string | undefined) {
  return useMilikSaya<RedemptionHistoryItem>(
    "redemption_history",
    "user_id",
    uid,
    waktuTukar,
  );
}

/** Stok per hadiah dari server (`GET /api/stok-hadiah`) — tanpa kode voucher. */
export function useStokHadiah() {
  const [stok, setStok] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    let batal = false;
    fetch("/api/stok-hadiah", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!batal && d?.ok) setStok(d.stok ?? {});
      })
      .catch(() => {})
      .finally(() => {
        if (!batal) setLoading(false);
      });
    return () => {
      batal = true;
    };
  }, [versi]);

  const muatUlang = useCallback(() => setVersi((v) => v + 1), []);
  return { stok, loading, muatUlang };
}

/** Daftar "Alat Saya" milik warga (`users/{uid}/alat`). */
export function useAlatSaya(uid: string | undefined) {
  const [items, setItems] = useState<AlatWarga[]>([]);
  const [loading, setLoading] = useState(Boolean(uid) && isFirebaseConfigured);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) return;
    return onSnapshot(
      collection(db, "users", uid, "alat"),
      (snap) => {
        setItems(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AlatWarga, "id">) }))
            .sort((a, b) => b.watt - a.watt),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { items, loading };
}
