/**
 * Cargos e usuarios vindos do banco (server/routes/equipe.js).
 *
 * Enquanto db/sistema.sql.txt nao for rodado, a API responde 503 e todas
 * as funcoes daqui devolvem null — quem chama cai no que esta guardado no
 * localStorage. Nada quebra por falta de tabela.
 */

const CHAVE_SESSAO = 'customers.session'

function token() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? 'null')?.token ?? null
  } catch {
    return null
  }
}

/* Situacoes em que simplesmente "nao ha banco": a API nao esta no ar
   (404) ou as tabelas de db/sistema.sql.txt ainda nao foram criadas
   (503). Nao sao erro para o usuario ver — quem chama cai no local. */
const SEM_BANCO = [404, 501, 502, 503, 504]

async function chamar(caminho, opcoes = {}) {
  const chave = token()
  if (!chave) return null

  let resposta
  try {
    resposta = await fetch(`/api/equipe${caminho}`, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chave}`,
        ...opcoes.headers,
      },
    })
  } catch {
    return null // servidor fora do ar
  }

  if (resposta.status === 204) return {}
  if (SEM_BANCO.includes(resposta.status)) return null

  const corpo = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    throw new Error(corpo?.erro ?? 'Não foi possível falar com o servidor.')
  }

  return corpo
}

/** Cargos + usuarios de uma vez. Devolve null quando o banco nao tem as tabelas. */
export async function carregarEquipe() {
  try {
    const [cargos, usuarios] = await Promise.all([chamar('/cargos'), chamar('/usuarios')])
    if (!cargos && !usuarios) return null
    return { cargos: cargos?.cargos ?? [], usuarios: usuarios?.usuarios ?? [] }
  } catch {
    return null
  }
}

export async function criarCargo(campos) {
  const r = await chamar('/cargos', { method: 'POST', body: JSON.stringify(campos) })
  return r?.cargo ?? null
}

export async function editarCargo(id, campos) {
  const r = await chamar(`/cargos/${id}`, { method: 'PATCH', body: JSON.stringify(campos) })
  return r?.cargo ?? null
}

export async function apagarCargo(id) {
  await chamar(`/cargos/${id}`, { method: 'DELETE' })
}

/** Edita o cadastro. O CPF nao vai — a rota recusa de proposito. */
export async function editarUsuario(id, campos) {
  const { cpf, ...semCpf } = campos
  const r = await chamar(`/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(semCpf),
  })
  return r?.usuario ?? null
}
