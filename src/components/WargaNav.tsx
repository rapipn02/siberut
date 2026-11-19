"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart, Gift, Home, User } from "./icons";

const TAB = [
  { href: "/warga", label: "Beranda", Icon: Home },
  { href: "/warga/analitik", label: "Analisis", Icon: BarChart },
  { href: "/warga/hadiah", label: "Hadiah", Icon: Gift },
  { href: "/warga/profil", label: "Profil", Icon: User },
];

export default function WargaNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-md bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TAB.map(({ href, label, Icon }) => {
          // Detail sesi bagian dari Beranda.
          const aktif =
            href === "/warga"
              ? pathname === "/warga" || pathname.startsWith("/warga/sesi")
              : pathname.startsWith(href);
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
