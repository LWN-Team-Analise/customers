/**
 * Clientes, obras, checks, observacoes, avisos e avaliacoes — tudo
 * direto no banco (server/routes/dados.js).
 *
 * Nao ha mais copia no localStorage: o que a tela mostra e o que esta
 * gravado. Quando o servidor nao responde, a chamada estoura e quem
 * chamou desfaz a alteracao na tela (o contexto cuida disso).
 */

import { del, get, patch, post, put } from './api'

/** Estado inicial enquanto a primeira leitura nao volta. */
export const VAZIO = { clientes: [], obras: [], observacoesQuadro: [] }

export function carregarTudo() {
  return get('/dados')
}

/**
 * So as logos dos clientes que TEM logo — e a unica leitura que roda
 * sem sessao, porque quem consome e a esfera da tela de login.
 */
export async function carregarVitrine() {
  const { fotos } = await get('/dados/vitrine')
  return Array.isArray(fotos) ? fotos.filter(Boolean) : []
}

/* ---------------- Setores do cliente ---------------- */

export async function criarSetor(campos) {
  const { setor } = await post('/dados/setores', campos)
  return setor
}

export async function editarSetor(id, campos) {
  const { setor } = await patch(`/dados/setores/${id}`, campos)
  return setor
}

export const apagarSetor = (id) => del(`/dados/setores/${id}`)

/* ---------------- Chat do site ---------------- */

export async function carregarChatDoSite() {
  const { mensagens } = await get('/dados/chat')
  return mensagens ?? []
}

export async function enviarNoChatDoSite(campos) {
  const { mensagem } = await post('/dados/chat', campos)
  return mensagem
}

/**
 * `escopo`: 'mim' (padrao) esconde so na minha tela; 'todos' apaga o
 * conteudo para a equipe inteira e deixa o rastro. O padrao e o menos
 * destrutivo dos dois — ver a rota, em server/routes/dados.js.
 */
export const apagarDoChatDoSite = (id, escopo = 'mim') =>
  del(`/dados/chat/${id}?escopo=${escopo}`)

/* ---------------- Clientes ---------------- */

export async function criarCliente(campos) {
  const { cliente } = await post('/dados/clientes', campos)
  return cliente
}

export async function editarCliente(id, campos) {
  const { cliente } = await patch(`/dados/clientes/${id}`, campos)
  return cliente
}

export const apagarCliente = (id) => del(`/dados/clientes/${id}`)

/**
 * A imagem INTEIRA do cliente — a que o editor de enquadramento usa
 * para reenquadrar sem recortar o recorte anterior.
 *
 * Ela nao vem na carga do quadro de proposito: e pesada e serve a um
 * clique so.
 */
export async function carregarImagemDoCliente(id) {
  const { logoOriginal } = await get(`/dados/clientes/${id}/imagem`)
  return logoOriginal ?? null
}

/* ---------------- Obras ---------------- */

export async function criarObra(campos) {
  const { id } = await post('/dados/obras', campos)
  return id
}

export const editarObra = (id, campos) => patch(`/dados/obras/${id}`, campos)
export const apagarObra = (id) => del(`/dados/obras/${id}`)

/**
 * Encerra a obra.
 *
 * So passa com TODOS os checks do roteiro dela marcados — a API
 * confere de novo antes de carimbar. A observacao e opcional.
 */
export const concluirObra = (id, observacao) =>
  post(`/dados/obras/${id}/concluir`, { observacao })

/* ---------------- Checks ---------------- */

export const marcarCheck = (obraId, checkId) => put(`/dados/obras/${obraId}/checks/${checkId}`)
export const desmarcarCheck = (obraId, checkId) => del(`/dados/obras/${obraId}/checks/${checkId}`)

/* ---------------- Observacoes ---------------- */

export function criarObservacao(obraId, campos) {
  return post(`/dados/obras/${obraId}/observacoes`, campos)
}

export const apagarObservacao = (obraId, obsId) =>
  del(`/dados/obras/${obraId}/observacoes/${obsId}`)

export const editarObservacao = (obraId, obsId, texto) =>
  patch(`/dados/obras/${obraId}/observacoes/${obsId}`, { texto })

/** As do quadro (tela de Obras), que nao pertencem a uma obra so. */
/* campos: { texto, autorNome, inicioEm?, fimEm? }
   inicioEm/fimEm sao 'AAAA-MM-DD' e andam juntos: e a duracao depois
   da qual a observacao sai do painel e vai para o historico. */
export const criarObservacaoQuadro = (campos) => post('/dados/observacoes', campos)
export const apagarObservacaoQuadro = (id) => del(`/dados/observacoes/${id}`)
export const editarObservacaoQuadro = (id, campos) =>
  patch(`/dados/observacoes/${id}`, campos)

/* ---------------- Avisos ---------------- */

export const criarAviso = (obraId, campos) => post(`/dados/obras/${obraId}/avisos`, campos)

/** Zera o selo do sininho para estes avisos. */
export const marcarAvisosLidos = (ids) => post('/dados/avisos/lidos', { ids })

/* ---------------- Avaliacoes ----------------
   Uma obra pode ter varias notas (diretor, cliente, ...). A media
   delas e o que vale para a obra e para quem participou dela. */

export const criarAvaliacao = (obraId, campos) =>
  post(`/dados/obras/${obraId}/avaliacoes`, campos)

export const editarAvaliacao = (id, campos) => patch(`/dados/avaliacoes/${id}`, campos)
export const apagarAvaliacao = (id) => del(`/dados/avaliacoes/${id}`)

/** Tira todas as notas da obra de uma vez. */
export const limparAvaliacao = (obraId) => del(`/dados/obras/${obraId}/avaliacao`)

/* ---------------- Etiquetas ---------------- */

export async function marcarEtiqueta(obraId, campos) {
  const { etiqueta } = await post(`/dados/obras/${obraId}/etiquetas`, campos)
  return etiqueta
}

export async function editarEtiqueta(id, campos) {
  const { etiqueta } = await patch(`/dados/etiquetas/${id}`, campos)
  return etiqueta
}

export const tirarEtiqueta = (obraId, etiquetaId) =>
  del(`/dados/obras/${obraId}/etiquetas/${etiquetaId}`)

/* ---------------- Anexos ----------------
   A lista vem junto com o quadro (so nome e tamanho); o arquivo em
   si so e buscado quando alguem clica para abrir. */

export const criarAnexo = (obraId, campos) => post(`/dados/obras/${obraId}/anexos`, campos)
export const baixarAnexo = (id) => get(`/dados/anexos/${id}`)
export const apagarAnexo = (id) => del(`/dados/anexos/${id}`)

/* ---------------- Chat da obra ---------------- */

export async function carregarChat(obraId) {
  const { mensagens } = await get(`/dados/obras/${obraId}/chat`)
  return mensagens ?? []
}

export async function enviarMensagem(obraId, campos) {
  const { mensagem } = await post(`/dados/obras/${obraId}/chat`, campos)
  return mensagem
}

/**
 * Apaga uma mensagem do chat.
 *
 * `escopo` diz para quem: 'todos' tira da conversa de todo mundo e
 * deixa a marca "mensagem apagada" no lugar; 'mim' (o padrão) some só
 * da tela de quem pediu. O padrão é o menos destrutivo de propósito.
 */
export const apagarMensagem = (obraId, mensagemId, escopo = 'mim') =>
  del(`/dados/obras/${obraId}/chat/${mensagemId}?escopo=${escopo}`)

/* ---------------- Termos da empresa ----------------
   As palavras que a empresa troca pela tela — hoje, como se
   chama "Etapa". Vem junto na carga do quadro; isto aqui só
   grava a mudança. */

export async function salvarTermos(campos) {
  const { termos } = await patch('/dados/termos', campos)
  return termos
}
