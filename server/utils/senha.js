/**
 * Validação de força de senha.
 *
 * Requisitos:
 * - Mínimo de 8 caracteres
 * - Pelo menos uma letra maiúscula
 * - Pelo menos uma letra minúscula
 * - Pelo menos um número
 * - Pelo menos um caractere especial
 */

/**
 * Valida se a senha atende aos requisitos mínimos de segurança.
 * @param {string} senha - A senha a ser validada
 * @returns {object} { valido: boolean, erros: string[] }
 */
export function validarForcaSenha(senha) {
  const erros = []

  if (!senha || typeof senha !== 'string') {
    return { valido: false, erros: ['A senha é obrigatória.'] }
  }

  if (senha.length < 8) {
    erros.push('A senha precisa ter pelo menos 8 caracteres.')
  }

  if (!/[A-Z]/.test(senha)) {
    erros.push('A senha precisa ter pelo menos uma letra maiúscula.')
  }

  if (!/[a-z]/.test(senha)) {
    erros.push('A senha precisa ter pelo menos uma letra minúscula.')
  }

  if (!/[0-9]/.test(senha)) {
    erros.push('A senha precisa ter pelo menos um número.')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) {
    erros.push('A senha precisa ter pelo menos um caractere especial (!@#$%^&* etc).')
  }

  // Verifica senhas comuns e fracas
  const senhasComuns = [
    'password',
    '12345678',
    'qwerty',
    'abc123',
    'letmein',
    'welcome',
    'admin123',
    'senha123',
  ]
  if (senhasComuns.includes(senha.toLowerCase())) {
    erros.push('Esta senha é muito comum. Escolha uma mais segura.')
  }

  return {
    valido: erros.length === 0,
    erros,
  }
}

/**
 * Gera uma senha forte aleatória.
 * @param {number} tamanho - Tamanho da senha (padrão: 16)
 * @returns {string} Senha gerada
 */
export function gerarSenhaForte(tamanho = 16) {
  const letrasMaiusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const letrasMinusculas = 'abcdefghijklmnopqrstuvwxyz'
  const numeros = '0123456789'
  const especiais = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  const todos = letrasMaiusculas + letrasMinusculas + numeros + especiais
  let senha = ''

  // Garante pelo menos um de cada tipo
  senha += letrasMaiusculas[Math.floor(Math.random() * letrasMaiusculas.length)]
  senha += letrasMinusculas[Math.floor(Math.random() * letrasMinusculas.length)]
  senha += numeros[Math.floor(Math.random() * numeros.length)]
  senha += especiais[Math.floor(Math.random() * especiais.length)]

  // Preenche o resto
  for (let i = senha.length; i < tamanho; i++) {
    senha += todos[Math.floor(Math.random() * todos.length)]
  }

  // Embaralha a senha
  return senha
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
