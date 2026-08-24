const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* O reprodutor de leitura em voz: ícones que não dependem da fonte do
   aparelho, e um progresso que não promete o que a fala não tem. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const CINCO = [
  { texto: 'Salmos 147 versículo 3.', rotulo: 'Referência' },
  { texto: 'Ele sara aos de coração partido.', rotulo: 'Versículo' },
  { texto: 'Deus não acha a nossa dor exagerada.', rotulo: 'Reflexão' },
  { texto: 'Você está se cobrando por não ter superado?', rotulo: 'Para meditar' },
  { texto: 'Deus de consolo, toca as feridas.', rotulo: 'Oração' }
];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (tema = 'claro') => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    /* trechos longos: sem isto a leitura avança sozinha no meio da
       medição e a barra é lida enquanto ainda está animando */
    await p.evaluate(() => { window.__dur = 60000; });
    return p;
  };
  const tocar = async (p, partes) => {
    await p.evaluate(ps => Voz.falar(ps, { titulo: 'Devocional do dia' }), partes);
    await p.waitForTimeout(700);
  };
  /* a largura tem transição de 0.3s: ler antes devolve o valor de partida */
  const assentar = (p) => p.waitForTimeout(500);
  const tracos = (p) => p.evaluate(() => {
    const prog = document.getElementById('audio-prog');
    return {
      quantos: prog.querySelectorAll('.audio-passo').length,
      continua: prog.classList.contains('continua'),
      larguras: [...prog.querySelectorAll('.audio-passo')].map(x =>
        Math.round(parseFloat(getComputedStyle(x.firstChild).width) /
                   x.getBoundingClientRect().width * 100)),
      atual: [...prog.querySelectorAll('.audio-passo')].findIndex(x => x.classList.contains('atual')),
      papel: prog.getAttribute('role'),
      valor: prog.getAttribute('aria-valuenow'),
      texto: prog.getAttribute('aria-valuetext')
    };
  });

  console.log('\n=== os controles deixaram de ser emoji ===');
  /* Eram U+23EE, U+23F8, U+23ED e U+23F9 — todos no conjunto emoji do
     Unicode, três deles com apresentação emoji por padrão. Quem os
     desenhava era a fonte do sistema: vinham com cor própria e ignoravam
     o `color` do CSS, então o mesmo botão saía laranja num aparelho e
     cinza noutro. */
  let p = await abrir();
  await tocar(p, CINCO);
  const bts = await p.evaluate(() => [...document.querySelectorAll('#barra-audio button')].map(x => ({
    id: x.id,
    texto: x.textContent.trim(),
    pontos: [...x.textContent.trim()].map(c => c.codePointAt(0)),
    svg: x.querySelectorAll('svg').length,
    simbolo: (x.querySelector('use') || {}).getAttribute
      ? x.querySelector('use').getAttribute('href') : null,
    l: Math.round(x.getBoundingClientRect().width),
    a: Math.round(x.getBoundingClientRect().height),
    rotulo: x.getAttribute('aria-label')
  })));
  const transporte = bts.filter(x => x.id !== 'audio-vel');
  ok('há quatro botões além da velocidade', transporte.length === 4,
     transporte.map(x => x.id).join(' '));
  ok('todos desenhados em SVG', transporte.every(x => x.svg === 1));
  /* U+23E9..U+23FA é a faixa dos controles de mídia em emoji */
  const aindaEmoji = bts.filter(x => x.pontos.some(c => c >= 0x23E9 && c <= 0x23FA));
  ok('nenhum glifo da faixa de emoji de mídia sobrou',
     aindaEmoji.length === 0, aindaEmoji.map(x => x.id).join(' '));
  ok('cada um com o seu símbolo, sem repetir',
     new Set(transporte.map(x => x.simbolo)).size === 4,
     transporte.map(x => x.simbolo).join(' '));
  ok('e todos com alvo de toque de 44px',
     transporte.every(x => x.l >= 44 && x.a >= 44),
     transporte.map(x => x.l + '×' + x.a).join(' '));

  console.log('\n=== o ícone acompanha a cor do texto ===');
  const cores = await p.evaluate(() => {
    const bt = document.getElementById('audio-ant');
    const svg = bt.querySelector('svg');
    const cs = getComputedStyle(svg);
    return { preenchimento: cs.fill, traco: cs.stroke, cor: getComputedStyle(bt).color };
  });
  ok('o ícone de transporte é cheio, como em todo player',
     cores.preenchimento === cores.cor && cores.traco === 'none',
     cores.preenchimento + ' / ' + cores.traco);

  console.log('\n=== parar virou fechar ===');
  /* pausar e parar eram dois botões para interromper; num mini-player o
     segundo é fechar, e é o que ele sempre fez */
  const fechar = bts.find(x => x.id === 'audio-parar');
  ok('o antigo ⏹ é agora um ✕', fechar.simbolo === '#i-fechar', fechar.simbolo);
  ok('  e diz que fecha, não que para', /fechar/i.test(fechar.rotulo), fechar.rotulo);
  ok('  e fecha mesmo', await p.evaluate(async () => {
    document.getElementById('audio-parar').click();
    await new Promise(r => setTimeout(r, 400));
    return !document.getElementById('barra-audio').classList.contains('ver');
  }));

  console.log('\n=== tocar e pausar trocam o ícone, não o botão ===');
  await tocar(p, CINCO);
  const alterna = await p.evaluate(async () => {
    const bt = document.getElementById('audio-play');
    const uso = () => bt.querySelector('use').getAttribute('href');
    const antes = { icone: uso(), rotulo: bt.getAttribute('aria-label'), svg: bt.querySelectorAll('svg').length };
    bt.click();
    await new Promise(r => setTimeout(r, 300));
    const pausado = { icone: uso(), rotulo: bt.getAttribute('aria-label'), svg: bt.querySelectorAll('svg').length };
    bt.click();
    await new Promise(r => setTimeout(r, 300));
    return { antes, pausado, voltou: uso() };
  });
  ok('tocando mostra a pausa', alterna.antes.icone === '#i-pausar', alterna.antes.icone);
  ok('pausado mostra o play', alterna.pausado.icone === '#i-tocar', alterna.pausado.icone);
  ok('  e o rótulo troca junto', /continuar/i.test(alterna.pausado.rotulo), alterna.pausado.rotulo);
  ok('  sem nunca perder o SVG', alterna.pausado.svg === 1);
  ok('e ao continuar volta para a pausa', alterna.voltou === '#i-pausar');

  console.log('\n=== um traço por trecho ===');
  /* A fala do navegador não permite buscar posição: só passar de um
     trecho para o outro. Uma linha arrastável prometeria o que não
     existe. */
  await assentar(p);
  const cinco = await tracos(p);
  ok('cinco partes dão cinco traços', cinco.quantos === 5, cinco.quantos);
  ok('  e não é a linha contínua', !cinco.continua);
  ok('nenhum traço nasce cheio', cinco.larguras.every(x => x === 0), cinco.larguras.join(' '));
  /* o traço em leitura passa quase todo o tempo com 0% — idx conta
     pedaços concluídos, e a maioria das partes tem um só —, então ele
     precisa de outra marca para não se confundir com os que nem
     começaram */
  ok('mas o que está tocando se distingue dos que não começaram',
     cinco.atual === 0, 'atual: ' + cinco.atual);
  ok('é um progressbar para quem usa leitor de tela', cinco.papel === 'progressbar', cinco.papel);
  ok('  dizendo em que trecho está', /trecho 1 de 5/i.test(cinco.texto || ''), cinco.texto);

  const andou = await p.evaluate(async () => {
    document.getElementById('audio-prox').click();
    await new Promise(r => setTimeout(r, 800));
    const prog = document.getElementById('audio-prog');
    return { larguras: [...prog.querySelectorAll('.audio-passo')].map(x =>
               Math.round(parseFloat(getComputedStyle(x.firstChild).width) /
                          x.getBoundingClientRect().width * 100)),
             atual: [...prog.querySelectorAll('.audio-passo')].findIndex(x => x.classList.contains('atual')),
             texto: prog.getAttribute('aria-valuetext') };
  });
  ok('avançar enche o traço que ficou para trás',
     andou.larguras[0] === 100, andou.larguras.join(' '));
  ok('  e passa a marca para o seguinte', andou.atual === 1, 'atual: ' + andou.atual);
  ok('  e o leitor de tela acompanha', /trecho 2 de 5/i.test(andou.texto || ''), andou.texto);
  await p.close();

  console.log('\n=== muitos trechos viram uma linha só ===');
  /* Um capítulo inteiro vira dezenas de partes: em traços, cada um
     ficaria fino demais para dizer alguma coisa. */
  p = await abrir();
  await tocar(p, Array.from({ length: 40 }, (_, i) => ({ texto: 'Versículo ' + i, rotulo: 'v' + i })));
  await assentar(p);
  const muitos = await tracos(p);
  ok('quarenta partes não viram quarenta traços', muitos.quantos === 1, muitos.quantos);
  ok('  e a barra assume a forma contínua', muitos.continua);
  ok('  ainda dizendo a posição', /trecho 1 de 40/i.test(muitos.texto || ''), muitos.texto);

  console.log('\n=== uma parte só não vira traço nenhum ===');
  await p.evaluate(() => Voz.parar(true));
  await tocar(p, [{ texto: 'Ele sara aos de coração partido.', rotulo: 'Versículo' }]);
  await assentar(p);
  const uma = await tracos(p);
  ok('com uma parte a barra é contínua', uma.quantos === 1 && uma.continua);
  await p.close();

  console.log('\n=== a velocidade parou de brigar com o play ===');
  /* era um círculo do tamanho do botão principal, na ponta da barra */
  p = await abrir();
  await tocar(p, CINCO);
  const vel = await p.evaluate(async () => {
    const v = document.getElementById('audio-vel');
    const play = document.getElementById('audio-play');
    const antes = { texto: v.textContent.trim(), destaque: v.classList.contains('rapido') };
    v.click();
    await new Promise(r => setTimeout(r, 300));
    return { antes, depois: v.textContent.trim(),
             destaque: v.classList.contains('rapido'),
             larguraVel: Math.round(v.getBoundingClientRect().width),
             larguraPlay: Math.round(play.getBoundingClientRect().width),
             borda: getComputedStyle(v).borderTopWidth,
             alvo: Math.round(v.getBoundingClientRect().height) };
  });
  ok('é menor que o botão de tocar', vel.larguraVel < vel.larguraPlay,
     vel.larguraVel + ' vs ' + vel.larguraPlay);
  ok('  e perdeu a moldura que a fazia parecer botão de transporte',
     vel.borda === '0px', vel.borda);
  ok('  sem perder o alvo de toque', vel.alvo >= 44, vel.alvo);
  ok('tocar nela muda a velocidade', vel.antes.texto !== vel.depois,
     vel.antes.texto + ' → ' + vel.depois);
  ok('  e fora do normal ela se destaca',
     !vel.antes.destaque && vel.destaque, vel.depois);

  console.log('\n=== o texto ganhou espaço ===');
  /* eram 116px para título e subtítulo; um botão a menos e a velocidade
     menor devolvem largura ao que diz o que está tocando */
  const info = await p.evaluate(() => {
    const el = document.querySelector('.audio-info');
    const t = document.getElementById('audio-titulo');
    return { largura: Math.round(el.getBoundingClientRect().width),
             cortado: t.scrollWidth > t.clientWidth + 1,
             titulo: t.textContent, sub: document.getElementById('audio-sub').textContent };
  });
  ok('a área de texto passou de 116px', info.largura > 116, info.largura + 'px');
  ok('  e o título cabe inteiro', !info.cortado, info.titulo);
  ok('  com o subtítulo dizendo o trecho', /de 5/.test(info.sub), info.sub);
  await p.close();

  console.log('\n=== nos dois temas ===');
  for(const tema of ['claro', 'escuro']){
    const pg = await abrir(tema);
    await tocar(pg, CINCO);
    const r = await pg.evaluate(() => {
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r2, g2, b2]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r2) + 0.7152 * f(g2) + 0.0722 * f(b2); };
      const razao = (a, c) => { const L1 = lum(num(a)), L2 = lum(num(c));
        return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
      const barra = getComputedStyle(document.getElementById('barra-audio')).backgroundColor;
      const ant = document.getElementById('audio-ant');
      const play = document.getElementById('audio-play');
      return {
        filtro: getComputedStyle(ant.querySelector('svg')).filter,
        icone: razao(getComputedStyle(ant).color, barra),
        /* a cor de verdade do ícone, não um branco presumido: no tema
           escuro ela deixou de ser branca justamente para passar aqui */
        corDoIcone: getComputedStyle(play).color,
        principal: razao(getComputedStyle(play).color, getComputedStyle(play).backgroundColor)
      };
    });
    ok('tema ' + tema + ': o ícone não depende de filtro nenhum', r.filtro === 'none', r.filtro);
    ok('tema ' + tema + ': passa nos 3:1 da 1.4.11', r.icone >= 3, r.icone + ':1');
    ok('tema ' + tema + ': o botão principal também', r.principal >= 3,
       r.principal + ':1 (' + r.corDoIcone + ')');
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
