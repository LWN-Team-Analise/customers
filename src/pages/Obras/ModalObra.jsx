import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoArea, CampoPastilhas, CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { PRIORIDADES } from '@/domain/obras'
import { hojeISO } from '@/utils/formato'
import './ModalObra.css'

const VAZIO = { clienteId: '', descricao: '', prioridade: 'media', dataPrevista: '' }

/**
 * Cadastro de obra. O mesmo formulario serve para padrao e emergencia —
 * o que muda e o tipo (e, por tabela, a cor do card no quadro).
 */
export default function ModalObra({ aberto, tipo = 'padrao', clientes = [], aoFechar, aoSalvar }) {
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})

  /* cada abertura comeca limpa, com a data de hoje ja preenchida */
  useEffect(() => {
    if (aberto) {
      setForm({ ...VAZIO, dataPrevista: hojeISO() })
      setErros({})
    }
  }, [aberto])

  const mudar = (campo) => (evento) => {
    const valor = evento?.target ? evento.target.value : evento
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  const enviar = (evento) => {
    evento.preventDefault()

    const novosErros = {}
    if (!form.clienteId) novosErros.clienteId = 'Escolha a empresa.'
    if (!form.descricao.trim()) novosErros.descricao = 'Descreva a obra.'
    if (!form.dataPrevista) novosErros.dataPrevista = 'Informe a data prevista.'

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    aoSalvar({ ...form, tipo })
    aoFechar()
  }

  const emergencia = tipo === 'emergencia'

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={emergencia ? 'Nova obra emergência' : 'Nova obra padrão'}
      subtitulo={
        emergencia
          ? 'Entra no quadro em vermelho e vai para o topo da fila.'
          : 'Começa na 1ª etapa, com o comercial.'
      }
      largura={560}
    >
      <form className="formobra" onSubmit={enviar} noValidate>
        <span className={`formobra__selo ${emergencia ? 'is-emergencia' : ''}`.trim()}>
          {emergencia ? 'Emergência' : 'Padrão'}
        </span>

        {clientes.length === 0 ? (
          <p className="formobra__semcliente">
            Nenhum cliente cadastrado ainda. Uma obra sempre nasce de um cliente —{' '}
            <Link to="/app/clientes" onClick={aoFechar}>
              cadastre o primeiro
            </Link>{' '}
            para continuar.
          </p>
        ) : (
          <CampoSelecao
            rotulo="Empresa"
            largo
            value={form.clienteId}
            onChange={mudar('clienteId')}
            erro={erros.clienteId}
            vazio="Escolha o cliente..."
            opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          />
        )}

        <CampoArea
          rotulo="Descrição"
          largo
          linhas={3}
          placeholder="O que precisa ser feito nesta obra?"
          value={form.descricao}
          onChange={mudar('descricao')}
          erro={erros.descricao}
        />

        <CampoPastilhas
          rotulo="Prioridade"
          valor={form.prioridade}
          aoMudar={mudar('prioridade')}
          opcoes={PRIORIDADES.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
        />

        <CampoTexto
          rotulo="Data prevista"
          type="date"
          value={form.dataPrevista}
          onChange={mudar('dataPrevista')}
          erro={erros.dataPrevista}
        />

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" disabled={clientes.length === 0}>
            {emergencia ? 'Abrir emergência' : 'Adicionar obra'}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
