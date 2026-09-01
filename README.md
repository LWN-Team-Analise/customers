# Customers

Portal de clientes — front-end em React + Vite.

## Rodando

Precisa de **Node 18+** e **PostgreSQL** rodando na maquina.

```bash
npm install
cp .env.example .env      # e preencha as credenciais do banco
```

Depois abra **dois terminais**:

```bash
npm run api               # API + banco, em http://localhost:3001
```

```bash
npm run dev               # front, em http://localhost:5173
```

O Vite faz proxy de tudo que comeca com `/api` para a API (vale no `dev` e no
`preview`), entao o front nao precisa saber a porta do backend.

| Script              | O que faz                                              |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | front em desenvolvimento (HMR)                         |
| `npm run api`       | API Express + PostgreSQL                               |
| `npm run build`     | build de producao em `dist/`                           |
| `npm run preview`   | serve o build gerado                                   |
| `npm run db:senha`  | gera o hash bcrypt de uma senha                        |
| `npm run db:validar`| roda o SQL num banco descartavel e confere tudo        |

## A foto do lado esquerdo

O painel esquerdo usa `public/assets/login.webp`. Para trocar a imagem, basta
substituir esse arquivo (ou editar `.hero__photo` em
`src/pages/Login/Login.css`). Se o arquivo sumir, entra automaticamente o
fallback `public/assets/lab-placeholder.svg` — nada quebra.

As cinco faixas sao **janelas recortadas sobre a mesma foto**: cada
`.hero__slice-photo` se dimensiona pelo bloco `.hero__slices` (nao pela faixa),
entao os pedacos ficam alinhados e a imagem se le como uma so, vista atraves de
frestas. O recorte vem de `clip-path` — que, ao contrario de `overflow`, corta
filhos posicionados sem virar containing block deles.

**Por isso nenhuma faixa pode receber `transform`**: um transform tornaria a
faixa o containing block da foto e quebraria o alinhamento. O respiro vertical
(`slice-breathe`) anima `height`, nao `scaleY`.

## Banco de dados

PostgreSQL. As credenciais ficam no `.env` (fora do git):

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=TrajetoClientes
```

O schema esta em **quatro arquivos, nesta ordem**:

| Arquivo                  | O que cria                                                      |
| ------------------------ | --------------------------------------------------------------- |
| `db/usuario.sql.txt`     | o banco, a tabela `usuario`, as travas e o usuario inicial       |
| `db/sistema.sql.txt`     | cargos, clientes, obras, observacoes e avaliacoes                 |
| `db/quadro.sql.txt`      | o roteiro (etapas, cards, checks), `obra_check` e a senha padrao  |
| `db/atualizacao.sql.txt` | permissoes, chat, etiquetas, anexos, notas, avisos lidos e senha  |

Rode o primeiro na ordem indicada dentro dele; depois rode os outros tres
inteiros, conectado ao banco `TrajetoClientes`. Os tres ultimos sao
**idempotentes**: podem rodar de novo sem quebrar nada do que ja existe.

### O que `db/atualizacao.sql.txt` acrescenta

Nada e apagado — o arquivo so **acrescenta**:

- `cargo.permissoes`: a lista de permissoes de cada cargo;
- `obra.data_inicio`, `obra.data_conclusao` e `obra.atualizado_por`
  (a `data_prevista` continua na tabela so para nao perder o historico);
- `etiqueta` + `obra_etiqueta`: os rotulos das obras;
- `obra_anexo`: os documentos da obra;
- `obra_chat` + `obra_chat_mencao`: a conversa de cada obra;
- `obra_avaliacao_item`: as varias notas por obra (diretor, cliente, ...) —
  `obra_avaliacao` passa a guardar a **media** delas, mantida por gatilho;
- `vigente_de` / `vigente_ate` em `etapa`, `etapa_card` e `etapa_check`:
  e o que faz o roteiro andar so para a frente (ver *As cinco etapas*);
- `aviso_leitura`: quem ja abriu qual aviso — e o selo do sininho;
- `senha_codigo`: o codigo do "esqueci minha senha";
- `usuario.outlook_email` / `outlook_id`: o vinculo com a conta Microsoft.

> **Depois de rodar:** todo cargo **sem acesso total** fica com *zero*
> permissoes, e quem estiver nele nao ve nenhuma aba do menu. Isso e de
> proposito (o padrao pedido), mas quer dizer que a primeira coisa a fazer
> e abrir **Usuarios > Cargos** e marcar as permissoes de cada um. Os
> cargos com `acesso_total` ja saem do SQL com a lista cheia, entao a
> diretoria nunca fica trancada do lado de fora.

O **roteiro de fabrica** (as 5 etapas com os cards e os checks) nao vem no SQL:
quem planta e a API, em `server/roteiro.js`, na primeira vez que ela sobe. E
assim porque os titulos tem acento, e colar acento no psql do Windows depende do
code page do terminal. Depois de plantado, o roteiro e seu: o que voce criar ou
apagar pela tela fica, e subir a API de novo nao mexe em nada.

Ele tambem liga a tabela `usuario` a de cargos: acrescenta `cargo_id` e `foto`,
e preenche o `cargo_id` a partir do texto que ja esta em `usuario.cargo`
(ignorando maiuscula e acento). Quem ja estava cadastrado nao precisa ser
recadastrado.

No fim do arquivo ha um **modelo pronto de INSERT** para cadastrar pessoas na
mao (nome, CPF, e-mail, telefone e cargo), com a senha padrao `123456` ja
convertida em hash. Sao os mesmos campos do formulario *Adicionar
colaborador* — a tela nao pede nada que a tabela nao tenha.

A **secao 13** cria a view `obra_conclusao`, que a tela Concluidas usa para
agrupar por ano e mes. Ela nao precisa de coluna nova: a data de conclusao e o
carimbo da ultima tarefa marcada, que o gatilho da secao 5 ja grava. Se voce ja
rodou o arquivo antes, da para rodar so essa secao.

Para conferir sem tocar no banco de verdade:

```bash
npm run db:validar
```

Ele cria um banco descartavel, roda **os dois scripts**, testa as restricoes, a
protecao do usuario id=1, os gatilhos, a media das avaliacoes e as consultas que
a API usa — e apaga o banco no fim.

### Usuario protegido

O registro `id = 1` tem `protegido = true`: um gatilho recusa `UPDATE` e
`DELETE` nele. A unica excecao automatica e o carimbo de `ultimo_acesso`, para o
login conseguir registrar o acesso. Para mexer de proposito, destrave na
propria transacao:

```sql
BEGIN;
  SET LOCAL app.desbloqueio = 'on';
  UPDATE usuario SET telefone = '(11) 99999-9999' WHERE id = 1;
COMMIT;
```

## Login

O campo de acesso aceita **e-mail ou CPF** (CPF validado pelos dois digitos
verificadores, guardado so com digitos). A senha e conferida com bcrypt na API.

Senha padrao do sistema: `123456`.

| Rota da API                     | O que faz                                    |
| ------------------------------- | -------------------------------------------- |
| `POST /api/auth/login`          | recebe `{ identifier, password }`            |
| `GET /api/auth/me`              | devolve o usuario do token (Bearer)          |
| `GET /api/health`               | diz se o banco responde e se a tabela existe |
| `GET /api/equipe/cargos`        | lista os cargos com nome, sigla e cor        |
| `POST /api/equipe/cargos`       | cria um cargo                                |
| `PATCH /api/equipe/cargos/:id`  | edita nome, sigla, cor ou acesso total       |
| `DELETE /api/equipe/cargos/:id` | apaga (recusa cargo fixo ou em uso)          |
| `POST /api/auth/senha`          | troca a propria senha (sai da senha padrao)  |
| `POST /api/auth/recuperar`      | manda o codigo de 6 digitos por e-mail       |
| `POST /api/auth/codigo`         | confere o codigo e libera a troca            |
| `POST /api/auth/redefinir`      | grava a senha nova                           |
| `GET /api/auth/outlook/config`  | diz se o login com Outlook esta configurado  |
| `POST /api/auth/outlook/entrar` | entra com a conta Microsoft ja vinculada     |
| `POST /api/auth/outlook/vincular` | vincula a conta Microsoft ao usuario logado |
| `GET /api/equipe/usuarios`      | equipe com cargo, cor e media das avaliacoes |
| `POST /api/equipe/usuarios`     | cadastra colaborador com a senha padrao 123456 |
| `PATCH /api/equipe/usuarios/:id` | edita o cadastro (CPF so pela diretoria)    |
| `DELETE /api/equipe/usuarios/:id` | desativa o acesso (o historico fica)       |
| `GET /api/dados`                | clientes, obras, checks, observacoes, avisos |
| `POST/PATCH/DELETE /api/dados/clientes` | cadastro de cliente                  |
| `POST/PATCH/DELETE /api/dados/obras` | cadastro de obra                        |
| `PUT/DELETE /api/dados/obras/:id/checks/:ck` | marca/desmarca um check        |
| `POST /api/dados/obras/:id/observacoes` | observacao da obra                   |
| `POST /api/dados/observacoes`   | observacao do quadro (vale para o geral)     |
| `POST /api/dados/obras/:id/avisos` | aviso aos setores pendentes               |
| `POST /api/dados/obras/:id/avaliacoes` | acrescenta uma nota (diretor, cliente...) |
| `PATCH/DELETE /api/dados/avaliacoes/:id` | edita ou tira uma nota                |
| `DELETE /api/dados/obras/:id/avaliacao` | tira todas as notas da obra            |
| `POST /api/dados/avisos/lidos` | marca avisos como lidos (zera o sininho)     |
| `GET/POST /api/dados/obras/:id/chat` | a conversa da obra                     |
| `POST /api/dados/obras/:id/etiquetas` | marca a obra com uma etiqueta         |
| `POST /api/dados/obras/:id/anexos` | anexa um documento a obra                |
| `GET /api/dados/anexos/:id`     | baixa o conteudo de um anexo                 |
| `GET /api/roteiro`              | o roteiro inteiro: etapas > cards > checks   |
| `POST/PATCH/DELETE /api/roteiro/etapas` | etapas (permissao `editar_etapa`)   |
| `POST/PATCH/DELETE /api/roteiro/cards`  | cards, com 1..N cargos cada         |
| `POST/PATCH/DELETE /api/roteiro/checks` | checks de um card                    |

As rotas do roteiro aceitam um `obraId` (no corpo, ou na query nos DELETE):
e ele que diz **a partir de qual obra** a mudanca vale. Ver *As cinco etapas*.

### Permissoes

Cada cargo tem uma lista de chaves em `cargo.permissoes`. A lista mora em
`src/domain/permissoes.js` — **um arquivo so, usado pelos dois lados**: a tela
esconde o botao e a API recusa a chamada usando exatamente as mesmas chaves.

| Grupo        | Chaves                                                              |
| ------------ | ------------------------------------------------------------------- |
| Visualizacao | `ver_inicio`, `ver_obras`, `ver_clientes`, `ver_concluidas`, `ver_avaliacoes`, `ver_avisos` |
| Alteracao    | `editar_usuario`, `editar_cargo`, `editar_avaliacoes`, `editar_clientes`, `editar_obras`, `check_todas_etapas`, `editar_etapa`, `editar_cards`, `editar_cargos_card`, `editar_checks`, `enviar_avisos` |

Alteracao **sempre** depende da visualizacao correspondente: desmarcar "Obras"
apaga junto tudo o que so faz sentido dentro de Obras, e essas linhas ficam
travadas ate a visualizacao voltar. Quem tem `acesso_total` (diretoria) passa
por qualquer uma, marcada ou nao.

### E-mail e Outlook

O "esqueci minha senha" manda um codigo de 6 digitos que vale **3 minutos**. So
o hash do codigo e guardado, e o passo 1 responde a mesma coisa exista ou nao a
conta — nao entrega quem esta cadastrado. As credenciais do remetente vao no
`.env` (`MAIL_USUARIO`, `MAIL_SENHA`); se a conta tiver verificacao em duas
etapas, gere uma **senha de aplicativo** no portal da Microsoft.

O login com Outlook usa o fluxo padrao da Microsoft e precisa de um aplicativo
registrado no Entra ID (`OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`,
`OUTLOOK_TENANT`), com `http://localhost:5173/outlook` como redirect URI. Sem
isso, a tela mostra o recado no lugar do botao e o resto do sistema continua
igual. O vinculo casa pelo **e-mail**: a conta Microsoft tem que ser a mesma do
cadastro — e por isso que o e-mail nao se altera mais pela tela do usuario.

O login devolve tambem o cargo do usuario (chave, nome, cor e `acessoTotal`) —
e dai que sai a trava de quem edita o que. Se `db/sistema.sql.txt` ainda nao
tiver sido rodado, a consulta cai numa versao sem cargo e o login continua
funcionando.

As rotas de `/api/equipe` exigem sessao (Bearer) e devolvem **503** com uma
mensagem clara enquanto o SQL nao for rodado — o front trata isso como "sem
banco" e usa os dados locais, sem quebrar nada.

Usuario e senha errados devolvem a mesma mensagem, de proposito: nao entrega a
quem tenta adivinhar qual e-mail existe no sistema.

## Estrutura

```
src/
├── assets/                 # imagens importadas pelo bundler
├── components/
│   ├── AppShell/           # barra lateral (icone + descricao) + barra superior
│   ├── Avatar/             # foto redonda de pessoa/empresa (cai nas iniciais)
│   ├── Button/             # botao primario, azul solido
│   ├── Campo/              # campos de form: texto, area, selecao, pastilhas, foto
│   ├── CookieConsent/      # aviso de cookies + leitura do consentimento
│   ├── GlassCard/          # superficie liquid glass (blur + refracao + brilho)
│   ├── LiquidGlass/        # filtros SVG (refracao e ruido)
│   ├── Confirma/           # confirmacao de exclusao (no lugar do window.confirm)
│   ├── Modal/              # pop-up opaco (Esc, clique fora, rolagem travada)
│   ├── SocialRow/          # entrar com Outlook
│   ├── TextField/          # campo com label flutuante (login)
│   └── ThemeToggle/        # botao lua/sol, fixo no canto superior direito
├── context/
│   ├── AuthContext.jsx     # sessao, login, logout, persistencia
│   ├── DadosContext.jsx    # obras, clientes, cargos, equipe e avaliacoes
│   └── ThemeContext.jsx    # tema claro/escuro (padrao: claro)
├── domain/obras.js         # setores, prioridades, as 5 etapas, avanco e permissao
├── hooks/
│   ├── usePointerGlow.js   # brilho especular que segue o ponteiro
│   ├── useCorDaLogo.js     # cor predominante da logo do cliente
│   └── useMediaQuery.js    # troca de layout desktop/mobile
├── pages/
│   ├── Avaliacoes/         # nota por obra; a do usuario e a media
│   ├── Clientes/           # cadastro de clientes (CEP + IBGE)
│   ├── Concluidas/         # fechadas, agrupadas por ano e mes
│   ├── Configuracoes/      # editar a propria conta e o tema
│   ├── Home/               # resumo apos o login
│   ├── Login/              # tela de login (foto + faixas de vidro + cartao)
│   ├── Obras/              # quadro, card, modais e a tela da obra
│   ├── Privacy/            # politica de privacidade (texto provisorio)
│   └── Usuarios/           # equipe por cargo + cadastro de cargos
├── routes/                 # rotas e guarda de rota
├── services/
│   ├── authService.js      # camada de autenticacao
│   ├── api.js              # o jeito unico de falar com a API (token, erros)
│   ├── dadosService.js     # clientes, obras, checks e observacoes via /api/dados
│   ├── roteiroService.js   # etapas, cards e checks via /api/roteiro
│   ├── equipeService.js    # cargos e usuarios via /api/equipe
│   └── enderecoService.js  # ViaCEP + IBGE (estados e cidades)
├── utils/
│   ├── corDaImagem.js      # cor predominante de uma imagem
│   ├── formato.js          # datas, CEP, iniciais, cor a partir do nome
│   └── pessoa.js           # saudacao pelo horario, iniciais, primeiro nome
└── styles/                 # tokens, pecas comuns e estilos globais

server/
├── index.js                # API Express
├── db.js                   # pool do PostgreSQL
├── sessao.js               # token, "exige sessao" e traducao de erro do Postgres
├── roteiro.js              # o roteiro de fabrica; planta sozinho na 1a subida
├── routes/auth.js          # login, sessao e troca de senha
├── routes/equipe.js        # cargos e usuarios
├── routes/dados.js         # clientes, obras, checks, observacoes, avisos, notas
├── routes/roteiro.js       # etapas, cards e checks (o roteiro das obras)
└── scripts/                # gerar hash de senha, validar o SQL

db/
├── usuario.sql.txt         # PARTE 1: banco, tabela usuario, travas
├── sistema.sql.txt         # PARTE 2: cargos, clientes, obras, avaliacoes
└── quadro.sql.txt          # PARTE 3: roteiro, obra_check, senha provisoria
```

## Rotas

| Rota                        | Tela                     | Acesso    |
| --------------------------- | ------------------------ | --------- |
| `/login`                    | Login                    | publico   |
| `/politica-de-privacidade`  | Politica de privacidade  | publico   |
| `/app`                      | Pagina inicial (resumo)  | protegido |
| `/app/obras`                | Quadro de obras          | protegido |
| `/app/obras/:id`            | Tela da obra (5 etapas)  | protegido |
| `/app/clientes`             | Clientes                 | protegido |
| `/app/concluidas`           | Obras concluidas         | protegido |
| `/app/avaliacoes`           | Avaliacoes da equipe     | protegido |
| `/app/usuarios`             | Usuarios                 | protegido |
| `/app/configuracoes`        | Configuracoes (esboco)   | protegido |

Sem sessao, `/app` redireciona para `/login`. Ao entrar, o usuario volta para a
rota que tentou acessar (ou `/app`).

A barra lateral repete essa ordem, com o icone e a descricao de cada tela. Ela e
uma **bolha de vidro flutuante**, centralizada na vertical, e leva *so* os itens
de navegacao — a logo fica solta no canto superior esquerdo e o avatar no canto
inferior esquerdo, os dois fora dela. Clicando no avatar abrem-se
**Configuracoes** e **Sair**.

## Obras

Uma obra pertence a um cliente e nasce **padrao** (card ciano) ou
**emergencia** (card laranja/vermelho). O quadro tem tres colunas: obras padrao,
obras emergencia e *enviar aviso* — esta ultima lista so as obras que tem setor
devendo informacao, com um botao por setor e um **Todos** que avisa todos os
pendentes daquela obra. O `+` do cabecalho dessa coluna avisa todas as obras de
uma vez.

O card mostra a logo da empresa, o nome, a etapa atual, a descricao, a
prioridade com a data prevista e as fotos de quem mexeu na obra. As etiquetas
`[tec] [gq]` no canto superior direito sao os setores que ainda devem
informacao na etapa atual.

### As cinco etapas

| Etapa | Setores envolvidos                        |
| ----- | ----------------------------------------- |
| 1ª    | Comercial                                 |
| 2ª    | Tecnico, ADM, GQ, Excelencia              |
| 3ª    | Tecnico, GQ, Excelencia, Comercial        |
| 4ª    | GQ, Comercial, ADM                        |
| 5ª    | Comercial, ADM, GQ, Excelencia            |

Cada setor tem um roteiro de tarefas dentro da etapa (`src/domain/obras.js`). O
setor fecha quando marca todas as suas tarefas; a etapa fecha quando **todos**
os setores dela fecharam. As cinco etapas deslizam na horizontal, com o painel
de **Observacoes** fixo a direita.

**Como as etapas abrem depende do tipo da obra:**

- **Padrao** — fila. So a etapa atual aceita marcacao; as seguintes ficam com
  cadeado ate a anterior fechar.
- **Emergencia** — as cinco ja nascem liberadas. Numa emergencia ninguem espera
  a etapa anterior fechar para agir.

Uma observacao guarda o nome de quem escreveu, a nota dessa pessoa, o texto e o
carimbo de data/hora. Cada um edita e apaga so a **propria** observacao; quando
edita, o card mostra "editada" no rodape. Obra com as etapas fechadas sai do
quadro e vai para **Concluidas**.

**O roteiro anda so para a frente.** Mexer no roteiro dentro de uma obra vale
para **ela e para as proximas** — nunca para as que ja passaram. Uma obra
fechada em marco nao pode ganhar um check novo em maio e voltar a aparecer como
pendente.

Como isso funciona: cada peca (etapa, card, check) tem uma janela de vigencia —
`vigente_de` e `vigente_ate`. Uma obra criada em X enxerga a peca quando
`vigente_de <= X < vigente_ate`. Criar dentro da obra X carimba `vigente_de`
com a data de nascimento de X; excluir carimba `vigente_ate` com a mesma data
(nada e apagado de verdade, senao o historico das obras antigas iria junto).
Depois de filtrar, as etapas sao **renumeradas dentro da propria obra**: se a 2a
saiu do roteiro em maio, a obra de junho ve a antiga 3a como a sua 2a.

Renomear uma etapa, um card ou um check continua valendo para todas: e a mesma
peca, so mudou o rotulo.

### Chat, etiquetas e anexos

Cada obra tem **uma conversa propria**, gravada no banco. Abre pelo botao
*Abrir chat* (ao lado de Membros) ou pelo "+" do canto — e o mesmo chat. Da para
escrever, anexar arquivo, tirar foto pela camera, responder uma mensagem
especifica e mencionar alguem com `@`.

As **etiquetas** rotulam a obra: o botao *Adicionar etiqueta* fica sempre em
primeiro, as etiquetas ja postas logo abaixo, e o lapis de cada uma na direita —
e dentro da edicao que mora o Excluir. A etiqueta e do sistema: a mesma pode
marcar varias obras, e some da lista quando nao esta em nenhuma.

Os **anexos** guardam os documentos da obra (ate 4 MB cada). A lista que chega
com o quadro traz so nome, tipo e tamanho; o arquivo em si so e buscado no
clique de baixar — senao cada carregamento arrastaria todos os documentos de
todas as obras junto.

### Quem pode editar o que

Cada cargo mexe so nas tarefas do proprio setor: o ADM nao fecha tarefa do
Tecnico. O bloco do outro setor continua visivel (da para acompanhar), mas com
cadeado e as tarefas desabilitadas.

Tres saidas dessa regra:

- o cargo com **acesso total** (`cargo.acesso_total`, a diretoria);
- a permissao **check em todas as etapas**;
- obra de **emergencia** — ali ninguem espera o setor certo.

A regra vive em `podeEditarCheck()` de `src/domain/obras.js` e vale junto com a
trava de etapa: uma etapa que ainda nao abriu continua travada mesmo para a
diretoria.

### Cargos

Cargos sao cadastrados na tela **Usuarios** (botao *Adicionar cargo*): nome,
sigla, **cor** e a marca de acesso total. A cor escolhida ali pinta as
etiquetas `[tec] [gq]` do card, os blocos das etapas e as tarjas dos cards de
usuario — nao ha cor de setor fixa no CSS.

Os cinco cargos que as etapas usam (`fixo = true`) mudam de nome e de cor, mas
nao podem ser apagados. Cargo em uso por algum usuario tambem nao.

### Avaliacoes

A nota e **da obra**, nao da pessoa. Uma obra pode ter **varias notas** — a do
diretor e a do cliente sao as de sempre, e o "+" acrescenta outras. A **media**
delas e a nota da obra (no banco, `obra_avaliacao` guarda essa media, mantida
por gatilho a partir de `obra_avaliacao_item`).

O card da lista e enxuto de proposito: nome da empresa, se a obra e padrao ou
emergencia, a nota, e os rostos de quem participou. A tarja da esquerda leva a
cor da **empresa** — a mesma do card dela na aba Clientes. O resto (descricao,
datas, cada nota separada) abre no clique. Obra avaliada precisa ficar com ao
menos uma nota: para zerar tudo existe o *Remover avaliacao*.

**A nota de cada usuario e a media das obras avaliadas em que ele entrou** — 8
numa obra e 5 em outra dao 6.5. Ela aparece na tela de Usuarios. No banco isso e
a view `usuario_media`; no front, o `mediaDoUsuario()` do `DadosContext`.

### Concluidas

Obra com as cinco etapas fechadas sai do quadro e vai para **Concluidas**,
agrupada por **ano** (no topo, selecionavel) e por **mes** — cada mes ocupa a
linha inteira e mostra quantas fecharam, quantas eram emergencia e a nota media.
Clicando no mes, ele abre e lista as obras.

A data que agrupa e `obra.concluidaEm`, o carimbo do ultimo check marcado (e ela
some se alguem reabrir a obra). Quem calcula e a view `obra_conclusao`, no banco.

### Usuarios e cargos

**Adicionar colaborador** pede exatamente o que a tabela `usuario` guarda: foto,
nome, nascimento, CPF, e-mail, cargo e telefone. Passando o mouse pelo card
aparecem os botoes de editar e excluir.

Colaborador novo entra com a **senha padrao 123456** e com `senha_temporaria`
ligado: em Configuracoes > Senha o sistema cobra a troca. Excluir **desativa** o
acesso (`ativo = false`) em vez de apagar, para o historico das obras nao perder
quem marcou o que.

A lista filtra por **nome** (campo de busca, que tambem acha por e-mail) e por
**cargo** — e da para marcar mais de um cargo ao mesmo tempo.

O **CPF nao muda depois de cadastrado**: na edicao o campo fica travado e a rota
`PATCH /api/equipe/usuarios/:id` recusa o campo. Para trocar, apaga-se o
cadastro e faz-se um novo — do jeito que a coluna UNIQUE do banco espera.

**Cargos** abre a lista em uma linha so de etiquetas coloridas — ADM | GQ |
EXCELENCIA — que quebra quando chega no fim do pop-up. Clicar em uma delas ja
abre a edicao em OUTRO pop-up por cima, com **Excluir** ao lado de **Salvar**.

O "acesso total" de um cargo aparece SO no formulario dele. Em nenhuma outra
tela — nem no card da pessoa, nem na lista de setores — se diz quem tem.

### Onde os dados moram

**Tudo no banco, gravado na hora.** Nao ha botao de "salvar geral" nem copia no
`localStorage`: cliente, obra, check marcado, observacao, aviso, avaliacao,
cargo, colaborador e foto de perfil vao para o PostgreSQL no momento da acao.

Quem faz isso e o `DadosContext` (`src/context/DadosContext.jsx`), o unico lugar
que fala com a API. Cada acao muda a tela primeiro (para nao travar esperando a
rede) e grava em seguida; se o servidor recusar, o estado volta a ser o do banco
e o motivo aparece numa faixa vermelha no topo da tela.

O `localStorage` guarda so tres coisas, todas do navegador e nao do sistema: a
sessao (`customers.session`), o tema (`customers.theme`) e a resposta ao aviso
de cookies (`customers.cookies`).

**O roteiro das obras** (etapas, cards e checks) tambem e cadastro: mora nas
tabelas `etapa`, `etapa_card` e `etapa_check`, e a propria tela da obra cria e
apaga. Como o roteiro e unico, mexer nele vale para TODAS as obras — por isso so
cargo com acesso total edita. O que cada obra ja marcou fica em `obra_check`.

O cadastro de cliente usa duas APIs publicas, sem chave: **ViaCEP** (o CEP
preenche endereco, bairro, cidade e estado) e **IBGE** (listas de estados e de
cidades). Se qualquer uma falhar, os campos continuam editaveis na mao.

A tarja colorida do card do cliente sai da **cor predominante da logo**
(`src/utils/corDaImagem.js`): a imagem e reduzida num canvas e os pixels sao
agrupados em baldes de cor, descartando branco, preto e cinza — senao quase toda
logo devolveria "branco". Sem logo, entra a cor derivada do nome.

## Temas

Fundo **preto e branco**, com **azul escuro** nas acoes (botoes, foco, checkbox,
selecao de texto) via `--accent`. O site abre no **modo claro** (fundo branco).

A troca de tema fica em **Configuracoes > Aparencia**, e so la — o header nao tem
mais esse botao. A escolha vale para o sistema inteiro e fica guardada em
`localStorage` (`customers.theme`).

O site inteiro usa **liquid glass**: superficie translucida, desfoque do que
passa atras, luz na borda de cima e um reflexo diagonal por cima. Botao colorido
mantem a cor e recebe o vidro em cima dela. A unica excecao e o **pop-up**, que e
opaco de proposito — formulario tem que ser facil de ler. Os tokens estao em
`tokens.css` (`--vidro-*`) e as classes prontas em `comum.css` (`.vidro`,
`.vidro-cor`).

As cores vivem todas em `src/styles/tokens.css`: o bloco `:root` e o tema claro
e `:root[data-theme='dark']` redefine os mesmos tokens. Componente novo deve usar
os tokens semanticos (`--text-strong`, `--line`, `--control-bg`, `--btn-*`,
`--glass-*`, `--photo-*`) em vez de cores fixas — assim ele ja nasce funcionando
nos dois temas.

O botao primario e **azul solido** nos dois temas (`--btn-bg` / `--btn-fg`) — sem
vidro, sem desfoque e sem brilho. Ele conclui uma acao (Entrar, Adicionar
colaborador, Salvar), entao precisa ser o elemento mais firme da tela. No escuro
clareia um pouco para se ler sobre o preto.

### Vidro, fundo e pop-ups

Sao tres camadas, e a regra e simples:

1. **Fundo** — uma malha azul em `radial-gradient` no `body`
   (`--mesh-a/b/c/topo`), bem fraca de proposito: e o que passa por tras do
   vidro. Se ela pesar, o efeito de bolha some. Fica `background-attachment:
   fixed`, entao rola o conteudo e nao o fundo.
2. **Superficies do site** — barra lateral, barra superior, painel de filtros e
   cards usam `--glass-*` com `backdrop-filter`: translucidas o bastante para
   deixar a malha aparecer, fechadas o bastante para o texto se ler.
3. **Pop-ups** — a unica excecao. `Modal` e o menu do avatar usam `--modal-bg`,
   `--modal-borda` e `--modal-sombra`: **opacos, sem desfoque e sem brilho**.
   Formulario tem que ser facil de ler, nao bonito de atravessar.

Componente novo dentro de um pop-up deve usar `--modal-*` ou `--surface`, nunca
`--glass-*` — senao volta a transparencia justamente onde ela atrapalha.

A logo troca junto com o tema: `LogoLWN.png` no claro e `LogoLWNWhite.png` no
escuro, escolhidas pelo `useTheme()` no `Login.jsx`. O logo do Outlook em
`src/assets/outlook.png` segue o mesmo caminho. As duas ficam em
**`src/assets/`** e sao importadas pelo bundler (`import logo from
'@/assets/LogoLWN.png'`) — assim o caminho e resolvido no build, com hash, e um
arquivo faltando vira erro de build em vez de imagem quebrada. Para trocar a
logo, substitua o arquivo em `src/assets/`.

A foto recebe `--photo-tint`: um veu branco no tema claro (para o titulo escuro
se ler por cima) e preto no escuro.

## Layout

**Desktop** — a foto ocupa a esquerda e se dissolve num gradiente ate
transparente por baixo do cartao (`mask-image` em `.hero__slices`). Nao ha
painel nem borda arredondada: o unico bloco com raio e o cartao de login.

**Mobile** (ate 768px) — a foto vira o bloco de cima e o formulario sobe 28px
por baixo dela, com as quinas superiores arredondadas. O titulo "Login" muda de
lugar de verdade (nao ha markup duplicado): `useMediaQuery` decide se o bloco
`.head` e renderizado dentro da foto ou dentro do cartao. "Esqueci minha senha"
desce para baixo do botao via `order` no grid do formulario.

## Cookies

O aviso aparece no primeiro acesso (`src/components/CookieConsent/`) com duas
opcoes: **Apenas essenciais** e **Aceitar todos**. A escolha e gravada em
`localStorage` sob `customers.cookies` junto com a data.

Antes de disparar qualquer analytics, consulte o consentimento:

```js
import { hasAnalyticsConsent } from '@/components/CookieConsent/CookieConsent'

if (hasAnalyticsConsent()) {
  // carregar o script de analise
}
```

Hoje nenhum cookie de analise e realmente instalado — o componente registra a
escolha e expoe o helper; falta plugar a ferramenta de analytics quando ela for
definida. `clearCookieConsent()` apaga a escolha e faz o aviso reaparecer.


## Troca de tema

Ao clicar no botao lua/sol, o `ThemeContext` poe a classe `theme-switching` no
`<html>` por 500ms. Enquanto ela existe, uma regra em `global.css` faz todas as
cores (fundo, texto, borda, sombra, preenchimento) deslizarem de um tema para o
outro; depois a classe sai, para nao atropelar as transicoes proprias de hover e
foco de cada componente. Com `prefers-reduced-motion` a classe nem entra.

Superficies que precisam acompanhar essa transicao usam **cor solida** em vez de
gradiente (`--btn-bg`, `--photo-veil`), porque `background-image` nao e
animavel em CSS. O brilho por cima continua sendo gradiente.
