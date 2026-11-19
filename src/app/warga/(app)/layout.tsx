"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWarga } from "@/components/WargaAuthProvider";
import WargaNav from "@/components/WargaNav";
import PanelAsisten from "@/components/PanelAsisten";
import { useNotifikasiWarga } from "@/hooks/useNotifikasiBrowser";
import { Bell, X, Zap } from "@/components/icons";

export default function WargaAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { warga, loading } = useWarga();

  useEffect(() => {
    if (!loading && !warga) router.replace("/warga/masuk");
  }, [loading, warga, router]);

  if (loading || !warga) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center animate-pulse">
          <Zap className="w-6 h-6 text-white fill-white" />
        </span>
      </div>
    );
  }

  return (
    <>
      <main className="pb-24">{children}</main>
      <Pemberitahuan />
      <PanelAsisten
        peran="warga"
        saran={[
          "Kapan sebaiknya saya nyuci hari ini?",
          "Poin saya cukup untuk tukar apa?",
          "Gimana kondisi listrik desa sekarang?",
        ]}
      />
      <WargaNav />
    </>
  );
}

function Pemberitahuan() {
  const { toast, tutup } = useNotifikasiWarga();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(tutup, 8000);
    return () => clearTimeout(t);
  }, [toast, tutup]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-3 z-50 mx-auto flex max-w-md items-start gap-3 px-4"
    >
      <div className="flex w-full items-start gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-xl">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{toast.judul}</p>
          <p className="mt-0.5 text-xs text-slate-300">{toast.isi}</p>
        </div>
        <button type="button" aria-label="Tutup pemberitahuan" onClick={tutup}>
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
