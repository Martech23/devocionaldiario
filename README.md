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

### Na imagem, o endereço vai desenhado

Legenda não sobrevive ao reencaminhamento. A imagem passa adiante sozinha,
e quem a recebe de terceira mão não teria como saber de onde veio. Por
isso o domínio é **escrito no rodapé da imagem**, além de ir na legenda.

Ele tem cor própria, mais firme que a do crédito da foto: com a tinta de
enfeite, sobre os dois fundos que têm desenho — a oliveira e o pergaminho
— o endereço ficava em **3,6:1**, abaixo dos 4,5 da WCAG AA. Endereço é
para ser lido e digitado.

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

### A notificação traz o versículo do dia

Trazia outro. Eram duas listas independentes — 15 referências na função de
servidor e as 180 do devocional — então quem tocasse no lembrete abria o
app e via coisa diferente do que tinha acabado de ler na tela de bloqueio.
Todo dia, sem exceção.

A lista agora vive em `api/lib/versiculos.js`, cópia da que o app usa. Está
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
