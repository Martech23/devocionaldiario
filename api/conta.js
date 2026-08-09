/**
 * Contas: registrar, entrar, sair, quem sou e excluir.
 *
 * Um endpoint só, com a ação no corpo, porque a Vercel conta cada arquivo
 * em /api como uma função serverless e o plano tem limite.
 */

const C = require('./lib/contas');

const MIN_SENHA = 8;

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
    return res.status(503).json({
      erro: 'Contas ainda não configuradas no servidor',
      dica: 'Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel'
    });
  }

  const body = corpo(req);
  const acao = String(body.acao || '');

  try {
    /* ---------- criar conta ---------- */
    if (acao === 'registrar') {
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
      const email = C.normalizarEmail(body.email);
      const senha = String(body.senha || '');

      if (await C.tentativasExcedidas(email)) {
        return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
      }

      const usuario = await C.acharUsuario(email);
      const ok = usuario && await C.senhaConfere(senha, usuario.sal, usuario.senha);

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
