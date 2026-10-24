/* ==========================================================================
   NexaVerse Play — config.js
   OAuth 2.0 Authorization Code Flow + PKCE (tanpa Client Secret di frontend)
   ========================================================================== */
const CONFIG = {
  CLIENT_ID: "7204355668e84d91b121dbb4e8e5f6e7",

  // Sejak 2025 Spotify tidak lagi menerima "localhost" sebagai redirect URI.
  // Untuk development lokal gunakan loopback 127.0.0.1, dan daftarkan URI yang
  // sama persis di Spotify Developer Dashboard.
  REDIRECT_URI: ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:5500/"
    : "https://spotify-itel.vercel.app/",

  SCOPES: [
    "streaming",
    "user-read-private",          // dipakai jika Spotify mengembalikan field product
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-read-recently-played",  // Recently Played (ditambahkan)
    "playlist-read-private",
    "user-library-read",
    "user-library-modify",        // tombol Like via PUT/DELETE /me/library (ditambahkan)
    "user-top-read"
    // user-read-email dihapus: field email tidak lagi dikembalikan untuk Development Mode
  ]
};

/* sessionStorage bersifat per-origin. Verifier PKCE harus berada di origin yang sama
   dengan redirect URI, jadi "localhost" dialihkan ke "127.0.0.1". */
if (window.location.hostname === "localhost") {
  window.location.replace(window.location.href.replace("//localhost", "//127.0.0.1"));
}
