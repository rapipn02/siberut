"use client";

import { useEffect } from "react";
import { fetchBertoken } from "@/lib/apiKlien";

// Server tetap membatasi sekali per 4 menit untuk semua tab (lihat jadwalServer).
const JEDA_MS = 5 * 60_000;

export function useSessionTick() {
  useEffect(() => {
    const jalankan = () => {
      if (document.hidden) return;
      fetchBertoken("/api/sessions/tick", { method: "POST" }).catch(() => {});
    };
    const awal = setTimeout(jalankan, 0);
    const id = setInterval(jalankan, JEDA_MS);
    return () => {
      clearTimeout(awal);
      clearInterval(id);
    };
  }, []);
}

const JEDA_PRAKIRAAN_MS = 15 * 60_000;

export function useForecastRefresh() {
  useEffect(() => {
    const jalankan = () => {
      if (document.hidden) return;
      fetchBertoken("/api/forecast/refresh?otomatis=1", { method: "POST" }).catch(() => {});
    };
    const awal = setTimeout(jalankan, 0);
    const id = setInterval(jalankan, JEDA_PRAKIRAAN_MS);
    return () => {
      clearTimeout(awal);
      clearInterval(id);
    };
  }, []);
}
