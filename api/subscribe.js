const { configured, addSub } = require('../lib/store');
const { fusoValido, horaValida, FUSO_PADRAO, HORA_PADRAO } = require('../lib/agenda');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!configured()) {
    return res.status(503).json({
      error: 'Push ainda não configurado no servidor',
      hint: 'Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body && body.subscription;
    if (!sub || !sub.endpoint || !sub.keys) {
      return res.status(400).json({ error: 'Subscription inválida' });
    }
    /* O fuso e a hora vêm do aparelho e são validados aqui: é entrada de
       fora, e um nome de fuso inventado quebraria o envio de todo mundo
       na hora do cron, não só o de quem mandou. */
    await addSub({
      endpoint: sub.endpoint,
      keys: sub.keys,
      fuso: fusoValido(body && body.fuso) ? body.fuso : FUSO_PADRAO,
      hora: horaValida(body && body.hora) ? body.hora : HORA_PADRAO,
      createdAt: new Date().toISOString()
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Erro ao salvar' });
  }
};
