const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Conteúdo do devocional: coerência entre versículo e os três textos */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html');
  await page.waitForTimeout(800);

  let n = 0, falhas = 0;
  const ok = (nome, v, extra) => {
    n++; if(!v) falhas++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + nome + (extra !== undefined ? '  → ' + extra : ''));
  };

  console.log('\n=== acervo de versículos ===');
  const acervo = await page.evaluate(() => ({
    total: TODAS.length,
    unicos: new Set(TODAS.map(v => v.join('-'))).size,
    temas: Object.keys(PROMESSAS).length,
    porTema: Object.values(PROMESSAS).map(v => v.length),
    alinhado: TEMA_DO_VERSO.length === TODAS.length,
    temasDevocional: Object.keys(DEVOCIONAL).length
  }));
  ok('180 versículos no acervo', acervo.total === 180, acervo.total);
  ok('nenhum versículo repetido', acervo.unicos === acervo.total, acervo.unicos + ' únicos');
  ok('10 temas', acervo.temas === 10, acervo.temas);
  ok('18 versículos por tema', acervo.porTema.every(x => x === 18), acervo.porTema.join(','));
  ok('TEMA_DO_VERSO alinhado com TODAS', acervo.alinhado);
  ok('todo tema tem devocional próprio', acervo.temasDevocional === acervo.temas);

  console.log('\n=== toda referência é válida ===');
  const refs = await page.evaluate(() => {
    const cap = {}; LIVROS.forEach(l => cap[l.nr] = l.caps);
    const ruins = [];
    TODAS.forEach(([nr, c, v]) => {
      if(!cap[nr] || c < 1 || c > cap[nr] || v < 1) ruins.push([nr, c, v].join(':'));
    });
    return ruins;
  });
  ok('capítulo dentro do livro em todas as 180', refs.length === 0, refs.join(' '));

  console.log('\n=== o texto do dia fala do tema do versículo ===');
  const coerencia = await page.evaluate(() => {
    const fora = [];
    for(let dia = 1; dia <= 366; dia++){
      const d = devocionalDoDia(dia);
      const pool = DEVOCIONAL[d.tema];
      if(!pool) { fora.push(dia + ': tema desconhecido'); continue; }
      if(!pool.reflexoes.includes(d.reflexao))   fora.push(dia + ': reflexão fora do tema ' + d.tema);
      if(!pool.meditacoes.includes(d.meditacao)) fora.push(dia + ': meditação fora do tema ' + d.tema);
      if(!pool.oracoes.includes(d.oracao))       fora.push(dia + ': oração fora do tema ' + d.tema);
      /* e o tema tem de ser mesmo o do versículo servido */
      const idx = TODAS.findIndex(v => v[0] === d.nr && v[1] === d.cap && v[2] === d.verso);
      if(TEMA_DO_VERSO[idx] !== d.tema) fora.push(dia + ': tema não bate com o versículo');
    }
    return fora;
  });
  ok('nos 366 dias, os três textos vêm do tema do versículo', coerencia.length === 0,
     coerencia.slice(0, 3).join(' | '));

  const antes = await page.evaluate(() => devocionalDoDia(200));
  const depois = await page.evaluate(() => devocionalDoDia(200));
  ok('mesmo dia devolve sempre o mesmo devocional',
     JSON.stringify(antes) === JSON.stringify(depois));

  /* Este teste exigia 366 combinações distintas de versículo+reflexão, e
     era o que a rotação de calendário dava: o mesmo versículo voltava no
     dia 181 com outra reflexão. O preço disso era a incoerência que se
     via na tela — a oração "Jesus, Tu choraste" ao lado de uma reflexão
     que não falava de choro. Desde o pareamento, cada versículo tem os
     seus três textos, e o ano passou a ter 180 devocionais distintos que
     se repetem na segunda metade. Foi a troca pedida: coerência no lugar
     de variedade. O que ainda se exige é que nenhuma das 180 se repita. */
  const variedade = await page.evaluate(() => {
    const combos = new Set(), meiaVolta = new Set();
    for(let d = 1; d <= 366; d++){
      const x = devocionalDoDia(d);
      combos.add([x.nr, x.cap, x.verso, x.reflexao].join('|'));
      if(d <= TODAS.length) meiaVolta.add([x.nr, x.cap, x.verso, x.reflexao].join('|'));
    }
    return { ano: combos.size, volta: meiaVolta.size, versos: TODAS.length };
  });
  ok('as 180 combinações de versículo+reflexão são todas distintas',
     variedade.volta === variedade.versos, variedade.volta + ' de ' + variedade.versos);
  ok('e o ano inteiro não inventa nenhuma além dessas',
     variedade.ano === variedade.versos, variedade.ano + ' combinações');

  console.log('\n=== o velho defeito não voltou ===');
  /* Antes, a reflexão saía de uma lista solta indexada só pelo dia
     (REFLEXOES[dia % 12]), à parte do versículo: um texto de gratidão podia
     vir acompanhado de uma reflexão sobre ansiedade. Este teste não fixa
     dia nenhum — o acervo pode crescer — e sim exige que, para todo dia de
     Gratidão, o texto servido pertença a Gratidão e a mais nenhum tema. */
  const cruzado = await page.evaluate(() => {
    const dias = [];
    for(let d = 1; d <= 366; d++) if(devocionalDoDia(d).tema === 'Gratidão') dias.push(d);
    const vazando = dias.filter(d => {
      const x = devocionalDoDia(d);
      const outros = Object.entries(DEVOCIONAL).filter(([t]) => t !== 'Gratidão');
      return !DEVOCIONAL['Gratidão'].reflexoes.includes(x.reflexao)
          || outros.some(([, p]) => p.reflexoes.includes(x.reflexao));
    });
    return { quantos: dias.length, vazando };
  });
  ok('há dias de Gratidão no ano', cruzado.quantos > 0, cruzado.quantos + ' dias');
  ok('e nenhum recebe reflexão de outro tema', cruzado.vazando.length === 0,
     cruzado.vazando.slice(0, 3).join(','));

  console.log('\n=== o tema aparece no percurso ===');
  await page.evaluate(() => {
    window.__falas = []; window.__dur = 60;
    window.buscarVerso = async () => ({ texto: 'Porque para Deus nada é impossível.', versao: 'Almeida Atualizada' });
  });
  await page.evaluate(() => versiculoDoDia());
  await page.waitForTimeout(500);

  const chip = page.locator('#cartao-hoje .tema-devo');
  ok('chip do tema está no cartão', await chip.count() === 1, await chip.count());
  const nomeTema = await chip.textContent();
  const esperado = await page.evaluate(() => devocionalDoDia(diaDoAno(new Date())).tema);
  ok('chip mostra o tema do dia', nomeTema === esperado, nomeTema + ' vs ' + esperado);
  ok('chip tem rótulo acessível',
     /Tema: .+Ver outras promessas/.test(await chip.getAttribute('aria-label')));

  const rotuloFalado = await page.evaluate(() => {
    const p = document.querySelector('#cartao-hoje .rotulo-passo');
    return p.textContent;
  });
  ok('rótulo do passo continua legível', /^Versículo do dia/.test(rotuloFalado), JSON.stringify(rotuloFalado));

  console.log('\n=== tocar no tema leva às promessas do assunto ===');
  await chip.click();
  await page.waitForTimeout(700);
  const selecionado = await page.evaluate(() => ({
    tema: temaAtual,
    ativo: document.querySelector('#temas .tema.ativo')?.textContent,
    ativos: document.querySelectorAll('#temas .tema.ativo').length
  }));
  ok('tema ficou selecionado nas promessas', selecionado.tema === esperado, selecionado.tema);
  ok('o botão certo ficou ativo', selecionado.ativo === esperado, selecionado.ativo);
  ok('só um tema ativo por vez', selecionado.ativos === 1, selecionado.ativos);

  const pool = await page.evaluate(() => PROMESSAS[temaAtual].length);
  ok('a caixa de promessas passa a sortear só nesse tema', pool === 18, pool);

  console.log('\n=== o percurso avança com o texto certo ===');
  await page.evaluate(() => versiculoDoDia());
  await page.waitForTimeout(400);
  const esperados = await page.evaluate(() => {
    const d = devocionalDoDia(diaDoAno(new Date()));
    return [d.reflexao, d.meditacao, d.oracao];
  });
  const vistos = [];
  for(let k = 0; k < 3; k++){
    await page.locator('#cartao-hoje .navega-passo .btn').click();
    await page.waitForTimeout(350);
    vistos.push(await page.locator('#cartao-hoje .texto-passo').textContent());
  }
  ok('passo 2 traz a reflexão do tema', vistos[0] === esperados[0]);
  ok('passo 3 traz a meditação do tema', vistos[1] === esperados[1]);
  ok('passo 4 traz a oração do tema', vistos[2] === esperados[2]);

  console.log('\n=== histórico usa o mesmo versículo do dia ===');
  /* a lista nasce fechada; é o botão que a monta */
  await page.evaluate(() => $('btn-hist').click());
  await page.waitForTimeout(300);
  const hist = await page.evaluate(() => {
    const hoje = new Date();
    const doDia = devocionalDoDia(diaDoAno(hoje));
    const naTela = document.querySelector('#lista-hist .item-hist.hoje .hist-ref')?.textContent;
    return { naTela, esperado: livroPorNr(doDia.nr).nome + ' ' + doDia.cap + ':' + doDia.verso };
  });
  ok('linha de hoje bate com o devocional', hist.naTela === hist.esperado, hist.naTela + ' vs ' + hist.esperado);

  console.log('\n=== o modo "ver tudo" também mostra o tema ===');
  await page.evaluate(() => document.querySelector('#cartao-hoje .alternar-modo').click());
  await page.waitForTimeout(500);
  ok('chip do tema segue presente', await page.locator('#cartao-hoje .tema-devo').count() === 1);
  ok('os 3 blocos continuam preenchidos',
     await page.evaluate(() => [...document.querySelectorAll('#cartao-hoje .bloco-devo p')]
       .every(p => p.textContent.trim().length > 20)));
  const blocos = await page.evaluate(() =>
    [...document.querySelectorAll('#cartao-hoje .bloco-devo p')].map(p => p.textContent));
  ok('reflexão no bloco certo', blocos[0] === esperados[0]);
  ok('meditação no bloco certo', blocos[1] === esperados[1]);
  ok('oração no bloco certo', blocos[2] === esperados[2]);

  await page.screenshot({ path: 'tema-devo.png' });

  console.log('\n=== erros ===');
  ok('sem erros de JS', erros.length === 0, erros.join(' | '));
  console.log('\n=== TOTAL: ' + n + ' asserções, ' + falhas + ' falhas ===');
  await browser.close();
  process.exit(falhas ? 1 : 0);
})();
