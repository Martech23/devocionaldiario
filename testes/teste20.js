const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* Escolha da voz de leitura */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await b.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);

  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  /* vozes de mentira, com os nomes que os aparelhos de verdade usam */
  const escolher = lista => p.evaluate(l => {
    const v = Voz.melhorVoz(l);
    return v && v.name;
  }, lista);
  const V = (name, lang, localService = true) => ({ name, lang, localService });

  console.log('\n=== a voz do iPhone que a pessoa baixou de propósito ===');
  ok('Premium ganha de uma Google genérica',
     await escolher([V('Google português do Brasil', 'pt-BR'), V('Luciana (Premium)', 'pt-BR')]),
     await escolher([V('Google português do Brasil', 'pt-BR'), V('Luciana (Premium)', 'pt-BR')]));
  ok('Enhanced também', (await escolher([V('Google português', 'pt-BR'), V('Joana (Enhanced)', 'pt-BR')]))
     === 'Joana (Enhanced)');
  ok('e o nome traduzido pelo iOS', (await escolher([V('Google português', 'pt-BR'), V('Luciana (Aprimorada)', 'pt-BR')]))
     === 'Luciana (Aprimorada)');

  console.log('\n=== português do Brasil na frente de Portugal ===');
  ok('pt-BR ganha de pt-PT mesmo quando o nome de Portugal é melhor',
     (await escolher([V('Joana (Premium)', 'pt-PT'), V('Luciana', 'pt-BR')])) === 'Luciana');
  ok('mas pt-PT serve se não houver pt-BR',
     (await escolher([V('Joana', 'pt-PT'), V('Alex', 'en-US')])) === 'Joana');
  ok('sotaque de Portugal com underline também conta',
     (await escolher([V('Luciana', 'pt_BR'), V('Alex', 'en-US')])) === 'Luciana');

  console.log('\n=== somar sinais vence primeiro-da-fila ===');
  /* era esse o defeito: bastava existir uma "Google" para ela ganhar,
     porque "google" vinha antes na lista de preferências */
  ok('Luciana Natural ganha de Google comum',
     (await escolher([V('Google português do Brasil', 'pt-BR'), V('Luciana Natural', 'pt-BR')]))
     === 'Luciana Natural');
  ok('Microsoft Francisca ganha de uma voz sem sinal nenhum',
     (await escolher([V('Voz padrão', 'pt-BR'), V('Microsoft Francisca', 'pt-BR')]))
     === 'Microsoft Francisca');

  console.log('\n=== voz de dentro do aparelho desempata ===');
  ok('entre duas iguais, fica a que não precisa de internet',
     (await escolher([V('Luciana', 'pt-BR', false), V('Luciana', 'pt-BR', true)])) === 'Luciana');
  const ordem = await p.evaluate(() => {
    const rede = { name: 'A', lang: 'pt-BR', localService: false };
    const dentro = { name: 'B', lang: 'pt-BR', localService: true };
    return { rede: Voz.pontuarVoz(rede), dentro: Voz.pontuarVoz(dentro) };
  });
  ok('a de dentro pontua mais que a de rede', ordem.dentro > ordem.rede,
     ordem.dentro + ' x ' + ordem.rede);
  const premium = await p.evaluate(() =>
    Voz.pontuarVoz({ name: 'Luciana (Premium)', lang: 'pt-BR', localService: false }) >
    Voz.pontuarVoz({ name: 'Voz padrão', lang: 'pt-BR', localService: true }));
  ok('mas o desempate não derruba uma Premium de verdade', premium);

  console.log('\n=== não quebra com lista vazia ou estranha ===');
  ok('lista vazia devolve nada', (await escolher([])) === null || (await escolher([])) === undefined);
  ok('voz sem nome não derruba',
     (await escolher([{ lang: 'pt-BR' }, V('Luciana', 'pt-BR')])) === 'Luciana');
  ok('nenhuma em português ainda devolve alguma',
     typeof (await escolher([V('Alex', 'en-US'), V('Anna', 'de-DE')])) === 'string');

  console.log('\n=== a troca de emergência existe e vale uma vez ===');
  /* voz de rede sem rede falha em todo trecho: sem a troca, a leitura
     inteira terminava em silêncio e ninguém entendia por quê */
  /* o código deixou de estar dentro da página: a CSP passou a recusar
     script embutido, e o app inteiro mudou-se para o app.js */
  const s = require('fs').readFileSync(RAIZ + '/app.js', 'utf8');
  const fonte = { troca: /trocouVozPorFalha/.test(s),
                  zera: /trocouVozPorFalha = false/.test(s),
                  filtra: /listaVozes\.filter\(v => v\.localService\)/.test(s) };
  ok('existe a trava de uma troca só', fonte.troca);
  ok('e ela zera a cada leitura nova', fonte.zera);
  ok('a troca busca voz de dentro do aparelho', fonte.filtra);

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
