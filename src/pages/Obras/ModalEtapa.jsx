import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import './ModalRoteiro.css'

/**
 * Etapa do roteiro: cria, renomeia e apaga.
 *
 * A posicao vem sozinha: etapa nova entra no fim da fila.
 *
 * O que muda aqui vale DESTA obra em diante — nunca para tras. Criar
 * uma etapa aqui a coloca nesta obra e nas proximas; excluir a tira
 * desta e das proximas, e as obras anteriores continuam com ela e com
 * tudo o que ja tinham marcado nela.
 */
export default function ModalEtapa({ aberto, etapa = null, obraId = null, aoFechar }) {
  const { adicionarEtapa, renomearEtapa, removerEtapa } = useDados()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const editando = Boolean(etapa)

  useEffect(() => {
    if (!aberto) return
    setNome(etapa?.nome ?? '')
    setErro('')
    setConfirmando(false)
  }, [aberto, etapa])

  const salvar = async (evento) => {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome da etapa.')
      return
    }

    setSalvando(true)
    try {
      if (editando) await renomearEtapa(etapa.id, nome.trim())
      else await adicionarEtapa(nome.trim(), obraId)
      aoFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const apagar = async () => {
    setSalvando(true)
    try {
      await removerEtapa(etapa.id, obraId)
      aoFechar()
    } catch (e) {
      setErro(e.message)
      setConfirmando(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? `Editar ${etapa.numero}ª etapa` : 'Nova etapa'}
      subtitulo="Vale desta obra em diante. As obras anteriores não mudam."
      largura={470}
    >
      <form className="formrot" onSubmit={salvar} noValidate>
        <CampoTexto
          rotulo="Nome da etapa"
          largo
          autoFocus
          placeholder="Ex.: Pós-obra"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erro}
          dica={editando ? undefined : 'Entra no fim da fila, depois da última etapa.'}
        />

        <footer className="formobra__acoes">
          {editando &&
            (confirmando ? (
              <button
                type="button"
                className="formrot__apagar is-confirmando"
                onClick={apagar}
                disabled={salvando}
              >
                Confirmar exclusão
              </button>
            ) : (
              <button
                type="button"
                className="formrot__apagar"
                onClick={() => setConfirmando(true)}
                disabled={salvando}
              >
                Excluir etapa
              </button>
            ))}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando}>
            {editando ? 'Salvar' : 'Adicionar etapa'}
          </Button>
        </footer>

        {confirmando && (
          <p className="formrot__aviso" role="alert">
            A etapa sai desta obra e das próximas, com os cards e os checks dela. As obras
            anteriores continuam com ela e com o que já foi marcado.
          </p>
        )}
      </form>
    </Modal>
  )
}
