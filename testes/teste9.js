const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Painel de conta e mesclagem, com a API interceptada pelo Playwright. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));

  /* servidor de mentira, com estado no processo de teste */
  const servidor = { usuario: null, dados: null, contas: {}, puts: 0 };
  const responder = (route, status, corpo) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });

  await page.route('**/api/conta', async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.acao === 'registrar') {
      if (!b.consentimento) return responder(route, 400, { erro: 'É preciso aceitar a guarda dos seus dados devocionais' });
      if (servidor.contas[b.email]) return responder(route, 409, { erro: 'Já existe uma conta com esse e-mail' });
      servidor.contas[b.email] = b.senha;
      servidor.usuario = { id: 'u1', email: b.email };
      return responder(route, 201, { usuario: servidor.usuario });
    }
    if (b.acao === 'entrar') {
      if (servidor.contas[b.email] !== b.senha) return responder(route, 401, { erro: 'E-mail ou senha incorretos' });
      servidor.usuario = { id: 'u1', email: b.email };
      return responder(route, 200, { usuario: servidor.usuario });
    }
    if (b.acao === 'eu')      return responder(route, 200, { usuario: servidor.usuario });
    if (b.acao === 'sair')  { servidor.usuario = null; return responder(route, 200, { ok: true }); }
    if (b.acao === 'excluir'){ servidor.usuario = null; servidor.dados = null; servidor.contas = {}; return responder(route, 200, { ok: true }); }
    return responder(route, 400, { erro: 'Ação desconhecida' });
  });

  await page.route('**/api/sincronizar', async route => {
    if (!servidor.usuario) return responder(route, 401, { erro: 'Entre na conta primeiro' });
    if (route.request().method() === 'GET') return responder(route, 200, { dados: servidor.dados });
    servidor.puts++;
    servidor.dados = JSON.parse(route.request().postData() || '{}').dados;
    return responder(route, 200, { ok: true, atualizadoEm: new Date().toISOString() });
  });

  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  let OK = 0, F = 0;
  const ok = (n, v) => { v ? OK++ : F++; console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n); };

  console.log('\n=== o app funciona sem conta ===');
  ok('painel de conta existe', await page.locator('#painel-conta').count() === 1);
  ok('começa fechado', await page.locator('#painel-conta.aberto').count() === 0);
  ok('sem usuário', await page.evaluate(() => Conta.usuario === null));
  ok('mostra o formulário, não o painel logado',
     await page.locator('#conta-deslogado:not(.oculto)').count() === 1 &&
     await page.locator('#conta-logado.oculto').count() === 1);

  console.log('\n=== abrir pelo cabeçalho ===');
  await page.click('#btn-abrir-conta');
  await page.waitForTimeout(600);
  ok('painel abriu', await page.locator('#painel-conta.aberto').count() === 1);
  ok('aria-hidden virou false', await page.getAttribute('#painel-conta', 'aria-hidden') === 'false');

  console.log('\n=== consentimento é obrigatório ===');
  await page.fill('#conta-email', 'maria@exemplo.com');
  await page.fill('#conta-senha', 'senhaforte1');
  await page.click('#btn-criar-conta');
  await page.waitForTimeout(400);
  ok('sem marcar, não cria', await page.evaluate(() => Conta.usuario === null));
  ok('explica o que falta', /Marque a autorização/.test(await page.locator('#conta-erro').textContent()));
  ok('a caixa é destacada', await page.locator('#linha-consentimento.faltando').count() === 1);

  console.log('\n=== criar conta ===');
  /* dados locais antes de ter conta: não podem sumir */
  await page.evaluate(() => {
    localStorage.setItem('lampada-favoritos', JSON.stringify([{ chave: '43:3:16', nr: 43, cap: 3, verso: 16, texto: 'local', ref: 'João 3:16', data: '2026-08-01T00:00:00Z' }]));
    localStorage.setItem('lampada-atividade-dias', JSON.stringify(['2026-08-01']));
    localStorage.setItem('lampada-capitulos-lidos', JSON.stringify({ '43:3': true }));
  });
  await page.check('#conta-consentimento');
  await page.click('#btn-criar-conta');
  await page.waitForTimeout(700);
  ok('conta criada', await page.evaluate(() => Conta.usuario && Conta.usuario.email === 'maria@exemplo.com'));
  ok('painel troca para o estado logado',
     await page.locator('#conta-logado:not(.oculto)').count() === 1);
  ok('mostra o e-mail', (await page.locator('#conta-quem').textContent()) === 'maria@exemplo.com');
  ok('enviou os dados locais no cadastro', servidor.dados !== null);
  ok('o favorito local foi para o servidor',
     servidor.dados.favoritos.some(f => f.chave === '43:3:16'));

  console.log('\n=== mesclagem sem perder nada ===');
  const mesclado = await page.evaluate(() => Conta.mesclarDados(
    {
      favoritos: [{ chave: 'A', data: '2026-01-01' }, { chave: 'B', data: '2026-01-01' }],
      notas: { v1: { texto: 'local novo', data: '2026-08-01' }, v2: { texto: 'só local', data: '2026-01-01' } },
      destaques: { x: 'amarelo' },
      oracoes: [{ id: 'o1', texto: 'local' }],
      capitulosLidos: { '1:1': true },
      atividade: ['2026-08-01', '2026-08-02'],
      planos: { joao7: [1, 2] }
    },
    {
      favoritos: [{ chave: 'B', data: '2026-01-01' }, { chave: 'C', data: '2026-01-01' }],
      notas: { v1: { texto: 'remoto velho', data: '2026-02-01' }, v3: { texto: 'só remoto', data: '2026-01-01' } },
      destaques: { x: 'verde', y: 'azul' },
      oracoes: [{ id: 'o2', texto: 'remoto' }],
      capitulosLidos: { '2:1': true },
      atividade: ['2026-08-02', '2026-08-03'],
      planos: { joao7: [2, 3], nt40: [1] }
    }
  ));
  ok('favoritos: união dos dois lados (A, B, C)',
     mesclado.favoritos.map(f => f.chave).sort().join(',') === 'A,B,C');
  ok('nota em conflito fica a mais recente', mesclado.notas.v1.texto === 'local novo');
  ok('nota só local sobrevive', mesclado.notas.v2.texto === 'só local');
  ok('nota só remota sobrevive', mesclado.notas.v3.texto === 'só remoto');
  ok('destaque em conflito fica o do aparelho', mesclado.destaques.x === 'amarelo');
  ok('destaque só remoto sobrevive', mesclado.destaques.y === 'azul');
  ok('orações: união por id', mesclado.oracoes.map(o => o.id).sort().join(',') === 'o1,o2');
  ok('capítulos lidos somam', mesclado.capitulosLidos['1:1'] && mesclado.capitulosLidos['2:1']);
  ok('atividade vira união sem repetir',
     mesclado.atividade.join(',') === '2026-08-01,2026-08-02,2026-08-03');
  ok('progresso de plano soma os dias',
     mesclado.planos.joao7.join(',') === '1,2,3' && mesclado.planos.nt40.join(',') === '1');

  console.log('\n=== entrar noutro aparelho não apaga o que já existe ===');
  const vindo = await page.evaluate(() => {
    const local = { favoritos: [{ chave: 'novo-aparelho', data: '2026-08-09' }], notas: {}, destaques: {},
                    oracoes: [], capitulosLidos: {}, atividade: [], planos: {} };
    const remoto = { favoritos: [{ chave: 'antigo', data: '2026-01-01' }], notas: {}, destaques: {},
                     oracoes: [], capitulosLidos: {}, atividade: [], planos: {} };
    return Conta.mesclarDados(local, remoto).favoritos.map(f => f.chave).sort();
  });
  ok('os dois sobrevivem', vindo.join(',') === 'antigo,novo-aparelho');
  ok('servidor vazio não apaga o local', await page.evaluate(() =>
    Conta.mesclarDados({ favoritos: [{ chave: 'z' }] }, null).favoritos.length === 1));

  console.log('\n=== mudança local vira envio ===');
  const antesPuts = servidor.puts;
  await page.evaluate(() => {
    alternarFavorito({ nr: 19, cap: 23, verso: 1, texto: 'novo', versao: 'v', ref: 'Salmos 23:1' });
  });
  await page.waitForTimeout(200);
  ok('marca que há pendência', await page.evaluate(() => Conta.sujo === true));
  await page.waitForTimeout(4600);
  ok('envia sozinho depois de alguns segundos', servidor.puts > antesPuts);
  ok('a pendência é baixada', await page.evaluate(() => Conta.sujo === false));
  ok('o servidor recebeu o favorito novo',
     servidor.dados.favoritos.some(f => f.chave === '19:23:1'));

  console.log('\n=== sair não apaga o aparelho ===');
  await page.click('#btn-sair-conta');
  await page.waitForTimeout(600);
  ok('saiu', await page.evaluate(() => Conta.usuario === null));
  ok('voltou ao formulário', await page.locator('#conta-deslogado:not(.oculto)').count() === 1);
  ok('os favoritos continuam no aparelho', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-favoritos')).length >= 2));

  console.log('\n=== entrar de novo traz de volta ===');
  await page.evaluate(() => { localStorage.setItem('lampada-favoritos', '[]'); renderFavoritos(); });
  await page.fill('#conta-email', 'maria@exemplo.com');
  await page.fill('#conta-senha', 'senhaforte1');
  await page.click('#btn-entrar-conta');
  await page.waitForTimeout(800);
  ok('entrou', await page.evaluate(() => Conta.usuario !== null));
  ok('o histórico voltou do servidor', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-favoritos')).length >= 2));

  console.log('\n=== senha errada ===');
  await page.click('#btn-sair-conta');
  await page.waitForTimeout(500);
  await page.fill('#conta-email', 'maria@exemplo.com');
  await page.fill('#conta-senha', 'errada');
  await page.click('#btn-entrar-conta');
  await page.waitForTimeout(500);
  ok('não entra', await page.evaluate(() => Conta.usuario === null));
  ok('mostra o erro do servidor',
     /E-mail ou senha incorretos/.test(await page.locator('#conta-erro').textContent()));

  console.log('\n=== erros de JS ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await browser.close();
  process.exit(F ? 1 : 0);
})();
