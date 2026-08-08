# Lâmpada · Devocional diário e Bíblia Sagrada

Site de devocional diário com:

- Versículo / devocional do dia (reflexão + meditação + oração)
- Caixa de promessas por tema
- Bíblia completa (versões de uso livre)
- Favoritos e diário (localStorage)
- Gerador de imagem para compartilhar
- Modo claro / escuro
- **Planos de leitura** (7, 21 e 40 dias)
- **Progresso de leitura** da Bíblia
- **PWA** instalável + lembrete diário

## Deploy

https://devocionaldiario-eosin.vercel.app/

## Arquivos

| Arquivo | Função |
|---------|--------|
| `index.html` | App completo |
| `manifest.webmanifest` | Metadados PWA |
| `sw.js` | Service Worker (cache offline básico) |
| `icon-192.png` / `icon-512.png` | Ícones do app |

## APIs

- getBible — Almeida, Bíblia Livre
- Free Use Bible API (helloao)

Somente versões de uso livre / domínio público.
