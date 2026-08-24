/* A política de privacidade contra o código.
   Uma política que descreve coisa diferente do que o sistema faz é, ela
   própria, uma falha de transparência (Art. 6º, VI da LGPD). Este teste
   compara as duas — foi assim que apareceu a afirmação errada sobre o
   Pexels, que a política dizia receber o IP de quem usa o app quando na
   verdade tudo passa pelo nosso servidor. */
const fs = require('fs');
const RAIZ = require('path').resolve(__dirname, '..');

let OK = 0, F = 0;
const ok = (n, v, x) => { v ? OK++ : F++;
  console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

const pol = fs.readFileSync(RAIZ + '/privacidade.html', 'utf8');
const semTags = pol.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const app = fs.readFileSync(RAIZ + '/app.js', 'utf8');
const vercel = JSON.parse(fs.readFileSync(RAIZ + '/vercel.json', 'utf8'));
const csp = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;

console.log('\n=== o que a LGPD exige que esteja escrito ===');
/* Art. 9º: finalidade, forma e duração, identificação do controlador,
   contato, com quem se compartilha e os direitos do titular. */
const exigidos = [
  ['identificação do controlador (Art. 5º, VI)', /controlador dos dados/i],
  ['canal de contato',                            /davidmartins1399@gmail\.com/],
  ['base legal de cada tratamento (Art. 7º)',     /Art\. 7º, V/],
  ['dado sensível e Art. 11',                     /Art\. 11, I/],
  ['direitos do titular (Art. 18)',               /Art\. 18/],
  ['prazo de guarda',                             /Por quanto tempo guardamos/i],
  ['revogação do consentimento',                  /revogar/i],
  ['transferência internacional (Art. 33)',       /Art\. 33/],
  ['incidente de segurança (Art. 48)',            /Art\. 48/],
  ['crianças e adolescentes (Art. 14)',           /Art\. 14/],
  ['cookies',                                     /bd_sessao/],
  ['ANPD como via de reclamação',                 /gov\.br\/anpd/],
  ['encarregado, ou a dispensa dele (Art. 41)',   /Art\. 41/],
  ['data da última atualização',                  /Última atualização/i]
];
for(const [nome, re] of exigidos) ok(nome + ' está na política', re.test(semTags) || re.test(pol));

console.log('\n=== quem recebe o quê: a política contra o código ===');
/* Todo terceiro que o navegador chama tem de estar na tabela — e a CSP
   é a lista fechada de para onde o navegador pode falar. */
const conectaCom = (csp.match(/connect-src ([^;]+)/) || [, ''])[1]
  .split(/\s+/).filter(h => h.startsWith('https://') && !h.includes("'"));
const nomeadoNaPolitica = {
  'https://*.supabase.co': /Supabase/i,
  'https://api.getbible.net': /getBible/i,
  'https://bible.helloao.org': /Free Use Bible API/i,
  'https://cdn.jsdelivr.net': /jsDelivr/i
};
for(const host of conectaCom){
  const re = nomeadoNaPolitica[host];
  ok('a CSP deixa falar com ' + host + ', e a política o nomeia',
     !!re && re.test(semTags), re ? '' : 'NÃO ESTÁ NA TABELA');
}
ok('a Vercel está na tabela (hospeda e vê o IP)', /Vercel/.test(semTags));
ok('a Upstash está na tabela (guarda a conta)', /Upstash/.test(semTags));

console.log('\n=== o Pexels: o erro que motivou este teste ===');
/* As fotos e a busca passam por /api/pexels e /api/proxy-image. O
   endereço de quem usa o app nunca chega ao Pexels — a política dizia
   que chegava. */
ok('o app só fala com o Pexels pelo nosso servidor',
   /fetch\('\/api\/pexels/.test(app) && /\/api\/proxy-image\?url=/.test(app));
ok('  e nunca direto com api.pexels.com', !/fetch\(\s*['"`]https:\/\/api\.pexels\.com/.test(app));
ok('  nem com images.pexels.com', !/img\.src\s*=\s*['"`]https:\/\/images\.pexels\.com/.test(app));
ok('a CSP nem permitiria: pexels não está em connect-src',
   !conectaCom.some(h => h.includes('pexels')), conectaCom.join(' '));
const linhaPexels = (pol.match(/<td>Pexels<\/td>[\s\S]*?<\/tr>/) || [''])[0].replace(/<[^>]+>/g, ' ');
ok('e a política não afirma mais que o Pexels recebe o seu IP',
   !/Endereço IP/i.test(linhaPexels), linhaPexels.trim().replace(/\s+/g, ' '));
ok('  dizendo, em vez disso, que quem ele vê é o servidor',
   /servidor, não você|vê o servidor/i.test(linhaPexels), linhaPexels.trim().replace(/\s+/g, ' '));

console.log('\n=== os eventos medidos são os que a política lista ===');
const EVENTOS = require(RAIZ + '/api/metricas').EVENTOS;
/* a política descreve os eventos em português corrente; a checagem é de
   quantidade e de que nenhum evento novo entrou sem ser contado */
const trecho = (semTags.match(/o nome de um evento, de uma lista fixa:([^;]+);/i) || [, ''])[1];
const descritos = trecho.split(',').map(x => x.trim()).filter(Boolean);
ok('o servidor aceita ' + EVENTOS.size + ' eventos', EVENTOS.size === 9, EVENTOS.size);
ok('e a política descreve o mesmo tanto', descritos.length === EVENTOS.size,
   descritos.length + ': ' + descritos.join(' | '));
/* nada além da lista fechada entra no Redis */
const anotados = [...app.matchAll(/Metricas\.anotar\('([^']+)'\)/g)].map(m => m[1]);
const forasteiros = anotados.filter(e => !EVENTOS.has(e));
ok('todo evento que o app dispara está na lista fechada do servidor',
   forasteiros.length === 0, forasteiros.join(' '));

console.log('\n=== os prazos escritos são os prazos do código ===');
const metricas = fs.readFileSync(RAIZ + '/api/metricas.js', 'utf8');
const contas = fs.readFileSync(RAIZ + '/lib/contas.js', 'utf8');
const sinc = fs.readFileSync(RAIZ + '/api/sincronizar.js', 'utf8');
const num = (fonte, re) => Number((fonte.match(re) || [, 0])[1]);
ok('90 dias de métricas, no código e na política',
   num(metricas, /DIAS_GUARDADOS = (\d+)/) === 90 && /90 dias/.test(semTags));
ok('30 dias de sessão, no código e na política',
   num(contas, /DIAS_SESSAO = (\d+)/) === 30 && /30 dias/.test(semTags));
ok('15 minutos de tentativas, no código e na política',
   num(contas, /JANELA_TENTATIVAS = (\d+) \* 60/) === 15 && /15 minutos/.test(semTags));
ok('1 MB de limite de sincronização, no código e na política',
   /LIMITE_BYTES = 1024 \* 1024/.test(sinc) && /1 MB/.test(semTags));
ok('resposta ao titular em até 15 dias', /15 dias/.test(semTags));

console.log('\n=== o que sobe é só o que a política diz que sobe ===');
/* A lista fechada do canal de sincronização é a garantia técnica de que
   nada além do descrito sai do aparelho. */
const CAMPOS = (sinc.match(/const CAMPOS = \[([\s\S]*?)\]/) || [, ''])[1]
  .split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean);
ok('o servidor aceita sete campos', CAMPOS.length === 7, CAMPOS.join(' '));
const naPolitica = {
  favoritos: /favoritos/i, notas: /notas/i, destaques: /destaques/i,
  oracoes: /orações/i, capitulosLidos: /capítulos lidos/i,
  atividade: /dias de leitura/i, planos: /progresso dos planos|planos/i
};
for(const c of CAMPOS)
  ok('  "' + c + '" está descrito na política', !!naPolitica[c] && naPolitica[c].test(semTags));

console.log('\n=== o cookie descrito é o cookie que existe ===');
ok('o nome bate', /NOME_COOKIE = 'bd_sessao'/.test(contas) && /bd_sessao/.test(pol));
for(const flag of ['HttpOnly', 'Secure', 'SameSite=Lax'])
  ok('  ' + flag + ' está no código e na política',
     contas.includes(flag) && pol.includes(flag.replace('=Lax', '=Lax')));
ok('é mesmo um cookie só', (contas.match(/setHeader\('Set-Cookie'/g) || []).length === 2);

console.log('\n=== as promessas de segurança são verificáveis ===');
ok('scrypt, como a política diz', /crypto\.scrypt/.test(contas) && /scrypt/i.test(semTags));
ok('sal por conta', /randomBytes\(16\)\.toString\('hex'\)/.test(contas) && /sal individual/i.test(semTags));
ok('comparação em tempo constante', /timingSafeEqual/.test(contas) && /tempo constante/i.test(semTags));
ok('a sessão é guardada como resumo, não como veio',
   /createHash\('sha256'\)/.test(contas) && /resumo criptográfico/i.test(semTags));
ok('excluir exige a senha de novo',
   /acao === 'excluir'[\s\S]{0,400}senhaConfere/.test(fs.readFileSync(RAIZ + '/api/conta.js', 'utf8')) &&
   /exige a senha novamente/i.test(semTags));

console.log('\n=== o IP: tratado para contar, e dito na política ===');
const limite = fs.readFileSync(RAIZ + '/lib/limite.js', 'utf8');
ok('o limitador existe e guarda só um resumo',
   /createHash\('sha256'\)/.test(limite) && /slice\(0, 24\)/.test(limite));
ok('e a política declara esse tratamento e a base legal',
   /endereço de onde vêm os pedidos/i.test(semTags) &&
   /resumo criptográfico truncado/i.test(semTags) &&
   /Art\. 7º, IX/.test(semTags));
ok('as estatísticas ganharam base legal declarada',
   /Base legal:[^.]*legítimo interesse/i.test(semTags));

console.log('\n=== o Do Not Track é respeitado, como está escrito ===');
ok('o código lê doNotTrack', /navigator\.doNotTrack === '1'/.test(app));
ok('e desliga a medição sozinho', /!naoRastrear\(\)/.test(app));
ok('a política promete isso', /Do Not Track/.test(pol));

console.log('\n=== nada além do disclosed fica no aparelho ===');
/* Toda chave de localStorage que o app grava precisa caber numa das
   categorias descritas na seção 2 da política. */
const chaves = [...new Set([...app.matchAll(/'(lampada-[a-z0-9-]+)'/g)].map(m => m[1]))];
const categorias = {
  /* seção 2 da política: o que fica só no aparelho */
  'lampada-favoritos':        'Favoritos',
  'lampada-notas':            'Notas',
  'lampada-destaques':        'Destaques',
  'lampada-oracoes':          'Orações',
  'lampada-capitulos-lidos':  'Progresso',
  'lampada-atividade-dias':   'Progresso',
  'lampada-planos-progresso': 'Progresso',
  'lampada-plano-atual':      'Progresso',
  'lampada-leitura-parou':    'Progresso',
  'lampada-buscas':           'Buscas recentes',
  'lampada-tema':             'Preferências',
  'lampada-voz-prefs':        'Preferências',
  'lampada-escala':           'Preferências',
  'lampada-devo-modo':        'Preferências',
  'lampada-modo-foco':        'Preferências',
  'lampada-aba':              'Preferências',
  'lampada-aba-dia':          'Preferências',
  'lampada-dica-verso':       'Preferências',
  'lampada-lembrete':         'Preferências',
  'lampada-hora-lembrete':    'Preferências',
  'lampada-fuso-enviado':     'Preferências',
  'lampada-metricas':         'Preferências',
  /* seção "Estatísticas de uso": o identificador aleatório */
  'lampada-id-anon':          'Estatísticas',
  /* seção 2, linha "Leitura offline" */
  'lampada-aquecido-em':      'Leitura offline'
};
const naoClassificadas = chaves.filter(k => !categorias[k]);
console.log('   chaves encontradas: ' + chaves.length);
ok('toda chave guardada cai numa categoria descrita na política',
   naoClassificadas.length === 0,
   naoClassificadas.length ? 'sem categoria: ' + naoClassificadas.join(', ') : '');

console.log('\n=== o cache de leitura offline está declarado ===');
/* Guardar o texto dos capítulos lidos é novo, e a lista do que se leu é
   uma informação — mesmo que o texto seja público e nunca saia do
   aparelho. A política precisa dizer isso. */
const sw = fs.readFileSync(RAIZ + '/sw.js', 'utf8');
ok('o service worker guarda o texto bíblico', /CACHE_BIBLIA/.test(sw));
ok('e a política descreve isso na seção do que fica no aparelho',
   /texto dos capítulos que você\s+abriu/i.test(semTags.replace(/\s+/g, ' ')) ||
   /texto dos capítulos que você abriu/i.test(semTags));
ok('  dizendo que nunca sai do aparelho',
   /Ela nunca sai\s*do aparelho/i.test(semTags) || /nunca sai do aparelho/i.test(semTags));
ok('  e a tabela ganhou a linha "Leitura offline"', /Leitura offline/.test(semTags));

console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
process.exit(F ? 1 : 0);
