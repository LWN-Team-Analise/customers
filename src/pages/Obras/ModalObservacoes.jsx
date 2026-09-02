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

const Lapis = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
  </svg>
)

/**
 * Observacoes do QUADRO — as que valem para as obras em geral, e nao
 * para uma obra so (essas ficam dentro da obra).
 *
 * Da para EDITAR a propria observacao, e nao so apagar.
 *
 * Antes so havia o lixo, e quem errasse uma palavra tinha de apagar o
 * recado e escrever tudo de novo — o que, num painel que a equipe le em
 * ordem, fazia a observacao mudar de lugar na lista e perder as
 * respostas que ja tinham vindo. Editar mantem a observacao onde ela
 * esta; a marca "editada" e o que diz a quem ja tinha lido que o texto
 * nao e mais o mesmo.
 *
 * Cada um mexe so na propria — a API confere de novo antes de gravar.
 */
export default function ModalObservacoes({ aberto, aoFechar, autor }) {
  const {
    observacoesQuadro,
    pessoaPorId,
    adicionarObservacaoQuadro,
    editarObservacaoQuadro,
    removerObservacaoQuadro,
  } = useDados()

  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  /* a observação que está aberta para edição (id), e o texto dela */
  const [editando, setEditando] = useState(null)
  const [rascunho, setRascunho] = useState('')

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

  const abrirEdicao = (o) => {
    setEditando(o.id)
    setRascunho(o.texto)
  }

  const salvarEdicao = async (evento) => {
    evento.preventDefault()
    if (!rascunho.trim()) return
    setSalvando(true)
    try {
      await editarObservacaoQuadro(editando, rascunho.trim())
      setEditando(null)
      setRascunho('')
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

        {observacoesQuadro.map((o) => {
          /* cada um mexe só na própria; a API confere de novo */
          const minha = String(o.autorId) === String(autor?.id)
          const emEdicao = editando === o.id

          return (
            <article key={o.id} className="quadrolista__item">
              <Avatar nome={o.autorNome} foto={pessoaPorId(o.autorId)?.foto} tamanho={32} />
              <div className="quadrolista__corpo">
                <p className="quadrolista__quem">
                  <strong>{o.autorNome}</strong>
                  <span>{dataHora(o.enviadaEm)}</span>
                  {/* quem já tinha lido precisa saber que o texto mudou */}
                  {o.editadaEm && <em className="quadrolista__editada">editada</em>}
                </p>

                {emEdicao ? (
                  <form className="quadrolista__form" onSubmit={salvarEdicao}>
                    <CampoArea
                      rotulo="Editar observação"
                      largo
                      linhas={3}
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                    />
                    <div className="quadrolista__formacoes">
                      <button
                        type="button"
                        className="formobra__cancelar"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                      <Button type="submit" disabled={!rascunho.trim()} loading={salvando}>
                        Salvar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="quadrolista__texto">{o.texto}</p>
                )}
              </div>

              {minha && !emEdicao && (
                <span className="quadrolista__ferramentas">
                  <button
                    type="button"
                    className="quadrolista__apagar"
                    onClick={() => abrirEdicao(o)}
                    aria-label={`Editar a sua observação de ${dataHora(o.enviadaEm)}`}
                    title="Editar"
                  >
                    <Lapis />
                  </button>
                  <button
                    type="button"
                    className="quadrolista__apagar"
                    onClick={() => removerObservacaoQuadro(o.id).catch(() => {})}
                    aria-label={`Apagar a sua observação de ${dataHora(o.enviadaEm)}`}
                    title="Apagar"
                  >
                    <Lixo />
                  </button>
                </span>
              )}
            </article>
          )
        })}
      </div>
    </Modal>
  )
}
