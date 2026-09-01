/* ============================================================
   Permissoes do cargo.

   Sao dois grupos:

     VISUALIZACAO — que abas o cargo enxerga no menu;
     ALTERACAO    — o que ele pode mexer dentro delas.

   A regra que amarra os dois: alteracao SEMPRE depende da
   visualizacao correspondente. Se o cargo nao ve Obras, ele
   nao edita obra, nem etapa, nem card, nem check — a tela
   trava sozinha (`dependeDe`) e o servidor recusa igual.

   Cargo novo nasce com a lista VAZIA: quem administra marca
   uma a uma. A unica excecao e o cargo com `acessoTotal`
   (diretoria), que passa por tudo sem depender da lista.
   ============================================================ */

/** Toda permissao de visualizacao. A ordem e a que aparece na tela. */
export const VISUALIZACAO = [
  { chave: 'ver_inicio', rotulo: 'Página inicial', rota: '/app' },
  { chave: 'ver_obras', rotulo: 'Obras', rota: '/app/obras' },
  { chave: 'ver_clientes', rotulo: 'Clientes', rota: '/app/clientes' },
  { chave: 'ver_concluidas', rotulo: 'Concluídas', rota: '/app/concluidas' },
  { chave: 'ver_avaliacoes', rotulo: 'Avaliações', rota: '/app/avaliacoes' },
  { chave: 'ver_avisos', rotulo: 'Enviar avisos', rota: null },
]

/**
 * Toda permissao de alteracao.
 *
 * `dependeDe` e a permissao de visualizacao que ela exige. Sem
 * aquela marcada, esta fica travada na tela e cai fora na hora de
 * salvar — nao adianta o cargo poder editar obra se ele nem
 * consegue abrir a aba.
 */
export const ALTERACAO = [
  {
    chave: 'editar_usuario',
    rotulo: 'Adicionar / editar usuário',
    dependeDe: null,
    nota: 'Sem esta, a pessoa só edita o próprio cadastro em Configurações (e nunca o CPF).',
  },
  { chave: 'editar_cargo', rotulo: 'Adicionar / editar cargo', dependeDe: null },
  { chave: 'editar_avaliacoes', rotulo: 'Adicionar / editar avaliações', dependeDe: 'ver_avaliacoes' },
  { chave: 'editar_clientes', rotulo: 'Adicionar / editar clientes', dependeDe: 'ver_clientes' },
  { chave: 'editar_obras', rotulo: 'Adicionar / editar obras', dependeDe: 'ver_obras' },
  {
    chave: 'check_todas_etapas',
    rotulo: 'Check em todas as etapas',
    dependeDe: 'ver_obras',
    nota: 'Sem esta, a pessoa só marca os checks do próprio cargo — exceto em obra de emergência.',
  },
  { chave: 'editar_etapa', rotulo: 'Adicionar / alterar etapa', dependeDe: 'ver_obras' },
  { chave: 'editar_cards', rotulo: 'Adicionar / alterar cards', dependeDe: 'ver_obras' },
  { chave: 'editar_cargos_card', rotulo: 'Adicionar / alterar cargos no card', dependeDe: 'ver_obras' },
  { chave: 'editar_checks', rotulo: 'Adicionar / alterar checks', dependeDe: 'ver_obras' },
  {
    chave: 'enviar_avisos',
    rotulo: 'Enviar avisos',
    dependeDe: 'ver_avisos',
    nota: 'Sem esta, a pessoa vê a coluna de avisos mas não consegue disparar nenhum.',
  },
]

export const TODAS = [...VISUALIZACAO, ...ALTERACAO]

/** So as chaves, na ordem — e o que vai para o banco. */
export const CHAVES = TODAS.map((p) => p.chave)

const PARA_ROTA = Object.fromEntries(
  VISUALIZACAO.filter((p) => p.rota).map((p) => [p.rota, p.chave]),
)

/** A permissao de visualizacao que uma rota exige, ou null se e livre. */
export function permissaoDaRota(rota) {
  return PARA_ROTA[rota] ?? null
}

const DEPENDENCIA = Object.fromEntries(
  ALTERACAO.filter((p) => p.dependeDe).map((p) => [p.chave, p.dependeDe]),
)

/**
 * Limpa a lista antes de gravar: alteracao sem a visualizacao dela
 * nao entra, e chave desconhecida some. E o mesmo tratamento no
 * servidor, para nao depender do que a tela mandou.
 */
export function normalizar(lista) {
  const marcadas = new Set((lista ?? []).filter((c) => CHAVES.includes(c)))
  Object.entries(DEPENDENCIA).forEach(([alteracao, visualizacao]) => {
    if (!marcadas.has(visualizacao)) marcadas.delete(alteracao)
  })
  return CHAVES.filter((c) => marcadas.has(c))
}

/** true quando a permissao de alteracao esta travada pela falta da visualizacao. */
export function travada(chave, lista) {
  const exigida = DEPENDENCIA[chave]
  return Boolean(exigida) && !(lista ?? []).includes(exigida)
}

/** As alteracoes que caem junto quando essa visualizacao e desmarcada. */
export function dependentes(chaveVisualizacao) {
  return ALTERACAO.filter((p) => p.dependeDe === chaveVisualizacao).map((p) => p.chave)
}

/* ------------------------------------------------------------
   Leitura no resto do sistema
   ------------------------------------------------------------ */

/**
 * O usuario pode?
 *
 * Cargo com acesso total passa sempre — e a diretoria, e ela nao
 * fica travada por lista. Fora isso, vale o que esta marcado no
 * cargo. Sem cargo nenhum, nao pode nada.
 */
export function podeFazer(usuario, chave) {
  if (!usuario) return false
  if (usuario.acessoTotal) return true
  return (usuario.cargoPermissoes ?? usuario.permissoes ?? []).includes(chave)
}

/** As abas do menu que este usuario enxerga. */
export function abasVisiveis(usuario) {
  return VISUALIZACAO.filter((p) => p.rota && podeFazer(usuario, p.chave)).map((p) => p.rota)
}
