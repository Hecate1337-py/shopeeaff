export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ================= CONFIGURATION =================
    
    // 1. Link Google Sheet kamu (Sudah dikonversi ke format CSV yang benar)
    const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/u/6/d/e/2PACX-1vTmUBJLxCpyLPTlgPKQYU_uPFKPYcB1GEcgADzX5G56QdzYFh0amyivTQSSzigXlbLmLYHO-jXTYHOB/pub?output=csv";
    
    // 2. Fallback Link (Link Cadangan Wajib)
    // Script akan lari kesini jika Google Sheet error, kosong, atau gagal loading.
    // Ganti link ini dengan link profil atau link promo utamamu.
    const FALLBACK_LINK = "https://s.shopee.co.id/9pXfMxzjld"; 
    
    // =================================================

    // ---- Health check (Penting untuk monitoring)
    if (pathname === "/health") return new Response("ok");

    // ---- Fungsi Helper: Load Link dari Google Sheet (dengan Cache 60s)
    async function loadLinks() {
      const cache = caches.default;
      const cacheKey = new Request(SHEET_CSV_URL, { cf: { cacheTtl: 60 } });

      let res = await cache.match(cacheKey);
      if (!res) {
        // Fetch ke Google jika tidak ada di cache
        res = await fetch(cacheKey, { cf: { cacheTtl: 60 } });
        if (!res.ok) throw new Error("Gagal load Sheet");
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }

      const text = await res.text();
      
      // Parsing CSV: Memecah baris, bersihkan tanda kutip/koma, ambil yg ada 'http'
      const lines = text
        .split("\n")
        .map(l => l.trim().replace(/^"|"$/g, '').replace(/,/g, '')) // Bersihin sisa format CSV
        .filter(l => l.startsWith("http")); // Validasi: Harus diawali http/https
      
      if (!lines.length) throw new Error("Sheet kosong atau tidak ada link valid");
      return lines;
    }

    // ---- /proof : Halaman Bukti (Mengambil Link Pertama di Sheet)
    if (pathname === "/proof") {
      let safe = FALLBACK_LINK;
      try {
        const lines = await loadLinks();
        if (lines.length > 0) safe = lines[0]; // Pakai link paling atas dari Sheet
      } catch {}

      const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Shopee Affiliate – Promo</title>
<style>
:root{--brand:#ee4d2d}
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:40px;text-align:center;color:#111}
.wrap{max-width:760px;margin:0 auto}
.btn{display:inline-block;padding:12px 22px;background:var(--brand);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;margin-top:10px}
.box{margin-top:24px;padding:12px;background:#fafafa;border:1px solid #eee;border-radius:10px;word-break:break-all;font-size:14px}
h1{margin-bottom:10px}
</style>
</head>
<body>
  <div class="wrap">
    <h1>Promo Shopee</h1>
    <p>Halaman ini digunakan untuk verifikasi partisipasi program afiliasi.</p>
    <a class="btn" href="${safe}" target="_blank">Buka Aplikasi Shopee</a>
    <div class="box"><strong>Link Validasi:</strong><br>${safe}</div>
  </div>
</body>
</html>`;
      return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8" } });
    }

    // ---- /preview : Cek semua link yang terbaca (Untuk Debugging)
    if (pathname === "/preview") {
      try {
        const links = await loadLinks();
        const html = `<!doctype html>
        <body style="font-family:monospace;padding:20px">
        <h3>Total Link: ${links.length}</h3>
        <ol>${links.map(l => `<li><a href="${l}">${l}</a></li>`).join("")}</ol>
        </body>`;
        return new Response(html, { headers: { "content-type": "text/html" } });
      } catch (e) {
        return new Response("Error Load Sheet: " + e.message, { status: 500 });
      }
    }

    // ---- ROTATOR UTAMA (Default Action)
    try {
      const lines = await loadLinks();
      
      // LOGIKA RANDOM (Lebih Cepat & Stabil daripada Round Robin)
      const selected = lines[Math.floor(Math.random() * lines.length)];

      // Redirect User
      return new Response(null, {
        status: 302,
        headers: { 
          "Location": selected, 
          "Cache-Control": "no-store" 
        }
      });

    } catch (e) {
      // SAFETY NET: Jika Sheet Error/Kosong, lari ke Fallback Link
      return new Response(null, {
        status: 302,
        headers: { "Location": FALLBACK_LINK, "Cache-Control": "no-store" }
      });
    }
  }
}
