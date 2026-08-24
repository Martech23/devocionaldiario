const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Mapa da Terra Santa */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1100);
  await p.evaluate(() => {
    window.buscarCapitulo = async () => ({ itens: [{ numero: 1, texto: 'Texto do capítulo.' }] });
  });

  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  console.log('\n=== os dados são geografia de verdade ===');
  const d = await p.evaluate(() => {
    const cap = {}; LIVROS.forEach(l => cap[l.nr] = l.caps);
    const fora = LUGARES.filter(l =>
      l.lat < MAPA.sulLat || l.lat > MAPA.norteLat || l.lon < MAPA.oesteLon || l.lon > MAPA.lesteLon);
    const refsRuins = [];
    LUGARES.forEach(l => l.refs.forEach(([nr, c]) => {
      if(!cap[nr] || c < 1 || c > cap[nr]) refsRuins.push(l.nome); }));
    return { total: LUGARES.length, fora: fora.map(l => l.nome), refsRuins,
             semNota: LUGARES.filter(l => !l.nota || l.nota.length < 10).map(l => l.nome),
             semRef: LUGARES.filter(l => !l.refs || !l.refs.length).map(l => l.nome) };
  });
  ok('todos os lugares cabem no recorte do mapa', d.fora.length === 0, d.fora.join(', '));
  ok('nenhuma passagem inválida', d.refsRuins.length === 0, d.refsRuins.join(', '));
  ok('todo lugar tem nota', d.semNota.length === 0, d.semNota.join(', '));
  ok('todo lugar tem ao menos uma passagem', d.semRef.length === 0, d.semRef.join(', '));
  ok('há uma boa quantidade de lugares', d.total >= 40, d.total);

  console.log('\n=== as coordenadas são as do OpenBible ===');
  /* amostra conferida contra o Bible Geocoding Data: se alguém editar
     LUGARES à mão em vez de rodar o gerador, isto reprova */
  const ob = await p.evaluate(() => {
    const q = n => LUGARES.find(l => l.nome === n);
    return { jer: q('Jerusalém'), bel: q('Belém'), dam: q('Damasco'),
             mencoes: LUGARES.filter(l => !(l.mencoes > 0)).map(l => l.nome),
             soma: LUGARES.reduce((s, l) => s + l.mencoes, 0) };
  });
  ok('Jerusalém em 31.7767, 35.2342',
     ob.jer.lat === 31.7767 && ob.jer.lon === 35.2342, ob.jer.lat + ', ' + ob.jer.lon);
  ok('Belém em 31.7043, 35.2076',
     ob.bel.lat === 31.7043 && ob.bel.lon === 35.2076, ob.bel.lat + ', ' + ob.bel.lon);
  ok('Damasco em 33.5111, 36.3064',
     ob.dam.lat === 33.5111 && ob.dam.lon === 36.3064, ob.dam.lat + ', ' + ob.dam.lon);
  ok('todo lugar tem contagem de menções', ob.mencoes.length === 0, ob.mencoes.join(', '));
  ok('Jerusalém é a mais citada de todas',
     await p.evaluate(() => LUGARES.every(l => l.nome === 'Jerusalém' || l.mencoes < 955)));
  ok('nenhum resquício de ajuste manual de rótulo',
     await p.evaluate(() => LUGARES.every(l => !('lado' in l) && !('dx' in l) && !('dy' in l))));

  console.log('\n=== a projeção põe cada um no lugar certo ===');
  /* o teste que importa não é o desenho, é a posição relativa: quem está
     mais ao norte tem de sair mais acima, e quem está a leste, à direita */
  const geo = await p.evaluate(() => {
    const nome = n => LUGARES.find(l => l.nome === n);
    const px = n => ({ x: projX(nome(n).lon), y: projY(nome(n).lat) });
    return { jerusalem: px('Jerusalém'), belem: px('Belém'), sidom: px('Sidom'),
             berseba: px('Berseba'), jope: px('Jope'), damasco: px('Damasco'),
             w: MAPA_W, h: MAPA_H };
  });
  ok('Belém fica ao sul de Jerusalém', geo.belem.y > geo.jerusalem.y,
     Math.round(geo.belem.y) + ' > ' + Math.round(geo.jerusalem.y));
  ok('Sidom é o mais ao norte', geo.sidom.y < geo.jerusalem.y && geo.sidom.y < geo.jope.y);
  ok('Berseba é o mais ao sul', geo.berseba.y > geo.jerusalem.y);
  ok('Damasco fica a leste de Jerusalém', geo.damasco.x > geo.jerusalem.x);
  ok('Jope fica a oeste de Jerusalém', geo.jope.x < geo.jerusalem.x);
  ok('o mapa é mais alto que largo, como a região',
     geo.h > geo.w, Math.round(geo.w) + 'x' + Math.round(geo.h));

  console.log('\n=== o mapa abre pela aba da Bíblia ===');
  ok('a seção pertence à aba Bíblia', await p.evaluate(() => abaDe('sec-mapa')) === 'biblia');
  await p.evaluate(() => irParaAba('biblia', { semRolar: true }));
  await p.waitForTimeout(300);
  ok('começa escondida', await p.locator('#sec-mapa.oculto').count() === 1);
  /* A barra de ferramentas — onde mora o botão do mapa — fica guardada
     enquanto se lê um capítulo, junto com a busca e os seletores. O
     mapa continua alcançável pela lista de livros, que é de onde este
     teste passa a chamá-lo. */
  await p.evaluate(() => { if(document.documentElement.dataset.lendo === '1') mostrarNivelDireto('livros'), delete document.documentElement.dataset.lendo; });
  await p.click('#btn-mapa');
  await p.waitForTimeout(700);
  ok('o botão revela o mapa', await p.locator('#sec-mapa').isVisible());
  ok('e o desenho apareceu', await p.locator('#palco-mapa svg.mapa').count() === 1);
  ok('com todos os lugares', await p.locator('#palco-mapa .m-lugar').count() === d.total);
  ok('litoral, rio e águas desenhados',
     await p.locator('#palco-mapa .m-costa').count() === 1 &&
     await p.locator('#palco-mapa .m-rio').count() === 1 &&
     await p.locator('#palco-mapa .m-agua').count() === 2);

  console.log('\n=== nada do alvo de toque aparece ===');
  /* o retângulo que recebe o toque é transparente; num descuido ele herdava
     o traço do grupo e desenhava uma caixa em volta do lugar */
  const alvos = await p.evaluate(() =>
    [...document.querySelectorAll('#palco-mapa .m-alvo')].map(e => {
      const cs = getComputedStyle(e);
      return { fill: cs.fill, stroke: cs.stroke, w: e.getAttribute('width') };
    }));
  ok('todos transparentes e sem traço',
     alvos.every(a => a.fill === 'rgba(0, 0, 0, 0)' && (a.stroke === 'none' || a.stroke === 'rgba(0, 0, 0, 0)')),
     JSON.stringify(alvos[0]));
  ok('e com 44px de área', alvos.every(a => +a.w === 44), alvos[0] && alvos[0].w);

  console.log('\n=== os rótulos não se atropelam ===');
  const colisoes = await p.evaluate(() => {
    /* só os que estão na tela: rótulo escondido devolve retângulo
       zerado na origem, e dois zerados se sobrepõem entre si */
    const cx = [...document.querySelectorAll('#palco-mapa .m-lugar text')]
      .filter(t => t.getAttribute('display') !== 'none')
      .map(t => ({ nome: t.textContent, r: t.getBoundingClientRect() }));
    const bate = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    const pares = [];
    for(let i = 0; i < cx.length; i++) for(let j = i + 1; j < cx.length; j++)
      if(bate(cx[i].r, cx[j].r)) pares.push(cx[i].nome + ' x ' + cx[j].nome);
    return pares;
  });
  ok('nenhum rótulo cobre outro', colisoes.length === 0, colisoes.slice(0, 3).join(' | ') || '0 colisões');
  const rot = await p.evaluate(() => {
    const ts = [...document.querySelectorAll('#palco-mapa .m-lugar text')];
    const escondidos = ts.filter(t => t.getAttribute('display') === 'none');
    const pontos = [...document.querySelectorAll('#palco-mapa .m-lugar circle')]
      .map(c => c.getBoundingClientRect());
    const bate = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    const sobrePonto = ts.filter(t => t.getAttribute('display') !== 'none')
      .filter(t => pontos.some(c => bate(t.getBoundingClientRect(), c)))
      .map(t => t.textContent);
    return { total: ts.length, escondidos: escondidos.map(t => t.textContent),
             sobrePonto, chamadas: document.querySelectorAll('#palco-mapa .m-chamada').length };
  });
  ok('quase todos os nomes aparecem', rot.total - rot.escondidos.length >= rot.total - 5,
     (rot.total - rot.escondidos.length) + '/' + rot.total);
  ok('nenhum nome escrito por cima de um ponto', rot.sobrePonto.length === 0, rot.sobrePonto.join(', '));
  ok('quem ficou longe ganhou linha de chamada', rot.chamadas > 0, rot.chamadas + ' linhas');

  console.log('\n=== tocar num lugar abre a ficha ===');
  await p.evaluate(() => mostrarLugar(LUGARES.findIndex(l => l.nome === 'Belém')));
  await p.waitForTimeout(400);
  ok('a ficha aparece', await p.locator('#ficha-lugar').isVisible());
  ok('com o nome', (await p.locator('#ficha-lugar h3').textContent()) === 'Belém');
  ok('com a nota', /Rute|Davi|Jesus/.test(await p.locator('#ficha-lugar .lugar-nota').textContent()));
  ok('e com a contagem de versículos do OpenBible',
     /Citado em \d+ vers/.test(await p.locator('#ficha-lugar .lugar-mencoes').textContent()),
     await p.locator('#ficha-lugar .lugar-mencoes').textContent());
  const botoes = await p.evaluate(() =>
    [...document.querySelectorAll('#ficha-lugar .lugar-refs button')].map(b => b.textContent));
  ok('e com as passagens', botoes.length >= 2, botoes.join(', '));
  ok('o lugar tocado fica marcado no mapa',
     await p.locator('#palco-mapa .m-lugar.ativo').count() === 1);

  console.log('\n=== a passagem abre no leitor ===');
  await p.locator('#ficha-lugar .lugar-refs button').first().click();
  await p.waitForTimeout(700);
  ok('foi para a leitura', await p.locator('#area-leitura').isVisible());
  ok('sem sair da aba Bíblia', await p.evaluate(() => abaAtual) === 'biblia');

  console.log('\n=== dá para chegar pelo teclado ===');
  const acess = await p.evaluate(() => {
    const g = document.querySelector('#palco-mapa .m-lugar');
    return { tab: g.getAttribute('tabindex'), papel: g.getAttribute('role'),
             rotulo: (g.getAttribute('aria-label') || '').slice(0, 30) };
  });
  ok('cada lugar é focável', acess.tab === '0', acess.tab);
  ok('e se anuncia como botão', acess.papel === 'button');
  ok('com nome e descrição', acess.rotulo.length > 10, acess.rotulo);
  await p.evaluate(() => document.querySelectorAll('#palco-mapa .m-lugar')[2].focus());
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  ok('Enter abre a ficha do lugar focado',
     (await p.locator('#ficha-lugar h3').textContent()).length > 2,
     await p.locator('#ficha-lugar h3').textContent());

  console.log('\n=== a atribuição exigida pela CC BY está na tela ===');
  const cred = await p.evaluate(() => {
    const c = document.querySelector('#sec-mapa .mapa-aviso');
    return { txt: c.textContent.replace(/\s+/g, ' '),
             links: [...c.querySelectorAll('a')].map(a => a.href) };
  });
  ok('credita o OpenBible.info', /OpenBible\.info/.test(cred.txt));
  ok('nomeia a licença', /CC BY 4\.0/.test(cred.txt));
  ok('liga para a base', cred.links.some(h => /openbibleinfo\/Bible-Geocoding-Data/.test(h)));
  ok('liga para o texto da licença', cred.links.some(h => /creativecommons\.org\/licenses\/by\/4\.0/.test(h)));

  console.log('\n=== nome escondido reaparece ao tocar ===');
  const some = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#palco-mapa .m-lugar text')]
      .find(t => t.getAttribute('display') === 'none');
    if(!t) return null;
    const g = t.closest('.m-lugar');
    mostrarLugar(+g.dataset.i);
    return { nome: t.textContent, visivel: getComputedStyle(t).display !== 'none' };
  });
  ok('o nome escondido volta quando o lugar é aberto',
     !some || some.visivel, some ? some.nome : 'nenhum escondido');

  console.log('\n=== o mapa fecha ===');
  /* A barra de ferramentas — onde mora o botão do mapa — fica guardada
     enquanto se lê um capítulo, junto com a busca e os seletores. O
     mapa continua alcançável pela lista de livros, que é de onde este
     teste passa a chamá-lo. */
  await p.evaluate(() => { if(document.documentElement.dataset.lendo === '1') mostrarNivelDireto('livros'), delete document.documentElement.dataset.lendo; });
  await p.click('#btn-mapa');
  await p.waitForTimeout(400);
  ok('o botão esconde de volta', await p.locator('#sec-mapa.oculto').count() === 1);

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);
  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
