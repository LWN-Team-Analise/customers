import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useDados } from '@/context/DadosContext'
import Avatar from '@/components/Avatar/Avatar'
import Busca from '@/components/Busca/Busca'
import ChatSite from '@/components/ChatSite/ChatSite'
import IlhaAviso from '@/components/IlhaAviso/IlhaAviso'
import ChatBot from '@/components/ChatBot/ChatBot'
import Confirma from '@/components/Confirma/Confirma'
import { ehAplicativo } from '@/utils/dispositivo'
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
  /* Tres barras, e nao um desenho: separadas, cada uma gira por conta
     propria. Abrindo, o conjunto inteiro da meia volta enquanto a de
     cima e a de baixo se cruzam e a do meio some — o X nasce girando,
     que e bem diferente de duas linhas que simplesmente viram X. */
  hamburguer: () => (
    <span className="ham" aria-hidden="true">
      <span className="ham__bar ham__bar--1" />
      <span className="ham__bar ham__bar--2" />
      <span className="ham__bar ham__bar--3" />
    </span>
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
  robo: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" {...traco}>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 4.5V8M9.5 13h.01M14.5 13h.01M9.5 16h5" />
      <circle cx="12" cy="3.4" r="1.2" />
    </svg>
  ),
  cadeado: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...traco} strokeWidth="1.9">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <path d="M12 14.4v2.2" />
    </svg>
  ),
  relogio: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...traco} strokeWidth="1.9">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 1.9" />
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
    permissoes: ['editar_usuario', 'editar_cargo', 'editar_cargo_titulo'],
  },
]

/* ------------------------------------------------------------
   As tres que ficam na barra do celular

   No computador a bolha e vertical e cabe o menu inteiro. No
   celular ela deita no rodape, e seis itens ali so cabiam rolando
   de lado — uma barra que rola e uma barra onde ninguem acha o
   quarto item, porque nada indica que ha um quarto item.

   Entao ficam quatro, que sao as telas do dia a dia, e o resto
   entra na gaveta do botao do meio. A gaveta abre ACIMA da barra,
   colada nela: e a continuacao do mesmo menu, e nao um pop-up que
   tapa a tela e precisa ser fechado.

   A ORDEM na barra nao e a do menu: ela e

       inicio · obras · [ mais ] · concluidas · clientes

   com o botao redondo no meio, onde o polegar chega sem esticar. Quem
   poe cada um no seu lugar e o `order` do CSS, a partir do `data-id`
   de cada item — o HTML continua na ordem do menu, que e a que o
   teclado e o leitor de tela seguem.
   ------------------------------------------------------------ */
const PRINCIPAIS = ['inicio', 'obras', 'concluidas', 'clientes']

/** Avatar do rodape: abre o menu de Configuracoes / Sair. */
/**
 * `naBarra` e a copia que mora DENTRO da barra de cima, no celular.
 *
 * A outra copia flutua no canto, em `position: fixed`. Flutuando, ela
 * passava por cima do campo de busca — e onde ela cai depende do
 * recorte do aparelho (a area segura do iPhone), entao nao havia conta
 * que a deixasse alinhada em todo telefone.
 *
 * Dentro da barra ela e um item como os outros: nao ha o que alinhar, e
 * nao ha como sobrepor. As duas copias existem ao mesmo tempo no HTML e
 * o CSS mostra uma de cada vez — a do canto no computador, a da barra
 * no celular.
 */
function MenuUsuario({ naBarra = false }) {
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
    <div className={`euzinho ${naBarra ? 'euzinho--barra' : ''}`.trim()} ref={caixa}>
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

/* ---------------- onde o botao mora ----------------

   O canto inferior direito e o padrao, e continua sendo: quem nunca
   arrastar nunca vai saber que da. Mas o botao flutua POR CIMA da tela,
   e numa tabela larga ele acaba pousando justo sobre a ultima coluna —
   dai a vontade de empurrar o botao para o lado, e nao de mudar a
   tabela de lugar.

   A posicao e guardada como o canto superior esquerdo do botao, em
   pixels. Guardar "encostado a direita" seria mais elegante, mas o
   botao pode parar no meio da tela: nao ha borda a que se referir. */
const CANTO = 'customers.bolhachat-posicao'
const BORDA = 12
/* o menu tem ~200px de altura e 210px de largura, contra 54px de botao:
   ele sobra uns 160px para o lado de fora */
const MENU_ALTO = 220
const MENU_SOBRA = 170

function lerCanto() {
  try {
    const cru = JSON.parse(localStorage.getItem(CANTO) ?? 'null')
    if (!cru || typeof cru.x !== 'number' || typeof cru.y !== 'number') return null
    return cru
  } catch {
    return null
  }
}

/* a janela encolhe e o botao guardado ficaria do lado de fora, sem
   volta: todo ponto e trazido para dentro antes de virar estilo */
function dentroDaTela({ x, y }, larg, alt) {
  return {
    x: Math.min(Math.max(BORDA, x), Math.max(BORDA, window.innerWidth - larg - BORDA)),
    y: Math.min(Math.max(BORDA, y), Math.max(BORDA, window.innerHeight - alt - BORDA)),
  }
}

/**
 * O botao redondo do canto inferior direito.
 *
 * Ele e sempre um "+" com menu: em qualquer tela ha pelo menos duas
 * coisas atras dele — o chat da equipe e o Chat LWN —, e um botao que faz
 * duas coisas precisa perguntar qual. Antes ele era atalho direto para o
 * chat e so virava menu na tela de Obras, onde havia a observacao do
 * quadro para acrescentar; com o bot entrando em todas as telas, o
 * atalho direto deixou de existir.
 *
 * Dentro de uma obra ele nao aparece: la o chat que vale e o da obra, e
 * dois botoes de chat na mesma tela so confundiriam.
 */
function BotaoChat({ acoes = [], aoAbrirChat, aoAbrirBot }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)
  const [canto, setCanto] = useState(lerCanto)
  /* o arrasto em curso; enquanto vale, o clique nao conta */
  const arrasto = useRef(null)
  /* quando o ultimo arrasto terminou. O clique que o navegador dispara
     no fim de um arrasto chega logo depois do pointerup: e por essa
     distancia no relogio que ele e reconhecido e descartado. */
  const fimDoArrasto = useRef(0)



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

  /* a janela mudou de tamanho: o botao volta para dentro dela */
  useEffect(() => {
    if (!canto) return undefined
    const caber = () => {
      const alvo = caixa.current
      if (!alvo) return
      const r = alvo.getBoundingClientRect()
      setCanto((atual) => (atual ? dentroDaTela(atual, r.width, r.height) : atual))
    }
    window.addEventListener('resize', caber)
    return () => window.removeEventListener('resize', caber)
  }, [canto])

  /**
   * Arrastar o botao.
   *
   * O mesmo gesto que abre o chat e o que muda o botao de lugar, entao
   * um dos dois tem de ceder: ate 4px de caminho ainda e um clique
   * (ninguem acerta o pixel), e do quinto em diante vira arrasto e o
   * clique nao acontece mais. E a mesma regra que a ilha do topo usa
   * para nao confundir toque com rolagem.
   */
  const pegar = (evento) => {
    const alvo = caixa.current
    if (!alvo || evento.button !== 0) return
    const r = alvo.getBoundingClientRect()
    arrasto.current = {
      dx: evento.clientX - r.left,
      dy: evento.clientY - r.top,
      larg: r.width,
      alt: r.height,
      andou: false,
      onde: null,
    }

    const mover = (e) => {
      const a = arrasto.current
      if (!a) return
      if (
        !a.andou &&
        Math.abs(e.clientX - (r.left + a.dx)) < 4 &&
        Math.abs(e.clientY - (r.top + a.dy)) < 4
      ) {
        return
      }
      a.andou = true
      /* o menu aberto atrapalha a mira: ele fecha no primeiro milimetro */
      setAberto(false)
      a.onde = dentroDaTela({ x: e.clientX - a.dx, y: e.clientY - a.dy }, a.larg, a.alt)
      setCanto(a.onde)
    }

    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      const a = arrasto.current
      if (a?.andou && a.onde) {
        fimDoArrasto.current = Date.now()
        try {
          localStorage.setItem(CANTO, JSON.stringify(a.onde))
        } catch {
          /* sem storage o lugar novo vale ate recarregar */
        }
      }
      arrasto.current = null
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  /* dois cliques na bolha devolvem o canto de fabrica */
  const devolver = () => {
    setCanto(null)
    try {
      localStorage.removeItem(CANTO)
    } catch {
      /* sem storage nao ha o que limpar */
    }
  }

  /* De onde o menu sai. Ele nasce ACIMA do botao e alinhado pela
     direita, que e o certo no canto de origem. Arrastado para perto do
     topo ou da borda esquerda, essa mesma abertura cairia fora da tela
     — as medidas abaixo sao a altura e a sobra lateral do menu, e nao a
     metade da tela: o que decide e se o menu CABE, nao em que lado do
     monitor o botao esta. */
  const lados = canto
    ? `${canto.y < MENU_ALTO ? 'is-parabaixo' : ''} ${
        canto.x < MENU_SOBRA ? 'is-esquerda' : ''
      }`.trim()
    : ''

  const itens = [
    ...acoes,
    {
      id: 'chat',
      rotulo: 'Chat da equipe',
      Glifo: Icone.chatPequeno,
      aoClicar: aoAbrirChat,
    },
    {
      id: 'bot',
      rotulo: 'Chat LWN',
      Glifo: Icone.robo,
      aoClicar: aoAbrirBot,
    },
  ]

  return (
    <div
      className={`bolhachat ${lados}`.trim()}
      ref={caixa}
      style={canto ? { left: canto.x, top: canto.y, right: 'auto', bottom: 'auto' } : undefined}
    >
      {aberto && (
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
        onPointerDown={pegar}
        onDoubleClick={devolver}
        onClick={() => {
          /* o botao andou junto com o ponteiro, entao o clique do fim do
             arrasto cai nele mesmo — e abriria o menu a cada vez que
             alguem so quis mudar o botao de lugar */
          if (Date.now() - fimDoArrasto.current < 300) return
          setAberto((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Abrir o chat da equipe, o Chat LWN ou acrescentar"
        title="Abrir — arraste para mudar de lugar, dois cliques voltam ao canto"
      >
        <Icone.mais />
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
  const navegar = useNavigate()
  const [chatAberto, setChatAberto] = useState(false)
  const [botAberto, setBotAberto] = useState(false)

  /* a tela pode assumir o campo de busca; se nao assumir, ele e do
     sistema e abre a lista de resultados por conta propria */
  const controlada = typeof busca === 'string'

  /* cada cargo enxerga so as abas que a permissao dele abre */
  const abas = useMemo(
    () =>
      MENU.filter((item) =>
        item.permissoes ? item.permissoes.some((p) => pode(p)) : pode(item.permissao),
      ),
    [pode],
  )

  /* as que saem da barra no celular e vao para a gaveta */
  const escondidas = useMemo(() => abas.filter((i) => !PRINCIPAIS.includes(i.id)), [abas])

  /* A ilha do aviso de senha. So no modo APLICATIVO — ver o comentario
     la embaixo, onde ela e desenhada. O shell precisa saber disso aqui
     em cima porque e ele quem reserva o espaco dela no alto da tela. */
  const avisoDeSenha = Boolean(user?.senhaTemporaria) && ehAplicativo()

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
  /* a gaveta do hamburguer (so existe no celular; ver AppShell.css) */
  const [gaveta, setGaveta] = useState(false)

  /* trocou de tela, fecha: deixar aberta esconderia a tela que a
     pessoa acabou de escolher */
  useEffect(() => {
    setGaveta(false)
  }, [local.pathname])

  useLayoutEffect(() => {
    const caixa = lista.current
    if (!caixa) return undefined

    const medir = () => {
      const atual = caixa.querySelector('.rail__btn.is-atual')
      /* `offsetParent` nulo = o botao esta escondido. Acontece no
         celular quando a tela aberta e uma das que foram para a
         gaveta: sem esta guarda o anel media 0x0 e ia encolher no
         canto da barra, parecendo defeito. */
      if (!atual || atual.offsetParent === null) {
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
    <div className={`shell ${avisoDeSenha ? 'tem-ilha' : ''}`.trim()}>
      {/* logo e avatar vivem fora da bolha, mas alinhados ao centro dela */}
      <Link to="/app" className="marca" aria-label="Página inicial">
        <img src={isDark ? logoModoEscuro : logoModoClaro} alt="LWN" />
      </Link>

      <nav
        className="rail vidro"
        aria-label="Navegação principal"
        /* as medidas do item atual moram na BARRA, e nao so na marca:
           a camada liquida do celular le as mesmas para saber onde
           pousar a bolha */
        style={{
          '--marca-x': `${marca.x}px`,
          '--marca-y': `${marca.y}px`,
          '--marca-l': `${marca.l}px`,
          '--marca-a': `${marca.a}px`,
        }}
      >
        {/* ---------------- o indicador (so no celular) ----------------

            Um circulo DA COR DA BARRA que desliza ate o item escolhido.
            Ele sobe metade para fora da faixa, e duas pecas nas laterais
            preenchem o vinco que sobraria entre o circulo e a linha reta
            da barra — e o que faz a silhueta subir em curva em vez de
            ter um circulo encostado num retangulo.

            A cor viva nao esta aqui: quem acende e o PROPRIO icone do
            item, que sobe para dentro deste circulo um instante depois
            de ele chegar. Essa espera e o efeito. */}
        <span
          className={`rail__indicador ${marca.pronta ? 'is-pronta' : ''}`.trim()}
          aria-hidden="true"
        />

        {/* o mesmo encaixe, parado, para o botao do meio */}
        {escondidas.length > 0 && <span className="rail__encaixe" aria-hidden="true" />}

        <ul className="rail__lista" ref={lista}>
          {/* Uma peca so, que MUDA DE LUGAR — e o que faz o anel deslizar de
              um item para o outro em vez de piscar no destino. Ela e irma dos
              botoes, nao filha: se cada botao tivesse o seu, nao haveria o
              que animar entre eles. */}
          <span
            className={`rail__marca ${marca.pronta ? 'is-pronta' : ''}`.trim()}
            aria-hidden="true"
          >
            <span className="rail__marca-anel" />
          </span>

          {abas.map((item) => {
            const Glifo = Icone[item.id]
            return (
              /* `data-principal` e o que o CSS le para esconder, no
                 celular, quem nao e uma das tres */
              <li
                key={item.id}
                data-id={item.id}
                data-principal={PRINCIPAIS.includes(item.id) ? 'sim' : 'nao'}
              >
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

          {/* O hamburguer. So aparece no celular, e so quando ha o que
              guardar: com duas abas liberadas pelo cargo, as duas cabem
              na barra e um botao "Mais" que abre o vazio seria pior que
              botao nenhum. */}
          {escondidas.length > 0 && (
            <li className="rail__somobile">
              {/* `is-atual` de proposito FORA daqui: essa classe e o que o
                  anel deslizante persegue, e ele nao tem o que fazer em
                  volta de um botao redondo que ja e destaque por si. O
                  estado aberto se ve no proprio botao. */}
              <button
                type="button"
                className="rail__btn rail__mais"
                onClick={() => setGaveta((v) => !v)}
                aria-expanded={gaveta}
                aria-controls="rail-gaveta"
                aria-label="Mais telas"
                title="Mais telas"
              >
                <span className="rail__glifo">
                  <Icone.hamburguer />
                </span>
                <span className="rail__rotulo">Mais</span>
              </button>
            </li>
          )}
        </ul>

        {/* A gaveta: o resto do menu, numa faixa colada por cima da
            barra. Nao e pop-up — nao escurece a tela nem toma o foco;
            e o mesmo menu, continuando para cima.

            Ela fica MONTADA mesmo fechada, escondida por `visibility`.
            Desmontando, o fechar era instantaneo: a peca sumia do DOM
            antes de qualquer transicao rodar, e era isso que dava o
            estalo seco. Montada, os dois sentidos animam. */}
        {escondidas.length > 0 && (
          <div
            className={`rail__gaveta ${gaveta ? 'is-aberta' : ''}`.trim()}
            id="rail-gaveta"
            aria-hidden={!gaveta}
          >
            {escondidas.map((item) => {
              const Glifo = Icone[item.id]
              return (
                <NavLink
                  key={item.id}
                  to={item.rota}
                  end={item.exato}
                  className={({ isActive }) => `rail__item ${isActive ? 'is-atual' : ''}`.trim()}
                  onClick={() => setGaveta(false)}
                  /* fechada, ela sai tambem do caminho do Tab */
                  tabIndex={gaveta ? undefined : -1}
                >
                  <span className="rail__glifo">
                    <Glifo />
                  </span>
                  {item.rotulo}
                </NavLink>
              )
            })}
          </div>
        )}
      </nav>

      <MenuUsuario />

      <div className="shell__coluna">
        <header className="topbar vidro">
          <p className="topbar__saudacao">
            {saudacao()}, <strong>{primeiroNome(user?.name)}</strong>!
          </p>

          {/* Procura em cliente, obra, pessoa, tela e ajuste de uma vez
              só. A tela que quiser o campo para si passa `busca` e
              `aoBuscar`; sem isso ele é do sistema inteiro. */}
          <Busca
            valor={controlada ? busca : undefined}
            aoMudar={controlada ? aoBuscar : undefined}
            placeholder={placeholderBusca}
          />

          {/* a escolha de tema mora so em Configuracoes > Aparencia */}
          <div className="topbar__acoes">
            <Notificacoes />
            <MenuUsuario naBarra />
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
        <BotaoChat
          acoes={acoesFlutuantes}
          aoAbrirChat={() => setChatAberto(true)}
          aoAbrirBot={() => setBotAberto(true)}
        />
      )}

      <ChatSite aberto={chatAberto} aoFechar={() => setChatAberto(false)} />
      <ChatBot aberto={botAberto} aoFechar={() => setBotAberto(false)} />

      {/* ---------------- a senha ainda e a padrao ----------------

          `senhaTemporaria` vem do banco (usuario.senha_temporaria) e so
          cai quando a pessoa troca a senha de verdade — trocar pela tela
          ou pelo "esqueci minha senha" zera a coluna. Enquanto ela for
          true a ilha esta aqui, em TODA tela de dentro do sistema,
          porque o AppShell e o que toda tela veste.

          Nao ha como dispensar o aviso: "Agora nao" recolhe a ilha para
          a pilula e ela continua no alto da tela. Senha que outra pessoa
          escolheu e senha que outra pessoa sabe.

          SO NO IPHONE. A ilha e a citacao de uma peca que so existe la:
          no iPhone ela pousa onde o aparelho ja tem uma, e a pessoa
          reconhece o gesto antes de ler o texto.

          SO NO MODO APLICATIVO. No navegador comum ela dividia o alto
          da tela com a barra de endereco e com a propria barra de
          busca do sistema, e o que se via era uma pastilha preta por
          cima do campo de procurar. Instalado na tela de inicio nao ha
          barra de endereco: o alto da tela e so do aviso, e o resto do
          sistema comeca abaixo dele (ver `.shell.tem-ilha` no CSS).

          O aviso nao se perde para quem usa pelo navegador: o bloco
          Senha, em Configuracoes, diz a mesma coisa em toda tela e em
          todo aparelho. */}
      {avisoDeSenha && (
        <IlhaAviso
          chave="customers.ilha-senha"
          Glifo={Icone.cadeado}
          titulo="Troque a sua senha"
          subtitulo="A senha que você está usando foi definida por outra pessoa e continua valendo. Este aviso fica aqui até você criar a sua."
          acoes={[
            {
              id: 'trocar',
              rotulo: 'Trocar a senha agora',
              Glifo: Icone.cadeado,
              /* leva ate o bloco Senha em Configuracoes e o acende la */
              aoClicar: () => navegar('/app/configuracoes', { state: { focar: 'senha' } }),
            },
            {
              id: 'depois',
              rotulo: 'Agora não',
              Glifo: Icone.relogio,
              /* sem acao: recolher para a pilula ja e o que este botao faz */
            },
          ]}
        />
      )}
    </div>
  )
}
