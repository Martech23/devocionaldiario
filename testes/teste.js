const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');

const MOCK = `
(() => {
  const vozes = [
    { name: 'Google português do Brasil', lang: 'pt-BR', voiceURI: 'g-pt-br', default: true },
    { name: 'Luciana', lang: 'pt-BR', voiceURI: 'luciana' },
    { name: 'Joana', lang: 'pt-PT', voiceURI: 'joana' }
  ];
  window.__falas = [];
  window.__dur = 500;
  class FakeUtt {
    constructor(t){ this.text = t; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null; }
  }
  const ss = {
    speaking: false, paused: false, pending: false,
    _atual: null, _t: null,
    getVoices: () => vozes,
    addEventListener(){}, removeEventListener(){},
    speak(u){
      window.__falas.push({ text: u.text, rate: u.rate, voz: u.voice && u.voice.name });
      ss.speaking = true; ss._atual = u;
      setTimeout(() => { if(ss._atual === u && u.onstart) u.onstart(); }, 5);
      ss._t = setTimeout(() => {
        if(ss._atual !== u) return;
        ss.speaking = false; ss._atual = null;
        if(u.onend) u.onend();
      }, window.__dur);
    },
    cancel(){
      clearTimeout(ss._t);
      ss._atual = null; ss.speaking = false; ss.paused = false;
    },
    pause(){ ss.paused = true; },
    resume(){ ss.paused = false; }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtt, configurable: true });
})();
`;

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 400, height: 780 } });

  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);

  console.log('\n=== estrutura ===');
  ok('barra de áudio existe', await page.locator('#barra-audio').count() === 1);
  ok('seção NÃO está mais na página inicial', await page.locator('#sec-voz').count() === 0);
  ok('painel de configuração existe', await page.locator('#painel-voz').count() === 1);
  ok('menu tem item de configuração', await page.locator('#btn-abrir-voz').count() === 1);
  ok('painel começa fechado', await page.locator('#painel-voz.aberto').count() === 0);
  ok('painel começa aria-hidden', await page.getAttribute('#painel-voz', 'aria-hidden') === 'true');

  console.log('\n=== abrir/fechar o painel pelo menu ===');
  await page.click('#btn-menu');
  await page.waitForTimeout(500);
  ok('gaveta abriu', await page.locator('.gaveta.aberta').count() === 1);
  await page.click('#btn-abrir-voz');
  await page.waitForTimeout(600);
  ok('painel abriu', await page.locator('#painel-voz.aberto').count() === 1);
  ok('aria-hidden virou false', await page.getAttribute('#painel-voz', 'aria-hidden') === 'false');
  ok('gaveta fechou por baixo', await page.locator('.gaveta.aberta').count() === 0);
  ok('véu continua visível', await page.locator('#veu.aberto').count() === 1);
  ok('controles vieram junto', await page.locator('#painel-voz #sel-voz').count() === 1
     && await page.locator('#painel-voz #opcoes-vel').count() === 1
     && await page.locator('#painel-voz .chave').count() === 3);
  await page.click('#btn-fechar-voz');
  await page.waitForTimeout(600);
  ok('painel fechou pelo botão voltar', await page.locator('#painel-voz.aberto').count() === 0);
  ok('véu sumiu', await page.locator('#veu.aberto').count() === 0);
  await page.click('#btn-menu');
  await page.waitForTimeout(400);
  await page.click('#btn-abrir-voz');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  ok('Escape fecha o painel', await page.locator('#painel-voz.aberto').count() === 0);
  await page.click('#btn-menu');
  await page.waitForTimeout(400);
  await page.click('#btn-abrir-voz');
  await page.waitForTimeout(500);
  await page.click('#veu', { position: { x: 380, y: 700 } });
  await page.waitForTimeout(600);
  ok('clique no véu fecha o painel', await page.locator('#painel-voz.aberto').count() === 0);
  const nVozes = await page.locator('#sel-voz option').count();
  ok('select de vozes preenchido (' + nVozes + ')', nVozes === 3);
  ok('botão Ouvir meu resumo', await page.locator('#linha-ouvir-stats .btn-ouvir').count() === 1);

  console.log('\n=== reprodução: exemplo ===');
  await page.click('#btn-menu');
  await page.waitForTimeout(400);
  await page.click('#btn-abrir-voz');
  await page.waitForTimeout(600);
  await page.click('#btn-testar-voz');
  await page.waitForTimeout(600);
  console.log('     título:', await page.locator('#audio-titulo').textContent());
  console.log('     sub:', await page.locator('#audio-sub').textContent());
  await page.waitForTimeout(900);
  let falas = await page.evaluate(() => window.__falas.map(f => f.text));
  console.log('     falas:', JSON.stringify(falas, null, 0));
  ok('leu a referência por extenso', falas.some(t => /Salmos, capítulo 119, versículo 105/.test(t)));
  ok('barra sumiu ao terminar', await page.locator('#barra-audio.ver').count() === 0);

  console.log('\n=== chunking de texto longo ===');
  const pedacos = await page.evaluate(() => {
    window.__falas = []; window.__dur = 30;
    const longo = 'Ele restaura a minha alma e me guia pelas veredas da justiça. '.repeat(12);
    Voz.falar([{ texto: longo, rotulo: 'Longo' }], { titulo: 'Teste' });
    return null;
  });
  await page.waitForTimeout(800);
  falas = await page.evaluate(() => window.__falas.map(f => f.text.length));
  ok('texto longo dividido em vários trechos (' + falas.length + ')', falas.length > 3);
  ok('nenhum trecho acima de 300 chars', falas.every(n => n <= 300));

  console.log('\n=== controles do player ===');
  await page.evaluate(() => {
    window.__falas = []; window.__dur = 4000;
    Voz.falar([
      { texto: 'Primeira parte do texto.', rotulo: 'Um' },
      { texto: 'Segunda parte do texto.', rotulo: 'Dois' },
      { texto: 'Terceira parte do texto.', rotulo: 'Três' }
    ], { titulo: 'Teste controles' });
  });
  await page.waitForTimeout(700);
  ok('barra visível durante a leitura', await page.locator('#barra-audio.ver').count() === 1);
  ok('body ganhou espaço', await page.locator('body.com-audio').count() === 1);
  console.log('     sub inicial:', await page.locator('#audio-sub').textContent());
  await page.click('#audio-prox');
  await page.waitForTimeout(200);
  console.log('     depois de avançar:', await page.locator('#audio-sub').textContent());
  ok('avançou de parte', /2 de 3|Dois/.test(await page.locator('#audio-sub').textContent()));
  await page.click('#audio-play');
  await page.waitForTimeout(150);
  /* o botão deixou de ser texto: os controles eram emoji (U+23F8 e
     companhia), que a fonte do sistema pintava com cor própria. Agora
     o estado está no <use> do SVG. Ver teste45.js. */
  const iconeDoPlay = () => page.evaluate(() =>
    document.querySelector('#audio-play use').getAttribute('href'));
  ok('pausou', (await iconeDoPlay()) === '#i-tocar');
  await page.click('#audio-play');
  await page.waitForTimeout(150);
  ok('retomou', (await iconeDoPlay()) === '#i-pausar');
  await page.click('#audio-parar');
  await page.waitForTimeout(700);
  ok('parou e escondeu a barra', await page.locator('#barra-audio.ver').count() === 0);

  console.log('\n=== velocidade ===');
  await page.click('#audio-vel').catch(() => {});
  await page.locator('#opcoes-vel button[data-vel="0.7"]').click();
  await page.waitForTimeout(50);
  ok('velocidade marcada', await page.locator('#opcoes-vel button[data-vel="0.7"].ativo').count() === 1);
  await page.evaluate(() => { window.__falas = []; window.__dur = 500; Voz.falar([{ texto: 'Teste de velocidade.' }], {}); });
  await page.waitForTimeout(120);
  const rate = await page.evaluate(() => window.__falas[0] && window.__falas[0].rate);
  ok('rate aplicado ao utterance (' + rate + ')', rate === 0.7);
  const persist = await page.evaluate(() => JSON.parse(localStorage.getItem('lampada-voz-prefs') || '{}'));
  ok('preferência salva', persist.vel === 0.7);
  await page.evaluate(() => Voz.parar());
  await page.locator('#opcoes-vel button[data-vel="1"]').click();

  console.log('\n=== modo áudio ===');
  await page.click('#chave-modo-audio');
  await page.waitForTimeout(400);
  ok('atributo data-audio ligado', await page.getAttribute('html', 'data-audio') === '1');
  ok('aria-checked correto', await page.getAttribute('#chave-modo-audio', 'aria-checked') === 'true');
  const larg = await page.evaluate(() => {
    const b = document.querySelector('#btn-testar-voz');
    return b.getBoundingClientRect().height;
  });
  ok('botão Ouvir cresceu no modo áudio (' + Math.round(larg) + 'px)', larg >= 50);

  await page.click('#btn-fechar-voz');       // painel cobre a tela: fecha antes de mexer no conteúdo
  await page.waitForTimeout(600);
  ok('painel fechado libera a página', await page.locator('#painel-voz.aberto').count() === 0);

  console.log('\n=== favoritos e busca ===');
  await page.evaluate(() => {
    localStorage.setItem('lampada-favoritos', JSON.stringify([{
      chave: '43:3:16', nr: 43, cap: 3, verso: 16,
      texto: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.',
      versao: 'Almeida', ref: 'João 3:16', data: new Date().toISOString(), nota: 'Minha nota.'
    }]));
    renderFavoritos();
  });
  await page.waitForTimeout(150);
  /* favoritos e diário moram na aba Meu desde a reforma da navegação */
  await page.evaluate(() => irParaAba('meu', { semRolar: true }));
  await page.waitForTimeout(250);
  ok('favorito tem botão de ouvir', await page.locator('#area-favoritos .item-fav .ouvir-mini').count() === 1);
  ok('botão Ouvir todos os favoritos', await page.locator('#area-favoritos .linha-ouvir .btn-ouvir').count() === 1);
  await page.evaluate(() => { window.__falas = []; });
  await page.evaluate(() => { window.__dur = 120; });
  await page.locator('#area-favoritos .item-fav .ouvir-mini').click();
  await page.waitForTimeout(500);
  falas = await page.evaluate(() => window.__falas.map(f => f.text));
  console.log('     falas favorito:', JSON.stringify(falas));
  ok('leu referência falada do favorito', falas.some(t => /João, capítulo 3, versículo 16/.test(t)));
  ok('leu o texto do versículo', falas.some(t => /Porque Deus amou o mundo/.test(t)));
  await page.evaluate(() => Voz.parar());

  console.log('\n=== capítulo completo ===');
  await page.evaluate(() => {
    window.__falas = []; window.__dur = 60;
    window.buscarCapitulo = async () => ({ itens: [
      { tipo: 'titulo', texto: 'O bom pastor' },
      { numero: 1, texto: 'O Senhor é o meu pastor, nada me faltará.' },
      { numero: 2, texto: 'Deitar-me faz em verdes pastos.' },
      { numero: 3, texto: 'Refrigera a minha alma.' }
    ] });
  });
  await page.evaluate(() => abrirLeitura(19, 23));
  await page.waitForTimeout(400);
  ok('capítulo tem botão Ouvir o capítulo',
     await page.locator('#area-leitura .linha-ouvir .btn-ouvir').count() === 1);
  await page.locator('#area-leitura .linha-ouvir .btn-ouvir').click();
  await page.waitForTimeout(150);
  ok('destaca o trecho sendo lido', await page.locator('#area-leitura .lendo-agora').count() === 1);
  await page.waitForTimeout(500);
  falas = await page.evaluate(() => window.__falas.map(f => f.text));
  console.log('     falas capítulo:', JSON.stringify(falas));
  ok('anunciou o capítulo', falas.some(t => /Salmos, capítulo 23/.test(t)));
  ok('leu o título de seção', falas.some(t => /O bom pastor/.test(t)));
  ok('leu os 3 versículos',
     ['nada me faltará', 'verdes pastos', 'Refrigera'].every(x => falas.some(t => t.includes(x))));
  ok('não anunciou número (opção desligada)', !falas.some(t => /^Versículo 1\./.test(t)));
  ok('limpou o destaque ao terminar', await page.locator('#area-leitura .lendo-agora').count() === 0);

  console.log('\n=== anunciar número do versículo ===');
  await page.locator('.gaveta a[href="#sec-voz"]').count();
  await page.evaluate(() => $('chave-num-versiculo').click());
  await page.evaluate(() => { window.__falas = []; abrirLeitura(19, 23); });
  await page.waitForTimeout(400);
  await page.locator('#area-leitura .linha-ouvir .btn-ouvir').click();
  await page.waitForTimeout(600);
  falas = await page.evaluate(() => window.__falas.map(f => f.text));
  ok('anuncia "Versículo 2" quando ligado', falas.some(t => /Versículo 2\. Deitar/.test(t)));
  await page.evaluate(() => { Voz.parar(); $('chave-num-versiculo').click(); });

  console.log('\n=== busca por palavra ===');
  await page.evaluate(() => {
    $('sec-busca').classList.remove('oculto');
    const lista = $('lista-busca');
    lista.innerHTML = '';
    window.__falas = []; window.__dur = 120;
    const el = document.createElement('div');
    el.className = 'item-busca';
    el.innerHTML = '<div class="busca-corpo"><div class="ref-busca">João 3:16</div><div class="txt-busca">Porque Deus amou o mundo</div></div>';
    el.prepend(criarOuvirMini('Ouvir João 3:16', () => [
      { texto: refFalada(43, 3, 16), rotulo: 'Referência' },
      { texto: 'Porque Deus amou o mundo de tal maneira.', rotulo: 'Versículo', el }
    ], { voz: { titulo: 'João 3:16' } }));
    lista.appendChild(el);
  });
  await page.locator('#lista-busca .ouvir-mini').click();
  await page.waitForTimeout(400);
  falas = await page.evaluate(() => window.__falas.map(f => f.text));
  ok('resultado de busca é lido', falas.some(t => /João, capítulo 3, versículo 16/.test(t)));
  await page.evaluate(() => Voz.parar());

  console.log('\n=== nomes de livros numerados ===');
  const refs = await page.evaluate(() => [
    refFalada(62, 5, 14), refFalada(46, 13, 4), refFalada(9, 3, 1), refFalada(43, 3, 16)
  ]);
  console.log('     ', JSON.stringify(refs));
  ok('1 João vira "Primeira de João"', /Primeira de João/.test(refs[0]));
  ok('1 Coríntios vira "Primeira aos Coríntios"', /Primeira aos Coríntios/.test(refs[1]));
  ok('1 Samuel vira "Primeiro Samuel"', /Primeiro Samuel/.test(refs[2]));

  console.log('\n=== erros de JS ===');
  const relevantes = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  if (relevantes.length) relevantes.forEach(e => console.log('  ' + e));
  ok('sem erros de JS', relevantes.length === 0);

  await browser.close();
})();
