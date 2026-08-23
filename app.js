/* =========================================================
   O ENDEREÇO DO SITE VAI JUNTO

   Versículo compartilhado sem link chega bonito e morre ali: quem
   recebeu não tem como voltar para o lugar de onde veio.

   O endereço sai da tag canônica, a mesma que a prévia do WhatsApp
   usa — assim link compartilhado e link da prévia não podem
   divergir. Em desenvolvimento, cai na origem da própria página.
   ========================================================= */
const LINK_SITE = (document.querySelector('link[rel="canonical"]') || {}).href
  || (location.origin + '/');
/* versão curta, para caber desenhada no rodapé da imagem */

/* O link levar à capa não bastaria: quem recebeu o versículo teria de
   procurá-lo. `?v=nr.capítulo.versículo` abre a passagem direto, com o
   versículo destacado. Números e não o nome do livro porque o nome tem
   acento e espaço, e endereço com "G%C3%AAnesis%2028" some quando o
   aplicativo de mensagem corta o link no meio. */
const linkDoVerso = (nr, cap, verso) =>
  LINK_SITE + '?v=' + nr + '.' + cap + (verso ? '.' + verso : '');

/* ===== fontes de texto: uso livre confirmado e ortografia atual ===== */
/* Versões semente — funcionam mesmo se o catálogo remoto falhar */
const VERSOES = [
  { fonte: 'getbible', id: 'livre', nome: 'Bíblia Livre', licenca: 'CC BY 3.0 Brasil' },
  { fonte: 'getbible', id: 'livretr', nome: 'Bíblia Livre (Texto Recebido)', licenca: 'CC BY 3.0 Brasil' },
  { fonte: 'helloao', id: 'por_blj', nome: 'Bíblia Livre (fonte alternativa)', licenca: 'Uso livre' },
  { fonte: 'helloao', id: 'por_onbv', nome: 'Nova Bíblia Viva (Open)', licenca: 'Uso livre' }
];
const HELLOAO = 'https://bible.helloao.org/api';
const BASE = 'https://api.getbible.net/v2';

const LIVROS = [
  [1,'Gênesis',50,'GEN'],[2,'Êxodo',40,'EXO'],[3,'Levítico',27,'LEV'],[4,'Números',36,'NUM'],
  [5,'Deuteronômio',34,'DEU'],[6,'Josué',24,'JOS'],[7,'Juízes',21,'JDG'],[8,'Rute',4,'RUT'],
  [9,'1 Samuel',31,'1SA'],[10,'2 Samuel',24,'2SA'],[11,'1 Reis',22,'1KI'],[12,'2 Reis',25,'2KI'],
  [13,'1 Crônicas',29,'1CH'],[14,'2 Crônicas',36,'2CH'],[15,'Esdras',10,'EZR'],[16,'Neemias',13,'NEH'],
  [17,'Ester',10,'EST'],[18,'Jó',42,'JOB'],[19,'Salmos',150,'PSA'],[20,'Provérbios',31,'PRO'],
  [21,'Eclesiastes',12,'ECC'],[22,'Cantares de Salomão',8,'SNG'],[23,'Isaías',66,'ISA'],
  [24,'Jeremias',52,'JER'],[25,'Lamentações',5,'LAM'],[26,'Ezequiel',48,'EZK'],[27,'Daniel',12,'DAN'],
  [28,'Oseias',14,'HOS'],[29,'Joel',3,'JOL'],[30,'Amós',9,'AMO'],[31,'Obadias',1,'OBA'],
  [32,'Jonas',4,'JON'],[33,'Miqueias',7,'MIC'],[34,'Naum',3,'NAM'],[35,'Habacuque',3,'HAB'],
  [36,'Sofonias',3,'ZEP'],[37,'Ageu',2,'HAG'],[38,'Zacarias',14,'ZEC'],[39,'Malaquias',4,'MAL'],
  [40,'Mateus',28,'MAT'],[41,'Marcos',16,'MRK'],[42,'Lucas',24,'LUK'],[43,'João',21,'JHN'],
  [44,'Atos',28,'ACT'],[45,'Romanos',16,'ROM'],[46,'1 Coríntios',16,'1CO'],[47,'2 Coríntios',13,'2CO'],
  [48,'Gálatas',6,'GAL'],[49,'Efésios',6,'EPH'],[50,'Filipenses',4,'PHP'],[51,'Colossenses',4,'COL'],
  [52,'1 Tessalonicenses',5,'1TH'],[53,'2 Tessalonicenses',3,'2TH'],[54,'1 Timóteo',6,'1TI'],
  [55,'2 Timóteo',4,'2TI'],[56,'Tito',3,'TIT'],[57,'Filemom',1,'PHM'],[58,'Hebreus',13,'HEB'],
  [59,'Tiago',5,'JAS'],[60,'1 Pedro',5,'1PE'],[61,'2 Pedro',3,'2PE'],[62,'1 João',5,'1JN'],
  [63,'2 João',1,'2JN'],[64,'3 João',1,'3JN'],[65,'Judas',1,'JUD'],[66,'Apocalipse',22,'REV']
].map(([nr,nome,caps,sigla]) => ({nr,nome,caps,sigla}));

/* =========================================================
   MAPA DA TERRA SANTA
   Coordenadas de lugar são fato, não obra: ninguém detém
   direito sobre a latitude de Belém. O desenho é nosso, feito
   em SVG — pela mesma razão que os fundos do gerador de imagem
   são desenhados e não fotografados: sem licença, sem chave de
   API, e funciona offline.
   Guardamos latitude e longitude de verdade e projetamos por
   código. Assim as posições relativas são honestas; só o traço
   do litoral é simplificado.
   ========================================================= */

/* Recorte do mapa, em graus */
const MAPA = { oesteLon: 34.15, lesteLon: 36.45, sulLat: 30.85, norteLat: 33.75, k: 300 };

/* Longitude encolhe com a latitude; sem isso a Terra Santa sairia
   esticada no sentido leste-oeste. */
const COS_MEDIO = Math.cos((MAPA.sulLat + MAPA.norteLat) / 2 * Math.PI / 180);
const MAPA_W = (MAPA.lesteLon - MAPA.oesteLon) * COS_MEDIO * MAPA.k;
const MAPA_H = (MAPA.norteLat - MAPA.sulLat) * MAPA.k;

const projX = lon => (lon - MAPA.oesteLon) * COS_MEDIO * MAPA.k;
const projY = lat => (MAPA.norteLat - lat) * MAPA.k;
const traco = pontos => pontos.map(([la, lo]) => projX(lo).toFixed(1) + ',' + projY(la).toFixed(1)).join(' ');

/* Litoral do Mediterrâneo, de sul para norte. Simplificado, mas
   ancorado em pontos reais da costa. */
const LITORAL = [
  [30.85, 34.20], [31.20, 34.25], [31.52, 34.42], [31.80, 34.62], [32.05, 34.74],
  [32.30, 34.83], [32.55, 34.90], [32.83, 34.97], [33.05, 35.10], [33.27, 35.19],
  [33.56, 35.37], [33.75, 35.48]
];

/* Rio Jordão: do lago da Galileia ao Mar Morto */
const JORDAO = [
  [32.72, 35.57], [32.55, 35.57], [32.35, 35.55], [32.15, 35.56], [31.95, 35.54], [31.82, 35.53]
];

/* Lago da Galileia e Mar Morto, como polígonos fechados */
const GALILEIA = [
  [32.90, 35.53], [32.88, 35.63], [32.82, 35.66], [32.75, 35.62], [32.73, 35.55], [32.80, 35.51]
];
const MAR_MORTO = [
  [31.77, 35.48], [31.76, 35.58], [31.55, 35.60], [31.40, 35.53], [31.25, 35.52],
  [31.10, 35.45], [31.20, 35.42], [31.45, 35.44], [31.65, 35.45]
];

/* Lugares. As passagens são as que a pessoa pode abrir dali. */
/* Lugares — gerados por ferramentas/gerar-lugares.mjs.
   Latitude, longitude e a contagem de menções vêm do Bible Geocoding
   Data do OpenBible.info (CC BY 4.0). O nome em português, a nota e as
   passagens são nossos. Não edite à mão: mexa no gerador e rode de novo. */
const LUGARES = [
  { nome: "Jerusalém", lat: 31.7767, lon: 35.2342, tipo: 'cidade', mencoes: 955,
    nota: "A cidade do templo. Cenário da Páscoa, da cruz e da ressurreição.",
    refs: [[19,122,6],[42,19,41],[44,2,1]] },
  { nome: "Samaria", lat: 32.2761, lon: 35.195, tipo: 'cidade', mencoes: 126,
    nota: "Capital do reino do norte; terra da mulher do poço.",
    refs: [[43,4,5],[44,8,5]] },
  { nome: "Betel", lat: 31.9228, lon: 35.2414, tipo: 'vila', mencoes: 69,
    nota: "Onde Jacó sonhou com a escada que subia ao céu.",
    refs: [[1,28,19]] },
  { nome: "Jericó", lat: 31.8717, lon: 35.4446, tipo: 'cidade', mencoes: 68,
    nota: "A cidade das muralhas, e onde Zaqueu subiu na árvore.",
    refs: [[6,6,20],[42,19,5]] },
  { nome: "Tiro", lat: 33.2708, lon: 35.1961, tipo: 'porto', mencoes: 64,
    nota: "Cidade fenícia. Jesus esteve nos seus arredores.",
    refs: [[41,7,24]] },
  { nome: "Hebrom", lat: 31.5251, lon: 35.1022, tipo: 'cidade', mencoes: 62,
    nota: "Onde Abraão morou e foi sepultado. Primeira capital de Davi.",
    refs: [[1,23,19],[10,2,4]] },
  { nome: "Damasco", lat: 33.5111, lon: 36.3064, tipo: 'cidade', mencoes: 58,
    nota: "No caminho para lá, Saulo viu a luz e virou Paulo.",
    refs: [[44,9,3]] },
  { nome: "Belém", lat: 31.7043, lon: 35.2076, tipo: 'cidade', mencoes: 52,
    nota: "Onde Rute colheu, Davi nasceu e Jesus nasceu.",
    refs: [[33,5,2],[42,2,4],[8,1,22]] },
  { nome: "Sodoma", lat: 31.2085, lon: 35.4492, tipo: 'cidade', mencoes: 50,
    nota: "A cidade que Ló escolheu olhando para a planície bem regada.",
    refs: [[1,13,12],[1,19,24]] },
  { nome: "Siquém", lat: 32.2136, lon: 35.2819, tipo: 'cidade', mencoes: 45,
    nota: "Onde Josué reuniu o povo para escolher a quem servir.",
    refs: [[6,24,15]] },
  { nome: "Gibeão", lat: 31.8475, lon: 35.1834, tipo: 'cidade', mencoes: 39,
    nota: "Os gibeonitas enganaram Josué com pão velho e sandálias gastas.",
    refs: [[6,9,3],[11,3,5]] },
  { nome: "Gate", lat: 31.6997, lon: 34.8469, tipo: 'cidade', mencoes: 38,
    nota: "Cidade de Golias, o filisteu que Davi enfrentou com a funda.",
    refs: [[9,17,4],[10,1,20]] },
  { nome: "Sidom", lat: 33.561, lon: 35.3719, tipo: 'porto', mencoes: 37,
    nota: "A viúva de Sarepta, entre Tiro e Sidom, sustentou Elias.",
    refs: [[11,17,9],[42,4,26]] },
  { nome: "Silo", lat: 32.0557, lon: 35.2895, tipo: 'vila', mencoes: 37,
    nota: "Onde ficou o tabernáculo, e onde Ana orou por um filho.",
    refs: [[9,1,9]] },
  { nome: "Hesbom", lat: 31.8008, lon: 35.8091, tipo: 'cidade', mencoes: 37,
    nota: "Capital de Seom, tomada por Israel a caminho da terra prometida.",
    refs: [[4,21,25]] },
  { nome: "Berseba", lat: 31.2447, lon: 34.8408, tipo: 'cidade', mencoes: 33,
    nota: "O extremo sul da terra: \"de Dã a Berseba\".",
    refs: [[1,21,33],[9,3,20]] },
  { nome: "Nazaré", lat: 32.7021, lon: 35.2977, tipo: 'cidade', mencoes: 32,
    nota: "Onde Jesus cresceu, e de onde diziam que nada de bom podia vir.",
    refs: [[42,2,51],[43,1,46]] },
  { nome: "Jezreel", lat: 32.5579, lon: 35.328, tipo: 'cidade', mencoes: 29,
    nota: "Onde ficava o palácio de Acabe e a vinha que Nabote não vendeu.",
    refs: [[11,21,1],[12,9,30]] },
  { nome: "Dã", lat: 33.249, lon: 35.652, tipo: 'cidade', mencoes: 25,
    nota: "O extremo norte da terra: \"de Dã a Berseba\".",
    refs: [[7,20,1],[11,12,29]] },
  { nome: "Gaza", lat: 31.504, lon: 34.4644, tipo: 'cidade', mencoes: 22,
    nota: "Cidade filisteia; onde Sansão derrubou as colunas.",
    refs: [[7,16,21]] },
  { nome: "Laquis", lat: 31.5653, lon: 34.8492, tipo: 'cidade', mencoes: 22,
    nota: "Cidade fortificada, sitiada pelos assírios nos dias de Ezequias.",
    refs: [[6,10,31],[12,18,14]] },
  { nome: "Mar Morto", lat: 31.5, lon: 35.5, tipo: 'agua', mencoes: 21,
    nota: "O ponto mais baixo da terra firme. O vale de Sidim, perto de Sodoma.",
    refs: [[1,14,3],[6,3,16]] },
  { nome: "Asdode", lat: 31.7572, lon: 34.6578, tipo: 'cidade', mencoes: 21,
    nota: "Para onde levaram a arca — e onde Dagom caiu de cara no chão.",
    refs: [[9,5,1]] },
  { nome: "Ecrom", lat: 31.7775, lon: 34.8519, tipo: 'cidade', mencoes: 20,
    nota: "A última das cinco cidades filisteias por onde a arca passou.",
    refs: [[9,5,10]] },
  { nome: "Jabes-Gileade", lat: 32.4024, lon: 35.6823, tipo: 'cidade', mencoes: 20,
    nota: "Saul salvou a cidade, e ela não esqueceu: buscou o corpo dele.",
    refs: [[9,11,1],[9,31,11]] },
  { nome: "Ramote-Gileade", lat: 32.4999, lon: 36.015, tipo: 'cidade', mencoes: 20,
    nota: "Onde Acabe foi ferido pela flecha atirada a esmo.",
    refs: [[11,22,3]] },
  { nome: "Quiriate-Jearim", lat: 31.809, lon: 35.1038, tipo: 'vila', mencoes: 19,
    nota: "A arca ficou ali vinte anos, até Davi ir buscá-la.",
    refs: [[9,7,1],[13,13,5]] },
  { nome: "Cafarnaum", lat: 32.8811, lon: 35.575, tipo: 'cidade', mencoes: 18,
    nota: "Base do ministério de Jesus na Galileia.",
    refs: [[40,4,13],[41,2,1]] },
  { nome: "Cesareia", lat: 32.5, lon: 34.8917, tipo: 'porto', mencoes: 18,
    nota: "Porto romano. Casa de Cornélio e prisão de Paulo.",
    refs: [[44,10,1],[44,23,33]] },
  { nome: "Monte Carmelo", lat: 32.6725, lon: 35.0233, tipo: 'monte', mencoes: 18,
    nota: "Onde Elias desafiou os profetas de Baal.",
    refs: [[11,18,20]] },
  { nome: "Bete-Semes", lat: 31.7506, lon: 34.9747, tipo: 'vila', mencoes: 17,
    nota: "Para onde as vacas levaram a arca sozinhas, sem se desviar.",
    refs: [[9,6,12]] },
  { nome: "Rabá", lat: 31.9547, lon: 35.9343, tipo: 'cidade', mencoes: 17,
    nota: "A cidade que Joabe sitiava enquanto Davi ficava em casa.",
    refs: [[10,11,1],[10,12,26]] },
  { nome: "Maanaim", lat: 32.1857, lon: 35.6867, tipo: 'vila', mencoes: 16,
    nota: "Onde Jacó viu os anjos de Deus, e onde Davi se abrigou.",
    refs: [[1,32,2],[10,17,24]] },
  { nome: "Monte Hermom", lat: 33.4, lon: 35.85, tipo: 'monte', mencoes: 16,
    nota: "A montanha alta do norte, e o orvalho que desce dela.",
    refs: [[5,3,8],[19,133,3]] },
  { nome: "Queila", lat: 31.6137, lon: 35.0036, tipo: 'vila', mencoes: 15,
    nota: "Davi livrou a cidade dos filisteus — e ela o teria entregado.",
    refs: [[9,23,5]] },
  { nome: "Jope", lat: 32.0545, lon: 34.753, tipo: 'porto', mencoes: 14,
    nota: "De onde Jonas fugiu de navio; onde Pedro teve a visão.",
    refs: [[32,1,3],[44,10,9]] },
  { nome: "Meguido", lat: 32.5853, lon: 35.1844, tipo: 'cidade', mencoes: 12,
    nota: "Passagem de exércitos por séculos.",
    refs: [[12,23,29]] },
  { nome: "Betânia", lat: 31.7717, lon: 35.2559, tipo: 'vila', mencoes: 12,
    nota: "Casa de Marta, Maria e Lázaro.",
    refs: [[43,11,1],[42,10,38]] },
  { nome: "Lago da Galileia", lat: 32.8189, lon: 35.59, tipo: 'agua', mencoes: 10,
    nota: "Onde Jesus chamou pescadores e acalmou a tempestade.",
    refs: [[41,4,39],[40,4,18]] },
  { nome: "Caná", lat: 32.8222, lon: 35.3027, tipo: 'vila', mencoes: 4,
    nota: "O primeiro sinal: a água que virou vinho.",
    refs: [[43,2,11]] },
  { nome: "Monte Nebo", lat: 31.7667, lon: 35.75, tipo: 'monte', mencoes: 2,
    nota: "De onde Moisés viu a terra que não pisaria.",
    refs: [[5,34,1]] }
];

/* =========================================================
   REFERÊNCIAS CRUZADAS
   Nada aqui é copiado de obra alheia: são ligações entre
   passagens, que são fato e não texto. Ficam escritas como
   grupos porque a relação é simétrica — se A remete a B, B
   remete a A —, e derivar os dois sentidos em código evita
   ligar num sentido e esquecer o outro.
   ========================================================= */

/* Passagens que tratam do mesmo assunto */
const GRUPOS_REF = [
  /* o Senhor é o pastor */
  [[19,23,1],[43,10,11],[26,34,11],[23,40,11],[60,2,25],[58,13,20],[19,80,1]],
  /* não temas, estou contigo */
  [[23,41,10],[6,1,9],[5,31,6],[23,43,1],[19,23,4],[19,27,1],[19,118,6],[58,13,6]],
  /* ansiedade entregue */
  [[50,4,6],[60,5,7],[40,6,34],[19,55,22],[23,26,3],[43,14,27],[19,94,19]],
  /* força na fraqueza */
  [[23,40,31],[50,4,13],[47,12,9],[49,6,10],[19,73,26],[23,41,13],[51,1,11],[19,28,7]],
  /* provisão */
  [[50,4,19],[40,6,33],[19,34,10],[39,3,10],[19,37,25],[40,6,26],[42,6,38],[19,23,1]],
  /* descanso para os cansados */
  [[40,11,28],[24,6,16],[58,4,9],[19,127,2],[19,62,1]],
  /* direção e sabedoria */
  [[20,3,5],[20,3,6],[19,32,8],[19,119,105],[23,30,21],[24,29,11],[59,1,5],[19,25,4],[20,16,9]],
  /* perdão que vem de Deus */
  [[62,1,9],[19,103,12],[23,1,18],[33,7,19],[19,51,10],[23,43,25],[58,8,12],[19,32,1]],
  /* perdoar os outros */
  [[40,6,14],[41,11,25],[42,6,37],[51,3,13],[49,4,32]],
  /* fé */
  [[58,11,1],[58,11,6],[45,10,17],[47,5,7],[41,9,23],[59,1,6]],
  /* esperança */
  [[45,15,13],[45,5,5],[25,3,22],[25,3,23],[19,27,14],[45,8,28],[60,1,3]],
  /* gratidão */
  [[19,100,4],[52,5,18],[51,3,15],[19,107,1],[49,5,20],[19,103,2],[19,136,1]],
  /* proteção */
  [[19,91,1],[19,91,11],[19,121,7],[20,18,10],[53,3,3],[19,46,1],[19,32,7],[34,1,7]],
  /* o amor de Deus */
  [[43,3,16],[45,5,8],[62,4,10],[45,8,28],[24,31,3],[49,2,4]],
  /* nova criatura, salvação pela graça */
  [[47,5,17],[49,2,8],[45,10,9],[56,3,5],[43,1,12]],
  /* a Palavra */
  [[19,119,105],[55,3,16],[58,4,12],[23,55,11],[6,1,8],[19,1,2]],
  /* oração */
  [[40,7,7],[59,5,16],[62,5,14],[24,33,3],[52,5,17],[50,4,6]],
  /* consolo na dor */
  [[19,34,18],[19,147,3],[40,5,4],[47,1,3],[66,21,4],[19,30,2],[19,42,11]],
  /* a casa e os filhos */
  [[6,24,15],[20,22,6],[49,6,4],[5,6,7],[19,127,3],[44,16,31]],
  /* luz */
  [[43,8,12],[40,5,14],[19,27,1],[62,1,5],[43,1,5]],
  /* alegria e louvor */
  [[19,118,24],[50,4,4],[16,8,10],[19,100,2],[19,95,2]],
  /* humildade */
  [[59,4,10],[60,5,6],[20,3,34],[33,6,8],[40,23,12]],
  /* coragem no lugar do medo */
  [[19,56,3],[55,1,7],[19,34,4],[43,16,33],[19,27,1],[19,118,6],[45,8,37],[62,5,4]],
  /* rocha e fortaleza */
  [[19,18,2],[19,46,7],[5,33,27],[19,3,3],[19,91,4],[19,62,2],[20,30,5]],
  /* firmeza e perseverança */
  [[46,16,13],[58,10,23],[45,12,12],[48,6,9],[46,15,58],[19,130,5],[19,39,7]],
  /* Deus dá forças a quem não tem */
  [[23,40,29],[49,3,16],[35,3,19],[19,138,3],[23,12,2],[38,4,6],[55,4,17]],
  /* toda boa dádiva */
  [[59,1,17],[19,84,11],[47,9,8],[19,145,16],[19,111,5],[20,3,10],[51,3,17]],
  /* o Senhor proverá */
  [[1,22,14],[2,16,4],[11,17,14],[43,6,35],[50,4,19]],
  /* Ele sara */
  [[24,30,17],[19,103,3],[19,6,2],[2,15,26],[39,4,2],[24,17,14],[19,147,3]],
  /* Ele guia os passos */
  [[19,37,23],[23,58,11],[20,16,3],[19,143,8],[43,16,13],[19,48,14],[20,4,11],[23,42,16],[19,139,10]],
  /* nenhuma condenação */
  [[45,8,1],[19,130,4],[44,3,19],[19,86,5],[42,23,34],[14,7,14]],
  /* dar graças em tudo */
  [[51,3,17],[13,16,34],[19,9,1],[47,9,15],[42,17,15],[19,34,1],[58,12,28],[19,92,1],[27,2,23]],
  /* a casa unida */
  [[21,4,9],[20,17,6],[19,133,1],[54,5,8],[8,1,16],[19,128,3],[51,3,20],[20,31,28],[41,10,9],[46,13,7]],
  /* o Senhor guarda */
  [[19,4,8],[19,121,8],[23,54,17],[19,5,11],[55,4,18],[19,27,5],[19,121,7]]
];

/* Passagens do Novo Testamento que citam o Antigo. A ligação é
   de citação mesmo, não de tema — vale marcar à parte. */
const CITACOES_REF = [
  [[40,4,4],[5,8,3]],   [[40,4,7],[5,6,16]],   [[40,4,10],[5,6,13]],
  [[40,22,37],[5,6,5]], [[40,22,39],[3,19,18]],
  [[45,1,17],[35,2,4]], [[58,10,38],[35,2,4]], [[48,3,11],[35,2,4]],
  [[40,1,23],[23,7,14]],[[42,4,18],[23,61,1]],
  [[40,27,46],[19,22,1]], [[43,19,24],[19,22,18]],
  [[60,2,24],[23,53,5]], [[44,8,32],[23,53,7]],
  [[45,10,13],[29,2,32]], [[44,2,17],[29,2,28]],
  [[58,13,6],[19,118,6]], [[40,21,42],[19,118,22]], [[60,2,7],[19,118,22]],
  [[46,15,54],[23,25,8]], [[66,21,4],[23,25,8]],
  [[45,4,3],[1,15,6]],  [[59,2,23],[1,15,6]]
];

/* Índice: de cada versículo para os que se ligam a ele. Construído
   uma vez, nos dois sentidos. */
const REFS = (() => {
  const mapa = new Map();
  const ligar = (a, b, tipo) => {
    const k = a.join('-');
    if(!mapa.has(k)) mapa.set(k, []);
    const lista = mapa.get(k);
    if(!lista.some(x => x.ref.join('-') === b.join('-'))) lista.push({ ref: b, tipo });
  };
  for(const grupo of GRUPOS_REF)
    for(const a of grupo) for(const b of grupo)
      if(a !== b) ligar(a, b, 'tema');
  for(const [a, b] of CITACOES_REF){ ligar(a, b, 'citacao'); ligar(b, a, 'citacao'); }
  return mapa;
})();

/* As citações vêm primeiro: são ligação direta, não parentesco de assunto. */
function referenciasDe(nr, cap, verso){
  const lista = REFS.get([nr, cap, verso].join('-')) || [];
  return [...lista].sort((a, b) => (a.tipo === 'citacao' ? 0 : 1) - (b.tipo === 'citacao' ? 0 : 1));
}

const PROMESSAS = {
  'Medo e ansiedade':[[23,41,10],[19,56,3],[43,14,27],[50,4,6],[60,5,7],[55,1,7],[19,34,4],[40,6,34],[19,94,19],
    [6,1,9],[19,23,4],[19,27,1],[23,43,1],[5,31,6],[43,16,33],[19,55,22],[23,26,3],[19,118,6]],
  'Força':[[23,40,31],[50,4,13],[19,46,1],[16,8,10],[47,12,9],[49,6,10],[19,18,2],[23,41,13],
    [19,28,7],[19,73,26],[35,3,19],[46,16,13],[49,3,16],[51,1,11],[55,4,17],[19,138,3],[23,12,2],[38,4,6]],
  'Provisão':[[50,4,19],[40,6,33],[19,23,1],[19,37,25],[42,6,38],[39,3,10],[19,34,10],
    [19,84,11],[40,6,26],[47,9,8],[19,145,16],[20,3,10],[1,22,14],[2,16,4],[11,17,14],[19,111,5],[43,6,35],[59,1,17]],
  'Cura e consolo':[[19,147,3],[23,53,5],[24,30,17],[40,11,28],[19,34,18],[66,21,4],[47,1,3],[19,30,2],
    [59,5,16],[19,103,3],[23,61,1],[40,5,4],[19,6,2],[2,15,26],[60,2,24],[19,42,11],[39,4,2],[24,17,14]],
  'Direção':[[20,3,5],[20,3,6],[19,32,8],[19,119,105],[23,30,21],[24,29,11],[20,16,9],
    [19,25,4],[19,37,23],[23,58,11],[59,1,5],[20,16,3],[19,143,8],[43,16,13],[19,48,14],[20,4,11],[23,42,16],[19,139,10]],
  'Perdão':[[62,1,9],[19,103,12],[23,1,18],[45,8,1],[33,7,19],[19,51,10],
    [19,32,1],[40,6,14],[42,6,37],[19,130,4],[44,3,19],[58,8,12],[19,86,5],[23,43,25],[41,11,25],[42,23,34],[14,7,14],[56,3,5]],
  'Fé e esperança':[[58,11,1],[45,8,28],[45,15,13],[25,3,22],[25,3,23],[19,27,14],[23,40,29],[58,10,23],
    [45,5,5],[58,11,6],[60,1,3],[41,9,23],[47,5,7],[19,130,5],[45,12,12],[49,2,8],[19,39,7],[59,1,6]],
  'Gratidão':[[19,100,4],[52,5,18],[19,118,24],[51,3,15],[19,103,2],
    [19,107,1],[51,3,17],[49,5,20],[19,136,1],[13,16,34],[19,9,1],[47,9,15],[19,95,2],[42,17,15],[19,34,1],[58,12,28],[19,92,1],[27,2,23]],
  'Família':[[6,24,15],[20,22,6],[21,4,9],[51,3,13],[49,4,32],
    [19,127,3],[49,6,4],[5,6,7],[20,17,6],[19,133,1],[54,5,8],[8,1,16],[44,16,31],[19,128,3],[51,3,20],[20,31,28],[41,10,9],[46,13,7]],
  'Proteção':[[19,91,1],[19,91,11],[19,121,7],[20,18,10],[53,3,3],[19,4,8],
    [19,121,8],[19,46,7],[23,54,17],[19,32,7],[19,5,11],[20,30,5],[19,91,4],[5,33,27],[19,3,3],[55,4,18],[19,27,5],[34,1,7]]
};

/* TODAS guarda o tema junto com a referência: é o que permite ao devocional
   do dia servir uma reflexão que fala do mesmo assunto do versículo. */
const TODAS = [];
const TEMA_DO_VERSO = [];
/* a posição dentro do tema é a chave do pareamento: é ela que liga o
   versículo aos três textos escritos para ele, em PARES */
const POS_NO_TEMA = [];
for(const [tema, versos] of Object.entries(PROMESSAS)){
  versos.forEach((v, i) => { TODAS.push(v); TEMA_DO_VERSO.push(tema); POS_NO_TEMA.push(i); });
}

/* =========================================================
   DEVOCIONAL POR TEMA
   Antes, reflexão, meditação e oração eram três listas soltas
   sorteadas à parte do versículo — um texto sobre gratidão
   podia vir acompanhado de uma reflexão sobre ansiedade. Aqui
   cada tema tem os seus, e o percurso do dia fala de uma coisa
   só, do começo ao fim.
   ========================================================= */
const DEVOCIONAL = {

'Medo e ansiedade': {
  reflexoes: [
    'O medo mente sobre o tamanho das coisas. Ele aumenta o problema e diminui Deus. Este versículo faz o contrário: devolve cada coisa ao seu tamanho real.',
    'Deus não pede que você deixe de sentir medo. Ele pede que não caminhe sozinho com ele. Há uma diferença entre não ter medo e não estar só.',
    'A ansiedade vive no amanhã. A graça vive no hoje. Por isso é tão cansativo — você está tentando viver um dia que ainda não existe, com forças que só chegam quando ele chegar.',
    'Repare que a Bíblia quase nunca diz "não tenha medo" sem completar com um motivo. Nunca é uma ordem seca: é sempre "não temas, porque Eu…". O que sustenta não é o esforço, é a companhia.',
    'Entregar não é fingir que passou. É dizer em voz alta o que pesa e deixar de carregar sozinho. Deus aguenta ouvir o tamanho real da sua preocupação.',
    'Quem tem medo costuma se sentir fraco na fé. Mas o medo não é ausência de fé — é o lugar onde a fé trabalha. Fé sem nada a temer não precisaria existir.',
    'Há noites em que a única oração possível é ficar quieto. Também isso conta. Deus não exige palavras bonitas de quem está com o coração apertado.',
    'A paz que este texto oferece não é a ausência de tempestade. É alguém com você dentro dela. Repare que a promessa não é de mar calmo, é de presença.'
  ],
  meditacoes: [
    'Que medo específico esta palavra desarma hoje?',
    'O que você está tentando carregar sozinho, e por quê?',
    'De tudo que te preocupa agora, o que é de hoje e o que é de um dia que ainda não chegou?',
    'Diga em voz alta o nome do seu maior medo. Depois leia o versículo de novo, devagar.',
    'Quando você já teve medo antes e Deus te sustentou? Lembre de uma vez.',
    'O que muda no seu dia se você acreditar nesta frase por inteiro?',
    'Que preocupação você poderia entregar agora, mesmo sem sentir alívio imediato?',
    'Transforme este versículo numa frase curta para repetir quando a angústia voltar.'
  ],
  oracoes: [
    'Senhor, Tu conheces o que me aperta o peito e eu nem sei nomear. Fica comigo. Não peço um caminho fácil, peço a Tua companhia nele. Amém.',
    'Pai, onde há medo, planta a Tua paz. Onde há dúvida, fortalece a minha fé. Guia os meus passos neste dia. Amém.',
    'Deus, eu me preocupo com amanhãs que talvez nem cheguem. Ensina-me a viver hoje, com a força de hoje. Amém.',
    'Senhor Jesus, eu entrego a Ti o que pesa em mim. Que a Tua promessa seja mais real do que as minhas preocupações. Amém.',
    'Pai, quando o medo gritar mais alto, faz-me lembrar da Tua voz. Amém.',
    'Deus, eu não consigo parar de pensar nisso sozinho. Toma conta do que eu não consigo soltar. Amém.',
    'Senhor, dá-me esta noite de sono e amanhã a coragem que hoje me falta. Amém.',
    'Pai, obrigado por não te assustares com o tamanho do meu medo. Segura-me firme. Amém.'
  ]
},

'Força': {
  reflexoes: [
    'A força de Deus não compete com a nossa fraqueza: ela a preenche. Onde você se sente pequeno, há espaço para a graça agir.',
    'Há um tipo de força que não parece força: é continuar. Levantar de novo, fazer de novo, esperar de novo. Esta é a que a Bíblia mais elogia.',
    'Repare que a promessa não é de nunca cansar. É de ser renovado. O cansaço não é sinal de que você falhou — é sinal de que você é gente.',
    'Deus costuma dar força para o próximo passo, não para o caminho inteiro de uma vez. Se você olhou o caminho todo e sentiu que não dá, é porque não era para olhar tudo agora.',
    'A pessoa forte da Bíblia não é a que nunca chorou. É a que chorou e continuou. Davi escreveu salmos desesperados e ainda assim são chamados de canções.',
    'Quando a força vem de dentro, ela acaba. Quando vem de Deus, ela é reposta. Por isso vale mais aprender a receber do que a aguentar.',
    'Você não precisa se sentir forte para ser sustentado. O apoio não depende de você reconhecê-lo no momento em que ele age.',
    'Há dias em que a vitória é apenas ter atravessado o dia. Não desqualifique isso. Deus não desqualifica.'
  ],
  meditacoes: [
    'Onde você está tentando ser forte por conta própria?',
    'Que peso você está carregando que nunca foi seu para carregar?',
    'O que seria "o próximo passo" hoje — só ele, sem o caminho todo?',
    'Em que área da sua vida você já não tem forças? Diga isso a Deus com essas palavras mesmo.',
    'Lembre de uma vez em que você achou que não daria conta — e deu. Quem te sustentou?',
    'O que você precisa parar de fazer para ter força para o que importa?',
    'Se a sua fraqueza é o lugar onde a graça age, que fraqueza você poderia parar de esconder?',
    'Guarde uma frase deste versículo de cor. Repita quando quiser desistir.'
  ],
  oracoes: [
    'Senhor, a minha força acabou antes do meu dia. Renova o que em mim se gastou. Amém.',
    'Pai, ensina-me a diferença entre desistir e descansar. Amém.',
    'Deus, dá-me força para o próximo passo. Só ele. Confio-Te o resto do caminho. Amém.',
    'Senhor, onde eu sou fraco, sê Tu forte por mim. Não tenho vergonha de precisar. Amém.',
    'Pai, obrigado por me sustentares mesmo nos dias em que eu nem percebi. Amém.',
    'Deus, tira de mim o peso que nunca foi meu para levar. Amém.',
    'Senhor, quero continuar. Dá-me hoje o suficiente para continuar. Amém.',
    'Pai celestial, faz da minha fraqueza um lugar onde a Tua graça caiba. Amém.'
  ]
},

'Provisão': {
  reflexoes: [
    'Deus provê, mas quase nunca com antecedência confortável. O maná caía de manhã, para o dia. Isso não é descuido: é um convite a caminhar junto, um dia de cada vez.',
    'Há diferença entre o que precisamos e o que queremos, e a maior parte da nossa angústia mora nessa distância. Este texto fala do primeiro.',
    'Provisão nem sempre chega como dinheiro. Às vezes chega como alguém que aparece, uma porta que fecha na hora certa, uma força que você não sabia que tinha.',
    'Confiar não substitui o trabalho — acompanha. A fé não é preguiça santificada; é fazer a sua parte sem carregar o peso do que não te cabe.',
    'A viúva tinha um punhado de farinha. Deus não multiplicou o que ela guardou, multiplicou o que ela repartiu. Há uma lógica aqui que o medo não entende.',
    'Quem já passou necessidade sabe: o mais difícil não é a falta, é o não saber. Este versículo não promete abundância — promete que você não está esquecido.',
    'Deus alimenta os pássaros, mas não põe comida no ninho. Ele provê o mundo onde há o que buscar. Isso muda o que significa esperar nEle.',
    'Gratidão pelo que já veio é a melhor preparação para o que ainda falta. Quem lembra do que recebeu tem menos medo do que virá.'
  ],
  meditacoes: [
    'O que você realmente precisa hoje — e o que só parece necessidade?',
    'Como Deus já proveu para você de um jeito que você não esperava?',
    'Que parte disso é sua para fazer, e que parte você precisa soltar?',
    'Se o suficiente chegasse só para hoje, isso bastaria? Por quê?',
    'A quem você poderia repartir algo do pouco que tem?',
    'Faça uma lista mental de três coisas que você tem hoje e não tinha há um ano.',
    'O que o medo da falta está te fazendo guardar demais?',
    'Transforme este versículo em uma oração de uma frase.'
  ],
  oracoes: [
    'Senhor, dá-me hoje o pão de hoje. Ensina-me a confiar amanhã de novo. Amém.',
    'Pai, tira de mim a angústia do que ainda não chegou. Obrigado pelo que já está aqui. Amém.',
    'Deus, ensina-me a diferença entre precisar e querer. Amém.',
    'Senhor, eu faço a minha parte e Te entrego o resultado. Amém.',
    'Pai, onde falta, sustenta. Onde sobra, ensina-me a repartir. Amém.',
    'Deus, obrigado pelas provisões que eu nem percebi que vieram de Ti. Amém.',
    'Senhor, quando eu não souber como será, faz-me lembrar de como foi. Amém.',
    'Pai bondoso, agradeço pela Tua fidelidade. Ensina-me a descansar naquilo que Tu já garantiste. Amém.'
  ]
},

'Cura e consolo': {
  reflexoes: [
    'Consolo não é fuga da realidade — é a presença de Deus dentro dela. Deixe esta palavra tocar o lugar que dói, sem pressa de melhorar.',
    'Nem toda cura é imediata e nem toda cura é do corpo. Há feridas que Deus fecha e há feridas que Ele acompanha. As duas coisas são cuidado.',
    'Jesus chorou diante de um túmulo que Ele mesmo ia abrir. Deus não acha a nossa dor exagerada, mesmo sabendo o fim da história.',
    'Você não precisa estar bem para se aproximar. Aliás, é justamente quando não está que este convite faz sentido.',
    'A pressa em superar é uma forma de fugir. O luto tem tempo próprio, e Deus não apressa quem Ele carrega.',
    'Há dores que não têm nome. Deus entende também as que você não consegue explicar para ninguém.',
    'Quem já foi consolado consola diferente. A sua dor, um dia, vai caber nas mãos de outra pessoa como remédio.',
    'A promessa não é de uma vida sem lágrimas. É de que elas serão enxugadas — uma por uma, por alguém que conhece cada uma delas.'
  ],
  meditacoes: [
    'Que ferida você está tentando esconder até de Deus?',
    'Do que você precisa hoje: de solução ou de companhia?',
    'Que dor sua já virou capacidade de entender outra pessoa?',
    'A quem você poderia dizer hoje "eu sei como é"?',
    'Você está se cobrando por não ter superado ainda? Diga isso a Deus.',
    'Leia o versículo de novo, devagar. Que palavra ficou pesando?',
    'O que seria descansar hoje, de verdade?',
    'Guarde uma frase deste texto para os momentos em que a dor voltar.'
  ],
  oracoes: [
    'Deus de consolo, toca as feridas que eu nem sempre sei nomear. Que a Tua presença seja suficiente hoje. Amém.',
    'Senhor, eu não venho arrumado. Venho como estou. Recebe-me assim. Amém.',
    'Pai, cura o que puder ser curado e sustenta o que ainda vai doer um tempo. Amém.',
    'Jesus, Tu choraste. Obrigado por não achares a minha dor pequena demais nem grande demais. Amém.',
    'Senhor, dá-me paciência comigo mesmo enquanto sararo. Amém.',
    'Deus, usa o que me machucou para que eu saiba cuidar de alguém. Amém.',
    'Pai, esta noite eu só preciso descansar. Fica comigo. Amém.',
    'Senhor, enxuga hoje uma das minhas lágrimas. Só uma já basta para eu seguir. Amém.'
  ]
},

'Direção': {
  reflexoes: [
    'A direção de Deus raramente chega como mapa completo. Costuma ser a próxima luz no caminho. Este versículo pode ser essa luz hoje.',
    'Uma lâmpada aos pés ilumina um passo. Não é pouco: é exatamente o que se precisa para não tropeçar. Querer ver o fim do caminho é querer outra coisa que não confiança.',
    'Muitas vezes queremos a resposta antes de confiar. Este texto lembra que a segurança não está no controle, mas em quem nos segura.',
    'Deus dirige mais pelo caráter que Ele forma em nós do que por sinais no céu. A pergunta "que caminho?" às vezes é menos útil que "que tipo de pessoa devo ser aqui?".',
    'Há decisões em que nenhuma opção é errada, e a angústia vem de acreditar que existe uma única resposta certa escondida. Deus caminha com quem escolhe de coração honesto.',
    'Pedir sabedoria é permitido. A Bíblia diz que Deus dá sem tirar sarro de quem pergunta. Você não precisa fingir que já sabe.',
    'O caminho de Deus quase nunca é o mais curto. Israel foi pelo deserto por um motivo. O trajeto também faz parte do que Ele quer te dar.',
    'Se você está parado sem saber para onde ir, talvez o próximo passo não seja escolher — seja esperar. Esperar também é obedecer.'
  ],
  meditacoes: [
    'Que decisão está te tirando o sono?',
    'Você está pedindo direção ou pedindo confirmação do que já decidiu?',
    'Qual é o próximo passo — não o plano inteiro, só o próximo?',
    'Que tipo de pessoa você quer ser nessa situação, independente do caminho?',
    'O que muda se, em vez de saber tudo, você só precisar dar um passo?',
    'Que conselho você já recebeu e ainda não seguiu?',
    'Se Deus te dissesse "espere", você conseguiria?',
    'Transforme este versículo numa oração pedindo sabedoria pelo dia de hoje.'
  ],
  oracoes: [
    'Senhor, não me mostres o caminho todo. Mostra-me o próximo passo e dá-me coragem para dá-lo. Amém.',
    'Pai, dá-me olhos para ver a Tua mão e ouvidos para ouvir a Tua voz no meio do barulho. Amém.',
    'Deus, eu não sei o que fazer. Ensina-me a esperar sem me desesperar. Amém.',
    'Senhor, dá-me sabedoria, porque prometeste dar a quem pede. Estou pedindo. Amém.',
    'Pai, quero mais a Tua vontade do que a minha certeza. Amém.',
    'Deus, se for para parar, dá-me paz para parar. Se for para andar, dá-me firmeza. Amém.',
    'Senhor, guarda-me de decidir por medo. Que eu decida por confiança. Amém.',
    'Espírito Santo, ilumina este texto no meu interior. Que ele se torne oração, atitude e esperança ao longo do dia. Amém.'
  ]
},

'Perdão': {
  reflexoes: [
    'Perdão não é dizer que não doeu. É deixar de cobrar uma dívida que talvez nunca seja paga. Custa caro — e é por isso que Deus sabe do que está falando.',
    'Muita gente carrega culpa por algo que Deus já esqueceu. Se Ele apagou, continuar cobrando de si mesmo não é humildade: é não acreditar no que Ele disse.',
    'Perdoar não obriga a confiar de novo, nem a voltar. São coisas diferentes. Perdão é soltar o peso; confiança se reconstrói com tempo e com provas.',
    'A dificuldade de perdoar os outros costuma ter a ver com a dificuldade de acreditar que fomos perdoados. Quem recebeu muito perdoa mais fácil.',
    'Guardar mágoa é beber veneno esperando que o outro adoeça. Você é quem acorda com isso todo dia.',
    'Confessar não é informar a Deus algo que Ele não sabia. É parar de fingir. O alívio começa aí.',
    'Jesus perdoou de dentro da cruz, antes de qualquer pedido de desculpa. Isso mostra que o perdão nasce de quem perdoa, não do arrependimento do outro.',
    'Se você errou com alguém, o versículo de hoje não é só conforto — é chamado. Há telefonemas que são oração.'
  ],
  meditacoes: [
    'De quem você ainda está cobrando uma dívida?',
    'Que culpa você carrega que Deus já apagou?',
    'Perdoar essa pessoa mudaria o quê no seu dia?',
    'Existe alguém a quem você precisa pedir perdão? O que te impede?',
    'Qual a diferença, no seu caso, entre perdoar e voltar a confiar?',
    'Fale a Deus, com todas as palavras, o que você fez ou o que te fizeram.',
    'O que você ganharia em soltar isso hoje?',
    'Guarde uma frase deste versículo para quando a mágoa voltar a falar.'
  ],
  oracoes: [
    'Senhor, eu não consigo perdoar sozinho. Começa em mim o que eu não consigo começar. Amém.',
    'Pai, obrigado por não me tratares conforme os meus erros. Ajuda-me a tratar assim quem me feriu. Amém.',
    'Deus, eu confesso o que Tu já sabes. Não quero mais fingir. Amém.',
    'Senhor, tira de mim a culpa que Tu já perdoaste. Ensina-me a acreditar no Teu perdão. Amém.',
    'Pai, se eu feri alguém, dá-me coragem para procurar essa pessoa. Amém.',
    'Deus, esvazia o meu coração da mágoa que já ocupou espaço demais. Amém.',
    'Jesus, Tu perdoaste de dentro da dor. Ensina-me esse caminho. Amém.',
    'Senhor, cria em mim um coração limpo e renova em mim um espírito firme. Amém.'
  ]
},

'Fé e esperança': {
  reflexoes: [
    'A fé não elimina as perguntas; ela nos dá companhia enquanto caminhamos com elas. Leve este versículo como companheiro, não como regra fria.',
    'Esperança bíblica não é otimismo. Otimismo aposta que vai dar certo; esperança confia em quem sustenta, inclusive quando não dá.',
    'Fé pequena em um Deus grande vale mais do que fé grande em nada. Jesus elogiou fé do tamanho de uma semente.',
    'Duvidar não é o contrário de crer. O contrário de crer é a indiferença. Quem duvida ainda está lidando com Deus.',
    'A Bíblia não foi escrita para heróis perfeitos, mas para pessoas reais. Este versículo fala com a sua humanidade, não contra ela.',
    'Há promessas que só florescem quando paramos de correr. Hoje, permita-se ouvir sem pressa o que Deus já disse.',
    'Esperar em Deus não é ficar parado achando bonito. É continuar fazendo o que se deve, sem saber ainda como termina.',
    'Cada promessa de Deus carrega o peso da fidelidade dEle. Você não precisa merecer o que já foi dado em amor.'
  ],
  meditacoes: [
    'Que promessa há aqui que você ainda não tomou como sua?',
    'Em que você está esperando neste momento da sua vida?',
    'Que dúvida você tem vergonha de levar a Deus? Leve hoje.',
    'Se você acreditasse nisso por inteiro hoje, o que faria diferente?',
    'Onde você já viu Deus cumprir algo na sua história?',
    'O que a sua esperança está apoiada: no resultado ou em quem sustenta?',
    'O que muda no seu dia se você levar isso a sério até de noite?',
    'A quem você poderia levar essa palavra hoje?'
  ],
  oracoes: [
    'Senhor, abre o meu coração para receber o que queres dizer hoje. Ensina-me a confiar mais do que a controlar. Amém.',
    'Pai, eu creio; ajuda a minha incredulidade. Amém.',
    'Deus, quando eu não entender, ensina-me a confiar mesmo assim. Amém.',
    'Senhor, que esta promessa não fique só na mente — que desça ao coração e se torne vida. Amém.',
    'Pai, eu espero em Ti. Sustenta-me enquanto espero. Amém.',
    'Jesus, Tu és a palavra viva. Ajuda-me a seguir-Te com confiança, um passo de cada vez. Amém.',
    'Deus de toda graça, obrigado por falares comigo. Ajuda-me a viver esta palavra com simplicidade e coragem. Amém.',
    'Senhor, guarda a minha esperança de virar só expectativa. Que ela se apoie em Ti. Amém.'
  ]
},

'Gratidão': {
  reflexoes: [
    'Gratidão não é fingir que está tudo bem. É reparar no que é bom sem esperar que o resto se resolva primeiro.',
    'Agradecer muda quem agradece antes de mudar qualquer circunstância. É por isso que a Bíblia insiste tanto nisso — não é para Deus se sentir bem.',
    'Dos dez curados, um voltou. A cura foi para os dez; o encontro foi só para quem voltou. Há coisas que só recebe quem agradece.',
    'A memória curta é a raiz da murmuração. Israel reclamava no deserto lembrando do Egito e esquecendo do mar aberto.',
    'Agradecer em tudo não é agradecer por tudo. Nem toda coisa é boa; mas em toda coisa há algo a reconhecer.',
    'Quem agradece pelo pouco costuma reparar mais no que vem. A gratidão treina os olhos.',
    'Reclamar é fácil porque a falta grita e a bênção sussurra. Gratidão é o esforço de ouvir o que sussurra.',
    'Deus não desperdiça palavras. Se este texto chegou até você hoje, há algo nele que o seu coração precisa reconhecer.'
  ],
  meditacoes: [
    'Cite três coisas boas de hoje, mesmo que pequenas.',
    'Por quem você é grato e nunca disse isso a essa pessoa?',
    'O que você tem hoje que já pediu muito um dia?',
    'Que bênção virou rotina e você parou de notar?',
    'O que este versículo diz sobre quem Deus é?',
    'A quem você poderia agradecer hoje, em voz alta?',
    'Do que você reclamou nesta semana que, olhando bem, é privilégio?',
    'Transforme este versículo em uma oração de agradecimento de uma frase.'
  ],
  oracoes: [
    'Senhor, obrigado. Simplesmente obrigado, por hoje. Amém.',
    'Pai, ensina-me a reparar no bom antes que ele passe. Amém.',
    'Deus, obrigado pelo que eu já nem percebo de tão acostumado. Amém.',
    'Senhor, obrigado pelas orações que Tu respondeste com um não. Amém.',
    'Pai celestial, recebe a minha gratidão e as minhas perguntas. Em tudo, seja feita a Tua vontade. Amém.',
    'Deus, dá-me memória para lembrar do que já fizeste quando eu duvidar do que farás. Amém.',
    'Senhor, faz da gratidão o meu primeiro pensamento e não o último. Amém.',
    'Pai, obrigado por hoje ter sido possível. Amém.'
  ]
},

'Família': {
  reflexoes: [
    'A família da Bíblia não é modelo de perfeição: é gente que erra, se magoa e volta. Deus trabalha dentro do que é real, não do que é ideal.',
    'Ensinar em casa é menos discurso e mais convivência. As crianças aprendem o que veem repetido, não o que ouvem uma vez.',
    'Amar quem mora com você é mais difícil do que amar de longe, porque de perto ninguém consegue disfarçar. É também onde o amor é mais verdadeiro.',
    'Há famílias que a gente recebe e famílias que a gente escolhe. Rute escolheu, e virou parte da história de Jesus.',
    'Suportar uns aos outros é uma expressão pouco romântica e muito honesta. Amor duradouro tem uma parte grande de paciência.',
    'Sua casa é o primeiro lugar onde a sua fé é testada — e o único onde ninguém acredita na versão editada.',
    'Cuidar dos seus não é menos espiritual do que cuidar de estranhos. A Bíblia trata isso como coisa séria.',
    'Nem toda família é lugar seguro, e a Bíblia não pede que se finja o contrário. Deus também é Pai de quem não teve um.'
  ],
  meditacoes: [
    'Com quem da sua casa você precisa ter uma conversa?',
    'O que a sua família vê em você que você não fala?',
    'A quem da sua família você poderia ligar hoje?',
    'Onde você tem sido mais paciente com estranhos do que com os seus?',
    'Que padrão da sua família de origem você quer interromper?',
    'Pelo que você é grato na sua casa hoje?',
    'O que você poderia perdoar dentro de casa nesta semana?',
    'Ore pelo nome de cada pessoa da sua família, uma por uma.'
  ],
  oracoes: [
    'Senhor, abençoa cada pessoa da minha casa hoje, uma por uma. Amém.',
    'Pai, ensina-me a ter em casa a paciência que eu tenho com estranhos. Amém.',
    'Deus, cura o que se rompeu na minha família. Onde não puder ser restaurado, dá-me paz. Amém.',
    'Senhor, que a minha vida ensine mais do que as minhas palavras. Amém.',
    'Pai, obrigado pelas pessoas que Tu me deste para amar de perto. Amém.',
    'Deus, guarda os que eu amo quando eu não puder estar por perto. Amém.',
    'Senhor, quebra em mim o que eu não quero passar adiante. Amém.',
    'Pai, sê Tu a casa de quem não teve uma. Amém.'
  ]
},

'Proteção': {
  reflexoes: [
    'Proteção na Bíblia não significa vida sem perigo. Significa que o perigo não tem a última palavra. Daniel foi guardado dentro da cova, não longe dela.',
    'Deus é chamado de refúgio, não de muro. Refúgio é lugar para onde se corre — implica movimento da nossa parte.',
    'Há um cuidado que se percebe e um cuidado que só se descobre depois. Boa parte do que Deus evitou, você nunca vai saber.',
    'Estar sob a sombra do Altíssimo é uma imagem de proximidade, não de blindagem. Sombra só existe quando se está muito perto.',
    'A promessa é de que Ele guarda a sua saída e a sua entrada — o começo e o fim de cada coisa, inclusive o que acontece no meio.',
    'Quem se sente frágil costuma se sentir esquecido. Este texto diz o contrário: você é olhado de perto justamente porque é frágil.',
    'Dormir em paz é um ato de fé. Você entrega o controle por oito horas todos os dias. Deus continua acordado.',
    'Ser guardado não quer dizer não sofrer. Quer dizer não se perder — e há uma diferença enorme entre as duas coisas.'
  ],
  meditacoes: [
    'De que você tem pedido para ser guardado?',
    'De que perigo Deus já te livrou sem você perceber na hora?',
    'O que te tira o sono? Entregue isso antes de deitar.',
    'Você corre para Deus como refúgio ou como último recurso?',
    'Por quem você poderia orar hoje pedindo proteção?',
    'O que significa, no seu caso, "ser guardado" e não "não sofrer"?',
    'Onde você se sente exposto agora?',
    'Guarde uma frase deste versículo para dizer ao deitar.'
  ],
  oracoes: [
    'Senhor, guarda a minha saída e a minha entrada, hoje e sempre. Amém.',
    'Pai, guarda quem eu amo, mesmo longe dos meus olhos. Amém.',
    'Deus, esta noite eu entrego o controle. Faz-me dormir em paz. Amém.',
    'Senhor, sê o meu refúgio — e dá-me pressa para correr para Ti. Amém.',
    'Pai, obrigado pelos perigos de que me livraste e eu nunca soube. Amém.',
    'Deus, onde eu me sinto exposto, cobre-me. Amém.',
    'Senhor, se eu tiver de passar por isso, passa comigo. Amém.',
    'Pai, guarda-me de me perder, mesmo que eu não seja poupado da dificuldade. Amém.'
  ]
}

};

/* =========================================================
   O TEXTO PRESO AO VERSÍCULO

   Reflexão, meditação e oração eram escolhidas por rotação de
   calendário: `giro % 8`, independente de qual versículo era o do dia.
   Três consequências, todas visíveis na tela:

   1. O texto falava do TEMA, não da passagem. O mesmo versículo recebia
      a reflexão nº 7 num semestre e a nº 4 no outro.
   2. As três listas não são paralelas entre si. A oração "Jesus, Tu
      choraste" (índice 3) aparecia ao lado de uma reflexão que não
      menciona isso, enquanto a reflexão sobre Jesus chorando (índice 2)
      saía com outra oração. As peças que combinam estavam espalhadas.
   3. Oito reflexões citam uma cena concreta — Jesus na cruz, Rute
      escolhendo, os dez curados, o maná, a viúva da farinha — e nenhuma
      caía junto do versículo daquela cena, embora vários deles estejam
      na lista.

   Aqui cada versículo tem os três índices que lhe cabem: [reflexão,
   meditação, oração]. A posição no vetor é a posição do versículo
   dentro do tema, em PROMESSAS.

   O preço: o devocional de um versículo passa a ser sempre o mesmo.
   Trocou-se variedade por coerência, que é o que se pediu.
   ========================================================= */
const PARES = {
  'Medo e ansiedade': [
    [3,0,0],[5,0,1],[7,5,3],[4,3,3],[4,6,5],[5,5,4],[0,4,4],[2,2,2],[6,1,5],
    [3,5,1],[1,1,0],[0,0,4],[3,7,7],[1,4,0],[7,5,3],[4,6,5],[2,7,2],[0,5,7]
  ],
  'Força': [
    [2,3,0],[0,0,3],[6,4,4],[7,5,6],[0,6,7],[5,0,3],[6,4,4],[3,2,2],[5,3,3],
    [1,3,6],[3,2,2],[1,7,6],[5,5,0],[7,1,1],[6,4,4],[4,4,4],[2,7,0],[5,1,5]
  ],
  'Provisão': [
    [1,0,2],[3,2,3],[5,3,1],[5,5,5],[4,4,4],[4,6,4],[6,0,0],[1,0,1],[6,6,1],
    [2,1,5],[7,5,7],[7,5,7],[0,1,6],[0,3,0],[4,4,4],[5,5,5],[2,0,2],[7,5,7]
  ],
  'Cura e consolo': [
    [1,0,0],[6,2,5],[1,1,2],[3,1,1],[0,0,0],[7,7,7],[6,2,5],[1,5,2],[6,3,5],
    [1,1,2],[0,0,0],[2,4,3],[5,5,4],[1,1,2],[6,2,5],[4,4,4],[7,6,6],[5,5,2]
  ],
  'Direção': [
    [2,1,4],[3,3,4],[0,2,0],[1,2,0],[0,4,1],[6,6,2],[4,0,4],[5,7,3],[3,2,0],
    [0,4,1],[5,7,3],[4,3,4],[7,6,2],[3,5,7],[2,0,1],[3,5,3],[0,4,0],[2,3,6]
  ],
  'Perdão': [
    [5,5,2],[1,1,3],[1,1,3],[1,1,3],[1,6,3],[5,5,7],[1,1,3],[3,2,1],[3,0,0],
    [0,6,3],[7,3,4],[1,1,3],[0,0,0],[1,1,3],[4,6,5],[6,2,6],[7,3,4],[0,4,0]
  ],
  'Fé e esperança': [
    [1,0,0],[1,4,2],[7,5,3],[7,4,6],[4,4,6],[6,1,4],[4,6,5],[7,0,7],[1,5,7],
    [3,2,1],[7,4,3],[2,2,1],[0,2,2],[6,1,4],[6,6,4],[7,0,6],[5,5,7],[3,2,1]
  ],
  'Gratidão': [
    [1,0,0],[4,6,4],[0,0,7],[1,3,6],[3,3,2],[5,4,0],[1,5,6],[4,6,4],[5,4,5],
    [5,4,5],[3,2,5],[7,4,0],[0,0,0],[2,1,1],[6,6,6],[7,7,6],[6,7,0],[5,2,5]
  ],
  'Família': [
    [5,0,0],[1,4,3],[2,2,4],[4,3,1],[4,6,2],[0,5,4],[7,4,6],[1,1,3],[0,5,4],
    [2,2,0],[6,2,5],[3,5,4],[5,7,0],[0,5,4],[1,0,3],[0,1,4],[4,0,2],[4,3,1]
  ],
  'Proteção': [
    [3,3,3],[2,1,4],[7,5,7],[1,3,3],[5,0,5],[6,2,2],[4,0,0],[0,6,6],[0,0,6],
    [3,6,5],[5,4,1],[1,3,3],[3,6,5],[5,6,6],[0,0,6],[2,1,4],[0,2,2],[7,5,6]
  ]
};

/* Compatibilidade: o restante do app ainda pede uma lista solta em alguns
   pontos genéricos, e a folha do dia usa as do tema. */
const REFLEXOES  = Object.values(DEVOCIONAL).flatMap(d => d.reflexoes);
const MEDITACOES = Object.values(DEVOCIONAL).flatMap(d => d.meditacoes);
const ORACOES    = Object.values(DEVOCIONAL).flatMap(d => d.oracoes);

/* Monta o devocional de um dia: o versículo escolhe o tema, e o tema
   escolhe os três textos. Determinístico pelo dia do ano — o histórico
   precisa reencontrar exatamente o que foi mostrado. */
function devocionalDoDia(dia){
  const idx  = dia % TODAS.length;
  const [nr, cap, verso] = TODAS[idx];
  const tema = TEMA_DO_VERSO[idx];
  const d    = DEVOCIONAL[tema];
  /* Os três textos vêm do pareamento, não do calendário. Sem par
     definido — tema novo, versículo acrescentado — cai na rotação
     antiga, que serve qualquer coisa do tema e nunca fica sem texto. */
  const par = (PARES[tema] || [])[POS_NO_TEMA[idx]];
  const giro = dia + Math.floor(dia / TODAS.length);
  const escolher = (lista, i) =>
    lista[(typeof i === 'number' ? i : giro) % lista.length];
  return {
    nr, cap, verso, tema,
    reflexao:  escolher(d.reflexoes,  par && par[0]),
    meditacao: escolher(d.meditacoes, par && par[1]),
    oracao:    escolher(d.oracoes,    par && par[2])
  };
}

/* ---------- favoritos (localStorage) ---------- */
const CHAVE_FAVS = 'lampada-favoritos';
function carregarFavs(){
  try { return JSON.parse(localStorage.getItem(CHAVE_FAVS) || '[]'); }
  catch { return []; }
}
function salvarFavs(lista){
  localStorage.setItem(CHAVE_FAVS, JSON.stringify(lista));
  Conta.marcarSujo();
}
function chaveVerso(nr, cap, verso){ return nr + ':' + cap + ':' + verso; }
function estaFavorito(nr, cap, verso){
  return carregarFavs().some(f => f.chave === chaveVerso(nr, cap, verso));
}
function alternarFavorito(dados){
  let lista = carregarFavs();
  const k = chaveVerso(dados.nr, dados.cap, dados.verso);
  const idx = lista.findIndex(f => f.chave === k);
  if(idx >= 0){
    lista.splice(idx, 1);
    salvarFavs(lista);
    avisar('Removido dos favoritos');
    renderFavoritos();
    return false;
  }
  lista.unshift({
    chave: k,
    nr: dados.nr, cap: dados.cap, verso: dados.verso,
    texto: dados.texto, versao: dados.versao,
    ref: dados.ref,
    data: new Date().toISOString(),
    nota: ''
  });
  salvarFavs(lista);
  avisar('Salvo nos favoritos');
  renderFavoritos();
  atualizarStats();
  return true;
}
function removerFav(chave){
  const antes = carregarFavs();
  salvarFavs(antes.filter(f => f.chave !== chave));
  renderFavoritos();
  atualizarStats();
  atualizarBotoesDoVerso();
  avisar('Removido', {
    aoTocar: () => { salvarFavs(antes); renderFavoritos(); atualizarStats(); atualizarBotoesDoVerso(); }
  });
}
/* O botão da folha mostra o estado do favorito. Se a lista muda por baixo
   dela — remoção, desfazer — ele precisa acompanhar, senão fica dizendo
   "★ Favorito" para um versículo que já não está lá. */
function atualizarBotoesDoVerso(){
  if(!versoAberto) return;
  const { nr, cap, verso } = versoAberto;
  const fav = estaFavorito(nr, cap, verso);
  const b = $('fa-fav');
  if(!b) return;
  pintarFavNaFolha(fav);
  atualizarVersoNaTela();
}

/* =========================================================
   O RÓTULO TROCA, O ÍCONE FICA

   Estes botões eram texto puro ("☆ Favoritar"), e quatro pontos do app
   trocavam o estado escrevendo por cima com textContent. Agora que o
   ícone é um <svg> irmão do rótulo, escrever no botão inteiro apagaria
   o desenho. Só o <span> muda.
   ========================================================= */
function rotularBotaoDaFolha(id, texto, ativo, dica){
  const b = $(id);
  if(!b) return;
  const alvo = b.querySelector('span') || b;
  alvo.textContent = texto;
  b.classList.toggle('ativo', !!ativo);
  if(dica) b.setAttribute('aria-label', dica);
  else b.removeAttribute('aria-label');
}
function pintarFavNaFolha(fav){
  rotularBotaoDaFolha('fa-fav', fav ? 'Favorito' : 'Favoritar', fav,
    fav ? 'Tirar dos favoritos' : 'Guardar nos favoritos');
}
function pintarNotaNaFolha(temNota){
  rotularBotaoDaFolha('fa-nota', temNota ? 'Editar nota' : 'Nota', temNota,
    temNota ? 'Editar a nota deste versículo' : 'Escrever uma nota neste versículo');
}

const $ = id => document.getElementById(id);
const norm = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let versaoAtual = VERSOES[0];
const cache = new Map();

/* =========================================================
   AVISO, COM SAÍDA DE EMERGÊNCIA

   Remover um pedido de oração, um favorito ou uma nota era
   instantâneo e definitivo — a palavra "Desfazer" não existia em
   lugar nenhum do app. Erro de toque acontece, e o remédio padrão é
   o desfazer no próprio aviso.

   Quando há ação, o aviso fica 6 segundos em vez de 2,4: é o tempo
   de ler, entender que errou e alcançar o botão. E ele precisa
   receber toque, então `pointer-events` volta a valer — no aviso
   comum continua desligado, para não bloquear a tela por baixo.
   ========================================================= */
function avisar(msg, acao){
  const a = $('aviso');
  a.textContent = '';
  a.classList.toggle('com-acao', !!acao);

  const txt = document.createElement('span');
  txt.textContent = msg;
  a.appendChild(txt);

  clearTimeout(a._t);

  if(acao){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aviso-acao';
    b.textContent = acao.rotulo || 'Desfazer';
    b.onclick = () => {
      clearTimeout(a._t);
      a.classList.remove('ver', 'com-acao');
      try { acao.aoTocar(); } catch(e) { console.info(e); }
    };
    a.appendChild(b);
  }

  a.classList.add('ver');
  a._t = setTimeout(() => a.classList.remove('ver', 'com-acao'), acao ? 6000 : 2400);
}

function diaDoAno(d){
  return Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000);
}
function livroPorNr(nr){ return LIVROS.find(l => l.nr === nr); }

/* =========================================================
   LEITURA EM VOZ — acessibilidade para quem não lê
   ========================================================= */

/* Nomes dos livros numerados ditos por extenso.
   Sem isso o sintetizador lê "1 João" como "um João". */
const NOMES_FALADOS = {
  '1 Samuel': 'Primeiro Samuel', '2 Samuel': 'Segundo Samuel',
  '1 Reis': 'Primeiro Reis', '2 Reis': 'Segundo Reis',
  '1 Crônicas': 'Primeiro Crônicas', '2 Crônicas': 'Segundo Crônicas',
  '1 Coríntios': 'Primeira aos Coríntios', '2 Coríntios': 'Segunda aos Coríntios',
  '1 Tessalonicenses': 'Primeira aos Tessalonicenses',
  '2 Tessalonicenses': 'Segunda aos Tessalonicenses',
  '1 Timóteo': 'Primeira a Timóteo', '2 Timóteo': 'Segunda a Timóteo',
  '1 Pedro': 'Primeira de Pedro', '2 Pedro': 'Segunda de Pedro',
  '1 João': 'Primeira de João', '2 João': 'Segunda de João', '3 João': 'Terceira de João'
};
function nomeFalado(nome){ return NOMES_FALADOS[nome] || nome; }

function refFalada(nr, cap, verso){
  const l = livroPorNr(nr);
  if(!l) return '';
  let s = nomeFalado(l.nome) + ', capítulo ' + cap;
  if(verso) s += ', versículo ' + verso;
  return s;
}

const Voz = (function(){
  const suporta = 'speechSynthesis' in window;
  const CHAVE = 'lampada-voz-prefs';
  const PADRAO = { voz: '', vel: 1, num: false, autoCap: false, modo: false };

  const prefs = Object.assign({}, PADRAO, (() => {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); }
    catch { return {}; }
  })());

  function salvar(){
    try { localStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch {}
  }

  let listaVozes = [];
  let vozAtual = null;
  let partes = [];        // blocos lógicos: {texto, rotulo, el}
  let trechos = [];       // pedaços curtos: {texto, parte}
  let idx = 0;
  let parteAtual = -1;
  let estado = 'parado';  // parado | tocando | pausado
  let titulo = '';
  let aoTerminar = null;
  let aoTrocarParte = null;
  let ignorarFim = false;
  /* a troca de emergência de voz vale uma vez por leitura, senão duas
     vozes quebradas mandariam falarAtual chamar a si mesmo sem fim */
  let trocouVozPorFalha = false;
  let watchdog = null;
  let elDestacado = null;
  let botaoAtivo = null;

  /* ---------- vozes disponíveis ---------- */
  function recarregarVozes(){
    if(!suporta) return;
    const todas = speechSynthesis.getVoices() || [];
    const pt = todas.filter(v => /^pt/i.test(v.lang));
    listaVozes = pt.length ? pt : todas;
    vozAtual = listaVozes.find(v => v.voiceURI === prefs.voz)
            || listaVozes.find(v => v.name === prefs.voz)
            || melhorVoz();
    document.dispatchEvent(new CustomEvent('vozes-prontas'));
  }

  /* =========================================================
     QUAL VOZ USAR

     Antes era o primeiro nome da lista que casasse: bastava haver
     uma "Google" qualquer para ela ganhar de uma "Luciana (Premium)",
     porque "google" vinha antes na fila. Agora cada sinal vale pontos
     e a voz soma — assim quem junta dois sinais passa na frente.

     "Premium" e "Enhanced" faltavam, e são justamente os nomes que o
     iPhone dá à voz boa que a pessoa baixou de propósito. O iOS ainda
     traduz esse nome para o idioma do aparelho, daí "aprimorad" e
     "melhorad" também entrarem.
     ========================================================= */
  const SINAIS_VOZ = [
    [/premium|enhanced|aprimorad|melhorad/i, 30],
    [/natural|neural|siri/i, 25],
    [/google|microsoft/i, 12],
    [/luciana|francisca|camila|vit[óo]ria|fernanda|joana|in[êe]s|thalita|helo[íi]sa/i, 8]
  ];

  function pontuarVoz(v){
    /* O sotaque vem antes do polimento, e por isso é degrau e não
       bônus: uma voz Premium de Portugal lendo um devocional brasileiro
       soa estrangeira, e nenhum somatório de qualidade deveria passar
       na frente de uma voz comum daqui. Os degraus são largos o
       bastante para os sinais de nome nunca os cruzarem. */
    let p = /pt[-_]?BR/i.test(v.lang) ? 1000
          : /^pt/i.test(v.lang)       ? 500
          : 0;
    for(const [re, n] of SINAIS_VOZ) if(re.test(v.name || '')) p += n;
    /* voz de rede costuma soar melhor, mas depende de internet — e este
       app é feito para funcionar sem. Vale pouco: desempata para a voz
       de dentro do aparelho sem derrubar uma Premium de verdade. */
    if(v.localService) p += 6;
    return p;
  }

  function melhorVoz(pool){
    return (pool || listaVozes).slice()
      .sort((a, b) => pontuarVoz(b) - pontuarVoz(a))[0] || null;
  }

  if(suporta){
    recarregarVozes();
    // No Chrome a lista chega de forma assíncrona
    speechSynthesis.addEventListener('voiceschanged', recarregarVozes);
  }

  /* ---------- preparo do texto ---------- */
  function limpar(txt){
    return String(txt || '')
      .replace(/[—–]/g, ', ')     // travessões viram pausa
      .replace(/[*_`>#]/g, ' ')
      .replace(/\s*\[\d+\]\s*/g, ' ')       // marcas de nota de rodapé
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Pedaços curtos evitam o corte do Chrome em falas longas
     e deixam pular/voltar mais preciso. */
  const MAX = 180;
  function dividir(txt){
    const t = limpar(txt);
    if(!t) return [];
    if(t.length <= MAX) return [t];

    const frases = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t];
    const saida = [];
    let buf = '';
    frases.forEach(f => {
      if(buf && (buf + f).length > MAX){ saida.push(buf.trim()); buf = f; }
      else buf += f;
    });
    if(buf.trim()) saida.push(buf.trim());

    // frase única gigante: quebra por palavras
    const final = [];
    saida.forEach(s => {
      if(s.length <= MAX * 1.6) return final.push(s);
      let linha = '';
      s.split(' ').forEach(p => {
        if(linha && (linha + ' ' + p).length > MAX){ final.push(linha); linha = p; }
        else linha = linha ? linha + ' ' + p : p;
      });
      if(linha) final.push(linha);
    });
    return final;
  }

  /* ---------- destaque visual ---------- */
  function limparDestaque(){
    if(elDestacado){ elDestacado.classList.remove('lendo-agora'); elDestacado = null; }
  }
  function destacar(el){
    limparDestaque();
    if(!el || !el.isConnected) return;
    el.classList.add('lendo-agora');
    elDestacado = el;
    const r = el.getBoundingClientRect();
    const folgaTopo = 80;
    const folgaBase = window.innerHeight - 120;
    if(r.top < folgaTopo || r.bottom > folgaBase){
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ---------- barra do reprodutor ---------- */
  function marcarBotao(btn){
    if(botaoAtivo && botaoAtivo !== btn) botaoAtivo.classList.remove('tocando');
    botaoAtivo = btn || null;
    if(botaoAtivo) botaoAtivo.classList.add('tocando');
  }

  function atualizarBarra(){
    const barra = $('barra-audio');
    if(!barra) return;
    const ativo = estado !== 'parado';
    barra.classList.toggle('ver', ativo);
    document.body.classList.toggle('com-audio', ativo);

    const t = $('audio-titulo');
    const sub = $('audio-sub');
    const play = $('audio-play');
    const vel = $('audio-vel');

    if(t) t.textContent = titulo || 'Leitura em voz';
    if(sub){
      const p = partes[parteAtual];
      const rotulo = p && p.rotulo ? p.rotulo : '';
      const total = partes.length;
      sub.textContent = total > 1
        ? (rotulo ? rotulo + ' · ' : '') + (parteAtual + 1) + ' de ' + total
        : rotulo;
    }
    if(play){
      const pausado = estado === 'pausado';
      play.textContent = pausado ? '▶' : '⏸';
      play.setAttribute('aria-label', pausado ? 'Continuar leitura' : 'Pausar leitura');
      play.title = pausado ? 'Continuar' : 'Pausar';
    }
    if(vel) vel.textContent = String(prefs.vel).replace('.', ',') + '×';

    const pb = $('audio-prog-barra');
    if(pb){
      const pct = trechos.length ? Math.min(100, (idx / trechos.length) * 100) : 0;
      pb.style.width = pct.toFixed(1) + '%';
    }
  }

  /* ---------- watchdog do Chrome no desktop ----------
     O Chrome silencia a fala depois de ~15 s. Um pause/resume
     periódico resolve. No Android isso reinicia a frase, então
     só usamos no desktop — e os trechos curtos já cobrem o resto. */
  const precisaWatchdog = /Chrome/.test(navigator.userAgent)
    && !/Android|Mobile|Edg\//.test(navigator.userAgent);

  function ligarWatchdog(){
    if(!precisaWatchdog || watchdog) return;
    watchdog = setInterval(() => {
      if(estado !== 'tocando') return;
      if(speechSynthesis.speaking && !speechSynthesis.paused){
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 10000);
  }
  function desligarWatchdog(){
    if(watchdog){ clearInterval(watchdog); watchdog = null; }
  }

  /* ---------- reprodução ---------- */
  function falarAtual(){
    if(idx >= trechos.length) return finalizar();
    const tr = trechos[idx];
    const u = new SpeechSynthesisUtterance(tr.texto);
    u.lang = (vozAtual && vozAtual.lang) || 'pt-BR';
    if(vozAtual) u.voice = vozAtual;
    u.rate = prefs.vel;
    u.pitch = 1;

    u.onstart = () => {
      if(tr.parte !== parteAtual){
        parteAtual = tr.parte;
        const p = partes[parteAtual];
        destacar(p && p.el);
        /* quem chamou pode acompanhar a leitura — é o que faz o percurso
           guiado virar de passo sozinho enquanto a voz avança */
        if(aoTrocarParte) { try { aoTrocarParte(parteAtual, p); } catch {} }
      }
      atualizarBarra();
    };
    u.onend = () => {
      if(ignorarFim) return;
      idx++;
      atualizarBarra();
      falarAtual();
    };
    u.onerror = (e) => {
      if(ignorarFim) return;
      const motivo = e && e.error;
      if(motivo === 'interrupted' || motivo === 'canceled') return;
      /* Voz de rede sem internet falha em todo trecho, um por um, e a
         leitura inteira terminava em silêncio sem ninguém entender por
         quê — o pior jeito de falhar num app que existe também para
         quem não lê. Na primeira falha troca para a melhor voz de
         dentro do aparelho e repete o trecho, uma vez só. */
      if(!trocouVozPorFalha && vozAtual && vozAtual.localService === false){
        const local = melhorVoz(listaVozes.filter(v => v.localService));
        if(local){
          trocouVozPorFalha = true;
          vozAtual = local;
          return falarAtual();
        }
      }
      idx++;
      falarAtual();
    };

    speechSynthesis.speak(u);
  }

  function finalizar(){
    const cb = aoTerminar;
    parar(true);
    if(typeof cb === 'function') cb();
  }

  /* API pública ------------------------------------------------ */

  /* lista: array de {texto, rotulo, el} — cada item é um bloco
     lógico (um versículo, a reflexão, a oração…) */
  function falar(lista, opcoes){
    if(!suporta){
      avisar('Este navegador não faz leitura em voz');
      return false;
    }
    const op = opcoes || {};
    ignorarFim = true;
    speechSynthesis.cancel();
    ignorarFim = false;

    partes = (Array.isArray(lista) ? lista : [lista])
      .map(p => (typeof p === 'string' ? { texto: p } : p))
      .filter(p => p && limpar(p.texto));

    if(!partes.length){ avisar('Nada para ouvir aqui'); return false; }

    trechos = [];
    partes.forEach((p, i) => {
      dividir(p.texto).forEach(t => trechos.push({ texto: t, parte: i }));
    });

    idx = 0;
    parteAtual = -1;
    trocouVozPorFalha = false;
    titulo = op.titulo || '';
    aoTerminar = op.aoTerminar || null;
    aoTrocarParte = op.aoTrocarParte || null;
    estado = 'tocando';
    limparDestaque();
    marcarBotao(op.botao);
    ligarWatchdog();
    atualizarBarra();
    falarAtual();
    return true;
  }

  function parar(silencioso){
    ignorarFim = true;
    if(suporta) speechSynthesis.cancel();
    ignorarFim = false;
    estado = 'parado';
    aoTerminar = null;
    aoTrocarParte = null;
    trechos = [];
    partes = [];
    idx = 0;
    parteAtual = -1;
    desligarWatchdog();
    limparDestaque();
    marcarBotao(null);
    atualizarBarra();
    if(!silencioso) { /* parada manual: nada a anunciar */ }
  }

  function pausar(){
    if(estado !== 'tocando') return;
    speechSynthesis.pause();
    estado = 'pausado';
    atualizarBarra();
  }

  function retomar(){
    if(estado !== 'pausado') return;
    speechSynthesis.resume();
    estado = 'tocando';
    atualizarBarra();
    // Alguns navegadores ignoram o resume; refala o trecho atual.
    setTimeout(() => {
      if(estado === 'tocando' && !speechSynthesis.speaking) falarAtual();
    }, 350);
  }

  function alternarPausa(){
    if(estado === 'tocando') pausar();
    else if(estado === 'pausado') retomar();
  }

  /* pula para o começo da parte seguinte / anterior */
  function irParaParte(destino){
    if(estado === 'parado' || !partes.length) return;
    const alvo = Math.max(0, Math.min(partes.length - 1, destino));
    const pos = trechos.findIndex(t => t.parte === alvo);
    if(pos < 0) return;
    ignorarFim = true;
    speechSynthesis.cancel();
    ignorarFim = false;
    idx = pos;
    parteAtual = -1;
    estado = 'tocando';
    atualizarBarra();
    falarAtual();
  }
  function proxima(){
    const p = trechos[idx] ? trechos[idx].parte : parteAtual;
    if(p >= partes.length - 1) return finalizar();
    irParaParte(p + 1);
  }
  function anterior(){
    const p = trechos[idx] ? trechos[idx].parte : parteAtual;
    irParaParte(p - 1);
  }

  /* O iOS só deixa falar se o primeiro speak sair de dentro do toque.
     Quando há busca de rede antes (ouvir um dia de plano, por exemplo),
     o toque já passou — então destravamos com uma fala muda no clique. */
  let destravado = false;
  function destravar(){
    if(!suporta || destravado) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      destravado = true;
    } catch {}
  }

  /* fala curta e avulsa (nome de seção, rótulo de botão) */
  function anunciar(texto){
    if(!suporta || !texto) return;
    if(estado !== 'parado') return;   // não atropela uma leitura em curso
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(limpar(texto));
    u.lang = (vozAtual && vozAtual.lang) || 'pt-BR';
    if(vozAtual) u.voice = vozAtual;
    u.rate = prefs.vel;
    speechSynthesis.speak(u);
  }

  function definirVelocidade(v){
    prefs.vel = Number(v) || 1;
    salvar();
    atualizarBarra();
    // aplica já no trecho atual
    if(estado === 'tocando'){
      const p = trechos[idx] ? trechos[idx].parte : 0;
      irParaParte(p);
    }
  }

  function definirVoz(idOuNome){
    prefs.voz = idOuNome || '';
    salvar();
    vozAtual = listaVozes.find(v => v.voiceURI === prefs.voz)
            || listaVozes.find(v => v.name === prefs.voz)
            || melhorVoz();
  }

  return {
    suporta,
    prefs,
    salvar,
    falar,
    parar,
    pausar,
    retomar,
    alternarPausa,
    proxima,
    anterior,
    anunciar,
    destravar,
    definirVelocidade,
    definirVoz,
    get vozes(){ return listaVozes; },
    get vozAtual(){ return vozAtual; },
    /* expostos para poder testar a escolha com listas de voz inventadas,
       já que as vozes reais dependem do aparelho de quem abre */
    pontuarVoz, melhorVoz,
    get estado(){ return estado; },
    tocando: () => estado !== 'parado'
  };
})();

/* =========================================================
   DESTAQUES COLORIDOS E NOTAS POR VERSÍCULO
   ========================================================= */
const CHAVE_MARCAS = 'lampada-destaques';
const CHAVE_NOTAS  = 'lampada-notas';
const CORES_MARCA  = ['amarelo', 'verde', 'azul', 'rosa'];

const lerJSON = (chave, padrao) => {
  try { return JSON.parse(localStorage.getItem(chave) || padrao); }
  catch { return JSON.parse(padrao); }
};
const carregarMarcas = () => lerJSON(CHAVE_MARCAS, '{}');
const salvarMarcas   = m => { localStorage.setItem(CHAVE_MARCAS, JSON.stringify(m)); Conta.marcarSujo(); };
const carregarNotas  = () => lerJSON(CHAVE_NOTAS, '{}');
const salvarNotas    = n => { localStorage.setItem(CHAVE_NOTAS, JSON.stringify(n)); Conta.marcarSujo(); };

/* As notas viviam presas a um favorito. Agora vale para qualquer versículo,
   então trazemos as antigas na primeira abertura — sem apagar nada. */
function migrarNotasDosFavoritos(){
  const notas = carregarNotas();
  let mudou = false;
  carregarFavs().forEach(f => {
    if(f.nota && f.nota.trim() && !notas[f.chave]){
      notas[f.chave] = {
        texto: f.nota, ref: f.ref, data: f.data,
        nr: f.nr, cap: f.cap, verso: f.verso
      };
      mudou = true;
    }
  });
  if(mudou) salvarNotas(notas);
}

function pintarVerso(el, nr, cap, verso){
  const k = chaveVerso(nr, cap, verso);
  const cor = carregarMarcas()[k];
  CORES_MARCA.forEach(c => el.classList.remove('marca-' + c));
  if(cor) el.classList.add('marca-' + cor);
  el.classList.toggle('tem-nota', !!carregarNotas()[k]);
}

/* ---------- folha de ações do versículo ---------- */
let versoAberto = null;   // {nr, cap, verso, texto}

function mostrarPaineFolha(qual){
  /* Os painéis internos da folha — nota, comparar, referências — também
     são um passo: o voltar traz de volta à folha principal antes de
     fechá-la. Sem isso, quem abrisse a nota e apertasse voltar perdia a
     folha inteira de uma vez. */
  const principal = 'folha-principal';
  if(qual !== principal){
    Navegacao.entrar('painel', () => mostrarPaineFolhaDireto(principal));
  } else if(Navegacao.sair('painel')){
    return;
  }
  mostrarPaineFolhaDireto(qual);
}

function mostrarPaineFolhaDireto(qual){
  ['folha-principal', 'folha-nota', 'folha-comparar', 'folha-refs', 'folha-enviar'].forEach(id =>
    $(id).classList.toggle('oculto', id !== qual)
  );
}

function abrirFolhaVerso(nr, cap, verso, texto){
  /* quem abriu a folha aprendeu o gesto — a dica sai sozinha, sem
     precisar que a pessoa a dispense */
  dispensarDicaDoVerso();
  versoAberto = { nr, cap, verso, texto };
  const ref = livroPorNr(nr).nome + ' ' + cap + ':' + verso;
  $('folha-ref').textContent = ref;
  $('folha-txt').textContent = texto;

  const k = chaveVerso(nr, cap, verso);
  const cor = carregarMarcas()[k];
  document.querySelectorAll('#folha-cores button').forEach(b =>
    b.classList.toggle('ativo', (b.dataset.cor || '') === (cor || ''))
  );
  mostrarBorrachaDaCor(!!cor);

  pintarFavNaFolha(estaFavorito(nr, cap, verso));

  const nota = carregarNotas()[k];
  pintarNotaNaFolha(!!nota);
  $('campo-nota-verso').value = nota ? nota.texto : '';

  /* direto: a folha ainda nem entrou no histórico, não há painel a sair */
  mostrarPaineFolhaDireto('folha-principal');
  $('folha-verso').classList.add('ver');
  $('folha-verso').setAttribute('aria-hidden', 'false');
  $('fundo-folha').classList.add('ver');
  Foco.prender($('folha-verso'));
  Navegacao.entrar('folha', fecharFolhaDireto);
  if(Voz.prefs.modo) Voz.anunciar(ref);
}

/* O voltar do sistema fecha a folha antes de sair da leitura. Quem
   fecha de verdade é sempre o popstate — ver o módulo Navegacao. */
function fecharFolha(){
  if(Navegacao.sair('folha')) return;
  fecharFolhaDireto();
}

function fecharFolhaDireto(){
  /* =========================================================
     A NOTA NÃO PODE SUMIR POR UM TOQUE FORA

     Fechar a folha descartava o que estava escrito, e tocar no fundo
     escuro fecha também. Alguém escrevia uma reflexão sobre o
     versículo, encostava o dedo fora sem querer, e acabou — sem
     pergunta, sem aviso, sem volta.

     Agora o que foi digitado é gravado ao fechar, como já acontecia
     na nota do diário, que salva sozinha ao perder o foco. Salvar em
     silêncio é melhor do que perguntar: ninguém precisa decidir se
     quer guardar o que acabou de escrever.
     ========================================================= */
  guardarNotaPendente();

  $('folha-verso').classList.remove('ver');
  $('folha-verso').setAttribute('aria-hidden', 'true');
  $('fundo-folha').classList.remove('ver');
  Foco.soltar($('folha-verso'));
  versoAberto = null;
}

/* redesenha o versículo aberto no capítulo, se ele estiver na tela */
function atualizarVersoNaTela(){
  if(!versoAberto) return;
  const { nr, cap, verso } = versoAberto;
  document.querySelectorAll('#area-leitura .v').forEach(el => {
    const sup = el.querySelector('sup');
    if(sup && Number(sup.textContent) === verso) pintarVerso(el, nr, cap, verso);
  });
}

function definirCorDoVerso(cor){
  if(!versoAberto) return;
  const { nr, cap, verso } = versoAberto;
  const marcas = carregarMarcas();
  const k = chaveVerso(nr, cap, verso);
  if(cor) marcas[k] = cor; else delete marcas[k];
  salvarMarcas(marcas);
  document.querySelectorAll('#folha-cores button').forEach(b =>
    b.classList.toggle('ativo', (b.dataset.cor || '') === (cor || ''))
  );
  mostrarBorrachaDaCor(!!cor);
  atualizarVersoNaTela();
  avisar(cor ? 'Versículo marcado' : 'Marca removida');
}

/* A borracha só existe quando há marca. Um ✕ permanente numa fileira de
   cores promete uma ação que na maior parte das vezes não faz nada — e,
   dentro de uma folha, lê como "fechar" antes de ler como "apagar". */
function mostrarBorrachaDaCor(temCor){
  const b = $('folha-limpar-cor');
  if(b) b.classList.toggle('oculto', !temCor);
}

/* Grava o que estiver no campo, se mudou. Silencioso de propósito:
   é rede de segurança, não uma ação que a pessoa pediu. */
function guardarNotaPendente(){
  if(!versoAberto) return;
  const campo = $('campo-nota-verso');
  if(!campo) return;
  const { nr, cap, verso } = versoAberto;
  const guardada = (carregarNotas()[chaveVerso(nr, cap, verso)] || {}).texto || '';
  if(campo.value.trim() === guardada.trim()) return;   /* nada mudou */
  salvarNotaDoVerso({ silencioso: true });
}

function salvarNotaDoVerso(op){
  if(!versoAberto) return;
  const { nr, cap, verso, texto } = versoAberto;
  const notas = carregarNotas();
  const k = chaveVerso(nr, cap, verso);
  const valor = $('campo-nota-verso').value.trim();
  const antes = notas[k];
  if(valor){
    notas[k] = {
      texto: valor,
      ref: livroPorNr(nr).nome + ' ' + cap + ':' + verso,
      data: (notas[k] && notas[k].data) || new Date().toISOString(),
      nr, cap, verso, versiculo: texto
    };
    if(!(op && op.silencioso)) avisar('Nota salva');
  } else {
    delete notas[k];
    /* apagar uma nota escrita à mão é a perda mais cara do app:
       vai embora sem confirmação, então damos o caminho de volta */
    if(!(op && op.silencioso)) avisar('Nota removida', antes && {
      aoTocar: () => { const n = carregarNotas(); n[k] = antes; salvarNotas(n);
                       atualizarVersoNaTela(); renderFavoritos();
                       const campo = $('campo-nota-verso');
                       if(campo && versoAberto && chaveVerso(versoAberto.nr, versoAberto.cap, versoAberto.verso) === k)
                         campo.value = antes.texto || '';
                       pintarNotaNaFolha(true); }
    });
  }
  salvarNotas(notas);
  atualizarVersoNaTela();
  renderFavoritos();
  mostrarPaineFolha('folha-principal');
  pintarNotaNaFolha(!!valor);
}

/* ---------- comparação entre versões ---------- */
/* =========================================================
   DESENHO DO MAPA
   Tudo sai das coordenadas: o litoral, os rios e os lugares
   passam pela mesma projeção, então nada pode sair de lugar
   em relação ao resto.
   ========================================================= */
let lugarAberto = null;

function desenharMapa(){
  const palco = $('palco-mapa');
  if(!palco || palco.dataset.pronto) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + Math.round(MAPA_W) + ' ' + Math.round(MAPA_H));
  svg.setAttribute('class', 'mapa');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Mapa da Terra Santa com ' + LUGARES.length + ' lugares');

  const criar = (tag, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for(const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  /* o mar é o fundo; a terra é um polígono que fecha pelo lado leste */
  svg.appendChild(criar('rect', { x: 0, y: 0, width: MAPA_W, height: MAPA_H, class: 'm-mar' }));
  const terra = LITORAL.map(([la, lo]) => [projX(lo), projY(la)]);
  const pontosTerra = terra.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
    + ' ' + MAPA_W + ',0 ' + MAPA_W + ',' + MAPA_H + ' ' + terra[0][0].toFixed(1) + ',' + MAPA_H;
  svg.appendChild(criar('polygon', { points: pontosTerra, class: 'm-terra' }));
  svg.appendChild(criar('polyline', { points: traco(LITORAL), class: 'm-costa' }));

  svg.appendChild(criar('polygon', { points: traco(GALILEIA), class: 'm-agua' }));
  svg.appendChild(criar('polygon', { points: traco(MAR_MORTO), class: 'm-agua' }));
  svg.appendChild(criar('polyline', { points: traco(JORDAO), class: 'm-rio' }));

  const pontos = [];
  const textos = [];
  LUGARES.forEach((l, i) => {
    const x = projX(l.lon), y = projY(l.lat);
    const g = criar('g', { class: 'm-lugar m-t-' + l.tipo, tabindex: '0', role: 'button' });
    g.setAttribute('aria-label', l.nome + '. ' + l.nota);
    g.dataset.i = i;
    if(l.tipo !== 'agua'){
      g.appendChild(criar('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6 }));
      pontos.push({ e: x - 8, d: x + 8, c: y - 8, b: y + 8 });
    }
    const t = criar('text', { x: x.toFixed(1), y: y.toFixed(1) });
    t.textContent = l.nome;
    g.appendChild(t);
    textos.push({ t, x, y, peso: l.mencoes || 0 });
    /* alvo de toque generoso por cima do desenho, que é pequeno */
    g.appendChild(criar('rect', {
      x: (x - 22).toFixed(1), y: (y - 22).toFixed(1),
      width: 44, height: 44, class: 'm-alvo'
    }));
    const abrir = () => mostrarLugar(i);
    g.onclick = abrir;
    g.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrir(); } };
    svg.appendChild(g);
  });

  palco.innerHTML = '';
  palco.appendChild(svg);
  acomodarRotulos(textos, pontos);
  palco.dataset.pronto = '1';
}

/* Posições candidatas em volta do ponto, na ordem de preferência:
   primeiro os lados, que são os que se leem melhor, depois acima e
   abaixo, depois as diagonais — e só então tudo de novo em anéis mais
   afastados, para os lugares que se amontoam em volta de Jerusalém.
   Nome que vai para um anel de longe ganha linha de chamada; sem ela
   ninguém sabe de qual ponto o nome é. */
const POSICOES = [];
for(const raio of [1, 1.7, 2.6]){
  POSICOES.push(
    { dx:  11 * raio, dy:   5, anc: 'start',  raio },
    { dx: -11 * raio, dy:   5, anc: 'end',    raio },
    { dx:   0, dy: -11 * raio, anc: 'middle', raio },
    { dx:   0, dy:  19 * raio, anc: 'middle', raio },
    { dx:  10 * raio, dy:  -7 * raio, anc: 'start',  raio },
    { dx: -10 * raio, dy:  -7 * raio, anc: 'end',    raio },
    { dx:  10 * raio, dy:  16 * raio, anc: 'start',  raio },
    { dx: -10 * raio, dy:  16 * raio, anc: 'end',    raio }
  );
}

/* =========================================================
   ONDE CADA NOME CABE
   Com 41 nomes num mapa de 583 unidades de largura, escolher
   posição de rótulo à mão não escala — e foi assim que a versão
   anterior precisou de deslocamento próprio em 14 lugares.
   Aqui cada nome experimenta as oito posições e fica na primeira
   que não encosta em rótulo já posto, em ponto de lugar nenhum,
   nem na borda. Quem é mais mencionado escolhe primeiro, então,
   quando sobra um lugar só, é Jerusalém que fica com ele.
   Nome que não cabe em posição nenhuma some: o ponto continua
   lá, clicável, e o leitor de tela continua anunciando o nome.
   ========================================================= */
function acomodarRotulos(textos, pontos){
  const bate = (a, b) => !(a.d < b.e || b.d < a.e || a.b < b.c || b.b < a.c);
  const postos = [];
  const ordem = textos.slice().sort((a, b) => b.peso - a.peso);
  /* o traço branco por trás da letra engorda o que se vê para além da
     caixa geométrica; a folga cobre isso */
  const FOLGA = 2.5;

  for(const item of ordem){
    /* medido na origem e com âncora conhecida: assim `cima` sai da fonte
       que o navegador de fato usou, em vez de uma altura chutada — foi
       chutando que quatro rótulos passaram por cima uns dos outros */
    item.t.setAttribute('x', 0);
    item.t.setAttribute('y', 0);
    item.t.setAttribute('text-anchor', 'start');
    const cx = item.t.getBBox();
    const larg = cx.width || item.t.textContent.length * 8;
    const alt = cx.height || 15;
    const cima = cx.height ? cx.y : -11;

    const tentar = p => {
      const x = item.x + p.dx, y = item.y + p.dy;
      const e = (p.anc === 'start' ? x : p.anc === 'end' ? x - larg : x - larg / 2) - FOLGA;
      const c = y + cima - FOLGA;
      const caixa = { e, d: e + larg + FOLGA * 2, c, b: c + alt + FOLGA * 2 };
      if(caixa.e < 2 || caixa.d > MAPA_W - 2 || caixa.c < 2 || caixa.b > MAPA_H - 2) return null;
      if(postos.some(q => bate(caixa, q))) return null;
      /* nunca por cima de um ponto: numa versão anterior o "G" de
         Gibeão ficava escondido atrás do círculo do vizinho */
      if(pontos.some(q => bate(caixa, q))) return null;
      return { p, x, y, caixa };
    };

    let posto = null;
    for(const p of POSICOES) if((posto = tentar(p))) break;

    if(!posto){ item.t.setAttribute('display', 'none'); continue; }
    item.t.setAttribute('x', posto.x.toFixed(1));
    item.t.setAttribute('y', posto.y.toFixed(1));
    item.t.setAttribute('text-anchor', posto.p.anc);
    postos.push(posto.caixa);
    if(posto.p.raio > 1) chamar(item, posto);
  }
}

/* Linha do ponto até a borda do rótulo que ficou longe. Vai atrás do
   texto, no mesmo grupo, para acender junto no toque e no foco. */
function chamar(item, posto){
  const alvoX = posto.p.anc === 'start' ? posto.caixa.e
    : posto.p.anc === 'end' ? posto.caixa.d
    : (posto.caixa.e + posto.caixa.d) / 2;
  const alvoY = (posto.caixa.c + posto.caixa.b) / 2;
  const ang = Math.atan2(alvoY - item.y, alvoX - item.x);
  const linha = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  linha.setAttribute('x1', (item.x + Math.cos(ang) * 7).toFixed(1));
  linha.setAttribute('y1', (item.y + Math.sin(ang) * 7).toFixed(1));
  linha.setAttribute('x2', alvoX.toFixed(1));
  linha.setAttribute('y2', alvoY.toFixed(1));
  linha.setAttribute('class', 'm-chamada');
  item.t.parentNode.insertBefore(linha, item.t);
}

function mostrarLugar(i){
  const l = LUGARES[i];
  if(!l) return;
  lugarAberto = i;
  document.querySelectorAll('#palco-mapa .m-lugar').forEach(g =>
    g.classList.toggle('ativo', +g.dataset.i === i));

  const ficha = $('ficha-lugar');
  ficha.classList.remove('oculto');
  ficha.innerHTML = '<h3></h3><p class="lugar-nota"></p>' +
    '<p class="lugar-mencoes"></p><div class="lugar-refs"></div>';
  ficha.querySelector('h3').textContent = l.nome;
  ficha.querySelector('.lugar-nota').textContent = l.nota;
  /* a contagem é do OpenBible: dá a medida de quanto a Bíblia fala
     do lugar, que nenhuma nota nossa transmitiria */
  ficha.querySelector('.lugar-mencoes').textContent =
    l.mencoes === 1 ? 'Citado em 1 versículo.' : 'Citado em ' + l.mencoes + ' versículos.';

  const caixa = ficha.querySelector('.lugar-refs');
  l.refs.forEach(([nr, cap, verso]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-sm';
    b.textContent = livroPorNr(nr).nome + ' ' + cap + ':' + verso;
    b.onclick = () => abrirLeitura(nr, cap, verso);
    caixa.appendChild(b);
  });
  if(Voz.prefs.modo) Voz.anunciar(l.nome + '. ' + l.nota);
}

/* =========================================================
   VEJA TAMBÉM
   Mostra as passagens ligadas à que está aberta. A referência
   aparece mesmo quando o texto não vem — ela é nossa e não
   depende de rede; só o texto é buscado.
   ========================================================= */
async function verReferencias(){
  if(!versoAberto) return;
  const { nr, cap, verso } = versoAberto;
  const ligadas = referenciasDe(nr, cap, verso);
  const alvo = $('lista-refs');
  mostrarPaineFolha('folha-refs');

  if(!ligadas.length){
    alvo.innerHTML = '';
    const vazio = document.createElement('p');
    vazio.className = 'refs-vazio';
    vazio.textContent = 'Ainda não há passagens ligadas a este versículo.';
    alvo.appendChild(vazio);
    return;
  }

  alvo.innerHTML = '<div class="carregando"><span class="giro"></span> Buscando as passagens…</div>';
  const buscados = await Promise.all(ligadas.map(async l => {
    const [n, c, v] = l.ref;
    try { return { l, texto: await buscarVerso(n, c, v).then(r => r.texto) }; }
    catch { return { l, texto: null }; }
  }));

  alvo.innerHTML = '';
  const grupos = [
    ['citacao', 'Cita ou é citado'],
    ['tema',    'Sobre o mesmo assunto']
  ];
  for(const [tipo, titulo] of grupos){
    const doTipo = buscados.filter(b => b.l.tipo === tipo);
    if(!doTipo.length) continue;
    const t = document.createElement('p');
    t.className = 'refs-titulo';
    t.textContent = titulo;
    alvo.appendChild(t);
    for(const { l, texto } of doTipo){
      const [n, c, v] = l.ref;
      const ref = livroPorNr(n).nome + ' ' + c + ':' + v;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ref-item';
      const r = document.createElement('span');
      r.className = 'ref-item-ref';
      r.textContent = ref;
      const x = document.createElement('span');
      x.className = texto ? 'ref-item-txt' : 'ref-item-txt falhou';
      x.textContent = texto || 'Toque para abrir a passagem.';
      item.appendChild(r);
      item.appendChild(x);
      /* a leitura espera a folha sair: aberta na linha seguinte, ela
         seria desfeita pelo voltar que fecha a folha */
      item.onclick = () => {
        const ir = () => abrirLeitura(n, c, v);
        if(!Navegacao.sair('folha', 1, ir)){ fecharFolhaDireto(); ir(); }
      };
      alvo.appendChild(item);
    }
  }

  const comTexto = buscados.filter(b => b.texto);
  if(comTexto.length){
    const linha = document.createElement('div');
    linha.className = 'linha-ouvir';
    linha.style.marginTop = '14px';
    linha.appendChild(criarBotaoOuvir('Ouvir as passagens', () =>
      comTexto.map(({ l, texto }) => {
        const [n, c, v] = l.ref;
        return { texto: refFalada(n, c, v) + '. ' + texto,
                 rotulo: livroPorNr(n).nome + ' ' + c + ':' + v };
      }), { classe: 'claro', voz: { titulo: 'Passagens ligadas' } }));
    alvo.appendChild(linha);
  }
}

/* "A", "A e B", "A, B e C" — lista em português, com o "e" antes do
   último, em vez das vírgulas soltas que o join daria */
function listarNomes(nomes){
  if(nomes.length <= 1) return nomes[0] || '';
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

async function compararVersoes(){
  if(!versoAberto) return;
  const { nr, cap, verso } = versoAberto;
  const alvo = $('lista-comparacao');
  mostrarPaineFolha('folha-comparar');
  alvo.innerHTML = '<div class="carregando"><span class="giro"></span> Buscando nas versões…</div>';

  /* =========================================================
     TRÊS MOTIVOS DIFERENTES, UMA FRASE SÓ

     Todo fracasso virava "Esta versão não respondeu agora" — e para
     as duas versões que só têm o Novo Testamento isso era falso e
     não tinha conserto: convidava a tentar de novo o que nunca vai
     dar certo. Agora cada motivo diz o que é.
     ========================================================= */
  const resultados = await Promise.all(VERSOES.map(async v => {
    try { return { nome: v.nome, texto: await buscarVersoEm(v, nr, cap, verso) }; }
    catch(e){ return { nome: v.nome, texto: null,
                       semLivro: !!e.semLivro, semVerso: !!e.semVerso }; }
  }));

  const livro = livroPorNr(nr).nome;
  /* Quem não traz o livro não tem o que comparar, e uma linha morta no
     meio da lista atrapalha a leitura das que têm. Sai da lista e vira
     uma nota no pé, que continua dizendo quais são — some da comparação,
     não da verdade. */
  const semLivro = resultados.filter(r => r.semLivro);
  const naLista  = resultados.filter(r => !r.semLivro);

  alvo.innerHTML = '';
  naLista.forEach(r => {
    const d = document.createElement('div');
    d.className = 'comp-item';
    const n = document.createElement('div');
    n.className = 'comp-nome';
    n.textContent = r.nome;
    const t = document.createElement('div');
    t.className = r.texto ? 'comp-txt' : 'comp-falhou';
    t.textContent = r.texto
      || (r.semVerso ? 'Esta versão junta este versículo a outro.'
                     : 'Esta versão não respondeu agora.');
    d.appendChild(n);
    d.appendChild(t);
    alvo.appendChild(d);
  });

  if(semLivro.length){
    const nota = document.createElement('p');
    nota.className = 'comp-fora';
    nota.textContent = (semLivro.length === 1
      ? 'Uma versão não entra aqui porque não traz ' + livro + ': '
      : semLivro.length + ' versões não entram aqui porque não trazem ' + livro + ': ')
      + listarNomes(semLivro.map(r => r.nome)) + '.';
    alvo.appendChild(nota);
  }

  const ouvir = criarBotaoOuvir('Ouvir todas as versões', () =>
    resultados.filter(r => r.texto).map(r => ({ texto: r.nome + '. ' + r.texto, rotulo: r.nome })),
    { classe: 'claro', voz: { titulo: 'Comparando versões' } });
  const linha = document.createElement('div');
  linha.className = 'linha-ouvir mt-14';
  linha.appendChild(ouvir);
  alvo.appendChild(linha);

  /* Falha de rede tem conserto: quem tentou e não conseguiu merece o
     caminho de volta. As que não trazem o livro já saíram da lista, e as
     que juntam o versículo não mudam por tentar — então o botão só
     aparece quando repetir pode dar outro resultado. */
  if(naLista.some(r => !r.texto && !r.semVerso)){
    const outra = document.createElement('button');
    outra.type = 'button';
    outra.className = 'btn-ouvir claro botao-largo mt-8';
    outra.textContent = 'Tentar de novo';
    outra.onclick = compararVersoes;
    alvo.appendChild(outra);
  }
}

/* =========================================================
   HISTÓRICO DO VERSÍCULO DO DIA
   ========================================================= */
function montarHistorico(){
  const alvo = $('lista-hist');
  if(!alvo) return;
  alvo.innerHTML = '';
  const hoje = new Date();
  for(let i = 0; i < 30; i++){
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const { nr, cap, verso } = devocionalDoDia(diaDoAno(d));
    const el = document.createElement('div');
    el.className = 'item-hist' + (i === 0 ? ' hoje' : '');
    const data = document.createElement('div');
    data.className = 'hist-data';
    data.textContent = i === 0 ? 'Hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const ref = document.createElement('div');
    ref.className = 'hist-ref';
    ref.textContent = livroPorNr(nr).nome + ' ' + cap + ':' + verso;
    el.appendChild(data);
    el.appendChild(ref);
    el.onclick = () => abrirLeitura(nr, cap, verso);
    alvo.appendChild(el);
  }
}

/* =========================================================
   MINHAS ORAÇÕES
   ========================================================= */
const CHAVE_ORACOES = 'lampada-oracoes';
const carregarOracoes = () => lerJSON(CHAVE_ORACOES, '[]');
const salvarOracoes   = l => { localStorage.setItem(CHAVE_ORACOES, JSON.stringify(l)); Conta.marcarSujo(); };

function adicionarOracao(){
  const campo = $('campo-oracao');
  const txt = campo.value.trim();
  if(!txt) return avisar('Escreva o pedido antes de adicionar');
  const lista = carregarOracoes();
  lista.unshift({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    texto: txt,
    data: new Date().toISOString(),
    respondida: false,
    dataResp: null
  });
  salvarOracoes(lista);
  campo.value = '';
  /* mexer no value por código não dispara `input`: sem isto o campo
     ficaria alto e vazio depois de um pedido longo */
  ajustarCampoOracao();
  renderOracoes();
  registrarAtividade();
  avisar('Pedido adicionado');
}

function renderOracoes(){
  const alvo = $('lista-oracoes');
  if(!alvo) return;
  const lista = carregarOracoes();
  alvo.innerHTML = '';
  if(!lista.length){
    alvo.innerHTML = '<div class="vazio-fav">Nenhum pedido ainda.<br>Escreva acima o que você quer entregar a Deus hoje.</div>';
    return;
  }
  lista.forEach((o, i) => {
    const el = document.createElement('div');
    el.className = 'item-oracao' + (o.respondida ? ' respondida' : '');
    el.style.animationDelay = (i * 0.03) + 's';

    const marca = document.createElement('button');
    marca.type = 'button';
    marca.className = 'ora-marca';
    marca.textContent = '✓';
    marca.setAttribute('aria-label', o.respondida ? 'Marcar como não respondida' : 'Marcar como respondida');
    marca.onclick = () => {
      const l = carregarOracoes();
      const item = l.find(x => x.id === o.id);
      if(!item) return;
      item.respondida = !item.respondida;
      item.dataResp = item.respondida ? new Date().toISOString() : null;
      salvarOracoes(l);
      renderOracoes();
      if(item.respondida) avisar('Deus respondeu — que alegria');
    };

    const corpo = document.createElement('div');
    corpo.className = 'ora-corpo';
    const txt = document.createElement('div');
    txt.className = 'ora-txt';
    txt.textContent = o.texto;
    const meta = document.createElement('div');
    meta.className = 'ora-meta';
    const quando = document.createElement('span');
    quando.textContent = new Date(o.data).toLocaleDateString('pt-BR');
    meta.appendChild(quando);
    if(o.respondida && o.dataResp){
      const selo = document.createElement('span');
      selo.className = 'selo-resp';
      selo.textContent = 'Respondida em ' + new Date(o.dataResp).toLocaleDateString('pt-BR');
      meta.appendChild(selo);
    }
    const apagar = document.createElement('button');
    apagar.type = 'button';
    apagar.className = 'btn-remover';
    apagar.textContent = 'Remover';
    apagar.onclick = () => {
      const antes = carregarOracoes();
      salvarOracoes(antes.filter(x => x.id !== o.id));
      renderOracoes();
      avisar('Pedido removido', {
        aoTocar: () => { salvarOracoes(antes); renderOracoes(); }
      });
    };
    meta.appendChild(apagar);
    corpo.appendChild(txt);
    corpo.appendChild(meta);

    el.appendChild(marca);
    el.appendChild(corpo);
    el.appendChild(criarOuvirMini('Ouvir este pedido', () => [
      { texto: o.texto, rotulo: 'Pedido', el }
    ], { voz: { titulo: 'Meu pedido' } }));
    alvo.appendChild(el);
  });
}

/* =========================================================
   DITADO POR VOZ — para quem não escreve
   ========================================================= */
/* =========================================================
   DITADO POR VOZ

   Três defeitos moravam aqui, e os três davam o mesmo sintoma: a
   pessoa aperta o botão, fala, e nada é ouvido.

   1. O AVISO VINHA ANTES DO MICROFONE ABRIR

   `rec.start()` não abre o microfone na hora: o navegador ainda vai
   pedir a permissão e ligar o aparelho de áudio, o que leva de alguns
   décimos de segundo a vários segundos na primeira vez. "Pode falar…"
   aparecia antes disso — então quem obedecia ao aviso e falava na hora
   era, literalmente, não ouvido. O aviso agora espera o navegador
   confirmar que a captação começou.

   2. A DETECÇÃO DA POLÍTICA SÓ FUNCIONA NO CHROME

   `document.featurePolicy` existe no Chrome, e lá um `microphone=()`
   no cabeçalho some com o botão — que é o certo, melhor do que
   prometer o que o navegador vai recusar.

   Só que Safari e Firefox não têm essa API. Neles a verificação cai no
   ramo "não sei, presumo que sim", o botão aparece, a pessoa toca e o
   navegador recusa calado. Era o que estava acontecendo em produção,
   onde o cabeçalho ficou barrando o microfone da própria origem.

   Por isso agora existe também o diagnóstico na hora do erro, que
   funciona em qualquer navegador: se fomos recusados mas a permissão
   do microfone não está negada, quem está barrando é o próprio site.

   3. FECHAR O MICROFONE PARECIA ERRO

   Tocar no botão de novo para parar dispara `aborted`, que caía no
   "Não deu para ouvir agora". Cancelar não é falhar.
   ========================================================= */
const Ditado = (function(){
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  /* Onde dá para perguntar, perguntamos: não adianta mostrar o botão se
     a política do servidor já barrou o microfone para a própria origem.
     Onde não dá (Safari, Firefox), não presumimos o pior — o botão
     aparece e o diagnóstico fica para explicarRecusa(). */
  function politicaPermite(){
    const fp = document.featurePolicy || document.permissionsPolicy;
    if(!fp || !fp.allowsFeature) return true;
    try { return fp.allowsFeature('microphone'); } catch(_) { return true; }
  }
  const suporta = !!Rec && politicaPermite();
  let rec = null;
  let botaoAtivo = null;
  let cancelando = false;   /* parada pedida por nós, não falha */

  function soltarBotao(){
    if(botaoAtivo){ botaoAtivo.classList.remove('ouvindo'); botaoAtivo = null; }
  }

  function parar(){
    if(rec){ cancelando = true; try { rec.stop(); } catch {} }
    soltarBotao();
  }

  /* Quando o navegador recusa, ele não diz quem recusou. Estas são as
     duas causas possíveis, e a diferença muda o que a pessoa deve
     fazer: liberar no navegador, ou nada — porque o erro é nosso. */
  async function explicarRecusa(){
    try {
      if(navigator.permissions && navigator.permissions.query){
        const p = await navigator.permissions.query({ name: 'microphone' });
        if(p.state === 'denied'){
          avisar('O microfone está bloqueado para este site. Libere nas permissões do navegador.');
          return;
        }
      }
    } catch(_){ /* Firefox e Safari não sabem consultar 'microphone' */ }
    /* permissão não está negada e mesmo assim fomos recusados: sobra a
       Permissions-Policy do servidor */
    avisar('O microfone foi bloqueado. Se acabou de permitir, recarregue a página.');
  }

  /* aoTexto recebe o que foi falado; botao só serve para o estado visual */
  function ouvir(botao, aoTexto){
    if(!suporta){
      avisar('Este navegador não entende ditado por voz');
      return;
    }
    if(botaoAtivo === botao) return parar();
    parar();
    Voz.parar(true);          // não tenta ouvir enquanto está falando

    rec = new Rec();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    cancelando = false;
    botaoAtivo = botao;
    botao.classList.add('ouvindo');
    /* nada de "Pode falar…" ainda: o microfone não está aberto */
    avisar('Abrindo o microfone…');

    /* `audiostart` é o momento em que a captação começa de verdade;
       `start` é só o serviço no ar. Quem chegar primeiro serve, porque
       nem todo navegador dispara os dois. */
    let jaAvisou = false;
    const podeFalar = () => {
      if(jaAvisou) return;
      jaAvisou = true;
      avisar('Pode falar…');
    };
    rec.onaudiostart = podeFalar;
    rec.onstart = podeFalar;

    rec.onresult = (e) => {
      const dito = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
      if(dito) aoTexto(dito);
    };

    rec.onerror = (e) => {
      const m = e && e.error;
      /* parada pedida por nós: o botão foi tocado de novo, ou outro
         microfone assumiu. Não é falha e não merece aviso. */
      if(m === 'aborted' && cancelando) return;
      if(m === 'not-allowed' || m === 'service-not-allowed') explicarRecusa();
      else if(m === 'no-speech') avisar('Não ouvi nada. Toque de novo e fale.');
      else if(m === 'audio-capture') avisar('Não achei um microfone neste aparelho');
      /* o ditado do Chrome manda o áudio para o servidor de fala: sem
         internet ele não funciona, mesmo com o resto do app offline */
      else if(m === 'network') avisar('O ditado precisa de internet para funcionar');
      else avisar('Não deu para ouvir agora');
    };

    rec.onend = () => {
      soltarBotao();
      cancelando = false;
    };

    try { rec.start(); }
    catch { parar(); avisar('Não deu para abrir o microfone'); }
  }

  return { suporta, ouvir, parar };
})();

/* ---------- números por extenso → referência ----------
   O reconhecimento devolve "João três dezesseis" tantas vezes quanto
   "João 3:16", então traduzimos as duas formas. */
const NUMEROS_FALADOS = {
  um:1, uma:1, dois:2, duas:2, tres:3, quatro:4, cinco:5, seis:6, sete:7,
  oito:8, nove:9, dez:10, onze:11, doze:12, treze:13, catorze:14, quatorze:14,
  quinze:15, dezesseis:16, dezasseis:16, dezessete:17, dezassete:17,
  dezoito:18, dezenove:19, dezanove:19, vinte:20, trinta:30, quarenta:40,
  cinquenta:50, sessenta:60, setenta:70, oitenta:80, noventa:90, cem:100,
  cento:100, duzentos:200, primeiro:1, primeira:1, segundo:2, segunda:2, terceiro:3
};

function converterNumerosFalados(frase){
  const palavras = norm(frase).split(/\s+/);
  const saida = [];
  let acumulado = null;

  const descarregar = () => {
    if(acumulado !== null){ saida.push(String(acumulado)); acumulado = null; }
  };

  palavras.forEach(p => {
    if(p === 'e' && acumulado !== null) return;          // "vinte e três"
    const n = NUMEROS_FALADOS[p];
    if(n === undefined){
      descarregar();
      // "capitulo" e "versiculo" viram separadores da referência
      if(p === 'capitulo' || p === 'capitulos') return saida.push('|cap|');
      if(p === 'versiculo' || p === 'versiculos') return saida.push('|ver|');
      return saida.push(p);
    }
    if(acumulado === null) acumulado = n;
    else if(acumulado % 100 === 0 && n < 100) acumulado += n;   // cento e dez
    else if(acumulado % 10 === 0 && n < 10) acumulado += n;     // vinte e três
    else { descarregar(); acumulado = n; }
  });
  descarregar();

  return saida.join(' ')
    .replace(/\s*\|cap\|\s*/g, ' ')
    .replace(/\s*\|ver\|\s*/g, ':')
    .replace(/\s+:/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

/* "joao 3 16" → "joao 3:16"; deixa buscas por palavra intactas */
function arrumarReferenciaFalada(txt){
  const t = converterNumerosFalados(txt);
  if(/\d+\s*:\s*\d+/.test(t)) return t.replace(/\s*:\s*/, ':');
  const m = t.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
  if(m) return m[1] + ' ' + m[2] + ':' + m[3];
  return t;
}

/* =========================================================
   CONTA E SINCRONIZAÇÃO
   O app continua inteiro sem conta: tudo vive no aparelho.
   A conta só acrescenta uma cópia no servidor, para o histórico
   sobreviver à troca de celular.
   ========================================================= */
const Conta = (function(){
  let usuario = null;
  let sujo = false;
  let enviando = false;
  let ultimaSync = null;
  let temporizador = null;

  const api = async (caminho, opcoes) => {
    const r = await fetch(caminho, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    }, opcoes || {}));
    let corpo = {};
    try { corpo = await r.json(); } catch {}
    if(!r.ok) throw new Error(corpo.erro || ('Erro ' + r.status));
    return corpo;
  };

  /* ---------- o que sai e entra do aparelho ---------- */
  function coletarLocal(){
    return {
      favoritos:      lerJSON(CHAVE_FAVS, '[]'),
      notas:          lerJSON(CHAVE_NOTAS, '{}'),
      destaques:      lerJSON(CHAVE_MARCAS, '{}'),
      oracoes:        lerJSON(CHAVE_ORACOES, '[]'),
      capitulosLidos: lerJSON(CHAVE_LIDOS, '{}'),
      atividade:      lerJSON(CHAVE_ATIVIDADE, '[]'),
      planos:         lerJSON(CHAVE_PLANOS, '{}')
    };
  }

  function aplicarLocal(d){
    if(!d) return;
    const grava = (chave, valor) => localStorage.setItem(chave, JSON.stringify(valor));
    if(d.favoritos)      grava(CHAVE_FAVS, d.favoritos);
    if(d.notas)          grava(CHAVE_NOTAS, d.notas);
    if(d.destaques)      grava(CHAVE_MARCAS, d.destaques);
    if(d.oracoes)        grava(CHAVE_ORACOES, d.oracoes);
    if(d.capitulosLidos) grava(CHAVE_LIDOS, d.capitulosLidos);
    if(d.atividade)      grava(CHAVE_ATIVIDADE, d.atividade);
    if(d.planos)         grava(CHAVE_PLANOS, d.planos);
    renderFavoritos();
    renderOracoes();
    atualizarStats();
    atualizarProgressoBiblia();
    montarPlanos();
  }

  /* ---------- mesclagem ----------
     Sempre por união. Entrar numa conta nunca deve apagar o que já
     existia no aparelho, e sincronizar nunca deve apagar o que já
     estava no servidor: sem histórico de exclusões, não há como
     distinguir "apagado lá" de "ainda não chegou aqui". */
  const maisNovo = (a, b) => (String(a || '') >= String(b || '') ? a : b);

  function unirPorChave(listaA, listaB, campo){
    const mapa = new Map();
    (listaA || []).forEach(x => { if(x && x[campo] != null) mapa.set(x[campo], x); });
    (listaB || []).forEach(x => {
      if(!x || x[campo] == null) return;
      const atual = mapa.get(x[campo]);
      if(!atual) return mapa.set(x[campo], x);
      /* mesmo item nos dois lados: fica o que foi mexido por último */
      mapa.set(x[campo], String(x.data || '') > String(atual.data || '') ? x : atual);
    });
    return [...mapa.values()];
  }

  function unirObjetos(a, b, aoColidir){
    const saida = Object.assign({}, b || {});
    Object.keys(a || {}).forEach(k => {
      saida[k] = (k in saida && aoColidir) ? aoColidir(a[k], saida[k]) : a[k];
    });
    return saida;
  }

  function mesclarDados(local, remoto){
    if(!remoto) return local;
    if(!local) return remoto;
    return {
      favoritos: unirPorChave(local.favoritos, remoto.favoritos, 'chave'),
      oracoes:   unirPorChave(local.oracoes, remoto.oracoes, 'id'),
      notas:     unirObjetos(local.notas, remoto.notas,
                   (l, r) => (String(l && l.data) >= String(r && r.data) ? l : r)),
      /* cor é escolha visual: vale a do aparelho em uso */
      destaques: unirObjetos(local.destaques, remoto.destaques, (l) => l),
      capitulosLidos: unirObjetos(local.capitulosLidos, remoto.capitulosLidos, (l, r) => l || r),
      atividade: [...new Set([...(local.atividade || []), ...(remoto.atividade || [])])].sort().slice(-400),
      planos: unirObjetos(local.planos, remoto.planos,
                (l, r) => [...new Set([...(l || []), ...(r || [])])].sort((x, y) => x - y))
    };
  }

  /* ---------- ciclo de sincronização ---------- */
  async function sincronizar(silencioso){
    if(!usuario) return;
    try{
      const { dados: remoto } = await api('/api/sincronizar');
      const mesclado = mesclarDados(coletarLocal(), remoto);
      aplicarLocal(mesclado);
      const r = await api('/api/sincronizar', {
        method: 'PUT',
        body: JSON.stringify({ dados: mesclado })
      });
      sujo = false;
      ultimaSync = r.atualizadoEm || new Date().toISOString();
      pintarPainel();
      if(!silencioso) avisar('Tudo sincronizado');
    }catch(e){
      if(!silencioso) avisar(e.message || 'Não deu para sincronizar');
    }
  }

  async function enviarSePendente(){
    if(!usuario || !sujo || enviando) return;
    enviando = true;
    try{
      const r = await api('/api/sincronizar', {
        method: 'PUT',
        body: JSON.stringify({ dados: coletarLocal() })
      });
      sujo = false;
      ultimaSync = r.atualizadoEm || new Date().toISOString();
      pintarPainel();
    }catch{ /* segue offline; tenta de novo depois */ }
    finally{ enviando = false; }
  }

  function marcarSujo(){
    if(!usuario) return;
    sujo = true;
    clearTimeout(temporizador);
    temporizador = setTimeout(enviarSePendente, 4000);
    pintarPainel();
  }

  /* ---------- entrar, cadastrar, sair, excluir ---------- */
  async function entrar(email, senha){
    const r = await api('/api/conta', {
      method: 'POST',
      body: JSON.stringify({ acao: 'entrar', email, senha })
    });
    usuario = r.usuario;
    pintarPainel();
    await sincronizar(true);
    avisar('Bem-vindo de volta');
  }

  async function registrar(email, senha, consentimento){
    const r = await api('/api/conta', {
      method: 'POST',
      body: JSON.stringify({ acao: 'registrar', email, senha, consentimento })
    });
    usuario = r.usuario;
    pintarPainel();
    await sincronizar(true);
    avisar('Conta criada');
  }

  async function sair(){
    try{ await enviarSePendente(); }catch{}
    try{ await api('/api/conta', { method: 'POST', body: JSON.stringify({ acao: 'sair' }) }); }catch{}
    usuario = null;
    ultimaSync = null;
    sujo = false;
    pintarPainel();
    /* os dados continuam no aparelho: sair não é apagar */
    avisar('Você saiu da conta');
  }

  async function excluir(senha){
    await api('/api/conta', {
      method: 'POST',
      body: JSON.stringify({ acao: 'excluir', senha })
    });
    usuario = null;
    ultimaSync = null;
    pintarPainel();
    avisar('Conta e dados do servidor excluídos');
  }

  async function verificarSessao(){
    try{
      const r = await api('/api/conta', { method: 'POST', body: JSON.stringify({ acao: 'eu' }) });
      usuario = r.usuario || null;
      pintarPainel();
      if(usuario) sincronizar(true);
    }catch{
      usuario = null;
      pintarPainel();
    }
  }

  return {
    get usuario(){ return usuario; },
    get sujo(){ return sujo; },
    get ultimaSync(){ return ultimaSync; },
    coletarLocal, aplicarLocal, mesclarDados,
    sincronizar, marcarSujo, enviarSePendente,
    entrar, registrar, sair, excluir, verificarSessao
  };
})();

/* ---------- botões de ouvir ---------- */

/* montar() é chamado no clique, para que o texto lido seja
   sempre o que está na tela naquele momento. */
function criarBotaoOuvir(rotulo, montar, opcoes){
  const op = opcoes || {};
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-ouvir' + (op.classe ? ' ' + op.classe : '');
  b.setAttribute('aria-label', rotulo);
  const ico = document.createElement('span');
  ico.className = 'ico';
  ico.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = '/icon-speaker.png';
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.decoding = 'async';
  ico.appendChild(img);
  b.appendChild(ico);
  b.appendChild(document.createTextNode(' ' + rotulo));
  b.onclick = () => {
    if(b.classList.contains('tocando')) return Voz.parar();
    Voz.falar(montar(), Object.assign({ botao: b }, op.voz || {}));
  };
  return b;
}

function criarOuvirMini(rotulo, montar, opcoes){
  const op = opcoes || {};
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ouvir-mini';
  b.innerHTML = '<img src="/icon-speaker.png" alt="" width="14" height="14" decoding="async">';
  b.setAttribute('aria-label', rotulo);
  b.title = rotulo;
  b.onclick = (e) => {
    e.stopPropagation();
    if(b.classList.contains('tocando')) return Voz.parar();
    Voz.falar(montar(), Object.assign({ botao: b }, op.voz || {}));
  };
  return b;
}

/* ---------- rede ---------- */
function juntarPartes(partes){
  return (partes||[]).map(p => typeof p === 'string' ? p : (p && p.text ? p.text : ''))
                     .join(' ').replace(/\s+/g,' ').trim();
}

/* Busca um capítulo numa versão específica.
   Extraído de buscarCapitulo para a comparação entre versões poder
   pedir a mesma passagem em cada uma, sem mexer na versão atual. */
async function buscarCapituloEm(v, nr, cap){
  const livro = livroPorNr(nr);
  if(!livro) throw new Error('Livro inválido.');

  const chave = v.fonte + '/' + v.id + '/' + nr + '/' + cap;
  if(cache.has(chave)) return cache.get(chave);

  const url = v.fonte === 'helloao'
    ? `${HELLOAO}/${v.id}/${livro.sigla}/${cap}.json`
    : `${BASE}/${v.id}/${nr}/${cap}.json`;

  const r = await fetch(url);
  if(!r.ok){
    /* =========================================================
       404 NÃO É "NÃO RESPONDEU"

       Metade do catálogo em português é só Novo Testamento — a
       Bíblia Livre para Todos e a Tradução para Tradutores entre
       elas. Pedir Gênesis a essas duas devolve 404, e o app
       tratava isso como falha de rede: dizia "não respondeu
       agora", convidando a tentar de novo uma coisa que nunca vai
       dar certo. O 404 é permanente e tem de ser dito como tal.
       ========================================================= */
    const e = new Error(r.status === 404
      ? 'Esta versão não traz ' + livro.nome + '.'
      : 'A fonte respondeu ' + r.status + ' para esse capítulo.');
    e.status = r.status;
    e.semLivro = r.status === 404;
    throw e;
  }
  const d = await r.json();

  let itens;
  if(v.fonte === 'helloao'){
    if(!d || !d.chapter || !Array.isArray(d.chapter.content)) throw new Error('Resposta em formato inesperado.');
    itens = d.chapter.content
      .filter(c => c.type === 'verse' || c.type === 'heading')
      .map(c => c.type === 'heading'
        ? {tipo:'titulo', texto:juntarPartes(c.content)}
        : {tipo:'verso', numero:c.number, texto:juntarPartes(c.content)});
  } else {
    if(!d || !Array.isArray(d.verses)) throw new Error('Resposta em formato inesperado.');
    itens = d.verses.map(x => ({tipo:'verso', numero:x.verse, texto:(x.text||'').trim()}));
  }
  /* a versão viaja junto: sem isso, quem recebe o capítulo não sabe qual
     das fontes respondeu de fato — e o cartão do versículo assinava com o
     nome da versão escolhida mesmo quando quem serviu foi a reserva */
  const saida = {itens, versao: v};
  cache.set(chave, saida);
  return saida;
}

/* =========================================================
   LIVRO INTEIRO DE UMA VEZ
   A busca por palavra pedia um capítulo por vez: 929 idas e
   voltas para varrer o Antigo Testamento. O gargalo não é o
   texto, é a viagem — o getBible serve o livro inteiro numa
   resposta só, o que troca 929 pedidos por 39.
   Não dá para confiar cegamente que o endereço existe em toda
   fonte, então a primeira falha desliga o atalho para o resto
   da sessão e tudo volta a funcionar capítulo a capítulo.
   ========================================================= */
const semLivroInteiro = new Set();
const provaLivroInteiro = new Map();

async function buscarLivroInteiro(v, nr){
  if(v.fonte !== 'getbible' || semLivroInteiro.has(v.id)) return null;
  /* A primeira chamada vale como prova. Sem isso os livros que a busca pede
     em paralelo saem todos juntos, antes de qualquer um registrar a falha,
     e uma fonte sem esse endereço custaria um pedido perdido por livro em
     voo em vez de um só. */
  if(!provaLivroInteiro.has(v.id)){
    const p = pedirLivroInteiro(v, nr);
    provaLivroInteiro.set(v.id, p);
    return p;
  }
  await provaLivroInteiro.get(v.id).catch(() => {});
  if(semLivroInteiro.has(v.id)) return null;
  return pedirLivroInteiro(v, nr);
}

async function pedirLivroInteiro(v, nr){
  try{
    const r = await fetch(`${BASE}/${v.id}/${nr}.json`);
    if(!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    if(!d || !Array.isArray(d.chapters)) throw new Error('formato inesperado');
    /* alimenta o mesmo cache que buscarCapituloEm consulta: daqui em diante
       qualquer parte do app que peça um capítulo desse livro já o tem */
    const caps = new Map();
    for(const c of d.chapters){
      if(!c || !Array.isArray(c.verses)) continue;
      const itens = c.verses.map(x => ({ tipo: 'verso', numero: x.verse, texto: (x.text || '').trim() }));
      const saida = { itens };
      caps.set(c.chapter, saida);
      cache.set(v.fonte + '/' + v.id + '/' + nr + '/' + c.chapter, saida);
    }
    if(!caps.size) throw new Error('livro sem capítulos');
    return caps;
  }catch(e){
    /* uma falha basta: insistir 65 vezes sairia mais caro que o atalho economiza */
    semLivroInteiro.add(v.id);
    console.info('Livro inteiro indisponível em', v.nome, '—', e.message);
    return null;
  }
}

/* Texto de um versículo numa versão específica (usado na comparação) */
async function buscarVersoEm(v, nr, cap, verso){
  const d = await buscarCapituloEm(v, nr, cap);
  const x = d.itens.find(i => i.tipo === 'verso' && i.numero === verso);
  /* O capítulo veio, o versículo não. Não é falha de rede: versões
     diferentes dividem os versículos de maneira diferente, e há quem
     junte dois num só. Dizer "não respondeu" aqui seria mentir duas
     vezes — respondeu, e o texto existe, só não com este número. */
  if(!x){
    const e = new Error('Esta versão não numera este versículo separadamente.');
    e.semVerso = true;
    throw e;
  }
  return x.texto;
}

async function buscarCapitulo(nr, cap){
  if(!versaoAtual || !versaoAtual.id){
    versaoAtual = VERSOES[0];
  }
  const livro = livroPorNr(nr);
  if(!livro) throw new Error('Livro inválido.');

  const tentar = (v) => buscarCapituloEm(v, nr, cap);

  try {
    return await tentar(versaoAtual);
  } catch(e1) {
    // Fallback automático para a Bíblia Livre se a versão atual falhar
    const fallback = VERSOES.find(v => v.id === 'livre') || VERSOES[0];
    if(fallback && fallback.id !== versaoAtual.id){
      try {
        const r = await tentar(fallback);
        console.info('Fallback para', fallback.nome, 'após falha em', versaoAtual.nome);
        return r;
      } catch(_) {}
    }
    throw e1;
  }
}

async function buscarVerso(nr, cap, verso){
  const d = await buscarCapitulo(nr, cap);
  const v = d.itens.find(x => x.tipo === 'verso' && x.numero === verso);
  if(!v) throw new Error('Versículo não existe nesta versão.');
  /* assina com quem serviu, não com quem foi escolhido: quando a versão
     do momento não traz o livro, quem responde é a reserva, e atribuir o
     texto dela à outra tradução é dizer uma coisa que não é verdade */
  return {texto:v.texto, versao:(d.versao || versaoAtual).nome};
}

function blocoErro(msg, aoTentar){
  const d = document.createElement('div');
  d.className = 'erro';
  d.innerHTML = '<b>Não deu para carregar</b>' + msg +
    '<ul><li>Se você está numa pré-visualização, o ambiente pode bloquear requisições externas. Baixe o arquivo e abra direto no navegador, ou publique num servidor.</li>' +
    '<li>Abra o console com F12 e veja se aparece erro de <code>CORS</code> ou de rede.</li></ul>';
  if(aoTentar){
    const b = document.createElement('button');
    b.className = 'btn claro';
    b.style.marginTop = '14px';
    b.textContent = 'Tentar de novo';
    b.onclick = aoTentar;
    d.appendChild(b);
  }
  return d;
}

/* ---------- cartão ---------- */
function cartaoVersiculo(texto, nr, cap, verso, versao, extra, opcoes){
  const ref = `${livroPorNr(nr).nome} ${cap}:${verso}`;
  const c = document.createElement('div');
  c.className = 'cartao';
  c.style.animation = 'fadeUp 0.35s ease both';
  const favAtivo = estaFavorito(nr, cap, verso);
  c.innerHTML =
    `<div class="cab-cartao">
       <div class="referencia">${ref}<small>${versao}</small></div>
       <div class="ferr-cartao">
         <button class="copiar" title="Compartilhar" aria-label="Compartilhar versículo"><img src="/icon-share.png" alt="" width="16" height="16" decoding="async"></button>
         <button class="ouvir" title="Ouvir" aria-label="Ouvir versículo"><img src="/icon-speaker.png" alt="" width="16" height="16" decoding="async"></button>
       </div>
     </div>
     <p class="versiculo"></p>
     <a href="#sec-biblia" class="link-cap">Ler o capítulo completo →</a>
     <div class="acoes-verso">
       <button class="btn-acao btn-fav ${favAtivo ? 'ativo' : ''}" type="button">${favAtivo ? '★ Favorito' : '☆ Favoritar'}</button>
       <button class="btn-acao btn-img" type="button"><svg class="i" aria-hidden="true"><use href="#i-imagem"/></svg> Gerar imagem</button>
     </div>`;
  c.querySelector('.versiculo').textContent = texto;
  c.querySelector('.link-cap').onclick = e => { e.preventDefault(); abrirLeitura(nr, cap, verso); };
  c.querySelector('.copiar').onclick = () => {
    const t = `"${texto}"\n${ref} — ${versao}`;
    compartilharTexto(t, linkDoVerso(nr, cap, verso));
  };
  const op = opcoes || {};
  /* O que será lido em voz: referência, versículo e — no devocional —
     também a reflexão, a meditação e a oração. */
  const montarPartes = () => [
    { texto: refFalada(nr, cap, verso), rotulo: 'Referência', el: c.querySelector('.referencia') },
    { texto, rotulo: 'Versículo', el: c.querySelector('.versiculo') }
  ].concat(typeof op.partesExtra === 'function' ? op.partesExtra() : (op.partesExtra || []));
  const opVoz = { titulo: op.titulo || ref };

  const btnOuvirTopo = c.querySelector('.ouvir');
  btnOuvirTopo.onclick = () => {
    if(btnOuvirTopo.classList.contains('tocando')) return Voz.parar();
    Voz.falar(montarPartes(), Object.assign({ botao: btnOuvirTopo }, opVoz));
  };

  /* No percurso guiado o cartão já vem acompanhado de "Ouvir e seguir", que
     começa lendo justamente este versículo. Os dois botões grandes, com o
     mesmo ícone e a um dedo de distância, não davam para diferenciar — quem
     chama pede para omitir este, e o alto-falante do cabeçalho continua ali
     para ouvir só o versículo. */
  if(!op.semBotaoOuvir){
    const btnOuvir = criarBotaoOuvir(op.rotuloBotao || 'Ouvir', montarPartes, { voz: opVoz });
    c.querySelector('.acoes-verso').prepend(btnOuvir);
  }
  c.querySelector('.btn-fav').onclick = function(){
    const ativo = alternarFavorito({nr, cap, verso, texto, versao, ref});
    this.classList.toggle('ativo', ativo);
    this.textContent = ativo ? '★ Favorito' : '☆ Favoritar';
  };
  c.querySelector('.btn-img').onclick = () =>
    abrirGeradorImagem(texto, ref, versao,
      typeof temaAtual !== 'undefined' ? temaAtual : '', [nr, cap, verso]);
  if(extra) c.appendChild(extra);
  return c;
}

/* ---------- devocional do dia ---------- */
/* =========================================================
   PERCURSO GUIADO DO DEVOCIONAL
   O devocional era um cartão para rolar. Virou um caminho com
   começo, meio e fim — um passo por vez, com a trilha de
   progresso à vista. Ler uma página e ser conduzido por algo
   são experiências diferentes, e a segunda serve melhor quem
   tem dificuldade com a primeira.
   ========================================================= */

const CHAVE_MODO_DEVO = 'lampada-devo-modo';   // 'percurso' | 'tudo'
const modoDevocional = () => localStorage.getItem(CHAVE_MODO_DEVO) || 'percurso';

/* Estimativa honesta: conta as palavras e usa duas velocidades —
   quem lê rápido pelos olhos e quem ouve na voz configurada. */
function estimarMinutos(textos){
  const palavras = textos.join(' ').trim().split(/\s+/).filter(Boolean).length;
  const lendo   = palavras / 200;
  const ouvindo = palavras / (155 * (Voz.prefs.vel || 1));
  const min = Math.max(1, Math.round(lendo));
  const max = Math.max(min, Math.round(ouvindo));
  return min === max ? min + ' min' : min + '–' + max + ' min';
}

let percursoAtual = null;

function montarPercurso(dados){
  const alvo = $('cartao-hoje');
  const { nr, cap, verso, texto, versao, reflexao, meditacao, oracao } = dados;
  const ref = livroPorNr(nr).nome + ' ' + cap + ':' + verso;

  const passos = [
    { rotulo: 'Versículo do dia',  titulo: ref, texto, fala: refFalada(nr, cap, verso) + '. ' + texto },
    { rotulo: 'Reflexão',      texto: reflexao,  fala: 'Reflexão. ' + reflexao },
    { rotulo: 'Para meditar',  texto: meditacao, fala: 'Para meditar. ' + meditacao },
    { rotulo: 'Oração',        texto: oracao,    fala: 'Oração. ' + oracao, italico: true }
  ];
  const total = passos.length;
  let i = 0;

  percursoAtual = { passos, ir: (n) => { i = n; desenhar(); } };

  const cartao = document.createElement('div');
  cartao.className = 'cartao';
  alvo.innerHTML = '';
  alvo.appendChild(cartao);

  function trilha(){
    const t = document.createElement('div');
    t.className = 'trilha';
    t.setAttribute('role', 'progressbar');
    t.setAttribute('aria-valuemin', '1');
    t.setAttribute('aria-valuemax', String(total));
    t.setAttribute('aria-valuenow', String(Math.min(i + 1, total)));
    t.setAttribute('aria-label', 'Passo ' + Math.min(i + 1, total) + ' de ' + total);
    for(let k = 0; k < total; k++){
      if(k) {
        const tr = document.createElement('span');
        tr.className = 'traco' + (k <= i ? ' feito' : '');
        t.appendChild(tr);
      }
      const p = document.createElement('span');
      p.className = 'ponto' + (k < i ? ' feito' : k === i ? ' atual' : '');
      t.appendChild(p);
    }
    return t;
  }

  function desenhar(){
    cartao.innerHTML = '';

    /* passo final: o dia se fecha aqui */
    if(i >= total){
      registrarAtividade();
      const fim = document.createElement('div');
      fim.className = 'fim-percurso';
      Metricas.anotar('devocional_completo');
      const streak = calcularStreak();
      fim.innerHTML =
        `<div class="selo" aria-hidden="true">✓</div>
         <h3>Devocional de hoje concluído</h3>
         <p></p>
         <div class="acoes-fim"></div>`;
      fim.querySelector('p').textContent = streak > 1
        ? streak + ' dias seguidos com a Palavra. Que isso siga te sustentando.'
        : 'Que a Palavra de hoje te acompanhe pelo dia.';

      const acoes = fim.querySelector('.acoes-fim');
      const botao = (rotulo, ico, classe, aoTocar) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-ouvir' + (classe ? ' ' + classe : '');
        b.style.justifyContent = 'center';
        const s = document.createElement('span');
        s.className = 'ico';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = ico;
        b.appendChild(s);
        b.appendChild(document.createTextNode(rotulo));
        b.onclick = aoTocar;
        return b;
      };
      acoes.appendChild(botao('Registrar um pedido de oração', '✝', '', () => {
        mostrarSecao('sec-oracoes');
        setTimeout(() => { const c = $('campo-oracao'); if(c) c.focus(); }, 500);
      }));
      acoes.appendChild(botao('Percorrer de novo', '↺', 'claro', () => {
        Voz.parar(true); i = 0; desenhar();
      }));

      cartao.appendChild(fim);
      cartao.appendChild(botaoAlternar());
      atualizarStats();
      return;
    }

    const passo = passos[i];

    const cabeca = document.createElement('div');
    cabeca.className = 'cabeca-percurso';
    cabeca.appendChild(trilha());
    const tempo = document.createElement('span');
    tempo.className = 'tempo-percurso';
    tempo.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-relogio"/></svg> ';
    tempo.append(estimarMinutos(passos.map(p => p.texto)));
    cabeca.appendChild(tempo);
    cartao.appendChild(cabeca);

    const corpo = document.createElement('div');
    corpo.className = 'passo';

    const rot = document.createElement('p');
    rot.className = 'rotulo-passo';
    rot.textContent = passo.rotulo;
    rot.appendChild(chipTema(dados.tema));
    corpo.appendChild(rot);

    /* o primeiro passo mantém o cartão de versículo inteiro, com
       favoritar, imagem e link para o capítulo */
    if(i === 0){
      const c = cartaoVersiculo(texto, nr, cap, verso, versao, null,
        { titulo: ref, semBotaoOuvir: true });
      c.style.border = '0'; c.style.padding = '0'; c.style.boxShadow = 'none';
      corpo.appendChild(c);
    } else {
      const t = document.createElement('p');
      t.className = 'texto-passo' + (passo.italico ? ' oracao' : '');
      t.textContent = passo.texto;
      corpo.appendChild(t);
    }
    cartao.appendChild(corpo);

    const nav = document.createElement('div');
    nav.className = 'navega-passo';
    if(i > 0){
      const volta = document.createElement('button');
      volta.type = 'button';
      volta.className = 'voltar-passo';
      volta.textContent = '‹ Voltar';
      volta.onclick = () => { Voz.parar(true); i--; desenhar(); };
      nav.appendChild(volta);
    }

    /* Ouvir e seguir: a voz lê do passo atual até o fim e a tela
       acompanha sozinha, virando de passo a cada bloco.
       "inicio" fica congelado nesta renderização — usar o i, que muda
       durante a leitura, faria a conta escorregar a cada troca. */
    const inicio = i;
    const ouvir = criarBotaoOuvir('Ouvir e seguir',
      () => passos.slice(inicio).map(p => ({ texto: p.fala, rotulo: p.rotulo })),
      { voz: {
          titulo: 'Devocional do dia',
          aoTrocarParte: (idx) => {
            const alvo = inicio + idx;
            if(alvo !== i){ i = alvo; desenhar(); }
          },
          aoTerminar: () => { i = total; desenhar(); }
        } });
    nav.appendChild(ouvir);

    const seguir = document.createElement('button');
    seguir.type = 'button';
    seguir.className = 'btn';
    seguir.textContent = i === total - 1 ? 'Concluir ✓' : 'Continuar ›';
    seguir.onclick = () => { Voz.parar(true); i++; desenhar(); };
    nav.appendChild(seguir);

    cartao.appendChild(nav);
    cartao.appendChild(botaoAlternar());
  }

  function botaoAlternar(){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'alternar-modo';
    b.textContent = 'Ver tudo de uma vez';
    b.onclick = () => {
      Voz.parar(true);
      localStorage.setItem(CHAVE_MODO_DEVO, 'tudo');
      montarTudoDeUmaVez(dados);
    };
    return b;
  }

  desenhar();
}

/* O formato antigo continua disponível: quem prefere rolar não perde nada */
/* O tema é o fio que costura os quatro passos. Mostrá-lo deixa a costura
   à vista, e tocar nele leva às outras promessas sobre o mesmo assunto. */
function chipTema(tema){
  const frag = document.createDocumentFragment();
  if(!tema) return frag;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tema-devo';
  b.textContent = tema;
  b.setAttribute('aria-label', 'Tema: ' + tema + '. Ver outras promessas sobre isso');
  b.onclick = () => irParaTema(tema);
  frag.appendChild(b);
  return frag;
}

function irParaTema(tema){
  const alvo = [...document.querySelectorAll('#temas .tema')].find(b => b.textContent === tema);
  if(alvo) selecionarTema(tema, alvo);
  mostrarSecao('sec-promessas');
}

function montarTudoDeUmaVez(dados){
  const alvo = $('cartao-hoje');
  const { nr, cap, verso, texto, versao, reflexao, meditacao, oracao } = dados;

  const extra = document.createElement('div');
  extra.innerHTML =
    `<div class="bloco-devo"><span class="rotulo-bloco">Reflexão</span><p></p></div>
     <div class="bloco-devo"><span class="rotulo-bloco">Para meditar</span><p></p></div>
     <div class="bloco-devo oracao"><span class="rotulo-bloco">Oração</span><p></p></div>`;
  if(dados.tema){
    const fita = document.createElement('p');
    fita.className = 'rotulo-passo';
    fita.style.marginTop = '18px';
    fita.appendChild(chipTema(dados.tema));
    extra.prepend(fita);
  }
  /* escopado aos blocos: a fita do tema também é um <p> e entraria na conta */
  const ps = extra.querySelectorAll('.bloco-devo p');
  ps[0].textContent = reflexao;
  ps[1].textContent = meditacao;
  ps[2].textContent = oracao;

  const blocos = extra.querySelectorAll('.bloco-devo');
  const partesExtra = [
    { texto: 'Reflexão. ' + reflexao,      rotulo: 'Reflexão',     el: blocos[0] },
    { texto: 'Para meditar. ' + meditacao, rotulo: 'Para meditar', el: blocos[1] },
    { texto: 'Oração. ' + oracao,          rotulo: 'Oração',       el: blocos[2] }
  ];

  alvo.innerHTML = '';
  alvo.appendChild(cartaoVersiculo(texto, nr, cap, verso, versao, extra, {
    partesExtra,
    titulo: 'Devocional do dia',
    rotuloBotao: 'Ouvir devocional completo'
  }));

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'alternar-modo';
  b.textContent = 'Voltar ao percurso guiado';
  b.onclick = () => {
    Voz.parar(true);
    localStorage.setItem(CHAVE_MODO_DEVO, 'percurso');
    montarPercurso(dados);
  };
  alvo.querySelector('.cartao').appendChild(b);
  registrarAtividade();
}

async function versiculoDoDia(){
  const alvo = $('cartao-hoje');
  alvo.innerHTML = `<div class="cartao">
    <div class="skeleton skeleton-titulo"></div>
    <div class="skeleton skeleton-linha"></div>
    <div class="skeleton skeleton-linha"></div>
    <div class="skeleton skeleton-linha w-75"></div>
  </div>`;

  const dia = diaDoAno(new Date());
  const base = devocionalDoDia(dia);
  const { nr, cap, verso } = base;
  try{
    const { texto, versao } = await buscarVerso(nr, cap, verso);
    const dados = Object.assign({ texto, versao }, base);
    if(modoDevocional() === 'tudo') montarTudoDeUmaVez(dados);
    else montarPercurso(dados);
  }catch(e){
    alvo.innerHTML = '';
    const w = document.createElement('div');
    w.className = 'cartao';
    w.appendChild(blocoErro(e.message, versiculoDoDia));
    alvo.appendChild(w);
  }
  Metricas.anotar('devocional_visto');
}

/* ---------- promessas ---------- */
let temaAtual = null;
function montarTemas(){
  const box = $('temas');
  box.innerHTML = '';
  const todos = document.createElement('button');
  todos.className = 'tema ativo';
  todos.textContent = 'Qualquer uma';
  todos.onclick = () => selecionarTema(null, todos);
  box.appendChild(todos);
  Object.keys(PROMESSAS).forEach(t => {
    const b = document.createElement('button');
    b.className = 'tema';
    b.textContent = t;
    b.onclick = () => selecionarTema(t, b);
    box.appendChild(b);
  });
}
function selecionarTema(t, botao){
  temaAtual = t;
  document.querySelectorAll('.tema').forEach(x => x.classList.remove('ativo'));
  botao.classList.add('ativo');
}
async function tirarPromessa(){
  Voz.parar(true);   // tirou outra promessa: silencia a anterior
  const area = $('area-promessa');
  area.innerHTML = '<div class="carregando"><span class="giro"></span> Abrindo a caixa…</div>';
  const pool = temaAtual ? PROMESSAS[temaAtual] : TODAS;
  const [nr,cap,verso] = pool[Math.floor(Math.random() * pool.length)];
  try{
    const {texto,versao} = await buscarVerso(nr,cap,verso);
    area.innerHTML = '';
    const cartao = cartaoVersiculo(texto,nr,cap,verso,versao,null,{
      titulo: 'Promessa',
      rotuloBotao: 'Ouvir a promessa'
    });
    cartao.style.border = '0';
    cartao.style.padding = '0';
    cartao.style.boxShadow = 'none';
    cartao.style.animation = 'popSuave 0.45s cubic-bezier(0.22, 1.2, 0.36, 1) both';
    area.appendChild(cartao);
    const outra = document.createElement('div');
    outra.style.marginTop = '20px';
    outra.innerHTML = '<button class="btn claro">Tirar outra</button>';
    outra.querySelector('button').onclick = tirarPromessa;
    area.appendChild(outra);
  }catch(e){
    area.innerHTML = '';
    area.appendChild(blocoErro(e.message, tirarPromessa));
  }
}

/* ---------- progresso de leitura ---------- */
const CHAVE_LIDOS = 'lampada-capitulos-lidos';
function carregarLidos(){
  try { return JSON.parse(localStorage.getItem(CHAVE_LIDOS) || '{}'); }
  catch { return {}; }
}
function salvarLidos(map){ localStorage.setItem(CHAVE_LIDOS, JSON.stringify(map)); Conta.marcarSujo(); }
function chaveCap(nr, cap){ return nr + ':' + cap; }
function marcouLido(nr, cap){
  Metricas.anotar('plano_dia_lido');
  const map = carregarLidos();
  map[chaveCap(nr, cap)] = true;
  salvarLidos(map);
  atualizarProgressoBiblia();
  registrarAtividade();
}
function estaLido(nr, cap){ return !!carregarLidos()[chaveCap(nr, cap)]; }
function progressoLivro(livro){
  let n = 0;
  for(let i = 1; i <= livro.caps; i++) if(estaLido(livro.nr, i)) n++;
  return n;
}
function atualizarProgressoBiblia(){
  const total = LIVROS.reduce((s, l) => s + l.caps, 0);
  let lidos = 0;
  const map = carregarLidos();
  Object.keys(map).forEach(k => { if(map[k]) lidos++; });
  const pct = total ? Math.round((lidos / total) * 100) : 0;
  const barra = $('barra-progresso-biblia');
  const txt = $('txt-progresso-biblia');
  if(barra) barra.style.width = pct + '%';
  if(txt) txt.textContent = pct + '% · ' + lidos + '/' + total + ' caps.';
}

/* ---------- bíblia ---------- */
function desenharLivros(){
  const alvo = $('lista-livros');
  alvo.innerHTML = '';
  [['Antigo Testamento', l => l.nr <= 39], ['Novo Testamento', l => l.nr > 39]].forEach(([titulo,cond]) => {
    const h = document.createElement('p');
    h.className = 'grupo';
    h.textContent = titulo;
    const grade = document.createElement('div');
    grade.className = 'livros';
    LIVROS.filter(cond).forEach(l => {
      const b = document.createElement('button');
      const prog = progressoLivro(l);
      b.className = 'livro' + (prog === l.caps ? ' completo' : (prog > 0 ? ' parcial' : ''));
      b.innerHTML = `${l.nome}<small>${prog}/${l.caps} cap.</small>`;
      b.onclick = () => abrirCapitulos(l);
      grade.appendChild(b);
    });
    alvo.appendChild(h);
    alvo.appendChild(grade);
  });
  atualizarProgressoBiblia();
}

function abrirCapitulos(livro){
  $('titulo-livro').textContent = livro.nome;
  const grade = $('lista-capitulos');
  grade.innerHTML = '';
  for(let i = 1; i <= livro.caps; i++){
    const b = document.createElement('button');
    b.className = 'cap' + (estaLido(livro.nr, i) ? ' lido' : '');
    b.textContent = i;
    b.onclick = () => abrirLeitura(livro.nr, i);
    grade.appendChild(b);
  }
  mostrarNivel('capitulos');
  mostrarSecao('sec-biblia');
}

/* =========================================================
   CONTINUAR A LEITURA LIVRE

   Medido: rolar até o meio de um capítulo, sair e voltar devolvia a
   pessoa ao topo — e não havia nada guardado no aparelho sobre onde
   ela estava. O cartão "Continuar de onde parou", da tela inicial, só
   aparece com um plano em andamento (planoEmAndamento), então quem lê
   por conta própria — que é como a maioria usa uma Bíblia — fechava o
   app no meio de Salmos 119 e no dia seguinte recomeçava procurando o
   lugar com o olho.

   O que fica guardado é o versículo, não a altura da rolagem: pixel
   não sobrevive a mudar o tamanho da letra, girar o aparelho ou trocar
   de versão da Bíblia. Versículo sobrevive a tudo isso.
   ========================================================= */
const CHAVE_PARADA = 'lampada-leitura-parou';

function lerParada(){
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PARADA) || 'null');
    if(!p || !livroPorNr(p.nr)) return null;
    return p;
  } catch(_){ return null; }
}

function guardarParada(nr, cap, verso){
  /* o versículo 1 não é uma parada: é o começo, e não há o que retomar */
  if(!verso || verso < 2){ esquecerParada(); return; }
  try {
    localStorage.setItem(CHAVE_PARADA, JSON.stringify({
      nr, cap, verso, data: new Date().toISOString()
    }));
  } catch(_){ /* aparelho sem espaço: a leitura funciona, só não lembra */ }
  montarRetomar();
}

function esquecerParada(){
  try { localStorage.removeItem(CHAVE_PARADA); } catch(_){}
  montarRetomar();
}

/* O primeiro versículo cujo topo já passou do cabeçalho: é o que a
   pessoa está lendo, não o que está entrando na tela por baixo. */
function versoNoTopo(){
  const area = $('area-leitura');
  if(!area) return null;
  const barra = document.querySelector('header.barra');
  const corte = (barra ? barra.getBoundingClientRect().bottom : 0) + 8;
  let achado = null;
  for(const el of area.querySelectorAll('.v')){
    const r = el.getBoundingClientRect();
    if(r.bottom > corte){ achado = el; break; }
  }
  if(!achado) return null;
  const sup = achado.querySelector('sup');
  const n = sup ? Number(sup.textContent) : NaN;
  return Number.isFinite(n) ? n : null;
}

let capituloNaTela = null;   /* {nr, cap} do que está aberto agora */
let anotarParada = null;

function ligarMemoriaDaLeitura(){
  if(anotarParada) return;
  let esperando = false;
  anotarParada = () => {
    if(esperando || !capituloNaTela) return;
    esperando = true;
    /* uma gravação por quadro de rolagem seria uma escrita no disco a
       cada pixel; o atraso junta o movimento inteiro numa só */
    setTimeout(() => {
      esperando = false;
      if(!capituloNaTela) return;
      const aberta = $('nivel-leitura') && !$('nivel-leitura').classList.contains('oculto');
      if(!aberta) return;
      const v = versoNoTopo();
      if(v) guardarParada(capituloNaTela.nr, capituloNaTela.cap, v);
      pintarFioDoCapitulo();
    }, 400);
  };
  window.addEventListener('scroll', anotarParada, { passive: true });
}

function montarRetomar(){
  const sec = $('sec-retomar');
  const cx = $('cartao-retomar');
  if(!sec || !cx) return;
  const p = lerParada();
  sec.classList.toggle('oculto', !p);
  if(!p) return;

  const livro = livroPorNr(p.nr);
  const ref = livro.nome + ' ' + p.cap + ':' + p.verso;
  cx.textContent = '';

  const nome = document.createElement('div');
  nome.className = 'continuar-nome';
  nome.textContent = ref;
  cx.appendChild(nome);

  const meta = document.createElement('div');
  meta.className = 'continuar-meta';
  meta.textContent = 'Você parou aqui ' + quandoFoi(p.data) + '.';
  cx.appendChild(meta);

  const acoes = document.createElement('div');
  acoes.className = 'continuar-acoes';
  const ir = document.createElement('button');
  ir.type = 'button';
  ir.className = 'btn';
  ir.textContent = 'Continuar em ' + ref;
  ir.onclick = () => { irParaAba('biblia', { semRolar: true }); abrirLeitura(p.nr, p.cap, p.verso); };
  acoes.appendChild(ir);
  const sair = document.createElement('button');
  sair.type = 'button';
  sair.className = 'btn-remover';
  sair.textContent = 'Dispensar';
  sair.onclick = esquecerParada;
  acoes.appendChild(sair);
  cx.appendChild(acoes);
}

/* "hoje", "ontem" ou a data: dizer "há 19 horas" obriga a pessoa a
   fazer a conta para saber se foi hoje de manhã ou ontem à noite */
function quandoFoi(iso){
  const d = new Date(iso);
  if(isNaN(d)) return 'da última vez';
  const dia = x => x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate();
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 86400000);
  if(dia(d) === dia(agora)) return 'hoje';
  if(dia(d) === dia(ontem)) return 'ontem';
  return 'em ' + d.toLocaleDateString('pt-BR');
}

/* =========================================================
   O CABEÇALHO DA LEITURA

   Ele substitui, enquanto se lê, a barra azul do app e os 258px de
   busca e seletores. Nada some do app: a busca volta pela lupa, o
   "Ouvir" aciona o mesmo botão que estava dentro do capítulo, e o Aa
   usa a mesma escala de fonte da gaveta.
   ========================================================= */
function montarCabecaDaLeitura(nr, cap){
  const livro = livroPorNr(nr);
  const rot = $('cl-livro');
  /* o rótulo do voltar diz para ONDE se volta, e não "voltar": quem lê
     João 3 volta para a lista de capítulos de João */
  if(rot) rot.textContent = livro ? livro.nome : 'Capítulos';
  const ouvir = $('cl-ouvir');
  if(ouvir) ouvir.classList.remove('tocando');
  fecharBuscaDaLeitura();
  pintarFioDoCapitulo();
}

/* O fio de 2px no pé do cabeçalho: quanto do capítulo já passou. */
function pintarFioDoCapitulo(){
  const fio = $('cl-fio');
  const area = $('area-leitura');
  if(!fio || !area || document.documentElement.dataset.lendo !== '1') return;
  const r = area.getBoundingClientRect();
  const alturaUtil = r.height - window.innerHeight;
  /* Capítulo que cabe inteiro na tela não tem progresso: mostrar o fio
     cheio ali seria um filete azul sem informação nenhuma, parecendo
     borda do cabeçalho. Some. */
  if(alturaUtil <= 0){
    fio.style.width = '0';
    fio.removeAttribute('aria-valuenow');
    return;
  }
  const pct = Math.max(0, Math.min(100, (-r.top / alturaUtil) * 100));
  fio.style.width = pct + '%';
  fio.setAttribute('aria-valuenow', Math.round(pct));
}

function fecharBuscaDaLeitura(){
  delete document.documentElement.dataset.buscaLeitura;
  const b = $('cl-busca');
  if(b) b.setAttribute('aria-expanded', 'false');
  if(typeof BuscaMemoria === 'object') BuscaMemoria.fechar();
}

function alternarBuscaDaLeitura(){
  const raiz = document.documentElement;
  const b = $('cl-busca');
  if(raiz.dataset.buscaLeitura === '1'){ fecharBuscaDaLeitura(); return; }
  raiz.dataset.buscaLeitura = '1';
  if(b) b.setAttribute('aria-expanded', 'true');
  const campo = $('busca');
  if(campo){ campo.focus(); BuscaMemoria.renderRecentes(); }
}

/* Reabrir o mesmo capítulo devolve ao ponto — mas nunca em silêncio.
   Rolar sozinho para o meio de um texto assusta; o aviso diz o que
   aconteceu e oferece a volta ao início, que é o outro caminho que a
   pessoa pode querer. */
function retomarSeForOCaso(nr, cap, destacar){
  if(destacar) return;                    /* veio por link ou por busca */
  const p = lerParada();
  if(!p || p.nr !== nr || p.cap !== cap || p.verso < 2) return;
  const alvo = [...$('area-leitura').querySelectorAll('.v')].find(el => {
    const sup = el.querySelector('sup');
    return sup && Number(sup.textContent) === p.verso;
  });
  if(!alvo) return;
  alvo.scrollIntoView({ behavior: 'auto', block: 'center' });
  avisar('Voltamos ao versículo ' + p.verso, {
    rotulo: 'Ir ao início',
    aoTocar: () => {
      const primeiro = $('area-leitura').querySelector('.v');
      if(primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

async function abrirLeitura(nr, cap, destacar, autoOuvir){
  Voz.parar(true);   // trocou de capítulo: não continua lendo o anterior
  mostrarNivel('leitura');
  mostrarSecao('sec-biblia');
  const alvo = $('area-leitura');
  alvo.innerHTML = '<div class="carregando"><span class="giro"></span> Abrindo o capítulo…</div>';
  try{
    const d = await buscarCapitulo(nr, cap);
    alvo.innerHTML = '';
    alvo.appendChild(desenharCapitulo(d, nr, cap, destacar));
    marcouLido(nr, cap);
    capituloNaTela = { nr, cap };
    ligarMemoriaDaLeitura();
    montarCabecaDaLeitura(nr, cap);
    retomarSeForOCaso(nr, cap, destacar);
    if(autoOuvir){
      const b = alvo.querySelector('.linha-ouvir .btn-ouvir');
      if(b) b.click();
    }
  }catch(e){
    alvo.innerHTML = '';
    Voz.parar();
    alvo.appendChild(blocoErro(e.message, () => abrirLeitura(nr, cap, destacar, autoOuvir)));
  }
}

/* =========================================================
   ENSINAR O TOQUE NO VERSÍCULO

   Medido: a linha do versículo era `role="button"` com `tabindex="0"`,
   mas sem descrição e sem dica na tela. O leitor de tela lia o
   versículo inteiro e dizia "botão" — sem nunca dizer o que apertar
   faria. E na tela não havia sinal nenhum: cores, nota, favorito,
   comparar e ouvir dependiam de a pessoa adivinhar o gesto.
   ========================================================= */
const CHAVE_DICA_VERSO = 'lampada-dica-verso';
const ID_DESCRICAO_VERSO = 'descricao-verso';

/* aria-label substituiria o conteúdo e o versículo deixaria de ser
   lido; describedby soma, vem depois do texto, e um elemento só serve
   para os cento e tantos versículos de um capítulo. */
function descricaoDoVerso(){
  let el = $(ID_DESCRICAO_VERSO);
  if(!el){
    el = document.createElement('span');
    el.id = ID_DESCRICAO_VERSO;
    el.className = 'so-leitor';
    el.textContent = 'Abre as ações do versículo: marcar com cor, favoritar, escrever nota, comparar versões, copiar, gerar imagem ou ouvir.';
    document.body.appendChild(el);
  }
  return el.id;
}

const dicaJaVista = () => { try { return localStorage.getItem(CHAVE_DICA_VERSO) === '1'; } catch(_){ return false; } };
function dispensarDicaDoVerso(){
  try { localStorage.setItem(CHAVE_DICA_VERSO, '1'); } catch(_){}
  document.querySelectorAll('.dica-verso').forEach(d => d.remove());
}

function montarDicaDoVerso(){
  if(dicaJaVista()) return null;
  const d = document.createElement('div');
  d.className = 'dica-verso';
  const t = document.createElement('span');
  t.textContent = 'Toque num versículo para marcar com cor, favoritar, anotar ou ouvir.';
  const x = document.createElement('button');
  x.type = 'button';
  x.setAttribute('aria-label', 'Dispensar esta dica');
  x.textContent = '✕';
  x.onclick = dispensarDicaDoVerso;
  d.appendChild(t);
  d.appendChild(x);
  return d;
}

function desenharCapitulo(dados, nr, cap, destacar){
  const livro = livroPorNr(nr);
  const frag = document.createElement('div');
  frag.style.animation = 'fadeUp 0.3s ease both';
  const h = document.createElement('div');
  h.className = 'cab-cartao';
  h.innerHTML = `<div class="referencia">${livro.nome} ${cap}<small>${versaoAtual.nome}</small></div>`;
  frag.appendChild(h);

  const dica = montarDicaDoVerso();
  if(dica) frag.appendChild(dica);

  /* partes da leitura em voz — um bloco por versículo, para
     destacar e acompanhar na tela enquanto é lido */
  const partesVoz = [{
    texto: nomeFalado(livro.nome) + ', capítulo ' + cap,
    rotulo: 'Início',
    el: h
  }];

  dados.itens.forEach(item => {
    if(item.tipo === 'titulo'){
      const t = document.createElement('p');
      t.className = 'titulo-sec';
      t.textContent = item.texto;
      frag.appendChild(t);
      partesVoz.push({ texto: item.texto, rotulo: 'Título', el: t });
      return;
    }
    const p = document.createElement('span');
    p.className = 'v' + (destacar === item.numero ? ' destaque' : '');
    /* o versículo abre a folha de ações ao ser tocado; sem isto ele era um
       span com onclick, invisível para o teclado e mudo no leitor de tela */
    p.tabIndex = 0;
    p.setAttribute('role', 'button');
    p.setAttribute('aria-haspopup', 'dialog');
    p.setAttribute('aria-describedby', descricaoDoVerso());
    const s = document.createElement('sup');
    s.textContent = item.numero;
    p.appendChild(s);
    p.appendChild(document.createTextNode(item.texto));
    pintarVerso(p, nr, cap, item.numero);
    const abrir = () => abrirFolhaVerso(nr, cap, item.numero, item.texto);
    p.onclick = abrir;
    p.onkeydown = e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrir(); }
    };
    frag.appendChild(p);
    partesVoz.push({
      texto: (Voz.prefs.num ? 'Versículo ' + item.numero + '. ' : '') + item.texto,
      rotulo: 'Versículo ' + item.numero,
      el: p
    });
  });

  /* Ouvir o capítulo — e, se a pessoa quiser, seguir para o próximo sozinho */
  const linhaOuvir = document.createElement('div');
  linhaOuvir.className = 'linha-ouvir';
  linhaOuvir.appendChild(criarBotaoOuvir('Ouvir o capítulo', () => partesVoz, {
    voz: {
      titulo: livro.nome + ' ' + cap,
      aoTerminar: () => {
        if(!Voz.prefs.autoCap) return;
        if(cap < livro.caps) abrirLeitura(nr, cap + 1, null, true);
        else if(nr < 66) abrirLeitura(nr + 1, 1, null, true);
      }
    }
  }));
  /* O botão fica no PÉ do capítulo, não entre o título e o primeiro
     versículo. Ali ele era o objeto mais alto da tela, mais saturado
     que a Escritura. No pé ele vira o que faz sentido no fim de uma
     leitura — ouvir de novo — e quem quer ouvir antes usa o "Ouvir" do
     cabeçalho, que aciona este mesmo botão.

     E ele continua VISÍVEL: escondê-lo com display:none deixava o
     controle de verdade inalcançável por toque e fora da árvore de
     acessibilidade, com o cabeçalho fingindo ser ele. */
  linhaOuvir.classList.add('ouvir-no-pe');

  /* A versão saiu de baixo do título do capítulo e foi para o pé da
     folha. É crédito, não cabeçalho: quem abre João 3 quer ler João 3,
     e a licença da tradução não precisa disputar a cabeça de página. */
  frag.appendChild(linhaOuvir);

  const credito = document.createElement('p');
  credito.className = 'rodape-folha';
  credito.textContent = versaoAtual.nome;
  frag.appendChild(credito);

  const passos = document.createElement('div');
  passos.className = 'passos';
  if(cap > 1 || nr > 1){
    const b = document.createElement('button');
    b.className = 'btn claro';
    b.textContent = '‹ Anterior';
    b.onclick = () => cap > 1 ? abrirLeitura(nr, cap - 1) : abrirLeitura(nr - 1, livroPorNr(nr - 1).caps);
    passos.appendChild(b);
  } else {
    passos.appendChild(document.createElement('span'));
  }
  if(cap < livro.caps || nr < 66){
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = 'Próximo ›';
    b.onclick = () => cap < livro.caps ? abrirLeitura(nr, cap + 1) : abrirLeitura(nr + 1, 1);
    passos.appendChild(b);
  }
  frag.appendChild(passos);
  return frag;
}

/* Livros → capítulos → leitura são três telas, e cada descida vira um
   passo no histórico. Subir pelo botão "Voltar" da tela e subir pelo
   voltar do sistema passam pelo mesmo caminho, então nunca sobra uma
   entrada pendurada pedindo dois toques. */
const NIVEIS = ['livros', 'capitulos', 'leitura'];

function mostrarNivel(nivel){
  const atual = nivelAtual();
  const de = NIVEIS.indexOf(atual), para = NIVEIS.indexOf(nivel);
  if(para > de){
    /* descendo: uma entrada por degrau, para voltar degrau a degrau
       mesmo quando se pula de livros direto para a leitura */
    for(let k = Math.max(de, 0); k < para; k++){
      const volta = NIVEIS[k];
      Navegacao.entrar('nivel', () => mostrarNivelDireto(volta));
    }
  } else if(para < de && de > -1){
    if(Navegacao.sair('nivel', de - para)) return;
  }
  mostrarNivelDireto(nivel);
}

function nivelAtual(){
  return NIVEIS.find(n => !$('nivel-' + n).classList.contains('oculto'));
}

function mostrarNivelDireto(nivel){
  /* saiu da leitura: parar de anotar a posição, senão a rolagem da
     lista de capítulos gravaria um versículo que ninguém está lendo */
  if(nivel !== 'leitura') capituloNaTela = null;
  /* o estado que troca o app inteiro pela folha — ver estilo.css */
  const raiz = document.documentElement;
  if(nivel === 'leitura'){ raiz.dataset.lendo = '1'; }
  else { delete raiz.dataset.lendo; delete raiz.dataset.buscaLeitura; }
  NIVEIS.forEach(n =>
    $('nivel-' + n).classList.toggle('oculto', n !== nivel)
  );
}

/* ---------- atividade / streak / estatísticas ---------- */
const CHAVE_ATIVIDADE = 'lampada-atividade-dias';
function hojeISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function carregarAtividade(){
  try { return JSON.parse(localStorage.getItem(CHAVE_ATIVIDADE) || '[]'); }
  catch { return []; }
}
function registrarAtividade(){
  const dias = new Set(carregarAtividade());
  dias.add(hojeISO());
  const lista = [...dias].sort();
  // manter no máximo 400 dias
  const trim = lista.slice(-400);
  localStorage.setItem(CHAVE_ATIVIDADE, JSON.stringify(trim));
  Conta.marcarSujo();
  atualizarStats();
}
function calcularStreak(){
  const dias = new Set(carregarAtividade());
  if(!dias.size) return 0;
  const d = new Date();
  // Se não houve atividade hoje, começa a contar de ontem (streak ainda válido até virar o dia sem uso)
  let chave = hojeISO();
  if(!dias.has(chave)){
    d.setDate(d.getDate() - 1);
    chave = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if(!dias.has(chave)) return 0;
  }
  let streak = 0;
  while(true){
    const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if(!dias.has(iso)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
/* Saudação por horário. Sem nome: a conta guarda só o e-mail, e deduzir um
   nome do que vem antes do arroba erra feio na maioria das vezes. */
function saudar(){
  const el = $('saudacao');
  if(!el) return;
  const h = new Date().getHours();
  el.textContent = h < 5 ? 'Boa madrugada'
                 : h < 12 ? 'Bom dia'
                 : h < 18 ? 'Boa tarde'
                 : 'Boa noite';
}

function atualizarStats(){
  const map = carregarLidos();
  let caps = 0;
  Object.keys(map).forEach(k => { if(map[k]) caps++; });
  const favs = carregarFavs().length;
  const prog = carregarProgPlanos();
  let planos = 0;
  Object.keys(prog).forEach(id => { planos += (prog[id] || []).length; });
  const streak = calcularStreak();
  const el = (id, v) => { const n = $(id); if(n) n.textContent = String(v); };
  el('stat-streak', streak);
  el('stat-caps', caps);
  el('stat-favs', favs);
  el('stat-planos', planos);
  /* Primeira visita: quatro zeros lado a lado são um boletim de nada feito.
     Começar do zero é normal; ser recebido por um placar disso, não. */
  const zerado = !streak && !caps && !favs && !planos;
  const grid = $('grid-stats'), boas = $('boas-vindas');
  if(grid) grid.classList.toggle('oculto', zerado);
  if(boas) boas.classList.toggle('oculto', !zerado);
  /* o "Ouvir meu resumo" leria os quatro zeros em voz alta, contradizendo
     a mensagem logo acima */
  const ouvirStats = $('linha-ouvir-stats');
  if(ouvirStats) ouvirStats.classList.toggle('oculto', zerado);

  const msg = $('stat-msg');
  if(msg){
    msg.classList.toggle('oculto', zerado);
    if(streak === 0) msg.textContent = 'Abra o devocional ou leia um capítulo hoje para iniciar sua sequência.';
    else if(streak === 1) msg.textContent = 'Bom começo! Volte amanhã para manter a sequência.';
    else if(streak < 7) msg.textContent = streak + ' dias seguidos. A constância transforma o coração.';
    else if(streak < 30) msg.textContent = streak + ' dias seguidos — uma bela disciplina espiritual.';
    else msg.textContent = streak + ' dias seguidos. Sua fidelidade na Palavra é inspiradora.';
  }
}

/* ---------- busca: referência ou palavra ---------- */
function buscarReferencia(){
  const txt = $('busca').value.trim();
  if(!txt) return;
  // Referência: "João 3:16", "Sl 23", "1 Coríntios 13"
  const m = txt.match(/^(.+?)\s+(\d+)(?:\s*[:.\s]\s*(\d+))?$/);
  if(m){
    const alvo = norm(m[1]);
    const livro = LIVROS.find(l => norm(l.nome) === alvo)
               || LIVROS.find(l => norm(l.nome).startsWith(alvo))
               || LIVROS.find(l => norm(l.nome).includes(alvo));
    if(!livro) return avisar('Livro não encontrado: ' + m[1]);
    const cap = Math.min(parseInt(m[2], 10), livro.caps);
    $('sec-busca').classList.add('oculto');
    abrirLeitura(livro.nr, cap, m[3] ? parseInt(m[3], 10) : undefined);
    return;
  }

  /* Só o nome do livro, sem capítulo: "genesis", "salmos", "1 joao".
     Sem isto a palavra caía na busca de texto e varria os 929 capítulos do
     Antigo Testamento atrás de versículos que contivessem "gênesis" — que
     não é o que ninguém quer ao digitar o nome de um livro. */
  const soLivro = LIVROS.find(l => norm(l.nome) === norm(txt));
  if(soLivro){
    $('sec-busca').classList.add('oculto');
    abrirLeitura(soLivro.nr, 1);
    return;
  }

  // Caso contrário: busca por palavra
  buscarPalavra(txt);
}

async function mapPool(items, limit, worker){
  const ret = new Array(items.length);
  let i = 0;
  async function run(){
    while(i < items.length){
      const idx = i++;
      ret[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(runners);
  return ret;
}

async function buscarPalavra(termo){
  /* Buscar uma palavra é sair da leitura: o resultado é uma lista, não
     um capítulo, e a folha deixa de ser o assunto da tela. O nível
     continua onde estava — quem fechar os resultados encontra o
     capítulo logo abaixo, como antes desta mudança. */
  if(typeof fecharBuscaDaLeitura === 'function') fecharBuscaDaLeitura();
  delete document.documentElement.dataset.lendo;

  const q = norm(termo);
  if(q.length < 2) return avisar('Digite pelo menos 2 letras para buscar');
  if(!versaoAtual) versaoAtual = VERSOES[0];

  const escopo = ($('sel-escopo-busca') && $('sel-escopo-busca').value) || 'nt';
  let livros = LIVROS;
  if(escopo === 'nt') livros = LIVROS.filter(l => l.nr >= 40);
  else if(escopo === 'at') livros = LIVROS.filter(l => l.nr <= 39);

  const sec = $('sec-busca');
  const lista = $('lista-busca');
  const status = $('status-busca');
  sec.classList.remove('oculto');
  lista.innerHTML = '';
  status.textContent = 'Buscando “' + termo + '” em ' + livros.length + ' livros…';
  mostrarSecao('sec-busca');

  const MAX = 40;
  const re = new RegExp('(' + termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  let achados = 0, feitos = 0, cancelado = false;

  /* Cada acerto vai para a tela na hora. Antes a lista só era montada
     depois de varrer tudo, então uma busca que levava meio minuto passava
     esse tempo inteiro parecendo travada, mesmo já tendo o que mostrar. */
  function mostrar(nr, cap, verso, nome, texto){
    const el = document.createElement('div');
    el.className = 'item-busca';
    el.innerHTML = `<div class="busca-corpo"><div class="ref-busca">${nome} ${cap}:${verso}</div>` +
                   `<div class="txt-busca">${texto.replace(re, '<mark>$1</mark>')}</div></div>`;
    el.prepend(criarOuvirMini('Ouvir ' + nome + ' ' + cap + ':' + verso, () => [
      { texto: refFalada(nr, cap, verso), rotulo: 'Referência' },
      { texto, rotulo: 'Versículo', el }
    ], { voz: { titulo: nome + ' ' + cap + ':' + verso } }));
    el.querySelector('.busca-corpo').onclick = () => abrirLeitura(nr, cap, verso);
    lista.appendChild(el);
  }

  const varrer = (nr, cap, nome, itens) => {
    for(const item of itens){
      if(achados >= MAX) return;
      if(item.tipo !== 'verso') continue;
      if(!norm(item.texto).includes(q)) continue;
      achados++;
      mostrar(nr, cap, item.numero, nome, item.texto);
    }
  };

  /* Livro a livro, não capítulo a capítulo: são 39 pedidos no Antigo
     Testamento em vez de 929 quando a fonte serve o livro inteiro. */
  await mapPool(livros, 6, async (l) => {
    if(cancelado) return;
    try{
      const caps = await buscarLivroInteiro(versaoAtual, l.nr);
      if(caps){
        for(const [cap, d] of [...caps.entries()].sort((a, b) => a[0] - b[0])){
          if(achados >= MAX) break;
          varrer(l.nr, cap, l.nome, d.itens);
        }
      } else {
        /* fonte sem livro inteiro: volta ao capítulo a capítulo, mas com
           mais pedidos em paralelo do que os 4 de antes */
        const caps = Array.from({ length: l.caps }, (_, i) => i + 1);
        await mapPool(caps, 8, async (c) => {
          if(cancelado || achados >= MAX) return;
          try{ varrer(l.nr, c, l.nome, (await buscarCapitulo(l.nr, c)).itens); }catch(_){}
        });
      }
    }catch(_){ /* livro indisponível: segue para o próximo */ }
    feitos++;
    status.textContent = 'Buscando… ' + feitos + '/' + livros.length + ' livros' +
      (achados ? ' · ' + achados + ' encontrados' : '');
    if(achados >= MAX) cancelado = true;
  });

  if(!achados){
    status.textContent = 'Nenhum versículo encontrado para “' + termo + '” neste escopo.';
    return;
  }
  status.textContent = achados + (achados >= MAX ? '+' : '') +
    ' resultado(s) para “' + termo + '”';
  registrarAtividade();
}

/* ---------- versões e controles ---------- */
const chaveVersao = v => v.fonte + ':' + v.id;
function creditar(){
  $('creditos').textContent = ' Exibindo: ' + versaoAtual.nome + ' (' + versaoAtual.licenca + ').';
}
function montarVersoes(){
  const sel = $('sel-versao');
  sel.innerHTML = '';
  const grupos = {
    getbible: {rotulo:'getBible', el:document.createElement('optgroup')},
    helloao:  {rotulo:'Free Use Bible API', el:document.createElement('optgroup')}
  };
  Object.values(grupos).forEach(g => g.el.label = g.rotulo);

  VERSOES.slice().sort((a,b) => (a.nome||'').localeCompare(b.nome||'','pt-BR')).forEach(v => {
    const o = document.createElement('option');
    o.value = chaveVersao(v);
    o.textContent = v.nome + ' — ' + v.licenca;
    grupos[v.fonte].el.appendChild(o);
  });
  Object.values(grupos).forEach(g => { if(g.el.children.length) sel.appendChild(g.el); });

  if(versaoAtual) sel.value = chaveVersao(versaoAtual);
  if(versaoAtual) creditar();

  sel.onchange = () => {
    versaoAtual = VERSOES.find(v => chaveVersao(v) === sel.value);
    creditar();
    cacheLimpo();
    mostrarNivel('livros');
    versiculoDoDia();
    avisar('Versão: ' + versaoAtual.nome);
  };
}
function cacheLimpo(){ /* cache já é indexado por fonte+versão */ }

/* ---------- descoberta de versões ---------- */
const LICENCA_LIVRE = /dom[ií]nio p[úu]blico|public domain|creative commons|\bcc[ -]?by\b|\bgpl\b|\bgfdl\b|freely distributable|free use|uso livre/i;
const LICENCA_RESTRITA = /non-?commercial|n[ãa]o comercial|all rights reserved|permission (to distribute )?granted/i;
function ehLivre(txt){
  const t = (txt||'').trim();
  if(!t) return false;
  if(LICENCA_RESTRITA.test(t)) return false;
  return LICENCA_LIVRE.test(t);
}
/* Edições anteriores às reformas ortográficas ficam de fora: o texto de
   1911 escreve "Portuguez", "elle", "Christo". O catálogo remoto oferece
   várias delas, então o filtro precisa valer também para o que é
   descoberto em tempo de execução, não só para a lista semente. */
const VERSAO_ARCAICA = /almeida|1819|1911|corrigida|portuguez|\bacf\b|\barc\b/i;

/* A Bíblia Livre é uma modernização do Almeida e circula com nomes como
   "Bíblia Almeida - BLIVRE". Sem esta ressalva o filtro acima derrubaria
   uma versão moderna e livre por causa de uma palavra no nome. */
const VERSAO_MODERNA = /livre|blivre|viva|contempor[âa]nea|\bnvt\b|linguagem de hoje/i;

function ehArcaica(v){
  const t = (v.id || '') + ' ' + (v.nome || '');
  if(VERSAO_MODERNA.test(t)) return false;
  return VERSAO_ARCAICA.test(t);
}

function acrescentar(novas){
  let add = 0;
  novas.forEach(v => {
    if(!v.id) return;
    if(VERSOES.some(x => x.fonte === v.fonte && x.id === v.id)) return;
    if(ehArcaica(v)) return;
    VERSOES.push(v);
    add++;
  });
  if(add) montarVersoes();
  return add;
}
async function descobrirGetbible(){
  try{
    const r = await fetch(`${BASE}/translations.json`);
    if(!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    const pt = Object.values(d).filter(t =>
      (t.lang||'').toLowerCase().startsWith('pt') && ehLivre(t.distribution_license));
    return acrescentar(pt.map(t => ({
      fonte: 'getbible',
      id: t.abbreviation,
      nome: t.translation || t.description || t.abbreviation,
      licenca: t.distribution_license
    })));
  }catch(e){ console.info('getBible: catálogo não carregado —', e.message); return 0; }
}
async function descobrirHelloao(){
  try{
    const r = await fetch(`${HELLOAO}/available_translations.json`);
    if(!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    const pt = (d.translations||[]).filter(t => {
      const code = (t.language||'').toLowerCase();
      const lin = ((t.languageName||'') + ' ' + (t.languageEnglishName||'') + ' ' + (t.name||'')).toLowerCase();
      // ISO 639-3 para português é "por"; evita falsos positivos como "porções"
      return code === 'por' || lin.includes('portugu');
    });
    return acrescentar(pt.map(t => ({
      fonte: 'helloao',
      id: t.id,
      nome: t.name || t.englishName || t.id,
      licenca: 'Uso livre'
    })));
  }catch(e){ console.info('helloao: catálogo não carregado —', e.message); return 0; }
}
async function descobrirTudo(){
  const [a,b] = await Promise.all([descobrirGetbible(), descobrirHelloao()]);
  const n = a + b;
  console.info('Versões em português disponíveis:', VERSOES.length,
               '(getBible +' + a + ', helloao +' + b + ')');
  if(n) avisar(n === 1 ? '1 versão adicionada' : n + ' versões adicionadas');
  if(VERSOES.length && !versaoAtual){
    versaoAtual = VERSOES[0];
    montarVersoes();
    versiculoDoDia();
  }
}

/* ---------- gerador de imagem ---------- */
let imgAtual = { texto: '', ref: '', versao: '', tema: '', onde: null };
let imgModo = 'foto'; /* 'foto' | 'arte' */
let imgFotoLista = [];
let imgFotoIdx = 0;
let imgFotoCache = {}; /* query -> photos[] */
let imgFotoObj = null; /* Image carregada */

/* Tema → busca visual (Pexels) */
const TEMA_BUSCA_PEXELS = {
  'Medo e ansiedade': 'calm ocean sunrise peaceful',
  'Força': 'mountain peak sunrise strength',
  'Provisão': 'golden wheat field harvest light',
  'Cura e consolo': 'soft morning light forest mist',
  'Direção': 'forest path sunlight journey',
  'Perdão': 'sunrise new day open sky',
  'Fé e esperança': 'lighthouse dawn ocean hope',
  'Gratidão': 'golden hour nature gratitude',
  'Família': 'warm sunset landscape home',
  'Proteção': 'rocky cliff shelter storm light',
  'Qualquer uma': 'peaceful nature sunrise'
};

function consultaFotoPorTema(tema, texto){
  if(tema && TEMA_BUSCA_PEXELS[tema]) return TEMA_BUSCA_PEXELS[tema];
  const t = ((texto || '') + ' ' + (tema || '')).toLowerCase();
  if(/medo|ansie|paz|descanso/.test(t)) return 'calm lake sunrise peace';
  if(/força|forte|poder/.test(t)) return 'mountain summit sunrise';
  if(/cura|consolo|choro/.test(t)) return 'gentle rain green leaves soft light';
  if(/caminho|direção|guia|pastor/.test(t)) return 'forest path light morning';
  if(/perdão|misericórdia/.test(t)) return 'sunrise cloudy sky hope';
  if(/esperança|fé|confia/.test(t)) return 'dawn horizon light sky';
  if(/família|casa|filhos/.test(t)) return 'warm golden hour countryside';
  if(/proteção|refúgio|escudo/.test(t)) return 'cliff ocean storm light';
  if(/luz|lâmpada|lampe/.test(t)) return 'candle warm light dark';
  if(/água|rio|mar/.test(t)) return 'still water reflection sunrise';
  return 'peaceful nature soft light sunrise';
}

/* =========================================================
   GERADOR DE IMAGEM DO VERSÍCULO
   Modo arte: fundos desenhados (offline).
   Modo foto: imagens reais via Pexels (/api/pexels).
   ========================================================= */

const FORMATOS = [
  { id: 'feed',     nome: 'Feed',     w: 1080, h: 1350 },
  { id: 'story',    nome: 'Story',    w: 1080, h: 1920 },
  { id: 'quadrado', nome: 'Quadrado', w: 1080, h: 1080 }
];

/* Ruído determinístico: o mesmo versículo gera sempre a mesma
   imagem, mas as estrelas e o trigo não ficam alinhados. */
function semente(txt){
  let h = 2166136261;
  for(let i = 0; i < txt.length; i++){
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function faixa(ctx, x0, y0, x1, y1, paradas){
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  paradas.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}

/* Silhueta de morro: uma senóide amaciada, do x=0 ao x=W */
function morro(ctx, W, H, base, altura, fase, cor){
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for(let x = 0; x <= W; x += 8){
    const t = x / W;
    const y = base - altura * (0.5 + 0.5 * Math.sin(fase + t * Math.PI * 1.6))
                   - altura * 0.25 * Math.sin(fase * 2 + t * Math.PI * 4);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function brilho(ctx, x, y, raio, cor){
  const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
  g.addColorStop(0, cor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
}

const FUNDOS = [
  {
    id: 'amanhecer', nome: 'Amanhecer', claro: false,
    desenhar(ctx, W, H){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#2B1B4A'], [0.35, '#8E3B62'], [0.62, '#E0714A'], [0.82, '#F2A65A'], [1, '#F6C978']
      ]);
      ctx.fillRect(0, 0, W, H);
      brilho(ctx, W * 0.5, H * 0.26, W * 0.52, 'rgba(255,226,150,0.6)');
      ctx.fillStyle = 'rgba(255,244,206,0.97)';
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.26, W * 0.095, 0, Math.PI * 2);
      ctx.fill();
      morro(ctx, W, H, H * 0.74, H * 0.07, 1.1, 'rgba(90,45,60,0.55)');
      morro(ctx, W, H, H * 0.83, H * 0.06, 2.4, 'rgba(52,26,42,0.85)');
      morro(ctx, W, H, H * 0.92, H * 0.05, 0.4, '#241426');
    }
  },
  {
    id: 'noite', nome: 'Noite estrelada', claro: false,
    desenhar(ctx, W, H, r){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#070B18'], [0.45, '#101C3A'], [0.8, '#1B2E56'], [1, '#24406E']
      ]);
      ctx.fillRect(0, 0, W, H);
      for(let i = 0; i < 260; i++){
        const x = r() * W, y = r() * H * 0.85, s = r();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + s * 0.75) + ')';
        ctx.beginPath();
        ctx.arc(x, y, s * 2.4 + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      brilho(ctx, W * 0.74, H * 0.17, W * 0.30, 'rgba(214,229,255,0.30)');
      ctx.fillStyle = '#EAF1FF';
      ctx.beginPath();
      ctx.arc(W * 0.74, H * 0.17, W * 0.072, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(W * 0.70, H * 0.145, W * 0.066, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      morro(ctx, W, H, H * 0.90, H * 0.05, 1.9, '#080C16');
    }
  },
  {
    id: 'montanhas', nome: 'Montanhas', claro: false,
    desenhar(ctx, W, H){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#1D3557'], [0.5, '#3D6188'], [1, '#88A8C4']
      ]);
      ctx.fillRect(0, 0, W, H);
      /* cumes com ombros arredondados: triângulo puro parece serra */
      const pico = (base, alt, desl, cor) => {
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, base);
        for(let k = 0; k < 5; k++){
          const larg = W / 3.4;
          const x0 = (k + desl) * larg;
          const topo = base - alt * (0.66 + ((k * 7) % 5) * 0.09);
          ctx.lineTo(x0, base);
          ctx.quadraticCurveTo(x0 + larg * 0.30, topo + alt * 0.16, x0 + larg * 0.5, topo);
          ctx.quadraticCurveTo(x0 + larg * 0.70, topo + alt * 0.16, x0 + larg, base);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      };
      pico(H * 0.70, H * 0.20, -0.4, 'rgba(45,78,112,0.75)');
      pico(H * 0.82, H * 0.17, 0.15, 'rgba(28,50,76,0.9)');
      pico(H * 0.93, H * 0.13, -0.15, '#152436');
    }
  },
  {
    id: 'aguas', nome: 'Águas tranquilas', claro: false,
    desenhar(ctx, W, H, r){
      const linha = H * 0.58;
      ctx.fillStyle = faixa(ctx, 0, 0, 0, linha, [
        [0, '#12324F'], [0.6, '#2E6E8E'], [1, '#7FB6C4']
      ]);
      ctx.fillRect(0, 0, W, linha);
      brilho(ctx, W * 0.5, linha, W * 0.42, 'rgba(255,236,190,0.45)');
      ctx.fillStyle = faixa(ctx, 0, linha, 0, H, [
        [0, '#2A6076'], [0.5, '#17384C'], [1, '#0C1E2C']
      ]);
      ctx.fillRect(0, linha, W, H - linha);
      for(let i = 0; i < 70; i++){
        const y = linha + r() * (H - linha);
        const larg = (0.1 + r() * 0.5) * W;
        ctx.fillStyle = 'rgba(255,236,190,' + (0.03 + r() * 0.10) + ')';
        ctx.fillRect(W / 2 - larg / 2, y, larg, 2 + r() * 3);
      }
    }
  },
  {
    id: 'trigal', nome: 'Trigal', claro: false,
    desenhar(ctx, W, H, r){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#5B4A20'], [0.35, '#A8792C'], [0.7, '#D7A544'], [1, '#8A6420']
      ]);
      ctx.fillRect(0, 0, W, H);
      brilho(ctx, W * 0.5, H * 0.30, W * 0.6, 'rgba(255,231,160,0.35)');
      for(let i = 0; i < 420; i++){
        const x = r() * W;
        const alt = (0.08 + r() * 0.20) * H;
        const y = H - r() * H * 0.30;
        ctx.strokeStyle = 'rgba(60,40,12,' + (0.25 + r() * 0.5) + ')';
        ctx.lineWidth = 2 + r() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (r() - 0.5) * 40, y - alt * 0.6, x + (r() - 0.5) * 70, y - alt);
        ctx.stroke();
      }
    }
  },
  {
    id: 'deserto', nome: 'Deserto', claro: false,
    desenhar(ctx, W, H){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#3D2B45'], [0.3, '#9B5B58'], [0.55, '#D98E5C'], [1, '#E8B979']
      ]);
      ctx.fillRect(0, 0, W, H);
      brilho(ctx, W * 0.30, H * 0.22, W * 0.34, 'rgba(255,226,170,0.62)');
      ctx.fillStyle = 'rgba(255,242,212,0.97)';
      ctx.beginPath();
      ctx.arc(W * 0.30, H * 0.22, W * 0.060, 0, Math.PI * 2);
      ctx.fill();
      const duna = (base, alt, fase, cor) => {
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for(let x = 0; x <= W; x += 6){
          const t = x / W;
          ctx.lineTo(x, base - alt * Math.sin(fase + t * Math.PI * 1.1));
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      };
      duna(H * 0.68, H * 0.06, 0.5, 'rgba(150,90,60,0.5)');
      duna(H * 0.80, H * 0.07, 2.2, 'rgba(108,62,48,0.8)');
      duna(H * 0.91, H * 0.05, 3.6, '#4E2C26');
    }
  },
  {
    id: 'luz', nome: 'Raios de luz', claro: false,
    desenhar(ctx, W, H){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#123253'], [0.55, '#0C2038'], [1, '#07131F']
      ]);
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W * 0.5, -H * 0.12);
      for(let i = 0; i < 13; i++){
        const a = (-0.85 + i * 0.14);
        ctx.save();
        ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 0, H * 1.25);
        g.addColorStop(0, 'rgba(255,232,175,0.30)');
        g.addColorStop(1, 'rgba(255,232,175,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-W * 0.022, 0, W * 0.044, H * 1.25);
        ctx.restore();
      }
      ctx.restore();
      brilho(ctx, W * 0.5, 0, W * 0.55, 'rgba(255,236,185,0.45)');
    }
  },
  {
    id: 'oliveira', nome: 'Ramo de oliveira', claro: true,
    desenhar(ctx, W, H, r){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#F6F1E3'], [0.6, '#EDE5D1'], [1, '#DFD3B8']
      ]);
      ctx.fillRect(0, 0, W, H);
      const ramo = (x0, y0, ang, comp, folhas) => {
        ctx.strokeStyle = 'rgba(90,102,62,0.75)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + Math.cos(ang) * comp * 0.5, y0 + Math.sin(ang) * comp * 0.5 - 40,
                             x0 + Math.cos(ang) * comp, y0 + Math.sin(ang) * comp);
        ctx.stroke();
        for(let i = 1; i <= folhas; i++){
          const t = i / (folhas + 1);
          const x = x0 + Math.cos(ang) * comp * t;
          const y = y0 + Math.sin(ang) * comp * t - 40 * Math.sin(Math.PI * t);
          const lado = i % 2 ? 1 : -1;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ang + lado * 0.9);
          ctx.fillStyle = 'rgba(104,124,72,' + (0.55 + r() * 0.35) + ')';
          ctx.beginPath();
          ctx.ellipse(0, 0, 34, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      };
      ramo(-40, H * 0.14, 0.34, W * 0.62, 9);
      ramo(W + 40, H * 0.90, Math.PI - 0.30, W * 0.60, 8);
      ctx.fillStyle = 'rgba(120,104,70,0.10)';
      for(let i = 0; i < 900; i++){
        ctx.fillRect(r() * W, r() * H, 2, 2);
      }
    }
  },
  {
    id: 'caminho', nome: 'Vereda', claro: false,
    desenhar(ctx, W, H){
      ctx.fillStyle = faixa(ctx, 0, 0, 0, H, [
        [0, '#24405C'], [0.4, '#4E7A8C'], [0.62, '#9CB79E'], [1, '#4B6340']
      ]);
      ctx.fillRect(0, 0, W, H);
      brilho(ctx, W * 0.5, H * 0.55, W * 0.4, 'rgba(255,240,200,0.4)');
      morro(ctx, W, H, H * 0.66, H * 0.05, 2.0, 'rgba(52,78,64,0.65)');
      morro(ctx, W, H, H * 0.74, H * 0.04, 0.6, 'rgba(40,60,48,0.85)');
      ctx.fillStyle = 'rgba(226,214,178,0.85)';
      ctx.beginPath();
      ctx.moveTo(W * 0.47, H * 0.70);
      ctx.quadraticCurveTo(W * 0.62, H * 0.84, W * 0.30, H);
      ctx.lineTo(W * 0.70, H);
      ctx.quadraticCurveTo(W * 0.70, H * 0.84, W * 0.53, H * 0.70);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#243A2A';
      ctx.fillRect(0, H * 0.985, W, H * 0.015);
    }
  },
  {
    id: 'pergaminho', nome: 'Pergaminho', claro: true,
    desenhar(ctx, W, H, r){
      ctx.fillStyle = faixa(ctx, 0, 0, W, H, [
        [0, '#F7EFDC'], [0.5, '#EFE2C6'], [1, '#E2D2AE']
      ]);
      ctx.fillRect(0, 0, W, H);
      for(let i = 0; i < 2600; i++){
        const a = r();
        ctx.fillStyle = 'rgba(120,94,52,' + (a * 0.09) + ')';
        ctx.fillRect(r() * W, r() * H, 1 + a * 3, 1 + a * 2);
      }
      for(let i = 0; i < 18; i++){
        ctx.strokeStyle = 'rgba(150,120,70,0.07)';
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath();
        const y = r() * H;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 60, W * 0.7, y + (r() - 0.5) * 60, W, y);
        ctx.stroke();
      }
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      v.addColorStop(0, 'rgba(120,90,45,0)');
      v.addColorStop(1, 'rgba(96,70,32,0.34)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
  }
];

let imgFormato = 'feed';
let imgFundo = null;      // null = escolhido a partir da referência

function fundoAtual(){
  if(imgFundo){
    const f = FUNDOS.find(x => x.id === imgFundo);
    if(f) return f;
  }
  const r = semente(imgAtual.ref || 'versiculo');
  return FUNDOS[Math.floor(r() * FUNDOS.length)];
}

/* =========================================================
   AS FOTOS SE ACUMULAM, NÃO SE SUBSTITUEM

   "Outras fotos" apagava o cache e pedia de novo — com a MESMA
   consulta, o MESMO per_page e sem página nenhuma. O Pexels devolvia
   as mesmas quinze fotos, e a borda da Vercel nem chegava a
   encaminhar o pedido. Depois disso, imgFotoIdx = 0 saltava para a
   primeira dessa lista idêntica: era isso que se via como "voltou
   para a foto do início", e apertar de novo não mudava nada porque
   já estava na primeira.

   Agora cada toque pede a PÁGINA SEGUINTE e ACRESCENTA à fita. Nada
   do que já estava lá desaparece, a foto escolhida continua
   escolhida, e o índice segue valendo porque a lista só cresce no
   fim.

   O cache guarda o acumulado por consulta, com a orientação da
   primeira busca: trocar Feed por Quadrado não joga fora as fotos
   que a pessoa já viu — o recorte dá conta da diferença.
   ========================================================= */
const FOTOS_POR_PAGINA = 24;

async function buscarFotosPexels(query, pagina){
  const guardado = imgFotoCache[query];
  if(!pagina || pagina === 1){
    if(guardado && guardado.fotos.length) return guardado.fotos;
    pagina = 1;
  }
  const orient = (guardado && guardado.orient) ||
    (imgFormato === 'quadrado' ? 'square' : 'portrait');
  const r = await fetch('/api/pexels?q=' + encodeURIComponent(query) +
    '&per_page=' + FOTOS_POR_PAGINA + '&page=' + pagina + '&orientation=' + orient);
  const d = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(d.error || ('Pexels ' + r.status));
  const novas = d.photos || [];
  if(!novas.length && pagina === 1) throw new Error('Nenhuma foto encontrada para este tema');

  const antes = guardado ? guardado.fotos : [];
  /* o mesmo id pode voltar entre páginas quando o acervo muda de ordem */
  const vistos = new Set(antes.map(f => f.id));
  const acumulado = antes.concat(novas.filter(f => !vistos.has(f.id)));
  imgFotoCache[query] = {
    orient,
    pagina,
    ultima: !!d.ultima || !novas.length,
    fotos: acumulado
  };
  return acumulado;
}

/* quantas fotos entraram desde a última vez, para a fita poder mostrar
   as novas em vez de deixar a pessoa achar que nada aconteceu */
function haMaisFotos(query){
  const c = imgFotoCache[query];
  return !c || !c.ultima;
}

function carregarImagemUrl(url){
  return new Promise((resolve, reject) => {
    // Usa o proxy para evitar problema de CORS no canvas
    const proxyUrl = '/api/proxy-image?url=' + encodeURIComponent(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a foto'));
    img.src = proxyUrl;
  });
}

function desenharFotoCover(ctx, img, W, H){
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(W / iw, H / ih);
  const nw = iw * scale, nh = ih * scale;
  const x = (W - nw) / 2, y = (H - nh) / 2;
  ctx.drawImage(img, x, y, nw, nh);
}

async function abrirGeradorImagem(texto, ref, versao, tema, onde){
  Metricas.anotar('imagem_gerada');
  /* `onde` guarda de qual passagem a imagem saiu, para o link que vai
     junto dela levar a essa passagem e não à capa */
  imgAtual = { texto, ref, versao, tema: tema || '', onde: onde || null };
  imgFundo = null;
  imgFotoLista = [];
  imgFotoIdx = 0;
  imgFotoObj = null;
  imgModo = 'foto';
  const modal = $('modal-img');
  modal.classList.add('aberto');
  Foco.prender(modal);
  Navegacao.entrar('imagem', fecharModalImgDireto);
  montarOpcoesImagem();
  await redesenharImagem();
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(() => {
      if($('modal-img').classList.contains('aberto')) redesenharImagem();
    });
  }
}
function fecharModalImg(){
  if(Navegacao.sair('imagem')) return;
  fecharModalImgDireto();
}

function fecharModalImgDireto(){
  $('modal-img').classList.remove('aberto');
  Foco.soltar($('modal-img'));
  
  // Destrava a rolagem do corpo do site e do HTML principal
  document.body.style.overflow = ''; 
  document.documentElement.style.overflow = '';
}


function montarOpcoesImagem(){
  const fmt = $('img-formatos');
  if(fmt && !fmt.children.length){
    FORMATOS.forEach(f => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-img';
      b.setAttribute('role', 'radio');
      b.textContent = f.nome;
      b.dataset.formato = f.id;
      b.onclick = async () => { imgFormato = f.id; marcarOpcoes(); await redesenharImagem(); };
      fmt.appendChild(b);
    });
  }
  montarFitaDeFundos();
  marcarOpcoes();
}

/* =========================================================
   A FITA DE FUNDOS

   Havia dez fundos desenhados e até quinze fotos, todos escondidos
   atrás de um botão "Trocar fundo" que ia para o próximo às cegas.
   Não dava para ver o que existia, escolher, nem voltar ao que se
   gostou — e quando a lista de fotos tinha uma só, o botão ia buscar
   outras no Pexels, então nem a volta trazia a mesma de novo.

   Aqui cada opção se mostra numa miniatura. As fotos vêm primeiro,
   porque é o modo de partida; os desenhados vêm depois de um traço,
   e são eles que sobram quando não há rede — o que também explica,
   sem precisar de aviso, por que só há desenho na tela.
   ========================================================= */
function miniaturaDesenhada(fundo){
  const c = document.createElement('canvas');
  /* pequeno de propósito: dez destes são desenhados a cada abertura */
  c.width = 116; c.height = 148;
  try { fundo.desenhar(c.getContext('2d'), c.width, c.height); } catch(_){}
  return c;
}

function montarFitaDeFundos(){
  const fita = $('img-fundos');
  if(!fita) return;
  fita.innerHTML = '';

  const opcao = (rotulo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fundo-op';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', rotulo);
    return b;
  };

  imgFotoLista.forEach((foto, i) => {
    const b = opcao('Foto de ' + (foto.photographer || 'autor desconhecido'));
    b.dataset.foto = String(i);
    const im = document.createElement('img');
    im.loading = 'lazy';
    im.alt = '';
    im.src = '/api/proxy-image?url=' + encodeURIComponent(foto.thumb || foto.url);
    b.appendChild(im);
    b.onclick = () => escolherFundo({ modo: 'foto', indice: i });
    fita.appendChild(b);
  });

  if(imgFotoLista.length){
    const corte = document.createElement('span');
    corte.className = 'fita-corte';
    corte.setAttribute('aria-hidden', 'true');
    fita.appendChild(corte);
  }

  FUNDOS.forEach(f => {
    const b = opcao(f.nome + ' — fundo desenhado');
    b.dataset.arte = f.id;
    b.appendChild(miniaturaDesenhada(f));
    b.onclick = () => escolherFundo({ modo: 'arte', id: f.id });
    fita.appendChild(b);
  });

  /* o que o "Trocar fundo" fazia de útil — pedir outras fotos ao Pexels —
     continua existindo, mas acrescentando à fita em vez de trocar tudo */
  const q = consultaFotoPorTema(imgAtual.tema, imgAtual.texto);
  const acabou = !haMaisFotos(q);
  const mais = opcao(acabou ? 'Não há mais fotos deste tema' : 'Buscar outras fotos');
  mais.className = 'fundo-op mais' + (acabou ? ' fim' : '');
  mais.removeAttribute('role');
  mais.disabled = acabou;
  mais.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-imagem"/></svg><span>' +
    (acabou ? 'Fim' : 'Outras fotos') + '</span>';
  mais.onclick = buscarOutrasFotos;
  fita.appendChild(mais);

  /* remontar a fita apaga as marcas junto com os botões antigos: sem
     isto, depois de "Outras fotos" a escolha continuava valendo por
     dentro e nenhuma miniatura aparecia marcada */
  marcarOpcoes();
}

async function escolherFundo(escolha){
  if(escolha.modo === 'arte'){
    imgModo = 'arte';
    imgFundo = escolha.id;
  } else {
    imgModo = 'foto';
    imgFotoIdx = escolha.indice;
    imgFotoObj = null;
  }
  marcarOpcoes();
  await redesenharImagem();
}

async function buscarOutrasFotos(){
  const q = consultaFotoPorTema(imgAtual.tema, imgAtual.texto);
  if(!haMaisFotos(q)) return avisar('Estas são todas as fotos deste tema.');

  const botao = document.querySelector('#img-fundos .fundo-op.mais');
  if(botao) botao.disabled = true;
  const quantasTinha = imgFotoLista.length;
  const proxima = ((imgFotoCache[q] && imgFotoCache[q].pagina) || 1) + 1;

  try {
    imgFotoLista = await buscarFotosPexels(q, proxima);
    /* a escolha de quem já achou a sua não se mexe: a lista só cresceu
       no fim, então o índice continua apontando para a mesma foto */
    montarFitaDeFundos();
    const novas = imgFotoLista.length - quantasTinha;
    if(novas > 0){
      /* sem isto, a fita continua mostrando as de antes e o toque parece
         não ter feito nada — as novas entraram lá longe, à direita */
      mostrarFotoNaFita(quantasTinha);
      avisar('Mais ' + novas + (novas === 1 ? ' foto' : ' fotos') + ' no fim da fita');
    } else {
      avisar('Estas são todas as fotos deste tema.');
    }
  } catch(e){
    console.info('Pexels:', e && e.message);
    avisar('Não deu para buscar outras fotos agora.');
  } finally {
    /* só reabilita se ainda houver o que pedir: reabilitar sempre
       desfazia o estado de "Fim" que a própria fita tinha acabado de
       montar, e o botão voltava a oferecer o que já não existe */
    const b = document.querySelector('#img-fundos .fundo-op.mais');
    if(b) b.disabled = !haMaisFotos(q);
  }
}

/* leva a fita até uma foto, sem trocar o que está escolhido */
function mostrarFotoNaFita(indice){
  const alvo = document.querySelector('#img-fundos .fundo-op[data-foto="' + indice + '"]');
  if(alvo && alvo.scrollIntoView)
    alvo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}

function marcarOpcoes(){
  const nome = $('img-nome-fundo');
  const cred = $('img-credito-foto');
  if(imgModo === 'foto'){
    const foto = imgFotoLista[imgFotoIdx];
    if(nome) nome.textContent = foto ? ('Foto · ' + (imgAtual.tema || 'tema do dia')) : 'Buscando foto do tema…';
    if(cred){
      cred.textContent = foto
        ? ('Foto: ' + foto.photographer + ' / Pexels')
        : '';
    }
  } else {
    if(nome) nome.textContent = fundoAtual().nome;
    if(cred) cred.textContent = 'Fundo artístico (desenhado no app)';
  }
  document.querySelectorAll('#img-formatos .chip-img').forEach(b => {
    const ativo = b.dataset.formato === imgFormato;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-checked', ativo ? 'true' : 'false');
  });
  document.querySelectorAll('#img-fundos .fundo-op[role="radio"]').forEach(b => {
    const ativo = b.dataset.arte
      ? (imgModo === 'arte' && fundoAtual().id === b.dataset.arte)
      : (imgModo === 'foto' && Number(b.dataset.foto) === imgFotoIdx);
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-checked', ativo ? 'true' : 'false');
  });
}

/* trocarFundo() saiu junto com o botão: sortear o próximo às cegas era
   o problema, não a solução. O que ele tinha de útil — pedir outras fotos
   ao Pexels — virou buscarOutrasFotos(), no fim da fita. */

async function redesenharImagem(){
  const palco = $('palco-img');
  if(palco) palco.classList.add('carregando');
  try {
    /* Escolheu um fundo desenhado: não se vai à rede. Antes a foto era
       sempre tentada primeiro, então pedir um desenho ainda esperava o
       Pexels responder para só depois cair no recuo. */
    if(imgModo === 'arte'){ desenharImagemArte(); marcarOpcoes(); return; }
    const tinhaFotos = imgFotoLista.length;
    await desenharImagemFoto();
    /* a lista chega de dentro do desenho, na primeira vez: a fita só
       pode ser montada depois que ela existe */
    if(!tinhaFotos && imgFotoLista.length) montarFitaDeFundos();
  } catch(e){
    /* Sem este recuo o canvas ficava em branco: 1080x1350 com zero
       pixels opacos, e a pessoa recebia um aviso pedindo para tentar de
       novo. Quem está offline, com o Pexels bloqueado, sem chave ou com
       a cota estourada tentaria para sempre — num app que se instala
       justamente para funcionar sem internet.
       O fundo desenhado não depende de rede nenhuma e sempre serve. */
    console.info('Pexels:', e && e.message);
    imgModo = 'arte';
    desenharImagemArte();
    /* a fita passa a mostrar só os desenhados, o que já diz por que não
       há foto na tela — o aviso some sozinho, a explicação fica */
    montarFitaDeFundos();
    avisar('Sem foto agora — usando fundo desenhado.');
  } finally {
    if(palco) palco.classList.remove('carregando');
  }
  marcarOpcoes();
}
async function desenharImagemFoto(){
  const canvas = $('canvas-verso');
  const fmt = FORMATOS.find(f => f.id === imgFormato) || FORMATOS[0];
  canvas.width = fmt.w;
  canvas.height = fmt.h;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // garante que tem texto para desenhar
  const texto = (imgAtual && imgAtual.texto) ? imgAtual.texto : 'Versículo não carregado';
  const ref   = (imgAtual && imgAtual.ref)   ? imgAtual.ref   : '';
  const versao = (imgAtual && imgAtual.versao) ? imgAtual.versao : '';

  const q = consultaFotoPorTema(imgAtual ? imgAtual.tema : '', texto);

  if(!imgFotoLista.length){
    const nome = $('img-nome-fundo');
    if(nome) nome.textContent = 'Buscando foto do tema…';
    imgFotoLista = await buscarFotosPexels(q);
    imgFotoIdx = Math.floor(semente(ref + q)() * imgFotoLista.length) % imgFotoLista.length;
  }

  let tentativas = 0;
  while(tentativas < 6){
    const foto = imgFotoLista[imgFotoIdx];
    if(!foto) break;

    try {
      if(!imgFotoObj || imgFotoObj._url !== foto.url){
        imgFotoObj = await carregarImagemUrl(foto.url);
        imgFotoObj._url = foto.url;
      }

      // desenha a foto
      desenharFotoCover(ctx, imgFotoObj, W, H);

      // desenha o texto
      desenharTextoSobreFundo(ctx, W, H, false);

      return;
    } catch(e){
      console.info('Falha na foto', foto.id || foto.url, e.message);
      imgFotoIdx = (imgFotoIdx + 1) % imgFotoLista.length;
      imgFotoObj = null;
      tentativas++;
    }
  }

  // fallback
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);
  desenharTextoSobreFundo(ctx, W, H, false);
}
const FONTE_CANVAS = '"Source Serif 4", "Georgia", "Times New Roman", serif';
function ajustarTexto(ctx, texto, maxW, maxH, tamMax, tamMin){
  let tam = tamMax;
  while(tam >= tamMin){
    ctx.font = '500 ' + tam + 'px ' + FONTE_CANVAS;
    const palavras = texto.split(' ');
    const linhas = [];
    let linha = '';
    for(let i = 0; i < palavras.length; i++){
      const teste = linha ? linha + ' ' + palavras[i] : palavras[i];
      if(ctx.measureText(teste).width > maxW){
        if(linha) linhas.push(linha);
        linha = palavras[i];
      } else {
        linha = teste;
      }
    }
    if(linha) linhas.push(linha);

    const alturaLinha = tam * 1.42;
    if(linhas.length * alturaLinha <= maxH){
      return { linhas, tam, alturaLinha };
    }
    tam -= 1;
  }
  ctx.font = '500 ' + tamMin + 'px ' + FONTE_CANVAS;
  return {
    linhas: [texto],
    tam: tamMin,
    alturaLinha: tamMin * 1.42
  };
}
     
function desenharTextoSobreFundo(ctx, W, H, claro){
  const margem = W * 0.11;
  const ajuste = ajustarTexto(ctx, '\u201C' + imgAtual.texto + '\u201D',
                              W - margem * 2, H * 0.44,
                              Math.round(W * 0.062), Math.round(W * 0.026));
  const linhas = ajuste ? ajuste.linhas : ['Versículo longo demais para a imagem'];
  const tam = ajuste ? ajuste.tam : Math.round(W * 0.030);
  const alturaLinha = ajuste ? ajuste.alturaLinha : tam * 1.42;

  const hTexto  = linhas.length * alturaLinha;
  const gapOrn  = H * 0.040;
  const gapRef  = H * 0.052;
  const gapVer  = H * 0.036;
  const grupoH  = hTexto + gapOrn + gapRef + gapVer;
  const topo    = H * 0.52 - grupoH / 2;

  const base = claro ? '248,242,228' : '6,10,18';
  const alfa = claro ? 0.42 : 0.52;
  const y0 = topo - H * 0.11, y1 = topo + grupoH + H * 0.11;
  const veu = ctx.createLinearGradient(0, y0, 0, y1);
  veu.addColorStop(0, 'rgba(' + base + ',0)');
  veu.addColorStop(0.24, 'rgba(' + base + ',' + alfa + ')');
  veu.addColorStop(0.76, 'rgba(' + base + ',' + alfa + ')');
  veu.addColorStop(1, 'rgba(' + base + ',0)');
  ctx.fillStyle = veu;
  ctx.fillRect(0, y0, W, y1 - y0);

  // véu geral leve para legibilidade em fotos claras
  if(!claro){
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const tinta   = claro ? '#2A2418' : '#FFFFFF';
  const dourado = claro ? '#8A6A22' : '#FFD98A';
  const suave   = claro ? 'rgba(42,36,24,0.58)' : 'rgba(255,255,255,0.66)';

  ctx.textAlign = 'center';
  ctx.fillStyle = suave;
  ctx.font = '600 ' + Math.round(W * 0.026) + 'px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText('BÍBLIA DEVOCIONAL', W / 2, H * 0.075);
  ctx.strokeStyle = dourado;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.44, H * 0.092);
  ctx.lineTo(W * 0.56, H * 0.092);
  ctx.stroke();

  ctx.fillStyle = tinta;
  ctx.font = '500 ' + tam + 'px ' + FONTE_CANVAS;
  let y = topo + alturaLinha * 0.78;
  linhas.forEach(l => { ctx.fillText(l, W / 2, y); y += alturaLinha; });

  const yOrn = topo + hTexto + gapOrn * 0.5;
  ctx.strokeStyle = dourado;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.45, yOrn);
  ctx.lineTo(W * 0.55, yOrn);
  ctx.stroke();

  ctx.fillStyle = dourado;
  ctx.font = '700 ' + Math.round(W * 0.038) + 'px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(imgAtual.ref, W / 2, topo + hTexto + gapOrn + gapRef * 0.72);

  ctx.fillStyle = suave;
  ctx.font = '400 ' + Math.round(W * 0.023) + 'px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(imgAtual.versao, W / 2, topo + hTexto + gapOrn + gapRef + gapVer * 0.62);

  /* O endereço saiu da arte.
     Ele era desenhado aqui no rodapé para viajar junto com a imagem
     reencaminhada. Só que endereço queimado na imagem é marca d'água:
     compete com o versículo, envelhece se o domínio mudar e não é
     clicável — ninguém digita um endereço lido numa foto.

     O link continua indo no compartilhamento, como texto ao lado da
     imagem, e lá ele é clicável e leva direto ao versículo. Ver
     compartilharTexto e linkDoVerso. */

  // crédito Pexels no rodapé (modo foto)
  if(imgModo === 'foto' && imgFotoLista[imgFotoIdx]){
    const f = imgFotoLista[imgFotoIdx];
    ctx.fillStyle = suave;
    ctx.font = '400 ' + Math.round(W * 0.018) + 'px "Source Sans 3", system-ui, sans-serif';
    ctx.fillText('Foto: ' + f.photographer + ' / Pexels', W / 2, H * 0.975);
  }
}
function desenharImagemArte(){
  const canvas = $('canvas-verso');
  const fmt = FORMATOS.find(f => f.id === imgFormato) || FORMATOS[0];
  canvas.width = fmt.w;
  canvas.height = fmt.h;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const fundo = fundoAtual();
  const r = semente((imgAtual.ref || '') + fundo.id);
  fundo.desenhar(ctx, W, H, r);
  desenharTextoSobreFundo(ctx, W, H, !!fundo.claro);
}

/* compat: alguns pontos ainda chamam desenharImagem() */
function desenharImagem(){ return redesenharImagem(); }

function nomeArquivoImagem(){
  return 'biblia-devocional-' +
    (imgAtual.ref || 'versiculo').replace(/\s+/g, '-').replace(/:/g, '-').toLowerCase() +
    '.png';
}

function baixarImagem(){
  const canvas = $('canvas-verso');
  const link = document.createElement('a');
  link.download = nomeArquivoImagem();
  link.href = canvas.toDataURL('image/png');
  link.click();
  avisar('Imagem baixada');
}

/* =========================================================
   COMPARTILHAR TEXTO COM O LINK JUNTO

   O link vai no campo `url`, separado, e não colado no texto. Quando
   o destino só aceita texto — o WhatsApp é assim —, quem junta os
   dois é o próprio navegador, com o espaçamento que aquele aplicativo
   espera. Colar o endereço no texto *e* mandar em `url` faria o link
   aparecer duas vezes nos destinos que entendem os dois campos.

   Na cópia para a área de transferência não existe campo separado,
   então aí o endereço entra no texto à mão.
   ========================================================= */
function compartilharTexto(texto, link){
  Metricas.anotar('compartilhou');
  const url = link || LINK_SITE;
  if(navigator.share)
    return navigator.share({ text: texto, url }).catch(() => {});
  if(navigator.clipboard)
    return navigator.clipboard.writeText(texto + '\n\n' + url)
      .then(() => avisar('Texto e link copiados'))
      .catch(() => avisar('Não foi possível copiar'));
  avisar('Não foi possível compartilhar');
}

/* Compartilhar o arquivo direto, quando o aparelho permite */
function compartilharImagem(){
  const canvas = $('canvas-verso');
  if(!canvas.toBlob || !navigator.share) return baixarImagem();
  canvas.toBlob(blob => {
    if(!blob) return baixarImagem();
    const arquivo = new File([blob], nomeArquivoImagem(), { type: 'image/png' });
    if(navigator.canShare && !navigator.canShare({ files: [arquivo] })) return baixarImagem();

    /* Nem todo aparelho aceita arquivo e link no mesmo envio. Vale a
       pena tentar com o link, mas nunca ao custo da imagem: se a
       combinação for recusada, vai a imagem sozinha — que já leva o
       endereço desenhado no rodapé. */
    const alvo = imgAtual.onde ? linkDoVerso.apply(null, imgAtual.onde) : LINK_SITE;
    const comLink = {
      files: [arquivo],
      title: imgAtual.ref,
      text: imgAtual.ref + ' — Bíblia Devocional',
      url: alvo
    };
    const carga = (!navigator.canShare || navigator.canShare(comLink))
      ? comLink
      : { files: [arquivo], title: comLink.title, text: comLink.text + '\n' + alvo };

    navigator.share(carga).catch(e => {
      if(e && e.name === 'AbortError') return;   // a pessoa desistiu
      baixarImagem();
    });
  }, 'image/png');
}

/* ---------- favoritos UI ---------- */
let tabFavAtual = 'favs';

function renderFavoritos(){
  const area = $('area-favoritos');
  if(!area) return;
  const lista = carregarFavs();

  if(tabFavAtual === 'favs'){
    const sóFavs = lista;
    if(!sóFavs.length){
      area.innerHTML = '<div class="vazio-fav">Nenhum favorito ainda.<br>Toque em ☆ Favoritar em qualquer versículo.</div>';
      return;
    }
    area.innerHTML = '';

    const linha = document.createElement('div');
    linha.className = 'linha-ouvir';
    linha.appendChild(criarBotaoOuvir('Ouvir todos os favoritos', () =>
      carregarFavs().map((f, i) => ({
        texto: refFalada(f.nr, f.cap, f.verso) + '. ' + f.texto,
        rotulo: f.ref,
        el: area.querySelectorAll('.item-fav')[i]
      })), { classe: 'claro', voz: { titulo: 'Favoritos' } }));
    area.appendChild(linha);

    sóFavs.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'item-fav';
      el.style.animationDelay = (i * 0.04) + 's';
      el.innerHTML =
        `<div class="fav-corpo">
           <div class="ref-fav">${f.ref}</div>
           <div class="txt-fav">${f.texto}</div>
           <div class="meta-fav">
             <span>${f.versao} · ${new Date(f.data).toLocaleDateString('pt-BR')}</span>
             <button class="btn-remover" type="button">Remover</button>
           </div>
         </div>`;
      el.prepend(criarOuvirMini('Ouvir ' + f.ref, () => [
        { texto: refFalada(f.nr, f.cap, f.verso), rotulo: 'Referência' },
        { texto: f.texto, rotulo: 'Versículo', el }
      ], { voz: { titulo: f.ref } }));
      el.querySelector('.btn-remover').onclick = () => removerFav(f.chave);
      area.appendChild(el);
    });
  } else {
    /* Diário: agora lista notas de qualquer versículo, não só de favoritos.
       Toque num versículo dentro do capítulo para escrever uma. */
    const notas = Object.values(carregarNotas())
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));

    if(!notas.length){
      area.innerHTML = '<div class="vazio-fav">Nenhuma nota ainda.<br>' +
        'Abra um capítulo, toque num versículo e escolha <b>✎ Nota</b>.</div>';
      return;
    }
    area.innerHTML = '';

    const linha = document.createElement('div');
    linha.className = 'linha-ouvir';
    linha.appendChild(criarBotaoOuvir('Ouvir meu diário', () =>
      notas.flatMap((n, i) => [
        { texto: n.ref, rotulo: n.ref, el: area.querySelectorAll('.item-fav')[i] },
        { texto: n.texto, rotulo: 'Sua nota' }
      ]), { classe: 'claro', voz: { titulo: 'Meu diário' } }));
    area.appendChild(linha);

    notas.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = 'item-fav';
      el.style.animationDelay = (i * 0.04) + 's';
      el.innerHTML =
        `<div class="fav-corpo">
           <div class="ref-fav"></div>
           <div class="txt-fav"></div>
           <textarea class="campo-nota" placeholder="Escreva uma reflexão ou oração…"></textarea>
           <div class="linha-ditar">
             <button class="btn-mic btn-mic-sm" type="button" aria-label="Ditar esta nota" title="Ditar"><img src="/icon-mic.png" alt="" width="16" height="16" decoding="async"></button>
             <span class="dica-ditar">Toque para ditar em vez de escrever</span>
           </div>
           <div class="meta-fav mt-8">
             <span></span>
             <button class="btn-remover" type="button">Remover</button>
           </div>
         </div>`;
      el.querySelector('.ref-fav').textContent = n.ref;
      const trecho = n.versiculo || '';
      el.querySelector('.txt-fav').textContent =
        trecho.length > 120 ? trecho.slice(0, 120) + '…' : trecho;
      el.querySelector('.meta-fav span').textContent = new Date(n.data).toLocaleDateString('pt-BR');

      const ta = el.querySelector('.campo-nota');
      ta.value = n.texto || '';
      const gravar = () => {
        const todas = carregarNotas();
        const k = chaveVerso(n.nr, n.cap, n.verso);
        const valor = ta.value.trim();
        if(valor){ todas[k] = Object.assign({}, n, { texto: valor }); }
        else { delete todas[k]; }
        salvarNotas(todas);
      };
      ta.onchange = gravar;
      ta.onblur = gravar;

      /* ditado grava na hora: quem dita costuma não voltar ao campo */
      el.querySelector('.btn-mic').onclick = function(){
        Ditado.ouvir(this, dito => {
          ta.value = (ta.value ? ta.value.trim() + ' ' : '') + dito;
          gravar();
          avisar('Nota atualizada');
        });
      };

      el.prepend(criarOuvirMini('Ouvir ' + n.ref + ' e a sua nota', () => {
        const partes = [{ texto: refFalada(n.nr, n.cap, n.verso), rotulo: 'Referência' }];
        if(trecho) partes.push({ texto: trecho, rotulo: 'Versículo', el });
        const nota = (ta.value || '').trim();
        if(nota) partes.push({ texto: 'Sua nota. ' + nota, rotulo: 'Sua nota', el: ta });
        return partes;
      }, { voz: { titulo: n.ref } }));

      el.querySelector('.btn-remover').onclick = () => {
        const todas = carregarNotas();
        const k = chaveVerso(n.nr, n.cap, n.verso);
        /* o que está no campo pode ser mais novo que o gravado: quem
           digitou e apagou sem sair do campo perderia a última frase */
        const antes = Object.assign({}, todas[k] || n, { texto: (ta.value || '').trim() || (todas[k] || n).texto });
        delete todas[k];
        salvarNotas(todas);
        renderFavoritos();
        avisar('Nota removida', {
          aoTocar: () => { const t = carregarNotas(); t[k] = antes; salvarNotas(t); renderFavoritos(); }
        });
      };
      area.appendChild(el);
    });
  }
}

/* ---------- tema claro / escuro ---------- */
function aplicarTema(tema){
  document.documentElement.setAttribute('data-tema', tema);
  localStorage.setItem('lampada-tema', tema);
  const btn = $('btn-tema');
  if(btn) btn.textContent = tema === 'escuro' ? '☀' : '◐';
}
function alternarTema(){
  const atual = document.documentElement.getAttribute('data-tema') || 'claro';
  aplicarTema(atual === 'escuro' ? 'claro' : 'escuro');
}

/* ---------- início ---------- */
(function initTema(){
  const salvo = localStorage.getItem('lampada-tema');
  const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  aplicarTema(salvo || (prefereEscuro ? 'escuro' : 'claro'));
})();

$('btn-tema').onclick = alternarTema;
/* =========================================================
   ABAS
   A Bíblia (66 livros) e os Planos (12 cartões) somavam 4.700px —
   59% de uma home de 9,5 telas — e ficavam entre o devocional do dia
   e tudo o que vem depois dele. São catálogos: passaram a viver em
   abas próprias, e a home caiu para o que se usa todo dia.
   ========================================================= */
/* A divisão é entre fazer e ter feito. Hoje guarda o que se faz no dia —
   o devocional, tirar uma promessa, registrar uma oração, e o campo dela
   pergunta "pelo que você quer orar hoje?". Meu guarda o que se acumulou:
   a jornada, os dias anteriores, os favoritos, o diário. */
const ABAS = {
  hoje:   ['sec-hoje', 'sec-continuar', 'sec-oracoes', 'sec-promessas'],
  biblia: ['controles', 'sec-busca', 'sec-biblia', 'sec-mapa'],
  planos: ['sec-planos'],
  meu:    ['sec-stats', 'sec-hist', 'sec-favoritos', 'sec-app']
};
const CHAVE_ABA = 'lampada-aba';
const CHAVE_ABA_DIA = 'lampada-aba-dia';
/* A aba de onde o voltar do sistema sai do app. É a mesma que o app abre
   por padrão: voltar tem de levar para casa, não para uma aba qualquer. */
const ABA_INICIAL = 'hoje';

/* O navegador guarda a rolagem e devolve a pessoa onde ela parou. Num site
   comum isso ajuda; aqui atrapalha, porque quem abre o app de manhã caía
   na caixa de promessas, onde tinha parado ontem, em vez de no devocional
   do dia. Desligamos a restauração e abrimos sempre no começo. */
if('scrollRestoration' in history) history.scrollRestoration = 'manual';
let abaAtual = null;

const abaDe = id => Object.keys(ABAS).find(a => ABAS[a].includes(id));

/* =========================================================
   O BOTÃO VOLTAR DO CELULAR

   O app tinha cinco camadas — aba, livro, capítulo, folha do versículo,
   menu lateral — e nenhuma delas existia para o navegador. Medido: abrir
   a Bíblia, escolher um livro, um capítulo e tocar num versículo deixava
   o histórico exatamente como estava ao carregar a página. Apertar o
   voltar do Android no meio de João 3 não subia um nível: fechava o app.

   No computador isso passa despercebido, porque lá se fecha tudo pelo X
   ou pelo Esc. No celular o voltar é o gesto mais usado do sistema, e
   perder o lugar da leitura por causa dele é caro.

   Cada camada aberta passa a empilhar uma entrada no histórico. O
   contrato é de mão única, e é o que evita laço infinito:

     • abrir uma camada  → Navegacao.entrar(id, comoFechar)
     • fechar pelo app   → Navegacao.sair(id), que pede o voltar ao
                           navegador e deixa o popstate fechar
     • fechar pelo voltar→ popstate desempilha e chama comoFechar

   Ou seja, ninguém fecha nada direto: quem fecha é sempre o popstate.
   Assim o X, o toque fora, o Esc e o voltar do sistema consomem a mesma
   entrada, e nunca sobra uma que exigisse dois toques para sair.
   ========================================================= */
const Navegacao = (function(){
  const pilha = [];
  const fila = [];          /* o que fazer assim que o voltar terminar */
  let desempilhando = false;
  let pendente = false;     /* há um history.go a caminho */

  /* `unica` é para a barra de abas: passear pelas cinco abas não pode
     custar cinco voltares para sair do app, então a camada 'aba' se
     repõe em vez de empilhar. Os degraus da Bíblia são o oposto —
     livros → capítulos → leitura precisa de um voltar por degrau — e
     por isso a repetição só vale para quem pede. */
  function entrar(id, comoFechar, op){
    const topo = pilha[pilha.length - 1];
    if(op && op.unica && topo && topo.id === id){ topo.fechar = comoFechar; return; }
    pilha.push({ id, fechar: comoFechar });
    try { history.pushState({ camadas: pilha.length }, ''); } catch(_){}
  }

  /* Devolve true quando o fechamento ficou por conta do navegador.
     False quer dizer "esta camada não está no histórico, feche você" —
     acontece quando algo é fechado sem nunca ter sido aberto por aqui.

     `quantas` existe por causa da Bíblia: o botão "Livros" sobe dois
     degraus de uma vez, e voltar só um deixaria a pessoa na lista de
     capítulos, não na de livros. */
  function sair(id, quantas = 1, entaoFaca){
    if(desempilhando) return false;      /* já estamos fechando */
    /* Um history.go já a caminho e outro pedido chegando: disparar o
       segundo agora faria duas navegações concorrentes, e o navegador
       pode passar do começo da pilha e levar a pessoa para fora do app.
       Então o segundo pedido entra na fila e é refeito quando o
       primeiro terminar, quando a pilha já estará no estado certo. */
    if(pendente){
      fila.push(() => { if(!sair(id, quantas, entaoFaca) && entaoFaca) entaoFaca(); });
      return true;
    }
    let i = -1, achadas = 0;
    for(let k = pilha.length - 1; k >= 0; k--){
      if(pilha[k].id !== id || pilha[k].saindo) continue;
      i = k;
      if(++achadas === quantas) break;
    }
    if(i === -1) return false;
    /* O popstate só chega no próximo quadro. Sem esta marca, dois toques
       rápidos no X disparariam dois history.go e o segundo levaria junto
       a camada de baixo — fechar a folha fecharia também o capítulo. */
    for(let k = i; k < pilha.length; k++) pilha[k].saindo = true;
    try { history.go(-(pilha.length - i)); }
    catch(_){
      for(let k = i; k < pilha.length; k++) pilha[k].saindo = false;
      return false;
    }
    /* Fechar e ir para outro lugar na mesma ação — o link do menu que
       leva a uma seção, a folha que vira o gerador de imagem. O que vem
       depois TEM de esperar o popstate: feito na linha seguinte, ele
       empilharia uma camada que o popstate desfaria logo em seguida.
       Era exatamente isso que quebrava os links do menu lateral. */
    pendente = true;
    if(entaoFaca) fila.push(entaoFaca);
    return true;
  }

  function aoVoltar(){
    const e = history.state;
    const alvo = (e && typeof e.camadas === 'number') ? e.camadas : 0;
    desempilhando = true;
    try {
      while(pilha.length > alvo){
        const c = pilha.pop();
        /* uma camada que falhe ao fechar não pode prender as de baixo */
        try { c.fechar(); } catch(err){ console.info(err); }
      }
    } finally { desempilhando = false; pendente = false; }
    while(fila.length){
      const f = fila.shift();
      try { f(); } catch(err){ console.info(err); }
    }
  }

  window.addEventListener('popstate', aoVoltar);

  return {
    entrar, sair,
    profundidade: () => pilha.length,
    camadas: () => pilha.map(c => c.id)
  };
})();

function irParaAba(nome, op = {}){
  if(!ABAS[nome]) nome = 'hoje';
  /* Sair da aba inicial é entrar numa camada: o voltar do sistema
     devolve para "Hoje" em vez de fechar o app. Uma entrada só para
     todas as abas — passear entre elas não empilha nada novo. */
  if(!op.doHistorico){
    if(nome !== ABA_INICIAL && abaAtual === ABA_INICIAL){
      Navegacao.entrar('aba',
        () => irParaAba(ABA_INICIAL, { doHistorico: true, semRolar: true, silencioso: true }),
        { unica: true });
    } else if(nome === ABA_INICIAL && abaAtual !== ABA_INICIAL){
      if(Navegacao.sair('aba')) return;
    }
  }
  if(nome === abaAtual) { if(!op.semRolar) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  abaAtual = nome;
  for(const [aba, ids] of Object.entries(ABAS)){
    for(const id of ids){
      const el = $(id);
      /* hidden e não .oculto: sec-busca usa .oculto para se esconder
         enquanto não há resultado, e as duas coisas são independentes */
      if(el) el.hidden = aba !== nome;
    }
  }
  document.querySelectorAll('#abas button').forEach(b => {
    const ativo = b.dataset.aba === nome;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-current', ativo ? 'page' : 'false');
  });
  localStorage.setItem(CHAVE_ABA, nome);
  localStorage.setItem(CHAVE_ABA_DIA, hojeISO());
  if(!op.semRolar) window.scrollTo({ top: 0, behavior: op.suave === false ? 'auto' : 'smooth' });
  /* quem está no modo áudio não vê para onde foi */
  if(Voz.prefs.modo && !op.silencioso){
    const b = document.querySelector('#abas button.ativo');
    if(b) Voz.anunciar(b.dataset.nome);
  }
}

/* Leva a uma seção, trocando de aba antes se ela estiver em outra.
   Todo scrollIntoView para seção passa por aqui — senão a rolagem cairia
   num elemento escondido e a tela pareceria não responder. */
function mostrarSecao(id, bloco){
  const aba = abaDe(id);
  if(aba && aba !== abaAtual) irParaAba(aba, { semRolar: true, silencioso: true });
  const el = $(id);
  if(el) el.scrollIntoView({ behavior: 'smooth', block: bloco || 'start' });
}

document.querySelectorAll('#abas button').forEach(b => {
  b.onclick = () => irParaAba(b.dataset.aba);
});

if($('btn-comecar')) $('btn-comecar').onclick = () => mostrarSecao('sec-hoje');

/* os links da gaveta agora trocam de aba além de rolar */
document.querySelectorAll('.gaveta a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    /* A gaveta sai antes da navegação. Feito ao contrário, trocar de aba
       empilhava uma camada e o voltar que fecha a gaveta levava as duas
       embora — o link do menu simplesmente não ia a lugar nenhum. */
    const ir = () => mostrarSecao(a.getAttribute('href').slice(1));
    if(!Navegacao.sair('gaveta', 1, ir)) ir();
  });
});

/* A aba escolhida só vale enquanto o dia é o mesmo: quem estava na Bíblia
   há dez minutos volta para lá, mas quem abre o app amanhã de manhã
   encontra o devocional do dia, que é o motivo de o app existir. */
const abaGuardada = localStorage.getItem(CHAVE_ABA_DIA) === hojeISO()
  ? localStorage.getItem(CHAVE_ABA)
  : 'hoje';
irParaAba(abaGuardada || 'hoje', { semRolar: true, silencioso: true });
window.scrollTo(0, 0);

/* =========================================================
   CHEGANDO POR UM VERSÍCULO COMPARTILHADO

   `?v=nr.capítulo.versículo` abre a passagem direto, com o versículo
   destacado. Quem recebeu o versículo de um amigo cai nele, e não
   numa capa onde teria de procurá-lo.

   Vem depois da aba guardada de propósito: o link é o motivo pelo
   qual a pessoa abriu o app agora, e ganha de onde ela estava ontem.

   Depois de atendido, o endereço é limpo — senão a pessoa navega o
   app inteiro com `?v=` grudado na barra, e um "atualizar" mais tarde
   a jogaria de volta para aquele versículo sem ela pedir.
   ========================================================= */
function atenderLinkDeVerso(){
  const bruto = new URLSearchParams(location.search).get('v');
  if(!bruto) return false;
  const [nr, cap, verso] = bruto.split('.').map(Number);
  const livro = livroPorNr(nr);
  if(!livro || !(cap >= 1 && cap <= livro.caps)) return false;

  history.replaceState(null, '', location.pathname);
  irParaAba('biblia', { semRolar: true, silencioso: true });
  abrirLeitura(nr, cap, verso > 0 ? verso : null);
  return true;
}
atenderLinkDeVerso();

$('btn-menu').onclick = () => abrirMenu(true);
/* o esmaecido acompanha a rolagem e apaga ao chegar no fim */
$('gaveta').querySelector('.gaveta-rolagem').addEventListener('scroll', marcarSobraDaGaveta, { passive: true });
/* e ao mudar o tamanho da letra, que muda a altura de tudo dentro */
document.querySelectorAll('.fonte-rapida button').forEach(b =>
  b.addEventListener('click', () => setTimeout(marcarSobraDaGaveta, 60)));
 document.querySelector('.logo').onclick = () => irParaAba('hoje');
$('veu').onclick = () => { abrirPainelVoz(false); abrirPainelConta(false); abrirMenu(false); };
document.querySelectorAll('[data-fecha]').forEach(a => a.onclick = () => abrirMenu(false));
/* =========================================================
   A BUSCA QUE LEMBRA

   Toda busca começava numa caixa em branco. Para reler um versículo era
   preciso lembrar a grafia exata — "Eclesiastes", "1 Coríntios", os
   acentos de "Gênesis" — e digitar tudo de novo. É a heurística 6 de
   Nielsen: reconhecer em vez de lembrar. Quem lê a Bíblia volta aos
   mesmos lugares, e o app não guardava nenhum deles.

   Duas coisas, no mesmo lugar e nunca ao mesmo tempo:

   • campo vazio  → as últimas buscas, como atalho de um toque
   • digitando    → os livros que casam com o que já foi escrito

   Tudo fica no aparelho, como o resto: nenhuma busca sai daqui.
   ========================================================= */
const CHAVE_RECENTES = 'lampada-buscas';
const MAX_RECENTES = 8;
const MAX_SUGESTOES = 6;

const BuscaMemoria = (function(){
  const campo = () => $('busca');
  const caixaSug = () => $('sugestoes-busca');
  const caixaRec = () => $('recentes-busca');
  let marcada = -1;

  function carregar(){
    try {
      const l = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]');
      return Array.isArray(l) ? l.filter(x => typeof x === 'string' && x.trim()) : [];
    } catch(_){ return []; }
  }

  function guardar(lista){
    try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista.slice(0, MAX_RECENTES))); }
    catch(_){ /* aparelho sem espaço: a busca funciona, só não lembra */ }
  }

  /* Registrada só quando a busca de fato acontece. Guardar o que foi
     digitado a cada tecla encheria a lista de metades de palavra. */
  function registrar(termo){
    const t = String(termo || '').trim();
    if(t.length < 2) return;
    /* a mesma busca sobe para o topo em vez de aparecer duas vezes */
    const lista = carregar().filter(x => norm(x) !== norm(t));
    lista.unshift(t);
    guardar(lista);
    renderRecentes();
  }

  function esquecerTudo(){
    try { localStorage.removeItem(CHAVE_RECENTES); } catch(_){}
    renderRecentes();
    avisar('Buscas recentes apagadas');
  }

  function renderRecentes(){
    const lista = carregar();
    const cx = caixaRec();
    const alvo = $('recentes-lista');
    if(!cx || !alvo) return;
    alvo.textContent = '';
    if(!lista.length){ cx.hidden = true; return; }

    lista.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-busca';
      b.textContent = t;
      b.onclick = () => { campo().value = t; fechar(); executar(t); };
      alvo.appendChild(b);
    });

    const limpar = document.createElement('button');
    limpar.type = 'button';
    limpar.className = 'chip-busca limpar';
    limpar.textContent = 'Limpar';
    limpar.onclick = esquecerTudo;
    alvo.appendChild(limpar);

    /* só aparece com o campo vazio: quem está digitando quer sugestão,
       não o histórico */
    cx.hidden = !!campo().value.trim();
  }

  /* Os livros que casam com o que já foi digitado. Começo de nome vem
     antes de "contém": quem escreve "jo" quer João, não Josué no meio
     de uma lista alfabética. */
  function candidatos(txt){
    const m = txt.match(/^(.+?)(?:\s+(\d+))?$/);
    if(!m) return [];
    const parte = norm(m[1]);
    if(parte.length < 1) return [];
    const cap = m[2] ? parseInt(m[2], 10) : null;

    const comeca = [], contem = [];
    for(const l of LIVROS){
      const n = norm(l.nome);
      if(n.startsWith(parte)) comeca.push(l);
      else if(n.includes(parte)) contem.push(l);
    }
    const achados = comeca.concat(contem).slice(0, MAX_SUGESTOES);

    return achados.map(l => {
      /* um capítulo que não existe não vira sugestão de capítulo: o
         livro inteiro continua sendo uma resposta útil */
      const valido = cap && cap >= 1 && cap <= l.caps;
      return {
        rotulo: valido ? l.nome + ' ' + cap : l.nome,
        tipo: valido ? 'capítulo' : (l.caps + ' capítulos'),
        parte: m[1],
        abrir: () => { campo().value = valido ? l.nome + ' ' + cap : l.nome;
                       fechar(); executar(campo().value); }
      };
    });
  }

  function sugerir(){
    const txt = campo().value.trim();
    const cx = caixaSug();
    if(!cx) return;
    cx.textContent = '';
    marcada = -1;

    if(!txt){ cx.hidden = true; campo().setAttribute('aria-expanded', 'false'); renderRecentes(); return; }
    caixaRec().hidden = true;

    const itens = candidatos(txt);
    /* Nenhum livro casa: em vez de caixa vazia, oferecemos o que o app
       de fato faria com esse texto — procurar a palavra. Era a função
       menos descoberta do app. */
    if(!itens.length && txt.length >= 2){
      itens.push({
        rotulo: 'Buscar “' + txt + '” no texto',
        tipo: 'palavra',
        parte: '',
        abrir: () => { fechar(); executar(txt); }
      });
    }
    if(!itens.length){ cx.hidden = true; campo().setAttribute('aria-expanded', 'false'); return; }

    itens.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sugestao';
      b.id = 'sug-' + i;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      /* o pedaço já digitado sai em negrito: mostra por que aquele item
         está ali, em vez de uma lista que parece arbitrária */
      const nome = document.createElement('span');
      /* comparação sem acento dos dois lados: com "gênesis" cru contra
         "gen" normalizado, nenhum livro acentuado ficava em negrito */
      const corte = it.parte ? norm(it.rotulo).indexOf(norm(it.parte)) : -1;
      if(corte === 0){
        const forte = document.createElement('b');
        forte.textContent = it.rotulo.slice(0, it.parte.length);
        nome.appendChild(forte);
        nome.appendChild(document.createTextNode(it.rotulo.slice(it.parte.length)));
      } else {
        nome.textContent = it.rotulo;
      }
      b.appendChild(nome);
      const tipo = document.createElement('span');
      tipo.className = 'sug-tipo';
      tipo.textContent = it.tipo;
      b.appendChild(tipo);
      b.onclick = it.abrir;
      cx.appendChild(b);
    });
    cx.hidden = false;
    campo().setAttribute('aria-expanded', 'true');
  }

  function fechar(){
    const cx = caixaSug();
    if(cx){ cx.hidden = true; cx.textContent = ''; }
    marcada = -1;
    campo().setAttribute('aria-expanded', 'false');
    if(caixaRec()) caixaRec().hidden = true;
  }

  function marcar(passo){
    const cx = caixaSug();
    if(!cx || cx.hidden) return false;
    const itens = [...cx.querySelectorAll('.sugestao')];
    if(!itens.length) return false;
    if(marcada > -1 && itens[marcada]){
      itens[marcada].classList.remove('marcada');
      itens[marcada].setAttribute('aria-selected', 'false');
    }
    /* n itens mais o estado "nenhum marcado" dão n+1 posições. Deslocar
       para 0..n antes do resto evita o -1 virar índice negativo, que
       deixava a primeira seta para baixo sem marcar nada. */
    const n = itens.length;
    marcada = ((marcada + 1 + passo + n + 1) % (n + 1)) - 1;
    if(marcada > -1){
      itens[marcada].classList.add('marcada');
      itens[marcada].setAttribute('aria-selected', 'true');
      /* o leitor de tela anuncia o item sem que o foco saia do campo,
         que é o que permite continuar digitando */
      campo().setAttribute('aria-activedescendant', itens[marcada].id);
    } else {
      campo().removeAttribute('aria-activedescendant');
    }
    return true;
  }

  function escolherMarcada(){
    const cx = caixaSug();
    if(!cx || cx.hidden || marcada < 0) return false;
    const it = cx.querySelectorAll('.sugestao')[marcada];
    if(!it) return false;
    it.click();
    return true;
  }

  /* Uma porta só para executar a busca, para o registro nunca depender
     de quem chamou — chip, sugestão, botão, Enter ou ditado. */
  function executar(termo){
    if(typeof termo === 'string') campo().value = termo;
    const t = campo().value.trim();
    if(!t) return;
    registrar(t);
    Metricas.anotar('busca_feita');
    buscarReferencia();
  }

  return { registrar, renderRecentes, sugerir, fechar, marcar, escolherMarcada, executar, esquecerTudo };
})();

$('busca').setAttribute('role', 'combobox');
$('busca').setAttribute('aria-autocomplete', 'list');
$('busca').setAttribute('aria-controls', 'sugestoes-busca');
$('busca').setAttribute('aria-expanded', 'false');

$('btn-busca').onclick = () => { BuscaMemoria.fechar(); BuscaMemoria.executar(); };
$('busca').addEventListener('input', () => BuscaMemoria.sugerir());
$('busca').addEventListener('focus', () => BuscaMemoria.renderRecentes());
$('busca').onkeydown = e => {
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    if(BuscaMemoria.marcar(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
    return;
  }
  if(e.key === 'Escape'){
    /* O campo é type="search", e nele o Chrome apaga o texto no Esc.
       Com a lista aberta isso é perda: quem aperta Esc quer dispensar a
       sugestão, não jogar fora o que acabou de digitar. Então o Esc
       fecha a lista e para por aí; com a lista já fechada, o
       comportamento normal do navegador continua valendo. */
    const cx = $('sugestoes-busca');
    const aberta = cx && !cx.hidden;
    BuscaMemoria.fechar();
    if(aberta) e.preventDefault();
    return;
  }
  if(e.key !== 'Enter') return;
  /* Enter com um item marcado abre o item; sem marca, busca o que está
     escrito — quem digitou tudo não é obrigado a passar pela lista */
  if(BuscaMemoria.escolherMarcada()) return;
  BuscaMemoria.fechar();
  BuscaMemoria.executar();
};

/* tocar fora fecha, mas não antes de o toque na sugestão ser contado */
document.addEventListener('click', e => {
  if(e.target.closest('#sugestoes-busca, .linha-busca')) return;
  const cx = $('sugestoes-busca');
  if(cx && !cx.hidden) BuscaMemoria.fechar();
});

BuscaMemoria.renderRecentes();
$('btn-livros').onclick = () => { mostrarNivel('livros'); mostrarSecao('sec-biblia'); };
$('btn-mapa').onclick = function(){
  const sec = $('sec-mapa');
  const abrindo = sec.classList.contains('oculto');
  /* a seção sai do escondido antes do desenho: getBBox só mede rótulo
     que o navegador já tenha disposto na tela */
  if(abrindo){ Metricas.anotar('mapa_aberto'); sec.classList.remove('oculto'); desenharMapa(); mostrarSecao('sec-mapa'); }
  else sec.classList.add('oculto');
  this.textContent = abrindo ? 'Mapa ⌃' : 'Mapa ⌄';
};
/* O tamanho da letra não era guardado: voltava ao normal a cada abertura,
   justamente para quem mais precisa dele. Agora fica. */
const CHAVE_ESC = 'lampada-escala';
const ESCALAS = ['0.9', '1', '1.2', '1.45'];
const NOME_ESCALA = { '0.9': 'pequena', '1': 'normal', '1.2': 'grande', '1.45': 'muito grande' };

function aplicarEscala(esc){
  esc = ESCALAS.includes(String(esc)) ? String(esc) : '1';
  document.documentElement.style.setProperty('--esc', esc);
  localStorage.setItem(CHAVE_ESC, esc);
  /* nos extremos o botão apaga: apertar sem efeito nenhum é pior do que
     ver que não há para onde ir */
  const i = ESCALAS.indexOf(esc);
  const menos = $('fonte-menos'), mais = $('fonte-mais');
  if(menos) menos.disabled = i === 0;
  if(mais)  mais.disabled  = i === ESCALAS.length - 1;
  return esc;
}

/* O Aa do cabeçalho tem um botão só, então ele dá a volta: parar no
   maior deixaria o botão morto para quem já está no topo da escala. */
function ciclarEscala(){
  const atual = localStorage.getItem(CHAVE_ESC) || '1';
  const i = Math.max(0, ESCALAS.indexOf(atual));
  const novo = ESCALAS[(i + 1) % ESCALAS.length];
  aplicarEscala(novo);
  avisar('Letra ' + NOME_ESCALA[novo]);
  if(Voz.prefs.modo) Voz.anunciar('Letra ' + NOME_ESCALA[novo]);
}

function passoEscala(dir){
  const atual = localStorage.getItem(CHAVE_ESC) || '1';
  const i = Math.max(0, ESCALAS.indexOf(atual));
  const novo = ESCALAS[Math.min(ESCALAS.length - 1, Math.max(0, i + dir))];
  if(novo === atual) return;
  aplicarEscala(novo);
  /* o texto muda na hora, mas dizer o nome ajuda quem não confia no que vê */
  avisar('Letra ' + NOME_ESCALA[novo]);
  if(Voz.prefs.modo) Voz.anunciar('Letra ' + NOME_ESCALA[novo]);
}

/* ---- os botões do cabeçalho da leitura ---- */
if($('cl-voltar')) $('cl-voltar').onclick = () => mostrarNivel('capitulos');
if($('cl-busca'))  $('cl-busca').onclick  = alternarBuscaDaLeitura;
if($('cl-fonte'))  $('cl-fonte').onclick  = ciclarEscala;
if($('cl-ouvir'))  $('cl-ouvir').onclick  = function(){
  /* aciona o mesmo botão que ficava dentro do capítulo, em vez de
     duplicar a lógica de montar as partes da voz */
  const b = document.querySelector('#area-leitura .linha-ouvir .btn-ouvir');
  if(b){ b.click(); this.classList.toggle('tocando'); }
};

if($('fonte-menos')) $('fonte-menos').onclick = () => passoEscala(-1);
if($('fonte-mais'))  $('fonte-mais').onclick  = () => passoEscala(1);
aplicarEscala(localStorage.getItem(CHAVE_ESC) || '1');
document.querySelectorAll('.voltar').forEach(b => b.onclick = () => mostrarNivel(b.dataset.volta));
$('btn-tirar').onclick = tirarPromessa;

/* Modal imagem */
$('btn-fechar-modal').onclick = fecharModalImg;
$('btn-baixar-img').onclick = baixarImagem;
$('btn-compartilhar-img').onclick = compartilharImagem;
$('modal-img').onclick = e => { if(e.target === $('modal-img')) fecharModalImg(); };

/* Tabs favoritos */
document.querySelectorAll('.tab-fav').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab-fav').forEach(t => t.classList.remove('ativo'));
    tab.classList.add('ativo');
    tabFavAtual = tab.dataset.tab;
    renderFavoritos();
  };
});

/* Ripple sutil nos botões principais */
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('.btn:not(.claro)');
  if(!btn) return;
  const rect = btn.getBoundingClientRect();
  btn.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100) + '%');
  btn.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100) + '%');
});

/* =========================================================
   FOCO NOS PAINÉIS
   Abrir a gaveta não mexia no foco: ele ficava no ☰ atrás do
   painel, e o Tab seguinte caía em botões cobertos. Quem
   enxerga fecha no olho; quem usa teclado ou leitor de tela se
   perde sem perceber que se perdeu.
   A pilha existe porque o painel de voz abre por cima da
   gaveta — o Tab tem de respeitar só o de cima.
   ========================================================= */
const Foco = (() => {
  const pilha = [];
  const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]),' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const dentroDe = el => [...el.querySelectorAll(FOCAVEIS)].filter(e => e.offsetParent !== null);

  function prender(painel, op = {}){
    if(!painel || pilha.some(p => p.painel === painel)) return;
    pilha.push({ painel, volta: op.volta || document.activeElement });
    const alvos = dentroDe(painel);
    (op.focar || alvos[0] || painel).focus();
  }

  function soltar(painel){
    const i = pilha.findIndex(p => p.painel === painel);
    if(i < 0) return;
    const [saiu] = pilha.splice(i, 1);
    /* devolver o foco a um elemento escondido joga a pessoa para o começo
       da página no Tab seguinte; nesse caso vale mais deixar como está */
    const v = saiu.volta;
    if(v && document.contains(v) && v.offsetParent !== null) v.focus();
  }

  document.addEventListener('keydown', e => {
    if(e.key !== 'Tab' || !pilha.length) return;
    const { painel } = pilha[pilha.length - 1];
    const alvos = dentroDe(painel);
    if(!alvos.length){ e.preventDefault(); painel.focus(); return; }
    const primeiro = alvos[0], ultimo = alvos[alvos.length - 1];
    const dentro = painel.contains(document.activeElement);
    if(e.shiftKey && (!dentro || document.activeElement === primeiro)){
      e.preventDefault(); ultimo.focus();
    } else if(!e.shiftKey && (!dentro || document.activeElement === ultimo)){
      e.preventDefault(); primeiro.focus();
    }
  }, true);

  return { prender, soltar };
})();

function abrirMenu(estado){
  if(estado) Navegacao.entrar('gaveta', () => abrirMenuDireto(false));
  else if(Navegacao.sair('gaveta')) return;
  abrirMenuDireto(estado);
}

function abrirMenuDireto(estado){
  $('gaveta').classList.toggle('aberta', estado);
  $('veu').classList.toggle('aberto', estado);
  
     document.body.style.overflow = estado ? 'hidden' : ''; 
     
  /* o foco entra no primeiro item do menu, não no A− do cabeçalho: quem
     abriu a gaveta quer navegar, o tamanho da letra está ali de plantão */
  if(estado) Foco.prender($('gaveta'), {
    volta: $('btn-menu'),
    focar: $('gaveta').querySelector('a[href^="#"]')
  });
  else Foco.soltar($('gaveta'));
  if(estado) marcarSobraDaGaveta();
}

/* =========================================================
   AVISAR QUE O MENU CONTINUA ABAIXO

   Rolar resolveu o alcance, mas não a descoberta: numa tela de
   360x640 a nota das versões fica abaixo da dobra e nada na tela
   diz que existe mais coisa ali.

   A classe acende um esmaecido no pé do menu, e some quando não
   há mais o que rolar — inclusive ao chegar no fim, para não
   prometer conteúdo que acabou.
   ========================================================= */
function marcarSobraDaGaveta(){
  const r = $('gaveta').querySelector('.gaveta-rolagem');
  if(!r) return;
  const sobra = r.scrollHeight - r.clientHeight - r.scrollTop > 8;
  $('gaveta').classList.toggle('tem-mais', sobra);
}

/* painel de configuração da leitura em voz (abre por cima da gaveta) */
function abrirPainelVoz(estado){
  if(estado){
    /* ele cobre a gaveta: a gaveta sai primeiro e o painel entra depois,
       senão um toque custaria dois voltares e o segundo reabriria uma
       gaveta que ninguém viu sair */
    if(Navegacao.sair('gaveta', 1, () => abrirPainelVoz(true))) return;
    Navegacao.entrar('painel-voz', () => abrirPainelVozDireto(false));
  } else if(Navegacao.sair('painel-voz')) return;
  abrirPainelVozDireto(estado);
}

function abrirPainelVozDireto(estado){
  const p = $('painel-voz');
  if(!p) return;
  p.classList.toggle('aberto', estado);
  p.setAttribute('aria-hidden', estado ? 'false' : 'true');
  $('veu').classList.toggle('aberto', estado);
  $('gaveta').classList.remove('aberta');
  Foco.soltar($('gaveta'));      /* a gaveta some por baixo; o Tab não pode segui-la */
  if(estado){
    p.querySelector('.painel-corpo').scrollTop = 0;
    /* volta para o ☰ e não para o item da gaveta, que estará escondido */
    Foco.prender(p, { volta: $('btn-menu') });
    if(Voz.prefs.modo) Voz.anunciar('Leitura em voz');
  } else Foco.soltar(p);
}
$('btn-abrir-voz').onclick  = () => abrirPainelVoz(true);
$('btn-fechar-voz').onclick = () => abrirPainelVoz(false);

document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if($('folha-verso').classList.contains('ver')) fecharFolha();
  else if($('painel-voz').classList.contains('aberto')) abrirPainelVoz(false);
  else if($('painel-conta').classList.contains('aberto')) abrirPainelConta(false);
  else abrirMenu(false);
});

/* =========================================================
   Conta
   ========================================================= */
function abrirPainelConta(estado){
  if(estado){
    if(Navegacao.sair('gaveta', 1, () => abrirPainelConta(true))) return;
    Navegacao.entrar('painel-conta', () => abrirPainelContaDireto(false));
  } else if(Navegacao.sair('painel-conta')) return;
  abrirPainelContaDireto(estado);
}

function abrirPainelContaDireto(estado){
  const p = $('painel-conta');
  if(!p) return;
  p.classList.toggle('aberto', estado);
  p.setAttribute('aria-hidden', estado ? 'false' : 'true');
  $('veu').classList.toggle('aberto', estado);
  $('gaveta').classList.remove('aberta');
  Foco.soltar($('gaveta'));
       document.body.style.overflow = estado ? 'hidden' : '';
  if(estado){
    p.querySelector('.painel-corpo').scrollTop = 0;
    pintarPainel();
    Foco.prender(p, { volta: $('btn-abrir-conta') });
    if(Voz.prefs.modo) Voz.anunciar('Sua conta');
  } else Foco.soltar(p);
}

function pintarPainel(){
  const u = Conta.usuario;
  const fora = $('conta-deslogado'), dentro = $('conta-logado');
  if(!fora || !dentro) return;
  fora.classList.toggle('oculto', !!u);
  dentro.classList.toggle('oculto', !u);

  const marca = $('btn-abrir-conta');
  if(marca) marca.classList.toggle('conectado', !!u);

  if(!u) return;
  $('conta-quem').textContent = u.email;
  const estado = $('conta-estado');
  if(Conta.sujo) estado.textContent = 'Há mudanças ainda não enviadas.';
  else if(Conta.ultimaSync)
    estado.textContent = 'Última sincronização: ' +
      new Date(Conta.ultimaSync).toLocaleString('pt-BR');
  else estado.textContent = 'Ainda não sincronizado neste aparelho.';
}

function erroConta(msg){
  const el = $('conta-erro');
  if(!el) return;
  el.textContent = msg || '';
  el.classList.toggle('erro', !!msg);
}

$('btn-abrir-conta').onclick  = () => abrirPainelConta(true);
$('btn-fechar-conta').onclick = () => abrirPainelConta(false);

function dadosDoFormulario(){
  return {
    email: $('conta-email').value.trim(),
    senha: $('conta-senha').value
  };
}

$('btn-criar-conta').onclick = async function(){
  const { email, senha } = dadosDoFormulario();
  const aceitou = $('conta-consentimento').checked;
  $('linha-consentimento').classList.toggle('faltando', !aceitou);
  if(!aceitou) return erroConta('Marque a autorização para criar a conta.');
  erroConta('');
  this.disabled = true;
  try{ await Conta.registrar(email, senha, true); }
  catch(e){ erroConta(e.message); }
  finally{ this.disabled = false; }
};

$('btn-entrar-conta').onclick = async function(){
  const { email, senha } = dadosDoFormulario();
  erroConta('');
  this.disabled = true;
  try{ await Conta.entrar(email, senha); }
  catch(e){ erroConta(e.message); }
  finally{ this.disabled = false; }
};

$('conta-senha').onkeydown = e => { if(e.key === 'Enter') $('btn-entrar-conta').click(); };

$('btn-sincronizar').onclick = function(){
  this.disabled = true;
  Conta.sincronizar().finally(() => { this.disabled = false; });
};

$('btn-sair-conta').onclick = () => Conta.sair();

$('btn-excluir-conta').onclick = async function(){
  const senha = $('conta-senha-excluir').value;
  if(!senha) return avisar('Digite a senha para confirmar');
  if(!confirm('Isto apaga sua conta e todo o histórico guardado no servidor. Não dá para desfazer. Continuar?')) return;
  this.disabled = true;
  try{
    await Conta.excluir(senha);
    $('conta-senha-excluir').value = '';
    abrirPainelConta(false);
  }catch(e){ avisar(e.message); }
  finally{ this.disabled = false; }
};

/* envia o que estiver pendente antes de a aba fechar */
window.addEventListener('pagehide', () => { Conta.enviarSePendente(); });
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') Conta.enviarSePendente();
});

Conta.verificarSessao();

/* =========================================================
   Folha de ações do versículo
   ========================================================= */
$('fundo-folha').onclick = fecharFolha;

document.querySelectorAll('#folha-cores button').forEach(b => {
  b.onclick = () => definirCorDoVerso(b.dataset.cor || '');
});

$('fa-ouvir').onclick = () => {
  if(!versoAberto) return;
  const { nr, cap, verso, texto } = versoAberto;
  Voz.falar([
    { texto: refFalada(nr, cap, verso), rotulo: 'Referência' },
    { texto, rotulo: 'Versículo' }
  ], { titulo: livroPorNr(nr).nome + ' ' + cap + ':' + verso });
};

$('fa-fav').onclick = function(){
  if(!versoAberto) return;
  const { nr, cap, verso, texto } = versoAberto;
  const ref = livroPorNr(nr).nome + ' ' + cap + ':' + verso;
  const ativo = alternarFavorito({ nr, cap, verso, texto, versao: versaoAtual.nome, ref });
  pintarFavNaFolha(ativo);
};

$('fa-nota').onclick = () => mostrarPaineFolha('folha-nota');
$('fa-comparar').onclick = compararVersoes;
$('fa-refs').onclick = verReferencias;
$('btn-voltar-folha3').onclick = () => mostrarPaineFolha('folha-principal');
$('btn-voltar-folha').onclick = () => mostrarPaineFolha('folha-principal');
$('btn-voltar-folha2').onclick = () => mostrarPaineFolha('folha-principal');
/* sem o wrapper, o clique chegaria como argumento e viraria as opções */
$('btn-salvar-nota').onclick = () => salvarNotaDoVerso();

$('fa-enviar').onclick = () => mostrarPaineFolha('folha-enviar');
$('btn-voltar-folha4').onclick = () => mostrarPaineFolha('folha-principal');

$('fa-enviar-texto').onclick = () => {
  if(!versoAberto) return;
  const { nr, cap, verso, texto } = versoAberto;
  const ref = livroPorNr(nr).nome + ' ' + cap + ':' + verso;
  compartilharTexto(`"${texto}"\n${ref} — ${versaoAtual.nome}`, linkDoVerso(nr, cap, verso));
  /* a bandeja do sistema abre por cima; ao voltar, a folha não pode estar
     parada na tela de escolha, como se o envio não tivesse acontecido */
  mostrarPaineFolha('folha-principal');
};

$('fa-enviar-imagem').onclick = () => {
  if(!versoAberto) return;
  const { nr, cap, verso, texto } = versoAberto;
  /* O gerador só abre depois de a folha ter saído. Daqui há duas camadas
     no histórico — o painel de envio por cima da folha — e sair('folha')
     leva as duas: ele volta até a camada nomeada, não um degrau. */
  const gerar = () => abrirGeradorImagem(
    texto, livroPorNr(nr).nome + ' ' + cap + ':' + verso,
    versaoAtual.nome, '', [nr, cap, verso]);
  if(!Navegacao.sair('folha', 1, gerar)){
    mostrarPaineFolhaDireto('folha-principal');
    fecharFolhaDireto();
    gerar();
  }
};

$('btn-nota-voz').onclick = function(){
  Ditado.ouvir(this, dito => {
    const ta = $('campo-nota-verso');
    ta.value = (ta.value ? ta.value.trim() + ' ' : '') + dito;
    ta.focus();
  });
};

/* =========================================================
   Histórico do versículo do dia
   ========================================================= */
$('btn-hist').onclick = function(){
  const lista = $('lista-hist');
  const abrindo = lista.classList.contains('oculto');
  if(abrindo && !lista.children.length) montarHistorico();
  lista.classList.toggle('oculto', !abrindo);
  this.lastChild.textContent = abrindo ? ' Esconder os dias anteriores' : ' Ver os últimos 30 dias';
};

/* =========================================================
   Minhas orações
   ========================================================= */
$('btn-add-oracao').onclick = adicionarOracao;
$('campo-oracao').onkeydown = e => {
  if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)) adicionarOracao();
};

/* O campo perdeu a alça de redimensionar — ela nascia no canto onde o
   microfone agora fica. Em troca cresce sozinho: zera a altura para o
   scrollHeight voltar a medir o conteúdo, não a altura de antes. */
function ajustarCampoOracao(){
  const ta = $('campo-oracao');
  ta.style.height = 'auto';
  /* com box-sizing: border-box a altura inclui a borda, e scrollHeight
     não — sem somar as duas o campo fica 2px curto e corta a última
     linha justamente de quem escreveu mais */
  const borda = ta.offsetHeight - ta.clientHeight;
  ta.style.height = Math.max(ta.scrollHeight + borda, 108) + 'px';
}
$('campo-oracao').addEventListener('input', ajustarCampoOracao);
$('btn-oracao-voz').onclick = function(){
  Ditado.ouvir(this, dito => {
    const ta = $('campo-oracao');
    ta.value = (ta.value ? ta.value.trim() + ' ' : '') + dito;
    ajustarCampoOracao();
    ta.focus();
  });
};
$('btn-ouvir-oracoes').onclick = function(){
  const lista = carregarOracoes();
  if(!lista.length) return avisar('Você ainda não tem pedidos');
  const itens = $('lista-oracoes').querySelectorAll('.item-oracao');
  if(this.classList.contains('tocando')) return Voz.parar();
  Voz.falar(lista.map((o, i) => ({
    texto: o.texto + (o.respondida ? '. Respondida.' : ''),
    rotulo: 'Pedido ' + (i + 1),
    el: itens[i]
  })), { titulo: 'Meus pedidos', botao: this });
};
renderOracoes();

/* =========================================================
   Busca por voz
   ========================================================= */
$('btn-busca-voz').onclick = function(){
  Ditado.ouvir(this, dito => {
    const arrumado = arrumarReferenciaFalada(dito);
    avisar('Buscando: ' + arrumado);
    /* pela mesma porta das outras: ditar também entra nas recentes */
    BuscaMemoria.executar(arrumado);
  });
};

/* notas antigas presas a favoritos passam a viver no store próprio */
migrarNotasDosFavoritos();

/* esconde os microfones onde o navegador não entende ditado */
document.documentElement.setAttribute('data-ditado', Ditado.suporta ? '1' : '0');

/* =========================================================
   Controles da leitura em voz
   ========================================================= */

/* ---------- barra do reprodutor ---------- */
const VELOCIDADES = [0.7, 0.85, 1, 1.15, 1.35];

$('audio-play').onclick   = () => Voz.alternarPausa();
$('audio-parar').onclick  = () => Voz.parar();
$('audio-prox').onclick   = () => Voz.proxima();
$('audio-ant').onclick    = () => Voz.anterior();
$('audio-vel').onclick    = () => {
  const i = VELOCIDADES.indexOf(Voz.prefs.vel);
  const nova = VELOCIDADES[(i + 1) % VELOCIDADES.length];
  Voz.definirVelocidade(nova);
  marcarVelocidade(nova);
};

/* ---------- seção "Leitura em voz" ---------- */
function marcarVelocidade(v){
  document.querySelectorAll('#opcoes-vel button').forEach(b =>
    b.classList.toggle('ativo', Number(b.dataset.vel) === Number(v))
  );
}

function montarSelectVozes(){
  const sel = $('sel-voz');
  if(!sel) return;
  const vozes = Voz.vozes;
  sel.innerHTML = '';
  if(!vozes.length){
    const o = document.createElement('option');
    o.textContent = 'Nenhuma voz encontrada no aparelho';
    sel.appendChild(o);
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  vozes.forEach(v => {
    const o = document.createElement('option');
    o.value = v.voiceURI;
    o.textContent = v.name + ' (' + v.lang + ')';
    if(Voz.vozAtual && v.voiceURI === Voz.vozAtual.voiceURI) o.selected = true;
    sel.appendChild(o);
  });
}
document.addEventListener('vozes-prontas', montarSelectVozes);
montarSelectVozes();

if($('sel-voz')) $('sel-voz').onchange = e => {
  Voz.definirVoz(e.target.value);
  Voz.anunciar('Esta é a voz escolhida para a leitura.');
};

document.querySelectorAll('#opcoes-vel button').forEach(b => {
  b.onclick = () => {
    Voz.definirVelocidade(Number(b.dataset.vel));
    marcarVelocidade(Number(b.dataset.vel));
  };
});
marcarVelocidade(Voz.prefs.vel);

if($('btn-testar-voz')) $('btn-testar-voz').onclick = () => {
  Voz.falar([
    { texto: 'Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.', rotulo: 'Exemplo' },
    { texto: refFalada(19, 119, 105), rotulo: 'Referência' }
  ], { titulo: 'Exemplo de leitura' });
};

/* ---------- chaves de configuração ---------- */
function ligarChave(id, campo, aoMudar){
  const b = $(id);
  if(!b) return;
  const aplicar = () => {
    const v = !!Voz.prefs[campo];
    b.classList.toggle('ativo', v);
    b.setAttribute('aria-checked', v ? 'true' : 'false');
  };
  aplicar();
  b.onclick = () => {
    Voz.prefs[campo] = !Voz.prefs[campo];
    Voz.salvar();
    aplicar();
    if(aoMudar) aoMudar(Voz.prefs[campo]);
  };
}

function aplicarModoAudio(ligado){
  document.documentElement.setAttribute('data-audio', ligado ? '1' : '0');
}

ligarChave('chave-modo-audio', 'modo', ligado => {
  aplicarModoAudio(ligado);
  Voz.anunciar(ligado
    ? 'Modo áudio ligado. Segure qualquer botão para ouvir o que ele faz.'
    : 'Modo áudio desligado.');
});
ligarChave('chave-num-versiculo', 'num');
ligarChave('chave-auto-cap', 'autoCap');
aplicarModoAudio(Voz.prefs.modo);

if(!Voz.suporta && $('aviso-voz')){
  $('aviso-voz').textContent =
    'Este navegador não faz leitura em voz. Tente pelo Chrome no Android ou pelo Safari no iPhone.';
}

/* ---------- ouvir o resumo da jornada ---------- */
(function ouvirStats(){
  const linha = $('linha-ouvir-stats');
  if(!linha) return;
  const plural = (n, s, p) => n + ' ' + (Number(n) === 1 ? s : p);
  linha.appendChild(criarBotaoOuvir('Ouvir meu resumo', () => {
    const n = id => ($(id) ? $(id).textContent : '0');
    return [{
      texto: 'Sua jornada. ' +
             plural(n('stat-streak'), 'dia seguido', 'dias seguidos') + '. ' +
             plural(n('stat-caps'), 'capítulo lido', 'capítulos lidos') + '. ' +
             plural(n('stat-favs'), 'versículo favorito', 'versículos favoritos') + '. ' +
             plural(n('stat-planos'), 'dia de plano concluído', 'dias de planos concluídos') + '. ' +
             ($('stat-msg') ? $('stat-msg').textContent : ''),
      rotulo: 'Resumo',
      el: $('grid-stats')
    }];
  }, { classe: 'claro', voz: { titulo: 'Sua jornada' } }));
})();

/* ---------- modo áudio: anunciar a seção ao navegar ---------- */
document.querySelectorAll('.gaveta a[data-fecha]').forEach(a => {
  a.addEventListener('click', () => {
    if(Voz.prefs.modo) Voz.anunciar(a.textContent.trim());
  });
});

/* ---------- modo áudio: toque longo diz o que o botão faz ---------- */
(function toqueLongo(){
  let tempo = null, disparou = false, x0 = 0, y0 = 0;

  /* o rótulo falado ignora ícones decorativos: "▶ Ouvir" vira "Ouvir" */
  const rotuloDe = el => {
    const aria = el.getAttribute('aria-label');
    if(aria) return aria;
    if(el.title) return el.title;
    const copia = el.cloneNode(true);
    copia.querySelectorAll('[aria-hidden="true"]').forEach(x => x.remove());
    return (copia.textContent || '')
      .replace(/[\u2000-\u33FF\u{1F000}-\u{1FAFF}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cancelar = () => { clearTimeout(tempo); tempo = null; };

  document.addEventListener('pointerdown', e => {
    if(!Voz.prefs.modo) return;
    const alvo = e.target.closest('button, a[href], select');
    if(!alvo) return;
    x0 = e.clientX; y0 = e.clientY;
    disparou = false;
    cancelar();
    tempo = setTimeout(() => {
      disparou = true;
      const r = rotuloDe(alvo);
      if(r) Voz.anunciar(r);
    }, 600);
  });

  document.addEventListener('pointermove', e => {
    if(!tempo) return;
    if(Math.abs(e.clientX - x0) > 12 || Math.abs(e.clientY - y0) > 12) cancelar();
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    document.addEventListener(ev, cancelar)
  );

  // o toque longo só anuncia: não deixa o clique acontecer
  document.addEventListener('click', e => {
    if(!disparou) return;
    disparou = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
})();

/* a fala do navegador sobrevive à navegação: encerra ao sair */
window.addEventListener('pagehide', () => Voz.parar(true));

/* ---------- planos de leitura ---------- */
const PLANOS = [
  {
    id: 'joao7',
    nome: 'Evangelho de João',
    desc: '7 dias conhecendo Jesus no Evangelho de João.',
    dias: [
      [43,1],[43,3],[43,6],[43,10],[43,14],[43,15],[43,20]
    ]
  },
  {
    id: 'salmos21',
    nome: 'Salmos de confiança',
    desc: '21 dias em salmos de paz, proteção e esperança.',
    dias: [
      [19,1],[19,8],[19,16],[19,19],[19,23],[19,27],[19,34],
      [19,37],[19,42],[19,46],[19,51],[19,56],[19,62],[19,63],
      [19,84],[19,90],[19,91],[19,103],[19,121],[19,139],[19,145]
    ]
  },
  {
    id: 'nt40',
    nome: 'Novo Testamento em 40 dias',
    desc: 'Um panorama do NT em 40 leituras selecionadas.',
    dias: [
      [40,5],[40,6],[41,1],[42,2],[42,15],[43,1],[43,3],[43,14],
      [44,2],[44,9],[45,5],[45,8],[45,12],[46,13],[47,5],[48,5],
      [49,1],[49,6],[50,2],[50,4],[51,3],[52,5],[54,2],[55,3],
      [58,11],[58,12],[59,1],[60,1],[60,5],[61,1],[62,1],[62,4],
      [65,1],[66,1],[66,21],[40,28],[42,24],[43,21],[44,1],[45,1]
    ]
  },
  {
    id: 'proverbios31',
    nome: 'Provérbios em 31 dias',
    desc: 'Um capítulo de sabedoria por dia do mês.',
    dias: Array.from({length: 31}, (_, i) => [20, i + 1])
  },
  {
    id: 'ansiedade14',
    nome: 'Para dias de ansiedade',
    desc: '14 leituras sobre paz, cuidado e descanso em Deus.',
    dias: [
      [40,6],[19,23],[19,46],[19,55],[23,41],[50,4],[60,5],
      [42,12],[19,94],[24,29],[45,8],[58,4],[19,121],[43,14]
    ]
  },
  {
    id: 'luto12',
    nome: 'Consolo na perda',
    desc: '12 leituras para acompanhar quem atravessa o luto.',
    dias: [
      [19,23],[19,34],[25,3],[40,5],[43,11],[43,14],
      [45,8],[47,1],[52,4],[66,21],[18,19],[21,3]
    ]
  },
  {
    id: 'casamento14',
    nome: 'Casamento e família',
    desc: '14 leituras sobre amor, perdão e vida a dois.',
    dias: [
      [46,13],[49,5],[51,3],[20,31],[8,1],[1,2],[19,127],
      [20,15],[45,12],[59,1],[62,4],[50,2],[21,4],[22,8]
    ]
  },
  {
    id: 'jesus30',
    nome: 'A vida de Jesus em 30 dias',
    desc: 'Do nascimento à ressurreição, pelos quatro Evangelhos.',
    dias: [
      [42,1],[42,2],[40,3],[40,4],[43,1],[43,2],[40,5],[40,6],[40,7],
      [41,1],[41,2],[42,6],[43,4],[43,6],[41,4],[42,10],[42,15],
      [43,8],[43,11],[40,13],[41,8],[42,19],[43,13],[43,14],[43,15],
      [40,26],[41,14],[42,23],[43,19],[43,20]
    ]
  },
  {
    id: 'gratidao7',
    nome: 'Sete dias de gratidão',
    desc: 'Uma semana curta para reaprender a agradecer.',
    dias: [ [19,100],[19,103],[19,136],[51,3],[52,5],[19,107],[66,4] ]
  }
];
/* Um dia de plano é [nr, cap] ou uma lista deles.
   Normalizar aqui deixa o resto do código indiferente ao formato. */
function capitulosDoDia(dia){
  return typeof dia[0] === 'number' ? [dia] : dia;
}

/* "Gênesis 1–3" ou "Gênesis 50 · Êxodo 1" */
function rotuloDoDia(caps){
  const grupos = [];
  caps.forEach(([nr, cap]) => {
    const ultimo = grupos[grupos.length - 1];
    if(ultimo && ultimo.nr === nr && cap === ultimo.fim + 1) ultimo.fim = cap;
    else grupos.push({ nr, ini: cap, fim: cap });
  });
  return grupos
    .map(g => livroPorNr(g.nr).nome + ' ' + (g.ini === g.fim ? g.ini : g.ini + '–' + g.fim))
    .join(' · ');
}

/* Distribui uma faixa de livros em N dias, mantendo a ordem canônica.
   Serve para montar planos longos sem escrever centenas de referências. */
function planoPorCapitulos(nrInicial, nrFinal, dias){
  const todos = [];
  for(let nr = nrInicial; nr <= nrFinal; nr++){
    const l = livroPorNr(nr);
    for(let c = 1; c <= l.caps; c++) todos.push([nr, c]);
  }
  const porDia = todos.length / dias;
  const saida = [];
  let pos = 0;
  for(let d = 0; d < dias; d++){
    const ate = d === dias - 1 ? todos.length : Math.round((d + 1) * porDia);
    saida.push(todos.slice(pos, ate));
    pos = ate;
  }
  return saida.filter(x => x.length);
}

PLANOS.push(
  {
    id: 'biblia365',
    nome: 'Bíblia em 1 ano',
    desc: 'Toda a Bíblia em 365 dias — dá para ouvir cada dia inteiro.',
    dias: planoPorCapitulos(1, 66, 365)
  },
  {
    id: 'nt90',
    nome: 'Novo Testamento em 90 dias',
    desc: 'De Mateus a Apocalipse em três meses.',
    dias: planoPorCapitulos(40, 66, 90)
  },
  {
    id: 'salmosprov60',
    nome: 'Salmos e Provérbios em 60 dias',
    desc: 'Louvor e sabedoria, lado a lado, por dois meses.',
    dias: planoPorCapitulos(19, 20, 60)
  }
);

/* Ouvir todos os capítulos de um dia, em sequência */
async function ouvirLeituraDoDia(caps, rotulo){
  Voz.destravar();
  Voz.parar(true);
  avisar('Preparando a leitura…');
  const partes = [];
  for(const [nr, cap] of caps){
    try{
      const d = await buscarCapitulo(nr, cap);
      partes.push({ texto: nomeFalado(livroPorNr(nr).nome) + ', capítulo ' + cap, rotulo: 'Início' });
      d.itens.forEach(item => {
        if(item.tipo === 'titulo') return partes.push({ texto: item.texto, rotulo: 'Título' });
        partes.push({
          texto: (Voz.prefs.num ? 'Versículo ' + item.numero + '. ' : '') + item.texto,
          rotulo: livroPorNr(nr).nome + ' ' + cap + ':' + item.numero
        });
      });
      marcouLido(nr, cap);
    }catch(e){
      partes.push({ texto: 'Não deu para carregar ' + livroPorNr(nr).nome + ' ' + cap + '.', rotulo: 'Erro' });
    }
  }
  if(!partes.length) return avisar('Não deu para carregar a leitura de hoje');
  Voz.falar(partes, { titulo: rotulo });
  atualizarStats();
}

const CHAVE_PLANOS = 'lampada-planos-progresso';
function carregarProgPlanos(){
  try { return JSON.parse(localStorage.getItem(CHAVE_PLANOS) || '{}'); }
  catch { return {}; }
}
function salvarProgPlanos(p){ localStorage.setItem(CHAVE_PLANOS, JSON.stringify(p)); Conta.marcarSujo(); }

/* =========================================================
   CONTINUAR DE ONDE PAROU
   Quem estava no dia 12 de um plano não via isso em lugar
   nenhum na tela Hoje: tinha de ir na aba Planos, achar o
   plano e achar o dia. É o que mais pesa em voltar no dia
   seguinte, então mora ao lado do devocional.
   ========================================================= */
const CHAVE_PLANO_ATUAL = 'lampada-plano-atual';

function planoEmAndamento(){
  const prog = carregarProgPlanos();
  const emAndamento = PLANOS
    .map(p => ({ plano: p, feitos: new Set(prog[p.id] || []) }))
    .filter(x => x.feitos.size > 0 && x.feitos.size < x.plano.dias.length);
  if(!emAndamento.length) return null;
  /* o último aberto ganha; sem essa marca — outro aparelho, por exemplo —
     vale o mais adiantado, que é onde há mais a perder parando */
  const ultimo = localStorage.getItem(CHAVE_PLANO_ATUAL);
  return emAndamento.find(x => x.plano.id === ultimo)
      || emAndamento.sort((a, b) => b.feitos.size - a.feitos.size)[0];
}

function montarContinuar(){
  const sec = $('sec-continuar');
  if(!sec) return;
  const atual = planoEmAndamento();
  sec.classList.toggle('oculto', !atual);
  if(!atual) return;

  const { plano, feitos } = atual;
  /* o próximo é o primeiro que falta, e não o seguinte ao último marcado:
     dá para marcar os dias fora de ordem */
  let dia = 1;
  while(feitos.has(dia)) dia++;
  const caps = capitulosDoDia(plano.dias[dia - 1]);
  const rotulo = rotuloDoDia(caps);
  const pct = Math.round(feitos.size / plano.dias.length * 100);

  const cx = $('cartao-continuar');
  cx.innerHTML =
    `<h3 class="continuar-nome"></h3>
     <div class="continuar-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span></span></div>
     <p class="continuar-meta"></p>
     <p class="continuar-ref"></p>
     <div class="continuar-acoes"></div>`;
  cx.querySelector('.continuar-nome').textContent = plano.nome;
  cx.querySelector('.continuar-meta').textContent =
    feitos.size + ' de ' + plano.dias.length + ' dias · ' + pct + '%';
  cx.querySelector('.continuar-ref').textContent = 'Dia ' + dia + ' · ' + rotulo;
  const barra = cx.querySelector('.continuar-barra');
  barra.setAttribute('aria-valuenow', String(pct));
  barra.setAttribute('aria-label', plano.nome + ': ' + pct + ' por cento concluído');
  barra.firstElementChild.style.width = pct + '%';

  const acoes = cx.querySelector('.continuar-acoes');
  const botao = (rot, classe, aoTocar) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = classe;
    b.textContent = rot;
    b.onclick = aoTocar;
    acoes.appendChild(b);
    return b;
  };
  const marcarAtual = () => localStorage.setItem(CHAVE_PLANO_ATUAL, plano.id);
  botao('Ler o dia ' + dia, 'btn', () => {
    marcarAtual();
    const [nr, cap] = caps[0];
    abrirLeitura(nr, cap);
  });
  /* ouvirLeituraDoDia cuida da própria fila de voz, como nas linhas do
     plano — aqui um botão comum basta */
  botao('Ouvir', 'btn claro', () => { marcarAtual(); ouvirLeituraDoDia(caps, rotulo); })
    .setAttribute('aria-label', 'Ouvir ' + rotulo);
  botao('Ver o plano', 'btn claro', () => {
    marcarAtual();
    mostrarSecao('sec-planos');
    abrirPlano(plano.id);
  });
}

function montarPlanos(){
  const grid = $('grid-planos');
  if(!grid) return;
  const prog = carregarProgPlanos();
  grid.innerHTML = '';
  PLANOS.forEach(plano => {
    const feitos = (prog[plano.id] || []).length;
    const card = document.createElement('div');
    card.className = 'card-plano';
    card.innerHTML =
      `<h3>${plano.nome}</h3>
       <p>${plano.desc}</p>
       <div class="meta-plano">${feitos}/${plano.dias.length} dias · ${plano.dias.length} leituras</div>
       <button class="btn" type="button">${feitos ? 'Continuar' : 'Começar'}</button>`;
    card.querySelector('button').onclick = () => abrirPlano(plano.id);
    grid.appendChild(card);
  });
}

function abrirPlano(id){
  const plano = PLANOS.find(p => p.id === id);
  if(!plano) return;
  localStorage.setItem(CHAVE_PLANO_ATUAL, id);
  const area = $('area-plano-ativo');
  const prog = carregarProgPlanos();
  const feitos = new Set(prog[id] || []);
  area.classList.remove('oculto');
  area.innerHTML = `<h3 class="titulo-menor">${plano.nome}</h3>`;
  plano.dias.forEach((ref, i) => {
    const caps = capitulosDoDia(ref);
    const [nr, cap] = caps[0];
    const rotulo = rotuloDoDia(caps);
    const dia = i + 1;
    const ok = feitos.has(dia);
    const row = document.createElement('div');
    row.className = 'plano-dia';
    row.innerHTML =
      `<div>
         <div class="ref-dia">Dia ${dia} · ${rotulo}</div>
         ${ok ? '<span class="feito">Concluído</span>' : ''}
       </div>
       <div class="linha-8">
         <button class="btn-sm dia-ouvir" type="button" aria-label="Ouvir ${rotulo}">▶ Ouvir</button>
         <button class="btn-sm dia-ler" type="button">Ler</button>
         <button class="btn-sm dia-marcar ${ok ? 'ativo' : ''}" type="button">${ok ? '✓ Feito' : 'Marcar'}</button>
       </div>`;
    const btnLer = row.querySelector('.dia-ler');
    const btnMarcar = row.querySelector('.dia-marcar');
    row.querySelector('.dia-ouvir').onclick = () => ouvirLeituraDoDia(caps, rotulo);
    btnLer.onclick = () => {
      abrirLeitura(nr, cap);
      mostrarSecao('sec-biblia');
    };
    btnMarcar.onclick = () => {
      const p = carregarProgPlanos();
      const lista = new Set(p[id] || []);
      if(lista.has(dia)) lista.delete(dia); else lista.add(dia);
      p[id] = [...lista].sort((a,b)=>a-b);
      salvarProgPlanos(p);
      localStorage.setItem(CHAVE_PLANO_ATUAL, id);
      abrirPlano(id);
      montarPlanos();
      montarContinuar();
      atualizarStats();
      registrarAtividade();
    };
    area.appendChild(row);
  });
  area.scrollIntoView({behavior:'smooth', block:'start'});
}

/* ---------- PWA + lembrete ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  const btn = $('btn-instalar-pwa');
  if(btn) btn.style.display = '';
});

function registrarSW(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(err => console.info('SW:', err));
}

function atualizarStatusPWA(){
  const el = $('status-pwa');
  if(!el) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const notif = ('Notification' in window) ? Notification.permission : 'unsupported';
  const pushOn = localStorage.getItem('lampada-lembrete') === '1';
  let t = [];
  if(standalone) t.push('App instalado.');
  if(pushOn && notif === 'granted') t.push('Web Push ativo (lembrete ~8h).');
  else if(notif === 'granted') t.push('Notificações permitidas — toque em “Ativar lembrete diário”.');
  else if(notif === 'denied') t.push('Notificações bloqueadas no navegador.');
  else if(notif === 'unsupported') t.push('Notificações não disponíveis neste navegador.');
  el.textContent = t.join(' ') || 'Instale o app e ative o Web Push para o lembrete diário.';
}

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function obterChaveVapid(){
  const r = await fetch('/api/vapid-public');
  if(!r.ok) throw new Error('Chave VAPID indisponível no servidor');
  const d = await r.json();
  if(!d.publicKey) throw new Error('Chave pública vazia');
  return d.publicKey;
}

/* =========================================================
   MÉTRICAS — só o suficiente para saber se o app serve

   Sem isso não há decisão comercial possível: não se sabe quantos
   voltam no dia seguinte, quantos terminam o devocional, se o lembrete
   traz alguém de volta. Mas medir num app devocional pede cuidado.

   O que sai daqui: uma lista de nomes de evento e um identificador
   aleatório gerado no aparelho. Nada de conta, nada de versículo lido,
   nada de oração escrita, nada de endereço de IP guardado.

   O identificador serve só para o servidor contar aparelhos distintos
   num HyperLogLog — um esboço que responde "quantos" sem guardar
   "quais". Ele entra e não fica.

   Respeita o "não me rastreie" do navegador e tem desligamento na tela.
   ========================================================= */
const CHAVE_METRICAS = 'lampada-metricas';
const CHAVE_ID_ANON = 'lampada-id-anon';

const Metricas = (() => {
  const fila = [];
  let enviando = null;

  const naoRastrear = () =>
    navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1';

  /* opt-out explícito na tela, e o "não me rastreie" do navegador
     também vale — quem já disse ao navegador não precisa repetir aqui */
  const ligado = () => localStorage.getItem(CHAVE_METRICAS) !== '0' && !naoRastrear();

  function id(){
    let v = localStorage.getItem(CHAVE_ID_ANON);
    if(!v){
      v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/[^a-z0-9]/g, '').slice(0, 24);
      localStorage.setItem(CHAVE_ID_ANON, v);
    }
    return v;
  }

  function anotar(evento){
    if(!ligado()) return;
    if(fila.includes(evento)) return;   /* uma vez por sessão basta */
    fila.push(evento);
    if(!enviando) enviando = setTimeout(despachar, 4000);
  }

  function despachar(){
    enviando = null;
    if(!fila.length || !ligado()) return;
    const corpo = JSON.stringify({ eventos: fila.splice(0, fila.length), id: id() });
    /* sendBeacon sobrevive ao fechamento da aba; o fetch é o plano B */
    try {
      if(navigator.sendBeacon &&
         navigator.sendBeacon('/api/metricas', new Blob([corpo], { type: 'application/json' }))) return;
    } catch(_) {}
    fetch('/api/metricas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: corpo, keepalive: true
    }).catch(() => {});
  }

  addEventListener('pagehide', despachar);
  addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') despachar(); });

  return { anotar, ligado, despachar,
    desligar(v){ localStorage.setItem(CHAVE_METRICAS, v ? '1' : '0'); },
    naoRastrear };
})();

Metricas.anotar('abriu');

/* =========================================================
   O LEMBRETE NA HORA DE QUEM RECEBE

   O envio era um cron diário num horário só do mundo: 8h de Brasília,
   que é 3h da manhã em Los Angeles e 19h em Manila. Num produto de
   hábito diário, a hora da entrega é o produto.

   O aparelho informa o próprio fuso; o servidor guarda e passa a rodar
   de hora em hora, entregando só a quem está na hora escolhida.
   ========================================================= */
const CHAVE_HORA_LEMBRETE = 'lampada-hora-lembrete';

function fusoDoAparelho(){
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
  catch(_) { return ''; }
}
function horaDoLembrete(){
  const h = parseInt(localStorage.getItem(CHAVE_HORA_LEMBRETE), 10);
  return (h >= 0 && h <= 23) ? h : 8;
}

/* Quem viaja leva o app junto: o fuso guardado na inscrição fica para
   trás e o lembrete passaria a chegar na hora do país de origem. A cada
   abertura, se o fuso mudou, a inscrição é reenviada. */
async function conferirFusoDoLembrete(){
  if(localStorage.getItem('lampada-lembrete') !== '1') return;
  const atual = fusoDoAparelho();
  if(!atual || localStorage.getItem('lampada-fuso-enviado') === atual + '|' + horaDoLembrete()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(!sub) return;
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), fuso: atual, hora: horaDoLembrete() })
    });
    if(r.ok) localStorage.setItem('lampada-fuso-enviado', atual + '|' + horaDoLembrete());
  } catch(_) { /* sem rede agora; tenta na próxima abertura */ }
}

/* Monta o seletor, mostra o fuso que o aparelho informa e reenvia a
   inscrição quando a pessoa troca de horário. */
function montarHoraLembrete(){
  const linha = $('linha-hora-lembrete');
  const sel = $('hora-lembrete');
  if(!linha || !sel) return;
  const ativo = localStorage.getItem('lampada-lembrete') === '1';
  linha.classList.toggle('oculto', !ativo);
  if(!ativo) return;

  if(!sel.options.length){
    for(let h = 0; h < 24; h++){
      const o = document.createElement('option');
      o.value = h;
      o.textContent = String(h).padStart(2, '0') + ':00';
      sel.appendChild(o);
    }
    sel.onchange = async () => {
      localStorage.setItem(CHAVE_HORA_LEMBRETE, sel.value);
      /* zera a marca para conferirFusoDoLembrete reenviar a inscrição */
      localStorage.removeItem('lampada-fuso-enviado');
      await conferirFusoDoLembrete();
      avisar('Lembrete às ' + String(sel.value).padStart(2, '0') + ':00');
    };
  }
  sel.value = String(horaDoLembrete());
  const fuso = fusoDoAparelho();
  $('fuso-aviso').textContent = fuso
    ? 'No horário de ' + fuso.replace(/_/g, ' ') + ', o do seu aparelho.'
    : 'No horário do seu aparelho.';
}

async function pedirLembrete(){
  if(!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)){
    avisar('Este navegador não suporta Web Push');
    return;
  }
  let perm = Notification.permission;
  if(perm === 'default') perm = await Notification.requestPermission();
  if(perm !== 'granted'){
    avisar('Permissão de notificação não concedida');
    atualizarStatusPWA();
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const publicKey = await obterChaveVapid();
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    const resp = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), fuso: fusoDoAparelho(), hora: horaDoLembrete() })
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok){
      throw new Error(data.error || data.hint || ('Erro ' + resp.status));
    }
    localStorage.setItem('lampada-lembrete', '1');
    localStorage.setItem('lampada-fuso-enviado', fusoDoAparelho() + '|' + horaDoLembrete());
    try {
      reg.showNotification('Bíblia Devocional', {
        body: 'Web Push ativado. Você receberá o lembrete diário por volta das '
              + horaDoLembrete() + 'h, no seu horário.',
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } catch(_) {}
    avisar('Lembrete Web Push ativado');
    Metricas.anotar('push_ativado');
    montarHoraLembrete();
  } catch(e){
    console.info(e);
    avisar(e.message || 'Não foi possível ativar o Web Push');
  }
  atualizarStatusPWA();
}

/* Chamado aqui, e não lá em cima junto das outras inicializações:
   `montarHoraLembrete` lê CHAVE_HORA_LEMBRETE, que é `const` e não sobe
   com o içamento como as funções sobem. Chamando antes, quem tinha o
   lembrete ligado — só quem — tomava um erro na abertura. */
montarHoraLembrete();
conferirFusoDoLembrete();

/* o desligamento das métricas, e o aviso de que o navegador já disse não */
(function ligarOptMetricas(){
  const c = $('opt-metricas');
  if(!c) return;
  const nota = $('metricas-nota');
  if(Metricas.naoRastrear()){
    c.checked = false;
    c.disabled = true;
    nota.textContent = 'Desligado: o seu navegador pede para não ser rastreado, e isso é respeitado.';
    return;
  }
  c.checked = Metricas.ligado();
  nota.textContent = 'Só contagens: quantos abriram, quantos leram. Nunca o que você lê, escreve ou ora.';
  c.onchange = () => {
    Metricas.desligar(c.checked);
    avisar(c.checked ? 'Obrigado por ajudar' : 'Estatísticas desligadas');
  };
})();

async function desativarLembrete(){
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch(_) {}
  localStorage.removeItem('lampada-lembrete');
  avisar('Lembrete desativado');
  atualizarStatusPWA();
}

function agendarLembreteDiario(){
  /* Mantido como fallback local se o app estiver aberto; o envio real é via /api/daily-push */
}

const btnInstalar = $('btn-instalar-pwa');
if(btnInstalar){
  btnInstalar.onclick = async () => {
    if(deferredInstall){
      deferredInstall.prompt();
      const { outcome } = await deferredInstall.userChoice;
      if(outcome === 'accepted') avisar('App instalado');
      deferredInstall = null;
    } else {
      avisar('No celular: menu do navegador → Instalar app / Adicionar à tela inicial');
    }
    atualizarStatusPWA();
  };
}
const btnLembrete = $('btn-lembrete');
if(btnLembrete) btnLembrete.onclick = pedirLembrete;

versaoAtual = VERSOES[0];
montarVersoes();
renderFavoritos();
montarTemas();
desenharLivros();
montarPlanos();
montarContinuar();
montarRetomar();
saudar();
versiculoDoDia();
atualizarProgressoBiblia();
atualizarStats();
registrarSW();
atualizarStatusPWA();
agendarLembreteDiario();
descobrirTudo().then(() => {
  montarVersoes();
});

/* ---------- modo foco ---------- */
function entrarModoFoco(){
  document.body.classList.add('modo-foco');
  localStorage.setItem('lampada-modo-foco', '1');
  try { abrirMenu(false); } catch(_) {}
  try { if(window.speechSynthesis) speechSynthesis.cancel(); } catch(_) {}
  const bibliaAberta = $('nivel-leitura') && !$('nivel-leitura').classList.contains('oculto');
  const alvo = bibliaAberta ? $('sec-biblia') : ($('sec-hoje') || $('sec-biblia'));
  if(alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  avisar('Modo foco ativo — Esc ou “Sair do foco” para voltar');
}
function sairModoFoco(){
  document.body.classList.remove('modo-foco');
  localStorage.removeItem('lampada-modo-foco');
  avisar('Modo foco desativado');
}
function alternarModoFoco(){
  if(document.body.classList.contains('modo-foco')) sairModoFoco();
  else entrarModoFoco();
}
(function initModoFoco(){
  const b1 = $('btn-entrar-foco');
  const b2 = $('btn-sair-foco');
  const b3 = $('btn-foco-menu');
  if(b1) b1.onclick = entrarModoFoco;
  if(b2) b2.onclick = sairModoFoco;
  if(b3) b3.onclick = () => { try { abrirMenu(false); } catch(_) {} entrarModoFoco(); };
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && document.body.classList.contains('modo-foco')){
      e.preventDefault();
      sairModoFoco();
    }
    if((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey){
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if(tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
      e.preventDefault();
      alternarModoFoco();
    }
  });
})();

/* =========================================================
   GESTOS DE LEITURA (SWIPE)
   Permite avançar ou voltar capítulos deslizando a tela
   ========================================================= */
(function initSwipeLeitura() {
  let touchstartX = 0;
  let touchstartY = 0;
  let touchendX = 0;
  let touchendY = 0;

  const area = document.getElementById('nivel-leitura');
  if (!area) return;

  area.addEventListener('touchstart', function(event) {
    touchstartX = event.changedTouches[0].screenX;
    touchstartY = event.changedTouches[0].screenY;
  }, { passive: true });

  area.addEventListener('touchend', function(event) {
    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    if (area.classList.contains('oculto')) return;

    const deltaX = touchendX - touchstartX;
    const deltaY = touchendY - touchstartY;

    const thresholdX = 60; // Mínimo de movimento horizontal para ser swipe
    const limiteY = 45;    // MÁXIMO de movimento vertical permitido

    // O swipe agora só aciona se for intencionalmente reto (horizontal)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > thresholdX && Math.abs(deltaY) < limiteY) {
      
      const passos = area.querySelector('.passos');
      if (!passos) return;

      const botoes = passos.querySelectorAll('button');
      let btnAnterior = null;
      let btnProximo = null;

      botoes.forEach(b => {
        if (b.textContent.includes('Anterior')) btnAnterior = b;
        if (b.textContent.includes('Próximo')) btnProximo = b;
      });

      if (deltaX < 0) {
        if (btnProximo) btnProximo.click();
      } else {
        if (btnAnterior) btnAnterior.click();
      }
    }
  }
})();

/* =========================================================
   BARRA SUPERIOR DINÂMICA
   Esconde ao rolar para baixo, mostra ao rolar para cima
   ========================================================= */
(function initBarraDinamica() {
  let ultimoScroll = window.scrollY;
  const barra = document.querySelector('header.barra');
  let animando = false; // Controle de quadros para evitar travamentos
  
  if (!barra) return;

  window.addEventListener('scroll', function() {
    const atualScroll = window.scrollY;
    
    if (document.body.style.overflow === 'hidden') return;

    // requestAnimationFrame sincroniza a leitura com a taxa de atualização da tela
    if (!animando) {
      window.requestAnimationFrame(function() {
        if (atualScroll > ultimoScroll && atualScroll > 60) {
          barra.classList.add('escondida');
        } else if (atualScroll < ultimoScroll) {
          barra.classList.remove('escondida');
        }
        ultimoScroll = atualScroll;
        animando = false;
      });
      animando = true;
    }
  }, { passive: true });
})();


     
