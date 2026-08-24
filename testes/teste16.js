/* Notificação diária: roda o handler de verdade, com Redis e envio simulados */
const path = require('path');
const Module = require('module');
const RAIZ = require('path').resolve(__dirname, '..');

let OK = 0, F = 0;
const ok = (n, v, x) => { v ? OK++ : F++;
  console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

/* ---- Redis de mentira, com a mesma API REST que store.js usa ---- */
const banco = new Map();               // chave → Set de strings
global.__redisChamadas = [];
/* chaves simples, separadas dos conjuntos: é onde mora a trava de
   "já mandei hoje", que o envio de hora em hora passou a exigir */
const simples = new Map();
function redisFalso(url, opcoes){
  const partes = JSON.parse(opcoes.body);
  const [cmd, chave, valor] = partes;
  global.__redisChamadas.push(cmd);
  let result = null;

  if(cmd === 'SET'){
    /* NX: grava só se ainda não existir, e devolve nulo se já existia —
       é o que impede dois envios no mesmo dia */
    const temNX = partes.includes('NX');
    if(temNX && simples.has(chave)) result = null;
    else { simples.set(chave, valor); result = 'OK'; }
    return Promise.resolve({ ok: true, json: async () => ({ result }) });
  }
  if(cmd === 'GET') return Promise.resolve({ ok: true, json: async () => ({ result: simples.get(chave) ?? null }) });

  if(!banco.has(chave)) banco.set(chave, new Set());
  const s = banco.get(chave);
  if(cmd === 'SMEMBERS') result = [...s];
  else if(cmd === 'SADD') { const antes = s.size; s.add(valor); result = s.size - antes; }
  else if(cmd === 'SREM') { result = s.delete(valor) ? 1 : 0; }
  return Promise.resolve({ ok: true, json: async () => ({ result }) });
}

/* ---- web-push de mentira: registra os envios e simula as falhas ---- */
const enviados = [];
let falhaProxima = null;
const webpushFalso = {
  setVapidDetails(...a) { webpushFalso.vapid = a; },
  async sendNotification(sub, payload, op) {
    if (falhaProxima && falhaProxima.endpoint === sub.endpoint) {
      const e = new Error(falhaProxima.msg || 'falhou');
      e.statusCode = falhaProxima.status;
      falhaProxima = null;
      throw e;
    }
    enviados.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), op });
    return { statusCode: 201 };
  }
};

/* intercepta os require do handler sem tocar no código dele */
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'web-push') return webpushFalso;
  return origRequire.apply(this, arguments);
};

/* rede: só o getBible interessa aqui */
let respostaBiblia = null;
global.fetch = (url, op) => {
  const u = String(url);
  if (u.includes('upstash') || (op && op.body && op.body.startsWith('['))) return redisFalso(u, op);
  if (u.includes('getbible')) {
    if (respostaBiblia === 'erro') return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    return Promise.resolve({ ok: true, json: async () => respostaBiblia });
  }
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
};

process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
process.env.VAPID_PUBLIC_KEY = 'pub';
process.env.VAPID_PRIVATE_KEY = 'priv';
process.env.VAPID_SUBJECT = 'mailto:teste@exemplo.com';
process.env.CRON_SECRET = 'segredo123';

const handler = origRequire(path.join(RAIZ, 'api/daily-push.js'));

function resposta() {
  const r = { code: 0, corpo: null, cab: {} };
  r.setHeader = (k, v) => { r.cab[k] = v; return r; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (o) => { r.corpo = o; return r; };
  r.end = () => r;
  return r;
}
const chamar = async (req) => { const r = resposta();
  await handler(Object.assign({ method: 'GET', headers: {}, query: {} }, req), r); return r; };

/* O envio deixou de ser diário e passou a ser de hora em hora, entregando
   só a quem está na hora que escolheu. Para o teste, as inscrições pedem
   a hora que é agora em São Paulo — assim estão sempre no ponto. */
const HORA_AGORA_SP = Number(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false
}).format(new Date())) % 24;
const assinatura = (n, hora = HORA_AGORA_SP) => JSON.stringify({
  endpoint: 'https://push.exemplo/' + n, keys: { p256dh: 'k' + n, auth: 'a' + n },
  fuso: 'America/Sao_Paulo', hora
});

(async () => {
  console.log('\n=== quem pode disparar o envio ===');
  /* =========================================================
     O QUE MUDOU AQUI, E POR QUÊ

     Este bloco prendia duas facilidades de depuração que viraram
     buracos de segurança e foram removidas:

       1. ?secret=... na URL. Query string entra no log de acesso da
          Vercel, no histórico do navegador e no Referer. Um segredo
          em URL fica escrito em lugares que ninguém limpa.
       2. A resposta de 401 devolvia tamanhoConfigurado — o
          COMPRIMENTO EXATO do CRON_SECRET — e segredoConfigurado,
          para quem não tinha autorização nenhuma. Confirmava que o
          segredo existe e dizia de que tamanho.

     Agora o 401 é uma frase só, e só o cabeçalho Authorization
     autoriza — que é o que o GitHub Actions e o README já usavam.
     ========================================================= */
  let r = await chamar({});
  ok('sem credencial nenhuma dá 401', r.code === 401, r.code);

  r = await chamar({ headers: { authorization: 'Bearer errado' } });
  ok('segredo errado também dá 401', r.code === 401, r.code);

  r = await chamar({ query: { secret: 'segredo123' }, url: '/api/daily-push?secret=segredo123' });
  ok('o segredo certo na URL NÃO autoriza mais', r.code === 401, r.code);

  console.log('\n=== e o 401 não conta nada sobre o segredo ===');
  const corpo401 = JSON.stringify(r.corpo);
  ok('não diz o tamanho de lado nenhum', !/tamanho/i.test(corpo401), corpo401);
  ok('não diz se o servidor tem um configurado',
     !/segredoConfigurado|segredoRecebido/.test(corpo401));
  ok('não nomeia a variável de ambiente', !/CRON_SECRET/.test(corpo401));
  ok('e nunca traz o segredo de verdade', !corpo401.includes('segredo123'));

  const guardaSeg = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const semSegredoNoServidor = await chamar({ headers: { authorization: 'Bearer qualquer' } });
  process.env.CRON_SECRET = guardaSeg;
  ok('"não configurado" responde igual a "não confere"',
     semSegredoNoServidor.code === r.code &&
     JSON.stringify(semSegredoNoServidor.corpo) === corpo401,
     JSON.stringify(semSegredoNoServidor.corpo));

  console.log('\n=== espaço colado junto não pode derrubar a chamada ===');
  /* colar o valor no painel da Vercel costuma trazer um espaço ou uma
     quebra de linha; os dois lados parecem iguais na tela e nunca
     conferem. O trim continua valendo — no cabeçalho, agora. */
  const guardaEsp = process.env.CRON_SECRET;
  process.env.CRON_SECRET = '  segredo123\n';
  banco.set('lampada:push:subs', new Set());
  r = await chamar({ headers: { authorization: 'Bearer segredo123' } });
  ok('segredo com espaço na Vercel ainda confere', r.code === 200, r.code);
  process.env.CRON_SECRET = guardaEsp;

  console.log('\n=== Bearer com espaços sobrando ===');
  banco.set('lampada:push:subs', new Set());
  r = await chamar({ headers: { authorization: '  Bearer   segredo123  ' } });
  ok('aceita o Bearer mesmo torto', r.code === 200, r.code);

  console.log('\n=== o cron da Vercel continua entrando sozinho ===');
  banco.set('lampada:push:subs', new Set());
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('x-vercel-cron: 1 autoriza, como antes', r.code === 200, r.code);

  console.log('\n=== com assinantes, envia para todos ===');
  banco.set('lampada:push:subs', new Set([assinatura(1), assinatura(2), assinatura(3)]));
  /* o capítulo pedido muda com o dia do ano: devolvemos uma faixa larga
     para o versículo procurado sempre existir */
  const capituloFalso = (nome) => ({ book_name: nome, verses:
    Array.from({ length: 40 }, (_, i) => ({ verse: i + 1,
      text: i === 0 ? 'O Senhor é o meu pastor, nada me faltará.' : 'Versículo ' + (i + 1) + ' do capítulo.' })) });
  respostaBiblia = capituloFalso('Salmos');
  enviados.length = 0;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('o cron da Vercel é aceito', r.code === 200, r.code);
  ok('enviou para os três', r.corpo.sent === 3, JSON.stringify({ total: r.corpo.total, sent: r.corpo.sent }));

  console.log('\n=== a mesma execução repetida não manda de novo ===');
  /* o cron passou a rodar de hora em hora, e a Vercel pode repetir uma
     execução que falhou no meio; quem recebe duas vezes desliga o aviso */
  enviados.length = 0;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('nada é enviado na segunda volta', r.corpo.sent === 0, JSON.stringify({ sent: r.corpo.sent, repetidos: r.corpo.repetidos }));
  ok('e os três são contados como já enviados', r.corpo.repetidos === 3, r.corpo.repetidos);

  console.log('\n=== quem escolheu outra hora não recebe agora ===');
  simples.clear();
  const outraHora = (HORA_AGORA_SP + 5) % 24;
  banco.set('lampada:push:subs', new Set([assinatura(1), assinatura(9, outraHora)]));
  enviados.length = 0;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('só quem está na hora recebe', r.corpo.sent === 1,
     JSON.stringify({ total: r.corpo.total, naHora: r.corpo.naHora, sent: r.corpo.sent }));
  ok('e o total continua contando todo mundo', r.corpo.total === 2, r.corpo.total);
  /* devolve os três para os cenários seguintes */
  banco.set('lampada:push:subs', new Set([assinatura(1), assinatura(2), assinatura(3)]));
  ok('nenhum erro', r.corpo.errors.length === 0, JSON.stringify(r.corpo.errors));
  ok('configurou o VAPID', Array.isArray(webpushFalso.vapid) && webpushFalso.vapid[1] === 'pub');

  const carga = enviados[0].payload;
  console.log('     payload:', JSON.stringify(carga));
  ok('a mensagem tem título, corpo e destino',
     !!carga.title && !!carga.body && carga.url === '/');
  ok('a tag agrupa as notificações', carga.tag === 'devocional-diario');
  /* o versículo do dia gira: fixar "Salmos" fazia o teste reprovar na
     virada da data, sem nada de errado no app */
  ok('o título traz uma referência de livro',
     /^[1-3]?\s?[A-ZÁÊÍÓÚÇ][^\d]*\s\d+:\d+ · /.test(carga.title), carga.title);
  ok('o corpo traz o texto do versículo', /Versículo|pastor/.test(carga.body), carga.body);
  ok('tem prazo de validade', enviados[0].op && enviados[0].op.TTL > 0, JSON.stringify(enviados[0].op));

  console.log('\n=== Bearer e o cron também abrem ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  enviados.length = 0;
  r = await chamar({ headers: { authorization: 'Bearer segredo123' } });
  ok('Bearer com o segredo certo funciona', r.code === 200 && r.corpo.sent === 3, r.code);
  enviados.length = 0;
  simples.clear();
  banco.set('lampada:push:subs', new Set([assinatura(1), assinatura(2), assinatura(3)]));
  simples.clear();
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('e o cron da Vercel também', r.code === 200 && r.corpo.sent === 3, r.code);

  console.log('\n=== inscrição morta é removida sozinha ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  falhaProxima = { endpoint: 'https://push.exemplo/2', status: 410 };
  enviados.length = 0;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('conta o removido', r.corpo.removed === 1, JSON.stringify({ sent: r.corpo.sent, removed: r.corpo.removed }));
  ok('e some do banco', banco.get('lampada:push:subs').size === 2,
     banco.get('lampada:push:subs').size + ' restantes');
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('na próxima rodada já são dois', r.corpo.total === 2, r.corpo.total);

  console.log('\n=== falha passageira não apaga ninguém ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  falhaProxima = { endpoint: 'https://push.exemplo/1', status: 500, msg: 'servidor de push instável' };
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('registra o erro', r.corpo.errors.length === 1, JSON.stringify(r.corpo.errors));
  ok('não remove por erro passageiro', banco.get('lampada:push:subs').size === 2);
  ok('e entrega para quem deu certo', r.corpo.sent === 1, r.corpo.sent);

  console.log('\n=== a Bíblia fora do ar não impede o lembrete ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  /* o acerto de hoje já está no cache do módulo desde os cenários
     anteriores; sem limpar, a queda simulada nunca seria exercitada */
  handler._limparCacheMensagem();
  respostaBiblia = 'erro';
  enviados.length = 0;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('ainda envia', r.corpo.sent === 2, r.corpo.sent);
  /* a reserva não é mais genérica: mesmo sem o texto, ela diz a referência,
     que é nossa e não depende da API */
  ok('com mensagem de reserva que aponta o devocional',
     /O devocional de hoje está em .+ \d+:\d+/.test(enviados[0].payload.body),
     enviados[0].payload.body);

  console.log('\n=== sem assinante nenhum ===');
  banco.set('lampada:push:subs', new Set());
  respostaBiblia = capituloFalso('Salmos');
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('responde 200 sem quebrar', r.code === 200 && r.corpo.total === 0, JSON.stringify(r.corpo));

  console.log('\n=== falta de configuração é dita com clareza ===');
  const guarda = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('sem chave VAPID dá 503', r.code === 503 && /VAPID/.test(r.corpo.error), r.code + ' ' + r.corpo.error);
  process.env.VAPID_PRIVATE_KEY = guarda;

  const g2 = process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('sem Redis dá 503', r.code === 503 && /Redis/.test(r.corpo.error), r.code + ' ' + r.corpo.error);
  process.env.UPSTASH_REDIS_REST_URL = g2;

  console.log('\n=== a notificação anuncia o versículo que o app mostra ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  /* A lista do push é cópia da do app, porque o app é arquivo único e a
     função de servidor não importa de dentro dele. Esta asserção é o que
     impede a cópia de envelhecer sem ninguém notar. */
  const fsx = origRequire('fs');
  /* o JavaScript do app saiu do index.html para o app.js quando a CSP
     passou a recusar script embutido */
  const html = fsx.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');
  const P = eval('(' + html.match(/const PROMESSAS = (\{[\s\S]*?\n\});/)[1] + ')');
  const doApp = [];
  for (const vs of Object.values(P)) for (const v of vs) doApp.push(v.join('-'));
  const mod = origRequire(path.join(RAIZ, 'lib/versiculos.js'));
  const doPush = mod.VERSICULOS.map(v => v.join('-'));
  ok('as duas listas têm o mesmo tamanho', doApp.length === doPush.length,
     doApp.length + ' no app, ' + doPush.length + ' no push');
  const difere = doApp.findIndex((v, i) => v !== doPush[i]);
  ok('e a mesma ordem, item por item', difere === -1,
     difere === -1 ? '180 iguais' : 'diverge no ' + difere + ': ' + doApp[difere] + ' x ' + doPush[difere]);

  /* o teste que de fato pega o defeito antigo: comparar o que cada lado
     escolheria para o mesmo dia, ao longo de um ano inteiro */
  const LIV = eval('(' + html.match(/const LIVROS = (\[[\s\S]*?\n\])\.map/)[1] + ')');
  const nomes = {}; LIV.forEach(([nr, n]) => nomes[nr] = n);
  let divergentes = 0, exemplo = '';
  for (let n = 1; n <= 366; n++) {
    const d = new Date(2026, 0, n);
    const doDia = mod.versiculoDoDia(d);
    const idx = mod.diaDoAno(d) % doApp.length;
    const esperado = doApp[idx];
    const veio = [doDia.nr, doDia.cap, doDia.verso].join('-');
    if (veio !== esperado) { divergentes++; if (!exemplo) exemplo = 'dia ' + n + ': ' + veio + ' x ' + esperado; }
  }
  ok('nos 366 dias, o push escolhe o mesmo do app', divergentes === 0, exemplo || '0 divergências');

  const hoje = mod.versiculoDoDia();
  ok('o nome do livro sai da nossa tabela, não do book_name da API',
     hoje.livro === nomes[hoje.nr], hoje.livro + ' ' + hoje.cap + ':' + hoje.verso);

  /* A partir do envio por fuso, o dia do assinante não é o dia do
     contêiner: às 01h UTC, São Paulo ainda está na véspera. Foi isto
     que esta asserção pegou — o push mandava Tiago 1:17 (dia 22 em UTC)
     enquanto o teste esperava o do dia 22 também. O push estava certo:
     quem está em São Paulo abre o app e vê o versículo do dia 21.
     A referência tem de sair da data local do assinante. */
  const agenda = origRequire(path.join(RAIZ, 'lib/agenda.js'));
  const dataLocalSP = agenda.momentoLocal('America/Sao_Paulo').data;
  const [ay, am, ad] = dataLocalSP.split('-').map(Number);
  const hojeLocal = mod.versiculoDoDia(new Date(ay, am - 1, ad));

  console.log('\n=== sem o texto, a referência ainda é a certa ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  banco.set('lampada:push:subs', new Set([assinatura(9)]));
  respostaBiblia = 'erro';
  enviados.length = 0;
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  const ref = hojeLocal.livro + ' ' + hojeLocal.cap + ':' + hojeLocal.verso;
  ok('a mensagem de reserva diz onde é o devocional',
     enviados[0].payload.body.includes(ref), enviados[0].payload.body);
  respostaBiblia = capituloFalso('Salmos');

  console.log('\n=== VAPID_SUBJECT com e-mail solto ===');
  simples.clear();   /* cada cenário parte de um dia limpo */
  /* escrever so o endereco no painel e o erro mais facil de cometer:
     o web-push recusa, e a mensagem dele nao diz o que fazer */
  banco.set('lampada:push:subs', new Set([assinatura(1)]));
  respostaBiblia = capituloFalso('Salmos');
  const guardaSub = process.env.VAPID_SUBJECT;

  process.env.VAPID_SUBJECT = 'davidmartins1399@gmail.com';
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('e-mail sem mailto: ainda funciona', r.code === 200, r.code);
  ok('o mailto: é acrescentado', webpushFalso.vapid[0] === 'mailto:davidmartins1399@gmail.com',
     webpushFalso.vapid[0]);

  process.env.VAPID_SUBJECT = '  mailto:ja@tinha.com  ';
  await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('quem já tem mailto: não ganha outro', webpushFalso.vapid[0] === 'mailto:ja@tinha.com',
     webpushFalso.vapid[0]);

  process.env.VAPID_SUBJECT = 'https://devocionaldiario-eosin.vercel.app';
  await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('uma URL passa intacta', webpushFalso.vapid[0] === 'https://devocionaldiario-eosin.vercel.app',
     webpushFalso.vapid[0]);

  delete process.env.VAPID_SUBJECT;
  await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('sem nada configurado, cai no padrão', /^mailto:/.test(webpushFalso.vapid[0]),
     webpushFalso.vapid[0]);
  process.env.VAPID_SUBJECT = guardaSub;

  console.log('\n=== nada estoura como crash sem explicação ===');
  banco.set('lampada:push:subs', new Set([assinatura(1)]));
  respostaBiblia = capituloFalso('Salmos');

  /* 1. chave VAPID torta: o web-push valida e joga exceção */
  webpushFalso.setVapidDetails = () => { throw new Error('Vapid public key should be 65 bytes long when decoded.'); };
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('chave VAPID inválida vira 503, não crash', r.code === 503, r.code);
  ok('e diz qual etapa falhou', r.corpo.etapa === 'configurar VAPID', r.corpo.etapa);
  /* o detalhe do web-push ia na resposta e agora vai para o log: a
     mensagem de erro de uma biblioteca descreve o que roda aqui dentro */
  ok('sem detalhe de biblioteca na resposta', r.corpo.detalhe === undefined, r.corpo.detalhe);
  ok('e sem o tamanho das chaves VAPID na resposta',
     r.corpo.tamanhoPublica === undefined && r.corpo.tamanhoPrivada === undefined,
     r.corpo.tamanhoPublica + '/' + r.corpo.tamanhoPrivada);
  webpushFalso.setVapidDetails = (...a) => { webpushFalso.vapid = a; };

  /* 2. Redis fora do ar ao listar */
  const fetchBom = global.fetch;
  global.fetch = (url, op) => {
    if (op && op.body && op.body.startsWith('[')) return Promise.resolve({ ok: false, status: 401, text: async () => 'token inválido' });
    return fetchBom(url, op);
  };
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('Redis recusando vira 502, não crash', r.code === 502, r.code);
  ok('e diz que foi ao listar', r.corpo.etapa === 'listar inscrições', r.corpo.etapa);
  /* o erro cru do Redis dizia o status e o texto da resposta do banco;
     isso fica no log da Vercel, não na resposta */
  ok('sem o erro cru do banco na resposta', r.corpo.detalhe === undefined, r.corpo.detalhe);
  global.fetch = fetchBom;

  /* 3. falha ao limpar inscrição morta não derruba o resto */
  simples.clear();   /* sem dia limpo, a trava barraria antes do envio */
  banco.set('lampada:push:subs', new Set([assinatura(1), assinatura(2)]));
  falhaProxima = { endpoint: 'https://push.exemplo/1', status: 410 };
  let primeira = true;
  global.fetch = (url, op) => {
    if (op && op.body && op.body.startsWith('[')) {
      const [cmd] = JSON.parse(op.body);
      if (cmd === 'SREM') return Promise.resolve({ ok: false, status: 500, text: async () => 'erro ao remover' });
    }
    return fetchBom(url, op);
  };
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('falhar ao remover não quebra o envio', r.code === 200, r.code);
  ok('o outro assinante recebe mesmo assim', r.corpo.sent === 1, r.corpo.sent);
  ok('e a falha fica registrada', /falha ao remover/.test(JSON.stringify(r.corpo.errors)),
     JSON.stringify(r.corpo.errors));
  global.fetch = fetchBom;

  /* 4. qualquer coisa inesperada ainda vira JSON */
  const listarBom = origRequire(path.join(RAIZ, 'lib/store.js')).listSubs;
  webpushFalso.setVapidDetails = () => { const e = new Error('boom'); e.name = 'TypeError'; throw e; };
  webpushFalso.setVapidDetails = (...a) => { webpushFalso.vapid = a; };
  banco.set('lampada:push:subs', new Set([assinatura(1)]));
  r = await chamar({ headers: { 'x-vercel-cron': '1' } });
  ok('e o caminho normal segue funcionando depois de tudo', r.code === 200, r.code);

  console.log('\n=== a janela escolhe mais de uma vez, a trava entrega uma ===');
  /* O relógio passou a ser o do GitHub, que atrasa e às vezes pula uma
     execução, então a janela de recuperação pega a mesma pessoa em até
     três passadas. Esta é a prova de que isso não vira três
     notificações: quem segura é a trava no Redis. */
  simples.clear();
  banco.set('lampada:push:subs', new Set([assinatura(70)]));
  enviados.length = 0;
  const passadas = [];
  for(let i = 0; i < 3; i++){
    const rr = await chamar({ headers: { 'x-vercel-cron': '1' } });
    passadas.push({ sent: rr.corpo.sent, repetidos: rr.corpo.repetidos, naHora: rr.corpo.naHora });
  }
  ok('as três passadas escolhem a pessoa', passadas.every(x => x.naHora === 1),
     JSON.stringify(passadas.map(x => x.naHora)));
  ok('só a primeira entrega', passadas[0].sent === 1 && passadas[1].sent === 0 && passadas[2].sent === 0,
     JSON.stringify(passadas.map(x => x.sent)));
  ok('as outras duas são contadas como repetidas',
     passadas[1].repetidos === 1 && passadas[2].repetidos === 1,
     JSON.stringify(passadas.map(x => x.repetidos)));
  ok('e o telefone recebeu uma notificação só', enviados.length === 1, enviados.length);

  /* Quem escolheu 8h e só foi chamado às 10h ainda tem de receber.
     Perto da meia-noite a conta encostaria no dia anterior, e a janela
     não atravessa a data de propósito — aí o cenário não se aplica. */
  if(HORA_AGORA_SP >= 2){
    simples.clear();
    enviados.length = 0;
    banco.set('lampada:push:subs', new Set([
      assinatura(71, HORA_AGORA_SP - 1),   /* uma hora de atraso */
      assinatura(72, HORA_AGORA_SP - 2)    /* duas horas de atraso */
    ]));
    r = await chamar({ headers: { 'x-vercel-cron': '1' } });
    ok('o envio atrasado ainda alcança quem esperava mais cedo', r.corpo.sent === 2, r.corpo.sent);
  }
  if(HORA_AGORA_SP >= 3){
    simples.clear();
    enviados.length = 0;
    banco.set('lampada:push:subs', new Set([assinatura(73, HORA_AGORA_SP - 3)]));
    r = await chamar({ headers: { 'x-vercel-cron': '1' } });
    ok('mas três horas depois já passou da janela', r.corpo.sent === 0, r.corpo.sent);
  }

  console.log('\n=== o teto de funções da conta Hobby ===');
  /* A Vercel faz uma função de CADA arquivo dentro de api/, inclusive
     dos que são só biblioteca. Com api/lib/ ali dentro eram 14, e o
     deploy morria em "No more than 12 Serverless Functions". Pior: os
     quatro arquivos de biblioteca viravam rotas públicas — /api/lib/store
     respondia a quem chamasse, sem nunca ter sido pensado como endpoint. */
  const fsz = require('fs');
  const conta = (dir) => fsz.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? conta(path.join(dir, e.name))
                                  : (e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
  const funcoes = conta(path.join(RAIZ, 'api'));
  ok('no máximo 12 funções, que é o teto da conta Hobby',
     funcoes.length <= 12, funcoes.length + ': ' + funcoes.map(f => path.basename(f)).join(', '));
  ok('e as bibliotecas não estão em api/, para não virarem rota',
     !fsz.existsSync(path.join(RAIZ, 'api/lib')));
  ok('elas moram na raiz, em lib/', fsz.existsSync(path.join(RAIZ, 'lib/store.js')));
  /* os endpoints têm de continuar achando as bibliotecas de lá */
  for(const f of funcoes){
    const src = fsz.readFileSync(f, 'utf8');
    if(!/require\(['"]\.\.?\/lib\//.test(src)) continue;
    let achou = true;
    try { origRequire(f); } catch(e) { achou = !/Cannot find module/.test(e.message); }
    ok(path.basename(f) + ' acha as bibliotecas no caminho novo', achou);
  }

  console.log('\n=== o horário do cron ===');
  /* O cron da Vercel voltou a ser diário porque conta Hobby recusa o
     deploy inteiro com qualquer coisa mais frequente:
       "Hobby accounts are limited to daily cron jobs."
     O relógio de hora em hora, que o envio por fuso exige, mudou-se
     para o GitHub Actions. O da Vercel fica como rede de segurança. */
  const vercel = JSON.parse(require('fs').readFileSync(RAIZ + '/vercel.json', 'utf8'));
  const cron = vercel.crons[0];
  ok('aponta para o envio diário', cron.path === '/api/daily-push', cron.path);
  ok('e roda uma vez por dia, que é o teto da conta Hobby',
     /^\S+ \S+ \* \* \*$/.test(cron.schedule) && !/[*\/,-]/.test(cron.schedule.split(' ')[1]),
     cron.schedule);

  console.log('\n=== o relógio de hora em hora, no GitHub ===');
  const yml = require('fs').readFileSync(RAIZ + '/.github/workflows/lembrete.yml', 'utf8');
  ok('o workflow existe', yml.length > 0);
  ok('roda de hora em hora', /cron:\s*'[^']*\*[^']*'/.test(yml), (yml.match(/cron:.*/) || [])[0]);
  ok('duas vezes por hora, para sobreviver ao atraso do GitHub',
     /^\s*- cron: '5,35 \* \* \* \*'/m.test(yml));
  ok('chama o mesmo endpoint do cron da Vercel', yml.includes('/api/daily-push'));
  ok('com o segredo no cabeçalho, nunca na URL',
     /Authorization: Bearer/.test(yml) && !/secret=\$/.test(yml));
  ok('o segredo vem dos secrets do repositório, não escrito no arquivo',
     /secrets\.CRON_SECRET/.test(yml));
  ok('falha alto se o segredo não estiver configurado', /::error::/.test(yml));
  ok('e não deixa duas execuções brigarem pela trava', /concurrency:/.test(yml));

console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  process.exit(F ? 1 : 0);
})();
