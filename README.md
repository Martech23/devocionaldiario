# Bíblia Devocional

Site: https://devocionaldiario-eosin.vercel.app/

## Funcionalidades

- **Percurso guiado** do devocional — um passo por vez, com estimativa de tempo
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

## Percurso guiado

O devocional era um cartão para rolar. Virou um caminho com começo, meio e
fim: **Versículo do dia → Reflexão → Para meditar → Oração**, um passo por
vez, com a trilha de progresso e o tempo estimado no topo.

Ler uma página e ser conduzido por ela são experiências diferentes, e a
segunda serve melhor justamente quem tem dificuldade com a primeira — o
mesmo público que motivou a leitura em voz.

**Ouvir e seguir** lê do passo atual até o fim e a tela vira de passo
sozinha, acompanhando a voz. No último passo, o botão é **Concluir ✓**, e a
tela final registra o dia, mostra a sequência ("7 dias seguidos com a
Palavra") e oferece registrar um pedido de oração ou percorrer de novo.

A estimativa é honesta: conta as palavras e usa duas velocidades — 200
palavras por minuto para quem lê pelos olhos e 155 × a velocidade
configurada para quem ouve. Quando as duas divergem, aparece a faixa
("3–5 min") em vez de um número inventado.

Quem prefere o formato antigo tem **Ver tudo de uma vez** no rodapé do
cartão; a escolha fica guardada em `lampada-devo-modo` e vale nas próximas
aberturas.

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

## Conta e sincronização

O app funciona inteiro **sem conta** — favoritos, notas, orações e progresso
ficam no aparelho. A conta só acrescenta uma cópia no servidor, para o
histórico sobreviver à troca de celular.

Usa o mesmo Upstash Redis do Web Push, sem serviço novo:

| Chave | Guarda |
|---|---|
| `bd:usuario:<email>` | id, senha (scrypt), sal, datas e consentimento |
| `bd:email:<id>` | e-mail, para achar a conta a partir da sessão |
| `bd:sessao:<hashToken>` | id do usuário, com validade de 30 dias |
| `bd:dados:<id>` | o histórico devocional, em JSON |
| `bd:tentativas:<email>` | senha errada, para travar após 10 em 15 min |

**O token de sessão nunca é gravado** — guardamos só o SHA-256 dele, num
cookie `HttpOnly; Secure; SameSite=Lax`. Um vazamento do banco não entrega
sessões ativas. A senha vai por `scrypt` com sal próprio por conta, e a
comparação é em tempo constante.

Entrar com e-mail inexistente e errar a senha devolvem a **mesma mensagem**:
distinguir os dois entregaria quem tem conta no site.

### Mesclagem

Sempre por união, nos dois sentidos. Entrar numa conta não apaga o que já
existia no aparelho, e sincronizar não apaga o que já estava no servidor —
sem um histórico de exclusões, não há como distinguir "apagado lá" de "ainda
não chegou aqui". Em conflito, nota fica a mais recente e destaque fica o do
aparelho em uso.

### Dado sensível

Histórico devocional revela convicção religiosa, que a LGPD (Art. 5º, II)
trata como **dado pessoal sensível**. Por isso o cadastro exige consentimento
explícito e destacado, e o painel tem exclusão da conta com todos os dados,
pedindo a senha de novo — o cookie sozinho não basta para apagar tudo.

A política de privacidade está em `privacidade.html`, ligada no rodapé, no
menu lateral e no próprio formulário de cadastro.

### Ainda não existe

Recuperação de senha, que precisa de um provedor de e-mail. Hoje, quem
esquecer a senha perde o acesso à cópia no servidor — os dados no aparelho
continuam intactos.

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

## Imagem do versículo

Dez fundos — amanhecer, noite estrelada, montanhas, águas, trigal, deserto,
raios de luz, ramo de oliveira, vereda e pergaminho — em três formatos: feed
(1080×1350), story (1080×1920) e quadrado.

**Os fundos são desenhados no canvas, não são fotos.** Banco de fotos
exigiria licença e chave de API, e mataria o funcionamento offline. Desenhado,
o app segue estático, sem dependência externa e sem risco de direito autoral.

O fundo é escolhido a partir da referência, então o mesmo versículo gera
sempre a mesma imagem — e o botão **Trocar fundo** percorre os dez, com o
nome da cena logo ao lado. O tamanho da fonte se ajusta sozinho ao
comprimento do texto, e um véu suave atrás do bloco garante leitura em
qualquer cena.

Onde o aparelho permite, **Compartilhar** envia o PNG direto para o WhatsApp
ou o Instagram; onde não, cai para o download.

## Versões da Bíblia

Duas regras decidem o que aparece no seletor: **licença de uso livre** e
**ortografia atual**.

Fica de fora o Almeida de 1911 que o getBible serve — texto de domínio
público, mas em português pré-reforma ("Portuguez", "elle", "Christo"), que
atrapalha justamente quem tem mais dificuldade de leitura.

O filtro vale também para o catálogo remoto, não só para a lista semente:
o app descobre versões novas em tempo de execução, e sem isso as edições
antigas voltariam sozinhas. A regra está em `VERSAO_ARCAICA`, aplicada em
`acrescentar()` — o único ponto por onde uma versão entra na lista.

Se a versão escolhida falhar, o app cai automaticamente para a Bíblia Livre.
Não há fonte reserva em português arcaico: quando todas as fontes falham, o
app mostra um erro com "Tentar de novo", em vez de servir um texto de 1911
sem avisar.

## APIs bíblicas

- getBible — Bíblia Livre
- Free Use Bible API (helloao)
