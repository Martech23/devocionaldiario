/**
 * Proxy Pexels — a chave fica só no servidor (PEXELS_API_KEY na Vercel).
 * GET /api/pexels?q=sunrise+mountains&per_page=12&orientation=portrait
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'PEXELS_API_KEY não configurada',
      hint: 'Adicione PEXELS_API_KEY nas variáveis de ambiente da Vercel (Production) e faça redeploy'
    });
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
    console.error(e);
    return res.status(500).json({ error: e.message || 'Falha ao buscar fotos' });
  }
};
