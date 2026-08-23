/** Expõe só a chave pública VAPID para o frontend se inscrever. */
module.exports = async function handler(req, res) {
  /* a chave pública é pública de propósito, mas quem a pede é a nossa
     página: não há razão para oferecê-la a outras origens */
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const key = process.env.VAPID_PUBLIC_KEY || '';
  if (!key) {
    return res.status(503).json({ error: 'Lembrete indisponível no momento' });
  }
  return res.status(200).json({ publicKey: key });
};
