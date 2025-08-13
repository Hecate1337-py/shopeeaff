export default {
  async fetch(request, env, ctx) {
    // Ambil file links.txt dari repo (public) lewat GitHub raw
    const res = await fetch("https://raw.githubusercontent.com/Hecate1337-py/shopeeaff/main/links.txt");
    const text = await res.text();
    
    // Bersihkan & filter baris kosong
    const links = text.split("\n").map(l => l.trim()).filter(l => l);

    if (!links.length) {
      return new Response("No links available", { status: 500 });
    }

    // Pilih link acak
    const selected = links[Math.floor(Math.random() * links.length)];

    // Redirect 302
    return Response.redirect(selected, 302);
  }
};
