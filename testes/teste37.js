const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* O devocional do dia deixou de ser sorteio: os três textos agora
   pertencem ao versículo. Este teste prende esse contrato. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);

  /* referência legível, para o relatório dizer qual versículo falhou */
  await p.evaluate(() => {
    window.__ref = d => (LIVROS.find(l => l.nr === d.nr) || {}).nome + ' ' + d.cap + ':' + d.verso;
    window.__todos = () => { const r = []; for(let i = 0; i < TODAS.length; i++) r.push(devocionalDoDia(i)); return r; };
  });

  console.log('\n=== nenhum dia fica sem texto ===');
  const cobertura = await p.evaluate(() => {
    const faltas = [];
    for(let dia = 0; dia < 400; dia++){
      const d = devocionalDoDia(dia);
      if(!d.reflexao || !d.meditacao || !d.oracao) faltas.push(dia + ' ' + __ref(d));
    }
    return { total: TODAS.length, faltas };
  });
  ok('há 180 versículos no ciclo', cobertura.total === 180, cobertura.total);
  ok('os 400 primeiros dias trazem os três textos completos',
     cobertura.faltas.length === 0, cobertura.faltas.slice(0, 3).join(' | '));

  console.log('\n=== o versículo manda, o calendário não ===');
  /* Era este o defeito: os três textos vinham de `giro % 8`, uma rotação
     de calendário independente do versículo. O mesmo versículo, uma volta
     depois, aparecia com outra reflexão — e o par podia não fazer sentido. */
  const estavel = await p.evaluate(() => {
    const fora = [];
    for(let dia = 0; dia < TODAS.length; dia++){
      const a = devocionalDoDia(dia), c = devocionalDoDia(dia + TODAS.length);
      if(a.reflexao !== c.reflexao || a.meditacao !== c.meditacao || a.oracao !== c.oracao)
        fora.push(__ref(a));
    }
    return fora;
  });
  ok('uma volta inteira depois, o mesmo versículo traz o mesmo devocional',
     estavel.length === 0, estavel.slice(0, 3).join(' | '));

  const tema = await p.evaluate(() => {
    const fora = [];
    for(let dia = 0; dia < TODAS.length; dia++){
      const d = devocionalDoDia(dia), t = DEVOCIONAL[d.tema];
      if(!t.reflexoes.includes(d.reflexao) || !t.meditacoes.includes(d.meditacao)
         || !t.oracoes.includes(d.oracao)) fora.push(__ref(d));
    }
    return fora;
  });
  ok('e os três textos continuam saindo do tema do versículo',
     tema.length === 0, tema.slice(0, 3).join(' | '));

  console.log('\n=== as cenas concretas caíram no versículo certo ===');
  /* Oito reflexões contam uma cena — o maná, a viúva, os dez leprosos.
     Nenhuma estava presa ao versículo que conta essa mesma cena. */
  const casos = [
    ['Mateus 5:4',    'reflexao',  'Jesus chorou diante de um túmulo'],
    ['Mateus 5:4',    'oracao',    'Jesus, Tu choraste'],
    ['Lucas 23:34',   'reflexao',  'Jesus perdoou de dentro da cruz'],
    ['Lucas 23:34',   'oracao',    'Jesus, Tu perdoaste de dentro da dor'],
    ['Rute 1:16',     'reflexao',  'Rute escolheu, e virou parte da história de Jesus'],
    ['Lucas 17:15',   'reflexao',  'Dos dez curados, um voltou'],
    ['Êxodo 16:4',    'reflexao',  'O maná caía de manhã'],
    ['Êxodo 16:4',    'oracao',    'dá-me hoje o pão de hoje'],
    ['1 Reis 17:14',  'reflexao',  'A viúva tinha um punhado de farinha'],
    ['Salmos 34:18',  'reflexao',  ''],   /* só confere que existe */
  ];
  const achados = await p.evaluate(() => {
    const m = {};
    for(let dia = 0; dia < TODAS.length; dia++){
      const d = devocionalDoDia(dia);
      m[__ref(d)] = { reflexao: d.reflexao, meditacao: d.meditacao, oracao: d.oracao, tema: d.tema };
    }
    return m;
  });
  for(const [ref, campo, trecho] of casos){
    const d = achados[ref];
    if(!d){ ok(ref + ' está na lista de versículos', false); continue; }
    if(!trecho){ ok(ref + ' tem devocional', !!d.reflexao); continue; }
    ok(ref + ' → ' + campo + ' fala da própria cena',
       d[campo].includes(trecho), d[campo].slice(0, 60) + '…');
  }

  console.log('\n=== reflexão e oração da mesma cena andam juntas ===');
  /* O caso da tela que motivou a mudança: a oração "Jesus, Tu choraste"
     estava no índice 3 e a reflexão do choro no 2 — as listas nunca
     foram paralelas, então a rotação as separava. */
  const juntos = await p.evaluate(() => {
    const pares = [
      ['Jesus chorou diante de um túmulo', 'Jesus, Tu choraste'],
      ['Jesus perdoou de dentro da cruz',  'Jesus, Tu perdoaste de dentro da dor']
    ];
    const r = [];
    for(const [refl, ora] of pares){
      let comAmbos = 0, soReflexao = 0, soOracao = 0;
      for(let dia = 0; dia < TODAS.length; dia++){
        const d = devocionalDoDia(dia);
        const a = d.reflexao.includes(refl), c = d.oracao.includes(ora);
        if(a && c) comAmbos++; else if(a) soReflexao++; else if(c) soOracao++;
      }
      r.push({ refl, comAmbos, soReflexao, soOracao });
    }
    return r;
  });
  for(const j of juntos){
    ok('"' + j.refl.slice(0, 30) + '…" nunca aparece sem a sua oração',
       j.soReflexao === 0, 'sozinha em ' + j.soReflexao + ' dia(s)');
    ok('  e a oração nunca aparece sem ela',
       j.soOracao === 0, 'sozinha em ' + j.soOracao + ' dia(s)');
    ok('  e as duas se encontram em pelo menos um dia', j.comAmbos > 0, j.comAmbos + ' dia(s)');
  }

  console.log('\n=== sem par definido, volta à rotação antiga ===');
  /* Um tema novo, ou um versículo acrescentado depois do fim da lista,
     não pode devolver undefined na tela. */
  const queda = await p.evaluate(() => {
    const guardado = PARES['Perdão'];
    PARES['Perdão'] = [];                       /* nenhum par para o tema */
    let dia = 0;
    while(dia < TODAS.length && devocionalDoDia(dia).tema !== 'Perdão') dia++;
    const semPar = devocionalDoDia(dia);
    const t = DEVOCIONAL['Perdão'];
    const valido = !!semPar.reflexao && !!semPar.meditacao && !!semPar.oracao
      && t.reflexoes.includes(semPar.reflexao)
      && t.meditacoes.includes(semPar.meditacao)
      && t.oracoes.includes(semPar.oracao);
    PARES['Perdão'] = guardado;
    const comPar = devocionalDoDia(dia);
    return { valido, restaurou: comPar.reflexao === t.reflexoes[guardado[0][0]] || true,
             mudou: semPar.reflexao !== comPar.reflexao || semPar.oracao !== comPar.oracao };
  });
  ok('sem par, o texto ainda vem do tema e nunca fica vazio', queda.valido);

  console.log('\n=== o histórico continua reencontrando o que foi mostrado ===');
  /* montarHistorico recalcula pelo número do dia em vez de guardar o
     texto. Se o mesmo dia devolvesse coisas diferentes a cada chamada,
     o histórico mentiria. */
  const repetivel = await p.evaluate(() => {
    const fora = [];
    for(let dia = 0; dia < 60; dia++){
      const a = devocionalDoDia(dia), c = devocionalDoDia(dia);
      if(a.reflexao !== c.reflexao || a.oracao !== c.oracao) fora.push(dia);
    }
    return fora;
  });
  ok('duas leituras do mesmo dia devolvem o mesmo devocional', repetivel.length === 0);

  console.log('\n=== nenhuma palavra foi reescrita ===');
  /* A escolha do usuário foi prender o texto ao versículo, não trocar
     o texto. As três listas têm de continuar com 8 itens por tema. */
  const listas = await p.evaluate(() => Object.entries(DEVOCIONAL).map(([t, d]) =>
    ({ t, r: d.reflexoes.length, m: d.meditacoes.length, o: d.oracoes.length })));
  ok('os dez temas continuam com 8 reflexões, 8 meditações e 8 orações',
     listas.length === 10 && listas.every(x => x.r === 8 && x.m === 8 && x.o === 8),
     listas.map(x => x.r + '/' + x.m + '/' + x.o).join(' '));
  const pares = await p.evaluate(() => Object.entries(PARES).map(([t, v]) =>
    ({ t, n: v.length, mal: v.filter(x => !x || x.length !== 3 || x.some(i => i < 0 || i > 7)).length })));
  ok('cada tema tem 18 pares, um por versículo',
     pares.length === 10 && pares.every(x => x.n === 18), pares.map(x => x.n).join(' '));
  ok('e todo índice cai dentro das listas de 8',
     pares.every(x => x.mal === 0), pares.filter(x => x.mal).map(x => x.t).join(' '));

  console.log('\n=== a tela mostra o que a função escolheu ===');
  /* O texto bíblico vem de fora e aqui não há rede; o que se quer provar
     é o pareamento, então o versículo entra por um substituto. */
  await p.evaluate(() => {
    window.buscarVerso = async () => ({ texto: 'Texto de prova.', versao: 'Bíblia Livre' });
  });

  const deUmaVez = await p.evaluate(async () => {
    localStorage.setItem('lampada-devo-modo', 'tudo');
    await versiculoDoDia();
    const d = devocionalDoDia(diaDoAno(new Date()));
    const t = document.getElementById('cartao-hoje').innerText;
    return { refl: t.includes(d.reflexao.slice(0, 40)),
             medi: t.includes(d.meditacao.slice(0, 30)),
             ora:  t.includes(d.oracao.slice(0, 30)), ref: __ref(d) };
  });
  ok('no modo "tudo de uma vez", a reflexão da tela é a pareada', deUmaVez.refl, deUmaVez.ref);
  ok('  a meditação também', deUmaVez.medi);
  ok('  e a oração também', deUmaVez.ora);

  /* No percurso guiado — o modo de partida — os três textos entram um a
     um, então a página começa só com o versículo. */
  const noPercurso = await p.evaluate(async () => {
    localStorage.setItem('lampada-devo-modo', 'percurso');
    await versiculoDoDia();
    const d = devocionalDoDia(diaDoAno(new Date()));
    const vistos = [];
    for(let passo = 0; passo < 5; passo++){
      vistos.push(document.getElementById('cartao-hoje').innerText);
      const avancar = [...document.querySelectorAll('#cartao-hoje button')]
        .find(b => /continuar|avançar|avancar|próximo|proximo|seguinte/i.test(b.textContent));
      if(!avancar) break;
      avancar.click();
      await new Promise(r => setTimeout(r, 400));
    }
    const tudo = vistos.join('\n');
    return { refl: tudo.includes(d.reflexao.slice(0, 40)),
             medi: tudo.includes(d.meditacao.slice(0, 30)),
             ora:  tudo.includes(d.oracao.slice(0, 30)), ref: __ref(d) };
  });
  ok('e o percurso guiado mostra os mesmos três, passo a passo',
     noPercurso.refl && noPercurso.medi && noPercurso.ora,
     'R ' + noPercurso.refl + ' M ' + noPercurso.medi + ' O ' + noPercurso.ora);

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  await p.close();
  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
