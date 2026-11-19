import { getAdmin } from "@/lib/firebaseAdmin";
import { cronAtauOperator, operatorDariToken, tolakAkses } from "@/lib/authServer";
import { buatBriefing } from "@/lib/briefingServer";

/** Buat ulang briefing Analis AI. Cron: hanya bila sudah basi; operator boleh memaksa. */
export async function POST(request: Request) {
  if (!(await cronAtauOperator(request))) return tolakAkses();
  const admin = getAdmin();
  if (!admin) {
    return Response.json({ ok: false, error: "Kredensial admin belum dikonfigurasi." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const paksa = body?.paksa === true && Boolean(await operatorDariToken(request));
  try {
    const hasil = await buatBriefing(admin.db, { paksa });
    return Response.json({ ok: true, hasil });
  } catch (err) {
    console.error("briefing gagal:", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "Gagal menyusun briefing." }, { status: 500 });
  }
}
