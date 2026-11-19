/** Terjemahkan galat Firebase Auth jadi kalimat yang dimengerti pengguna. */
export function pesanRamah(err: unknown): string {
  const kode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: string }).code)
      : "";
  switch (kode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email atau kata sandi salah.";
    case "auth/invalid-email":
      return "Format email tidak benar.";
    case "auth/email-already-in-use":
      return "Email sudah terdaftar.";
    case "auth/weak-password":
      return "Kata sandi minimal 6 karakter.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Tunggu beberapa menit.";
    case "auth/network-request-failed":
      return "Tidak ada koneksi ke server. Periksa jaringan.";
    default:
      return err instanceof Error ? err.message : "Gagal masuk.";
  }
}
