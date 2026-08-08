const webpush = require('web-push');
const { configured, listSubs, removeSub } = require('./lib/store');

/**
 * Chamado pelo Vercel Cron (todo dia 11:00 UTC ≈ 08:00 Brasília).
 * Protegido por CRON_SECRET ou header x-vercel-cron.
 */
module.exports = async function handler(req, res) {
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const okAuth = secret && auth === `Bearer ${secret}`;

  if (!isVercelCron && !okAuth) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (!configured()) {
    return res.status(503).json({ error: 'Redis não configurado' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:devocional@example.com';

  if (!publicKey || !privateKey) {
    return res.status(503).json({ error: 'VAPID keys não configuradas' });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: 'Bíblia Devocional · Devocional do dia',
    body: 'Seu encontro diário com a Palavra está pronto. Abra e medite.',
    url: '/',
    tag: 'devocional-diario'
  });

  const subs = await listSubs();
  let sent = 0;
  let removed = 0;
  const errors = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 60 * 60 * 12 }
      );
      sent++;
    } catch (e) {
      const code = e.statusCode || e.statusCode;
      // 404/410 = subscription expirada
      if (code === 404 || code === 410) {
        await removeSub(sub.endpoint);
        removed++;
      } else {
        errors.push(String(e.message || e));
      }
    }
  }

  return res.status(200).json({
    ok: true,
    total: subs.length,
    sent,
    removed,
    errors: errors.slice(0, 5)
  });
};
