"use client";

import Link from "next/link";
import type { LoadShiftSession } from "@/lib/types";
import type { StatusWarga } from "@/lib/warga";
import { AlertTriangle, CheckCircle, ChevronRight, Star, Sun } from "../icons";

export { jamWib, tanggalWib } from "@/lib/waktu";

export { useSekarang } from "@/hooks/useSekarang";

export type { StatusWarga };

export const INFO_STATUS: Record<
  StatusWarga,
  { pill: string; kotak: string; teks: string; tip: string; Icon: typeof Sun }
> = {
  SURPLUS: {
    pill: "bg-brand-600",
    kotak: "bg-brand-600/5",
    teks: "text-brand-700",
    tip: "Surplus energi! Waktunya menyalakan alat berat (pompa/setrika) agar hemat BBM desa.",
    Icon: Sun,
  },
  NORMAL: {
    pill: "bg-brand-600",
    kotak: "bg-brand-600/5",
    teks: "text-brand-700",
    tip: "Kondisi normal: pasokan daya mencukupi beban desa.",
    Icon: CheckCircle,
  },
  WARNING: {
    pill: "bg-amber-500",
    kotak: "bg-amber-500/10",
    teks: "text-amber-700",
    tip: "Waspada: potensi penurunan daya surya ≤ 20%. Bijak gunakan listrik.",
    Icon: AlertTriangle,
  },
  ALERT: {
    pill: "bg-red-500",
    kotak: "bg-red-500/10",
    teks: "text-red-600",
    tip: "Defisit daya surya > 20%! Segera kurangi pemakaian alat listrik berat.",
    Icon: AlertTriangle,
  },
};

export function PillStatus({ status }: { status: StatusWarga }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white ${INFO_STATUS[status].pill}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      {status}
    </span>
  );
}

export function KartuPoin({ poin }: { poin: number }) {
  return (
    <div className="flex items-center rounded-3xl border border-brand-600/10 bg-brand-50 p-5">
      <div className="flex-1">
        <p className="text-[11px] font-extrabold tracking-wide text-brand-600">
          SALDO POIN BUMDes
        </p>
        <p className="text-[44px] leading-tight font-black text-brand-700">{poin}</p>
        <p className="flex items-center gap-1 text-[11px] font-bold text-brand-600">
          <CheckCircle className="w-3.5 h-3.5" />
          Terverifikasi otomatis
        </p>
      </div>
      <span className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
        <Star className="w-8 h-8 text-brand-600 fill-brand-600" />
      </span>
    </div>
  );
}

const LABEL_SESI = {
  ACTIVE: "SEDANG BERLANGSUNG",
  UPCOMING: "MENDATANG",
  ENDED: "SESI BERAKHIR",
} as const;

export function KartuSesi({ sesi }: { sesi: LoadShiftSession }) {
  const aktif = sesi.status === "ACTIVE";
  const selesai = sesi.status === "ENDED";

  return (
    <Link
      href={`/warga/sesi/${sesi.id}`}
      className={`flex items-center rounded-[20px] border bg-white p-5 transition active:scale-[0.99] ${
        aktif
          ? "border-brand-600/50 shadow-lg shadow-brand-600/10"
          : "border-slate-900/10 shadow-sm"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold">
          <span
            className={`w-2 h-2 rounded-full ${
              aktif ? "bg-brand-600 animate-pulse" : selesai ? "bg-slate-300" : "bg-amber-500"
            }`}
          />
          <span className={aktif ? "text-brand-600" : "text-slate-500"}>
            {LABEL_SESI[sesi.status]}
          </span>
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500">{sesi.date}</p>
        <p
          className={`text-[22px] font-black ${selesai ? "text-slate-400" : "text-slate-900"}`}
        >
          {sesi.startTime} - {sesi.endTime} WIB
        </p>
        {aktif && (
          <span className="inline-block mt-2 rounded-lg bg-brand-600/10 px-2.5 py-1 text-[11px] font-bold text-brand-600">
            Klaim +{sesi.poin_per_partisipasi ?? 0} Poin Sekarang
          </span>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <ChevronRight className={`w-6 h-6 ${aktif ? "text-brand-600" : "text-slate-300"}`} />
        {selesai && <CheckCircle className="w-4 h-4 text-brand-600/50" />}
      </div>
    </Link>
  );
}

export function Kosong({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-[13px] text-slate-500 shadow-sm">
      {children}
    </div>
  );
}
