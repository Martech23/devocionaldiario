const BASE = require('./base');
const NAVEGADOR = require('./navegador');
/* O gerador de imagem: nada fica fora do alcance, e o fundo se escolhe
   em vez de se sortear. */
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync('teste.js', 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];

/* Pexels não é alcançável do ambiente de teste: servimos fotos locais
   para o modal entrar no mesmo estado de uma sessão de verdade. */
const FOTOS = `
(() => {
  window.__pexels = 0;
  window.__semFoto = false;
  const real = window.fetch;
  window.fetch = (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if(url.startsWith('/api/pexels')){
      window.__pexels++;
      if(window.__semFoto) return Promise.resolve({ ok: false, status: 503,
        json: async () => ({ error: 'sem fotos' }) });
      const n = window.__pexels;
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ photos: [
        { id: n * 10 + 1, url: '/icon-512.png', thumb: '/icon-192.png', photographer: 'Autor ' + n + 'A' },
        { id: n * 10 + 2, url: '/icon-512.png', thumb: '/icon-192.png', photographer: 'Autor ' + n + 'B' },
        { id: n * 10 + 3, url: '/icon-512.png', thumb: '/icon-192.png', photographer: 'Autor ' + n + 'C' }
      ] }) });
    }
    if(url.startsWith('/api/proxy-image')) return real('/icon-512.png');
    return real(u, o);
  };
})();`;

(async () => {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const erros = [];
  let OK = 0, F = 0;
  const ok = (n, v, x) => { v ? OK++ : F++;
    console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

  const abrir = async (vp = [390, 844], antes) => {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(FOTOS);
    await p.addInitScript(MOCK);
    if(antes) await p.addInitScript(antes);
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(900);
    await p.evaluate(() => abrirGeradorImagem(
      'Ele sara aos de coração partido, e os cura de suas dores.',
      'Salmos 147:3', 'Bíblia Livre', 'Cura e consolo', [19, 147, 3]));
    await p.waitForTimeout(1600);
    return p;
  };

  /* visível de verdade: dentro da tela E dentro da janela do miolo que
     rola. Só a viewport não bastava — os chips de formato cabiam nela e
     estavam escondidos atrás da barra de ações. */
  const alcance = (p) => p.evaluate(() => {
    const cx = document.querySelector('#modal-img .modal-caixa');
    const rol = cx.querySelector('.modal-rolagem');
    const jan = rol.getBoundingClientRect();
    const ve = (el) => {
      const q = el.getBoundingClientRect();
      const naTela = q.top >= 0 && q.bottom <= innerHeight + 1;
      const naJanela = !rol.contains(el) || (q.top >= jan.top - 1 && q.bottom <= jan.bottom + 1);
      return naTela && naJanela;
    };
    const um = (sel) => { const e = document.querySelector(sel); return e ? ve(e) : null; };
    return {
      fechar:       um('#btn-fechar-modal'),
      compartilhar: um('#btn-compartilhar-img'),
      baixar:       um('#btn-baixar-img'),
      formato:      um('#img-formatos'),
      fita:         um('#img-fundos'),
      previa:       um('#palco-img'),
      caixaRola:    cx.scrollHeight > cx.clientHeight + 1
    };
  });

  console.log('\n=== nada mais nasce fora do alcance ===');
  /* Era este o defeito medido: num 360×640 a caixa pedia 659px e tinha
     589. "Fechar" e "Baixar" nasciam abaixo da dobra, e nada dizia que
     dava para rolar até eles — o botão que fecha um modal é o último
     que pode sumir. */
  for(const vp of [[360, 640], [390, 844], [414, 896]]){
    const p = await abrir(vp);
    const a = await alcance(p);
    ok(vp.join('×') + ': o fechar está à vista', a.fechar === true);
    ok('  Compartilhar também', a.compartilhar === true);
    ok('  Baixar também', a.baixar === true);
    ok('  os chips de formato também', a.formato === true);
    ok('  e a fita de fundos inteira', a.fita === true);
    ok('  a caixa não precisa rolar por inteiro', a.caixaRola === false);
    await p.close();
  }

  console.log('\n=== o fechar voltou para o alto ===');
  let p = await abrir();
  const cab = await p.evaluate(() => {
    const f = document.getElementById('btn-fechar-modal');
    const h = document.querySelector('#modal-img h3');
    const q = f.getBoundingClientRect(), r = h.getBoundingClientRect();
    return { rotulo: f.getAttribute('aria-label'), texto: f.textContent.trim(),
             mesmaLinha: Math.abs((q.top + q.height / 2) - (r.top + r.height / 2)) < 24,
             alvo: Math.round(q.width) + '×' + Math.round(q.height),
             grande: q.width >= 40 && q.height >= 40 };
  });
  ok('é um ✕ no cabeçalho, ao lado do título', cab.mesmaLinha && cab.texto === '✕', cab.texto);
  ok('  com rótulo para quem não vê o desenho', cab.rotulo === 'Fechar', cab.rotulo);
  ok('  e alvo de toque de 40px', cab.grande, cab.alvo);
  ok('não existe mais um botão "Fechar" no pé',
     await p.evaluate(() => ![...document.querySelectorAll('.modal-acoes button')]
       .some(x => /^fechar$/i.test(x.textContent.trim()))));

  console.log('\n=== o fundo se escolhe, não se sorteia ===');
  /* "Trocar fundo" passava para o próximo às cegas: não dava para ver o
     que existia, escolher, nem voltar ao que se gostou. */
  ok('o botão "Trocar fundo" não existe mais',
     await p.evaluate(() => !document.getElementById('btn-trocar-fundo')));
  const fita = await p.evaluate(() => {
    const f = document.getElementById('img-fundos');
    const ops = [...f.querySelectorAll('.fundo-op[role="radio"]')];
    return {
      papel: f.getAttribute('role'),
      total: ops.length,
      fotos: ops.filter(x => x.dataset.foto !== undefined).length,
      artes: ops.filter(x => x.dataset.arte !== undefined).length,
      comMiniatura: ops.filter(x => x.querySelector('img, canvas')).length,
      comRotulo: ops.filter(x => (x.getAttribute('aria-label') || '').length > 3).length,
      marcados: ops.filter(x => x.getAttribute('aria-checked') === 'true').length,
      alvo: ops[0] ? Math.round(ops[0].getBoundingClientRect().height) : 0,
      temMais: !!f.querySelector('.fundo-op.mais')
    };
  });
  ok('a fita é um radiogroup', fita.papel === 'radiogroup', fita.papel);
  /* Os dez fundos desenhados saíram da fita e ficaram só como socorro
     quando o Pexels não responde — ver teste44.js. */
  ok('mostra só as fotos, sem fundo desenhado nenhum',
     fita.fotos === 3 && fita.artes === 0, fita.fotos + ' fotos, ' + fita.artes + ' desenhos');
  ok('  cada um com a sua miniatura', fita.comMiniatura === fita.total, fita.comMiniatura);
  ok('  e com rótulo próprio para leitor de tela', fita.comRotulo === fita.total);
  ok('exatamente um está marcado', fita.marcados === 1, fita.marcados);
  ok('e há como pedir outras fotos', fita.temMais);

  console.log('\n=== escolher, e voltar ao que se gostou ===');
  /* o que o sorteio não permitia: desfazer */
  const idaEVolta = await p.evaluate(async () => {
    const foto = (i) => document.querySelectorAll('#img-fundos .fundo-op[data-foto]')[i];
    foto(0).click(); await new Promise(r => setTimeout(r, 500));
    const primeiro = imgFotoLista[imgFotoIdx].id;
    foto(2).click(); await new Promise(r => setTimeout(r, 500));
    const outro = imgFotoLista[imgFotoIdx].id;
    foto(0).click(); await new Promise(r => setTimeout(r, 500));
    const devolta = imgFotoLista[imgFotoIdx].id;
    return { primeiro, outro, devolta, marcado: foto(0).getAttribute('aria-checked') };
  });
  ok('escolher outra foto troca a escolha', idaEVolta.primeiro !== idaEVolta.outro,
     idaEVolta.primeiro + ' → ' + idaEVolta.outro);
  ok('e voltar à primeira devolve exatamente ela',
     idaEVolta.devolta === idaEVolta.primeiro, String(idaEVolta.devolta));
  ok('  com a miniatura marcada de novo', idaEVolta.marcado === 'true');

  console.log('\n=== trocar de foto não gasta cota ===');
  /* as fotos já vieram na primeira busca: escolher entre elas é local */
  const rede = await p.evaluate(async () => {
    const antes = window.__pexels;
    document.querySelectorAll('#img-fundos .fundo-op[data-foto]')[1].click();
    await new Promise(r => setTimeout(r, 500));
    return { antes, depois: window.__pexels, modo: imgModo };
  });
  ok('nenhum pedido novo ao Pexels', rede.depois === rede.antes,
     rede.antes + ' → ' + rede.depois);
  ok('e continua no modo foto', rede.modo === 'foto', rede.modo);

  console.log('\n=== "Outras fotos" acrescenta, não troca ===');
  /* Trocar a lista inteira era o defeito: quem tinha achado a sua foto
     a perdia, e o índice voltava para zero. Detalhes em teste43.js. */
  const outras = await p.evaluate(async () => {
    const rotulos = () => [...document.querySelectorAll('#img-fundos .fundo-op[data-foto]')]
      .map(x => x.getAttribute('aria-label'));
    const antes = rotulos();
    const modoAntes = imgModo;
    const fundoAntes = imgFundo;
    document.querySelector('#img-fundos .fundo-op.mais').click();
    await new Promise(r => setTimeout(r, 900));
    return { antes, depois: rotulos(), modoAntes, modo: imgModo,
             fundoAntes, fundo: imgFundo };
  });
  ok('a fita cresce', outras.depois.length > outras.antes.length,
     outras.antes.length + ' → ' + outras.depois.length);
  ok('  guardando as que já estavam lá',
     outras.antes.every(r => outras.depois.includes(r)), outras.depois.join(' | '));
  ok('  e as novas são mesmo novas',
     outras.depois.some(r => !outras.antes.includes(r)));
  /* pedir mais fotos não é escolher uma: quem estava num fundo desenhado
     continua nele até tocar numa miniatura */
  ok('  sem sequestrar a escolha de quem já tinha uma',
     outras.modo === outras.modoAntes && outras.fundo === outras.fundoAntes,
     outras.modoAntes + '/' + outras.fundoAntes + ' → ' + outras.modo + '/' + outras.fundo);

  console.log('\n=== o crédito é legenda da prévia, e uma só ===');
  /* aparecia depois do botão de trocar fundo e lia como rótulo do
     "Formato" logo abaixo */
  const credito = await p.evaluate(() => {
    const c = document.getElementById('img-credito-foto');
    const palco = document.getElementById('palco-img');
    const fita = document.getElementById('img-fundos');
    const q = c.getBoundingClientRect();
    return { texto: c.textContent,
             depoisDaPrevia: q.top >= palco.getBoundingClientRect().bottom - 1,
             antesDaFita: q.bottom <= fita.getBoundingClientRect().top + 1,
             quantos: document.querySelectorAll('#modal-img .credito-foto').length };
  });
  ok('existe uma única linha de crédito', credito.quantos === 1, credito.quantos);
  ok('  logo abaixo da prévia', credito.depoisDaPrevia);
  ok('  e antes da fita, não colada no "Formato"', credito.antesDaFita);
  await p.close();

  console.log('\n=== sem Pexels, sobram os desenhados — e isso se vê ===');
  /* a fita passa a mostrar só os desenhos, o que já explica a ausência
     de foto sem precisar de aviso na tela */
  p = await abrir([390, 844], () => { window.__semFoto = true; });
  const semRede = await p.evaluate(() => {
    const ops = [...document.querySelectorAll('#img-fundos .fundo-op[role="radio"]')];
    return { fotos: ops.filter(x => x.dataset.foto !== undefined).length,
             artes: ops.filter(x => x.dataset.arte !== undefined).length,
             modo: imgModo,
             marcados: ops.filter(x => x.getAttribute('aria-checked') === 'true').length,
             pintou: document.getElementById('canvas-verso')
               .getContext('2d').getImageData(0, 0, 4, 4).data.some(v => v !== 0) };
  });
  ok('a fita fica vazia de fotos, e diz isso',
     semRede.fotos === 0 && semRede.artes === 0, semRede.fotos + '/' + semRede.artes);
  ok('  e a imagem sai assim mesmo', semRede.pintou && semRede.modo === 'arte');
  /* nada marcado é o certo: o socorro não foi escolha de ninguém */
  ok('  sem miniatura marcada, porque ninguém escolheu isso',
     semRede.marcados === 0, semRede.marcados);
  const aindaAlcanca = await alcance(p);
  ok('  e nada saiu do alcance por causa disso',
     aindaAlcanca.fechar && aindaAlcanca.compartilhar && aindaAlcanca.fita);
  await p.close();

  console.log('\n=== o formato continua funcionando, no pé ===');
  p = await abrir();
  const formato = await p.evaluate(async () => {
    const chip = (n) => [...document.querySelectorAll('#img-formatos .chip-img')]
      .find(x => x.textContent.trim() === n);
    const c = document.getElementById('canvas-verso');
    const antes = c.width + 'x' + c.height;
    chip('Story').click();
    await new Promise(r => setTimeout(r, 700));
    const depois = c.width + 'x' + c.height;
    return { antes, depois, marcado: chip('Story').getAttribute('aria-checked'),
             outro: chip('Feed').getAttribute('aria-checked'),
             noPe: !!document.querySelector('.pe-imagem #img-formatos') };
  });
  ok('trocar para Story muda a proporção do canvas',
     formato.antes === '1080x1350' && formato.depois === '1080x1920',
     formato.antes + ' → ' + formato.depois);
  ok('  o chip escolhido fica marcado', formato.marcado === 'true' && formato.outro === 'false');
  ok('  e os chips moram no pé, junto das ações', formato.noPe);

  console.log('\n=== a prévia avisa que está trabalhando ===');
  const girando = await p.evaluate(() => {
    const palco = document.getElementById('palco-img');
    palco.classList.add('carregando');
    const antes = getComputedStyle(palco, '::before').animationName;
    palco.classList.remove('carregando');
    const depois = getComputedStyle(palco, '::before').animationName;
    return { antes, depois };
  });
  ok('há um giro enquanto carrega', girando.antes === 'rodar', girando.antes);
  ok('  e ele some quando termina', girando.depois === 'none', girando.depois);
  await p.close();

  console.log('\n=== erros ===');
  const rel = erros.filter(e => !/favicon|net::ERR|Failed to (load|fetch)|load resource/i.test(e));
  rel.forEach(e => console.log('   ' + e));
  ok('sem erros de JS', rel.length === 0);

  console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
  await b.close();
  process.exit(F ? 1 : 0);
})();
