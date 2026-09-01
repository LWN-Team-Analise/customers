/**
 * Cargos e usuarios (server/routes/equipe.js).
 *
 * Colaborador novo entra com a senha padrao 123456 e com
 * senha_temporaria ligado: o sistema cobra a troca no primeiro acesso.
 */

import { del, get, patch, post } from './api'

/** A mesma do servidor; a tela mostra ao cadastrar. */
export const SENHA_PADRAO = '123456'

/* ---------------- Cargos ---------------- */

export async function carregarCargos() {
  const { cargos } = await get('/equipe/cargos')
  return cargos ?? []
}

export async function criarCargo(campos) {
  const { cargo } = await post('/equipe/cargos', campos)
  return cargo
}

export async function editarCargo(id, campos) {
  const { cargo } = await patch(`/equipe/cargos/${id}`, campos)
  return cargo
}

export const apagarCargo = (id) => del(`/equipe/cargos/${id}`)

/* ---------------- Usuarios ---------------- */

export async function carregarUsuarios() {
  const { usuarios } = await get('/equipe/usuarios')
  return usuarios ?? []
}

/** Cargos + usuarios de uma vez, para a carga inicial. */
export async function carregarEquipe() {
  const [cargos, usuarios] = await Promise.all([carregarCargos(), carregarUsuarios()])
  return { cargos, usuarios }
}

export async function criarUsuario(campos) {
  const { usuario } = await post('/equipe/usuarios', campos)
  return usuario
}

/**
 * Edita o cadastro. O CPF so passa se quem esta logado for da diretoria
 * — a API recusa para todo o resto.
 */
export async function editarUsuario(id, campos) {
  const { usuario } = await patch(`/equipe/usuarios/${id}`, campos)
  return usuario
}

export const apagarUsuario = (id) => del(`/equipe/usuarios/${id}`)

/* ---------------- Senha ---------------- */

export const trocarSenha = (atual, nova) => post('/auth/senha', { atual, nova })
