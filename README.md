# Lâmpada · Devocional diário e Bíblia Sagrada

Site: https://devocionaldiario-eosin.vercel.app/

## Funcionalidades

- Devocional do dia, caixa de promessas, Bíblia completa
- Favoritos, diário, planos de leitura, progresso e streak
- Busca por referência ou palavra
- PWA instalável
- **Web Push** — lembrete diário (~8h Brasília)
- **Leitura em voz** — acessibilidade para quem não sabe ler

## Leitura em voz

Todo texto do app pode ser ouvido: devocional do dia (versículo, reflexão,
meditação e oração), promessas, resultados de busca, favoritos, notas do
diário, os dias dos planos e a Bíblia inteira, capítulo por capítulo.

Usa a Web Speech API do próprio aparelho — sem chave de API, sem custo e
funciona offline depois que o app está instalado.

- Barra de reprodução fixa: pausar, avançar/voltar trecho, parar e velocidade
- O trecho lido fica destacado e a tela acompanha sozinha
- Referências ditas por extenso: "1 João 3:16" vira "Primeira de João, capítulo 3, versículo 16"
- Em **Leitura em voz** dá para escolher a voz e a velocidade, e ligar:
  - **Modo áudio** — botões maiores, seção anunciada ao abrir e toque longo
    em qualquer botão diz para que ele serve
  - **Anunciar o número do versículo**
  - **Continuar no próximo capítulo** automaticamente

A qualidade da voz vem do aparelho. No Android, instalar a "Fala do Google"
melhora bastante; no iPhone, Ajustes → Acessibilidade → Conteúdo Falado →
Vozes → Português (Brasil).

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
