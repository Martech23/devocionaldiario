const crypto = require('crypto');
const webpush = require('web-push');

/**
 * O web-push exige que o subject seja mailto: ou uma URL, e recusa um
 * e-mail solto. Escrever só o endereço no painel é o erro mais fácil de
 * cometer e o mais difícil de enxergar, então normalizamos aqui.
 */
function arrumarSubject(bruto) {
  const s = String(bruto || '').trim();
  if (!s) return 'mailto:devocional@example.com';
  if (/^(mailto:|https?:\/\/)/i.test(s)) return s;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'mailto:' + s;
  return s;
}

/** Comparação em tempo constante, como já se faz com as senhas das contas. */
function iguais(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}
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
  /* Qualquer coisa que escape daqui vira a tela de crash da Vercel, que não
     diz o que houve nem aparece no navegador de quem chamou. Melhor um JSON
     dizendo em que etapa foi. */
  try {
    return await enviar(req, res);
  } catch (e) {
    return res.status(500).json({
      error: 'A função quebrou',
      etapa: 'inesperada',
      detalhe: String(e && e.message || e),
      pilha: String(e && e.stack || '').split('\n').slice(0, 4)
    });
  }
};

async function enviar(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  /* trim dos dois lados: colar o valor no painel da Vercel costuma trazer
     um espaço ou uma quebra de linha junto, e o erro daí é invisível —
     os dois valores parecem idênticos na tela e nunca conferem */
  const secret = String(process.env.CRON_SECRET || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const doBearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const okAuth = !!secret && iguais(doBearer, secret);

  /* req.query nem sempre vem preenchido, dependendo do runtime em que a
     função roda. Sem esta reserva, o ?secret= era silenciosamente ignorado
     e a chamada dava 401 mesmo com o segredo certo. */
  let q = req.query;
  if (!q || typeof q.secret === 'undefined') {
    try {
      q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    } catch (_) {
      q = q || {};
    }
  }
  const daUrl = String(q.secret || '').trim();
  const recebido = daUrl || doBearer;
  const enviouSegredo = !!recebido;
  const okQuery = !!secret && iguais(daUrl, secret);

  if (!isVercelCron && !okAuth && !okQuery) {
    /* Três coisas diferentes davam a mesma resposta, e quem chamava não
       tinha como saber qual era a sua. O segredo não vaza em nenhuma. */
    const motivo = !secret
      ? 'CRON_SECRET não está definido nas variáveis de ambiente deste projeto na Vercel. Enquanto não estiver, não há chamada manual possível — só o cron automático.'
      : !enviouSegredo
        ? 'Nenhum segredo foi enviado. Acrescente ?secret=SEU_SECRET no fim do endereço, ou o cabeçalho Authorization: Bearer SEU_SECRET.'
        : 'O segredo enviado não confere com o CRON_SECRET configurado na Vercel.';
    return res.status(401).json({
      error: 'Não autorizado',
      motivo: motivo,
      segredoConfigurado: !!secret,
      segredoRecebido: enviouSegredo,
      /* só os tamanhos, nunca os valores: é o que revela na hora um espaço
         colado junto, um valor truncado ou aspas em volta */
      tamanhoConfigurado: secret.length,
      tamanhoRecebido: recebido.length
    });
  }

  if (!configured()) {
    return res.status(503).json({ error: 'Redis não configurado' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = arrumarSubject(process.env.VAPID_SUBJECT);

  if (!publicKey || !privateKey) {
    return res.status(503).json({ error: 'VAPID keys não configuradas' });
  }

  /* O web-push valida as chaves e joga uma exceção se elas estiverem
     malformadas. Sem este try, uma chave torta virava a tela de crash da
     Vercel, que não diz nada sobre o que aconteceu. */
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (e) {
    return res.status(503).json({
      error: 'VAPID keys inválidas',
      etapa: 'configurar VAPID',
      detalhe: String(e && e.message || e),
      dica: 'Confira VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY na Vercel. A pública tem 87 caracteres e a privada 43, ambas em base64url. VAPID_SUBJECT precisa ser mailto: ou uma URL.',
      tamanhoPublica: publicKey.length,
      tamanhoPrivada: privateKey.length,
      subject: subject
    });
  }

  const msg = await montarMensagem();
  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    url: msg.url || '/',
    tag: 'devocional-diario'
  });

  /* Ler o Redis também estourava para fora: token errado, URL errada ou a
     Upstash fora do ar davam 500 sem explicação. */
  let subs;
  try {
    subs = await listSubs();
  } catch (e) {
    return res.status(502).json({
      error: 'Não consegui ler as inscrições no Redis',
      etapa: 'listar inscrições',
      detalhe: String(e && e.message || e),
      dica: 'Confira UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel.'
    });
  }

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
        /* a limpeza da inscrição morta não pode derrubar o envio dos outros */
        try { await removeSub(sub.endpoint); removed++; }
        catch (e2) { errors.push('falha ao remover inscrição: ' + String(e2 && e2.message || e2)); }
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
}
