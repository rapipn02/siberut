# Portal Warga Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan seluruh fungsi aplikasi Android warga (ListrikSiberut, repo `javamaulana/IslandGrid-AI---Mobile`) ke web, di app Next.js yang sama dengan dashboard operator, rute `/warga`.

**Architecture:** Route group baru di `src/app/warga/`. Login warga terpisah dari operator: Firebase Auth yang sama, tapi profil dibaca dari `users/{uid}` (bukan `operators/{uid}`). Semua data dibaca langsung dari Firestore lewat hook `onSnapshot` (pola yang sudah ada). Penukaran hadiah lewat `POST /api/redeem` (sudah ada, server-side). Notifikasi = listener Firestore + `Notification` API browser selama tab terbuka.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Firebase JS SDK 12, Tailwind 4, Recharts, Vitest.

**Spec:** Bagian "Desain" di bawah (disepakati di percakapan 2026-11-19: alasan migrasi = lomba web, tidak boleh mobile).

## Desain

**Kenapa:** tim ikut lomba kategori web; aplikasi warga Android tidak boleh dipakai. Seluruh alur warga harus bisa didemokan di browser (HP maupun laptop).

**Fitur yang dipindah (paritas dengan `WargaHomeScreen.kt`):**

| Mobile | Web |
|---|---|
| Login + Daftar (email/sandi, `users/{uid}`) | `/warga/masuk`, `/warga/daftar` |
| Beranda: sapaan, saldo poin, status grid, Jam Emas, daftar sesi | `/warga` |
| Detail sesi + unggah foto bukti → `participation_requests` | `/warga/sesi/[id]` |
| Analitik: kurva beban vs surya | `/warga/analitik` |
| Hadiah: katalog, stok, tukar poin, tampil kode | `/warga/hadiah` |
| Profil: data diri, riwayat kontribusi, logout | `/warga/profil` |
| NotificationService (listener Firestore) | hook notifikasi browser |

**Sengaja tidak dibawa:** "Login Demo Warga" tanpa autentikasi (diganti akun demo asli dari seed), konsol debug, Web Push saat tab tertutup (butuh service worker + VAPID; tambah bila juri menuntut).

**Keputusan:**
- Tampilan mobile-first: kolom `max-w-md` di tengah, navigasi bawah 4 tab (Beranda, Analitik, Hadiah, Profil). Di laptop tetap kolom HP di tengah.
- Kirim bukti hanya bila sesi `ACTIVE` **dan** `startAt ≤ sekarang ≤ endAt`. `timestamp` pakai `serverTimestamp()` supaya jam HP warga tidak bisa dimanipulasi.
- Foto dikompres di browser (canvas → JPEG, sisi terpanjang 1024 px), total semua foto ≤ 700 KB (batas `context.md`). Maks 3 foto.
- Penukaran lewat `/api/redeem` dengan Firebase ID token — warga tidak perlu menulis `voucher_stock` sendiri.
- Saat verifikasi menyetujui, route `verify-participation` mengisi `nama_warga` + `user_id` di `BUMDes_rewards` (merge) supaya peringkat poin operator menampilkan nama.

## Global Constraints

- Tidak menambah dependency baru.
- Nama koleksi/field Firestore persis seperti `context.md` (camelCase untuk koleksi mobile, snake_case untuk ML/web). Jangan diseragamkan.
- `participation_requests` dibuat dengan: `userId`, `userName`, `timestamp`, `goldenHourRange` (`"HH:MM-HH:MM"`), `photosBase64` (Base64 mentah tanpa prefix `data:`), `status: "PENDING"`.
- Teks UI berbahasa Indonesia; warna pakai token `brand-*` dari `globals.css`.
- Halaman operator yang sudah ada tidak boleh berubah perilaku, kecuali tautan "Masuk sebagai warga" di `/login`.
- Kerja di branch `feat/portal-warga` (repo `web/`).

## Review Focus

1. Akun operator login di `/warga/masuk` → ditolak dengan pesan "Akun ini bukan akun warga", lalu sign-out. (Task 3)
2. Sesi `ACTIVE` di Firestore tapi `endAt` sudah lewat (cron telat) → tombol kirim mati. (Task 1, test `statusKirimBukti`)
3. Foto besar (5 MB) → tetap terkirim karena dikompres; bila total setelah kompres > 700 KB → ditolak dengan pesan jelas, bukan error Firestore. (Task 2, test `muatBatas`)
4. Warga baru tanpa dokumen `BUMDes_rewards` → saldo tampil 0, tombol tukar mati, tidak crash. (Task 4)
5. Klik "Tukar" dua kali cepat → hanya satu permintaan (tombol dikunci saat `busy`). (Task 6)

---

### Task 1: Logika murni warga

**Files:**
- Create: `src/lib/warga.ts`
- Test: `src/lib/warga.test.ts`

**Interfaces:**
- Consumes: `LoadShiftSession` dari `src/lib/types.ts`
- Produces:
  - `statusKirimBukti(sesi: LoadShiftSession, sekarangMs: number): { boleh: boolean; alasan: string }`
  - `urutSesiWarga(sesi: LoadShiftSession[]): LoadShiftSession[]` — ACTIVE dulu, lalu UPCOMING (mulai terdekat dulu), lalu ENDED (terbaru dulu); urutan pakai `startAt.toMillis()`.

- [ ] **Step 1: Tulis test gagal** — `warga.test.ts`, buat sesi palsu dengan `startAt/endAt` berupa `{ toMillis: () => n }` (cast `as unknown as Timestamp`):
  - `statusKirimBukti` ACTIVE & dalam rentang → `{ boleh: true }`
  - ACTIVE tapi `sekarangMs > endAt` → `boleh: false`, `alasan` berisi `"berakhir"`
  - UPCOMING → `boleh: false`, `alasan` berisi jam `startTime` (mis. `"10:00"`)
  - ENDED → `boleh: false`, `alasan` berisi `"berakhir"`
  - tanpa `startAt/endAt` → `boleh: false`
  - `urutSesiWarga([ended, upcoming2, active, upcoming1])` → `[active, upcoming1, upcoming2, ended]`
- [ ] **Step 2:** `npx vitest run src/lib/warga.test.ts` → FAIL (modul tidak ada)
- [ ] **Step 3:** Implementasi di `src/lib/warga.ts`. Alasan teks: `"Sesi dibuka pukul {startTime} WIB."`, `"Sesi sudah berakhir."`, `"Jadwal sesi tidak lengkap."`, `""` bila boleh.
- [ ] **Step 4:** `npx vitest run src/lib/warga.test.ts` → PASS
- [ ] **Step 5:** Commit `feat(warga): logika status kirim bukti & urutan sesi`

### Task 2: Kompres foto di browser

**Files:**
- Create: `src/lib/kompresFoto.ts`
- Test: `src/lib/kompresFoto.test.ts`

**Interfaces:**
- Consumes: `ukuranKb(b64: string): number` dari `src/lib/photo.ts`
- Produces:
  - `ukuranTarget(lebar: number, tinggi: number, maks = 1024): { lebar: number; tinggi: number }` — skala proporsional, tidak pernah membesarkan.
  - `muatBatas(fotos: string[], batasKb = 700): boolean`
  - `kompresFoto(file: File): Promise<string>` — Base64 mentah JPEG kualitas 0.6 (tanpa prefix). Pakai `createImageBitmap` + `<canvas>`; `canvas.toDataURL("image/jpeg", 0.6).split(",")[1]`.
  - `BATAS_FOTO_KB = 700`, `MAKS_FOTO = 3`

- [ ] **Step 1: Test gagal:**
  - `ukuranTarget(4000, 3000)` → `{ lebar: 1024, tinggi: 768 }`
  - `ukuranTarget(3000, 4000)` → `{ lebar: 768, tinggi: 1024 }`
  - `ukuranTarget(800, 600)` → `{ lebar: 800, tinggi: 600 }`
  - `muatBatas(["A".repeat(800 * 1024 * 4 / 3)])` → `false`; `muatBatas(["/9j/AAAA"])` → `true`
- [ ] **Step 2:** `npx vitest run src/lib/kompresFoto.test.ts` → FAIL
- [ ] **Step 3:** Implementasi. `kompresFoto` tidak diuji unit (butuh DOM) — diverifikasi manual di Task 5.
- [ ] **Step 4:** test → PASS
- [ ] **Step 5:** Commit `feat(warga): kompres foto bukti di browser`

### Task 3: Autentikasi warga + kerangka layout

**Files:**
- Create: `src/lib/wargaAuth.ts`, `src/components/WargaAuthProvider.tsx`, `src/components/WargaNav.tsx`
- Create: `src/app/warga/layout.tsx` (bungkus `WargaAuthProvider`, kolom `max-w-md`)
- Create: `src/app/warga/(akun)/masuk/page.tsx`, `src/app/warga/(akun)/daftar/page.tsx`
- Create: `src/app/warga/(app)/layout.tsx` (guard: belum login → `/warga/masuk`; render `WargaNav` di bawah)
- Create: `src/app/warga/(app)/page.tsx` (placeholder "Halo, {nama}" — diisi Task 5)
- Modify: `src/app/login/page.tsx` — tautan "Warga? Masuk di sini →" ke `/warga/masuk`
- Modify: `firestore.rules` dan `../firestore.rules` — `match /users/{uid}`: `create, update` tambah syarat `request.resource.data.role == 'WARGA'`

**Interfaces:**
- Consumes: `auth`, `db`, `isFirebaseConfigured` dari `src/lib/firebase.ts`; `AppUser` dari `src/lib/types.ts`
- Produces:
  - `loginWarga(email: string, sandi: string): Promise<AppUser>` — sign-in, baca `users/{uid}`; tidak ada / `role !== "WARGA"` → `signOut` lalu throw `Error("Akun ini bukan akun warga.")`
  - `daftarWarga(d: { nama: string; email: string; sandi: string; phone: string }): Promise<AppUser>` — `createUserWithEmailAndPassword` + `setDoc(users/{uid}, { uid, nama, email, phone, role: "WARGA" })`. Validasi: nama tidak kosong, sandi ≥ 6.
  - `useWarga(): { warga: AppUser | null; loading: boolean; masuk: typeof loginWarga; daftar: typeof daftarWarga; keluar: () => Promise<void> }`
  - Pesan error Firebase: salin `pesanRamah` dari `src/app/login/page.tsx` ke `src/lib/pesanAuth.ts` (export `pesanRamah(err: unknown): string`), tambah `auth/email-already-in-use` → `"Email sudah terdaftar."` dan `auth/weak-password` → `"Kata sandi minimal 6 karakter."`; halaman operator ikut memakai versi baru.
  - `WargaNav`: 4 tautan `/warga`, `/warga/analitik`, `/warga/hadiah`, `/warga/profil`, ikon dari `src/components/icons.tsx` (Grid, ArrowUpRight, Gift, Users), aktif = `usePathname()`.

- [ ] **Step 1:** Implementasi file di atas. Halaman masuk menampilkan kotak akun demo `warga@siberut.id` / `password123` (pola sama seperti `AKUN` di login operator).
- [ ] **Step 2:** `npx tsc --noEmit` → bersih; `npm test` → semua lolos
- [ ] **Step 3: Verifikasi manual** (`npm run dev`): daftar akun baru → masuk ke `/warga`; logout; masuk dengan `admin@bumdes.id` di `/warga/masuk` → pesan "Akun ini bukan akun warga."; buka `/warga` tanpa login → dialihkan ke `/warga/masuk`.
- [ ] **Step 4:** Commit `feat(warga): login, daftar, dan kerangka portal warga`

### Task 4: Hook data warga

**Files:**
- Create: `src/hooks/useWargaData.ts`

**Interfaces:**
- Consumes: `db`, `isFirebaseConfigured`; tipe `BUMDesReward`, `ParticipationRequest`, `RedemptionHistoryItem`
- Produces:
  - `useSaldo(uid: string | undefined): { poin: number; loading: boolean }` — `onSnapshot(BUMDes_rewards/{uid})`; dokumen tidak ada → `poin: 0`
  - `useRiwayatKontribusi(uid): { items: ParticipationRequest[]; loading: boolean }` — `where("userId","==",uid)` **tanpa** `orderBy` (hindari composite index), urutkan di klien `timestamp` desc; `timestamp` null (pending tulis) dianggap terbaru.
  - `useRiwayatTukar(uid): { items: RedemptionHistoryItem[]; loading: boolean }` — `where("user_id","==",uid)`, urut klien desc.
- Data lain pakai hook yang sudah ada: `useSystemStatus`, `usePowerForecasts`, `useSessions`, `useBroadcasts`, `useRewardCatalog`, `useVouchers`.

- [ ] **Step 1:** Implementasi.
- [ ] **Step 2:** `npx tsc --noEmit` → bersih
- [ ] **Step 3:** Commit `feat(warga): hook saldo & riwayat warga`

### Task 5: Beranda + detail sesi + kirim bukti

**Files:**
- Modify: `src/app/warga/(app)/page.tsx`
- Create: `src/app/warga/(app)/sesi/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 1 (`statusKirimBukti`, `urutSesiWarga`), Task 2 (`kompresFoto`, `muatBatas`, `MAKS_FOTO`), Task 3 (`useWarga`), Task 4 (`useSaldo`, `useRiwayatKontribusi`), `useSystemStatus`, `usePowerForecasts`, `findGreenWindow`, `tampilanStatus`, `useSessions`, `useBroadcasts`, `dataUrlFoto`

- [ ] **Step 1: Beranda** — urutan kartu: sapaan `Halo, {nama}`; kartu saldo poin; kartu status grid (warna dari `tampilanStatus(status.current_status)`, teks pesan untuk warga); kartu Jam Emas (`findGreenWindow(points)` atau `golden_hour_start/end` dari `system_status` bila tidak ada); daftar sesi `urutSesiWarga(items)` sebagai tautan ke `/warga/sesi/{id}` dengan pill status; 3 imbauan terbaru dari `useBroadcasts(3)`.
- [ ] **Step 2: Detail sesi** — cari sesi dari `useSessions()` berdasarkan `params.id`; tampilkan tanggal, jam, beban saat ini (`currentLoadKw`), kapasitas surya (`capacityKw`), peserta, poin per partisipasi. Bila `statusKirimBukti(...).boleh`: `<input type="file" accept="image/*" capture="environment" multiple>`, kompres tiap file, pratinjau thumbnail (bisa dihapus), maks `MAKS_FOTO`; tombol "Klaim Poin Jam Emas" mati bila 0 foto, `!muatBatas`, atau sedang kirim. Kirim: `addDoc(participation_requests, { userId, userName, timestamp: serverTimestamp(), goldenHourRange: \`${startTime}-${endTime}\`, photosBase64, status: "PENDING" })` → pesan "Bukti terkirim. Poin masuk setelah diverifikasi (±5 menit)." Bila tidak boleh: tampilkan `alasan`. Bila warga sudah punya pengajuan APPROVED dengan `windowId === sesi.id` (dari `useRiwayatKontribusi`): tampilkan "Poin sesi ini sudah Anda terima." dan sembunyikan form.
- [ ] **Step 3:** `npx tsc --noEmit` bersih; `npm run lint` tanpa error baru
- [ ] **Step 4: Verifikasi manual:** dengan sesi ACTIVE dari seed, unggah foto HP besar → terkirim, dokumen muncul di halaman Verifikasi operator dengan thumbnail benar; jalankan verifikasi dari halaman operator → saldo di beranda warga bertambah tanpa reload.
- [ ] **Step 5:** Commit `feat(warga): beranda, detail sesi, kirim bukti foto`

### Task 6: Analitik + Hadiah

**Files:**
- Create: `src/app/warga/(app)/analitik/page.tsx`
- Create: `src/app/warga/(app)/hadiah/page.tsx`

**Interfaces:**
- Consumes: `PowerBalanceChart` (`points`, `pltdLimit`), `KartuWaktuGrid` dari `src/components/Countdown.tsx` (prop `titik`, bentuk sama seperti di `src/app/(dashboard)/page.tsx`), `useRewardCatalog`, `useVouchers().stok`, `useSaldo`, `auth.currentUser.getIdToken()`

- [ ] **Step 1: Analitik** — judul "Kurva Kesetimbangan Daya", `PowerBalanceChart` (`pltdLimit = status.total_pltd_capacity_kw ?? 50`), 3 metrik kecil (beban puncak, surya puncak, jam defisit = jumlah `deficit`), `KartuWaktuGrid`, catatan kecil "Prediksi per jam, diperbarui tiap 3 jam."
- [ ] **Step 2: Hadiah** — saldo di atas; daftar katalog `aktif !== false`, tiap item: nama, deskripsi, `pointsRequired`, stok tersedia (`stok[id]?.tersedia ?? 0`), tombol "Tukar" mati bila poin kurang / stok 0 / `busy`. Klik → konfirmasi `"Tukar {n} poin dengan {nama}?"` → `fetch("/api/redeem", { method: "POST", headers: { Authorization: \`Bearer ${token}\`, "Content-Type": "application/json" }, body: JSON.stringify({ catalog_id }) })`. Sukses → tampilkan kode besar + tombol salin (`navigator.clipboard.writeText`) + teks "Masukkan ke meteran listrik di rumah." Gagal → tampilkan `error` dari respons.
- [ ] **Step 3:** `npx tsc --noEmit` bersih
- [ ] **Step 4: Verifikasi manual:** akun demo 150 poin tukar "Token Listrik 20rb" → kode tampil, saldo berkurang, stok berkurang di halaman Hadiah operator.
- [ ] **Step 5:** Commit `feat(warga): analitik dan penukaran hadiah`

### Task 7: Profil + notifikasi browser

**Files:**
- Create: `src/app/warga/(app)/profil/page.tsx`
- Create: `src/hooks/useNotifikasiBrowser.ts`
- Modify: `src/app/warga/(app)/layout.tsx` — panggil `useNotifikasiBrowser()`

**Interfaces:**
- Consumes: `useWarga`, `useRiwayatKontribusi`, `useRiwayatTukar`, `waktuRelatif` dari `src/hooks/useBroadcasts.ts`
- Produces: `useNotifikasiBrowser(): { izin: NotificationPermission | "tidak-didukung"; minta: () => Promise<void> }` — dua listener: `broadcast_notifications` dan `load_shift_sessions`, masing-masing `where(<field waktu>, ">", Timestamp.now() saat mount)`; pada `docChanges()` tipe `added` → `new Notification(judul, { body, icon: "/logo-islandgrid.png" })` bila izin `granted`. Sesi baru → judul "Jam Emas Dimulai! ☀️", isi "Listrik surya melimpah. Nyalakan pompa/setrika sekarang dan klaim poin." (salinan dari `NotificationService.kt`).

- [ ] **Step 1: Profil** — nama, email, HP; total aksi disetujui (`items.filter(APPROVED).length`) dan total poin diperoleh (jumlah `poinDiberikan`); tombol "Aktifkan Notifikasi" (sembunyi bila `granted`/tidak didukung); daftar riwayat kontribusi (tanggal, `goldenHourRange`, pill status, `verificationReason` bila REJECTED); daftar riwayat tukar (nama hadiah, biaya, kode); tombol Keluar → `/warga/masuk`.
- [ ] **Step 2:** `npx tsc --noEmit` bersih
- [ ] **Step 3: Verifikasi manual:** izinkan notifikasi, kirim broadcast dari halaman Notifikasi operator di tab lain → notifikasi browser muncul.
- [ ] **Step 4:** Commit `feat(warga): profil, riwayat, notifikasi browser`

### Task 8: Sisi server, seed, dokumentasi

**Files:**
- Modify: `src/app/api/verify-participation/route.ts` — di transaksi APPROVED, `tx.set(BUMDes_rewards/{userId}, { total_poin: increment, user_id: userId, nama_warga: <userName dari dokumen> }, { merge: true })`; ambil `userName` dari `kini.data()`.
- Modify: `scripts/seed.ts` — akun warga demo: Auth `warga@siberut.id` / `password123`, `users/{uid}` `{ uid, nama: "Java Maulana", email, phone: "081234567890", role: "WARGA" }`, `BUMDes_rewards/{uid}` `{ user_id: uid, nama_warga: "Java Maulana", nomor_hp, total_poin: 150 }`. Pola sama seperti `ensureOperator`.
- Modify: `README.md` — tabel Halaman tambah portal warga; tabel akun tambah `warga@siberut.id`; jumlah test sesuai hasil `npm test`.
- Modify: `../context.md` — §1 arsitektur: "Mobile Warga" → "Portal Warga (web, `/warga`)"; §5 tanggung jawab Mobile dipindah ke Web.

- [ ] **Step 1:** Implementasi perubahan di atas.
- [ ] **Step 2:** `npm test` → semua lolos; `npx tsc --noEmit` bersih; `npm run build` sukses (rute `/warga/*` muncul di output build).
- [ ] **Step 3:** `npm run seed` → log memuat `warga@siberut.id`.
- [ ] **Step 4: Uji ujung-ke-ujung:** login warga demo → beranda → sesi aktif → kirim foto → operator verifikasi → saldo naik → tukar hadiah → kode tampil → riwayat di profil.
- [ ] **Step 5:** Commit `feat(warga): nama warga di poin, akun demo, dokumentasi`
