const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Busca por palavra: quantas idas e voltas custa */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* Serve a "Bíblia" inteira sem rede: conta cada pedido e sabe responder
   tanto por livro quanto por capítulo, para dar para testar os dois caminhos. */
const FONTE = (comLivroInteiro) => `
  window.__pedidos = { livro: 0, capitulo: 0 };
  window.__temLivroInteiro = ${comLivroInteiro};
  const versoDe = (nr, cap, v) =>
    (nr === 19 && cap === 23 && v === 1) ? 'O Senhor é o meu pastor, nada me faltará.'
    : (v === 1 ? 'Neste lugar houve muito amor entre o povo.' : 'Versiculo comum sem a palavra procurada.');
  window.fetch = async (url) => {
    const u = String(url);
    let m = u.match(/v2\\/[^/]+\\/(\\d+)\\.json$/);
    if(m){
      window.__pedidos.livro++;
      if(!window.__temLivroInteiro) return { ok: false, status: 404, json: async () => ({}) };
      const nr = +m[1];
      const livro = LIVROS.find(l => l.nr === nr);
      return { ok: true, json: async () => ({ chapters:
        Array.from({ length: livro.caps }, (_, i) => ({ chapter: i + 1,
          verses: Array.from({ length: 3 }, (_, k) => ({ verse: k + 1, text: versoDe(nr, i + 1, k + 1) })) })) }) };
    }
    m = u.match(/v2\\/[^/]+\\/(\\d+)\\/(\\d+)\\.json$/);
    if(m){
      window.__pedidos.capitulo++;
      const nr = +m[1], cap = +m[2];
      return { ok: true, json: async () => ({ verses:
        Array.from({ length: 3 }, (_, k) => ({ verse: k + 1, text: versoDe(nr, cap, k + 1) })) }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (comLivroInteiro) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => console.log('   pageerror:', e.message));
    await p.addInitScript(MOCK);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(new Function(FONTE(comLivroInteiro)));
    await p.evaluate(() => { versaoAtual = VERSOES.find(v => v.fonte === 'getbible') || VERSOES[0]; });
    return p;
  };

  console.log('\n=== nome de livro não dispara busca de texto ===');
  let p = await abrir(true);
  await p.evaluate(() => { $('busca').value = 'genesis'; buscarReferencia(); });
  await p.waitForTimeout(700);
  ok('abriu a Bíblia em vez de varrer', await p.evaluate(() => abaAtual) === 'biblia');
  ok('nenhuma busca de texto rodou', await p.evaluate(() => $('sec-busca').classList.contains('oculto')));
  ok('e custou quase nada', await p.evaluate(() => __pedidos.livro + __pedidos.capitulo) <= 2,
     await p.evaluate(() => JSON.stringify(__pedidos)));
  ok('acento não atrapalha', await p.evaluate(() => {
    $('busca').value = 'gênesis'; return !!LIVROS.find(l => norm(l.nome) === norm('gênesis')); }));
  await p.evaluate(() => { $('busca').value = 'salmos'; buscarReferencia(); });
  await p.waitForTimeout(600);
  ok('vale para qualquer livro', /Salmos 1/.test(await p.locator('#area-leitura, .ref-leitura').first().textContent().catch(() => '')) ||
     await p.evaluate(() => !!document.querySelector('#area-leitura')));
  await p.close();

  console.log('\n=== com livro inteiro: 39 pedidos, não 929 ===');
  p = await abrir(true);
  await p.evaluate(() => { $('sel-escopo-busca').value = 'at'; $('busca').value = 'zzzqqq'; return buscarPalavra('zzzqqq'); });
  await p.waitForTimeout(1500);
  const comBulk = await p.evaluate(() => __pedidos);
  console.log('     pedidos:', JSON.stringify(comBulk));
  ok('um pedido por livro do AT', comBulk.livro === 39, comBulk.livro);
  ok('nenhum pedido por capítulo', comBulk.capitulo === 0, comBulk.capitulo);
  ok('avisa que não achou nada', /Nenhum versículo/.test(await p.locator('#status-busca').textContent()));
  await p.close();

  console.log('\n=== a busca continua achando o que deve ===');
  p = await abrir(true);
  await p.evaluate(() => { $('sel-escopo-busca').value = 'at'; return buscarPalavra('pastor'); });
  await p.waitForTimeout(1500);
  const achou = await p.locator('#lista-busca .item-busca').count();
  ok('achou o versículo', achou >= 1, achou + ' resultado(s)');
  ok('com a referência certa',
     /Salmos 23:1/.test(await p.locator('#lista-busca .ref-busca').first().textContent()));
  ok('e o termo destacado',
     await p.locator('#lista-busca mark').first().textContent() === 'pastor');
  await p.close();

  console.log('\n=== sem livro inteiro: cai para capítulo, e não insiste ===');
  p = await abrir(false);
  await p.evaluate(() => { $('sel-escopo-busca').value = 'nt'; return buscarPalavra('zzzqqq'); });
  await p.waitForTimeout(4000);
  const semBulk = await p.evaluate(() => __pedidos);
  console.log('     pedidos:', JSON.stringify(semBulk));
  ok('tentou o livro inteiro uma vez só', semBulk.livro === 1, semBulk.livro);
  ok('e varreu os 260 capítulos do NT', semBulk.capitulo === 260, semBulk.capitulo);
  ok('mesmo assim respondeu', /Nenhum versículo/.test(await p.locator('#status-busca').textContent()));
  await p.close();

  console.log('\n=== para de procurar ao encher a tela ===');
  p = await abrir(true);
  await p.evaluate(() => { $('sel-escopo-busca').value = 'tudo'; return buscarPalavra('amor'); });
  await p.waitForTimeout(2500);
  const cheio = await p.evaluate(() => __pedidos);
  const n = await p.locator('#lista-busca .item-busca').count();
  console.log('     pedidos:', JSON.stringify(cheio), '| resultados:', n);
  ok('parou nos 40 resultados', n === 40, n);
  ok('sem varrer os 66 livros', cheio.livro < 66, cheio.livro + ' livros pedidos');
  ok('status marca que há mais', /\+/.test(await p.locator('#status-busca').textContent()),
     await p.locator('#status-busca').textContent());
  await p.close();

  console.log('\n=== o cache do livro serve a leitura depois ===');
  p = await abrir(true);
  await p.evaluate(() => { $('sel-escopo-busca').value = 'at'; return buscarPalavra('pastor'); });
  await p.waitForTimeout(1500);
  const antes = await p.evaluate(() => __pedidos.capitulo);
  await p.evaluate(() => abrirLeitura(19, 23));
  await p.waitForTimeout(600);
  ok('abrir Salmos 23 não pediu nada de novo',
     await p.evaluate(() => __pedidos.capitulo) === antes, 'antes ' + antes);
  ok('e o capítulo apareceu', await p.locator('#area-leitura .v').count() >= 1);
  await p.close();

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
