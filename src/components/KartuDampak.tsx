"use client";

import Link from "next/link";
import { useStatistikHarian } from "@/hooks/useStatistikHarian";
import { kelompokkan } from "@/lib/statistikIklim";
import { idr, num } from "@/lib/format";
import { FUEL } from "@/lib/fuel";

/**
 * Ringkasan Dampak Iklim 7 hari untuk dashboard & kalkulator. Ringkas: satu baris
 * angka, atau keadaan kosong yang menjelaskan penyebab dan langkah berikutnya.
 */
export default function KartuDampak() {
  const k = useStatistikHarian(7);

  let isi: React.ReactNode;
  if (k.tahap === "memuat") {
    isi = <p className="text-sm text-slate-500">Memuat ringkasan 7 hari…</p>;
  } else if (k.tahap === "galat") {
    isi = <p className="text-sm text-red-700">Ringkasan tidak dapat dimuat: {k.pesan}</p>;
  } else if (k.harian.length === 0) {
    isi = (
      <p className="text-sm text-slate-600">
        Statistik harian belum dihitung. Buka Dampak Iklim lalu pilih Hitung ulang riwayat, atau tunggu cron
        sesi berikutnya (tiap 5 menit).
      </p>
    );
  } else {
    const t = kelompokkan(k.harian, "bulan").reduce(
      (a, g) => ({
        aksi: a.aksi + g.aksi,
        kwh: a.kwh + g.kwhDigeser,
        liter: a.liter + g.literSolarDihemat,
        co2: a.co2 + g.co2DicegahKg,
        surya: a.surya + g.suryaTerpakaiKwh,
        beban: a.beban + g.bebanKwh,
      }),
      { aksi: 0, kwh: 0, liter: 0, co2: 0, surya: 0, beban: 0 },
    );
    const porsi = t.beban > 0 ? Math.round((t.surya / t.beban) * 100) : 0;
    isi = (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        <Angka label="Porsi beban dari surya" nilai={`${porsi}%`} catatan="prakiraan" />
        <Angka label="Aksi warga terverifikasi" nilai={num(t.aksi)} />
        {t.aksi > 0 ? (
          <>
            <Angka label="Solar dihemat" nilai={`${num(Math.round(t.liter * 10) / 10)} L`} />
            <Angka label="Biaya solar dihemat" nilai={idr(Math.round(t.liter * FUEL.hargaSolarPerLiter))} />
            <Angka label="CO₂ dicegah" nilai={`${num(Math.round(t.co2 * 10) / 10)} kg`} />
          </>
        ) : (
          <p className="col-span-2 self-center text-sm text-slate-600 sm:col-span-3">
            Belum ada aksi warga yang disetujui minggu ini, jadi belum ada solar yang dihemat. Buka sesi Jam
            Emas agar warga bisa ikut.
          </p>
        )}
      </dl>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="judul-dampak">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="judul-dampak" className="font-semibold">Dampak iklim 7 hari terakhir</h3>
        <Link href="/operator/dampak" className="text-sm font-semibold text-brand-700 hover:underline">
          Lihat per hari, minggu, bulan
        </Link>
      </div>
      {isi}
    </section>
  );
}

function Angka({ label, nilai, catatan }: { label: string; nilai: string; catatan?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">
        {label}
        {catatan && <span className="text-slate-400"> · {catatan}</span>}
      </dt>
      <dd className="text-xl font-bold text-slate-900">{nilai}</dd>
    </div>
  );
}
