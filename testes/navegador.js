/**
 * ONDE ESTÁ O CHROMIUM
 *
 * As suítes nasceram com o caminho cravado no código
 * (`/opt/pw-browsers/chromium-1194/…`), que é onde ele fica na máquina
 * onde foram escritas — e em nenhuma outra. Assim elas rodavam num
 * lugar só, o que é o mesmo que não rodar.
 *
 * Aqui a busca é em ordem: o que você mandou, o que o Playwright
 * baixou, e por fim nada — deixando o próprio Playwright decidir, que
 * é o que funciona depois de `npx playwright install chromium`.
 */
const fs = require('fs');
const path = require('path');

function achar() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  const raizes = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers',
                  path.join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
  for (const raiz of raizes) {
    let pastas;
    try { pastas = fs.readdirSync(raiz); } catch (_) { continue; }
    /* mais novo primeiro: chromium-1194 antes de chromium-1100 */
    const candidatas = pastas.filter(d => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of candidatas) {
      const exe = path.join(raiz, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  /* undefined faz o Playwright usar o navegador dele */
  return undefined;
}

module.exports = achar();
