const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Ensinar o toque no versículo: descrição para o leitor de tela e dica na tela */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

const CAP = () => {
  const v = [];
  for(let i = 1; i <= 20; i++) v.push({ verse: i, text: 'Texto do versículo número ' + i + ' para o teste.' });
  return { verses: v };
};

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (jaViu) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    if(jaViu) await p.addInitScript(() => localStorage.setItem('lampada-dica-verso', '1'));
    await p.addInitScript(c => {
      const real = window.fetch;
      window.fetch = (u, o) => /getbible|helloao/.test(String(u))
        ? Promise.resolve({ ok: true, status: 200, json: async () => c })
        : real(u, o);
    }, CAP());
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    return p;
  };
  const lerCapitulo = async (p, cap = 3) => {
    await p.evaluate(async c => { irParaAba('biblia'); await abrirLeitura(43, c); }, cap);
    await p.waitForTimeout(900);
  };

  console.log('\n=== o leitor de tela passa a saber o que o botão faz ===');
  /* Antes: o versículo era role="button" sem descrição nenhuma. O leitor
     lia o texto inteiro e dizia "botão", sem nunca dizer o que apertar
     faria — e apertar é o que abre cores, nota, favorito e comparar. */
  let p = await abrir();
  await lerCapitulo(p);
  const a11y = await p.evaluate(() => {
    const v = document.querySelector('#area-leitura .v');
    const id = v.getAttribute('aria-describedby');
    const desc = id ? document.getElementById(id) : null;
    return {
      role: v.getAttribute('role'),
      descrito: !!desc,
      descricao: desc ? desc.textContent : null,
      /* aria-label estragaria: substitui o conteúdo e o versículo
         deixaria de ser lido */
      semLabel: !v.getAttribute('aria-label'),
      textoIntacto: /Texto do versículo número 1/.test(v.textContent),
      popup: v.getAttribute('aria-haspopup')
    };
  });
  ok('o versículo continua sendo botão', a11y.role === 'button');
  ok('e agora tem descrição', a11y.descrito);
  ok('que diz o que o toque faz',
     /marcar com cor|favoritar|nota/i.test(a11y.descricao || ''), (a11y.descricao || '').slice(0, 70) + '…');
  ok('sem aria-label, que apagaria o texto do versículo', a11y.semLabel);
  ok('e o versículo continua legível pelo leitor', a11y.textoIntacto);
  ok('anuncia que abre um diálogo', a11y.popup === 'dialog');

  const compartilhada = await p.evaluate(() => {
    const ids = new Set([...document.querySelectorAll('#area-leitura .v')]
      .map(v => v.getAttribute('aria-describedby')));
    return { versos: document.querySelectorAll('#area-leitura .v').length,
             descricoes: document.querySelectorAll('.so-leitor').length,
             idsDistintos: ids.size };
  });
  /* uma descrição só para o capítulo inteiro, não uma por versículo */
  ok('os 20 versículos dividem uma descrição só',
     compartilhada.descricoes === 1 && compartilhada.idsDistintos === 1,
     JSON.stringify(compartilhada));

  const escondida = await p.evaluate(() => {
    const el = document.querySelector('.so-leitor');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { largura: Math.round(r.width), altura: Math.round(r.height),
             display: cs.display, visibility: cs.visibility };
  });
  /* precisa sumir da tela sem sumir do leitor: display:none e
     visibility:hidden tirariam dos dois */
  ok('a descrição não aparece na tela', escondida.largura <= 1 && escondida.altura <= 1,
     JSON.stringify(escondida));
  ok('mas continua no fluxo de acessibilidade',
     escondida.display !== 'none' && escondida.visibility !== 'hidden',
     escondida.display + ' / ' + escondida.visibility);

  console.log('\n=== a dica da primeira vez ===');
  const dica = await p.evaluate(() => {
    const d = document.querySelector('.dica-verso');
    if(!d) return null;
    const x = d.querySelector('button');
    const r = x.getBoundingClientRect();
    const area = document.getElementById('area-leitura').getBoundingClientRect();
    const dr = d.getBoundingClientRect();
    return {
      texto: d.querySelector('span').textContent,
      alvoX: Math.round(r.height),
      rotuloX: x.getAttribute('aria-label'),
      acimaDosVersos: dr.top < document.querySelector('.v').getBoundingClientRect().top,
      cabeNaTela: dr.width <= area.width + 1
    };
  });
  ok('aparece na primeira vez', !!dica);
  ok('e diz o que fazer', /Toque num versículo/.test(dica.texto), dica.texto);
  ok('fica acima dos versículos', dica.acimaDosVersos);
  ok('cabe na largura da leitura', dica.cabeNaTela);
  ok('o X tem alvo de toque de 44px', dica.alvoX >= 44, dica.alvoX + 'px');
  ok('e o X tem rótulo para o leitor de tela', !!dica.rotuloX, dica.rotuloX);

  console.log('\n=== abrir a folha ensina o gesto: a dica sai sozinha ===');
  /* quem já usou não precisa mais ser ensinado, e não deve ter de
     dispensar uma dica sobre algo que acabou de fazer */
  await p.evaluate(() => document.querySelector('#area-leitura .v').click());
  await p.waitForTimeout(400);
  ok('a folha abriu', await p.evaluate(() => $('folha-verso').classList.contains('ver')));
  ok('e a dica sumiu', !(await p.evaluate(() => !!document.querySelector('.dica-verso'))));
  ok('ficou registrado no aparelho',
     (await p.evaluate(() => localStorage.getItem('lampada-dica-verso'))) === '1');
  await p.evaluate(() => fecharFolha());
  await p.waitForTimeout(350);
  await lerCapitulo(p, 4);
  ok('e não volta no capítulo seguinte',
     !(await p.evaluate(() => !!document.querySelector('.dica-verso'))));
  await p.close();

  console.log('\n=== o X também dispensa, para quem não quer tocar ainda ===');
  p = await abrir();
  await lerCapitulo(p);
  ok('a dica está lá', await p.evaluate(() => !!document.querySelector('.dica-verso')));
  await p.evaluate(() => document.querySelector('.dica-verso button').click());
  await p.waitForTimeout(250);
  ok('o X remove', !(await p.evaluate(() => !!document.querySelector('.dica-verso'))));
  await lerCapitulo(p, 5);
  ok('e não volta', !(await p.evaluate(() => !!document.querySelector('.dica-verso'))));
  await p.close();

  console.log('\n=== quem já sabe nunca vê a dica ===');
  p = await abrir(true);
  await lerCapitulo(p);
  ok('não aparece para quem já dispensou',
     !(await p.evaluate(() => !!document.querySelector('.dica-verso'))));
  ok('mas a descrição do leitor de tela continua lá',
     await p.evaluate(() => !!document.querySelector('#area-leitura .v[aria-describedby]')));

  console.log('\n=== resposta ao toque e ao teclado ===');
  const estados = await p.evaluate(() => {
    const regras = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch(_){ return []; } })
      .map(r => r.selectorText || '').filter(Boolean);
    return {
      temActive: regras.some(s => s.includes('.v:active')),
      temFoco: regras.some(s => s.includes('.v:focus-visible')),
      temHover: regras.some(s => s.includes('.v:hover'))
    };
  });
  /* :hover já existia e só vale no computador; no celular, que é onde o
     app é usado, encostar o dedo não dava resposta nenhuma */
  ok('o toque tem resposta (:active)', estados.temActive);
  ok('e o teclado tem foco visível (:focus-visible)', estados.temFoco);
  ok('o :hover do computador continua', estados.temHover);

  const foco = await p.evaluate(() => {
    const v = document.querySelector('#area-leitura .v');
    v.focus();
    return { focado: document.activeElement === v, tabindex: v.getAttribute('tabindex') };
  });
  ok('o versículo recebe foco pelo teclado', foco.focado && foco.tabindex === '0');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  ok('e Enter abre a folha', await p.evaluate(() => $('folha-verso').classList.contains('ver')));
  await p.close();

  console.log('\n=== contraste da dica nos dois temas ===');
  for(const tema of ['claro', 'escuro']){
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', e => erros.push(e.message));
    await pg.addInitScript(MOCK);
    await pg.addInitScript(t => localStorage.setItem('lampada-tema', t), tema);
    await pg.addInitScript(c => {
      const real = window.fetch;
      window.fetch = (u, o) => /getbible|helloao/.test(String(u))
        ? Promise.resolve({ ok: true, status: 200, json: async () => c }) : real(u, o);
    }, CAP());
    await pg.goto(BASE + '/index.html');
    await pg.waitForTimeout(900);
    await pg.evaluate(async () => { irParaAba('biblia'); await abrirLeitura(43, 3); });
    await pg.waitForTimeout(900);
    const razao = await pg.evaluate(() => {
      const d = document.querySelector('.dica-verso');
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const L1 = lum(num(getComputedStyle(d.querySelector('span')).color));
      const L2 = lum(num(getComputedStyle(d).backgroundColor));
      return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2);
    });
    ok('tema ' + tema + ': a dica passa nos 4,5 da AA', razao >= 4.5, razao + ':1');
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
