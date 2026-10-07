import { useCallback, useState } from 'react'

/**
 * ARRASTAR CHECKS — para cima, para baixo, ou para outro card (de
 * qualquer setor, de qualquer etapa).
 *
 * O check e pego pelo pegador (o primeiro botao que aparece ao passar o
 * mouse nele) e solto em cima de outro check — antes ou depois dele,
 * conforme a metade em que o mouse esta — ou no fim de um card.
 *
 * Ao soltar, o card de destino manda a fila inteira dele, ja na ordem
 * nova, para \`ordenar(cardId, checkIds)\`. O servidor decide o resto
 * (PUT /roteiro/cards/:id/checks/ordem): mudar a ordem vale na hora;
 * levar para outro card um check que alguma obra ja marcou vira versao
 * nova, so para as obras criadas dali em diante.
 *
 * Os checks do sistema mudam de ordem e de card, mas nao saem da etapa
 * deles: a tela recusa antes (\`aoRecusar\`) e o servidor tambem.
 *
 * So entram na fila os checks que ainda valem (\`!vigenteAte\`): numa obra
 * antiga aparece check que ja saiu do roteiro, e ele nao tem mais ordem.
 */
export function useArrasteDeChecks({ ordenar, aoRecusar }) {
  /* { checkId, cardId, etapaId, sistema, titulo } */
  const [arrastando, setArrastando] = useState(null)
  /* { cardId, antesDe } — antesDe null = no fim do card */
  const [alvo, setAlvo] = useState(null)

  const vivos = (card) => (card.checks ?? []).filter((c) => !c.vigenteAte)

  const mirar = useCallback((cardId, antesDe) => {
    setAlvo((atual) =>
      atual?.cardId === cardId && atual?.antesDe === antesDe ? atual : { cardId, antesDe },
    )
  }, [])

  const terminar = useCallback(() => {
    setArrastando(null)
    setAlvo(null)
  }, [])

  const comecar = (check, card, etapa) => (evento) => {
    evento.dataTransfer.effectAllowed = 'move'
    try {
      evento.dataTransfer.setData('text/plain', check.titulo)
    } catch {
      /* navegador que nao aceita setData no dragstart: o estado ja basta */
    }
    setArrastando({
      checkId: check.id,
      cardId: card.id,
      etapaId: etapa.id,
      sistema: Boolean(check.tipo) && check.tipo !== 'comum',
      titulo: check.titulo,
    })
  }

  /* em cima de um check: antes dele na metade de cima, depois na de baixo */
  const sobreCheck = (check, card) => (evento) => {
    if (!arrastando) return
    evento.preventDefault()
    evento.stopPropagation()
    evento.dataTransfer.dropEffect = 'move'
    const caixa = evento.currentTarget.getBoundingClientRect()
    const depois = evento.clientY > caixa.top + caixa.height / 2
    const lista = vivos(card)
    const i = lista.findIndex((c) => c.id === check.id)
    mirar(card.id, depois ? (lista[i + 1]?.id ?? null) : check.id)
  }

  /* no card, fora de um check: so vale abaixo do ultimo (ou card vazio) */
  const sobreCard = (card) => (evento) => {
    if (!arrastando) return
    evento.preventDefault()
    evento.dataTransfer.dropEffect = 'move'
    const ultimo = [...evento.currentTarget.querySelectorAll('[data-check]')].at(-1)
    if (!ultimo || evento.clientY > ultimo.getBoundingClientRect().bottom) mirar(card.id, null)
  }

  const soltarEm = (card, etapa) => async (evento) => {
    evento.preventDefault()
    evento.stopPropagation()
    const pego = arrastando
    const destino = alvo?.cardId === card.id ? alvo : { cardId: card.id, antesDe: null }
    terminar()
    if (!pego || destino.antesDe === pego.checkId) return

    if (pego.sistema && String(etapa.id) !== String(pego.etapaId)) {
      aoRecusar?.(`"${pego.titulo}" é do sistema: muda de ordem e de card, mas não sai da etapa dele.`)
      return
    }

    const antes = vivos(card).map((c) => c.id)
    const fila = antes.filter((id) => id !== pego.checkId)
    const posicao = destino.antesDe ? fila.indexOf(destino.antesDe) : -1
    fila.splice(posicao < 0 ? fila.length : posicao, 0, pego.checkId)
    if (pego.cardId === card.id && fila.join('|') === antes.join('|')) return

    try {
      await ordenar(card.id, fila)
    } catch (e) {
      aoRecusar?.(e.message)
    }
  }

  return { arrastando, alvo, comecar, terminar, sobreCheck, sobreCard, soltarEm }
}

/**
 * O recado de quando o check levado para outro card ja tinha sido
 * marcado em alguma obra — e por isso virou versao nova.
 *
 * `nestaObra`: o arraste foi feito de dentro de uma obra, que tambem
 * continua com o check onde estava.
 */
export function textoDaVersao(versionados, nestaObra = false) {
  const nomes = versionados.map((v) => `"${v.titulo}"`).join(', ')
  const obras = Math.max(...versionados.map((v) => v.obras))
  return (
    `${nomes} já foi marcado em ${obras} obra${obras > 1 ? 's' : ''}. No lugar novo ele vale ` +
    `para as obras criadas a partir de agora; nas que já existem${nestaObra ? ' — esta inclusive —' : ''} ` +
    'ele continua onde estava.'
  )
}
