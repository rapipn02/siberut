import { getAdmin } from "@/lib/firebaseAdmin";
import { penggunaDariToken, tolakAkses } from "@/lib/authServer";
import { pakaiKuota } from "@/lib/kuotaServer";
import { llmAktif, mintaBalasan, type PesanLlm } from "@/lib/llm";
import { potongRiwayat, promptSistem, toolsUntuk, type Peran } from "@/lib/asisten";
import { dataAwal, jalankanTool } from "@/lib/asistenServer";
import { tanggalPanjangWib } from "@/lib/waktu";

const MAKS_PUTARAN_TOOL = 2; // data utama sudah dikirim di awal, jadi jarang perlu tool
/** Batas seluruh permintaan, di bawah proxy_read_timeout nginx (60 detik). */
const BATAS_TOTAL_MS = 50_000;

/**
 * Asisten berbasis data. Peran & uid ditentukan dari token di server —
 * model tidak pernah memilih data milik siapa yang dibaca.
 */
export async function POST(request: Request) {
  const pengguna = await penggunaDariToken(request);
  if (!pengguna) return tolakAkses();
  if (!llmAktif()) {
    return Response.json({ ok: false, error: "Asisten AI belum diaktifkan." }, { status: 503 });
  }

  const peran: Peran = pengguna.peran;
  const { uid, nama } = pengguna;

  const body = await request.json().catch(() => ({}));
  const riwayat = potongRiwayat(body?.pesan);
  if (riwayat.length === 0 || riwayat[riwayat.length - 1].role !== "user") {
    return Response.json({ ok: false, error: "Pertanyaan kosong." }, { status: 400 });
  }

  const { db } = getAdmin()!;
  const sekarang = Date.now();
  // Kuota dan data awal paralel: data yang tidak terpakai (kuota habis) cukup dibuang.
  const [kuota, data] = await Promise.all([
    pakaiKuota(db, uid, "asisten"),
    dataAwal(peran, { db, uid, sekarang }),
  ]);
  if (!kuota.boleh) {
    return Response.json(
      { ok: false, error: "Jatah tanya hari ini habis. Coba lagi besok ya." },
      { status: 429 },
    );
  }

  const pesan: PesanLlm[] = [
    { role: "system", content: promptSistem(peran, nama, tanggalPanjangWib(new Date(sekarang)), data) },
    ...riwayat,
  ];
  const tools = toolsUntuk(peran);
  const dipakai: string[] = [];

  for (let putaran = 0; putaran <= MAKS_PUTARAN_TOOL; putaran++) {
    // Gemini kadang butuh 10 sampai 25 detik per panggilan; sisa waktu dibagi ke putaran berikutnya.
    const sisaDetik = (BATAS_TOTAL_MS - (Date.now() - sekarang)) / 1000;
    if (sisaDetik < 5) break;
    const balasan = await mintaBalasan({
      pesan,
      // Putaran terakhir tanpa tools → model wajib menjawab dengan data yang sudah ada.
      tools: putaran < MAKS_PUTARAN_TOOL ? tools : undefined,
      batasDetik: Math.min(40, sisaDetik),
    });
    if ("gagal" in balasan) {
      return Response.json(
        balasan.gagal === "kuota"
          ? { ok: false, error: "Jatah layanan AI hari ini sudah habis. Surya bisa dipakai lagi besok." }
          : { ok: false, error: "Server AI Google sedang sibuk. Coba lagi beberapa menit lagi." },
        { status: balasan.gagal === "kuota" ? 429 : 503 },
      );
    }

    if (!balasan.tool_calls?.length) {
      return Response.json({
        ok: true,
        jawaban: balasan.content?.trim() || "Maaf, saya belum bisa menjawab itu.",
        toolDipakai: dipakai,
        sisaKuota: kuota.sisa,
      });
    }

    // Kirim balik pesan asisten apa adanya (Gemini butuh thought_signature di dalamnya).
    pesan.push(balasan as PesanLlm);
    const hasil = await Promise.all(
      balasan.tool_calls.map((p) => jalankanTool(peran, p.function.name, p.function.arguments, { db, uid, sekarang })),
    );
    balasan.tool_calls.forEach((p, i) => {
      dipakai.push(p.function.name);
      pesan.push({ role: "tool", tool_call_id: p.id, content: JSON.stringify(hasil[i]) });
    });
  }

  return Response.json(
    { ok: false, error: "Server AI Google sedang lambat. Coba lagi beberapa menit lagi." },
    { status: 503 },
  );
}
