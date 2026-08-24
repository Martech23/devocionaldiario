const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* A leitura vira uma folha: a mobília recua e o texto ganha a tela */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const CAP = (n = 40) => ({ verses: Array.from({ length: n }, (_, i) => ({
  verse: i + 1,
  text: 'Havia um homem entre os fariseus, chamado Nicodemos, príncipe dos judeus, e este foi ter de noite com Jesus.'
})) });

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (versos = 40) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.addInitScript(() => localStorage.setItem('lampada-dica-verso', '1'));
    await p.addInitScript(c => {
      const real = window.fetch;
      window.fetch = (u, o) => /getbible|helloao/.test(String(u))
        ? Promise.resolve({ ok: true, status: 200, json: async () => c }) : real(u, o);
    }, CAP(versos));
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(1000);
    return p;
  };
  const ler = async (p, cap = 3) => {
    await p.evaluate(async c => { irParaAba('biblia'); await abrirLeitura(43, c); window.scrollTo(0, 0); }, cap);
    await p.waitForTimeout(1100);
  };
  const visivel = (p, sel) => p.evaluate(s => {
    const e = document.querySelector(s);
    if(!e) return false;
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
  }, sel);

  console.log('\n=== a mobília recua e a Palavra ganha a tela ===');
  /* Medido antes desta mudança, na mesma tela de 390×844: o primeiro
     versículo começava em 640px dos 844 — 76% de mobília — e cabiam
     dois versículos. */
  let p = await abrir();
  await ler(p);
  const m = await p.evaluate(() => {
    const v = document.querySelector('#area-leitura .v');
    const tela = window.innerHeight;
    const inicio = Math.round(v.getBoundingClientRect().top);
    return {
      inicio, tela,
      mobilia: Math.round(inicio / tela * 100),
      versiculos: [...document.querySelectorAll('#area-leitura .v')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.top < tela - 60 && r.bottom > 48; }).length
    };
  });
  ok('o primeiro versículo sobe de 640px para menos de 250', m.inicio < 250, m.inicio + 'px');
  ok('a mobília cai de 76% para menos de um terço', m.mobilia < 33, m.mobilia + '%');
  ok('e cabem pelo menos cinco versículos, em vez de dois', m.versiculos >= 5, m.versiculos);

  console.log('\n=== o que sai de cena enquanto se lê ===');
  ok('a barra azul do app dá lugar ao cabeçalho da leitura', !(await visivel(p, 'header.barra')));
  ok('a busca e os dois seletores saem', !(await visivel(p, '#controles')));
  ok('o rótulo "Bíblia Sagrada completa" sai', !(await visivel(p, '#sec-biblia > .rotulo-secao')));
  ok('a barra de progresso de 103px sai', !(await visivel(p, '#wrap-progresso-biblia')));
  /* Ele não é escondido: escondê-lo deixaria o controle de verdade
     inalcançável por toque, com o cabeçalho fingindo ser ele. Ele desce
     para o pé do capítulo, onde não fica entre o título e o texto. */
  const ouvirPe = await p.evaluate(() => {
    const b = document.querySelector('#area-leitura .linha-ouvir');
    const v1 = document.querySelector('#area-leitura .v');
    return { existe: !!b, visivel: b ? b.getBoundingClientRect().height > 0 : false,
             abaixoDoTexto: b && v1 ? b.getBoundingClientRect().top > v1.getBoundingClientRect().top : false };
  });
  ok('o "Ouvir o capítulo" continua alcançável por toque', ouvirPe.existe && ouvirPe.visivel);
  ok('mas desce para o pé, saindo de entre o título e o texto', ouvirPe.abaixoDoTexto);
  ok('o cabeçalho da leitura entra', await visivel(p, '#cabeca-leitura'));
  ok('as abas continuam, para não perder a navegação', await visivel(p, '#abas, .abas'));

  console.log('\n=== nada foi removido do app: só saiu de cena ===');
  await p.evaluate(() => mostrarNivel('capitulos'));
  await p.waitForTimeout(500);
  ok('sair do capítulo devolve a barra do app', await visivel(p, 'header.barra'));
  ok('devolve a busca', await visivel(p, '#controles'));
  ok('devolve a barra de progresso', await visivel(p, '#wrap-progresso-biblia'));
  ok('e o estado de leitura sai do html',
     !(await p.evaluate(() => document.documentElement.dataset.lendo)));

  console.log('\n=== o cabeçalho da leitura ===');
  await ler(p);
  const cab = await p.evaluate(() => {
    const c = document.getElementById('cabeca-leitura');
    const r = c.getBoundingClientRect();
    const alvos = [...c.querySelectorAll('button')].map(b => ({
      id: b.id, alt: Math.round(b.getBoundingClientRect().height),
      larg: Math.round(b.getBoundingClientRect().width)
    }));
    return {
      altura: Math.round(r.height),
      esquerda: Math.round(r.left),
      largura: Math.round(r.width),
      janela: window.innerWidth,
      grudado: getComputedStyle(c).position,
      voltaPara: document.getElementById('cl-livro').textContent,
      recuo: Math.round(document.getElementById('cl-voltar').getBoundingClientRect().left),
      alvos
    };
  });
  ok('tem 48px de altura', cab.altura === 48, cab.altura);
  /* ele vive dentro do cartão, que já é sangrado: puxar de novo jogava
     o "‹" para fora da tela e o cortava */
  ok('vai de borda a borda, sem estourar', cab.esquerda === 0 && cab.largura === cab.janela,
     cab.esquerda + ' + ' + cab.largura + ' de ' + cab.janela);
  ok('e o "‹" não fica colado na borda', cab.recuo >= 8, cab.recuo + 'px');
  ok('fica grudado no topo ao rolar', cab.grudado === 'sticky', cab.grudado);
  /* "‹ João" diz para onde se volta; "‹ Voltar" não diria */
  ok('o voltar diz o nome do livro', cab.voltaPara === 'João', cab.voltaPara);
  for(const a of cab.alvos){
    ok('o botão ' + a.id + ' tem alvo de toque de 44px', a.alt >= 44 && a.larg >= 44,
       a.larg + '×' + a.alt);
  }

  console.log('\n=== a lupa traz a busca de volta ===');
  ok('começa fechada', !(await visivel(p, '#controles')));
  await p.evaluate(() => document.getElementById('cl-busca').click());
  await p.waitForTimeout(400);
  const comBusca = await p.evaluate(() => ({
    campo: !!document.querySelector('#controles .linha-busca'),
    focado: document.activeElement === document.getElementById('busca'),
    marcado: document.getElementById('cl-busca').getAttribute('aria-expanded'),
    seletores: getComputedStyle(document.querySelector('#controles .seletor-versao')).display,
    ferramentas: getComputedStyle(document.querySelector('#controles .linha-ferramentas')).display,
    ainda: document.documentElement.dataset.lendo
  }));
  ok('a busca aparece', await visivel(p, '#controles'));
  ok('com o cursor já no campo', comBusca.focado);
  ok('e a lupa marcada como aberta', comBusca.marcado === 'true');
  /* só a busca volta: os dois seletores e a barra de ferramentas
     continuam guardados, senão os 258px voltavam junto */
  ok('os seletores continuam guardados', comBusca.seletores === 'none');
  ok('a barra de ferramentas também', comBusca.ferramentas === 'none');
  ok('e a folha continua sendo folha', comBusca.ainda === '1');

  /* as sugestões que existem hoje têm de continuar funcionando ali */
  await p.evaluate(() => { $('busca').value = 'gên'; BuscaMemoria.sugerir(); });
  await p.waitForTimeout(300);
  ok('as sugestões funcionam dentro da leitura',
     await p.evaluate(() => document.querySelectorAll('#sugestoes-busca .sugestao').length > 0));

  await p.evaluate(() => document.getElementById('cl-busca').click());
  await p.waitForTimeout(300);
  ok('tocar de novo na lupa fecha', !(await visivel(p, '#controles')));
  ok('e a lupa volta a não estar marcada',
     (await p.evaluate(() => document.getElementById('cl-busca').getAttribute('aria-expanded'))) === 'false');

  console.log('\n=== o Ouvir do cabeçalho aciona o mesmo botão de antes ===');
  /* o botão saiu da tela, mas continua no DOM: o cabeçalho o aciona em
     vez de duplicar a lógica de montar as partes da voz */
  const ouviu = await p.evaluate(() => {
    const alvo = document.querySelector('#area-leitura .linha-ouvir .btn-ouvir');
    if(!alvo) return { achou: false };
    let cliques = 0;
    alvo.addEventListener('click', () => cliques++);
    document.getElementById('cl-ouvir').click();
    return { achou: true, cliques };
  });
  ok('o botão original continua no DOM', ouviu.achou);
  ok('e o Ouvir do cabeçalho o aciona', ouviu.cliques === 1, ouviu.cliques);

  console.log('\n=== o Aa dá a volta em vez de morrer no maior ===');
  const escalas = await p.evaluate(() => {
    const vistas = [];
    for(let i = 0; i < 5; i++){
      document.getElementById('cl-fonte').click();
      vistas.push(localStorage.getItem('lampada-escala'));
    }
    return vistas;
  });
  ok('cinco toques passeiam pelas quatro escalas e voltam',
     new Set(escalas).size === 4 && escalas[4] === escalas[0], escalas.join(' → '));
  await p.close();

  console.log('\n=== o fio de progresso ===');
  p = await abrir(60);
  await ler(p);
  const fio0 = await p.evaluate(() => document.getElementById('cl-fio').getBoundingClientRect().width);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(800);
  const fioFim = await p.evaluate(() => ({
    larg: document.getElementById('cl-fio').getBoundingClientRect().width,
    janela: window.innerWidth,
    valor: document.getElementById('cl-fio').getAttribute('aria-valuenow')
  }));
  ok('no topo do capítulo o fio está vazio', fio0 < 8, Math.round(fio0) + 'px');
  ok('no fim do capítulo ele está cheio', fioFim.larg > fioFim.janela * 0.9,
     Math.round(fioFim.larg) + ' de ' + fioFim.janela);
  ok('e o leitor de tela recebe a porcentagem', Number(fioFim.valor) >= 90, fioFim.valor);
  await p.close();

  /* capítulo que cabe inteiro na tela não tem progresso nenhum: um fio
     cheio ali seria um filete azul sem informação, parecendo borda */
  p = await abrir(3);
  await ler(p);
  const curto = await p.evaluate(() => ({
    larg: document.getElementById('cl-fio').getBoundingClientRect().width,
    valor: document.getElementById('cl-fio').getAttribute('aria-valuenow')
  }));
  ok('capítulo curto não mostra fio', curto.larg < 2, Math.round(curto.larg) + 'px');
  ok('e não anuncia porcentagem falsa', curto.valor === null, String(curto.valor));
  await p.close();

  console.log('\n=== os números pendurados na margem ===');
  p = await abrir();
  await ler(p);
  const margem = await p.evaluate(() => {
    const v = document.querySelector('#area-leitura .v');
    const sup = v.querySelector('sup');
    const rv = v.getBoundingClientRect(), rs = sup.getBoundingClientRect();
    /* o texto começa depois do número: é isso que dá a borda esquerda
       reta da mancha, sem o degrau do sobrescrito no meio da linha */
    const faixa = document.createRange();
    faixa.setStart(v.childNodes[1], 0);
    faixa.setEnd(v.childNodes[1], 5);
    return {
      sup: getComputedStyle(sup).position,
      numeroAntes: Math.round(rs.left) < Math.round(faixa.getBoundingClientRect().left),
      recuo: Math.round(faixa.getBoundingClientRect().left - rv.left),
      corDoNumero: getComputedStyle(sup).color
    };
  });
  ok('o número sai do fluxo do texto', margem.sup === 'absolute', margem.sup);
  ok('e fica à esquerda da mancha', margem.numeroAntes);
  ok('com o texto recuado para abrir a margem', margem.recuo >= 20, margem.recuo + 'px');

  const alinhado = await p.evaluate(() => {
    const faixas = [...document.querySelectorAll('#area-leitura .v')].slice(0, 5).map(v => {
      const f = document.createRange();
      f.setStart(v.childNodes[1], 0); f.setEnd(v.childNodes[1], 3);
      return Math.round(f.getBoundingClientRect().left);
    });
    return { faixas, iguais: new Set(faixas).size };
  });
  /* a promessa da margem: todos os versículos começam na mesma coluna,
     tenham número de um, dois ou três dígitos */
  ok('todos os versículos começam na mesma coluna', alinhado.iguais === 1,
     JSON.stringify(alinhado.faixas));

  console.log('\n=== a folha ===');
  const folha = await p.evaluate(() => {
    const cartao = document.querySelector('#sec-biblia > .cartao');
    const r = cartao.getBoundingClientRect();
    const cs = getComputedStyle(cartao);
    const fundo = getComputedStyle(document.body).backgroundColor;
    return {
      largura: Math.round(r.width), janela: window.innerWidth,
      papel: cs.backgroundColor, fundo, sombra: cs.boxShadow !== 'none',
      raio: cs.borderRadius
    };
  });
  ok('a folha vai de borda a borda', folha.largura === folha.janela,
     folha.largura + ' de ' + folha.janela);
  ok('o papel é mais claro que a mesa em volta', folha.papel !== folha.fundo,
     folha.papel + ' sobre ' + folha.fundo);
  ok('com sombra, para a folha levantar da mesa', folha.sombra);
  ok('e sem cantos arredondados, que a fariam parecer cartão', /^0px/.test(folha.raio), folha.raio);

  console.log('\n=== a versão da Bíblia foi para o pé da folha ===');
  const credito = await p.evaluate(() => {
    const c = document.querySelector('#area-leitura .rodape-folha');
    const cab = document.querySelector('#area-leitura .cab-cartao');
    return { existe: !!c, texto: c ? c.textContent : null,
             abaixoDoTitulo: c && cab ? c.getBoundingClientRect().top > cab.getBoundingClientRect().top : false };
  });
  ok('o crédito da versão existe', credito.existe && credito.texto.length > 0, credito.texto);
  ok('e está abaixo do capítulo, não na cabeça da página', credito.abaixoDoTitulo);

  console.log('\n=== o texto continua legível e sem vazar ===');
  const leg = await p.evaluate(() => {
    const v = document.querySelector('#area-leitura .v');
    const cs = getComputedStyle(v);
    const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => { const f = x => { x /= 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const L1 = lum(num(cs.color));
    const L2 = lum(num(getComputedStyle(document.querySelector('#sec-biblia > .cartao')).backgroundColor));
    return {
      razao: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2),
      rolagemLateral: document.documentElement.scrollWidth <= window.innerWidth,
      largura: Math.round(v.getBoundingClientRect().width)
    };
  });
  ok('o versículo passa nos 4,5 da AA sobre o papel', leg.razao >= 4.5, leg.razao + ':1');
  ok('e nada vaza para os lados', leg.rolagemLateral);
  await p.close();

  console.log('\n=== e nos dois temas ===');
  for(const tema of ['claro', 'escuro']){
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', e => erros.push(e.message));
    await pg.addInitScript(MOCK);
    await pg.addInitScript(() => localStorage.setItem('lampada-dica-verso', '1'));
    await pg.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    await pg.addInitScript(c => {
      const real = window.fetch;
      window.fetch = (u, o) => /getbible|helloao/.test(String(u))
        ? Promise.resolve({ ok: true, status: 200, json: async () => c }) : real(u, o);
    }, CAP());
    await pg.goto(BASE + '/index.html');
    await pg.waitForTimeout(1000);
    await pg.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
    await pg.waitForTimeout(1100);
    const r = await pg.evaluate(() => {
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r2, g2, b2]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r2) + 0.7152 * f(g2) + 0.0722 * f(b2); };
      const razao = (a, c) => { const L1 = lum(num(a)), L2 = lum(num(c));
        return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
      const papel = getComputedStyle(document.querySelector('#sec-biblia > .cartao')).backgroundColor;
      return {
        verso: razao(getComputedStyle(document.querySelector('#area-leitura .v')).color, papel),
        numero: razao(getComputedStyle(document.querySelector('#area-leitura .v sup')).color, papel),
        titulo: razao(getComputedStyle(document.querySelector('#area-leitura .referencia')).color, papel),
        cabecalho: razao(getComputedStyle(document.getElementById('cl-ouvir')).color,
                         getComputedStyle(document.getElementById('cabeca-leitura')).backgroundColor)
      };
    });
    ok('tema ' + tema + ': o versículo passa na AA', r.verso >= 4.5, r.verso + ':1');
    ok('tema ' + tema + ': o título do capítulo passa', r.titulo >= 4.5, r.titulo + ':1');
    ok('tema ' + tema + ': os botões do cabeçalho passam', r.cabecalho >= 4.5, r.cabecalho + ':1');
    /* o número na margem é chrome, e a AA pede 3:1 para elemento não
       textual — mas ele é texto, então mantemos os 4,5 */
    ok('tema ' + tema + ': o número na margem passa', r.numero >= 4.5, r.numero + ':1');
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
