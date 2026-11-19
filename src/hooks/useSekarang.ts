"use client";

import { useEffect, useState } from "react";

/** Waktu sekarang yang diperbarui berkala — render tetap murni (tanpa Date.now() di badan komponen). */
export function useSekarang(jedaMs = 30_000): number {
  const [sekarang, setSekarang] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setSekarang(Date.now()), jedaMs);
    return () => clearInterval(id);
  }, [jedaMs]);
  return sekarang;
}
