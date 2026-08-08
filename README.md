# Bíblia Devocional

Site: https://devocionaldiario-eosin.vercel.app/

## Funcionalidades

- Devocional do dia, com histórico dos últimos 30 dias
- Caixa de promessas por tema e Bíblia completa
- **Destaques coloridos** e **notas** em qualquer versículo
- **Comparar versões** lado a lado
- **Minhas orações** — pedidos, respondidas e datas
- Favoritos, diário, progresso e streak
- 12 planos de leitura, incluindo Bíblia em 1 ano
- Busca por referência ou palavra
- PWA instalável
- **Web Push** — lembrete diário (~8h Brasília)
- **Leitura em voz** e **ditado por voz** — para quem não lê nem escreve

## Toque num versículo

Dentro de um capítulo, tocar num versículo abre a folha de ações: marcar com
uma das quatro cores, favoritar, escrever uma nota, comparar as versões,
copiar, gerar imagem ou ouvir.

Os destaques e as notas ficam no aparelho (`localStorage`) e reaparecem
sempre que o capítulo é reaberto. As notas antigas, que só existiam presas a
um favorito, são migradas na primeira abertura.

## Planos de leitura

Nove planos escritos à mão (Provérbios em 31 dias, ansiedade, luto,
casamento, a vida de Jesus…) e três gerados a partir da lista de livros:
**Bíblia em 1 ano**, **Novo Testamento em 90 dias** e **Salmos e Provérbios
em 60 dias**.

Um dia de plano pode ter vários capítulos — `[[1,1],[1,2],[1,3]]` vira
"Gênesis 1–3" — e o botão **Ouvir** lê o dia inteiro de uma vez.

## Leitura em voz

Todo texto do app pode ser ouvido: devocional do dia (versículo, reflexão,
meditação e oração), promessas, resultados de busca, favoritos, notas do
diário, os dias dos planos e a Bíblia inteira, capítulo por capítulo.

Usa a Web Speech API do próprio aparelho — sem chave de API, sem custo e
funciona offline depois que o app está instalado.

- Barra de reprodução fixa: pausar, avançar/voltar trecho, parar e velocidade
- O trecho lido fica destacado e a tela acompanha sozinha
- Referências ditas por extenso: "1 João 3:16" vira "Primeira de João, capítulo 3, versículo 16"
- No menu lateral, em **Leitura em voz**, dá para escolher a voz e a velocidade, e ligar:
  - **Modo áudio** — botões maiores, seção anunciada ao abrir e toque longo
    em qualquer botão diz para que ele serve
  - **Anunciar o número do versículo**
  - **Continuar no próximo capítulo** automaticamente

A qualidade da voz vem do aparelho. No Android, instalar a "Fala do Google"
melhora bastante; no iPhone, Ajustes → Acessibilidade → Conteúdo Falado →
Vozes → Português (Brasil).

## Ditado por voz

Quem não lê também não escreve. O microfone aparece na busca, na nota do
versículo, no campo de oração e em cada nota do diário, usando
`SpeechRecognition` — sem servidor.

No diário, o ditado é anexado ao que já estava escrito e salvo na hora, sem
precisar sair do campo.

Na busca, números falados viram referência: "João três dezesseis" e
"Gênesis capítulo um versículo três" chegam como `João 3:16` e `Gênesis 1:3`.

Onde o navegador não implementa a API, os microfones somem em vez de
oferecer um botão que só sabe avisar que não funciona — os mesmos campos
continuam editáveis por escrito.

## Web Push — configuração na Vercel

1. Crie um Redis grátis em [Upstash](https://console.upstash.com) → **REST API**
2. No projeto Vercel → **Settings → Environment Variables**, adicione:

| Variável | Valor |
|----------|--------|
| `VAPID_PUBLIC_KEY` | (veja `.env.example`) |
| `VAPID_PRIVATE_KEY` | (veja `.env.example`) |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |
| `UPSTASH_REDIS_REST_URL` | URL do Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Upstash |
| `CRON_SECRET` | senha opcional para teste manual |

3. Faça um **Redeploy** na Vercel
4. No site → **Instalar app** → **Ativar lembrete diário**

O cron em `vercel.json` chama `/api/daily-push` todo dia às **11:00 UTC** (8h em Brasília).

### Testar o push manualmente

```bash
curl -X GET "https://devocionaldiario-eosin.vercel.app/api/daily-push" \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

## APIs bíblicas

- getBible — Almeida, Bíblia Livre
- Free Use Bible API (helloao)
