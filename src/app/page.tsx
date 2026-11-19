import { redirect } from "next/navigation";

/** Tidak ada halaman depan: pengunjung langsung ke login (yang juga menautkan portal warga). */
export default function Beranda() {
  redirect("/login");
}
