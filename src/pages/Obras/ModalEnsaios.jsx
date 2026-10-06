import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import './ModalEnsaios.css'

/**
 * O CATALOGO de ensaios — separado das obras.
 *
 * E a lista de onde o Planejamento de ensaios escolhe. Quem mexe aqui e
 * quem tem "Adicionar / editar ensaios" (gerenciar_ensaios); a API
 * recusa os outros do mesmo jeito.
 *
 * Renomear vale para todas as obras (e o mesmo ensaio). Excluir tira do
 * catalogo: as obras que ja planejaram aquele ensaio continuam com ele,
 * e com a execucao registrada.
 */
export default function ModalEnsaios({ aberto, aoFechar }) {
  const { ensaiosAtivos, adicionarEnsaio, atualizarEnsaio, removerEnsaio, pode } = useDados()
  const podeMexer = pode('gerenciar_ensaios')

  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState(null) // { id, nome }
  const [apagando, setApagando] = useState(null) // id
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setNovo('')
    setEditando(null)
    setApagando(null)
    setErro('')
  }, [aberto])

  const fazer = async (acao) => {
    setOcupado(true)
    setErro('')
    try {
      await acao()
      return true
    } catch (e) {
      setErro(e.message)
      return false
    } finally {
      setOcupado(false)
    }
  }

  const adicionar = async (evento) => {
    evento.preventDefault()
    if (!novo.trim()) return
    if (await fazer(() => adicionarEnsaio({ nome: novo.trim() }))) setNovo('')
  }

  const renomear = async (evento) => {
    evento.preventDefault()
    if (!editando?.nome.trim()) {
      setErro('Escreva o nome do ensaio.')
      return
    }
    if (await fazer(() => atualizarEnsaio(editando.id, { nome: editando.nome.trim() }))) {
      setEditando(null)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Ensaios"
      subtitulo="O catálogo de onde o Planejamento de ensaios escolhe."
      largura={480}
      nivel={1}
    >
      <div className="catalogo">
        <ul className="catalogo__lista">
          {ensaiosAtivos.map((e) => (
            <li key={e.id} className="catalogo__item">
              {editando?.id === e.id ? (
                <form className="catalogo__edicao" onSubmit={renomear}>
                  <input
                    className="catalogo__campo"
                    value={editando.nome}
                    onChange={(ev) => setEditando({ ...editando, nome: ev.target.value })}
                    aria-label="Nome do ensaio"
                    autoFocus
                  />
                  <button type="submit" className="catalogo__botao" disabled={ocupado}>
                    Salvar
                  </button>
                  <button type="button" className="catalogo__botao" onClick={() => setEditando(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <span className="catalogo__nome">{e.nome}</span>
                  {podeMexer &&
                    (apagando === e.id ? (
                      <>
                        <span className="catalogo__pergunta">Excluir?</span>
                        <button
                          type="button"
                          className="catalogo__botao catalogo__botao--perigo"
                          disabled={ocupado}
                          onClick={async () => {
                            if (await fazer(() => removerEnsaio(e.id))) setApagando(null)
                          }}
                        >
                          Sim, excluir
                        </button>
                        <button type="button" className="catalogo__botao" onClick={() => setApagando(null)}>
                          Não
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="catalogo__botao"
                          onClick={() => {
                            setApagando(null)
                            setEditando({ id: e.id, nome: e.nome })
                          }}
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          className="catalogo__botao catalogo__botao--perigo"
                          onClick={() => {
                            setEditando(null)
                            setApagando(e.id)
                          }}
                        >
                          Excluir
                        </button>
                      </>
                    ))}
                </>
              )}
            </li>
          ))}
          {ensaiosAtivos.length === 0 && (
            <li className="ensaios__vazio">Nenhum ensaio no catálogo ainda.</li>
          )}
        </ul>

        {podeMexer && (
          <form className="catalogo__novo" onSubmit={adicionar}>
            <CampoTexto
              rotulo="Novo ensaio"
              largo
              placeholder="Ex.: Vazão"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
            />
            <Button type="submit" loading={ocupado} disabled={!novo.trim()}>
              Adicionar
            </Button>
          </form>
        )}

        <p className="formrot__dica formrot__dica--colada">
          Excluir tira o ensaio do catálogo. As obras que já o planejaram continuam com ele e com a
          execução registrada.
        </p>

        {erro && (
          <p className="formrot__erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Fechar
          </button>
        </footer>
      </div>
    </Modal>
  )
}
