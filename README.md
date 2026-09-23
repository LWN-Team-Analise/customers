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
| `npm run api:dev`   | a mesma API, recarregando a cada mudanca em `server/`  |
| `npm run build`     | build de producao em `dist/`                           |
| `npm run preview`   | serve o build gerado                                   |
| `npm run db:senha`  | gera o hash bcrypt de uma senha                        |
| `npm run db:validar`| roda o SQL num banco descartavel e confere tudo        |

## Publicando (Vercel + Neon)

O sistema roda hospedado na **Vercel**, com o banco no **Neon** (Postgres
gerenciado). Sao duas diferencas em relacao a maquina local, e as duas ja
estao resolvidas no repositorio:

**1. Nao ha processo ouvindo uma porta.** Na Vercel cada chamada acorda uma
funcao, responde e morre. Por isso as rotas moram em `server/app.js`, que nao
sabe nada de porta nenhuma, e quem liga elas ao mundo sao dois arquivos
diferentes:

| Arquivo          | Onde vale       | O que faz                          |
| ---------------- | --------------- | ---------------------------------- |
| `server/app.js`  | os dois         | as rotas, e so                     |
| `server/index.js`| maquina local   | `listen` na porta + conferencias   |
| `api/index.js`   | Vercel          | entrega o mesmo `app` para a nuvem |

O desvio de `/api/...` para essa funcao, o `dist/` do front e o fallback do
SPA estao no `vercel.json`.

**2. O banco vem de uma variavel so.** Com `DATABASE_URL` preenchida, o
`server/db.js` usa ela e ignora `DB_HOST`/`DB_USER`/etc. — que continuam
valendo para quem roda local. Use sempre a connection string do endpoint
**pooler** do Neon (o host com `-pooler`): em serverless cada chamada abre a
propria conexao, e sem o pooler o limite do banco estoura antes de chegar
gente de verdade.

### O que precisa estar configurado na Vercel

`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES`, `APP_URL` (o endereco publico do
site — e dele que sai o link do "esqueci minha senha"), `GRAPH_TENANT_ID`,
`GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `MAIL_USUARIO` e, se o login com
Outlook estiver ligado, `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET` e
`OUTLOOK_TENANT`.

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` **nao** vao para a
Vercel: elas apontam para o Postgres da sua maquina, que a nuvem nao alcanca.

### O Chat LWN em producao

O modelo roda no Ollama, que vive na maquina de quem desenvolve — na Vercel
nao ha maquina nossa do outro lado. Os assuntos do manual continuam
respondendo normalmente; a pergunta que dependeria do modelo volta dizendo
que ele nao esta ligado nesta hospedagem, em vez de esperar o tempo acabar.
Para ligar o modelo em producao, aponte `OLLAMA_URL` para um endereco publico
que a Vercel alcance.

### Migrando o banco da maquina para o Neon

Mesma versao maior dos dois lados (Postgres 18), entao o caminho e direto:

```bash
pg_dump --no-owner --no-privileges --no-tablespaces --schema=public \
        --dbname=TrajetoClientes --file=local.sql
```

Tire do arquivo gerado as duas linhas `CREATE SCHEMA public;` e
`COMMENT ON SCHEMA public ...` — o schema ja existe no Neon — e restaure:

```bash
psql -v ON_ERROR_STOP=1 --single-transaction -d "$DATABASE_URL" -f local.sql
```

Depois confira a view `obra_conclusao`: se o banco de origem tiver rodado o
`sistema.sql.txt` depois do `atualizacao.sql.txt`, ela volta na versao antiga,
a que cobra da obra ate os checks criados depois dela. A definicao certa esta
no `db/atualizacao.sql.txt`.

## A esfera de clientes (tela de login)

O lado esquerdo do login e uma **esfera de fotos** que gira sozinha, obedece ao
arrasto e se inclina na direcao do cursor (`src/components/SphereGallery`).

**As placas sao as logos dos clientes cadastrados**, e so as de quem TEM logo:
cliente sem foto nao vira placa em branco, ele simplesmente nao entra na
esfera. Enquanto nenhum cliente tiver logo, entra `public/assets/login.webp`
como reserva — senao a tela abriria com uma bola de retangulos vazios.

As fotos vem de `GET /api/dados/vitrine`, a **unica rota de dados sem sessao**
do sistema. Ela e publica por necessidade: a esfera esta na tela de login, onde
ainda nao existe token. Por isso devolve **so a imagem** — sem nome, sem id, sem
endereco —, no maximo 24 delas. Quem abrir a resposta na mao ve o mesmo punhado
de logos que ja ve na tela, e nada que ligue uma logo a um cadastro.

> Vale saber, na hora de cadastrar: a logo de um cliente fica visivel para quem
> abrir a tela de login, sem precisar entrar. Se alguma nao puder aparecer, e
> melhor nao subir ela no cadastro.

O desenho e **canvas 2D**, nao WebGL: as placas sempre olham para a camera,
entao nao ha nada que precise de shader — e a tela de login nao carrega uma
biblioteca 3D so para o enfeite. Os pontos se espalham pela distribuicao de
Fibonacci (angulo aureo), o que mantem a casca uniforme com qualquer numero de
placas, sem polos apinhados.

Duas mascaras que se cruzam (`mask-composite: intersect`) tiram a esfera de onde
ela atrapalharia: uma dissolve na direcao do cartao de login, a outra abre um
claro atras da frase "Trajetoria de Clientes".

## Banco de dados

> **Instalacao NOVA — rodar nesta ordem:** `db/usuario.sql.txt`,
> `db/sistema.sql.txt`, `db/quadro.sql.txt`, `db/atualizacao.sql.txt`,
> `db/setores-e-chat.sql.txt`, `db/atualizacao-2.sql.txt`,
> `db/atualizacao-3.sql.txt`, `db/atualizacao-4.sql.txt`,
> `db/atualizacao-5.sql.txt` e, por ultimo, `db/atualizacao-6.sql.txt`.
>
> **Banco que JA roda — um comando so:**
>
> ```bash
> npm run db:atualizar
> ```
>
> Ele aplica os arquivos de atualizacao que faltam, na ordem, e no fim
> lista o que ficou no banco. Usa a mesma conexao da API (o `.env`),
> entao nao precisa de `psql` no PATH nem de digitar senha. Pode rodar
> de novo quantas vezes quiser.
>
> Os tres primeiros arquivos ficam de fora dele de proposito: sao de
> instalacao. Num banco existente eles nao acrescentam nada, e o
> `sistema.sql.txt` ainda desfaz o que o `quadro.sql.txt` fez (ele repoe
> as views antigas, que olham a tabela `obra_tarefa`). Se rodar aquele
> por engano, rode o `quadro.sql.txt` logo em seguida.
>
> Os arquivos de atualizacao so ACRESCENTAM e podem rodar mais de uma
> vez sem problema. Enquanto o `-2` nao rodar, a API nao sobe: ela ja le
> `obra.proposta`, `obra.concluida_em` e `usuario.cargo_titulo`. A aba
> **Concluidas** volta a listar depois dele, que e quem carimba as obras
> ja fechadas na coluna nova.

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
| `db/atualizacao-2.sql.txt` | n. da proposta, conclusao manual, cargo x setor, e-mail opcional |
| `db/atualizacao-3.sql.txt` | termos configuraveis e o "apagar para todos / para mim" do chat  |
| `db/atualizacao-4.sql.txt` | cadastro de cargos, recorte das imagens e nascimento opcional     |
| `db/atualizacao-5.sql.txt` | descricao da etapa, duracao da observacao e aviso por e-mail      |
| `db/atualizacao-6.sql.txt` | chat da equipe com anexo, mencao, resposta e apagar              |

Rode o primeiro na ordem indicada dentro dele; depois rode os outros
inteiros, conectado ao banco `TrajetoClientes`. Todos, do segundo em diante,
sao **idempotentes**: podem rodar de novo sem quebrar nada do que ja existe.

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

E para APLICAR as atualizacoes no banco de verdade, sem `psql`:

```bash
npm run db:atualizar
```

Ele cria um banco descartavel, roda **os dois scripts**, testa as restricoes, a
protecao do usuario id=1, os gatilhos, a media das avaliacoes e as consultas que
a API usa — e apaga o banco no fim.

### O que `db/atualizacao-2.sql.txt` acrescenta

- `obra.proposta`: o n. da proposta, obrigatorio nas obras novas (as antigas
  ficam com o campo vazio — nao da para inventar numero de proposta velha);
- `obra.descricao` passa a aceitar NULL: virou campo **opcional**;
- `obra.concluida_em / concluida_por / conclusao_obs`: a conclusao deixou de
  ser automatica e virou um clique. O arquivo **carimba** as obras que ja
  estavam fechadas pela regra antiga, para nenhuma sumir de Concluidas;
- `usuario.cargo_titulo`: o CARGO especifico da pessoa. O SETOR continua sendo
  `usuario.cargo_id` -> tabela `cargo`;
- `usuario.email` passa a aceitar NULL: e-mail virou **opcional**;
- gatilho `obra_check_sai`: quem desmarca o ultimo check sai da lista de
  membros da obra (o par do `obra_check_entra`, que ja existia);
- a permissao `excluir_concluidas` entra nos setores com acesso total.

### O que `db/atualizacao-3.sql.txt` acrescenta

- tabela `configuracao`: os termos que a empresa troca pela tela — hoje, como
  se chama "Etapa" (singular e plural);
- `obra_chat.apagada_em / apagada_por`: mensagem apagada **para todos** fica na
  conversa, vazia, com a marca "mensagem apagada";
- tabela `obra_chat_oculta`: mensagem apagada **so para mim**, que continua
  inteira para todo o resto do chat.

### O que `db/atualizacao-4.sql.txt` acrescenta

- tabela `cargo_titulo`: o cadastro de **cargos** ("Analista de Qualidade",
  "Coordenador de Obras"). Sem cor e sem permissao nenhuma — quem pinta a tela
  e carrega as permissoes e o **setor** (tabela `cargo`). Os cargos que ja
  estavam digitados em `usuario.cargo_titulo` viram cadastro na propria
  migracao, e cada pessoa ja aponta para o dela;
- `usuario.cargo_titulo_id`: o vinculo com esse cadastro. A coluna de texto
  fica e continua sendo copiada junto, entao renomear um cargo vale para todo
  mundo que esta nele sem quebrar quem le so o texto;
- `usuario.data_nascimento` aceita NULL: o cadastro de colaborador passou a
  exigir so **CPF, nome e setor**;
- recorte das imagens — `cliente.logo_original / recorte_logo / capa /
  recorte_capa` e `usuario.foto_original / recorte_foto`. A coluna da imagem
  em si (`logo`, `capa`, `foto`) guarda o resultado JA recortado, que e o que
  as telas mostram; o original serve para reenquadrar depois sem recortar o
  recorte anterior, e o `{ cx, cy, zoom }` para reabrir o editor no mesmo
  lugar. O cliente tem DOIS recortes independentes da mesma imagem: a logo
  (quadrada) e o header da obra (faixa larga).

### O que `db/atualizacao-5.sql.txt` acrescenta

- `etapa.descricao`: a linha de apoio embaixo do nome da etapa ("aguardando
  aprovacao"). O card do quadro passou a mostrar **nome + descricao** no lugar
  de "1ª Etapa + nome" — ver [Nome e descricao de cada etapa](#nome-e-descricao-de-cada-etapa);
- `observacao_quadro.inicio_em` / `fim_em` (DATE, com `CHECK`): a **duracao**
  da observacao do quadro. Passada a data final ela sai do painel sozinha e vai
  para a aba Historico — nao e apagada. As duas datas andam juntas: janela pela
  metade nao e janela, e o banco recusa;
- `usuario.avisos_email` (default `true`): quem NAO quer receber o aviso de
  pendencia por e-mail alem do sininho. Nao ha tela para isso ainda — e uma
  valvula de escape para virar no banco se alguem reclamar de excesso.

### O que `db/atualizacao-6.sql.txt` acrescenta

O **chat da equipe** (`chat_site`) ganha o que o chat da obra ja tinha:
`responde_a`, `arquivo_nome/tipo/conteudo`, `apagada_em/apagada_por`, e as
tabelas `chat_site_mencao` e `chat_site_oculta`. `texto` deixa de ser NOT NULL
— mensagem que e so anexo nao tem texto, e apagar para todos zera o texto e
mantem a linha.

Os nomes sao os MESMOS de `obra_chat`, de proposito: as duas tabelas respondem
a mesma pergunta e sao lidas pelo mesmo componente. Nome diferente para a
mesma coisa e o comeco de dois jeitos diferentes de tratar a mesma coisa.

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
| `GET /api/equipe/titulos`       | lista os CARGOS da equipe (sem cor)          |
| `POST /api/equipe/titulos`      | cria um cargo (pede `editar_cargo_titulo`)   |
| `PATCH /api/equipe/titulos/:id` | renomeia (e acerta quem esta nele)           |
| `DELETE /api/equipe/titulos/:id`| apaga (recusa cargo em uso)                  |
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
| `GET /api/dados/vitrine`        | so as logos dos clientes — **sem sessao**, para a esfera do login |
| `POST/PATCH/DELETE /api/dados/setores` | setores do cliente (o ramo da empresa) |
| `GET/POST/DELETE /api/dados/chat` | o chat geral da equipe (botao flutuante) |
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

### O token vive na memoria, nao so no localStorage

Em `src/services/api.js` o token tem **duas moradas**: uma variavel de modulo e
o `localStorage`. A da memoria e a que vale, e ela existe por causa de um bug
que fazia o login parecer quebrado.

Quem escreve no `localStorage` e um efeito do `AuthContext`, e efeito so roda
depois que a tela pinta. So que o `DadosProvider` e **filho** do `AuthProvider`,
e no React o efeito do filho roda **antes** do efeito do pai. Resultado: no
instante em que o login abria a sessao, a primeira carga do quadro ja saia — e
saia sem token, porque o `localStorage` ainda estava vazio.

```
POST /api/auth/login    → 200      a senha estava certa
GET  /api/dados         → 401      ...mas foi sem Authorization
GET  /api/equipe/cargos → 401
GET  /api/roteiro       → 401
```

O 401 vinha com `sessao: false`, o `api.js` derrubava a sessao recem-aberta e a
tela voltava para o login dizendo **"sua sessao expirou por tempo"** — logo
depois de a pessoa acertar a senha.

A correcao e o `guardarToken()`: o `AuthContext` empurra o token para a memoria
do `api` **no mesmo passo** em que muda a sessao, antes de qualquer efeito. O
`localStorage` continua sendo escrito pelo efeito, e serve para a proxima vez
que o site abrir.


### Permissoes

Cada **setor** tem uma lista de chaves em `cargo.permissoes`. A lista mora em
`src/domain/permissoes.js` — **um arquivo so, usado pelos dois lados**: a tela
esconde o botao e a API recusa a chamada usando exatamente as mesmas chaves.

| Grupo        | Chaves                                                              |
| ------------ | ------------------------------------------------------------------- |
| Visualizacao | `ver_inicio`, `ver_obras`, `ver_clientes`, `ver_concluidas`, `ver_avaliacoes`, `ver_avisos` |
| Alteracao    | `editar_usuario`, `editar_cargo`, `editar_cargo_titulo`, `editar_avaliacoes`, `editar_clientes`, `editar_obras`, `excluir_concluidas`, `check_todas_etapas`, `editar_etapa`, `editar_cards`, `editar_cargos_card`, `editar_checks`, `enviar_avisos` |

Alteracao **sempre** depende da visualizacao correspondente: desmarcar "Obras"
apaga junto tudo o que so faz sentido dentro de Obras, e essas linhas ficam
travadas ate a visualizacao voltar. Quem tem `acesso_total` (diretoria) passa
por qualquer uma, marcada ou nao.

Tres chaves valem uma nota:

- **`excluir_concluidas`** e separada de `editar_obras` de proposito. Apagar
  uma obra fechada nao e mexer em trabalho em andamento: e apagar o registro do
  que a empresa entregou. Ela depende de `ver_concluidas`;
- **`editar_etapa`** manda tambem no **nome** das etapas — a palavra "Etapa" em
  si, que a empresa pode trocar. Quem manda no roteiro decide como o roteiro se
  chama;
- **`editar_cargo_titulo`** manda no cadastro de **cargos** e, junto com ele,
  em ATRIBUIR um cargo a alguem. Sem ela o campo Cargo fica travado no cadastro
  do colaborador e tambem em Configuracoes — ninguem se promove sozinho no
  proprio perfil. Ela nao depende de nenhuma visualizacao: quem so tem ela
  entra na aba Usuarios pela lista de Cargos.

### E-mail (esqueci minha senha)

O "esqueci minha senha" manda um codigo de 6 digitos que vale **3 minutos**. So
o hash do codigo e guardado, e o passo 1 responde a mesma coisa exista ou nao a
conta — nao entrega quem esta cadastrado.

Existem **dois caminhos de envio**, e o primeiro que estiver configurado ganha:

| | Quando usar | O que preencher no `.env` |
|---|---|---|
| **API da Microsoft (Graph)** | Caixa em Microsoft 365 — inclusive a da LWN | `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `MAIL_USUARIO` |
| **SMTP** | Qualquer outro provedor (Gmail, Zoho, SMTP proprio) | `MAIL_USUARIO`, `MAIL_SENHA`, `MAIL_HOST`, `MAIL_PORT` |

Ao subir a API, o log diz por onde o e-mail vai sair — e, no caminho da
Microsoft, **se o aplicativo realmente pode enviar**:

```
[api] envio de e-mail: API da Microsoft (Graph)
[api] permissao ok: Mail.Send concedida; caixa lwnteamanalise@lwnengenharia.com.br
```

Autenticar e uma coisa, ter permissao e outra: o registro pode estar certinho,
o segredo valido, o token sair na hora — e o envio falhar com 403 porque
ninguem concedeu `Mail.Send`. A resposta esta dentro do proprio token (na lista
`roles`), e ler isso ao subir a API poupa a investigacao de "por que o e-mail
nao chega". Quando falta, o log e direto:

```
[api] ATENCAO: o aplicativo autentica, mas NAO tem a permissao Mail.Send.
      No Entra ID: Permissoes de API > Adicionar > Microsoft Graph >
      Permissoes de APLICATIVO > Mail.Send > e depois
      "Conceder consentimento do administrador".
```

#### Por que o SMTP nao funciona neste dominio

O tenant da LWN tem o **SMTP autenticado desligado**. Testando
`lwnteamanalise@lwnengenharia.com.br` em `smtp.office365.com:587`, o servidor
responde:

```
535 5.7.139 Authentication unsuccessful,
SmtpClientAuthentication is disabled for the Tenant.
```

**A senha esta certa.** O que a Microsoft nao aceita mais e login por SMTP — ela
desligou isso por padrao em todo tenant novo. Nenhuma senha de aplicativo
resolve, porque o bloqueio e do tenant, nao da conta.

O caminho que a Microsoft deixou aberto e a **API (Graph)**: em vez de conectar
na caixa e mandar, o servidor pede um token ao Entra ID e chama `/sendMail`.
Quem se autentica e o **aplicativo**, nao uma pessoa — nao ha senha de caixa nem
MFA para atrapalhar.

#### Passo a passo: ligar o envio pela API da Microsoft

Precisa de uma conta com papel de **Administrador global** (ou Administrador de
aplicativos, mais alguem que possa dar o consentimento) no tenant.

**1. Registrar o aplicativo**

1. Abra <https://entra.microsoft.com> e entre com a conta de administrador.
2. **Identidade → Aplicativos → Registros de aplicativo → Novo registro**.
3. Nome: `Trajetoria de Clientes — envio de e-mail`.
4. Tipos de conta com suporte: **Somente contas neste diretorio organizacional**.
5. URI de redirecionamento: **deixe em branco** — este aplicativo nao tem tela de
   login, ele fala sozinho com a API.
6. **Registrar**.

**2. Copiar os dois IDs**

Na tela **Visao geral** do aplicativo recem-criado, copie:

- **ID do aplicativo (cliente)** → vai em `GRAPH_CLIENT_ID`
- **ID do diretorio (locatario)** → vai em `GRAPH_TENANT_ID`

**3. Criar o segredo do cliente**

1. **Certificados e segredos → Segredos do cliente → Novo segredo do cliente**.
2. Descricao: `api-customers`. Expiracao: 24 meses.
3. **Adicionar**, e copie a coluna **Valor** (nao a "ID do segredo").

> O valor so aparece uma vez. Saiu da tela, nao tem como ver de novo — e preciso
> criar outro. E ele **vence**: anote a data, porque quando vencer o e-mail para
> de sair, com erro 401.

**4. Dar a permissao de enviar**

1. **Permissoes de API → Adicionar uma permissao → Microsoft Graph**.
2. Escolha **Permissoes de aplicativo** (nao "delegadas" — nao ha usuario logado
   neste fluxo).
3. Procure `Mail.Send` e marque.
4. **Adicionar permissoes**.
5. Clique em **Conceder consentimento do administrador para \<empresa\>** e
   confirme. A linha do `Mail.Send` tem que ficar com o **visto verde** — sem
   esse passo o envio volta 403.

**5. (Recomendado) Limitar a quais caixas o aplicativo pode enviar**

Do jeito que esta, o aplicativo pode enviar como **qualquer caixa do tenant**.
Para prende-lo so na caixa do sistema, rode no PowerShell (modulo
`ExchangeOnlineManagement`):

```powershell
Connect-ExchangeOnline
New-DistributionGroup -Name "App Envio Customers" -Alias app-envio-customers -Type Security -Members lwnteamanalise@lwnengenharia.com.br
New-ApplicationAccessPolicy -AppId <GRAPH_CLIENT_ID> -PolicyScopeGroupId app-envio-customers@lwnengenharia.com.br -AccessRight RestrictAccess -Description "So a caixa do Trajetoria de Clientes"
```

**6. Preencher o `.env` e reiniciar a API**

```
MAIL_USUARIO=lwnteamanalise@lwnengenharia.com.br
GRAPH_TENANT_ID=<ID do diretorio (locatario)>
GRAPH_CLIENT_ID=<ID do aplicativo (cliente)>
GRAPH_CLIENT_SECRET=<o Valor do segredo>
```

```bash
npm run api
```

O log tem que dizer `[api] envio de e-mail: API da Microsoft (Graph)`. Feito
isso, teste o "Esqueci minha senha" na tela de login: o codigo chega, e uma
copia fica em **Itens Enviados** da caixa.

#### Quando nao chegar

| O que a tela diz | O que e |
|---|---|
| "Falta a permissao Mail.Send..." (403) | O passo 4 nao foi concluido — falta o consentimento do administrador, ou a permissao foi marcada como *delegada* em vez de *de aplicativo* |
| "O aplicativo nao esta autorizado..." (401) | O segredo esta errado ou **venceu**. Crie outro no passo 3 |
| "A caixa ... nao foi encontrada" (404) | O `MAIL_USUARIO` nao existe nesse tenant, ou nao tem caixa do Exchange |
| "A Microsoft bloqueia o envio por SMTP..." | Os `GRAPH_*` estao vazios e o sistema caiu no SMTP. Volte ao passo 6 |

> **Se preferir nao mexer no Entra ID**, a outra saida e ligar o SMTP: no
> Microsoft 365 admin center, **Usuarios → a conta → Email → Gerenciar
> aplicativos de email → Autenticacao SMTP**, e desligar o bloqueio no nivel do
> tenant pelo Exchange admin center. E menos recomendavel: a Microsoft esta
> descontinuando esse caminho.

### Login com Outlook

O login com Outlook usa o fluxo padrao da Microsoft e precisa de um aplicativo
registrado no Entra ID (`OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`,
`OUTLOOK_TENANT`). Sem isso, a tela mostra o recado no lugar do botao e o resto
do sistema continua igual. O vinculo casa pelo **e-mail**: a conta Microsoft
tem que ser a mesma do cadastro — e por isso que o e-mail nao se altera mais
pela tela do usuario.

#### O Outlook e OBRIGATORIO: o portao do meio

Entrar com CPF/e-mail e senha **nao da mais acesso ao sistema**. Quem entrou
mas ainda nao vinculou a conta Microsoft para numa tela do meio
(`src/pages/Login/PortaoOutlook.jsx`) e nao ve nada alem dela — sem menu, sem
barra lateral e sem rota que passe por fora. Duas saidas: vincular ou sair.

Quem decide isso e o `ProtectedRoute`, em tres portoes na ordem: sessao →
Outlook → cargo. O portao do Outlook vale para TODA rota interna, inclusive
Configuracoes — deixa-la de fora seria abrir a porta que a regra fecha, porque
e de la que se mexe no proprio cadastro.

> **A valvula de seguranca.** O portao so aparece quando o servidor confirma
> que o login com Outlook esta configurado (`GET /api/auth/outlook/config`).
> Isso nao e conforto, e seguranca: com o `.env` sem as chaves da Microsoft, ou
> com o segredo do cliente vencido, o portao trancaria **todo mundo** para fora
> do sistema — inclusive quem poderia consertar, e sem nenhuma tela por onde
> fazer isso. Enquanto o servidor responder que nao ha por onde entrar, o
> sistema volta a funcionar como antes.
>
> A consequencia pratica: **o registro no Entra ID virou dependencia de
> producao.** Segredo do cliente vencido nao degrada mais uma funcionalidade —
> ele desliga o login da empresa inteira ate alguem renovar. Anote a data de
> expiracao.

A resposta do `/outlook/config` fica em cache pela vida da pagina
(`authService`): o `ProtectedRoute` faz essa pergunta a cada troca de rota, e
sem o cache seriam dezenas de requisicoes identicas.

#### O redirect URI precisa estar cadastrado no portal

```
AADSTS50011: The redirect URI 'http://localhost:5173/outlook' specified in the
request does not match the redirect URIs configured for the application...
```

Esse erro nao e de codigo: a Microsoft so devolve o `code` para um endereco que
esteja **na lista do registro**, e essa lista comeca vazia. No Entra ID:

1. **Registros de aplicativo → o app → Autenticacao**;
2. **Adicionar uma plataforma → Web**. Tem de ser **Web**, e nao "Aplicativo de
   pagina unica (SPA)": a troca do `code` pelo token acontece no NOSSO
   servidor, com o segredo do cliente, e a Microsoft recusa segredo em
   redirect de SPA;
3. URI de redirecionamento: `http://localhost:5173/outlook` (o de
   desenvolvimento) e o endereco de producao, um por linha;
4. **Configurar / Salvar**. Vale em poucos segundos.

O caminho `/outlook` e a pagina `RetornoOutlook`: ela so pega o `code`, entrega
para a janela que abriu e se fecha.

> **Nao da para conferir isso por fora.** Chamar o `/authorize` com um redirect
> errado devolve **HTTP 200 e a tela de login normal** — igualzinho a um
> redirect certo. O AADSTS50011 so aparece DEPOIS que a conta e escolhida. A
> unica prova e clicar no botao.

O login devolve tambem o cargo do usuario (chave, nome, cor e `acessoTotal`) —
e dai que sai a trava de quem edita o que. Se `db/sistema.sql.txt` ainda nao
tiver sido rodado, a consulta cai numa versao sem cargo e o login continua
funcionando.

As rotas de `/api/equipe` exigem sessao (Bearer) e devolvem **503** com uma
mensagem clara enquanto o SQL nao for rodado — o front trata isso como "sem
banco" e usa os dados locais, sem quebrar nada.

Usuario e senha errados devolvem a mesma mensagem, de proposito: nao entrega a
quem tenta adivinhar qual e-mail existe no sistema.

## Notificacoes

O sininho mostra **so os avisos endereçados ao SEU setor**. Quem e da
Excelencia nao recebe a cobranca de um check pendente do Comercial: nao ha nada
que essa pessoa possa fazer a respeito, e um sino cheio de aviso de outro setor
e um sino que ninguem mais abre.

A regra vale **inclusive para a diretoria**. Antes o acesso total trazia tudo, e
o sino dela virava o despejo do quadro inteiro; quem quer a visao geral do que
falta em cada setor tem a coluna de pendencias na tela de Obras, que mostra a
mesma coisa organizada.

A unica excecao e o aviso **sem setor nenhum**: esse e recado para a empresa
toda e chega para todo mundo. Quem decide e `minhasNotificacoes`, no
`DadosContext`.

### O aviso tambem vai por e-mail

O sininho so cobra quem esta com o sistema aberto — e quem esta devendo
informacao costuma ser exatamente quem nao esta. Por isso o clique em **Enviar
aviso** faz duas coisas: grava a cobranca (o sininho) e manda um e-mail para
**quem e do setor cobrado**.

O e-mail leva o que a pessoa precisa para decidir se para o que esta fazendo:

- a prioridade em destaque — **EMERGENCIA**, alta, media ou baixa, com a cor
  correspondente. Obra de emergencia entra como emergencia, nao como "alta";
- o numero da proposta e o nome do cliente, com a **logo** dele;
- a descricao da obra, a etapa e quais setores foram cobrados;
- quem disparou o aviso;
- um botao **"Abrir a obra e resolver"**, que leva direto para
  `/app/obras/:id` — a tela onde o check e marcado. O endereco sai de
  `APP_URL` no `.env`; em producao, ponha o dominio de verdade.

A logo viaja como **anexo embutido** (`cid:`), nao como `src="data:..."`:
Gmail, Outlook Web e quase todo cliente descartam data URL em imagem, e ela
chegaria quebrada.

**Quem recebe:** todo mundo do setor cobrado, **inclusive quem apertou o
botao**. Isso e diferente do sininho, que pula o autor de proposito — o selo
vermelho existe para dizer "tem coisa nova para voce", e um recado que a
propria pessoa escreveu nao e novidade nenhuma. O e-mail responde outra
pergunta: ele e o REGISTRO da cobranca, e quem esta no setor cobrado esta
sendo cobrado, tenha ou nao apertado o botao. Alem disso, avisar o proprio
setor e o caso mais comum de todos ("a Excelencia esta devendo, e eu sou da
Excelencia") — pular o autor fazia justamente ele nao receber nada.

Duas coisas que o envio nao faz, de proposito:

- nao manda para quem tem `usuario.avisos_email = false`;
- **nao trava a chamada**. O aviso ja esta gravado quando o e-mail sai; um
  e-mail que nao foi nao pode desfazer uma cobranca que foi.

A resposta traz `emails` (quantos sairam) e `emailMotivo` (por que nenhum
saiu), e a tela mostra os dois:

```
Aviso enviado para GQ — Libbs. 3 pessoas receberam por e-mail.
Aviso enviado para GQ — Libbs. Nenhum e-mail saiu: falta a permissão Mail.Send
no aplicativo, ou o consentimento do administrador.
```

O segundo caso importa: sem ele a tela dizia "enviado" e o e-mail morria em
silencio, e so o log do servidor sabia.

## Setores do cliente

> Nao confundir com o **setor da equipe** (Comercial, GQ, Excelencia), que e a
> tabela `cargo` e carrega as permissoes. Este aqui e o ramo do CLIENTE, e nao
> decide nada alem de filtro e cor de etiqueta.

O ramo em que a empresa atua (Farmaceutico, Alimenticio...). Vive em tabela
propria (`setor_cliente`) e nao como texto no cliente, porque o setor tem que
ser o MESMO em todos os cadastros — com texto livre, "Farmaceutico" e
"farmaceutica" viram dois setores e o filtro deixa de funcionar.

Quem mexe e quem pode mexer em cliente: o botao **Setores** na aba Clientes
cria, edita e exclui; o cadastro de cada cliente escolhe entre os que existem.

Apagar um setor **nao apaga os clientes dele**. A chave estrangeira e
`ON DELETE SET NULL`: eles voltam para "sem setor" e aparecem no filtro *Sem
setor*, para reclassificar com calma.

### O card que abre e fecha

Fechado, o cliente e uma linha: logo, nome e a setinha. Aberto, ele vira o
cartao de quinas recortadas com a logo no topo.

A passagem entre os dois e animada **nos dois sentidos**: abrindo, o cartao se
desenrola de cima para baixo, como uma persiana que desce a partir da linha
fechada; fechando, ele se recolhe de baixo para cima, pelo mesmo caminho. Quem
faz e um `clip-path` que vai de `inset(0 0 100% 0)` a `inset(0 0 0 0)`, com a
origem da escala presa no topo.

Fechar precisa do estado `is-fechando` no JSX: a animacao de saida so roda
enquanto o elemento **ainda esta no DOM**. Sem ele, o React tira o cartao no
mesmo instante do clique e nao ha o que animar — por isso o clique marca a
classe, deixa a animacao correr e so entao desmonta.

**Fecha por tres caminhos, e os tres valem**: o botao *Fechar* sobre a foto, o
proprio cabecalho (a faixa com a logo e o nome) e **qualquer ponto do card
aberto**. Clicar de novo onde se clicou para abrir e o gesto que a mao ja
espera — e o resto do cartao, que antes era area morta, agora responde igual.

O clique so nao fecha quando sai de um elemento com funcao propria (`button`,
`a`, `input`, `select`, `textarea`): apagar um cliente nao pode fechar o card
no mesmo gesto. Quem decide e um `closest()` no alvo do clique.

### A previa do header, no cadastro

A logo do cliente aparece em dois lugares com recortes **independentes**: o
quadrado do card e a faixa larga que abre a tela da obra. O quadrado sempre
esteve a vista no cadastro; a faixa, nao — ela so existia dentro do editor, e
para ve-la era preciso clicar em "Ajustar enquadramento", que e justamente a
decisao que a previa deveria ajudar a tomar.

Agora a faixa aparece **parada, no cadastro**, do tamanho real, logo abaixo da
logo. O editor continua sendo onde se MEXE nos dois recortes; ali so se ve como
esta. E a mesma peca (`PreviaHeader`, em `components/EditorImagem`) nos dois
lugares: com `aoMudar` ela e arrastavel e E o ajuste do header; sem, e amostra.

Cliente cadastrado antes do recorte separado nao tem `capa`. Nesse caso a
previa usa a propria logo e diz isso embaixo, com o caminho para dar um recorte
proprio a faixa.

## Chat da equipe

O botao redondo do canto inferior direito abre a conversa geral da equipe
(`chat_site`). Ela e separada do chat da obra de proposito: aquele morre com a
obra e vira historico dela; este e do dia a dia e nao pertence a obra nenhuma.

### Uma conversa so, usada por duas telas

As duas faziam a mesma coisa e **so uma sabia fazer**: o chat da obra tinha
anexo, camera, mencao com @, resposta e as duas formas de apagar; o da equipe
era uma caixa de texto e um botao de enviar. Quem precisava mandar uma foto
para a equipe abria uma obra qualquer so para usar o chat dela.

Em vez de copiar as duzentas linhas para o outro lado — e ficar com dois chats
que divergem na primeira correcao —, a conversa inteira virou um componente:
**`src/components/Chat/Conversa.jsx`**. As duas telas sao cascas finas em cima
dele:

| Tela | O que ela faz |
|---|---|
| `pages/Obras/ModalChat.jsx` | carrega o chat DA OBRA e poe os participantes dela na frente da lista de @ |
| `components/ChatSite/ChatSite.jsx` | carrega o chat DA EQUIPE; ali a equipe inteira pode ser citada, em ordem alfabetica |

O componente **nao carrega nem guarda** as mensagens: quem faz isso e quem
chama, porque as duas origens sao rotas diferentes. Dali saem so dois pedidos
— `aoEnviar` e `aoApagar` — e a lista que voltar e responsabilidade de quem
chamou.

O CSS foi junto: `pages/Obras/ModalChat.css` virou
`components/Chat/Chat.css`, e as duas telas usam as mesmas classes `chat__*`.

O botao muda conforme a tela:

| Tela | O botao |
|---|---|
| Obras | **+**, com *Adicionar observação* e *Chat da equipe* |
| Demais | icone de chat, atalho direto |
| Dentro de uma obra | **nao aparece** — la o chat que vale e o da obra |

Conversar e de todo mundo que entra; nao ha permissao para isso. O que se
controla e quem apaga: cada um tira so a propria mensagem, e a API confere de
novo antes de apagar.

## Obra fechada: a tela travada

Clicar numa obra em **Concluidas** abre `/app/concluidas/:id` — a MESMA tela
da obra, com `somenteLeitura`. A pessoa nao sai da aba de concluidas, ve tudo
(capa, etapas, checks marcados, observacoes, **chat, etiquetas, anexos**,
avaliacoes) e nao escreve nada.

A trava e num lugar so — as permissoes da tela caem juntas:

```jsx
const soLeitura = somenteLeitura || concluida(obra)
const podeEtapa = !soLeitura && pode('editar_etapa')
```

Espalhar o `!soLeitura` por quinze condicoes e como se esquece uma.

Repare no `|| concluida(obra)`: a trava e da OBRA, nao do caminho por onde se
chegou nela. Uma obra fechada aberta por `/app/obras/:id` (um link antigo, o
botao de voltar do navegador) vem travada do mesmo jeito.

**O que continua a vista, e so para consulta:**

| Onde | O que da para fazer | O que sumiu |
| ---- | ------------------- | ----------- |
| Chat | ler a conversa inteira | a caixa de escrever, o responder e o apagar |
| Etiquetas | ver quais a obra tem | adicionar, editar e reaproveitar |
| Anexos | **baixar** os documentos | anexar e excluir |
| Observacoes | ler todas | escrever e editar, mesmo a propria |
| Checks | ver o que foi marcado, por quem e quando | marcar e desmarcar |

Etiquetas e anexos ficavam de fora antes: os dois botoes sumiam junto com o
Editar, e tudo o que tinha sido etiquetado ou anexado durante a obra
desaparecia no dia em que ela era concluida — justo quando esse material vira
registro e passa a ser o que alguem volta para consultar.

A API repete a trava, e nao depende da tela: o middleware `obraAberta`
(`server/routes/dados.js`) recusa com 409 qualquer escrita numa obra fechada —
check, chat, observacao, aviso, etiqueta, anexo e a propria edicao da obra.
Fora da trava ficam as **avaliacoes**, de proposito: e depois de concluida que
a obra e avaliada.

Na faixa de carimbos aparecem, **so aqui**, "Concluida em", "Concluida por" e a
observacao do encerramento. Numa obra em andamento os tres seriam linhas
vazias.

Abaixo de tudo vem a **Rastreabilidade**: uma linha do tempo unica com quem
marcou cada check e a que horas, o chat, as observacoes, os avisos, os anexos
e as notas. Ela aparece em QUALQUER obra, aberta ou fechada: saber quem marcou
o que serve tanto para conferir o passado quanto para acompanhar o presente.

Os filtros do topo sao:

```
[Tudo] [1ª Etapa] [2ª Etapa] [3ª Etapa] ... [Chat] [Observações] [Avisos] [Avaliações] [Anexos]
```

As etapas vem do roteiro DAQUELA obra, e sao quantas ela tiver. Antes havia um
filtro so, "Checks", que jogava as cinco etapas na mesma pilha e nao respondia
a pergunta que se faz olhando a ficha: **"o que aconteceu na 3ª?"**.

A engrenagem no fim da fila renomeia a palavra "Etapa" — veja a secao seguinte.

## O nome das etapas

"Etapa" e a palavra da empresa, nao do sistema: amanha o roteiro pode se chamar
Fase, Marco, Frente ou Entrega. Ela mora na tabela `configuracao`
(`termo_etapa` e `termo_etapas`), vem junto na carga do quadro e sai do
`DadosContext`:

```jsx
const { termoEtapa, termoEtapas, rotuloEtapa } = useDados()
rotuloEtapa(3) // "3ª Etapa"
```

Toda tela que escreve a palavra usa esses tres — o cabecalho de cada bloco na
tela da obra, o card do quadro, os filtros da rastreabilidade, os avisos, o
pop-up de criar etapa e o de editar. Trocar num lugar troca em todos.

Sao dois campos, e nao um: o portugues precisa do singular ("3ª Etapa") e do
plural ("Etapas pendentes"). Deduzir o plural com um "s" no fim daria "Fases"
certo e "Marcoss" errado.

> **Nao ha mais tela para trocar essa palavra.** A engrenagem que ficava ao
> lado dos filtros da rastreabilidade saiu, e o bloco que a substituiu em
> Configuracoes tambem. Os valores continuam na tabela `configuracao` e
> continuam mandando em toda tela que escreve a palavra — so a edicao pela
> interface deixou de existir. Para trocar hoje, e um `UPDATE` em
> `configuracao` (chaves `termo_etapa` e `termo_etapas`) ou um `PATCH` em
> `/api/dados/termos`, que continua de pe.
>
> Com a etapa ganhando **nome proprio** (logo abaixo), o rotulo por posicao
> perdeu o lugar de destaque e a palavra passou a aparecer bem menos.

### Nome e descricao de cada etapa

O rotulo por posicao ("1ª Etapa") deixou de ser o titulo do card. Quem manda
agora e o **nome** da etapa, e embaixo dele vem uma **descricao** — texto
livre, opcional, que conta em que pe a etapa esta:

```
Comercial                <- etapa.nome        (o titulo)
aguardando aprovacao     <- etapa.descricao   (a linha de apoio)
```

Antes eram estas duas linhas:

```
1ª Etapa                 <- rotuloEtapa(1), automatico
comercial                <- etapa.nome, em caixa alta e pequeno
```

O lugar de destaque estava gasto para dizer uma coisa que a ordem das colunas
ja diz. O rotulo por posicao continua existindo — ele e o titulo de quem nao
deu nome a etapa, a dica do card, e a frase "Liberada quando a 2ª fechar" —,
so nao e mais o cabecalho.

O lapis no canto do card abre o mesmo pop-up de sempre (`ModalEtapa`), agora
com os dois campos e uma previa das duas linhas. Nome e descricao valem para
**todas as obras**: e a mesma etapa, so mudou como ela se chama e como esta.
Criar e excluir e que continuam valendo desta obra em diante.

## Confirmações

Quatro acoes pedem confirmacao antes de acontecer, e o `Confirma` tem dois
tons: `perigo` (vermelho, para apagar) e `acao` (cor do sistema — pintar de
vermelho um "Criar obra" faz a pessoa hesitar sem motivo).

| Ação | O que a caixa mostra |
|---|---|
| Sair | que a sessao fecha |
| Criar obra | empresa, tipo, prioridade e descricao |
| Novo colaborador | o cargo e **o que ele libera**, permissao por permissao |
| Novo/editar cargo | acesso total e a lista de permissoes marcadas |

As duas ultimas sao as que importam: cargo nao e cadastro de uma pessoa, e o
que um grupo inteiro passa a poder fazer. Uma caixa marcada sem querer libera
aquilo para todo mundo do cargo, e ninguem percebe na hora.

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
│   ├── Home/               # o "meu dia": Grade, Quadro e Dashboard
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
├── routes/equipe.js        # setores (tabela cargo) e usuarios
├── routes/dados.js         # clientes, obras, checks, observacoes, avisos, notas
├── routes/roteiro.js       # etapas, cards e checks (o roteiro das obras)
└── scripts/                # gerar hash de senha, validar o SQL

db/
├── usuario.sql.txt         # PARTE 1: banco, tabela usuario, travas
├── sistema.sql.txt         # PARTE 2: setores (tabela cargo), clientes, obras
├── quadro.sql.txt          # PARTE 3: roteiro, obra_check, senha provisoria
├── atualizacao.sql.txt     # permissoes, chat, etiquetas, anexos, notas
├── setores-e-chat.sql.txt  # setor do cliente e o chat da equipe
├── atualizacao-2.sql.txt   # proposta, conclusao manual, setor x cargo
├── atualizacao-3.sql.txt   # termos configuraveis, apagar msg para todos/mim
├── atualizacao-4.sql.txt   # cadastro de cargos, recorte das imagens
└── atualizacao-5.sql.txt   # descricao da etapa, duracao da observacao, aviso por e-mail
```

## Rotas

| Rota                        | Tela                     | Acesso    |
| --------------------------- | ------------------------ | --------- |
| `/login`                    | Login                    | publico   |
| `/politica-de-privacidade`  | Politica de privacidade  | publico   |
| `/app`                      | Pagina inicial (o "meu dia") | protegido |
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

## Pagina inicial

Tres modos de olhar a MESMA lista, e a lista e uma so: **os checks das
obras abertas**.

| Aba | O que mostra |
|---|---|
| **Grade** | so o que da para fazer AGORA, em ordem de urgencia |
| **Quadro** | as mesmas tarefas em tres colunas: Nao iniciado / Em andamento / Concluida |
| **Dashboard** | os numeros de tempo que a lista nao mostra |

### Tarefa aqui e CHECK de obra

Nao existe cadastro de tarefa neste sistema, e **nao ha botao de
"adicionar tarefa" em lugar nenhum** desta tela. Uma tarefa solta nao
teria obra onde ser marcada nem quem a cobrasse — o sininho, os avisos e
a rastreabilidade so sabem falar de check de obra. Quem cria tarefa e
quem monta o roteiro.

### A faixa do dia

Data, tempo, saudacao e o resumo do dia. O icone do tempo e o de VERDADE,
puxado da [Open-Meteo](https://open-meteo.com) para **Santana, Sao Paulo**
(`src/hooks/useClima.js`) — ali havia um sol desenhado, fixo, que num dia de
chuva mentia. A temperatura de agora, com a maxima e a minima, fica sobreposta
ao canto superior direito do desenho, sem moldura: o desenho responde "como
esta la fora" de relance, e o numero e o detalhe de quem parou para olhar.

A Open-Meteo foi escolhida por dois motivos praticos: **nao pede chave de API**
(nada a cadastrar, nada a vencer, nada a esconder no `.env`) e responde direto
ao navegador, com CORS liberado. Nao vai dado nenhum do usuario na chamada — so
as coordenadas fixas do bairro, que sao duas constantes no topo do arquivo.

A resposta fica em cache por 15 minutos. Falhou (sem internet, servico fora)? O
hook devolve `null`, a faixa mostra so o desenho neutro e o dia da pessoa segue:
nenhuma tela deste sistema pode depender de um servico de previsao do tempo.

Os trinta codigos da OMM caem em **nove desenhos** (`familiaDoTempo`): "garoa
leve" e "garoa moderada" pedem a mesma figura, e desenhar trinta seria trocar
clareza por variedade. Os desenhos estao em
`src/components/Clima/IconeClima.jsx`.

> As gotas caem com atraso **negativo**, distribuido pelo ciclo (`-i/n` de uma
> volta). Nao e detalhe de estilo: com atraso positivo pequeno as tres caiam
> quase juntas e ficavam invisiveis ao mesmo tempo, e o icone de garoa virava um
> icone de "encoberto" por meio segundo a cada volta.

### O que entra na Grade

Duas coisas, e so essas duas:

1. **o que falta agora** — os checks da etapa que ja abriu e ainda nao foram
   marcados;
2. **uma linha por obra onde nada falta para voce**, dizendo o que aconteceu
   ("Sua parte esta concluida" ou "Ainda nao abriu para voce") e, principalmente,
   **quem esta segurando a passagem** para a proxima etapa.

Fica de fora o que esta preso em etapa futura: nao ha o que fazer com ele hoje,
e uma lista de afazeres que mistura o que da para fazer com o que nao da vira
inventario do roteiro. Fica de fora tambem o que ja foi marcado. Esses dois
moram no **Quadro**, que e a aba do estado.

A linha de espera nao some da Grade de proposito: sumir daria a entender que a
obra acabou. E o nome de quem esta devendo aparece ali porque, sem ele, a unica
saida era abrir a obra e conferir card por card.

Quem monta a lista e `src/pages/Home/useTarefas.js`. O **estado** de cada
tarefa sai de duas perguntas, nesta ordem:

```
marcado?                 -> Concluida
a etapa dele ja abriu?   -> Em andamento   (da para fazer agora)
ainda nao abriu          -> Nao iniciado   (a etapa anterior segura)
```

Obra de emergencia nunca tem "Nao iniciado": ali todas as etapas abrem de
uma vez. Obra ENCERRADA fica de fora inteira — ela e registro, e um
quadro que mistura o que acabou com o que falta para de responder a
pergunta que existe para responder.

### A coluna de concluidas mostra o CARD

Nas duas primeiras colunas, um card por CHECK. Na de concluidas, um card por
**card do roteiro** — "Comercial" —, com os checks dele dentro, cada um com a
data, a hora e quem marcou. O rodape traz a hora em que o card inteiro fechou,
que e a do ultimo check dele.

Antes cada check virava um retangulo solto ali, e um card de seis checks
enchia a coluna com seis retangulos contando a mesma historia.

Card ainda pela metade entra na mesma lista, com o placar ("3 de 6") e a borda
em azul em vez de verde: esconde-lo faria o trabalho ja feito sumir da tela sem
ter para onde ir.

**Nao da para arrastar card entre colunas**, e isso e proposital. A
coluna nao e uma escolha, e uma consequencia: "Em andamento" quer dizer
que a etapa abriu, e "Concluida" que alguem marcou o check. Arrastar
para "Concluida" seria marcar o check por fora do controle de quem pode
marcar o que — a marcacao continua na tela da obra, onde essa regra vive.

O botao **Minhas / Todas** filtra pelo SETOR de quem esta logado. Quem
nao tem setor, ou nao tem nenhuma tarefa no dele, ve tudo — senao a tela
abriria vazia e pareceria quebrada.

### Dashboard

Tres perguntas, e todas as respostas saem de carimbos que o sistema **ja
fazia**: `obra.data_inicio`, `obra.concluida_em` e o `feito_em` de cada
check. Nao ha coluna nova, cronometro nem ninguem apontando hora.

**1. Duracao da obra** — de `data_inicio` (ou, sem ela, da data de
cadastro) ate `concluida_em`.

**2. Tempo de resposta, por setor ou por pessoa** — este merece leitura
atenta, porque o nome pode enganar. Nao existe "inicio da tarefa"
gravado em lugar nenhum: so o instante em que ela foi MARCADA. Entao o
que da para medir e o **intervalo entre uma marcacao e a seguinte dentro
da mesma obra** — quanto tempo a obra ficou parada esperando aquele
check depois que o anterior saiu. A primeira marcacao conta a partir do
inicio da obra.

O credito vai para **quem marcou** (`feito_por`), e nao para o setor
dono do check no roteiro: numa emergencia qualquer um pode marcar, e
atribuir o tempo a quem nao encostou na obra seria inventar numero.

**3. Atraso e adiantamento** — a unica que compara o combinado com o
acontecido: `data_conclusao` (prometida) contra `concluida_em` (real).
Positivo e depois do prazo, negativo e antes. Obra sem data combinada
fica de fora: nao da para estar atrasado em relacao a um prazo que nunca
existiu.

O painel olha a **empresa inteira**, e nao o setor de quem esta vendo —
media de uma pessoa so nao e media de nada. Por isso o filtro
Minhas/Todas some nessa aba.

> **Todo grafico depende de OBRA CONCLUIDA.** Enquanto nao houver uma,
> tres dos quatro numeros de cima aparecem como `—` e dois dos graficos
> mostram o motivo no lugar da barra. Isso e o desenho funcionando, nao
> um erro: media de zero obras nao existe, e um grafico vazio que nao
> explica por que esta vazio manda a pessoa procurar defeito onde nao
> ha.

As contas ficam em `src/pages/Home/Painel.jsx` e sao feitas em **dias
inteiros de calendario**, com `Date.UTC` nas duas pontas: subtrair dois
`new Date()` erra por uma hora em toda virada de horario de verao, e um
relatorio que muda de resultado em outubro nao serve para nada.

### Os graficos

Quatro, em `src/pages/Home/graficos.jsx`, **sem biblioteca nenhuma**:

| Peca | Onde entra |
|---|---|
| `Barras` | tempo de resposta por setor ou por pessoa |
| `Rosca` | a fatia de entregas no prazo |
| `Divergente` | atraso e adiantamento, obra a obra |
| `Colunas` | duracao das obras concluidas, com a linha da media |

Eles ficam **lado a lado** numa grade de duas colunas; os que precisam de
largura (um item por obra) atravessam as duas com `cartao--largo`. Abaixo de
1080px viram uma coluna so — com menos de 300px uteis o eixo e os nomes nao
cabem, e o desenho para de comparar.

Duas decisoes sustentam o arquivo dos graficos:

**1. O SVG e desenhado no tamanho real em pixels**, medido por
`ResizeObserver`, e nao num `viewBox` que estica. Num viewBox a letra do eixo
estica junto com o desenho: o mesmo grafico sairia com fonte de 9px numa coluna
estreita e de 18px numa larga. Medindo, o texto tem 11px em qualquer largura.

**2. A escala cai em numeros redondos** (0, 5, 10, 15), da familia
1 / 2 / 2,5 / 5 / 10 vezes uma potencia de dez. Eixo com marca em 8,7 obriga a
fazer conta para ler o grafico.

A rosca e feita com `stroke-dasharray` num circulo, e nao com um `path` de
arco: arco de 0% e arco de 100% sao os dois casos que quebram o desenho por
caminho (um vira um ponto, o outro nao fecha) — e sao justamente os dois que
este grafico mais mostra, "nenhuma atrasada" e "todas atrasadas".

## Obras

### "Urgente": a prioridade da emergencia

No banco a emergencia continua sendo `prioridade = 'alta'` — e o gatilho que
garante isso, e mexer no valor gravado obrigaria a migrar a coluna, o CHECK e
todas as obras antigas para ganhar uma palavra.

O que mudou e a LEITURA: onde a obra e de emergencia, a tela escreve
**"Urgente"**. "Alta" nao distinguia nada — a obra padrao tambem pode ser
alta, e as duas apareciam iguais no quadro.

A escolha do formulario continua sendo entre as **tres de sempre**, e so na
obra padrao. Urgente nao e uma quarta opcao a marcar; e o nome que a
emergencia da a prioridade que ela ja tem. A pastilha leva a cor da propria
emergencia, e nao o vermelho da alta.

Quem decide isso sao dois helpers em `src/domain/obras.js` —
`rotuloPrioridadeObra(obra)` e `tomPrioridadeObra(obra)` —, usados por toda
tela que escreve a palavra. Ja houve o dia em que um lugar dizia "média" e o
outro "Media".

### "Concluido em" no card

Quando o ULTIMO check da obra e marcado, o card do quadro passa a mostrar
**"Concluido em: [data e hora]"** no canto inferior direito, embaixo dos
avatares.

A hora e a da **ultima marcacao** — e ela que responde "quando ficou pronto".
Nao e a mesma coisa que `obra.concluida_em`, que e o carimbo do clique em
"Concluir obra". Enquanto esse clique nao vem, a obra continua no quadro — e e
exatamente ai que o carimbo serve, porque e o que faz alguem lembrar de
fechar.

### A data de conclusao

Na obra **padrao** ela e opcional: a data as vezes so se sabe depois. Na
**emergencia** e OBRIGATORIA, no formulario e na API.

Emergencia sem prazo e uma contradicao: sem uma data ate a qual aquilo
precisa estar resolvido, o que existe e uma obra urgente — e urgente ja e a
prioridade alta da obra padrao. Alem disso e o prazo que faz a obra aparecer
como **atrasada** na pagina inicial e entrar na conta de atraso do Dashboard;
sem ele, a emergencia seria a unica que nunca cobra ninguem.

A regra e conferida em dois lugares: a tela barra o envio, e a API repete a
checagem — quem chamasse `/api/dados/obras` direto passaria por cima da
primeira. Na EDICAO a API olha o banco, e nao so o corpo da chamada, porque ha
dois caminhos ate a mesma contradicao: apagar a data de uma emergencia que ja
existe, e transformar em emergencia uma obra padrao que esta sem data.

Na obra padrao sem data, a tela da obra mostra um **(!) piscando** no canto
superior direito do bloco "Data de conclusao". Ele nao e enfeite: sem prazo a
obra some dos dois unicos lugares que existem para cobra-la, e ninguem
percebe. O sinal e um botao — clicar abre o cadastro, que e onde a data se
preenche; aviso que aponta um buraco sem levar ate ele obriga a pessoa a
procurar sozinha onde conserta.

Ele pulsa devagar (1,6s) e nunca apaga de vez: a opacidade minima e 0,35.
Sinal que some inteiro vira um bloco vazio piscando. Para quem pediu menos
movimento no sistema ele fica firme, e o recado continua o mesmo.

Nao aparece na emergencia (la a data e obrigatoria no cadastro, entao o caso
nao existe) nem na obra ja concluida (o prazo daquela ja passou, e piscar
sobre registro fechado e ruido).

Uma obra pertence a um cliente e nasce **padrao** (card ciano) ou
**emergencia** (card laranja/vermelho). O quadro tem tres colunas: obras padrao,
obras emergencia e *enviar aviso* — esta ultima lista so as obras que tem setor
devendo informacao, com um botao por setor e um **Todos** que avisa todos os
pendentes daquela obra. O `+` do cabecalho dessa coluna avisa todas as obras de
uma vez.

### Observacao do quadro com duracao

O painel a direita do quadro guarda os recados que valem para as obras em
geral. Muitos deles valem **por um periodo**, nao para sempre ("ate sexta o
galpao fica fechado"), e ate aqui quem escrevia tinha de lembrar de voltar e
apagar. Quase nunca lembrava, e o painel virava um mural de recado vencido.

Marcando **Adicionar duracao** abrem os dois calendarios — *de* e *ate* —, os
dois **obrigatorios**: uma janela pela metade nao diz quando a observacao sai
do quadro, que e a unica coisa que a duracao existe para dizer. A regra e
conferida em tres lugares: o `min`/`max` cruzado dos campos, a conferencia no
envio e o `CHECK` da tabela.

Passada a data final, a observacao **sai do painel sozinha** e vai para a aba
**Historico** do pop-up. Ela nao e apagada: "o que estava valendo em marco?" e
uma pergunta legitima, e a resposta sumiria junto com a linha.

Duas coisas que **nao** entram no historico, de proposito:

- a observacao **sem duracao**, que nunca vence — fica no painel ate alguem
  apagar, como sempre foi;
- a observacao **apagada na mao** — quem clicou no lixo nao queria mais ver
  aquilo, e ressuscitar numa aba seria o contrario do gesto.

O corte usa `AAAA-MM-DD` comparado como **texto**. Nessa forma a ordem
alfabetica E a cronologica, entao nao ha `Date` nem fuso no meio para fazer a
observacao sumir um dia antes. As colunas sao `DATE` pelo mesmo motivo: o prazo
e "ate sexta", nao "ate sexta as 14h32".

Quem separa as duas listas e o `DadosContext`: `observacoesQuadro` (o que vale
hoje, e o que o painel mostra) e `historicoObservacoes` (o que venceu, da
vencida mais recente para a mais antiga).

### O card da obra

O card mostra a logo da empresa, **o n. da proposta e o nome do cliente**, a
etapa atual, a descricao, a prioridade com a data prevista e as fotos de quem
mexeu na obra. As etiquetas `[tec] [gq]` no canto superior direito sao os
setores que ainda devem informacao na etapa atual.

O titulo e `"1042/2026 - Acme"`: **o n. da proposta na frente**, porque e por
ele que a obra e procurada no resto da empresa — quem liga perguntando de uma
obra tem o numero da proposta na mao, e nao o nome da empresa (que costuma ter
cinco obras abertas ao mesmo tempo). Obra antiga, sem proposta cadastrada,
mostra so o nome do cliente. Quem monta e o `tituloDaObra()` de
`src/domain/obras.js`, para o card, a capa da obra, a lista de Concluidas e o
titulo do chat escreverem o MESMO nome.

**No cadastro da obra:** o n. da proposta e **obrigatorio** e a **descricao
virou opcional**. A obra ja e identificada pela dupla proposta + cliente, e
obrigar um texto livre so fazia aparecer "obra" e "-" no lugar da descricao.

**A prioridade e uma pastilha clara**, e nao texto colorido solto. O motivo e o
card de emergencia: ele ja e laranja-avermelhado, e o vermelho da prioridade
alta escrito por cima dele sumia. A saida anterior era desistir da cor ali —
so que ai a prioridade do card mais urgente do quadro era justamente a unica
que nao dava para reconhecer pela cor, que e para isso que a cor existe.

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

**Apagar uma mensagem pergunta para quem**, porque sao dois gestos diferentes:

| | O que acontece | Quem pode |
| --- | --- | --- |
| **Apagar para todos** | a mensagem some da conversa de todo mundo. A linha fica, vazia, com a marca *"mensagem apagada"* — o texto e o arquivo viram NULL no banco | so o autor (e o acesso total) |
| **Apagar para mim** | some so da sua tela; para os outros a conversa continua inteira | qualquer um, em qualquer mensagem |

A marca do "para todos" nao e enfeite: sem ela, quem tivesse respondido a
mensagem apagada ficaria com uma resposta solta no meio da conversa, sem
entender a que. O "para mim" e uma linha em `obra_chat_oculta`, filtrada na
leitura — e por isso ele e o **padrao** da rota: uma chamada sem `escopo` nao
apaga a mensagem de outras pessoas.

O pop-up de escolha so oferece o "para todos" na propria mensagem. Na de outra
pessoa ha um caminho so, e perguntar ali seria oferecer uma escolha que nao
existe.

As **etiquetas** rotulam a obra: o botao *Adicionar etiqueta* fica sempre em
primeiro, as etiquetas ja postas logo abaixo, e o lapis de cada uma na direita —
e dentro da edicao que mora o Excluir. A etiqueta e do sistema: a mesma pode
marcar varias obras, e some da lista quando nao esta em nenhuma.

Os **anexos** guardam os documentos da obra (ate 4 MB cada). A lista que chega
com o quadro traz so nome, tipo e tamanho; o arquivo em si so e buscado no
clique de baixar — senao cada carregamento arrastaria todos os documentos de
todas as obras junto.

### Quem pode editar o que

Cada setor mexe so nas tarefas do proprio setor: o ADM nao fecha tarefa do
Tecnico. O bloco do outro setor continua visivel (da para acompanhar), mas com
cadeado, o check riscado em diagonal, o cursor de bloqueado e o botao
desabilitado — **nao da nem para clicar**.

Tres saidas dessa regra:

- o setor com **acesso total** (`cargo.acesso_total`, a diretoria);
- a permissao **check em todas as etapas**;
- obra de **emergencia** — ali ninguem espera o setor certo.

A regra vive em `podeEditarCheck()` de `src/domain/obras.js` e vale junto com a
trava de etapa: uma etapa que ainda nao abriu continua travada mesmo para a
diretoria.

**A tela e o servidor precisam responder a MESMA coisa.** Havia dois atalhos so
no cliente — o texto `'todos'` na lista antiga de permissoes e a chave do setor
ser `diretor` — que o servidor nao conhecia. O efeito era o check que **marcava
e desmarcava sozinho**: a tela liberava o clique, a gravacao era recusada e o
recarregamento devolvia o check ao estado anterior, meio segundo depois. Hoje
`temAcessoTotal()` le so a marca `acessoTotal`, a mesma coluna que o
`meuCargo()` do servidor consulta.

Alem disso, `alternarCheck()` (no `DadosContext`) faz a pergunta **antes** de
mexer na tela: check de outro setor nao chega a piscar, e obra concluida nem
aceita o clique.

### Membros da obra

**Membro e quem MARCOU algum check nela** — mais ninguem.

Dois gatilhos no banco cuidam disso: `obra_check_entra` poe a pessoa na lista
quando ela marca, e `obra_check_sai` a tira quando ela desmarca o ultimo check
dela naquela obra. Sem o segundo, quem marcasse por engano e desmarcasse ficava
como participante para sempre.

Na tela, obra sem nenhum check marcado mostra "ninguem marcou check ainda". Ela
mostrava os quatro primeiros da equipe como se fossem os participantes — gente
que nunca tinha encostado naquela obra aparecendo como responsavel por ela.

### Setor e cargo

Sao duas coisas diferentes, e a confusao entre elas custa caro:

| | **Setor** | **Cargo** |
| --- | --- | --- |
| O que e | o grupo da equipe: Comercial, Excelencia, GQ | o titulo da pessoa: "Analista de Qualidade" |
| De onde vem | uma lista cadastrada (tela Usuarios > **Setores**) | texto livre no cadastro dela |
| Obrigatorio? | sim | nao |
| Decide permissao? | **sim — tudo** | nao, nada |
| Onde mora | `usuario.cargo_id` -> tabela `cargo` | `usuario.cargo_titulo` |

**Todas as permissoes saem do SETOR.** Dois analistas e um coordenador do mesmo
setor podem exatamente as mesmas coisas — o cargo e informacao, nao poder.

> **Nota para quem le o codigo:** a tabela do banco continua se chamando
> `cargo`, e no front os campos ainda sao `cargo`, `cargoNome`, `cargoCor`,
> `cargoPorChave`. Renomear a tabela derrubaria as chaves estrangeiras de meia
> duzia de outras (`etapa_card_cargo`, `etapa_check_cargo`, `obra_aviso_cargo`)
> e os trinta pontos do front que leem esses campos — sem mudar nada do que o
> sistema faz. Na TELA, tudo isso se chama Setor. O cargo especifico e o campo
> novo, `cargoTitulo`.

Setores sao cadastrados na tela **Usuarios** (botao *Setores*): nome, sigla,
**cor** e a marca de acesso total. A cor escolhida ali pinta as etiquetas
`[tec] [gq]` do card, os blocos das etapas e as tarjas dos cards de usuario —
nao ha cor de setor fixa no CSS.

Os cinco setores que as etapas usam (`fixo = true`) mudam de nome e de cor, mas
nao podem ser apagados. Setor em uso por algum usuario tambem nao.

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

### Concluir a obra

Marcar o ultimo check **nao fecha mais a obra sozinho**. Ele so faz aparecer, a
**direita do Progresso**, o botao **Concluir obra** — e o botao so existe com a
barra em 100%, com todos os checks marcados e para quem pode editar obra.

Ele fica ao LADO da barra, e nao embaixo dela: embaixo, ao aparecer, empurrava
a faixa inteira de informacoes para baixo justamente no momento em que a pessoa
estava olhando para ela. Ao lado, a faixa nao muda de altura — o botao nasce no
espaco que ja existia a direita.

Sao dois passos depois disso: um formulario com a **observacao do
encerramento** (opcional) e uma segunda confirmacao, que e onde a obra fecha de
verdade. Dai ela sai do quadro e passa a viver em Concluidas.

Antes o fechamento era automatico: no instante em que o ultimo check era
marcado, a obra sumia do quadro sem ninguem decidir nada — e um check marcado
por engano a levava junto. Agora sao duas perguntas diferentes, e o codigo as
separa:

```js
obraConcluida(roteiro, checks) // "marcou tudo?"      -> o botao aparece
obraFechada(obra)              // "alguem concluiu?"  -> sai do quadro
```

Quem responde a segunda e a coluna `obra.concluida_em`, carimbada no clique. A
view `obra_conclusao` continua existindo e agora responde so a primeira.

### Concluidas

Obra concluida vai para **Concluidas**, agrupada por **ano** (no topo,
selecionavel) e por **mes** — cada mes ocupa a linha inteira e mostra quantas
fecharam, quantas eram emergencia e a nota media. Clicando no mes, ele abre e
lista as obras.

A data que agrupa e `obra.concluidaEm`: a hora em que alguem clicou em Concluir
obra. Cada linha mostra tambem **quem** concluiu.

**Excluir** uma obra concluida tem permissao propria — `excluir_concluidas` — e
nao sai de `editar_obras`. Nao e a mesma coisa: aqui nao se mexe em trabalho em
andamento, apaga-se o REGISTRO do que a empresa entregou, com a rastreabilidade,
o chat, as observacoes, as etiquetas, os anexos e as avaliacoes junto. Sem a
permissao o lixo nem aparece na linha, e a API recusa do mesmo jeito.

O lixo fica FORA do botao que abre a obra, e nao dentro: um botao dentro de
outro e onde o clique erra de alvo, e aqui errar significa apagar o registro de
uma obra entregue.

### Usuarios e setores

**Adicionar colaborador** pede foto, nome, nascimento, CPF, e-mail, telefone,
**setor** e **cargo**. Passando o mouse pelo card aparecem os botoes de editar
e excluir.

**Obrigatorios: nome, nascimento, CPF e setor.** E-mail, telefone, cargo e foto
sao opcionais. E-mail e telefone eram obrigatorios e travavam o cadastro de
quem trabalha em campo e nao tem e-mail corporativo — quem nao tem e-mail
**entra pelo CPF**, que o login ja aceita no mesmo campo. Preenchidos, os dois
continuam sendo validados: o que a validacao deve pegar e o dedo trocado, nao a
ausencia.

Colaborador novo entra com a **senha padrao 123456** e com `senha_temporaria`
ligado. A coluna continua sendo gravada, mas **nenhuma tela cobra mais a
troca**: a faixa amarela que aparecia no alto de todas as paginas e o alerta que
ficava dentro de Configuracoes > Senha foram removidos. Trocar a senha continua
sendo em Configuracoes > Senha, por quem quiser.

Excluir **desativa** o acesso (`ativo = false`) em vez de apagar, para o
historico das obras nao perder quem marcou o que.

A lista filtra por **nome** (campo de busca, que tambem acha por e-mail) e por
**setor** — e da para marcar mais de um setor ao mesmo tempo.

O **CPF nao muda depois de cadastrado**: na edicao o campo fica travado e a rota
`PATCH /api/equipe/usuarios/:id` recusa o campo. Para trocar, apaga-se o
cadastro e faz-se um novo — do jeito que a coluna UNIQUE do banco espera.

**Setores** abre a lista em uma linha so de etiquetas coloridas — ADM | GQ |
EXCELENCIA — que quebra quando chega no fim do pop-up. Clicar em uma delas ja
abre a edicao em OUTRO pop-up por cima, com **Excluir** ao lado de **Salvar**.

O "acesso total" de um setor aparece SO no formulario dele. Em nenhuma outra
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
