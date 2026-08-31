import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import Avatar from '@/components/Avatar/Avatar'
import { CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { validateCPF, validateEmail } from '@/services/authService'
import { formatarCPF, formatarTelefone, soDigitos } from '@/utils/formato'
import './ModalColaborador.css'

const VAZIO = {
  nome: '',
  nascimento: '',
  cpf: '',
  email: '',
  cargo: '',
  telefone: '',
  foto: null,
}

/**
 * Cadastro do colaborador: foto a esquerda do nome e, embaixo, os dados
 * que o banco pede (nome, nascimento, CPF, e-mail, cargo, telefone).
 *
 * O CPF so pode ser digitado uma vez: na edicao ele fica travado. Para
 * trocar, apaga-se o colaborador e cadastra-se de novo — e o que
 * combinamos, e o que a coluna UNIQUE do banco espera.
 */
export default function ModalColaborador({ aberto, colaborador = null, aoFechar, aoSalvar }) {
  const { cargos } = useDados()
  const entradaFoto = useRef(null)

  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})

  const editando = Boolean(colaborador)

  useEffect(() => {
    if (!aberto) return
    setForm(
      colaborador
        ? {
            ...VAZIO,
            ...colaborador,
            cpf: formatarCPF(colaborador.cpf ?? ''),
            telefone: formatarTelefone(colaborador.telefone ?? ''),
          }
        : VAZIO,
    )
    setErros({})
  }, [aberto, colaborador])

  const mudar = (campo) => (evento) => {
    const bruto = evento?.target ? evento.target.value : evento
    const valor =
      campo === 'cpf'
        ? formatarCPF(bruto)
        : campo === 'telefone'
          ? formatarTelefone(bruto)
          : bruto
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  const escolherFoto = (evento) => {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setForm((atual) => ({ ...atual, foto: String(leitor.result) }))
    leitor.readAsDataURL(arquivo)
  }

  const enviar = (evento) => {
    evento.preventDefault()

    const novos = {}
    if (!form.nome.trim()) novos.nome = 'Informe o nome completo.'
    if (!form.nascimento) novos.nascimento = 'Informe a data de nascimento.'
    if (!form.cargo) novos.cargo = 'Escolha o cargo.'
    if (!validateEmail(form.email)) novos.email = 'E-mail inválido.'
    // na edicao o CPF esta travado: nao ha o que validar
    if (!editando && !validateCPF(form.cpf)) novos.cpf = 'CPF inválido.'
    if (soDigitos(form.telefone).length < 10) novos.telefone = 'Informe o DDD e o número.'

    if (Object.keys(novos).length > 0) {
      setErros(novos)
      return
    }

    aoSalvar({
      ...form,
      nome: form.nome.trim(),
      email: form.email.trim(),
      cpf: soDigitos(form.cpf),
      telefone: soDigitos(form.telefone),
    })
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar colaborador' : 'Adicionar colaborador'}
      subtitulo="Estes sao os mesmos campos da tabela usuario, no banco."
      largura={580}
    >
      <form className="formcolab" onSubmit={enviar} noValidate>
        {/* foto a esquerda, nome a direita */}
        <div className="formcolab__cabeca">
          <button
            type="button"
            className="formcolab__foto"
            onClick={() => entradaFoto.current?.click()}
            title="Escolher foto de perfil"
          >
            <Avatar nome={form.nome || '?'} foto={form.foto} tamanho={74} />
            <span className="formcolab__trocar">{form.foto ? 'Trocar' : 'Foto'}</span>
          </button>
          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={escolherFoto}
            tabIndex={-1}
          />

          <div className="formcolab__nome">
            <CampoTexto
              rotulo="Nome completo"
              placeholder="Nome e sobrenome"
              value={form.nome}
              onChange={mudar('nome')}
              erro={erros.nome}
            />
            {form.foto && (
              <button
                type="button"
                className="formcolab__semfoto"
                onClick={() => setForm((a) => ({ ...a, foto: null }))}
              >
                Remover foto
              </button>
            )}
          </div>
        </div>

        <div className="formcolab__grade">
          <CampoTexto
            rotulo="Data de nascimento"
            type="date"
            value={form.nascimento}
            onChange={mudar('nascimento')}
            erro={erros.nascimento}
          />

          <CampoTexto
            rotulo="CPF"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={mudar('cpf')}
            erro={erros.cpf}
            disabled={editando}
            dica={editando ? 'O CPF não muda depois de cadastrado.' : undefined}
          />

          <CampoTexto
            rotulo="E-mail"
            type="email"
            placeholder="pessoa@empresa.com.br"
            value={form.email}
            onChange={mudar('email')}
            erro={erros.email}
          />

          <CampoTexto
            rotulo="Telefone"
            inputMode="numeric"
            placeholder="(11) 90000-0000"
            value={form.telefone}
            onChange={mudar('telefone')}
            erro={erros.telefone}
          />

          <CampoSelecao
            rotulo="Cargo"
            largo
            value={form.cargo}
            onChange={mudar('cargo')}
            erro={erros.cargo}
            vazio="Escolha o cargo..."
            opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome }))}
          />
        </div>

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit">{editando ? 'Salvar alterações' : 'Adicionar colaborador'}</Button>
        </footer>
      </form>
    </Modal>
  )
}
