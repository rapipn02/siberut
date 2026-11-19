import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { llmAktif, mintaJson } from "./llm";
import {
  SKEMA_BRIEFING,
  angkaBriefing,
  briefingSegar,
  isBriefingAi,
  promptBriefing,
  type AngkaBriefing,
  type BriefingAi,
} from "./analisAi";
import { jamWib } from "./waktu";
import type { ForecastPoint } from "./types";

export interface DokBriefing {
  angka: AngkaBriefing;
  ai: BriefingAi | null;
  dibuat: Timestamp;
  /** Waktu narasi AI dibuat — bisa lebih lama dari `dibuat` bila AI sedang tidak tersedia. */
  aiDibuat: Timestamp | null;
}

/**
 * Susun briefing operator dan simpan di `ai_briefing/terbaru`.
 * Angka selalu diperbarui; narasi AI hanya bila model tersedia — bila gagal,
 * narasi lama dipertahankan (ditandai waktunya) supaya dashboard tidak kosong.
 */
export async function buatBriefing(
  db: Firestore,
  opsi: { paksa?: boolean } = {},
): Promise<"baru" | "segar" | "tanpa-data" | "tanpa-ai"> {
  const ref = db.collection("ai_briefing").doc("terbaru");
  const lama = (await ref.get()).data() as DokBriefing | undefined;
  const sekarang = Date.now();
  if (!opsi.paksa && briefingSegar(lama?.dibuat?.toMillis(), sekarang)) return "segar";

  const [fcSnap, statusSnap] = await Promise.all([
    db
      .collection("power_forecasts")
      .where("timestamp", ">=", Timestamp.fromMillis(sekarang - 3600_000))
      .where("timestamp", "<", Timestamp.fromMillis(sekarang + 48 * 3600_000))
      .orderBy("timestamp", "asc")
      .limit(48)
      .get(),
    db.collection("system_status").doc("siberut_grid").get(),
  ]);
  if (fcSnap.empty) return "tanpa-data";

  const titik: ForecastPoint[] = fcSnap.docs.map((d) => {
    const v = d.data();
    const waktu: Date = v.timestamp.toDate();
    return {
      jam: jamWib(waktu),
      beban: v.projected_load_kw ?? 0,
      plts: v.predicted_plts_kw ?? 0,
      deficit: Boolean(v.deficit_flag),
      waktuMs: waktu.getTime(),
    };
  });
  const s = statusSnap.data() ?? {};
  const pltdKw = s.total_pltd_capacity_kw ?? 50;
  const angka = angkaBriefing(titik, pltdKw);

  const ai = llmAktif()
    ? await mintaJson({
        pesan: [
          {
            role: "user",
            content: promptBriefing(titik, angka, {
              pltsKwp: s.total_plts_capacity_kw ?? 75,
              pltdKw,
              kk: s.total_households ?? 327,
            }),
          },
        ],
        skema: SKEMA_BRIEFING,
        validasi: isBriefingAi,
        batasDetik: 30,
      })
    : null;

  const dok: DokBriefing = {
    angka,
    ai: ai ?? lama?.ai ?? null,
    dibuat: Timestamp.fromMillis(sekarang),
    aiDibuat: ai ? Timestamp.fromMillis(sekarang) : (lama?.aiDibuat ?? null),
  };
  await ref.set(dok);
  return ai ? "baru" : "tanpa-ai";
}
