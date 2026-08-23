/**
 * LIMITE POR ORIGEM
 *
 * O travamento de login existia, mas contava por e-mail. Duas coisas
 * passavam por baixo dele:
 *
 *   1. Pulverização de senha. Tentar UMA senha comum contra dez mil
 *      e-mails nunca chega a 10 tentativas em e-mail nenhum, então o
 *      contador por e-mail jamais dispara.
 *   2. Negação de serviço contra a pessoa. Quem souber o seu e-mail
 *      manda 10 senhas erradas e tranca VOCÊ por 15 minutos, quantas
 *      vezes quiser. O contador ficava na conta da vítima.
 *
 * Contar também por origem fecha os dois. E vale para o resto: cadastro,
 * métricas, inscrição de notificação e os dois proxies são endpoints sem
 * autenticação nenhuma, e sem limite qualquer um esgota a cota do Redis
 * ou da chave do Pexels — que são compartilhados com a conta e a
 * sincronização.
 *
 * O IP NÃO é guardado. Ele é dado pessoal (Art. 5º, I da LGPD), e para
 * contar quantas vezes a mesma origem bateu na porta basta um resumo:
 * gravamos só o SHA-256 truncado, com prazo curto, e a chave morre
 * sozinha quando a janela fecha.
 */

const crypto = require('crypto');
const { redis } = require('./store');

/* Na Vercel estes cabeçalhos são escritos pela borda e sobrescrevem o que
   o cliente tenha mandado — por isso dá para confiar no primeiro valor.
   Fora dela, o pior caso é contar junto quem deveria contar separado. */
function origemDoPedido(req) {
  const h = (req && req.headers) || {};
  const primeiro = (v) => String(v || '').split(',')[0].trim();
  return primeiro(h['x-vercel-forwarded-for']) ||
         primeiro(h['x-real-ip']) ||
         primeiro(h['x-forwarded-for']) ||
         'sem-origem';
}

/* resumo curto: serve para comparar, não para reconstituir */
function marca(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex').slice(0, 24);
}

/**
 * Devolve true quando a origem já passou do teto na janela.
 *
 * Nunca lança: um limitador que derruba o serviço que devia proteger é
 * pior do que limitador nenhum. Se o Redis não responder, o pedido passa.
 */
async function excedeu(nome, req, maximo, janelaSegundos, extra) {
  try {
    const chave = 'bd:lim:' + nome + ':' + marca(origemDoPedido(req) + '|' + (extra || ''));
    const n = Number(await redis('INCR', [chave])) || 0;
    if (n === 1) await redis('EXPIRE', [chave, String(janelaSegundos)]);
    return n > maximo;
  } catch (_) {
    return false;
  }
}

module.exports = { excedeu, origemDoPedido, marca };
