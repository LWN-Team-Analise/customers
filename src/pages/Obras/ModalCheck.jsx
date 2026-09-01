import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { SeletorMulti } from '@/components/Seletor/Seletor'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import './ModalRoteiro.css'

/**
 * Um check do card: cria, renomeia, escolhe o dono e apaga.
 *
 * O "dono" e a parte importante. Normalmente o check e de quem e o card.
 * Aqui da para dizer que UM check especifico responde a outro(s)
 * cargo(s) — sem criar card novo e sem mudar o dono dos outros checks.
 * E o caso de "Envio revisao externa": mora no card do GQ, mas quem
 * marca sao GQ e Excelencia.
 *
 * Como o card, o check vale DESTA obra em diante: criar aqui o coloca
 * nesta obra e nas proximas, excluir o tira desta e das proximas. As
 * obras anteriores ficam como estavam, com o que ja marcaram.
 */
export default function ModalCheck({
  aberto,
  card,
  nomeCard,
  check = null,
  obraId = null,
  aoFechar,
}) {
  const { cargos, adicionarCheck, atualizarCheck, removerCheck, nomeDoCargo } = useDados()

  const [titulo, setTitulo] = useState('')
  const [donos, setDonos] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const editando = Boolean(check)
  const doCard = (card?.cargos ?? []).map(nomeDoCargo).join(' e ')

  useEffect(() => {
    if (!aberto) return
    setTitulo(check?.titulo ?? '')
    setDonos(check?.cargos ?? [])
    setErro('')
    setConfirmando(false)
  }, [aberto, check])

  const salvar = async (evento) => {
    evento.preventDefault()
    if (!titulo.trim()) {
      setErro('Escreva o que precisa ser feito.')
      return
    }

    setSalvando(true)
    try {
      const campos = { titulo: titulo.trim(), cargos: donos, obraId }
      if (editando) await atualizarCheck(check.id, campos)
      else await adicionarCheck(card.id, campos)
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
      await removerCheck(check.id, obraId)
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
      titulo={editando ? 'Editar check' : 'Novo check'}
      subtitulo={`Card ${nomeCard ?? ''}. Vale desta obra em diante.`}
      largura={480}
    >
      <form className="formrot" onSubmit={salvar} noValidate>
        <CampoTexto
          rotulo="O que precisa ser feito"
          largo
          autoFocus
          placeholder="Ex.: Envio revisão externa"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <div>
          <label className="formrot__rotulo">Quem marca este check</label>
          <SeletorMulti
            largo
            valores={donos}
            aoMudar={setDonos}
            vazio={doCard ? `Segue o card (${doCard})` : 'Segue o card'}
            aria-label="Cargos que podem marcar este check"
            opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome, cor: c.cor }))}
          />
          {/* em branco o campo ja diz "Segue o card (...)"; so quando
              alguem escolhe um dono proprio e que vale explicar */}
          {donos.length > 0 && (
            <>
              <p className="formrot__dica">
                Só estes cargos marcam este check. Os outros checks do card não mudam.
              </p>
              <button type="button" className="formrot__limpar" onClick={() => setDonos([])}>
                Voltar a seguir o card
              </button>
            </>
          )}
        </div>

        {erro && (
          <p className="formrot__erro" role="alert">
            {erro}
          </p>
        )}

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
                Excluir check
              </button>
            ))}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando}>
            {editando ? 'Salvar' : 'Adicionar check'}
          </Button>
        </footer>

        {confirmando && (
          <p className="formrot__aviso" role="alert">
            O check sai desta obra e das próximas. As obras anteriores continuam com ele e
            com o que já foi marcado.
          </p>
        )}
      </form>
    </Modal>
  )
}
