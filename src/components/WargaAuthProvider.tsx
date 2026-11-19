"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { daftarWarga, loginWarga } from "@/lib/wargaAuth";
import type { AppUser } from "@/lib/types";

interface WargaContextValue {
  warga: AppUser | null;
  loading: boolean;
  masuk: typeof loginWarga;
  daftar: typeof daftarWarga;
  keluar: () => Promise<void>;
}

const WargaContext = createContext<WargaContextValue | null>(null);

export function WargaAuthProvider({ children }: { children: ReactNode }) {
  const [warga, setWarga] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    // Profil dibaca lewat onSnapshot, bukan getDoc: saat daftar, akun Auth
    // tercipta sebelum dokumen users/{uid} ditulis — snapshot menangkap
    // dokumen itu begitu muncul, tanpa balapan state.
    let lepasProfil: (() => void) | null = null;
    const lepasAuth = onAuthStateChanged(auth, (user) => {
      lepasProfil?.();
      lepasProfil = null;
      if (!user) {
        setWarga(null);
        setLoading(false);
        return;
      }
      lepasProfil = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          const data = snap.data() as AppUser | undefined;
          setWarga(data?.role === "WARGA" ? { ...data, uid: user.uid } : null);
          setLoading(false);
        },
        () => {
          setWarga(null);
          setLoading(false);
        },
      );
    });
    return () => {
      lepasProfil?.();
      lepasAuth();
    };
  }, []);

  const keluar = async () => {
    if (isFirebaseConfigured) await signOut(auth);
    setWarga(null);
  };

  return (
    <WargaContext.Provider
      value={{ warga, loading, masuk: loginWarga, daftar: daftarWarga, keluar }}
    >
      {children}
    </WargaContext.Provider>
  );
}

export function useWarga(): WargaContextValue {
  const ctx = useContext(WargaContext);
  if (!ctx) throw new Error("useWarga harus di dalam <WargaAuthProvider>");
  return ctx;
}
