const SOURCE_HOST = "www.accordiespartiti.it";

export function safeAssetUrl(rawSource) {
  try {
    const source = new URL(rawSource);
    if (source.protocol !== "https:" || source.hostname !== SOURCE_HOST) return null;
    return source;
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

  const source = safeAssetUrl(request.query?.src);
  if (!source) {
    response.status(400).json({ error: "Asset non consentito" });
    return;
  }

  try {
    const upstream = await fetch(source, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AccordiCleanReader/1.0)" },
    });
    if (!upstream.ok) throw new Error(`Asset non disponibile (${upstream.status})`);

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("font/")) {
      throw new Error("Tipo asset non consentito");
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400");
    response.status(200).send(body);
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Errore di recupero",
    });
  }
}
