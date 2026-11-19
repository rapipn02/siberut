"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWarga } from "./WargaAuthProvider";
import { useSaldo } from "@/hooks/useWargaData";
import { BarChart, Gift, Home, LogOut, Star, User, Zap } from "./icons";

const TAB = [
  { href: "/warga", label: "Beranda", Icon: Home },
  { href: "/warga/analitik", label: "Analisis", Icon: BarChart },
  { href: "/warga/hadiah", label: "Hadiah", Icon: Gift },
  { href: "/warga/profil", label: "Profil", Icon: User },
];

/** Menu desktop: sama dengan TAB, ditambah Alat Saya yang di HP dibuka dari Beranda. */
const MENU_DESKTOP = [
  TAB[0],
  { href: "/warga/alat", label: "Alat Saya", Icon: Zap },
  ...TAB.slice(1),
];

function aktifDi(pathname: string, href: string, desktop: boolean) {
  if (href !== "/warga") return pathname.startsWith(href);
  // Di HP, detail sesi & Alat Saya bagian dari Beranda. Di desktop Alat Saya punya menu sendiri.
  return (
    pathname === "/warga" ||
    pathname.startsWith("/warga/sesi") ||
    (!desktop && pathname.startsWith("/warga/alat"))
  );
}

/** HP & tablet: navigasi bawah. */
export default function WargaNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:max-w-3xl lg:hidden">
      <ul className="grid grid-cols-4">
        {TAB.map(({ href, label, Icon }) => {
          const aktif = aktifDi(pathname, href, false);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className="flex flex-col items-center gap-1 py-2.5"
              >
                <span
                  className={`flex items-center justify-center w-14 h-8 rounded-full transition ${
                    aktif ? "bg-brand-100 text-brand-700" : "text-slate-500"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span
                  className={`text-xs ${
                    aktif ? "font-bold text-slate-900" : "font-medium text-slate-500"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Laptop: sidebar kiri, gaya sama dengan Sidebar operator. */
export function SidebarWarga() {
  const pathname = usePathname();
  const { keluar } = useWarga();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-islandgrid.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
        <span className="text-lg font-bold">
          Listrik<span className="text-brand-600">Siberut</span>
        </span>
      </div>

      <nav className="mt-2 flex-1 px-3 text-sm">
        <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-slate-400">MENU</p>
        {MENU_DESKTOP.map(({ href, label, Icon }) => {
          const aktif = aktifDi(pathname, href, true);
          return (
            <Link
              key={href}
              href={href}
              aria-current={aktif ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${
                aktif ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span
                className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded bg-brand-600 transition-opacity ${
                  aktif ? "opacity-100" : "opacity-0"
                }`}
              />
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}

        <p className="mt-5 mb-1 px-3 text-[11px] font-semibold tracking-wide text-slate-400">AKUN</p>
        <button
          type="button"
          onClick={() => keluar()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Keluar
        </button>
      </nav>

      <div className="m-4 rounded-xl bg-gradient-to-br from-slate-800 to-brand-900 p-4 text-white">
        <p className="text-sm font-semibold">Jam Emas</p>
        <p className="mt-0.5 mb-3 text-xs text-slate-300">
          Nyalakan alat berat saat surya melimpah, kirim fotonya, dapat poin.
        </p>
        <Link
          href="/warga"
          className="inline-block rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold hover:bg-brand-500"
        >
          Lihat sesi
        </Link>
      </div>
    </aside>
  );
}

/** Laptop: topbar, gaya sama dengan Topbar operator. */
export function TopbarWarga() {
  const { warga } = useWarga();
  const { poin } = useSaldo(warga?.uid);
  const nama = warga?.nama ?? "Warga";

  return (
    <header className="sticky top-0 z-20 hidden items-center gap-3 border-b border-slate-200 bg-white/90 px-8 py-4 backdrop-blur lg:flex">
      <div>
        <p className="font-semibold">Halo, {nama}</p>
        <p className="text-xs text-slate-500">Pulau Siberut, Mentawai</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/warga/hadiah"
          className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-slate-50"
        >
          <Star className="h-4 w-4 fill-brand-600 text-brand-600" />
          {poin} poin
        </Link>
        <div className="flex items-center gap-3 pl-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {nama.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{nama}</span>
              <span className="whitespace-nowrap rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                Warga
              </span>
            </div>
            <span className="text-xs text-slate-500">{warga?.email}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
