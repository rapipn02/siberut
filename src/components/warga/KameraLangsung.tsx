"use client";

import { useEffect, useRef, useState } from "react";
import { kompresFoto } from "@/lib/kompresFoto";
import { Camera, X } from "../icons";

/**
 * Kamera di dalam halaman (getUserMedia): foto diambil dari video langsung, jadi warga
 * tidak bisa memilih gambar lama dari galeri. Tidak ada <input type="file"> di sini.
 */
export default function KameraLangsung({
  bisaPotret,
  onFoto,
  onError,
}: {
  bisaPotret: boolean;
  onFoto: (base64: string) => void;
  onError: (pesan: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [aktif, setAktif] = useState(false);
  const [memotret, setMemotret] = useState(false);

  function tutup() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setAktif(false);
  }

  // Lampu kamera harus mati saat warga meninggalkan halaman.
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  async function buka() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError("Browser ini tidak mendukung kamera langsung. Buka portal lewat Chrome di HP.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      stream.current = s;
      setAktif(true);
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
    } catch (err) {
      const nama = err instanceof Error ? err.name : "";
      onError(
        nama === "NotAllowedError"
          ? "Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi."
          : nama === "NotFoundError"
            ? "Kamera tidak ditemukan di perangkat ini."
            : "Kamera tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.",
      );
    }
  }

  async function potret() {
    const v = video.current;
    if (!v || !v.videoWidth || memotret) return;
    setMemotret(true);
    try {
      onFoto(await kompresFoto(v));
    } catch {
      onError("Foto gagal diambil. Coba lagi.");
    } finally {
      setMemotret(false);
    }
  }

  return (
    <div className="mt-4">
      {/* Video selalu ada di DOM agar ref siap saat stream dipasang; disembunyikan bila kamera mati. */}
      <div className={aktif ? "overflow-hidden rounded-2xl bg-black" : "hidden"}>
        <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
      </div>

      {aktif ? (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          <button
            type="button"
            onClick={potret}
            disabled={!bisaPotret || memotret}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Camera className="h-5 w-5" /> {memotret ? "Memotret…" : "Potret"}
          </button>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup kamera"
            className="flex items-center justify-center rounded-xl border border-slate-200 px-4 text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={buka}
          disabled={!bisaPotret}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold disabled:opacity-50"
        >
          <Camera className="h-5 w-5" /> Buka Kamera
        </button>
      )}
      <p className="mt-2 text-[11px] text-slate-400">
        Foto diambil langsung dari kamera. Foto dari galeri tidak bisa dipakai.
      </p>
    </div>
  );
}
