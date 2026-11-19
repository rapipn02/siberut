"use client";

import { useEffect, useRef, useState } from "react";
import { fetchBertoken } from "@/lib/apiKlien";
import type { PesanObrolan } from "@/lib/asisten";
import { Send, X } from "./icons";

/** Teks model → tebal (**x**) & butir (- x), tanpa merender HTML mentah. */
function TeksAsisten({ teks }: { teks: string }) {
  return (
    <>
      {teks.split("\n").map((baris, i) => {
        const butir = /^\s*[-*•]\s+/.test(baris);
        const isi = baris.replace(/^\s*[-*•]\s+/, "");
        const bagian = isi.split(/\*\*(.+?)\*\*/g).map((b, j) => (j % 2 ? <b key={j}>{b}</b> : b));
        if (!isi.trim()) return <div key={i} className="h-2" />;
        return butir ? (
          <p key={i} className="flex gap-1.5">
            <span aria-hidden>•</span>
            <span>{bagian}</span>
          </p>
        ) : (
          <p key={i}>{bagian}</p>
        );
      })}
    </>
  );
}

export default function PanelAsisten({
  peran,
  saran,
}: {
  peran: "warga" | "operator";
  saran: string[];
}) {
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState<PesanObrolan[]>([]);
  const [teks, setTeks] = useState("");
  const [busy, setBusy] = useState(false);
  const [sisa, setSisa] = useState<number | null>(null);
  const bawah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: "smooth" });
  }, [pesan, busy]);

  async function kirim(pertanyaan: string) {
    const q = pertanyaan.trim();
    if (!q || busy) return;
    const riwayat: PesanObrolan[] = [...pesan, { role: "user", content: q }];
    setPesan(riwayat);
    setTeks("");
    setBusy(true);
    try {
      const d = await (
        await fetchBertoken("/api/asisten", { method: "POST", body: JSON.stringify({ pesan: riwayat }) })
      ).json();
      setPesan([...riwayat, { role: "assistant", content: d.ok ? d.jawaban : `⚠ ${d.error ?? "Gagal."}` }]);
      if (typeof d.sisaKuota === "number") setSisa(d.sisaKuota);
    } catch {
      setPesan([...riwayat, { role: "assistant", content: "⚠ Tidak dapat menghubungi server." }]);
    } finally {
      setBusy(false);
    }
  }

  const warga = peran === "warga";

  return (
    <>
      {!buka && (
        <button
          type="button"
          onClick={() => setBuka(true)}
          aria-label="Buka asisten"
          className={`fixed z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-700 ${
            warga ? "bottom-24 right-[max(1rem,calc(50%-14rem+1rem))]" : "bottom-6 right-6"
          }`}
        >
          Tanya asisten
        </button>
      )}

      {buka && (
        <div
          role="dialog"
          aria-label="Asisten ListrikSiberut"
          className={`fixed z-50 flex flex-col bg-white shadow-2xl ${
            warga
              ? "inset-x-0 bottom-0 mx-auto h-[78dvh] max-w-md rounded-t-3xl"
              : "bottom-6 right-6 h-[70vh] w-[min(420px,calc(100vw-3rem))] rounded-2xl border border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <div className="flex-1">
              <p className="text-sm font-black">Asisten ListrikSiberut</p>
              <p className="text-[11px] text-slate-500">
                Menjawab dari data asli sistem{sisa !== null ? ` · sisa ${sisa} pertanyaan hari ini` : ""}
              </p>
            </div>
            <button type="button" aria-label="Tutup asisten" onClick={() => setBuka(false)} className="p-1 text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {pesan.length === 0 && (
              <div>
                <p className="text-slate-500">
                  {warga
                    ? "Tanya soal listrik desa, Jam Emas, poin, atau hadiah Anda."
                    : "Tanya kondisi grid, partisipasi warga, stok voucher, atau simulasi BBM."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {saran.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => kirim(s)}
                      className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-xs text-violet-800 hover:bg-violet-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pesan.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={`max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2.5 ${
                    m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.role === "user" ? m.content : <TeksAsisten teks={m.content} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex">
                <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 text-slate-500">
                  <span className="animate-pulse">Memeriksa data…</span>
                </div>
              </div>
            )}
            <div ref={bawah} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              kirim(teks);
            }}
            className="flex gap-2 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              maxLength={500}
              placeholder="Tulis pertanyaan…"
              className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              disabled={busy || !teks.trim()}
              aria-label="Kirim"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
