"use client";

import { useState } from "react";
import { fetchBertoken } from "@/lib/apiKlien";
import { useWarga } from "@/components/WargaAuthProvider";
import { useSaldo, useStokHadiah } from "@/hooks/useWargaData";
import { useRewardCatalog } from "@/hooks/useRewards";
import { statusHadiah } from "@/lib/warga";
import { KartuPoin, Kosong } from "@/components/warga/ui";
import { ArrowUpRight, Copy, Droplet, ShoppingBag, X, Zap } from "@/components/icons";
import type { RewardCatalogItem, RewardIcon } from "@/lib/types";

const IKON: Record<RewardIcon, typeof Zap> = {
  FLASH: Zap,
  SHOPPING: ShoppingBag,
  WATER: Droplet,
};

type Hasil = { ok: true; kode: string; nama: string } | { ok: false; pesan: string };

export default function HadiahWargaPage() {
  const { warga } = useWarga();
  const { poin } = useSaldo(warga?.uid);
  const { items, loading } = useRewardCatalog();
  const { stok, loading: memuatStok, gagal: stokGagal, muatUlang: muatUlangStok } = useStokHadiah();
  const [dipilih, setDipilih] = useState<RewardCatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [tersalin, setTersalin] = useState(false);

  const katalog = items.filter((i) => i.aktif !== false);

  function tutup() {
    if (busy) return;
    setDipilih(null);
    setHasil(null);
    setTersalin(false);
  }

  async function tukar() {
    if (!dipilih || busy) return;
    setBusy(true);
    try {
      const res = await fetchBertoken("/api/redeem", {
        method: "POST",
        body: JSON.stringify({ catalog_id: dipilih.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) muatUlangStok();
      setHasil(
        data.ok
          ? { ok: true, kode: data.kode, nama: data.nama_hadiah || dipilih.name }
          : { ok: false, pesan: data.error ?? "Penukaran gagal. Coba lagi." },
      );
    } catch (err) {
      setHasil({
        ok: false,
        pesan: err instanceof Error ? err.message : "Tidak ada koneksi ke server.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function salin(kode: string) {
    try {
      await navigator.clipboard.writeText(kode);
      setTersalin(true);
    } catch {
      setTersalin(false);
    }
  }

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <header>
        <h1 className="text-2xl font-black lg:text-3xl lg:font-bold">Katalog Hadiah</h1>
        <p className="text-xs text-slate-500">
          Tukarkan poin kontribusi Anda dengan token listrik & kebutuhan desa.
        </p>
      </header>

      <KartuPoin poin={poin} />

      <section className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
        {loading || memuatStok ? (
          <div className="h-24 rounded-[20px] bg-slate-200/70 animate-pulse" />
        ) : stokGagal ? (
          <div className="rounded-2xl bg-white p-5 text-[13px] text-slate-600 shadow-sm md:col-span-2 xl:col-span-3 lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-none">
            Stok hadiah sedang tidak bisa dimuat. Coba lagi beberapa saat lagi.
            <button
              type="button"
              onClick={muatUlangStok}
              className="mt-3 block rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Muat ulang
            </button>
          </div>
        ) : katalog.length === 0 ? (
          <Kosong>Katalog hadiah masih kosong.</Kosong>
        ) : (
          katalog.map((item) => {
            const sisa = stok[item.id] ?? 0;
            const st = statusHadiah(poin, item.pointsRequired, sisa);
            const Icon = IKON[item.iconType] ?? Zap;
            const bisa = st === "bisa";
            return (
              <button
                key={item.id}
                type="button"
                disabled={!bisa}
                onClick={() => setDipilih(item)}
                className={`flex w-full items-center gap-4 rounded-[20px] border bg-white p-4 text-left transition lg:rounded-xl lg:shadow-none ${
                  bisa
                    ? "border-brand-600/20 shadow-sm active:scale-[0.99] lg:border-slate-200 lg:hover:border-brand-600/50"
                    : "border-slate-900/5 cursor-not-allowed"
                } ${st === "habis" ? "opacity-50" : ""}`}
              >
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                    bisa ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black">{item.name}</span>
                  {item.deskripsi && (
                    <span className="block truncate text-[11px] text-slate-500">
                      {item.deskripsi}
                    </span>
                  )}
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`text-[13px] font-extrabold ${
                        bisa ? "text-brand-600" : "text-slate-400"
                      }`}
                    >
                      {item.pointsRequired} Poin
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        sisa > 5
                          ? "bg-slate-100 text-slate-500"
                          : sisa > 0
                            ? "bg-amber-500/10 text-amber-600"
                            : "text-red-500"
                      }`}
                    >
                      {sisa > 0 ? `Sisa: ${sisa}` : "Habis"}
                    </span>
                  </span>
                  {st === "kurang-poin" && (
                    <span className="block text-[10px] text-slate-400">
                      Kurang {item.pointsRequired - poin} poin
                    </span>
                  )}
                </span>
                {bisa ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                ) : st === "habis" ? (
                  <span className="text-[10px] font-black text-red-500">HABIS</span>
                ) : null}
              </button>
            );
          })
        )}
      </section>

      {dipilih && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="judul-tukar"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={tutup}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:m-4 sm:rounded-3xl lg:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start">
              <h2 id="judul-tukar" className="flex-1 text-lg font-black">
                {hasil?.ok ? "Penukaran Berhasil" : "Konfirmasi Penukaran"}
              </h2>
              <button type="button" aria-label="Tutup" onClick={tutup} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasil?.ok ? (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">{hasil.nama}</p>
                <p className="mt-4 text-xs font-semibold text-slate-500">KODE TOKEN ANDA:</p>
                <p className="mt-1 select-all break-all rounded-2xl bg-brand-50 px-4 py-4 font-mono text-2xl font-black tracking-wider text-brand-700 lg:rounded-xl">
                  {hasil.kode}
                </p>
                <button
                  type="button"
                  onClick={() => salin(hasil.kode)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"
                >
                  <Copy className="h-4 w-4" /> {tersalin ? "Tersalin!" : "Salin kode"}
                </button>
                <p className="mt-3 text-[11px] text-slate-500">
                  Masukkan ke meteran listrik di rumah. Kode juga tersimpan di Profil.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm">Tukar {dipilih.pointsRequired} poin dengan:</p>
                <p className="text-xl font-black text-brand-600">{dipilih.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Sisa poin setelah ditukar: {poin - dipilih.pointsRequired}
                </p>
                {hasil && !hasil.ok && (
                  <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    {hasil.pesan}
                  </p>
                )}
              </>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              {hasil?.ok ? (
                <button
                  type="button"
                  onClick={tutup}
                  className="col-span-2 h-12 rounded-xl bg-brand-600 font-bold text-white"
                >
                  Tutup
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={tutup}
                    disabled={busy}
                    className="h-12 rounded-xl border border-slate-200 font-semibold disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={tukar}
                    disabled={busy}
                    className="h-12 rounded-xl bg-brand-600 font-bold text-white disabled:opacity-60"
                  >
                    {busy ? "Memproses…" : "Ya, Tukar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
