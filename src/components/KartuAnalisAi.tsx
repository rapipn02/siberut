"use client";

import { useState } from "react";
import { useBriefing } from "@/hooks/useBriefing";
import { waktuRelatif } from "@/hooks/useBroadcasts";
import { fetchBertoken } from "@/lib/apiKlien";
import { rentangJam } from "@/lib/analisAi";
import { Refresh } from "./icons";

const WARNA_RISIKO = {
  rendah: "bg-slate-100 text-slate-700",
  sedang: "bg-amber-100 text-amber-900",
  tinggi: "bg-red-100 text-red-800",
} as const;

/**
 * Briefing operator 48 jam. Kiri: angka yang dihitung sistem + ringkasan.
 * Kanan: jam rawan dan saran tindakan dari Gemini. Lebar penuh supaya tidak ada teks terpotong.
 */
export default function KartuAnalisAi() {
  const { briefing, loading } = useBriefing();
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  async function perbarui() {
    setBusy(true);
    setPesan("");
    try {
      const d = await (
        await fetchBertoken("/api/ai/briefing", { method: "POST", body: JSON.stringify({ paksa: true }) })
      ).json();
      if (!d.ok) setPesan(d.error ?? "Gagal memperbarui.");
      else if (d.hasil === "tanpa-ai") setPesan("AI sedang tidak tersedia. Angka diperbarui, penjelasan memakai versi sebelumnya.");
      else if (d.hasil === "tanpa-data") setPesan("Belum ada data prakiraan untuk dianalisis.");
    } catch {
      setPesan("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  const ai = briefing?.ai;
  const a = briefing?.angka;
  const waktuAi = briefing?.aiDibuat?.toDate?.();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="judul-briefing">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="judul-briefing" className="font-semibold">Briefing 48 jam ke depan</h3>
          <p className="text-xs text-slate-500">
            Angka dihitung sistem dari prakiraan. Penjelasan dan saran ditulis Gemini
            {waktuAi ? `, ${waktuRelatif(waktuAi)}` : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={perbarui}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
        >
          <Refresh className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Menyusun briefing…" : briefing ? "Susun ulang" : "Susun briefing"}
        </button>
      </div>

      {pesan && <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{pesan}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Memuat briefing terakhir…</p>
      ) : !briefing || !a ? (
        <p className="mt-5 text-sm text-slate-600">
          Belum ada briefing. Briefing disusun otomatis setiap prakiraan diperbarui, atau tekan Susun briefing.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs text-slate-500">Beban puncak</dt>
                <dd className="text-lg font-bold">
                  {a.bebanPuncakKw} kW{a.jamPuncak && <span className="text-sm font-medium text-slate-500"> pukul {a.jamPuncak}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Solar PLTD untuk menutup kekurangan</dt>
                <dd className="text-lg font-bold">{a.literPltd} liter</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Jam defisit ({a.jamDefisit.length} jam)</dt>
                <dd className="font-semibold text-red-800">{a.jamDefisit.length ? rentangJam(a.jamDefisit) : "Tidak ada"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Jam Emas (surya melebihi beban)</dt>
                <dd className="font-semibold text-brand-800">{a.jamEmas ?? "Tidak ada"}</dd>
              </div>
            </dl>
            {ai && <p className="text-sm leading-relaxed text-slate-700">{ai.ringkasan}</p>}
          </div>

          {ai ? (
            <div className="space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
              {ai.risiko.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Jam rawan</h4>
                  <ul className="space-y-2">
                    {ai.risiko.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${WARNA_RISIKO[r.tingkat]}`}>
                          {r.jam} · {r.tingkat}
                        </span>
                        <span className="text-slate-700">{r.sebab}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold">Saran jadwal PLTD</h4>
                  <p className="mt-1 text-sm text-slate-700">{ai.jadwalPltd}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Saran Jam Emas untuk warga</h4>
                  <p className="mt-1 text-sm text-slate-700">{ai.jamEmasSaran}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 lg:border-l lg:border-slate-100 lg:pl-6">
              Penjelasan AI belum tersedia. Angka di samping tetap berlaku.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
