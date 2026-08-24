const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Acessibilidade: cabeçalhos, foco nos painéis e alvos de toque */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js','utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
const VERSO = () => `window.buscarVerso = async () => ({ texto: 'Deus supre toda necessidade segundo as suas riquezas.', versao: 'Biblia Livre' }); return versiculoDoDia();`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1000);
  await p.evaluate(new Function(VERSO()));
  await p.waitForTimeout(400);

  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };
  const foco = () => p.evaluate(() => { const a = document.activeElement;
    return a ? a.tagName + '·' + ((a.getAttribute('aria-label') || a.id || a.textContent || '').trim().slice(0,22)) : 'nenhum'; });

  console.log('\n=== 1. cabeçalhos ===');
  const h = await p.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    textoH1: (document.querySelector('h1')||{}).textContent?.trim().replace(/\s+/g,' '),
    h2: document.querySelectorAll('h2').length,
    secoes: document.querySelectorAll('section.secao').length,
    rotulosP: document.querySelectorAll('p.rotulo-secao').length,
    tags: [...new Set([...document.querySelectorAll('.rotulo-secao')].map(e => e.tagName))]
  }));
  ok('existe exatamente um h1', h.h1 === 1, h.h1);
  ok('o h1 é o nome do app', /Bíblia Devocional/.test(h.textoH1 || ''), JSON.stringify(h.textoH1));
  /* derivado das seções, não preso a um número: acrescentar uma seção nova
     não pode fazer a suíte falhar sem que nada tenha quebrado */
  ok('toda seção tem um h2', h.h2 === h.secoes, h.h2 + ' h2 para ' + h.secoes + ' seções');
  ok('nenhum sobrou como parágrafo', h.rotulosP === 0, h.rotulosP);
  ok('todos usam a mesma tag', h.tags.join(',') === 'H2', h.tags.join(','));

  /* a hierarquia não pode pular nível: h1 → h2 → h3 */
  const ordem = await p.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(e => e.offsetParent !== null).map(e => +e.tagName[1]));
  let pula = null;
  for(let i = 1; i < ordem.length; i++) if(ordem[i] - ordem[i-1] > 1) pula = ordem[i-1] + '→' + ordem[i];
  ok('a hierarquia não pula nível', pula === null, pula || ordem.join(' '));

  console.log('\n=== 2. foco: a gaveta ===');
  ok('gaveta é um diálogo modal',
     await p.getAttribute('#gaveta', 'role') === 'dialog' &&
     await p.getAttribute('#gaveta', 'aria-modal') === 'true');
  await p.click('#btn-menu');
  await p.waitForTimeout(400);
  const dentroGaveta = await p.evaluate(() => $('gaveta').contains(document.activeElement));
  ok('o foco entra na gaveta ao abrir', dentroGaveta, await foco());

  /* o Tab tem de dar a volta dentro do painel, não vazar para trás dele */
  let vazou = false;
  for(let i = 0; i < 14; i++){
    await p.keyboard.press('Tab');
    if(!(await p.evaluate(() => $('gaveta').contains(document.activeElement)))) { vazou = true; break; }
  }
  ok('14 Tabs não escapam da gaveta', !vazou, vazou ? 'escapou em ' + await foco() : 'preso');
  await p.keyboard.press('Shift+Tab');
  ok('Shift+Tab também fica preso',
     await p.evaluate(() => $('gaveta').contains(document.activeElement)), await foco());

  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  ok('Escape fecha a gaveta', !(await p.evaluate(() => $('gaveta').classList.contains('aberta'))));
  ok('o foco volta para o ☰', await p.evaluate(() => document.activeElement.id) === 'btn-menu', await foco());

  console.log('\n=== 2. foco: painel de voz por cima da gaveta ===');
  await p.click('#btn-menu'); await p.waitForTimeout(350);
  await p.click('#btn-abrir-voz'); await p.waitForTimeout(450);
  ok('o foco entrou no painel de voz',
     await p.evaluate(() => $('painel-voz').contains(document.activeElement)), await foco());
  let vazou2 = false;
  for(let i = 0; i < 12; i++){
    await p.keyboard.press('Tab');
    if(!(await p.evaluate(() => $('painel-voz').contains(document.activeElement)))) { vazou2 = true; break; }
  }
  ok('o Tab respeita só o painel de cima', !vazou2, vazou2 ? await foco() : 'preso');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('o foco volta para o ☰ (a gaveta fechou junto)',
     await p.evaluate(() => document.activeElement.id) === 'btn-menu', await foco());

  console.log('\n=== 2. foco: painel de conta ===');
  await p.click('#btn-abrir-conta'); await p.waitForTimeout(450);
  ok('o foco entrou no painel de conta',
     await p.evaluate(() => $('painel-conta').contains(document.activeElement)), await foco());
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('e volta para o botão da conta',
     await p.evaluate(() => document.activeElement.id) === 'btn-abrir-conta', await foco());

  console.log('\n=== 2. foco: modal da imagem ===');
  await p.evaluate(() => irParaAba('hoje', { semRolar: true })); await p.waitForTimeout(250);
  await p.evaluate(() => abrirGeradorImagem('Texto do versículo.', 'Salmos 23:1', 'Biblia Livre'));
  await p.waitForTimeout(900);
  ok('o foco entrou no modal',
     await p.evaluate(() => $('modal-img').contains(document.activeElement)), await foco());
  let vazou3 = false;
  for(let i = 0; i < 12; i++){
    await p.keyboard.press('Tab');
    if(!(await p.evaluate(() => $('modal-img').contains(document.activeElement)))) { vazou3 = true; break; }
  }
  ok('o Tab não sai do modal', !vazou3, vazou3 ? await foco() : 'preso');
  await p.evaluate(() => fecharModalImg()); await p.waitForTimeout(300);

  console.log('\n=== 2. o teclado abre a folha do versículo ===');
  await p.evaluate(() => irParaAba('biblia', { semRolar: true }));
  /* a API bíblica não é alcançável daqui; servimos o capítulo de mentira */
  await p.evaluate(() => {
    window.buscarCapitulo = async () => ({ itens: [
      { numero: 1, texto: 'O Senhor é o meu pastor, nada me faltará.' },
      { numero: 2, texto: 'Deitar-me faz em verdes pastos.' }
    ] });
  });
  await p.evaluate(() => abrirLeitura(19, 23));
  await p.waitForTimeout(900);
  const verso = p.locator('#area-leitura .v').first();
  await verso.waitFor({ state: 'visible', timeout: 10000 });
  ok('o versículo é alcançável pelo teclado',
     await verso.evaluate(e => e.tabIndex === 0), await verso.evaluate(e => e.tabIndex));
  ok('e se anuncia como botão',
     await verso.getAttribute('role') === 'button');
  ok('e avisa que abre um diálogo',
     await verso.getAttribute('aria-haspopup') === 'dialog');
  /* foca e aciona pelo teclado, sem clique nenhum */
  await verso.evaluate(e => e.focus());
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  ok('Enter abre a folha de ações',
     await p.evaluate(() => $('folha-verso').classList.contains('ver')));
  ok('e o foco entra nela',
     await p.evaluate(() => $('folha-verso').contains(document.activeElement)), await foco());
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  ok('Escape fecha a folha', !(await p.evaluate(() => $('folha-verso').classList.contains('ver'))));
  ok('e devolve o foco ao versículo',
     await p.evaluate(() => document.activeElement.classList.contains('v')), await foco());

  /* espaço também aciona, e sem rolar a página */
  const antes = await p.evaluate(() => window.scrollY);
  await p.keyboard.press(' ');
  await p.waitForTimeout(500);
  ok('espaço abre a folha', await p.evaluate(() => $('folha-verso').classList.contains('ver')));
  ok('e não rola a página junto', Math.abs(await p.evaluate(() => window.scrollY) - antes) < 5);
  await p.evaluate(() => fecharFolha());
  await p.waitForTimeout(300);

  console.log('\n=== 3. alvos de toque ===');
  const medir = async (nome) => {
    const r = await p.evaluate(() => [...document.querySelectorAll('button,a[href],[role="button"]')]
      .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0)
      .filter(e => getComputedStyle(e).display !== 'inline')   /* link no meio de frase: dispensado */
      /* WCAG 2.5.8 dispensa alvos cujo tamanho é ditado pelo próprio texto:
         o versículo é um bloco de texto que por acaso também é tocável, e
         forçá-lo a 44px abriria buracos entre as linhas da leitura */
      .filter(e => !e.classList.contains('v'))
      /* o chip do tema estende a área de toque por fora, com ::after; a
         altura crua mente sobre ele e há asserção própria mais abaixo */
      .filter(e => !e.classList.contains('tema-devo'))
      .filter(e => !e.closest('#modal-img') || $('modal-img').classList.contains('aberto'))
      .map(e => ({ h: Math.round(e.getBoundingClientRect().height),
                   q: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0,24) }))
      .filter(x => x.h < 44));
    ok(nome + ': nenhum alvo abaixo de 44px', r.length === 0, r.length ? JSON.stringify(r) : '0');
  };
  for(const aba of ['hoje','biblia','planos','meu']){
    await p.evaluate(a => irParaAba(a, { semRolar: true }), aba);
    await p.waitForTimeout(250);
    await medir('aba ' + aba);
  }
  await p.evaluate(() => abrirMenu(true)); await p.waitForTimeout(300); await medir('gaveta');
  await p.evaluate(() => abrirPainelVoz(true)); await p.waitForTimeout(300); await medir('painel de voz');
  await p.evaluate(() => { abrirPainelVoz(false); abrirGeradorImagem('T.', 'Salmos 23:1', 'BL'); });
  await p.waitForTimeout(900); await medir('modal da imagem');
  await p.evaluate(() => fecharModalImg()); await p.waitForTimeout(300);

  console.log('\n=== 3. o ☰ era o pior caso ===');
  const ham = await p.evaluate(() => { const c = $('btn-menu').getBoundingClientRect();
    return { h: Math.round(c.height), w: Math.round(c.width) }; });
  ok('o ☰ tem 44×44 no mínimo', ham.h >= 44 && ham.w >= 44, ham.h + '×' + ham.w);

  console.log('\n=== 3. o chip do tema cresce sem inchar ===');
  await p.evaluate(() => irParaAba('hoje', { semRolar: true })); await p.waitForTimeout(300);
  const chip = await p.evaluate(() => {
    const c = document.querySelector('.tema-devo');
    if(!c) return null;
    const r = c.getBoundingClientRect(), x = r.x + r.width / 2;
    let topo = r.y, base = r.y + r.height;
    for(let y = r.y; y > r.y - 30; y--){ const e = document.elementFromPoint(x, y); if(e === c || c.contains(e)) topo = y; else break; }
    for(let y = r.y + r.height; y < r.y + r.height + 30; y++){ const e = document.elementFromPoint(x, y); if(e === c || c.contains(e)) base = y; else break; }
    return { visual: Math.round(r.height), toque: Math.round(base - topo) };
  });
  ok('desenho continua pequeno', chip.visual < 34, chip.visual + 'px');
  ok('mas a área de toque tem 44px', chip.toque >= 44, chip.toque + 'px');

  console.log('\n=== 4. contraste mínimo da WCAG AA ===');
  const lum = (cor) => { const c = cor.match(/[\d.]+/g).map(Number).slice(0,3)
    .map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; };
  const razao = (a, bb) => { const l1 = lum(a), l2 = lum(bb);
    return (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05); };

  for(const tema of ['claro','escuro']){
    await p.evaluate(t => aplicarTema(t), tema);
    await p.waitForTimeout(300);
    /* --texto-3 aparece sobre o papel dos cartões e sobre o fundo da página:
       o pior dos dois é que decide */
    const c = await p.evaluate(() => {
      const r = getComputedStyle(document.documentElement);
      const hex = h => { h = h.trim().replace('#',''); if(h.length===3) h = h.split('').map(x=>x+x).join('');
        return 'rgb(' + [0,2,4].map(i => parseInt(h.slice(i,i+2),16)).join(',') + ')'; };
      return { t3: hex(r.getPropertyValue('--texto-3')), t2: hex(r.getPropertyValue('--texto-2')),
               papel: hex(r.getPropertyValue('--papel')), fundo: hex(r.getPropertyValue('--fundo')) };
    });
    const pior3 = Math.min(razao(c.t3, c.papel), razao(c.t3, c.fundo));
    const pior2 = Math.min(razao(c.t2, c.papel), razao(c.t2, c.fundo));
    ok(tema + ': texto-3 passa os 4,5:1', pior3 >= 4.5, pior3.toFixed(2));
    ok(tema + ': texto-2 passa os 4,5:1', pior2 >= 4.5, pior2.toFixed(2));
  }

  /* o rótulo da aba inativa é 11px — texto normal, não grande */
  await p.evaluate(() => aplicarTema('claro'));
  await p.waitForTimeout(300);
  const aba = await p.evaluate(() => {
    const b = document.querySelector('#abas button:not(.ativo)');
    return { cor: getComputedStyle(b).color, fundo: getComputedStyle(document.querySelector('#abas')).backgroundColor,
             tamanho: parseFloat(getComputedStyle(b).fontSize) };
  });
  ok('o rótulo da aba inativa passa', razao(aba.cor, aba.fundo) >= 4.5,
     razao(aba.cor, aba.fundo).toFixed(2) + ' em ' + aba.tamanho + 'px');

  /* no tema escuro, ícone preto sobre fundo escuro some */
  await p.evaluate(() => aplicarTema('escuro'));
  await p.waitForTimeout(350);
  const pretos = await p.evaluate(() => [...document.querySelectorAll('img[src*="icon-"]')]
    .filter(i => i.offsetParent !== null && getComputedStyle(i).filter === 'none')
    .map(i => i.src.split('/').pop()));
  ok('nenhum ícone fica preto no tema escuro', pretos.length === 0, pretos.join(' ') || '0');
  await p.evaluate(() => aplicarTema('claro'));
  await p.waitForTimeout(300);

  console.log('\n=== 6. nenhum emoji colorido na interface ===');
  await p.evaluate(() => aplicarTema('claro'));
  await p.waitForTimeout(300);
  /* Emoji trazem cor própria, ignoram o tema e mudam de desenho conforme o
     aparelho. Aqui desenhamos cada glifo num canvas pedindo preto: o que
     sair colorido é emoji. */
  const coloridos = await p.evaluate(() => {
    const textos = [...document.querySelectorAll('button, .ferramenta, .tempo-percurso, .rotulo-secao')]
      .filter(e => e.offsetParent !== null)
      .map(e => e.textContent).join('');
    const glifos = [...new Set(textos.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [])];
    const c = document.createElement('canvas'); c.width = c.height = 40;
    const x = c.getContext('2d');
    return glifos.filter(g => {
      x.clearRect(0,0,40,40); x.fillStyle = '#000'; x.font = '28px system-ui';
      x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(g, 20, 20);
      const d = x.getImageData(0,0,40,40).data;
      let cor = 0, tinta = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i+3] < 30) continue; tinta++;
        if (Math.abs(d[i]-d[i+1]) > 12 || Math.abs(d[i+1]-d[i+2]) > 12) cor++; }
      return tinta && cor / tinta > 0.05;
    });
  });
  ok('nenhum emoji colorido em botão ou rótulo', coloridos.length === 0, coloridos.join(' ') || '0');

  ok('os ícones de interface são SVG que herdam a cor',
     await p.locator('svg.i').count() > 0, await p.locator('svg.i').count() + ' em uso');
  const herda = await p.evaluate(() => {
    const s = document.querySelector('svg.i');
    return s ? getComputedStyle(s).stroke : null;
  });
  ok('e o traço segue currentColor', herda && herda !== 'none', herda);

  /* os quatro microfones do app precisam ser o mesmo desenho */
  const mics = await p.evaluate(() => {
    const ids = ['btn-busca-voz', 'btn-oracao-voz', 'btn-nota-voz'];
    return ids.map(i => { const e = document.getElementById(i);
      const img = e && e.querySelector('img');
      return img ? img.getAttribute('src') : (e ? e.textContent.trim() : 'ausente'); });
  });
  ok('os microfones usam todos o mesmo ícone',
     new Set(mics).size === 1 && mics[0] === '/icon-mic.png', mics.join(' | '));

  console.log('\n=== 6. um "Ouvir" só no cartão do devocional ===');
  await p.evaluate(() => irParaAba('hoje', { semRolar: true }));
  await p.waitForTimeout(300);
  const ouvires = await p.evaluate(() =>
    [...document.querySelectorAll('#cartao-hoje .btn-ouvir')].map(b => b.textContent.trim()));
  ok('só um botão grande de ouvir', ouvires.length === 1, ouvires.join(' | '));
  ok('e é o "Ouvir e seguir"', /Ouvir e seguir/.test(ouvires[0] || ''), ouvires[0]);
  ok('o alto-falante do cabeçalho continua, para ouvir só o versículo',
     await p.locator('#cartao-hoje button.ouvir').count() === 1);

  /* fora do percurso o botão grande continua existindo */
  const soltoTemOuvir = await p.evaluate(() => {
    const c = cartaoVersiculo('Texto.', 19, 23, 1, 'BL', null, {});
    return c.querySelectorAll('.btn-ouvir').length;
  });
  ok('cartão avulso mantém o botão Ouvir', soltoTemOuvir === 1, soltoTemOuvir);

  console.log('\n=== 5. fontes servidas pelo próprio site ===');
  const rede = [];
  const espiao = r => { const u = new URL(r.url());
    if(!/localhost|127\.0\.0\.1/.test(u.hostname)) rede.push(u.hostname); };
  p.on('request', espiao);
  await p.reload();
  await p.waitForTimeout(1800);
  p.off('request', espiao);
  ok('nenhum pedido a fonts.googleapis ou gstatic',
     !rede.some(h => /googleapis|gstatic/.test(h)), [...new Set(rede)].join(' ') || 'nenhum externo');
  ok('não sobrou <link> para o Google no HTML',
     await p.evaluate(() => ![...document.querySelectorAll('link')].some(l => /google/.test(l.href || ''))));

  const fontes = await p.evaluate(async () => {
    await document.fonts.ready;
    return { sans: document.fonts.check('16px "Source Sans 3"'),
             serif: document.fonts.check('16px "Source Serif 4"'),
             quantas: document.fonts.size,
             corpo: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g,'') };
  });
  ok('a Source Sans carregou mesmo assim', fontes.sans);
  ok('a Source Serif também', fontes.serif);
  ok('e o corpo usa a Source Sans', fontes.corpo === 'Source Sans 3', fontes.corpo);
  ok('as duas estão no precache do service worker',
     await (async () => { const sw = await (await fetch(BASE + '/sw.js')).text();
       return /source-sans-3\.woff2/.test(sw) && /source-serif-4\.woff2/.test(sw); })());

  console.log('\n=== nada transbordou ===');
  ok('sem rolagem horizontal',
     await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);
  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
