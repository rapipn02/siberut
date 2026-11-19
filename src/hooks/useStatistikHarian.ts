"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { kunciTanggalWib } from "@/lib/waktu";
import type { StatHarian } from "@/lib/statistikIklim";

export type KeadaanStatistik =
  | { tahap: "memuat" }
  | { tahap: "galat"; pesan: string }
  | { tahap: "siap"; harian: StatHarian[] };

/** `statistik_harian` N hari terakhir (WIB), urut naik, realtime. */
export function useStatistikHarian(hari: number): KeadaanStatistik {
  const [keadaan, setKeadaan] = useState<KeadaanStatistik>({ tahap: "memuat" });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const dari = kunciTanggalWib(new Date(Date.now() - (hari - 1) * 86_400_000));
    return onSnapshot(
      query(collection(db, "statistik_harian"), where("tanggal", ">=", dari), orderBy("tanggal", "asc")),
      (snap) => setKeadaan({ tahap: "siap", harian: snap.docs.map((d) => d.data() as StatHarian) }),
      (err) => setKeadaan({ tahap: "galat", pesan: err.message }),
    );
  }, [hari]);

  return keadaan;
}
