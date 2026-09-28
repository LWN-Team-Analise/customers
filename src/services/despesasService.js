/**
 * Despesas, refeicoes e bonus — direto no banco (server/routes/despesas.js).
 *
 * `usuarios` nos filtros:
 *   undefined / []   so os meus
 *   'todos'          a equipe inteira (exige revisar_despesa_geral)
 *   ['4', '9']       essas pessoas   (idem, se nao for so eu)
 *
 * Quem decide se pode e a API: sem a permissao, pedir outra pessoa
 * volta erro, e a tela mostra o recado.
 */

import { get, post } from './api'

function paraFiltro(usuarios) {
  if (usuarios === 'todos') return 'todos'
  if (Array.isArray(usuarios) && usuarios.length > 0) return usuarios.join(',')
  return ''
}

function comUsuarios(caminho, usuarios) {
  const filtro = paraFiltro(usuarios)
  return filtro ? `${caminho}&usuarios=${encodeURIComponent(filtro)}` : caminho
}

/** campos: { categoria, tipo, data, obraId, valor?, justificativa?, observacao?, anexo? } */
export const enviar = (campos) => post('/despesas/envios', campos)

/** Os envios de um mes ('AAAA-MM'), com os totais do dia, do mes e por pessoa. */
export const carregarMes = (mes, usuarios) =>
  get(comUsuarios(`/despesas/envios?mes=${encodeURIComponent(mes)}`, usuarios))

/** O ano mes a mes, com o total anual. */
export const carregarAno = (ano, usuarios) =>
  get(comUsuarios(`/despesas/resumo?ano=${encodeURIComponent(ano)}`, usuarios))

/** O comprovante: { nome, tipo, conteudo } (data URL). */
export const baixarAnexo = (id) => get(`/despesas/anexos/${id}`)
