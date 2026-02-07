// Counter global untuk rotasi berurutan (reset tiap deployment)
let globalCounter = 0;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // =================================================================
    // 1. SETUP: LINK CADANGAN (WAJIB DIGANTI)
    // =================================================================
    // Link ini dipakai jika GitHub error atau list kosong.
    const FALLBACK_LINK = "https://s.shopee.co.id/9pXfMxzjld"; 

    // =================================================================
    // 2. FITUR HEMAT KUOTA: BLOCK BOTS & CRAWLERS
    // =================================================================
    // Jika link di-share di WA/FB, bot mereka akan nge-ping. 
    // Kita kasih tampilan HTML saja, jangan jalankan script berat.
    const ua = request.headers.get("User-Agent") || "";
    // Regex mendeteksi bot umum (WA, FB, Twitter, Telegram, Discord, Google)
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

    // Health check sederhana
    if (pathname === "/health") return new Response("ok");

    // =================================================================
    // 3. FUNGSI LOAD LINK (CACHE 1 JAM / 3600 DETIK)
    // =================================================================
    async function loadLinks() {
      // GANTI URL INI dengan link raw GitHub kamu sendiri
      const RAW_URL = "https://raw.githubusercontent.com/Hecate1337-py/shopeeaff/main/links.txt";
      
      const cache = caches.default;
      const cacheKey = new Request(RAW_URL);

      // Cek apakah ada data di Cache Cloudflare?
      let res = await cache.match(cacheKey);

      if (!res) {
        // Jika tidak ada di cache, ambil dari GitHub
        // cacheTtl: 3600 = 1 Jam. (Lebih hemat daripada 60 detik)
        // cacheEverything: true = Paksa simpan cache walau GitHub kirim header no-cache
        res = await fetch(RAW_URL, { 
          cf: { cacheTtl: 3600, cacheEverything: true } 
        });

        if (!res.ok) throw new Error("Gagal mengambil links.txt dari GitHub");

        // Kita buat ulang response agar header cache-nya valid untuk disimpan
        const resToCache = new Response(res.clone().body, res);
        resToCache.headers.set("Cache-Control", "public, max-age=3600");
        
        // Simpan ke Cache Cloudflare (Background process)
        ctx.waitUntil(cache.put(cacheKey, resToCache));
      }

      const text = await res.text();
      // Bersihkan text dari baris kosong atau karakter aneh
      const lines = text
        .split("\n")
        .map(l => l.trim().replace(/[\u0000-\u001F\u007F]/g, ""))
        .filter(Boolean); // Hapus baris kosong

      if (!lines.length) throw new Error("File links.txt kosong");
      return lines;
    }

    // =================================================================
    // 4. HALAMAN DEBUG (/preview & /proof)
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
          "Cache-Control": "no-store" // Browser user jangan nge-cache redirect ini, biar bisa ganti-ganti
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
