const BASE = require('./base');
const RAIZ = require('path').resolve(__dirname, '..');
const NAVEGADOR = require('./navegador');
/* O ditado por voz: o aviso, os erros e o cabeçalho do servidor */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* SpeechRecognition de mentira, com o tempo na nossa mão.
   O de verdade não abre o microfone quando start() volta — ele ainda
   vai pedir permissão e ligar o áudio. É essa demora que o teste
   precisa reproduzir, porque é nela que a fala se perdia. */
const FALSO = `
  window.__fala = { criadas: [] };
  class RecFalso {
    constructor(){ window.__fala.criadas.push(this); window.__fala.ultima = this; this.iniciou = false; }
    start(){ this.iniciou = true; window.__fala.abriu = false; }
    stop(){ if(this.onerror) this.onerror({ error: 'aborted' }); if(this.onend) this.onend(); }
    abort(){ this.stop(); }
    /* o navegador confirmando que a captação começou */
    _audiostart(){ window.__fala.abriu = true; if(this.onaudiostart) this.onaudiostart(); }
    _start(){ if(this.onstart) this.onstart(); }
    _resultado(txt){ if(this.onresult) this.onresult({ results: [[{ transcript: txt }]] }); }
    _erro(e){ if(this.onerror) this.onerror({ error: e }); if(this.onend) this.onend(); }
  }
  window.SpeechRecognition = RecFalso;
  window.webkitSpeechRecognition = RecFalso;
`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (extra) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.addInitScript(FALSO);
    if(extra) await p.addInitScript(extra);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    return p;
  };

  const aviso = (p) => p.evaluate(() => $('aviso').textContent);

  console.log('\n=== o aviso espera o microfone abrir ===');
  /* Era este o defeito relatado: "aperto para falar e ele não ouve".
     "Pode falar…" aparecia junto com o toque, mas o microfone só abre
     depois — então quem obedecia ao aviso falava no vazio. */
  let p = await abrir();
  await p.evaluate(() => { irParaAba('oracoes'); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.form-oracao .btn-mic').click());
  await p.waitForTimeout(100);
  ok('logo após o toque, NÃO diz "Pode falar"', !/Pode falar/.test(await aviso(p)), await aviso(p));
  ok('diz que está abrindo', /Abrindo o microfone/.test(await aviso(p)), await aviso(p));
  ok('e o microfone de fato ainda não abriu',
     (await p.evaluate(() => window.__fala.abriu)) === false);
  ok('mas o botão já mostra que está ativo',
     await p.evaluate(() => document.querySelector('.form-oracao .btn-mic').classList.contains('ouvindo')));

  await p.evaluate(() => window.__fala.ultima._audiostart());
  await p.waitForTimeout(100);
  ok('só quando o áudio começa é que manda falar', /Pode falar/.test(await aviso(p)), await aviso(p));

  console.log('\n=== e o aviso não sai duas vezes ===');
  /* alguns navegadores disparam start e audiostart, outros só um */
  await p.evaluate(() => { window.__avisos = 0;
    const orig = window.avisar; window.avisar = (...a) => { window.__avisos++; return orig(...a); }; });
  await p.evaluate(() => { window.__fala.ultima._start(); window.__fala.ultima._audiostart(); });
  await p.waitForTimeout(100);
  ok('start depois de audiostart não repete o aviso',
     (await p.evaluate(() => window.__avisos)) === 0, await p.evaluate(() => window.__avisos));

  console.log('\n=== o que foi falado chega a quem pediu ===');
  await p.evaluate(() => window.__fala.ultima._resultado('pela saúde da minha mãe'));
  await p.waitForTimeout(200);
  ok('o texto entra no campo',
     /pela saúde da minha mãe/.test(await p.evaluate(() => $('campo-oracao').value)),
     await p.evaluate(() => $('campo-oracao').value));
  await p.close();

  console.log('\n=== parar não é falhar ===');
  /* tocar no botão de novo dispara 'aborted', que caía no genérico
     "Não deu para ouvir agora" — cancelar não é erro */
  p = await abrir();
  await p.evaluate(() => { irParaAba('oracoes'); });
  await p.waitForTimeout(200);
  const btn = '.form-oracao .btn-mic';
  await p.evaluate(s => document.querySelector(s).click(), btn);
  await p.evaluate(() => window.__fala.ultima._audiostart());
  await p.waitForTimeout(100);
  await p.evaluate(() => { $('aviso').textContent = ''; });
  await p.evaluate(s => document.querySelector(s).click(), btn);   /* segundo toque: parar */
  await p.waitForTimeout(200);
  ok('não aparece mensagem de erro ao parar', !/Não deu para ouvir/.test(await aviso(p)), await aviso(p) || '(vazio)');
  ok('e o botão volta ao normal',
     !(await p.evaluate(s => document.querySelector(s).classList.contains('ouvindo'), btn)));

  console.log('\n=== cada erro diz o que fazer ===');
  const cenario = async (erro, permissao) => {
    const pg = await abrir(permissao === undefined ? null : `
      /* navigator.permissions é um getter só de leitura: atribuir não
         faz nada e o teste passaria pelo caminho errado sem avisar */
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: { query: async () => ({ state: ${JSON.stringify(permissao)} }) }
      });
    `);
    await pg.evaluate(() => { irParaAba('oracoes'); });
    await pg.waitForTimeout(200);
    await pg.evaluate(s => document.querySelector(s).click(), '.form-oracao .btn-mic');
    await pg.waitForTimeout(80);
    await pg.evaluate(e => window.__fala.ultima._erro(e), erro);
    await pg.waitForTimeout(250);
    const t = await pg.evaluate(() => $('aviso').textContent);
    const preso = await pg.evaluate(s => document.querySelector(s).classList.contains('ouvindo'), '.form-oracao .btn-mic');
    await pg.close();
    return { t, preso };
  };

  let c = await cenario('no-speech');
  ok('sem fala: convida a tentar de novo', /Não ouvi nada/.test(c.t), c.t);
  ok('e o botão não fica preso em "ouvindo"', !c.preso);

  /* o ditado do Chrome manda o áudio para o servidor de fala: offline
     ele não funciona, mesmo com o resto do app funcionando */
  c = await cenario('network');
  ok('sem internet: diz que o ditado precisa de rede', /precisa de internet/.test(c.t), c.t);

  c = await cenario('audio-capture');
  ok('sem microfone no aparelho: diz isso', /Não achei um microfone/.test(c.t), c.t);

  /* Duas causas, mesmo erro do navegador, remédios diferentes. */
  c = await cenario('not-allowed', 'denied');
  ok('permissão negada pela pessoa: manda liberar no navegador',
     /Libere nas permissões/.test(c.t), c.t);

  c = await cenario('not-allowed', 'granted');
  ok('permissão concedida e ainda assim recusado: não manda liberar de novo',
     !/Libere nas permissões/.test(c.t) && /bloqueado/.test(c.t), c.t);

  c = await cenario('not-allowed', 'prompt');
  ok('permissão ainda por decidir: também não manda liberar',
     !/Libere nas permissões/.test(c.t), c.t);

  /* Firefox e Safari não sabem consultar 'microphone' */
  c = await cenario('not-allowed');
  ok('navegador que não sabe consultar a permissão ainda recebe uma mensagem',
     /bloqueado/.test(c.t), c.t);

  console.log('\n=== o botão aparece quando o navegador entende ditado ===');
  p = await abrir();
  ok('com a API, o botão está visível',
     await p.evaluate(() => document.documentElement.getAttribute('data-ditado') === '1'));
  ok('e o botão do campo de oração é clicável',
     await p.evaluate(() => {
       irParaAba('oracoes');
       const b = document.querySelector('.form-oracao .btn-mic');
       return !!b && getComputedStyle(b).display !== 'none';
     }));
  await p.close();

  /* sem a API, o botão some em vez de mentir */
  p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(MOCK);
  await p.addInitScript(`
    delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined });
  `);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(900);
  ok('sem a API, o app marca data-ditado=0',
     await p.evaluate(() => document.documentElement.getAttribute('data-ditado') === '0'),
     await p.evaluate(() => document.documentElement.getAttribute('data-ditado')));
  ok('e os botões de microfone somem',
     await p.evaluate(() => {
       irParaAba('oracoes');
       const b = document.querySelector('.form-oracao .btn-mic');
       return !b || getComputedStyle(b).display === 'none';
     }));
  await p.close();

  console.log('\n=== o servidor não pode barrar o próprio microfone ===');
  /* Era esta a causa em produção: microphone=() barra a própria origem.
     O botão aparecia, a pessoa tocava e o navegador recusava calado. */
  const vercel = JSON.parse(fs.readFileSync(RAIZ + '/vercel.json', 'utf8'));
  const cabecalhos = vercel.headers[0].headers;
  const pp = cabecalhos.find(h => h.key === 'Permissions-Policy').value;
  ok('a Permissions-Policy libera o microfone para a própria origem',
     /microphone=\(self\)/.test(pp), pp);
  ok('e não com a lista vazia, que barra todo mundo', !/microphone=\(\)/.test(pp));
  ok('câmera e pagamento seguem fechados',
     /camera=\(\)/.test(pp) && /payment=\(\)/.test(pp), pp);

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
