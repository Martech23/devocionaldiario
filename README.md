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
