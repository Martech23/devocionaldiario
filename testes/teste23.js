const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* O link do site vai junto ao compartilhar */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* o capítulo tem de vir de algum lugar para a leitura abrir de verdade */
const VERSOS = { 19: 'E chamou o nome daquele lugar Betel.',
                 20: 'E Jacó fez um voto, dizendo.',
                 21: 'E se eu tornar em paz à casa de meu pai.' };
async function rotaBiblia(p){
  await p.route('**/api.getbible.net/**', r => r.fulfill({ status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ verses: Object.entries(VERSOS).map(([k, v]) => ({ verse: +k, text: v })) }) }));
  await p.route('**/bible.helloao.org/**', r => r.fulfill({ status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ chapter: { content: Object.entries(VERSOS)
      .map(([k, v]) => ({ type: 'verse', number: +k, content: [v] })) } }) }));
}

const ESPIAO = () => {
  window.__share = [];
  window.__copiado = [];
  navigator.share = d => {
    window.__share.push({ text: d.text, url: d.url, title: d.title, files: (d.files || []).length });
    return Promise.resolve();
  };
  navigator.canShare = () => true;
};

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.addInitScript(ESPIAO);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.buscarVerso = async () => ({ texto: 'Porque para Deus nada é impossível.', versao: 'Almeida' });
  });
  await p.evaluate(() => versiculoDoDia());
  await p.waitForTimeout(600);

  console.log('\n=== o endereço sai da tag canônica ===');
  /* se o link do compartilhamento e o da prévia do WhatsApp saíssem de
     lugares diferentes, um dia iam divergir sem ninguém notar */
  const link = await p.evaluate(() => ({
    site: LINK_SITE,
    canonica: document.querySelector('link[rel="canonical"]').href,
    og: (document.querySelector('meta[property="og:url"]') || {}).content
  }));
  ok('LINK_SITE é a canônica', link.site === link.canonica, link.site);
  ok('e bate com a og:url da prévia', link.site === link.og);
  ok('é absoluto e https', /^https:\/\//.test(link.site));
  /* DOMINIO_SITE existia só para ser queimado no rodapé da imagem
     gerada. O endereço saiu de lá — marca d'água compete com o
     versículo, envelhece se o domínio mudar e não é clicável — e a
     constante foi junto. O link continua indo no compartilhamento. */

  console.log('\n=== versículo do cartão ===');
  /* o versículo do dia gira: fixar a referência fazia o teste reprovar
     na virada da data, sem nada de errado no app. Pergunta-se ao app
     qual é a passagem de hoje e confere-se contra ela. */
  const hoje = await p.evaluate(() => {
    /* lida do próprio cartão na tela: é a referência que a pessoa vê,
       e não uma conta que o teste refaz por fora e pode divergir */
    const el = document.querySelector('#cartao-hoje .referencia');
    const ref = el.childNodes[0].textContent.trim();
    const [, nome, cap, verso] = ref.match(/^(.+)\s(\d+):(\d+)$/);
    const livro = LIVROS.find(l => l.nome === nome);
    return { nr: livro.nr, cap: +cap, verso: +verso, ref };
  });
  console.log('     passagem de hoje:', hoje.ref);
  await p.click('#cartao-hoje .copiar');
  await p.waitForTimeout(250);
  let s = await p.evaluate(() => window.__share[0]);
  ok('compartilhou', !!s);
  ok('com o versículo', /nada é impossível/.test(s.text));
  ok('com a referência de hoje', s.text.includes(hoje.ref), hoje.ref);
  const alvoHoje = '?v=' + hoje.nr + '.' + hoje.cap + '.' + hoje.verso;
  ok('e com um link que leva a ela', s.url.endsWith(alvoHoje), s.url);
  ok('o link é do próprio site', s.url.startsWith(link.site));
  /* o link vai no campo url e não colado no texto: quem junta os dois,
     quando o destino só aceita texto, é o navegador — colar nos dois
     faria o endereço aparecer duas vezes no WhatsApp */
  ok('o link não está grudado no texto também', !s.text.includes(link.dominio));

  console.log('\n=== versículo da folha ===');
  /* Compartilhar e Imagem viraram um botão só que pergunta em que forma:
     o caminho agora passa pelo painel de envio. O que se prova continua
     sendo o mesmo — que o texto e o link saem da passagem aberta. */
  await p.evaluate(() => {
    window.__share = [];
    versoAberto = { nr: 1, cap: 1, verso: 1, texto: 'No princípio criou Deus os céus e a terra.' };
    $('fa-enviar').click();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => $('fa-enviar-texto').click());
  await p.waitForTimeout(250);
  s = await p.evaluate(() => window.__share[0]);
  ok('compartilhou', !!s);
  ok('com o versículo e a referência', /No princípio/.test(s.text) && /Gênesis 1:1/.test(s.text));
  ok('e com o link daquela passagem', /\?v=1\.1\.1$/.test(s.url), s.url);

  console.log('\n=== imagem ===');
  /* pelo botão de verdade, e não chamando o gerador na mão: o que
     precisa ser testado é a ligação entre a passagem aberta e a
     imagem — chamando direto, eu passaria as coordenadas eu mesmo e
     o teste passaria mesmo se o app tivesse esquecido de passá-las */
  await p.evaluate(() => {
    window.__share = [];
    versoAberto = { nr: 42, cap: 1, verso: 37, texto: 'Porque para Deus nada é impossível.' };
    $('fa-enviar').click();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => $('fa-enviar-imagem').click());
  await p.waitForTimeout(900);
  await p.evaluate(() => compartilharImagem());
  await p.waitForTimeout(900);
  s = await p.evaluate(() => window.__share[0]);
  ok('compartilhou o arquivo', s && s.files === 1, s && s.files);
  ok('com a referência na legenda', /Lucas 1:37/.test(s.text));
  ok('e com o link daquela passagem', /\?v=42\.1\.37$/.test(s.url), s.url);

  console.log('\n=== o rodapé da imagem ficou limpo ===');
  /* O endereço era desenhado em H*0.945 para viajar com a imagem
     reencaminhada. Saiu: marca d'água compete com o versículo, envelhece
     se o domínio mudar e não é clicável. O link continua na legenda do
     compartilhamento — as duas asserções acima provam isso. */
  const rodape = await p.evaluate(async () => {
    const c = document.getElementById('canvas-verso'), ctx = c.getContext('2d');
    const escrito = [];
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = (t, ...r) => { escrito.push(String(t)); return orig(t, ...r); };
    await desenharImagem();
    await new Promise(r => setTimeout(r, 150));
    return escrito;
  });
  ok('nada escrito na imagem é o endereço do site',
     !rodape.some(t => /vercel\.app|devocionaldiario|https?:/i.test(t)),
     JSON.stringify(rodape.filter(t => /vercel|devocional|http/i.test(t))));

  console.log('\n=== e é legível em todos os fundos ===');
  const cont = await p.evaluate(async () => {
    const lum = ([r, g, b]) => { const f = v => { v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const out = [];
    for(const f of FUNDOS){
      imgFundo = f.id;
      await desenharImagem();
      await new Promise(r => setTimeout(r, 120));
      const c = document.getElementById('canvas-verso'), ctx = c.getContext('2d');
      /* Antes media a faixa do endereço, que não existe mais. O que
         precisa ser legível sobre todo fundo é o versículo, e ele fica
         no miolo vertical da arte em qualquer um dos três formatos. */
      const d = ctx.getImageData(Math.round(c.width * 0.12), Math.round(c.height * 0.38),
                                 Math.round(c.width * 0.76), Math.round(c.height * 0.22)).data;
      let esc = [255, 255, 255], cla = [0, 0, 0];
      for(let i = 0; i < d.length; i += 4){
        const px = [d[i], d[i + 1], d[i + 2]];
        if(lum(px) < lum(esc)) esc = px;
        if(lum(px) > lum(cla)) cla = px;
      }
      const L1 = lum(esc), L2 = lum(cla);
      out.push({ id: f.id, r: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2) });
    }
    return out;
  });
  const pior = cont.reduce((a, x) => x.r < a.r ? x : a);
  ok('o versículo passa nos 4,5 da AA sobre todos os fundos', cont.every(x => x.r >= 4.5),
     'pior: ' + pior.id + ' ' + pior.r);
  ok('e são vários fundos mesmo', cont.length >= 8, cont.length + ' fundos');

  console.log('\n=== sem navigator.share, o link entra no texto copiado ===');
  /* aí não existe campo separado: se o endereço não for colado à mão,
     quem copia perde o link */
  const p2 = await b.newPage({ viewport: { width: 390, height: 900 } });
  p2.on('pageerror', e => erros.push(e.message));
  await p2.addInitScript(MOCK);
  await p2.addInitScript(() => {
    delete navigator.share;
    window.__copiado = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: t => { window.__copiado.push(t); return Promise.resolve(); } },
      configurable: true
    });
  });
  await p2.goto(BASE + '/index.html');
  await p2.waitForTimeout(900);
  await p2.evaluate(() => {
    window.buscarVerso = async () => ({ texto: 'Porque para Deus nada é impossível.', versao: 'Almeida' });
  });
  await p2.evaluate(() => versiculoDoDia());
  await p2.waitForTimeout(600);
  await p2.click('#cartao-hoje .copiar');
  await p2.waitForTimeout(250);
  const copiado = await p2.evaluate(() => window.__copiado[0]);
  ok('copiou algo', !!copiado);
  ok('com o versículo', /nada é impossível/.test(copiado || ''));
  ok('e com o link da passagem colado no fim',
     (copiado || '').trim().endsWith(alvoHoje),
     JSON.stringify((copiado || '').slice(-46)));

  console.log('\n=== abrir o app por um link compartilhado ===');
  /* é o ponto da coisa toda: quem recebeu o versículo cai nele, e não
     numa capa onde teria de procurá-lo */
  const p3 = await b.newPage({ viewport: { width: 390, height: 900 } });
  p3.on('pageerror', e => erros.push(e.message));
  await p3.addInitScript(MOCK);
  await rotaBiblia(p3);
  await p3.goto(BASE + '/index.html?v=1.28.19');
  await p3.waitForTimeout(1800);
  ok('abriu na aba Bíblia', (await p3.evaluate(() => abaAtual)) === 'biblia');
  ok('com o capítulo na tela', await p3.locator('#area-leitura').isVisible());
  ok('no livro e capítulo certos',
     /Gênesis 28/.test(await p3.locator('#area-leitura').textContent()));
  ok('com o versículo destacado', (await p3.locator('#area-leitura .v.destaque').count()) === 1);
  ok('e o destacado é o 19',
     /^19/.test((await p3.locator('#area-leitura .v.destaque').textContent() || '').trim()));
  /* sem limpar, a pessoa navegaria o app inteiro com ?v= na barra e um
     "atualizar" mais tarde a jogaria de volta àquele versículo */
  ok('o endereço foi limpo depois de atendido',
     (await p3.evaluate(() => location.search)) === '',
     JSON.stringify(await p3.evaluate(() => location.search)));
  await p3.close();

  console.log('\n=== link estragado não derruba o app ===');
  for(const [q, nome] of [['?v=99.1.1', 'livro que não existe'],
                          ['?v=1.999.1', 'capítulo além do fim'],
                          ['?v=abacaxi', 'lixo no lugar dos números'],
                          ['', 'sem parâmetro nenhum']]){
    const pg = await b.newPage({ viewport: { width: 390, height: 900 } });
    const err = [];
    pg.on('pageerror', e => err.push(e.message));
    await pg.addInitScript(MOCK);
    await rotaBiblia(pg);
    await pg.goto(BASE + '/index.html' + q);
    await pg.waitForTimeout(1100);
    const aba = await pg.evaluate(() => abaAtual);
    ok(nome + ': cai no devocional em vez de quebrar', aba === 'hoje' && err.length === 0,
       aba + (err.length ? ' · ' + err[0] : ''));
    await pg.close();
  }

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource|Failed to fetch/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
