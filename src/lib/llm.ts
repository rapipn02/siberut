/**
 * Klien LLM server-side — endpoint Gemini kompatibel-OpenAI (`/chat/completions`).
 * Konfigurasi dari env `LLM_*` (lihat .env.example). Tidak ada SDK: cukup `fetch`.
 *
 * Prinsip: AI bersifat tambahan. Setiap kegagalan (key kosong, 429 kuota habis,
 * timeout, JSON rusak) mengembalikan `null` — pemanggil wajib punya jalur tanpa AI.
 */

export type BagianPesan =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface PanggilanTool {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type PesanLlm =
  | { role: "system" | "user"; content: string | BagianPesan[] }
  | { role: "assistant"; content: string | null; tool_calls?: PanggilanTool[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface DefinisiTool {
  type: "function";
  function: { name: string; description: string; parameters: object };
}

function konfigurasi() {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, ""),
    key: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gemini-3.5-flash-lite",
    reasoning: process.env.LLM_REASONING_EFFORT || undefined,
    maksToken: Number(process.env.LLM_MAKS_TOKEN) || 2000,
    batasDetik: Number(process.env.LLM_BATAS_DETIK) || 12,
  };
}

export function llmAktif(): boolean {
  const k = konfigurasi();
  return Boolean(k.baseUrl && k.key);
}

/** Satu panggilan `/chat/completions`. `null` bila gagal dengan alasan apa pun. */
async function panggil(
  body: Record<string, unknown>,
  batasDetik?: number,
): Promise<{ content: string | null; tool_calls?: PanggilanTool[] } | null> {
  const k = konfigurasi();
  if (!k.baseUrl || !k.key) return null;

  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), (batasDetik ?? k.batasDetik) * 1000);
  try {
    const res = await fetch(`${k.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: k.model,
        max_tokens: k.maksToken,
        ...(k.reasoning ? { reasoning_effort: k.reasoning } : {}),
        ...body,
      }),
      signal: kontrol.signal,
    });
    if (!res.ok) {
      console.warn(`LLM membalas ${res.status}${res.status === 429 ? " (kuota habis)" : ""}.`);
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message ?? null;
  } catch (err) {
    const batal = err instanceof Error && err.name === "AbortError";
    console.warn(batal ? "LLM timeout." : "LLM tidak dapat dihubungi.");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Minta jawaban berbentuk JSON sesuai skema, lalu validasi sebelum dipakai. */
export async function mintaJson<T>(opsi: {
  pesan: PesanLlm[];
  skema: { nama: string; schema: object };
  validasi: (x: unknown) => x is T;
  batasDetik?: number;
}): Promise<T | null> {
  const pesan = await panggil(
    {
      messages: opsi.pesan,
      response_format: {
        type: "json_schema",
        json_schema: { name: opsi.skema.nama, strict: true, schema: opsi.skema.schema },
      },
    },
    opsi.batasDetik,
  );
  if (!pesan?.content) return null;
  try {
    const hasil: unknown = JSON.parse(pesan.content);
    if (opsi.validasi(hasil)) return hasil;
    console.warn(`LLM: jawaban "${opsi.skema.nama}" tidak sesuai skema.`);
  } catch {
    console.warn(`LLM: jawaban "${opsi.skema.nama}" bukan JSON.`);
  }
  return null;
}

/** Satu putaran obrolan dengan tools (dipakai asisten). */
export async function mintaBalasan(opsi: {
  pesan: PesanLlm[];
  tools?: DefinisiTool[];
  batasDetik?: number;
}) {
  return panggil(
    { messages: opsi.pesan, ...(opsi.tools?.length ? { tools: opsi.tools } : {}) },
    opsi.batasDetik,
  );
}
