# IslandGrid AI — Dashboard Operator

Dashboard operator BUMDes/PLTD Pulau Siberut, Mentawai. Memantau kesetimbangan
daya PLTS + PLTD, mengumumkan Jam Emas ke warga, memverifikasi bukti partisipasi,
dan mengelola poin serta hadiah.

Next.js 16 · React 19 · Firebase (Auth + Firestore) · Tailwind 4 · Recharts

---

## Menjalankan

```bash
git clone https://github.com/rapipn02/listriksiberut.git
cd listriksiberut
npm install
cp .env.example .env.local     # lalu isi nilainya, lihat tabel di bawah
npm run dev                    # http://localhost:3000
```

Firebase **wajib** dikonfigurasi — login memakai Firebase Auth, tidak ada mode
demo tanpa autentikasi.

### Isi `.env.local`

| Variabel | Diambil dari |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `MESSAGING_SENDER_ID`, `APP_ID` | Firebase Console → Project settings → General → Your apps |
| `GOOGLE_APPLICATION_CREDENTIALS` | Project settings → Service accounts → Generate new private key, simpan sebagai `serviceAccountKey.json` di folder ini (**jangan commit** — sudah di `.gitignore`) |
| `CRON_SECRET` | bebas, buat acak: `openssl rand -hex 32` |
| `ISLANDGRID_API_BASE_URL` | alamat layanan prediksi ML (opsional, boleh kosong saat pengembangan lokal) |

Sisanya sudah terisi nilai default di `.env.example`.

### Menyiapkan data + akun operator

```bash
npm run seed
```

> ⚠️ `npm run seed` **menimpa** poin warga, katalog hadiah, dan stok voucher.
> Pada database yang sedang dipakai, cukup jalankan `npm run seed:warga` —
> hanya membuat akun demo portal warga `warga@siberut.id` / `password123`.

Membuat akun operator (`admin@bumdes.id` / `teknisi@bumdes.id`, kata sandi
`password123`), warga contoh, katalog hadiah, stok voucher, sesi Jam Emas yang
sedang berjalan, dan beberapa pengajuan bukti foto untuk dicoba.

> Koleksi `power_forecasts` milik pipeline ML — seed sengaja melewatinya bila
> sudah berisi data, supaya tidak menimpa hasil tim ML yang sedang jalan.

### Verifikasi instalasi

```bash
npm test        # 101 unit test harus lolos
npx tsc --noEmit
npm run build
```

## Peran

Operator login di `/login`, warga di `/warga/masuk`. Kata sandi semua akun demo: `password123`.

| Akun | Peran | Bisa mengakses |
|---|---|---|
| `admin@bumdes.id` | Admin BUMDes | seluruh halaman |
| `teknisi@bumdes.id` | Teknisi PLTD | Dashboard, Kalkulator BBM, Notifikasi, Pengaturan, Bantuan |
| `warga@siberut.id` | Warga | portal warga `/warga` saja |

Akun warga dan operator saling terpisah: profil warga dibaca dari `users/{uid}`
(`role: "WARGA"`), operator dari `operators/{uid}`. Operator yang mencoba masuk
di portal warga ditolak, begitu juga sebaliknya.

Teknisi tidak melihat menu **Sesi Jam Emas**, **Verifikasi**, **Hadiah**, dan
**Manajemen Poin** — semua yang menyangkut poin dan uang hanya untuk Admin
BUMDes. Peran dibaca dari koleksi `operators/{uid}` di Firestore, bukan dari
klien, jadi tidak bisa dipalsukan lewat browser.

---

## Halaman

| Halaman | Isi |
|---|---|
| Dashboard | status grid, kurva kesetimbangan daya 24 jam, Jam Emas, cuaca, hitung mundur defisit |
| Kalkulator BBM | penghematan solar, biaya, dan emisi menurut tingkat kepatuhan warga |
| Notifikasi | kirim imbauan FCM ke warga + riwayat broadcast |
| Sesi Jam Emas | buat/ubah jadwal sesi; status berpindah otomatis UPCOMING → ACTIVE → ENDED |
| Verifikasi | bukti foto warga dinilai mesin aturan; operator bisa menimpa keputusannya |
| Hadiah | katalog hadiah, stok kode voucher, riwayat penukaran |
| Manajemen Poin | peringkat poin warga |

### Portal warga (`/warga`) — pengganti aplikasi Android ListrikSiberut

Tampilan mobile-first (kolom HP, navigasi bawah), bisa dibuka dari browser HP maupun laptop.

| Halaman | Isi |
|---|---|
| `/warga/masuk`, `/warga/daftar` | masuk / daftar akun warga (email + kata sandi) |
| `/warga` Beranda | status grid saat ini, Jam Emas hari ini, daftar sesi, saldo poin, imbauan BUMDes |
| `/warga/sesi/[id]` | detail sesi; foto alat dari kamera/galeri, dikompres di browser (≤ 700 KB total, maks 3 foto), dikirim ke `participation_requests` |
| `/warga/analitik` | kurva beban vs surya 24/48 jam, kondisi jam ini, countdown surplus |
| `/warga/hadiah` | katalog + stok, tukar poin lewat `POST /api/redeem`, kode token tampil di layar |
| `/warga/profil` | data diri, statistik kontribusi, riwayat partisipasi & penukaran, izin notifikasi, keluar |

Notifikasi muncul sebagai toast di halaman (dan notifikasi sistem bila diizinkan)
**selama portal terbuka** — imbauan baru dan sesi Jam Emas yang mulai berjalan.
Notifikasi saat tab tertutup butuh Web Push (belum dibuat).

---

