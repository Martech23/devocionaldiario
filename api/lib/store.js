/**
 * Armazenamento de subscriptions Web Push via Upstash Redis REST.
 * Variáveis de ambiente na Vercel:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

const crypto = require('crypto');

const KEY = 'lampada:push:subs';

function configured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis(command, args = []) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis não configurado');

  const res = await fetch(`${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([command, ...args])
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error('Redis HTTP ' + res.status + ': ' + t);
  }
  const data = await res.json();
  return data.result;
}

async function listSubs() {
  const raw = (await redis('SMEMBERS', [KEY])) || [];
  return raw.map((s) => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);
}

async function addSub(sub) {
  const endpoint = sub && sub.endpoint;
  if (!endpoint) throw new Error('Subscription sem endpoint');
  // remove antiga do mesmo endpoint
  const all = await listSubs();
  for (const s of all) {
    if (s.endpoint === endpoint) {
      await redis('SREM', [KEY, JSON.stringify(s)]);
    }
  }
  await redis('SADD', [KEY, JSON.stringify(sub)]);
  return true;
}

async function removeSub(endpoint) {
  if (!endpoint) return false;
  const all = await listSubs();
  let removed = false;
  for (const s of all) {
    if (s.endpoint === endpoint) {
      await redis('SREM', [KEY, JSON.stringify(s)]);
      removed = true;
    }
  }
  return removed;
}

/**
 * Trava de "já mandei hoje".
 *
 * O cron passou a rodar de hora em hora. Se uma execução falhar no meio
 * e a Vercel repetir, ou se alguém trocar de fuso durante o dia, a mesma
 * pessoa poderia receber o lembrete duas vezes — o pior defeito possível
 * num aviso diário, porque quem recebe dois desliga a notificação.
 *
 * A chave carrega a data local de quem recebe, então ela vale para o dia
 * dele e não para o do servidor. `NX` faz a marcação e a checagem no
 * mesmo passo: se voltar nulo, alguém já marcou e não se envia. Duas
 * execuções simultâneas não conseguem as duas vencer.
 *
 * `EX` de dois dias limpa sozinho — não existe faxina para esquecer.
 */
async function marcarEnvio(endpoint, dataLocal) {
  const id = crypto.createHash('sha1').update(String(endpoint)).digest('hex').slice(0, 16);
  const chave = `lampada:push:enviado:${id}:${dataLocal}`;
  const r = await redis('SET', [chave, '1', 'NX', 'EX', String(60 * 60 * 48)]);
  return r === 'OK';
}

module.exports = { configured, redis, listSubs, addSub, removeSub, marcarEnvio };
