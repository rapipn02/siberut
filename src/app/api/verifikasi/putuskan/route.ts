import { Timestamp } from "firebase-admin/firestore";
import { getAdmin } from "@/lib/firebaseAdmin";
import { operatorDariToken, tolakAkses } from "@/lib/authServer";
import { keputusanManual } from "@/lib/izin";
import { estimasiKwh, isAnalisisFoto } from "@/lib/mataAi";

const POIN_BAWAAN = 25;

/**
 * Admin BUMDes menimpa keputusan mesin verifikasi. Dijalankan di server dalam
 * satu transaksi: status pengajuan, windowId sesi, dan saldo poin berubah
 * bersama — tidak ada poin ganda saat diklik dua kali.
 */
export async function POST(request: Request) {
  const operator = await operatorDariToken(request, true);
  if (!operator) return tolakAkses(403);

  let body: { id?: unknown; setujui?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || typeof body.setujui !== "boolean") {
    return Response.json({ ok: false, error: "id & setujui wajib diisi." }, { status: 400 });
  }
  const setujui = body.setujui;

  const { db } = getAdmin()!;
  try {
    const hasil = await db.runTransaction(async (tx) => {
      const reqRef = db.collection("participation_requests").doc(id);
      const snap = await tx.get(reqRef);
      if (!snap.exists) return { ditemukan: false as const };
      const v = snap.data()!;
      const waktu: Timestamp | undefined = v.timestamp;

      // Sesi yang memuat waktu kirim → sumber poin & windowId.
      let sesiId: string | null = v.windowId ?? null;
      let poinSesi = POIN_BAWAAN;
      if (waktu) {
        const kandidat = await tx.get(
          db
            .collection("load_shift_sessions")
            .where("startAt", "<=", waktu)
            .orderBy("startAt", "desc")
            .limit(5),
        );
        const sesi = kandidat.docs.find(
          (d) => (d.data().endAt?.toMillis?.() ?? 0) >= waktu.toMillis(),
        );
        if (sesi) {
          sesiId = sesi.id;
          poinSesi = sesi.data().poin_per_partisipasi ?? POIN_BAWAAN;
        }
      }

      const saldoRef = db.collection("BUMDes_rewards").doc(v.userId);
      const saldo = (await tx.get(saldoRef)).data()?.total_poin ?? 0;

      const k = keputusanManual(
        { status: v.status, poin: v.poinDiberikan ?? 0 },
        setujui,
        poinSesi,
      );
      if (!k.ubah) return { ditemukan: true as const, berubah: false, poin: k.poin };

      tx.update(reqRef, {
        status: k.status,
        poinDiberikan: k.poin,
        windowId: sesiId,
        verifiedAt: Timestamp.now(),
        verificationReason: `${setujui ? "Disetujui" : "Ditolak"} manual oleh ${operator.nama}.`,
        verificationCode: setujui ? "MANUAL_APPROVED" : "MANUAL_REJECTED",
        // Dampak terukur ikut tercatat bila foto sudah dinilai Mata AI.
        estimasiKwh: setujui && isAnalisisFoto(v.aiAnalisis) ? estimasiKwh(v.aiAnalisis) : 0,
      });
      if (k.selisihPoin !== 0) {
        // Saldo tidak boleh minus walau poin sudah sempat ditukar.
        tx.set(
          saldoRef,
          {
            total_poin: Math.max(0, saldo + k.selisihPoin),
            user_id: v.userId,
            ...(v.userName ? { nama_warga: v.userName } : {}),
          },
          { merge: true },
        );
      }
      return { ditemukan: true as const, berubah: true, poin: k.poin };
    });

    if (!hasil.ditemukan) {
      return Response.json({ ok: false, error: "Pengajuan tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ ok: true, berubah: hasil.berubah, poin: hasil.poin });
  } catch (err) {
    console.error("putuskan gagal:", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "Gagal menyimpan keputusan." }, { status: 500 });
  }
}
