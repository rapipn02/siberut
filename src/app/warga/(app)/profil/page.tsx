"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWarga } from "@/components/WargaAuthProvider";
import { useRiwayatKontribusi, useRiwayatTukar, useSaldo } from "@/hooks/useWargaData";
import { useIzinNotifikasi } from "@/hooks/useNotifikasiBrowser";
import { ringkasKontribusi } from "@/lib/warga";
import DampakSaya from "@/components/warga/DampakSaya";
import { Kosong, jamWib, tanggalWib } from "@/components/warga/ui";
import {
  Bell,
  CheckCircle,
  Clock,
  Gift,
  History,
  LogOut,
  XCircle,
} from "@/components/icons";
import type { ParticipationRequest } from "@/lib/types";

const GAYA_STATUS = {
  APPROVED: { Icon: CheckCircle, warna: "text-brand-600", latar: "bg-brand-600/10", label: "Disetujui" },
  REJECTED: { Icon: XCircle, warna: "text-red-500", latar: "bg-red-500/10", label: "Ditolak" },
  PENDING: { Icon: Clock, warna: "text-amber-500", latar: "bg-amber-500/10", label: "Menunggu" },
} as const;

export default function ProfilWargaPage() {
  const router = useRouter();
  const { warga, keluar } = useWarga();
  const { poin } = useSaldo(warga?.uid);
  const { items: kontribusi, loading: memuatKontribusi } = useRiwayatKontribusi(warga?.uid);
  const { items: tukar, loading: memuatTukar } = useRiwayatTukar(warga?.uid);
  const { izin, minta } = useIzinNotifikasi();
  const [tab, setTab] = useState<"kontribusi" | "tukar">("kontribusi");

  const ringkas = ringkasKontribusi(kontribusi);
  const nama = warga?.nama ?? "";

  async function handleKeluar() {
    await keluar();
    router.replace("/warga/masuk");
  }

  return (
    <div className="p-5">
      <section className="flex flex-col items-center pt-4 text-center">
        <span className="flex h-[110px] w-[110px] items-center justify-center rounded-full border-4 border-brand-600/10 bg-white text-5xl font-black text-brand-600">
          {nama.charAt(0).toUpperCase() || "W"}
        </span>
        <h1 className="mt-4 text-2xl font-black">{nama}</h1>
        <p className="text-sm text-slate-500">{warga?.email}</p>
        {warga?.phone && <p className="text-xs text-slate-400">{warga.phone}</p>}
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Angka label="Saldo Poin" nilai={poin} />
        <Angka label="Aksi Hemat" nilai={ringkas.aksi} />
        <Angka label="Poin Didapat" nilai={ringkas.poin} />
      </section>

      <DampakSaya riwayat={kontribusi} />

      {izin !== "granted" && izin !== "tidak-didukung" && (
        <button
          type="button"
          onClick={minta}
          disabled={izin === "denied"}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-brand-600/20 bg-brand-50 p-4 text-left disabled:opacity-70"
        >
          <Bell className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="text-sm">
            <span className="block font-bold">
              {izin === "denied" ? "Notifikasi diblokir" : "Aktifkan Notifikasi"}
            </span>
            <span className="text-xs text-slate-500">
              {izin === "denied"
                ? "Izinkan lewat pengaturan situs di browser."
                : "Dapat kabar saat Jam Emas dimulai atau ada imbauan BUMDes."}
            </span>
          </span>
        </button>
      )}

      <div className="mt-6 grid grid-cols-2 h-10 p-1 rounded-full bg-slate-200/70">
        <TabTombol aktif={tab === "kontribusi"} onClick={() => setTab("kontribusi")}>
          <History className="h-4 w-4" /> Kontribusi
        </TabTombol>
        <TabTombol aktif={tab === "tukar"} onClick={() => setTab("tukar")}>
          <Gift className="h-4 w-4" /> Penukaran
        </TabTombol>
      </div>

      <section className="mt-3 space-y-2">
        {tab === "kontribusi" ? (
          memuatKontribusi ? (
            <Kerangka />
          ) : kontribusi.length === 0 ? (
            <Kosong>Belum ada riwayat partisipasi.</Kosong>
          ) : (
            kontribusi.map((r) => <KartuRiwayat key={r.id} r={r} />)
          )
        ) : memuatTukar ? (
          <Kerangka />
        ) : tukar.length === 0 ? (
          <Kosong>Belum pernah menukar hadiah.</Kosong>
        ) : (
          tukar.map((t) => {
            const waktu = t.timestamp?.toDate?.();
            return (
              <div key={t.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center">
                  <p className="flex-1 font-bold">{t.nama_hadiah}</p>
                  <p className="text-sm font-black text-red-500">-{t.biaya_poin}</p>
                </div>
                <p className="mt-1 select-all font-mono text-sm font-bold tracking-wider text-brand-700">
                  {t.kode_diberikan}
                </p>
                {waktu && (
                  <p className="text-[11px] text-slate-400">
                    {tanggalWib(waktu)}, {jamWib(waktu)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>

      <button
        type="button"
        onClick={handleKeluar}
        className="mt-8 flex w-full items-center gap-4 border-t border-slate-900/5 py-4 font-bold text-red-500"
      >
        <LogOut className="h-5 w-5" /> Keluar Akun
      </button>
    </div>
  );
}

function KartuRiwayat({ r }: { r: ParticipationRequest }) {
  const ditinjau = r.status === "PENDING" && Boolean(r.aiAnalisis);
  const g = ditinjau
    ? { ...GAYA_STATUS.PENDING, label: "Ditinjau" }
    : (GAYA_STATUS[r.status] ?? GAYA_STATUS.PENDING);
  const alatAi = r.aiAnalisis?.alat
    .map((a) => `${a.nama} ±${Math.round(a.estimasiWatt)} W`)
    .join(", ");
  const waktu = r.timestamp?.toDate?.();
  const poin = r.poinDiberikan ?? 0;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${g.latar}`}>
          <g.Icon className={`h-6 w-6 ${g.warna}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Jam Emas {r.goldenHourRange || ""}</p>
          <p className="text-[11px] text-slate-500">
            {waktu ? `${tanggalWib(waktu)}, ${jamWib(waktu)}` : "Baru saja"}
          </p>
        </div>
        <p className={`text-sm font-black ${poin > 0 ? "text-brand-600" : g.warna}`}>
          {poin > 0 ? `+${poin} Poin` : g.label}
        </p>
      </div>
      {r.status === "APPROVED" && alatAi && (
        <p className="mt-2 rounded-lg bg-violet-50 px-3 py-1.5 text-[11px] text-violet-700">
          Diverifikasi Mata AI: {alatAi}
          {r.estimasiKwh ? ` · ±${r.estimasiKwh} kWh digeser ke Jam Emas` : ""}
        </p>
      )}
      {ditinjau && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
          Ditinjau petugas: {r.aiAnalisis?.alasan}
        </p>
      )}
      {r.status === "REJECTED" && r.verificationReason && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] text-red-600">
          {r.verificationReason}
        </p>
      )}
    </div>
  );
}

function Angka({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-xl font-black">{nilai}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function TabTombol({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-full text-xs font-bold transition ${
        aktif ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function Kerangka() {
  return <div className="h-20 rounded-2xl bg-slate-200/70 animate-pulse" />;
}
