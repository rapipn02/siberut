import { getAdmin } from "@/lib/firebaseAdmin";
import { cronAtauOperator, operatorDariToken, tolakAkses } from "@/lib/authServer";
import { daftarTanggal, hitungStatistikHari, hitungStatistikTerkini } from "@/lib/statistikServer";

/**
 * Hitung `statistik_harian`. Cron: hari ini + kemarin. Operator boleh mengisi
 * riwayat lewat `{ dariTanggal: "YYYY-MM-DD" }` (maks 120 hari).
 */
export async function POST(request: Request) {
  if (!(await cronAtauOperator(request))) return tolakAkses();
  const admin = getAdmin();
  if (!admin) return Response.json({ ok: false, error: "Kredensial admin belum dikonfigurasi." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const dari = typeof body?.dariTanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dariTanggal)
    ? body.dariTanggal
    : null;

  try {
    if (dari && (await operatorDariToken(request))) {
      const tanggal = daftarTanggal(dari, Date.now());
      for (const t of tanggal) await hitungStatistikHari(admin.db, t);
      return Response.json({ ok: true, hari: tanggal.length, dari: tanggal[0], sampai: tanggal.at(-1) });
    }
    const hasil = await hitungStatistikTerkini(admin.db);
    return Response.json({ ok: true, hari: hasil.length });
  } catch (err) {
    console.error("statistik gagal:", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "Gagal menghitung statistik." }, { status: 500 });
  }
}
