import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { llmAktif, mintaBalasan, mintaJson } from "./llm";

const ENV = {
  LLM_BASE_URL: "https://contoh.test/v1beta/openai/",
  LLM_API_KEY: "kunci-uji",
  LLM_MODEL: "gemini-uji",
  LLM_REASONING_EFFORT: "low",
  LLM_MAKS_TOKEN: "500",
  LLM_BATAS_DETIK: "5",
};

const skema = { nama: "uji", schema: { type: "object" } };
const isAlat = (x: unknown): x is { alat: string } =>
  typeof x === "object" && x !== null && typeof (x as { alat?: unknown }).alat === "string";

function balasan(status: number, content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

let fetchPalsu: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  fetchPalsu = vi.fn();
  vi.stubGlobal("fetch", fetchPalsu);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mintaJson", () => {
  it("mengirim konfigurasi LLM_* dan mengembalikan JSON yang lolos validasi", async () => {
    fetchPalsu.mockResolvedValue(balasan(200, '{"alat":"pompa air"}'));

    const hasil = await mintaJson({
      pesan: [{ role: "user", content: "halo" }],
      skema,
      validasi: isAlat,
    });

    expect(hasil).toEqual({ alat: "pompa air" });
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("https://contoh.test/v1beta/openai/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer kunci-uji");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "gemini-uji",
      reasoning_effort: "low",
      max_tokens: 500,
      response_format: { type: "json_schema", json_schema: { name: "uji", strict: true } },
    });
  });

  it("null saat kuota habis (429)", async () => {
    fetchPalsu.mockResolvedValue(balasan(429, ""));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
  });

  it("null saat isi bukan JSON atau tidak lolos validasi", async () => {
    fetchPalsu.mockResolvedValueOnce(balasan(200, "maaf, saya tidak bisa"));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
    fetchPalsu.mockResolvedValueOnce(balasan(200, '{"alat":42}'));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
  });

  it("null saat jaringan gagal atau timeout", async () => {
    fetchPalsu.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
  });

  it("tidak memanggil apa pun bila key belum diisi", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    expect(llmAktif()).toBe(false);
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });
});

describe("ulang sekali saat layanan sibuk", () => {
  it("503 lalu 200: hasil dari percobaan kedua", async () => {
    fetchPalsu
      .mockResolvedValueOnce(balasan(503, ""))
      .mockResolvedValueOnce(balasan(200, '{"alat":"setrika"}'));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toEqual({ alat: "setrika" });
    expect(fetchPalsu).toHaveBeenCalledTimes(2);
  });

  it("429 (kuota habis) tidak diulang", async () => {
    fetchPalsu.mockResolvedValue(balasan(429, ""));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
  });

  it("503 dua kali: menyerah setelah percobaan kedua", async () => {
    fetchPalsu.mockResolvedValue(balasan(503, ""));
    expect(await mintaJson({ pesan: [], skema, validasi: isAlat })).toBeNull();
    expect(fetchPalsu).toHaveBeenCalledTimes(2);
  });
});

describe("mintaBalasan membedakan kuota habis dan server sibuk", () => {
  it("429 → kuota", async () => {
    fetchPalsu.mockResolvedValue(balasan(429, ""));
    expect(await mintaBalasan({ pesan: [] })).toEqual({ gagal: "kuota" });
  });

  it("503 dua kali → sibuk", async () => {
    fetchPalsu.mockResolvedValue(balasan(503, ""));
    expect(await mintaBalasan({ pesan: [] })).toEqual({ gagal: "sibuk" });
  });

  it("timeout → sibuk", async () => {
    fetchPalsu.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(await mintaBalasan({ pesan: [] })).toEqual({ gagal: "sibuk" });
  });

  it("200 → pesan model", async () => {
    fetchPalsu.mockResolvedValue(balasan(200, "halo"));
    expect(await mintaBalasan({ pesan: [] })).toMatchObject({ content: "halo" });
  });
});
