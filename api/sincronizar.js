/**
 * Sincronização do histórico devocional.
 *
 *   GET  → devolve o que está no servidor
 *   PUT  → grava o que o aparelho enviou
 *
 * A mesclagem acontece no navegador, não aqui: só o cliente conhece o
 * estado local, e resolver o conflito perto de onde os dois estão evita
 * uma ida e volta a mais. O servidor guarda e devolve.
 */

const C = require('./lib/contas');

/* Só estas chaves trafegam. Uma lista fechada impede que um cliente
   adulterado use a conta como depósito de qualquer coisa. */
const CAMPOS = [
  'favoritos', 'notas', 'destaques', 'oracoes',
  'capitulosLidos', 'atividade', 'planos'
];

const LIMITE_BYTES = 1024 * 1024;   // 1 MB por conta

function apenasCamposConhecidos(entrada) {
  const saida = {};
  if (!entrada || typeof entrada !== 'object') return saida;
  CAMPOS.forEach(c => {
    if (Object.prototype.hasOwnProperty.call(entrada, c)) saida[c] = entrada[c];
  });
  return saida;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!C.configurado()) {
    return res.status(503).json({ erro: 'Sincronização ainda não configurada no servidor' });
  }

  try {
    const usuario = await C.usuarioDaRequisicao(req);
    if (!usuario) return res.status(401).json({ erro: 'Entre na conta primeiro' });

    if (req.method === 'GET') {
      const dados = await C.lerDados(usuario.id);
      return res.status(200).json({ dados: dados || null });
    }

    if (req.method === 'PUT') {
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      } catch { return res.status(400).json({ erro: 'Corpo inválido' }); }

      const dados = apenasCamposConhecidos(body.dados);
      const bruto = JSON.stringify(dados);
      if (bruto.length > LIMITE_BYTES) {
        return res.status(413).json({ erro: 'Seus dados passaram do limite de 1 MB' });
      }

      const registro = { ...dados, atualizadoEm: new Date().toISOString() };
      await C.gravarDados(usuario.id, registro);
      return res.status(200).json({ ok: true, atualizadoEm: registro.atualizadoEm });
    }

    return res.status(405).json({ erro: 'Método não permitido' });
  } catch (e) {
    console.error('sincronizar:', e);
    return res.status(500).json({ erro: 'Erro no servidor' });
  }
};
