import type { AnalisisFoto } from "@/lib/mataAi";
import { AMBANG_KEYAKINAN, estimasiKwh } from "@/lib/mataAi";

const LABEL_INDIKASI: Record<AnalisisFoto["indikasiKecurangan"], string> = {
  tidak: "Foto asli",
  foto_layar: "Foto layar HP/monitor",
  bukan_alat_listrik: "Bukan alat listrik",
  gambar_internet: "Mirip gambar internet",
  tidak_jelas: "Foto tidak jelas",
};

/** Hasil Mata AI (Gemini Vision) untuk satu pengajuan — dipakai operator saat meninjau. */
export default function PanelAi({ ai }: { ai: AnalisisFoto }) {
  const persen = Math.round(Math.max(0, Math.min(1, ai.keyakinan)) * 100);
  const ragu = ai.keyakinan < AMBANG_KEYAKINAN;
  const curiga = ai.indikasiKecurangan !== "tidak";

  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
        curiga || ragu || !ai.tampakDigunakan
          ? "border-amber-200 bg-amber-50"
          : "border-violet-200 bg-violet-50"
      }`}
    >
      <p className="flex items-center gap-1.5 font-semibold text-violet-700">
        Mata AI
        <span className="font-normal text-slate-500">· keyakinan {persen}%</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ai.alat.length === 0 ? (
          <span className="text-slate-500">Tidak ada alat terdeteksi</span>
        ) : (
          ai.alat.map((a, i) => (
            <span key={i} className="rounded-full bg-white px-2 py-0.5 text-slate-700 border border-slate-200">
              {a.nama} · ±{Math.round(a.estimasiWatt)} W
            </span>
          ))
        )}
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            ai.tampakDigunakan ? "bg-brand-100 text-brand-800" : "bg-slate-200 text-slate-600"
          }`}
        >
          {ai.tampakDigunakan ? "Tampak dipakai" : "Tidak tampak dipakai"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            curiga ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-800"
          }`}
        >
          {LABEL_INDIKASI[ai.indikasiKecurangan]}
        </span>
      </div>
      <p className="mt-1.5 text-slate-700">{ai.alasan}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Perkiraan beban digeser: {estimasiKwh(ai)} kWh (asumsi 1 jam pemakaian).
      </p>
    </div>
  );
}
