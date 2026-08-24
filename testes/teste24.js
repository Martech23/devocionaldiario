const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* O menu lateral em tela curta */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* 360x640 e 320x568 são telas Android comuns, e são onde o menu não
   cabia: 727px de conteúdo em 640 de gaveta, 87px cortados na borda */
const TELAS = [[320, 568], [360, 640], [390, 844], [412, 915]];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (w, h) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(800);
    await p.evaluate(() => abrirMenu(true));
    await p.waitForTimeout(600);
    return p;
  };

  console.log('\n=== a nota das versões chega inteira, em toda tela ===');
  /* era este o defeito: "(Open)" terminava fora da borda */
  for(const [w, h] of TELAS){
    const p = await abrir(w, h);
    const r = await p.evaluate(async () => {
      const rol = document.querySelector('.gaveta-rolagem');
      const nota = rol.querySelector('.nota');
      rol.scrollTop = rol.scrollHeight;
      await new Promise(x => setTimeout(x, 150));
      const rn = nota.getBoundingClientRect(), rr = rol.getBoundingClientRect();
      return { dentro: rn.top >= rr.top - 1 && rn.bottom <= rr.bottom + 1,
               semCorte: nota.scrollHeight <= nota.clientHeight + 1,
               texto: nota.textContent.trim() };
    });
    ok(w + 'x' + h + ': a nota cabe na tela depois de rolar', r.dentro && r.semCorte);
    ok(w + 'x' + h + ': e termina em "(Open)."', /\(Open\)\.$/.test(r.texto));
    await p.close();
  }

  console.log('\n=== o menu rola quando não cabe ===');
  const p = await abrir(360, 640);
  const rol = await p.evaluate(() => {
    const r = document.querySelector('.gaveta-rolagem');
    return { existe: !!r, overflow: getComputedStyle(r).overflowY,
             minH: getComputedStyle(r).minHeight,
             sobra: r.scrollHeight - r.clientHeight,
             contem: r.contains(document.querySelector('.gaveta .nota')) };
  });
  ok('existe um rolador', rol.existe);
  ok('com rolagem ligada', rol.overflow === 'auto', rol.overflow);
  /* sem min-height: 0 o item flex recusa encolher e a rolagem nunca acontece */
  ok('e com min-height zerado, senão o flex não deixa rolar', rol.minH === '0px', rol.minH);
  ok('há mesmo o que rolar nesta tela', rol.sobra > 0, rol.sobra + 'px');
  ok('a nota está dentro do rolador', rol.contem);

  console.log('\n=== o cabeçalho não rola junto ===');
  /* é onde mora o tamanho da letra, e quem precisa dele é justamente
     quem teria mais dificuldade de rolar até achá-lo */
  const cab = await p.evaluate(async () => {
    const r = document.querySelector('.gaveta-rolagem');
    const antes = document.querySelector('.cabeca-gaveta').getBoundingClientRect().top;
    r.scrollTop = r.scrollHeight;
    await new Promise(x => setTimeout(x, 150));
    const dep = document.querySelector('.cabeca-gaveta').getBoundingClientRect();
    return { parado: Math.abs(dep.top - antes) < 1, visivel: dep.top >= -1,
             temBotoes: document.querySelectorAll('.cabeca-gaveta .fonte-rapida button').length };
  });
  ok('fica parado ao rolar o menu', cab.parado);
  ok('e continua visível', cab.visivel);
  ok('com os dois botões de tamanho da letra', cab.temBotoes === 2, cab.temBotoes);

  console.log('\n=== avisa que continua abaixo ===');
  const aviso = await p.evaluate(async () => {
    const g = document.querySelector('.gaveta'), r = g.querySelector('.gaveta-rolagem');
    /* o bloco anterior deixou o menu rolado até o fim */
    r.scrollTop = 0;
    r.dispatchEvent(new Event('scroll'));
    await new Promise(x => setTimeout(x, 200));
    const noTopo = g.classList.contains('tem-mais');
    const est = getComputedStyle(g, '::after');
    r.scrollTop = r.scrollHeight;
    r.dispatchEvent(new Event('scroll'));
    await new Promise(x => setTimeout(x, 250));
    return { noTopo, noFim: g.classList.contains('tem-mais'),
             semToque: est.pointerEvents === 'none' };
  });
  ok('aceso enquanto há menu abaixo da dobra', aviso.noTopo);
  ok('e apagado ao chegar no fim', !aviso.noFim);
  /* é aviso, não obstáculo: o toque tem de passar direto para o item */
  ok('não intercepta o toque', aviso.semToque, 'pointer-events: ' + (aviso.semToque ? 'none' : '?'));
  await p.close();

  console.log('\n=== em tela alta não avisa nada ===');
  const p2 = await abrir(390, 844);
  const alto = await p2.evaluate(() => ({
    aviso: document.querySelector('.gaveta').classList.contains('tem-mais'),
    sobra: (() => { const r = document.querySelector('.gaveta-rolagem');
      return r.scrollHeight - r.clientHeight; })()
  }));
  ok('nada a rolar', alto.sobra <= 1, alto.sobra + 'px');
  ok('e nenhum esmaecido aceso', !alto.aviso);
  await p2.close();

  console.log('\n=== nada quebrou com o novo invólucro ===');
  const p3 = await abrir(390, 844);
  const menu = await p3.evaluate(() => ({
    links: document.querySelectorAll('.gaveta a[href^="#"]').length,
    focado: document.activeElement && document.activeElement.textContent.trim(),
    voz: !!document.querySelector('.gaveta #btn-abrir-voz'),
    escada: getComputedStyle(document.querySelector('.gaveta-rolagem a')).transitionDelay
  }));
  ok('os nove itens continuam no menu', menu.links === 9, menu.links);
  /* o foco entra no primeiro item, não no A− do cabeçalho */
  ok('o foco entra no primeiro item', menu.focado === 'Devocional do dia', menu.focado);
  ok('a leitura em voz continua ali', menu.voz);
  /* os links deixaram de ser filhos da gaveta e viraram filhos do
     rolador: sem corrigir o nth-child, a escada de entrada pularia o
     primeiro item */
  ok('a escada de entrada começa no primeiro item', menu.escada === '0.04s', menu.escada);

  const clicou = await p3.evaluate(async () => {
    document.querySelector('.gaveta a[href="#sec-promessas"]').click();
    await new Promise(x => setTimeout(x, 400));
    return { fechou: !document.querySelector('.gaveta').classList.contains('aberta'),
             aba: typeof abaAtual !== 'undefined' ? abaAtual : null };
  });
  ok('tocar num item ainda fecha o menu', clicou.fechou);
  ok('e leva à seção', clicou.aba === 'hoje', clicou.aba);
  await p3.close();

  console.log('\n=== com a letra aumentada também ===');
  /* aumentar a letra estica tudo dentro e pode fazer sobrar rolagem
     onde não havia */
  const p4 = await abrir(390, 844);
  const grande = await p4.evaluate(async () => {
    const b = document.getElementById('fonte-mais');
    b.click(); b.click(); b.click();
    await new Promise(x => setTimeout(x, 300));
    const r = document.querySelector('.gaveta-rolagem');
    const nota = r.querySelector('.nota');
    r.scrollTop = r.scrollHeight;
    await new Promise(x => setTimeout(x, 200));
    const rn = nota.getBoundingClientRect(), rr = r.getBoundingClientRect();
    return { alcanca: rn.bottom <= rr.bottom + 1,
             cabecaVisivel: document.querySelector('.cabeca-gaveta').getBoundingClientRect().top >= -1 };
  });
  ok('a nota continua alcançável', grande.alcanca);
  ok('e o cabeçalho continua à vista', grande.cabecaVisivel);
  await p4.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource|Failed to fetch/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
