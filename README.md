# Lâmpada · Devocional diário e Bíblia Sagrada

Site: https://devocionaldiario-eosin.vercel.app/

## Funcionalidades

- Devocional do dia, caixa de promessas, Bíblia completa
- Favoritos, diário, planos de leitura, progresso e streak
- Busca por referência ou palavra
- PWA instalável
- **Web Push** — lembrete diário (~8h Brasília)

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
