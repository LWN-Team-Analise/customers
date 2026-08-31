import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import Avatar from '@/components/Avatar/Avatar'
import { primeiroNome, saudacao } from '@/utils/pessoa'
/* O nome do arquivo diz para QUAL FUNDO a logo foi feita:
   ...White = para fundo branco (modo claro)
   ...Black = para fundo preto  (modo escuro) */
import logoModoClaro from '@/assets/firstLogoWhite.png'
import logoModoEscuro from '@/assets/firstLogoBlack.webp'
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
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  obras: () => (
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <path d="M4 20V6.5a1 1 0 0 1 .7-.95l7-2.2a1 1 0 0 1 1.3.95V20" />
      <path d="M13 10h6a1 1 0 0 1 1 1v9M3 20h18" />
      <path d="M7 8.5h2M7 12h2M7 15.5h2M16 13.5h1M16 16.5h1" />
    </svg>
  ),
  clientes: () => (
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8.5 8V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8V8" />
      <path d="M3 13h18M10.5 13v1.6h3V13" />
    </svg>
  ),
  concluidas: () => (
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <path d="m12 3 2.2 1.6 2.7-.2.9 2.6 2.3 1.5-.9 2.6.9 2.6-2.3 1.5-.9 2.6-2.7-.2L12 21l-2.2-1.6-2.7.2-.9-2.6L3.9 15.5l.9-2.6-.9-2.6L6.2 8.8l.9-2.6 2.7.2z" />
      <path d="m9 12.2 2 2 4-4.2" />
    </svg>
  ),
  avaliacoes: () => (
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.99 6.75 19.75l1-5.85L3.5 9.75l5.9-.85z" />
    </svg>
  ),
  usuarios: () => (
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M2.8 19.5a6.4 6.4 0 0 1 12.4 0" />
      <path d="M16.2 5.2a3.3 3.3 0 0 1 0 6.1M17.6 14.4a6.4 6.4 0 0 1 3.6 5.1" />
    </svg>
  ),
  config: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" {...traco}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z" />
    </svg>
  ),
  sair: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" {...traco}>
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

/* Barra lateral: icone + descricao embaixo, como na referencia. */
const MENU = [
  { id: 'inicio', rotulo: 'Página inicial', rota: '/app', exato: true },
  { id: 'obras', rotulo: 'Obras', rota: '/app/obras' },
  { id: 'clientes', rotulo: 'Clientes', rota: '/app/clientes' },
  { id: 'concluidas', rotulo: 'Concluídas', rota: '/app/concluidas' },
  { id: 'avaliacoes', rotulo: 'Avaliações', rota: '/app/avaliacoes' },
  { id: 'usuarios', rotulo: 'Usuários', rota: '/app/usuarios' },
]

/** Avatar do rodape: abre o menu de Configuracoes / Sair. */
function MenuUsuario() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  /* fecha ao clicar fora ou no Esc */
  useEffect(() => {
    if (!aberto) return undefined

    const foraDaCaixa = (evento) => {
      if (!caixa.current?.contains(evento.target)) setAberto(false)
    }
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', foraDaCaixa)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  const sair = async () => {
    setAberto(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="euzinho" ref={caixa}>
      {aberto && (
        <div className="euzinho__menu" role="menu">
          <p className="euzinho__quem">
            <strong>{user?.name ?? 'Usuário'}</strong>
            <span>{user?.cargo ?? user?.email ?? ''}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            className="euzinho__item"
            onClick={() => {
              setAberto(false)
              navigate('/app/configuracoes')
            }}
          >
            <Icone.config />
            Configurações
          </button>
          <button
            type="button"
            role="menuitem"
            className="euzinho__item euzinho__item--sair"
            onClick={sair}
          >
            <Icone.sair />
            Sair
          </button>
        </div>
      )}

      <button
        type="button"
        className={`euzinho__botao ${aberto ? 'is-aberto' : ''}`.trim()}
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Conta e configurações"
        title={user?.name ?? 'Conta'}
      >
        <Avatar nome={user?.name} foto={user?.foto} tamanho={40} />
      </button>
    </div>
  )
}

export default function AppShell({ children, busca, aoBuscar, placeholderBusca }) {
  const { user } = useAuth()
  const { theme, selectTheme, isDark } = useTheme()
  const [buscaLocal, setBuscaLocal] = useState('')

  /* a tela pode assumir o campo de busca; se nao assumir, ele fica local */
  const controlada = typeof busca === 'string'
  const valorBusca = controlada ? busca : buscaLocal
  const mudarBusca = controlada ? aoBuscar : setBuscaLocal

  return (
    <div className="shell">
      {/* logo e avatar vivem fora da bolha: um no topo, outro no rodape */}
      <Link to="/app" className="marca" aria-label="Página inicial">
        <img src={isDark ? logoModoEscuro : logoModoClaro} alt="LWN" />
      </Link>

      <nav className="rail" aria-label="Navegação principal">
        <ul className="rail__lista">
          {MENU.map((item) => {
            const Glifo = Icone[item.id]
            return (
              <li key={item.id}>
                <NavLink
                  to={item.rota}
                  end={item.exato}
                  className={({ isActive }) => `rail__btn ${isActive ? 'is-atual' : ''}`.trim()}
                  title={item.rotulo}
                >
                  <span className="rail__glifo">
                    <Glifo />
                  </span>
                  <span className="rail__rotulo">{item.rotulo}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <MenuUsuario />

      <div className="shell__coluna">
        <header className="topbar">
          <p className="topbar__saudacao">
            {saudacao()}, <strong>{primeiroNome(user?.name)}</strong>
          </p>

          <form className="omni" onSubmit={(evento) => evento.preventDefault()} role="search">
            <span className="omni__orb" aria-hidden="true" />
            <input
              className="omni__campo"
              value={valorBusca}
              onChange={(evento) => mudarBusca?.(evento.target.value)}
              placeholder={placeholderBusca ?? 'Buscar cliente, obra ou ordem de serviço...'}
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
    </div>
  )
}
