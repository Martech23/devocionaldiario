const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* Métricas anônimas e horário do lembrete, no navegador */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  /* abre uma página já espionando o que sai para /api/metricas */
  const abrir = async (antes) => {
    const p = await b.newPage({ viewport: { width: 390, height: 900 } });
    p.on('pageerror', e => erros.push(e.message));
    p.__envios = [];
    await p.route('**/api/metricas', r => {
      p.__envios.push(r.request().postData());
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await p.addInitScript(MOCK);
    if (antes) await p.addInitScript(antes);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(1100);
    return p;
  };

  console.log('\n=== o que sai do aparelho ===');
  let p = await abrir();
  await p.evaluate(() => Metricas.despachar());
  await p.waitForTimeout(400);
  const env = JSON.parse(p.__envios[0] || '{}');
  ok('algo foi enviado', !!p.__envios.length);
  ok('só duas chaves: eventos e id', Object.keys(env).sort().join(',') === 'eventos,id',
     Object.keys(env).join(','));
  ok('os eventos são nomes, não conteúdo',
     env.eventos.every(e => /^[a-z_]+$/.test(e)), env.eventos.join(', '));
  ok('"abriu" está entre eles', env.eventos.includes('abriu'));
  ok('o id é aleatório e curto', /^[a-z0-9]{8,32}$/.test(env.id), env.id);

  console.log('\n=== nada do que a pessoa lê ou escreve vai junto ===');
  /* é a promessa da política de privacidade, e é ela que precisa de teste */
  const vazou = await p.evaluate(async () => {
    localStorage.setItem('lampada-oracoes', JSON.stringify([{ texto: 'PEDIDO SECRETO' }]));
    localStorage.setItem('lampada-favoritos', JSON.stringify([{ nr: 1, cap: 1, verso: 1 }]));
    Metricas.anotar('busca_feita');
    Metricas.despachar();
    await new Promise(r => setTimeout(r, 300));
  });
  await p.waitForTimeout(300);
  const tudo = p.__envios.join(' ');
  ok('nenhum pedido de oração', !/PEDIDO SECRETO/.test(tudo));
  ok('nenhum versículo', !/"nr"|"cap"|"verso"/.test(tudo));
  ok('nenhum texto de busca', !/busca":"/.test(tudo));
  ok('nenhum e-mail', !/@/.test(tudo), tudo.slice(0, 60));

  console.log('\n=== o mesmo evento não vai duas vezes na sessão ===');
  const repetido = await p.evaluate(async () => {
    Metricas.anotar('mapa_aberto');
    Metricas.anotar('mapa_aberto');
    Metricas.anotar('mapa_aberto');
    Metricas.despachar();
    await new Promise(r => setTimeout(r, 250));
  });
  await p.waitForTimeout(250);
  const ultimo = JSON.parse(p.__envios[p.__envios.length - 1] || '{"eventos":[]}');
  ok('três anotações viram um evento só',
     ultimo.eventos.filter(e => e === 'mapa_aberto').length === 1, ultimo.eventos.join(', '));
  await p.close();

  console.log('\n=== o id é o mesmo aparelho, não a mesma sessão ===');
  /* sem isso não dá para contar retorno no dia seguinte */
  p = await abrir();
  /* o id nasce no primeiro envio, e não na abertura: quem desligou a
     medição ou usa "não me rastreie" nunca chega a ter um gerado */
  const antesDoEnvio = await p.evaluate(() => localStorage.getItem('lampada-id-anon'));
  ok('não existe antes do primeiro envio', antesDoEnvio === null, String(antesDoEnvio));
  await p.evaluate(() => Metricas.despachar());
  await p.waitForTimeout(300);
  const id1 = await p.evaluate(() => localStorage.getItem('lampada-id-anon'));
  await p.reload();
  await p.waitForTimeout(900);
  await p.evaluate(() => Metricas.despachar());
  await p.waitForTimeout(300);
  const id2 = await p.evaluate(() => localStorage.getItem('lampada-id-anon'));
  ok('nasce no primeiro envio', !!id1, id1);
  ok('e sobrevive ao recarregar', id1 === id2, id2);
  await p.close();

  console.log('\n=== desligar desliga mesmo ===');
  p = await abrir(() => localStorage.setItem('lampada-metricas', '0'));
  await p.evaluate(() => { Metricas.anotar('abriu'); Metricas.despachar(); });
  await p.waitForTimeout(500);
  ok('nada é enviado', p.__envios.length === 0, p.__envios.length + ' envios');
  ok('a caixa aparece desmarcada', (await p.evaluate(() => $('opt-metricas').checked)) === false);
  await p.close();

  console.log('\n=== o "não me rastreie" do navegador é respeitado sozinho ===');
  /* quem já disse ao navegador não deveria ter de repetir aqui */
  p = await abrir(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true }));
  await p.evaluate(() => { Metricas.anotar('abriu'); Metricas.despachar(); });
  await p.waitForTimeout(500);
  const dnt = await p.evaluate(() => ({
    envios: 0,
    marcada: $('opt-metricas').checked,
    travada: $('opt-metricas').disabled,
    nota: $('metricas-nota').textContent
  }));
  ok('nada é enviado', p.__envios.length === 0, p.__envios.length + ' envios');
  ok('a caixa vem desmarcada', !dnt.marcada);
  ok('e travada, porque a escolha já foi feita', dnt.travada);
  ok('com o motivo na tela', /não ser rastreado/.test(dnt.nota), dnt.nota.slice(0, 50));
  await p.close();

  console.log('\n=== a métrica nunca atrapalha quem só quer ler ===');
  /* servidor fora do ar não pode virar erro na tela */
  p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const err2 = [];
  p.on('pageerror', e => err2.push(e.message));
  await p.route('**/api/metricas', r => r.abort('failed'));
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/index.html');
  await p.waitForTimeout(1000);
  await p.evaluate(() => Metricas.despachar());
  await p.waitForTimeout(600);
  ok('endpoint quebrado não gera erro de JS', err2.length === 0, err2.join(' | '));
  ok('e o app continua de pé', await p.locator('#cartao-hoje').count() > 0);
  await p.close();

  console.log('\n=== horário do lembrete ===');
  p = await abrir(() => localStorage.setItem('lampada-lembrete', '1'));
  const h = await p.evaluate(() => ({
    visivel: !$('linha-hora-lembrete').classList.contains('oculto'),
    opcoes: $('hora-lembrete').options.length,
    valor: $('hora-lembrete').value,
    aviso: $('fuso-aviso').textContent,
    fuso: fusoDoAparelho()
  }));
  ok('a linha aparece para quem tem lembrete', h.visivel);
  ok('com as 24 horas', h.opcoes === 24, h.opcoes);
  ok('começando nas 8h, como era antes', h.valor === '8', h.valor);
  ok('e diz o fuso do aparelho', /horário/.test(h.aviso), h.aviso.slice(0, 46));
  ok('o fuso é lido do navegador', h.fuso.length > 0, h.fuso);

  const trocou = await p.evaluate(async () => {
    const sel = $('hora-lembrete');
    sel.value = '6';
    sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    return { guardado: localStorage.getItem('lampada-hora-lembrete'), lido: horaDoLembrete() };
  });
  ok('trocar a hora guarda a escolha', trocou.guardado === '6', trocou.guardado);
  ok('e é ela que vai para o servidor', trocou.lido === 6, trocou.lido);
  await p.close();

  console.log('\n=== a linha some para quem não tem lembrete ===');
  p = await abrir();
  ok('escondida', await p.evaluate(() => $('linha-hora-lembrete').classList.contains('oculto')));
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to load resource|Failed to fetch/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
