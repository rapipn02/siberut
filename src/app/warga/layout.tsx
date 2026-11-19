import type { Metadata, Viewport } from "next";
import { WargaAuthProvider } from "@/components/WargaAuthProvider";

export const metadata: Metadata = {
  title: "ListrikSiberut — Portal Warga",
  description:
    "Jam Emas listrik surya, klaim poin BUMDes, dan tukar hadiah untuk warga Pulau Siberut.",
};

export const viewport: Viewport = {
  themeColor: "#16A34A",
  viewportFit: "cover",
};

export default function WargaLayout({ children }: { children: React.ReactNode }) {
  return (
    <WargaAuthProvider>
      <div className="min-h-dvh bg-slate-200/60">
        <div className="mx-auto max-w-md min-h-dvh bg-slate-50 shadow-sm">{children}</div>
      </div>
    </WargaAuthProvider>
  );
}
