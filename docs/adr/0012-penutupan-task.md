# ADR-0012: Penutupan task eksplisit dengan deskripsi opsional

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [04](../stages/04-koreksi-izin-penutupan.md).

## Konteks

Keputusan bisnis 12: menerima rekomendasi A dan menambahkan input text opsional.

## Keputusan

Task hanya menjadi closed melalui aksi eksplisit Tandai task selesai. Sediakan input teks deskripsi penutupan yang opsional. Mencatat realisasi tidak otomatis menutup task.

## Konsekuensi

Deskripsi penutupan bukan catatan hasil realisasi yang wajib. Skema awal belum menampung deskripsi penutupan; lokasi penyimpanannya harus dijelaskan sebelum perubahan skema. Hak menutup/membuka kembali dan dampak pada rencana yang sudah ada belum diputuskan; lihat Q-04.
