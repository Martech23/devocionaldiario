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
  /* =========================================================
     O TETO QUE APERTA É O DO MÊS, NÃO O DA HORA

     O plano gratuito do Pexels dá 200 pedidos por hora e 20 mil por
     mês. Como a borda da Vercel guarda a resposta, o custo real não
     é "quantas pessoas usaram" e sim "quantos endereços distintos
     existem": 10 temas × 2 orientações × 4 páginas = 80.

     Com uma hora de cache, 80 endereços × 24 horas dariam 1.920
     chamadas por dia — 57 mil por mês, quase três vezes o teto.
     Com 24 horas, são 80 por dia: 2.400 por mês, 12% da cota,
     independentemente de quantas pessoas usem o app.

     Foto de banco não muda; guardar por um dia não custa nada a
     ninguém. Este número é o que segura a conta, não o limite por
     IP — esse é contra abuso, não contra volume legítimo.
     ========================================================= */
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

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
    const perPage = Math.min(Math.max(parseInt((req.query && req.query.per_page) || '12', 10) || 12, 1), 40);
    /* Sem página, "buscar outras fotos" pedia sempre a mesma primeira
       página e recebia as mesmas fotos — e a borda nem chegava a
       encaminhar o pedido. O teto de 4 é o que mantém a conta do mês
       fechada; ver o comentário do cache acima. */
    const page = Math.min(Math.max(parseInt((req.query && req.query.page) || '1', 10) || 1, 1), 4);
    const orientation = ['landscape', 'portrait', 'square'].includes(req.query && req.query.orientation)
      ? req.query.orientation
      : 'portrait';

    const url =
      'https://api.pexels.com/v1/search?query=' +
      encodeURIComponent(q) +
      '&per_page=' +
      perPage +
      '&page=' +
      page +
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
      page,
      /* o cliente precisa saber se ainda há o que pedir: sem isto ele
         só descobriria o fim recebendo uma página vazia */
      ultima: page >= 4 || photos.length < perPage,
      total: data.total_results || photos.length,
      photos
    });
  } catch (e) {
    console.error('pexels:', e);
    return res.status(500).json({ error: 'Falha ao buscar fotos' });
  }
};
