const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* As chaves do painel de voz: geometria, estado e contraste */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (tema = 'claro') => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(() => abrirPainelVoz(true));
    await p.waitForTimeout(500);
    return p;
  };

  console.log('\n=== a pista voltou ao tamanho de pista ===');
  /* Era este o defeito: a chave foi desenhada 54x32, e uma regra
     genérica de alvo de toque pôs min-height:44px em tudo que se toca.
     A pista esticou para 44px de altura enquanto o botão branco
     continuava preso em top:3px com 26px — sobravam 12px de pista
     vazia embaixo, e a chave virava um borrão torto. */
  let p = await abrir();
  const g = await p.evaluate(() => {
    const c = document.querySelector('.chave');
    const r = c.getBoundingClientRect();
    const pista = getComputedStyle(c, '::before');
    const botao = getComputedStyle(c, '::after');
    return {
      alvo: { l: Math.round(r.width), a: Math.round(r.height) },
      pista: { l: parseFloat(pista.width), a: parseFloat(pista.height) },
      botao: { l: parseFloat(botao.width), a: parseFloat(botao.height) },
      fundoDoBotao: getComputedStyle(c).backgroundColor
    };
  });
  ok('o alvo de toque continua com 44px', g.alvo.a >= 44, g.alvo.l + '×' + g.alvo.a);
  ok('mas a pista voltou aos 32px', g.pista.a === 32, g.pista.l + '×' + g.pista.a);
  ok('e a pista não é mais o próprio botão',
     g.fundoDoBotao === 'rgba(0, 0, 0, 0)', g.fundoDoBotao);
  ok('o botão continua com 26px', g.botao.a === 26, g.botao.l + '×' + g.botao.a);
  /* a sobra que produzia o borrão: (44 - 26) / 2 = 9 de cada lado */
  ok('não sobra pista vazia embaixo do botão',
     Math.abs((g.pista.a - g.botao.a) / 2 - 3) < 0.5,
     'folga de ' + ((g.pista.a - g.botao.a) / 2) + 'px de cada lado');

  console.log('\n=== o botão fica centrado, e continua centrado ===');
  const centro = await p.evaluate(() => {
    const c = document.querySelector('.chave');
    const medir = () => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c, '::after');
      /* top:50% chega aqui já resolvido em pixels pelo navegador */
      const meio = parseFloat(cs.top) + parseFloat(cs.marginTop) + parseFloat(cs.height) / 2;
      return { meioDoBotao: meio, meioDaChave: r.height / 2 };
    };
    const antes = medir();
    /* estica a chave: com `top` fixo em pixels, o botão sairia do centro */
    c.style.height = '60px';
    const depois = medir();
    c.style.height = '';
    return { antes, depois };
  });
  ok('o botão está no meio da chave',
     Math.abs(centro.antes.meioDoBotao - centro.antes.meioDaChave) < 1,
     centro.antes.meioDoBotao + ' vs ' + centro.antes.meioDaChave);
  /* a centragem é por porcentagem, então nenhuma mudança de altura
     futura pode desalinhar o botão de novo — que foi como este defeito
     nasceu, quando uma regra genérica pôs min-height:44px em tudo */
  ok('e continua no meio se a altura mudar',
     Math.abs(centro.depois.meioDoBotao - centro.depois.meioDaChave) < 1,
     centro.depois.meioDoBotao + ' vs ' + centro.depois.meioDaChave);
  const fonteCss = fs.readFileSync(RAIZ + '/estilo.css', 'utf8');
  ok('e a folha de estilo centra por porcentagem, não por pixel fixo',
     /\.chave::after \{[^}]*top: 50%/.test(fonteCss));

  console.log('\n=== ligado e desligado se distinguem ===');
  /* A pista e o botão têm transição. Ler o estilo no instante seguinte
     à troca de classe devolve o valor DE PARTIDA da animação, e os dois
     estados saíam idênticos — foi o que a primeira versão deste teste
     mediu. Aqui esperamos a transição terminar. */
  const ler = () => p.evaluate(() => {
    const c = document.querySelector('.chave');
    return { pista: getComputedStyle(c, '::before').backgroundColor,
             botao: getComputedStyle(c, '::after').transform };
  });
  await p.evaluate(() => document.querySelector('.chave').classList.remove('ativo'));
  await p.waitForTimeout(600);
  const off = await ler();
  await p.evaluate(() => document.querySelector('.chave').classList.add('ativo'));
  await p.waitForTimeout(600);
  const on = await ler();
  await p.evaluate(() => document.querySelector('.chave').classList.remove('ativo'));
  await p.waitForTimeout(600);
  const estados = { off, on };
  ok('a pista muda de cor', estados.off.pista !== estados.on.pista,
     estados.off.pista + ' → ' + estados.on.pista);
  /* o estado não pode depender só da cor: a posição do botão o diz
     também, e é isso que serve a quem não distingue as duas cores */
  ok('e o botão anda para o outro lado', estados.off.botao !== estados.on.botao,
     estados.off.botao + ' → ' + estados.on.botao);
  ok('o botão anda 20px, ficando dentro da pista',
     /matrix\(1, 0, 0, 1, 20, 0\)/.test(estados.on.botao) ||
     /translateX\(20px\)/.test(estados.on.botao), estados.on.botao);

  console.log('\n=== o leitor de tela sabe o estado ===');
  const a11y = await p.evaluate(() => {
    const cs = [...document.querySelectorAll('.chave')];
    return cs.map(c => ({
      papel: c.getAttribute('role'),
      estado: c.getAttribute('aria-checked'),
      rotulo: c.getAttribute('aria-label') || ''
    }));
  });
  ok('há três chaves no painel', a11y.length === 3, a11y.length);
  for(const c of a11y){
    ok('a chave "' + c.rotulo.slice(0, 26) + '" é um switch', c.papel === 'switch', c.papel);
    ok('  e diz se está ligada', c.estado === 'true' || c.estado === 'false', c.estado);
    ok('  e tem rótulo próprio', c.rotulo.length > 0, c.rotulo);
  }

  console.log('\n=== tocar liga e desliga de verdade ===');
  const clique = await p.evaluate(() => {
    const c = document.querySelector('.chave');
    const antes = c.getAttribute('aria-checked');
    c.click();
    const depois = c.getAttribute('aria-checked');
    c.click();
    return { antes, depois, voltou: c.getAttribute('aria-checked') };
  });
  ok('o toque troca o estado', clique.antes !== clique.depois,
     clique.antes + ' → ' + clique.depois);
  ok('e o segundo toque volta', clique.voltou === clique.antes);
  await p.close();

  console.log('\n=== contraste nos dois temas ===');
  /* A WCAG 1.4.11 pede 3:1 para a borda de um controle contra o que
     está em volta. O bege de antes (--linha-forte) dava 2,1:1 e lia
     como "desabilitado", não como "desligado". */
  for(const tema of ['claro', 'escuro']){
    const pg = await abrir(tema);
    const r = await pg.evaluate(() => {
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r2, g2, b2]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r2) + 0.7152 * f(g2) + 0.0722 * f(b2); };
      const razao = (a, c) => { const L1 = lum(num(a)), L2 = lum(num(c));
        return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
      const c = document.querySelector('.chave');
      const painel = getComputedStyle(document.querySelector('#painel-voz .painel-corpo')).backgroundColor;
      const fundo = /rgba\(0, 0, 0, 0\)/.test(painel)
        ? getComputedStyle(document.getElementById('painel-voz')).backgroundColor : painel;
      /* sem transição a leitura é imediata e confiável */
      c.style.transition = 'none';
      const antes = getComputedStyle(c, '::before');
      c.classList.remove('ativo');
      const off = getComputedStyle(c, '::before').backgroundColor;
      c.classList.add('ativo');
      const on = getComputedStyle(c, '::before').backgroundColor;
      c.classList.remove('ativo');
      c.style.transition = '';
      return {
        desligada: razao(off, fundo),
        ligada: razao(on, fundo),
        botaoSobrePista: razao('rgb(255,255,255)', on),
        fundo
      };
    });
    ok('tema ' + tema + ': desligada passa nos 3:1 da 1.4.11', r.desligada >= 3, r.desligada + ':1');
    ok('tema ' + tema + ': ligada também', r.ligada >= 3, r.ligada + ':1');
    ok('tema ' + tema + ': o botão branco se destaca da pista ligada',
       r.botaoSobrePista >= 3, r.botaoSobrePista + ':1');
    await pg.close();
  }

  console.log('\n=== o foco pelo teclado é visível ===');
  p = await abrir();
  const foco = await p.evaluate(() => {
    const regras = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch(_){ return []; } })
      .map(x => x.selectorText || '').filter(Boolean);
    return regras.some(sel => sel.includes('.chave:focus-visible'));
  });
  ok('existe .chave:focus-visible', foco);
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
