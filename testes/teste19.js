const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Prévia ao compartilhar o link (Open Graph) */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage();
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  await p.goto(BASE + '/index.html');

  const og = await p.evaluate(() => {
    const m = {};
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(e =>
      m[e.getAttribute('property') || e.getAttribute('name')] = e.getAttribute('content'));
    const can = document.querySelector('link[rel="canonical"]');
    return { m, canonical: can && can.href };
  });

  console.log('\n=== a capa declara a prévia ===');
  ok('tem og:title', !!og.m['og:title'], og.m['og:title']);
  ok('tem og:description', !!og.m['og:description']);
  ok('tem og:image', !!og.m['og:image'], og.m['og:image']);
  ok('tem og:url', !!og.m['og:url']);
  ok('tem og:type', og.m['og:type'] === 'website');
  ok('tem canonical', !!og.canonical, og.canonical);

  console.log('\n=== a imagem está num endereço que o robô resolve ===');
  /* o robô não está numa página: ele busca uma URL. Caminho relativo
     ou protocolo faltando e a prévia sai sem imagem. */
  ok('og:image é absoluta e https', /^https:\/\//.test(og.m['og:image'] || ''));
  ok('og:url é absoluta e https', /^https:\/\//.test(og.m['og:url'] || ''));
  ok('o mesmo domínio nas duas',
     new URL(og.m['og:image']).host === new URL(og.m['og:url']).host,
     new URL(og.m['og:image']).host);

  console.log('\n=== a imagem serve para prévia grande ===');
  ok('declara largura 1200', og.m['og:image:width'] === '1200', og.m['og:image:width']);
  ok('declara altura 630', og.m['og:image:height'] === '630', og.m['og:image:height']);
  ok('declara o tipo', /jpeg|png/.test(og.m['og:image:type'] || ''), og.m['og:image:type']);
  ok('tem texto alternativo', (og.m['og:image:alt'] || '').length > 15);
  ok('pede cartão grande no Twitter/X', og.m['twitter:card'] === 'summary_large_image');

  console.log('\n=== o arquivo existe mesmo, e no tamanho declarado ===');
  const caminho = new URL(og.m['og:image']).pathname;
  const r = await p.request.get(BASE + caminho);
  ok('o arquivo responde', r.status() === 200, r.status());
  ok('é servido como imagem', /^image\//.test(r.headers()['content-type'] || ''),
     r.headers()['content-type']);
  const bytes = (await r.body()).length;
  /* acima de ~300 KB o robô do WhatsApp costuma desistir e a prévia
     volta a sair sem imagem — foi por isso que a arte virou JPEG */
  ok('é leve o bastante para o robô não desistir', bytes < 300 * 1024,
     Math.round(bytes / 1024) + ' KB');

  const dim = await p.evaluate(src => new Promise(res => {
    const i = new Image();
    i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => res({ w: 0, h: 0 });
    i.src = src;
  }), caminho);
  ok('a imagem tem mesmo 1200x630', dim.w === 1200 && dim.h === 630, dim.w + 'x' + dim.h);
  ok('e a proporção é a que abre prévia grande', Math.abs(dim.w / dim.h - 1.91) < 0.03,
     (dim.w / dim.h).toFixed(2));

  console.log('\n=== a política de privacidade também tem prévia ===');
  await p.goto(BASE + '/privacidade.html');
  const priv = await p.evaluate(() => {
    const m = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(e =>
      m[e.getAttribute('property')] = e.getAttribute('content'));
    return m;
  });
  ok('tem og:image', /^https:\/\//.test(priv['og:image'] || ''));
  ok('com título próprio', /Privacidade/.test(priv['og:title'] || ''), priv['og:title']);
  ok('e og:url apontando para ela mesma', /privacidade/.test(priv['og:url'] || ''));

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
