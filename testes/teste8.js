const RAIZ = require('path').resolve(__dirname, '..');
/* Testes do servidor de contas, com um Redis em memória no lugar do Upstash. */

process.env.UPSTASH_REDIS_REST_URL = 'http://redis-falso';
process.env.UPSTASH_REDIS_REST_TOKEN = 'token-falso';

const bd = new Map();
const expira = new Map();

function vivo(k){
  if (expira.has(k) && Date.now() > expira.get(k)) { bd.delete(k); expira.delete(k); return false; }
  return bd.has(k);
}

global.fetch = async (url, opcoes) => {
  const [cmd, ...args] = JSON.parse(opcoes.body);
  const c = String(cmd).toUpperCase();
  let result = null;

  if (c === 'GET') result = vivo(args[0]) ? bd.get(args[0]) : null;
  else if (c === 'SET') {
    const [k, v, ...resto] = args;
    const temNX = resto.some(x => String(x).toUpperCase() === 'NX');
    if (temNX && vivo(k)) { result = null; }
    else {
      bd.set(k, v);
      const i = resto.findIndex(x => String(x).toUpperCase() === 'EX');
      if (i >= 0) expira.set(k, Date.now() + Number(resto[i + 1]) * 1000);
      result = 'OK';
    }
  }
  else if (c === 'DEL') { bd.delete(args[0]); expira.delete(args[0]); result = 1; }
  else if (c === 'INCR') { const n = (Number(vivo(args[0]) ? bd.get(args[0]) : 0) || 0) + 1; bd.set(args[0], String(n)); result = n; }
  else if (c === 'EXPIRE') { expira.set(args[0], Date.now() + Number(args[1]) * 1000); result = 1; }

  return { ok: true, json: async () => ({ result }), text: async () => '' };
};

const C = require(RAIZ + '/lib/contas.js');
const conta = require(RAIZ + '/api/conta.js');
const sincronizar = require(RAIZ + '/api/sincronizar.js');

let OK = 0, FALHA = 0;
const ok = (n, v) => { v ? OK++ : FALHA++; console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n); };

/* req/res falsos no formato que a Vercel entrega */
/* Cada chamada sai de uma origem diferente, como sairia de verdade: são
   pessoas distintas em aparelhos distintos. Sem isso, o teto por origem
   — que existe para travar varredura de e-mails — dispararia no meio do
   teste, que não é o que este arquivo está medindo. O teto em si tem
   suíte própria. */
let origem = 0;
function chamar(handler, { metodo = 'POST', corpo = {}, cookie = '', ip } = {}) {
  return new Promise(resolve => {
    const cabecalhos = {};
    const res = {
      statusCode: 0,
      setHeader(k, v) { cabecalhos[k.toLowerCase()] = v; },
      status(c) { res.statusCode = c; return res; },
      json(o) { resolve({ status: res.statusCode, corpo: o, cabecalhos }); return res; },
      end() { resolve({ status: res.statusCode, corpo: null, cabecalhos }); return res; }
    };
    handler({ method: metodo, body: JSON.stringify(corpo),
              headers: { cookie, 'x-real-ip': ip || ('198.51.100.' + (++origem % 250)) } }, res);
  });
}

const cookieDe = (r) => {
  const sc = r.cabecalhos['set-cookie'] || '';
  const m = sc.match(/bd_sessao=([^;]*)/);
  return m ? 'bd_sessao=' + m[1] : '';
};

(async () => {
  console.log('\n=== criar conta ===');
  let r = await chamar(conta, { corpo: { acao: 'registrar', email: 'Maria@Exemplo.COM ', senha: 'senhaforte1', consentimento: true } });
  ok('conta criada (201)', r.status === 201);
  ok('e-mail normalizado', r.corpo.usuario.email === 'maria@exemplo.com');
  ok('resposta não devolve senha nem sal',
     !('senha' in r.corpo.usuario) && !('sal' in r.corpo.usuario));
  const cookieMaria = cookieDe(r);
  ok('cookie de sessão emitido', /bd_sessao=.+/.test(cookieMaria));
  const sc = r.cabecalhos['set-cookie'];
  ok('cookie é HttpOnly, Secure e SameSite', /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Lax/.test(sc));

  console.log('\n=== o que o banco guarda ===');
  const gravado = JSON.parse(bd.get('bd:usuario:maria@exemplo.com'));
  ok('senha não é gravada em texto puro', gravado.senha !== 'senhaforte1');
  ok('hash tem 128 hex (scrypt 64 bytes)', /^[0-9a-f]{128}$/.test(gravado.senha));
  ok('cada conta tem sal próprio', /^[0-9a-f]{32}$/.test(gravado.sal));
  ok('consentimento registrado com data', !!gravado.consentiuEm);
  const chavesSessao = [...bd.keys()].filter(k => k.startsWith('bd:sessao:'));
  const tokenCru = cookieMaria.split('=')[1];
  ok('o token da sessão não é gravado', !chavesSessao.some(k => k.includes(tokenCru)));

  console.log('\n=== recusas no cadastro ===');
  r = await chamar(conta, { corpo: { acao: 'registrar', email: 'maria@exemplo.com', senha: 'outrasenha1', consentimento: true } });
  ok('e-mail repetido é recusado (409)', r.status === 409);
  r = await chamar(conta, { corpo: { acao: 'registrar', email: 'joao@exemplo.com', senha: 'curta', consentimento: true } });
  ok('senha curta é recusada', r.status === 400 && /8 caracteres/.test(r.corpo.erro));
  r = await chamar(conta, { corpo: { acao: 'registrar', email: 'nao-e-email', senha: 'senhaforte1', consentimento: true } });
  ok('e-mail inválido é recusado', r.status === 400);
  r = await chamar(conta, { corpo: { acao: 'registrar', email: 'joao@exemplo.com', senha: 'senhaforte1' } });
  ok('sem consentimento não cria conta', r.status === 400 && /aceitar/.test(r.corpo.erro));
  ok('a conta sem consentimento não foi criada', !bd.has('bd:usuario:joao@exemplo.com'));

  console.log('\n=== entrar ===');
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'senhaforte1' } });
  ok('senha certa entra', r.status === 200);
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'errada' } });
  ok('senha errada é recusada (401)', r.status === 401);
  const erroSenha = r.corpo.erro;
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'ninguem@exemplo.com', senha: 'qualquer' } });
  ok('e-mail inexistente dá a mesma mensagem', r.corpo.erro === erroSenha);

  console.log('\n=== limite de tentativas ===');
  for (let i = 0; i < 12; i++) {
    await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'errada' } });
  }
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'senhaforte1' } });
  ok('trava após tentativas demais (429)', r.status === 429);
  bd.delete('bd:tentativas:maria@exemplo.com');
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'senhaforte1' } });
  ok('destravada, entra de novo', r.status === 200);
  const cookieBom = cookieDe(r);

  console.log('\n=== sessão ===');
  r = await chamar(conta, { corpo: { acao: 'eu' }, cookie: cookieBom });
  ok('com cookie, sabe quem é', r.corpo.usuario && r.corpo.usuario.email === 'maria@exemplo.com');
  r = await chamar(conta, { corpo: { acao: 'eu' } });
  ok('sem cookie, ninguém', r.corpo.usuario === null);
  r = await chamar(conta, { corpo: { acao: 'eu' }, cookie: 'bd_sessao=inventado' });
  ok('cookie inventado não vale', r.corpo.usuario === null);

  console.log('\n=== sincronizar ===');
  r = await chamar(sincronizar, { metodo: 'GET' });
  ok('sem sessão, sincronizar é 401', r.status === 401);
  r = await chamar(sincronizar, { metodo: 'GET', cookie: cookieBom });
  ok('conta nova ainda não tem dados', r.status === 200 && r.corpo.dados === null);

  r = await chamar(sincronizar, {
    metodo: 'PUT', cookie: cookieBom,
    corpo: { dados: { favoritos: [{ chave: '43:3:16' }], atividade: ['2026-08-09'], lixo: 'não deveria passar' } }
  });
  ok('grava (200)', r.status === 200 && !!r.corpo.atualizadoEm);
  r = await chamar(sincronizar, { metodo: 'GET', cookie: cookieBom });
  ok('devolve o que gravou', r.corpo.dados.favoritos[0].chave === '43:3:16');
  ok('campo desconhecido é descartado', !('lixo' in r.corpo.dados));
  ok('carimba a data de atualização', !!r.corpo.dados.atualizadoEm);

  const gigante = { notas: {} };
  for (let i = 0; i < 40000; i++) gigante.notas['x' + i] = 'texto de nota razoavelmente longo aqui';
  r = await chamar(sincronizar, { metodo: 'PUT', cookie: cookieBom, corpo: { dados: gigante } });
  ok('recusa acima de 1 MB (413)', r.status === 413);

  console.log('\n=== dados de uma conta não vazam para outra ===');
  const r2 = await chamar(conta, { corpo: { acao: 'registrar', email: 'pedro@exemplo.com', senha: 'senhaforte2', consentimento: true } });
  const cookiePedro = cookieDe(r2);
  r = await chamar(sincronizar, { metodo: 'GET', cookie: cookiePedro });
  ok('Pedro não vê os dados de Maria', r.corpo.dados === null);

  console.log('\n=== sair ===');
  r = await chamar(conta, { corpo: { acao: 'sair' }, cookie: cookieBom });
  ok('sair responde ok', r.status === 200);
  ok('cookie é limpo', /bd_sessao=;/.test(r.cabecalhos['set-cookie']));
  r = await chamar(conta, { corpo: { acao: 'eu' }, cookie: cookieBom });
  ok('a sessão antiga deixa de valer', r.corpo.usuario === null);

  console.log('\n=== excluir conta ===');
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'senhaforte1' } });
  const cookieFinal = cookieDe(r);
  r = await chamar(conta, { corpo: { acao: 'excluir', senha: 'errada' }, cookie: cookieFinal });
  ok('excluir sem a senha certa é recusado', r.status === 401);
  ok('a conta continua lá', bd.has('bd:usuario:maria@exemplo.com'));

  r = await chamar(conta, { corpo: { acao: 'excluir', senha: 'senhaforte1' }, cookie: cookieFinal });
  ok('excluir com a senha certa funciona', r.status === 200);
  ok('usuário apagado', !bd.has('bd:usuario:maria@exemplo.com'));
  ok('dados apagados', !bd.has([...bd.keys()].find(k => k.startsWith('bd:dados:')) || 'nada'));
  r = await chamar(conta, { corpo: { acao: 'entrar', email: 'maria@exemplo.com', senha: 'senhaforte1' } });
  ok('não dá mais para entrar', r.status === 401);

  console.log('\n=== métodos e ações inválidas ===');
  r = await chamar(conta, { metodo: 'GET' });
  ok('GET em /api/conta é 405', r.status === 405);
  r = await chamar(conta, { corpo: { acao: 'invadir' } });
  ok('ação desconhecida é 400', r.status === 400);
  r = await chamar(sincronizar, { metodo: 'DELETE', cookie: cookiePedro });
  ok('DELETE em /api/sincronizar é 405', r.status === 405);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + FALHA + ' falhas ===');
  process.exit(FALHA ? 1 : 0);
})();
