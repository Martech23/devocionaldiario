# Bíblia Devocional

Site: https://devocionaldiario-eosin.vercel.app/

## Funcionalidades

- **Quatro abas** — Hoje, Bíblia, Planos e Meu
- **Percurso guiado** do devocional — um passo por vez, com estimativa de tempo
- Devocional do dia **por tema**, com histórico dos últimos 30 dias
- Caixa de promessas por tema e Bíblia completa
- **Destaques coloridos** e **notas** em qualquer versículo
- **Comparar versões** lado a lado
- **Minhas orações** — pedidos, respondidas e datas
- Favoritos, diário, progresso e streak
- 12 planos de leitura, incluindo Bíblia em 1 ano
- Busca por referência ou palavra
- **Veja também** — referências cruzadas entre passagens
- **Mapa da Terra Santa** — 41 lugares, cada um abrindo as passagens dali
- Prévia com imagem ao compartilhar o link
- PWA instalável
- **Web Push** — lembrete diário (~8h Brasília)
- **Leitura em voz** e **ditado por voz** — para quem não lê nem escreve

## Busca por palavra

A busca pedia **um capítulo por vez**: 929 idas e voltas para varrer o
Antigo Testamento, 1.189 para a Bíblia inteira, quatro em paralelo. O
gargalo nunca foi o texto — foi a viagem.

| | Antes | Agora |
|---|---:|---:|
| Pedidos para varrer o AT | 929 | **39** |
| Pedidos para varrer o NT | 260 | **27** |
| Em paralelo | 4 | 6 livros / 8 capítulos |
| Resultados aparecem | no fim | **conforme saem** |

O getBible serve o livro inteiro numa resposta só. Como não dá para
confiar que todas as fontes tenham esse endereço, **a primeira chamada
vale como prova**: se falhar, o atalho é desligado para o resto da sessão
e tudo volta a funcionar capítulo a capítulo. As outras chamadas esperam
por essa prova em vez de saírem juntas — senão uma fonte sem o endereço
custaria um pedido perdido por livro em voo, não um só.

O livro baixado alimenta o mesmo cache que a leitura consulta, então abrir
um capítulo depois de uma busca não custa pedido nenhum.

### Nome de livro não é palavra

Digitar `genesis` varria os 929 capítulos do Antigo Testamento atrás de
versículos que contivessem a palavra "gênesis". A referência só era
reconhecida com número junto (`Gênesis 1`). Agora o nome sozinho abre o
livro, com ou sem acento.

## Veja também — referências cruzadas

Tocar num versículo e ver as passagens que conversam com ele. Cada uma
abre no leitor; dá para ouvir todas de uma vez.

**Nada aqui é copiado de obra alheia.** São ligações entre passagens — que
são fato, não texto —, escritas à mão. Os comentários clássicos (Matthew
Henry, Gill, Clarke) são domínio público *em inglês*, mas a tradução para
o português é obra nova com direito próprio: a mesma armadilha que barrou a
ACF e a NVI. Referência cruzada escapa disso porque não tem prosa.

| | |
|---|---:|
| Grupos temáticos | 34 |
| Citações do NT ao AT | 23 |
| Versículos cobertos | 260 |
| Ligações geradas | 1.470 |
| Devocionais do dia cobertos | **180/180** |

As ligações ficam como **grupos**, não como listas por versículo, porque a
relação é simétrica — se A remete a B, B remete a A. Derivar os dois
sentidos em código elimina a chance de ligar num sentido e esquecer o
outro; há teste que percorre o índice inteiro conferindo isso.

As **citações** aparecem antes das ligações por tema: Mateus 4:4 cita
Deuteronômio 8:3, e isso é mais forte do que parentesco de assunto.

A referência aparece **mesmo quando o texto não vem**: a ligação é nossa e
não depende de rede; só o texto é buscado.

### Para crescer

O *Treasury of Scripture Knowledge* (1830, domínio público) tem ~500 mil
ligações, e o OpenBible.info publica um conjunto moderno. Qualquer um dos
dois entra no lugar de `GRUPOS_REF` sem mexer no resto.

O caminho já está aberto: o mapa passou a usar dados do OpenBible.info e a
licença deles, **CC BY 4.0**, foi conferida no arquivo `license.txt` do
próprio repositório. O conjunto de referências cruzadas é outro arquivo e
merece a mesma conferência antes de entrar — mas agora se sabe onde olhar,
e o gerador do mapa serve de molde para o que faltar.

## O devocional extra do Supabase

O app passou a buscar no Supabase um devocional extra publicado por nós.
O bloco original inseria o conteúdo da tabela com `innerHTML`:

```js
div.innerHTML = `<strong ...>${item.titulo}</strong><p ...>${item.texto}</p>`;
```

**Isso é execução de código, não exibição de texto.** Um
`<img src=x onerror="...">` gravado na tabela viraria JavaScript rodando
no navegador de todo visitante — e naquela altura o CSP do projeto ainda
tinha `unsafe-inline`, que deixaria executar. Hoje não tem mais, mas as
duas defesas ficam de pé: política é configuração de servidor, e
configuração muda. Testado com quatro cargas (`img/onerror`,
`<script>`, `<svg onload>`, `iframe javascript:`): **as quatro
executavam**.

Agora o conteúdo entra por `textContent`. O pior que pode acontecer é
uma tag aparecer escrita na tela.

### A chave `anon` e a RLS

A chave `anon` está no código-fonte da página, e isso é o desenho previsto
do Supabase — ela é pública por natureza. O que a torna segura é a **Row
Level Security** na tabela `devocionais`: sem política que proíba escrita
anônima, qualquer um com essa chave escreve na tabela.

O `textContent` fecha o buraco do lado do app **independentemente da
RLS**. Mas a RLS continua sendo o que impede alguém de sujar o conteúdo
que os leitores veem, e isso só se confere no painel do Supabase.

### Mais dois defeitos no mesmo bloco

- **Cores cravadas em claro.** Fundo `#fdf8f0` com o texto herdando o tema
  escuro dava **1,14:1** de contraste — invisível. Saindo das variáveis,
  passou para 7,29:1 no claro e 6,39:1 no escuro.
- **`document.body.prepend()`** punha a caixa **acima da barra fixa**,
  empurrando a tela inteira para baixo dois segundos depois de carregar.
  Agora entra dentro da seção do dia.

O `script.js` foi apagado: não era carregado por arquivo nenhum e, se
fosse, quebraria — usava IDs (`titulo-dev`, `conteudo-dev`) que não
existem no HTML, e lia um esquema de tabela diferente do usado no
`index.html`.

Supabase, jsDelivr e Pexels entraram na política de privacidade. São
terceiros que recebem o IP de quem abre o app.

## A política de segurança fechou

O `Content-Security-Policy` do projeto tinha duas brechas que anulavam boa
parte do que ele prometia:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' …
style-src  'self' 'unsafe-inline' …
```

`unsafe-inline` em `script-src` deixa executar qualquer `<script>` embutido
ou `onerror=` que apareça na página — que é exatamente o que uma injeção
precisa. Com ele ligado, a CSP não defendia de XSS; defendia só de scripts
vindos de outro domínio.

### O que era preciso para tirar

`unsafe-eval` **não era usado por nada** — saiu de graça. As outras duas
seguravam o desenho de arquivo único:

| o que havia | quantos | para onde foi |
|---|---|---|
| bloco `<script>` embutido | 2 | `app.js`, `supabase-extra.js` |
| bloco `<style>` embutido | 2 | `estilo.css`, `privacidade.css` |
| atributo `style="…"` no HTML | 29 | classes no fim do `estilo.css` |
| atributo `style="…"` em template do JS | 4 | as mesmas classes |
| `onclick=` no HTML | **0** | — |

Os zero manipuladores embutidos foram sorte de desenho: o app sempre ligou
tudo por JavaScript. Fosse diferente, o trabalho seria muito maior.

### O nome da classe vem repetido

```css
.w-75.w-75 { width: 75%; }
```

Não é engano. `style=` embutido vence qualquer seletor; a classe simples não
vence. A largura do esqueleto de carregamento voltou sozinha para os 65% de
`.skeleton-linha:last-child` no instante em que deixou de ser inline — e foi
o teste que percebeu, comparando o valor calculado com o que o inline
declarava. Repetir o nome dobra a especificidade e empata com aquele
seletor; o desempate é a ordem, e o bloco é o último do arquivo.

Estilo escrito por JavaScript (`el.style.width = …`) continua valendo: a CSP
governa o atributo no HTML, não o CSSOM.

### Como isso é testado

O servidor local não manda cabeçalho nenhum. Um teste que abrisse a página
como ela é servida em desenvolvimento passaria com o app quebrado — foi
assim que o `unsafe-inline` sobreviveu tanto tempo sem ninguém notar que ele
não estava protegendo nada.

Por isso o `teste32.js` lê a política **do `vercel.json`** e a injeta nas
respostas, depois percorre o app inteiro — capítulo, folha do versículo,
gerador de imagem no canvas, sugestões de busca, gaveta — ouvindo o evento
`securitypolicyviolation`. Qualquer recusa do navegador vira falha.

### O que ainda passa por fora

`https://cdn.jsdelivr.net`, em `script-src`, é a biblioteca do Supabase. É o
único terceiro que o app carrega em tempo de execução. Trocá-lo por uma cópia
local fecharia também isso, ao custo de manter a biblioteca atualizada à mão.

## O gerador de imagem voltava em branco

Canvas de 1080×1350 com **zero pixels opacos**. O recuo para o fundo
desenhado tinha sido removido de `redesenharImagem`:

```js
catch(e){ avisar('Não foi possível carregar foto do Pexels…'); }
```

`desenharImagemArte()` continuava existindo, mas ficou inalcançável.
Quem estivesse offline, com o Pexels bloqueado, sem chave ou com a cota
estourada gerava uma imagem vazia — num app que se instala justamente
para funcionar sem internet.

O recuo voltou. E o "Trocar fundo" passou a girar **também** o fundo
desenhado: sem isso, quem cai no recuo aperta o botão e vê a mesma cena,
com o botão prometendo uma troca que não acontece.

O merge também tinha apagado o **endereço desenhado no rodapé** da
imagem, que a PR #40 havia acrescentado. Restaurado, com os mesmos
6,33:1 no pior fundo.

## O microfone estava desligado no servidor

O `vercel.json` trazia `Permissions-Policy: camera=(), microphone=(),
geolocation=(), payment=()`. A lista vazia em `microphone=()` não bloqueia
só terceiros — **bloqueia a própria origem**. O ditado por voz, que é a
funcionalidade que existe para quem não escreve, estava morto em produção.

E falhava do pior jeito possível: o botão continuava na tela, a pessoa
tocava, e nada acontecia.

Medido antes de mexer, servindo a mesma página com os dois cabeçalhos:

| `Permissions-Policy` | Navegador permite o microfone | Botão de ditar |
|---|---|---|
| `microphone=()` | **não** | aparecia mesmo assim |
| `microphone=(self)` | sim | aparece |

Duas correções, porque eram dois defeitos:

- **No servidor:** `microphone=(self)`. Câmera, localização e pagamento
  continuam fechados — o app não usa nenhum dos três.
- **No app:** o `Ditado` checava só se a API existe no navegador. Agora
  checa também `featurePolicy.allowsFeature('microphone')`, então se
  algum cabeçalho futuro barrar de novo, o botão some em vez de mentir.

Há teste que lê o `vercel.json` e reprova se o microfone voltar a ser
fechado, e outro que serve a página com cada um dos dois cabeçalhos e
confere que o botão acompanha o que o navegador decidiu.

## Lembrete na hora de quem recebe

O cron era diário, num horário só do mundo: `0 11 * * *`. Isso é 8h em
Brasília, **3h da manhã em Los Angeles e 19h em Manila**. Num produto de
hábito diário, a hora da entrega é o produto — e num produto internacional
um horário único é o mesmo que não ter lembrete.

Agora o cron roda **de hora em hora** e cada execução entrega apenas a
quem, no próprio fuso, está na hora que escolheu.

| | Antes | Agora |
|---|---|---|
| Cron | `0 11 * * *` | `0 * * * *` |
| Horário | 8h de Brasília, para todos | a hora que cada um escolhe |
| Fuso | nenhum | o do aparelho, enviado na inscrição |

### O fuso sai do Intl, não de uma conta de offset

Guardar "menos 180 minutos" pareceria mais simples e estaria errado duas
vezes por ano: o deslocamento muda com o horário de verão. O fuso vai
como nome IANA (`America/Sao_Paulo`) e a hora local sai do
`Intl.DateTimeFormat`, que já sabe as regras.

Escrevendo o teste eu errei essa conta na primeira tentativa — esperava
que 11h UTC fossem 3h em Los Angeles, e são 4h, porque em 10 de março de
2026 o horário de verão americano já começou. É exatamente o erro que a
conta com offset fixo cometeria o ano inteiro.

### Ninguém pode receber duas vezes

Com 24 execuções por dia, uma repetição da Vercel ou uma troca de fuso no
meio do dia poderiam mandar o mesmo lembrete de novo — e quem recebe dois
desliga a notificação. A trava é uma chave por pessoa **e por data
local**, gravada com `SET NX`: a marcação e a checagem acontecem no mesmo
passo, então duas execuções simultâneas não conseguem as duas vencer. A
chave expira sozinha em dois dias.

A data é a **local de quem recebe**, não a do servidor: quem está em
Tóquio às 8h ainda é "ontem" no servidor, e receberia o versículo de
véspera.

### Quem já tinha o lembrete não perde nada

Inscrição antiga não tem fuso nem hora, e cai em Brasília às 8h — o que
ela já recebia. Há teste somando as 24 execuções de um dia e exigindo
exatamente **uma entrega por inscrito**: nem zero, nem duas.

Quem viaja leva o app junto, então o fuso é reconferido a cada abertura e
a inscrição é reenviada se mudou.

## Estatísticas de uso

Não havia nenhuma. Sem isso não existe decisão comercial: não se sabe
quantos voltam no dia seguinte, quantos terminam o devocional, se o
lembrete traz alguém de volta.

**Não usamos o Vercel Analytics.** Num app de aba única "pageviews" não
responde nada; evento personalizado é recurso de plano pago; e seria mais
um script de terceiro num app que tirou até a fonte do Google. As
contagens ficam no mesmo Redis que já guarda as contas.

| Chave | O que é |
|---|---|
| `lampada:m:<data>:<evento>` | contador inteiro |
| `lampada:m:<data>:dau` | HyperLogLog de aparelhos distintos |

Nove eventos, em lista fechada **do lado do servidor** — aceitar nome
livre deixaria qualquer um encher o Redis de chaves inventadas: `abriu`,
`devocional_visto`, `devocional_completo`, `push_ativado`,
`compartilhou`, `imagem_gerada`, `plano_dia_lido`, `mapa_aberto`,
`busca_feita`.

Leitura em `GET /api/metricas?chave=<PUSH_SECRET>&dias=30` — fechada,
porque número de usuário é informação do negócio.

### Contar quantos sem guardar quais

Para saber retorno diário é preciso distinguir aparelhos. O identificador
é aleatório, nasce **no primeiro envio** (quem desligou ou usa *Do Not
Track* nunca chega a ter um) e entra num **HyperLogLog** — um resumo
probabilístico de tamanho fixo que responde "quantos" sem guardar
"quais". Ele entra na contagem e não fica: não existe lista da qual
pudesse ser recuperado.

O que **nunca** sai do aparelho: o que a pessoa lê, escreve, marca, ora
ou busca. Nem o texto da busca — só o fato de que uma busca aconteceu.
Há teste que planta um pedido de oração no `localStorage` e exige que ele
não apareça em nenhum envio.

Tudo expira em 90 dias. O `Do Not Track` do navegador desliga a medição
sozinho, e há desligamento na tela para quem não o usa. Endpoint fora do
ar não vira erro na tela de quem só queria ler.

## O menu em tela curta

A gaveta vai de `top: 0` a `bottom: 0` — a altura dela é a da tela — e o
conteúdo não cabia em telas baixas. Sem rolagem, a sobra simplesmente
saía pela borda: a nota das versões terminava no meio, sem o `(Open)`.

| Tela | Conteúdo | Gaveta | Sobra |
|---|---:|---:|---:|
| 320×568 | 727px | 568px | **159px cortados** |
| 360×640 | 727px | 640px | **87px cortados** |
| 390×844 | 727px | 844px | cabia |

Não era caso de encolher: em 320×568 faltavam 159px, e só se conseguiria
isso apertando alvos de toque que a WCAG exige em 44px. O que faltava era
**rolagem**.

O que rola é um invólucro interno, não a gaveta. O cabeçalho fica de fora
dele de propósito: é onde mora o tamanho da letra, e quem precisa dele é
justamente quem teria mais dificuldade de rolar até achá-lo — a mesma
razão pela qual esse controle saiu do rodapé um tempo atrás.

```css
.gaveta-rolagem {
  flex: 1;
  min-height: 0;      /* sem isto o flex recusa encolher e não rola */
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

O `min-height: 0` é o detalhe que faz a coisa funcionar: um item flex tem
tamanho mínimo automático igual ao conteúdo, e sem zerá-lo ele nunca
encolhe abaixo dos 727px — a rolagem jamais aconteceria.

### Rolar resolve o alcance, não a descoberta

Com a rolagem a nota fica alcançável, mas continua abaixo da dobra sem
nada dizendo que existe. Um esmaecido no pé do menu acende quando ainda
há conteúdo abaixo e apaga ao chegar no fim, para não prometer o que
acabou. Ele é `pointer-events: none` — é aviso, não obstáculo.

O aviso é recalculado ao abrir o menu, ao rolar e ao mudar o tamanho da
letra, que estica tudo por dentro e pode criar rolagem onde não havia.

### O que o invólucro quase quebrou

Os links deixaram de ser filhos da gaveta e viraram filhos do rolador. A
escada de entrada era escrita como `a:nth-child(2)` a `(5)`, contando com
o cabeçalho na posição 1 — sem corrigir para `(1)` a `(4)`, o primeiro
item passaria a entrar sem atraso e a animação começaria no segundo.

## Tipografia

O app tem **três vozes**, e a regra é qual delas fala:

| Variável | Onde | Família |
|---|---|---|
| `--fonte-interface` | botões, rótulos, listas | Source Sans 3 |
| `--fonte-leitura` | a Escritura e o devocional | Source Serif 4 |
| `--fonte-titulo` | os títulos | Source Serif 4 |

A regra de origem — **interface em sans, Palavra em serif** — já existia e
continua. O que mudou é que **o título entrou no serif junto da Palavra**,
porque o que ele anuncia é ela, não a interface. Antes todo título era
sans e o app parecia um painel de configurações com um versículo dentro.

O que **não** virou serif: o rótulo de seção. O `h2` deste app é uma
etiqueta de 12px em maiúsculas — é chrome, não título. Serif ali seria
enfeite em cima de etiqueta, e há teste que exige que ele continue sans.

As três estão em variável para trocar de família ser **uma linha e não
dezesseis**. Querendo Lora, Merriweather ou Playfair Display: baixe o
woff2 para `/fonts`, some o `@font-face` e mude `--fonte-titulo`. Um teste
percorre a folha de estilo inteira e reprova se alguma regra voltar a
escrever a pilha de fontes na mão.

### Legibilidade

| | Antes | Agora |
|---|---:|---:|
| Corpo | 16px / 1,55 | **17px / 1,65** |
| Devocional (reflexão, meditação, oração) | 15,5px / 1,6 | **17px / 1,7** |
| Saudação | 22px sans | **26px serif** |

O devocional estava **menor que a interface**: 15,5px para o que se lê e
16px para o rótulo de um botão era a hierarquia ao contrário. É o texto
mais longo do app e agora é o mais confortável.

### Respiro

| | Antes | Agora |
|---|---:|---:|
| Margem lateral (celular) | 16px | **20px** |
| Margem lateral (≥560px) | 16px | **28px** |
| Recheio do cartão | 24/22/26 | **28/24/30** |
| Entre seções | 28px | **34px** |

16px é a margem de uma lista de sistema; um app de leitura pede mais. O
teto de 880px continua, senão a linha fica longa demais no tablet.

### O canvas não entende variável de CSS

Trocar as famílias por variável quebrou o gerador de imagem, e em
silêncio. `ctx.font` passa pelo parser de fonte do canvas, que rejeita
`var(--fonte-leitura)` **sem erro** e deixa valendo a fonte anterior —
10px sans-serif. Com isso `measureText` media na fonte errada, tudo
"cabia" no tamanho máximo, e o versículo longo sairia estourando a
imagem em vez de encolher.

Quem pegou foi a asserção `a fonte foi reduzida para caber`, escrita
muito antes e sem relação aparente com tipografia. A pilha do canvas vai
escrita numa constante `FONTE_CANVAS`, e agora há teste conferindo que
ela é aceita pelo navegador e que não contém `var(`.

## Compartilhar leva ao versículo

Versículo compartilhado sem link chega bonito e morre ali: quem recebeu
não tem como voltar ao lugar de onde ele veio. Agora vai um link junto —
e ele **não é a capa**, é a passagem.

```
https://devocionaldiario-eosin.vercel.app/?v=1.28.19
```

`?v=livro.capítulo.versículo`. Abre Gênesis 28, com o 19 destacado.

São **números e não o nome do livro** porque o nome tem acento e espaço, e
um endereço com `G%C3%AAnesis%2028` some quando o aplicativo de mensagem
corta o link no meio.

O endereço-base sai da tag `canonical` — a mesma que a prévia do WhatsApp
usa. Se saíssem de lugares diferentes, um dia divergiriam sem ninguém
notar; há teste conferindo que `LINK_SITE`, a canônica e a `og:url` são a
mesma coisa.

### O link vai no campo certo

`navigator.share({ text, url })`, com o endereço **separado** e não colado
no texto. Quando o destino só aceita texto — o WhatsApp é assim —, quem
junta os dois é o próprio navegador, com o espaçamento que aquele
aplicativo espera. Colar o endereço no texto *e* mandar em `url` faria o
link aparecer duas vezes onde os dois campos são entendidos.

Na cópia para a área de transferência não existe campo separado, então aí
o endereço entra no texto à mão. Há teste para os dois caminhos.

### Chegando pelo link

`?v=` é atendido **depois** da aba guardada, de propósito: o link é o
motivo pelo qual a pessoa abriu o app agora, e ganha de onde ela estava
ontem. Depois de atendido o endereço é limpo — senão ela navegaria o app
inteiro com `?v=` grudado na barra, e um "atualizar" mais tarde a jogaria
de volta àquele versículo sem ter pedido.

Link estragado não derruba nada: livro que não existe, capítulo além do
fim do livro ou lixo no lugar dos números caem no devocional do dia, como
uma abertura normal. São quatro asserções.

### O endereço saiu da imagem

Ele já foi desenhado no rodapé da arte, com a ideia de viajar junto com a
imagem reencaminhada — legenda não sobrevive ao repasse, e quem recebe de
terceira mão não sabe de onde veio.

Saiu. Endereço queimado na imagem é marca d'água: compete com o versículo,
que é o motivo de a imagem existir; envelhece no dia em que o domínio mudar,
e ninguém digita um endereço lido numa foto.

O link continua indo no compartilhamento, ao lado da imagem, onde é clicável
e leva **direto ao versículo** — ver `compartilharTexto` e `linkDoVerso`. O
teste grava tudo que passa por `fillText` e confere que nada ali é o
endereço, e que o versículo, a referência e a marca continuam.

| | Antes | Agora |
|---|---:|---:|
| Pior fundo (pergaminho) | 3,65 | **6,33** |
| Segundo pior (oliveira) | 3,61 | **6,83** |
| Melhor caso | 9,96 | **15,29** |

O teste percorre os dez fundos e reprova se qualquer um cair abaixo de
4,5.

## Prévia ao compartilhar

Mandar o link no WhatsApp mostrava título e descrição, e nenhuma imagem.
A causa não era o favicon: o `index.html` **não tinha nenhuma tag Open
Graph**, e sem elas o WhatsApp cai no `<title>` e no `<meta description>`
— que era exatamente o que aparecia.

O favicon não resolve isso. Quem lê a prévia é o Open Graph, e ele quer
uma imagem própria:

| Exigência | Por quê |
|---|---|
| Endereço **absoluto**, com `https://` | o robô não está numa página, está buscando uma URL; caminho relativo ele não resolve |
| **1200×630** | é o que abre a prévia grande; imagem quadrada vira miniatura ao lado do texto |
| **JPEG ou PNG** | SVG e WEBP não são renderizados na prévia — então o `favicon.svg` nunca serviria |
| Arquivo **leve** | acima de ~300 KB o robô costuma desistir e a prévia volta a sair sem imagem |

A arte está em `og-imagem.jpg`, **53 KB**. A mesma imagem em PNG dava 399
KB, perto demais do limite para valer o risco. Ela é gerada por
`ferramentas/og-imagem.html`, uma página que existe só para virar captura
de tela em 1200×630 — assim a arte se refaz com um comando em vez de
depender de um arquivo que ninguém sabe mais como foi feito.

A política de privacidade ganhou as mesmas tags, senão o link dela sairia
sem imagem do mesmo jeito.

### O WhatsApp guarda a prévia

Depois de publicar, um link já compartilhado pode continuar mostrando a
prévia antiga por um bom tempo — o cache é do WhatsApp e não há botão para
limpar. Para conferir que funcionou, mande o endereço com uma variação
qualquer no fim (`?x=1`): para o robô é outra URL, e ele busca de novo.

## Microfone dentro do campo do pedido

Em "Minhas orações", o microfone ficava numa coluna ao lado do campo de
texto. Numa tela de 320px, aquela coluna de 44px mais o vão de 8px comiam
**52px** — um sexto da tela — para um botão que se usa uma vez por pedido.

| Largura do campo | Antes | Agora |
|---|---:|---:|
| tela de 320px | 190px | **242px** |
| tela de 390px | 260px | **312px** |

Agora ele flutua dentro do canto de baixo do próprio campo: o container
ancora com `position: relative`, o botão vai a `position: absolute` a 8px
das bordas, e o campo reserva **56px** de `padding-bottom` para o texto
nunca correr por baixo do ícone — 44px do botão mais os 8px que ele guarda
da borda, mais folga.

O posicionamento é escopado a `.form-oracao .btn-mic`. O mesmo `.btn-mic`
serve à busca por voz e à nota do versículo, que continuam em linha; há
teste conferindo que os dois seguem em `position: static`.

### O que a mudança quebrava, e o que se fez

A alça de redimensionar do navegador nasce exatamente no canto onde o
microfone agora pousa — o botão a cobriria e ela viraria enfeite. Então o
`resize` saiu, e em troca **o campo cresce sozinho** conforme se escreve,
que em celular é melhor do que arrastar uma alça de 16px.

Duas armadilhas nesse ajuste:

- `box-sizing: border-box` faz a altura incluir a borda, e `scrollHeight`
  não inclui. Sem somar as duas o campo fica 2px curto e corta a última
  linha — justamente de quem escreveu mais.
- Mexer no `value` por código **não dispara `input`**. Sem chamar o ajuste
  à mão, o campo ficava alto e vazio depois de adicionar um pedido longo,
  e o mesmo valia para o texto que chega pelo ditado.

Quando o navegador não tem ditado, o botão some — e aí o fundo reservado
para ele viraria um buraco embaixo do texto. O `padding-bottom` volta ao
normal junto.

## Mapa da Terra Santa

Ler "desceu a Jericó" ou "atravessou para a outra margem" sem saber onde
fica nada é ler metade. O mapa fica na aba **Bíblia**, atrás de um botão, e
cada lugar abre uma ficha com o que aconteceu ali, quantos versículos o
citam e as passagens para ler.

| | |
|---|---:|
| Lugares | 41 |
| Passagens ligadas a eles | 68 |
| Nomes que cabem no desenho | 37 |

### As coordenadas são do OpenBible.info

O mapa usa o [Bible Geocoding
Data](https://github.com/openbibleinfo/Bible-Geocoding-Data) do
OpenBible.info, publicado sob **Creative Commons Attribution 4.0**. Deles
vêm a latitude, a longitude e a contagem de quantos versículos citam cada
lugar. Nossos são a escolha dos lugares, o nome em português, a nota e as
passagens que abrem no leitor. A CC BY exige crédito, e ele está **na tela
do mapa**, não só aqui.

O desenho continua sendo nosso, em SVG: sem imagem de terceiro, sem tile
server, sem pedido de rede — o mapa funciona offline, que é o ponto de um
app que se instala no celular. O que a base aberta substituiu foi o dado,
não o traço. Foi para isso que os dois estavam separados desde o começo.

Antes as 24 coordenadas eram digitadas à mão, de memória. Comparadas com a
base, erravam **1,8 km em média e 8,8 km no pior caso** — Caná, porque há
dois sítios candidatos e eu tinha escolhido o tradicional sem saber que
havia disputa.

`ferramentas/gerar-lugares.mjs` baixa a base, resolve cada lugar e imprime
o bloco `LUGARES` que vai para o `index.html`. Rodar de novo é como se
atualiza; editar as coordenadas à mão é o que não se faz.

```
node ferramentas/gerar-lugares.mjs            gera o bloco LUGARES
node ferramentas/gerar-lugares.mjs --ranking  lista candidatos a entrar
```

### O gerador confere o que escrevemos

Cada passagem que escolhemos é conferida contra a lista de menções da
base: se dissermos que Rute 1:22 fala de Belém e ela discordar, o gerador
avisa. A conferência é **por capítulo, não por versículo**, de propósito —
a passagem que abre no leitor é a do acontecimento, não a que soletra o
nome. Atos 2:1 é o Pentecostes; quem diz "Jerusalém" é Atos 2:5.

Isso pegou três coisas que eu não sabia:

| | |
|---|---|
| Jericó | a do Antigo Testamento e a do Novo são sítios a 2,3 km um do outro |
| Berseba, Samaria | aparecem duas vezes no mesmo ponto — a cidade e a região |
| Mar Morto | Gênesis 19 fala de Sodoma, não do mar; a passagem virou Gênesis 14:3 |

Um pino cobre os dois sítios de Jericó e as duas entradas de Berseba e
Samaria; o campo `tambem` declara isso, e as menções somam. As duas
passagens que abrimos sem o nome aparecer no capítulo — Lucas 10 para
Betânia, Marcos 4 para o lago — estão declaradas em `contexto`, e o
gerador reclama se a exceção deixar de ser necessária.

### Quem escolhe onde cada nome fica

Com 24 lugares, 14 rótulos precisavam de deslocamento escrito à mão. Com
41 isso não escala. Agora cada nome experimenta 24 posições em volta do
ponto — três anéis por oito direções — e fica na primeira que não encosta
em nome já posto, em ponto nenhum e nem na borda. Quem é mais citado
escolhe primeiro, então, quando sobra uma vaga só, é Jerusalém que fica
com ela.

A caixa de cada nome é medida com `getBBox()`, não estimada por número de
letras: foi estimando que quatro rótulos passaram por cima uns dos outros
na primeira tentativa. Por isso o desenho acontece com a seção já visível
— `getBBox` não mede o que o navegador ainda não dispôs.

Nome que sai para um anel de longe ganha **linha de chamada**. Sem ela o
mapa ficava com nomes soltos no meio do nada, sem dar para saber de qual
ponto eram — troca ruim. Nome que não cabe em posição nenhuma some, e são
quatro, todos no aperto da Judeia: o ponto continua clicável, o leitor de
tela continua anunciando, e **tocar no ponto faz o nome reaparecer**, para
não existir ponto anônimo.

### Alvo de toque invisível

Cada lugar é um grupo com ponto, rótulo e um retângulo transparente de
44×44 por cima, que é quem recebe o toque — um ponto de 6px de raio é
impossível de acertar com o dedo. O retângulo herdava o traço do grupo e
desenhava uma caixa em volta de cada cidade; o teste confere que ele
continua sem preenchimento e sem traço.

### Por que não um atlas pronto

| Fonte | Licença | Por que não |
|---|---|---|
| Atlas escaneados no Commons | domínio público (pré-1930) | imagem de 1900 em tela de celular: texto ilegível, sem toque, sem tema escuro |
| Tiles do OpenStreetMap | ODbL | precisa de rede, mostra fronteiras modernas, e a atribuição viaja junto |

O OpenBible.info não é um atlas: é a tabela de coordenadas. Por isso serve.

## Continuar de onde parou

Quem estava no dia 12 de um plano não via isso em lugar nenhum na tela
Hoje: tinha de ir na aba Planos, achar o plano e achar o dia. O cartão
mora logo abaixo do devocional, com o nome do plano, a barra de progresso,
a leitura do próximo dia e três botões — ler, ouvir e ver o plano.

Só aparece com um plano **em andamento**: quem não começou nenhum não
precisa de um cartão vazio dizendo isso, e um plano concluído sai da lista.

Dois detalhes que o código explica:

- **O próximo dia é o primeiro que falta**, não o seguinte ao último
  marcado — dá para marcar os dias fora de ordem, e `[1,2,5,6]` oferece o 3.
- Com **mais de um plano em andamento**, ganha o último aberto
  (`lampada-plano-atual`). Sem essa marca — em outro aparelho, por exemplo —
  vale o mais adiantado, que é onde há mais a perder parando. A marca é
  preferência de aparelho e não sincroniza; o progresso em si sincroniza.

## Primeira visita

O novo usuário era recebido por `0 dias seguidos · 0 capítulos lidos ·
0 favoritos · 0 dias de planos`. Começar do zero é normal; ser recebido
por um placar disso, não.

Enquanto não há atividade nenhuma, o placar dá lugar a uma mensagem de
boas-vindas que diz o que vai aparecer ali e leva ao devocional do dia. O
botão **Ouvir meu resumo** some junto — ele leria os quatro zeros em voz
alta, contradizendo a mensagem logo acima.

No topo da aba Hoje há uma **saudação por horário** — bom dia, boa tarde,
boa noite, boa madrugada. Sem nome: a conta guarda só o e-mail, e deduzir
um nome do que vem antes do arroba erra feio na maioria das vezes.

## Ícones

Um mesmo botão aparecia diferente no Android, no iPhone e no computador,
porque parte dos ícones era emoji — que vem com cor própria, ignora o tema
e é desenhado pelo sistema, não pelo app.

Os que de fato renderizavam coloridos (🔍 🎤 🕐, e no celular também 🖼 🗓)
viraram **SVG num sprite**, com `currentColor`: herdam a cor do texto ao
redor e são idênticos em todo lugar. Os glifos que já eram monocromáticos
— setas, ‹ ›, ✓, ★ ☆ — ficaram, porque nunca foram o problema.

Os quatro microfones do app usavam desenhos diferentes entre si: o da busca
era PNG, os outros três eram emoji. Agora são o mesmo arquivo.

## Um "Ouvir" só no devocional

O cartão do percurso trazia **"Ouvir"** e **"Ouvir e seguir"** lado a lado,
com o mesmo ícone e a um dedo de distância — um lê só o versículo, o outro
lê o devocional inteiro e vira de passo sozinho. Não havia como adivinhar a
diferença.

O botão grande sai do primeiro passo (`semBotaoOuvir`), porque
"Ouvir e seguir" já começa lendo aquele versículo. O alto-falante discreto
do cabeçalho continua ali para quem quer só o versículo, e o cartão avulso
— em promessas, favoritos, resultados de busca — mantém o botão de sempre.

## Fontes no próprio site

As duas famílias vinham de `fonts.googleapis.com` por um `<link rel="stylesheet">`.
Isso tem três problemas, e o terceiro é o que decide:

1. É **bloqueante de renderização** — nada aparece na tela até aquele host
   responder. Em rede boa é invisível; em rede ruim, em portal cativo ou com
   DNS lento, é tela branca.
2. Manda o IP de quem abre o app para um terceiro, a cada carregamento.
3. **O service worker só guarda o próprio domínio**, então a folha externa
   nunca entrava no cache. Um app que promete funcionar offline dependia de
   um servidor de fora para pintar a primeira tela.

Agora são dois arquivos locais, no precache:

| Arquivo | Tamanho |
|---|---:|
| `fonts/source-sans-3.woff2` | 28,7 KB |
| `fonts/source-serif-4.woff2` | 122,4 KB |

São **fontes variáveis** — um arquivo por família cobre todos os pesos, em
vez de um por peso. O `unicode-range` limita ao latim; fora dele o sistema
assume. O Google saiu da tabela de terceiros da política de privacidade,
porque continuar listado ali seria falso.

## Contraste

`--texto-3` é a cor dos títulos de seção, dos rótulos das abas inativas
(11 px), das datas do histórico — 35 usos. Ela aparece sobre o papel dos
cartões **e** sobre o fundo da página, e o pior dos dois é que decide.

| Tema | Antes | Agora | Mínimo AA |
|---|---:|---:|---:|
| Claro | 3,41 | **4,95** | 4,5 |
| Escuro | 4,00 | **4,72** | 4,5 |

No tema escuro, o ícone de compartilhar também ficava **preto sobre fundo
escuro** nos três lugares onde aparece. A regra de inversão pega agora pelo
nome do arquivo, e traz o `#fa-copiar` junto porque a regra dele tem id e
venceria por especificidade.

## Acessibilidade estrutural

Um app cuja premissa é servir quem tem dificuldade de ler tinha três
defeitos medidos que atrapalhavam exatamente esse público.

### Cabeçalhos

A página não tinha **nenhum `<h1>` nem `<h2>`**. Os dez títulos de seção
eram `<p class="rotulo-secao">`, e a hierarquia começava direto no `<h3>`.
Quem usa TalkBack ou VoiceOver navega por cabeçalhos — é como um cego
"passa o olho" numa tela — e esse atalho simplesmente não existia aqui.

Agora: `<h1>` no nome do app, os dez títulos como `<h2>`, `<h3>` nos
cartões. Sem pular nível. O CSS não mudou, só a tag.

### Foco nos painéis

Abrir a gaveta não mexia no foco: ele ficava no ☰ *atrás* do painel, e o
Tab seguinte caía em botões cobertos. O módulo `Foco` resolve os três
lados:

- o foco **entra** no painel ao abrir
- o Tab **dá a volta dentro** dele e não vaza para trás
- ao fechar, o foco **volta** ao botão que abriu

Vale para gaveta, painel de voz, painel de conta, folha do versículo e
modal da imagem, todos marcados com `role="dialog"` e `aria-modal`. A
pilha existe porque o painel de voz abre por cima da gaveta — o Tab tem de
respeitar só o de cima. Devolver o foco a um elemento escondido joga a
pessoa para o começo da página, então esse caso é detectado e evitado.

**Os versículos eram `<span>` com `onclick`**: quem usa teclado não
conseguia abrir a folha de ações de jeito nenhum, e o leitor de tela não
dizia que aquilo era tocável. Agora têm `tabindex`, `role="button"`,
`aria-haspopup="dialog"` e respondem a Enter e espaço.

### Alvos de toque

41 controles ficavam abaixo dos 44 px da WCAG 2.5.5 — o ☰ tinha **18 px**
de altura. Quem tem tremor, artrite ou dedo grosso erra o alvo e não sabe
por quê. Hoje são zero.

Dois casos não levam `min-height`, e é de propósito:

- **o chip do tema** estende a área de toque por fora, com `::after`: com
  44 px de altura ele pesaria mais que o próprio título ao lado
- **os versículos e o link do consentimento** são dispensados pela WCAG
  2.5.8 — alvos cujo tamanho é ditado pelo texto em volta. Forçar 44 px num
  versículo abriria buracos entre as linhas da leitura

### Ainda falta

Link "pular para o conteúdo", e anunciar mudanças dinâmicas por
`aria-live` — quando o devocional carrega, quando a busca termina, quando
a aba troca, o leitor de tela do sistema fica em silêncio. O modo áudio já
fala essas coisas, mas com a voz do *app*, não com a do leitor de tela.

## O botão voltar do celular

O app tinha cinco camadas — aba, livro, capítulo, folha do versículo, menu
lateral — e **nenhuma delas existia para o navegador**. Medido antes da
correção: abrir a Bíblia, escolher um livro, um capítulo e tocar num
versículo deixava o histórico exatamente como estava ao carregar a página.

```
entradas no histórico ao abrir:                              2
depois de: aba → livro → capítulo → folha do versículo:      2
depois de apertar VOLTAR:                          fora do app
```

No computador isso passa despercebido, porque lá se fecha tudo pelo X ou
pelo Esc. No celular o voltar é o gesto mais usado do sistema, e perder o
lugar da leitura por causa dele é caro. É a heurística 3 de Nielsen —
controle e liberdade do usuário — na sua forma mais literal.

### O contrato

Cada camada aberta empilha uma entrada. O contrato é de mão única, e é o
que evita laço infinito:

| momento | o que acontece |
|---|---|
| abrir uma camada | `Navegacao.entrar(id, comoFechar)` |
| fechar pelo app (X, toque fora, Esc) | `Navegacao.sair(id)` pede o voltar ao navegador |
| fechar pelo voltar do sistema | `popstate` desempilha e chama `comoFechar` |

Ninguém fecha nada direto: **quem fecha é sempre o `popstate`**. Assim o X,
o toque fora, o Esc e o voltar do sistema consomem a mesma entrada, e nunca
sobra uma exigindo dois toques para sair de um lugar só.

As camadas são `aba`, `nivel` (uma por degrau da Bíblia), `folha`, `painel`
(nota, comparar, referências), `gaveta`, `painel-voz`, `painel-conta` e
`imagem`.

### Três armadilhas que os testes seguram

**Fechar e ir para outro lugar na mesma ação.** `history.go` é assíncrono.
O link do menu lateral fechava a gaveta e trocava de aba na mesma linha: a
troca de aba empilhava uma camada, o `popstate` chegava depois e levava as
duas embora — o link não ia a lugar nenhum. Por isso `sair` aceita uma
continuação, executada só depois de o desempilhamento terminar.

**Passear pelas abas.** Se cada troca de aba empilhasse, sair do app
custaria um voltar por aba visitada. A camada `aba` é `unica`: repõe-se em
vez de empilhar. Os degraus da Bíblia são o oposto — livros → capítulos →
leitura precisa de um voltar por degrau — então a repetição só vale para
quem pede.

**Dois toques rápidos no X.** O `popstate` só chega no quadro seguinte; sem
uma marca de "já estou saindo", o segundo toque disparava outro
`history.go` e levava junto a camada de baixo — fechar a folha fechava
também o capítulo.

### O que o voltar faz hoje

Lendo João 3 com a folha do versículo aberta, os voltares são: fecha a
folha → volta à lista de capítulos → volta à lista de livros → volta à aba
Hoje → **só então** sai do app. Um link compartilhado (`?v=43.3.16`) abre
direto na leitura e mesmo assim sobe pelos degraus, em vez de jogar a
pessoa para fora de um app que ela acabou de abrir.

## Navegação em abas

Tudo vivia numa página só, e a home tinha **8.004 px — 9,5 telas de
rolagem**. A lista dos 66 livros (2.248 px) e o catálogo de 12 planos
(2.456 px) somavam 59% dela e ficavam entre o devocional do dia e todo o
resto. O que mais se revisita, **Favoritos e diário**, estava a 8,6 telas
do topo; o **Instalar app** era o último elemento da página.

São catálogos, não conteúdo diário. Ganharam abas próprias:

A divisão entre **Hoje** e **Meu** é entre *fazer* e *ter feito*:

| Aba | O que tem | Altura |
|---|---|---:|
| **Hoje** | saudação, devocional, continuar de onde parou, orações, promessas | 2.079 px |
| **Bíblia** | busca, versão, lista de livros, leitura | 2.819 px |
| **Planos** | os 12 planos | 2.797 px |
| **Meu** | jornada, dias anteriores, favoritos, diário, instalar | 1.525 px |

A home caiu de 8.004 px para **2,5 telas**.

### Abrir o app é chegar no devocional

O navegador guarda a rolagem e devolve a pessoa onde ela parou. Num site
comum isso ajuda; aqui atrapalhava — quem tinha parado na caixa de
promessas reabria lá no dia seguinte, em vez de no devocional do dia, que
é o motivo de o app existir. A restauração automática fica desligada
(`history.scrollRestoration = 'manual'`) e a abertura é sempre no começo.

A aba escolhida (`lampada-aba`) **só vale enquanto o dia é o mesmo**: quem
estava na Bíblia há dez minutos volta para lá, quem abre amanhã de manhã
encontra o devocional.

**Sua jornada** e **Dias anteriores** são registro do que se acumulou, não
algo que se faça — e a sequência já aparece no fim do percurso guiado, no
momento em que ela motiva. **Minhas orações** fica em Hoje mesmo sendo
pessoal: o campo pergunta *"pelo que você quer orar hoje?"* e a tela de
conclusão do devocional termina oferecendo registrar um pedido — mover a
seção transformaria esse passo do ritual num salto de aba.

Uma seção só é alcançada por `mostrarSecao(id)`, que troca de aba antes de
rolar — sem isso a rolagem cairia num elemento escondido e a tela pareceria
travada. É o que faz "Ler o capítulo completo" saltar do devocional para a
Bíblia, e o chip do tema saltar para a caixa de promessas.

Os ícones das abas são SVG com `currentColor`, não emoji: emoji trazem cor
própria e ignorariam o azul do estado ativo.

### Rodapé compartilhado

A barra de áudio também é fixa no rodapé. As duas se empilham por uma
medida só, `--rodape`, de que dependem o `bottom` da barra de áudio, o dos
avisos e o `padding-bottom` do conteúdo — nada fica escondido atrás das
abas, e o `env(safe-area-inset-bottom)` do iPhone entra em um lugar só.

### Tamanho da letra

Saiu dos controles da Bíblia — vale para o app inteiro, e preso à aba
Bíblia ficaria inalcançável para quem está lendo o devocional. Foi primeiro
para o rodapé do menu, e daí para o **cabeçalho do menu**, porque no rodapé
ele nascia atrás de nove itens:

| Tela | Gaveta rola | Controle no rodapé | No cabeçalho |
|---|---:|---|---|
| 390×844 | 0 px | visível | visível |
| 360×640 | 72 px | **86 px abaixo do fim** | visível |
| 320×568 | 144 px | fora da tela | visível |

São **dois botões de passo** (`A−` `A+`), não quatro de escolha direta: a
gaveta tem 290 px e, descontado o padding e a palavra "Menu", sobram uns
195 px — quatro alvos de 44 px não caberiam com folga. Além de caber,
"aumentar a letra" é mais direto do que escolher entre quatro rótulos
abstratos. Nos extremos o botão apaga, e um aviso diz o tamanho novo em
palavras ("Letra grande"), também por voz no modo áudio.

**É guardado** (`lampada-escala`) — antes voltava ao normal a cada
abertura, justamente para quem mais depende dele.

## Conteúdo do devocional

Cada versículo pertence a um dos dez temas, e **os três textos do dia saem
do tema do próprio versículo**. Antes não era assim: reflexão, meditação e
oração eram três listas soltas indexadas só pelo dia, à parte do versículo
— um texto de gratidão podia vir acompanhado de uma reflexão sobre
ansiedade. O percurso guiado tornou o problema visível, porque a premissa
dele é que os quatro passos formam um caminho só.

| | Antes | Agora |
|---|---|---|
| Versículos | 69 | **180** (18 por tema) |
| Reflexões / meditações / orações | 12 de cada, soltas | **8 de cada por tema**, 240 no total |
| Relação com o versículo | nenhuma | mesma do tema |
| Volta a repetir a combinação | a cada 276 dias | **nunca dentro do ano** |

O versículo dá a volta a cada 180 dias e as reflexões a cada 8. Se o índice
fosse só o dia, os dois ciclos voltariam a coincidir no dia 361 e a última
semana do ano repetiria a combinação da primeira; somar o número da volta
desencontra os ciclos — 366 dias, 366 pares distintos.

O devocional continua **determinístico pelo dia do ano**: o histórico dos
últimos 30 dias precisa reencontrar exatamente o que foi mostrado.

Um chip com o nome do tema aparece ao lado do rótulo do passo. Tocar nele
seleciona esse tema na caixa de promessas e leva até lá — dá para continuar
lendo sobre o mesmo assunto.

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

### Como se sabe que dá para tocar?

Não se sabia. Medido na linha do versículo, antes de mexer:

```json
{"cursor":"pointer","role":"button","tabindex":"0","ariaLabel":null,"temDica":false}
```

Era um botão sem descrição e sem sinal na tela. Quem usa leitor de tela
ouvia o versículo inteiro e depois a palavra "botão" — sem nunca saber o que
apertar faria. Quem enxerga não tinha pista nenhuma: cores, nota, favorito,
comparar e ouvir dependiam de adivinhar o gesto.

**Para o leitor de tela: `aria-describedby`, não `aria-label`.** O label
*substitui* o conteúdo — com ele, o versículo deixaria de ser lido, e o preço
de anunciar a ação seria perder a Palavra. A descrição soma, vem depois do
texto, e um elemento `.so-leitor` só serve para os cento e tantos versículos
de um capítulo.

A classe `.so-leitor` esconde da tela sem esconder do leitor: `clip-path`,
não `display: none` nem `visibility: hidden` — esses dois tirariam dos dois.

**Na tela: uma dica que se aposenta.** Acima do capítulo, na primeira vez,
"Toque num versículo para marcar com cor, favoritar, anotar ou ouvir." Ela
sai **sozinha** assim que alguém abre a folha de um versículo: quem acabou de
fazer não precisa ser ensinado, nem obrigado a dispensar um aviso sobre o que
já sabe. E tem um X de 44px para quem quiser dispensar antes.

**Resposta ao toque.** Havia `.v:hover`, que só existe no computador. No
celular — onde o app é usado — encostar o dedo não dava retorno nenhum.
Agora há `.v:active`, e `.v:focus-visible` para quem navega pelo teclado.

### A nota não some ao fechar a folha

Fechar a folha descartava o que estivesse escrito no campo — e tocar no fundo
escuro fecha também. Alguém escrevia uma reflexão, encostava o dedo fora sem
querer e acabou: sem pergunta, sem aviso, sem volta.

Agora `fecharFolha()` chama `guardarNotaPendente()` antes de fechar. Ela
compara o campo com o que está gravado e, se mudou, grava — em silêncio, com
`salvarNotaDoVerso({ silencioso: true })`. É rede de segurança, não uma ação
que a pessoa pediu, então não aparece o aviso "Nota salva". Vale para as três
saídas: o X, o toque no fundo e o Esc.

Salvar sem perguntar é melhor do que perguntar: ninguém precisa decidir se
quer guardar o que acabou de escrever. É o mesmo comportamento que a nota do
diário já tinha, que grava ao perder o foco.

### Desfazer

Remover um pedido de oração, um favorito ou uma nota era instantâneo e
definitivo — a palavra "Desfazer" não existia em lugar nenhum do app.

O aviso (`avisar`) passou a aceitar uma segunda opção:

```js
avisar('Pedido removido', { aoTocar: () => { salvarOracoes(antes); renderOracoes(); } });
```

O padrão é sempre o mesmo: guardar a lista inteira **antes** de remover e
devolvê-la no `aoTocar`. Está ligado nas quatro remoções — favorito, pedido
de oração, nota do versículo (esvaziando o campo) e nota da lista do diário.
Na nota da lista, o que volta é o que estava no `textarea`, não só o gravado:
quem digitou e apagou sem sair do campo perderia a última frase.

Dois detalhes que os testes cobrem:

- **6 segundos em vez de 2,4** quando há ação. É o tempo de ler, entender que
  errou e alcançar o botão.
- **`pointer-events` volta a valer só quando há botão** (`.aviso.com-acao`).
  No aviso comum continua desligado, senão ele roubaria o toque de quem
  quisesse tocar na tela por baixo.

O botão tem 44px de altura, como o resto do app, e passa nos 4,5:1 da AA nos
dois temas — no tema escuro o aviso inverte para fundo claro, então lá ele usa
azul escuro (`#12508F`), não o azul claro do tema claro.

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

### Qual voz o app escolhe sozinho

Escolher a primeira da lista que casasse com um nome conhecido tinha um
defeito silencioso: a ordem da lista decidia tudo. Bastava existir uma
"Google" qualquer para ela ganhar de uma **"Luciana (Premium)"** — a voz
boa que a pessoa baixou de propósito — só porque `google` vinha antes na
fila de preferências.

Agora cada sinal vale pontos e a voz soma:

| Sinal | Pontos |
|---|---:|
| `pt-BR` | **1000** |
| outro português | 500 |
| Premium, Enhanced, Aprimorada, Melhorada | 30 |
| Natural, Neural, Siri | 25 |
| Google, Microsoft | 12 |
| nome conhecido de voz brasileira | 8 |
| não depende de internet | 6 |

O idioma é **degrau, não bônus**: uma voz Premium de Portugal lendo um
devocional brasileiro soa estrangeira, e nenhum somatório de qualidade
deveria passar na frente de uma voz comum daqui. Os degraus são largos o
bastante para os sinais de nome nunca os cruzarem.

`Premium` e `Enhanced` faltavam na lista antiga, e são exatamente os nomes
que o iPhone dá à voz boa. O iOS ainda traduz esse nome para o idioma do
aparelho, daí `aprimorad` e `melhorad` também entrarem.

A escolha só vale enquanto a pessoa não escolher a dela no menu lateral —
essa fica guardada e ganha de tudo.

### Quando a voz falha por falta de internet

As vozes que soam melhor costumam ser de rede. Sem internet elas falham em
**todo** trecho, um por um, e o `onerror` simplesmente pulava para o
seguinte: a leitura inteira terminava em silêncio, sem nada na tela
explicando por quê. Num app que existe também para quem não lê, é o pior
jeito possível de falhar.

Na primeira falha o app troca para a melhor voz **de dentro do aparelho** e
repete o trecho. A troca vale uma vez por leitura — duas vozes quebradas
fariam a função chamar a si mesma sem fim.

Por isso também o pequeno bônus para voz local: ele não derruba uma
Premium de verdade, só desempata para a que funciona sem rede.

## A chave torta

As três chaves do painel de voz apareciam como um borrão bege com o botão
branco encostado no alto. Medido:

```
declarado no CSS  54 x 32
real na tela      54 x 44      ← 12px de pista vazia embaixo do botão
botão             26px em top: 3px
```

A causa foi uma regra minha, escrita para outra coisa: `min-height: 44px`
aplicado a tudo que se toca, `.chave` inclusive. A pista esticou; o botão,
preso num `top` fixo, ficou onde estava.

O conserto separa as duas coisas que estavam empilhadas no mesmo elemento:

- o `<button>` continua com **44px de altura**, porque é ele que o dedo acerta;
- a **pista** virou um `::before` de 52×32, centrado dentro dele;
- o **botão** passou a se centrar por **porcentagem** (`top: 50%` +
  `margin-top: -13px`) em vez de um `top` fixo — assim nenhuma mudança de
  altura futura pode desalinhá-lo de novo, que foi exatamente como o defeito
  nasceu.

O cinza de desligado também mudou. O bege anterior (`--linha-forte`) dava
**2,1:1** contra o papel e lia como *desabilitado*, não como *desligado* —
abaixo dos **3:1** que a WCAG 1.4.11 pede para a borda de um controle. Agora
são 3,3:1 no claro e 3,8:1 no escuro.

O estado não depende só da cor: o botão anda de um lado ao outro, e cada
chave é um `role="switch"` com `aria-checked`.

### Um detalhe do teste que vale guardar

A primeira versão do teste lia a cor logo depois de trocar a classe e via os
dois estados **idênticos**. A pista tem `transition`, e o navegador devolve o
valor *de partida* da animação enquanto ela corre. Ou se espera a transição
terminar, ou se desliga a transição antes de medir — o teste faz as duas
coisas, conforme o caso.

## A leitura virou uma folha

Medido no navegador, tela de 390×844, capítulo aberto e rolagem no topo:

| | antes | agora |
|---|---|---|
| Antes do primeiro versículo | **640 px** | **166 px** |
| Da primeira tela era mobília | **76%** | **20%** |
| Versículos visíveis | **2** | **6** |

Os 640px eram: barra azul (58), busca com dois seletores (258), barra de
ferramentas (34), rótulo de seção (59), barra de progresso (103), cabeçalho
do capítulo (68) e um comprimido azul de "Ouvir o capítulo" (60) — o objeto
mais saturado da tela, mais alto que a própria Escritura, entre o título e o
texto.

### Nada foi removido: sai de cena

`html[data-lendo="1"]`, posto por `mostrarNivelDireto`, troca o app pela
folha enquanto se lê um capítulo, e sai ao voltar para a lista. A barra azul
dá lugar a um cabeçalho de 48px cor de papel; a busca, os seletores, o rótulo
e a barra de progresso recuam. As abas ficam — perder a navegação custaria
mais do que os 59px que ela ocupa.

O capítulo passa a repousar numa folha (`#FFFEFC` no claro, `#1C2129` no
escuro) sobre uma mesa um tom mais funda, com sombra e sem cantos
arredondados — canto redondo faria parecer cartão, não papel.

### O cabeçalho da leitura

`‹ João` diz **para onde se volta**, não "voltar". À direita, três botões de
44px: a **lupa**, o **Ouvir** e o **Aa**.

- A **lupa** traz de volta só a barra de busca — os seletores e a barra de
  ferramentas continuam guardados, senão os 258px voltavam junto. As
  sugestões e as buscas recentes funcionam ali dentro.
- O **Ouvir** aciona o mesmo botão que estava no capítulo, em vez de duplicar
  a lógica de montar as partes da voz.
- O **Aa** dá a volta na escala em vez de parar no maior: com um botão só,
  parar no topo deixaria o botão morto.

O progresso do capítulo deixou de ser um bloco de 103px e virou um **fio de
2px** no pé do cabeçalho. Capítulo que cabe inteiro na tela não mostra fio
nenhum: ali não há progresso, e um filete cheio pareceria borda.

### Os números na margem

`.v` ganha `padding-left` e o `sup` vai para `position: absolute` na margem
esquerda. É isso que dá a borda reta da mancha de texto — há teste conferindo
que os versículos começam **todos na mesma coluna**, tenham número de um, dois
ou três dígitos.

A versão da Bíblia saiu de baixo do título e foi para o pé da folha: é
crédito, não cabeçalho.

### Três defeitos que apareceram no caminho

**O `‹` cortado.** O cabeçalho vive dentro do cartão, que já é sangrado até a
borda da tela; puxá-lo de novo com margem negativa jogava o chevron para fora.

**Buscar de dentro da leitura parecia quebrado.** `#sec-busca` estava na
lista do que a folha esconde, então uma busca por palavra não mostrava nada.
Agora `buscarPalavra` desliga o `data-lendo` — quem busca deixou de estar
lendo — e a seção não é mais escondida.

**O "Ouvir o capítulo" escondido era mentira.** Escondê-lo com `display:none`
e proxiar o clique pelo cabeçalho deixava o controle de verdade inalcançável
por toque e fora da árvore de acessibilidade. Ele desceu para o **pé** do
capítulo, visível e real, onde não fica entre o título e a primeira palavra.

### O que custou

A barra de ferramentas fica guardada enquanto se lê, e com ela o botão do
**mapa** — ele continua alcançável pela lista de livros, um toque atrás. E o
menu lateral, que morava na barra azul, também fica um nível acima.

## Continuar a leitura livre

Medido: rolar até o meio de um capítulo, sair e voltar devolvia a pessoa ao
**topo** — e não havia nada guardado no aparelho sobre onde ela estava.

O cartão "Continuar de onde parou", da tela inicial, só aparece com um plano
em andamento (`planoEmAndamento`). Quem lê por conta própria — que é como a
maioria usa uma Bíblia — fechava o app no meio de Salmos 119 e no dia
seguinte recomeçava procurando o lugar com o olho.

### O que fica guardado é o versículo, não o pixel

`lampada-leitura-parou` guarda `{nr, cap, verso, data}`. Altura de rolagem
não sobrevive a mudar o tamanho da letra, girar o aparelho ou trocar de
versão da Bíblia; versículo sobrevive a tudo isso. Há teste que muda `--esc`
para 1,3 e confere que a parada não se mexe.

O versículo anotado é **o primeiro cujo fundo já passou do cabeçalho** — o
que a pessoa está lendo, não o que está entrando na tela por baixo. A
gravação é adiada em 400ms, senão rolar seria uma escrita no disco por pixel.

**O versículo 1 não é uma parada.** Estar no começo do capítulo não é ter
parado no meio de nada, então voltar ao topo apaga o registro em vez de
gravar "você parou no início".

**Sair da leitura desliga a anotação** (`capituloNaTela = null`), senão
rolar a lista de capítulos gravaria um versículo que ninguém está lendo.

### Voltar ao ponto, mas nunca em silêncio

Reabrir o mesmo capítulo rola até o versículo guardado — e mostra
**"Voltamos ao versículo 25"** com um **Ir ao início**. Rolar sozinho para o
meio de um texto assusta se nada explicar; o aviso diz o que aconteceu e
oferece o outro caminho.

Quem chega por link compartilhado ou por busca traz um `destacar`, e aí o
destaque manda: ninguém que abriu "João 3:16" quer cair no versículo 25.

## A busca que lembra

Toda busca começava numa caixa em branco. Para reler um versículo era
preciso lembrar a grafia exata — os acentos de "Gênesis", o espaço de
"1 Coríntios", se é "Eclesiastes" ou "Eclesiástico" — e digitar tudo de
novo. É a heurística 6 de Nielsen: **reconhecer em vez de lembrar**. Quem lê
a Bíblia volta aos mesmos lugares, e o app não guardava nenhum deles.

Duas coisas, no mesmo lugar e nunca ao mesmo tempo:

| estado do campo | o que aparece |
|---|---|
| vazio | as últimas oito buscas, como atalho de um toque |
| digitando | os livros que casam com o que já foi escrito |

### As sugestões

Começo de nome vem antes de "contém": quem escreve `jo` quer João, não Josué
no meio de uma lista alfabética. O pedaço já digitado sai em negrito, para
mostrar **por que** aquele item está ali — a comparação é sem acento dos dois
lados, senão nenhum livro acentuado ficava marcado.

Digitar um número vira sugestão de capítulo: `joão 3` oferece **João 3**. Um
capítulo que não existe (`judas 40`) não é oferecido, mas o livro continua na
lista, porque ainda é uma resposta útil.

E quando nada casa, a última sugestão é **Buscar "…" no texto** — a busca por
palavra era a função menos descoberta do app, porque nada na tela dizia que
ela existia.

Tudo navegável pelo teclado: `↓`/`↑` andam pela lista, `Enter` abre o item
marcado (ou busca o que está escrito, se não houver marca), `Esc` fecha. O
foco nunca sai do campo — quem marca um item é o `aria-activedescendant`,
que é o que permite continuar digitando.

### O Esc que apagava o campo

`#busca` é `<input type="search">`, e nesse tipo de campo o Chrome apaga o
texto quando se aperta Esc. Com a lista de sugestões aberta isso é perda:
quem aperta Esc quer dispensar a sugestão, não jogar fora o que acabou de
digitar. Então o Esc fecha a lista e chama `preventDefault()`; com a lista
já fechada, o comportamento normal do navegador continua valendo.

### As recentes

Guardadas só quando a busca **de fato acontece** — registrar a cada tecla
encheria a lista de metades de palavra. Repetir uma busca não duplica: ela
sobe para o topo. Buscas de uma letra não entram. O limite é oito, e há um
**Limpar** no fim da faixa.

Todas as portas passam por `BuscaMemoria.executar`, para o registro nunca
depender de quem chamou — atalho, sugestão, botão, Enter ou ditado.

A lista fica no aparelho (`lampada-buscas`) e **não é sincronizada com a
conta**: o que alguém procura na Bíblia diz mais do que o que ele marcou.
Uma lista corrompida no `localStorage` é filtrada em vez de derrubar o app —
o que presta continua aparecendo.

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

### "Aperto para falar e ele não ouve"

Três causas diferentes davam esse mesmo sintoma.

**1. O cabeçalho do servidor barrava o microfone da própria origem.**
`Permissions-Policy: microphone=()` não fecha o microfone só para terceiros:
fecha para o site também. Está corrigido para `microphone=(self)` — mas o
conserto ficou seis dias sem chegar à produção, preso atrás de um build que
falhava por outro motivo (o cron de hora em hora). Nenhum deploy passou
nesse intervalo, então o cabeçalho velho continuou no ar.

No Chrome esse cabeçalho **some com o botão**, porque `document.featurePolicy`
deixa perguntar antes. Safari e Firefox não têm essa API: lá o botão
aparecia, a pessoa tocava, e o navegador recusava calado.

**2. O aviso "Pode falar…" vinha antes de o microfone abrir.**
`rec.start()` não abre o microfone quando retorna — o navegador ainda vai
pedir permissão e ligar o áudio, o que leva de décimos de segundo a vários
segundos na primeira vez. Quem obedecia ao aviso e falava na hora era,
literalmente, não ouvido.

Agora o toque mostra **"Abrindo o microfone…"**, e só quando o navegador
confirma a captação (`audiostart`, ou `start` em quem não dispara o
primeiro) é que aparece **"Pode falar…"**.

**3. Parar parecia erro.** Tocar no botão de novo dispara `aborted`, que
caía no genérico "Não deu para ouvir agora". Cancelar não é falhar.

### Cada recusa diz o que fazer

| Erro | Mensagem |
|---|---|
| `no-speech` | Não ouvi nada. Toque de novo e fale. |
| `audio-capture` | Não achei um microfone neste aparelho |
| `network` | O ditado precisa de internet para funcionar |
| `not-allowed`, permissão **negada** | O microfone está bloqueado para este site. Libere nas permissões do navegador. |
| `not-allowed`, permissão **não negada** | O microfone foi bloqueado. Se acabou de permitir, recarregue a página. |
| `aborted` por toque nosso | (nenhuma) |

A distinção nas duas últimas linhas importa: o navegador manda o mesmo
`not-allowed` nos dois casos, mas mandar "libere o microfone" para quem já
liberou é inútil — e era exatamente a situação em produção, onde quem
barrava era o cabeçalho do próprio site. `navigator.permissions.query`
resolve a dúvida onde existe; onde não existe, a mensagem fica na versão
que não acusa a pessoa.

Sobre `network`: o ditado do Chrome manda o áudio para o servidor de fala do
navegador. É a única parte do app que **não funciona offline**, e agora ela
diz isso em vez de falhar em silêncio.

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
| `CRON_SECRET` | **obrigatório** — é ele que autoriza o relógio de hora em hora |

3. Faça um **Redeploy** na Vercel
4. No site → **Instalar app** → **Ativar lembrete diário**

### Os dois tetos da conta Hobby

O plano grátis da Vercel impõe dois limites que já derrubaram o deploy aqui.
Ambos recusam o **build inteiro**, não só a parte que passou do limite:

**Um cron por dia.** Ver a seção abaixo.

**No máximo 12 Serverless Functions.** E a Vercel faz uma função de *cada*
arquivo `.js` dentro de `api/`, inclusive dos que são só biblioteca. Com
`api/lib/` ali dentro eram 14 — e, de quebra, `/api/lib/store` virava uma
rota pública que ninguém jamais pensou como endpoint.

Por isso as bibliotecas moram na **raiz, em `lib/`**, e os endpoints as
alcançam por `require('../lib/…')`. A Vercel só transforma em função o que
está em `api/`; o resto vem junto no pacote porque o build rastreia os
`require`. Hoje são 10 funções, com folga de duas.

Se um dia precisar de mais de 12, dá para juntar endpoints parecidos num só
com um parâmetro de rota (`subscribe`/`unsubscribe`/`vapid-public` são
candidatos naturais) — ou assinar o Pro.

O `teste16.js` conta os arquivos de `api/` e falha antes do deploy.

### Quem chama o envio, e por que não é a Vercel

O lembrete respeita o fuso de cada pessoa, e 8h da manhã acontece 24 vezes
no mundo. Logo, o envio precisa ser chamado **de hora em hora**, entregando
a cada passada só à fatia que está na hora escolhida.

O cron da Vercel não pode fazer isso aqui. Conta **Hobby aceita um cron por
dia** e recusa o deploy inteiro com qualquer coisa mais frequente:

```
Hobby accounts are limited to daily cron jobs. This cron expression
(0 * * * *) would run more than once per day.
```

Então o relógio mudou-se para o **GitHub Actions**
(`.github/workflows/lembrete.yml`), que roda `5,35 * * * *` e bate no mesmo
`/api/daily-push` com o `CRON_SECRET` no cabeçalho. O cron do `vercel.json`
continua lá, uma vez por dia, como rede de segurança.

**Falta um passo manual:** o workflow precisa do segredo no repositório —
*Settings → Secrets and variables → Actions → New repository secret*, nome
`CRON_SECRET`, com o mesmo valor que está na Vercel. Sem ele o endpoint
devolve 401 e o workflow falha de propósito, dizendo o que fazer, em vez de
rodar em silêncio sem entregar nada.

(Assinar o plano Pro da Vercel também resolve, e aí basta devolver o
`0 * * * *` ao `vercel.json` e apagar o workflow.)

### A janela de recuperação

O cron do GitHub não é pontual: atrasa quando a fila está cheia e às vezes
pula uma execução. Se "está na hora" fosse igualdade exata, um atraso de
cinco minutos passando das 8h para as 9h custaria o lembrete do dia inteiro.

Por isso a janela é de três horas — a escolhida e as duas seguintes
(`TOLERANCIA_HORAS` em `lib/agenda.js`). Mandar 9h20 quando a pessoa
pediu 8h é uma imprecisão; não mandar é um lembrete perdido, que num produto
de hábito diário é bem pior.

Isso só é seguro porque **quem garante a entrega única é a trava no Redis**
(`marcarEnvio`, uma chave por assinante e por data local, com 48h de
validade). A janela escolhe até três vezes, a trava entrega uma — as outras
duas voltam contadas como `repetidos`. O `teste16.js` prova ponta a ponta:
três passadas seguidas, `sent: [1, 0, 0]`, uma notificação no aparelho.

A janela **não dá a volta na meia-noite**, de propósito. Com resto de 24,
quem escolhesse 23h seria pego de novo à 0h e à 1h — outra data local, trava
nova, e uma segunda notificação de madrugada com o versículo do dia
seguinte. O atraso só conta para frente e dentro do mesmo dia.

### A notificação traz o versículo do dia

Trazia outro. Eram duas listas independentes — 15 referências na função de
servidor e as 180 do devocional — então quem tocasse no lembrete abria o
app e via coisa diferente do que tinha acabado de ler na tela de bloqueio.
Todo dia, sem exceção.

A lista agora vive em `lib/versiculos.js`, cópia da que o app usa. Está
repetida porque o app é um arquivo único e a função de servidor não importa
de dentro dele — e a cópia é **presa por teste**: a suíte compara as duas
listas item por item e simula os 366 dias do ano conferindo se os dois
lados escolhem o mesmo versículo.

O nome do livro sai da nossa tabela, não do `book_name` que a API devolve.
E se a Bíblia estiver fora do ar, o lembrete ainda sai dizendo a referência
("O devocional de hoje está em Salmos 34:10") — a referência é nossa e não
depende de rede.

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
