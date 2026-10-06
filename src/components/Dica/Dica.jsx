import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Dica.css'

/**
 * Dica que aparece ao passar o mouse (ou ao focar pelo teclado).
 *
 * A bolha vai para o <body>, e nao para dentro do elemento: os cards que
 * usam isto tem `overflow: hidden` (cantos arredondados, gradiente), e
 * uma bolha de dentro deles sairia cortada justamente onde ela importa.
 * Ela abre ACIMA do elemento; sem espaco em cima, abre embaixo.
 *
 *   <Dica as="article" texto={card.informacoes} className="setorcard">...</Dica>
 *
 * Sem `texto`, e so o elemento — nada de bolha vazia.
 */
export default function Dica({ as: Elemento = 'div', texto, titulo, children, ...resto }) {
  const alvo = useRef(null)
  const bolha = useRef(null)
  const [aberta, setAberta] = useState(false)
  const [lugar, setLugar] = useState(null)

  const temDica = Boolean(String(texto ?? '').trim())

  const abrir = useCallback(() => temDica && setAberta(true), [temDica])
  const fechar = useCallback(() => {
    setAberta(false)
    setLugar(null)
  }, [])

  /* posiciona depois de a bolha existir, para saber a altura dela */
  useLayoutEffect(() => {
    if (!aberta || !alvo.current || !bolha.current) return
    const caixa = alvo.current.getBoundingClientRect()
    const b = bolha.current.getBoundingClientRect()
    const margem = 8
    const cabeEmCima = caixa.top - b.height - margem > 8
    const left = Math.min(
      Math.max(8, caixa.left + caixa.width / 2 - b.width / 2),
      window.innerWidth - b.width - 8,
    )
    setLugar({
      top: cabeEmCima ? caixa.top - b.height - margem : caixa.bottom + margem,
      left,
      lado: cabeEmCima ? 'cima' : 'baixo',
    })
  }, [aberta])

  return (
    <>
      <Elemento
        ref={alvo}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onFocus={abrir}
        onBlur={fechar}
        {...resto}
      >
        {children}
      </Elemento>

      {aberta &&
        createPortal(
          <div
            ref={bolha}
            className="dica"
            role="tooltip"
            data-lado={lugar?.lado}
            style={
              lugar
                ? { top: lugar.top, left: lugar.left }
                : /* primeira pintura: fora da tela, so para medir */
                  { top: -9999, left: -9999 }
            }
          >
            {titulo && <strong className="dica__titulo">{titulo}</strong>}
            <span className="dica__texto">{texto}</span>
          </div>,
          document.body,
        )}
    </>
  )
}
