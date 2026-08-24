const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* "Outras fotos" voltava para a primeira foto e depois não fazia mais
   nada. Este teste prende a causa e o conserto — e a conta da cota. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* Um Pexels de mentira que se comporta como o de verdade: responde por
   página, e a página 4 é a última. */
const PEXELS = `
(() => {
  window.__urls = [];
  const POR_PAGINA = 24;
  const real = window.fetch;
  window.fetch = (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if(url.startsWith('/api/pexels')){
      window.__urls.push(url);
      const p = new URL(url, location.origin).searchParams;
      const pagina = Number(p.get('page') || 1);
      const porPagina = Number(p.get('per_page') || 12);
      /* o servidor limita a 4 páginas; acima disso devolve vazio */
      const fotos = pagina > 4 ? [] : Array.from({ length: porPagina }, (_, i) => ({
        id: pagina * 1000 + i,
        url: '/icon-512.png', thumb: '/icon-192.png',
        photographer: 'Autor p' + pagina + 'n' + i
      }));
      return Promise.resolve({ ok: true, status: 200, json: async () => ({
        page: pagina, ultima: pagina >= 4 || fotos.length < porPagina,
        total: 96, photos: fotos
      }) });
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

  const abrir = async () => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(PEXELS);
    await p.addInitScript(MOCK);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(() => abrirGeradorImagem(
      'Ele sara aos de coração partido, e os cura de suas dores.',
      'Salmos 147:3', 'Bíblia Livre', 'Cura e consolo', [19, 147, 3]));
    await p.waitForTimeout(1600);
    return p;
  };
  const tocarOutras = (p) => p.evaluate(async () => {
    document.querySelector('#img-fundos .fundo-op.mais').click();
    await new Promise(r => setTimeout(r, 800));
  });
  const estado = (p) => p.evaluate(() => {
    const ops = [...document.querySelectorAll('#img-fundos .fundo-op[data-foto]')];
    return {
      fotos: ops.length,
      escolhida: imgFotoIdx,
      idEscolhido: (imgFotoLista[imgFotoIdx] || {}).id,
      primeiroId: (imgFotoLista[0] || {}).id,
      ids: imgFotoLista.map(f => f.id),
      modo: imgModo,
      pedidos: window.__urls.length,
      urls: window.__urls.slice()
    };
  });

  console.log('\n=== o defeito: pedia a mesma página de novo ===');
  /* "Outras fotos" apagava o cache e refazia a MESMA consulta, sem
     página nenhuma: o Pexels devolvia as mesmas fotos e a borda da
     Vercel nem encaminhava o pedido. */
  let p = await abrir();
  const inicio = await estado(p);
  ok('a primeira busca pede a página 1', /page=1/.test(inicio.urls[0]), inicio.urls[0]);
  ok('  com per_page declarado', /per_page=24/.test(inicio.urls[0]));

  await tocarOutras(p);
  const dep1 = await estado(p);
  ok('o segundo toque pede a página 2, não a 1',
     /page=2/.test(dep1.urls[dep1.urls.length - 1]), dep1.urls[dep1.urls.length - 1]);
  ok('  e a página pedida nunca se repete',
     new Set(dep1.urls).size === dep1.urls.length, dep1.urls.length + ' pedidos, ' +
     new Set(dep1.urls).size + ' distintos');

  console.log('\n=== as fotos se somam, não se substituem ===');
  ok('a fita cresceu em vez de trocar de conteúdo',
     dep1.fotos > inicio.fotos, inicio.fotos + ' → ' + dep1.fotos);
  ok('  e tudo que estava lá continua lá',
     inicio.ids.every(id => dep1.ids.includes(id)));
  ok('  sem repetir nenhuma', new Set(dep1.ids).size === dep1.ids.length);

  console.log('\n=== não volta mais para a primeira foto ===');
  /* Era isto que se via: imgFotoIdx = 0 saltava para a primeira de uma
     lista idêntica, e apertar de novo não mudava nada porque já estava
     na primeira. */
  ok('a foto escolhida continua sendo a mesma de antes',
     dep1.idEscolhido === inicio.idEscolhido,
     'antes ' + inicio.idEscolhido + ', depois ' + dep1.idEscolhido);
  ok('  e não é a primeira da fita só por acaso',
     inicio.escolhida !== 0 || inicio.ids.length === 1,
     'índice inicial ' + inicio.escolhida);

  /* e escolher uma foto à mão sobrevive ao toque seguinte */
  const escolhido = await p.evaluate(async () => {
    const ops = [...document.querySelectorAll('#img-fundos .fundo-op[data-foto]')];
    const alvo = ops[5];
    alvo.click();
    await new Promise(r => setTimeout(r, 500));
    return { id: imgFotoLista[imgFotoIdx].id, idx: imgFotoIdx };
  });
  await tocarOutras(p);
  const dep2 = await estado(p);
  ok('escolhi a sexta foto e ela continua escolhida depois de "Outras fotos"',
     dep2.idEscolhido === escolhido.id, escolhido.id + ' → ' + dep2.idEscolhido);
  ok('  com a fita ainda maior', dep2.fotos > dep1.fotos, dep1.fotos + ' → ' + dep2.fotos);
  ok('  e a miniatura dela marcada',
     await p.evaluate(i => {
       const el = document.querySelector('#img-fundos .fundo-op[data-foto="' + i + '"]');
       return el && el.getAttribute('aria-checked') === 'true';
     }, escolhido.idx));

  console.log('\n=== o fim da fita se anuncia ===');
  /* sem isto, o botão continuaria oferecendo o que já não existe */
  await tocarOutras(p);   /* página 4 */
  const noFim = await p.evaluate(() => {
    const m = document.querySelector('#img-fundos .fundo-op.mais');
    return { texto: m.textContent.trim(), desabilitado: m.disabled,
             rotulo: m.getAttribute('aria-label'),
             fotos: imgFotoLista.length,
             pedidos: window.__urls.length };
  });
  ok('depois da última página o botão vira "Fim"', /Fim/.test(noFim.texto), noFim.texto);
  ok('  e não pode mais ser tocado', noFim.desabilitado === true);
  ok('  dizendo por quê a quem usa leitor de tela',
     /não há mais/i.test(noFim.rotulo || ''), noFim.rotulo);
  ok('quatro páginas de 24 dão 96 fotos', noFim.fotos === 96, noFim.fotos);
  ok('  em quatro pedidos, um por página', noFim.pedidos === 4, noFim.pedidos);

  const insistir = await p.evaluate(async () => {
    const antes = window.__urls.length;
    const m = document.querySelector('#img-fundos .fundo-op.mais');
    m.click(); m.click();
    await new Promise(r => setTimeout(r, 500));
    return { antes, depois: window.__urls.length };
  });
  ok('insistir no fim não gasta cota', insistir.depois === insistir.antes,
     insistir.antes + ' → ' + insistir.depois);
  await p.close();

  console.log('\n=== reabrir não recomeça a conta ===');
  /* o acumulado fica em cache no aparelho: fechar e abrir de novo não
     pode custar mais uma volta de pedidos */
  p = await abrir();
  const reaberto = await p.evaluate(async () => {
    await tocarFora();
    async function tocarFora(){
      for(let i = 0; i < 3; i++){
        document.querySelector('#img-fundos .fundo-op.mais').click();
        await new Promise(r => setTimeout(r, 700));
      }
    }
    const antes = window.__urls.length;
    fecharModalImgDireto();
    await new Promise(r => setTimeout(r, 200));
    abrirGeradorImagem('Ele sara aos de coração partido, e os cura de suas dores.',
      'Salmos 147:3', 'Bíblia Livre', 'Cura e consolo', [19, 147, 3]);
    await new Promise(r => setTimeout(r, 1200));
    return { antes, depois: window.__urls.length,
             fotos: document.querySelectorAll('#img-fundos .fundo-op[data-foto]').length };
  });
  ok('reabrir o gerador não faz pedido novo',
     reaberto.depois === reaberto.antes, reaberto.antes + ' → ' + reaberto.depois);
  ok('  e a fita já volta com as 96', reaberto.fotos === 96, reaberto.fotos);
  await p.close();

  console.log('\n=== a conta da cota do Pexels ===');
  /* 200 pedidos/hora e 20 mil/mês no plano gratuito. Como a borda da
     Vercel guarda a resposta, o custo é o número de ENDEREÇOS
     distintos, não o de pessoas. */
  const pex = fs.readFileSync(RAIZ + '/api/pexels.js', 'utf8');
  const app = fs.readFileSync(RAIZ + '/app.js', 'utf8');
  const temas = (app.match(/const PROMESSAS = \{[\s\S]*?\n\};/) || [''])[0]
    .split('\n').filter(l => /^\s{2}'[^']+':/.test(l)).length;
  const paginas = Number((pex.match(/parseInt\(\(req\.query && req\.query\.page\)[\s\S]*?, 1\), (\d+)\)/) || [, 0])[1]);
  const cache = Number((pex.match(/s-maxage=(\d+)/) || [, 0])[1]);
  const enderecos = temas * 2 * paginas;          /* tema × orientação × página */
  const porDia = enderecos * (86400 / cache);
  const porMes = porDia * 30;
  console.log('     ' + temas + ' temas × 2 orientações × ' + paginas + ' páginas = ' +
              enderecos + ' endereços · cache de ' + (cache / 3600) + 'h');
  console.log('     pior caso: ' + porDia + '/dia, ' + porMes + '/mês');
  ok('o teto de páginas está declarado no servidor', paginas === 4, paginas);
  ok('o cache da borda é de 24 horas', cache === 86400, cache + 's');
  ok('pior caso cabe nos 200 pedidos/hora', porDia / 24 <= 200, Math.round(porDia / 24) + '/h');
  ok('pior caso cabe nos 20.000/mês', porMes <= 20000, porMes + '/mês');
  ok('  com folga de pelo menos 3×', porMes * 3 <= 20000,
     Math.round(20000 / porMes) + '× de folga');

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
