// Counter global untuk rotasi berurutan (reset tiap deployment)
let globalCounter = 0;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // =================================================================
    // 1. SETUP: LINK CADANGAN (WAJIB DIGANTI)
    // =================================================================
    const FALLBACK_LINK = "https://s.shopee.co.id/9pXfMxzjld"; 

    // =================================================================
    // 2. FUNGSI LOAD LINK (DIPINDAHKAN KE ATAS)
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

        if (!res.ok) throw new Error("Gagal mengambil links.txt dari GitHub");

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
    // 3. ROUTE DEBUG - HARUS DI ATAS SEBELUM LOGIKA LAIN!
    // =================================================================
    
    // Health check
    if (pathname === "/health") {
      return new Response("ok");
    }

    // Reset counter ke 0
    if (pathname === "/reset") {
      globalCounter = 0;
      return new Response("✅ Counter direset ke 0. <a href='/status'>Lihat Status</a>", { 
        headers: { "content-type": "text/html; charset=utf-8" } 
      });
    }

    // Lihat status counter dan link berikutnya
    if (pathname === "/status") {
      try {
        const links = await loadLinks();
        const nextIndex = globalCounter % links.length;
        const html = `
          <!DOCTYPE html>
          <html lang="id">
          <head>
            <meta charset="utf-8">
            <title>Status Rotator</title>
            <style>
              body { font-family: Arial; padding: 20px; background: #f5f5f5; }
              .container { background: white; padding: 20px; border-radius: 8px; max-width: 800px; margin: 0 auto; }
              .stat { background: #e3f2fd; padding: 10px; margin: 5px 0; border-radius: 4px; }
              .next { background: #fff3cd; font-weight: bold; }
              a { color: #1976d2; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>📊 Status Rotator</h2>
              <div class="stat"><strong>Total Links:</strong> ${links.length}</div>
              <div class="stat"><strong>Global Counter:</strong> ${globalCounter}</div>
              <div class="stat"><strong>Next Index:</strong> ${nextIndex}</div>
              <div class="stat next"><strong>Next Link:</strong> ${links[nextIndex]}</div>
              
              <hr>
              
              <h3>🔗 Semua Link:</h3>
              <ol start="0">
                ${links.map((l, i) => `
                  <li style="${i === nextIndex ? 'background: #fff3cd; padding: 5px; font-weight: bold;' : ''}">
                    ${l} ${i === nextIndex ? '<strong style="color: red;">← NEXT</strong>' : ''}
                  </li>
                `).join("")}
              </ol>
              
              <hr>
              
              <p>
                <a href="/reset">🔄 Reset Counter</a> | 
                <a href="/preview">📋 Preview Links</a> | 
                <a href="/">🏠 Test Redirect</a>
              </p>
            </div>
          </body>
          </html>
        `;
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    // Preview semua link
    if (pathname === "/preview") {
      try {
        const links = await loadLinks();
        const html = `
          <!DOCTYPE html>
          <html lang="id">
          <head>
            <meta charset="utf-8">
            <title>Preview Links</title>
            <style>
              body { font-family: Arial; padding: 20px; background: #f5f5f5; }
              .container { background: white; padding: 20px; border-radius: 8px; max-width: 800px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>📋 Total Link: ${links.length}</h2>
              <ol>${links.map(l => `<li>${l}</li>`).join("")}</ol>
              <hr>
              <p><a href="/status">📊 Lihat Status</a></p>
            </div>
          </body>
          </html>
        `;
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    // Proof redirect ke fallback
    if (pathname === "/proof") {
      return new Response(null, { status: 302, headers: { Location: FALLBACK_LINK } });
    }

    // =================================================================
    // 4. FITUR HEMAT KUOTA: BLOCK BOTS & CRAWLERS
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
        <body>
          <h1>Redirecting...</h1>
        </body>
        </html>`, 
        { headers: { "content-type": "text/html" } }
      );
    }

    // =================================================================
    // 5. LOGIKA ROTATOR BERURUTAN (ROUND-ROBIN)
    // =================================================================
    try {
      const lines = await loadLinks();
      
      // ROTASI BERURUTAN: Setiap request ambil link berikutnya secara adil
      const index = globalCounter % lines.length;
      globalCounter++; // Naikkan counter untuk request berikutnya
      
      const selected = lines[index];

      // Validasi URL biar aman
      let target;
      try {
        const u = new URL(selected);
        if (!/^https?:$/.test(u.protocol)) throw 0;
        target = u.toString();
      } catch {
        // Jika link terpilih rusak, gunakan fallback
        target = FALLBACK_LINK;
      }

      return new Response(null, {
        status: 302,
        headers: { 
          "Location": target, 
          "Cache-Control": "no-store"
        }
      });

    } catch (e) {
      // SAFETY NET: Jika GitHub Down total, lari ke sini.
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
