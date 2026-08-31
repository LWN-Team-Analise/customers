import { Navigate, Route, Routes } from 'react-router-dom'
import Login from '@/pages/Login/Login'
import Home from '@/pages/Home/Home'
import Privacy from '@/pages/Privacy/Privacy'
import Obras from '@/pages/Obras/Obras'
import ObraDetalhe from '@/pages/Obras/ObraDetalhe'
import Clientes from '@/pages/Clientes/Clientes'
import Concluidas from '@/pages/Concluidas/Concluidas'
import Avaliacoes from '@/pages/Avaliacoes/Avaliacoes'
import Usuarios from '@/pages/Usuarios/Usuarios'
import Configuracoes from '@/pages/Configuracoes/Configuracoes'
import ProtectedRoute from './ProtectedRoute'

/** Envolve a rota interna na guarda de sessao. */
function Interna({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/politica-de-privacidade" element={<Privacy />} />

      <Route path="/app" element={<Interna><Home /></Interna>} />
      <Route path="/app/obras" element={<Interna><Obras /></Interna>} />
      <Route path="/app/obras/:id" element={<Interna><ObraDetalhe /></Interna>} />
      <Route path="/app/clientes" element={<Interna><Clientes /></Interna>} />
      <Route path="/app/concluidas" element={<Interna><Concluidas /></Interna>} />
      <Route path="/app/avaliacoes" element={<Interna><Avaliacoes /></Interna>} />
      <Route path="/app/usuarios" element={<Interna><Usuarios /></Interna>} />
      <Route path="/app/configuracoes" element={<Interna><Configuracoes /></Interna>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
