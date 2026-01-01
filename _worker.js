export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- 1. SETUP FALLBACK LINK (WAJIB DIGANTI)
    // Link ini akan dipakai jika GitHub Down, Error, atau links.txt kosong.
    const FALLBACK_LINK = "https://s.shopee.co.id/9pXfMxzjld"; 

    // ---- Health check
    if (pathname === "/health") return new Response("ok");

    // ---- Helper: load links.txt dari GitHub + edge cache 60s
    async function loadLinks() {
      const RAW_URL = "https://raw.githubusercontent.com/Hecate1337-py/shopeeaff/main/links.txt";
      const cache = caches.default;
      const cacheKey = new Request(RAW_URL, { cf: { cacheTtl: 60 } });

      let res = await cache.match(cacheKey);
      if (!res) {
        res = await fetch(cacheKey, { cf: { cacheTtl: 60 } });
        if (!res.ok) throw new Error("Failed to load links.txt");
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
      const text = await res.text();
      const lines = text
        .split("\n")
        .map(l => l.trim().replace(/[\u0000-\u001F\u007F]/g, ""))
        .filter(Boolean);
      if (!lines.length) throw new Error("No links available");
      return lines;
    }

    // ---- /proof : Halaman Bukti
    if (pathname === "/proof") {
      let aff = (env && env.SHOPEE_AFF_LINK) || "";
      if (!aff) {
        try {
          const lines = await loadLinks();
          aff = lines[0];
        } catch {
          aff = FALLBACK_LINK; // Gunakan fallback jika gagal load
        }
      }
      
      // Validasi URL biar gak error saat render HTML
      let safe = FALLBACK_LINK;
      try {
        const u = new URL(aff);
        if (/^https?:$/.test(u.protocol)) safe = u.toString();
      } catch {}

      const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Shopee Affiliate</title>
<style>
:root{--brand:#ee4d2d}
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:40px;text-align:center;color:#111}
.wrap{max-width:760px;margin:0 auto}
.btn{display:inline-block;padding:12px 22px;background:var(--brand);color:#fff;border-radius:10px;text-decoration:none;font-weight:600}
.box{margin-top:24px;padding:12px;background:#fafafa;border:1px solid #eee;border-radius:10px;word-break:break-all}
</style>
</head>
<body>
  <div class="wrap">
    <h1>Promo Shopee</h1>
    <p><a class="btn" href="${safe}" target="_blank">Buka Aplikasi</a></p>
    <div class="box"><strong>Link:</strong><br>${safe}</div>
  </div>
</body>
</html>`;
      return new Response(html, { headers: { "content-type": "text/html" } });
    }

    // ---- /preview : Cek link
    if (pathname === "/preview") {
      try {
        const links = await loadLinks();
        const html = `<!doctype html><h2>Daftar Link (${links.length})</h2><ol>${links.map(l => `<li><a href="${l}">${l}</a></li>`).join("")}</ol>`;
        return new Response(html, { headers: { "content-type": "text/html" } });
      } catch (e) {
        return new Response("Gagal load GitHub: " + e.message, { status: 500 });
      }
    }

    // ---- ROTATOR LOGIC
    try {
      const lines = await loadLinks();
      const selected = lines[Math.floor(Math.random() * lines.length)];

      let target;
      try {
        const u = new URL(selected);
        if (!/^https?:$/.test(u.protocol)) throw 0;
        target = u.toString();
      } catch {
        throw new Error("Invalid URL found");
      }

      return new Response(null, {
        status: 302,
        headers: { "Location": target, "Cache-Control": "no-store" }
      });

    } catch (e) {
      // !!!! SAFETY NET / JARING PENGAMAN !!!!
      // Jika error apapun terjadi (GitHub down, format salah), lari ke sini.
      return new Response(null, {
        status: 302,
        headers: { 
          "Location": FALLBACK_LINK, 
          "Cache-Control": "no-store" 
        }
      });
    }
  }
}
