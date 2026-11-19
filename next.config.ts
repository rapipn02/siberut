import type { NextConfig } from "next";

/** Halaman operator dulu di root (/sesi, /poin, …) — kini di /operator/*. Tautan lama tetap jalan. */
const HALAMAN_OPERATOR = [
  "kalkulator-bbm",
  "notifikasi",
  "sesi",
  "verifikasi",
  "hadiah",
  "poin",
  "pengaturan",
  "bantuan",
];

const nextConfig: NextConfig = {
  // Standalone build untuk deploy VPS (jalan via `node .next/standalone/server.js`).
  output: "standalone",
  async redirects() {
    return HALAMAN_OPERATOR.map((h) => ({
      source: `/${h}`,
      destination: `/operator/${h}`,
      permanent: false,
    }));
  },
};

export default nextConfig;
