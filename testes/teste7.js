const BASE = require('./base');
const NAVEGADOR = require('./navegador');
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const CURTO = 'O Senhor é o meu pastor; nada me faltará.';
const LONGO = 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, '.repeat(6);

(async () => {
  const browser = await chromium.launch({ executablePath: NAVEGADOR });
  const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const ok = (n, v) => console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n);

  console.log('\n=== catálogo de fundos ===');
  const meta = await page.evaluate(() => ({
    fundos: FUNDOS.map(f => f.id),
    nomes: FUNDOS.map(f => f.nome),
    claros: FUNDOS.filter(f => f.claro).map(f => f.id),
    formatos: FORMATOS.map(f => f.id + ' ' + f.w + 'x' + f.h)
  }));
  console.log('     fundos:', meta.fundos.join(', '));
  console.log('     formatos:', meta.formatos.join(' · '));
  ok('10 fundos disponíveis', meta.fundos.length === 10);
  ok('todos com nome legível', meta.nomes.every(n => n && n.length > 3));
  ok('há fundos claros e escuros', meta.claros.length >= 2 && meta.claros.length < 10);
  ok('3 formatos', meta.formatos.length === 3);
  ok('nenhum fundo usa imagem externa', await page.evaluate(() =>
    FUNDOS.every(f => !/Image|drawImage|http/i.test(f.desenhar.toString()))));

  console.log('\n=== abrir o gerador ===');
  await page.evaluate(t => abrirGeradorImagem(t, 'Salmos 23:1', 'Bíblia Livre'), CURTO);
  await page.waitForTimeout(500);
  ok('modal abriu', await page.locator('#modal-img.aberto').count() === 1);
  /* Havia uma grade de fundos, que virou o botão "Trocar fundo", que
     agora voltou a ser uma fita de miniaturas — desta vez rolável e com
     as fotos junto. Ver teste42.js. */
  ok('a fita de fundos existe', await page.locator('#img-fundos').count() === 1);
  ok('chips de formato montados', await page.locator('#img-formatos .chip-img').count() === 3);
  ok('nome da cena aparece', await page.evaluate(() =>
    document.getElementById('img-nome-fundo').textContent === fundoAtual().nome));
  ok('formato feed marcado', await page.locator('#img-formatos .chip-img.ativo').count() === 1);
  ok('modal cabe na tela sem rolar', await page.evaluate(() => {
    const c = document.querySelector('.modal-caixa');
    return c.scrollHeight <= c.clientHeight + 1;
  }));
  ok('nenhum botão de ação com texto cortado', await page.evaluate(() =>
    [...document.querySelectorAll('.modal-acoes .btn')].every(b => b.scrollWidth <= b.clientWidth + 1)));

  console.log('\n=== o canvas realmente desenha ===');
  const pixels = await page.evaluate(() => {
    const c = document.getElementById('canvas-verso');
    const ctx = c.getContext('2d');
    const pontos = [[10,10],[540,80],[540,675],[540,1200],[1070,1340]];
    return pontos.map(([x,y]) => Array.from(ctx.getImageData(x, y, 1, 1).data).join(','));
  });
  console.log('     amostras:', pixels.join(' | '));
  ok('nenhum pixel transparente', await page.evaluate(() => {
    const ctx = document.getElementById('canvas-verso').getContext('2d');
    return ctx.getImageData(0, 0, 1, 1).data[3] === 255;
  }));
  ok('a imagem tem variação de cor', new Set(pixels).size > 1);

  console.log('\n=== mesmo versículo, mesmo fundo ===');
  const a = await page.evaluate(t => {
    abrirGeradorImagem(t, 'João 3:16', 'Bíblia Livre');
    return fundoAtual().id;
  }, CURTO);
  const b = await page.evaluate(t => {
    abrirGeradorImagem(t, 'João 3:16', 'Bíblia Livre');
    return fundoAtual().id;
  }, CURTO);
  ok('escolha determinística por referência (' + a + ')', a === b);
  const c = await page.evaluate(() => {
    const vistos = new Set();
    ['Gênesis 1:1','Salmos 23:1','João 3:16','Atos 2:4','Apocalipse 21:4','Rute 1:16']
      .forEach(ref => { imgAtual = { texto:'x', ref, versao:'v' }; imgFundo = null; vistos.add(fundoAtual().id); });
    return vistos.size;
  });
  ok('referências diferentes espalham entre fundos (' + c + ' distintos)', c >= 3);

  console.log('\n=== os fundos desenhados, agora só como socorro ===');
  /* Eles saíram da fita: quem escolhe, escolhe foto de verdade. Mas
     continuam sendo o que faz a imagem existir quando o Pexels não
     responde — e é isso que este bloco passa a provar. Ver teste44.js. */
  await page.evaluate(t => abrirGeradorImagem(t, 'Salmos 23:1', 'Bíblia Livre'), CURTO);
  await page.waitForTimeout(400);
  ok('nenhum desenho aparece para escolher', await page.evaluate(() =>
    document.querySelectorAll('#img-fundos [data-arte]').length === 0));

  const socorro = await page.evaluate(() => {
    const antes = fundoAtual().id;
    imgModo = 'arte';
    imgFundo = FUNDOS.find(f => f.id !== antes).id;
    desenharImagemArte();
    const c = document.getElementById('canvas-verso').getContext('2d');
    return { antes, depois: fundoAtual().id,
             nome: document.getElementById('img-nome-fundo').textContent,
             opaco: c.getImageData(0, 0, 1, 1).data[3] === 255 };
  });
  ok('trocar o fundo do socorro muda a cena (' + socorro.antes + ' → ' + socorro.depois + ')',
     socorro.antes !== socorro.depois);
  ok('e desenha de verdade', socorro.opaco);

  const todos = await page.evaluate(() => ({
    quantos: FUNDOS.length,
    ids: new Set(FUNDOS.map(f => f.id)).size,
    desenham: FUNDOS.every(f => typeof f.desenhar === 'function')
  }));
  ok('os dez fundos continuam no código, sem repetir',
     todos.quantos === 10 && todos.ids === 10 && todos.desenham);

  for (const [id, w, h] of [['story',1080,1920],['quadrado',1080,1080],['feed',1080,1350]]) {
    await page.locator('#img-formatos .chip-img[data-formato="' + id + '"]').click();
    await page.waitForTimeout(250);
    const dim = await page.evaluate(() => {
      const c = document.getElementById('canvas-verso');
      return [c.width, c.height];
    });
    ok('formato ' + id + ' → ' + dim.join('x'), dim[0] === w && dim[1] === h);
  }

  console.log('\n=== texto longo ===');
  await page.evaluate(t => abrirGeradorImagem(t, 'João 3:16', 'Bíblia Livre'), LONGO);
  await page.waitForTimeout(400);
  const ajuste = await page.evaluate(t => {
    const ctx = document.getElementById('canvas-verso').getContext('2d');
    return ajustarTexto(ctx, t, 1080 * 0.78, 1350 * 0.44, 67, 28);
  }, LONGO);
  console.log('     linhas:', ajuste && ajuste.linhas.length, '· fonte:', ajuste && ajuste.tam);
  ok('versículo longo ainda cabe', !!ajuste);
  ok('a fonte foi reduzida para caber', ajuste && ajuste.tam < 67);
  ok('o bloco respeita a altura máxima',
     ajuste && ajuste.linhas.length * ajuste.alturaLinha <= 1350 * 0.44);

  console.log('\n=== nome do arquivo ===');
  const nome = await page.evaluate(() => {
    imgAtual = { texto: 'x', ref: '1 Coríntios 13:4', versao: 'v' };
    return nomeArquivoImagem();
  });
  console.log('     ', nome);
  ok('sem espaço nem dois-pontos no nome', !/[\s:]/.test(nome));
  ok('termina em .png', nome.endsWith('.png'));

  console.log('\n=== exportação ===');
  const dataUrl = await page.evaluate(() =>
    document.getElementById('canvas-verso').toDataURL('image/png').slice(0, 22));
  ok('canvas não está contaminado (exporta PNG)', dataUrl === 'data:image/png;base64,');
  ok('compartilharImagem existe', await page.evaluate(() => typeof compartilharImagem === 'function'));

  console.log('\n=== erros de JS ===');
  const relevantes = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  relevantes.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', relevantes.length === 0);

  await browser.close();
})();
