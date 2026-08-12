export default async function handler(req, res) {
  // Habilita CORS para o seu próprio site (necessário para o navegador aceitar a resposta)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { versao, livro, capitulo } = req.query;

  if (!versao || !livro || !capitulo) {
    return res.status(400).json({ erro: 'Informe versao, livro e capitulo.' });
  }

  try {
    // Adapte a URL conforme a API que você usa (getBible, Free Use Bible API, etc.)
    // Exemplo com getBible v2:
    const url = `https://api.getbible.net/v2/${versao}/${livro}/${capitulo}.json`;
    
    const resposta = await fetch(url);
    
    if (!resposta.ok) {
      return res.status(404).json({ erro: 'Texto não encontrado.' });
    }

    const dados = await resposta.json();
    return res.status(200).json(dados);

  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao buscar a Bíblia: ' + erro.message });
  }
}
