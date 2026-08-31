import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '@/services/authService'

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

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* modo privado / storage bloqueado: sessao fica so em memoria */
    }
  }, [session])

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const result = await authService.signIn(credentials)
      setSession(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  /** Atualiza o usuario da sessao (foto, nome, telefone...). */
  const atualizarPerfil = useCallback((campos) => {
    setSession((atual) => (atual ? { ...atual, user: { ...atual.user, ...campos } } : atual))
  }, [])

  const logout = useCallback(async () => {
    await authService.signOut()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.token),
      loading,
      login,
      logout,
      atualizarPerfil,
    }),
    [session, loading, login, logout, atualizarPerfil],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
