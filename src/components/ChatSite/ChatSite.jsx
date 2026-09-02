import { useEffect, useRef, useState } from 'react'
import Avatar from '@/components/Avatar/Avatar'
import Modal from '@/components/Modal/Modal'
import { useAuth } from '@/context/AuthContext'
import { useDados } from '@/context/DadosContext'
import { dataHora } from '@/utils/formato'
import './ChatSite.css'

/**
 * A conversa geral da equipe.
 *
 * E separada do chat da obra de proposito: aquele morre com a obra e vira
 * historico dela; este e do dia a dia e nao pertence a obra nenhuma. Por isso
 * o botao que abre este some quando a pessoa entra numa obra — la dentro o
 * chat que importa e o da obra.
 *
 * Nao exige permissao: conversar e de todo mundo que entra. O que se controla
 * e quem apaga — cada um tira so a propria mensagem, e a API confere de novo.
 */

const Enviar = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12 20 4l-8 16-2-6z" />
  </svg>
)

const Lixo = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </svg>
)

export default function ChatSite({ aberto, aoFechar }) {
  const { user } = useAuth()
  const { carregarChatDoSite, enviarNoChatDoSite, apagarDoChatDoSite, pessoaPorId } = useDados()

  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const fim = useRef(null)

  /* a conversa so e buscada quando o pop-up abre: ela nao entra na carga do
     quadro, que ja e grande */
  useEffect(() => {
    if (!aberto) return undefined
    let vivo = true
    setCarregando(true)
    setErro('')

    carregarChatDoSite()
      .then((lista) => {
        if (vivo) setMensagens(lista)
      })
      .catch((e) => {
        if (vivo) setErro(e.message)
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })

    return () => {
      vivo = false
    }
  }, [aberto, carregarChatDoSite])

  /* sempre no fim: numa conversa, o que interessa e a ultima mensagem */
  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ block: 'end' })
  }, [aberto, mensagens.length])

  const enviar = async (evento) => {
    evento.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo || enviando) return

    setEnviando(true)
    try {
      const nova = await enviarNoChatDoSite(conteudo)
      /* a mensagem entra na lista aqui mesmo: recarregar o chat inteiro para
         mostrar uma linha nova daria um piscar em toda a conversa */
      setMensagens((atual) => [...atual, nova])
      setTexto('')
      setErro('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const apagar = async (id) => {
    try {
      await apagarDoChatDoSite(id)
      setMensagens((atual) => atual.filter((m) => m.id !== id))
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Chat da equipe" largura={520}>
      <div className="chatsite">
        <div className="chatsite__lista">
          {carregando && <p className="chatsite__vazio">Carregando a conversa...</p>}

          {!carregando && mensagens.length === 0 && (
            <p className="chatsite__vazio">
              Nenhuma mensagem ainda. Escreva a primeira aqui embaixo.
            </p>
          )}

          {mensagens.map((m) => {
            const minha = String(m.autorId) === String(user?.id)
            const autor = pessoaPorId(m.autorId)
            return (
              <article
                key={m.id}
                className={`chatsite__msg ${minha ? 'is-minha' : ''}`.trim()}
              >
                {!minha && (
                  <Avatar nome={m.autorNome} foto={autor?.foto} tamanho={28} titulo={m.autorNome} />
                )}

                <div className="chatsite__balao">
                  {!minha && <p className="chatsite__autor">{m.autorNome}</p>}
                  <p className="chatsite__texto">{m.texto}</p>
                  <p className="chatsite__pe">
                    <time>{dataHora(m.enviadaEm)}</time>
                    {minha && (
                      <button
                        type="button"
                        className="chatsite__apagar"
                        onClick={() => apagar(m.id)}
                        aria-label="Apagar mensagem"
                        title="Apagar"
                      >
                        <Lixo />
                      </button>
                    )}
                  </p>
                </div>
              </article>
            )
          })}

          <span ref={fim} />
        </div>

        {erro && (
          <p className="chatsite__erro" role="alert">
            {erro}
          </p>
        )}

        <form className="chatsite__envio" onSubmit={enviar}>
          <input
            className="chatsite__campo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva a mensagem..."
            aria-label="Mensagem"
          />
          <button
            type="submit"
            className="chatsite__botao"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar mensagem"
            title="Enviar"
          >
            <Enviar />
          </button>
        </form>
      </div>
    </Modal>
  )
}
