# Testes

46 suítes, ~1.720 asserções. Rodam num Chromium de verdade, contra o app
de verdade servido de um servidor estático local. Não há mock do app: o
que a suíte carrega em `http://localhost:8099/index.html` é o mesmo
`index.html` que a Vercel publica.

```
npm test                 tudo (uns 11 minutos)
npm test -- 38 45        só as suítes 38 e 45
npm test -- --lista      só mostra o que existe
PORTA_TESTE=8100 npm test    se a 8099 já estiver ocupada
node testes/teste38.js       uma suíte sozinha, com a saída inteira
```

Rodar uma suíte sozinha exige que o servidor esteja de pé. Ele é do
`rodar.js`; para trabalhar numa suíte só, deixe `npm test -- 38` rodando
em outro terminal, ou levante um `python3 -m http.server 8099` na raiz.

## Como está montado

| arquivo | o que faz |
|---|---|
| `rodar.js` | levanta o servidor, roda cada suíte num processo próprio, soma |
| `navegador.js` | acha o Chromium (variável, `/opt/pw-browsers`, cache do Playwright) |
| `base.js` | o endereço do servidor, num lugar só |
| `extrai.js` | lê pedaços do `app.js` para as suítes que conferem o código-fonte |
| `teste*.js` | as suítes |

Cada suíte é um script Node solto — sem framework, sem `describe`, sem
`it`. Ela abre uma página, mexe no app, mede, e imprime uma linha por
asserção:

```
  OK  | o botão de pausa troca o ícone, não o texto
FALHA | o contraste do play no tema escuro é 2.88:1, precisa de 3:1
```

O `rodar.js` conta essas linhas. Quem escrever uma suíte nova precisa
imprimir nesse formato, senão ela aparece com zero asserções.

## Processo por suíte, de propósito

São 46 processos e leva minutos. Poderia ser um só e ser mais rápido,
mas uma suíte que trave ou vaze memória levaria as outras junto, e a
saída de 46 suítes num processo é ilegível quando algo quebra. O
`rodar.js` imprime só as linhas de FALHA e diz qual comando repete a
suíte inteira.

## O que essas suítes já pegaram

Vale dizer, porque justifica o custo dos 11 minutos:

- o aquecimento offline ignorava `pedirLivroInteiro`, o pedido mais
  pesado do app — competia com a busca por palavra da pessoa
- a chave `lampada-aquecido-em` entrou no `localStorage` sem entrar na
  política de privacidade
- CSS órfão (`w-100-mb-12`, `nota-mini`) que ficou para trás numa
  redesenhada
- contraste de 2,88:1 no play do tema escuro
- 404 do comparador tratado como erro passageiro, quando é permanente:
  há versões que só têm o Novo Testamento

## Duas armadilhas que já custaram caro

**Ler estilo logo depois de trocar a classe** devolve o valor *inicial*
da transição, não o final. Duas suítes já mediram 28% de um progresso
que estava em 100%. Espere a transição terminar.

**Trocar `window.fetch` na página não engana o service worker** — ele
escuta em outro lugar, e o pedido nem passa pelo seu remendo. Para
testar offline, use `context.route()` com `serviceWorkers: 'allow'`.

## No CI

`.github/workflows/testes.yml` roda a suíte na `main` e em toda proposta
de mudança. Em push de branch solta não roda: gastaria os 11 minutos sem
dizer nada que a proposta não vá dizer.

## Capturas de tela

Algumas suítes salvam `.png` aqui para inspeção. Eles estão no
`.gitignore` — são saída, não fonte. O workflow os guarda como artefato
quando algo falha.
