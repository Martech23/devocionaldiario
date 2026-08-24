const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Usabilidade: a nota que sumia ao fechar a folha, e o desfazer */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async () => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(MOCK);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    return p;
  };

  /* abre João 3:16 na leitura e depois a folha do versículo */
  const abrirVerso = async (p) => {
    await p.evaluate(async () => {
      irParaAba('biblia');
      await abrirLeitura(43, 3);
    });
    await p.waitForTimeout(700);
    await p.evaluate(() => abrirFolhaVerso(43, 3, 16, 'Porque Deus amou o mundo de tal maneira'));
    await p.waitForTimeout(300);
  };

  const notaGuardada = (p) => p.evaluate(() =>
    (JSON.parse(localStorage.getItem('lampada-notas') || '{}')['43:3:16'] || {}).texto || '');

  console.log('\n=== 2. a nota não some ao fechar a folha ===');
  /* Era este o buraco: escrever a reflexão, encostar o dedo no fundo
     escuro sem querer, e tudo ia embora sem pergunta. */
  let p = await abrir();
  await abrirVerso(p);
  await p.evaluate(() => { $('fa-nota').click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { $('campo-nota-verso').value = 'Reflexão escrita com o dedo tremendo'; });
  /* toque no fundo escuro — o jeito mais fácil de perder tudo */
  await p.evaluate(() => $('fundo-folha').click());
  await p.waitForTimeout(300);
  ok('o que foi digitado ficou gravado',
     (await notaGuardada(p)) === 'Reflexão escrita com o dedo tremendo', await notaGuardada(p));
  ok('a folha fechou mesmo assim', !(await p.evaluate(() => $('folha-verso').classList.contains('ver'))));
  ok('e sem aviso de "Nota salva" — foi rede de segurança, não ação pedida',
     !(await p.evaluate(() => $('aviso').classList.contains('ver'))));

  /* reabrir traz o texto de volta no campo */
  await abrirVerso(p);
  ok('ao reabrir, o texto está no campo',
     (await p.evaluate(() => $('campo-nota-verso').value)) === 'Reflexão escrita com o dedo tremendo');
  ok('o botão da folha diz "Editar nota"',
     /Editar nota/.test(await p.evaluate(() => $('fa-nota').textContent)));

  /* fechar sem mexer não pode inventar gravação nem aviso */
  await p.evaluate(() => fecharFolha());
  await p.waitForTimeout(200);
  ok('fechar sem mudar nada não dispara aviso',
     !(await p.evaluate(() => $('aviso').classList.contains('ver'))));
  ok('e a nota continua igual',
     (await notaGuardada(p)) === 'Reflexão escrita com o dedo tremendo');

  /* fechar pelo Esc conta igual */
  await abrirVerso(p);
  await p.evaluate(() => { $('fa-nota').click(); $('campo-nota-verso').value = 'Segunda versão'; });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  ok('fechar pelo Esc também grava', (await notaGuardada(p)) === 'Segunda versão', await notaGuardada(p));
  await p.close();

  console.log('\n=== 3. desfazer: favorito ===');
  p = await abrir();
  await abrirVerso(p);
  await p.evaluate(() => $('fa-fav').click());
  await p.waitForTimeout(200);
  const temFav = () => p.evaluate(() => JSON.parse(localStorage.getItem('lampada-favoritos') || '[]').length);
  ok('favoritou', (await temFav()) === 1, await temFav());
  await p.evaluate(() => { irParaAba('favoritos'); });
  await p.waitForTimeout(300);
  await p.evaluate(() => removerFav('43:3:16'));
  await p.waitForTimeout(200);
  ok('removeu', (await temFav()) === 0);
  const botaoDesfazer = await p.evaluate(() => {
    const b = document.querySelector('#aviso .aviso-acao');
    if(!b) return null;
    const r = b.getBoundingClientRect();
    return { texto: b.textContent, altura: Math.round(r.height), largura: Math.round(r.width) };
  });
  ok('apareceu o botão Desfazer', botaoDesfazer && botaoDesfazer.texto === 'Desfazer', JSON.stringify(botaoDesfazer));
  ok('com alvo de toque de 44px', botaoDesfazer && botaoDesfazer.altura >= 44, botaoDesfazer && botaoDesfazer.altura);
  await p.click('#aviso .aviso-acao');
  await p.waitForTimeout(300);
  ok('desfez: o favorito voltou', (await temFav()) === 1, await temFav());
  ok('e voltou igual, não um recorte',
     await p.evaluate(() => { const f = JSON.parse(localStorage.getItem('lampada-favoritos'))[0];
       return f.chave === '43:3:16' && !!f.ref && !!f.texto; }));
  ok('o aviso sumiu ao desfazer', !(await p.evaluate(() => $('aviso').classList.contains('ver'))));

  console.log('\n=== 3. desfazer: pedido de oração ===');
  await p.evaluate(() => {
    localStorage.setItem('lampada-oracoes', JSON.stringify([
      { id: 'a1', texto: 'Pela saúde da minha mãe', data: new Date().toISOString(), respondida: false }
    ]));
    irParaAba('oracoes'); renderOracoes();
  });
  await p.waitForTimeout(300);
  const oracoes = () => p.evaluate(() => JSON.parse(localStorage.getItem('lampada-oracoes') || '[]'));
  await p.evaluate(() => document.querySelector('#lista-oracoes .btn-remover').click());
  await p.waitForTimeout(200);
  ok('o pedido saiu', (await oracoes()).length === 0);
  await p.click('#aviso .aviso-acao');
  await p.waitForTimeout(300);
  const volta = await oracoes();
  ok('desfez: o pedido voltou', volta.length === 1 && volta[0].texto === 'Pela saúde da minha mãe',
     JSON.stringify(volta));
  ok('e apareceu de novo na lista',
     (await p.evaluate(() => document.querySelectorAll('#lista-oracoes .item-oracao').length)) >= 1);

  console.log('\n=== 3. desfazer: nota do versículo (esvaziando o campo) ===');
  await abrirVerso(p);
  await p.evaluate(() => { $('fa-nota').click(); $('campo-nota-verso').value = 'Uma nota que custou a sair'; });
  await p.evaluate(() => salvarNotaDoVerso());
  await p.waitForTimeout(200);
  ok('gravou', (await notaGuardada(p)) === 'Uma nota que custou a sair');
  await p.evaluate(() => { $('fa-nota').click(); $('campo-nota-verso').value = ''; });
  await p.evaluate(() => salvarNotaDoVerso());
  await p.waitForTimeout(200);
  ok('esvaziar o campo apaga a nota', (await notaGuardada(p)) === '');
  ok('e oferece o desfazer', await p.evaluate(() => !!document.querySelector('#aviso .aviso-acao')));
  await p.click('#aviso .aviso-acao');
  await p.waitForTimeout(300);
  ok('desfez: a nota voltou inteira',
     (await notaGuardada(p)) === 'Uma nota que custou a sair', await notaGuardada(p));
  ok('e o campo aberto mostra o texto de novo',
     (await p.evaluate(() => $('campo-nota-verso').value)) === 'Uma nota que custou a sair');
  ok('o botão volta a dizer Editar nota',
     /Editar nota/.test(await p.evaluate(() => $('fa-nota').textContent)));

  console.log('\n=== 3. desfazer: nota na lista de notas ===');
  await p.evaluate(() => { fecharFolha(); irParaAba('favoritos'); });
  await p.waitForTimeout(400);
  const achouRemover = await p.evaluate(() => {
    tabFavAtual = 'notas';
    renderFavoritos();
    const alvo = document.querySelector('#area-favoritos .btn-remover');
    if(alvo){ alvo.click(); return true; }
    return false;
  });
  if(achouRemover){
    await p.waitForTimeout(200);
    ok('a nota saiu da lista', (await notaGuardada(p)) === '');
    ok('com desfazer à mão', await p.evaluate(() => !!document.querySelector('#aviso .aviso-acao')));
    await p.click('#aviso .aviso-acao');
    await p.waitForTimeout(300);
    ok('desfez: a nota voltou', (await notaGuardada(p)) === 'Uma nota que custou a sair', await notaGuardada(p));
  } else {
    console.log('  (aviso) não achei o botão remover da lista de notas — verificar seletor');
    F++;
  }

  console.log('\n=== o aviso comum não bloqueia a tela ===');
  /* pointer-events volta a valer só quando há botão; senão o aviso
     ficaria roubando o toque de quem quisesse tocar por baixo dele */
  await p.evaluate(() => avisar('Só um recado'));
  await p.waitForTimeout(200);
  const comum = await p.evaluate(() => ({
    eventos: getComputedStyle($('aviso')).pointerEvents,
    temBotao: !!document.querySelector('#aviso .aviso-acao'),
    classe: $('aviso').classList.contains('com-acao')
  }));
  ok('sem ação: atravessável', comum.eventos === 'none', comum.eventos);
  ok('sem ação: sem botão', !comum.temBotao);
  ok('sem ação: sem a classe com-acao', !comum.classe);

  await p.evaluate(() => avisar('Com volta', { aoTocar: () => { window.__desfez = 1; } }));
  await p.waitForTimeout(200);
  const comAcao = await p.evaluate(() => ({
    eventos: getComputedStyle($('aviso')).pointerEvents,
    largura: Math.round($('aviso').getBoundingClientRect().width),
    janela: window.innerWidth,
    scroll: document.documentElement.scrollWidth
  }));
  ok('com ação: recebe toque', comAcao.eventos === 'auto', comAcao.eventos);
  ok('com ação: cabe na tela', comAcao.largura <= comAcao.janela, comAcao.largura + ' de ' + comAcao.janela);
  ok('e não cria rolagem lateral', comAcao.scroll <= comAcao.janela, comAcao.scroll);

  console.log('\n=== o desfazer expira, mas dá tempo de ler ===');
  await p.evaluate(() => { window.__desfez = 0; avisar('Some daqui a pouco', { aoTocar: () => { window.__desfez = 1; } }); });
  await p.waitForTimeout(3000);
  ok('aos 3s ainda está lá (o comum já teria sumido)',
     await p.evaluate(() => $('aviso').classList.contains('ver')));
  await p.waitForTimeout(3600);
  ok('aos 6,6s já saiu', !(await p.evaluate(() => $('aviso').classList.contains('ver'))));
  ok('e nada foi desfeito sozinho', (await p.evaluate(() => window.__desfez)) === 0);

  console.log('\n=== um aviso novo apaga o botão do anterior ===');
  /* senão o "Desfazer" do favorito ficaria pendurado num aviso de outra coisa */
  await p.evaluate(() => { avisar('Primeiro', { aoTocar: () => {} }); avisar('Segundo'); });
  await p.waitForTimeout(150);
  ok('sobrou só o texto novo',
     (await p.evaluate(() => $('aviso').textContent)) === 'Segundo',
     await p.evaluate(() => $('aviso').textContent));
  ok('sem botão pendurado', !(await p.evaluate(() => !!document.querySelector('#aviso .aviso-acao'))));

  console.log('\n=== contraste do botão Desfazer ===');
  for(const tema of ['claro', 'escuro']){
    const razao = await p.evaluate((t) => {
      document.documentElement.setAttribute('data-tema', t);
      avisar('x', { aoTocar: () => {} });
      const b = document.querySelector('#aviso .aviso-acao');
      const num = c => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = ([r, g, bl]) => { const f = v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl); };
      const L1 = lum(num(getComputedStyle(b).color));
      const L2 = lum(num(getComputedStyle($('aviso')).backgroundColor));
      return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2);
    }, tema);
    ok('tema ' + tema + ': passa nos 4,5 da AA', razao >= 4.5, razao + ':1');
  }
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
