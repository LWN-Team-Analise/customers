/**
 * Camada de autenticacao — fala com a API em /api/auth (server/routes/auth.js),
 * que por sua vez consulta o PostgreSQL. Em desenvolvimento o Vite faz o proxy
 * de /api para http://localhost:3001 (ver vite.config.js).
 */

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())
}

export function onlyDigits(value) {
  return String(value).replace(/\D/g, '')
}

/** Valida CPF pelos dois digitos verificadores. */
export function validateCPF(value) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const digito = (tamanho) => {
    let soma = 0
    for (let i = 0; i < tamanho; i += 1) {
      soma += Number(cpf[i]) * (tamanho + 1 - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10])
}

/** O campo de acesso aceita e-mail ou CPF. */
export function validateIdentifier(value = '') {
  return validateEmail(value) || validateCPF(value)
}

/** CPF mascarado para exibicao: 305.868.948-96 */
export function formatCPF(value) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return value
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

async function lerErro(resposta) {
  try {
    const dados = await resposta.json()
    return dados?.erro
  } catch {
    return null
  }
}

export async function signIn({ identifier, password }) {
  const valor = String(identifier ?? '').trim()

  // valida antes de ir na rede: erro imediato e uma requisicao a menos
  if (!validateIdentifier(valor)) {
    throw new Error('Informe um e-mail ou CPF válido.')
  }
  if (!password) {
    throw new Error('Informe sua senha.')
  }

  let resposta
  try {
    resposta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: valor, password }),
    })
  } catch {
    throw new Error('Não foi possível falar com o servidor. Ele está rodando? (npm run api)')
  }

  if (!resposta.ok) {
    throw new Error((await lerErro(resposta)) || 'Não foi possível entrar. Tente novamente.')
  }

  return resposta.json()
}

/** Revalida a sessao guardada; devolve null se o token nao vale mais. */
export async function fetchMe(token) {
  try {
    const resposta = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resposta.ok) return null
    const { user } = await resposta.json()
    return user
  } catch {
    return null
  }
}

export async function signOut() {
  // o token e sem estado no servidor: sair e apagar a sessao local
}
