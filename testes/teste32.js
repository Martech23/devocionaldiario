const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* A CSP fechada: sem unsafe-inline, sem unsafe-eval, e o app inteiro */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const RAIZ = require('path').resolve(__dirname, '..');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* A política que a Vercel manda em produção. O servidor local não manda
   cabeçalho nenhum, então sem isto o teste rodaria sem CSP e não provaria
   coisa alguma — que é justamente como o unsafe-inline sobreviveu tanto. */
const CSP = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'))
  .headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const violacoes = [];
  const erros = [];

  const abrir = async (pagina = 'index.html') => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    /* o navegador dispara este evento a cada recusa da política */
    await p.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push({
        diretiva: e.violatedDirective,
        alvo: String(e.blockedURI || '').slice(0, 60),
        linha: e.lineNumber
      }));
    });
    await p.addInitScript(MOCK);
    /* Um capítulo de mentira. O MOCK só troca a síntese de voz, e o
       sandbox bloqueia a API bíblica — sem isto a leitura nunca renderiza
       e o teste não teria como olhar o DOM que ela monta, que é
       justamente onde moravam os style= criados por JavaScript. */
    await p.addInitScript(() => {
      const real = window.fetch;
      window.fetch = (u, o) => {
        if(/getbible|helloao/.test(String(u))){
          const versos = [];
          for(let i = 1; i <= 36; i++) versos.push({ verse: i, text: 'Versículo de teste número ' + i + '.' });
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ verses: versos }) });
        }
        return real(u, o);
      };
    });
    /* a CSP de produção, aplicada a mão no servidor de teste */
    await p.route('**/*', async rota => {
      const r = await rota.fetch();
      const h = { ...r.headers(), 'content-security-policy': CSP };
      rota.fulfill({ response: r, headers: h });
    });
    await p.goto(BASE + '/' + pagina);
    await p.waitForTimeout(1200);
    return p;
  };

  const csp = async (p) => {
    const v = await p.evaluate(() => window.__csp || []);
    violacoes.push(...v);
    return v;
  };

  console.log('\n=== a política não tem mais nenhuma brecha ===');
  ok('sem unsafe-inline', !/unsafe-inline/.test(CSP));
  ok('sem unsafe-eval', !/unsafe-eval/.test(CSP));
  ok('script só da própria origem e do CDN do Supabase',
     /script-src 'self' https:\/\/cdn\.jsdelivr\.net;/.test(CSP), CSP.match(/script-src[^;]*/)[0]);
  ok('estilo só da própria origem e do Google Fonts',
     /style-src 'self' https:\/\/fonts\.googleapis\.com;/.test(CSP), CSP.match(/style-src[^;]*/)[0]);
  ok('object-src fechado, que barra plugin e embed', /object-src 'none'/.test(CSP));
  ok('e o resto continua fechado',
     /frame-ancestors 'none'/.test(CSP) && /base-uri 'self'/.test(CSP) && /form-action 'self'/.test(CSP));

  console.log('\n=== o HTML não tem mais nada embutido ===');
  for(const arq of ['index.html', 'privacidade.html']){
    /* comentário fora: o bloco que explica a RLS do Supabase cita um
       <img src=x onerror=…> como exemplo de ataque, e o exemplo casava */
    const h = fs.readFileSync(path.join(RAIZ, arq), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    ok(arq + ': sem bloco <script> embutido', !/<script>/.test(h));
    ok(arq + ': sem bloco <style> embutido', !/<style>/.test(h));
    ok(arq + ': sem atributo style=', !/style="/.test(h));
    /* onclick no HTML também precisaria de unsafe-inline */
    ok(arq + ': sem manipulador no HTML (onclick e afins)',
       !/<[a-z][^>]*\son(click|load|error|change|input|submit)=/i.test(h));
  }

  console.log('\n=== e o app funciona inteiro sob a política ===');
  /* É esta a parte que importa: fechar a CSP é fácil, difícil é fechar
     sem quebrar nada. O servidor local não manda cabeçalho, então sem a
     injeção acima o teste passaria mesmo com o app quebrado. */
  let p = await abrir();
  const vivo = await p.evaluate(() => ({
    js: typeof Navegacao === 'object' && typeof BuscaMemoria === 'object',
    css: getComputedStyle(document.querySelector('header.barra')).position === 'sticky',
    devocional: !!document.getElementById('cartao-hoje'),
    abas: document.querySelectorAll('#abas button').length
  }));
  ok('o JavaScript carregou e rodou', vivo.js);
  ok('o CSS externo foi aplicado', vivo.css);
  ok('o devocional do dia está na tela', vivo.devocional);
  ok('as abas existem', vivo.abas >= 4, vivo.abas);
  ok('nenhuma recusa da política até aqui', (await csp(p)).length === 0,
     JSON.stringify(await p.evaluate(() => window.__csp)));

  /* as classes que substituíram os style= têm de valer de verdade */
  const classes = await p.evaluate(() => ({
    svg: getComputedStyle(document.querySelector('svg[aria-hidden="true"]')).position,
    nota: getComputedStyle(document.querySelector('.gaveta .nota')).fontSize
  }));
  ok('o SVG de símbolos continua fora do fluxo', classes.svg === 'absolute', classes.svg);
  /* as larguras do esqueleto de carregamento eram style= dentro de um
     template do JavaScript, que a CSP recusa igual ao do HTML */
  const esq = await p.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<div class="skeleton skeleton-linha w-75"></div>';
    document.body.appendChild(d);
    const l = getComputedStyle(d.firstChild).width;
    const pai = getComputedStyle(d).width;
    d.remove();
    return { linha: parseFloat(l), pai: parseFloat(pai) };
  });
  ok('a largura do esqueleto virou classe e vale 75%',
     Math.abs(esq.linha / esq.pai - 0.75) < 0.02, (esq.linha / esq.pai).toFixed(3));

  console.log('\n=== cada style= que virou classe rende o mesmo valor ===');
  /* O style= embutido vencia qualquer seletor; a classe não vence por
     padrão. Foi assim que a largura do esqueleto de carregamento caiu de
     75% para os 65% de .skeleton-linha:last-child. Aqui cada uma das
     substituições é conferida contra o que o inline declarava. */
  const ESPERADO = {
    'svg-simbolos': { position: 'absolute' },
    'mt-8':  { marginTop: '8px' },   'mt-10': { marginTop: '10px' },
    'mt-14': { marginTop: '14px' },
    'mt-16': { marginTop: '16px' },  'mt-18': { marginTop: '18px' },
    'mb-0':  { marginBottom: '0px' },'mb-8':  { marginBottom: '8px' },
    'w-80':  { width: '80%' },       'w-75':  { width: '75%' },
    'linha-8': { display: 'flex', gap: '8px' },
    'botao-largo': { justifyContent: 'center' },
    /* w-100-mb-12 saiu com o botão "Trocar fundo", que virou a fita de
       miniaturas; nota-mini saiu com a linha de crédito solta, que virou
       legenda da prévia (.credito-foto). */
    'mt-20-mb-22': { marginTop: '20px', marginBottom: '22px' },
    'mt-16-mb-0':  { marginTop: '16px', marginBottom: '0px' },
    'titulo-menor': { marginBottom: '12px', fontSize: '16px' },
    'bloco-separado': { marginTop: '26px' },
    'status-linha': { fontSize: '13.5px', marginBottom: '12px' },
    'nota-pe':    { marginTop: '16px', fontSize: '13px' },
    'nota-media': { marginTop: '14px', fontSize: '13.5px' },
    'nota-curta': { marginTop: '12px', fontSize: '13px' },
    'oculto-css': { display: 'none' }
  };
  const conferido = await p.evaluate((esperado) => {
    const saida = [];
    for(const [cls, props] of Object.entries(esperado)){
      /* mede num elemento de teste dentro de um pai de largura conhecida,
         para as porcentagens darem valor comparável */
      const pai = document.createElement('div');
      pai.style.width = '400px';
      pai.style.display = 'block';
      const el = document.createElement('div');
      el.className = cls;
      pai.appendChild(el);
      document.body.appendChild(pai);
      const cs = getComputedStyle(el);
      const errados = [];
      for(const [prop, valor] of Object.entries(props)){
        let real = cs[prop];
        if(valor.endsWith('%')) real = Math.round(parseFloat(real) / 400 * 100) + '%';
        if(real !== valor) errados.push(prop + '=' + real + ' (esperado ' + valor + ')');
      }
      pai.remove();
      if(errados.length) saida.push(cls + ': ' + errados.join(', '));
    }
    return saida;
  }, ESPERADO);
  ok('as 24 classes rendem o que o style= rendia', conferido.length === 0, conferido.join(' | '));
  /* Nem toda classe aparece no DOM inicial: várias só existem dentro de
     templates que o JavaScript monta depois. A conferência de uso é
     feita no código-fonte, e nos dois sentidos — classe definida sem
     uso é lixo, classe usada sem definição é estilo que sumiu. */
  const fonte = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
              + fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');
  const cssTxt = fs.readFileSync(path.join(RAIZ, 'estilo.css'), 'utf8');
  const semUso = Object.keys(ESPERADO).filter(c =>
    !new RegExp('class="[^"]*\\b' + c + '\\b').test(fonte));
  ok('nenhuma classe nova ficou sem uso', semUso.length === 0, semUso.join(', '));
  const semRegra = Object.keys(ESPERADO).filter(c => !cssTxt.includes('.' + c + '.' + c));
  ok('e todas têm regra no CSS', semRegra.length === 0, semRegra.join(', '));

  console.log('\n=== percorrendo o app sob a política ===');
  await p.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
  await p.waitForTimeout(900);
  ok('o capítulo abriu e montou os versículos', await p.evaluate(() =>
    document.querySelectorAll('#area-leitura .v').length === 36),
    await p.evaluate(() => document.querySelectorAll('#area-leitura .v').length));

  await p.evaluate(() => abrirFolhaVerso(43, 3, 16, 'Porque Deus amou o mundo'));
  await p.waitForTimeout(300);
  ok('a folha do versículo abriu', await p.evaluate(() => $('folha-verso').classList.contains('ver')));

  /* o gerador de imagem usa canvas e blob: — se a CSP apertasse demais,
     era aqui que quebraria */
  /* Imagem deixou de ser um botão da grade e virou uma das duas escolhas
     de Compartilhar: o caminho passa pelo painel de envio. */
  await p.evaluate(() => $('fa-enviar').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => $('fa-enviar-imagem').click());
  await p.waitForTimeout(1500);
  const img = await p.evaluate(() => {
    const c = document.querySelector('#modal-img canvas');
    if(!c) return null;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let tinta = 0;
    for(let i = 0; i < d.length; i += 400) if(d[i] !== d[0] || d[i+1] !== d[1]) tinta++;
    return { largura: c.width, pintou: tinta > 0 };
  });
  ok('o gerador de imagem desenhou', img && img.pintou, JSON.stringify(img));
  await p.evaluate(() => fecharModalImg());
  await p.waitForTimeout(300);

  /* a busca e as sugestões, que são DOM criado por JS */
  await p.evaluate(() => { $('busca').value = 'gen'; BuscaMemoria.sugerir(); });
  await p.waitForTimeout(300);
  ok('as sugestões da busca aparecem',
     await p.evaluate(() => document.querySelectorAll('#sugestoes-busca .sugestao').length > 0));

  /* em duas idas: trocar de aba pede o voltar ao navegador, e abrir a
     gaveta na mesma linha seria desfeito pelo popstate */
  await p.evaluate(() => irParaAba('hoje'));
  await p.waitForTimeout(350);
  await p.evaluate(() => abrirMenu(true));
  await p.waitForTimeout(300);
  ok('a gaveta abre', await p.evaluate(() => $('gaveta').classList.contains('aberta')));
  await p.evaluate(() => abrirMenu(false));
  await p.waitForTimeout(300);

  /* estilo escrito por JS continua permitido: a CSP governa o atributo
     no HTML, não o CSSOM */
  ok('o JavaScript ainda consegue mexer no estilo',
     await p.evaluate(() => { const d = document.createElement('div');
       d.style.width = '42px'; document.body.appendChild(d);
       const w = getComputedStyle(d).width; d.remove(); return w === '42px'; }));

  ok('nenhuma recusa da política em todo o percurso', (await csp(p)).length === 0,
     JSON.stringify(await p.evaluate(() => window.__csp)));
  await p.close();

  console.log('\n=== a página de privacidade também ===');
  p = await abrir('privacidade.html');
  const priv = await p.evaluate(() => ({
    css: getComputedStyle(document.querySelector('.barra-int')).maxWidth,
    titulo: (document.querySelector('h1') || {}).textContent || '',
    recusas: window.__csp.length
  }));
  ok('o CSS externo foi aplicado', priv.css === '760px', priv.css);
  ok('e a página tem conteúdo', priv.titulo.length > 0, priv.titulo.slice(0, 40));
  ok('sem recusa da política', priv.recusas === 0);
  await csp(p);
  await p.close();

  console.log('\n=== o service worker leva os arquivos novos ===');
  /* sem eles no precache, o app instalado abriria offline como uma
     página sem estilo e sem nenhuma função */
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  for(const arq of ['/estilo.css', '/app.js', '/privacidade.css']){
    ok('precache tem ' + arq, sw.includes("'" + arq + "'"));
  }
  /* a versão sobe a cada mudança de arquivo servido; o que importa é que
     ela exista e seja um número, não qual número é */
  ok('e a versão do cache é explícita', /lampada-v\d+/.test(sw), (sw.match(/lampada-v\d+/) || [])[0]);

  console.log('\n=== os arquivos novos existem e são servidos ===');
  for(const arq of ['app.js', 'estilo.css', 'supabase-extra.js', 'privacidade.css']){
    ok(arq + ' existe', fs.existsSync(path.join(RAIZ, arq)));
  }
  ok('index.html aponta para o CSS externo',
     /<link rel="stylesheet" href="\/estilo\.css">/.test(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')));
  ok('index.html aponta para o JS externo',
     /<script src="\/app\.js"><\/script>/.test(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')));

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);
  if(violacoes.length) violacoes.forEach(v => console.log('   RECUSA: ' + JSON.stringify(v)));
  ok('nenhuma recusa da CSP em nenhuma página', violacoes.length === 0, violacoes.length);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
