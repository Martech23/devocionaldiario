/**
 * Contas de usuário sobre o mesmo Upstash Redis já usado pelo Web Push.
 *
 * Chaves:
 *   bd:usuario:<email>     hash com id, senha (scrypt), salt, datas e consentimento
 *   bd:email:<id>          e-mail do usuário, para achar a conta a partir da sessão
 *   bd:sessao:<hashToken>  id do usuário, com TTL
 *   bd:dados:<id>          o histórico devocional, em JSON
 *   bd:tentativas:<email>  contador de senha errada, com TTL
 *
 * O token de sessão nunca é gravado: guardamos só o SHA-256 dele. Assim um
 * vazamento do banco não entrega sessões ativas.
 */

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const DIAS_SESSAO = 30;
const TTL_SESSAO = DIAS_SESSAO * 24 * 60 * 60;
const MAX_TENTATIVAS = 10;
const JANELA_TENTATIVAS = 15 * 60;

function configurado() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis(...comando) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis não configurado');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando.map(String))
  });
  if (!res.ok) throw new Error('Redis HTTP ' + res.status + ': ' + (await res.text()));
  return (await res.json()).result;
}

/* ---------- e-mail e senha ---------- */

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

/* scrypt com sal por usuário. Custo padrão do Node (N=16384). */
async function derivar(senha, salSemHex) {
  const buf = await scrypt(String(senha), Buffer.from(salSemHex, 'hex'), 64);
  return buf.toString('hex');
}

async function criarHashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return { sal, hash: await derivar(senha, sal) };
}

async function senhaConfere(senha, sal, hashEsperado) {
  const calculado = await derivar(senha, sal);
  const a = Buffer.from(calculado, 'hex');
  const b = Buffer.from(String(hashEsperado || ''), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* =========================================================
   O RELÓGIO CONTAVA QUEM TEM CONTA

   A resposta do login é a mesma para e-mail inexistente e senha
   errada — de propósito, para não entregar quem tem conta num app
   religioso. Só que o TEMPO não era o mesmo: sem usuário, o scrypt
   nem chegava a rodar e a resposta voltava em milissegundos; com
   usuário, ela demorava o custo do scrypt. Media-se o relógio e
   sabia-se a diferença que a mensagem escondia.

   Aqui o trabalho acontece de todo jeito, sobre um sal descartável.
   O resultado é jogado fora; o que interessa é o tempo gasto. */
const SAL_FANTASMA = crypto.randomBytes(16).toString('hex');
async function gastarOMesmoTempo() {
  try { await derivar('senha-que-nao-existe', SAL_FANTASMA); } catch (_) {}
  return false;
}

/* ---------- usuários ---------- */

async function acharUsuario(email) {
  const bruto = await redis('GET', 'bd:usuario:' + normalizarEmail(email));
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch { return null; }
}

async function acharEmailPorId(id) {
  return await redis('GET', 'bd:email:' + id);
}

async function criarUsuario(email, senha) {
  const limpo = normalizarEmail(email);
  const { sal, hash } = await criarHashSenha(senha);
  const usuario = {
    id: crypto.randomUUID(),
    email: limpo,
    sal,
    senha: hash,
    criadoEm: new Date().toISOString(),
    /* consentimento explícito: histórico devocional revela convicção
       religiosa, que a LGPD trata como dado sensível */
    consentiuEm: new Date().toISOString()
  };
  /* SET NX evita que duas requisições simultâneas criem a mesma conta */
  const ok = await redis('SET', 'bd:usuario:' + limpo, JSON.stringify(usuario), 'NX');
  if (!ok) return null;
  await redis('SET', 'bd:email:' + usuario.id, limpo);
  return usuario;
}

async function excluirUsuario(usuario) {
  await redis('DEL', 'bd:usuario:' + usuario.email);
  await redis('DEL', 'bd:email:' + usuario.id);
  await redis('DEL', 'bd:dados:' + usuario.id);
  await redis('DEL', 'bd:tentativas:' + usuario.email);
}

/* ---------- tentativas de login ---------- */

async function tentativasExcedidas(email) {
  const n = Number(await redis('GET', 'bd:tentativas:' + normalizarEmail(email))) || 0;
  return n >= MAX_TENTATIVAS;
}

async function registrarFalha(email) {
  const chave = 'bd:tentativas:' + normalizarEmail(email);
  const n = await redis('INCR', chave);
  if (Number(n) === 1) await redis('EXPIRE', chave, JANELA_TENTATIVAS);
}

async function limparFalhas(email) {
  await redis('DEL', 'bd:tentativas:' + normalizarEmail(email));
}

/* ---------- sessões ---------- */

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

async function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await redis('SET', 'bd:sessao:' + hashToken(token), usuarioId, 'EX', TTL_SESSAO);
  return token;
}

async function usuarioDaSessao(token) {
  if (!token) return null;
  const chave = 'bd:sessao:' + hashToken(token);
  const id = await redis('GET', chave);
  if (!id) return null;
  await redis('EXPIRE', chave, TTL_SESSAO);   // sessão ativa se renova
  const email = await acharEmailPorId(id);
  if (!email) return null;
  return await acharUsuario(email);
}

async function encerrarSessao(token) {
  if (!token) return;
  await redis('DEL', 'bd:sessao:' + hashToken(token));
}

/* ---------- dados devocionais ---------- */

async function lerDados(usuarioId) {
  const bruto = await redis('GET', 'bd:dados:' + usuarioId);
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch { return null; }
}

async function gravarDados(usuarioId, dados) {
  await redis('SET', 'bd:dados:' + usuarioId, JSON.stringify(dados));
}

/* ---------- cookie de sessão ---------- */

const NOME_COOKIE = 'bd_sessao';

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const [k, ...resto] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

function definirCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${NOME_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_SESSAO}`);
}

function limparCookie(res) {
  res.setHeader('Set-Cookie',
    `${NOME_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

async function usuarioDaRequisicao(req) {
  return await usuarioDaSessao(lerCookie(req, NOME_COOKIE));
}

/* O que volta para o navegador nunca inclui hash nem sal */
function publico(usuario) {
  return usuario && { id: usuario.id, email: usuario.email, criadoEm: usuario.criadoEm };
}

module.exports = {
  configurado, normalizarEmail, emailValido,
  acharUsuario, criarUsuario, excluirUsuario, senhaConfere,
  tentativasExcedidas, registrarFalha, limparFalhas,
  gastarOMesmoTempo,
  criarSessao, encerrarSessao, usuarioDaRequisicao,
  lerDados, gravarDados,
  lerCookie, definirCookie, limparCookie, publico,
  NOME_COOKIE, MAX_TENTATIVAS
};
