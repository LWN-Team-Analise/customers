import { useEffect, useRef, useState } from 'react'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Button from '@/components/Button/Button'
import { CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { useAuth } from '@/context/AuthContext'
import { useDados } from '@/context/DadosContext'
import { useTheme } from '@/context/ThemeContext'
import useOutlook from '@/hooks/useOutlook'
import { podeEditarCpf } from '@/domain/obras'
import { editarUsuario, trocarSenha } from '@/services/equipeService'
import { validateCPF, vincularOutlook } from '@/services/authService'
import { tokenAtual } from '@/services/api'
import { formatarCPF, formatarTelefone, soDigitos } from '@/utils/formato'
import { prepararImagem } from '@/utils/imagem'
import outlookLogo from '@/assets/outlook.png'
import './Configuracoes.css'

const Sol = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.4 6.4 5 5M19 19l-1.4-1.4M17.6 6.4 19 5M5 19l1.4-1.4" />
  </svg>
)

const Lua = () => (
  <svg viewBox="0 0 24 24" width="15" height="15">
    <path
      fill="currentColor"
      d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a.8.8 0 0 0-1.1-.9A9.9 9.9 0 1 0 21.3 15.7a.8.8 0 0 0-.9-1.1Z"
    />
  </svg>
)

/**
 * Conta do usuario logado: foto, nome, telefone, nascimento e cargo.
 * Tudo grava no banco na hora do Salvar.
 *
 * Dois campos NAO se alteram por aqui:
 *
 *   E-MAIL — e a porta de entrada e o vinculo com o Outlook. Trocar
 *            ele sozinho quebraria os dois; quem muda e a diretoria,
 *            pela tela de Usuarios.
 *   CPF    — trava de cargo, nao permissao: so a diretoria mexe. A API
 *            recusa igual.
 *
 * O tema tambem mora aqui, e agora na propria linha do nome, sem card
 * separado.
 */
export default function Configuracoes() {
  const { user, atualizarPerfil } = useAuth()
  const { cargos, recarregar } = useDados()
  const { theme, selectTheme } = useTheme()
  const entradaFoto = useRef(null)

  const [form, setForm] = useState(null)
  const [erros, setErros] = useState({})
  const [recado, setRecado] = useState('')
  const [salvando, setSalvando] = useState(false)

  const cpfLiberado = podeEditarCpf(user)

  /* carrega o formulario com o que a sessao tem hoje */
  useEffect(() => {
    if (!user) return
    setForm({
      nome: user.name ?? '',
      email: user.email ?? '',
      telefone: formatarTelefone(user.telefone ?? ''),
      nascimento: user.dataNascimento ?? '',
      /* `cargo` aqui é a chave do SETOR (travado); `cargoTitulo` é o
         cargo específico da pessoa, que ela mesma edita */
      cargo: user.cargoChave ?? '',
      cargoTitulo: user.cargoTitulo ?? '',
      cpf: formatarCPF(user.cpf ?? ''),
      foto: user.foto ?? null,
    })
  }, [user])

  if (!form) return null

  const mudar = (campo) => (evento) => {
    const bruto = evento?.target ? evento.target.value : evento
    const valor =
      campo === 'telefone'
        ? formatarTelefone(bruto)
        : campo === 'cpf'
          ? formatarCPF(bruto)
          : bruto
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
    setRecado('')
  }

  /* a imagem e reduzida aqui, no navegador: foto de celular crua nao
     cabe no limite do servidor nem no localStorage da sessao */
  const escolherFoto = async (evento) => {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    try {
      const foto = await prepararImagem(arquivo)
      setForm((atual) => ({ ...atual, foto }))
      setRecado('')
    } catch (e) {
      setRecado(e.message)
    }
  }

  const salvar = async (evento) => {
    evento.preventDefault()

    const novos = {}
    if (!form.nome.trim()) novos.nome = 'Informe o nome.'
    if (form.telefone && soDigitos(form.telefone).length < 10) {
      novos.telefone = 'Informe o DDD e o número.'
    }
    if (cpfLiberado && form.cpf && !validateCPF(form.cpf)) novos.cpf = 'CPF inválido.'
    if (Object.keys(novos).length > 0) {
      setErros(novos)
      return
    }

    /* o e-mail NAO vai: quem edita o proprio cadastro nao troca o
       endereco de acesso, e a API recusaria a gravacao inteira */
    const campos = {
      nome: form.nome.trim(),
      telefone: soDigitos(form.telefone),
      nascimento: form.nascimento || null,
      /* o SETOR não vai: o campo é só informativo nesta tela, e mandá-lo
         daqui abriria caminho para a pessoa trocar o próprio setor — que
         é o mesmo que trocar as próprias permissões.
         O CARGO vai: ele é o título dela, não decide nada, e é ela quem
         sabe quando mudou. */
      cargoTitulo: form.cargoTitulo.trim(),
      foto: form.foto,
    }
    /* o CPF so vai quando pode mudar E mudou */
    if (cpfLiberado && soDigitos(form.cpf) !== soDigitos(user.cpf)) {
      campos.cpf = soDigitos(form.cpf)
    }

    setSalvando(true)
    try {
      const salvo = await editarUsuario(user.id, campos)

      /* a sessao guarda uma copia do usuario: atualiza para a foto e o
         nome novos aparecerem no menu sem precisar entrar de novo */
      atualizarPerfil({
        name: salvo?.nome ?? campos.nome,
        telefone: salvo?.telefone ?? campos.telefone,
        cpf: salvo?.cpf ?? user.cpf,
        dataNascimento: salvo?.nascimento ?? campos.nascimento,
        foto: campos.foto,
        cargoChave: user.cargoChave,
        cargoNome: user.cargoNome,
        cargoTitulo: salvo?.cargoTitulo ?? campos.cargoTitulo,
      })
      await recarregar()

      setRecado('Dados salvos no banco.')
    } catch (erro) {
      setRecado(erro.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppShell>
      <section className="config">
        <header>
          <h1 className="tela__titulo">Configurações</h1>
        </header>

        {/* o aviso do Outlook fica no topo: e a primeira coisa que
            quem ainda nao vinculou precisa ver ao entrar */}
        <BlocoOutlook />

        <form className="config__bloco config__bloco--conta vidro" onSubmit={salvar} noValidate>
          <h2 className="config__titulo">Sua conta</h2>

          <div className="config__cabeca">
            <button
              type="button"
              className="config__foto"
              onClick={() => entradaFoto.current?.click()}
              title="Trocar foto de perfil"
            >
              <Avatar nome={form.nome} foto={form.foto} tamanho={86} />
              <span className="config__trocar">{form.foto ? 'Trocar' : 'Foto'}</span>
            </button>
            <input
              ref={entradaFoto}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={escolherFoto}
              tabIndex={-1}
            />

            <div className="config__nome">
              <CampoTexto
                rotulo="Nome completo"
                value={form.nome}
                onChange={mudar('nome')}
                erro={erros.nome}
              />

              {/* o tema mora aqui, na linha do nome: os dois botoes
                  dividem a largura inteira, sem card separado */}
              <div className="config__temas" role="radiogroup" aria-label="Tema do sistema">
                <button
                  type="button"
                  role="radio"
                  className={`config__tema ${theme === 'light' ? 'is-atual' : ''}`.trim()}
                  onClick={() => selectTheme('light')}
                  aria-checked={theme === 'light'}
                >
                  <Sol />
                  Modo claro
                </button>
                <button
                  type="button"
                  role="radio"
                  className={`config__tema ${theme === 'dark' ? 'is-atual' : ''}`.trim()}
                  onClick={() => selectTheme('dark')}
                  aria-checked={theme === 'dark'}
                >
                  <Lua />
                  Modo escuro
                </button>
              </div>

              {form.foto && (
                <button
                  type="button"
                  className="config__semfoto"
                  onClick={() => setForm((a) => ({ ...a, foto: null }))}
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>

          <div className="config__grade">
            {/* travado para todos: o e-mail e o acesso e o vinculo do Outlook */}
            <CampoTexto
              rotulo="E-mail"
              type="email"
              value={form.email}
              readOnly
              disabled
            />

            <CampoTexto
              rotulo="Telefone"
              inputMode="numeric"
              placeholder="(11) 90000-0000"
              value={form.telefone}
              onChange={mudar('telefone')}
              erro={erros.telefone}
            />

            <CampoTexto
              rotulo="Data de nascimento"
              type="date"
              value={form.nascimento}
              onChange={mudar('nascimento')}
            />

            {/* travado para todos, menos para a diretoria */}
            <CampoTexto
              rotulo="CPF"
              inputMode="numeric"
              value={form.cpf}
              onChange={mudar('cpf')}
              erro={erros.cpf}
              disabled={!cpfLiberado}
              readOnly={!cpfLiberado}
            />

            {/* Travado aqui, e de propósito.

                O setor é o que decide o que a pessoa PODE fazer no sistema.
                Deixá-lo aberto na tela da própria conta dá a qualquer um a
                chance de se promover à diretoria — a API já recusava, mas o
                campo aberto na tela é um convite a tentar.

                Quem muda setor é quem tem permissão para isso, na aba
                Usuários. Aqui ele só informa em que setor a pessoa está. */}
            <CampoSelecao
              rotulo="Setor"
              largo
              value={form.cargo}
              vazio="Sem setor"
              disabled
              opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome, cor: c.cor }))}
              dica="É o setor que define as suas permissões. Só a administração altera."
            />

            {/* O cargo específico é da pessoa e não decide permissão
                nenhuma, então ela mesma mantém o dele atualizado. */}
            <CampoTexto
              rotulo="Cargo"
              largo
              placeholder="Ex.: Analista de Qualidade"
              value={form.cargoTitulo}
              onChange={mudar('cargoTitulo')}
              dica="Opcional — o seu cargo dentro do setor."
            />
          </div>

          {recado && (
            <p className="config__recado" role="status">
              {recado}
            </p>
          )}

          <div className="config__salvar">
            <Button type="submit" loading={salvando}>
              Salvar alterações
            </Button>
          </div>
        </form>

        <TrocarSenha />
      </section>
    </AppShell>
  )
}

/**
 * Conta Microsoft.
 *
 * Enquanto ela nao estiver vinculada, o aviso aparece TODA vez que a
 * pessoa entra em Configuracoes — foi o pedido, e e o que faz o
 * cadastro acontecer.
 *
 * Depois de vincular, o sistema puxa a foto do Outlook e passa a
 * cobrar que a senha do site vire a mesma do Outlook: duas senhas
 * diferentes para a mesma pessoa e receita de confusao.
 */
function BlocoOutlook() {
  const { user, atualizarPerfil } = useAuth()
  const { recarregar } = useDados()
  const outlook = useOutlook()

  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [recado, setRecado] = useState('')

  const vinculado = Boolean(user?.outlook)

  const vincular = async () => {
    setErro('')
    setRecado('')
    setOcupado(true)
    try {
      const { codigo, redirecionar } = await outlook.abrir()
      const resposta = await vincularOutlook(codigo, redirecionar, tokenAtual())
      atualizarPerfil({
        outlook: true,
        outlookEmail: resposta.user?.outlookEmail ?? null,
        foto: resposta.user?.foto ?? user?.foto,
        senhaTemporaria: true,
      })
      await recarregar()
      setRecado(resposta.recado ?? 'Outlook vinculado.')
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <article
      className={`config__bloco config__bloco--outlook vidro ${
        vinculado ? '' : 'is-pendente'
      }`.trim()}
    >
      <h2 className="config__titulo">Conta Microsoft (Outlook)</h2>

      {/* O bloco ocupa a linha inteira, entao o texto fica de um lado e o
          botao do outro — em vez de o botao cair sozinho numa linha nova
          com meia tela vazia ao lado. */}
      <div className="config__outlookcorpo">
        <div className="config__outlooktexto">
      {vinculado ? (
        <p className="config__nota">
          Vinculada a <strong>{user.outlookEmail ?? user.email}</strong>. Você pode entrar no
          sistema pelo botão do Outlook, sem digitar a senha.
        </p>
      ) : (
        <p className="config__alerta" role="alert">
          Você ainda <strong>não cadastrou o Outlook</strong>. Vincule a sua conta da empresa
          para entrar pelo botão do Outlook — e para o sistema puxar a sua foto de perfil
          automaticamente.
        </p>
      )}

      {!outlook.disponivel && !outlook.conferindo && (
        <p className="config__nota">
          O login com Outlook ainda não foi ligado no servidor. Peça para a diretoria preencher
          <code> OUTLOOK_CLIENT_ID</code>, <code>OUTLOOK_CLIENT_SECRET</code> e
          <code> OUTLOOK_TENANT</code> no <code>.env</code> da API.
        </p>
      )}

      {erro && (
        <p className="config__recado config__recado--erro" role="alert">
          {erro}
        </p>
      )}
      {recado && (
        <p className="config__recado" role="status">
          {recado}
        </p>
      )}

        </div>

      <div className="config__outlookacao">
        <button
          type="button"
          className="botaooutlook"
          onClick={vincular}
          disabled={ocupado || outlook.conferindo || !outlook.disponivel}
        >
          {/* nas cores da Microsoft, como no botao da tela de login: e por
              elas que a pessoa reconhece o botao sem ler o rotulo */}
          <img className="botaooutlook__logo" src={outlookLogo} alt="" aria-hidden="true" />
          {ocupado
            ? 'Abrindo a Microsoft...'
            : vinculado
              ? 'Vincular outra conta'
              : 'Entrar com o Outlook'}
        </button>
      </div>
      </div>
    </article>
  )
}

/**
 * Troca da propria senha.
 *
 * E por aqui que o colaborador novo sai da senha padrao 123456 — e,
 * depois de vincular o Outlook, que ele iguala a senha do site a da
 * conta Microsoft.
 */
function TrocarSenha() {
  const { user, atualizarPerfil } = useAuth()

  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [repetida, setRepetida] = useState('')
  const [erro, setErro] = useState('')
  const [recado, setRecado] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enviar = async (evento) => {
    evento.preventDefault()
    setErro('')
    setRecado('')

    if (!atual) {
      setErro('Informe a senha atual.')
      return
    }
    if (nova.length < 6) {
      setErro('A nova senha precisa de 6 caracteres ou mais.')
      return
    }
    if (nova === atual) {
      setErro('A nova senha precisa ser diferente da atual.')
      return
    }
    if (nova !== repetida) {
      setErro('A confirmação não bate com a nova senha.')
      return
    }

    setSalvando(true)
    try {
      await trocarSenha(atual, nova)
      atualizarPerfil({ senhaTemporaria: false })
      setAtual('')
      setNova('')
      setRepetida('')
      setRecado('Senha trocada.')
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="config__bloco vidro" onSubmit={enviar} noValidate>
      <h2 className="config__titulo">Senha</h2>

      {user?.senhaTemporaria && (
        <p className="config__alerta" role="alert">
          {user?.outlook
            ? 'Você acabou de vincular o Outlook. Troque a senha do site para a MESMA senha do Outlook — assim você não confunde as duas.'
            : 'Você ainda está com a senha padrão do primeiro acesso. Troque agora.'}
        </p>
      )}

      <div className="config__grade">
        <CampoTexto
          rotulo="Senha atual"
          type="password"
          autoComplete="current-password"
          value={atual}
          onChange={(e) => {
            setAtual(e.target.value)
            setErro('')
          }}
        />
        <CampoTexto
          rotulo="Nova senha"
          type="password"
          autoComplete="new-password"
          value={nova}
          onChange={(e) => {
            setNova(e.target.value)
            setErro('')
          }}
          dica="No mínimo 6 caracteres."
        />
        <CampoTexto
          rotulo="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => {
            setRepetida(e.target.value)
            setErro('')
          }}
        />
      </div>

      {erro && (
        <p className="config__recado config__recado--erro" role="alert">
          {erro}
        </p>
      )}
      {recado && (
        <p className="config__recado" role="status">
          {recado}
        </p>
      )}

      <div className="config__salvar">
        <Button type="submit" loading={salvando} disabled={!atual || !nova || !repetida}>
          Trocar senha
        </Button>
      </div>
    </form>
  )
}
