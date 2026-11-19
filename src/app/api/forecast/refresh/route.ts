import { cronAtauOperator, tolakAkses } from "@/lib/authServer";
import { getAdmin } from "@/lib/firebaseAdmin";
import { buatBriefing } from "@/lib/briefingServer";

const TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  // Memicu run model ML (mahal) — hanya cron server atau operator.
  if (!(await cronAtauOperator(request))) return tolakAkses();

  const base = process.env.ISLANDGRID_API_BASE_URL;
  const key = process.env.ISLANDGRID_API_KEY;

  if (!base || !key) {
    return Response.json(
      { ok: false, error: "Layanan prediksi belum dikonfigurasi." },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/forecast/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-IslandGrid-Key": key,
      },
      body: JSON.stringify({ hours: 48, sync_firestore: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return Response.json(
        { ok: false, error: `Layanan ML membalas ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Prakiraan baru → perbarui briefing Analis AI (dibatasi tiap 2 jam di dalamnya).
    const admin = getAdmin();
    const briefing = admin
      ? await buatBriefing(admin.db).catch(() => "gagal" as const)
      : null;
    return Response.json({
      ok: true,
      current_status: data?.current_status ?? null,
      records: Array.isArray(data?.forecasts) ? data.forecasts.length : null,
      briefing,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return Response.json(
      {
        ok: false,
        error: aborted
          ? "Layanan prediksi tidak merespons (timeout)."
          : "Layanan prediksi tidak tersedia.",
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}
