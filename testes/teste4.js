const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* capítulo falso, já que a rede externa é bloqueada aqui */
const STUB = `
window.__stubCaps = 0;
window.addEventListener('DOMContentLoaded', () => {
  window.buscarCapituloEm = async (v, nr, cap) => ({ itens: [
    { tipo:'verso', numero:1, texto:'Texto de ' + v.id + ' para o capítulo ' + cap + ', versículo 1.' },
    { tipo:'verso', numero:2, texto:'Texto de ' + v.id + ' para o capítulo ' + cap + ', versículo 2.' }
  ]});
  window.buscarCapitulo = async (nr, cap) => {
    window.__stubCaps++;
    return { itens: [
      { tipo:'titulo', texto:'Um título de seção' },
      { tipo:'verso', numero:1, texto:'Primeiro versículo do capítulo ' + cap + '.' },
      { tipo:'verso', numero:2, texto:'Segundo versículo do capítulo ' + cap + '.' },
      { tipo:'verso', numero:3, texto:'Terceiro versículo do capítulo ' + cap + '.' }
    ]};
  };
});
`;

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({
    viewport: { width: 400, height: 820 },
    permissions: []
  });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

  await page.addInitScript(MOCK);
  await page.addInitScript(STUB);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);

  // ---------------------------------------------------------------
  console.log('\n=== destaques coloridos ===');
  await page.evaluate(() => abrirLeitura(19, 23));
  await page.waitForTimeout(400);
  ok('capítulo desenhou 3 versículos', await page.locator('#area-leitura .v').count() === 3);

  await page.locator('#area-leitura .v').nth(1).click();
  await page.waitForTimeout(500);
  ok('folha abriu ao tocar no versículo', await page.locator('#folha-verso.ver').count() === 1);
  ok('folha mostra a referência certa',
     (await page.locator('#folha-ref').textContent()) === 'Salmos 23:2');
  ok('folha mostra o texto do versículo',
     /Segundo versículo/.test(await page.locator('#folha-txt').textContent()));

  await page.locator('#folha-cores button[data-cor="verde"]').click();
  await page.waitForTimeout(250);
  ok('versículo ficou verde', await page.locator('#area-leitura .v.marca-verde').count() === 1);
  ok('cor gravada no localStorage', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-destaques'))['19:23:2'] === 'verde'));
  ok('cor marcada como ativa na folha',
     await page.locator('#folha-cores button[data-cor="verde"].ativo').count() === 1);

  await page.locator('#folha-cores button[data-cor="amarelo"]').click();
  await page.waitForTimeout(200);
  ok('trocou de cor', await page.locator('#area-leitura .v.marca-amarelo').count() === 1
     && await page.locator('#area-leitura .v.marca-verde').count() === 0);

  await page.locator('#folha-cores button[data-cor=""]').click();
  await page.waitForTimeout(200);
  ok('limpou a marca', await page.locator('#area-leitura .v[class*="marca-"]').count() === 0);
  ok('chave removida do store', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-destaques'))['19:23:2'] === undefined));

  // marca de novo para checar a persistência ao reabrir o capítulo
  await page.locator('#folha-cores button[data-cor="azul"]').click();
  await page.waitForTimeout(150);
  await page.evaluate(() => { fecharFolha(); abrirLeitura(40, 5); });
  await page.waitForTimeout(400);
  await page.evaluate(() => abrirLeitura(19, 23));
  await page.waitForTimeout(400);
  ok('marca sobrevive a sair e voltar do capítulo',
     await page.locator('#area-leitura .v.marca-azul').count() === 1);

  // ---------------------------------------------------------------
  console.log('\n=== notas em qualquer versículo ===');
  await page.locator('#area-leitura .v').nth(2).click();
  await page.waitForTimeout(450);
  await page.click('#fa-nota');
  await page.waitForTimeout(250);
  ok('painel de nota apareceu', await page.locator('#folha-nota:not(.oculto)').count() === 1);
  await page.fill('#campo-nota-verso', 'Deus cuidou de mim aqui.');
  await page.click('#btn-salvar-nota');
  await page.waitForTimeout(300);
  ok('nota gravada', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-notas'))['19:23:3'].texto === 'Deus cuidou de mim aqui.'));
  ok('versículo ganhou marca de nota',
     await page.locator('#area-leitura .v.tem-nota').count() === 1);
  ok('voltou para o painel principal',
     await page.locator('#folha-principal:not(.oculto)').count() === 1);

  await page.evaluate(() => { fecharFolha(); tabFavAtual = 'diario'; renderFavoritos(); });
  await page.waitForTimeout(300);
  ok('nota aparece no Diário sem ser favorito',
     (await page.locator('#area-favoritos .item-fav .ref-fav').first().textContent()) === 'Salmos 23:3');
  ok('Diário tem botão Ouvir meu diário',
     await page.locator('#area-favoritos .linha-ouvir .btn-ouvir').count() === 1);

  // apagar pelo campo vazio
  await page.locator('#area-leitura .v').nth(2).click();
  await page.waitForTimeout(400);
  await page.click('#fa-nota');
  await page.waitForTimeout(200);
  await page.fill('#campo-nota-verso', '   ');
  await page.click('#btn-salvar-nota');
  await page.waitForTimeout(250);
  ok('nota vazia remove o registro', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-notas'))['19:23:3'] === undefined));
  await page.evaluate(() => fecharFolha());

  // ---------------------------------------------------------------
  console.log('\n=== migração das notas antigas ===');
  const migrou = await page.evaluate(() => {
    localStorage.setItem('lampada-favoritos', JSON.stringify([{
      chave: '43:3:16', nr: 43, cap: 3, verso: 16, texto: 'Texto antigo.',
      versao: 'Almeida', ref: 'João 3:16', data: '2026-01-01T00:00:00.000Z',
      nota: 'Nota escrita no formato antigo.'
    }]));
    localStorage.setItem('lampada-notas', '{}');
    migrarNotasDosFavoritos();
    return JSON.parse(localStorage.getItem('lampada-notas'))['43:3:16'];
  });
  ok('nota presa a favorito foi migrada', migrou && migrou.texto === 'Nota escrita no formato antigo.');
  ok('migração preserva a referência', migrou && migrou.ref === 'João 3:16');

  // ---------------------------------------------------------------
  console.log('\n=== comparar versões ===');
  await page.evaluate(() => abrirLeitura(19, 23));
  await page.waitForTimeout(400);
  await page.locator('#area-leitura .v').nth(0).click();
  await page.waitForTimeout(450);
  await page.click('#fa-comparar');
  await page.waitForTimeout(700);
  const nComp = await page.locator('#lista-comparacao .comp-item').count();
  ok('comparação lista as 4 versões (' + nComp + ')', nComp === 4);
  ok('cada versão traz o seu próprio texto', await page.evaluate(() =>
    new Set([...document.querySelectorAll('#lista-comparacao .comp-txt')]
      .map(e => e.textContent)).size === 4));
  ok('comparação tem botão de ouvir todas',
     await page.locator('#lista-comparacao .btn-ouvir').count() === 1);
  await page.click('#btn-voltar-folha2');
  await page.waitForTimeout(200);
  ok('voltou da comparação', await page.locator('#folha-principal:not(.oculto)').count() === 1);
  await page.evaluate(() => fecharFolha());

  // ---------------------------------------------------------------
  console.log('\n=== histórico do versículo do dia ===');
  /* o histórico é registro, então mora na aba Meu */
  await page.evaluate(() => irParaAba('meu', { semRolar: true }));
  await page.waitForTimeout(250);
  ok('histórico começa escondido', await page.locator('#lista-hist.oculto').count() === 1);
  await page.click('#btn-hist');
  await page.waitForTimeout(300);
  ok('mostrou 30 dias', await page.locator('#lista-hist .item-hist').count() === 30);
  ok('primeiro item é Hoje',
     (await page.locator('#lista-hist .hist-data').first().textContent()) === 'Hoje');
  ok('rótulo do botão virou "Esconder"',
     /Esconder/.test(await page.locator('#btn-hist').textContent()));
  await page.click('#btn-hist');
  await page.waitForTimeout(250);
  ok('esconde de novo', await page.locator('#lista-hist.oculto').count() === 1);

  // ---------------------------------------------------------------
  console.log('\n=== minhas orações ===');
  /* a oração é ato do dia, ficou na aba Hoje */
  await page.evaluate(() => irParaAba('hoje', { semRolar: true }));
  await page.waitForTimeout(250);
  await page.evaluate(() => { localStorage.setItem('lampada-oracoes', '[]'); renderOracoes(); });
  await page.fill('#campo-oracao', 'Pela saúde da minha mãe.');
  await page.click('#btn-add-oracao');
  await page.waitForTimeout(300);
  ok('pedido adicionado', await page.locator('#lista-oracoes .item-oracao').count() === 1);
  ok('campo foi limpo', (await page.inputValue('#campo-oracao')) === '');
  ok('pedido tem botão de ouvir', await page.locator('#lista-oracoes .ouvir-mini').count() === 1);

  await page.fill('#campo-oracao', 'Pelo emprego novo.');
  await page.click('#btn-add-oracao');
  await page.waitForTimeout(300);
  ok('segundo pedido entra no topo',
     /emprego novo/.test(await page.locator('#lista-oracoes .ora-txt').first().textContent()));

  await page.locator('#lista-oracoes .ora-marca').first().click();
  await page.waitForTimeout(300);
  ok('marcou como respondida', await page.locator('#lista-oracoes .item-oracao.respondida').count() === 1);
  ok('mostra selo com a data', await page.locator('#lista-oracoes .selo-resp').count() === 1);
  ok('gravou no localStorage', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-oracoes'))[0].respondida === true));

  await page.locator('#lista-oracoes .ora-marca').first().click();
  await page.waitForTimeout(250);
  ok('desmarca de volta', await page.locator('#lista-oracoes .item-oracao.respondida').count() === 0);

  await page.evaluate(() => { window.__falas = []; window.__dur = 150; });
  await page.click('#btn-ouvir-oracoes');
  await page.waitForTimeout(500);
  const falasOra = await page.evaluate(() => window.__falas.map(f => f.text));
  ok('lê os pedidos em voz', falasOra.some(t => /emprego novo/.test(t)));
  await page.evaluate(() => Voz.parar());

  await page.locator('#lista-oracoes .btn-remover').first().click();
  await page.waitForTimeout(250);
  ok('remove o pedido', await page.locator('#lista-oracoes .item-oracao').count() === 1);
  await page.evaluate(() => { localStorage.setItem('lampada-oracoes', '[]'); renderOracoes(); });
  ok('estado vazio explica o que fazer',
     /Nenhum pedido ainda/.test(await page.locator('#lista-oracoes').textContent()));

  // ---------------------------------------------------------------
  console.log('\n=== números falados → referência ===');
  const casos = await page.evaluate(() => [
    ['joão três dezesseis',                       arrumarReferenciaFalada('joão três dezesseis')],
    ['salmos vinte e três',                       arrumarReferenciaFalada('salmos vinte e três')],
    ['primeira coríntios treze quatro',           arrumarReferenciaFalada('primeira coríntios treze quatro')],
    ['gênesis capítulo um versículo três',        arrumarReferenciaFalada('gênesis capítulo um versículo três')],
    ['salmos cento e dezenove',                   arrumarReferenciaFalada('salmos cento e dezenove')],
    ['amor',                                      arrumarReferenciaFalada('amor')]
  ]);
  casos.forEach(([entrada, saida]) => console.log('     "' + entrada + '" → "' + saida + '"'));
  const esperado = {
    'joão três dezesseis': 'joao 3:16',
    'salmos vinte e três': 'salmos 23',
    'primeira coríntios treze quatro': '1 corintios 13:4',
    'gênesis capítulo um versículo três': 'genesis 1:3',
    'salmos cento e dezenove': 'salmos 119',
    'amor': 'amor'
  };
  casos.forEach(([entrada, saida]) =>
    ok('"' + entrada + '"', saida === esperado[entrada]));

  // ---------------------------------------------------------------
  console.log('\n=== planos gerados ===');
  const planos = await page.evaluate(() => PLANOS.map(p => ({ id: p.id, dias: p.dias.length })));
  console.log('     planos:', planos.map(p => p.id + '(' + p.dias + ')').join(', '));
  ok('catálogo cresceu para 12 planos', planos.length === 12);
  ok('Bíblia em 1 ano tem 365 dias',
     planos.find(p => p.id === 'biblia365').dias === 365);
  ok('NT em 90 dias tem 90 dias', planos.find(p => p.id === 'nt90').dias === 90);
  ok('plano de 1 ano cobre os 1189 capítulos', await page.evaluate(() => {
    const p = PLANOS.find(x => x.id === 'biblia365');
    return p.dias.reduce((n, d) => n + capitulosDoDia(d).length, 0) === 1189;
  }));
  ok('começa em Gênesis 1 e termina em Apocalipse 22', await page.evaluate(() => {
    const p = PLANOS.find(x => x.id === 'biblia365');
    const pri = capitulosDoDia(p.dias[0])[0];
    const ult = capitulosDoDia(p.dias[p.dias.length - 1]).slice(-1)[0];
    return pri[0] === 1 && pri[1] === 1 && ult[0] === 66 && ult[1] === 22;
  }));
  ok('rótulo agrupa capítulos seguidos', await page.evaluate(() =>
    rotuloDoDia([[1,1],[1,2],[1,3]]) === 'Gênesis 1–3'));
  ok('rótulo separa livros diferentes', await page.evaluate(() =>
    rotuloDoDia([[1,50],[2,1]]) === 'Gênesis 50 · Êxodo 1'));
  ok('dia simples continua funcionando', await page.evaluate(() =>
    capitulosDoDia([43, 3]).length === 1 && rotuloDoDia([[43,3]]) === 'João 3'));

  console.log('\n=== ouvir a leitura do dia (vários capítulos) ===');
  await page.evaluate(() => { window.__falas = []; window.__dur = 40; window.__stubCaps = 0; });
  await page.evaluate(() => ouvirLeituraDoDia([[1,1],[1,2]], 'Gênesis 1–2'));
  await page.waitForTimeout(1400);
  ok('buscou os dois capítulos', await page.evaluate(() => window.__stubCaps === 2));
  const falasDia = await page.evaluate(() => window.__falas.map(f => f.text));
  ok('anunciou os dois capítulos',
     falasDia.some(t => /capítulo 1$/.test(t)) && falasDia.some(t => /capítulo 2$/.test(t)));
  ok('leu versículos dos dois', falasDia.filter(t => /versículo do capítulo/.test(t)).length >= 6);
  await page.evaluate(() => Voz.parar());

  // ---------------------------------------------------------------
  console.log('\n=== ditado (sem suporte no Chromium headless) ===');
  ok('Ditado existe e informa o suporte',
     ['boolean'].includes(await page.evaluate(() => typeof Ditado.suporta)));
  const semSuporte = await page.evaluate(() => {
    if (Ditado.suporta) return 'tem suporte';
    Ditado.ouvir(document.getElementById('btn-busca-voz'), () => {});
    return document.getElementById('aviso').textContent;
  });
  ok('avisa quando o navegador não entende ditado',
     semSuporte === 'tem suporte' || /não entende ditado/.test(semSuporte));

  console.log('\n=== o servidor precisa deixar o microfone existir ===');
  /* `microphone=()` na Permissions-Policy desliga o microfone até para a
     própria origem. O botão continuava na tela, a pessoa tocava e nada
     acontecia — o pior tipo de defeito, porque promete o que o navegador
     já decidiu recusar. */
  const vercel = JSON.parse(require('fs').readFileSync(RAIZ + '/vercel.json', 'utf8'));
  const pp = (vercel.headers[0].headers.find(h => h.key === 'Permissions-Policy') || {}).value || '';
  ok('a política existe', !!pp, pp);
  ok('e libera o microfone para a própria origem', /microphone=\(self\)/.test(pp), pp);
  ok('sem abrir para terceiros', !/microphone=\*/.test(pp));
  ok('câmera continua fechada', /camera=\(\)/.test(pp));
  ok('localização continua fechada', /geolocation=\(\)/.test(pp));

  console.log('\n=== e o app não promete o que a política proíbe ===');
  const HTML = require('fs').readFileSync(RAIZ + '/index.html', 'utf8');
  for(const [politica, deveAparecer] of [['microphone=()', false], ['microphone=(self)', true]]){
    const pg = await browser.newPage();
    await pg.route(BASE + '/index.html', r => r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'permissions-policy': politica },
      body: HTML
    }));
    await pg.goto(BASE + '/index.html');
    await pg.waitForTimeout(900);
    const r = await pg.evaluate(() => ({
      permitido: (document.featurePolicy || {}).allowsFeature
        ? document.featurePolicy.allowsFeature('microphone') : null,
      mostra: document.documentElement.dataset.ditado !== '0'
    }));
    ok('com ' + politica + ' o navegador ' + (deveAparecer ? 'permite' : 'barra'),
       r.permitido === deveAparecer, String(r.permitido));
    ok('e o botão de ditar ' + (deveAparecer ? 'aparece' : 'some'),
       r.mostra === deveAparecer, String(r.mostra));
    await pg.close();
  }

  console.log('\n=== erros de JS ===');
  const relevantes = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  relevantes.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', relevantes.length === 0);

  await browser.close();
})();
