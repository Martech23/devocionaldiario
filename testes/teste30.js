const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* O botão voltar do celular recua dentro do app, não fecha o app */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async () => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    /* uma página de verdade antes do app: com âncora (#) o voltar seria
       navegação no mesmo documento e o teste não conseguiria distinguir
       "saiu do app" de "só mudou o pedaço da URL" */
    await p.goto(BASE + '/privacidade.html');
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    return p;
  };

  /* o que está na tela agora, em uma linha */
  const onde = (p) => p.evaluate(() => ({
    aba: (document.querySelector('#abas button.ativo') || {}).dataset ? document.querySelector('#abas button.ativo').dataset.aba : null,
    nivel: ['livros','capitulos','leitura'].find(n => !$('nivel-' + n).classList.contains('oculto')),
    folha: $('folha-verso').classList.contains('ver'),
    painel: ['folha-nota','folha-comparar','folha-refs'].find(id => !$(id).classList.contains('oculto')) || null,
    gaveta: $('gaveta').classList.contains('aberta'),
    imagem: $('modal-img').classList.contains('aberto'),
    camadas: Navegacao.camadas().join('>'),
    noApp: !!document.getElementById('sec-hoje')
  }));

  const voltar = async (p, n = 1) => {
    for(let i = 0; i < n; i++){ await p.goBack(); await p.waitForTimeout(320); }
  };

  console.log('\n=== o caminho completo: aba → livro → capítulo → versículo ===');
  /* Era isto o defeito: quatro passos de navegação e o histórico ficava
     exatamente como estava ao carregar. O voltar do Android fechava o
     app no meio da leitura. */
  let p = await abrir();
  ok('começa sem camada nenhuma', (await onde(p)).camadas === '', (await onde(p)).camadas);

  await p.evaluate(() => irParaAba('biblia'));
  await p.waitForTimeout(250);
  await p.evaluate(() => abrirCapitulos(LIVROS.find(l => l.nr === 43)));
  await p.waitForTimeout(250);
  await p.evaluate(() => abrirLeitura(43, 3));
  await p.waitForTimeout(700);
  await p.evaluate(() => abrirFolhaVerso(43, 3, 16, 'Porque Deus amou o mundo'));
  await p.waitForTimeout(300);

  let e = await onde(p);
  ok('as quatro camadas estão empilhadas', e.camadas === 'aba>nivel>nivel>folha', e.camadas);
  ok('e a folha está aberta sobre o capítulo', e.folha && e.nivel === 'leitura');

  await voltar(p, 1);
  e = await onde(p);
  ok('1º voltar: fecha a folha e continua no capítulo',
     !e.folha && e.nivel === 'leitura' && e.noApp, JSON.stringify(e));

  await voltar(p, 1);
  e = await onde(p);
  ok('2º voltar: sobe para a lista de capítulos', e.nivel === 'capitulos', e.nivel);

  await voltar(p, 1);
  e = await onde(p);
  ok('3º voltar: sobe para a lista de livros', e.nivel === 'livros', e.nivel);

  await voltar(p, 1);
  e = await onde(p);
  ok('4º voltar: volta para a aba Hoje', e.aba === 'hoje', e.aba);
  ok('e ainda estamos dentro do app', e.noApp);
  ok('sem camada sobrando', e.camadas === '', e.camadas);

  /* só agora é que o voltar tem o direito de sair */
  await p.goBack();
  await p.waitForTimeout(400);
  ok('5º voltar: aí sim sai do app', /privacidade/.test(p.url()), p.url());
  await p.close();

  console.log('\n=== fechar pelo app consome a mesma entrada ===');
  /* Se o X não consumisse a entrada, o voltar seguinte não faria nada
     visível — a pessoa apertaria duas vezes para sair de um lugar só. */
  p = await abrir();
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
  await p.waitForTimeout(700);
  await p.evaluate(() => abrirFolhaVerso(43, 3, 16, 'texto'));
  await p.waitForTimeout(250);
  ok('folha empilhada', (await onde(p)).camadas.endsWith('folha'));
  await p.evaluate(() => fecharFolha());
  await p.waitForTimeout(350);
  e = await onde(p);
  ok('fechar pelo app fecha a folha', !e.folha);
  ok('e tira a camada do histórico', !e.camadas.endsWith('folha'), e.camadas);
  await voltar(p, 1);
  e = await onde(p);
  ok('o voltar seguinte já sobe de nível, sem passo em falso',
     e.nivel !== 'leitura', e.nivel);
  await p.close();

  console.log('\n=== o mesmo para o toque no fundo escuro e o Esc ===');
  for(const [nome, fechar] of [
    ['toque no fundo', p2 => p2.evaluate(() => $('fundo-folha').click())],
    ['tecla Esc',      p2 => p2.keyboard.press('Escape')]
  ]){
    const pg = await abrir();
    await pg.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
    await pg.waitForTimeout(700);
    await pg.evaluate(() => abrirFolhaVerso(43, 3, 16, 'texto'));
    await pg.waitForTimeout(250);
    await fechar(pg);
    await pg.waitForTimeout(350);
    const r = await onde(pg);
    ok(nome + ': fecha e libera a entrada', !r.folha && !r.camadas.endsWith('folha'), r.camadas);
    await pg.close();
  }

  console.log('\n=== os painéis dentro da folha também são um passo ===');
  /* quem abre a nota e aperta voltar espera perder a nota, não a folha */
  p = await abrir();
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { abrirFolhaVerso(43, 3, 16, 'texto'); });
  await p.waitForTimeout(250);
  await p.evaluate(() => $('fa-nota').click());
  await p.waitForTimeout(250);
  e = await onde(p);
  ok('a nota está aberta dentro da folha', e.painel === 'folha-nota', e.painel);
  ok('e virou uma camada', e.camadas.endsWith('folha>painel'), e.camadas);
  await voltar(p, 1);
  e = await onde(p);
  ok('voltar fecha só a nota', e.painel === null && e.folha, JSON.stringify({ painel: e.painel, folha: e.folha }));
  await voltar(p, 1);
  ok('o voltar seguinte fecha a folha', !(await onde(p)).folha);
  await p.close();

  console.log('\n=== a gaveta ===');
  p = await abrir();
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(300);
  ok('abriu', (await onde(p)).gaveta);
  await voltar(p, 1);
  e = await onde(p);
  ok('voltar fecha a gaveta em vez de sair do app', !e.gaveta && e.noApp);
  ok('sem camada sobrando', e.camadas === '', e.camadas);
  /* e fechar pelo X não deixa entrada pendurada */
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(250);
  await p.evaluate(() => abrirMenu(false));
  await p.waitForTimeout(350);
  ok('fechar pelo app também limpa', (await onde(p)).camadas === '', (await onde(p)).camadas);
  await p.close();

  console.log('\n=== o gerador de imagem ===');
  p = await abrir();
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
  await p.waitForTimeout(700);
  await p.evaluate(() => abrirFolhaVerso(43, 3, 16, 'Porque Deus amou o mundo'));
  await p.waitForTimeout(250);
  /* Imagem deixou de ser um botão da grade e virou uma das duas escolhas
     de Compartilhar: o caminho passa pelo painel de envio. */
  await p.evaluate(() => $('fa-enviar').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => $('fa-enviar-imagem').click());
  await p.waitForTimeout(900);
  e = await onde(p);
  ok('a folha sai e o gerador entra', e.imagem && !e.folha, JSON.stringify({ imagem: e.imagem, folha: e.folha }));
  /* a folha cede a entrada dela em vez de somar outra: senão o voltar
     reabriria uma folha que ninguém viu sair */
  ok('sem entrada pendurada da folha', !/folha/.test(e.camadas), e.camadas);
  await voltar(p, 1);
  e = await onde(p);
  ok('voltar fecha o gerador e devolve o capítulo',
     !e.imagem && e.nivel === 'leitura' && e.noApp, JSON.stringify(e));
  await p.close();

  console.log('\n=== o botão "Livros" sobe dois degraus de uma vez ===');
  p = await abrir();
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
  await p.waitForTimeout(700);
  ok('estamos na leitura', (await onde(p)).nivel === 'leitura');
  await p.evaluate(() => $('btn-livros').click());
  await p.waitForTimeout(400);
  e = await onde(p);
  ok('vai direto para os livros, não para os capítulos', e.nivel === 'livros', e.nivel);
  ok('e consome os dois degraus do histórico', !/nivel/.test(e.camadas), e.camadas);
  await voltar(p, 1);
  ok('o voltar seguinte já volta para Hoje', (await onde(p)).aba === 'hoje', (await onde(p)).aba);
  await p.close();

  console.log('\n=== passear pelas abas não empilha uma por aba ===');
  /* senão sair do app exigiria um voltar para cada aba visitada */
  p = await abrir();
  for(const a of ['biblia', 'planos', 'meu', 'biblia', 'planos']){
    await p.evaluate(x => irParaAba(x), a);
    await p.waitForTimeout(150);
  }
  e = await onde(p);
  ok('cinco trocas de aba, uma camada só', e.camadas === 'aba', e.camadas);
  await voltar(p, 1);
  e = await onde(p);
  ok('um voltar devolve para Hoje', e.aba === 'hoje' && e.noApp, e.aba);
  /* e voltar para Hoje pela barra de abas também libera a entrada */
  await p.evaluate(() => irParaAba('meu'));
  await p.waitForTimeout(200);
  await p.evaluate(() => irParaAba('hoje'));
  await p.waitForTimeout(350);
  ok('tocar em Hoje na barra também limpa', (await onde(p)).camadas === '', (await onde(p)).camadas);
  await p.close();

  console.log('\n=== dois toques rápidos no X não levam a camada de baixo ===');
  p = await abrir();
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
  await p.waitForTimeout(700);
  await p.evaluate(() => abrirFolhaVerso(43, 3, 16, 'texto'));
  await p.waitForTimeout(250);
  await p.evaluate(() => { fecharFolha(); fecharFolha(); fecharFolha(); });
  await p.waitForTimeout(450);
  e = await onde(p);
  ok('a folha fechou', !e.folha);
  ok('e o capítulo continua aberto', e.nivel === 'leitura', e.nivel);
  await p.close();

  console.log('\n=== o link de versículo compartilhado ===');
  /* chega direto na leitura: o voltar tem de subir pelos níveis, não
     jogar a pessoa para fora de um app que ela acabou de abrir */
  p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e2 => erros.push(e2.message));
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html?v=43.3.16');
  await p.waitForTimeout(1400);
  e = await onde(p);
  ok('abriu no capítulo certo', e.aba === 'biblia' && e.nivel === 'leitura', JSON.stringify(e));
  ok('e o endereço foi limpo', !/[?]v=/.test(p.url()), p.url());
  ok('com os degraus empilhados', e.camadas === 'aba>nivel>nivel', e.camadas);
  await voltar(p, 1);
  ok('voltar sobe para os capítulos', (await onde(p)).nivel === 'capitulos', (await onde(p)).nivel);
  await p.close();

  console.log('\n=== o link do menu lateral leva mesmo à seção ===');
  /* Esta é a regressão que a primeira versão causou: a gaveta saía pelo
     voltar do navegador, que só chega no quadro seguinte, e no meio
     disso a troca de aba era empilhada — o voltar levava as duas, e o
     link não ia a lugar nenhum. */
  p = await abrir();
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelector('.gaveta a[href="#sec-stats"]').click());
  await p.waitForTimeout(600);
  e = await onde(p);
  ok('a gaveta fechou', !e.gaveta);
  ok('e a aba mudou para Meu', e.aba === 'meu', e.aba);
  ok('a seção está visível',
     await p.evaluate(() => { const el = $('sec-stats'); return !!el && !el.hidden; }));
  ok('uma camada só ficou empilhada', e.camadas === 'aba', e.camadas);
  await voltar(p, 1);
  ok('e o voltar devolve para Hoje', (await onde(p)).aba === 'hoje');
  await p.close();

  console.log('\n=== os painéis que cobrem a gaveta ===');
  /* abrem por cima dela: um toque não pode custar dois voltares */
  for(const [nome, abre, aberto] of [
    ['leitura em voz', p2 => p2.evaluate(() => abrirPainelVoz(true)),  () => $('painel-voz').classList.contains('aberto')],
    ['sua conta',      p2 => p2.evaluate(() => abrirPainelConta(true)), () => $('painel-conta').classList.contains('aberto')]
  ]){
    const pg = await abrir();
    await pg.evaluate(() => abrirMenu(true));
    await pg.waitForTimeout(250);
    await abre(pg);
    await pg.waitForTimeout(600);
    ok(nome + ': abriu', await pg.evaluate(aberto));
    ok(nome + ': a gaveta saiu de baixo', !(await onde(pg)).gaveta);
    ok(nome + ': uma camada só', (await onde(pg)).camadas.split('>').length === 1, (await onde(pg)).camadas);
    await voltar(pg, 1);
    ok(nome + ': um voltar fecha e sobra nada',
       !(await pg.evaluate(aberto)) && (await onde(pg)).camadas === '', (await onde(pg)).camadas);
    await pg.close();
  }

  console.log('\n=== erros ===');
  const rel = erros.filter(x => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(x));
  rel.forEach(x => console.log('   ' + x));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
