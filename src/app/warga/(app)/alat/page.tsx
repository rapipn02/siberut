"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchBertoken } from "@/lib/apiKlien";
import { kompresFoto } from "@/lib/kompresFoto";
import { rencanaHemat, wattWajar, type HasilLabel } from "@/lib/alatWarga";
import { jamEmasHariIni } from "@/lib/warga";
import { idr } from "@/lib/format";
import { useWarga } from "@/components/WargaAuthProvider";
import { useAlatSaya } from "@/hooks/useWargaData";
import { usePowerForecasts } from "@/hooks/usePowerForecasts";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { Kosong } from "@/components/warga/ui";
import { Camera, ChevronLeft, Picture, X, Zap } from "@/components/icons";

const CEPAT = [
  { nama: "Pompa air", watt: 250 },
  { nama: "Setrika", watt: 350 },
  { nama: "Mesin cuci", watt: 400 },
  { nama: "Rice cooker", watt: 400 },
  { nama: "Freezer/mesin es", watt: 150 },
  { nama: "Mesin jahit", watt: 100 },
];

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

export default function AlatSayaPage() {
  const { warga } = useWarga();
  const { items: alat, loading } = useAlatSaya(warga?.uid);
  const { points } = usePowerForecasts();
  const { status } = useSystemStatus();
  const jamEmas = useMemo(() => jamEmasHariIni(points, status), [points, status]);
  const rencana = useMemo(() => rencanaHemat(alat, jamEmas), [alat, jamEmas]);

  const [nama, setNama] = useState("");
  const [watt, setWatt] = useState("");
  const [merek, setMerek] = useState("");
  const [sumber, setSumber] = useState<"ai" | "manual">("manual");
  const [hasilAi, setHasilAi] = useState<(HasilLabel & { sisaKuota?: number }) | null>(null);
  const [memindai, setMemindai] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState("");
  const kamera = useRef<HTMLInputElement>(null);
  const galeri = useRef<HTMLInputElement>(null);

  function isi(n: string, w: number, m = "", s: "ai" | "manual" = "manual") {
    setNama(n);
    setWatt(String(w || ""));
    setMerek(m);
    setSumber(s);
    setError("");
  }

  async function pindai(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMemindai(true);
    setError("");
    setHasilAi(null);
    try {
      const foto = await kompresFoto(file);
      const res = await fetchBertoken("/api/ai/label", {
        method: "POST",
        body: JSON.stringify({ foto }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error ?? "Gagal membaca label.");
      setHasilAi({ ...d.hasil, sisaKuota: d.sisaKuota });
      isi(d.hasil.nama, d.hasil.watt, d.hasil.merek, "ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca label.");
    } finally {
      setMemindai(false);
    }
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const w = wattWajar(Number(watt));
    if (!warga || !nama.trim()) return setError("Nama alat wajib diisi.");
    if (!w) return setError("Daya harus 1–5000 watt.");
    setMenyimpan(true);
    try {
      await addDoc(collection(db, "users", warga.uid, "alat"), {
        nama: nama.trim().slice(0, 60),
        watt: w,
        ...(merek.trim() ? { merek: merek.trim().slice(0, 40) } : {}),
        sumber,
      });
      isi("", 0);
      setHasilAi(null);
    } catch {
      setError("Gagal menyimpan. Periksa koneksi.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    if (!warga) return;
    await deleteDoc(doc(db, "users", warga.uid, "alat", id)).catch(() => {});
  }

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <Link href="/warga" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <ChevronLeft className="h-5 w-5" /> Beranda
      </Link>

      <header>
        <h1 className="text-2xl font-black lg:text-3xl lg:font-bold">Alat Saya</h1>
        <p className="text-xs text-slate-500">
          Foto label alat Anda. AI membaca dayanya, lalu sistem menyusun jadwal pakai di Jam Emas.
        </p>
      </header>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-6">
      <section className="rounded-3xl bg-slate-900 p-5 text-white lg:rounded-xl">
        <p className="text-xs font-bold text-violet-200">Rencana hemat hari ini</p>
        {!jamEmas ? (
          <p className="mt-2 text-sm text-slate-300">
            Hari ini surya diprediksi tidak melampaui beban. Tunda alat berat bila bisa.
          </p>
        ) : rencana.jadwal.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">
            Jam Emas {jamEmas.mulai}–{jamEmas.selesai}. Tambahkan alat Anda untuk melihat jadwalnya.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {rencana.jadwal.map((j, i) => (
                <li key={`${j.alat.id}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-brand-400">{j.jam}</span>
                  <span className="flex-1 truncate">{j.alat.nama}</span>
                  <span className="text-xs text-slate-400">{j.kwh.toFixed(2)} kWh</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-300">
              Total {rencana.kwh} kWh dipindah ke listrik surya → desa hemat ±{rencana.liter} L solar (
              {idr(rencana.rupiah)}). Ikuti sesi Jam Emas untuk dapat poin.
            </p>
          </>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-none">
        <h2 className="font-black">Tambah Alat</h2>
        <input ref={kamera} type="file" accept="image/*" capture="environment" hidden onChange={pindai} />
        <input ref={galeri} type="file" accept="image/*" hidden onChange={pindai} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => kamera.current?.click()}
            disabled={memindai}
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Camera className="h-5 w-5" /> {memindai ? "Membaca…" : "Foto Label"}
          </button>
          <button
            type="button"
            onClick={() => galeri.current?.click()}
            disabled={memindai}
            className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 py-3 text-sm font-semibold text-violet-700 disabled:opacity-60"
          >
            <Picture className="h-5 w-5" /> Dari Galeri
          </button>
        </div>

        {hasilAi && (
          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800">
            {hasilAi.terbaca ? "Label terbaca" : "Perkiraan AI"}: {hasilAi.alasan} Periksa lalu simpan.
            {hasilAi.sisaKuota !== undefined && (
              <span className="block text-violet-500">Sisa pindai hari ini: {hasilAi.sisaKuota}</span>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {CEPAT.map((c) => (
            <button
              key={c.nama}
              type="button"
              onClick={() => isi(c.nama, c.watt)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              {c.nama} · {c.watt} W
            </button>
          ))}
        </div>

        <form onSubmit={simpan} className="mt-4 space-y-2">
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama alat" className={INPUT} />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={watt}
              onChange={(e) => setWatt(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="numeric"
              placeholder="Daya (watt)"
              className={INPUT}
            />
            <input value={merek} onChange={(e) => setMerek(e.target.value)} placeholder="Merek (opsional)" className={INPUT} />
          </div>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={menyimpan}
            className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white disabled:opacity-60"
          >
            {menyimpan ? "Menyimpan…" : "Simpan Alat"}
          </button>
        </form>
      </section>
      </div>

      <section>
        <h2 className="text-base font-extrabold">Daftar Alat ({alat.length})</h2>
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
          ) : alat.length === 0 ? (
            <Kosong>Belum ada alat. Foto label atau pilih alat umum di atas.</Kosong>
          ) : (
            alat.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-none">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Zap className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.nama}</p>
                  <p className="text-xs text-slate-500">
                    {a.watt} W{a.merek ? ` · ${a.merek}` : ""}
                    {a.sumber === "ai" && <span className="text-violet-600"> · dibaca AI</span>}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Hapus ${a.nama}`}
                  onClick={() => hapus(a.id)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
