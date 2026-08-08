/** Expõe só a chave pública VAPID para o frontend se inscrever. */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const key = process.env.VAPID_PUBLIC_KEY || '';
  if (!key) {
    return res.status(503).json({ error: 'VAPID_PUBLIC_KEY não definida' });
  }
  return res.status(200).json({ publicKey: key });
};
