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
  cargoTitulo: '',
  telefone: '',
  foto: null,
}

/**
 * Cadastro do colaborador.
 *
 * SETOR e CARGO sao coisas diferentes aqui, e a confusao entre os dois
 * custa caro:
 *
 *   SETOR — Comercial, Excelência, GQ. E o que decide TUDO o que a
 *           pessoa pode fazer no sistema, quais checks ela marca e que
 *           avisos chegam para ela. Obrigatorio, e escolhido de uma
 *           lista (`form.cargo`, que e a chave do setor no banco).
 *   CARGO — "Analista de Qualidade", "Coordenador de Obras". E o titulo
 *           dela dentro do setor. Texto livre, opcional, e nao muda
 *           nenhuma permissao — dois analistas e um coordenador do mesmo
 *           setor podem exatamente as mesmas coisas.
 *
 * OBRIGATORIOS: nome, data de nascimento, CPF e setor.
 * OPCIONAIS: e-mail, telefone, cargo e foto. E-mail e telefone eram
 * obrigatorios e travavam o cadastro de quem trabalha em campo e nao tem
 * e-mail corporativo — quem nao tem e-mail entra pelo CPF.
 *
 * O CPF e travado para todo mundo, com UMA excecao: a diretoria. E trava
 * de setor, nao permissao configuravel — a API recusa do mesmo jeito, e
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
    if (!form.cargo) novos.cargo = 'Escolha o setor.'
    // no cadastro o CPF e obrigatorio; na edicao, so quem pode mexer valida
    if ((!editando || cpfLiberado) && !validateCPF(form.cpf)) novos.cpf = 'CPF inválido.'

    /* E-mail e telefone sao OPCIONAIS: so entram na conferência quando a
       pessoa escreveu alguma coisa. Vazio passa; errado, nao — o que a
       validacao deve pegar e o dedo trocado, nao a ausencia. */
    if (form.email.trim() && !validateEmail(form.email)) novos.email = 'E-mail inválido.'
    if (form.telefone.trim() && soDigitos(form.telefone).length < 10) {
      novos.telefone = 'Informe o DDD e o número.'
    }

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
      cargoTitulo: form.cargoTitulo.trim(),
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
            dica="Opcional — sem e-mail, o acesso é pelo CPF."
          />

          <CampoTexto
            rotulo="Telefone"
            inputMode="numeric"
            placeholder="(11) 90000-0000"
            value={form.telefone}
            onChange={mudar('telefone')}
            erro={erros.telefone}
            dica="Opcional."
          />

          {/* SETOR: obrigatório, e é ele que decide o que a pessoa pode */}
          <CampoSelecao
            rotulo="Setor"
            largo
            value={form.cargo}
            onChange={mudar('cargo')}
            erro={erros.cargo}
            vazio="Escolha o setor..."
            opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome, cor: c.cor }))}
            dica="É o setor que define as permissões desta pessoa."
          />

          {/* CARGO: o título dentro do setor. Não muda permissão nenhuma. */}
          <CampoTexto
            rotulo="Cargo"
            largo
            placeholder="Ex.: Analista de Qualidade"
            value={form.cargoTitulo}
            onChange={mudar('cargoTitulo')}
            erro={erros.cargoTitulo}
            dica="Opcional — o cargo específico dentro do setor."
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

      {/* A conferência é sobre o SETOR.

          Cadastrar uma pessoa e escolher o setor dela sao a mesma acao aqui,
          e e o setor que decide o que ela pode fazer desde o primeiro acesso.
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
 * que o SETOR escolhido libera para ela.
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
      <dd>{campos.email || <em>sem e-mail — entra pelo CPF</em>}</dd>

      <dt>Setor</dt>
      <dd>{cargo?.nome ?? campos.cargo}</dd>

      <dt>Cargo</dt>
      <dd>{campos.cargoTitulo || <em>não informado</em>}</dd>

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
