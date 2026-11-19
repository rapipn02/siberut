import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { AppUser } from "./types";

const BUKAN_WARGA = "Akun ini bukan akun warga.";

export async function loginWarga(email: string, sandi: string): Promise<AppUser> {
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), sandi);
  const profil = await getDoc(doc(db, "users", user.uid));

  if (profil.exists()) {
    const data = profil.data() as AppUser;
    if (data.role !== "WARGA") {
      await signOut(auth);
      throw new Error(BUKAN_WARGA);
    }
    return { ...data, uid: user.uid };
  }

  // Tanpa profil: operator → tolak. Selain itu, pendaftaran sempat terputus
  // (akun Auth tercipta tapi users/{uid} tidak tertulis) → pulihkan profilnya
  // supaya warga tidak terkunci selamanya.
  if ((await getDoc(doc(db, "operators", user.uid))).exists()) {
    await signOut(auth);
    throw new Error(BUKAN_WARGA);
  }
  const alamat = user.email ?? email.trim();
  const warga: AppUser = {
    uid: user.uid,
    nama: (user as { displayName?: string | null }).displayName || alamat.split("@")[0],
    email: alamat,
    phone: "",
    role: "WARGA",
  };
  await setDoc(doc(db, "users", user.uid), warga);
  return warga;
}

export interface DataDaftar {
  nama: string;
  email: string;
  sandi: string;
  phone: string;
}

export async function daftarWarga(d: DataDaftar): Promise<AppUser> {
  const nama = d.nama.trim();
  if (!nama) throw new Error("Nama lengkap wajib diisi.");
  if (d.sandi.length < 6) throw new Error("Kata sandi minimal 6 karakter.");

  const cred = await createUserWithEmailAndPassword(auth, d.email.trim(), d.sandi);
  const warga: AppUser = {
    uid: cred.user.uid,
    nama,
    email: d.email.trim(),
    phone: d.phone.trim(),
    role: "WARGA",
  };
  try {
    await setDoc(doc(db, "users", warga.uid), warga);
  } catch {
    // Batalkan akun Auth agar email bisa didaftarkan ulang.
    try {
      await deleteUser(cred.user);
    } catch {
      // Gagal menghapus pun, login nanti memulihkan profil (lihat loginWarga).
    }
    throw new Error("Pendaftaran gagal. Periksa koneksi lalu coba lagi.");
  }
  return warga;
}
