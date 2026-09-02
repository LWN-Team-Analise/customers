import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import Confirma from '@/components/Confirma/Confirma'
import Avatar from '@/components/Avatar/Avatar'
import { CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { podeEditarCpf } from '@/domain/obras'
import { ALTERACAO, VISUALIZACAO } from '@/domain/permissoes'
import { SENHA_PADRAO } from '@/services/equipeService'
import { validateCPF, validateEmail } from '@/services/authService'
import { formatarCPF, formatarTelefone, soDigitos } from '@/utils/formato'
import { prepararImagem } from '@/utils/imagem'
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
 * O CPF e travado para todo mundo, com UMA excecao: a diretoria. E trava
 * de cargo, nao permissao configuravel — a API recusa do mesmo jeito, e
 * por isso nao adianta so liberar o campo aqui.
 *
 * `usuarioLogado` e quem esta mexendo — e dele que sai a permissao.
 */
export default function ModalColaborador({
  aberto,
  colaborador = null,
  usuarioLogado = null,
  aoFechar,
  aoSalvar,
}) {
  const { cargos } = useDados()
  const entradaFoto = useRef(null)

  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)

  const editando = Boolean(colaborador)
  const cpfLiberado = podeEditarCpf(usuarioLogado)

  useEffect(() => {
    if (!aberto) return
    setForm(
      colaborador
        ? {
            ...VAZIO,
            ...colaborador,
            cpf: formatarCPF(colaborador.cpf ?? ''),
            telefone: formatarTelefone(colaborador.telefone ?? ''),
            nascimento: colaborador.nascimento ?? '',
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

  const escolherFoto = async (evento) => {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    try {
      const foto = await prepararImagem(arquivo)
      setForm((atual) => ({ ...atual, foto }))
      setErros((atual) => ({ ...atual, geral: undefined }))
    } catch (e) {
      setErros((atual) => ({ ...atual, geral: e.message }))
    }
  }

  /* o que se confirma aqui e o CARGO: e ele que decide o que a pessoa
     nova vai poder fazer no sistema desde o primeiro acesso */
  const [conferindo, setConferindo] = useState(null)

  const enviar = (evento) => {
    evento.preventDefault()

    const novos = {}
    if (!form.nome.trim()) novos.nome = 'Informe o nome completo.'
    if (!form.nascimento) novos.nascimento = 'Informe a data de nascimento.'
    if (!form.cargo) novos.cargo = 'Escolha o cargo.'
    if (!validateEmail(form.email)) novos.email = 'E-mail inválido.'
    // no cadastro o CPF e obrigatorio; na edicao, so quem pode mexer valida
    if ((!editando || cpfLiberado) && !validateCPF(form.cpf)) novos.cpf = 'CPF inválido.'
    if (soDigitos(form.telefone).length < 10) novos.telefone = 'Informe o DDD e o número.'

    if (Object.keys(novos).length > 0) {
      setErros(novos)
      return
    }

    const campos = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: soDigitos(form.telefone),
      nascimento: form.nascimento,
      cargo: form.cargo,
      foto: form.foto,
    }
    /* o CPF so viaja quando pode mudar: na edicao por quem nao e da
       diretoria, mandar o campo faria a API recusar a gravacao inteira */
    if (!editando || (cpfLiberado && soDigitos(form.cpf) !== soDigitos(colaborador?.cpf))) {
      campos.cpf = soDigitos(form.cpf)
    }

    setConferindo(campos)
  }

  const gravar = async () => {
    if (!conferindo) return
    setSalvando(true)
    try {
      await aoSalvar(conferindo)
      setConferindo(null)
      aoFechar()
    } catch (e) {
      setErros({ geral: e.message })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar colaborador' : 'Adicionar colaborador'}
      subtitulo={
        editando ? undefined : `Entra com a senha ${SENHA_PADRAO} e troca no primeiro acesso.`
      }
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
            disabled={editando && !cpfLiberado}
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
            opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome, cor: c.cor }))}
          />
        </div>

        {erros.geral && (
          <p className="formcolab__erro" role="alert">
            {erros.geral}
          </p>
        )}

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando}>
            {editando ? 'Salvar alterações' : 'Adicionar colaborador'}
          </Button>
        </footer>
      </form>

      {/* A conferência é sobre o CARGO.

          Cadastrar uma pessoa e escolher o cargo dela sao a mesma acao aqui,
          e e o cargo que decide o que ela pode fazer desde o primeiro acesso.
          Mostrar a lista antes de gravar e o que evita descobrir semana que
          vem que o novo tecnico tambem apagava obra. */}
      <Confirma
        aberto={Boolean(conferindo)}
        nivel={1}
        tom="acao"
        titulo={editando ? 'Salvar as alterações?' : 'Cadastrar este colaborador?'}
        mensagem={
          editando
            ? 'Os dados abaixo passam a valer para esta pessoa.'
            : `A pessoa entra com a senha ${SENHA_PADRAO} e troca no primeiro acesso.`
        }
        detalhes={<ResumoDoCargo campos={conferindo} cargos={cargos} />}
        rotuloConfirmar={editando ? 'Salvar' : 'Cadastrar'}
        aoConfirmar={gravar}
        aoFechar={() => setConferindo(null)}
      />
    </Modal>
  )
}

/**
 * O resumo que aparece na confirmacao: quem e a pessoa e, principalmente, o
 * que o cargo escolhido libera para ela.
 */
function ResumoDoCargo({ campos, cargos }) {
  if (!campos) return null

  const cargo = cargos.find((c) => c.chave === campos.cargo)
  const chaves = cargo?.permissoes ?? []
  const rotulo = (chave) =>
    [...VISUALIZACAO, ...ALTERACAO].find((p) => p.chave === chave)?.rotulo ?? chave

  return (
    <dl>
      <dt>Nome</dt>
      <dd>{campos.nome}</dd>

      <dt>E-mail</dt>
      <dd>{campos.email}</dd>

      <dt>Cargo</dt>
      <dd>{cargo?.nome ?? campos.cargo}</dd>

      <dt>Pode</dt>
      <dd>
        {cargo?.acessoTotal ? (
          <strong>Acesso total — passa por todas as travas do sistema.</strong>
        ) : chaves.length === 0 ? (
          <em>Nenhuma permissão. A pessoa só vê a própria conta.</em>
        ) : (
          <ul>
            {chaves.map((c) => (
              <li key={c}>{rotulo(c)}</li>
            ))}
          </ul>
        )}
      </dd>
    </dl>
  )
}
