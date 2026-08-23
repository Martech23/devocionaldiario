/**
 * MÉTRICAS PRÓPRIAS, AGREGADAS
 *
 * Por que não o Vercel Analytics: num app de aba única, "pageviews" não
 * responde nada. As perguntas que decidem um produto devocional são
 * outras — quantos leram o devocional de hoje, quantos terminaram o
 * percurso, quantos ligaram o lembrete, quantos voltaram amanhã. E o
 * plano gratuito da Vercel não tem evento personalizado, além de somar
 * um script de terceiro num app que tirou até a fonte do Google.
 *
 * O que fica guardado:
 *   lampada:m:<data>:<evento>   contador inteiro — quantas vezes
 *   lampada:m:<data>:dau        HyperLogLog — quantos aparelhos distintos
 *
 * O HyperLogLog é o ponto: ele responde "quantos" sem guardar "quais".
 * É um esboço probabilístico de tamanho fixo; o identificador entra e
 * não fica — não existe lista de onde tirá-lo de volta. Dá o número de
 * retorno diário sem manter cadastro de ninguém.
 *
 * Tudo expira em 90 dias sozinho.
 */

const { configured, redis } = require('../lib/store');
const { excedeu } = require('../lib/limite');

/* Lista fechada, e do lado do servidor. Aceitar nome livre deixaria
   qualquer um encher o Redis de chaves inventadas. */
const EVENTOS = new Set([
  'abriu',
  'devocional_visto',
  'devocional_completo',
  'push_ativado',
  'compartilhou',
  'imagem_gerada',
  'plano_dia_lido',
  'mapa_aberto',
  'busca_feita'
]);

const DIAS_GUARDADOS = 90;
const TTL = 60 * 60 * 24 * DIAS_GUARDADOS;
const MAX_EVENTOS = 20;

const hoje = () => new Date().toISOString().slice(0, 10);

/** Comparação em tempo constante, como no daily-push. */
function iguais(a, b) {
  const crypto = require('crypto');
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

async function registrar(eventos, id) {
  const dia = hoje();
  let contados = 0;

  /* o aparelho distinto entra no esboço, não numa lista */
  if (id && /^[a-z0-9]{8,32}$/.test(id)) {
    const chave = `lampada:m:${dia}:dau`;
    await redis('PFADD', [chave, id]);
    await redis('EXPIRE', [chave, String(TTL)]);
  }

  for (const ev of eventos.slice(0, MAX_EVENTOS)) {
    if (!EVENTOS.has(ev)) continue;
    const chave = `lampada:m:${dia}:${ev}`;
    await redis('INCR', [chave]);
    await redis('EXPIRE', [chave, String(TTL)]);
    contados++;
  }
  return contados;
}

async function resumo(dias) {
  const nomes = [...EVENTOS];
  const saida = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const linha = { dia: d };
    linha.aparelhos = Number(await redis('PFCOUNT', [`lampada:m:${d}:dau`])) || 0;
    for (const ev of nomes) {
      linha[ev] = Number(await redis('GET', [`lampada:m:${d}:${ev}`])) || 0;
    }
    saida.push(linha);
  }
  return saida;
}

module.exports = async function handler(req, res) {
  /* Sem CORS aberto. E com teto: cada POST podia disparar até 42 comandos
     no Redis, e o Redis é o MESMO das contas e da sincronização. Sem
     limite, umas poucas centenas de chamadas esgotavam a cota do dia e
     derrubavam junto o login de quem tem conta. */
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!configured()) {
    /* sem Redis a métrica simplesmente não existe — e isso nunca pode
       virar erro na tela de quem só queria ler o devocional */
    return res.status(200).json({ ok: true, ignorado: 'sem Redis' });
  }

  try {
    if (req.method === 'POST') {
      if (await excedeu('metricas', req, 120, 60 * 60)) {
        /* devolve ok: métrica recusada nunca pode virar erro na tela de
           quem só queria ler o devocional */
        return res.status(200).json({ ok: true, ignorado: 'limite' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const eventos = Array.isArray(body.eventos) ? body.eventos.map(String) : [];
      const contados = await registrar(eventos, body.id);
      return res.status(200).json({ ok: true, contados });
    }

    if (req.method === 'GET') {
      /* leitura é fechada: o número de usuários é informação do negócio */
      const q = req.query && req.query.chave
        ? req.query.chave
        : new URL(req.url, 'http://x').searchParams.get('chave');
      const segredo = process.env.PUSH_SECRET;
      if (!segredo || !iguais(q, segredo)) {
        /* uma resposta só para "não configurado" e "não confere": a
           diferença dizia a quem perguntasse se o segredo existe */
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const dias = Math.min(Math.max(parseInt(
        (req.query && req.query.dias) ||
        new URL(req.url, 'http://x').searchParams.get('dias') || '14', 10) || 14, 1), 90);
      return res.status(200).json({ ok: true, dias, linhas: await resumo(dias) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('metricas:', e);
    return res.status(500).json({ error: 'Erro' });
  }
};

module.exports.EVENTOS = EVENTOS;
