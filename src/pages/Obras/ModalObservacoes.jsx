import { useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import Avatar from '@/components/Avatar/Avatar'
import { CampoArea } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { dataHora } from '@/utils/formato'
import './ModalObservacoes.css'

const Lixo = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </svg>
)

/**
 * Observacoes do QUADRO — as que valem para as obras em geral, e nao
 * para uma obra so (essas ficam dentro da obra).
 */
export default function ModalObservacoes({ aberto, aoFechar, autor }) {
  const { observacoesQuadro, pessoaPorId, adicionarObservacaoQuadro, removerObservacaoQuadro } =
    useDados()

  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!texto.trim()) return
    setSalvando(true)
    try {
      await adicionarObservacaoQuadro(texto.trim())
      setTexto('')
    } catch {
      /* o recado do erro aparece na faixa do AppShell */
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Observações do quadro"
      subtitulo="Recados que valem para as obras em geral. Ficam com seu nome e o horário."
      largura={560}
    >
      <form className="quadroform" onSubmit={enviar}>
        <div className="quadroform__autor">
          <Avatar nome={autor?.name} foto={autor?.foto} tamanho={34} titulo={autor?.name} />
          <strong>{autor?.name ?? 'Usuário'}</strong>
        </div>

        <CampoArea
          rotulo="Nova observação"
          largo
          linhas={3}
          placeholder="O que a equipe precisa saber?"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        <div className="quadroform__acao">
          <Button type="submit" disabled={!texto.trim()} loading={salvando}>
            Adicionar
          </Button>
        </div>
      </form>

      <div className="quadrolista">
        {observacoesQuadro.length === 0 && (
          <p className="quadrolista__vazio">Nenhuma observação registrada ainda.</p>
        )}

        {observacoesQuadro.map((o) => (
          <article key={o.id} className="quadrolista__item">
            <Avatar nome={o.autorNome} foto={pessoaPorId(o.autorId)?.foto} tamanho={32} />
            <div className="quadrolista__corpo">
              <p className="quadrolista__quem">
                <strong>{o.autorNome}</strong>
                <span>{dataHora(o.enviadaEm)}</span>
              </p>
              <p className="quadrolista__texto">{o.texto}</p>
            </div>
            <button
              type="button"
              className="quadrolista__apagar"
              onClick={() => removerObservacaoQuadro(o.id).catch(() => {})}
              aria-label={`Apagar a observação de ${o.autorNome}`}
              title="Apagar"
            >
              <Lixo />
            </button>
          </article>
        ))}
      </div>
    </Modal>
  )
}
