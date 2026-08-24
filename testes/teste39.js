const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Comparar versões: metade do catálogo em português é só Novo
   Testamento, e pedir Gênesis a essas devolve 404. O app dizia
   "não respondeu agora" — falso, e sem conserto por tentar de novo. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* Um catálogo de mentira com os quatro casos que interessam:
   completa, só Novo Testamento, capítulo sem o versículo, e rede caída. */
const FONTES = `
(() => {
  const capitulo = (versos) => ({ chapter: { content: versos.map(v =>
    ({ type: 'verse', number: v[0], content: [v[1]] })) } });
  window.__pedidos = [];
  const real = window.fetch;
  window.fetch = (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if(!/helloao|getbible/.test(url)) return real(u, o);
    window.__pedidos.push(url);
    const ok = (d) => Promise.resolve({ ok: true, status: 200, json: async () => d });
    const erro = (s) => Promise.resolve({ ok: false, status: s, json: async () => ({}) });

    /* catálogos: o app descobre versões em tempo de execução */
    if(/available_translations/.test(url)) return ok({ translations: [] });
    if(/translations\\.json/.test(url))     return ok({});

    /* NT-only: 404 em qualquer livro do Antigo Testamento */
    const antigo = /\\/(GEN|EXO|PSA|ISA)\\//.test(url) || /getbible\\.net\\/v2\\/[^/]+\\/([1-9]|1[0-9]|2[0-9]|3[0-9])\\//.test(url);
    if(/só-nt-a|so-nt-b/.test(url) && antigo) return erro(404);

    /* rede caída de verdade */
    if(/caiu/.test(url)) return Promise.reject(new TypeError('Failed to fetch'));

    /* junta dois versículos num só: o capítulo vem, o 2 não existe */
    if(/junta/.test(url))
      return ok(capitulo([[1, 'No princípio criou Deus os céus e a terra, e a terra era sem forma.'],
                          [3, 'E disse Deus: haja luz.']]));

    return ok(capitulo([[1, 'No princípio criou Deus os céus e a terra.'],
                        [2, 'E a terra era sem forma e vazia.'],
                        [16, 'Porque Deus amou o mundo de tal maneira.']]));
  };
})();
`;

/* Cinco versões de teste no lugar do catálogo real, para o resultado não
   depender de quem está no ar hoje. */
const ELENCO = `
(() => {
  window.__montarElenco = () => {
    VERSOES.length = 0;
    VERSOES.push(
      { fonte: 'helloao', id: 'livre',   nome: 'Bíblia Livre' },
      { fonte: 'helloao', id: 'junta',   nome: 'Versão que junta versículos' },
      { fonte: 'helloao', id: 'só-nt-a', nome: 'Biblia Livre para Todos' },
      { fonte: 'helloao', id: 'so-nt-b', nome: 'A Bíblia Sagrada, Tradução para Tradutores' },
      { fonte: 'helloao', id: 'caiu',    nome: 'Versão fora do ar' }
    );
    versaoAtual = VERSOES[0];
    cache.clear();
  };
})();
`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async () => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(FONTES);
    await p.addInitScript(MOCK);
    await p.addInitScript(ELENCO);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(() => __montarElenco());
    return p;
  };

  const comparar = (p, nr, cap, verso, texto) => p.evaluate(async a => {
    __montarElenco();
    abrirFolhaVerso(a[0], a[1], a[2], a[3]);
    await new Promise(r => setTimeout(r, 200));
    await compararVersoes();
    await new Promise(r => setTimeout(r, 400));
    const lista = document.getElementById('lista-comparacao');
    return {
      linhas: [...lista.querySelectorAll('.comp-item')].map(x => ({
        nome: x.querySelector('.comp-nome').textContent,
        texto: (x.querySelector('.comp-txt') || {}).textContent || null,
        falhou: (x.querySelector('.comp-falhou') || {}).textContent || null
      })),
      nota: (lista.querySelector('.comp-fora') || {}).textContent || null,
      tentarDeNovo: [...lista.querySelectorAll('button')]
        .some(x => /tentar de novo/i.test(x.textContent))
    };
  }, [nr, cap, verso, texto]);

  console.log('\n=== Gênesis 1:1 — o defeito que se viu na tela ===');
  /* Duas versões do catálogo em português só têm o Novo Testamento.
     Pedir Gênesis devolve 404, e o app respondia "Esta versão não
     respondeu agora" — que convida a tentar de novo o que nunca vai
     dar certo. */
  let p = await abrir();
  const gen = await comparar(p, 1, 1, 1, 'No princípio criou Deus os céus e a terra.');
  const nomes = gen.linhas.map(l => l.nome);
  ok('as versões sem o Antigo Testamento saem da lista',
     !nomes.includes('Biblia Livre para Todos') &&
     !nomes.includes('A Bíblia Sagrada, Tradução para Tradutores'), nomes.join(' | '));
  ok('nenhuma linha diz mais "não respondeu" por causa delas',
     gen.linhas.filter(l => /não respondeu/.test(l.falhou || '')).length === 1,
     gen.linhas.filter(l => l.falhou).map(l => l.nome + ': ' + l.falhou).join(' | '));

  console.log('\n=== mas some da lista, não da verdade ===');
  ok('há uma nota no pé', !!gen.nota, gen.nota);
  ok('  que nomeia as duas', /Biblia Livre para Todos/.test(gen.nota || '')
     && /Tradução para Tradutores/.test(gen.nota || ''));
  ok('  e diz o livro que falta', /Gênesis/.test(gen.nota || ''));
  ok('  com "e" antes da última, não vírgula solta',
     / e A Bíblia Sagrada/.test(gen.nota || ''), gen.nota);
  ok('  e concorda no plural', /^2 versões não entram/.test(gen.nota || ''), gen.nota);

  console.log('\n=== cada motivo diz o que é ===');
  const junta = gen.linhas.find(l => l.nome === 'Versão que junta versículos');
  const caiu  = gen.linhas.find(l => l.nome === 'Versão fora do ar');
  const boa   = gen.linhas.find(l => l.nome === 'Bíblia Livre');
  ok('a que traz o texto traz o texto', boa && /No princípio criou Deus/.test(boa.texto || ''));
  /* o capítulo chegou e o versículo 1 existe nesta: aqui ela mostra texto */
  ok('a que junta versículos mostra o versículo 1 normalmente',
     junta && !!junta.texto, junta && (junta.texto || junta.falhou));
  ok('a que está fora do ar diz "não respondeu agora"',
     caiu && /não respondeu agora/.test(caiu.falhou || ''), caiu && caiu.falhou);

  console.log('\n=== o versículo que a versão não numera ===');
  const v2 = await comparar(p, 1, 1, 2, 'E a terra era sem forma e vazia.');
  const j2 = v2.linhas.find(l => l.nome === 'Versão que junta versículos');
  ok('o capítulo veio, o versículo não: não é falha de rede',
     j2 && /junta este versículo a outro/.test(j2.falhou || ''), j2 && j2.falhou);
  ok('e continua sem dizer "não respondeu"',
     j2 && !/não respondeu/.test(j2.falhou || ''));

  console.log('\n=== "Tentar de novo" só quando repetir adianta ===');
  ok('com uma versão fora do ar, o botão aparece', gen.tentarDeNovo);
  const semQueda = await p.evaluate(async () => {
    __montarElenco();
    VERSOES.splice(VERSOES.findIndex(v => v.id === 'caiu'), 1);
    abrirFolhaVerso(1, 1, 1, 'No princípio criou Deus os céus e a terra.');
    await new Promise(r => setTimeout(r, 200));
    await compararVersoes();
    await new Promise(r => setTimeout(r, 400));
    const lista = document.getElementById('lista-comparacao');
    return { botao: [...lista.querySelectorAll('button')].some(x => /tentar de novo/i.test(x.textContent)),
             nota: (lista.querySelector('.comp-fora') || {}).textContent || null };
  });
  ok('sem falha de rede, o botão não aparece — nada mudaria', !semQueda.botao);
  ok('mas a nota das que não trazem o livro continua', !!semQueda.nota, semQueda.nota);

  console.log('\n=== a exclusão é por livro, não para sempre ===');
  /* As duas têm o Novo Testamento: em João elas voltam à lista. */
  const jo = await comparar(p, 43, 3, 16, 'Porque Deus amou o mundo de tal maneira.');
  const nomesJo = jo.linhas.map(l => l.nome);
  ok('em João 3:16 as duas voltam a aparecer',
     nomesJo.includes('Biblia Livre para Todos') &&
     nomesJo.includes('A Bíblia Sagrada, Tradução para Tradutores'), nomesJo.join(' | '));
  ok('e trazem texto', jo.linhas.filter(l => l.nome === 'Biblia Livre para Todos')
     .every(l => !!l.texto));
  ok('sem nota de livro faltando', !jo.nota, jo.nota);

  console.log('\n=== uma só no singular ===');
  const uma = await p.evaluate(async () => {
    __montarElenco();
    VERSOES.splice(VERSOES.findIndex(v => v.id === 'so-nt-b'), 1);
    abrirFolhaVerso(1, 1, 1, 'No princípio criou Deus os céus e a terra.');
    await new Promise(r => setTimeout(r, 200));
    await compararVersoes();
    await new Promise(r => setTimeout(r, 400));
    return (document.querySelector('#lista-comparacao .comp-fora') || {}).textContent || null;
  });
  ok('com uma só, a frase vai para o singular',
     /^Uma versão não entra/.test(uma || ''), uma);

  console.log('\n=== o erro de 404 nomeia o livro ===');
  const msg = await p.evaluate(async () => {
    __montarElenco();
    try { await buscarVersoEm(VERSOES.find(v => v.id === 'só-nt-a'), 1, 1, 1); return null; }
    catch(e){ return { msg: e.message, semLivro: !!e.semLivro, status: e.status }; }
  });
  ok('a mensagem diz qual livro falta', /não traz Gênesis/.test((msg || {}).msg || ''),
     (msg || {}).msg);
  ok('e o erro vem marcado como permanente', (msg || {}).semLivro === true);
  ok('  com o status que a fonte devolveu', (msg || {}).status === 404, (msg || {}).status);

  console.log('\n=== o texto assina quem serviu, não quem foi escolhido ===');
  /* A leitura já caía para a Bíblia Livre quando a versão do momento
     falhava, mas o cartão continuava assinando com o nome da escolhida:
     atribuía a uma tradução um texto que não era dela. */
  const assinatura = await p.evaluate(async () => {
    __montarElenco();
    versaoAtual = VERSOES.find(v => v.id === 'só-nt-a');
    const r = await buscarVerso(1, 1, 1);
    const noNT = (versaoAtual = VERSOES.find(v => v.id === 'só-nt-a'),
                  await buscarVerso(43, 3, 16));
    return { escolhida: 'Biblia Livre para Todos', emGenesis: r.versao, emJoao: noNT.versao,
             texto: r.texto };
  });
  ok('em Gênesis, quem responde é a reserva — e é ela que assina',
     assinatura.emGenesis === 'Bíblia Livre', assinatura.emGenesis);
  ok('e o texto veio mesmo', /No princípio criou Deus/.test(assinatura.texto || ''));
  ok('em João, quem responde é a escolhida, e assina ela',
     assinatura.emJoao === 'Biblia Livre para Todos', assinatura.emJoao);

  console.log('\n=== ouvir só o que tem texto ===');
  const falado = await p.evaluate(async () => {
    __montarElenco();
    abrirFolhaVerso(1, 1, 1, 'No princípio criou Deus os céus e a terra.');
    await new Promise(r => setTimeout(r, 200));
    await compararVersoes();
    await new Promise(r => setTimeout(r, 400));
    window.__falas = [];
    const b2 = [...document.querySelectorAll('#lista-comparacao button')]
      .find(x => /ouvir todas/i.test(x.textContent));
    b2.click();
    await new Promise(r => setTimeout(r, 600));
    return window.__falas.map(f => f.text).join(' ~ ');
  });
  ok('nenhuma versão sem texto entra na fala',
     !/não respondeu|não traz|junta este/i.test(falado), falado.slice(0, 120));
  ok('e as que têm texto entram', /Bíblia Livre/.test(falado));
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
