export default {
  async fetch(request, env, ctx) {
    // Health check optional: akses /health buat cek cepat
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return new Response("ok");

    // --- Ambil links.txt dari GitHub raw, dengan Edge cache 60s ---
    const RAW_URL = "https://raw.githubusercontent.com/Hecate1337-py/shopeeaff/main/links.txt";
    const cache = caches.default;
    const cacheKey = new Request(RAW_URL, { cf: { cacheTtl: 60 } });

    let res = await cache.match(cacheKey);
    if (!res) {
      res = await fetch(cacheKey);
      if (!res.ok) return new Response("Failed to load links.txt", { status: 502 });
      // simpan di edge cache
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }

    const text = await res.text();

    // --- Bersihkan & filter baris kosong ---
    const lines = text
      .split("\n")
      .map(l => l.trim().replace(/[\u0000-\u001F\u007F]/g, "")) // buang control chars & CRLF
      .filter(Boolean);

    if (!lines.length) return new Response("No links available", { status: 500 });

    // --- Pilih acak ---
    const selected = lines[Math.floor(Math.random() * lines.length)];

    // --- Validasi URL (hanya http/https) ---
    let u;
    try {
      u = new URL(selected);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad scheme");
    } catch {
      return new Response("Invalid link in links.txt", { status: 400 });
    }

    // --- Redirect + no-store agar tidak di-cache browser ---
    return new Response(null, {
      status: 302,
      headers: {
        Location: u.toString(),
        "Cache-Control": "no-store"
      }
    });
  }
}
