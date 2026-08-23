/**
 * Proxy de imagem do Pexels
 * GET /api/proxy-image?url=https://images.pexels.com/...
 */
const { excedeu } = require('../lib/limite');

/* uma foto de fundo tem cerca de 1 MB; 8 é folga para o gerador inteiro */
const LIMITE_BYTES = 8 * 1024 * 1024;

module.exports = async function handler(req, res) {
  /* Sem Access-Control-Allow-Origin: * — quem carrega estas fotos é a
     nossa própria página, e o * transformava o endereço num proxy de
     imagem aberto, que qualquer site podia usar por conta da nossa
     largura de banda. Pedido de mesma origem não precisa de CORS. */
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  if (await excedeu('proxy-image', req, 300, 60 * 60)) {
    return res.status(429).json({ error: 'muitos pedidos' });
  }

  const url = req.query && req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url obrigatória' });
  }

  // Só permite imagens do Pexels
  if (!url.startsWith('https://images.pexels.com/')) {
    return res.status(403).json({ error: 'domínio não permitido' });
  }

  try {
    /* =========================================================
       A LISTA DE PERMISSÃO VALIA SÓ PARA O PRIMEIRO SALTO

       O endereço era conferido antes do pedido, mas o fetch seguia
       redirecionamentos sozinho: bastava a origem responder 302 para
       o proxy ir buscar em outro lugar — com o nosso servidor, de
       dentro da nossa rede. Com 'manual' o redirecionamento vira
       resposta, e nós decidimos que não seguimos nenhum.
       ========================================================= */
    const r = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'BibliaDevocional/1.0' }
    });

    if (r.status >= 300 && r.status < 400) {
      return res.status(502).json({ error: 'a origem redirecionou' });
    }
    if (!r.ok) {
      return res.status(r.status).json({ error: 'falha ao buscar imagem' });
    }

    /* O tipo vinha da origem e era repassado como veio. Se algum dia
       voltasse text/html, este endereço serviria HTML pelo NOSSO
       domínio — script de outra pessoa com a nossa origem. Aqui só
       passa imagem, e o tipo é reescrito por nós. */
    const tipo = String(r.headers.get('content-type') || '').toLowerCase();
    if (!tipo.startsWith('image/')) {
      return res.status(502).json({ error: 'a origem não devolveu imagem' });
    }

    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length > LIMITE_BYTES) {
      return res.status(502).json({ error: 'imagem grande demais' });
    }

    res.setHeader('Content-Type', tipo.split(';')[0]);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('proxy-image:', e);
    return res.status(500).json({ error: 'erro no proxy' });
  }
};
