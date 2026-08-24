const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* Continuar a leitura livre, e a imagem sem o endereço queimado */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const CAP = () => {
  const v = [];
  for(let i = 1; i <= 40; i++) v.push({ verse: i, text: 'Versículo ' + i + ' com texto longo o suficiente para ocupar duas linhas na tela do celular e empurrar a rolagem.' });
  return { verses: v };
};

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (parada) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    /* a dica do versículo fora do caminho: ela empurra a rolagem e não é
       o que este teste mede */
    await p.addInitScript(() => localStorage.setItem('lampada-dica-verso', '1'));
    if(parada) await p.addInitScript(
      x => localStorage.setItem('lampada-leitura-parou', JSON.stringify(x)), parada);
    await p.addInitScript(c => {
      const real = window.fetch;
      window.fetch = (u, o) => /getbible|helloao/.test(String(u))
        ? Promise.resolve({ ok: true, status: 200, json: async () => c }) : real(u, o);
    }, CAP());
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(1000);
    return p;
  };
  const ler = async (p, cap = 3) => {
    await p.evaluate(async c => { irParaAba('biblia'); await abrirLeitura(43, c); }, cap);
    await p.waitForTimeout(1000);
  };
  const guardada = p => p.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-leitura-parou') || 'null'));

  console.log('\n=== o app passa a saber onde a pessoa parou ===');
  /* Medido antes: rolar até o meio, sair e voltar devolvia ao topo, e não
     havia nada guardado no aparelho sobre a posição. */
  let p = await abrir();
  ok('no começo não há parada guardada', (await guardada(p)) === null);
  await ler(p);
  await p.evaluate(() => window.scrollTo(0, 2000));
  await p.waitForTimeout(800);
  let g = await guardada(p);
  ok('rolar guarda a parada', !!g, JSON.stringify(g));
  ok('com livro e capítulo certos', g && g.nr === 43 && g.cap === 3, g && (g.nr + ':' + g.cap));
  ok('e o versículo, não a altura em pixels',
     g && typeof g.verso === 'number' && !('scroll' in g) && !('y' in g), JSON.stringify(Object.keys(g||{})));
  ok('o versículo é o que está no topo da tela, não o primeiro do capítulo',
     g && g.verso > 1, g && g.verso);

  /* pixel não sobrevive a mudar a letra ou girar o aparelho; versículo sim */
  const antes = g.verso;
  await p.evaluate(() => { document.documentElement.style.setProperty('--esc', '1.3'); });
  await p.waitForTimeout(300);
  ok('a parada não depende do tamanho da letra',
     (await guardada(p)).verso === antes, (await guardada(p)).verso + ' vs ' + antes);
  await p.evaluate(() => { document.documentElement.style.removeProperty('--esc'); });

  console.log('\n=== o versículo 1 não é uma parada ===');
  /* estar no começo do capítulo não é ter parado no meio de nada */
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);
  ok('voltar ao topo esquece a parada', (await guardada(p)) === null, JSON.stringify(await guardada(p)));
  await p.close();

  console.log('\n=== sair da leitura para de anotar ===');
  p = await abrir();
  await ler(p);
  await p.evaluate(() => window.scrollTo(0, 2000));
  await p.waitForTimeout(800);
  const antesDeSair = await guardada(p);
  await p.evaluate(() => { mostrarNivel('capitulos'); window.scrollTo(0, 0); });
  await p.waitForTimeout(900);
  ok('rolar a lista de capítulos não sobrescreve a parada',
     JSON.stringify(await guardada(p)) === JSON.stringify(antesDeSair),
     JSON.stringify(await guardada(p)));
  await p.close();

  console.log('\n=== o cartão na tela inicial ===');
  /* o cartão "Continuar de onde parou" só serve a planos; quem lê livre
     não deixava rastro nenhum */
  p = await abrir({ nr: 19, cap: 119, verso: 87, data: new Date().toISOString() });
  const cartao = await p.evaluate(() => {
    const sec = document.getElementById('sec-retomar');
    const cx = document.getElementById('cartao-retomar');
    return {
      visivel: sec && !sec.classList.contains('oculto'),
      titulo: (sec.querySelector('.rotulo-secao') || {}).textContent,
      ref: (cx.querySelector('.continuar-nome') || {}).textContent,
      quando: (cx.querySelector('.continuar-meta') || {}).textContent,
      botoes: [...cx.querySelectorAll('button')].map(x => x.textContent)
    };
  });
  ok('o cartão aparece', cartao.visivel);
  ok('com a referência exata', cartao.ref === 'Salmos 119:87', cartao.ref);
  ok('e o título é sobre leitura, não sobre plano',
     cartao.titulo === 'Continuar a leitura', cartao.titulo);
  /* "hoje" e "ontem" em vez de "há 19 horas": dizer as horas obriga a
     pessoa a fazer a conta para saber se foi de manhã ou ontem à noite */
  ok('diz quando foi em palavra, não em horas', /hoje/.test(cartao.quando), cartao.quando);
  ok('oferece continuar e dispensar', cartao.botoes.length === 2 &&
     /Continuar em Salmos 119:87/.test(cartao.botoes[0]) && /Dispensar/.test(cartao.botoes[1]),
     JSON.stringify(cartao.botoes));

  await p.evaluate(() => document.querySelector('#cartao-retomar button').click());
  await p.waitForTimeout(1400);
  const foi = await p.evaluate(() => ({
    nivel: ['livros','capitulos','leitura'].find(n => !$('nivel-' + n).classList.contains('oculto')),
    ref: (document.querySelector('#area-leitura .referencia') || {}).textContent || ''
  }));
  ok('continuar abre o capítulo certo', foi.nivel === 'leitura' && /Salmos 119/.test(foi.ref),
     JSON.stringify(foi));
  await p.close();

  console.log('\n=== dispensar apaga ===');
  p = await abrir({ nr: 43, cap: 3, verso: 12, data: new Date().toISOString() });
  await p.evaluate(() => document.querySelectorAll('#cartao-retomar button')[1].click());
  await p.waitForTimeout(300);
  ok('a parada some do aparelho', (await guardada(p)) === null);
  ok('e o cartão se esconde',
     await p.evaluate(() => document.getElementById('sec-retomar').classList.contains('oculto')));
  await p.close();

  console.log('\n=== reabrir o capítulo devolve ao ponto, e avisa ===');
  /* rolar sozinho para o meio de um texto assusta se nada explicar */
  p = await abrir({ nr: 43, cap: 3, verso: 25, data: new Date().toISOString() });
  await ler(p);
  const volta = await p.evaluate(() => {
    const barra = document.querySelector('header.barra').getBoundingClientRect().bottom;
    const v25 = [...document.querySelectorAll('#area-leitura .v')]
      .find(el => Number(el.querySelector('sup').textContent) === 25);
    const r = v25.getBoundingClientRect();
    return {
      rolou: Math.round(window.scrollY),
      versoNaTela: r.top > barra - 40 && r.bottom < window.innerHeight,
      aviso: $('aviso').textContent,
      temBotao: !!document.querySelector('#aviso .aviso-acao')
    };
  });
  ok('a tela foi para o versículo guardado', volta.versoNaTela, 'scrollY=' + volta.rolou);
  ok('e o aviso diz o que aconteceu', /Voltamos ao versículo 25/.test(volta.aviso), volta.aviso);
  ok('com o caminho de volta ao início', volta.temBotao);
  await p.click('#aviso .aviso-acao');
  await p.waitForTimeout(900);
  ok('"Ir ao início" sobe para o versículo 1',
     await p.evaluate(() => {
       const v1 = document.querySelector('#area-leitura .v').getBoundingClientRect();
       return v1.top > 0 && v1.bottom < window.innerHeight;
     }));
  await p.close();

  console.log('\n=== quem chega por link ou busca não é desviado ===');
  /* abrir um versículo compartilhado tem de levar àquele versículo, não
     ao ponto onde a pessoa parou noutro dia */
  p = await abrir({ nr: 43, cap: 3, verso: 30, data: new Date().toISOString() });
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3, 5); });
  await p.waitForTimeout(1200);
  ok('o destaque manda, não a parada',
     !/Voltamos ao versículo/.test(await p.evaluate(() => $('aviso').textContent)),
     await p.evaluate(() => $('aviso').textContent));
  await p.close();

  console.log('\n=== capítulo diferente não retoma ===');
  p = await abrir({ nr: 43, cap: 3, verso: 25, data: new Date().toISOString() });
  await ler(p, 4);
  ok('João 4 abre no começo, sem aviso',
     !/Voltamos ao versículo/.test(await p.evaluate(() => $('aviso').textContent)),
     await p.evaluate(() => $('aviso').textContent));
  await p.close();

  console.log('\n=== a imagem não leva mais o endereço queimado ===');
  /* endereço na arte é marca d'água: compete com o versículo, envelhece
     se o domínio mudar e não é clicável. O link continua no
     compartilhamento, ao lado da imagem, onde se pode tocar. */
  const fonte = fs.readFileSync(RAIZ + '/app.js', 'utf8');
  ok('o domínio não é mais desenhado no canvas', !/fillText\(DOMINIO_SITE/.test(fonte));
  ok('e a constante morta foi embora', !/DOMINIO_SITE/.test(fonte));
  ok('mas o link continua indo no compartilhamento',
     /linkDoVerso/.test(fonte) && /navigator\.share/.test(fonte));

  /* Em vez de contar pixels — que confundem a arte do fundo com texto —
     gravamos tudo que o canvas escreve. É a prova direta: se o endereço
     não passa por fillText, ele não está na imagem. */
  p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.addInitScript(() => localStorage.setItem('lampada-dica-verso', '1'));
  await p.addInitScript(() => {
    window.__escrito = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(t, ...r){
      window.__escrito.push(String(t));
      return orig.call(this, t, ...r);
    };
  });
  await p.addInitScript(c => {
    const real = window.fetch;
    window.fetch = (u, o) => /getbible|helloao/.test(String(u))
      ? Promise.resolve({ ok: true, status: 200, json: async () => c }) : real(u, o);
  }, CAP());
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1000);
  await ler(p);
  await p.evaluate(() => { abrirFolhaVerso(43, 3, 16, 'Porque Deus amou o mundo de tal maneira.'); });
  await p.waitForTimeout(300);
  /* Imagem deixou de ser um botão da grade e virou uma das duas escolhas
     de Compartilhar: o caminho passa pelo painel de envio. */
  await p.evaluate(() => $('fa-enviar').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => $('fa-enviar-imagem').click());
  await p.waitForTimeout(1800);
  const escrito = await p.evaluate(() => window.__escrito);
  ok('o gerador desenhou texto na imagem', escrito.length > 0, escrito.length + ' chamadas');
  ok('nenhuma delas é o endereço do site',
     !escrito.some(t => /vercel\.app|devocionaldiario|https?:/i.test(t)),
     JSON.stringify(escrito.filter(t => /vercel|devocional|http/i.test(t))));
  ok('mas o versículo e a referência continuam lá',
     escrito.some(t => /Deus amou o mundo/.test(t)) && escrito.some(t => /João 3:16/.test(t)),
     JSON.stringify(escrito.slice(0, 6)));
  ok('e a marca do app no topo também',
     escrito.some(t => /BÍBLIA DEVOCIONAL/i.test(t)));
  await p.close();

  console.log('\n=== parada estragada não derruba o app ===');
  p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.addInitScript(() => localStorage.setItem('lampada-leitura-parou', '{isto nao e json'));
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);
  ok('o app abre normalmente', await p.evaluate(() => !!document.getElementById('sec-hoje')));
  ok('e o cartão fica escondido',
     await p.evaluate(() => document.getElementById('sec-retomar').classList.contains('oculto')));
  await p.evaluate(() => localStorage.setItem('lampada-leitura-parou',
    JSON.stringify({ nr: 999, cap: 1, verso: 2 })));
  await p.evaluate(() => montarRetomar());
  await p.waitForTimeout(200);
  ok('livro inexistente também é ignorado',
     await p.evaluate(() => document.getElementById('sec-retomar').classList.contains('oculto')));
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
