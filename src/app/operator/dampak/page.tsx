"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStatistikHarian } from "@/hooks/useStatistikHarian";
import { kelompokkan, type Periode, type StatKelompok } from "@/lib/statistikIklim";
import { fetchBertoken } from "@/lib/apiKlien";
import { kunciTanggalWib } from "@/lib/waktu";
import { FUEL } from "@/lib/fuel";
import { idr, num } from "@/lib/format";
import { Download, Refresh } from "@/components/icons";

const PILIHAN: { periode: Periode; label: string; hari: number; keterangan: string }[] = [
  { periode: "hari", label: "Hari", hari: 30, keterangan: "30 hari terakhir" },
  { periode: "minggu", label: "Minggu", hari: 84, keterangan: "12 minggu terakhir" },
  { periode: "bulan", label: "Bulan", hari: 365, keterangan: "12 bulan terakhir" },
];

const HARI_ISI_ULANG = 90;

function unduhCsv(baris: StatKelompok[], periode: Periode) {
  const kepala = "periode,aksi,kwh_digeser,liter_solar_dihemat,co2_dicegah_kg,surya_terpakai_kwh,beban_kwh,porsi_surya_persen,jam_defisit,liter_pltd_perkiraan,sesi";
  const isi = baris
    .map((b) =>
      [b.kunci, b.aksi, b.kwhDigeser, b.literSolarDihemat, b.co2DicegahKg, b.suryaTerpakaiKwh, b.bebanKwh, b.porsiSuryaPersen, b.jamDefisit, b.literPltdPerkiraan, b.sesi].join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([`${kepala}\n${isi}`], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dampak-iklim-per-${periode}-${kunciTanggalWib(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DampakIklimPage() {
  const [pilih, setPilih] = useState(PILIHAN[0]);
  const keadaan = useStatistikHarian(pilih.hari);
  const [isiUlang, setIsiUlang] = useState<{ busy: boolean; pesan: string }>({ busy: false, pesan: "" });

  const baris = useMemo(
    () => (keadaan.tahap === "siap" ? kelompokkan(keadaan.harian, pilih.periode) : []),
    [keadaan, pilih.periode],
  );
  const total = baris.reduce(
    (t, b) => ({
      aksi: t.aksi + b.aksi,
      kwh: t.kwh + b.kwhDigeser,
      liter: t.liter + b.literSolarDihemat,
      co2: t.co2 + b.co2DicegahKg,
      surya: t.surya + b.suryaTerpakaiKwh,
      beban: t.beban + b.bebanKwh,
      pltd: t.pltd + b.literPltdPerkiraan,
    }),
    { aksi: 0, kwh: 0, liter: 0, co2: 0, surya: 0, beban: 0, pltd: 0 },
  );
  const porsi = total.beban > 0 ? Math.round((total.surya / total.beban) * 100) : 0;

  async function hitungUlang() {
    setIsiUlang({ busy: true, pesan: "" });
    const dari = kunciTanggalWib(new Date(Date.now() - (HARI_ISI_ULANG - 1) * 86_400_000));
    try {
      const d = await (
        await fetchBertoken("/api/statistik/hitung", { method: "POST", body: JSON.stringify({ dariTanggal: dari }) })
      ).json();
      setIsiUlang({
        busy: false,
        pesan: d.ok ? `${d.hari} hari dihitung ulang (${d.dari} sampai ${d.sampai}).` : (d.error ?? "Gagal menghitung."),
      });
    } catch {
      setIsiUlang({ busy: false, pesan: "Tidak dapat menghubungi server." });
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dampak Iklim</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Berapa beban desa yang ditanggung surya, dan berapa solar serta CO₂ yang dicegah oleh warga
            yang menggeser pemakaian ke Jam Emas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={hitungUlang}
            disabled={isiUlang.busy}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
          >
            <Refresh className={`h-4 w-4 ${isiUlang.busy ? "animate-spin" : ""}`} />
            {isiUlang.busy ? "Menghitung…" : `Hitung ulang ${HARI_ISI_ULANG} hari`}
          </button>
          <button
            type="button"
            onClick={() => unduhCsv(baris, pilih.periode)}
            disabled={baris.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Ekspor CSV
          </button>
        </div>
      </div>

      {isiUlang.pesan && <p role="status" className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm">{isiUlang.pesan}</p>}

      <div role="tablist" aria-label="Periode" className="mb-6 inline-flex rounded-lg border border-slate-300 bg-white p-1">
        {PILIHAN.map((p) => (
          <button
            key={p.periode}
            type="button"
            role="tab"
            aria-selected={pilih.periode === p.periode}
            onClick={() => setPilih(p)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              pilih.periode === p.periode ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {keadaan.tahap === "memuat" ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">Memuat statistik {pilih.keterangan}…</p>
      ) : keadaan.tahap === "galat" ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-800">Statistik tidak dapat dimuat: {keadaan.pesan}</p>
      ) : baris.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
          Belum ada statistik untuk {pilih.keterangan}. Tekan <b>Hitung ulang {HARI_ISI_ULANG} hari</b> untuk menghitung
          dari prakiraan dan riwayat partisipasi yang sudah ada.
        </div>
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-5">
            <Angka label="Porsi beban dari surya" nilai={`${porsi}%`} sub="prakiraan" />
            <Angka label="Solar PLTD (perkiraan)" nilai={`${num(Math.round(total.pltd))} L`} sub="menutup kekurangan surya" />
            {total.aksi > 0 ? (
              <>
                <Angka label="CO₂ dicegah warga" nilai={`${num(Math.round(total.co2 * 10) / 10)} kg`} />
                <Angka label="Solar dihemat warga" nilai={`${num(Math.round(total.liter * 10) / 10)} L`} sub={idr(Math.round(total.liter * FUEL.hargaSolarPerLiter))} />
                <Angka label="Beban digeser ke Jam Emas" nilai={`${num(Math.round(total.kwh * 10) / 10)} kWh`} sub={`${num(total.aksi)} aksi disetujui`} />
              </>
            ) : (
              <div className="col-span-2 lg:col-span-3">
                <dt className="text-xs text-slate-500">Partisipasi warga</dt>
                <dd className="mt-1 text-sm text-slate-700">
                  Belum ada aksi yang disetujui dalam {pilih.keterangan}, jadi belum ada solar atau CO₂ yang
                  dicegah warga. Buka sesi Jam Emas di menu Sesi agar warga bisa mengirim bukti.
                </dd>
              </div>
            )}
          </dl>

          <div className="grid gap-6 xl:grid-cols-2">
            <Grafik judul={`Berapa beban desa yang ditanggung surya per ${pilih.label.toLowerCase()}?`}>
              <BarChart data={baris} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} unit=" kWh" width={80} />
                <Tooltip formatter={(v) => `${v} kWh`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="suryaTerpakaiKwh" name="Dari surya" stackId="a" fill="#16A34A" isAnimationActive={false} />
                <Bar dataKey={(b: StatKelompok) => Math.max(0, b.bebanKwh - b.suryaTerpakaiKwh)} name="Dari solar" stackId="a" fill="#9A4A2B" fillOpacity={0.6} isAnimationActive={false} />
              </BarChart>
            </Grafik>
            <Grafik
              judul={`Berapa CO₂ yang dicegah warga per ${pilih.label.toLowerCase()}?`}
              kosong={
                total.aksi === 0
                  ? "Belum ada aksi warga yang disetujui dalam periode ini. Batang muncul setelah warga mengirim bukti di sesi Jam Emas dan diverifikasi."
                  : undefined
              }
            >
                <BarChart data={baris} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} unit=" kg" width={60} />
                  <Tooltip formatter={(v) => `${v} kg CO₂`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="co2DicegahKg" name="CO₂ dicegah" fill="#0F4C5C" isAnimationActive={false} />
                </BarChart>
            </Grafik>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Statistik dampak iklim per {pilih.label.toLowerCase()}</caption>
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{pilih.label}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Porsi surya</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Jam defisit</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Aksi warga</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">kWh digeser</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Solar dihemat</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">CO₂ dicegah</th>
                </tr>
              </thead>
              <tbody>
                {[...baris].reverse().map((b) => (
                  <tr key={b.kunci} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">{b.label}</th>
                    <td className="px-4 py-2.5 text-right">{b.porsiSuryaPersen}%</td>
                    <td className="px-4 py-2.5 text-right">{b.jamDefisit}</td>
                    <td className="px-4 py-2.5 text-right">{b.aksi}</td>
                    <td className="px-4 py-2.5 text-right">{b.kwhDigeser}</td>
                    <td className="px-4 py-2.5 text-right">{b.literSolarDihemat} L</td>
                    <td className="px-4 py-2.5 text-right">{b.co2DicegahKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-6 max-w-3xl text-xs text-slate-500">
        Cara hitung: kWh digeser adalah perkiraan Mata AI dari daya alat di foto (asumsi 1 jam pemakaian).
        1 kWh yang pindah ke jam surya menghemat {FUEL.literPerKwhGenset} liter solar genset (asumsi proyek), dan
        1 liter solar setara {FUEL.co2PerLiter} kg CO₂ (IPCC 2006). Porsi surya, jam defisit, dan solar PLTD
        berasal dari prakiraan model, bukan pembacaan meteran.
      </p>
    </div>
  );
}

function Angka({ label, nilai, sub }: { label: string; nilai: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-2xl font-bold text-slate-900">{nilai}</dd>
      {sub && <dd className="text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}

function Grafik({
  judul,
  kosong,
  children,
}: {
  judul: string;
  kosong?: string;
  children: React.ReactElement;
}) {
  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-4">
      <figcaption className="mb-3 text-sm font-semibold">{judul}</figcaption>
      <div className="h-64">
        {kosong ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600">{kosong}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}
