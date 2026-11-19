import { getAdmin } from "@/lib/firebaseAdmin";
import { wargaDariToken, tolakAkses } from "@/lib/authServer";
import { pakaiKuota } from "@/lib/kuotaServer";
import { llmAktif, mintaJson } from "@/lib/llm";
import { PROMPT_LABEL, SKEMA_LABEL, isHasilLabel, wattWajar } from "@/lib/alatWarga";
import { dataUrlFoto } from "@/lib/photo";

const MAKS_BASE64 = 1_500_000; // ±1,1 MB gambar; foto sudah dikompres di browser

/** Warga memotret label alat → Gemini membaca jenis, merek, dan watt. */
export async function POST(request: Request) {
  const warga = await wargaDariToken(request);
  if (!warga) return tolakAkses();
  if (!llmAktif()) {
    return Response.json({ ok: false, error: "Fitur AI belum diaktifkan. Isi daya alat secara manual." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const foto = typeof body?.foto === "string" ? body.foto : "";
  const url = foto.length <= MAKS_BASE64 ? dataUrlFoto(foto) : null;
  if (!url || !url.startsWith("data:image/")) {
    return Response.json({ ok: false, error: "Foto tidak valid atau terlalu besar." }, { status: 400 });
  }

  const kuota = await pakaiKuota(getAdmin()!.db, warga.uid, "label");
  if (!kuota.boleh) {
    return Response.json({ ok: false, error: "Jatah pindai hari ini habis. Coba lagi besok atau isi manual." }, { status: 429 });
  }

  const hasil = await mintaJson({
    pesan: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT_LABEL },
          { type: "image_url", image_url: { url } },
        ],
      },
    ],
    skema: SKEMA_LABEL,
    validasi: isHasilLabel,
    batasDetik: 25,
  });
  if (!hasil) {
    return Response.json({ ok: false, error: "AI sedang sibuk. Coba lagi sebentar atau isi manual." }, { status: 502 });
  }
  return Response.json({
    ok: true,
    sisaKuota: kuota.sisa,
    hasil: { ...hasil, watt: wattWajar(hasil.watt) ?? 0 },
  });
}
