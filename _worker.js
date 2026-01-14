export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- PENGATURAN PERSENTASE CUAN ----
    // 0.8 artinya 80% kemungkinan user diarahkan ke Shopee.
    // 0.2 (sisanya) akan diarahkan ke link lain (Monetag/Ads).
    const SHOPEE_CHANCE = 0.7; 

    // ---- 1. SETUP FALLBACK LINK (WAJIB DIGANTI)
    // Gunakan link Shopee andalanmu di sini sebagai cadangan mati
    const FALLBACK_LINK = "https://otieu.com/4/10402440"; 

    // ---- Health check
    if (pathname === "/health") return new Response("ok");

    // ---- Helper: load links.txt dari GitHub + edge cache 60s
    async function loadLinks() {
      // Pastikan URL GitHub ini benar
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

    // ---- /proof : Halaman Bukti (Tetap Prioritas Shopee)
    if (pathname === "/proof") {
      let aff = FALLBACK_LINK;
      try {
        const lines = await loadLinks();
        // Coba cari link yang mengandung kata "shopee" untuk ditampilkan di tombol
        const shopeeOnly = lines.filter(l => l.toLowerCase().includes("shopee"));
        if (shopeeOnly.length > 0) {
            aff = shopeeOnly[0];
        } else {
            aff = lines[0];
        }
      } catch {}
      
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

    // ---- /preview : Cek semua link
    if (pathname === "/preview") {
      try {
        const links = await loadLinks();
        const shopeeCount = links.filter(l => l.toLowerCase().includes("shopee")).length;
        const otherCount = links.length - shopeeCount;
        
        const html = `<!doctype html>
        <h2>Status Link</h2>
        <p>Total Link: <strong>${links.length}</strong></p>
        <p>Shopee Link: <strong>${shopeeCount}</strong> (Prioritas: ${SHOPEE_CHANCE * 100}%)</p>
        <p>Other Link: <strong>${otherCount}</strong> (Prioritas: ${(1 - SHOPEE_CHANCE) * 100}%)</p>
        <hr>
        <ol>${links.map(l => `<li><a href="${l}">${l}</a></li>`).join("")}</ol>`;
        return new Response(html, { headers: { "content-type": "text/html" } });
      } catch (e) {
        return new Response("Gagal load GitHub: " + e.message, { status: 500 });
      }
    }

    // ---- ROTATOR LOGIC (SMART WEIGHTED)
    try {
      const lines = await loadLinks();

      // 1. Pisahkan Link Shopee vs Link Lain (Berdasarkan kata "shopee")
      const shopeeLinks = lines.filter(l => l.toLowerCase().includes("shopee"));
      const otherLinks = lines.filter(l => !l.toLowerCase().includes("shopee"));

      let selected;

      // 2. Tentukan nasib user (Gacha Persentase)
      // Math.random() menghasilkan angka 0.0 s/d 1.0
      const roll = Math.random(); 

      // Logika: Jika roll di bawah 0.8 (80%) DAN ada link Shopee -> Kasih Shopee
      if (roll < SHOPEE_CHANCE && shopeeLinks.length > 0) {
        selected = shopeeLinks[Math.floor(Math.random() * shopeeLinks.length)];
      } 
      // Jika tidak kena Shopee, ATAU link Shopee habis -> Coba kasih Link Lain
      else if (otherLinks.length > 0) {
        selected = otherLinks[Math.floor(Math.random() * otherLinks.length)];
      } 
      // Jika Link Lain kosong (misal lupa isi), balik lagi ke Shopee
      else {
        selected = shopeeLinks.length > 0 
           ? shopeeLinks[Math.floor(Math.random() * shopeeLinks.length)]
           : lines[Math.floor(Math.random() * lines.length)];
      }

      // 3. Validasi URL Akhir
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
