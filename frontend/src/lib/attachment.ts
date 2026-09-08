// Tampilan "PNG · 820 KB" di kartu lampiran (ADR-0016) — dari data yang sudah divalidasi
// server (fileType MIME hasil sniff signature asli, ukuranBytes dari file.size saat upload).
export function labelTipeFile(fileType: string | null): string {
  if (fileType === "image/png") return "PNG";
  if (fileType === "image/jpeg") return "JPG";
  return "FILE";
}

export function formatUkuranFile(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
