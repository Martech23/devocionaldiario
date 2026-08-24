const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
const STUB = fs.readFileSync('teste4.js', 'utf8').match(/const STUB = `([\s\S]*?)`;/)[1];

/* SpeechRecognition falso: devolve o que estiver em window.__ditar */
const MIC = `
(() => {
  window.__ditar = 'texto ditado';
  window.__micStarts = 0;
  class FakeRec {
    constructor(){ this.lang = ''; this.interimResults = false; this.continuous = false; }
    start(){
      window.__micStarts++;
      setTimeout(() => {
        if (window.__micErro) {
          if (this.onerror) this.onerror({ error: window.__micErro });
        } else if (this.onresult) {
          this.onresult({ results: [[{ transcript: window.__ditar }]] });
        }
        if (this.onend) this.onend();
      }, 30);
    }
    stop(){ if (this.onend) this.onend(); }
  }
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRec, configurable: true });
})();
`;

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);
  const erros = [];

  // ================= com suporte a ditado =================
  const page = await browser.newPage({ viewport: { width: 400, height: 820 } });
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await page.addInitScript(MOCK);
  await page.addInitScript(STUB);
  await page.addInitScript(MIC);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  console.log('\n=== suporte detectado ===');
  ok('Ditado.suporta é true', await page.evaluate(() => Ditado.suporta === true));
  ok('html marcado com data-ditado="1"',
     await page.getAttribute('html', 'data-ditado') === '1');

  console.log('\n=== ditado no Diário ===');
  /* favoritos e diário moram na aba Meu desde a reforma da navegação */
  await page.evaluate(() => irParaAba('meu', { semRolar: true }));
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    localStorage.setItem('lampada-notas', JSON.stringify({
      '19:23:1': { texto: 'Nota inicial.', ref: 'Salmos 23:1', data: new Date().toISOString(),
                   nr: 19, cap: 23, verso: 1, versiculo: 'Um versículo qualquer.' }
    }));
    tabFavAtual = 'diario';
    renderFavoritos();
  });
  await page.waitForTimeout(300);
  ok('nota do Diário tem microfone',
     await page.locator('#area-favoritos .item-fav .btn-mic').count() === 1);
  ok('microfone está visível', await page.locator('#area-favoritos .btn-mic').isVisible());
  ok('tem a dica de uso',
     /ditar em vez de escrever/.test(await page.locator('#area-favoritos .dica-ditar').textContent()));

  await page.evaluate(() => { window.__ditar = 'Deus foi fiel comigo.'; });
  await page.locator('#area-favoritos .btn-mic').click();
  await page.waitForTimeout(300);
  const valor = await page.inputValue('#area-favoritos .campo-nota');
  console.log('     campo agora:', JSON.stringify(valor));
  ok('ditado foi anexado ao texto existente', valor === 'Nota inicial. Deus foi fiel comigo.');
  ok('gravou sem precisar sair do campo', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-notas'))['19:23:1'].texto === 'Nota inicial. Deus foi fiel comigo.'));

  await page.evaluate(() => { window.__ditar = 'E de novo.'; });
  await page.locator('#area-favoritos .btn-mic').click();
  await page.waitForTimeout(300);
  ok('ditar duas vezes acumula', (await page.inputValue('#area-favoritos .campo-nota'))
     === 'Nota inicial. Deus foi fiel comigo. E de novo.');

  console.log('\n=== ditado começando de um campo vazio ===');
  await page.evaluate(() => {
    localStorage.setItem('lampada-notas', JSON.stringify({
      '43:3:16': { texto: '', ref: 'João 3:16', data: new Date().toISOString(),
                   nr: 43, cap: 3, verso: 16, versiculo: 'Texto.' }
    }));
    renderFavoritos();
    window.__ditar = 'Primeira frase ditada.';
  });
  await page.waitForTimeout(300);
  await page.locator('#area-favoritos .btn-mic').first().click();
  await page.waitForTimeout(300);
  ok('não deixa espaço sobrando no começo',
     (await page.inputValue('#area-favoritos .campo-nota')) === 'Primeira frase ditada.');

  console.log('\n=== os outros microfones seguem funcionando ===');
  /* o campo de oração está na aba Hoje */
  await page.evaluate(() => irParaAba('hoje', { semRolar: true }));
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__ditar = 'Pela minha família.'; });
  await page.click('#btn-oracao-voz');
  await page.waitForTimeout(300);
  ok('ditado na oração', (await page.inputValue('#campo-oracao')) === 'Pela minha família.');

  /* a busca mudou para junto da Bíblia, com o seletor de versão */
  await page.evaluate(() => irParaAba('biblia', { semRolar: true }));
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__ditar = 'joão três dezesseis'; });
  await page.click('#btn-busca-voz');
  await page.waitForTimeout(400);
  ok('ditado na busca vira referência', (await page.inputValue('#busca')) === 'joao 3:16');

  await page.evaluate(() => abrirLeitura(19, 23));
  await page.waitForTimeout(400);
  await page.locator('#area-leitura .v').nth(0).click();
  await page.waitForTimeout(450);
  await page.click('#fa-nota');
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__ditar = 'Nota ditada na folha.'; });
  await page.click('#btn-nota-voz');
  await page.waitForTimeout(300);
  ok('ditado na nota do versículo',
     (await page.inputValue('#campo-nota-verso')) === 'Nota ditada na folha.');
  await page.evaluate(() => fecharFolha());

  console.log('\n=== erro de permissão do microfone ===');
  await page.evaluate(() => irParaAba('meu', { semRolar: true }));
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__micErro = 'not-allowed'; tabFavAtual = 'diario'; renderFavoritos(); });
  await page.waitForTimeout(300);
  await page.locator('#area-favoritos .btn-mic').first().click();
  await page.waitForTimeout(300);
  /* A mensagem deixou de ser "Permita o microfone" para todo mundo:
     mandar liberar não ajuda quem já liberou, e era o caso em produção,
     onde quem barrava era a Permissions-Policy do próprio site. Agora a
     recusa é diagnosticada antes de falar. */
  ok('explica que o microfone foi bloqueado',
     /bloqueado/.test(await page.locator('#aviso').textContent()),
     await page.locator('#aviso').textContent());
  ok('botão não fica preso no estado ouvindo',
     await page.locator('#area-favoritos .btn-mic.ouvindo').count() === 0);
  await page.evaluate(() => { window.__micErro = null; });

  const relevantes = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  await page.close();

  // ================= sem suporte a ditado =================
  console.log('\n=== navegador sem SpeechRecognition ===');
  const p2 = await browser.newPage({ viewport: { width: 400, height: 820 } });
  p2.on('pageerror', e => erros.push('pageerror(sem suporte): ' + e.message));
  // o Chromium expõe webkitSpeechRecognition mesmo headless: tiramos os dois
  await p2.addInitScript(`
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  `);
  await p2.addInitScript(MOCK);
  await p2.addInitScript(STUB);
  await p2.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p2.waitForTimeout(900);
  ok('Ditado.suporta é false', await p2.evaluate(() => Ditado.suporta === false));
  ok('html marcado com data-ditado="0"', await p2.getAttribute('html', 'data-ditado') === '0');
  ok('microfone da busca fica escondido', !(await p2.locator('#btn-busca-voz').isVisible()));
  ok('microfone da oração fica escondido', !(await p2.locator('#btn-oracao-voz').isVisible()));
  await p2.evaluate(() => {
    localStorage.setItem('lampada-notas', JSON.stringify({
      '19:23:1': { texto: 'x', ref: 'Salmos 23:1', data: new Date().toISOString(), nr: 19, cap: 23, verso: 1 }
    }));
    tabFavAtual = 'diario';
    renderFavoritos();
  });
  await p2.waitForTimeout(300);
  /* sem isto a aba inteira ficaria oculta e o !isVisible() abaixo passaria
     de graça, sem provar nada sobre a linha de ditado */
  await p2.evaluate(() => irParaAba('meu', { semRolar: true }));
  await p2.waitForTimeout(250);
  ok('linha de ditado do Diário fica escondida',
     !(await p2.locator('#area-favoritos .linha-ditar').isVisible()));
  ok('a nota continua editável por escrito',
     await p2.locator('#area-favoritos .campo-nota').isVisible());
  await p2.close();

  console.log('\n=== erros de JS ===');
  relevantes.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', relevantes.length === 0);

  await browser.close();
})();
