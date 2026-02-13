export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // =================================================================
    // 1. SETUP
    // =================================================================
    const FALLBACK_LINK = "https://s.shopee.co.id/6pvD4CLvmb/";

    // =================================================================
    // 2. BLOCK BOTS (Hemat Kuota)
    // =================================================================
    const ua = request.headers.get("User-Agent") || "";
    if (/facebookexternalhit|WhatsApp|TelegramBot|Twitterbot|Discordbot|Googlebot|bingbot/i.test(ua)) {
      return new Response(`
        <!doctype html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Promo Shopee Spesial</title>
          <meta property="og:title" content="Rekomendasi Produk Shopee">
          <meta property="og:description" content="Klik link ini untuk melihat diskon spesial hari ini!">
          <meta property="og:image" content="https://cf.shopee.co.id/file/id-50009109-c9a9301e80826955a805c87532f30089">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body><h1>Redirecting...</h1></body>
        </html>`, 
        { headers: { "content-type": "text/html" } }
      );
    }

    if (pathname === "/health") return new Response("ok");

    // =================================================================
    // 3. LOAD LINKS (Cache 1 Jam)
    // =================================================================
    async function loadLinks() {
      const RAW_URL = "https://raw.githubusercontent.com/Hecate1337-py/shopeeaff/main/links.txt";
      const cache = caches.default;
      const cacheKey = new Request(RAW_URL);

      let res = await cache.match(cacheKey);

      if (!res) {
        res = await fetch(RAW_URL, { 
          cf: { cacheTtl: 3600, cacheEverything: true } 
        });

        if (!res.ok) throw new Error("Gagal mengambil links.txt");

        const resToCache = new Response(res.clone().body, res);
        resToCache.headers.set("Cache-Control", "public, max-age=3600");
        ctx.waitUntil(cache.put(cacheKey, resToCache));
      }

      const text = await res.text();
      const lines = text
        .split("\n")
        .map(l => l.trim().replace(/[\u0000-\u001F\u007F]/g, ""))
        .filter(Boolean);

      if (!lines.length) throw new Error("File links.txt kosong");
      return lines;
    }

    // =================================================================
    // 4. HALAMAN DEBUG
    // =================================================================
    if (pathname === "/proof") {
      return new Response(null, { status: 302, headers: { Location: FALLBACK_LINK } });
    }

    if (pathname === "/preview") {
      try {
        const links = await loadLinks();
        const html = `<h2>Total Link: ${links.length}</h2><ol>${links.map(l => `<li>${l}</li>`).join("")}</ol>`;
        return new Response(html, { headers: { "content-type": "text/html" } });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    // =================================================================
    // 5. ROTATOR UTAMA + DETEKSI SUMBER
    // =================================================================
    try {
      const lines = await loadLinks();
      const selected = lines[Math.floor(Math.random() * lines.length)];

      // Validasi URL
      let target;
      try {
        const u = new URL(selected);
        if (!/^https?:$/.test(u.protocol)) throw 0;
        target = u.toString();
      } catch {
        target = FALLBACK_LINK;
      }

      // =================================================================
      // ⭐ DETEKSI SUMBER TRAFIK & TAMBAHKAN SUB-ID
      // =================================================================
      const referer = request.headers.get("Referer") || "";
      let finalTarget = target;

      try {
        let urlObj = new URL(target);
        
        // Deteksi dari Referer Header
        if (referer.includes("t.co") || referer.includes("twitter.com") || referer.includes("x.com")) {
          urlObj.searchParams.set("sub_id", "X_Traffic");
        } else if (referer.includes("facebook.com") || referer.includes("fb.com") || referer.includes("l.facebook.com")) {
          urlObj.searchParams.set("sub_id", "FB_Traffic");
        } else if (referer.includes("instagram.com")) {
          urlObj.searchParams.set("sub_id", "IG_Traffic");
        } else if (referer.includes("tiktok.com")) {
          urlObj.searchParams.set("sub_id", "TikTok_Traffic");
        }
        // Bisa tambahkan platform lain sesuai kebutuhan
        
        finalTarget = urlObj.toString();
      } catch (e) {
        // Jika gagal parse URL, pakai target asli
        finalTarget = target;
      }

      // =================================================================
      // ⭐ REDIRECT DENGAN REFERRER POLICY
      // =================================================================
      return new Response(null, {
        status: 302,
        headers: { 
          "Location": finalTarget,
          "Cache-Control": "no-store",
          // KUNCI: Agar Shopee bisa lihat referer dari Twitter/FB
          "Referrer-Policy": "no-referrer-when-downgrade"
        }
      });

    } catch (e) {
      // SAFETY NET
      return new Response(null, {
        status: 302,
        headers: { 
          "Location": FALLBACK_LINK,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer-when-downgrade"
        }
      });
    }
  }
}
