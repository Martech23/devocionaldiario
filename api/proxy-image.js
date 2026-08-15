/**
 * Proxy de imagem do Pexels
 * GET /api/proxy-image?url=https://images.pexels.com/...
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const url = req.query && req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url obrigatória' });
  }

  // Só permite imagens do Pexels
  if (!url.startsWith('https://images.pexels.com/')) {
    return res.status(403).json({ error: 'domínio não permitido' });
  }

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'BibliaDevocional/1.0' }
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: 'falha ao buscar imagem' });
    }

    const contentType = r.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);

    const buffer = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'erro no proxy' });
  }
};
