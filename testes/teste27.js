const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* O devocional extra vindo do Supabase */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* Supabase de mentira: devolve o que mandarmos, como o de verdade
   devolveria se alguém escrevesse aquilo na tabela. */
const FALSO = (titulo, texto) => `
  window.supabase = { createClient: () => ({ from: () => ({
    select: () => ({ order: () => ({ limit: async () => ({
      data: [{ titulo: ${JSON.stringify(titulo)}, texto: ${JSON.stringify(texto)} }] }) }) }) }) }) };
`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (titulo, texto, tema = 'claro') => {
    const p = await b.newPage({ viewport: { width: 390, height: 900 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    if (titulo !== null) await p.addInitScript(FALSO(titulo, texto));
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(3200);   /* o bloco entra 2s depois de carregar */
    return p;
  };

  console.log('\n=== o conteúdo da tabela não vira script ===');
  /* Era este o buraco: com innerHTML, um onerror gravado na tabela
     executava no navegador de todo visitante. */
  const ataques = [
    ['<img src=x onerror="window.__xss=1">Título', 'texto normal', 'img com onerror'],
    ['Título', '<script>window.__xss=1<\/script>', 'tag script no corpo'],
    ['<svg onload="window.__xss=1">', 'x', 'svg com onload'],
    ['x', '<iframe src="javascript:window.__xss=1"></iframe>', 'iframe javascript:']
  ];
  for(const [titulo, texto, nome] of ataques){
    const p = await abrir(titulo, texto);
    const r = await p.evaluate(() => ({
      executou: !!window.__xss,
      tags: document.querySelectorAll('#bloco-extra img, #bloco-extra script, #bloco-extra svg, #bloco-extra iframe').length,
      texto: (document.getElementById('bloco-extra') || {}).textContent || ''
    }));
    ok(nome + ': não executou', !r.executou);
    ok(nome + ': nenhuma tag foi criada', r.tags === 0, r.tags);
    await p.close();
  }
  const p0 = await abrir('<b>Título</b>', 'x');
  ok('o que veio como HTML aparece como texto na tela',
     /<b>Título<\/b>/.test(await p0.evaluate(() => $('bloco-extra').textContent)),
     await p0.evaluate(() => $('bloco-extra').textContent.slice(0, 30)));
  await p0.close();

  console.log('\n=== o bloco entra no lugar certo ===');
  let p = await abrir('Devocional da Colômbia', 'Um texto qualquer para o bloco.');
  const lugar = await p.evaluate(() => {
    const e = document.getElementById('bloco-extra');
    const barra = document.querySelector('header.barra');
    return { existe: !!e,
             dentroDaSecao: !!e && !!e.closest('#sec-hoje'),
             primeiroDoBody: document.body.firstElementChild === e,
             abaixoDaBarra: !!e && e.getBoundingClientRect().top > barra.getBoundingClientRect().bottom };
  });
  ok('o bloco aparece', lugar.existe);
  /* antes era body.prepend: nascia acima da barra fixa e empurrava a
     tela inteira para baixo dois segundos depois de carregar */
  ok('dentro da seção do dia', lugar.dentroDaSecao);
  ok('e não como primeiro filho do body', !lugar.primeiroDoBody);
  ok('abaixo da barra do app', lugar.abaixoDaBarra);

  console.log('\n=== e é legível nos dois temas ===');
  const contraste = async (tema) => {
    const pg = await abrir('Título do extra', 'Texto do devocional extra publicado por nós.', tema);
    const r = await pg.evaluate(() => {
      const e = document.getElementById('bloco-extra');
      const p = e.querySelector('p');
      const cor = getComputedStyle(p).color, fundo = getComputedStyle(e).backgroundColor;
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const L1 = lum(num(cor)), L2 = lum(num(fundo));
      return { razao: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2), cor, fundo };
    });
    await pg.close();
    return r;
  };
  for(const tema of ['claro', 'escuro']){
    const c = await contraste(tema);
    ok('tema ' + tema + ': passa nos 4,5 da AA', c.razao >= 4.5, c.razao + ':1');
  }

  console.log('\n=== texto de fora não estoura o cartão ===');
  const largo = await abrir('Título', 'A'.repeat(200) + ' ' + 'palavralonguissimasemespaco'.repeat(6));
  const vaza = await largo.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    janela: window.innerWidth,
    cartao: Math.round(document.getElementById('bloco-extra').getBoundingClientRect().width)
  }));
  ok('nada vaza para os lados', vaza.scroll <= vaza.janela, vaza.scroll + ' de ' + vaza.janela);
  ok('e o cartão cabe na tela', vaza.cartao <= vaza.janela, vaza.cartao + 'px');
  await largo.close();

  console.log('\n=== sem Supabase, o app continua inteiro ===');
  /* offline, ou CDN fora do ar: o extra é extra */
  p = await abrir(null);
  const sem = await p.evaluate(() => ({
    bloco: !!document.getElementById('bloco-extra'),
    devocional: !!document.getElementById('cartao-hoje'),
    supabase: typeof window.supabase
  }));
  ok('o bloco simplesmente não aparece', !sem.bloco);
  ok('sem erro de JS', erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)/i.test(e)).length === 0);
  ok('e o devocional do dia continua lá', sem.devocional);
  await p.close();

  console.log('\n=== linha vazia na tabela não cria caixa vazia ===');
  p = await abrir('', '');
  ok('nada é criado', !(await p.evaluate(() => !!document.getElementById('bloco-extra'))));
  await p.close();

  console.log('\n=== não duplica se rodar de novo ===');
  p = await abrir('Título', 'Texto');
  const dobro = await p.evaluate(async () => {
    await carregarDevocionalSupabase();
    await carregarDevocionalSupabase();
    return document.querySelectorAll('#bloco-extra, .bloco-extra').length;
  });
  ok('continua havendo um só', dobro === 1, dobro);
  await p.close();

  console.log('\n=== o script.js morto foi embora ===');
  /* não era carregado por ninguém e, se fosse, quebraria: usava IDs
     (titulo-dev, conteudo-dev) que não existem no HTML */
  ok('o arquivo não existe mais', !fs.existsSync(RAIZ + '/script.js'));
  const html = fs.readFileSync(RAIZ + '/index.html', 'utf8');
  ok('e nada no HTML aponta para ele', !/src="\/?script\.js"/.test(html));

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource|Failed to fetch/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
