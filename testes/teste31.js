const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* A busca que lembra: recentes e sugestões */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (recentes) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    if(recentes) await p.addInitScript(
      r => localStorage.setItem('lampada-buscas', JSON.stringify(r)), recentes);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(() => irParaAba('biblia'));
    await p.waitForTimeout(300);
    return p;
  };

  const sugestoes = (p) => p.evaluate(() =>
    [...document.querySelectorAll('#sugestoes-busca .sugestao')].map(b => ({
      rotulo: b.querySelector('span').textContent,
      tipo: b.querySelector('.sug-tipo').textContent,
      negrito: (b.querySelector('b') || {}).textContent || ''
    })));
  const chips = (p) => p.evaluate(() =>
    [...document.querySelectorAll('#recentes-lista .chip-busca')].map(b => b.textContent));
  const guardadas = (p) => p.evaluate(() =>
    JSON.parse(localStorage.getItem('lampada-buscas') || '[]'));

  /* Tocar num atalho de referência abre o capítulo, e a folha guarda a
     barra de busca. Para continuar medindo a busca, o teste sai da
     leitura — direto, sem passar pelo voltar do navegador, que só chega
     no quadro seguinte. */
  const sairDaLeitura = (p) => p.evaluate(() => {
    if(document.documentElement.dataset.lendo !== '1') return;
    mostrarNivelDireto('livros');
    delete document.documentElement.dataset.lendo;
  });

  const digitar = async (p, txt) => {
    /* digitar exige o campo visível, e ele fica guardado na folha da
       leitura: sair primeiro evita depender da ordem dos blocos */
    await sairDaLeitura(p);
    await p.fill('#busca', '');
    await p.click('#busca');
    await p.type('#busca', txt, { delay: 12 });
    await p.waitForTimeout(220);
  };

  console.log('\n=== sugere o livro enquanto se digita ===');
  /* Era preciso lembrar a grafia exata: os acentos de "Gênesis", o
     espaço de "1 Coríntios". Agora basta o começo. */
  let p = await abrir();
  await digitar(p, 'gen');
  let s = await sugestoes(p);
  ok('“gen” acha Gênesis', s.length && s[0].rotulo === 'Gênesis', JSON.stringify(s.map(x => x.rotulo)));
  ok('e diz de quantos capítulos é', /capítulos/.test(s[0].tipo), s[0].tipo);
  /* o negrito mostra por que aquele item está ali */
  ok('o pedaço digitado sai em negrito, mesmo com acento no nome',
     s[0].negrito.toLowerCase() === 'gên', JSON.stringify(s[0].negrito));

  await digitar(p, 'jo');
  s = await sugestoes(p);
  ok('“jo” lista mais de um livro', s.length > 1, s.map(x => x.rotulo).join(', '));
  ok('e começo de nome vem antes de "contém"',
     s[0].rotulo.toLowerCase().startsWith('jo'), s[0].rotulo);
  ok('no máximo seis, para não virar parede', s.length <= 6, s.length);

  await digitar(p, 'joão 3');
  s = await sugestoes(p);
  ok('“joão 3” sugere o capítulo, não só o livro',
     s.some(x => x.rotulo === 'João 3' && x.tipo === 'capítulo'),
     JSON.stringify(s.map(x => x.rotulo + '/' + x.tipo)));

  /* capítulo que não existe não vira sugestão de capítulo: o livro
     inteiro ainda é uma resposta útil */
  await digitar(p, 'judas 40');
  s = await sugestoes(p);
  ok('capítulo inexistente não é oferecido',
     !s.some(x => /Judas 40/.test(x.rotulo)), JSON.stringify(s.map(x => x.rotulo)));
  ok('mas o livro continua na lista', s.some(x => x.rotulo === 'Judas'));

  console.log('\n=== o que não é livro vira busca por palavra ===');
  /* era a função menos descoberta do app: nada na tela dizia que dava
     para procurar uma palavra */
  await digitar(p, 'perdão');
  s = await sugestoes(p);
  ok('oferece procurar no texto', s.length === 1 && /Buscar “perdão” no texto/.test(s[0].rotulo),
     JSON.stringify(s.map(x => x.rotulo)));
  ok('rotulado como palavra', s[0].tipo === 'palavra', s[0].tipo);

  await digitar(p, 'x');
  ok('uma letra só não oferece busca por palavra (o mínimo é 2)',
     !(await sugestoes(p)).some(x => /no texto/.test(x.rotulo)),
     JSON.stringify((await sugestoes(p)).map(x => x.rotulo)));

  console.log('\n=== escolher pelo teclado ===');
  await digitar(p, 'salm');
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(120);
  let m = await p.evaluate(() => {
    const el = document.querySelector('#sugestoes-busca .marcada');
    return el ? { texto: el.textContent, id: el.id, campo: $('busca').getAttribute('aria-activedescendant') } : null;
  });
  /* a primeira seta para baixo tem de marcar o primeiro item — a conta
     do ciclo errava aqui e não marcava nada */
  ok('a primeira seta marca o primeiro item', m && /Salmos/.test(m.texto), JSON.stringify(m));
  ok('e o leitor de tela é avisado sem tirar o foco do campo',
     m && m.campo === m.id, m && m.campo);

  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(120);
  ok('a seta para cima volta a não marcar nada',
     !(await p.evaluate(() => !!document.querySelector('#sugestoes-busca .marcada'))));
  ok('e o aria-activedescendant some',
     !(await p.evaluate(() => $('busca').getAttribute('aria-activedescendant'))));

  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(900);
  ok('Enter no item marcado abre o livro',
     (await p.evaluate(() => $('busca').value)) === 'Salmos',
     await p.evaluate(() => $('busca').value));
  ok('e a lista fecha', await p.evaluate(() => $('sugestoes-busca').hidden));
  await p.close();

  console.log('\n=== as buscas ficam guardadas ===');
  p = await abrir();
  ok('no começo não há nada', (await guardadas(p)).length === 0);
  ok('e a faixa de recentes está escondida', await p.evaluate(() => $('recentes-busca').hidden));

  await digitar(p, 'João 3:16');
  /* O campo é type="search": no Chrome o Esc apaga o texto. Com a lista
     aberta isso seria perda — quem aperta Esc quer dispensar a sugestão,
     não jogar fora o que digitou. */
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok('Esc fecha a lista sem apagar o que foi digitado',
     (await p.evaluate(() => $('busca').value)) === 'João 3:16',
     JSON.stringify(await p.evaluate(() => $('busca').value)));
  ok('e a lista fechou mesmo', await p.evaluate(() => $('sugestoes-busca').hidden));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok('com a lista já fechada, o Esc volta a limpar, como manda o navegador',
     (await p.evaluate(() => $('busca').value)) === '',
     JSON.stringify(await p.evaluate(() => $('busca').value)));
  await p.evaluate(() => BuscaMemoria.executar('João 3:16'));
  await p.waitForTimeout(900);
  ok('a busca feita foi guardada', (await guardadas(p))[0] === 'João 3:16', JSON.stringify(await guardadas(p)));

  await p.evaluate(() => BuscaMemoria.executar('Salmos 23'));
  await p.waitForTimeout(900);
  ok('a mais recente fica no topo', (await guardadas(p))[0] === 'Salmos 23', JSON.stringify(await guardadas(p)));

  /* repetir não duplica: sobe para o topo */
  await p.evaluate(() => BuscaMemoria.executar('joão 3:16'));
  await p.waitForTimeout(900);
  let g = await guardadas(p);
  ok('repetir a mesma busca não duplica', g.length === 2, JSON.stringify(g));
  ok('e ela sobe para o topo', g[0].toLowerCase() === 'joão 3:16', g[0]);

  /* uma letra não merece virar atalho */
  await p.evaluate(() => BuscaMemoria.registrar('a'));
  ok('busca de uma letra não é guardada', (await guardadas(p)).length === 2);

  console.log('\n=== e viram atalho de um toque ===');
  await p.evaluate(() => { $('busca').value = ''; $('busca').focus(); BuscaMemoria.renderRecentes(); });
  await p.waitForTimeout(200);
  let c = await chips(p);
  ok('os atalhos aparecem com o campo vazio', c.length >= 2, JSON.stringify(c));
  ok('com o botão de limpar no fim', c[c.length - 1] === 'Limpar', c[c.length - 1]);
  ok('e a faixa está visível', !(await p.evaluate(() => $('recentes-busca').hidden)));

  /* A busca por referência abre o capítulo, e a leitura guarda a barra
     de busca inteira — é o desenho da folha. Então os atalhos são
     medidos nos dois lugares onde a pessoa de fato os vê: fora da
     leitura, e dentro dela com a lupa aberta. */
  await p.evaluate(() => { mostrarNivelDireto('livros'); delete document.documentElement.dataset.lendo;
                           $('busca').value = ''; $('busca').focus(); BuscaMemoria.renderRecentes(); });
  await p.waitForTimeout(400);
  const alvoDoToque = await p.evaluate(() => {
    const b = document.querySelector('#recentes-lista .chip-busca');
    return Math.round(b.getBoundingClientRect().height);
  });
  ok('fora da leitura, o atalho tem alvo de toque de 44px', alvoDoToque >= 44, alvoDoToque + 'px');

  await p.evaluate(async () => { await abrirLeitura(43, 3); });
  await p.waitForTimeout(1000);
  const dentro = await p.evaluate(() => {
    const antes = Math.round((document.querySelector('#recentes-lista .chip-busca') || {getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height);
    document.getElementById('cl-busca').click();
    $('busca').value = ''; BuscaMemoria.renderRecentes();
    const b = document.querySelector('#recentes-lista .chip-busca');
    return { antes, depois: b ? Math.round(b.getBoundingClientRect().height) : 0 };
  });
  ok('dentro da leitura os atalhos ficam guardados', dentro.antes === 0, dentro.antes + 'px');
  ok('e a lupa os traz de volta, com os mesmos 44px', dentro.depois >= 44, dentro.depois + 'px');
  await sairDaLeitura(p);
  await p.evaluate(() => { $('busca').value = ''; BuscaMemoria.renderRecentes(); });
  await p.waitForTimeout(300);

  await p.evaluate(() => document.querySelectorAll('#recentes-lista .chip-busca')[1].click());
  await p.waitForTimeout(900);
  ok('tocar num atalho refaz a busca',
     (await p.evaluate(() => $('busca').value)).length > 0,
     await p.evaluate(() => $('busca').value));

  console.log('\n=== recentes e sugestões nunca aparecem juntos ===');
  await p.evaluate(() => { $('busca').value = ''; $('busca').focus(); BuscaMemoria.renderRecentes(); });
  await p.waitForTimeout(150);
  ok('campo vazio: recentes sim, sugestões não',
     !(await p.evaluate(() => $('recentes-busca').hidden)) &&
      (await p.evaluate(() => $('sugestoes-busca').hidden)));
  await digitar(p, 'mat');
  ok('digitando: sugestões sim, recentes não',
     (await p.evaluate(() => $('recentes-busca').hidden)) &&
     !(await p.evaluate(() => $('sugestoes-busca').hidden)));

  console.log('\n=== limpar apaga mesmo ===');
  await sairDaLeitura(p);
  await p.evaluate(() => { $('busca').value = ''; $('busca').focus(); BuscaMemoria.renderRecentes(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('#recentes-lista .chip-busca.limpar').click());
  await p.waitForTimeout(250);
  ok('a lista guardada some', (await guardadas(p)).length === 0);
  ok('e a faixa se esconde', await p.evaluate(() => $('recentes-busca').hidden));
  await p.close();

  console.log('\n=== a busca por voz também é lembrada ===');
  p = await abrir();
  await p.evaluate(() => BuscaMemoria.executar('Provérbios 3'));
  await p.waitForTimeout(900);
  ok('entrou nas recentes', (await guardadas(p))[0] === 'Provérbios 3', JSON.stringify(await guardadas(p)));
  ok('e o ditado passa pela mesma porta',
     /BuscaMemoria\.executar\(arrumado\)/.test(fs.readFileSync(RAIZ + '/app.js', 'utf8')));
  await p.close();

  console.log('\n=== lista guardada estragada não derruba o app ===');
  p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.addInitScript(() => localStorage.setItem('lampada-buscas', '{isto nao e json'));
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);
  ok('o app abre normalmente', await p.evaluate(() => !!document.getElementById('sec-hoje')));
  ok('e a faixa fica escondida', await p.evaluate(() => $('recentes-busca').hidden));
  await p.evaluate(() => localStorage.setItem('lampada-buscas', JSON.stringify([1, null, 'Rute'])));
  await p.evaluate(() => BuscaMemoria.renderRecentes());
  await p.waitForTimeout(150);
  ok('lixo dentro da lista é filtrado, o que presta fica',
     (await chips(p)).join('|') === 'Rute|Limpar', (await chips(p)).join('|'));
  await p.close();

  console.log('\n=== guarda no máximo oito ===');
  p = await abrir();
  await p.evaluate(() => { for(let i = 1; i <= 12; i++) BuscaMemoria.registrar('busca numero ' + i); });
  await p.waitForTimeout(200);
  g = await guardadas(p);
  ok('para em oito', g.length === 8, g.length);
  ok('e são as oito últimas', g[0] === 'busca numero 12' && g[7] === 'busca numero 5', g.join(' | '));
  await p.close();

  console.log('\n=== contraste e tamanho nos dois temas ===');
  for(const tema of ['claro', 'escuro']){
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', e => erros.push(e.message));
    await pg.addInitScript(MOCK);
    await pg.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    await pg.addInitScript(() => localStorage.setItem('lampada-buscas', JSON.stringify(['Salmos 23'])));
    await pg.goto(BASE + '/index.html');
    await pg.waitForTimeout(900);
    await pg.evaluate(() => { irParaAba('biblia'); });
    await pg.waitForTimeout(250);
    await pg.evaluate(() => { $('busca').value = 'gen'; BuscaMemoria.sugerir(); });
    await pg.waitForTimeout(200);
    const r = await pg.evaluate(() => {
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r2, g2, b2]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r2) + 0.7152 * f(g2) + 0.0722 * f(b2); };
      const razao = (a, c) => { const L1 = lum(num(a)), L2 = lum(num(c));
        return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
      const sug = document.querySelector('.sugestao');
      const fundo = getComputedStyle(document.getElementById('sugestoes-busca')).backgroundColor;
      return {
        texto: razao(getComputedStyle(sug).color, fundo),
        tipo: razao(getComputedStyle(sug.querySelector('.sug-tipo')).color, fundo),
        altura: Math.round(sug.getBoundingClientRect().height),
        larguraOk: sug.getBoundingClientRect().width <= window.innerWidth,
        rolagemLateral: document.documentElement.scrollWidth <= window.innerWidth
      };
    });
    ok('tema ' + tema + ': o nome do livro passa nos 4,5 da AA', r.texto >= 4.5, r.texto + ':1');
    ok('tema ' + tema + ': o rótulo do tipo também', r.tipo >= 4.5, r.tipo + ':1');
    ok('tema ' + tema + ': a sugestão tem 44px', r.altura >= 44, r.altura + 'px');
    ok('tema ' + tema + ': cabe na tela, sem rolagem lateral',
       r.larguraOk && r.rolagemLateral);
    await pg.close();
  }

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
