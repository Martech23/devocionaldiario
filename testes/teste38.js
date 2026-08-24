const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* A folha do versículo: seis ações que fecham a grade, uma família só
   de ícones, e o que abre painel dizendo que abre painel. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
const VERSO = 'No princípio era a Palavra, e a Palavra estava junto de Deus, e a Palavra era Deus.';

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (tema = 'claro', vp = [390, 844]) => {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    await p.addInitScript(() => {
      window.__enviados = [];
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: x => { window.__enviados.push(x); return Promise.resolve(); }
      });
    });
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(v => abrirFolhaVerso(43, 1, 1, v), VERSO);
    await p.waitForTimeout(500);
    return p;
  };

  console.log('\n=== a última fileira não fica pela metade ===');
  /* Eram sete botões numa grade de duas colunas: três fileiras cheias e
     "Imagem" sozinho na quarta, com metade da largura vazia ao lado. */
  let p = await abrir();
  const grade = await p.evaluate(() => {
    const bs = [...document.querySelectorAll('.folha-acoes button')];
    const fileiras = {};
    bs.forEach(x => { const y = Math.round(x.getBoundingClientRect().top);
      (fileiras[y] = fileiras[y] || []).push(x.innerText.trim()); });
    const cols = getComputedStyle(document.querySelector('.folha-acoes'))
      .gridTemplateColumns.split(' ').length;
    const f = document.getElementById('folha-verso');
    return { n: bs.length, cols, fileiras: Object.values(fileiras).map(x => x.length),
             rotulos: bs.map(x => x.innerText.trim()),
             altura: Math.round(f.getBoundingClientRect().height),
             rola: f.scrollHeight > f.clientHeight + 1, vh: innerHeight };
  });
  ok('são seis ações, não sete', grade.n === 6, grade.rotulos.join(' · '));
  ok('a grade tem duas colunas no celular', grade.cols === 2, grade.cols);
  ok('e as três fileiras estão cheias — nenhuma órfã',
     grade.fileiras.length === 3 && grade.fileiras.every(x => x === 2),
     grade.fileiras.join('+'));
  /* a folha media 433px com sete botões */
  ok('a folha encolheu para menos de 400px', grade.altura < 400, grade.altura + 'px');
  ok('e cabe sem rolar', !grade.rola);
  ok('ocupa menos da metade da tela', grade.altura / grade.vh < 0.5,
     Math.round(grade.altura / grade.vh * 100) + '%');

  console.log('\n=== uma família só de ícones ===');
  /* Eram três: dois PNG, um SVG e quatro glifos de texto. Os glifos vinham
     da fonte do sistema — peso, tamanho e linha de base mudavam de
     aparelho para aparelho. */
  const icones = await p.evaluate(() => {
    const bs = [...document.querySelectorAll('.folha-acoes button')];
    return bs.map(x => ({
      id: x.id,
      txt: x.innerText.trim(),
      svg: x.querySelectorAll('svg.i').length,
      img: x.querySelectorAll('img').length,
      simbolo: (x.querySelector('svg.i use') || {}).getAttribute
        ? x.querySelector('svg.i use').getAttribute('href') : null,
      traco: x.querySelector('svg.i') ? getComputedStyle(x.querySelector('svg.i')).strokeWidth : null,
      lado: x.querySelector('svg.i') ? Math.round(x.querySelector('svg.i').getBoundingClientRect().width) : 0
    }));
  });
  ok('todo botão tem exatamente um ícone SVG',
     icones.every(x => x.svg === 1), icones.map(x => x.svg).join(''));
  ok('e nenhum PNG sobrou', icones.every(x => x.img === 0));
  ok('nenhum rótulo carrega glifo de texto no lugar de ícone',
     icones.every(x => !/[☆★✎⇄↔]/.test(x.txt)), icones.map(x => x.txt).join(' · '));
  ok('todos os ícones têm o mesmo tamanho',
     new Set(icones.map(x => x.lado)).size === 1, icones.map(x => x.lado).join(','));
  ok('e o mesmo peso de traço',
     new Set(icones.map(x => x.traco)).size === 1, icones.map(x => x.traco).join(','));
  /* ⇄ e ↔ eram duas setas de duas pontas para duas ações diferentes */
  const cmp = icones.find(x => x.id === 'fa-comparar');
  const ref = icones.find(x => x.id === 'fa-refs');
  ok('Comparar e Veja também têm desenhos distintos',
     cmp.simbolo !== ref.simbolo, cmp.simbolo + ' vs ' + ref.simbolo);
  const simbolos = icones.map(x => x.simbolo);
  ok('e nenhum ícone se repete entre os seis',
     new Set(simbolos).size === 6, simbolos.join(' '));
  const usados = await p.evaluate(sim =>
    sim.every(s => !!document.querySelector(s.replace('#', 'symbol#'))), simbolos);
  ok('todos os símbolos existem no sprite', usados);

  console.log('\n=== o que abre painel avisa que abre painel ===');
  /* Dois botões agem na hora e quatro trocam o conteúdo da folha. Nada
     distinguia os dois grupos. */
  const setas = await p.evaluate(() => {
    const bs = [...document.querySelectorAll('.folha-acoes button')];
    return bs.map(x => ({ id: x.id, classe: x.classList.contains('abre-painel'),
      seta: getComputedStyle(x, '::after').content }));
  });
  const abrem = ['fa-nota', 'fa-comparar', 'fa-refs', 'fa-enviar'];
  const naHora = ['fa-ouvir', 'fa-fav'];
  for(const s of setas){
    if(abrem.includes(s.id))
      ok(s.id + ' mostra o ›', s.classe && /›/.test(s.seta), s.seta);
    if(naHora.includes(s.id))
      ok(s.id + ' age na hora e não mostra seta', !s.classe && !/›/.test(s.seta), s.seta);
  }

  console.log('\n=== a borracha só existe quando há marca ===');
  /* Um ✕ permanente numa fileira de cores promete uma ação que quase
     sempre não faz nada — e dentro de uma folha lê como "fechar". */
  const borracha = await p.evaluate(async () => {
    const b2 = document.getElementById('folha-limpar-cor');
    const visivel = () => !b2.classList.contains('oculto') && b2.offsetParent !== null;
    const semMarca = visivel();
    definirCorDoVerso('amarelo');
    const comMarca = visivel();
    const marcado = document.querySelector('.c-amarelo').classList.contains('ativo');
    const tick = getComputedStyle(document.querySelector('.c-amarelo'), '::after').content;
    b2.click();
    await new Promise(r => setTimeout(r, 100));
    return { semMarca, comMarca, marcado, tick, depoisDeLimpar: visivel(),
             sobrouMarca: document.querySelector('.c-amarelo').classList.contains('ativo') };
  });
  ok('escondida quando o versículo não está marcado', !borracha.semMarca);
  ok('aparece assim que uma cor é posta', borracha.comMarca);
  ok('e some de novo ao tirar a marca', !borracha.depoisDeLimpar);
  ok('tirar a marca desmarca mesmo o círculo', !borracha.sobrouMarca);

  console.log('\n=== marcado se distingue de "em foco" ===');
  /* O único sinal de "esta é a cor posta" era uma moldura azul — e o
     anel do foco pelo teclado é igualmente azul. Abrir a folha põe o
     foco no primeiro círculo, e o amarelo parecia sempre marcado. */
  ok('a cor marcada leva um ✓ dentro', /✓/.test(borracha.tick), borracha.tick);
  const focoSozinho = await p.evaluate(() => {
    document.querySelector('.c-verde').focus();
    return { foco: document.activeElement.className,
             tick: getComputedStyle(document.querySelector('.c-verde'), '::after').content,
             ativo: document.querySelector('.c-verde').classList.contains('ativo') };
  });
  ok('mas o foco sozinho não põe ✓', !/✓/.test(focoSozinho.tick) && !focoSozinho.ativo,
     focoSozinho.tick);

  console.log('\n=== compartilhar pergunta em que forma ===');
  /* Compartilhar e Imagem faziam a mesma coisa por dois caminhos. */
  const envio = await p.evaluate(async () => {
    document.getElementById('fa-enviar').click();
    await new Promise(r => setTimeout(r, 300));
    const painel = document.getElementById('folha-enviar');
    const escolhas = [...painel.querySelectorAll('.folha-escolha button')].map(x => ({
      id: x.id, titulo: (x.querySelector('b') || {}).textContent,
      explica: (x.querySelector('small') || {}).textContent,
      alvo: Math.round(x.getBoundingClientRect().height)
    }));
    return { visivel: !painel.classList.contains('oculto'),
             principalOculto: document.getElementById('folha-principal').classList.contains('oculto'),
             escolhas };
  });
  ok('o painel de envio abre', envio.visivel && envio.principalOculto);
  ok('com duas escolhas', envio.escolhas.length === 2,
     envio.escolhas.map(x => x.titulo).join(' | '));
  ok('cada uma diz o que faz', envio.escolhas.every(x => (x.explica || '').length > 10),
     envio.escolhas.map(x => x.explica).join(' | '));
  ok('e ambas com alvo de toque folgado',
     envio.escolhas.every(x => x.alvo >= 44), envio.escolhas.map(x => x.alvo).join(','));

  const texto = await p.evaluate(async () => {
    document.getElementById('fa-enviar-texto').click();
    await new Promise(r => setTimeout(r, 300));
    return { enviados: window.__enviados,
             voltouAoPrincipal: !document.getElementById('folha-principal').classList.contains('oculto') };
  });
  ok('"Enviar o texto" manda mesmo o versículo', texto.enviados.length === 1,
     (texto.enviados[0] || {}).text);
  ok('  com a referência junto', /João 1:1/.test((texto.enviados[0] || {}).text || ''));
  ok('  e com o link do versículo', /\/\?v=|43/.test((texto.enviados[0] || {}).url || ''),
     (texto.enviados[0] || {}).url);
  ok('e a folha não fica parada na tela de escolha', texto.voltouAoPrincipal);
  await p.close();

  console.log('\n=== "Criar uma imagem" leva ao gerador e fecha a folha ===');
  p = await abrir();
  const imagem = await p.evaluate(async () => {
    document.getElementById('fa-enviar').click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('fa-enviar-imagem').click();
    await new Promise(r => setTimeout(r, 900));
    return { modal: document.getElementById('modal-img').classList.contains('aberto'),
             folha: document.getElementById('folha-verso').classList.contains('ver'),
             ref: (document.getElementById('img-ref') || {}).textContent };
  });
  ok('o gerador de imagem abre', imagem.modal);
  ok('e a folha sai de cena — as duas camadas, não só uma', !imagem.folha);
  await p.close();

  console.log('\n=== o voltar desfaz um degrau de cada vez ===');
  p = await abrir();
  const voltar = await p.evaluate(async () => {
    const passo = async f => { f(); await new Promise(r => setTimeout(r, 350)); };
    await passo(() => document.getElementById('fa-enviar').click());
    const noPainel = !document.getElementById('folha-enviar').classList.contains('oculto');
    await passo(() => history.back());
    const voltouAFolha = !document.getElementById('folha-principal').classList.contains('oculto')
      && document.getElementById('folha-verso').classList.contains('ver');
    await passo(() => history.back());
    const fechou = !document.getElementById('folha-verso').classList.contains('ver');
    return { noPainel, voltouAFolha, fechou };
  });
  ok('o voltar traz do painel de envio para a folha',
     voltar.noPainel && voltar.voltouAFolha);
  ok('e só o segundo voltar fecha a folha', voltar.fechou);

  await p.close();

  console.log('\n=== o rótulo troca sem apagar o ícone ===');
  /* página nova: o bloco acima fechou a folha com o voltar, e com ela
     versoAberto virou null — os dois botões sairiam sem fazer nada */
  p = await abrir();
  /* Quatro pontos do app escreviam o estado com textContent no botão
     inteiro. Agora o ícone é irmão do rótulo: escrever no botão apagaria
     o desenho. */
  const estados = await p.evaluate(async () => {
    const ler = id => { const x = document.getElementById(id);
      return { txt: (x.querySelector('span') || x).textContent.trim(),
               svg: x.querySelectorAll('svg.i').length,
               ativo: x.classList.contains('ativo'),
               rotulo: x.getAttribute('aria-label') }; };
    const antes = { fav: ler('fa-fav'), nota: ler('fa-nota') };
    document.getElementById('fa-fav').click();
    await new Promise(r => setTimeout(r, 200));
    const favOn = ler('fa-fav');
    document.getElementById('fa-fav').click();
    await new Promise(r => setTimeout(r, 200));
    const favOff = ler('fa-fav');
    document.getElementById('campo-nota-verso').value = 'uma nota qualquer';
    salvarNotaDoVerso();
    await new Promise(r => setTimeout(r, 250));
    const notaOn = ler('fa-nota');
    return { antes, favOn, favOff, notaOn };
  });
  ok('favoritar troca o rótulo', estados.antes.fav.txt !== estados.favOn.txt,
     estados.antes.fav.txt + ' → ' + estados.favOn.txt);
  ok('  e o ícone continua lá', estados.favOn.svg === 1);
  ok('  e o botão fica marcado', estados.favOn.ativo);
  ok('  e o leitor de tela sabe o que o toque faz agora',
     /tirar/i.test(estados.favOn.rotulo || ''), estados.favOn.rotulo);
  ok('desfavoritar volta ao rótulo de antes',
     estados.favOff.txt === estados.antes.fav.txt && !estados.favOff.ativo,
     estados.favOff.txt);
  ok('escrever a nota vira "Editar nota"', /editar/i.test(estados.notaOn.txt),
     estados.notaOn.txt);
  ok('  sem perder o ícone', estados.notaOn.svg === 1);
  ok('  e o botão fica marcado', estados.notaOn.ativo);

  console.log('\n=== o versículo longo avisa que continua ===');
  const corte = await p.evaluate(() => {
    const t = document.querySelector('.folha-txt');
    const cs = getComputedStyle(t);
    return { linhas: cs.webkitLineClamp || cs.lineClamp, alt: Math.round(t.getBoundingClientRect().height) };
  });
  ok('o texto da folha para em três linhas', String(corte.linhas) === '3', corte.linhas);
  await p.close();

  console.log('\n=== nos dois temas o ícone se vê ===');
  /* Os PNG de antes eram pretos e precisavam de um filtro para o tema
     escuro; um deles já tinha ficado preto sobre fundo preto. O SVG
     herda a cor do texto e não depende de filtro nenhum. */
  for(const tema of ['claro', 'escuro']){
    const pg = await abrir(tema);
    const r = await pg.evaluate(() => {
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r2, g2, b2]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r2) + 0.7152 * f(g2) + 0.0722 * f(b2); };
      const razao = (a, c) => { const L1 = lum(num(a)), L2 = lum(num(c));
        return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
      const bt = document.getElementById('fa-ouvir');
      const svg = bt.querySelector('svg.i');
      return { traco: getComputedStyle(svg).stroke,
               cor: getComputedStyle(bt).color,
               filtro: getComputedStyle(svg).filter,
               contraste: razao(getComputedStyle(bt).color, getComputedStyle(bt).backgroundColor) };
    });
    ok('tema ' + tema + ': o ícone herda a cor do texto', r.traco === r.cor, r.traco);
    ok('tema ' + tema + ': sem filtro de inversão', r.filtro === 'none', r.filtro);
    ok('tema ' + tema + ': o rótulo passa nos 4,5:1', r.contraste >= 4.5, r.contraste + ':1');
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
