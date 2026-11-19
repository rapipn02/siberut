"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWarga } from "./WargaAuthProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import { pesanRamah } from "@/lib/pesanAuth";
import { Zap } from "./icons";

const DEMO = { email: "warga@siberut.id", sandi: "password123" };

const INPUT =
  "w-full px-4 py-3.5 rounded-2xl bg-white border border-slate-200 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500";

export default function FormAkunWarga({ awal }: { awal: "masuk" | "daftar" }) {
  const router = useRouter();
  const { warga, loading, masuk, daftar } = useWarga();
  const [tab, setTab] = useState(awal);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && warga) router.replace("/warga");
  }, [loading, warga, router]);

  function gantiTab(t: "masuk" | "daftar") {
    setTab(t);
    setError("");
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !sandi) {
      setError("Email dan kata sandi tidak boleh kosong.");
      return;
    }
    setBusy(true);
    try {
      if (tab === "masuk") await masuk(email, sandi);
      else await daftar({ nama, email, sandi, phone: hp });
      router.replace("/warga");
    } catch (err) {
      setError(pesanRamah(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-14 pb-8">
      <div className="flex flex-col items-center text-center">
        <div className="w-[72px] h-[72px] rounded-full bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
          <Zap className="w-10 h-10 text-white fill-white" />
        </div>
        <h1 className="mt-5 text-[32px] leading-tight font-black tracking-tight">
          ListrikSiberut
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kendali energi mandiri di ujung jari Anda.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-2 h-12 p-1 rounded-full bg-slate-200/70">
        {(["masuk", "daftar"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => gantiTab(t)}
            className={`rounded-full text-sm font-bold transition ${
              tab === t ? "bg-white text-brand-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t === "masuk" ? "Masuk" : "Daftar"}
          </button>
        ))}
      </div>

      {!isFirebaseConfigured && (
        <p className="mt-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Firebase belum dikonfigurasi. Isi <code>.env.local</code> dulu.
        </p>
      )}

      <form onSubmit={kirim} className="mt-8 space-y-3">
        {tab === "daftar" && (
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama Lengkap"
            autoComplete="name"
            className={INPUT}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className={INPUT}
        />
        <input
          type="password"
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          placeholder="Kata Sandi"
          autoComplete={tab === "masuk" ? "current-password" : "new-password"}
          className={INPUT}
        />
        {tab === "daftar" && (
          <input
            type="tel"
            inputMode="tel"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            placeholder="Nomor HP"
            autoComplete="tel"
            className={INPUT}
          />
        )}

        {error && (
          <p role="alert" className="text-center text-xs font-medium text-red-500 pt-1">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full h-14 mt-2 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-base font-extrabold transition"
        >
          {busy ? "Memproses…" : tab === "masuk" ? "Masuk" : "Daftar Sekarang"}
        </button>
      </form>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => {
          gantiTab("masuk");
          setEmail(DEMO.email);
          setSandi(DEMO.sandi);
        }}
        className="mt-10 w-full rounded-3xl border border-brand-600/20 bg-brand-600/5 p-4 text-left"
      >
        <p className="text-[13px] font-bold text-brand-600">Coba Aplikasi Sebagai Warga</p>
        <p className="text-sm font-black mt-1">Isi Akun Demo Warga</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {DEMO.email} · {DEMO.sandi}
        </p>
      </button>

      <p className="text-center text-xs text-slate-400 mt-5">
        Operator BUMDes/PLTD?{" "}
        <Link href="/login" className="font-semibold text-slate-600 hover:underline">
          Masuk dashboard
        </Link>
      </p>
    </div>
  );
}
