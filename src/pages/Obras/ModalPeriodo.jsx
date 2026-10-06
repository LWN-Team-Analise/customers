import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { DIAS_EMERGENCIA, diasAte, execucaoCurta } from '@/domain/obras'
import { dataBR } from '@/utils/formato'
import './ModalRoteiro.css'

/**
 * O PERIODO DE EXECUCAO da obra: da entrada em campo ao prazo final.
 *
 *   Inicio da execucao — a entrada em campo. Opcional: sem ela, o
 *                        periodo comeca no inicio da obra;
 *   Prazo final        — a entrega da documentacao. OBRIGATORIO: a
 *                        etapa de execucao nao anda sem ele, e e dele
 *                        que sai a cor do card no quadro.
 *
 * Quem define e quem tem "Pode definir prazo para checks"
 * (definir_prazos). Periodo menor que 3 dias transforma a obra padrao
 * em Obra Emergencial — a tela avisa antes de salvar.
 */
export default function ModalPeriodo({ aberto, obra, aoFechar }) {
  const { definirExecucao } = useDados()
  const [inicio, setInicio] = useState('')
  const [prazoFinal, setPrazoFinal] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setInicio(obra?.execucaoInicio ?? '')
    setPrazoFinal(obra?.dataConclusao ?? '')
    setErro('')
  }, [aberto, obra])

  const comeco = inicio || obra?.dataInicio || ''
  const dias = comeco && prazoFinal ? diasAte(prazoFinal, comeco) : null
  const viraEmergencia = obra?.tipo === 'padrao' && execucaoCurta(comeco, prazoFinal)

  const salvar = async (evento) => {
    evento.preventDefault()
    if (!prazoFinal) {
      setErro('O prazo final é obrigatório.')
      return
    }
    if (inicio && inicio > prazoFinal) {
      setErro('O início da execução não pode ser depois do prazo final.')
      return
    }
    setSalvando(true)
    try {
      await definirExecucao(obra.id, { inicio: inicio || null, prazoFinal })
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
      subtitulo="Da entrada em campo até a entrega da documentação."
      largura={460}
    >
      <form className="formrot" onSubmit={salvar} noValidate>
        <div className="formrot__datas">
          <CampoTexto
            rotulo="Início da execução"
            type="date"
            value={inicio}
            max={prazoFinal || undefined}
            onChange={(e) => setInicio(e.target.value)}
            dica={inicio ? undefined : `Vazio: ${dataBR(obra?.dataInicio) || 'início da obra'}`}
          />
          <CampoTexto
            rotulo="Prazo final *"
            type="date"
            required
            value={prazoFinal}
            min={inicio || undefined}
            onChange={(e) => setPrazoFinal(e.target.value)}
            autoFocus={!obra?.dataConclusao}
          />
        </div>

        {dias !== null && dias >= 0 && (
          <p className="formrot__dica formrot__dica--colada">
            {dias === 0 ? 'Execução no mesmo dia.' : `${dias} dia${dias > 1 ? 's' : ''} de execução.`}{' '}
            Conforme o prazo final se aproxima, o card da obra vai do verde ao vermelho — o
            vermelho chega 1 dia antes do prazo.
          </p>
        )}

        {viraEmergencia && (
          <p className="formrot__emergencia" role="status">
            Execução em menos de {DIAS_EMERGENCIA} dias: ao salvar, esta obra passa a ser uma
            Obra Emergencial.
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
          <Button type="submit" loading={salvando} disabled={!prazoFinal}>
            Salvar período
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
