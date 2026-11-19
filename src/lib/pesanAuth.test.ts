import { describe, expect, it } from "vitest";
import { pesanRamah } from "./pesanAuth";

const galat = (code: string) => Object.assign(new Error(code), { code });

describe("pesanRamah", () => {
  it("menerjemahkan kredensial salah", () => {
    expect(pesanRamah(galat("auth/invalid-credential"))).toBe(
      "Email atau kata sandi salah.",
    );
  });

  it("menerjemahkan email sudah terdaftar", () => {
    expect(pesanRamah(galat("auth/email-already-in-use"))).toBe(
      "Email sudah terdaftar.",
    );
  });

  it("menerjemahkan kata sandi lemah", () => {
    expect(pesanRamah(galat("auth/weak-password"))).toBe(
      "Kata sandi minimal 6 karakter.",
    );
  });

  it("memakai pesan Error biasa bila tanpa kode", () => {
    expect(pesanRamah(new Error("Akun ini bukan akun warga."))).toBe(
      "Akun ini bukan akun warga.",
    );
  });
});
