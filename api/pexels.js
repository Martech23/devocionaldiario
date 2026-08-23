/**
 * Proxy Pexels — a chave fica só no servidor (PEXELS_API_KEY na Vercel).
 * GET /api/pexels?q=sunrise+mountains&per_page=12&orientation=portrait
 */
const { excedeu } = require('../lib/limite');

module.exports = async function handler(req, res) {
  /* Sem CORS aberto: com Access-Control-Allow-Origin: * este endereço era
     uma API de busca de fotos pública movida pela NOSSA chave do Pexels.
     A cota gratuita são 200 pedidos por hora; qualquer site podia gastá-la
     e deixar o gerador de imagem sem foto. */
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (await excedeu('pexels', req, 40, 60 * 60)) {
    return res.status(429).json({ error: 'muitos pedidos' });
  }

  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY;
  if (!key) {
    /* sem dizer qual variável falta nem em que painel: é desenho interno */
    return res.status(503).json({ error: 'Fotos indisponíveis no momento' });
  }

  try {
    const q = String((req.query && req.query.q) || 'peaceful nature sunrise')
      .slice(0, 100)
      .trim();
    const perPage = Math.min(Math.max(parseInt((req.query && req.query.per_page) || '12', 10) || 12, 1), 30);
    const orientation = ['landscape', 'portrait', 'square'].includes(req.query && req.query.orientation)
      ? req.query.orientation
      : 'portrait';

    const url =
      'https://api.pexels.com/v1/search?query=' +
      encodeURIComponent(q) +
      '&per_page=' +
      perPage +
      '&orientation=' +
      orientation;

    const r = await fetch(url, {
      headers: { Authorization: key }
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        error: (data && data.error) || 'Erro na API Pexels',
        status: r.status
      });
    }

    const photos = (data.photos || []).map((p) => ({
      id: p.id,
      url: (p.src && (p.src.large2x || p.src.large || p.src.medium)) || '',
      thumb: (p.src && (p.src.medium || p.src.small)) || '',
      photographer: p.photographer || 'Pexels',
      photographer_url: p.photographer_url || 'https://www.pexels.com',
      alt: p.alt || q
    })).filter((p) => p.url);

    return res.status(200).json({
      query: q,
      total: data.total_results || photos.length,
      photos
    });
  } catch (e) {
    console.error('pexels:', e);
    return res.status(500).json({ error: 'Falha ao buscar fotos' });
  }
};
