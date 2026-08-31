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

O schema esta em **dois arquivos, nesta ordem**:

| Arquivo               | O que cria                                                    |
| --------------------- | ------------------------------------------------------------- |
| `db/usuario.sql.txt`  | o banco, a tabela `usuario`, as travas e o usuario inicial     |
| `db/sistema.sql.txt`  | cargos, clientes, obras, tarefas, observacoes e avaliacoes     |

Rode o primeiro na ordem indicada dentro dele; depois rode o segundo inteiro,
conectado ao banco `TrajetoClientes`. O segundo e **idempotente**: pode rodar de
novo sem quebrar nada do que ja existe.

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
| `GET /api/equipe/usuarios`      | equipe com cargo, cor e media das avaliacoes |
| `PATCH /api/equipe/usuarios/:id` | edita o cadastro (nunca o CPF)              |

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
│   ├── dadosService.js     # persistencia das obras/clientes (localStorage)
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
├── routes/auth.js          # login e sessao
├── routes/equipe.js        # cargos e usuarios
└── scripts/                # gerar hash de senha, validar o SQL

db/
├── usuario.sql.txt         # PARTE 1: banco, tabela usuario, travas
└── sistema.sql.txt         # PARTE 2: cargos, clientes, obras, avaliacoes
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
carimbo de data/hora. Obra com as cinco etapas fechadas sai do quadro e vai para
**Concluidas**.

### Quem pode editar o que

Cada cargo mexe so nas tarefas do proprio setor: o ADM nao fecha tarefa do
Tecnico. O bloco do outro setor continua visivel (da para acompanhar), mas com
cadeado e as tarefas desabilitadas.

A excecao e o cargo com **acesso total** (`cargo.acesso_total` no banco, a
diretoria): esse edita qualquer setor. A regra vive em `podeEditarSetor()` de
`src/domain/obras.js` e vale junto com a trava de etapa — uma etapa que ainda
nao abriu continua travada mesmo para a diretoria.

### Cargos

Cargos sao cadastrados na tela **Usuarios** (botao *Adicionar cargo*): nome,
sigla, **cor** e a marca de acesso total. A cor escolhida ali pinta as
etiquetas `[tec] [gq]` do card, os blocos das etapas e as tarjas dos cards de
usuario — nao ha cor de setor fixa no CSS.

Os cinco cargos que as etapas usam (`fixo = true`) mudam de nome e de cor, mas
nao podem ser apagados. Cargo em uso por algum usuario tambem nao.

### Avaliacoes

A nota e **da obra**, nao da pessoa: a empresa avalia o servico prestado e
escreve uma descricao. Toda obra comeca como *sem avaliacao*; clicando no card
abre o pop-up com a nota, a descricao e a lista de quem participou.

**A nota de cada usuario e a media das obras avaliadas em que ele entrou** — 8
numa obra e 5 em outra dao 6.5. Ela aparece na tela de Usuarios. No banco isso e
a view `usuario_media`; no front, o `mediaDoUsuario()` do `DadosContext`.

### Concluidas

Obra com as cinco etapas fechadas sai do quadro e vai para **Concluidas**,
agrupada por **ano** (no topo, selecionavel) e por **mes** — cada mes ocupa a
linha inteira e mostra quantas fecharam, quantas eram emergencia e a nota media.
Clicando no mes, ele abre e lista as obras.

A data que agrupa e `obra.concluidaEm`, carimbada quando a ultima tarefa fecha
(e apagada se alguem reabrir a obra). No banco isso e a view `obra_conclusao`.

### Usuarios e cargos

**Adicionar colaborador** pede exatamente o que a tabela `usuario` guarda: foto,
nome, nascimento, CPF, e-mail, cargo e telefone. Passando o mouse pelo card
aparecem os botoes de editar e excluir.

O **CPF nao muda depois de cadastrado**: na edicao o campo fica travado e a rota
`PATCH /api/equipe/usuarios/:id` recusa o campo. Para trocar, apaga-se o
cadastro e faz-se um novo — do jeito que a coluna UNIQUE do banco espera.

**Adicionar cargo** abre a lista dos cargos ja cadastrados, com edicao (nome,
sigla, cor, acesso total) e exclusao no mesmo lugar.

### Onde os dados moram

**Cargos e usuarios** vem do banco (`/api/equipe`, em `server/routes/equipe.js`)
assim que `db/sistema.sql.txt` for rodado. Enquanto isso a API responde 503, o
front cai na equipe de exemplo do `localStorage` e a tela de Usuarios avisa.

**Obras, clientes e avisos** ainda ficam so no `localStorage` (chave
`customers.dados.v2`), atras de `src/services/dadosService.js`. As tabelas ja
existem no SQL; nenhuma tela fala com o storage direto, entao trocar o corpo
dessas funcoes por `fetch('/api/...')` nao muda as telas.

O cadastro de cliente usa duas APIs publicas, sem chave: **ViaCEP** (o CEP
preenche endereco, bairro, cidade e estado) e **IBGE** (listas de estados e de
cidades). Se qualquer uma falhar, os campos continuam editaveis na mao.

A tarja colorida do card do cliente sai da **cor predominante da logo**
(`src/utils/corDaImagem.js`): a imagem e reduzida num canvas e os pixels sao
agrupados em baldes de cor, descartando branco, preto e cinza — senao quase toda
logo devolveria "branco". Sem logo, entra a cor derivada do nome.

## Temas

Fundo **preto e branco**, com **azul escuro** nas acoes (botoes, foco, checkbox,
selecao de texto) via `--accent`. O site abre no **modo claro**
(fundo branco); o botao lua/sol no canto superior direito troca para o escuro
(fundo preto) e guarda a escolha em `localStorage` (`customers.theme`).

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
