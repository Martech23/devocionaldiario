const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Tipografia e respiro */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.addInitScript(() => localStorage.setItem('lampada-devo-modo', 'tudo'));
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.buscarVerso = async () => ({ texto: 'Porque para Deus nada é impossível.', versao: 'Almeida' });
  });
  await p.evaluate(() => versiculoDoDia());
  await p.waitForTimeout(600);

  const css = (sel, prop) => p.evaluate(([s, k]) => {
    const e = document.querySelector(s);
    return e ? getComputedStyle(e)[k] : null;
  }, [sel, prop]);
  const num = async (sel, prop) => parseFloat(await css(sel, prop));
  const ehSerif = async sel => /Source Serif|Georgia|Lora|Merriweather|Playfair/i.test(await css(sel, 'fontFamily') || '');
  const ehSans = async sel => /Source Sans|system-ui|-apple-system|Inter/i.test(await css(sel, 'fontFamily') || '');

  console.log('\n=== as três famílias saem de variável ===');
  /* trocar de família tem de ser uma linha, não dezesseis */
  const vars = await p.evaluate(() => {
    const r = getComputedStyle(document.documentElement);
    return { interface: r.getPropertyValue('--fonte-interface').trim(),
             leitura: r.getPropertyValue('--fonte-leitura').trim(),
             titulo: r.getPropertyValue('--fonte-titulo').trim() };
  });
  ok('--fonte-interface definida', vars.interface.length > 5, vars.interface.slice(0, 28));
  ok('--fonte-leitura definida', vars.leitura.length > 5, vars.leitura.slice(0, 28));
  ok('--fonte-titulo definida', vars.titulo.length > 5, vars.titulo.slice(0, 28));
  /* @font-face precisa nomear a família — é ela que a declara; o que
     não pode é uma regra comum repetir a pilha e sair de sincronia */
  const usos = await p.evaluate(() =>
    [...document.styleSheets[0].cssRules]
      .filter(r => r.type === CSSRule.STYLE_RULE && r.style &&
        /Source (Serif 4|Sans 3)/.test(r.style.fontFamily || ''))
      .map(r => r.selectorText));
  ok('nenhuma regra escreve a família na mão', usos.length === 0, usos.slice(0, 3).join(', ') || 'zero');

  console.log('\n=== corpo confortável de ler ===');
  const base = await num('body', 'fontSize');
  const lh = await num('body', 'lineHeight');
  ok('corpo entre 16 e 18px', base >= 16 && base <= 18, base + 'px');
  ok('entrelinha entre 1,6 e 1,7', lh / base >= 1.6 && lh / base <= 1.7, (lh / base).toFixed(2));
  ok('o corpo é sans', await ehSans('body'));

  console.log('\n=== o que se lê de verdade ===');
  const dfs = await num('.bloco-devo p', 'fontSize');
  const dlh = await num('.bloco-devo p', 'lineHeight');
  ok('o devocional é serif', await ehSerif('.bloco-devo p'));
  ok('não é menor que a interface', dfs >= base, dfs + 'px contra ' + base + 'px de interface');
  ok('e respira mais que ela', dlh / dfs >= 1.65, (dlh / dfs).toFixed(2));
  ok('o versículo é serif e o maior de todos',
     await ehSerif('.versiculo') && (await num('.versiculo', 'fontSize')) > dfs,
     (await num('.versiculo', 'fontSize')) + 'px');

  console.log('\n=== títulos em serif, chrome em sans ===');
  ok('a saudação é serif', await ehSerif('.saudacao'));
  ok('e é maior que o corpo', (await num('.saudacao', 'fontSize')) >= 24,
     (await num('.saudacao', 'fontSize')) + 'px');
  /* o h2 deste app é rótulo de 12px maiúsculo: é chrome, não título —
     serif ali seria enfeite em cima de etiqueta */
  ok('o rótulo de seção continua sans', await ehSans('.rotulo-secao'));
  ok('e continua pequeno e maiúsculo',
     (await num('.rotulo-secao', 'fontSize')) <= 13 &&
     (await css('.rotulo-secao', 'textTransform')) === 'uppercase');
  ok('os botões continuam sans', await ehSans('.btn-ouvir'));

  await p.evaluate(() => irParaAba('planos', { semRolar: true }));
  await p.waitForTimeout(400);
  ok('o título do plano é serif', await ehSerif('.card-plano h3'),
     (await css('.card-plano h3', 'fontFamily') || '').slice(0, 24));

  console.log('\n=== respiro ===');
  const env = await p.evaluate(() => {
    const e = document.querySelector('.envolve');
    const c = getComputedStyle(e);
    return { esq: parseFloat(c.paddingLeft), dir: parseFloat(c.paddingRight) };
  });
  ok('margem lateral de pelo menos 20px', env.esq >= 20 && env.dir >= 20, env.esq + 'px');
  const cart = await p.evaluate(() => {
    const c = getComputedStyle(document.querySelector('.cartao'));
    return { t: parseFloat(c.paddingTop), l: parseFloat(c.paddingLeft) };
  });
  ok('o cartão respira por dentro', cart.l >= 24 && cart.t >= 26, cart.t + '/' + cart.l);
  ok('as seções se separam', (await num('.secao', 'marginTop')) >= 32,
     (await num('.secao', 'marginTop')) + 'px');

  console.log('\n=== a linha não fica longa demais no tablet ===');
  const p3 = await b.newPage({ viewport: { width: 900, height: 900 } });
  p3.on('pageerror', e => erros.push(e.message));
  await p3.addInitScript(MOCK);
  await p3.goto(BASE + '/index.html');
  await p3.waitForTimeout(800);
  const largo = await p3.evaluate(() => {
    const e = document.querySelector('.envolve');
    return { w: e.getBoundingClientRect().width, pad: parseFloat(getComputedStyle(e).paddingLeft) };
  });
  ok('o conteúdo tem teto de largura', largo.w <= 880, Math.round(largo.w) + 'px');
  ok('e a margem abre em tela grande', largo.pad >= 28, largo.pad + 'px');

  console.log('\n=== nada vaza para os lados ===');
  for(const w of [320, 360, 390]){
    const pg = await b.newPage({ viewport: { width: w, height: 800 } });
    pg.on('pageerror', e => erros.push(e.message));
    await pg.addInitScript(MOCK);
    await pg.goto(BASE + '/index.html');
    await pg.waitForTimeout(700);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    ok('a ' + w + 'px', sw <= w, sw);
    await pg.close();
  }

  console.log('\n=== o canvas não usa variável de CSS ===');
  /* ctx.font rejeita var(--…) em silêncio e mede na fonte errada: o
     versículo longo deixaria de encolher e estouraria a imagem */
  const fonteCanvas = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '500 67px ' + FONTE_CANVAS;
    return { aceita: /67px/.test(c.font), valor: c.font };
  });
  ok('a pilha do canvas é aceita pelo navegador', fonteCanvas.aceita, fonteCanvas.valor);
  ok('e não contém var(', !/var\(/.test(await p.evaluate(() => FONTE_CANVAS)));

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource|Failed to fetch/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
