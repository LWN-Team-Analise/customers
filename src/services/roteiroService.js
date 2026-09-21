/**
 * O roteiro das obras: etapas, cards e checks.
 *
 * Ele anda para a FRENTE. Toda alteracao leva junto o `obraId` de onde
 * ela partiu: o servidor usa a data de nascimento dessa obra como o
 * ponto de virada. O que e criado vale para ela e para as proximas; o
 * que e excluido some dela em diante — as obras anteriores continuam
 * com o roteiro que tinham.
 *
 * Sem `obraId` (alteracao feita fora de uma obra), o corte e "de agora
 * em diante": so as obras criadas dali para a frente sentem a mudanca.
 */

import { del, get, patch, post } from './api'

/** Anexa o obraId na query, para os DELETE (que nao levam corpo). */
const comObra = (caminho, obraId) =>
  obraId ? `${caminho}?obraId=${encodeURIComponent(obraId)}` : caminho

export async function carregarRoteiro() {
  const { etapas } = await get('/roteiro')
  return etapas ?? []
}

/* ---------------- Etapas ---------------- */

export async function criarEtapa({ nome, descricao = '', obraId } = {}) {
  const { etapa } = await post('/roteiro/etapas', { nome, descricao, obraId })
  return etapa
}

/**
 * Renomear vale para todas: e a mesma etapa, so mudou o rotulo.
 *
 * `campos` e { nome?, descricao? } — o que nao vier fica como esta.
 */
export const editarEtapa = (id, campos) => patch(`/roteiro/etapas/${id}`, campos)

export const apagarEtapa = (id, obraId) => del(comObra(`/roteiro/etapas/${id}`, obraId))

/* ---------------- Cards ---------------- */

/** cargos: lista de chaves. Mais de uma = card com gradiente. */
export async function criarCard(etapaId, { cargos, titulo, obraId }) {
  const { id } = await post(`/roteiro/etapas/${etapaId}/cards`, { cargos, titulo, obraId })
  return id
}

export const editarCard = (id, campos) => patch(`/roteiro/cards/${id}`, campos)
export const apagarCard = (id, obraId) => del(comObra(`/roteiro/cards/${id}`, obraId))

/* ---------------- Checks ---------------- */

/**
 * campos: { titulo, cargos?, obraId? }
 *
 * `cargos` vazio = o check segue o cargo do card. Com nomes, aquela
 * lista passa a mandar so naquele check.
 */
export async function criarCheck(cardId, campos) {
  const { check } = await post(`/roteiro/cards/${cardId}/checks`, campos)
  return check
}

export const editarCheck = (id, campos) => patch(`/roteiro/checks/${id}`, campos)
export const apagarCheck = (id, obraId) => del(comObra(`/roteiro/checks/${id}`, obraId))

/* ---------------- Etiquetas do card ---------------- */

/**
 * Catalogo PROPRIO, separado do das obras: a etiqueta da obra diz o
 * que a obra e, a do card diz o que aquele pedaco do roteiro e. Sem a
 * atualizacao 7 do banco a API responde 501, e a tela mostra o recado.
 */
export async function etiquetarCard(cardId, { nome, cor, etiquetaId } = {}) {
  const { etiqueta } = await post(`/roteiro/cards/${cardId}/etiquetas`, { nome, cor, etiquetaId })
  return etiqueta
}

export async function editarEtiquetaCard(id, campos) {
  const { etiqueta } = await patch(`/roteiro/cards/etiquetas/${id}`, campos)
  return etiqueta
}

export const tirarEtiquetaCard = (cardId, etiquetaId) =>
  del(`/roteiro/cards/${cardId}/etiquetas/${etiquetaId}`)
