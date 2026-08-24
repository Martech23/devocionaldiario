const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Microfone flutuando dentro do campo de pedido de oração */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const LONGO = 'Senhor, peço pela saúde da minha mãe, pelo emprego do meu irmão ' +
  'e por paz na nossa casa neste tempo difícil que estamos atravessando juntos.';

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);
  await p.evaluate(() => $('sec-oracoes').scrollIntoView());
  await p.waitForTimeout(200);

  const pos = () => p.evaluate(() => {
    const ta = $('campo-oracao'), bt = $('btn-oracao-voz');
    const caixa = document.querySelector('.form-oracao');
    const r = e => { const b = e.getBoundingClientRect();
      return { e: b.left, d: b.right, c: b.top, b: b.bottom, w: b.width, h: b.height }; };
    return { caixaPos: getComputedStyle(caixa).position,
             btPos: getComputedStyle(bt).position,
             padB: parseFloat(getComputedStyle(ta).paddingBottom),
             resize: getComputedStyle(ta).resize,
             ta: r(ta), bt: r(bt) };
  });

  console.log('\n=== o botão flutua dentro do campo ===');
  let m = await pos();
  ok('o container ancora o posicionamento', m.caixaPos === 'relative', m.caixaPos);
  ok('o botão é absoluto', m.btPos === 'absolute', m.btPos);
  ok('e cabe inteiro dentro do campo',
     m.bt.e >= m.ta.e && m.bt.d <= m.ta.d + 0.5 && m.bt.c >= m.ta.c && m.bt.b <= m.ta.b + 0.5);

  console.log('\n=== encostado no canto de baixo, à direita ===');
  ok('encostado à direita', Math.round(m.ta.d - m.bt.d) <= 10, Math.round(m.ta.d - m.bt.d) + 'px da borda');
  ok('encostado embaixo', Math.round(m.ta.b - m.bt.b) <= 10, Math.round(m.ta.b - m.bt.b) + 'px da borda');
  ok('mais para a direita do que para a esquerda', (m.bt.e - m.ta.e) > (m.ta.d - m.bt.d));
  ok('mais para baixo do que para cima', (m.bt.c - m.ta.c) > (m.ta.b - m.bt.b));

  console.log('\n=== o texto não passa por baixo do ícone ===');
  ok('o fundo reservado cobre o botão inteiro',
     m.padB >= m.bt.h + (m.ta.b - m.bt.b), m.padB + 'px para um botão de ' + m.bt.h + 'px');
  const passa = await p.evaluate(async t => {
    const ta = $('campo-oracao'), bt = $('btn-oracao-voz');
    ta.value = t; ta.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 150));
    /* a última linha do texto vai até o fim da área de conteúdo, que é
       a altura menos o padding de baixo e as bordas */
    const cs = getComputedStyle(ta);
    const fimDoTexto = ta.getBoundingClientRect().bottom
      - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth);
    return { fimDoTexto, topoDoBotao: bt.getBoundingClientRect().top,
             cortado: ta.scrollHeight > ta.clientHeight + 1,
             altura: Math.round(ta.getBoundingClientRect().height) };
  }, LONGO);
  ok('o texto termina acima do botão', passa.fimDoTexto <= passa.topoDoBotao,
     Math.round(passa.topoDoBotao - passa.fimDoTexto) + 'px de folga');

  console.log('\n=== o campo cresce em vez de cortar ===');
  /* a alça de redimensionar nascia no canto onde o botão agora fica,
     então ela saiu — e sem crescer sozinho o pedido longo sumiria */
  ok('sem alça de redimensionar', m.resize === 'none', m.resize);
  ok('nada do texto longo fica escondido', !passa.cortado, 'altura ' + passa.altura + 'px');
  ok('e o campo cresceu mesmo', passa.altura > m.ta.h, m.ta.h + ' → ' + passa.altura);

  console.log('\n=== apagar o texto encolhe de volta ===');
  const voltou = await p.evaluate(async () => {
    const ta = $('campo-oracao');
    ta.value = ''; ta.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 150));
    return Math.round(ta.getBoundingClientRect().height);
  });
  ok('volta ao tamanho de partida', Math.abs(voltou - m.ta.h) <= 2, voltou + 'px');

  console.log('\n=== adicionar um pedido também encolhe ===');
  /* mexer no value por código não dispara `input`: sem chamar o ajuste
     à mão o campo ficaria alto e vazio depois de um pedido longo */
  const depois = await p.evaluate(async t => {
    const ta = $('campo-oracao');
    ta.value = t; ta.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 120));
    $('btn-add-oracao').click();
    await new Promise(r => setTimeout(r, 250));
    return { altura: Math.round(ta.getBoundingClientRect().height), valor: ta.value,
             itens: document.querySelectorAll('#lista-oracoes .item-oracao').length };
  }, LONGO);
  ok('o pedido entrou na lista', depois.itens >= 1, depois.itens);
  ok('o campo esvaziou', depois.valor === '');
  ok('e voltou ao tamanho de partida', Math.abs(depois.altura - m.ta.h) <= 2, depois.altura + 'px');

  console.log('\n=== o alvo de toque continua de 44px ===');
  ok('44x44', Math.round(m.bt.w) === 44 && Math.round(m.bt.h) === 44,
     Math.round(m.bt.w) + 'x' + Math.round(m.bt.h));

  console.log('\n=== o campo ganhou a largura que era do botão ===');
  const larg = await p.evaluate(() => {
    const ta = $('campo-oracao'), caixa = document.querySelector('.form-oracao');
    return { ta: ta.getBoundingClientRect().width, caixa: caixa.getBoundingClientRect().width };
  });
  ok('o campo ocupa a largura toda do container',
     Math.abs(larg.ta - larg.caixa) < 1, Math.round(larg.ta) + ' de ' + Math.round(larg.caixa));

  console.log('\n=== os outros microfones não foram afetados ===');
  /* .btn-mic serve também à busca por voz e à nota do versículo, que
     continuam em linha; o posicionamento tinha de ficar escopado */
  const outros = await p.evaluate(() => ({
    busca: getComputedStyle($('btn-busca-voz')).position,
    nota: getComputedStyle($('btn-nota-voz')).position
  }));
  ok('o da busca continua no fluxo', outros.busca === 'static', outros.busca);
  ok('o da nota do versículo também', outros.nota === 'static', outros.nota);

  console.log('\n=== sem ditado no navegador não sobra buraco ===');
  const semDitado = await p.evaluate(() => {
    document.documentElement.dataset.ditado = '0';
    const ta = $('campo-oracao');
    return { botao: getComputedStyle($('btn-oracao-voz')).display,
             padB: parseFloat(getComputedStyle(ta).paddingBottom) };
  });
  ok('o botão some', semDitado.botao === 'none');
  ok('e o fundo reservado some junto', semDitado.padB < 20, semDitado.padB + 'px');

  console.log('\n=== 320px, a tela mais estreita ===');
  const p2 = await b.newPage({ viewport: { width: 320, height: 900 } });
  p2.on('pageerror', e => erros.push(e.message));
  await p2.addInitScript(MOCK);
  await p2.goto(BASE + '/index.html');
  await p2.waitForTimeout(900);
  const estreito = await p2.evaluate(() => {
    const ta = $('campo-oracao'), bt = $('btn-oracao-voz');
    const a = ta.getBoundingClientRect(), c = bt.getBoundingClientRect();
    return { dentro: c.right <= a.right + 0.5 && c.bottom <= a.bottom + 0.5,
             larguraCampo: Math.round(a.width),
             vazando: document.documentElement.scrollWidth > 320 };
  });
  ok('o botão continua dentro do campo', estreito.dentro);
  ok('e nada vaza para os lados', !estreito.vazando);
  ok('o campo tem largura de sobra', estreito.larguraCampo > 200, estreito.larguraCampo + 'px');

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
