const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html');
  await page.waitForTimeout(700);
  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);

  await page.evaluate(() => {
    window.__caps = [];
    window.buscarCapitulo = async (nr, cap) => {
      window.__caps.push(nr + ':' + cap);
      return { itens: [{ numero: 1, texto: 'Texto do capítulo ' + cap + '.' }] };
    };
  });

  console.log('\n=== continuar no próximo capítulo (desligado) ===');
  await page.evaluate(() => { window.__falas = []; window.__dur = 50; window.__caps = []; });
  await page.evaluate(() => abrirLeitura(19, 23, null, true));
  await page.waitForTimeout(700);
  let caps = await page.evaluate(() => window.__caps);
  console.log('     capítulos abertos:', JSON.stringify(caps));
  ok('abriu só o capítulo pedido', caps.length === 1 && caps[0] === '19:23');
  ok('barra escondida ao terminar', await page.locator('#barra-audio.ver').count() === 0);

  console.log('\n=== continuar no próximo capítulo (ligado) ===');
  await page.evaluate(() => { $('chave-auto-cap').click(); });
  ok('opção ligada', await page.evaluate(() => Voz.prefs.autoCap === true));
  await page.evaluate(() => { window.__falas = []; window.__caps = []; });
  await page.evaluate(() => abrirLeitura(19, 23, null, true));
  await page.waitForTimeout(1800);
  caps = await page.evaluate(() => window.__caps);
  console.log('     capítulos abertos:', JSON.stringify(caps));
  ok('encadeou para os próximos capítulos', caps.length >= 3);
  ok('sequência correta', caps[0] === '19:23' && caps[1] === '19:24' && caps[2] === '19:25');
  await page.evaluate(() => { Voz.parar(); $('chave-auto-cap').click(); });

  console.log('\n=== virada de livro ===');
  await page.evaluate(() => { $('chave-auto-cap').click(); window.__caps = []; });
  await page.evaluate(() => abrirLeitura(31, 1, null, true));  // Obadias tem 1 capítulo
  await page.waitForTimeout(900);
  caps = await page.evaluate(() => window.__caps);
  console.log('     capítulos abertos:', JSON.stringify(caps));
  ok('passou de Obadias para Jonas', caps[0] === '31:1' && caps[1] === '32:1');
  await page.evaluate(() => { Voz.parar(); $('chave-auto-cap').click(); });

  console.log('\n=== trocar de capítulo interrompe a leitura ===');
  await page.evaluate(() => { window.__falas = []; window.__dur = 5000; });
  await page.evaluate(() => abrirLeitura(19, 23, null, true));
  await page.waitForTimeout(500);
  ok('está tocando', await page.evaluate(() => Voz.tocando()));
  await page.evaluate(() => abrirLeitura(40, 5));
  await page.waitForTimeout(400);
  ok('parou ao abrir outro capítulo', await page.evaluate(() => Voz.tocando() === false));
  ok('barra sumiu', await page.locator('#barra-audio.ver').count() === 0);

  console.log('\n=== erros ===');
  ok('sem erros de JS', erros.length === 0);
  erros.forEach(e => console.log('   ' + e));
  await browser.close();
})();
