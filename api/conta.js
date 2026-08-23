/**
 * Contas: registrar, entrar, sair, quem sou e excluir.
 *
 * Um endpoint só, com a ação no corpo, porque a Vercel conta cada arquivo
 * em /api como uma função serverless e o plano tem limite.
 */

const C = require('../lib/contas');
const { excedeu } = require('../lib/limite');

const MIN_SENHA = 8;

/* Tetos por origem, além do contador por e-mail que já existia. Ver o
   comentário de lib/limite.js: o contador por e-mail não pega
   pulverização de senha, e é ele mesmo a arma de quem quer trancar a
   conta de outra pessoa. */
/* Os números são folgados de propósito. No Brasil boa parte do acesso
   móvel sai por CGNAT: um prédio, uma escola ou uma operadora inteira
   podem aparecer aqui com o mesmo endereço. Um teto apertado trancaria
   gente inocente que só dividiu a rede com outra pessoa. O que precisa
   ser barrado — varredura de e-mails e pulverização de senha — usa
   milhares de tentativas, não dezenas; e o teto por conta, mais estreito,
   continua valendo por cima deste. */
const TETO_ENTRAR    = { max: 30, janela: 10 * 60 };
const TETO_REGISTRAR = { max: 15, janela: 60 * 60 };

function corpo(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  if (!C.configurado()) {
    /* sem dica sobre qual banco ou qual variável: quem chama de fora não
       precisa saber o que roda aqui dentro, e a dica ia direto para quem
       estivesse procurando por onde entrar */
    return res.status(503).json({ erro: 'Contas indisponíveis no momento' });
  }

  const body = corpo(req);
  const acao = String(body.acao || '');

  try {
    /* ---------- criar conta ---------- */
    if (acao === 'registrar') {
      /* O 409 "já existe uma conta com esse e-mail" é necessário — sem ele
         ninguém entende por que o cadastro falhou —, mas é também um
         oráculo: dá para perguntar de e-mail em e-mail quem tem conta num
         app religioso, o que por si só revela convicção (Art. 11). O teto
         por origem não fecha o oráculo, fecha a varredura. */
      if (await excedeu('registrar', req, TETO_REGISTRAR.max, TETO_REGISTRAR.janela)) {
        return res.status(429).json({ erro: 'Muitos cadastros a partir daqui. Tente mais tarde.' });
      }
      const email = C.normalizarEmail(body.email);
      const senha = String(body.senha || '');

      if (!C.emailValido(email)) return res.status(400).json({ erro: 'E-mail inválido' });
      if (senha.length < MIN_SENHA) {
        return res.status(400).json({ erro: 'A senha precisa de pelo menos ' + MIN_SENHA + ' caracteres' });
      }
      /* O histórico devocional revela convicção religiosa, que a LGPD trata
         como dado sensível: sem consentimento explícito, não criamos a conta. */
      if (body.consentimento !== true) {
        return res.status(400).json({ erro: 'É preciso aceitar a guarda dos seus dados devocionais' });
      }

      const usuario = await C.criarUsuario(email, senha);
      if (!usuario) return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail' });

      const token = await C.criarSessao(usuario.id);
      C.definirCookie(res, token);
      return res.status(201).json({ usuario: C.publico(usuario) });
    }

    /* ---------- entrar ---------- */
    if (acao === 'entrar') {
      if (await excedeu('entrar', req, TETO_ENTRAR.max, TETO_ENTRAR.janela)) {
        return res.status(429).json({ erro: 'Muitas tentativas a partir daqui. Espere e tente de novo.' });
      }
      const email = C.normalizarEmail(body.email);
      const senha = String(body.senha || '');

      if (await C.tentativasExcedidas(email)) {
        return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
      }

      const usuario = await C.acharUsuario(email);
      /* sem usuário, gasta-se o mesmo tempo mesmo assim: a mensagem já era
         igual nos dois casos, faltava o relógio ser */
      const ok = usuario
        ? await C.senhaConfere(senha, usuario.sal, usuario.senha)
        : await C.gastarOMesmoTempo();

      if (!ok) {
        await C.registrarFalha(email);
        /* mensagem igual para e-mail inexistente e senha errada: dizer qual
           dos dois falhou entregaria quem tem conta no site */
        return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
      }

      await C.limparFalhas(email);
      const token = await C.criarSessao(usuario.id);
      C.definirCookie(res, token);
      return res.status(200).json({ usuario: C.publico(usuario) });
    }

    /* ---------- sair ---------- */
    if (acao === 'sair') {
      await C.encerrarSessao(C.lerCookie(req, C.NOME_COOKIE));
      C.limparCookie(res);
      return res.status(200).json({ ok: true });
    }

    /* ---------- quem sou ---------- */
    if (acao === 'eu') {
      const usuario = await C.usuarioDaRequisicao(req);
      return res.status(200).json({ usuario: usuario ? C.publico(usuario) : null });
    }

    /* ---------- excluir conta e dados (direito de eliminação, LGPD) ---------- */
    if (acao === 'excluir') {
      const usuario = await C.usuarioDaRequisicao(req);
      if (!usuario) return res.status(401).json({ erro: 'Entre na conta primeiro' });

      /* pede a senha de novo: o cookie sozinho não deve bastar para apagar tudo */
      const ok = await C.senhaConfere(String(body.senha || ''), usuario.sal, usuario.senha);
      if (!ok) return res.status(401).json({ erro: 'Senha incorreta' });

      await C.encerrarSessao(C.lerCookie(req, C.NOME_COOKIE));
      await C.excluirUsuario(usuario);
      C.limparCookie(res);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: 'Ação desconhecida' });
  } catch (e) {
    console.error('conta:', e);
    return res.status(500).json({ erro: 'Erro no servidor' });
  }
};
