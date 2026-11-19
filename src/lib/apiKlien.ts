import { auth } from "./firebase";

/**
 * `fetch` ke API internal dengan Firebase ID token pengguna yang sedang login
 * (operator atau warga). Server memverifikasi token — tidak ada header rahasia
 * yang bisa dipalsukan dari browser.
 */
export async function fetchBertoken(url: string, init: RequestInit = {}): Promise<Response> {
  // Setelah reload, Firebase memulihkan sesi secara async — tunggu dulu,
  // kalau tidak panggilan pertama terkirim tanpa token.
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
