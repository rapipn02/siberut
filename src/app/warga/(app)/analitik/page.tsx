"use client";

import { useMemo, useState } from "react";
import PowerBalanceChart from "@/components/PowerBalanceChart";
import KartuWaktuGrid from "@/components/Countdown";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { usePowerForecasts } from "@/hooks/usePowerForecasts";
import { useSekarang } from "@/components/warga/ui";
import { titikTerdekat } from "@/lib/warga";

const RENTANG = [
  { jam: 24, label: "24 Jam" },
  { jam: 48, label: "48 Jam" },
] as const;

export default function AnalitikWargaPage() {
  const { status } = useSystemStatus();
  const { points, loading } = usePowerForecasts();
  const [rentang, setRentang] = useState<24 | 48>(24);
  const sekarang = useSekarang(60_000);

  const tampil = useMemo(() => points.slice(0, rentang + 1), [points, rentang]);
  const pltd = status?.total_pltd_capacity_kw ?? 50;
  const plts = status?.total_plts_capacity_kw ?? 75;
  const puncak = tampil.length ? Math.round(Math.max(...tampil.map((p) => p.beban))) : 0;
  const jamDefisit = tampil.filter((p) => p.deficit).length;

  const kini = useMemo(
    () =>
      titikTerdekat(points, sekarang),
    [points, sekarang],
  );
  const selisih = kini ? Math.round(kini.plts - kini.beban) : 0;

  const titikGrid = useMemo(
    () =>
      points
        .filter((p) => p.waktuMs)
        .map((p) => ({ waktuMs: p.waktuMs as number, jam: p.jam, surplus: p.plts > p.beban })),
    [points],
  );

  return (
    <div className="space-y-5 p-5">
      <header>
        <h1 className="text-xl font-black">Kurva Kesetimbangan Daya</h1>
        <p className="text-xs text-slate-500">Real-time & prediksi · Beban vs Surya</p>
      </header>

      <div className="grid grid-cols-2 h-10 p-1 rounded-full bg-slate-200/70">
        {RENTANG.map((r) => (
          <button
            key={r.jam}
            type="button"
            onClick={() => setRentang(r.jam)}
            className={`rounded-full text-xs font-bold transition ${
              rentang === r.jam ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        {loading ? (
          <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
        ) : tampil.length === 0 ? (
          <p className="flex h-56 items-center justify-center text-xs text-slate-400">
            Data kurva belum tersedia
          </p>
        ) : (
          <PowerBalanceChart points={tampil} pltdLimit={pltd} />
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <Legenda warna="bg-slate-800" teks="Beban" />
          <Legenda warna="bg-brand-600" teks="Prediksi Surya" />
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-slate-400" />
            Batas PLTD
          </span>
        </div>
      </section>

      {kini && (
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">Pukul {kini.jam} WIB</p>
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
              LIVE
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Kecil label="Beban" nilai={`${Math.round(kini.beban)} kW`} warna="text-slate-900" />
            <Kecil label="Surya" nilai={`${Math.round(kini.plts)} kW`} warna="text-brand-600" />
            <Kecil
              label={selisih >= 0 ? "Surplus" : "Defisit"}
              nilai={`${selisih >= 0 ? "+" : ""}${selisih} kW`}
              warna={selisih >= 0 ? "text-brand-600" : "text-red-500"}
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Kartu judul="Kapasitas PLTS" nilai={plts} satuan="kWp" />
        <Kartu judul="Beban Puncak" nilai={puncak} satuan="kW" merah={puncak > pltd} />
        <Kartu judul="Batas PLTD" nilai={pltd} satuan="kW" />
        <Kartu judul={`Jam Defisit (${rentang}j)`} nilai={jamDefisit} satuan="jam" merah={jamDefisit > 0} />
      </div>

      <KartuWaktuGrid titik={titikGrid} />

      <p className="text-center text-[11px] text-slate-400">
        Prediksi per jam dari model AI, diperbarui tiap 3 jam.
      </p>
    </div>
  );
}

function Legenda({ warna, teks }: { warna: string; teks: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-0.5 ${warna}`} />
      {teks}
    </span>
  );
}

function Kecil({ label, nilai, warna }: { label: string; nilai: string; warna: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-base font-black ${warna}`}>{nilai}</p>
    </div>
  );
}

function Kartu({
  judul,
  nilai,
  satuan,
  merah = false,
}: {
  judul: string;
  nilai: number;
  satuan: string;
  merah?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[11px] text-slate-500">{judul}</p>
      <p className={`mt-1 text-3xl font-black ${merah ? "text-red-500" : "text-slate-900"}`}>
        {nilai}
        <span className="ml-1 text-sm font-semibold text-slate-400">{satuan}</span>
      </p>
    </div>
  );
}
