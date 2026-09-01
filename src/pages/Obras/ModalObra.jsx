import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoArea, CampoPastilhas, CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { PRIORIDADES, prioridadeDaObra, prioridadeTravada } from '@/domain/obras'
import { hojeISO } from '@/utils/formato'
import './ModalObra.css'

const VAZIO = {
  clienteId: '',
  descricao: '',
  prioridade: 'media',
  dataInicio: '',
  dataConclusao: '',
}

/**
 * Cadastro e edicao de obra. O mesmo formulario serve para padrao e
 * emergencia — o que muda e o tipo (e, por tabela, a cor do card no
 * quadro).
 *
 * Duas datas:
 *   Data de inicio     — ja vem preenchida com hoje;
 *   Data de conclusao  — quando a obra deve/foi entregue; pode ficar
 *                        em branco enquanto ninguem souber.
 *
 * Emergencia nao escolhe prioridade: e sempre alta. A tela mostra a
 * pastilha travada, e o banco garante o mesmo por gatilho.
 *
 * Com `obra`, o pop-up entra em modo edicao: os campos vem preenchidos
 * e o Salvar manda so o que mudou.
 */
export default function ModalObra({
  aberto,
  tipo = 'padrao',
  obra = null,
  clientes = [],
  aoFechar,
  aoSalvar,
}) {
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)

  const editando = Boolean(obra)
  const tipoAtual = editando ? obra.tipo : tipo
  const emergencia = tipoAtual === 'emergencia'
  const travada = prioridadeTravada(tipoAtual)
  const prioridade = prioridadeDaObra({ tipo: tipoAtual, prioridade: form.prioridade })

  /* abrindo para criar, comeca limpa e com a data de hoje;
     abrindo para editar, comeca com o que a obra tem hoje */
  useEffect(() => {
    if (!aberto) return
    setForm(
      obra
        ? {
            clienteId: obra.clienteId ?? '',
            descricao: obra.descricao ?? '',
            prioridade: obra.prioridade ?? 'media',
            dataInicio: obra.dataInicio ?? '',
            dataConclusao: obra.dataConclusao ?? '',
          }
        : { ...VAZIO, dataInicio: hojeISO() },
    )
    setErros({})
  }, [aberto, obra])

  const mudar = (campo) => (evento) => {
    const valor = evento?.target ? evento.target.value : evento
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  const enviar = async (evento) => {
    evento.preventDefault()

    const novosErros = {}
    if (!form.clienteId) novosErros.clienteId = 'Escolha a empresa.'
    if (!form.descricao.trim()) novosErros.descricao = 'Descreva a obra.'
    if (!form.dataInicio) novosErros.dataInicio = 'Informe a data de início.'
    /* conclusao antes do inicio quase sempre e dedo trocado no teclado */
    if (form.dataConclusao && form.dataConclusao < form.dataInicio) {
      novosErros.dataConclusao = 'A conclusão não pode ser antes do início.'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setSalvando(true)
    try {
      await aoSalvar({ ...form, prioridade, tipo: tipoAtual })
      aoFechar()
    } catch (e) {
      setErros({ geral: e.message })
    } finally {
      setSalvando(false)
    }
  }

  const titulo = editando
    ? 'Editar obra'
    : emergencia
      ? 'Nova obra emergência'
      : 'Nova obra padrão'

  const subtitulo = editando
    ? 'O que mudar aqui fica registrado com o seu nome e a hora.'
    : emergencia
      ? 'Entra no quadro em vermelho, com prioridade alta e todas as etapas liberadas.'
      : 'Começa na 1ª etapa, com o comercial.'

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} subtitulo={subtitulo} largura={560}>
      <form className="formobra" onSubmit={enviar} noValidate>
        <span className={`formobra__selo ${emergencia ? 'is-emergencia' : ''}`.trim()}>
          {emergencia ? 'Emergência' : 'Padrão'}
        </span>

        {clientes.length === 0 ? (
          <p className="formobra__semcliente">
            Nenhum cliente cadastrado —{' '}
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

        {/* emergencia nao escolhe: a prioridade e alta e nao muda */}
        {travada ? (
          <div className="campo">
            <span className="campo__rotulo">Prioridade</span>
            <div className="pastilhas">
              <span className="pastilha is-atual is-travada" data-tom="alta">
                Alta
              </span>
            </div>
            <span className="campo__nota">Toda obra de emergência é prioridade alta.</span>
          </div>
        ) : (
          <CampoPastilhas
            rotulo="Prioridade"
            valor={form.prioridade}
            aoMudar={mudar('prioridade')}
            opcoes={PRIORIDADES.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
          />
        )}

        <div className="formobra__datas">
          <CampoTexto
            rotulo="Data de início"
            type="date"
            value={form.dataInicio}
            onChange={mudar('dataInicio')}
            erro={erros.dataInicio}
            dica={editando ? undefined : 'Vem preenchida com hoje.'}
          />
          <CampoTexto
            rotulo="Data de conclusão"
            type="date"
            value={form.dataConclusao}
            onChange={mudar('dataConclusao')}
            erro={erros.dataConclusao}
            dica="Opcional — dá para preencher depois."
          />
        </div>

        {erros.geral && (
          <p className="formobra__erro" role="alert">
            {erros.geral}
          </p>
        )}

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" disabled={clientes.length === 0} loading={salvando}>
            {editando ? 'Salvar alterações' : emergencia ? 'Abrir emergência' : 'Adicionar obra'}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
