/**
 * Guarda-tudo das obras, clientes, equipe e avisos.
 *
 * Hoje os dados vivem no localStorage do navegador — o banco ainda so tem a
 * tabela "usuario". A tela nunca fala com o localStorage direto: fala com as
 * funcoes daqui. Quando as tabelas existirem, basta trocar o corpo destas
 * funcoes por chamadas de fetch('/api/...') que nenhuma tela muda.
 */

import { etapasIniciais } from '@/domain/obras'
import { hojeISO } from '@/utils/formato'

const CHAVE = 'customers.dados.v2'

/** Id curto e legivel, suficiente enquanto os dados sao locais. */
export function novoId(prefixo = 'id') {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/* ------------------------------------------------------------
   Semente: sem ela as telas abririam vazias e sem nada para ver.
   ------------------------------------------------------------ */

/* Os cinco primeiros sao os setores das etapas (fixo: nao da para apagar).
   As mesmas cores estao em db/sistema.sql.txt — quando a API responde,
   e ela que manda. */
const CARGOS_SEMENTE = [
  { id: 'cg_comercial', chave: 'comercial', nome: 'Comercial', curto: 'com', cor: '#13b7c7', acessoTotal: false, fixo: true },
  { id: 'cg_adm', chave: 'adm', nome: 'ADM', curto: 'adm', cor: '#35b566', acessoTotal: false, fixo: true },
  { id: 'cg_tecnico', chave: 'tecnico', nome: 'Técnico', curto: 'téc', cor: '#f2802a', acessoTotal: false, fixo: true },
  { id: 'cg_gq', chave: 'gq', nome: 'GQ', curto: 'gq', cor: '#3a63e8', acessoTotal: false, fixo: true },
  { id: 'cg_excelencia', chave: 'excelencia', nome: 'Excelência', curto: 'exc', cor: '#9a5ce0', acessoTotal: false, fixo: true },
  { id: 'cg_diretor', chave: 'diretor', nome: 'Diretor', curto: 'dir', cor: '#c2a23a', acessoTotal: true, fixo: false },
]

const EQUIPE_SEMENTE = [
  { id: 'u_ana', nome: 'Ana Ribeiro', cargo: 'comercial', foto: null },
  { id: 'u_bruno', nome: 'Bruno Castro', cargo: 'tecnico', foto: null },
  { id: 'u_carla', nome: 'Carla Menezes', cargo: 'gq', foto: null },
  { id: 'u_diego', nome: 'Diego Prado', cargo: 'adm', foto: null },
  { id: 'u_elisa', nome: 'Elisa Nunes', cargo: 'excelencia', foto: null },
]

const CLIENTES_SEMENTE = [
  {
    id: 'c_alfa',
    nome: 'Alfa Engenharia',
    logo: null,
    endereco: 'Av. Paulista, 1578',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-200',
    criadoEm: '2026-01-12T09:00:00.000Z',
  },
  {
    id: 'c_delta',
    nome: 'Delta Indústria',
    logo: null,
    endereco: 'Rua XV de Novembro, 340',
    bairro: 'Centro',
    cidade: 'Curitiba',
    estado: 'PR',
    cep: '80020-310',
    criadoEm: '2026-02-03T09:00:00.000Z',
  },
  {
    id: 'c_orion',
    nome: 'Órion Serviços',
    logo: null,
    endereco: 'Av. Afonso Pena, 1212',
    bairro: 'Centro',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    cep: '30130-003',
    criadoEm: '2026-03-21T09:00:00.000Z',
  },
]

/** Marca as tarefas de uma etapa como feitas, para a semente nascer com historia. */
function concluirEtapa(etapas, numero, responsavelId) {
  const etapa = etapas.find((e) => e.numero === numero)
  if (!etapa) return
  Object.values(etapa.setores).forEach((bloco) => {
    bloco.tarefas.forEach((t) => {
      t.feito = true
    })
    bloco.responsavelId = responsavelId
  })
}

function obraSemente({ id, clienteId, descricao, tipo, prioridade, dataPrevista, avancar = 0, membros }) {
  const etapas = etapasIniciais()
  for (let n = 1; n <= avancar; n += 1) concluirEtapa(etapas, n, membros[0])
  return {
    id,
    clienteId,
    descricao,
    tipo,
    prioridade,
    dataPrevista,
    membros,
    etapas,
    observacoes: [],
    avisos: [],
    avaliacao: null,
    criadoEm: new Date().toISOString(),
  }
}

function semente() {
  return {
    cargos: CARGOS_SEMENTE,
    equipe: EQUIPE_SEMENTE,
    clientes: CLIENTES_SEMENTE,
    obras: [
      obraSemente({
        id: 'o_1',
        clienteId: 'c_alfa',
        descricao: 'Laudo de conformidade das linhas de produção da unidade norte.',
        tipo: 'padrao',
        prioridade: 'alta',
        dataPrevista: '2026-09-18',
        avancar: 1,
        membros: ['u_ana', 'u_bruno'],
      }),
      obraSemente({
        id: 'o_2',
        clienteId: 'c_delta',
        descricao: 'Consultoria de qualidade para renovação do certificado.',
        tipo: 'padrao',
        prioridade: 'media',
        dataPrevista: '2026-10-02',
        avancar: 0,
        membros: ['u_carla'],
      }),
      obraSemente({
        id: 'o_3',
        clienteId: 'c_orion',
        descricao: 'Parada não programada: avaliação estrutural do galpão 4.',
        tipo: 'emergencia',
        prioridade: 'alta',
        dataPrevista: '2026-09-05',
        avancar: 0,
        membros: ['u_bruno', 'u_elisa'],
      }),
    ],
  }
}

const VAZIO = { cargos: [], equipe: [], clientes: [], obras: [] }

/** Le o estado inteiro do storage; se nao houver nada ainda, planta a semente. */
export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) {
      const inicial = semente()
      salvar(inicial)
      return inicial
    }
    const dados = JSON.parse(bruto)
    return { ...VAZIO, ...dados }
  } catch {
    /* storage bloqueado ou JSON corrompido: segue so em memoria */
    return semente()
  }
}

export function salvar(dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados))
  } catch {
    /* modo privado: os dados valem so enquanto a aba estiver aberta */
  }
}

export function limpar() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* nada a fazer */
  }
}

/* ------------------------------------------------------------
   Fabricas — as telas montam os registros por aqui.
   ------------------------------------------------------------ */

export function criarObra({ clienteId, descricao, prioridade, dataPrevista, tipo = 'padrao', autorId }) {
  return {
    id: novoId('obra'),
    clienteId,
    descricao: String(descricao ?? '').trim(),
    tipo,
    prioridade,
    dataPrevista: dataPrevista || hojeISO(),
    membros: autorId ? [autorId] : [],
    etapas: etapasIniciais(),
    observacoes: [],
    avisos: [],
    avaliacao: null,
    criadoEm: new Date().toISOString(),
  }
}

export function criarCliente({ nome, logo, endereco, bairro, cidade, estado, cep }) {
  return {
    id: novoId('cli'),
    nome: String(nome ?? '').trim(),
    logo: logo ?? null,
    endereco: String(endereco ?? '').trim(),
    bairro: String(bairro ?? '').trim(),
    cidade: String(cidade ?? '').trim(),
    estado: String(estado ?? '').trim(),
    cep: String(cep ?? '').trim(),
    criadoEm: new Date().toISOString(),
  }
}

export function criarObservacao({ autorId, autorNome, avaliacao, texto, foto }) {
  return {
    id: novoId('obs'),
    autorId: autorId ?? null,
    autorNome,
    avaliacao: avaliacao ?? null,
    texto: String(texto ?? '').trim(),
    foto: foto ?? null,
    enviadaEm: new Date().toISOString(),
  }
}

/** Cargo novo criado pela tela de Usuarios. */
export function criarCargo({ nome, cor, curto, acessoTotal = false }) {
  const limpo = String(nome ?? '').trim()
  const chave =
    limpo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || novoId('cargo')

  return {
    id: novoId('cg'),
    chave,
    nome: limpo,
    curto: String(curto ?? '').trim().slice(0, 6) || chave.slice(0, 3),
    cor: cor || '#6b7280',
    acessoTotal: Boolean(acessoTotal),
    // so os cinco das etapas nascem fixos; cargo criado aqui pode ser apagado
    fixo: false,
  }
}

/** Avaliacao que a empresa deu para a obra. */
export function criarAvaliacao({ nota, descricao, autorNome }) {
  return {
    nota: Number(nota),
    descricao: String(descricao ?? '').trim(),
    autorNome: autorNome ?? null,
    avaliadaEm: new Date().toISOString(),
  }
}
