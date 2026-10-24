/* ==========================================================================
   NexaVerse Play — app.js
   Bagian 1a: konstanta, state, utilitas, dan sprite ikon
   ========================================================================== */
"use strict";

/* ---------- 1. Konstanta dan state ---------- */
const SPOTIFY = {
  ACCOUNTS: "https://accounts.spotify.com",
  API: "https://api.spotify.com/v1",
  SDK: "https://sdk.scdn.co/spotify-player.js"
};
const KEYS = {
  token: "nv_token",
  verifier: "nv_pkce_verifier",
  oauthState: "nv_pkce_state",
  theme: "nv_theme",
  volume: "nv_volume"
};
const VIZ_BARS = 28;
const PARAMS = new URLSearchParams(location.search);
const IS_DEMO = PARAMS.get("demo") === "1";
const PAGE = document.body?.dataset.page || "";
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const AUTH_ERRORS = {
  access_denied: "Izin Spotify ditolak. Coba login lagi dan setujui izinnya.",
  state_mismatch: "Sesi login tidak cocok. Silakan ulangi login.",
  token_exchange: "Gagal menukar kode login menjadi token. Coba lagi.",
  session_expired: "Sesi Spotify sudah berakhir. Silakan login lagi."
};

const state = {
  demo: IS_DEMO,
  me: null,
  premium: null,
  deviceId: null,
  playbackReady: false,
  player: null,
  sdkPromise: null,
  listeners: [],
  unlocked: false,
  refreshing: null,
  current: null,
  queue: [],
  paused: true,
  positionMs: 0,
  durationMs: 0,
  syncedAt: 0,
  shuffle: false,
  repeat: "off",
  volume: 0.6,
  bpm: 112,
  bars: [],
  levels: new Array(VIZ_BARS).fill(0.12),
  liveLoop: 0,
  seeking: false,
  lastSec: -1,
  liked: new Map(),
  demoList: [],
  demoIndex: 0,
  cardVisible: true,
  io: null,
  lists: { liked: [], recent: [] },
  playlists: [],
  view: "home"
};

/* ---------- 2. Utilitas ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (ms) => {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const bgUrl = (u) => (u ? (u.startsWith("url(") ? u : `url("${u}")`) : "none");
const artOf = (item) => item?.album?.images?.[0]?.url || item?.images?.[0]?.url || "";
const artistsOf = (t) => (t?.artists || []).map((a) => a.name).join(", ");
const hash = (text) => {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const setArt = (node, url) => {
  if (node) node.style.backgroundImage = bgUrl(url);
};
const setIcon = (useEl, name) => {
  if (useEl) useEl.setAttribute("href", `#i-${name}`);
};
const isTypingTarget = (node) =>
  !!node && (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(node.tagName) || node.isContentEditable);

/* ---------- 3. Sprite ikon (SVG inline bergaya garis tebal) ---------- */
const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-note" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></symbol>
<symbol id="i-prev" viewBox="0 0 24 24"><path d="M5 5v14"/><path d="M19 5.5v13a1 1 0 0 1-1.5.86l-9.5-6.5a1 1 0 0 1 0-1.72l9.5-6.14A1 1 0 0 1 19 5.5z"/></symbol>
<symbol id="i-next" viewBox="0 0 24 24"><path d="M19 5v14"/><path d="M5 5.5v13a1 1 0 0 0 1.5.86l9.5-6.5a1 1 0 0 0 0-1.72L6.5 4.64A1 1 0 0 0 5 5.5z"/></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-9.2-9.1C1.7 7.8 3.6 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.4 0 5.3 3.3 4.2 6.4C19.5 15.4 12 20 12 20z"/></symbol>
<symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></symbol>
<symbol id="i-repeat" viewBox="0 0 24 24"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></symbol>
<symbol id="i-queue" viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.6"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="4.5" cy="18" r="1.6"/></symbol>
<symbol id="i-volume" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.8 6a8.5 8.5 0 0 1 0 12"/></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5h4v5"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/></symbol>
<symbol id="i-library" viewBox="0 0 24 24"><path d="M4 4v16M9 4v16M14 4l5 16"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/></symbol>
</defs></svg>`;

function injectSprite() {
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
}

/* ---------- 4. Tema (Paper Light / Ink Dark) ---------- */
function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  $$("[data-set-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setTheme === next)));
  $$("[data-theme-icon]").forEach((u) => setIcon(u, next === "dark" ? "sun" : "moon"));
}
function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(KEYS.theme, theme);
  } catch (_) {
    /* penyimpanan diblokir: tema tetap berlaku untuk sesi ini */
  }
}
function initTheme() {
  let saved = "light";
  try {
    saved = localStorage.getItem(KEYS.theme) || "light";
  } catch (_) {
    /* abaikan */
  }
  applyTheme(saved);
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-theme-toggle]")) {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    }
    const pick = e.target.closest("[data-set-theme]");
    if (pick) setTheme(pick.dataset.setTheme);
  });
}

/* ---------- 5. Notifikasi dan overlay ---------- */
function toast(message, type = "info", duration = 3400) {
  const wrap = $("#toasts");
  if (!wrap) return;
  const node = el("div", `toast toast--${type}`, message);
  node.setAttribute("role", type === "error" ? "alert" : "status");
  wrap.appendChild(node);
  while (wrap.children.length > 4) wrap.firstElementChild.remove();
  setTimeout(() => {
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 320);
  }, duration);
}
function showOverlay(text) {
  const overlay = $("#authOverlay");
  if (!overlay) return;
  $("#authText").textContent = text;
  overlay.hidden = false;
}
function hideOverlay() {
  const overlay = $("#authOverlay");
  if (overlay) overlay.hidden = true;
}

/* ---------- 6. Sesi dan token (sessionStorage) ---------- */
class AuthError extends Error {}
class ApiError extends Error {
  constructor(status, message, reason = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
  }
}
function readToken() {
  try {
    return JSON.parse(sessionStorage.getItem(KEYS.token) || "null");
  } catch (_) {
    return null;
  }
}
function writeToken(data, previous) {
  const token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || previous?.refresh_token || null,
    expires_at: Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000,
    scope: data.scope || previous?.scope || ""
  };
  sessionStorage.setItem(KEYS.token, JSON.stringify(token));
  return token;
}
function clearSession() {
  [KEYS.token, KEYS.verifier, KEYS.oauthState].forEach((key) => sessionStorage.removeItem(key));
}
function isLoggedIn() {
  return !!readToken()?.access_token;
}
function isAuthFailure(err) {
  return err instanceof AuthError || (err instanceof ApiError && err.status === 401);
}
function sessionExpired() {
  teardownPlayer();
  clearSession();
  location.replace("login.html?error=session_expired");
}

/* ---------- 7. PKCE dan login ---------- */
const base64url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
async function codeChallengeOf(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}
function showLoginError(message) {
  const box = $("#authError");
  if (!box) {
    toast(message, "error", 5000);
    return;
  }
  box.textContent = message;
  box.hidden = false;
}
async function startLogin() {
  const button = $("#connectBtn");
  if (button) button.disabled = true;
  try {
    const verifier = randomString(64);
    const oauthState = randomString(24);
    sessionStorage.setItem(KEYS.verifier, verifier);
    sessionStorage.setItem(KEYS.oauthState, oauthState);
    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      response_type: "code",
      redirect_uri: CONFIG.REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: await codeChallengeOf(verifier),
      scope: CONFIG.SCOPES.join(" "),
      state: oauthState
    });
    location.assign(`${SPOTIFY.ACCOUNTS}/authorize?${params.toString()}`);
  } catch (err) {
    console.error(err);
    if (button) button.disabled = false;
    showLoginError("Gagal memulai login. Muat ulang halaman lalu coba lagi.");
  }
}

/* ---------- 8. Callback OAuth (ditangani di index.html) ---------- */
async function handleAuthCallback() {
  const error = PARAMS.get("error");
  const code = PARAMS.get("code");
  if (!error && !code) return false;

  history.replaceState(null, "", location.pathname);
  showOverlay("Menghubungkan ke Spotify…");

  if (error) {
    hideOverlay();
    location.replace(`login.html?error=${encodeURIComponent(error)}`);
    return true;
  }

  const verifier = sessionStorage.getItem(KEYS.verifier);
  const expectedState = sessionStorage.getItem(KEYS.oauthState);
  sessionStorage.removeItem(KEYS.verifier);
  sessionStorage.removeItem(KEYS.oauthState);

  if (!verifier || PARAMS.get("state") !== expectedState) {
    hideOverlay();
    location.replace("login.html?error=state_mismatch");
    return true;
  }

  try {
    const res = await fetch(`${SPOTIFY.ACCOUNTS}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: CONFIG.REDIRECT_URI,
        code_verifier: verifier
      })
    });
    if (!res.ok) throw new Error(`token ${res.status}`);
    writeToken(await res.json(), null);
    location.replace("dashboard.html");
  } catch (err) {
    console.error(err);
    hideOverlay();
    location.replace("login.html?error=token_exchange");
  }
  return true;
}

/* ---------- 9. Refresh token dan wrapper Web API ---------- */
async function refreshAccessToken(token) {
  if (!token?.refresh_token) throw new AuthError("Refresh token tidak tersedia.");
  const res = await fetch(`${SPOTIFY.ACCOUNTS}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token
    })
  });
  if (!res.ok) throw new AuthError(`Refresh token gagal (${res.status}).`);
  return writeToken(await res.json(), token);
}
async function getAccessToken() {
  const token = readToken();
  if (!token?.access_token) return null;
  if (Date.now() < token.expires_at) return token.access_token;
  if (!state.refreshing) {
    state.refreshing = refreshAccessToken(token).finally(() => {
      state.refreshing = null;
    });
  }
  const fresh = await state.refreshing;
  return fresh.access_token;
}
async function api(path, { method = "GET", query, body, retry = true } = {}) {
  const token = await getAccessToken();
  if (!token) throw new AuthError("Sesi tidak ditemukan. Silakan login.");

  const url = new URL(`${SPOTIFY.API}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  const init = { method, headers: { Authorization: `Bearer ${token}` } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);

  if (res.status === 401 && retry) {
    const stale = readToken();
    if (stale) {
      stale.expires_at = 0;
      sessionStorage.setItem(KEYS.token, JSON.stringify(stale));
    }
    return api(path, { method, query, body, retry: false });
  }
  if (res.status === 429 && retry) {
    const wait = Number(res.headers.get("Retry-After") || 1);
    if (wait <= 5) {
      await sleep(wait * 1000);
      return api(path, { method, query, body, retry: false });
    }
  }
  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.message || `Permintaan gagal (${res.status}).`,
      data?.error?.reason || ""
    );
  }
  return data;
}
function friendlyError(err) {
  if (err instanceof ApiError) {
    if (/premium/i.test(err.message)) return "Fitur ini membutuhkan Spotify Premium.";
    if (err.status === 403 && /scope/i.test(err.message)) return "Izin akun belum lengkap. Logout lalu login ulang.";
    if (err.status === 403) return "Akses ditolak Spotify. Pastikan akunmu terdaftar di aplikasi ini.";
    if (err.status === 404) return "Pemutar belum aktif. Coba lagi beberapa detik.";
    if (err.status === 429) return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
  }
  return err?.message || "Terjadi kesalahan tak terduga.";
}
function requireAuth() {
  if (IS_DEMO || isLoggedIn()) return true;
  location.replace("login.html");
  return false;
}

/* ---------- 10. Inisialisasi landing dan login ---------- */
async function initLanding() {
  await handleAuthCallback();
}
function initLogin() {
  const code = PARAMS.get("error");
  if (code) {
    showLoginError(AUTH_ERRORS[code] || `Login gagal (${code}). Coba lagi.`);
    history.replaceState(null, "", location.pathname);
  } else if (isLoggedIn()) {
    location.replace("dashboard.html");
    return;
  }
  $("#connectBtn")?.addEventListener("click", startLogin);
}

/* ---------- 11. Utilitas umum halaman ---------- */
function keepDemoInLinks() {
  if (!IS_DEMO) return;
  $$("a[href]").forEach((a) => {
    const raw = a.getAttribute("href");
    if (!/^(dashboard|profile)\.html/.test(raw)) return;
    const url = new URL(raw, location.href);
    url.searchParams.set("demo", "1");
    a.setAttribute("href", `${url.pathname.split("/").pop()}${url.search}${url.hash}`);
  });
}
function initReveal() {
  const items = $$(".reveal");
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach((node) => node.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  items.forEach((node) => io.observe(node));
}

/* ==========================================================================
   Bagian 2: data demo, render daftar, SDK, transport, dan Like
   ========================================================================== */

/* ---------- 12. Data demo (tanpa jaringan) ---------- */
function demoArt(seed) {
  const pal = ["#FFD6BA", "#B8E0D2", "#D6C7E8", "#FFF2B2", "#FF9B85"];
  const h = hash(seed);
  const bg = pal[h % 5];
  const c2 = pal[(h >> 4) % 5];
  const c3 = pal[(h >> 8) % 5];
  const motif = [
    '<path d="M20 240q40-60 80 0t80 0t80 0" fill="none" stroke="#2B2B2B" stroke-width="12" stroke-linecap="round"/>',
    `<rect x="70" y="70" width="160" height="160" fill="${c3}" stroke="#2B2B2B" stroke-width="10" transform="rotate(${(h % 30) - 15} 150 150)"/>`,
    `<polygon points="150,36 262,246 38,246" fill="${c3}" stroke="#2B2B2B" stroke-width="10"/>`
  ][h % 3];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="${bg}"/><circle cx="${140 + (h % 30)}" cy="${128 - (h % 24)}" r="${84 + (h % 34)}" fill="${c2}" stroke="#2B2B2B" stroke-width="10"/>${motif}</svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

const DEMO = {
  profile: { id: "demo", display_name: "Nexa Fan (Demo)", images: [{ url: demoArt("me") }], product: "premium" },
  tracks: [
    ["Sunrise Comic Strip", "Pastel Riot", "Pastel Riot Vol. 1", 214],
    ["Ink & Honey", "The Halftone Dots", "Dot Grid", 187],
    ["Paper Airplane Rush", "Nova Lines", "Folded Skies", 232],
    ["Neon Pow!", "Comic Circuit", "Pow Pow EP", 196],
    ["Midnight Doodle", "Ink Velvet", "Night Sketch", 251],
    ["Coral Bounce", "Mint Parade", "Bounce House", 178],
    ["Lavender Thunder", "Sketchbook Club", "Thunder Pages", 224],
    ["Yellow Sticker", "Nexa Sisters", "Sticker Pack", 205],
    ["Spray Can Summer", "Pastel Riot", "Pastel Riot Vol. 1", 189],
    ["Hard Shadow Blues", "Ink Velvet", "Night Sketch", 263]
  ].map(([name, artist, album, secs], i) => ({
    id: `demo${i}`,
    uri: `spotify:track:demo${i}`,
    name,
    artists: [{ name: artist }],
    album: { name: album, images: [{ url: demoArt(`t${i}`) }] },
    duration_ms: secs * 1000
  })),
  playlists: ["Chill Paper", "Ink & Coffee", "Workout Halftone", "Pastel Sunday", "Late Night Panels", "Road Trip Comics"]
    .map((name, i) => ({
      id: `dp${i}`,
      uri: `spotify:playlist:dp${i}`,
      name,
      owner: { display_name: "Nexa Fan (Demo)" },
      items: { total: 8 + i * 3 },
      images: [{ url: demoArt(`p${i}`) }]
    })),
  artists: ["Pastel Riot", "The Halftone Dots", "Nova Lines", "Comic Circuit", "Ink Velvet", "Mint Parade"]
    .map((name, i) => ({
      id: `da${i}`,
      name,
      genres: i % 2 ? ["paper rock"] : ["comic pop"],
      images: [{ url: demoArt(`a${i}`) }]
    }))
};

/* ---------- 13. Render daftar lagu ---------- */
const listRegistry = new Map();

function trackRow(track, index) {
  const li = el("li", "track");
  li.dataset.index = String(index);
  if (state.current?.id === track.id) li.classList.add("is-playing");

  const art = el("span", "track__art");
  setArt(art, artOf(track));
  const meta = el("span", "track__meta");
  meta.append(el("span", "track__title", track.name), el("span", "track__artist", artistsOf(track)));
  const play = el("button", "track__play");
  play.type = "button";
  play.setAttribute("aria-label", `Putar ${track.name}`);
  play.innerHTML = '<svg class="icon icon--fill" aria-hidden="true"><use href="#i-play"/></svg>';

  li.append(
    el("span", "track__idx", String(index + 1)),
    art,
    meta,
    el("span", "track__dur", fmtTime(track.duration_ms)),
    play
  );
  return li;
}

function compactRow(track) {
  const li = el("li", "track");
  const art = el("span", "track__art");
  setArt(art, artOf(track));
  const meta = el("span", "track__meta");
  meta.append(el("span", "track__title", track.name), el("span", "track__artist", artistsOf(track)));
  li.append(art, meta, el("span", "track__dur", fmtTime(track.duration_ms)));
  return li;
}

function emptyRow(text) {
  return el("li", "track track--empty", text);
}

function skeletonRows(count = 4) {
  return Array.from({ length: count }, () => el("li", "track is-skeleton"));
}

function renderList(listEl, tracks, emptyText, onPlay) {
  listRegistry.set(listEl.id, { tracks, onPlay });
  const rows = tracks.length
    ? tracks.slice(0, 50).map((t, i) => trackRow(t, i))
    : [emptyRow(emptyText)];
  listEl.replaceChildren(...rows);
  listEl.setAttribute("aria-busy", "false");
  highlightRows();
}

function highlightRows() {
  $$(".track[data-index]").forEach((row) => {
    const entry = listRegistry.get(row.closest("ol")?.id);
    const track = entry?.tracks[Number(row.dataset.index)];
    row.classList.toggle("is-playing", !!track && track.id === state.current?.id);
  });
}

/* Satu listener per daftar (delegasi), sehingga tidak menumpuk saat render ulang */
function bindListClicks() {
  ["likedList", "recentList", "searchList"].forEach((id) => {
    $(`#${id}`)?.addEventListener("click", (e) => {
      const button = e.target.closest(".track__play");
      if (!button) return;
      const entry = listRegistry.get(button.closest("ol").id);
      const row = button.closest(".track");
      if (entry && row) entry.onPlay(Number(row.dataset.index));
    });
  });
}

/* ---------- 14. Web Playback SDK ---------- */
function loadSdk() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  if (!state.sdkPromise) {
    state.sdkPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Spotify Web Playback SDK tidak merespons.")), 15000);
      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timer);
        resolve(window.Spotify);
      };
      const script = document.createElement("script");
      script.src = SPOTIFY.SDK;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Gagal memuat Spotify Web Playback SDK."));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      state.sdkPromise = null;
      throw err;
    });
  }
  return state.sdkPromise;
}

async function initPlayer() {
  const Spotify = await loadSdk();
  const player = new Spotify.Player({
    name: "NexaVerse Play",
    volume: state.volume,
    getOAuthToken: async (cb) => {
      try {
        cb(await getAccessToken());
      } catch (_) {
        sessionExpired();
      }
    }
  });
  state.player = player;
  bindPlayerEvents(player);
  const connected = await player.connect();
  if (!connected) throw new Error("Browser tidak bisa tersambung ke Spotify Connect.");
}

function bindPlayerEvents(player) {
  const on = (event, handler) => {
    player.addListener(event, handler);
    state.listeners.push([event, handler]);
  };
  on("ready", ({ device_id: id }) => {
    state.deviceId = id;
    state.playbackReady = true;
    if (state.premium === null) setPremium(true);
    toast("Pemutar siap. Pilih lagu untuk mulai.", "ok", 2400);
    refreshControls();
  });
  on("not_ready", () => {
    state.playbackReady = false;
    refreshControls();
  });
  on("player_state_changed", applySdkState);
  on("account_error", () => setPremium(false));
  on("authentication_error", () => sessionExpired());
  on("initialization_error", ({ message }) => toast(`Inisialisasi pemutar gagal: ${message}`, "error", 6000));
  on("playback_error", ({ message }) => toast(`Pemutaran bermasalah: ${message}`, "error", 5000));
}

function teardownPlayer() {
  const player = state.player;
  if (!player) return;
  state.listeners.forEach(([event, handler]) => player.removeListener(event, handler));
  state.listeners = [];
  try {
    player.disconnect();
  } catch (_) {
    /* sudah terputus */
  }
  state.player = null;
  state.deviceId = null;
  state.playbackReady = false;
}

function setPremium(value) {
  state.premium = value;
  renderPlan();
  if (value === false) {
    refreshControls();
    openModal("premiumModal");
  }
}

/* ---------- 15. Status pemutaran dari SDK ---------- */
function applySdkState(s) {
  if (!s) {
    freezePosition();
    state.paused = true;
    renderPlayback();
    return;
  }
  const track = s.track_window?.current_track || null;
  const changed = (track?.id || null) !== (state.current?.id || null);
  state.current = track;
  state.queue = s.track_window?.next_tracks || [];
  state.paused = !!s.paused;
  state.positionMs = s.position || 0;
  state.durationMs = s.duration || track?.duration_ms || 0;
  state.syncedAt = performance.now();
  state.shuffle = !!s.shuffle;
  state.repeat = ["off", "context", "track"][s.repeat_mode] || "off";
  if (changed) onTrackChanged();
  renderPlayback();
}

function onTrackChanged() {
  state.lastSec = -1;
  state.bpm = 88 + (hash(state.current?.id || "nexa") % 52);
  refreshLikeState();
  if (!$("#queuePanel")?.hidden) renderQueue();
  highlightRows();
}

function currentPosition() {
  if (!state.current || state.paused) return state.positionMs;
  const max = state.durationMs || Infinity;
  return Math.min(max, state.positionMs + (performance.now() - state.syncedAt));
}
function freezePosition() {
  state.positionMs = currentPosition();
  state.syncedAt = performance.now();
}
function trackDuration() {
  return state.durationMs || state.current?.duration_ms || 0;
}
function setCurrent(track, { paused = false, position = 0 } = {}) {
  const changed = (track?.id || null) !== (state.current?.id || null);
  state.current = track || null;
  state.paused = paused;
  state.positionMs = position;
  state.durationMs = track?.duration_ms || 0;
  state.syncedAt = performance.now();
  if (changed) onTrackChanged();
  renderPlayback();
}

/* ---------- 16. Transport demo (simulasi tanpa audio) ---------- */
function demoStart(list, index) {
  if (!list.length) return;
  state.demoList = list;
  state.demoIndex = clamp(index, 0, list.length - 1);
  toast("Mode demo: pemutaran disimulasikan tanpa audio.", "info", 2600);
  setCurrent(list[state.demoIndex], { paused: false });
}
function demoStep(dir) {
  const n = state.demoList.length;
  if (!n) return;
  state.demoIndex = state.shuffle
    ? Math.floor(Math.random() * n)
    : (state.demoIndex + dir + n) % n;
  setCurrent(state.demoList[state.demoIndex], { paused: state.paused });
}

/* ---------- 17. Transport asli (Web API + SDK) ---------- */
function unlockAudio() {
  if (state.unlocked || typeof state.player?.activateElement !== "function") return;
  state.unlocked = true;
  state.player.activateElement().catch(() => {});
}
function requirePlayable() {
  if (state.premium === false) {
    openModal("premiumModal");
    return false;
  }
  if (!state.playbackReady || !state.deviceId) {
    toast("Pemutar sedang disiapkan. Coba lagi sebentar.", "info");
    return false;
  }
  return true;
}
function handlePlayError(err) {
  if (isAuthFailure(err)) return sessionExpired();
  if (err instanceof ApiError && err.status === 403 && /premium/i.test(err.message)) return setPremium(false);
  toast(friendlyError(err), "error", 5000);
}
async function activateDevice() {
  await api("/me/player", { method: "PUT", body: { device_ids: [state.deviceId], play: false } });
}
async function startPlayback(body) {
  const query = { device_id: state.deviceId };
  try {
    await api("/me/player/play", { method: "PUT", query, body });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    await activateDevice();
    await api("/me/player/play", { method: "PUT", query, body });
  }
}
async function playTracks(tracks, index = 0) {
  if (!tracks.length) return toast("Daftar lagu masih kosong.", "info");
  if (state.demo) return demoStart(tracks, index);
  if (!requirePlayable()) return;
  unlockAudio();
  try {
    await startPlayback({ uris: tracks.slice(index, index + 50).map((t) => t.uri) });
    setCurrent(tracks[index]);
  } catch (err) {
    handlePlayError(err);
  }
}
async function playContext(uri) {
  if (state.demo) return demoStart(DEMO.tracks, 0);
  if (!requirePlayable()) return;
  unlockAudio();
  try {
    await startPlayback({ context_uri: uri });
    toast("Memutar playlist.", "ok", 1800);
  } catch (err) {
    handlePlayError(err);
  }
}
async function togglePlay() {
  if (state.demo) {
    if (!state.current) return demoStart(DEMO.tracks, 0);
    freezePosition();
    state.paused = !state.paused;
    return renderPlayback();
  }
  if (!requirePlayable()) return;
  unlockAudio();
  if (!state.current) {
    const fallback = state.lists.liked.length ? state.lists.liked : state.lists.recent;
    if (!fallback.length) return toast("Pilih lagu terlebih dahulu.", "info");
    return playTracks(fallback, 0);
  }
  try {
    await state.player.togglePlay();
  } catch (err) {
    handlePlayError(err);
  }
}
async function skip(dir) {
  if (state.demo) return demoStep(dir);
  if (!requirePlayable()) return;
  try {
    await (dir > 0 ? state.player.nextTrack() : state.player.previousTrack());
  } catch (err) {
    handlePlayError(err);
  }
}
async function seekTo(ms) {
  if (state.demo) {
    state.positionMs = ms;
    state.syncedAt = performance.now();
    state.lastSec = -1;
    return renderPlayback();
  }
  if (!requirePlayable()) return;
  try {
    await state.player.seek(ms);
    state.positionMs = ms;
    state.syncedAt = performance.now();
    state.lastSec = -1;
  } catch (err) {
    handlePlayError(err);
  }
}
function setVolume(percent) {
  state.volume = clamp(percent / 100, 0, 1);
  try {
    localStorage.setItem(KEYS.volume, String(state.volume));
  } catch (_) {
    /* abaikan */
  }
  if (!state.demo && state.player) state.player.setVolume(state.volume).catch(() => {});
}
async function toggleShuffle() {
  const next = !state.shuffle;
  if (state.demo) {
    state.shuffle = next;
    return renderModes();
  }
  if (!requirePlayable()) return;
  try {
    await api("/me/player/shuffle", { method: "PUT", query: { state: next, device_id: state.deviceId } });
    state.shuffle = next;
    renderModes();
  } catch (err) {
    handlePlayError(err);
  }
}
async function cycleRepeat() {
  const order = ["off", "context", "track"];
  const next = order[(order.indexOf(state.repeat) + 1) % order.length];
  if (state.demo) {
    state.repeat = next;
    return renderModes();
  }
  if (!requirePlayable()) return;
  try {
    await api("/me/player/repeat", { method: "PUT", query: { state: next, device_id: state.deviceId } });
    state.repeat = next;
    renderModes();
  } catch (err) {
    handlePlayError(err);
  }
}

/* ---------- 18. Tombol Like (library) ---------- */
function setLike(on) {
  const button = $("#likeBtn");
  if (!button) return;
  button.setAttribute("aria-pressed", String(!!on));
  button.setAttribute("aria-label", on ? "Hapus dari Liked Songs" : "Simpan ke Liked Songs");
}
async function refreshLikeState() {
  const track = state.current;
  if (!track?.id) return setLike(false);
  if (state.liked.has(track.id)) return setLike(state.liked.get(track.id));
  if (state.demo) return setLike(false);
  try {
    const [saved] = await api("/me/library/contains", { query: { uris: track.uri } });
    state.liked.set(track.id, !!saved);
    if (state.current?.id === track.id) setLike(!!saved);
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    setLike(false);
  }
}
async function toggleLike() {
  const track = state.current;
  if (!track) return toast("Belum ada lagu yang diputar.", "info");
  const next = !state.liked.get(track.id);
  state.liked.set(track.id, next);
  setLike(next);
  if (state.demo) {
    return toast(next ? "Ditambahkan ke Liked Songs (demo)." : "Dihapus dari Liked Songs (demo).", "ok");
  }
  try {
    await api("/me/library", { method: next ? "PUT" : "DELETE", query: { uris: track.uri } });
    toast(next ? "Ditambahkan ke Liked Songs." : "Dihapus dari Liked Songs.", "ok");
    loadLiked();
  } catch (err) {
    state.liked.set(track.id, !next);
    setLike(!next);
    if (isAuthFailure(err)) return sessionExpired();
    toast(friendlyError(err), "error", 5000);
  }
}

/* ---------- 19. Render Now Playing Card ---------- */
function setPlayIcon(playing) {
  setIcon($("#playBtn use"), playing ? "pause" : "play");
  setIcon($("#miniPlayBtn use"), playing ? "pause" : "play");
  const label = playing ? "Jeda" : "Putar";
  $("#playBtn").setAttribute("aria-label", label);
  $("#miniPlayBtn").setAttribute("aria-label", label);
}
function renderModes() {
  $("#shuffleBtn").setAttribute("aria-pressed", String(state.shuffle));
  const repeatBtn = $("#repeatBtn");
  repeatBtn.setAttribute("aria-pressed", String(state.repeat !== "off"));
  const labels = { off: "mati", context: "seluruh daftar", track: "satu lagu" };
  repeatBtn.setAttribute("aria-label", `Ulangi: ${labels[state.repeat]}`);
  $("#repeatBadge").hidden = state.repeat !== "track";
}
function refreshControls() {
  const locked = !state.demo && state.premium === false;
  const hasTrack = !!state.current;
  ["#playBtn", "#prevBtn", "#nextBtn", "#miniPlayBtn", "#miniPrev", "#miniNext", "#shuffleBtn", "#repeatBtn", "#playLikedBtn"]
    .forEach((selector) => {
      const node = $(selector);
      if (node) node.disabled = locked;
    });
  $("#seek").disabled = locked || !hasTrack;
  $("#likeBtn").disabled = !hasTrack;
}
function renderProgress() {
  const pos = currentPosition();
  const dur = trackDuration();
  const ratio = dur ? clamp(pos / dur, 0, 1) : 0;
  const seek = $("#seek");
  if (!state.seeking) seek.value = String(Math.round(ratio * 1000));
  seek.style.setProperty("--p", `${(ratio * 100).toFixed(2)}%`);
  const sec = Math.floor(pos / 1000);
  if (sec !== state.lastSec) {
    state.lastSec = sec;
    $("#curTime").textContent = fmtTime(pos);
    $("#durTime").textContent = fmtTime(dur);
  }
}
function renderPlayback() {
  const t = state.current;
  const playing = !!t && !state.paused;
  $("#nowPlaying").classList.toggle("is-playing", playing);
  $("#npTitle").textContent = t ? t.name : "Belum ada lagu";
  $("#npArtist").textContent = t ? artistsOf(t) : "Pilih lagu dari daftar di bawah";
  setArt($("#npArt"), t ? artOf(t) : "");
  setArt($("#miniArt"), t ? artOf(t) : "");
  $("#miniTitle").textContent = t ? t.name : "Belum ada lagu";
  $("#miniArtist").textContent = t ? artistsOf(t) : "—";
  setPlayIcon(playing);
  renderModes();
  renderProgress();
  syncLoop();
  refreshControls();
  updateMini();
  highlightRows();
  document.title = playing ? `▶ ${t.name} · NexaVerse Play` : "Dashboard · NexaVerse Play";
}

/* ---------- 20. Visualizer (simulasi berbasis tempo semu) ---------- */
/* Catatan: audio dari Web Playback SDK tidak bisa dianalisis oleh Web Audio API,
   sehingga bar bergerak mengikuti tempo semu yang diturunkan dari ID lagu. */
function buildVisualizer() {
  const host = $("#npViz");
  host.replaceChildren(...Array.from({ length: VIZ_BARS }, () => el("span", "viz-bar")));
  state.bars = $$(".viz-bar", host);
}
function animateViz(now) {
  const bars = state.bars;
  const t = now / 1000;
  const beat = ((t * state.bpm) / 60) % 1;
  const kick = Math.pow(1 - beat, 4);
  const amp = REDUCED ? 0.45 : 1;
  bars.forEach((bar, i) => {
    const weight = 1 - (i / bars.length) * 0.55;
    const wave = 0.5 + 0.5 * Math.sin(t * (2.2 + i * 0.41) + i * 1.3) * Math.cos(t * (0.8 + (i % 4) * 0.27));
    const target = clamp((0.12 + wave * 0.5 + kick * weight * 0.55) * amp, 0.08, 1);
    const level = state.levels[i] + (target - state.levels[i]) * 0.3;
    state.levels[i] = level;
    bar.style.setProperty("--s", level.toFixed(3));
  });
}
function idleViz() {
  state.bars.forEach((bar, i) => {
    state.levels[i] = 0.12;
    bar.style.setProperty("--s", "0.12");
  });
}

/* ---------- 21. Loop animasi (satu rAF, dihentikan saat jeda) ---------- */
function tick(now) {
  renderProgress();
  const dur = trackDuration();
  if (state.demo && state.current && !state.paused && dur > 0 && currentPosition() >= dur) {
    demoStep(1);
    return;
  }
  if (state.current && !state.paused) animateViz(now);
}
function startLoop() {
  if (state.liveLoop) return;
  const frame = (now) => {
    state.liveLoop = requestAnimationFrame(frame);
    tick(now);
  };
  state.liveLoop = requestAnimationFrame(frame);
}
function stopLoop() {
  if (state.liveLoop) cancelAnimationFrame(state.liveLoop);
  state.liveLoop = 0;
}
function syncLoop() {
  if (state.current && !state.paused) {
    startLoop();
  } else {
    stopLoop();
    idleViz();
  }
}

/* ==========================================================================
   Bagian 3: UI dashboard (mini player, antrean, navigasi, pencarian, library,
   identitas, dan modal)
   ========================================================================== */

/* ---------- 22. Mini player ---------- */
function updateMini() {
  $("#miniPlayer")?.classList.toggle("is-visible", !state.cardVisible && !!state.current);
}
function initMiniPlayer() {
  const card = $("#nowPlaying");
  if (!card || !("IntersectionObserver" in window)) return;
  state.io = new IntersectionObserver(([entry]) => {
    state.cardVisible = entry.isIntersecting;
    updateMini();
  }, { threshold: 0.2 });
  state.io.observe(card);
}

/* ---------- 23. Antrean berikutnya ---------- */
function renderQueue() {
  const upcoming = state.demo
    ? state.demoList.slice(state.demoIndex + 1).concat(state.demoList.slice(0, state.demoIndex))
    : state.queue;
  const items = (upcoming || []).filter(Boolean).slice(0, 10);
  $("#queueList").replaceChildren(...(items.length ? items.map(compactRow) : [emptyRow("Antrean kosong.")]));
}
function toggleQueue() {
  const panel = $("#queuePanel");
  const open = panel.hidden;
  panel.hidden = !open;
  $("#queueBtn").setAttribute("aria-expanded", String(open));
  if (open) renderQueue();
}

/* ---------- 24. Navigasi tampilan (berdasarkan hash) ---------- */
function setView(name) {
  const target = document.getElementById(`view-${name}`) ? name : "home";
  state.view = target;
  $$("[data-view]").forEach((view) => {
    const active = view.dataset.view === target;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });
  $$(".side-nav [data-nav]").forEach((link) => {
    const active = link.dataset.nav === target;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (target === "library" && !state.playlists.length) loadPlaylists();
  updateMini();
}

/* ---------- 25. Pencarian ---------- */
async function runSearch(rawQuery) {
  const status = $("#searchStatus");
  const list = $("#searchList");
  const q = rawQuery.trim();
  if (!q) {
    status.textContent = "Ketik judul lagu atau nama artis.";
    list.replaceChildren();
    return;
  }
  status.textContent = "Mencari…";
  list.replaceChildren(...skeletonRows(3));
  try {
    const tracks = state.demo
      ? DEMO.tracks.filter((t) => `${t.name} ${artistsOf(t)}`.toLowerCase().includes(q.toLowerCase()))
      : ((await api("/search", { query: { q, type: "track", limit: 10 } }))?.tracks?.items || []).filter(Boolean);
    status.textContent = tracks.length ? `${tracks.length} hasil untuk “${q}”.` : `Tidak ada hasil untuk “${q}”.`;
    renderList(list, tracks, "Tidak ada lagu yang cocok.", (i) => playTracks(tracks, i));
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    status.textContent = friendlyError(err);
    list.replaceChildren();
  }
}

/* ---------- 26. Library: playlist, Liked Songs, dan Recently Played ---------- */
function playlistCard(pl) {
  const button = el("button", "pl-card");
  button.type = "button";
  button.setAttribute("aria-label", `Putar playlist ${pl.name}`);
  const art = el("span", "pl-card__art");
  setArt(art, artOf(pl));
  const total = pl.items?.total ?? pl.tracks?.total ?? 0;
  button.append(
    art,
    el("span", "pl-card__title", pl.name),
    el("span", "pl-card__sub", `${total} lagu · ${pl.owner?.display_name || "Kamu"}`)
  );
  button.addEventListener("click", () => playContext(pl.uri));
  return button;
}
async function loadPlaylists() {
  const status = $("#libraryStatus");
  const grid = $("#playlistGrid");
  status.textContent = "Memuat playlist…";
  try {
    const items = state.demo
      ? DEMO.playlists
      : ((await api("/me/playlists", { query: { limit: 50 } }))?.items || []).filter(Boolean);
    state.playlists = items;
    status.textContent = items.length ? `${items.length} playlist.` : "Belum ada playlist.";
    grid.replaceChildren(...items.map((pl) => playlistCard(pl)));
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    status.textContent = friendlyError(err);
  }
}
async function loadLiked() {
  const list = $("#likedList");
  const count = $("#likedCount");
  try {
    let tracks;
    let total;
    if (state.demo) {
      tracks = DEMO.tracks.slice(0, 8);
      total = tracks.length;
    } else {
      const res = await api("/me/tracks", { query: { limit: 50 } });
      tracks = (res?.items || []).map((item) => item.track).filter(Boolean);
      total = res?.total ?? tracks.length;
      tracks.forEach((t) => state.liked.set(t.id, true));
    }
    state.lists.liked = tracks;
    count.textContent = String(total);
    renderList(list, tracks, "Belum ada lagu yang disukai.", (i) => playTracks(state.lists.liked, i));
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    list.setAttribute("aria-busy", "false");
    list.replaceChildren(emptyRow(friendlyError(err)));
  }
}
async function loadRecent() {
  const list = $("#recentList");
  const count = $("#recentCount");
  try {
    let tracks;
    if (state.demo) {
      tracks = DEMO.tracks.slice(2, 9);
    } else {
      const res = await api("/me/player/recently-played", { query: { limit: 20 } });
      tracks = [];
      const seen = new Set();
      for (const item of res?.items || []) {
        const t = item.track;
        if (t && !seen.has(t.id)) {
          seen.add(t.id);
          tracks.push(t);
        }
      }
    }
    state.lists.recent = tracks;
    count.textContent = String(tracks.length);
    renderList(list, tracks, "Belum ada riwayat pemutaran.", (i) => playTracks(state.lists.recent, i));
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    list.setAttribute("aria-busy", "false");
    list.replaceChildren(emptyRow(friendlyError(err)));
  }
}

/* ---------- 27. Identitas, status Premium, dan akun ---------- */
function greetingWord() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}
function identityData() {
  if (state.me) return state.me;
  return state.demo ? DEMO.profile : null;
}
function renderIdentity() {
  const me = identityData();
  const name = me?.display_name || "Pengguna";
  const image = me?.images?.[0]?.url || "";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  ["topAvatar", "profAvatar"].forEach((id) => {
    const avatar = document.getElementById(id);
    if (!avatar) return;
    setArt(avatar, image);
    const fallback = avatar.querySelector(".avatar__fallback");
    if (fallback) {
      fallback.textContent = initial;
      fallback.hidden = !!image;
    }
  });
  if ($("#greetName")) {
    $("#greetKicker").textContent = greetingWord();
    $("#greetName").textContent = `Halo, ${name}!`;
  }
}
function planLabel() {
  if (state.demo) return "Demo";
  if (state.premium === true) return "Premium";
  if (state.premium === false) return "Bukan Premium";
  return "";
}
function renderPlan() {
  const label = planLabel();
  const badge = $("#planBadge");
  if (badge) {
    badge.hidden = !label;
    badge.textContent = label;
    badge.classList.toggle("badge--warn", state.premium === false);
  }
  const accountText = $("#accountText");
  if (accountText) {
    const name = identityData()?.display_name || "akunmu";
    accountText.textContent = state.demo
      ? "Mode demo: data contoh, tanpa akun Spotify."
      : `Masuk sebagai ${name}. Status: ${label || "sedang dicek"}.`;
  }
}

/* ---------- 28. Modal, animasi tombol, dan kontrol dashboard ---------- */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  modal.querySelector("button, a")?.focus();
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = true;
}
function triggerSplash(button) {
  if (REDUCED) return;
  button.classList.remove("is-splash");
  void button.offsetWidth;
  button.classList.add("is-splash");
  setTimeout(() => button.classList.remove("is-splash"), 700);
}
function logout() {
  teardownPlayer();
  clearSession();
  location.assign("login.html");
}
function onKeydown(e) {
  if (e.key === "Escape") {
    closeModal("premiumModal");
    return;
  }
  if (e.code === "Space" && PAGE === "dashboard" && !isTypingTarget(e.target) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    togglePlay();
  }
}
function bindDashboardControls() {
  $("#playBtn").addEventListener("click", (e) => {
    triggerSplash(e.currentTarget);
    togglePlay();
  });
  $("#miniPlayBtn").addEventListener("click", togglePlay);
  $("#prevBtn").addEventListener("click", () => skip(-1));
  $("#miniPrev").addEventListener("click", () => skip(-1));
  $("#nextBtn").addEventListener("click", () => skip(1));
  $("#miniNext").addEventListener("click", () => skip(1));
  $("#likeBtn").addEventListener("click", toggleLike);
  $("#shuffleBtn").addEventListener("click", toggleShuffle);
  $("#repeatBtn").addEventListener("click", cycleRepeat);
  $("#queueBtn").addEventListener("click", toggleQueue);
  $("#playLikedBtn").addEventListener("click", () => playTracks(state.lists.liked, 0));
  $("#miniOpen").addEventListener("click", () => {
    location.hash = "home";
    $("#nowPlaying").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
  });
  $("#volume").addEventListener("input", (e) => {
    const value = Number(e.target.value);
    e.target.style.setProperty("--p", `${value}%`);
    setVolume(value);
  });

  const seek = $("#seek");
  seek.addEventListener("input", () => {
    state.seeking = true;
    const ratio = Number(seek.value) / 1000;
    seek.style.setProperty("--p", `${(ratio * 100).toFixed(2)}%`);
    $("#curTime").textContent = fmtTime(trackDuration() * ratio);
  });
  seek.addEventListener("change", () => {
    state.seeking = false;
    state.lastSec = -1;
    seekTo(Math.round(trackDuration() * (Number(seek.value) / 1000)));
  });

  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch($("#searchInput").value);
  });
  $("#logoutBtn").addEventListener("click", logout);
  $$("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeModal("premiumModal")));
  $("#premiumModal").addEventListener("click", (e) => {
    if (e.target.id === "premiumModal") closeModal("premiumModal");
  });
  document.addEventListener("keydown", onKeydown);
}

/* ---------- 29. Inisialisasi dashboard ---------- */
async function initDashboard() {
  if (!requireAuth()) return;

  let savedVolume = NaN;
  try {
    savedVolume = Number(localStorage.getItem(KEYS.volume));
  } catch (_) {
    /* abaikan */
  }
  if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) state.volume = savedVolume;
  const volume = $("#volume");
  volume.value = String(Math.round(state.volume * 100));
  volume.style.setProperty("--p", `${Math.round(state.volume * 100)}%`);

  buildVisualizer();
  initMiniPlayer();
  bindListClicks();
  bindDashboardControls();
  window.addEventListener("hashchange", () => setView(location.hash.replace("#", "") || "home"));
  setView(location.hash.replace("#", "") || "home");
  renderModes();
  renderPlayback();

  if (state.demo) {
    $("#demoBanner").hidden = false;
    renderIdentity();
    renderPlan();
    refreshControls();
    await Promise.all([loadLiked(), loadRecent()]);
    return;
  }

  try {
    state.me = await api("/me");
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    toast(friendlyError(err), "error", 6000);
  }
  renderIdentity();
  // Field product hanya ada untuk aplikasi dengan kuota penuh.
  // Jika tidak ada, status Premium ditentukan oleh event account_error dari SDK.
  if (state.me?.product) setPremium(state.me.product === "premium");
  renderPlan();
  refreshControls();

  if (state.premium !== false) {
    initPlayer().catch((err) => {
      console.error(err);
      toast(`Pemutar belum siap: ${friendlyError(err)}`, "error", 7000);
    });
  }
  await Promise.allSettled([loadLiked(), loadRecent()]);
  renderPlan();
}

/* ---------- 30. Halaman profile ---------- */
const profileCache = {
  playlists: [],
  playlistTotal: 0,
  liked: [],
  likedTotal: 0,
  artists: [],
  recent: 0
};

function renderProfileHero() {
  const me = identityData();
  $("#profName").textContent = me?.display_name || "Pengguna";
  $("#profSub").textContent = IS_DEMO ? "Akun contoh untuk mode demo" : "Akun Spotify terhubung";
  const plan = IS_DEMO
    ? "Demo"
    : me?.product
      ? (me.product === "premium" ? "Premium" : "Bukan Premium")
      : "Spotify";
  const badge = $("#profPlan");
  badge.textContent = plan;
  badge.classList.toggle("badge--warn", !IS_DEMO && !!me?.product && me.product !== "premium");
}
function playlistLink(pl) {
  const link = el("a", "pl-card");
  link.href = pl.external_urls?.spotify
    || (IS_DEMO ? "dashboard.html?demo=1#library" : `https://open.spotify.com/playlist/${pl.id}`);
  if (!IS_DEMO) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  const art = el("span", "pl-card__art");
  setArt(art, artOf(pl));
  const total = pl.items?.total ?? pl.tracks?.total ?? 0;
  link.append(art, el("span", "pl-card__title", pl.name), el("span", "pl-card__sub", `${total} lagu`));
  return link;
}
function likedRow(track) {
  const row = el("li", "track");
  const art = el("span", "track__art");
  setArt(art, artOf(track));
  const meta = el("span", "track__meta");
  meta.append(el("span", "track__title", track.name), el("span", "track__artist", artistsOf(track)));
  const link = el("a", "ext-link", "Buka");
  link.href = track.external_urls?.spotify
    || (IS_DEMO ? "dashboard.html?demo=1#home" : `https://open.spotify.com/track/${track.id}`);
  if (!IS_DEMO) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  row.append(art, meta, link);
  return row;
}
function artistCard(artist) {
  const card = el("a", "artist-card");
  card.href = artist.external_urls?.spotify
    || (IS_DEMO ? "dashboard.html?demo=1#search" : `https://open.spotify.com/artist/${artist.id}`);
  if (!IS_DEMO) {
    card.target = "_blank";
    card.rel = "noopener noreferrer";
  }
  const art = el("span", "artist-card__art");
  setArt(art, artOf(artist));
  const genres = (artist.genres || []).slice(0, 2).join(", ") || "Artis";
  card.append(art, el("span", "artist-card__name", artist.name), el("span", "artist-card__sub", genres));
  return card;
}
function tabContent(name) {
  if (name === "liked") {
    const items = profileCache.liked;
    if (!items.length) return el("p", "status", "Belum ada lagu yang disukai.");
    const list = el("ol", "track-list track-list--compact");
    list.append(...items.map((t) => likedRow(t)));
    return list;
  }
  if (name === "artists") {
    const items = profileCache.artists;
    if (!items.length) return el("p", "status", "Belum ada data artis teratas.");
    const grid = el("div", "artist-grid");
    grid.append(...items.map((a) => artistCard(a)));
    return grid;
  }
  const items = profileCache.playlists;
  if (!items.length) return el("p", "status", "Belum ada playlist.");
  const grid = el("div", "grid");
  grid.append(...items.map((pl) => playlistLink(pl)));
  return grid;
}
function renderTab(name) {
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const panel = $("#tabPanel");
  panel.setAttribute("aria-labelledby", `tab-${name}`);
  panel.replaceChildren(tabContent(name));
}
function bindTabs() {
  const tabs = $$(".tab");
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => renderTab(tab.dataset.tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const step = e.key === "ArrowRight" ? 1 : tabs.length - 1;
      const next = tabs[(index + step) % tabs.length];
      next.focus();
      renderTab(next.dataset.tab);
    });
  });
}
async function initProfile() {
  if (!requireAuth()) return;
  $("#demoBanner").hidden = !IS_DEMO;
  bindTabs();

  try {
    if (IS_DEMO) {
      profileCache.playlists = DEMO.playlists;
      profileCache.playlistTotal = DEMO.playlists.length;
      profileCache.liked = DEMO.tracks.slice(0, 8);
      profileCache.likedTotal = profileCache.liked.length;
      profileCache.artists = DEMO.artists;
      profileCache.recent = 7;
    } else {
      const [me, playlists, liked, artists, recent] = await Promise.all([
        api("/me"),
        api("/me/playlists", { query: { limit: 50 } }),
        api("/me/tracks", { query: { limit: 50 } }),
        api("/me/top/artists", { query: { limit: 20, time_range: "medium_term" } }),
        api("/me/player/recently-played", { query: { limit: 20 } })
      ]);
      state.me = me;
      if (me?.product) state.premium = me.product === "premium";
      profileCache.playlists = (playlists?.items || []).filter(Boolean);
      profileCache.playlistTotal = playlists?.total ?? profileCache.playlists.length;
      profileCache.liked = (liked?.items || []).map((item) => item.track).filter(Boolean);
      profileCache.likedTotal = liked?.total ?? profileCache.liked.length;
      profileCache.artists = (artists?.items || []).filter(Boolean);
      profileCache.recent = (recent?.items || []).length;
    }
  } catch (err) {
    if (isAuthFailure(err)) return sessionExpired();
    $("#tabPanel").replaceChildren(el("p", "status", friendlyError(err)));
    return;
  }

  renderIdentity();
  renderProfileHero();
  $("#statPlaylists").textContent = String(profileCache.playlistTotal);
  $("#statLiked").textContent = String(profileCache.likedTotal);
  $("#statArtists").textContent = String(profileCache.artists.length);
  $("#statRecent").textContent = String(profileCache.recent);
  renderTab("playlists");
}

/* ---------- 31. Landing cleanup dan boot ---------- */
function cleanup() {
  stopLoop();
  if (state.io) state.io.disconnect();
  teardownPlayer();
}
window.addEventListener("pagehide", cleanup);

function boot() {
  document.documentElement.classList.add("js");
  injectSprite();
  initTheme();
  keepDemoInLinks();
  initReveal();
  const starters = { landing: initLanding, login: initLogin, dashboard: initDashboard, profile: initProfile };
  const start = starters[PAGE];
  if (start) {
    Promise.resolve(start()).catch((err) => console.error("NexaVerse Play:", err));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
