"use client";

import { useMemo } from "react";
import { useWarga } from "@/components/WargaAuthProvider";
import { useAlatSaya, useSaldo } from "@/hooks/useWargaData";
import Link from "next/link";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { usePowerForecasts } from "@/hooks/usePowerForecasts";
import { useSessions } from "@/hooks/useSessions";
import { useBroadcasts, waktuRelatif } from "@/hooks/useBroadcasts";
import { jamEmasHariIni, sesiBeranda, statusWarga, titikTerdekat } from "@/lib/warga";
import { rencanaHemat } from "@/lib/alatWarga";
import { idr } from "@/lib/format";
import {
  INFO_STATUS,
  KartuPoin,
  KartuSesi,
  Kosong,
  PillStatus,
  jamWib,
  useSekarang,
  type StatusWarga,
} from "@/components/warga/ui";
import { Bell, ChevronRight, Sun, Zap } from "@/components/icons";

const BASI_MS = 4 * 3600_000; // ML memperbarui tiap 3 jam

export default function BerandaWargaPage() {
  const { warga } = useWarga();
  const { poin } = useSaldo(warga?.uid);
  const { status } = useSystemStatus();
  const { points } = usePowerForecasts();
  const { items: semuaSesi, loading: memuatSesi } = useSessions(30);
  const { items: imbauan } = useBroadcasts(3);
  const { items: alat } = useAlatSaya(warga?.uid);
  const sekarang = useSekarang();

  // Titik prakiraan terdekat dengan jam sekarang → surplus atau ikut status grid.
  const statusKini: StatusWarga = useMemo(
    () =>
      statusWarga(
        titikTerdekat(points, sekarang),
        status?.current_operating_status ?? status?.current_status,
      ),
    [points, status, sekarang],
  );
  const info = INFO_STATUS[statusKini];

  const diperbarui = status?.updated_at?.toDate?.();
  const basi = !diperbarui || sekarang - diperbarui.getTime() > BASI_MS;

  // Jam Emas dari prakiraan 24 jam ke depan; cadangan dari system_status.
  const jamEmas = useMemo(() => jamEmasHariIni(points, status), [points, status]);
  const rencana = useMemo(() => rencanaHemat(alat, jamEmas), [alat, jamEmas]);

  const sesi = useMemo(() => sesiBeranda(semuaSesi, sekarang), [semuaSesi, sekarang]);

  const nama = warga?.nama ?? "";

  return (
    <div>
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-white px-5 py-3.5 shadow-sm">
        <span className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center font-bold text-white">
          {nama.charAt(0).toUpperCase() || "W"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-black">Halo, {nama}</p>
          <p className="text-[11px] text-slate-500">Pulau Siberut, Mentawai</p>
        </div>
      </header>

      <div className="space-y-6 p-5">
        <section>
          <div className="flex items-center">
            <PillStatus status={statusKini} />
            <span className="flex-1" />
            <span
              className={`flex items-center gap-1.5 text-[10px] font-bold ${
                basi ? "text-slate-400" : "text-slate-500"
              }`}
              title={basi ? "Prakiraan belum diperbarui lebih dari 4 jam" : undefined}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  basi ? "bg-slate-400" : "bg-brand-600 animate-pulse"
                }`}
              />
              LIVE • {diperbarui ? jamWib(diperbarui) : "--:--"}
            </span>
          </div>
          <div className={`mt-2 flex items-center gap-2 rounded-xl p-3 ${info.kotak}`}>
            <info.Icon className={`w-4 h-4 shrink-0 ${info.teks}`} />
            <p className={`text-[11px] font-medium ${info.teks}`}>{info.tip}</p>
          </div>
        </section>

        <section>
          <h1 className="text-[28px] font-black leading-tight">Listrik Siberut</h1>
          <p className="text-[13px] text-slate-500">
            Kontribusi Anda menjaga desa tetap terang.
          </p>
        </section>

        <section className="rounded-3xl bg-slate-900 p-5 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-brand-400">
            <Sun className="w-4 h-4" />
            JAM EMAS HARI INI
          </p>
          {jamEmas ? (
            <>
              <p className="mt-2 text-[28px] font-black tracking-wide">{jamEmas.mulai} – {jamEmas.selesai}</p>
              <p className="mt-1 text-xs text-slate-300">
                Waktu terbaik menyalakan pompa air, setrika & mesin es.
                {jamEmas.surplusKw !== null && (
                  <> Surplus surya ±{jamEmas.surplusKw} kW.</>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-300">
              Hari ini surya diprediksi tidak melampaui beban. Hemat listrik sepanjang hari.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-base font-extrabold">Sesi Jam Emas</h2>
          <p className="text-[11px] text-slate-500">
            Kirim foto alat listrik saat sesi berlangsung untuk mendapat poin BUMDes.
          </p>
          <div className="mt-3 space-y-3">
            {memuatSesi ? (
              <div className="h-28 rounded-[20px] bg-slate-200/70 animate-pulse" />
            ) : sesi.length === 0 ? (
              <Kosong>
                Belum ada sesi Jam Emas minggu ini. Sesi dibuka otomatis saat listrik surya
                diprediksi melimpah, dan Anda akan mendapat pemberitahuan.
              </Kosong>
            ) : (
              sesi.map((s) => <KartuSesi key={s.id} sesi={s} />)
            )}
          </div>
        </section>

        <Link
          href="/warga/alat"
          className="flex items-center gap-4 rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <Zap className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold tracking-wide text-violet-700">
              RENCANA HEMAT HARI INI
            </span>
            {rencana.jadwal.length > 0 ? (
              <>
                <span className="block font-black">
                  {rencana.jadwal.length} alat di Jam Emas · {rencana.kwh} kWh
                </span>
                <span className="block text-xs text-slate-500">
                  Desa hemat ±{rencana.liter} L solar ({idr(rencana.rupiah)})
                </span>
              </>
            ) : (
              <>
                <span className="block font-black">Pindai label alat listrik Anda</span>
                <span className="block text-xs text-slate-500">
                  AI membaca daya alat, lalu menyusun jadwal pakai terbaik.
                </span>
              </>
            )}
          </span>
          <ChevronRight className="h-5 w-5 text-violet-400" />
        </Link>

        <KartuPoin poin={poin} />

        {imbauan.length > 0 && (
          <section>
            <h2 className="text-base font-extrabold">Imbauan BUMDes</h2>
            <ul className="mt-3 space-y-2">
              {imbauan.map((b) => (
                <li key={b.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-brand-50 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-brand-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{b.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{b.message}</p>
                    {b.timestamp?.toDate && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {waktuRelatif(b.timestamp.toDate())}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
