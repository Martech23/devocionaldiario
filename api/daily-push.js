const webpush = require('web-push');
const { configured, listSubs, removeSub } = require('./lib/store');
const { versiculoDoDia } = require('./lib/versiculos');

/**
 * A notificação anunciava um versículo e o app mostrava outro: eram duas
 * listas independentes, uma de 15 referências aqui e as 180 do devocional.
 * Quem tocasse no lembrete abria o app e via coisa diferente do que tinha
 * acabado de ler na tela de bloqueio. Agora a fonte é a mesma.
 */
async function montarMensagem() {
  const { nr, cap, verso, livro } = versiculoDoDia();
  const ref = livro + ' ' + cap + ':' + verso;
  const url = 'https://api.getbible.net/v2/livre/' + nr + '/' + cap + '.json';
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    const v = (d.verses || []).find((x) => Number(x.verse) === Number(verso));
    const texto = (v && v.text ? v.text : '').trim().replace(/\s+/g, ' ');
    if (!texto) throw new Error('sem texto');
    const body = texto.length > 120 ? texto.slice(0, 117) + '…' : texto;
    return { title: ref + ' · Bíblia Devocional', body: body, url: '/' };
  } catch (_) {
    /* a Bíblia fora do ar não pode calar o lembrete; a referência é nossa
       e continua certa mesmo sem o texto */
    return {
      title: 'Bíblia Devocional · Devocional do dia',
      body: 'O devocional de hoje está em ' + ref + '. Abra e medite.',
      url: '/'
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.authorization || '';
  const okAuth = secret && auth === 'Bearer ' + secret;
  const q = req.query || {};
  const okQuery = secret && q.secret === secret;

  if (!isVercelCron && !okAuth && !okQuery) {
    return res.status(401).json({
      error: 'Não autorizado',
      hint: 'Defina CRON_SECRET na Vercel e chame com Authorization: Bearer SEU_SECRET ou ?secret=SEU_SECRET'
    });
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

  const msg = await montarMensagem();
  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    url: msg.url || '/',
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
      const code = e.statusCode;
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
    sent: sent,
    removed: removed,
    preview: { title: msg.title, body: msg.body },
    errors: errors.slice(0, 5)
  });
};
