# DESIGN.md · ListrikSiberut

Arah desain untuk halaman publik. Halaman depan `/` saat ini dinonaktifkan (langsung ke `/login`);
arah ini dipakai lagi bila halaman publik dibuat kembali. Dashboard
operator boleh tetap memakai brand hijau yang ada, tetapi memakai aturan isi yang sama.

## Identitas

Program hemat listrik desa di Pulau Siberut, Mentawai. Suaranya suara BUMDes dan warga:
lugas, hangat, berbicara tentang pompa air, mesin es, solar, dan matahari. Bukan startup,
bukan "platform AI". Teknologi disebut bila menjelaskan apa yang terjadi, bukan untuk pamer.

## Dial

`Dial: ENERGY 2 / RHYTHM 2 / MOTION 1`

- ENERGY 2: menyapa dengan jelas lewat satu judul serif besar dan peta pulau; selebihnya tenang.
- RHYTHM 2: bagian konsisten, dengan beberapa pemecah (peta di pembuka, grafik lebar, tabel AI).
- MOTION 1: hanya hover/focus. Tidak ada animasi masuk, tidak ada pulsa berulang.

## Palet (semua pasangan teks lolos WCAG AA, dicek `contrast-check.py`)

| Peran | Warna | Alasan |
|---|---|---|
| Latar (pasir) | `#F4EEE1` | warna pasir pantai Siberut; hangat, tidak putih steril |
| Inti 1 · laut dalam | `#0F4C5C` | teks penting, tombol utama; laut yang mengelilingi microgrid terisolasi |
| Inti 2 · hutan | `#2E6B3F` | surplus surya, aksi positif, energi bersih |
| Aksen · matahari | `#E3A33B` | **hanya** untuk Jam Emas (pita di grafik, label Jam Emas). Satu-satunya aksen |
| Status · tanah | `#9A4A2B` | defisit/solar; warna data, bukan dekorasi |
| Tinta | `#1C2A2E` | teks isi |
| Teks sekunder | `#5B6B6E` | keterangan (4,81:1 di pasir) |

Rasio terukur: tinta/pasir 12,79 · laut/pasir 8,22 · hutan/pasir 5,52 · tanah/pasir 5,36 ·
sekunder/pasir 4,81 · putih/laut 9,51 · putih/hutan 6,38 · tinta/matahari 6,74.

## Tipografi

- Judul: **Fraunces** (serif humanis). Alasan: nada cerita komunitas dan papan pengumuman desa,
  membedakan halaman publik dari dashboard teknis.
- Isi: **Inter**. Alasan: sudah dipakai di dashboard dan portal warga; terbaca di layar HP murah.
- Tanpa huruf kapital semua dengan tracking lebar. Label kecil memakai sentence case.

## Motif identitas

Garis pantai Pulau Siberut (Natural Earth, domain publik) dan pita Jam Emas berwarna matahari
yang muncul di peta, grafik, dan label. Itulah satu gestur yang diulang.

## Bentuk

- Radius: 6px untuk kontrol, 12px untuk panel. Tidak ada tombol/kartu pil.
- Bayangan: tidak dipakai di halaman publik; pemisahan memakai garis 1px dan ruang kosong.
- Tidak ada gradasi, orb blur, grid latar, glow, ikon sparkle/✦, emoji, eyebrow badge.

## Isi

- Angka hanya dari sistem (API) atau dari sumber yang disebut. Bila data kosong, tulis kosong.
- Tanpa em dash. Tanpa buzzword ("berbasis AI", "revolusioner", "canggih").
- Tombol menyebut tindakannya: "Masuk sebagai warga", "Masuk dashboard operator".
