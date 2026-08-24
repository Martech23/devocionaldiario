const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  await page.addInitScript(MOCK);
  /* esta suíte cobre o formato "ver tudo de uma vez"; o percurso guiado,
     que hoje é o padrão, tem suíte própria (teste10.js) */
  await page.addInitScript(() => localStorage.setItem('lampada-devo-modo', 'tudo'));
  await page.goto(BASE + '/index.html');
  await page.waitForTimeout(800);
  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);

  console.log('\n=== devocional do dia ===');
  await page.evaluate(() => {
    window.__falas = []; window.__dur = 60;
    window.buscarVerso = async () => ({
      texto: 'Porque para Deus nada é impossível.',
      versao: 'Almeida Atualizada'
    });
  });
  await page.evaluate(() => versiculoDoDia());
  await page.waitForTimeout(500);
  const rotulo = await page.locator('#cartao-hoje .btn-ouvir').textContent();
  console.log('     rótulo:', JSON.stringify(rotulo));
  ok('botão do devocional presente', /Ouvir devocional completo/.test(rotulo));
  ok('tem os 3 blocos do devocional', await page.locator('#cartao-hoje .bloco-devo').count() === 3);

  await page.locator('#cartao-hoje .btn-ouvir').click();
  await page.waitForTimeout(900);
  const falas = await page.evaluate(() => window.__falas.map(f => f.text));
  console.log('     partes lidas:', falas.length);
  falas.forEach(f => console.log('       ·', f.slice(0, 70)));
  ok('leu referência', falas.some(t => /capítulo/.test(t)));
  ok('leu o versículo', falas.some(t => /nada é impossível/.test(t)));
  ok('leu a Reflexão', falas.some(t => /^Reflexão\./.test(t)));
  ok('leu Para meditar', falas.some(t => /^Para meditar\./.test(t)));
  ok('leu a Oração', falas.some(t => /^Oração\./.test(t)));

  console.log('\n=== toque longo no modo áudio ===');
  await page.evaluate(() => { Voz.parar(); Voz.prefs.modo = true; window.__falas = []; });
  const btn = await page.locator('#cartao-hoje .btn-ouvir');
  await page.evaluate(() => {
    const b = document.querySelector('#cartao-hoje .btn-ouvir');
    window.scrollTo({ top: window.scrollY + b.getBoundingClientRect().top - 300, behavior: 'auto' });
  });
  await page.waitForTimeout(400);
  const box = await btn.boundingBox();
  console.log('     box:', JSON.stringify(box));
  console.log('     elemento sob o ponto:', await page.evaluate(([x,y]) => {
    const e = document.elementFromPoint(x, y);
    return e ? (e.tagName + '.' + e.className) : null;
  }, [box.x + box.width/2, box.y + box.height/2]));
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const anuncio = await page.evaluate(() => window.__falas.map(f => f.text));
  console.log('     anunciou:', JSON.stringify(anuncio));
  ok('toque longo diz o nome do botão', anuncio.some(t => /Ouvir devocional completo/.test(t)));
  ok('rótulo falado sem o símbolo ▶', anuncio.every(t => !/▶/.test(t)));
  ok('toque longo não disparou a leitura', anuncio.length === 1);

  console.log('\n=== toque curto ainda funciona ===');
  await page.evaluate(() => { Voz.parar(); window.__falas = []; window.__dur = 3000; });
  await btn.click();
  await page.waitForTimeout(300);
  ok('clique normal inicia a leitura',
     (await page.evaluate(() => window.__falas.length)) >= 1);
  ok('barra apareceu', await page.locator('#barra-audio.ver').count() === 1);

  await page.screenshot({ path: 'devocional.png' });
  await page.evaluate(() => { document.documentElement.setAttribute('data-audio','1'); Voz.parar(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'modo-audio.png' });
  await page.evaluate(() => { aplicarTema('escuro'); Voz.parar(); abrirPainelVoz(true); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'sec-voz-escuro.png' });

  console.log('\n=== erros ===');
  ok('sem erros de JS', erros.length === 0);
  erros.forEach(e => console.log('   ' + e));
  await browser.close();
})();
