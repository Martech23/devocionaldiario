const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Continuar de onde parou, e a primeira visita */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
const VERSO = () => `window.buscarVerso = async () => ({ texto: 'Deus supre toda necessidade.', versao: 'Biblia Livre' }); return versiculoDoDia();`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };
  const erros = [];

  const abrir = async (semear) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await p.addInitScript(MOCK);
    if (semear) await p.addInitScript(semear);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(1000);
    await p.evaluate(new Function(VERSO()));
    await p.waitForTimeout(400);
    return p;
  };

  console.log('\n=== primeira visita: nada de placar zerado ===');
  let p = await abrir();
  await p.evaluate(() => irParaAba('meu', { semRolar: true }));
  await p.waitForTimeout(300);
  ok('mostra as boas-vindas', await p.locator('#boas-vindas').isVisible());
  ok('esconde os quatro zeros', !(await p.locator('#grid-stats').isVisible()));
  ok('esconde a frase da sequência', !(await p.locator('#stat-msg').isVisible()));
  ok('e o "Ouvir meu resumo", que leria os zeros',
     !(await p.locator('#linha-ouvir-stats').isVisible()));
  ok('o botão leva ao devocional', await p.locator('#btn-comecar').isVisible());
  await p.locator('#btn-comecar').click();
  await p.waitForTimeout(600);
  ok('e troca para a aba Hoje', await p.evaluate(() => abaAtual) === 'hoje');

  console.log('\n=== com qualquer atividade, o placar volta ===');
  await p.evaluate(() => { registrarAtividade(); atualizarStats(); irParaAba('meu', { semRolar: true }); });
  await p.waitForTimeout(400);
  ok('placar aparece', await p.locator('#grid-stats').isVisible());
  ok('boas-vindas somem', !(await p.locator('#boas-vindas').isVisible()));
  ok('a sequência conta 1', await p.locator('#stat-streak').textContent() === '1');
  ok('o resumo falado volta', await p.locator('#linha-ouvir-stats').isVisible());
  await p.close();

  console.log('\n=== saudação por horário ===');
  for(const [h, esperado] of [[3,'Boa madrugada'], [9,'Bom dia'], [15,'Boa tarde'], [21,'Boa noite']]){
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    await q.addInitScript(MOCK);
    await q.addInitScript(`{ const R = Date; const fixo = new R(2026, 0, 15, ${h}, 30);
      window.Date = class extends R { constructor(...a){ return a.length ? new R(...a) : new R(fixo); } };
      window.Date.now = () => fixo.getTime(); }`);
    await q.goto(BASE + '/index.html');
    await q.waitForTimeout(900);
    ok(h + 'h → ' + esperado, (await q.locator('#saudacao').textContent()) === esperado,
       await q.locator('#saudacao').textContent());
    await q.close();
  }

  console.log('\n=== continuar: sem plano, não aparece ===');
  p = await abrir();
  ok('seção fica escondida', !(await p.locator('#sec-continuar').isVisible()));
  await p.close();

  console.log('\n=== continuar: com plano em andamento ===');
  const semear = `localStorage.setItem('lampada-planos-progresso', JSON.stringify({ joao7: [1,2,3] }));
                  localStorage.setItem('lampada-plano-atual', 'joao7');`;
  p = await abrir(semear);
  ok('a seção aparece', await p.locator('#sec-continuar').isVisible());
  ok('na aba Hoje', await p.evaluate(() => abaDe('sec-continuar')) === 'hoje');
  ok('logo abaixo do devocional', await p.evaluate(() =>
     $('sec-hoje').compareDocumentPosition($('sec-continuar')) & Node.DOCUMENT_POSITION_FOLLOWING) > 0);
  ok('diz o nome do plano',
     (await p.locator('.continuar-nome').textContent()) === 'Evangelho de João');
  ok('quantos dias e a porcentagem',
     /3 de 7 dias · 43%/.test(await p.locator('.continuar-meta').textContent()),
     await p.locator('.continuar-meta').textContent());
  ok('a barra reflete o progresso',
     await p.evaluate(() => document.querySelector('.continuar-barra span').style.width) === '43%');
  ok('a barra é acessível',
     await p.getAttribute('.continuar-barra', 'aria-valuenow') === '43' &&
     await p.getAttribute('.continuar-barra', 'role') === 'progressbar');

  /* o próximo é o primeiro que falta, não o seguinte ao último marcado */
  ok('oferece o dia 4', /^Dia 4 · /.test(await p.locator('.continuar-ref').textContent()),
     await p.locator('.continuar-ref').textContent());
  await p.close();

  console.log('\n=== marcar fora de ordem não confunde o próximo ===');
  p = await abrir(`localStorage.setItem('lampada-planos-progresso', JSON.stringify({ joao7: [1,2,5,6] }));
                   localStorage.setItem('lampada-plano-atual', 'joao7');`);
  ok('pula para o dia 3, que é o que falta',
     /^Dia 3 · /.test(await p.locator('.continuar-ref').textContent()),
     await p.locator('.continuar-ref').textContent());
  ok('e a conta é 4 de 7',
     /4 de 7 dias/.test(await p.locator('.continuar-meta').textContent()));
  await p.close();

  console.log('\n=== plano terminado sai da lista ===');
  p = await abrir(`localStorage.setItem('lampada-planos-progresso', JSON.stringify({ joao7: [1,2,3,4,5,6,7] }));
                   localStorage.setItem('lampada-plano-atual', 'joao7');`);
  ok('não oferece continuar um plano concluído',
     !(await p.locator('#sec-continuar').isVisible()));
  await p.close();

  console.log('\n=== dois planos: manda o último aberto ===');
  p = await abrir(`localStorage.setItem('lampada-planos-progresso', JSON.stringify({ joao7: [1,2,3,4,5], salmos21: [1] }));
                   localStorage.setItem('lampada-plano-atual', 'salmos21');`);
  ok('escolhe o marcado como atual, não o mais adiantado',
     (await p.locator('.continuar-nome').textContent()) === 'Salmos de confiança',
     await p.locator('.continuar-nome').textContent());
  /* sem a marca — outro aparelho, por exemplo — vale o mais adiantado */
  await p.evaluate(() => { localStorage.removeItem('lampada-plano-atual'); montarContinuar(); });
  await p.waitForTimeout(250);
  ok('sem a marca, cai no mais adiantado',
     (await p.locator('.continuar-nome').textContent()) === 'Evangelho de João',
     await p.locator('.continuar-nome').textContent());
  await p.close();

  console.log('\n=== os botões levam para onde dizem ===');
  p = await abrir(semear);
  await p.locator('.continuar-acoes .btn').last().click();   // Ver o plano
  await p.waitForTimeout(700);
  ok('"Ver o plano" vai para a aba Planos', await p.evaluate(() => abaAtual) === 'planos');
  ok('e abre o plano certo', await p.locator('#area-plano-ativo h3').textContent() === 'Evangelho de João');
  await p.close();

  console.log('\n=== marcar um dia atualiza o cartão ===');
  p = await abrir(semear);
  ok('antes, dia 4', /Dia 4/.test(await p.locator('.continuar-ref').textContent()));
  await p.evaluate(() => {
    const prog = carregarProgPlanos(); prog.joao7 = [1,2,3,4]; salvarProgPlanos(prog); montarContinuar();
  });
  await p.waitForTimeout(300);
  ok('depois, dia 5', /Dia 5/.test(await p.locator('.continuar-ref').textContent()),
     await p.locator('.continuar-ref').textContent());
  ok('e a barra andou',
     await p.evaluate(() => document.querySelector('.continuar-barra span').style.width) === '57%');
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);
  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
