import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

/**
 * Janela em vidro, centralizada, com fundo escurecido.
 * Fecha no Esc, no clique fora e no X. Enquanto esta aberta, a rolagem
 * da pagina fica travada e o foco vai para dentro do dialogo.
 */
export default function Modal({ aberto, aoFechar, titulo, subtitulo, largura = 520, children }) {
  const caixa = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined

    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') aoFechar?.()
    }

    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTeclar)
    caixa.current?.focus()

    return () => {
      document.body.style.overflow = rolagem
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar?.()}>
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
