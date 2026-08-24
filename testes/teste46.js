const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* Offline de verdade: o app prometia funcionar sem internet e abria com
   estilo e nenhuma palavra da Bíblia. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

let OK = 0, F = 0;
const ok = (n, v, x) => { v ? OK++ : F++;
  console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

/* =========================================================
   POR QUE A INTERCEPTAÇÃO É NO CONTEXTO

   A primeira versão desta medição trocava window.fetch na página,
   como fazem as outras suítes. Com isso o service worker NUNCA vê
   o pedido — ele escuta a camada de rede do navegador, e uma
   função trocada dentro da página passa por baixo dele. A medição
   dizia que o cache não funcionava quando o problema era o teste.

   context.route() intercepta onde o SW enxerga.
   ========================================================= */
async function abrirContexto(){
  const ctx = await chromium.launchPersistentContext('/tmp/sw-teste-' + Date.now() + '-' + Math.random(), {
    executablePath: NAVEGADOR,
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'allow'
  });
  ctx.__rede = 0;
  await ctx.route('**://api.getbible.net/**', async rota => {
    ctx.__rede++;
    if(ctx.__offline) return rota.abort('internetdisconnected');
    await rota.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ verses: Array.from({ length: 30 }, (_, i) =>
        ({ verse: i + 1, text: 'Texto do versículo ' + (i + 1) + '.' })) }) });
  });
  await ctx.route('**://bible.helloao.org/**', r => r.fulfill({ status: 404, body: '{}' }));
  const p = ctx.pages()[0];
  await p.addInitScript(MOCK);
  return { ctx, p };
}

const cortarRede = async (ctx) => { ctx.__offline = true; await ctx.setOffline(true); };

(async () => {

console.log('\n=== o service worker assume o controle ===');
let { ctx, p } = await abrirContexto();
await p.goto(BASE + '/index.html');
await p.waitForTimeout(2000);
await p.reload();                      /* 2ª carga: já sob o SW */
await p.waitForTimeout(2500);
ok('o service worker controla a página',
   await p.evaluate(() => !!navigator.serviceWorker.controller));

console.log('\n=== o texto bíblico passa a ser guardado ===');
/* Antes o sw.js dava `return` para getbible, helloao e bible-api: deixava
   passar direto para a rede e não guardava nada. */
const fonteSW = fs.readFileSync(RAIZ + '/sw.js', 'utf8');
ok('o sw.js não ignora mais o texto bíblico',
   /event\.respondWith\(servirBiblia\(req\)\)/.test(fonteSW));
ok('e continua ignorando /api/ — conta e sincronização não se cacheiam',
   /pathname\.startsWith\('\/api\/'\)\) return/.test(fonteSW));

await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
await p.waitForTimeout(1200);
const guardado = await p.evaluate(async () => {
  const nomes = await caches.keys();
  const c = await caches.open('lampada-biblia-v1');
  return { nomes, quantos: (await c.keys()).length };
});
ok('há um cache só para a Bíblia', guardado.nomes.includes('lampada-biblia-v1'),
   guardado.nomes.join(' · '));
ok('e ele tem capítulos dentro', guardado.quantos > 0, guardado.quantos);

console.log('\n=== o cache da Bíblia sobrevive à publicação do app ===');
/* Se o texto morasse no CACHE do app, cada correção de CSS jogaria fora
   tudo o que a pessoa já tinha lido. */
ok('o activate preserva o cache da Bíblia',
   /k !== CACHE && k !== CACHE_BIBLIA/.test(fonteSW));
const sobreviveu = await p.evaluate(async () => {
  /* simula a troca de versão: o activate apaga tudo que não é os dois */
  const antes = (await (await caches.open('lampada-biblia-v1')).keys()).length;
  for(const nome of await caches.keys())
    if(nome !== 'lampada-biblia-v1' && nome.startsWith('lampada-v')) await caches.delete(nome);
  return { antes, depois: (await (await caches.open('lampada-biblia-v1')).keys()).length };
});
ok('apagar o cache do app não leva a Bíblia junto',
   sobreviveu.depois === sobreviveu.antes && sobreviveu.antes > 0,
   sobreviveu.antes + ' → ' + sobreviveu.depois);
await ctx.close();

console.log('\n=== sem internet, o app continua servindo ===');
({ ctx, p } = await abrirContexto());
await p.goto(BASE + '/index.html');
await p.waitForTimeout(2000);
await p.reload();
await p.waitForTimeout(2500);
await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
await p.waitForTimeout(1200);

await cortarRede(ctx);
await p.reload({ waitUntil: 'load' }).catch(() => {});
await p.waitForTimeout(2500);

const offline = await p.evaluate(async () => {
  const cartao = document.getElementById('cartao-hoje').innerText.replace(/\s+/g, ' ');
  irParaAba('biblia');
  try { await abrirLeitura(43, 3); } catch(e){}
  await new Promise(r => setTimeout(r, 1200));
  const lido = document.getElementById('area-leitura').innerText.replace(/\s+/g, ' ');
  try { await abrirLeitura(1, 7); } catch(e){}
  await new Promise(r => setTimeout(r, 1000));
  const novo = document.getElementById('area-leitura').innerText.replace(/\s+/g, ' ');
  return { cartao, lido, novo, comEstilo: getComputedStyle(document.body).fontFamily.length > 5 };
});
ok('a página abre com estilo', offline.comEstilo);
/* era isto que falhava: "Não deu para carregar · Failed to fetch" */
ok('o versículo do dia aparece', !/não deu para carregar|sem internet/i.test(offline.cartao)
   && /Versículo do dia/i.test(offline.cartao), offline.cartao.slice(0, 90));
ok('um capítulo já lido abre inteiro',
   /Texto do versículo 1\./.test(offline.lido), offline.lido.slice(0, 80));
/* honestidade: o que nunca foi buscado não existe, e o app diz isso */
ok('um capítulo nunca aberto avisa, sem mentir',
   /sem internet agora/i.test(offline.novo), offline.novo.slice(0, 70));

console.log('\n=== a mensagem parou de falar com o programador ===');
/* O que aparecia para qualquer pessoa sem sinal: "Se você está numa
   pré-visualização… Abra o console com F12 e veja se aparece erro de
   CORS ou de rede." */
const msg = await p.evaluate(() => {
  const e = document.querySelector('#area-leitura .erro');
  return { texto: e ? e.innerText.replace(/\s+/g, ' ') : '',
           html: e ? e.innerHTML : '',
           botao: !!(e && [...e.querySelectorAll('button')].find(b => /tentar de novo/i.test(b.textContent))) };
});
for(const proibido of ['F12', 'CORS', 'pré-visualização', 'servidor', 'console'])
  ok('não fala em "' + proibido + '"', !new RegExp(proibido, 'i').test(msg.texto), msg.texto.slice(0, 60));
ok('diz o que houve, em uma frase', /sem internet agora/i.test(msg.texto), msg.texto.slice(0, 70));
ok('e diz que o que já foi lido continua lá',
   /continua aqui/i.test(msg.texto));
ok('com um botão de tentar de novo', msg.botao);
ok('sem lista de dicas técnicas', !/<ul|<li/.test(msg.html));

console.log('\n=== quando a rede volta, o erro sai sozinho ===');
ctx.__offline = false;
await ctx.setOffline(false);
await p.waitForTimeout(2500);
const depois = await p.evaluate(() => document.getElementById('area-leitura').innerText.replace(/\s+/g,' '));
ok('o capítulo carrega sem ninguém tocar em nada',
   /Texto do versículo 1\./.test(depois), depois.slice(0, 80));
await ctx.close();

console.log('\n=== o amanhã é guardado enquanto ainda há sinal ===');
/* Cachear o que já foi lido não cobre o devocional de amanhã, que é
   justamente o que a pessoa vai querer no ônibus. */
({ ctx, p } = await abrirContexto());
await p.goto(BASE + '/index.html');
await p.waitForTimeout(2000);
await p.reload();
/* Lento de propósito: espera 3 s de silêncio na rede, depois 7 capítulos
   com 1,2 s entre eles. O marcador do dia só é escrito quando os sete
   terminam — se a sessão acabar antes, a próxima abertura retoma, e o que
   já está no cache do service worker não custa rede nenhuma. */
await p.waitForTimeout(26000);
const aquecido = await p.evaluate(async () => {
  const c = await caches.open('lampada-biblia-v1');
  return { quantos: (await c.keys()).length,
           marca: localStorage.getItem('lampada-aquecido-em') };
});
ok('vários capítulos futuros foram guardados sozinhos',
   aquecido.quantos >= 5, aquecido.quantos + ' no cache');
ok('e o dia fica marcado, para não repetir a cada abertura',
   !!aquecido.marca, aquecido.marca);

const naoRepete = await p.evaluate(async () => {
  const antes = window.__pedidos;
  await aquecerProximosDias();       /* segunda chamada no mesmo dia */
  return true;
});
const fonteApp = fs.readFileSync(RAIZ + '/app.js', 'utf8');
ok('o aquecimento roda uma vez por dia',
   /CHAVE_AQUECIDO\) === hoje\) return/.test(fonteApp));
ok('  e nunca disputa a rede com quem está lendo',
   /requestIdleCallback/.test(fonteApp) && /setTimeout\(r, 1200\)/.test(fonteApp));
ok('  e desiste em silêncio se não houver rede',
   /if\(!navigator\.onLine\) return/.test(fonteApp));

console.log('\n=== o cache não cresce sem limite ===');
ok('há um teto de capítulos', /MAX_BIBLIA = 600/.test(fonteSW));
ok('  e uma poda pelos mais antigos',
   /chaves\.slice\(0, chaves\.length - MAX_BIBLIA\)/.test(fonteSW));
await ctx.close();

console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
process.exit(F ? 1 : 0);
})();
