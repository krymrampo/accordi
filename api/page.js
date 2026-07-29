const SOURCE_ORIGIN = "https://www.accordiespartiti.it";

export function safeSourcePath(rawPath) {
  try {
    const candidate = new URL(rawPath || "/", SOURCE_ORIGIN);
    if (candidate.origin !== SOURCE_ORIGIN || !candidate.pathname.startsWith("/")) return null;
    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  const sourcePath = safeSourcePath(request.query?.path);
  if (!sourcePath) {
    response.status(400).json({ error: "Percorso non consentito" });
    return;
  }

  try {
    const upstream = await fetch(`${SOURCE_ORIGIN}${sourcePath}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.7",
        "User-Agent": "Mozilla/5.0 (compatible; AccordiCleanReader/1.0; +https://github.com/krymrampo/accordi)",
      },
    });

    if (!upstream.ok) throw new Error(`Origine ha risposto ${upstream.status}`);
    const html = await upstream.text();

    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400");
    response.status(200).json({ html, sourcePath, savedAt: Date.now() });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Errore di recupero",
    });
  }
}
