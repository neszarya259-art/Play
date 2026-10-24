# NexaVerse Play

Pemutar musik web bergaya **Comic Paper-Ink** yang memutar **full track** Spotify melalui **Spotify Web Playback SDK**. Dibuat dengan HTML, CSS, dan JavaScript murni tanpa framework.

> Proyek independen. Tidak berafiliasi dengan atau didukung oleh Spotify AB. Spotify adalah merek dagang Spotify AB.

## Fitur

- Login **Authorization Code Flow + PKCE** tanpa Client Secret di frontend.
- Pemutaran full track untuk akun **Spotify Premium**.
- Kartu **Now Playing** bergaya komik: sampul dengan bingkai kertas dan lipatan di sudut, visualizer bar, progress bar, dan tombol stiker dengan efek ink splash.
- Kontrol putar, berikutnya, sebelumnya, seek, volume, acak, ulangi, Like, dan antrean.
- Dashboard dengan Liked Songs, Recently Played, pencarian, library playlist, dan pengaturan.
- Halaman Profile dengan statistik dan tab Playlists, Liked, dan Top Artists.
- Tema **Paper Light** (default) dan **Ink Dark**. Pilihan tersimpan di localStorage.
- Mode demo (`?demo=1`) tanpa login dan tanpa audio, untuk melihat tampilan.

## Struktur file

| File | Fungsi |
|---|---|
| `config.js` | Client ID, redirect URI, dan daftar scope |
| `index.html` | Landing page. Juga menangani callback OAuth (`?code=`) |
| `login.html` | Halaman login dengan tombol Connect with Spotify |
| `dashboard.html` | Sidebar, Now Playing Card, daftar lagu, mini player, dan modal Premium |
| `profile.html` | Profil, statistik, dan tab Playlists, Liked, Top Artists |
| `styles.css` | Seluruh gaya, termasuk tema dan Now Playing Card |
| `app.js` | Logika PKCE, Web Playback SDK, Web API, dan UI |
| `README.md` | Panduan ini |

## 1. Siapkan aplikasi di Spotify Developer Dashboard

1. Buka [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) lalu buat aplikasi. Client ID sudah tertulis di `config.js`. Ganti dengan Client ID milikmu jika memakai aplikasi sendiri.
2. Tambahkan **Redirect URI** persis seperti berikut:
   - `http://127.0.0.1:5500/` untuk pengembangan lokal
   - `https://spotify-itel.vercel.app/` untuk produksi
3. Spotify tidak lagi menerima `localhost` sebagai redirect URI. Gunakan `127.0.0.1`. `config.js` sudah otomatis memakai `127.0.0.1` saat dibuka dari `localhost`.
4. Aplikasi berada di **Development Mode**. Akun pemilik aplikasi harus Premium. Tambahkan setiap akun yang akan dipakai di menu **User Management**. Development Mode membatasi jumlah pengguna (maksimal 5).

## 2. Menjalankan secara lokal

Pilih salah satu cara berikut:

- **VS Code + Live Server**: atur port ke `5500`, lalu buka `http://127.0.0.1:5500/`.
- **Python**: jalankan `python -m http.server 5500 --bind 127.0.0.1`, lalu buka `http://127.0.0.1:5500/`.

Jangan membuka file langsung dari `file://`. Web Crypto dan OAuth memerlukan konteks aman (HTTPS atau loopback).

## 3. Deploy ke Vercel

1. Upload isi folder ini ke repositori, lalu impor di Vercel sebagai proyek statis. Tidak perlu build command.
2. Pastikan domain produksi sama persis dengan `REDIRECT_URI` di `config.js` dan di Spotify Dashboard.

## 4. Alur login (PKCE)

1. `login.html` membuat `code_verifier` dan `state` acak, menyimpannya di `sessionStorage`, lalu mengarahkan ke `accounts.spotify.com/authorize` dengan `code_challenge` (S256).
2. Spotify kembali ke `REDIRECT_URI` dengan `?code=...&state=...`. `index.html` memverifikasi `state`, menukar kode menjadi token lewat `/api/token`, lalu menyimpan token di `sessionStorage`.
3. Token diperbarui otomatis memakai `refresh_token` sekitar 60 detik sebelum kedaluwarsa.
4. `dashboard.html` dan `profile.html` dilindungi. Jika belum login, pengguna diarahkan ke `login.html`.

## 5. Catatan penting

- **Cek Premium.** Sejak Februari 2026, field `product` tidak lagi dikembalikan oleh `GET /me` untuk Development Mode. Aplikasi memakai `product` jika tersedia, lalu beralih ke event `account_error` dari SDK. Jika akun bukan Premium, modal peringatan muncul dan pemutaran dinonaktifkan.
- **Visualizer bersifat simulasi.** Audio dari Web Playback SDK berjalan di dalam iframe yang tidak bisa dianalisis oleh Web Audio API. Bar bergerak mengikuti tempo semu yang diturunkan dari ID lagu, dan berhenti saat jeda.
- **Scope tambahan.** `user-read-recently-played` diperlukan untuk Recently Played, dan `user-library-modify` untuk tombol Like. Scope `user-read-email` dihapus karena field email tidak lagi dikembalikan.
- **Like** memakai `PUT` dan `DELETE /me/library` serta `GET /me/library/contains` dengan parameter `uris`, sesuai format Februari 2026. Endpoint lama `/me/tracks` untuk menulis sudah dihapus.
- **Pencarian** dibatasi 10 hasil per permintaan.
- **Pemutaran berhenti saat pindah halaman** (Dashboard ke Profile dan sebaliknya), karena perangkat Web Playback SDK ikut terputus. Tetap berada di satu tab saat memutar musik.
- Token hanya hidup di tab ini (`sessionStorage`). Menutup tab berarti harus login lagi.
- Gunakan aplikasi sesuai [Spotify Developer Terms](https://developer.spotify.com/terms) dan [Brand Guidelines](https://developer.spotify.com/documentation/design).

## 6. Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| `INVALID_CLIENT: Insecure redirect URI` | Redirect URI belum terdaftar, atau masih memakai `localhost`. Gunakan `http://127.0.0.1:5500/` dan daftarkan persis seperti itu. |
| Login gagal atau akses ditolak | Akun belum ditambahkan di User Management, atau jumlah pengguna sudah mencapai batas Development Mode. |
| Modal "Butuh Spotify Premium" | Akun bukan Premium. Akun Lite dan Premium Mini tidak mendukung Web Playback SDK. |
| "Pemutar belum siap" | Tunggu beberapa detik setelah halaman dimuat. Pastikan tidak ada ekstensi browser yang memblokir `sdk.scdn.co`. |
| "Izin akun belum lengkap" | Token lama belum memiliki scope baru. Logout lalu login ulang. |
| Tidak ada suara di Safari | Klik tombol putar sekali untuk membuka kunci audio. |
| Tombol Like tidak berfungsi | Login ulang agar scope `user-library-modify` ikut diberikan. |

## Lisensi

Kode contoh ini bebas dipakai dan dimodifikasi untuk belajar dan proyek pribadi.
