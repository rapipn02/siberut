import { getAuth } from "firebase-admin/auth";
import { getAdmin } from "./firebaseAdmin";
import { cronDiizinkan } from "./cronAuth";
import { ambilBearer, operatorSah } from "./izin";
import type { OperatorRole } from "./types";

/** uid dari header `Authorization: Bearer <Firebase ID token>`, atau null. */
export async function uidDariToken(request: Request): Promise<string | null> {
  const token = ambilBearer(request.headers.get("authorization"));
  const admin = getAdmin();
  if (!token || !admin) return null;
  try {
    return (await getAuth(admin.app).verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export interface OperatorMasuk {
  uid: string;
  nama: string;
  role: OperatorRole;
}

/** Operator aktif pemilik token. `perluAdmin` = hanya Admin BUMDes. */
export async function operatorDariToken(
  request: Request,
  perluAdmin = false,
): Promise<OperatorMasuk | null> {
  const uid = await uidDariToken(request);
  const admin = getAdmin();
  if (!uid || !admin) return null;
  const data = (await admin.db.collection("operators").doc(uid).get()).data();
  if (!operatorSah(data, perluAdmin)) return null;
  return { uid, nama: String(data?.nama ?? "operator"), role: data?.role as OperatorRole };
}

/** Untuk route yang dipanggil cron server ATAU tombol di dashboard operator. */
export async function cronAtauOperator(request: Request, perluAdmin = false) {
  return cronDiizinkan(request) || Boolean(await operatorDariToken(request, perluAdmin));
}

export function tolakAkses(status: 401 | 403 = 401) {
  return Response.json(
    { ok: false, error: status === 401 ? "Tidak diizinkan." : "Akses ditolak." },
    { status },
  );
}

export interface WargaMasuk {
  uid: string;
  nama: string;
}

/** Warga (users/{uid} role WARGA) pemilik token. */
export async function wargaDariToken(request: Request): Promise<WargaMasuk | null> {
  const uid = await uidDariToken(request);
  const admin = getAdmin();
  if (!uid || !admin) return null;
  const data = (await admin.db.collection("users").doc(uid).get()).data();
  if (data?.role !== "WARGA") return null;
  return { uid, nama: String(data.nama ?? "Warga") };
}

/**
 * Operator ATAU warga pemilik token: token diverifikasi sekali, lalu kedua
 * dokumen peran dibaca paralel (lebih cepat dari operatorDariToken lalu wargaDariToken).
 */
export async function penggunaDariToken(
  request: Request,
): Promise<{ peran: "operator" | "warga"; uid: string; nama: string } | null> {
  const uid = await uidDariToken(request);
  const admin = getAdmin();
  if (!uid || !admin) return null;
  const [op, wg] = await Promise.all([
    admin.db.collection("operators").doc(uid).get(),
    admin.db.collection("users").doc(uid).get(),
  ]);
  if (operatorSah(op.data(), false)) return { peran: "operator", uid, nama: String(op.data()?.nama ?? "operator") };
  if (wg.data()?.role === "WARGA") return { peran: "warga", uid, nama: String(wg.data()?.nama ?? "Warga") };
  return null;
}
