import { createHash } from "node:crypto";
import { Timestamp, FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdmin } from "@/lib/firebaseAdmin";
import { cronAtauOperator, tolakAkses, wargaDariToken } from "@/lib/authServer";
import {
  bolehDinilaiWarga,
  verifikasiBanyak,
  type JendelaImbauan,
  type KlaimTersetujui,
  type PengajuanPartisipasi,
} from "@/lib/verification";
import { llmAktif, mintaJson } from "@/lib/llm";
import {
  PROMPT_ANALISIS_FOTO,
  SKEMA_ANALISIS_FOTO,
  estimasiKwh,
  isAnalisisFoto,
  keputusanAkhir,
  type AnalisisFoto,
} from "@/lib/mataAi";
import { dataUrlFoto } from "@/lib/photo";

const MAKS_PER_JALAN = 50;
/** Batas panggilan Gemini per jalan cron — sisa antre ke jalan berikutnya (kuota harian terbatas). */
const MAKS_AI_PER_JALAN = 5;
// Satu foto ≈ 1.065 token. Cukup foto pertama: AI tidak pernah menolak sendirian, foto yang
// kurang jelas ditahan untuk petugas yang tetap melihat semua foto.
const MAKS_FOTO_AI = 1;
const BATAS_DETIK_AI = 30;

async function analisisFoto(fotos: unknown): Promise<AnalisisFoto | null> {
  const gambar = (Array.isArray(fotos) ? fotos : [])
    .map(dataUrlFoto)
    .filter((u): u is string => Boolean(u))
    .slice(0, MAKS_FOTO_AI);
  if (gambar.length === 0) return null;
  return mintaJson({
    pesan: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT_ANALISIS_FOTO },
          ...gambar.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ],
      },
    ],
    skema: SKEMA_ANALISIS_FOTO,
    validasi: isAnalisisFoto,
    batasDetik: BATAS_DETIK_AI,
  });
}

function sidikFoto(foto: unknown): string[] {
  if (!Array.isArray(foto)) return [];
  return foto
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map((f) => createHash("sha256").update(f).digest("hex"));
}

export async function POST(request: Request) {
  // Cron/admin: semua antrean. Warga: hanya pengajuannya sendiri yang baru dikirim (dinilai langsung).
  let pemilik: string | null = null;
  if (!(await cronAtauOperator(request, true))) {
    const warga = await wargaDariToken(request);
    if (!warga) return tolakAkses();
    pemilik = warga.uid;
  }
  const idTarget = pemilik
    ? ((await request.json().catch(() => ({}))) as { id?: unknown }).id
    : null;
  if (pemilik && typeof idTarget !== "string") {
    return Response.json({ ok: false, error: "id pengajuan wajib." }, { status: 400 });
  }

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
    let menunggu: QueryDocumentSnapshot[];
    if (pemilik && typeof idTarget === "string") {
      const d = await db.collection("participation_requests").doc(idTarget).get();
      menunggu =
        d.exists && bolehDinilaiWarga(d.data() ?? {}, d.createTime?.toMillis() ?? 0, pemilik, sekarang)
          ? [d as QueryDocumentSnapshot] // exists sudah dicek
          : [];
    } else {
      const menungguSnap = await db
        .collection("participation_requests")
        .where("status", "==", "PENDING")
        .limit(MAKS_PER_JALAN)
        .get();
      // Sudah dinilai AI & menunggu keputusan operator → jangan dianalisis ulang.
      // ponytail: >50 pengajuan tertahan bisa menyumbat antrean; tambah field status terpisah bila itu terjadi.
      menunggu = menungguSnap.docs.filter((d) => !d.data().aiAnalisis);
    }

    if (menunggu.length === 0) {
      return Response.json({
        ok: true,
        diproses: 0,
        disetujui: 0,
        ditolak: 0,
        alasan: "Tidak ada pengajuan menunggu.",
      });
    }

    const sesiSnap = await db
      .collection("load_shift_sessions")
      .where("endAt", ">", Timestamp.fromMillis(sekarang - 24 * 3600_000))
      .get();
    const jendela: JendelaImbauan[] = sesiSnap.docs
      .filter((d) => d.data().startAt && d.data().endAt)
      .map((d) => {
        const v = d.data();
        return {
          id: d.id,
          mulaiMs: v.startAt.toMillis(),
          selesaiMs: v.endAt.toMillis(),
          poinPerPartisipasi: v.poin_per_partisipasi ?? 25,
        };
      });

    const disetujuiSnap = await db
      .collection("participation_requests")
      .where("status", "==", "APPROVED")
      .get();
    const klaim: KlaimTersetujui[] = disetujuiSnap.docs
      .map((d) => ({ userId: d.data().userId, windowId: d.data().windowId }))
      .filter((k): k is KlaimTersetujui => Boolean(k.userId && k.windowId));

    const hashTerpakai = disetujuiSnap.docs.flatMap((d) => {
      const v = d.data();
      return Array.isArray(v.photoHashes) ? (v.photoHashes as string[]) : sidikFoto(v.photosBase64);
    });

    const fotoPerId = new Map(menunggu.map((d) => [d.id, d.data().photosBase64]));
    const pengajuan: PengajuanPartisipasi[] = menunggu.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        userId: v.userId,
        jumlahFoto: Array.isArray(v.photosBase64) ? v.photosBase64.length : 0,
        submittedAtMs: v.timestamp?.toMillis?.() ?? 0,
        dibuatServerMs: d.createTime?.toMillis?.(),
        hashFoto: sidikFoto(v.photosBase64),
      };
    });

    const hasil = verifikasiBanyak(
      pengajuan,
      jendela,
      klaim,
      sekarang,
      hashTerpakai,
    );

    let disetujui = 0;
    let ditolak = 0;
    let ditinjau = 0;
    let aiDipakai = 0;
    let tertunda = 0;
    const pakaiAi = llmAktif();

    for (const { pengajuan: p, hasil: aturan } of hasil) {
      const reqRef = db.collection("participation_requests").doc(p.id);

      // Mata AI hanya untuk yang lolos aturan — hemat kuota.
      let ai: AnalisisFoto | null = null;
      if (aturan.status === "APPROVED" && pakaiAi) {
        if (aiDipakai >= MAKS_AI_PER_JALAN) {
          tertunda++;
          continue; // tetap PENDING, dinilai di jalan cron berikutnya
        }
        aiDipakai++;
        ai = await analisisFoto(fotoPerId.get(p.id));
      }
      const h = keputusanAkhir(aturan, ai);
      const jejakAi = ai
        ? { aiAnalisis: { ...ai, dianalisisPada: Timestamp.fromMillis(sekarang) } }
        : {};

      if (h.status === "PENDING") {
        await reqRef.update({
          ...jejakAi,
          windowId: h.windowId,
          verificationReason: h.reason,
          verificationCode: h.reasonCode,
          photoHashes: p.hashFoto ?? [],
        });
        ditinjau++;
      } else if (h.status === "APPROVED") {
        await db.runTransaction(async (tx) => {
          const kini = await tx.get(reqRef);
          if (!kini.exists || kini.data()?.status !== "PENDING") return;

          tx.update(reqRef, {
            status: "APPROVED",
            poinDiberikan: h.poin,
            windowId: h.windowId,
            verifiedAt: Timestamp.fromMillis(sekarang),
            verificationReason: h.reason,
            verificationCode: h.reasonCode,
            photoHashes: p.hashFoto ?? [],
            ...jejakAi,
            estimasiKwh: estimasiKwh(ai),
          });
          // user_id + nama_warga ikut ditulis: warga yang daftar lewat portal
          // belum punya dokumen poin, dan peringkat operator butuh namanya.
          const userName = kini.data()?.userName;
          tx.set(
            db.collection("BUMDes_rewards").doc(p.userId),
            {
              total_poin: FieldValue.increment(h.poin),
              user_id: p.userId,
              ...(userName ? { nama_warga: userName } : {}),
            },
            { merge: true },
          );
        });
        disetujui++;
      } else {
        await reqRef.update({
          status: "REJECTED",
          poinDiberikan: 0,
          windowId: h.windowId,
          verifiedAt: Timestamp.fromMillis(sekarang),
          verificationReason: h.reason,
          verificationCode: h.reasonCode,
          photoHashes: p.hashFoto ?? [],
        });
        ditolak++;
      }
    }

    return Response.json({
      ok: true,
      diproses: hasil.length - tertunda,
      disetujui,
      ditolak,
      ditinjau,
      ai_dipakai: aiDipakai,
      tertunda,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Gagal";
    console.error("verify-participation gagal:", detail);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}
