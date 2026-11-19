"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useForecastRefresh, useSessionTick } from "@/hooks/useSessionTick";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import PanelAsisten from "@/components/PanelAsisten";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();
  // Menu terbuka hanya untuk halaman tempat ia dibuka → pindah halaman otomatis menutupnya.
  const [menuDi, setMenuDi] = useState<string | null>(null);
  const menuOpen = menuDi === pathname;
  const setMenuOpen = (buka: boolean) => setMenuDi(buka ? pathname : null);
  useSessionTick();
  useForecastRefresh();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-page">
        <div className="flex items-center gap-2 text-slate-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-islandgrid.png"
            alt=""
            width={24}
            height={24}
            className="w-6 h-6 animate-pulse"
          />
          Memuat…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          aria-hidden
        />
      )}

      <div className="lg:ml-64 min-h-dvh bg-page">
        <Topbar onMenuClick={() => setMenuOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <PanelAsisten
        peran="operator"
        saran={[
          "Berapa defisit nanti malam?",
          "Hemat BBM kalau 50% warga ikut?",
          "Siapa 5 warga paling aktif?",
          "Ada pengajuan yang perlu ditinjau?",
        ]}
      />
    </div>
  );
}
