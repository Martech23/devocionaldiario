#!/usr/bin/env node
/* =========================================================
   GERADOR DA LISTA DE LUGARES DO MAPA

   As coordenadas do mapa vêm do Bible Geocoding Data do
   OpenBible.info, publicado sob Creative Commons Attribution 4.0:
   https://github.com/openbibleinfo/Bible-Geocoding-Data

   O que é deles: latitude, longitude e a contagem de quantas
   passagens mencionam cada lugar.
   O que é nosso: quais lugares entram, o nome em português, a
   nota e as passagens escolhidas para abrir no leitor.

   O script também confere cada passagem que escrevemos contra a
   lista de menções deles — se dissermos que Rute 1:22 fala de
   Belém e a base não concordar, ele avisa.

   Uso:
     node ferramentas/gerar-lugares.mjs            gera o bloco LUGARES
     node ferramentas/gerar-lugares.mjs --ranking  lista candidatos a entrar
   ========================================================= */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main';
const CACHE = new URL('./.cache-openbible/', import.meta.url).pathname;

/* Recorte do mapa, igual ao do index.html */
const MAPA = { oesteLon: 34.15, lesteLon: 36.45, sulLat: 30.85, norteLat: 33.75 };

/* -------------------------------------------------------------
   A CURADORIA — nossa parte.
   `ob` é o friendly_id no Bible Geocoding Data; é só por ele que
   o lugar é encontrado. `refs` são [nr do livro, capítulo, versículo].

   `tambem` lista outras entradas do OpenBible que o mesmo pino
   cobre. Eles separam o que para quem lê é um lugar só: a Jericó
   do Antigo Testamento e a do Novo são sítios a 2,3 km um do
   outro; Berseba e Samaria aparecem duas vezes no mesmo ponto,
   uma para a cidade e outra para a região. As menções somam.

   `contexto` são capítulos que abrimos de propósito sem que o
   nome do lugar apareça neles — a passagem é a do acontecimento.
   ------------------------------------------------------------- */
const CURADOS = [
  { ob: 'Jerusalem', nome: 'Jerusalém', tipo: 'cidade',
    nota: 'A cidade do templo. Cenário da Páscoa, da cruz e da ressurreição.',
    refs: [[19,122,6],[42,19,41],[44,2,1]] },
  { ob: 'Bethlehem 1', nome: 'Belém', tipo: 'cidade',
    nota: 'Onde Rute colheu, Davi nasceu e Jesus nasceu.',
    refs: [[33,5,2],[42,2,4],[8,1,22]] },
  { ob: 'Nazareth', nome: 'Nazaré', tipo: 'cidade',
    nota: 'Onde Jesus cresceu, e de onde diziam que nada de bom podia vir.',
    refs: [[42,2,51],[43,1,46]] },
  { ob: 'Capernaum', nome: 'Cafarnaum', tipo: 'cidade',
    nota: 'Base do ministério de Jesus na Galileia.',
    refs: [[40,4,13],[41,2,1]] },
  { ob: 'Cana', nome: 'Caná', tipo: 'vila',
    nota: 'O primeiro sinal: a água que virou vinho.',
    refs: [[43,2,11]] },
  { ob: 'Jericho 1', nome: 'Jericó', tipo: 'cidade', tambem: ['Jericho 2'],
    nota: 'A cidade das muralhas, e onde Zaqueu subiu na árvore.',
    refs: [[6,6,20],[42,19,5]] },
  { ob: 'Bethel 1', nome: 'Betel', tipo: 'vila',
    nota: 'Onde Jacó sonhou com a escada que subia ao céu.',
    refs: [[1,28,19]] },
  { ob: 'Shechem', nome: 'Siquém', tipo: 'cidade',
    nota: 'Onde Josué reuniu o povo para escolher a quem servir.',
    refs: [[6,24,15]] },
  { ob: 'Samaria 1', nome: 'Samaria', tipo: 'cidade', tambem: ['Samaria 2'],
    nota: 'Capital do reino do norte; terra da mulher do poço.',
    refs: [[43,4,5],[44,8,5]] },
  { ob: 'Hebron', nome: 'Hebrom', tipo: 'cidade',
    nota: 'Onde Abraão morou e foi sepultado. Primeira capital de Davi.',
    refs: [[1,23,19],[10,2,4]] },
  { ob: 'Beersheba 1', nome: 'Berseba', tipo: 'cidade', tambem: ['Beersheba 2'],
    nota: 'O extremo sul da terra: "de Dã a Berseba".',
    refs: [[1,21,33],[9,3,20]] },
  { ob: 'Joppa', nome: 'Jope', tipo: 'porto',
    nota: 'De onde Jonas fugiu de navio; onde Pedro teve a visão.',
    refs: [[32,1,3],[44,10,9]] },
  { ob: 'Caesarea', nome: 'Cesareia', tipo: 'porto',
    nota: 'Porto romano. Casa de Cornélio e prisão de Paulo.',
    refs: [[44,10,1],[44,23,33]] },
  { ob: 'Mount Carmel', nome: 'Monte Carmelo', tipo: 'monte',
    nota: 'Onde Elias desafiou os profetas de Baal.',
    refs: [[11,18,20]] },
  { ob: 'Megiddo', nome: 'Meguido', tipo: 'cidade',
    nota: 'Passagem de exércitos por séculos.',
    refs: [[12,23,29]] },
  { ob: 'Tyre', nome: 'Tiro', tipo: 'porto',
    nota: 'Cidade fenícia. Jesus esteve nos seus arredores.',
    refs: [[41,7,24]] },
  { ob: 'Sidon', nome: 'Sidom', tipo: 'porto',
    nota: 'A viúva de Sarepta, entre Tiro e Sidom, sustentou Elias.',
    refs: [[11,17,9],[42,4,26]] },
  { ob: 'Damascus', nome: 'Damasco', tipo: 'cidade',
    nota: 'No caminho para lá, Saulo viu a luz e virou Paulo.',
    refs: [[44,9,3]] },
  { ob: 'Bethany 1', nome: 'Betânia', tipo: 'vila', contexto: ['LUK 10'],
    nota: 'Casa de Marta, Maria e Lázaro.',
    refs: [[43,11,1],[42,10,38]] },
  { ob: 'Shiloh', nome: 'Silo', tipo: 'vila',
    nota: 'Onde ficou o tabernáculo, e onde Ana orou por um filho.',
    refs: [[9,1,9]] },
  { ob: 'Gaza', nome: 'Gaza', tipo: 'cidade',
    nota: 'Cidade filisteia; onde Sansão derrubou as colunas.',
    refs: [[7,16,21]] },
  { ob: 'Mount Nebo', nome: 'Monte Nebo', tipo: 'monte',
    nota: 'De onde Moisés viu a terra que não pisaria.',
    refs: [[5,34,1]] },
  { ob: 'Sea of Galilee', nome: 'Lago da Galileia', tipo: 'agua', contexto: ['MRK 4'],
    nota: 'Onde Jesus chamou pescadores e acalmou a tempestade.',
    refs: [[41,4,39],[40,4,18]] },
  { ob: 'Salt Sea', nome: 'Mar Morto', tipo: 'agua',
    nota: 'O ponto mais baixo da terra firme. O vale de Sidim, perto de Sodoma.',
    refs: [[1,14,3],[6,3,16]] },

  /* entraram com os dados do OpenBible: os mais mencionados do recorte
     que ainda não estavam no mapa */
  { ob: 'Sodom', nome: 'Sodoma', tipo: 'cidade',
    nota: 'A cidade que Ló escolheu olhando para a planície bem regada.',
    refs: [[1,13,12],[1,19,24]] },
  { ob: 'Gibeon', nome: 'Gibeão', tipo: 'cidade',
    nota: 'Os gibeonitas enganaram Josué com pão velho e sandálias gastas.',
    refs: [[6,9,3],[11,3,5]] },
  { ob: 'Gath 1', nome: 'Gate', tipo: 'cidade',
    nota: 'Cidade de Golias, o filisteu que Davi enfrentou com a funda.',
    refs: [[9,17,4],[10,1,20]] },
  { ob: 'Heshbon', nome: 'Hesbom', tipo: 'cidade',
    nota: 'Capital de Seom, tomada por Israel a caminho da terra prometida.',
    refs: [[4,21,25]] },
  { ob: 'Jezreel 2', nome: 'Jezreel', tipo: 'cidade',
    nota: 'Onde ficava o palácio de Acabe e a vinha que Nabote não vendeu.',
    refs: [[11,21,1],[12,9,30]] },
  { ob: 'Dan', nome: 'Dã', tipo: 'cidade',
    nota: 'O extremo norte da terra: "de Dã a Berseba".',
    refs: [[7,20,1],[11,12,29]] },
  { ob: 'Lachish', nome: 'Laquis', tipo: 'cidade',
    nota: 'Cidade fortificada, sitiada pelos assírios nos dias de Ezequias.',
    refs: [[6,10,31],[12,18,14]] },
  { ob: 'Ashdod', nome: 'Asdode', tipo: 'cidade',
    nota: 'Para onde levaram a arca — e onde Dagom caiu de cara no chão.',
    refs: [[9,5,1]] },
  { ob: 'Ekron', nome: 'Ecrom', tipo: 'cidade',
    nota: 'A última das cinco cidades filisteias por onde a arca passou.',
    refs: [[9,5,10]] },
  { ob: 'Jabesh-gilead', nome: 'Jabes-Gileade', tipo: 'cidade',
    nota: 'Saul salvou a cidade, e ela não esqueceu: buscou o corpo dele.',
    refs: [[9,11,1],[9,31,11]] },
  { ob: 'Ramoth-gilead', nome: 'Ramote-Gileade', tipo: 'cidade',
    nota: 'Onde Acabe foi ferido pela flecha atirada a esmo.',
    refs: [[11,22,3]] },
  { ob: 'Kiriath-jearim', nome: 'Quiriate-Jearim', tipo: 'vila',
    nota: 'A arca ficou ali vinte anos, até Davi ir buscá-la.',
    refs: [[9,7,1],[13,13,5]] },
  { ob: 'Beth-shemesh 1', nome: 'Bete-Semes', tipo: 'vila',
    nota: 'Para onde as vacas levaram a arca sozinhas, sem se desviar.',
    refs: [[9,6,12]] },
  { ob: 'Rabbah 1', nome: 'Rabá', tipo: 'cidade',
    nota: 'A cidade que Joabe sitiava enquanto Davi ficava em casa.',
    refs: [[10,11,1],[10,12,26]] },
  { ob: 'Mahanaim', nome: 'Maanaim', tipo: 'vila',
    nota: 'Onde Jacó viu os anjos de Deus, e onde Davi se abrigou.',
    refs: [[1,32,2],[10,17,24]] },
  { ob: 'Mount Hermon', nome: 'Monte Hermom', tipo: 'monte',
    nota: 'A montanha alta do norte, e o orvalho que desce dela.',
    refs: [[5,3,8],[19,133,3]] },
  { ob: 'Keilah', nome: 'Queila', tipo: 'vila',
    nota: 'Davi livrou a cidade dos filisteus — e ela o teria entregado.',
    refs: [[9,23,5]] }
];

/* nr do livro → sigla USFM, para conferir as passagens contra a base */
const USFM = ['','GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH',
  'EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO',
  'OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO',
  '2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN',
  '2JN','3JN','JUD','REV'];

async function baixar(nome){
  if(!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const destino = CACHE + nome.replace('/', '-');
  if(existsSync(destino)) return readFileSync(destino, 'utf8');
  process.stderr.write('baixando ' + nome + '…\n');
  const r = await fetch(BASE + '/' + nome);
  if(!r.ok) throw new Error(nome + ': HTTP ' + r.status);
  const txt = await r.text();
  writeFileSync(destino, txt);
  return txt;
}

const linhas = t => t.split('\n').filter(Boolean).map(l => JSON.parse(l));

/* a identificação com maior score é a que o OpenBible considera mais
   provável; é dela que sai a coordenada */
function coordenada(antigo, modernos){
  const assoc = antigo.modern_associations || {};
  const ids = Object.keys(assoc);
  if(!ids.length) return null;
  const melhor = ids.reduce((a, b) => (assoc[b].score || 0) > (assoc[a].score || 0) ? b : a);
  const m = modernos.get(melhor);
  if(!m || !m.lonlat) return null;
  const [lon, lat] = m.lonlat.split(',').map(Number);
  return { lat, lon };
}

const main = async () => {
  const modernos = new Map(linhas(await baixar('data/modern.jsonl')).map(r => [r.id, r]));
  const antigos  = new Map(linhas(await baixar('data/ancient.jsonl')).map(r => [r.friendly_id, r]));

  if(process.argv.includes('--ranking')) return ranking(antigos, modernos);

  const saida = [];
  const avisos = [];
  for(const c of CURADOS){
    const a = antigos.get(c.ob);
    if(!a){ avisos.push('não existe no OpenBible: ' + c.ob); continue; }
    const p = coordenada(a, modernos);
    if(!p){ avisos.push('sem coordenada: ' + c.ob); continue; }
    if(p.lat < MAPA.sulLat || p.lat > MAPA.norteLat || p.lon < MAPA.oesteLon || p.lon > MAPA.lesteLon)
      avisos.push('fora do recorte: ' + c.nome);

    /* Conferência: o capítulo que escolhemos fala mesmo deste lugar?
       A checagem é por capítulo, não por versículo, de propósito. A
       passagem que abre no leitor é a do acontecimento, não a que
       soletra o nome: Atos 2:1 é o Pentecostes, mas quem diz
       "Jerusalém" é Atos 2:5. Exigir o versículo exato reprovaria a
       escolha certa; exigir o capítulo ainda pega o erro de verdade,
       que é ligar um lugar a uma história que não é dele. */
    const registros = [a, ...(c.tambem || []).map(n => antigos.get(n)).filter(Boolean)];
    if((c.tambem || []).length !== registros.length - 1)
      avisos.push(c.nome + ': alguma entrada de `tambem` não existe');

    const capitulos = new Set();
    for(const r of registros) for(const v of r.verses || []) capitulos.add(v.usx.replace(/:\d+$/, ''));
    const excecoes = new Set(c.contexto || []);
    for(const [nr, cap] of c.refs){
      const chave = USFM[nr] + ' ' + cap;
      if(!capitulos.has(chave) && !excecoes.has(chave))
        avisos.push(`${c.nome}: ${chave} não menciona o lugar em nenhum versículo`);
    }
    for(const e of excecoes)
      if(capitulos.has(e)) avisos.push(`${c.nome}: ${e} já menciona o lugar, a exceção sobra`);

    saida.push({ ...c, lat: +p.lat.toFixed(4), lon: +p.lon.toFixed(4),
      mencoes: registros.reduce((s, r) => s + (r.verses || []).length, 0) });
  }

  saida.sort((a, b) => b.mencoes - a.mencoes);
  const linha = l => `  { nome: ${JSON.stringify(l.nome)}, lat: ${l.lat}, lon: ${l.lon}, ` +
    `tipo: '${l.tipo}', mencoes: ${l.mencoes},\n    nota: ${JSON.stringify(l.nota)},\n` +
    `    refs: [${l.refs.map(r => '[' + r.join(',') + ']').join(',')}] }`;

  console.log('const LUGARES = [\n' + saida.map(linha).join(',\n') + '\n];');
  if(avisos.length) process.stderr.write('\nAVISOS:\n  ' + avisos.join('\n  ') + '\n');
  process.stderr.write(`\n${saida.length} lugares, ${saida.reduce((s, l) => s + l.refs.length, 0)} passagens\n`);
};

/* candidatos a entrar no mapa: povoados e montes dentro do recorte,
   ordenados por quantas passagens os mencionam, com distância mínima
   entre eles para os rótulos não virarem uma mancha só */
function ranking(antigos, modernos){
  const dentro = [];
  const BONS = new Set(['settlement', 'mountain', 'hill']);
  for(const a of antigos.values()){
    const t = a.types || [];
    if(!t.some(x => BONS.has(x)) || t.some(x => !BONS.has(x) && x !== 'special')) continue;
    const p = coordenada(a, modernos);
    if(!p) continue;
    if(p.lat < MAPA.sulLat + 0.1 || p.lat > MAPA.norteLat - 0.1 ||
       p.lon < MAPA.oesteLon + 0.1 || p.lon > MAPA.lesteLon - 0.1) continue;
    dentro.push({ ob: a.friendly_id, mencoes: (a.verses || []).length, ...p });
  }
  dentro.sort((x, y) => y.mencoes - x.mencoes);
  const km = (a, b) => Math.hypot((b.lat - a.lat) * 111.32,
    (b.lon - a.lon) * 111.32 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180));
  const jaTem = new Set(CURADOS.map(c => c.ob));
  const escolhidos = dentro.filter(d => jaTem.has(d.ob));
  for(const d of dentro){
    if(jaTem.has(d.ob)) continue;
    if(d.mencoes < 15) continue;
    if(escolhidos.every(e => km(d, e) >= 8)) escolhidos.push(d);
  }
  for(const e of escolhidos)
    console.log(`${String(e.mencoes).padStart(4)}  ${e.ob.padEnd(20)}` +
      `${e.lat.toFixed(4).padStart(9)}${e.lon.toFixed(4).padStart(9)}` +
      (jaTem.has(e.ob) ? '' : '   ← ainda não está no mapa'));
}

main().catch(e => { console.error(e); process.exit(1); });
