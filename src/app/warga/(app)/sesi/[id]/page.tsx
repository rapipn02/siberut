"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useWarga } from "@/components/WargaAuthProvider";
import { useSessions } from "@/hooks/useSessions";
import { useRiwayatKontribusi } from "@/hooks/useWargaData";
import { klaimSaya, statusKirimBukti } from "@/lib/warga";
import { BATAS_FOTO_KB, MAKS_FOTO, kompresFoto, muatBatas } from "@/lib/kompresFoto";
import { totalUkuranKb } from "@/lib/photo";
import { useSekarang } from "@/components/warga/ui";
import {
  Camera,
  CheckCircle,
  ChevronLeft,
  Clock,
  Picture,
  Users,
  X,
  Zap,
} from "@/components/icons";

export default function DetailSesiPage() {
  const { id } = useParams<{ id: string }>();
  const { warga } = useWarga();
  const { items, loading } = useSessions(30);
  const { items: riwayat } = useRiwayatKontribusi(warga?.uid);
  const sekarang = useSekarang(15_000);

  const sesi = items.find((s) => s.id === id);

  if (loading) {
    return <div className="m-5 h-64 rounded-3xl bg-slate-200/70 animate-pulse" />;
  }

  if (!sesi) {
    return (
      <div className="p-5">
        <Kembali />
        <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-none">
          Sesi tidak ditemukan atau sudah lama berakhir.
        </p>
      </div>
    );
  }

  const beban = sesi.currentLoadKw ?? 0;
  const kapasitas = sesi.capacityKw ?? 0;
  const rasio = kapasitas > 0 ? Math.min(1, beban / kapasitas) : 0;
  const kirim = statusKirimBukti(sesi, sekarang);
  const klaim = klaimSaya(riwayat, sesi);
  const berakhir = sesi.status === "ENDED" || sekarang > (sesi.endAt?.toMillis?.() ?? 0);

  return (
    <div className="p-5 pb-8 lg:p-8">
      <Kembali />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-6">
      <div>
      <p className="mt-4 text-sm text-slate-500">{sesi.date}</p>
      <h1 className="text-2xl font-black lg:text-3xl lg:font-bold">Detail Sesi Jam Emas</h1>
      <p className="mt-1 text-lg font-bold text-brand-600">
        {sesi.startTime} – {sesi.endTime} WIB
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <KartuMetrik
          Icon={Zap}
          judul="Target Pengalihan"
          nilai={`${sesi.targetSavingKwh ?? 0} kWh`}
        />
        <KartuMetrik
          Icon={Users}
          judul="Partisipasi"
          nilai={`${sesi.participantCount ?? 0} Warga`}
        />
      </div>

      <h2 className="mt-6 text-[15px] font-bold">Kondisi Grid Desa Saat Ini</h2>
      <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-none">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Beban Saat Ini</span>
          <span className="font-black text-brand-600">{beban} kW</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
          <div
            className={`h-full rounded-full ${rasio >= 0.9 ? "bg-red-500" : "bg-brand-600"}`}
            style={{ width: `${rasio * 100}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] text-slate-500">
          Kapasitas Produksi Surya: {kapasitas} kW
        </p>
      </div>

      </div>

      <div className="mt-8 lg:mt-4">
        {klaim === "disetujui" ? (
          <Info hijau>Poin sesi ini sudah Anda terima. Terima kasih!</Info>
        ) : klaim === "menunggu" ? (
          <Info>
            Bukti Anda sedang diverifikasi. Poin masuk otomatis dalam ±5 menit.
          </Info>
        ) : klaim === "ditinjau" ? (
          <Info>
            Foto Anda sedang ditinjau petugas BUMDes. Hasilnya muncul di Profil.
          </Info>
        ) : kirim.boleh ? (
          <FormBukti
            sesiId={sesi.id}
            poin={sesi.poin_per_partisipasi ?? 0}
            rentang={`${sesi.startTime}-${sesi.endTime}`}
          />
        ) : berakhir ? (
          <Info hijau>Sesi ini telah berakhir. Terima kasih atas partisipasi warga!</Info>
        ) : (
          <p className="text-center text-[13px] text-slate-500">
            Aksi partisipasi akan dibuka pukul {sesi.startTime} WIB.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

function FormBukti({ sesiId, poin, rentang }: { sesiId: string; poin: number; rentang: string }) {
  const { warga } = useWarga();
  const [fotos, setFotos] = useState<string[]>([]);
  const [memproses, setMemproses] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [error, setError] = useState("");
  const kamera = useRef<HTMLInputElement>(null);
  const galeri = useRef<HTMLInputElement>(null);

  const totalKb = totalUkuranKb(fotos);
  const muat = muatBatas(fotos);

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // supaya file yang sama bisa dipilih lagi
    if (files.length === 0) return;
    setError("");
    const sisa = MAKS_FOTO - fotos.length;
    if (files.length > sisa) setError(`Maksimal ${MAKS_FOTO} foto per klaim.`);
    setMemproses(true);
    const baru: string[] = [];
    for (const f of files.slice(0, Math.max(0, sisa))) {
      try {
        baru.push(await kompresFoto(f));
      } catch {
        setError("Ada foto yang tidak bisa dibaca. Gunakan format JPG atau PNG.");
      }
    }
    setFotos((lama) => [...lama, ...baru]);
    setMemproses(false);
  }

  async function kirim() {
    if (!warga || fotos.length === 0 || !muat || mengirim) return;
    setMengirim(true);
    setError("");
    try {
      await addDoc(collection(db, "participation_requests"), {
        userId: warga.uid,
        userName: warga.nama,
        timestamp: serverTimestamp(),
        goldenHourRange: rentang,
        photosBase64: fotos,
        status: "PENDING",
      });
      setFotos([]);
      // Setelah terkirim, riwayat menampilkan PENDING dan halaman beralih
      // ke pesan "sedang diverifikasi" dengan sendirinya.
    } catch {
      setError("Gagal mengirim. Periksa koneksi lalu coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  return (
    <section key={sesiId}>
      <h2 className="text-lg font-black">Klaim Insentif Jam Emas</h2>
      <p className="text-xs text-slate-500">
        Kirim foto alat listrik (pompa air/setrika/mesin es) yang sedang Anda gunakan
        sekarang. Dapatkan +{poin} poin.
      </p>

      <input ref={kamera} type="file" accept="image/*" capture="environment" hidden onChange={pilih} />
      <input ref={galeri} type="file" accept="image/*" multiple hidden onChange={pilih} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => kamera.current?.click()}
          disabled={fotos.length >= MAKS_FOTO || memproses}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold disabled:opacity-50"
        >
          <Camera className="w-5 h-5" /> Ambil Foto
        </button>
        <button
          type="button"
          onClick={() => galeri.current?.click()}
          disabled={fotos.length >= MAKS_FOTO || memproses}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold disabled:opacity-50"
        >
          <Picture className="w-5 h-5" /> Dari Galeri
        </button>
      </div>

      {(fotos.length > 0 || memproses) && (
        <div className="mt-4">
          <div className="flex gap-2 overflow-x-auto">
            {fotos.map((f, i) => (
              <div key={i} className="relative w-24 h-24 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${f}`}
                  alt={`Foto bukti ${i + 1}`}
                  className="w-24 h-24 rounded-xl object-cover"
                />
                <button
                  type="button"
                  aria-label={`Hapus foto ${i + 1}`}
                  onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {memproses && (
              <div className="w-24 h-24 shrink-0 rounded-xl bg-slate-200 animate-pulse" />
            )}
          </div>
          <p className={`mt-1 text-[11px] ${muat ? "text-slate-400" : "text-red-500 font-medium"}`}>
            {fotos.length}/{MAKS_FOTO} foto · {totalKb} KB
            {!muat && `, melebihi batas ${BATAS_FOTO_KB} KB. Hapus salah satu foto.`}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}

      <button
        type="button"
        onClick={kirim}
        disabled={fotos.length === 0 || !muat || mengirim || memproses}
        className="mt-6 h-14 w-full rounded-2xl bg-brand-600 font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {mengirim ? "Mengirim…" : "Klaim Poin Jam Emas"}
      </button>
    </section>
  );
}

function Kembali() {
  return (
    <Link href="/warga" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
      <ChevronLeft className="w-5 h-5" /> Beranda
    </Link>
  );
}

function KartuMetrik({
  Icon,
  judul,
  nilai,
}: {
  Icon: typeof Zap;
  judul: string;
  nilai: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-none">
      <Icon className="w-5 h-5 text-brand-600" />
      <p className="mt-2 text-[11px] text-slate-500">{judul}</p>
      <p className="text-lg font-black">{nilai}</p>
    </div>
  );
}

function Info({ children, hijau = false }: { children: React.ReactNode; hijau?: boolean }) {
  const Icon = hijau ? CheckCircle : Clock;
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl p-4 text-[13px] ${
        hijau ? "bg-brand-600/10 text-slate-800" : "bg-amber-500/10 text-amber-800"
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${hijau ? "text-brand-600" : "text-amber-600"}`} />
      {children}
    </div>
  );
}
