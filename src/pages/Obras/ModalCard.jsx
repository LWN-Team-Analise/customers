import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { SeletorMulti } from '@/components/Seletor/Seletor'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { fundoDoCard } from '@/domain/obras'
import './ModalRoteiro.css'

/**
 * Card de setor dentro de uma etapa: cria e edita.
 *
 * Com mais de um cargo escolhido o card ganha um gradiente com a cor de
 * cada um — a previa embaixo mostra como vai ficar antes de salvar.
 *
 * O card vale DESTA obra em diante. Criar aqui coloca o card nesta
 * obra e nas proximas; excluir tira desta e das proximas. As obras
 * que ja passaram nao mudam — nem o que elas ja tinham marcado.
 */
export default function ModalCard({ aberto, etapa, card = null, obraId = null, aoFechar }) {
  const { cargos, corDoCargo, adicionarCard, atualizarCard, removerCard, rotuloEtapa } =
    useDados()

  const [escolhidos, setEscolhidos] = useState([])
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const editando = Boolean(card)

  useEffect(() => {
    if (!aberto) return
    setEscolhidos(card?.cargos ?? [])
    setTitulo(card?.titulo ?? '')
    setErro('')
    setConfirmando(false)
  }, [aberto, card])

  const salvar = async (evento) => {
    evento.preventDefault()
    if (escolhidos.length === 0) {
      setErro('Escolha ao menos um setor.')
      return
    }

    setSalvando(true)
    try {
      const campos = { cargos: escolhidos, titulo: titulo.trim(), obraId }
      if (editando) await atualizarCard(card.id, campos)
      else await adicionarCard(etapa.id, campos)
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
      await removerCard(card.id, obraId)
      aoFechar()
    } catch (e) {
      setErro(e.message)
      setConfirmando(false)
    } finally {
      setSalvando(false)
    }
  }

  const previa = { cargos: escolhidos, titulo }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar card' : 'Novo card'}
      subtitulo={`${rotuloEtapa(etapa?.numero ?? 1)} — ${
        etapa?.nome ?? ''
      }. Vale desta obra em diante.`}
      largura={520}
    >
      <form className="formrot" onSubmit={salvar} noValidate>
        <label className="formrot__rotulo">Setores responsáveis</label>
        <SeletorMulti
          largo
          valores={escolhidos}
          aoMudar={setEscolhidos}
          vazio="Escolha um ou mais setores..."
          aria-label="Setores responsáveis pelo card"
          opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome, cor: c.cor }))}
        />
        <p className="formrot__dica">
          Com mais de um cargo, o card fica com um gradiente das cores deles — e qualquer um
          dos cargos pode marcar os checks.
        </p>

        <CampoTexto
          rotulo="Título (opcional)"
          largo
          placeholder="Em branco, usa o nome do(s) setor(es)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        {escolhidos.length > 0 && (
          <div className="formrot__previa">
            <span className="formrot__previanome">Como vai ficar</span>
            <span
              className="formrot__amostra"
              style={{ background: fundoDoCard(previa, corDoCargo) }}
            >
              {titulo.trim() ||
                escolhidos.map((c) => cargos.find((x) => x.chave === c)?.nome ?? c).join(' + ')}
            </span>
          </div>
        )}

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
                Excluir card
              </button>
            ))}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando}>
            {editando ? 'Salvar' : 'Adicionar card'}
          </Button>
        </footer>

        {confirmando && (
          <p className="formrot__aviso" role="alert">
            O card sai desta obra e das próximas, com os checks dele. As obras anteriores
            continuam com ele e com o que já foi marcado.
          </p>
        )}
      </form>
    </Modal>
  )
}
