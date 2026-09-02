import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useDados } from '@/context/DadosContext'
import Avatar from '@/components/Avatar/Avatar'
import ParticleInterlock from '@/components/ParticleInterlock/ParticleInterlock'
import ChatSite from '@/components/ChatSite/ChatSite'
import Confirma from '@/components/Confirma/Confirma'
import { primeiroNome, saudacao } from '@/utils/pessoa'
import { dataHora } from '@/utils/formato'
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
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.8 2.8L16 9.6" />
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
  chat: () => (
    <svg viewBox="0 0 24 24" width="21" height="21" {...traco}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  ),
  mais: () => (
    <svg viewBox="0 0 24 24" width="22" height="22" {...traco} strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  nota: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" {...traco}>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  ),
  chatPequeno: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" {...traco}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  ),
  sino: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" {...traco}>
      <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
}

/**
 * Barra lateral: icone + descricao embaixo.
 *
 * `permissao` e a chave que o cargo precisa ter para o item aparecer.
 * Usuarios nao tem permissao de VISUALIZACAO propria: quem entra la e
 * quem pode mexer em usuario ou em cargo.
 */
const MENU = [
  { id: 'inicio', rotulo: 'Página inicial', rota: '/app', exato: true, permissao: 'ver_inicio' },
  { id: 'obras', rotulo: 'Obras', rota: '/app/obras', permissao: 'ver_obras' },
  { id: 'clientes', rotulo: 'Clientes', rota: '/app/clientes', permissao: 'ver_clientes' },
  { id: 'concluidas', rotulo: 'Concluídas', rota: '/app/concluidas', permissao: 'ver_concluidas' },
  { id: 'avaliacoes', rotulo: 'Avaliações', rota: '/app/avaliacoes', permissao: 'ver_avaliacoes' },
  {
    id: 'usuarios',
    rotulo: 'Usuários',
    rota: '/app/usuarios',
    permissoes: ['editar_usuario', 'editar_cargo'],
  },
]

/** Avatar do rodape: abre o menu de Configuracoes / Sair. */
function MenuUsuario() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  /* sair fecha a sessao e leva embora o que estiver aberto: pergunta antes */
  const [saindo, setSaindo] = useState(false)
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
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="euzinho" ref={caixa}>
      {aberto && (
        <div className="euzinho__menu" role="menu">
          <p className="euzinho__quem">
            <strong>{user?.name ?? 'Usuário'}</strong>
            <span>{user?.cargoNome ?? user?.email ?? ''}</span>
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
            onClick={() => {
              setAberto(false)
              setSaindo(true)
            }}
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

      <Confirma
        aberto={saindo}
        titulo="Sair do sistema?"
        mensagem="Você volta para a tela de login e precisa entrar de novo."
        tom="acao"
        rotuloConfirmar="Sair"
        aoConfirmar={sair}
        aoFechar={() => setSaindo(false)}
      />
    </div>
  )
}

/**
 * Sininho das notificacoes.
 *
 * O selo vermelho conta os avisos que chegaram para o SETOR de quem
 * esta logado e que ainda nao foram abertos. Abrir o painel marca
 * todos como lidos — que e o gesto que a pessoa espera.
 *
 * "Para o setor" e literal: quem e da Excelencia nao recebe a cobranca
 * de um check pendente do Comercial. Nao ha nada que essa pessoa possa
 * fazer a respeito, e um sino cheio de aviso de outro setor e um sino
 * que ninguem mais abre. Quem quiser a visao geral tem a coluna de
 * pendencias na tela de Obras. Quem decide isso e `minhasNotificacoes`,
 * no contexto.
 */
function Notificacoes() {
  const navigate = useNavigate()
  const {
    minhasNotificacoes,
    naoLidas,
    marcarNotificacoesLidas,
    clientePorId,
    cargoPorChave,
    rotuloEtapa,
  } = useDados()

  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined

    const fora = (evento) => {
      if (!caixa.current?.contains(evento.target)) setAberto(false)
    }
    const tecla = (evento) => {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const abrir = () => {
    const proximo = !aberto
    setAberto(proximo)
    if (proximo && naoLidas > 0) marcarNotificacoesLidas()
  }

  const lista = minhasNotificacoes.slice(0, 20)

  return (
    <div className="sininho" ref={caixa}>
      <button
        type="button"
        className={`topbar__sino ${aberto ? 'is-aberto' : ''}`.trim()}
        onClick={abrir}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={
          naoLidas > 0 ? `Notificações — ${naoLidas} não lidas` : 'Notificações'
        }
        title="Notificações"
      >
        <Icone.sino />
        {naoLidas > 0 && (
          <span className="sininho__selo" aria-hidden="true">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="sininho__painel" role="menu">
          <header className="sininho__topo">
            <h2>Notificações</h2>
            <span>{minhasNotificacoes.length}</span>
          </header>

          {lista.length === 0 ? (
            <p className="sininho__vazio">Nenhuma notificação pendente.</p>
          ) : (
            <ul className="sininho__lista">
              {lista.map((aviso) => {
                const cliente = clientePorId(aviso.clienteId)
                const setores = aviso.setores
                  .map((s) => cargoPorChave(s)?.nome ?? s)
                  .join(', ')
                return (
                  <li key={aviso.id}>
                    <button
                      type="button"
                      className={`sininho__item ${aviso.lido ? '' : 'is-nova'}`.trim()}
                      onClick={() => {
                        setAberto(false)
                        navigate(`/app/obras/${aviso.obraId}`)
                      }}
                    >
                      <span className="sininho__marca" data-tipo={aviso.obraTipo} aria-hidden="true" />
                      <span className="sininho__corpo">
                        <strong>{cliente?.nome ?? 'Obra'}</strong>
                        <span className="sininho__texto">
                          {aviso.mensagem || `Pendência na ${rotuloEtapa(aviso.etapa)}.`}
                        </span>
                        <span className="sininho__meta">
                          {setores && <em>para {setores}</em>}
                          {aviso.enviadoPorNome && <em>por {aviso.enviadoPorNome}</em>}
                          <em>{dataHora(aviso.enviadoEm)}</em>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * O botao redondo do canto inferior direito.
 *
 * Na maioria das telas ele e so o chat da equipe: um clique abre. Na tela
 * de Obras ele vira um "+" com duas opcoes, porque la existe uma segunda
 * coisa a acrescentar (a observacao do quadro) — e um botao que faz duas
 * coisas precisa perguntar qual.
 *
 * Dentro de uma obra ele nao aparece: la o chat que vale e o da obra, e
 * dois botoes de chat na mesma tela so confundiriam.
 */
function BotaoChat({ acoes = [], aoAbrirChat }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  /* com opcoes extras o botao vira menu; sem elas, atalho direto */
  const temMenu = acoes.length > 0

  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => {
      if (!caixa.current?.contains(e.target)) setAberto(false)
    }
    const tecla = (e) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const itens = [
    ...acoes,
    {
      id: 'chat',
      rotulo: 'Chat da equipe',
      Glifo: Icone.chatPequeno,
      aoClicar: aoAbrirChat,
    },
  ]

  return (
    <div className="bolhachat" ref={caixa}>
      {temMenu && aberto && (
        <div className="bolhachat__menu" role="menu">
          {itens.map(({ id, rotulo, Glifo, aoClicar }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="bolhachat__item"
              onClick={() => {
                setAberto(false)
                aoClicar()
              }}
            >
              <Glifo />
              {rotulo}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`bolhachat__botao ${aberto ? 'is-aberto' : ''}`.trim()}
        onClick={() => (temMenu ? setAberto((v) => !v) : aoAbrirChat())}
        aria-haspopup={temMenu ? 'menu' : undefined}
        aria-expanded={temMenu ? aberto : undefined}
        aria-label={temMenu ? 'Adicionar observação ou abrir o chat' : 'Abrir o chat da equipe'}
        title={temMenu ? 'Adicionar' : 'Chat da equipe'}
      >
        {temMenu ? <Icone.mais /> : <Icone.chat />}
      </button>
    </div>
  )
}

/**
 * `semChat` tira o botao flutuante da tela — e o que a tela da obra usa,
 * porque la o chat que vale e o da obra.
 *
 * `acoesFlutuantes` acrescenta opcoes ao botao; com elas ele vira um "+"
 * com menu, sem elas continua sendo o atalho do chat.
 */
export default function AppShell({
  children,
  busca,
  aoBuscar,
  placeholderBusca,
  semChat = false,
  acoesFlutuantes = [],
}) {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const { erro, limparErro, pode } = useDados()
  const [buscaLocal, setBuscaLocal] = useState('')
  const [chatAberto, setChatAberto] = useState(false)

  /* a tela pode assumir o campo de busca; se nao assumir, ele fica local */
  const controlada = typeof busca === 'string'
  const valorBusca = controlada ? busca : buscaLocal
  const mudarBusca = controlada ? aoBuscar : setBuscaLocal

  /* cada cargo enxerga so as abas que a permissao dele abre */
  const abas = useMemo(
    () =>
      MENU.filter((item) =>
        item.permissoes ? item.permissoes.some((p) => pode(p)) : pode(item.permissao),
      ),
    [pode],
  )

  /* ------------------------------------------------------------
     Onde a marca do item atual tem que estar

     A posicao e medida do proprio botao, nao calculada de indice
     vezes altura: no celular a barra deita e os itens rolam por
     dentro dela, entao a conta daria errado. Ler o offset resolve
     os dois sentidos com o mesmo codigo.

     `pronta` so vira true depois da PRIMEIRA medida. Sem isso a
     marca entrava deslizando do canto 0,0 a cada carga de tela.
     ------------------------------------------------------------ */
  const lista = useRef(null)
  const local = useLocation()
  const [marca, setMarca] = useState({ x: 0, y: 0, l: 0, a: 0, pronta: false })

  useLayoutEffect(() => {
    const caixa = lista.current
    if (!caixa) return undefined

    const medir = () => {
      const atual = caixa.querySelector('.rail__btn.is-atual')
      if (!atual) {
        setMarca((m) => ({ ...m, pronta: false }))
        return
      }
      setMarca({
        x: atual.offsetLeft,
        y: atual.offsetTop,
        l: atual.offsetWidth,
        a: atual.offsetHeight,
        pronta: true,
      })
    }

    medir()

    /* a barra muda de forma na virada para o celular, e a lista rola;
       nos dois casos a marca tem que reencontrar o botao */
    const observador = new ResizeObserver(medir)
    observador.observe(caixa)
    caixa.addEventListener('scroll', medir)
    return () => {
      observador.disconnect()
      caixa.removeEventListener('scroll', medir)
    }
  }, [local.pathname, abas])

  return (
    <div className="shell">
      {/* logo e avatar vivem fora da bolha, mas alinhados ao centro dela */}
      <Link to="/app" className="marca" aria-label="Página inicial">
        <img src={isDark ? logoModoEscuro : logoModoClaro} alt="LWN" />
      </Link>

      <nav className="rail vidro" aria-label="Navegação principal">
        <ul className="rail__lista" ref={lista}>
          {/* Uma peca so, que MUDA DE LUGAR — e o que faz o anel deslizar de
              um item para o outro em vez de piscar no destino. Ela e irma dos
              botoes, nao filha: se cada botao tivesse o seu, nao haveria o
              que animar entre eles. */}
          <span
            className={`rail__marca ${marca.pronta ? 'is-pronta' : ''}`.trim()}
            style={{
              '--marca-x': `${marca.x}px`,
              '--marca-y': `${marca.y}px`,
              '--marca-l': `${marca.l}px`,
              '--marca-a': `${marca.a}px`,
            }}
            aria-hidden="true"
          >
            <span className="rail__marca-anel" />
          </span>

          {abas.map((item) => {
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
        <header className="topbar vidro">
          <p className="topbar__saudacao">
            {saudacao()}, <strong>{primeiroNome(user?.name)}</strong>!
          </p>

          <form className="omni" onSubmit={(evento) => evento.preventDefault()} role="search">
            {/* o orbe se anima pelo relogio, nao pelo nascimento do
                elemento: trocar de aba remonta o header e a volta
                continua de onde estava */}
            <ParticleInterlock
              className="omni__orb"
              tamanho={26}
              cor={isDark ? '#e8f0ff' : '#1b4386'}
              destaque={isDark ? '#7db4ff' : '#4d8ff0'}
              densidade={96}
              pontoTamanho={112}
            />
            <input
              className="omni__campo"
              value={valorBusca}
              onChange={(evento) => mudarBusca?.(evento.target.value)}
              placeholder={placeholderBusca ?? 'Buscar cliente, obra ou configurações'}
              aria-label="Buscar"
            />
          </form>

          {/* a escolha de tema mora so em Configuracoes > Aparencia */}
          <div className="topbar__acoes">
            <Notificacoes />
          </div>
        </header>

        {/* falha de gravacao aparece aqui, em cima de qualquer tela */}
        {erro && (
          <p className="shell__erro" role="alert">
            {erro}
            <button type="button" onClick={limparErro} aria-label="Fechar aviso">
              ×
            </button>
          </p>
        )}

        <main className="shell__conteudo">{children}</main>
      </div>

      {!semChat && (
        <BotaoChat acoes={acoesFlutuantes} aoAbrirChat={() => setChatAberto(true)} />
      )}

      <ChatSite aberto={chatAberto} aoFechar={() => setChatAberto(false)} />
    </div>
  )
}
