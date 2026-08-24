const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Abas: a home deixou de ser uma página só */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
const VERSO = () => `window.buscarVerso = async () => ({ texto: 'Deus supre toda necessidade segundo as suas riquezas.', versao: 'Biblia Livre' }); return versiculoDoDia();`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1000);
  await p.evaluate(new Function(VERSO()));
  await p.waitForTimeout(400);

  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };
  const visiveis = () => p.evaluate(() =>
    [...document.querySelectorAll('section.secao, #controles')]
      .filter(s => s.offsetParent !== null).map(s => s.id));

  console.log('\n=== a barra existe e começa em Hoje ===');
  ok('barra de abas na página', await p.locator('#abas').count() === 1);
  ok('quatro abas', await p.locator('#abas button').count() === 4);
  ok('abre em Hoje', await p.evaluate(() => abaAtual) === 'hoje');
  ok('aba ativa marcada', await p.getAttribute('#abas button[data-aba="hoje"]', 'aria-current') === 'page');
  ok('só uma ativa', await p.locator('#abas button.ativo').count() === 1);
  ok('ícones herdam a cor (svg, não emoji)',
     await p.locator('#abas button svg.ico').count() === 4);

  console.log('\n=== cada aba mostra só o que é dela ===');
  const esperado = {
    hoje:   ['sec-hoje','sec-oracoes','sec-promessas'],
    biblia: ['controles','sec-biblia'],           // sec-busca só aparece com resultado
    planos: ['sec-planos'],
    meu:    ['sec-stats','sec-hist','sec-favoritos','sec-app']
  };
  for(const [aba, ids] of Object.entries(esperado)){
    await p.locator(`#abas button[data-aba="${aba}"]`).click();
    await p.waitForTimeout(300);
    const v = await visiveis();
    ok(aba + ': mostra exatamente as suas seções', v.join(',') === ids.join(','), v.join(','));
  }

  console.log('\n=== o que se faz hoje x o que se acumulou ===');
  /* jornada e dias anteriores são registro; a oração é ato do dia, e o
     campo dela pergunta "pelo que você quer orar hoje?" */
  ok('a jornada saiu de Hoje', await p.evaluate(() => abaDe('sec-stats')) === 'meu');
  ok('os dias anteriores também', await p.evaluate(() => abaDe('sec-hist')) === 'meu');
  ok('as orações ficaram em Hoje', await p.evaluate(() => abaDe('sec-oracoes')) === 'hoje');
  ok('e a caixa de promessas também', await p.evaluate(() => abaDe('sec-promessas')) === 'hoje');

  /* o menu aponta para "Sua jornada", que agora vive em outra aba */
  await p.evaluate(() => irParaAba('hoje', { semRolar: true }));
  await p.waitForTimeout(200);
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(350);
  await p.locator('.gaveta a[href="#sec-stats"]').click();
  await p.waitForTimeout(600);
  ok('o menu leva à jornada trocando de aba', await p.evaluate(() => abaAtual) === 'meu');
  ok('e a seção fica visível', await p.locator('#sec-stats').isVisible());

  /* o fim do devocional oferece registrar um pedido: não pode sair de Hoje */
  await p.evaluate(() => irParaAba('hoje', { semRolar: true }));
  await p.waitForTimeout(250);
  await p.evaluate(() => { const c = $('cartao-hoje').querySelectorAll('.navega-passo .btn');
    return null; });
  for(let k = 0; k < 4; k++){
    const btn = p.locator('#cartao-hoje .navega-passo .btn');
    if(await btn.count() === 0) break;
    await btn.click(); await p.waitForTimeout(280);
  }
  const fim = await p.locator('.acoes-fim .btn-ouvir').first();
  ok('o devocional chegou ao fim', await p.locator('.fim-percurso').count() === 1);
  await fim.click();
  await p.waitForTimeout(700);
  ok('registrar um pedido não sai da aba Hoje', await p.evaluate(() => abaAtual) === 'hoje');
  ok('e as orações estão visíveis', await p.locator('#sec-oracoes').isVisible());

  console.log('\n=== a home encolheu ===');
  await p.locator('#abas button[data-aba="hoje"]').click();
  await p.waitForTimeout(300);
  const alt = await p.evaluate(() => document.body.scrollHeight);
  console.log('     altura da home:', alt + 'px =', (alt / 844).toFixed(1), 'telas');
  ok('home cabe em menos de 4 telas', alt < 844 * 4, (alt / 844).toFixed(1) + ' telas');

  console.log('\n=== abrir o app cai no devocional, não onde se parou ===');
  /* o navegador guarda a rolagem e devolve a pessoa onde ela estava: quem
     tinha parado na caixa de promessas reabria lá, e não no devocional */
  await p.locator('#abas button[data-aba="hoje"]').click();
  await p.waitForTimeout(250);
  await p.evaluate(() => $('sec-promessas').scrollIntoView());
  await p.waitForTimeout(400);
  const rolou = await p.evaluate(() => Math.round(window.scrollY));
  ok('a rolagem foi mesmo até as promessas', rolou > 300, rolou + 'px');
  await p.reload();
  await p.waitForTimeout(1200);
  await p.evaluate(new Function(VERSO()));
  await p.waitForTimeout(300);
  ok('reabre no topo', await p.evaluate(() => Math.round(window.scrollY)) === 0,
     await p.evaluate(() => Math.round(window.scrollY)) + 'px');
  ok('e o devocional é o que está na tela',
     await p.evaluate(() => {
       const meio = window.innerHeight / 2;
       for (const s of document.querySelectorAll('section.secao')) {
         if (s.offsetParent === null) continue;
         const r = s.getBoundingClientRect();
         if (r.top < meio && r.bottom > meio) return s.id;
       }
       return null;
     }) === 'sec-hoje');
  ok('a restauração automática do navegador está desligada',
     await p.evaluate(() => history.scrollRestoration) === 'manual');

  console.log('\n=== a aba guardada vale só no mesmo dia ===');
  await p.locator('#abas button[data-aba="planos"]').click();
  await p.waitForTimeout(250);
  /* finge que a escolha foi feita ontem */
  await p.evaluate(() => {
    const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    localStorage.setItem('lampada-aba-dia', d);
  });
  await p.reload();
  await p.waitForTimeout(1200);
  await p.evaluate(new Function(VERSO()));
  await p.waitForTimeout(300);
  ok('um dia novo abre em Hoje, mesmo tendo saído dos Planos',
     await p.evaluate(() => abaAtual) === 'hoje', await p.evaluate(() => abaAtual));

  console.log('\n=== a escolha sobrevive ao recarregar ===');
  await p.locator('#abas button[data-aba="planos"]').click();
  await p.waitForTimeout(250);
  await p.reload();
  await p.waitForTimeout(1000);
  await p.evaluate(new Function(VERSO()));   /* o reload levou o stub embora */
  await p.waitForTimeout(300);
  ok('voltou em Planos', await p.evaluate(() => abaAtual) === 'planos');
  ok('e a seção certa está visível', (await visiveis()).join(',') === 'sec-planos');

  console.log('\n=== abrir um capítulo leva à aba da Bíblia ===');
  await p.locator('#abas button[data-aba="hoje"]').click();
  await p.waitForTimeout(300);
  await p.evaluate(() => abrirLeitura(19, 23));
  await p.waitForTimeout(600);
  ok('trocou sozinho para a Bíblia', await p.evaluate(() => abaAtual) === 'biblia');
  ok('a área de leitura está visível', await p.locator('#area-leitura').isVisible());

  console.log('\n=== a busca mostra os resultados na aba certa ===');
  await p.locator('#abas button[data-aba="hoje"]').click();
  await p.waitForTimeout(250);
  await p.evaluate(() => { $('sec-busca').classList.remove('oculto'); mostrarSecao('sec-busca'); });
  await p.waitForTimeout(400);
  ok('foi para a Bíblia', await p.evaluate(() => abaAtual) === 'biblia');
  ok('resultados visíveis', await p.locator('#sec-busca').isVisible());
  await p.evaluate(() => $('sec-busca').classList.add('oculto'));

  console.log('\n=== sec-busca continua escondida sem resultado ===');
  await p.locator('#abas button[data-aba="biblia"]').click();
  await p.waitForTimeout(250);
  ok('a aba Bíblia não revela a busca vazia', !(await p.locator('#sec-busca').isVisible()));

  console.log('\n=== o menu lateral troca de aba ===');
  await p.locator('#abas button[data-aba="hoje"]').click();
  await p.waitForTimeout(250);
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(350);
  await p.locator('.gaveta a[href="#sec-favoritos"]').click();
  await p.waitForTimeout(600);
  ok('link do menu levou à aba Meu', await p.evaluate(() => abaAtual) === 'meu');
  ok('e a seção ficou visível', await p.locator('#sec-favoritos').isVisible());

  console.log('\n=== nada fixo se sobrepõe no rodapé ===');
  await p.locator('#abas button[data-aba="hoje"]').click();
  await p.waitForTimeout(250);
  await p.evaluate(() => { window.__dur = 9000; });
  /* espera explícita: a aba acabou de trocar e o cartão ainda pode estar
     terminando de aparecer — esperar em milissegundos fixos dá corrida */
  const ouvir = p.locator('#cartao-hoje .navega-passo .btn-ouvir');
  await ouvir.waitFor({ state: 'visible', timeout: 10000 });
  await ouvir.click();
  await p.waitForTimeout(700);
  const caixas = await p.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const c = e.getBoundingClientRect();
                     return { top: Math.round(c.top), bottom: Math.round(c.bottom) }; };
    return { abas: r('#abas'), audio: r('#barra-audio'), janela: window.innerHeight };
  });
  console.log('     abas', JSON.stringify(caixas.abas), 'áudio', JSON.stringify(caixas.audio));
  ok('a barra de áudio se apoia nas abas, não por cima',
     caixas.audio.bottom <= caixas.abas.top + 1);
  ok('as abas encostam no fim da janela', caixas.abas.bottom >= caixas.janela - 1);
  await p.evaluate(() => Voz.parar());
  await p.waitForTimeout(300);

  console.log('\n=== o conteúdo não fica atrás das abas ===');
  const folga = await p.evaluate(() => {
    const m = document.querySelector('main.envolve');
    return parseFloat(getComputedStyle(m).paddingBottom);
  });
  ok('main reserva espaço no rodapé', folga >= 58, folga + 'px');

  console.log('\n=== tamanho da letra: no cabeçalho, sempre à vista ===');
  ok('controle no cabeçalho da gaveta', await p.locator('.cabeca-gaveta .fonte-rapida button').count() === 2);
  ok('o bloco antigo do rodapé sumiu', await p.locator('#tamanhos').count() === 0);
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(400);

  /* O ponto da mudança só aparece em tela pequena: nesta janela de 844px a
     gaveta nem rola, então medir aqui não provaria nada. Abrimos uma tela
     de 360x640 — a que tinha o controle 86px abaixo do fim — só para isto. */
  const peq = await b.newPage({ viewport: { width: 360, height: 640 } });
  await peq.goto(BASE + '/index.html');
  await peq.waitForTimeout(900);
  await peq.evaluate(() => abrirMenu(true));
  await peq.waitForTimeout(400);
  const alcance = await peq.evaluate(() => {
    /* quem rola é o invólucro interno; a gaveta em si é do tamanho da
       tela e o cabeçalho fica de fora dele, parado */
    const g = document.querySelector('.gaveta-rolagem'), m = $('fonte-mais');
    return { precisaRolar: g.scrollHeight - g.clientHeight,
             base: Math.round(m.getBoundingClientRect().bottom), janela: window.innerHeight };
  });
  ok('em 360x640 a gaveta ainda rola', alcance.precisaRolar > 0, alcance.precisaRolar + 'px');
  ok('mas o controle fica visível sem rolar', alcance.base <= alcance.janela,
     'base ' + alcance.base + ' de ' + alcance.janela);
  ok('e o botão tem 44px em tela pequena',
     await peq.evaluate(() => Math.round($('fonte-mais').getBoundingClientRect().height)) >= 44);
  await peq.close();

  const escala = () => p.evaluate(() => document.documentElement.style.getPropertyValue('--esc').trim());
  ok('começa no normal', (await escala()) === '1', await escala());
  ok('A− começa apagado no normal? não', await p.locator('#fonte-menos').isDisabled() === false);

  await p.click('#fonte-mais'); await p.waitForTimeout(250);
  ok('A+ aumenta um passo', (await escala()) === '1.2', await escala());
  await p.click('#fonte-mais'); await p.waitForTimeout(250);
  ok('e outro', (await escala()) === '1.45', await escala());
  ok('no máximo, A+ apaga', await p.locator('#fonte-mais').isDisabled());
  await p.click('#fonte-menos'); await p.waitForTimeout(250);
  ok('A− volta um passo', (await escala()) === '1.2', await escala());
  ok('e A+ acende de novo', await p.locator('#fonte-mais').isDisabled() === false);

  await p.click('#fonte-menos'); await p.waitForTimeout(200);
  await p.click('#fonte-menos'); await p.waitForTimeout(250);
  ok('desce até a menor', (await escala()) === '0.9', await escala());
  ok('no mínimo, A− apaga', await p.locator('#fonte-menos').isDisabled());

  ok('o aviso diz o tamanho',
     /Letra (pequena|normal|grande|muito grande)/.test(await p.locator('#aviso').textContent()),
     await p.locator('#aviso').textContent());

  await p.reload();
  await p.waitForTimeout(1000);
  ok('a escala sobrevive ao recarregar', (await escala()) === '0.9', await escala());
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(400);
  ok('e o A− volta apagado', await p.locator('#fonte-menos').isDisabled());
  await p.evaluate(() => { aplicarEscala('1'); abrirMenu(false); });
  await p.waitForTimeout(300);

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);
  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
