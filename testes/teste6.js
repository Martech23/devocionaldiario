const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 400, height: 820 } });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);

  console.log('\n=== lista semente ===');
  const versoes = await page.evaluate(() => VERSOES.map(v => ({ id: v.id, nome: v.nome, fonte: v.fonte })));
  versoes.forEach(v => console.log('     ' + v.fonte + '/' + v.id + ' — ' + v.nome));
  ok('sobraram 4 versões', versoes.length === 4);
  ok('nenhuma é o texto de 1911', !versoes.some(v => /almeida|1911/i.test(v.id + ' ' + v.nome)));
  ok('a padrão é a Bíblia Livre', versoes[0].id === 'livre');
  ok('versaoAtual aponta para a Bíblia Livre',
     await page.evaluate(() => versaoAtual.id === 'livre'));

  console.log('\n=== filtro de ortografia arcaica ===');
  const casos = [
    ['getbible', 'almeida',      'Almeida',                       true],
    ['getbible', 'almeida1911',  'De 1911 Biblia Sagrada',        true],
    ['getbible', 'arc',          'Almeida Revista e Corrigida',   true],
    ['getbible', 'acf',          'Almeida Corrigida Fiel',        true],
    ['helloao',  'por_x',        'Biblia em Portuguez',           true],
    ['getbible', 'livre',        'Bíblia Livre',                  false],
    ['helloao',  'por_onbv',     'Nova Bíblia Viva',              false],
    ['helloao',  'por_nvt',      'Nova Versão Transformadora',    false],
    // a Bíblia Livre circula com "Almeida" no nome: não pode cair no filtro
    ['getbible', 'blivre',       'Bíblia Almeida - BLIVRE',       false],
    ['helloao',  'por_blivre',   'Almeida Bíblia Livre',          false],
    ['helloao',  'por_x2',       'Antiga e Nova Aliança',         false],
    ['helloao',  'por_ntlh',     'Nova Tradução na Linguagem de Hoje', false]
  ];
  for (const [fonte, id, nome, esperaBloqueio] of casos) {
    const bloqueada = await page.evaluate(([id, nome]) => ehArcaica({ id, nome }), [id, nome]);
    ok((esperaBloqueio ? 'bloqueia' : 'aceita ') + ' "' + nome + '"', bloqueada === esperaBloqueio);
  }

  console.log('\n=== o catálogo remoto não traz o arcaico de volta ===');
  const antes = await page.evaluate(() => VERSOES.length);
  const add = await page.evaluate(() => acrescentar([
    { fonte: 'getbible', id: 'almeida', nome: 'Almeida', licenca: 'domínio público' },
    { fonte: 'getbible', id: 'almeida1911', nome: 'De 1911 Biblia Sagrada', licenca: 'GPL' },
    { fonte: 'helloao', id: 'por_nova', nome: 'Tradução Moderna Livre', licenca: 'Uso livre' }
  ]));
  const depois = await page.evaluate(() => VERSOES.map(v => v.id));
  console.log('     versões agora:', depois.join(', '));
  ok('só a moderna entrou', add === 1);
  ok('o total subiu de ' + antes + ' para ' + depois.length, depois.length === antes + 1);
  ok('almeida continua fora', !depois.includes('almeida'));
  ok('a moderna entrou mesmo', depois.includes('por_nova'));

  console.log('\n=== seletor da tela ===');
  const opcoes = await page.evaluate(() =>
    [...document.querySelectorAll('#sel-versao option')].map(o => o.textContent));
  opcoes.forEach(o => console.log('     ' + o));
  ok('seletor não oferece nada arcaico', !opcoes.some(t => /almeida|1911|corrigida/i.test(t)));
  ok('seletor lista as versões disponíveis', opcoes.length === depois.length);

  console.log('\n=== fonte reserva em português arcaico ===');
  ok('versoReserva não existe mais',
     await page.evaluate(() => typeof window.versoReserva === 'undefined'));
  ok('constante RESERVA não existe mais',
     await page.evaluate(() => typeof window.RESERVA === 'undefined'));
  ok('fallback aponta para a Bíblia Livre', await page.evaluate(() => {
    const fonte = buscarCapitulo.toString();
    return fonte.includes("v.id === 'livre'") && !fonte.includes("v.id === 'almeida'");
  }));

  console.log('\n=== quando tudo falha, erro honesto ===');
  const msg = await page.evaluate(async () => {
    window.buscarCapituloEm = async () => { throw new Error('fonte fora do ar'); };
    try { await buscarVerso(43, 3, 16); return 'não lançou'; }
    catch (e) { return e.message; }
  });
  console.log('     mensagem:', JSON.stringify(msg));
  ok('propaga o erro em vez de servir texto de 1911', /fora do ar/.test(msg));

  console.log('\n=== erros de JS ===');
  const relevantes = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  relevantes.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', relevantes.length === 0);

  await browser.close();
})();
