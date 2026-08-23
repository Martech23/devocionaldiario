const { configured, removeSub } = require('../lib/store');
const { excedeu } = require('../lib/limite');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (await excedeu('unsubscribe', req, 30, 60 * 60)) {
    return res.status(429).json({ error: 'muitos pedidos' });
  }

  if (!configured()) {
    return res.status(503).json({ error: 'Push não configurado' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const endpoint = body && body.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório' });
    await removeSub(endpoint);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('unsubscribe:', e);
    return res.status(500).json({ error: 'Erro' });
  }
};
