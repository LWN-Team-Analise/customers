/* ============================================================
   Regras de dominio das obras.

   O roteiro (etapas > cards > checks) NAO mora mais aqui: ele e
   cadastro, vem do banco e a tela de obra cria e apaga etapa,
   card e check. O que sobra neste arquivo sao as regras que leem
   esse roteiro — quem fechou, quem falta, quem pode marcar.

   Vocabulario:
     roteiro  = [{ id, numero, nome, cards: [...] }]
     card     = { id, titulo, cargos: ['gq', ...], checks: [...] }
     marcados = { [checkId]: { feitoPor, feitoEm } } — o que a obra ja fez

   Tudo aqui e funcao pura (sem React) para servir tanto as telas
   quanto o contexto.
   ============================================================ */

import { podeFazer } from './permissoes'

export const PRIORIDADES = [
  { id: 'baixa', rotulo: 'Baixa' },
  { id: 'media', rotulo: 'Média' },
  { id: 'alta', rotulo: 'Alta' },
]

/**
 * Como a prioridade se escreve na tela.
 *
 * As tres so com a inicial maiuscula. Quem faz a alta saltar da lista e a
 * COR (vermelho), nao a caixa alta — que gritava no meio de um card ja
 * cheio de informacao.
 *
 * Vive aqui, e nao em cada tela, porque o card do quadro, a tela da obra,
 * o filtro e o pop-up de cadastro escrevem a MESMA palavra — e ja houve
 * o dia em que um deles dizia "média" e o outro "Media".
 */
export const PRIORIDADE_ROTULO = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

/** O rotulo de uma prioridade, com reserva para valor desconhecido. */
export function rotuloDaPrioridade(id) {
  return PRIORIDADE_ROTULO[id] ?? id ?? "—"
}

export const PRIORIDADE_PESO = { alta: 3, media: 2, baixa: 1 }

export const TIPOS = [
  { id: 'padrao', rotulo: 'Obra padrão' },
  { id: 'emergencia', rotulo: 'Obra emergência' },
]

/** Emergencia nasce e continua alta: a tela nem oferece a escolha. */
export const PRIORIDADE_FIXA = { emergencia: 'alta' }

export function prioridadeDaObra({ tipo, prioridade }) {
  return PRIORIDADE_FIXA[tipo] ?? prioridade
}

export function prioridadeTravada(tipo) {
  return tipo in PRIORIDADE_FIXA
}

/** O rotulo da etapa sai da posicao: 1 -> "1ª Etapa". */
export function rotuloDaEtapa(numero) {
  return `${numero}ª Etapa`
}

/* ------------------------------------------------------------
   O nome da obra na tela

   Uma obra se chama "1042/2026 - Acme": primeiro o n. da
   proposta, depois o cliente. E nessa ordem porque e assim que
   ela e procurada — quem liga perguntando de uma obra tem o
   numero da proposta na mao, nao o nome da empresa (que costuma
   ter cinco obras abertas ao mesmo tempo).

   Vive aqui, e nao em cada tela, porque o card do quadro, a
   capa da obra, a lista de Concluidas, o chat e o sininho
   escrevem o MESMO nome — e obra antiga, sem proposta, precisa
   cair no nome do cliente sozinho em todos eles.
   ------------------------------------------------------------ */

export function tituloDaObra(obra, cliente) {
  const nome = cliente?.nome ?? 'Cliente removido'
  const proposta = String(obra?.proposta ?? '').trim()
  return proposta ? `${proposta} - ${nome}` : nome
}

/* ------------------------------------------------------------
   O roteiro que CADA obra enxerga

   O roteiro anda para a frente: o que e criado dentro de uma
   obra vale para ela e para as proximas, e o que e excluido
   some dela em diante — as anteriores continuam com o roteiro
   que tinham no dia em que nasceram.

   Quem carimba isso e o servidor, em vigenteDe/vigenteAte de
   cada etapa, card e check. Aqui a gente so aplica a janela:

       vigenteDe <= nascimento < vigenteAte

   Depois de filtrar, as etapas sao renumeradas (1ª, 2ª, 3ª...)
   dentro da propria obra: se a 2ª etapa saiu do roteiro em
   maio, a obra de junho ve a antiga 3ª como a sua 2ª.
   ------------------------------------------------------------ */

const dentroDaJanela = (peca, quando) => {
  if (!quando) return !peca?.vigenteAte
  const t = new Date(quando).getTime()
  const de = peca?.vigenteDe ? new Date(peca.vigenteDe).getTime() : -Infinity
  const ate = peca?.vigenteAte ? new Date(peca.vigenteAte).getTime() : Infinity
  return de <= t && t < ate
}

/**
 * O roteiro como ele estava (e continua) para uma obra criada em
 * `nascimento`. Sem data, devolve o roteiro que vale hoje.
 */
export function roteiroVigente(roteiro, nascimento) {
  const quando = nascimento ?? new Date().toISOString()

  return (roteiro ?? [])
    .filter((etapa) => dentroDaJanela(etapa, quando))
    .map((etapa, indice) => ({
      ...etapa,
      // a numeracao e da OBRA, nao do cadastro: sem buraco na fila
      numero: indice + 1,
      cards: (etapa.cards ?? [])
        .filter((card) => dentroDaJanela(card, quando))
        .map((card) => ({
          ...card,
          checks: (card.checks ?? []).filter((check) => dentroDaJanela(check, quando)),
        })),
    }))
}

/* ------------------------------------------------------------
   Leitura do que ja foi feito
   ------------------------------------------------------------ */

const feito = (marcados, checkId) => Boolean(marcados?.[checkId])

/**
 * Card sem nenhum check nao entra na conta de nada.
 *
 * E o estado de quem acabou de criar o card e ainda nao escreveu os
 * checks. Se ele contasse, um card vazio deixaria a etapa travada em
 * TODAS as obras ate alguem lembrar de preencher — e ninguem ia
 * descobrir o porque.
 */
const cardVale = (card) => (card?.checks?.length ?? 0) > 0

/** Card fechado = todos os checks dele marcados. */
export function cardConcluido(card, marcados) {
  if (!cardVale(card)) return false
  return card.checks.every((c) => feito(marcados, c.id))
}

/** Etapa fecha quando todos os cards que valem fecharam. */
export function etapaConcluida(etapa, marcados) {
  const valem = (etapa?.cards ?? []).filter(cardVale)
  if (valem.length === 0) return false
  return valem.every((card) => cardConcluido(card, marcados))
}

/** Cargos que ainda devem informacao na etapa — vira [téc] [gq] no card. */
export function setoresPendentes(roteiro, marcados, numeroEtapa) {
  const etapa = roteiro?.find((e) => e.numero === numeroEtapa)
  if (!etapa) return []
  const pendentes = etapa.cards
    .filter((card) => cardVale(card) && !cardConcluido(card, marcados))
    .flatMap((card) => card.cargos)
  return [...new Set(pendentes)]
}

/** Quantos cards da etapa contam para o placar "2/3". */
export function cardsQueValem(etapa) {
  return (etapa?.cards ?? []).filter(cardVale)
}

/** Etapa em andamento: a primeira que ainda nao fechou. */
export function etapaAtual(roteiro, marcados) {
  const aberta = roteiro?.find((e) => !etapaConcluida(e, marcados))
  return aberta ? aberta.numero : (roteiro?.length ?? 1)
}

/**
 * true quando todas as etapas do roteiro fecharam.
 *
 * ATENCAO: isto e "marcou tudo", nao "a obra acabou". Sao coisas
 * diferentes desde que a conclusao virou um clique:
 *
 *   obraConcluida()  -> nao sobrou check em aberto. E o que faz o
 *                       botao "Concluir obra" aparecer;
 *   obraFechada()    -> alguem clicou nele. E o que tira a obra do
 *                       quadro e a leva para Concluidas.
 *
 * Antes as duas eram a mesma coisa, e um check marcado por engano
 * mandava a obra inteira para o arquivo sem ninguem decidir nada.
 */
export function obraConcluida(roteiro, marcados) {
  if (!roteiro?.length) return false
  return roteiro.every((e) => etapaConcluida(e, marcados))
}

/**
 * A obra foi ENCERRADA por alguem?
 *
 * O carimbo vem do banco (obra.concluida_em), gravado no clique do
 * "Concluir obra". Enquanto ele for nulo a obra continua no quadro,
 * mesmo com todos os checks marcados.
 */
export function obraFechada(obra) {
  return Boolean(obra?.concluidaEm)
}

/**
 * A obra esta pronta para ser concluida?
 *
 * Tres condicoes, e as tres precisam valer:
 *   - ainda esta aberta (nao adianta concluir duas vezes);
 *   - o roteiro dela tem check (obra sem roteiro nao "acaba");
 *   - nao sobrou nenhum check por marcar.
 */
export function prontaParaConcluir(roteiro, obra) {
  if (obraFechada(obra)) return false
  return obraConcluida(roteiro, obra?.checks)
}

/** Percentual concluido da obra (0–100), usado nas barras de progresso. */
export function progressoDaObra(roteiro, marcados) {
  const todos = (roteiro ?? []).flatMap((e) => e.cards.flatMap((c) => c.checks))
  if (todos.length === 0) return 0
  return Math.round((todos.filter((c) => feito(marcados, c.id)).length / todos.length) * 100)
}

/**
 * Estado da etapa na tela de detalhe:
 *  'concluida' | 'atual' | 'bloqueada'
 *
 * Obra PADRAO anda em fila: so a etapa atual aceita marcacao e as
 * seguintes ficam com cadeado ate a anterior fechar.
 * Obra EMERGENCIA abre todas de uma vez — numa emergencia ninguem pode
 * ficar esperando a etapa anterior fechar para agir.
 */
export function estadoDaEtapa(roteiro, obra, numero) {
  const marcados = obra?.checks ?? {}
  const etapa = roteiro?.find((e) => e.numero === numero)
  if (etapaConcluida(etapa, marcados)) return 'concluida'
  if (obra?.tipo === 'emergencia') return 'atual'
  const anteriores = (roteiro ?? []).filter((e) => e.numero < numero)
  return anteriores.every((e) => etapaConcluida(e, marcados)) ? 'atual' : 'bloqueada'
}

/* ------------------------------------------------------------
   Quem pode o que
   ------------------------------------------------------------ */

/**
 * A chave do cargo de quem esta logado. Vem do banco
 * (usuario.cargoChave) e cai no texto de usuario.cargo quando a tabela
 * cargo ainda nao existe.
 */
export function chaveDoCargo(usuario) {
  if (!usuario) return null
  if (usuario.cargoChave) return usuario.cargoChave
  // sem a tabela cargo, normaliza o texto livre: "Técnico" -> "tecnico"
  return (
    String(usuario.cargo ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || null
  )
}

/**
 * Setor com acesso total (diretoria).
 *
 * Le SO a marca `acessoTotal`, que e a mesma coluna que o servidor
 * consulta em `meuCargo()`. Ja houve aqui dois atalhos a mais — o
 * texto 'todos' na lista antiga e a chave do setor ser "diretor" —
 * e eles eram a origem do check que marcava e desmarcava sozinho:
 * a tela liberava o clique, o servidor recusava a gravacao e o
 * recarregamento devolvia o check ao estado anterior. Cliente e
 * servidor precisam responder a MESMA coisa.
 */
export function temAcessoTotal(usuario) {
  return Boolean(usuario?.acessoTotal)
}

/* reexportado porque quase toda tela ja importa deste arquivo; a
   lista de permissoes em si mora em src/domain/permissoes.js */
export { podeFazer }

/** Somente a diretoria mexe no CPF — trava de setor, nao de permissao. */
export function podeEditarCpf(usuario) {
  return chaveDoCargo(usuario) === 'diretor'
}

/**
 * Quem marca os checks de um card.
 *
 * Cada cargo mexe so no que e dele: o ADM nao fecha check do Tecnico.
 * Card de mais de um cargo aceita qualquer um deles. A excecao e o cargo
 * com acesso total (diretoria), que edita qualquer card.
 */
export function podeEditarCard(usuario, card) {
  if (!usuario) return false
  if (temAcessoTotal(usuario)) return true
  return (card?.cargos ?? []).includes(chaveDoCargo(usuario))
}

/**
 * De quem e um check.
 *
 * Normalmente e de quem e o card. Mas o check pode ter dono proprio — e
 * ai a lista DELE manda, e a do card nao entra. E o que permite pendurar
 * "Envio revisao externa" em GQ + Excelencia sem transformar o card
 * inteiro em "GQ + Excelencia".
 */
export function cargosDoCheck(check, card) {
  const proprios = check?.cargos ?? []
  return proprios.length > 0 ? proprios : (card?.cargos ?? [])
}

/** true quando o check tem dono diferente do card — a tela marca isso. */
export function checkTemDonoProprio(check) {
  return (check?.cargos ?? []).length > 0
}

/**
 * Quem marca ESTE check.
 *
 * Tres portas de saida da regra "so o seu cargo":
 *   - acesso total (diretoria);
 *   - a permissao "check em todas as etapas";
 *   - obra de EMERGENCIA — ali ninguem fica esperando o setor certo.
 */
export function podeEditarCheck(usuario, check, card, obra) {
  if (!usuario) return false
  if (temAcessoTotal(usuario)) return true
  if (podeFazer(usuario, 'check_todas_etapas')) return true
  if (obra?.tipo === 'emergencia') return true
  return cargosDoCheck(check, card).includes(chaveDoCargo(usuario))
}

/* ------------------------------------------------------------
   Aparencia do card de setor

   Um cargo -> cor cheia. Dois ou mais -> gradiente com as cores de
   cada um, na ordem em que foram escolhidos.
   ------------------------------------------------------------ */

export function corDoCard(card, corDoCargo) {
  const cores = (card?.cargos ?? []).map(corDoCargo).filter(Boolean)
  if (cores.length === 0) return '#6b7280'
  return cores[0]
}

export function fundoDoCard(card, corDoCargo) {
  const cores = (card?.cargos ?? []).map(corDoCargo).filter(Boolean)
  if (cores.length === 0) return '#6b7280'
  if (cores.length === 1) return cores[0]
  return `linear-gradient(120deg, ${cores.join(', ')})`
}

/** Nome que aparece no topo do card: o titulo escrito ou os cargos dele. */
export function nomeDoCard(card, nomeDoCargo) {
  if (card?.titulo) return card.titulo
  const nomes = (card?.cargos ?? []).map(nomeDoCargo).filter(Boolean)
  return nomes.length > 0 ? nomes.join(' + ') : 'Sem cargo'
}
