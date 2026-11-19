import { beforeEach, describe, expect, it, vi } from "vitest";

// Batas jaringan Firebase dipalsukan — yang diuji alur pemulihan wargaAuth.
const fb = vi.hoisted(() => ({
  createUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("./firebase", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: fb.createUser,
  signInWithEmailAndPassword: fb.signIn,
  signOut: fb.signOut,
  deleteUser: fb.deleteUser,
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  getDoc: fb.getDoc,
  setDoc: fb.setDoc,
}));

import { daftarWarga, loginWarga } from "./wargaAuth";

const ada = (data: unknown) => ({ exists: () => true, data: () => data });
const kosong = { exists: () => false, data: () => undefined };

beforeEach(() => {
  Object.values(fb).forEach((f) => f.mockReset());
});

describe("daftarWarga", () => {
  it("menghapus akun Auth bila profil gagal ditulis, supaya email bisa dipakai lagi", async () => {
    const user = { uid: "u1", email: "a@b.id" };
    fb.createUser.mockResolvedValue({ user });
    fb.setDoc.mockRejectedValue(new Error("permission-denied"));

    await expect(
      daftarWarga({ nama: "Ani", email: "a@b.id", sandi: "rahasia", phone: "" }),
    ).rejects.toThrow("Pendaftaran gagal");
    expect(fb.deleteUser).toHaveBeenCalledWith(user);
  });
});

describe("loginWarga", () => {
  it("memulihkan profil warga yang hilang (daftar sempat terputus)", async () => {
    fb.signIn.mockResolvedValue({ user: { uid: "u1", email: "ani@desa.id" } });
    fb.getDoc.mockImplementation(async (ref: string) =>
      ref === "users/u1" ? kosong : kosong,
    );
    fb.setDoc.mockResolvedValue(undefined);

    const w = await loginWarga("ani@desa.id", "rahasia");
    expect(w).toMatchObject({ uid: "u1", nama: "ani", role: "WARGA" });
    expect(fb.setDoc).toHaveBeenCalledWith(
      "users/u1",
      expect.objectContaining({ uid: "u1", role: "WARGA", email: "ani@desa.id" }),
    );
  });

  it("tetap menolak akun operator", async () => {
    fb.signIn.mockResolvedValue({ user: { uid: "op1", email: "admin@bumdes.id" } });
    fb.getDoc.mockImplementation(async (ref: string) =>
      ref === "operators/op1" ? ada({ role: "admin_bumdes", aktif: true }) : kosong,
    );

    await expect(loginWarga("admin@bumdes.id", "x")).rejects.toThrow(
      "Akun ini bukan akun warga.",
    );
    expect(fb.signOut).toHaveBeenCalled();
    expect(fb.setDoc).not.toHaveBeenCalled();
  });

  it("menolak profil users yang bukan WARGA", async () => {
    fb.signIn.mockResolvedValue({ user: { uid: "u2", email: "x@y.id" } });
    fb.getDoc.mockImplementation(async (ref: string) =>
      ref === "users/u2" ? ada({ role: "OPERATOR", nama: "X" }) : kosong,
    );

    await expect(loginWarga("x@y.id", "x")).rejects.toThrow("Akun ini bukan akun warga.");
    expect(fb.signOut).toHaveBeenCalled();
  });
});
