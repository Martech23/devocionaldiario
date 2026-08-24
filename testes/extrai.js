/* extrai só as tabelas de dados do app.js, sem tocar no DOM */
const fs = require('fs');
const RAIZ = require('path').resolve(__dirname, '..');
const src = fs.readFileSync(RAIZ + '/app.js', 'utf8');
function bloco(nome){
  const i = src.indexOf('const ' + nome + ' = {');
  if(i < 0) throw new Error('não achei ' + nome);
  let j = src.indexOf('{', i), n = 0, k = j;
  for(; k < src.length; k++){
    if(src[k] === '{') n++;
    else if(src[k] === '}'){ n--; if(!n) break; }
  }
  return src.slice(j, k + 1);
}
const PROMESSAS  = eval('(' + bloco('PROMESSAS') + ')');
const DEVOCIONAL = eval('(' + bloco('DEVOCIONAL') + ')');
const PARES      = eval('(' + bloco('PARES') + ')');
const LIVROS_ABREV = (()=>{ try { return eval('(' + bloco('LIVROS_ABREV') + ')'); } catch(_){ return null; } })();
module.exports = { PROMESSAS, DEVOCIONAL, PARES, src };
