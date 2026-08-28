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

O schema completo esta em **`db/usuario.sql.txt`** — rode no editor SQL na
ordem indicada no arquivo (cria o banco, a tabela `usuario`, as travas e o
usuario inicial). Para conferir sem tocar no banco de verdade:

```bash
npm run db:validar
```

Ele cria um banco descartavel, roda o script inteiro, testa as restricoes e a
protecao do usuario id=1, e apaga o banco no fim.

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

| Rota da API            | O que faz                                    |
| ---------------------- | -------------------------------------------- |
| `POST /api/auth/login` | recebe `{ identifier, password }`             |
| `GET /api/auth/me`     | devolve o usuario do token (Bearer)          |
| `GET /api/health`      | diz se o banco responde e se a tabela existe |

Usuario e senha errados devolvem a mesma mensagem, de proposito: nao entrega a
quem tenta adivinhar qual e-mail existe no sistema.

## Estrutura

```
src/
├── assets/                 # imagens importadas pelo bundler
├── components/
│   ├── Button/             # botao com gradiente e reflexo
│   ├── GlassCard/          # superficie liquid glass (blur + refracao + brilho)
│   ├── AppShell/           # barra lateral + barra superior da area logada
│   ├── CookieConsent/      # aviso de cookies + leitura do consentimento
│   ├── LiquidGlass/        # filtros SVG (refracao e ruido)
│   ├── ThemeToggle/        # botao lua/sol, fixo no canto superior direito
│   ├── SocialRow/          # entrar com Outlook
│   └── TextField/          # campo com label flutuante
├── context/
│   ├── AuthContext.jsx     # sessao, login, logout, persistencia
│   └── ThemeContext.jsx    # tema claro/escuro (padrao: claro)
├── hooks/
│   ├── usePointerGlow.js   # brilho especular que segue o ponteiro
│   └── useMediaQuery.js    # troca de layout desktop/mobile
├── pages/
│   ├── Login/              # tela de login (foto + faixas de vidro + cartao)
│   ├── Privacy/            # politica de privacidade (texto provisorio)
│   └── Home/               # tela inicial apos o login (usa o AppShell)
├── routes/                 # rotas e guarda de rota
├── services/authService.js # camada de autenticacao
├── utils/pessoa.js         # saudacao pelo horario, iniciais, primeiro nome
└── styles/                 # tokens e estilos globais

server/
├── index.js                # API Express
├── db.js                   # pool do PostgreSQL
├── routes/auth.js          # login e sessao
└── scripts/                # gerar hash de senha, validar o SQL

db/usuario.sql.txt          # schema + usuario inicial (rodar no editor SQL)
```

## Rotas

| Rota                        | Tela                   | Acesso    |
| --------------------------- | ---------------------- | --------- |
| `/login`                    | Login                  | publico   |
| `/politica-de-privacidade`  | Politica de privacidade| publico   |
| `/app`                      | Tela inicial           | protegido |

Sem sessao, `/app` redireciona para `/login`. Ao entrar, o usuario volta para a
rota que tentou acessar (ou `/app`).

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

O botao primario e azul escuro nos dois temas (`--btn-bg` / `--btn-fg`); no
escuro ele clareia um pouco para se ler sobre o preto.

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
