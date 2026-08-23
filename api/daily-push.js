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
const { configured, listSubs, removeSub, marcarEnvio } = require('../lib/store');
const { versiculoDoDia } = require('../lib/versiculos');
const { paraEnviarAgora } = require('../lib/agenda');

/**
 * A notificação anunciava um versículo e o app mostrava outro: eram duas
 * listas independentes, uma de 15 referências aqui e as 180 do devocional.
 * Quem tocasse no lembrete abria o app e via coisa diferente do que tinha
 * acabado de ler na tela de bloqueio. Agora a fonte é a mesma.
 */
/* Uma mensagem por data local, e não uma por execução: quem está em
   Tóquio às 8h ainda é "ontem" no servidor, e receberia o versículo de
   véspera. O cache evita refazer a busca para cada inscrito do mesmo dia. */
const cacheMensagem = new Map();
async function mensagemDoDia(dataLocal) {
  if (cacheMensagem.has(dataLocal)) return cacheMensagem.get(dataLocal);
  const [a, m, d] = String(dataLocal).split('-').map(Number);
  const msg = await montarMensagem(new Date(a, m - 1, d));
  /* só o acerto é guardado. Guardar a mensagem de reserva congelaria
     uma queda passageira da Bíblia para o resto da vida do contêiner:
     todo mundo daquele fuso receberia "abra e medite" o dia inteiro,
     mesmo depois de a fonte voltar. */
  if (!msg.reserva) cacheMensagem.set(dataLocal, msg);
  return msg;
}

async function montarMensagem(quando) {
  const { nr, cap, verso, livro } = versiculoDoDia(quando);
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
      url: '/',
      reserva: true
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
    /* a pilha ia inteira para quem chamasse: caminhos de arquivo, versões
       de módulo e a forma do projeto. Fica no log da Vercel, onde só quem
       tem acesso ao painel a lê. */
    console.error('daily-push:', e);
    return res.status(500).json({ error: 'A função quebrou', etapa: 'inesperada' });
  }
};

async function enviar(req, res) {
  /* Sem CORS: quem chama isto é o cron da Vercel ou a linha de comando,
     nunca uma página. Com Access-Control-Allow-Origin: * qualquer site
     podia sondar este endpoint pelo navegador de quem o visitasse. */
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  /* trim dos dois lados: colar o valor no painel da Vercel costuma trazer
     um espaço ou uma quebra de linha junto, e o erro daí é invisível —
     os dois valores parecem idênticos na tela e nunca conferem */
  const secret = String(process.env.CRON_SECRET || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const doBearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const okAuth = !!secret && iguais(doBearer, secret);

  /* =========================================================
     O SEGREDO SAIU DA URL, E O 401 PAROU DE CONTAR

     Duas coisas erradas moravam aqui.

     A primeira: ?secret=... na barra de endereço. Query string entra
     no log de acesso da Vercel, no histórico do navegador e no
     cabeçalho Referer de qualquer link seguido a partir dali. Um
     segredo em URL é um segredo escrito em vários lugares que
     ninguém lembra de limpar. Só o cabeçalho Authorization vale
     agora — que é o que o GitHub Actions e o README já usavam.

     A segunda: a resposta de 401 devolvia tamanhoConfigurado, o
     COMPRIMENTO EXATO do CRON_SECRET, a quem não tinha autorização
     nenhuma. Junto com "segredoConfigurado", confirmava que existe e
     dizia de que tamanho. Era ajuda de depuração deixada para trás.
     ========================================================= */
  if (!isVercelCron && !okAuth) {
    return res.status(401).json({ error: 'Não autorizado' });
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
    console.error('daily-push VAPID:', e);
    return res.status(503).json({
      error: 'VAPID keys inválidas',
      etapa: 'configurar VAPID',
      /* o detalhe vai para o log, não para a resposta */
      dica: 'Confira as chaves VAPID no painel. A pública tem 87 caracteres e a privada 43, ambas em base64url; o subject precisa ser mailto: ou uma URL.'
    });
  }

  /* Ler o Redis também estourava para fora: token errado, URL errada ou a
     Upstash fora do ar davam 500 sem explicação. */
  let subs;
  try {
    subs = await listSubs();
  } catch (e) {
    console.error('daily-push Redis:', e);
    return res.status(502).json({
      error: 'Não consegui ler as inscrições',
      etapa: 'listar inscrições'
    });
  }

  /* De todos os inscritos, só os que estão na hora que escolheram, no
     fuso deles. As outras 23 execuções do dia simplesmente não têm o
     que fazer para essa pessoa. */
  const agora = new Date();
  const naHora = paraEnviarAgora(subs, agora);

  let sent = 0;
  let removed = 0;
  let repetidos = 0;
  const errors = [];
  let previa = null;

  for (const { sub, dataLocal } of naHora) {
    try {
      /* a trava vem antes do envio: melhor não mandar por engano do que
         mandar duas vezes e a pessoa desligar a notificação */
      const primeiraVez = await marcarEnvio(sub.endpoint, dataLocal);
      if (!primeiraVez) { repetidos++; continue; }

      const msg = await mensagemDoDia(dataLocal);
      if (!previa) previa = msg;
      const payload = JSON.stringify({
        title: msg.title,
        body: msg.body,
        url: msg.url || '/',
        tag: 'devocional-diario'
      });

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
    naHora: naHora.length,
    sent: sent,
    removed: removed,
    repetidos: repetidos,
    hora: agora.toISOString().slice(11, 16) + ' UTC',
    preview: previa ? { title: previa.title, body: previa.body } : null,
    errors: errors.slice(0, 5)
  });
}

/* Só para teste: o cache de mensagem vive enquanto o contêiner vive, e
   um teste que simula a Bíblia fora do ar precisa de um dia limpo. Não
   é usado em produção. */
module.exports._limparCacheMensagem = () => cacheMensagem.clear();
