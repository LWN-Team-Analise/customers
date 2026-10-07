import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { diasAte } from '@/domain/obras'
import { dataBR } from '@/utils/formato'
import './ModalRoteiro.css'

/**
 * O PERIODO DE EXECUCAO: so a 3a etapa, da entrada em campo ao prazo
 * DELA.
 *
 *   Inicio da execucao — a entrada em campo. Opcional: sem ela, o
 *                        periodo comeca no inicio da obra;
 *   Prazo da execucao  — ate quando a execucao tem de fechar.
 *                        OBRIGATORIO: a etapa nao anda sem ele.
 *
 * O prazo final da OBRA e outro e nao muda aqui: a obra continua depois
 * da execucao (documentacao, entrega). O prazo da execucao nao passa
 * dele — e nao mexe na cor do card nem no tipo da obra: execucao curta
 * nao transforma obra padrao em emergencia.
 *
 * Quem define e quem tem "Pode definir prazo para checks"
 * (definir_prazos).
 */
export default function ModalPeriodo({ aberto, obra, aoFechar }) {
  const { definirExecucao } = useDados()
  const [inicio, setInicio] = useState('')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setInicio(obra?.execucaoInicio ?? '')
    setPrazo(obra?.execucaoPrazo ?? '')
    setErro('')
  }, [aberto, obra])

  const comeco = inicio || obra?.dataInicio || ''
  const prazoObra = obra?.dataConclusao ?? ''
  const dias = comeco && prazo ? diasAte(prazo, comeco) : null

  const salvar = async (evento) => {
    evento.preventDefault()
    if (!prazo) {
      setErro('O prazo da execução é obrigatório.')
      return
    }
    if (inicio && inicio > prazo) {
      setErro('O início da execução não pode ser depois do prazo da execução.')
      return
    }
    if (prazoObra && prazo > prazoObra) {
      setErro(`O prazo da execução não pode passar do prazo final da obra (${dataBR(prazoObra)}).`)
      return
    }
    setSalvando(true)
    try {
      await definirExecucao(obra.id, { inicio: inicio || null, prazo })
      aoFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Período de execução"
      subtitulo={
        prazoObra ? `Só a etapa de execução. Prazo final da obra: ${dataBR(prazoObra)}.` : 'Só a etapa de execução.'
      }
      largura={460}
    >
      <form className="formrot" onSubmit={salvar} noValidate>
        <div className="formrot__datas">
          <CampoTexto
            rotulo="Início da execução"
            type="date"
            value={inicio}
            min={obra?.dataInicio || undefined}
            max={prazo || prazoObra || undefined}
            onChange={(e) => setInicio(e.target.value)}
            dica={inicio ? undefined : `Vazio: ${dataBR(obra?.dataInicio) || 'início da obra'}`}
          />
          <CampoTexto
            rotulo="Prazo da execução *"
            type="date"
            required
            value={prazo}
            min={inicio || obra?.dataInicio || undefined}
            max={prazoObra || undefined}
            onChange={(e) => setPrazo(e.target.value)}
            autoFocus={!obra?.execucaoPrazo}
          />
        </div>

        {dias !== null && dias >= 0 && (
          <p className="formrot__dica formrot__dica--colada">
            {dias === 0 ? 'Execução no mesmo dia.' : `${dias} dia${dias > 1 ? 's' : ''} de execução.`}
          </p>
        )}

        {erro && (
          <p className="formrot__erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando} disabled={!prazo}>
            Salvar período
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
