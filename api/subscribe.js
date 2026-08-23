const { configured, addSub } = require('../lib/store');
const { fusoValido, horaValida, FUSO_PADRAO, HORA_PADRAO } = require('../lib/agenda');
const { excedeu } = require('../lib/limite');

module.exports = async function handler(req, res) {
  /* Sem CORS aberto, e com teto. Cada inscrição nova lê o conjunto
     inteiro antes de gravar, então inscrições falsas ficam mais caras à
     medida que se acumulam — e nada as expira. Sem limite, dava para
     encher o Redis e fazer o envio diário estourar o tempo. */
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!configured()) {
    return res.status(503).json({ error: 'Lembrete indisponível no momento' });
  }

  if (await excedeu('subscribe', req, 20, 60 * 60)) {
    return res.status(429).json({ error: 'muitos pedidos' });
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
    console.error('subscribe:', e);
    return res.status(500).json({ error: 'Erro ao salvar' });
  }
};
