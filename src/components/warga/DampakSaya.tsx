"use client";

import { useState } from "react";
import { useStatistikHarian } from "@/hooks/useStatistikHarian";
import { useSekarang } from "@/hooks/useSekarang";
import { dampakPribadi } from "@/lib/statistikIklim";
import { kunciTanggalWib } from "@/lib/waktu";
import type { ParticipationRequest } from "@/lib/types";

/** Dampak iklim warga sendiri (minggu ini / bulan ini) dan porsinya terhadap desa bulan ini. */
export default function DampakSaya({ riwayat }: { riwayat: ParticipationRequest[] }) {
  const sekarang = useSekarang(60_000);
  const [periode, setPeriode] = useState<"mingguIni" | "bulanIni">("mingguIni");
  const desa = useStatistikHarian(31);
  const d = dampakPribadi(riwayat, sekarang)[periode];

  const bulanKini = kunciTanggalWib(new Date(sekarang)).slice(0, 7);
  const literDesa =
    desa.tahap === "siap"
      ? desa.harian.filter((h) => h.tanggal.startsWith(bulanKini)).reduce((t, h) => t + h.literSolarDihemat, 0)
      : 0;
  const saya = dampakPribadi(riwayat, sekarang).bulanIni.liter;
  const porsi = literDesa > 0 ? Math.min(100, Math.round((saya / literDesa) * 100)) : null;

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm" aria-labelledby="judul-dampak-saya">
      <div className="flex items-center justify-between gap-3">
        <h2 id="judul-dampak-saya" className="font-black">Dampak saya</h2>
        <div role="tablist" aria-label="Periode" className="grid grid-cols-2 rounded-full bg-slate-100 p-1 text-xs font-bold">
          {(["mingguIni", "bulanIni"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={periode === p}
              onClick={() => setPeriode(p)}
              className={`rounded-full px-3 py-1.5 ${periode === p ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
            >
              {p === "mingguIni" ? "Minggu ini" : "Bulan ini"}
            </button>
          ))}
        </div>
      </div>

      {d.aksi === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          Belum ada aksi yang disetujui {periode === "mingguIni" ? "minggu" : "bulan"} ini. Ikut sesi Jam Emas
          berikutnya dan kirim foto alat Anda.
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-[11px] text-slate-500">Solar dihemat</dt>
            <dd className="text-xl font-black">{d.liter} L</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">CO₂ dicegah</dt>
            <dd className="text-xl font-black">{d.co2Kg} kg</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Aksi</dt>
            <dd className="text-xl font-black">{d.aksi}</dd>
          </div>
        </dl>
      )}

      {porsi !== null && saya > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Bulan ini Anda menyumbang {porsi}% dari solar yang dihemat seluruh desa.
        </p>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        Perkiraan dari daya alat di foto (1 jam pemakaian), 0,3 L solar per kWh, 2,68 kg CO₂ per liter (IPCC 2006).
      </p>
    </section>
  );
}
