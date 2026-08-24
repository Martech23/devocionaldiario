/* Auditoria de segurança dos endpoints: prende o que foi corrigido para
   que não volte por descuido. Roda os handlers de verdade, com Redis e
   rede simulados. */
const RAIZ = require('path').resolve(__dirname, '..');
const fs = require('fs');

let OK = 0, F = 0;
const ok = (n, v, x) => { v ? OK++ : F++;
  console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

/* ---------- Redis de mentira ---------- */
const simples = new Map();
const conjuntos = new Map();
let redisFora = false;
function redisFalso(url, opcoes){
  if(redisFora) return Promise.reject(new Error('Redis fora do ar'));
  const partes = JSON.parse(opcoes.body).map(String);
  const [cmd, chave, valor] = partes;
  let result = null;
  if(cmd === 'SET'){
    if(partes.includes('NX') && simples.has(chave)) result = null;
    else { simples.set(chave, valor); result = 'OK'; }
  }
  else if(cmd === 'GET')    result = simples.has(chave) ? simples.get(chave) : null;
  else if(cmd === 'INCR')   { const n = (Number(simples.get(chave)) || 0) + 1; simples.set(chave, String(n)); result = n; }
  else if(cmd === 'EXPIRE') result = 1;
  else if(cmd === 'DEL')    { result = simples.delete(chave) ? 1 : 0; conjuntos.delete(chave); }
  else if(cmd === 'PFADD' || cmd === 'PFCOUNT') result = 1;
  else {
    if(!conjuntos.has(chave)) conjuntos.set(chave, new Set());
    const s = conjuntos.get(chave);
    if(cmd === 'SMEMBERS') result = [...s];
    else if(cmd === 'SADD'){ const a = s.size; s.add(valor); result = s.size - a; }
    else if(cmd === 'SREM') result = s.delete(valor) ? 1 : 0;
  }
  return Promise.resolve({ ok: true, json: async () => ({ result }) });
}

/* ---------- rede de mentira ---------- */
let respostaExterna = null;
const realFetch = global.fetch;
global.fetch = (u, o) => {
  const url = String(u);
  if(url.includes('upstash') || url.includes('redis-falso')) return redisFalso(url, o);
  if(respostaExterna) return Promise.resolve(respostaExterna(url, o));
  return Promise.reject(new Error('rede não simulada: ' + url));
};

process.env.UPSTASH_REDIS_REST_URL = 'https://redis-falso.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'token-de-teste';

/* ---------- res de mentira ---------- */
function fazerRes(){
  const r = { código: 0, corpo: null, cabecalhos: {}, cookies: [] };
  r.setHeader = (k, v) => { r.cabecalhos[k.toLowerCase()] = v; if(/set-cookie/i.test(k)) r.cookies.push(v); };
  r.status = (c) => { r.código = c; return r; };
  r.json = (j) => { r.corpo = j; return r; };
  r.send = (b) => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}
const pedir = async (mod, req) => {
  const res = fazerRes();
  await require(RAIZ + '/api/' + mod)(req, res);
  return res;
};
const req = (o = {}) => Object.assign({ method: 'POST', headers: {}, query: {}, url: '/', body: {} }, o);
const deOrigem = (ip, extra = {}) => req(Object.assign({ headers: { 'x-real-ip': ip } }, extra));
const limpar = () => { simples.clear(); conjuntos.clear(); };

(async () => {

console.log('\n=== o proxy aberto que ninguém usava ===');
/* /api/biblia.js era um proxy sem autenticação para a getBible, com
   CORS liberado e os três parâmetros da URL entrando sem validação
   nenhuma — e o app nunca o chamou. Ocupava um dos 12 lugares de função
   do plano Hobby servindo só de superfície de ataque. */
ok('api/biblia.js não existe mais', !fs.existsSync(RAIZ + '/api/biblia.js'));
const fontes = ['app.js', 'index.html', 'sw.js', 'supabase-extra.js']
  .map(f => fs.readFileSync(RAIZ + '/' + f, 'utf8')).join('\n');
ok('e nada no app o chamava', !/api\/biblia/.test(fontes));
const funcoes = fs.readdirSync(RAIZ + '/api').filter(f => f.endsWith('.js'));
ok('sobram 9 funções, dentro do teto de 12 da Vercel',
   funcoes.length === 9, funcoes.length + ': ' + funcoes.join(' '));

console.log('\n=== nenhum endpoint nosso fala com o mundo inteiro ===');
/* Access-Control-Allow-Origin: * transformava cada um deles num serviço
   público movido pela nossa cota: a chave do Pexels, a largura de banda
   das fotos, o Redis compartilhado com as contas. */
for(const f of funcoes){
  const fonte = fs.readFileSync(RAIZ + '/api/' + f, 'utf8');
  const abre = /res\.setHeader\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/.test(fonte);
  ok('api/' + f + ' não libera CORS para qualquer origem', !abre);
}

console.log('\n=== o 401 do envio parou de contar o segredo ===');
/* A resposta de "não autorizado" devolvia tamanhoConfigurado — o
   comprimento exato do CRON_SECRET — a quem não tinha autorização
   nenhuma, e ainda dizia se ele existia. */
process.env.CRON_SECRET = 'um-segredo-bem-comprido-de-teste';
process.env.VAPID_PUBLIC_KEY = 'x'.repeat(87);
process.env.VAPID_PRIVATE_KEY = 'y'.repeat(43);
let r = await pedir('daily-push', req({ method: 'GET' }));
ok('sem segredo, responde 401', r.código === 401, r.código);
const texto401 = JSON.stringify(r.corpo);
ok('e não diz o tamanho do segredo', !/tamanho/i.test(texto401), texto401);
ok('e não diz se ele está configurado', !/segredoConfigurado|segredoRecebido/.test(texto401));
ok('e não sugere o nome da variável de ambiente',
   !/CRON_SECRET|UPSTASH|VAPID_/.test(texto401), texto401);

console.log('\n=== e o segredo saiu da barra de endereço ===');
/* Query string entra no log de acesso, no histórico e no Referer. */
r = await pedir('daily-push', req({ method: 'GET', query: { secret: process.env.CRON_SECRET },
                                    url: '/api/daily-push?secret=' + process.env.CRON_SECRET }));
ok('?secret= na URL não autoriza mais', r.código === 401, r.código);
const fonteCron = fs.readFileSync(RAIZ + '/api/daily-push.js', 'utf8');
ok('e o código não lê mais secret da query', !/q\.secret|searchParams.*secret/.test(fonteCron));
ok('o cabeçalho Authorization continua valendo — é o que o Actions usa', true);
r = await pedir('daily-push', req({ method: 'GET',
  headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }));
ok('  e de fato autoriza', r.código !== 401, r.código);
ok('  sem pilha de execução na resposta',
   !/pilha|at Object|\.js:\d+/.test(JSON.stringify(r.corpo)));

console.log('\n=== o relógio parou de dizer quem tem conta ===');
/* A mensagem de erro do login já era igual para e-mail inexistente e
   senha errada. O tempo não era: sem usuário o scrypt nem rodava, e a
   resposta voltava num piscar. Media-se o relógio e sabia-se. */
limpar();
const cronometrar = async (email) => {
  const t = process.hrtime.bigint();
  const res = await pedir('conta', deOrigem('9.9.9.' + Math.floor(Math.random() * 250),
    { body: { acao: 'entrar', email, senha: 'senha-errada-mesmo' } }));
  return { ms: Number(process.hrtime.bigint() - t) / 1e6, res };
};
/* uma conta de verdade, para comparar */
await pedir('conta', deOrigem('1.1.1.1', { body: {
  acao: 'registrar', email: 'existe@teste.com', senha: 'senha-boa-123', consentimento: true } }));
const semConta = [];
const comConta = [];
for(let i = 0; i < 3; i++){
  semConta.push((await cronometrar('naoexiste' + i + '@teste.com')).ms);
  comConta.push((await cronometrar('existe@teste.com')).ms);
}
const media = a => a.reduce((x, y) => x + y, 0) / a.length;
const mSem = media(semConta), mCom = media(comConta);
/* a razão entre os dois era de mais de uma ordem de grandeza */
ok('e-mail que não existe demora o mesmo que um que existe',
   mSem / mCom > 0.5 && mSem / mCom < 2,
   mSem.toFixed(0) + 'ms vs ' + mCom.toFixed(0) + 'ms');
const rSem = await cronometrar('naoexiste@teste.com');
const rCom = await cronometrar('existe@teste.com');
ok('e a mensagem continua idêntica nos dois',
   JSON.stringify(rSem.res.corpo) === JSON.stringify(rCom.res.corpo),
   JSON.stringify(rSem.res.corpo));

console.log('\n=== força bruta: o teto por e-mail não bastava ===');
/* Pulverização de senha: UMA senha comum contra muitos e-mails nunca
   chega a 10 tentativas em e-mail nenhum. O contador por e-mail nunca
   dispara, e não havia contador por origem. */
limpar();
/* os tetos são folgados de propósito por causa do CGNAT — muita gente
   dividindo um IP — então o teste precisa passar bem deles */
let bloqueou = 0;
for(let i = 0; i < 45; i++){
  const res = await pedir('conta', deOrigem('7.7.7.7', { body: {
    acao: 'entrar', email: 'alvo' + i + '@teste.com', senha: 'Senha123' } }));
  if(res.código === 429) bloqueou++;
}
ok('45 e-mails diferentes da mesma origem: a origem é travada',
   bloqueou > 0, bloqueou + ' de 45 recusadas');

/* A outra ponta: o contador por e-mail é a arma de quem quer trancar a
   conta ALHEIA. Continua existindo — é defesa — mas agora quem faz o
   ataque também é travado, e de outra origem a vítima ainda entra. */
limpar();
await pedir('conta', deOrigem('1.1.1.1', { body: {
  acao: 'registrar', email: 'vitima@teste.com', senha: 'senha-boa-123', consentimento: true } }));
for(let i = 0; i < 35; i++){
  await pedir('conta', deOrigem('6.6.6.6', { body: {
    acao: 'entrar', email: 'vitima@teste.com', senha: 'errada' } }));
}
const doAtacante = await pedir('conta', deOrigem('6.6.6.6', { body: {
  acao: 'entrar', email: 'vitima@teste.com', senha: 'errada' } }));
ok('quem martela também apanha do teto por origem', doAtacante.código === 429, doAtacante.código);

console.log('\n=== cadastro em massa ===');
/* Sem teto, dava para criar contas sem fim: enche o Redis gratuito, que
   é o MESMO das contas e da sincronização. E o 409 "já existe" é um
   oráculo de quem tem conta num app religioso — o teto não fecha o
   oráculo, fecha a varredura. */
limpar();
let criadas = 0, recusadas = 0;
for(let i = 0; i < 22; i++){
  const res = await pedir('conta', deOrigem('8.8.8.8', { body: {
    acao: 'registrar', email: 'massa' + i + '@teste.com', senha: 'senha-boa-123', consentimento: true } }));
  if(res.código === 201) criadas++;
  if(res.código === 429) recusadas++;
}
ok('a mesma origem não cria conta sem fim', recusadas > 0,
   criadas + ' criadas, ' + recusadas + ' recusadas');

console.log('\n=== métricas não esvaziam mais o Redis das contas ===');
/* Cada POST podia disparar até 42 comandos, e o Redis é compartilhado
   com o login. Umas poucas centenas de chamadas esgotavam a cota do dia. */
limpar();
let ignoradas = 0;
for(let i = 0; i < 140; i++){
  const res = await pedir('metricas', deOrigem('5.5.5.5', { body: { eventos: ['abriu'], id: 'abcdefgh1234' } }));
  if(res.corpo && res.corpo.ignorado === 'limite') ignoradas++;
}
ok('passado o teto, o excesso é descartado', ignoradas > 0, ignoradas + ' de 140');
ok('e nunca vira erro na tela de quem só queria ler',
   (await pedir('metricas', deOrigem('5.5.5.5', { body: { eventos: ['abriu'] } }))).código === 200);

console.log('\n=== a leitura das métricas é uma resposta só ===');
process.env.PUSH_SECRET = 'segredo-das-metricas';
const semSegredo = await pedir('metricas', req({ method: 'GET', query: {}, url: '/api/metricas' }));
delete process.env.PUSH_SECRET;
const semConfig = await pedir('metricas', req({ method: 'GET', query: {}, url: '/api/metricas' }));
process.env.PUSH_SECRET = 'segredo-das-metricas';
ok('"não configurado" e "não confere" respondem igual',
   semSegredo.código === semConfig.código &&
   JSON.stringify(semSegredo.corpo) === JSON.stringify(semConfig.corpo),
   semSegredo.código + ' ' + JSON.stringify(semSegredo.corpo));

console.log('\n=== o proxy de imagem não sai mais do lugar ===');
/* A lista de permissão era conferida antes do pedido, mas o fetch
   seguia redirecionamento sozinho: bastava a origem responder 302 e o
   proxy ia buscar em outro lugar, com o nosso servidor. */
limpar();
respostaExterna = () => ({ ok: false, status: 302,
  headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.alloc(0) });
r = await pedir('proxy-image', req({ method: 'GET',
  query: { url: 'https://images.pexels.com/foto.jpg' } }));
ok('redirecionamento da origem é recusado, não seguido', r.código === 502, r.código);
const fonteProxy = fs.readFileSync(RAIZ + '/api/proxy-image.js', 'utf8');
ok('e o fetch pede redirect: manual', /redirect:\s*'manual'/.test(fonteProxy));

/* o tipo vinha da origem e era repassado como veio: se voltasse HTML,
   este endereço serviria HTML pelo NOSSO domínio */
respostaExterna = () => ({ ok: true, status: 200,
  headers: { get: () => 'text/html; charset=utf-8' },
  arrayBuffer: async () => Buffer.from('<script>alert(1)</script>') });
r = await pedir('proxy-image', req({ method: 'GET',
  query: { url: 'https://images.pexels.com/x.jpg' } }));
ok('o que não é imagem não passa', r.código === 502, r.código);

respostaExterna = () => ({ ok: true, status: 200,
  headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => Buffer.from([0xff, 0xd8, 0xff]) });
r = await pedir('proxy-image', req({ method: 'GET',
  query: { url: 'https://images.pexels.com/boa.jpg' } }));
ok('e uma imagem de verdade passa', r.código === 200, r.código);
ok('  com o tipo reescrito por nós', r.cabecalhos['content-type'] === 'image/jpeg',
   r.cabecalhos['content-type']);
ok('  e com nosniff', r.cabecalhos['x-content-type-options'] === 'nosniff');

r = await pedir('proxy-image', req({ method: 'GET',
  query: { url: 'https://evil.com/x.jpg' } }));
ok('domínio de fora continua barrado', r.código === 403, r.código);
r = await pedir('proxy-image', req({ method: 'GET',
  query: { url: 'https://images.pexels.com@evil.com/x.jpg' } }));
ok('e o truque do @ no lugar da barra também', r.código === 403, r.código);

console.log('\n=== nenhuma resposta entrega o desenho de dentro ===');
/* Mensagens do tipo "defina UPSTASH_REDIS_REST_TOKEN na Vercel" diziam a
   quem estivesse procurando exatamente o que roda aqui. */
limpar();
const guardadas = {
  U: process.env.UPSTASH_REDIS_REST_URL, T: process.env.UPSTASH_REDIS_REST_TOKEN,
  P: process.env.PEXELS_API_KEY
};
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.PEXELS_API_KEY;
delete process.env.PEXELS_KEY;
const vazamentos = [];
for(const [mod, pedido] of [
  ['conta',        req({ body: { acao: 'eu' } })],
  ['sincronizar',  req({ method: 'GET' })],
  ['subscribe',    req({ body: { subscription: { endpoint: 'x', keys: {} } } })],
  ['pexels',       req({ method: 'GET', query: {} })],
  ['vapid-public', req({ method: 'GET' })]
]){
  const res = await pedir(mod, pedido);
  const t = JSON.stringify(res.corpo || '');
  if(/UPSTASH|PEXELS_API_KEY|VAPID_PUBLIC_KEY|Vercel|redeploy/i.test(t)) vazamentos.push(mod + ': ' + t);
}
Object.assign(process.env, { UPSTASH_REDIS_REST_URL: guardadas.U,
  UPSTASH_REDIS_REST_TOKEN: guardadas.T, PEXELS_API_KEY: guardadas.P });
ok('nenhum endpoint nomeia variável de ambiente nem o painel',
   vazamentos.length === 0, vazamentos.join(' | '));

const fontesApi = funcoes.map(f => fs.readFileSync(RAIZ + '/api/' + f, 'utf8')).join('\n');
ok('e nenhum devolve e.message cru ao cliente',
   !/error:\s*e\.message|erro:\s*e\.message|\+\s*erro\.message/.test(fontesApi));

console.log('\n=== o IP serve para contar, não para guardar ===');
/* Contar por origem significa tratar IP, que é dado pessoal (Art. 5º, I).
   Guardamos só um resumo curto, com prazo, e nunca o endereço. */
limpar();
await pedir('metricas', deOrigem('203.0.113.42', { body: { eventos: ['abriu'] } }));
const chaves = [...simples.keys()].filter(k => k.startsWith('bd:lim:'));
ok('a chave do limite existe', chaves.length > 0, chaves[0]);
ok('e não contém o endereço', !chaves.some(k => k.includes('203.0.113.42')), chaves.join(' '));
const { marca } = require(RAIZ + '/lib/limite');
ok('  porque é um resumo de mão única', chaves.some(k => k.includes(marca('203.0.113.42|'))));
ok('  curto o bastante para não reconstituir', marca('x').length === 24, marca('x').length);

console.log('\n=== o limitador não derruba o que protege ===');
limpar();
redisFora = true;
const comRedisFora = await pedir('conta', deOrigem('4.4.4.4', { body: { acao: 'eu' } }));
redisFora = false;
ok('Redis fora do ar não vira 429 nem 500 pelo limitador',
   comRedisFora.código !== 429, comRedisFora.código);

console.log('\n=== o que já estava certo continua certo ===');
limpar();
r = await pedir('conta', deOrigem('2.2.2.2', { body: {
  acao: 'registrar', email: 'ok@teste.com', senha: 'senha-boa-123' } }));
ok('sem consentimento, não cria conta (Art. 11)', r.código === 400, r.código);
r = await pedir('conta', deOrigem('2.2.2.2', { body: {
  acao: 'registrar', email: 'ok@teste.com', senha: 'curta', consentimento: true } }));
ok('senha curta é recusada', r.código === 400, r.código);
r = await pedir('conta', deOrigem('2.2.2.2', { body: {
  acao: 'registrar', email: 'ok@teste.com', senha: 'senha-boa-123', consentimento: true } }));
ok('conta criada', r.código === 201, r.código);
ok('  e a resposta nunca traz hash nem sal',
   !/senha|sal|scrypt/i.test(JSON.stringify(r.corpo)), JSON.stringify(r.corpo));
const cookie = r.cookies.join(' ');
ok('  o cookie é HttpOnly, Secure e SameSite', /HttpOnly/.test(cookie) &&
   /Secure/.test(cookie) && /SameSite=Lax/.test(cookie), cookie.slice(0, 60));
const token = decodeURIComponent(cookie.split('=')[1].split(';')[0]);
ok('  e o token não fica guardado como veio',
   ![...simples.values()].some(v => String(v).includes(token)));
r = await pedir('sincronizar', req({ method: 'GET' }));
ok('sincronizar sem sessão devolve 401', r.código === 401, r.código);
r = await pedir('conta', deOrigem('2.2.2.2', { body: { acao: 'excluir' },
  headers: { 'x-real-ip': '2.2.2.2', cookie: 'bd_sessao=' + encodeURIComponent(token) } }));
ok('excluir a conta sem a senha é recusado', r.código === 401, r.código);

console.log('\n=== erros ===');
console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
process.exit(F ? 1 : 0);
})();
