import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { useDados } from '@/context/DadosContext'
import './ModalCargos.css'

const CORES_SUGERIDAS = [
  '#13b7c7', '#35b566', '#f2802a', '#3a63e8', '#9a5ce0',
  '#c2a23a', '#e0457b', '#0f9aa8', '#7a5c3e', '#5b6470',
]

const VAZIO = { nome: '', cor: CORES_SUGERIDAS[0], curto: '', acessoTotal: false }

const Icone = {
  lapis: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
  cadeado: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
    </svg>
  ),
}

/**
 * Cadastro de cargos: criar, editar (nome, cor, sigla) e apagar.
 * Os cinco cargos das etapas sao "fixos": mudam de nome e de cor, mas
 * nao podem ser apagados — as etapas da obra dependem deles.
 */
export default function ModalCargos({ aberto, aoFechar }) {
  const { cargos, equipe, adicionarCargo, atualizarCargo, removerCargo } = useDados()

  const [form, setForm] = useState(VAZIO)
  const [editandoId, setEditandoId] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (aberto) {
      setForm(VAZIO)
      setEditandoId(null)
      setErro('')
    }
  }, [aberto])

  const mudar = (campo) => (valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErro('')
  }

  const comecarEdicao = (cargo) => {
    setEditandoId(cargo.id)
    setForm({
      nome: cargo.nome,
      cor: cargo.cor,
      curto: cargo.curto,
      acessoTotal: Boolean(cargo.acessoTotal),
    })
    setErro('')
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setForm(VAZIO)
    setErro('')
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    const nome = form.nome.trim()
    if (!nome) {
      setErro('Informe o nome do cargo.')
      return
    }

    const repetido = cargos.some(
      (c) => c.id !== editandoId && c.nome.toLowerCase() === nome.toLowerCase(),
    )
    if (repetido) {
      setErro('Já existe um cargo com esse nome.')
      return
    }

    try {
      if (editandoId) await atualizarCargo(editandoId, { ...form, nome })
      else await adicionarCargo({ ...form, nome })
      cancelarEdicao()
    } catch (e) {
      setErro(e.message)
    }
  }

  const apagar = async (cargo) => {
    if (!window.confirm(`Apagar o cargo "${cargo.nome}"?`)) return
    try {
      await removerCargo(cargo.id)
      if (editandoId === cargo.id) cancelarEdicao()
    } catch (e) {
      setErro(e.message)
    }
  }

  const quantos = (chave) => equipe.filter((p) => p.cargo === chave).length

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Cargos"
      subtitulo="A cor escolhida aqui pinta as etiquetas do card e os blocos das etapas."
      largura={600}
    >
      <div className="cargos">
        <ul className="cargos__lista">
          {cargos.map((cargo) => (
            <li
              key={cargo.id}
              className={`cargos__item ${editandoId === cargo.id ? 'is-editando' : ''}`.trim()}
            >
              <span className="cargos__bolha" style={{ background: cargo.cor }} aria-hidden="true" />
              <span className="cargos__quem">
                <strong>{cargo.nome}</strong>
                <span>
                  {cargo.curto} · {quantos(cargo.chave)} pessoa
                  {quantos(cargo.chave) === 1 ? '' : 's'}
                  {cargo.acessoTotal && ' · edita todos os setores'}
                </span>
              </span>

              {cargo.fixo && (
                <span className="cargos__fixo" title="Usado pelas etapas da obra">
                  <Icone.cadeado />
                  etapas
                </span>
              )}

              <span className="cargos__botoes">
                <button type="button" onClick={() => comecarEdicao(cargo)} title="Editar" aria-label={`Editar ${cargo.nome}`}>
                  <Icone.lapis />
                </button>
                <button
                  type="button"
                  onClick={() => apagar(cargo)}
                  disabled={cargo.fixo}
                  title={cargo.fixo ? 'Cargo usado pelas etapas' : 'Apagar'}
                  aria-label={`Apagar ${cargo.nome}`}
                >
                  <Icone.lixo />
                </button>
              </span>
            </li>
          ))}
        </ul>

        <form className="cargos__form" onSubmit={enviar}>
          <h3 className="cargos__titulo">{editandoId ? 'Editar cargo' : 'Adicionar cargo'}</h3>

          <div className="cargos__linha">
            <label className="cargos__campo cargos__campo--nome">
              <span>Nome</span>
              <input
                value={form.nome}
                onChange={(e) => mudar('nome')(e.target.value)}
                placeholder="Ex.: Jurídico"
              />
            </label>

            <label className="cargos__campo cargos__campo--sigla">
              <span>Sigla</span>
              <input
                value={form.curto}
                onChange={(e) => mudar('curto')(e.target.value)}
                placeholder="jur"
                maxLength={6}
              />
            </label>

            <label className="cargos__campo cargos__campo--cor">
              <span>Cor</span>
              <input
                type="color"
                value={form.cor}
                onChange={(e) => mudar('cor')(e.target.value)}
                aria-label="Cor do cargo"
              />
            </label>
          </div>

          <div className="cargos__paleta">
            {CORES_SUGERIDAS.map((c) => (
              <button
                key={c}
                type="button"
                className={`cargos__cor ${form.cor.toLowerCase() === c ? 'is-atual' : ''}`.trim()}
                style={{ background: c }}
                onClick={() => mudar('cor')(c)}
                aria-label={`Usar a cor ${c}`}
              />
            ))}
          </div>

          <label className="cargos__total">
            <input
              type="checkbox"
              checked={form.acessoTotal}
              onChange={(e) => mudar('acessoTotal')(e.target.checked)}
            />
            <span>
              Edita as tarefas de <strong>todos</strong> os setores (diretoria)
            </span>
          </label>

          {erro && (
            <p className="cargos__erro" role="alert">
              {erro}
            </p>
          )}

          <div className="cargos__acoes">
            {editandoId && (
              <button type="button" className="formobra__cancelar" onClick={cancelarEdicao}>
                Cancelar edição
              </button>
            )}
            <Button type="submit">{editandoId ? 'Salvar cargo' : 'Adicionar cargo'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
