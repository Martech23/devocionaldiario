const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Os fundos desenhados saíram da escolha e ficaram como socorro.
   Este teste prende as duas metades: não se escolhe, mas não falta. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const PEXELS = `
(() => {
  window.__semPexels = false;
  window.__urls = [];
  const real = window.fetch;
  window.fetch = (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if(url.startsWith('/api/pexels')){
      window.__urls.push(url);
      if(window.__semPexels) return Promise.reject(new TypeError('Failed to fetch'));
      const p = Number(new URL(url, location.origin).searchParams.get('page') || 1);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({
        page: p, ultima: p >= 4,
        photos: Array.from({ length: 24 }, (_, i) => ({
          id: p * 1000 + i, url: '/icon-512.png', thumb: '/icon-192.png',
          photographer: 'Autor p' + p + 'n' + i })) }) });
    }
    if(url.startsWith('/api/proxy-image')) return real('/icon-512.png');
    return real(u, o);
  };
})();`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (antes) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(PEXELS);
    await p.addInitScript(MOCK);
    if(antes) await p.addInitScript(antes);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(() => abrirGeradorImagem(
      'Ele sara aos de coração partido, e os cura de suas dores.',
      'Salmos 147:3', 'Bíblia Livre', 'Cura e consolo', [19, 147, 3]));
    await p.waitForTimeout(1600);
    return p;
  };
  const fita = (p) => p.evaluate(() => {
    const f = document.getElementById('img-fundos');
    const ops = [...f.querySelectorAll('.fundo-op')];
    return {
      fotos: ops.filter(x => x.dataset.foto !== undefined).length,
      desenhos: ops.filter(x => x.dataset.arte !== undefined).length,
      radios: f.querySelectorAll('[role="radio"]').length,
      cortes: f.querySelectorAll('.fita-corte').length,
      vazia: !!f.querySelector('.fita-vazia'),
      vazioTexto: (f.querySelector('.fita-vazia') || {}).textContent || '',
      modo: imgModo,
      credito: document.getElementById('img-credito-foto').textContent,
      marcados: ops.filter(x => x.getAttribute('aria-checked') === 'true').length,
      pintou: document.getElementById('canvas-verso')
        .getContext('2d').getImageData(0, 0, 4, 4).data[3] === 255
    };
  });

  console.log('\n=== na escolha, só foto de verdade ===');
  let p = await abrir();
  const normal = await fita(p);
  ok('a fita tem só fotos', normal.fotos === 24 && normal.desenhos === 0,
     normal.fotos + ' fotos, ' + normal.desenhos + ' desenhos');
  ok('  nenhuma miniatura desenhada sobrou', normal.desenhos === 0);
  ok('  nem o traço que as separava', normal.cortes === 0);
  ok('  e todo botão de escolha é foto', normal.radios === normal.fotos, normal.radios);
  ok('uma foto está escolhida', normal.marcados === 1 && normal.modo === 'foto', normal.modo);
  ok('a legenda credita o fotógrafo', /Pexels/.test(normal.credito), normal.credito);

  /* nada no app oferece mais um fundo desenhado para escolher */
  const semOferta = await p.evaluate(() =>
    !document.querySelector('[data-arte]') && !document.getElementById('btn-trocar-fundo'));
  ok('não há nenhum caminho para escolher um desenho', semOferta);
  await p.close();

  console.log('\n=== mas sem Pexels a imagem ainda sai ===');
  /* Um app que se instala para funcionar offline não pode responder
     "não deu" a quem só queria compartilhar um versículo. */
  p = await abrir(() => { window.__semPexels = true; });
  const socorro = await fita(p);
  ok('cai no fundo desenhado sozinho', socorro.modo === 'arte', socorro.modo);
  ok('  e a imagem sai mesmo assim', socorro.pintou);
  ok('  sem nenhuma miniatura marcada — não foi escolha de ninguém',
     socorro.marcados === 0, socorro.marcados);
  ok('  e sem desenho nenhum na fita', socorro.desenhos === 0);

  console.log('\n=== e a tela diz por quê ===');
  ok('a legenda explica a falta, e não anuncia um estilo',
     /sem foto/i.test(socorro.credito) && !/artístico/i.test(socorro.credito),
     socorro.credito);
  ok('a fita vazia se explica em vez de parecer defeito',
     socorro.vazia && /nenhuma foto/i.test(socorro.vazioTexto), socorro.vazioTexto);
  ok('  e o botão de tentar de novo continua lá',
     await p.evaluate(() => !!document.querySelector('#img-fundos .fundo-op.mais')));

  console.log('\n=== quando a rede volta, a foto assume ===');
  const voltou = await p.evaluate(async () => {
    window.__semPexels = false;
    document.querySelector('#img-fundos .fundo-op.mais').click();
    await new Promise(r => setTimeout(r, 1200));
    const ops = [...document.querySelectorAll('#img-fundos .fundo-op[data-foto]')];
    return { modo: imgModo, fotos: ops.length,
             marcados: ops.filter(x => x.getAttribute('aria-checked') === 'true').length,
             credito: document.getElementById('img-credito-foto').textContent,
             vazia: !!document.querySelector('#img-fundos .fita-vazia') };
  });
  ok('sai do socorro sozinho', voltou.modo === 'foto', voltou.modo);
  ok('  com as fotos na fita', voltou.fotos === 24, voltou.fotos);
  ok('  uma delas escolhida', voltou.marcados === 1, voltou.marcados);
  ok('  a legenda volta a creditar o fotógrafo', /Pexels/.test(voltou.credito), voltou.credito);
  ok('  e a mensagem de fita vazia some', !voltou.vazia);
  await p.close();

  console.log('\n=== o desenho continua no código, e funcionando ===');
  /* Sair da escolha não é sair do app: são eles que seguram o offline. */
  p = await abrir();
  const motor = await p.evaluate(() => {
    const antes = imgModo;
    imgModo = 'arte';
    imgFundo = FUNDOS[3].id;
    desenharImagemArte();
    const c = document.getElementById('canvas-verso').getContext('2d');
    const amostra = [[10, 10], [500, 200], [900, 1200]]
      .map(([x, y]) => Array.from(c.getImageData(x, y, 1, 1).data).join(','));
    imgModo = antes;
    return { quantos: FUNDOS.length, nomes: FUNDOS.map(f => f.nome),
             opaco: c.getImageData(0, 0, 1, 1).data[3] === 255,
             variou: new Set(amostra).size > 1 };
  });
  ok('os dez fundos continuam existindo', motor.quantos === 10, motor.quantos);
  ok('  e desenham de verdade quando chamados', motor.opaco && motor.variou);
  ok('a escolha do socorro é determinística pela referência',
     await p.evaluate(() => {
       imgFundo = null;
       imgAtual = { texto: 'x', ref: 'João 3:16', versao: 'v' };
       const a = fundoAtual().id;
       imgAtual = { texto: 'x', ref: 'João 3:16', versao: 'v' };
       return a === fundoAtual().id;
     }));
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
