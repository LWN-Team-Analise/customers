import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as authService from '@/services/authService'
import { SESSAO_CAIU } from '@/services/api'

const STORAGE_KEY = 'customers.session'

const AuthContext = createContext(null)

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession())
  const [loading, setLoading] = useState(false)
  /* true = a sessao caiu sozinha (token vencido), nao foi a pessoa que saiu.
     E o que faz o login explicar o motivo em vez de so aparecer do nada. */
  const [expirou, setExpirou] = useState(false)

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* modo privado / storage bloqueado: sessao fica so em memoria */
    }
  }, [session])

  /**
   * Qualquer chamada que volte "sessao morta" derruba a sessao aqui.
   *
   * Sem isto, o token vencia depois de 8 horas e a tela continuava com
   * cara de logada: os dados ja carregados seguiam na tela e so o
   * primeiro "salvar" e que mostrava o erro.
   */
  useEffect(() => {
    const caiu = () => {
      setSession((atual) => {
        if (!atual) return atual
        setExpirou(true)
        return null
      })
    }
    window.addEventListener(SESSAO_CAIU, caiu)
    return () => window.removeEventListener(SESSAO_CAIU, caiu)
  }, [])

  /**
   * Ao abrir o site, confere se o token guardado ainda vale.
   *
   * So derruba quando o servidor DIZ que o token morreu. Se a API estiver
   * fora do ar, a sessao fica de pe — senao uma queda de rede deslogaria
   * todo mundo.
   */
  const jaConferiu = useRef(false)
  useEffect(() => {
    if (jaConferiu.current || !session?.token) return
    jaConferiu.current = true

    let vivo = true
    authService.fetchMe(session.token).then((resultado) => {
      if (!vivo) return
      if (resultado.expirada) {
        setExpirou(true)
        setSession(null)
        return
      }
      // aproveita e atualiza o cadastro: cargo, permissoes e foto de agora
      if (resultado.user) {
        setSession((atual) => (atual ? { ...atual, user: resultado.user } : atual))
      }
    })
    return () => {
      vivo = false
    }
  }, [session?.token])

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const result = await authService.signIn(credentials)
      setExpirou(false)
      setSession(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Abre a sessao com o que o servidor ja devolveu pronto.
   *
   * E o caminho do login pelo Outlook: quem conversou com a Microsoft
   * foi o servidor, e ele volta com { token, user } montado — nao ha
   * senha para o `login` conferir.
   */
  const entrarComSessao = useCallback((resultado) => {
    if (resultado?.token) {
      setExpirou(false)
      setSession(resultado)
    }
    return resultado
  }, [])

  /** Atualiza o usuario da sessao (foto, nome, telefone...). */
  const atualizarPerfil = useCallback((campos) => {
    setSession((atual) => (atual ? { ...atual, user: { ...atual.user, ...campos } } : atual))
  }, [])

  const logout = useCallback(async () => {
    await authService.signOut()
    setExpirou(false)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.token),
      loading,
      expirou,
      login,
      entrarComSessao,
      logout,
      atualizarPerfil,
    }),
    [session, loading, expirou, login, entrarComSessao, logout, atualizarPerfil],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
