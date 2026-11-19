# ListrikSiberut · IslandGrid AI

[![CI](https://github.com/rapipn02/siberut/actions/workflows/ci.yml/badge.svg)](https://github.com/rapipn02/siberut/actions/workflows/ci.yml)

Aplikasi web hemat listrik untuk microgrid Pulau Siberut, Mentawai (PLTS 75 kWp, PLTD 50 kW, 327 KK).
Model ML memprakirakan kapan listrik surya melimpah, warga menggeser pemakaian alat berat ke **Jam Emas**,
dan setiap aksi yang terverifikasi mendapat poin BUMDes. Dibuat untuk IT RUSH 2026, subtema Smart Small Island.

| Halaman | Pengguna | Isi |
|---|---|---|
| `/warga` | warga (HP atau laptop) | Jam Emas, kirim foto bukti, poin dan hadiah, Alat Saya, asisten Surya |
| `/operator` | Admin BUMDes, Teknisi PLTD | pemantauan grid, briefing AI, Dampak Iklim, verifikasi, broadcast, hadiah |

Teknologi: Next.js 16, React 19, Firebase (Auth, Firestore, FCM), Tailwind 4, Recharts, Gemini API.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi Firebase, service account, CRON_SECRET, LLM_*
npm run dev                  # http://localhost:3000
npm test                     # unit test
```

Akun demo (kata sandi `password123`): `admin@bumdes.id`, `teknisi@bumdes.id`, `warga@siberut.id`.
Panduan deploy ada di `DEPLOY.md`.

## Penggunaan template, library, aset, layanan, dan AI

Sesuai ketentuan IT RUSH 2026, semua template, library, aset open-source, layanan, dan AI coding assistant
yang dipakai dicantumkan di bawah ini dan di proposal.

### Template

| Nama | Dipakai untuk | Lisensi |
|---|---|---|
| `create-next-app` (Vercel) | kerangka awal proyek Next.js (konfigurasi TypeScript, ESLint, Tailwind). Berkas contoh bawaan di `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) tidak dipakai di halaman. | MIT |

Tidak memakai template UI atau dashboard siap pakai. Tampilan disusun tim, dengan rancangan website tim sebagai acuan portal warga.

### Library

| Library | Versi | Dipakai untuk | Lisensi |
|---|---|---|---|
| next | 16.2.12 | framework web (App Router, API route) | MIT |
| react, react-dom | 19.2.4 | antarmuka | MIT |
| firebase | 12.x | Auth, Firestore, Messaging di browser | Apache-2.0 |
| firebase-admin | 14.x | Firestore, Auth, FCM di server | Apache-2.0 |
| recharts | 3.x | grafik beban vs surya, Dampak Iklim | MIT |
| @opentelemetry/api | 1.9.x | dependensi instrumentasi Next.js | Apache-2.0 |
| tailwindcss, @tailwindcss/postcss | 4.x | styling | MIT |
| typescript | 5.x | bahasa | Apache-2.0 |
| vitest | 4.x | unit test | MIT |
| eslint, eslint-config-next | 9.x / 16.2.12 | linting | MIT |
| tsx | 4.x | menjalankan skrip seed | MIT |
| dotenv | 17.x | memuat `.env` pada skrip | BSD-2-Clause |
| @types/node, @types/react, @types/react-dom | sesuai `package.json` | tipe TypeScript | MIT |

Layanan ML (repo terpisah, [zhhraid/islandgrid-ai-ml](https://github.com/zhhraid/islandgrid-ai-ml)) memakai antara lain FastAPI dan XGBoost; daftar lengkapnya ada di README repo tersebut.

### Aset

| Aset | Sumber | Lisensi |
|---|---|---|
| Font Inter | Google Fonts, dimuat lewat `next/font` | SIL Open Font License 1.1 |
| Ikon di `src/components/icons.tsx` | jalur SVG diadaptasi dari [Lucide](https://lucide.dev) (turunan Feather Icons) | ISC (Lucide), MIT (Feather) |
| Logo `public/logo-islandgrid.png` | [ISI: dibuat tim / sumber lain] | [ISI] |

### Layanan dan data eksternal

| Layanan | Dipakai untuk | Ketentuan |
|---|---|---|
| Firebase (Google) | basis data, autentikasi, notifikasi push | Firebase Terms of Service |
| Google Gemini API (`gemini-3.5-flash-lite`) | fitur AI di dalam aplikasi: Mata AI (cek foto bukti), Analis AI (briefing operator), Pindai Label, asisten Surya | Gemini API Additional Terms |
| Open-Meteo | data cuaca (radiasi, tutupan awan, suhu) untuk model ML | data CC BY 4.0, wajib atribusi: *Weather data by [Open-Meteo.com](https://open-meteo.com/)* |

### AI coding assistant dan alat bantu AI

| Alat | Bagian karya yang dibantu | Cara pemakaian |
|---|---|---|
| Claude (Claude Code, Anthropic) | perbaikan keamanan API dan aturan Firestore; statistik Dampak Iklim; tata letak responsif; unit test; analisis kinerja dan pemakaian token; panduan deploy; draf naskah revisi proposal, diagram arsitektur, dan tangkapan layar dokumentasi | asisten pemrograman di editor dengan instruksi dari tim per tugas. Kebutuhan, alur, desain, dan keputusan akhir ditentukan tim. Semua kode ditinjau dan diuji tim (unit test, typecheck, lint, build) sebelum diterapkan. |
| [ISI: AI lain yang dipakai anggota tim, misalnya untuk riset atau slide] | [ISI] | [ISI] |

Gemini pada tabel layanan adalah **bagian dari produk** (dipanggil aplikasi saat berjalan), bukan alat bantu pembuatan. Model prakiraan PLTS (XGBoost) dilatih sendiri oleh tim ML.


