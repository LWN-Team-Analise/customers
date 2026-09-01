import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

/**
 * Janela centralizada, com fundo escurecido. Superficie OPACA: e o unico
 * lugar do sistema sem o vidro, para o formulario nao brigar com o que
 * passa por tras.
 *
 * Fecha no Esc, no clique fora e no X. Enquanto esta aberta, a rolagem
 * da pagina fica travada e o foco vai para dentro do dialogo.
 *
 * `nivel`: pop-up aberto por cima de outro (editar um cargo a partir da
 * lista de cargos, por exemplo) usa nivel={1} para ficar na frente.
 */
export default function Modal({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  largura = 520,
  nivel = 0,
  children,
}) {
  const caixa = useRef(null)

  /* aoFechar quase sempre chega como funcao nova a cada render do pai
     (`() => setAberto(false)`). Guardada na ref, ela nao entra nas
     dependencias do efeito abaixo — se entrasse, o efeito rodaria a
     cada tecla digitada e o foco voltaria para a caixa, tirando o
     cursor do campo depois de UMA letra. */
  const fechar = useRef(aoFechar)
  useEffect(() => {
    fechar.current = aoFechar
  }, [aoFechar])

  useEffect(() => {
    if (!aberto) return undefined

    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') fechar.current?.()
    }

    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTeclar)

    /* leva o foco para o dialogo uma vez, na abertura: dai o leitor de
       tela anuncia o titulo e o Tab anda dentro do formulario */
    caixa.current?.focus()

    return () => {
      document.body.style.overflow = rolagem
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  if (!aberto) return null

  return createPortal(
    <div
      className="modal"
      style={nivel > 0 ? { zIndex: 90 + nivel * 10 } : undefined}
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar?.()}
    >
      <div
        className="modal__caixa"
        style={{ maxWidth: largura }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={caixa}
      >
        <header className="modal__topo">
          <div>
            <h2 className="modal__titulo">{titulo}</h2>
            {subtitulo && <p className="modal__sub">{subtitulo}</p>}
          </div>
          <button type="button" className="modal__x" onClick={aoFechar} aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="modal__corpo">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
