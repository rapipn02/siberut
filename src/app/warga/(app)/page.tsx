"use client";

import { useMemo } from "react";
import { useWarga } from "@/components/WargaAuthProvider";
import { useSaldo } from "@/hooks/useWargaData";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { usePowerForecasts } from "@/hooks/usePowerForecasts";
import { useSessions } from "@/hooks/useSessions";
import { useBroadcasts, waktuRelatif } from "@/hooks/useBroadcasts";
import { findGreenWindow } from "@/lib/greenHours";
import { statusWarga, titikTerdekat, urutSesiWarga } from "@/lib/warga";
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
import { Bell, Sun } from "@/components/icons";

const BASI_MS = 4 * 3600_000; // ML memperbarui tiap 3 jam
const MAKS_SESI_SELESAI = 3;

export default function BerandaWargaPage() {
  const { warga } = useWarga();
  const { poin } = useSaldo(warga?.uid);
  const { status } = useSystemStatus();
  const { points } = usePowerForecasts();
  const { items: semuaSesi, loading: memuatSesi } = useSessions(30);
  const { items: imbauan } = useBroadcasts(3);
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
  const jamEmas = useMemo(() => {
    const w = findGreenWindow(points.slice(0, 25));
    if (w) return { teks: `${w.mulai} – ${w.selesai}`, surplus: w.surplusKw };
    if (status?.golden_hour_start && status.golden_hour_end) {
      return { teks: `${status.golden_hour_start} – ${status.golden_hour_end}`, surplus: null };
    }
    return null;
  }, [points, status]);

  const sesi = useMemo(() => {
    const urut = urutSesiWarga(semuaSesi);
    const berjalan = urut.filter((s) => s.status !== "ENDED");
    const selesai = urut.filter((s) => s.status === "ENDED").slice(0, MAKS_SESI_SELESAI);
    return [...berjalan, ...selesai];
  }, [semuaSesi]);

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
              <p className="mt-2 text-[28px] font-black tracking-wide">{jamEmas.teks}</p>
              <p className="mt-1 text-xs text-slate-300">
                Waktu terbaik menyalakan pompa air, setrika & mesin es.
                {jamEmas.surplus !== null && (
                  <> Surplus surya ±{jamEmas.surplus} kW.</>
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
              <Kosong>Belum ada jadwal sesi yang terdaftar.</Kosong>
            ) : (
              sesi.map((s) => <KartuSesi key={s.id} sesi={s} />)
            )}
          </div>
        </section>

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
