import { getAdmin } from "@/lib/firebaseAdmin";
import { stokPerHadiah } from "@/lib/warga";

/**
 * Stok hadiah untuk portal warga. Dihitung di server supaya warga tidak perlu
 * (dan tidak boleh) membaca koleksi `voucher_stock` yang berisi kode asli.
 */
export async function GET() {
  const admin = getAdmin();
  if (!admin) {
    return Response.json(
      { ok: false, error: "Layanan belum dikonfigurasi." },
      { status: 503 },
    );
  }
  try {
    const snap = await admin.db
      .collection("voucher_stock")
      .where("is_used", "==", false)
      .select("reward_id", "is_used")
      .get();
    return Response.json(
      { ok: true, stok: stokPerHadiah(snap.docs.map((d) => d.data())) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("stok-hadiah gagal:", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "Gagal membaca stok." }, { status: 500 });
  }
}
