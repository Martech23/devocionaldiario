/**
 * Armazenamento de subscriptions Web Push via Upstash Redis REST.
 * Variáveis de ambiente na Vercel:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

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

module.exports = { configured, listSubs, addSub, removeSub };
