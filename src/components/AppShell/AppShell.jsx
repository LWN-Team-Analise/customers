import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { iniciais, primeiroNome, saudacao } from '@/utils/pessoa'
import './AppShell.css'

const traco = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Icone = {
  inicio: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  atalhos: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5z" />
    </svg>
  ),
  cadastros: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v6c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6M5 12v6c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-6" />
    </svg>
  ),
  notificacoes: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  relatorios: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M14 3.4A9 9 0 0 1 20.6 10H14z" />
    </svg>
  ),
  reunioes: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <rect x="3" y="6.5" width="12" height="11" rx="2.2" />
      <path d="m15 11 5.5-3v8L15 13z" />
    </svg>
  ),
  config: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z" />
    </svg>
  ),
  sair: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" {...traco}>
      <path d="M14 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8" />
      <path d="m17 15 3-3-3-3M20 12H10" />
    </svg>
  ),
  sino: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" {...traco}>
      <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  sol: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" {...traco}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.4 6.4 5 5M19 19l-1.4-1.4M17.6 6.4 19 5M5 19l1.4-1.4" />
    </svg>
  ),
  lua: () => (
    <svg viewBox="0 0 24 24" width="15" height="15">
      <path
        fill="currentColor"
        d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a.8.8 0 0 0-1.1-.9A9.9 9.9 0 1 0 21.3 15.7a.8.8 0 0 0-.9-1.1Z"
      />
    </svg>
  ),
}

/* Itens da barra lateral. So "inicio" tem tela por enquanto; os demais ficam
   desabilitados e marcados como "em breve" ate existir a rota correspondente. */
const MENU = [
  { id: 'inicio', rotulo: 'Início', rota: '/app' },
  { id: 'atalhos', rotulo: 'Atalhos' },
  { id: 'cadastros', rotulo: 'Cadastros' },
  { id: 'notificacoes', rotulo: 'Notificações' },
  { id: 'relatorios', rotulo: 'Relatórios' },
  { id: 'reunioes', rotulo: 'Reuniões' },
  { id: 'config', rotulo: 'Configurações' },
]

export default function AppShell({ children, ativo = 'inicio' }) {
  const { user, logout } = useAuth()
  const { theme, selectTheme } = useTheme()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')

  const sair = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label="Navegação principal">
        <ul className="rail__lista">
          {MENU.map((item) => {
            const Glifo = Icone[item.id]
            const atual = item.id === ativo
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`rail__btn ${atual ? 'is-atual' : ''}`.trim()}
                  aria-label={item.rotulo}
                  aria-current={atual ? 'page' : undefined}
                  title={item.rota ? item.rotulo : `${item.rotulo} (em breve)`}
                  disabled={!item.rota}
                  onClick={() => item.rota && navigate(item.rota)}
                >
                  <Glifo />
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="rail__btn rail__sair"
          aria-label="Sair"
          title="Sair"
          onClick={sair}
        >
          <Icone.sair />
        </button>
      </nav>

      <header className="topbar">
        <div className="topbar__usuario">
          <span className="avatar" aria-hidden="true">
            {iniciais(user?.name)}
          </span>
          <p className="topbar__saudacao">
            {saudacao()}, <strong>{primeiroNome(user?.name)}</strong>
          </p>
        </div>

        <form className="omni" onSubmit={(evento) => evento.preventDefault()} role="search">
          <span className="omni__orb" aria-hidden="true" />
          <input
            className="omni__campo"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar cliente, obra ou ordem de serviço..."
            aria-label="Buscar"
          />
        </form>

        <div className="topbar__acoes">
          <div className="tema" role="group" aria-label="Tema">
            <button
              type="button"
              className={`tema__opcao ${theme === 'light' ? 'is-atual' : ''}`.trim()}
              onClick={() => selectTheme('light')}
              aria-pressed={theme === 'light'}
            >
              <Icone.sol />
              Claro
            </button>
            <button
              type="button"
              className={`tema__opcao ${theme === 'dark' ? 'is-atual' : ''}`.trim()}
              onClick={() => selectTheme('dark')}
              aria-pressed={theme === 'dark'}
            >
              <Icone.lua />
              Escuro
            </button>
          </div>

          <button
            type="button"
            className="topbar__sino"
            aria-label="Notificações"
            title="Notificações (em breve)"
          >
            <Icone.sino />
          </button>
        </div>
      </header>

      <main className="shell__conteudo">{children}</main>
    </div>
  )
}
