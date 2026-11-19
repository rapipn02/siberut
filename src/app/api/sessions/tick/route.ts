import { Timestamp } from "firebase-admin/firestore";
import { getAdmin } from "@/lib/firebaseAdmin";
import { cronAtauOperator, tolakAkses } from "@/lib/authServer";
import { ringkasDampak } from "@/lib/fuel";
import { hitungStatistikTerkini } from "@/lib/statistikServer";

export async function POST(request: Request) {
  if (!(await cronAtauOperator(request))) return tolakAkses();

  const admin = getAdmin();
  if (!admin) {
    return Response.json(
      { ok: false, error: "Kredensial admin belum dikonfigurasi." },
      { status: 503 },
    );
  }
  const { db } = admin;
  const sekarang = Date.now();

  try {
    const fcSnap = await db
      .collection("power_forecasts")
      .where("timestamp", ">=", Timestamp.fromMillis(sekarang - 3600_000))
      .orderBy("timestamp", "asc")
      .limit(1)
      .get();
    const bebanSekarang = fcSnap.empty
      ? 0
      : Math.round((fcSnap.docs[0].data().projected_load_kw ?? 0) * 10) / 10;

    // Tanpa foto (select) — dokumen pengajuan bisa ~0,9 MB masing-masing.
    const partisipasiSnap = await db
      .collection("participation_requests")
      .where("status", "==", "APPROVED")
      .select("windowId", "estimasiKwh", "verifiedAt")
      .get();
    const hitungPeserta = new Map<string, number>();
    const kwhPerSesi = new Map<string, number>();
    for (const d of partisipasiSnap.docs) {
      const { windowId: wid, estimasiKwh } = d.data();
      if (!wid) continue;
      hitungPeserta.set(wid, (hitungPeserta.get(wid) ?? 0) + 1);
      kwhPerSesi.set(wid, (kwhPerSesi.get(wid) ?? 0) + (estimasiKwh ?? 0));
    }

    // Dampak nyata (kWh digeser menurut Mata AI) untuk dashboard & kalkulator.
    const dampak = ringkasDampak(
      partisipasiSnap.docs.map((d) => ({
        estimasiKwh: d.data().estimasiKwh,
        waktuMs: d.data().verifiedAt?.toMillis?.(),
      })),
      sekarang,
    );
    await db
      .collection("statistik")
      .doc("dampak")
      .set({ ...dampak, diperbarui: Timestamp.fromMillis(sekarang) });
    // Statistik iklim harian (hari ini + kemarin) untuk grafik hari/minggu/bulan.
    await hitungStatistikTerkini(db, sekarang);

    const sesiSnap = await db.collection("load_shift_sessions").get();
    let jadiAktif = 0;
    let jadiSelesai = 0;
    let diperbarui = 0;

    for (const d of sesiSnap.docs) {
      const v = d.data();
      const mulai = v.startAt?.toMillis?.();
      const selesai = v.endAt?.toMillis?.();
      if (!mulai || !selesai) continue;

      const statusSeharusnya =
        sekarang >= selesai ? "ENDED" : sekarang >= mulai ? "ACTIVE" : "UPCOMING";

      const peserta = hitungPeserta.get(d.id) ?? 0;
      const perubahan: Record<string, unknown> = {};

      if (v.status !== statusSeharusnya) {
        perubahan.status = statusSeharusnya;
        if (statusSeharusnya === "ACTIVE") jadiAktif++;
        if (statusSeharusnya === "ENDED") jadiSelesai++;
      }
      if (v.participantCount !== peserta) perubahan.participantCount = peserta;
      const kwh = Math.round((kwhPerSesi.get(d.id) ?? 0) * 100) / 100;
      if ((v.kwhTergeser ?? 0) !== kwh) perubahan.kwhTergeser = kwh;

      if (statusSeharusnya === "ACTIVE" && v.currentLoadKw !== bebanSekarang) {
        perubahan.currentLoadKw = bebanSekarang;
      }

      if (Object.keys(perubahan).length > 0) {
        await d.ref.update(perubahan);
        diperbarui++;
      }
    }

    return Response.json({
      ok: true,
      total_sesi: sesiSnap.size,
      diperbarui,
      jadi_aktif: jadiAktif,
      jadi_selesai: jadiSelesai,
      beban_sekarang_kw: bebanSekarang,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Gagal";
    console.error("sessions/tick gagal:", detail);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}
