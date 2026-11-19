import type { MetadataRoute } from "next";

/** PWA: portal warga bisa "Tambahkan ke layar utama" — pengganti aplikasi Android. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ListrikSiberut · Portal Warga",
    short_name: "ListrikSiberut",
    description: "Jam Emas listrik surya, klaim poin BUMDes, dan tukar hadiah warga Pulau Siberut.",
    lang: "id",
    start_url: "/warga",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8FAFC",
    theme_color: "#16A34A",
    icons: [
      { src: "/logo-islandgrid.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
