"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

export type IzinNotifikasi = NotificationPermission | "tidak-didukung";

function bacaIzin(): IzinNotifikasi {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "tidak-didukung";
}

/** Izin notifikasi sistem + tombol meminta izin (dipakai halaman Profil). */
export function useIzinNotifikasi() {
  const [izin, setIzin] = useState<IzinNotifikasi>("default");

  useEffect(() => {
    // Baca setelah mount — `Notification` tidak ada saat render server.
    const t = setTimeout(() => setIzin(bacaIzin()), 0);
    return () => clearTimeout(t);
  }, []);

  const minta = useCallback(async () => {
    if (bacaIzin() === "tidak-didukung") return;
    setIzin(await Notification.requestPermission());
  }, []);

  return { izin, minta };
}

export interface Pemberitahuan {
  judul: string;
  isi: string;
}

/**
 * Pengganti NotificationService Android: dengarkan imbauan baru dan sesi
 * Jam Emas yang mulai berjalan selama portal terbuka. Selalu tampil sebagai
 * toast di dalam halaman; notifikasi sistem bila izin diberikan.
 * ponytail: hanya selama tab terbuka — tab tertutup butuh Web Push (service worker + VAPID).
 */
export function useNotifikasiWarga() {
  const [toast, setToast] = useState<Pemberitahuan | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const kabari = (p: Pemberitahuan) => {
      setToast(p);
      if (bacaIzin() !== "granted") return;
      try {
        new Notification(p.judul, { body: p.isi, icon: "/logo-islandgrid.png" });
      } catch {
        // Chrome Android menolak konstruktor Notification di luar service worker;
        // toast di dalam halaman sudah cukup.
      }
    };

    const lepasImbauan = onSnapshot(
      query(
        collection(db, "broadcast_notifications"),
        where("timestamp", ">", Timestamp.now()),
      ),
      (snap) => {
        for (const c of snap.docChanges()) {
          if (c.type !== "added") continue;
          const v = c.doc.data();
          kabari({ judul: v.title || "Info Baru", isi: v.message ?? "" });
        }
      },
      () => {},
    );

    // Snapshot pertama = sesi yang sudah berjalan sebelum halaman dibuka → abaikan.
    let awal = true;
    const lepasSesi = onSnapshot(
      query(collection(db, "load_shift_sessions"), where("status", "==", "ACTIVE")),
      (snap) => {
        if (awal) {
          awal = false;
          return;
        }
        for (const c of snap.docChanges()) {
          if (c.type !== "added") continue;
          const v = c.doc.data();
          kabari({
            judul: "Jam Emas Dimulai! ☀️",
            isi: `Listrik surya melimpah (${v.startTime}–${v.endTime} WIB). Nyalakan pompa/setrika sekarang dan klaim poin.`,
          });
        }
      },
      () => {},
    );

    return () => {
      lepasImbauan();
      lepasSesi();
    };
  }, []);

  const tutup = useCallback(() => setToast(null), []);
  return { toast, tutup };
}
