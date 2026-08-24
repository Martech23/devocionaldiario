/**
 * RODA A SUÍTE INTEIRA
 *
 *   npm test                 tudo
 *   npm test -- 38 46        só as suítes 38 e 46
 *   npm test -- --lista      só mostra o que existe
 *
 * As suítes abrem o app num servidor estático local. Ele é levantado
 * aqui e derrubado no fim — nenhuma delas precisa saber disso.
 *
 * Cada suíte roda em processo próprio, de propósito: uma que trave ou
 * vaze memória não leva as outras junto, e a saída de cada uma fica
 * separada. São ~47 processos e leva alguns minutos.
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const RAIZ = path.resolve(AQUI, '..');
const PORTA = Number(process.env.PORTA_TESTE || 8099);

/* ---------- servidor estático mínimo ---------- */
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',   '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};

function servir() {
  return new Promise((ok, falha) => {
    const s = http.createServer((req, res) => {
      let alvo = decodeURIComponent(req.url.split('?')[0]);
      if (alvo === '/') alvo = '/index.html';
      /* nada de subir na árvore: o servidor só enxerga o repositório */
      const arquivo = path.join(RAIZ, path.normalize(alvo).replace(/^(\.\.[/\\])+/, ''));
      if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
      fs.readFile(arquivo, (e, dados) => {
        if (e) { res.writeHead(404).end('não achei'); return; }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
        res.end(dados);
      });
    });
    s.on('error', falha);
    s.listen(PORTA, () => ok(s));
  });
}

/* ---------- descoberta das suítes ---------- */
function suites(filtro) {
  const todas = fs.readdirSync(AQUI)
    .filter(f => /^teste\d*\.js$/.test(f) || f === 'teste.js')
    .sort((a, b) => {
      const n = x => Number((x.match(/\d+/) || [0])[0]);
      return n(a) - n(b);
    });
  if (!filtro.length) return todas;
  return todas.filter(f => filtro.some(x => f === x || f === 'teste' + x + '.js'));
}

function rodarUma(arquivo) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(AQUI, arquivo)], { cwd: AQUI });
    let saida = '';
    p.stdout.on('data', d => saida += d);
    p.stderr.on('data', d => saida += d);
    p.on('close', (codigo) => {
      /* As suítes imprimem '  OK  ' + ' | ' e ' FALHA' + ' | ' — ou seja,
         três espaços antes da barra no caso do OK. Contar dois dava zero
         em tudo, e a suíte inteira aparecia como se não tivesse rodado. */
      const passou = (saida.match(/^\s*OK\s+\|/gm) || []).length;
      const falhou = (saida.match(/^\s*FALHA\s+\|/gm) || []).length;
      ok({ arquivo, passou, falhou, codigo, saida });
    });
  });
}

(async () => {
  const args = process.argv.slice(2);
  const lista = suites(args.filter(a => !a.startsWith('--')));

  if (args.includes('--lista')) {
    lista.forEach(f => console.log('  ' + f));
    console.log('\n' + lista.length + ' suítes');
    return;
  }

  const nav = require('./navegador');
  console.log('navegador:', nav || '(o que o Playwright baixou)');
  console.log('servidor : http://localhost:' + PORTA + ' servindo ' + RAIZ);

  let servidor;
  try { servidor = await servir(); }
  catch (e) {
    console.error('\nNão consegui abrir a porta ' + PORTA + ': ' + e.message);
    console.error('Se já houver algo ali, use PORTA_TESTE=8100 npm test');
    process.exit(1);
  }

  console.log('rodando ' + lista.length + ' suítes\n');
  const inicio = Date.now();
  let passou = 0, falhou = 0;
  const quebradas = [];

  for (const arquivo of lista) {
    const r = await rodarUma(arquivo);
    passou += r.passou;
    falhou += r.falhou;
    const ruim = r.falhou > 0 || r.codigo !== 0;
    if (ruim) quebradas.push(r);
    const marca = ruim ? 'FALHA' : ' ok  ';
    console.log(`  ${marca} ${arquivo.padEnd(13)} ${String(r.passou).padStart(4)} ok` +
                (r.falhou ? `  ${r.falhou} falhas` : ''));
    if (ruim) {
      /* só as linhas de falha: a saída inteira de 47 suítes é ilegível */
      const linhas = r.saida.split('\n').filter(l => /^\s*FALHA\s+\|/.test(l));
      linhas.forEach(l => console.log('         ' + l.trim()));
      if (!linhas.length) console.log('         (saiu com código ' + r.codigo + ' — travou antes de reportar)');
    }
  }

  servidor.close();
  const seg = ((Date.now() - inicio) / 1000).toFixed(0);
  console.log(`\n${passou} asserções · ${falhou} falhas · ${lista.length} suítes · ${seg}s`);

  if (quebradas.length) {
    console.log('\nPara ver a saída inteira de uma delas:');
    console.log('  node testes/' + quebradas[0].arquivo);
  }
  process.exit(falhou || quebradas.length ? 1 : 0);
})();
