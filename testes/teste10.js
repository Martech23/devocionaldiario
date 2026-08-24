const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
/* o app monta o devocional na inicialização, antes de qualquer stub:
   simulamos a busca e remontamos explicitamente */
const SIMULAR = () => `window.buscarVerso = async () => ({ texto: 'Porque para Deus nada e impossivel neste dia.', versao: 'Biblia Livre' }); return versiculoDoDia();`;
(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type()==='error') erros.push(m.text()); });
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1000);
  await p.evaluate(new Function(SIMULAR()));
  await p.waitForTimeout(500);
  let OK=0,F=0; const ok=(n,v)=>{v?OK++:F++;console.log((v?'  OK  ':' FALHA')+' | '+n);};
  /* o rótulo do passo carrega o chip do tema ao lado; aqui interessa só o
     nome do passo, então lemos o nó de texto e não o textContent inteiro */
  const rotulo = () => p.evaluate(() =>
    document.querySelector('#cartao-hoje .rotulo-passo').firstChild.textContent.trim());

  console.log('\n=== percurso é o padrão ===');
  ok('modo padrão é percurso', await p.evaluate(() => modoDevocional() === 'percurso'));
  ok('trilha aparece', await p.locator('#cartao-hoje .trilha').count() === 1);
  ok('quatro pontos', await p.locator('#cartao-hoje .trilha .ponto').count() === 4);
  ok('primeiro ponto é o atual', await p.locator('#cartao-hoje .trilha .ponto').first().evaluate(e => e.classList.contains('atual')));
  const tempo = await p.locator('.tempo-percurso').textContent();
  console.log('     estimativa:', tempo);
  ok('mostra estimativa em minutos', /\d+(–\d+)? min/.test(tempo));
  ok('rótulo do passo 1', (await rotulo()) === 'Versículo do dia');
  ok('não há botão Voltar no primeiro passo', await p.locator('.voltar-passo').count() === 0);
  ok('acessibilidade: progressbar', await p.getAttribute('#cartao-hoje .trilha','aria-valuenow') === '1');

  console.log('\n=== avançar passo a passo ===');
  const rotulos = [];
  for (let k = 0; k < 3; k++) {
    await p.locator('#cartao-hoje .navega-passo .btn').click();
    await p.waitForTimeout(350);
    rotulos.push(await rotulo());
  }
  console.log('     percorrido:', rotulos.join(' → '));
  ok('segue Reflexão, Para meditar, Oração', rotulos.join(',') === 'Reflexão,Para meditar,Oração');
  ok('ponto atual acompanha', await p.locator('#cartao-hoje .trilha .ponto').nth(3).evaluate(e => e.classList.contains('atual')));
  ok('pontos anteriores ficam feitos', await p.locator('#cartao-hoje .trilha .ponto.feito').count() === 3);
  ok('último passo diz Concluir', /Concluir/.test(await p.locator('#cartao-hoje .navega-passo .btn').textContent()));
  await p.screenshot({ path: 'percurso-passo.png' });

  console.log('\n=== conclusão ===');
  await p.locator('#cartao-hoje .navega-passo .btn').click();
  await p.waitForTimeout(400);
  ok('mostra a tela de conclusão', await p.locator('.fim-percurso').count() === 1);
  ok('registra o dia', await p.evaluate(() => carregarAtividade().includes(hojeISO())));
  ok('oferece registrar pedido e percorrer de novo', await p.locator('.acoes-fim .btn-ouvir').count() === 2);
  await p.screenshot({ path: 'percurso-fim.png' });

  console.log('\n=== percorrer de novo ===');
  await p.locator('.acoes-fim .btn-ouvir').nth(1).click();
  await p.waitForTimeout(350);
  ok('volta ao passo 1', (await rotulo()) === 'Versículo do dia');

  console.log('\n=== ouvir e seguir ===');
  await p.evaluate(() => { window.__falas = []; window.__dur = 250; });
  await p.locator('#cartao-hoje .navega-passo .btn-ouvir').click();
  /* Em vez de espiar num instante exato — que depende de quantos pedaços a
     voz fez de cada bloco — acompanhamos a tela e guardamos por onde ela
     passou. A asserção é sobre o caminho, não sobre o relógio. */
  const passou = [];
  for (let k = 0; k < 25; k++) {
    await p.waitForTimeout(85);
    const r = await p.evaluate(() => {
      const el = document.querySelector('#cartao-hoje .rotulo-passo');
      return el ? el.firstChild.textContent.trim() : (document.querySelector('.fim-percurso') ? 'FIM' : null);
    });
    if (r && r !== passou[passou.length - 1]) passou.push(r);
  }
  console.log('     caminho:', passou.join(' → '));
  ok('a tela percorreu os quatro passos sozinha',
     passou.join(',') === 'Versículo do dia,Reflexão,Para meditar,Oração,FIM');
  const falas = await p.evaluate(() => window.__falas.map(f => f.text));
  ok('leu os quatro blocos', ['nada e impossivel','Reflexão.','Para meditar.','Oração.'].every(t => falas.some(f => f.includes(t))));
  ok('terminou na conclusão', await p.locator('.fim-percurso').count() === 1);
  await p.evaluate(() => Voz.parar());

  console.log('\n=== alternar para ver tudo ===');
  await p.locator('.alternar-modo').click();
  await p.waitForTimeout(500);
  ok('mostra o formato antigo', await p.locator('#cartao-hoje .bloco-devo').count() === 3);
  ok('preferência gravada', await p.evaluate(() => localStorage.getItem('lampada-devo-modo') === 'tudo'));
  ok('trilha some', await p.locator('#cartao-hoje .trilha').count() === 0);
  await p.reload(); await p.waitForTimeout(1000);
  await p.evaluate(new Function(SIMULAR()));
  await p.waitForTimeout(500);
  ok('a escolha sobrevive ao recarregar', await p.locator('#cartao-hoje .bloco-devo').count() === 3);
  await p.locator('.alternar-modo').click();
  await p.waitForTimeout(500);
  ok('volta ao percurso', await p.locator('#cartao-hoje .trilha').count() === 1);

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   '+e));
  ok('sem erros de JS', rel.length === 0);
  console.log('\n=== TOTAL: '+OK+' asserções, '+F+' falhas ===');
  await b.close(); process.exit(F?1:0);
})();
