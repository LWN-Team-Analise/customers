import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { abasVisiveis, podeFazer } from '@/domain/permissoes'

/**
 * Bloqueia rotas internas para quem nao concluiu o login e, depois
 * disso, para quem o cargo nao deixa entrar.
 *
 * Esconder o item do menu nao basta: qualquer um digitaria o endereco
 * na barra. Quem cai numa aba fechada e mandado para a primeira que
 * ele PODE ver — e nao para uma tela de erro, que so deixaria a pessoa
 * sem saida.
 *
 * `permissoes` (plural) e para as telas que abrem com mais de uma
 * chave, como Usuarios: entra quem mexe em usuario OU em cargo.
 */
export default function ProtectedRoute({ children, permissao, permissoes }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const exigidas = permissoes ?? (permissao ? [permissao] : [])
  const liberado = exigidas.length === 0 || exigidas.some((chave) => podeFazer(user, chave))

  if (!liberado) {
    /* Configuracoes e sempre livre: e onde a pessoa troca a propria
       senha e vincula o Outlook, entao ela nunca fica sem para onde ir. */
    const primeira = abasVisiveis(user)[0] ?? '/app/configuracoes'
    return <Navigate to={primeira} replace />
  }

  return children
}
