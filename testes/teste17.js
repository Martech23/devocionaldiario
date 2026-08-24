const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Referências cruzadas: os dados e o painel "Veja também" */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
const SERVIR = `
  window.buscarVerso = async (nr,cap,v) => ({ texto: 'Texto de ' + livroPorNr(nr).nome + ' ' + cap + ':' + v + '.', versao: 'BL' });
  window.buscarCapitulo = async () => ({ itens: [{numero:1,texto:'O Senhor é o meu pastor; nada me faltará.'}] });
`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1100);
  await p.evaluate(SERVIR);

  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  console.log('\n=== os dados ===');
  const d = await p.evaluate(() => {
    const cap = {}; LIVROS.forEach(l => cap[l.nr] = l.caps);
    const todas = [];
    GRUPOS_REF.forEach(g => g.forEach(v => todas.push(v)));
    CITACOES_REF.forEach(par => par.forEach(v => todas.push(v)));
    const ruins = todas.filter(([nr, c]) => !cap[nr] || c < 1 || c > cap[nr]);
    const cobertos = new Set(todas.map(v => v.join('-')));
    return { grupos: GRUPOS_REF.length, citacoes: CITACOES_REF.length,
             referencias: todas.length, ruins: ruins.map(v => v.join(':')),
             versiculos: cobertos.size, indice: REFS.size };
  });
  console.log('     ' + JSON.stringify(d).slice(0, 150));
  ok('nenhuma referência fora dos limites do livro', d.ruins.length === 0, d.ruins.join(' '));
  ok('há grupos e citações', d.grupos > 20 && d.citacoes > 15, d.grupos + ' grupos, ' + d.citacoes + ' citações');
  ok('o índice cobre todos os versículos citados', d.indice === d.versiculos,
     d.indice + ' no índice para ' + d.versiculos + ' versículos');

  console.log('\n=== a ligação vale nos dois sentidos ===');
  /* escrever grupos em vez de listas por versículo existe justamente para
     não ligar A→B e esquecer B→A; aqui provamos que não aconteceu */
  const assimetria = await p.evaluate(() => {
    const fora = [];
    for(const [chave, lista] of REFS){
      const [nr, cap, verso] = chave.split('-').map(Number);
      for(const { ref } of lista){
        const volta = REFS.get(ref.join('-')) || [];
        if(!volta.some(x => x.ref.join('-') === [nr, cap, verso].join('-')))
          fora.push(chave + ' → ' + ref.join('-'));
      }
    }
    return fora;
  });
  ok('toda ligação tem a de volta', assimetria.length === 0,
     assimetria.slice(0, 3).join(' | ') || 'todas simétricas');

  const semDuplicata = await p.evaluate(() => {
    for(const [, lista] of REFS){
      const vistos = new Set();
      for(const { ref } of lista){ const k = ref.join('-');
        if(vistos.has(k)) return false; vistos.add(k); }
    }
    return true;
  });
  ok('nenhum versículo aparece duas vezes na mesma lista', semDuplicata);

  const semAutoRef = await p.evaluate(() => {
    for(const [chave, lista] of REFS)
      if(lista.some(x => x.ref.join('-') === chave)) return chave;
    return null;
  });
  ok('nenhum versículo remete a si mesmo', semAutoRef === null, semAutoRef || 'ok');

  console.log('\n=== os 180 devocionais têm referência ===');
  const cobertura = await p.evaluate(() => {
    const sem = TODAS.filter(v => !REFS.has(v.join('-')));
    return { total: TODAS.length, sem: sem.length,
             exemplos: sem.slice(0, 3).map(v => livroPorNr(v[0]).nome + ' ' + v[1] + ':' + v[2]) };
  });
  ok('nenhum versículo do devocional fica sem', cobertura.sem === 0,
     cobertura.sem ? cobertura.exemplos.join(', ') : cobertura.total + '/' + cobertura.total);

  console.log('\n=== as citações vêm antes do tema ===');
  const ordem = await p.evaluate(() => {
    /* Mateus 4:4 cita Deuteronômio 8:3 */
    const l = referenciasDe(40, 4, 4);
    return { tipos: l.map(x => x.tipo), primeira: l[0] && l[0].ref.join('-') };
  });
  ok('Mateus 4:4 lista a citação primeiro', ordem.tipos[0] === 'citacao', ordem.tipos.join(','));
  ok('e ela é Deuteronômio 8:3', ordem.primeira === '5-8-3', ordem.primeira);

  console.log('\n=== o painel abre pela folha do versículo ===');
  await p.evaluate(() => { irParaAba('biblia', { semRolar: true }); return abrirLeitura(19, 23); });
  await p.waitForTimeout(800);
  await p.locator('#area-leitura .v').first().click();
  await p.waitForTimeout(500);
  ok('o botão "Veja também" está na folha', await p.locator('#fa-refs').isVisible());
  await p.click('#fa-refs');
  await p.waitForTimeout(900);
  ok('o painel abriu', await p.locator('#folha-refs:not(.oculto)').count() === 1);
  ok('a folha principal escondeu', await p.locator('#folha-principal.oculto').count() === 1);

  const itens = await p.evaluate(() =>
    [...document.querySelectorAll('#lista-refs .ref-item')].map(e => ({
      ref: e.querySelector('.ref-item-ref').textContent,
      txt: e.querySelector('.ref-item-txt').textContent })));
  console.log('     ' + itens.length + ' passagens, a primeira é ' + (itens[0] || {}).ref);
  ok('lista as passagens ligadas', itens.length >= 10, itens.length);
  ok('cada uma traz referência e texto',
     itens.every(i => /\d+:\d+/.test(i.ref) && i.txt.length > 5));
  ok('Salmos 23:1 remete a João 10:11', itens.some(i => i.ref === 'João 10:11'));
  ok('e não remete a si mesmo', !itens.some(i => i.ref === 'Salmos 23:1'));
  ok('oferece ouvir as passagens',
     await p.locator('#folha-refs .btn-ouvir').first().isVisible());

  console.log('\n=== tocar numa passagem abre a leitura dela ===');
  await p.locator('#lista-refs .ref-item').first().click();
  await p.waitForTimeout(700);
  ok('a folha fechou', !(await p.evaluate(() => $('folha-verso').classList.contains('ver'))));
  ok('e foi para a aba da Bíblia', await p.evaluate(() => abaAtual) === 'biblia');

  console.log('\n=== a referência aparece mesmo sem o texto ===');
  /* a rede é do texto; a ligação é nossa e não pode depender dela */
  /* tocar numa passagem levou a leitura para outro capítulo; voltamos ao
     Salmos 23:1, que é o versículo com ligações que este bloco testa */
  await p.evaluate(() => {
    window.buscarVerso = async () => { throw new Error('fonte fora do ar'); };
    versoAberto = { nr: 19, cap: 23, verso: 1, texto: 'O Senhor é o meu pastor.' };
    return verReferencias();
  });
  await p.waitForTimeout(900);
  const semRede = await p.evaluate(() =>
    [...document.querySelectorAll('#lista-refs .ref-item')].map(e => ({
      ref: e.querySelector('.ref-item-ref').textContent,
      falhou: e.querySelector('.ref-item-txt').classList.contains('falhou') })));
  ok('as referências continuam listadas', semRede.length >= 10, semRede.length);
  ok('e dizem que dá para abrir mesmo assim', semRede.every(x => x.falhou));
  await p.evaluate(() => fecharFolha());

  console.log('\n=== versículo sem ligação não quebra ===');
  const vazio = await p.evaluate(() => referenciasDe(65, 1, 3).length);
  ok('referenciasDe devolve lista vazia', vazio === 0, vazio);
  await p.evaluate(() => {
    versoAberto = { nr: 65, cap: 1, verso: 3, texto: 'Texto.' };
    return verReferencias();
  });
  await p.waitForTimeout(400);
  ok('e o painel explica em vez de ficar em branco',
     /Ainda não há passagens/.test(await p.locator('#lista-refs').textContent()),
     (await p.locator('#lista-refs').textContent()).slice(0, 50));

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource|fonte fora do ar/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);
  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
