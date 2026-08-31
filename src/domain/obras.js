/* ============================================================
   Regras de dominio das obras: setores, prioridades, os cinco
   estagios e as tarefas padrao de cada setor em cada estagio.

   Tudo aqui e dado puro (sem React) para poder ser usado tanto
   pelas telas quanto pelo store — e, mais para frente, pela API.
   ============================================================ */

/** Os cinco setores da empresa. "curto" e o que aparece na etiqueta do card. */
export const SETORES = [
  { id: 'comercial', rotulo: 'Comercial', curto: 'com' },
  { id: 'adm', rotulo: 'ADM', curto: 'adm' },
  { id: 'tecnico', rotulo: 'Técnico', curto: 'téc' },
  { id: 'gq', rotulo: 'GQ', curto: 'gq' },
  { id: 'excelencia', rotulo: 'Excelência', curto: 'exc' },
]

export const SETOR_POR_ID = Object.fromEntries(SETORES.map((s) => [s.id, s]))

export const PRIORIDADES = [
  { id: 'baixa', rotulo: 'Baixa' },
  { id: 'media', rotulo: 'Média' },
  { id: 'alta', rotulo: 'Alta' },
]

export const PRIORIDADE_PESO = { alta: 3, media: 2, baixa: 1 }

export const TIPOS = [
  { id: 'padrao', rotulo: 'Obra padrão' },
  { id: 'emergencia', rotulo: 'Obra emergência' },
]

/* ------------------------------------------------------------
   As cinco etapas. Cada uma lista os setores envolvidos e, para
   cada setor, o roteiro de tarefas que precisa ser cumprido.
   A etapa so fecha quando TODOS os setores dela concluem.
   ------------------------------------------------------------ */
export const ETAPAS = [
  {
    numero: 1,
    rotulo: '1ª Etapa',
    nome: 'Comercial',
    tarefas: {
      comercial: [
        'Proposta técnica',
        'Data de execução',
        'Ciente da proposta de consultoria',
        'Reunião interna',
        'Apresentar todas as propostas',
        'Venda alinhada com técnica e qualidade',
      ],
    },
  },
  {
    numero: 2,
    rotulo: '2ª Etapa',
    nome: 'Planejamento',
    tarefas: {
      tecnico: [
        'Levantamento em campo',
        'Definir escopo do serviço',
        'Montar cronograma de execução',
        'Enviar documentação técnica',
      ],
      adm: ['Abertura de contrato', 'Conferir dados do cliente', 'Emitir nota de entrada'],
      gq: [
        'Elaboração',
        'Determinar focal point',
        'Reunião interna',
        'Enviar revisão interna',
        'Entrar em contato e se apresentar',
      ],
      excelencia: ['Checar padrões do processo', 'Registrar indicadores iniciais'],
    },
  },
  {
    numero: 3,
    rotulo: '3ª Etapa',
    nome: 'Execução',
    tarefas: {
      tecnico: ['Execução em campo', 'Registro fotográfico', 'Relatório técnico'],
      gq: ['Revisão do relatório', 'Ajustes com o técnico', 'Aprovação interna'],
      excelencia: ['Auditoria do processo', 'Feedback do time'],
      comercial: ['Alinhamento com o cliente', 'Comunicar prazos'],
    },
  },
  {
    numero: 4,
    rotulo: '4ª Etapa',
    nome: 'Entrega',
    tarefas: {
      gq: ['Revisão final', 'Fechamento de pendências'],
      comercial: ['Apresentação ao cliente', 'Coleta de aceite'],
      adm: ['Emissão da nota fiscal', 'Registro no financeiro'],
    },
  },
  {
    numero: 5,
    rotulo: '5ª Etapa',
    nome: 'Encerramento',
    tarefas: {
      comercial: ['Pesquisa de satisfação', 'Proposta de renovação'],
      adm: ['Arquivamento do contrato', 'Baixa financeira'],
      gq: ['Arquivar documentação', 'Lições aprendidas'],
      excelencia: ['Avaliação final do time', 'Registro de indicadores'],
    },
  },
]

/** Setores envolvidos numa etapa, sempre na ordem oficial de SETORES. */
export function setoresDaEtapa(numero) {
  const etapa = ETAPAS.find((e) => e.numero === numero)
  if (!etapa) return []
  return SETORES.map((s) => s.id).filter((id) => id in etapa.tarefas)
}

/** Monta o checklist zerado de uma obra nova: 5 etapas x setores x tarefas. */
export function etapasIniciais() {
  return ETAPAS.map((etapa) => ({
    numero: etapa.numero,
    setores: Object.fromEntries(
      setoresDaEtapa(etapa.numero).map((setor) => [
        setor,
        {
          tarefas: etapa.tarefas[setor].map((titulo) => ({ titulo, feito: false })),
          responsavelId: null,
        },
      ]),
    ),
  }))
}

/** Um setor fecha quando todas as tarefas dele naquela etapa estao marcadas. */
export function setorConcluido(etapaObra, setor) {
  const bloco = etapaObra?.setores?.[setor]
  if (!bloco || bloco.tarefas.length === 0) return false
  return bloco.tarefas.every((t) => t.feito)
}

/** A etapa fecha quando todos os setores dela fecharam. */
export function etapaConcluida(etapaObra) {
  if (!etapaObra) return false
  const setores = Object.keys(etapaObra.setores)
  return setores.length > 0 && setores.every((s) => setorConcluido(etapaObra, s))
}

/** Setores que ainda devem informacao na etapa — vira [téc] [gq] no card. */
export function setoresPendentes(obra, numeroEtapa) {
  const etapa = obra?.etapas?.find((e) => e.numero === numeroEtapa)
  if (!etapa) return []
  return Object.keys(etapa.setores).filter((s) => !setorConcluido(etapa, s))
}

/** Etapa em andamento: a primeira que ainda nao fechou (5 = tudo pronto). */
export function etapaAtual(obra) {
  const aberta = obra?.etapas?.find((e) => !etapaConcluida(e))
  return aberta ? aberta.numero : ETAPAS.length
}

/** true quando as cinco etapas fecharam. */
export function obraConcluida(obra) {
  return Boolean(obra?.etapas?.length) && obra.etapas.every(etapaConcluida)
}

/**
 * Estado da etapa na tela de detalhe:
 *  'concluida' | 'atual' | 'bloqueada'
 *
 * Obra PADRAO anda em fila: so a etapa atual aceita marcacao e as
 * seguintes ficam com cadeado ate a anterior fechar.
 * Obra EMERGENCIA abre as cinco de uma vez — numa emergencia ninguem
 * pode ficar esperando a etapa anterior fechar para agir.
 */
export function estadoDaEtapa(obra, numero) {
  const etapa = obra?.etapas?.find((e) => e.numero === numero)
  if (etapaConcluida(etapa)) return 'concluida'
  if (obra?.tipo === 'emergencia') return 'atual'
  const anteriores = obra.etapas.filter((e) => e.numero < numero)
  return anteriores.every(etapaConcluida) ? 'atual' : 'bloqueada'
}

/**
 * Quem pode marcar a tarefa de um setor.
 *
 * Cada cargo mexe so no que e dele: o ADM nao fecha tarefa do Tecnico.
 * A excecao e o cargo com acesso total (diretoria), que enxerga e edita
 * qualquer setor.
 *
 * `usuario` e o do AuthContext; a chave do cargo vem do banco
 * (usuario.cargoChave) e cai no texto de usuario.cargo quando a tabela
 * cargo ainda nao existe.
 */
export function chaveDoCargo(usuario) {
  if (!usuario) return null
  if (usuario.cargoChave) return usuario.cargoChave
  // sem a tabela cargo, normaliza o texto livre: "Técnico" -> "tecnico"
  return String(usuario.cargo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || null
}

export function temAcessoTotal(usuario) {
  if (!usuario) return false
  if (usuario.acessoTotal) return true
  if (usuario.permissoes?.includes('todos')) return true
  // diretoria continua passando mesmo sem a tabela cargo
  return ['diretor', 'diretoria'].includes(chaveDoCargo(usuario))
}

export function podeEditarSetor(usuario, setor) {
  if (!usuario) return false
  if (temAcessoTotal(usuario)) return true
  return chaveDoCargo(usuario) === setor
}

/** Percentual concluido da obra (0–100), usado nas barras de progresso. */
export function progressoDaObra(obra) {
  const todas = obra.etapas.flatMap((e) => Object.values(e.setores).flatMap((s) => s.tarefas))
  if (todas.length === 0) return 0
  return Math.round((todas.filter((t) => t.feito).length / todas.length) * 100)
}
