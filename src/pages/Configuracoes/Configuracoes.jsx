import { useEffect, useRef, useState } from 'react'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Button from '@/components/Button/Button'
import { CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { useAuth } from '@/context/AuthContext'
import { useDados } from '@/context/DadosContext'
import { useTheme } from '@/context/ThemeContext'
import { editarUsuario } from '@/services/equipeService'
import { validateEmail } from '@/services/authService'
import { formatarCPF, formatarTelefone, soDigitos } from '@/utils/formato'
import './Configuracoes.css'

/**
 * Conta do usuario logado. Da para trocar foto, nome, e-mail, telefone,
 * nascimento e cargo.
 *
 * O CPF fica travado: uma vez cadastrado, so muda apagando o usuario e
 * cadastrando de novo — a API recusa a alteracao, entao nao adianta
 * mexer so na tela.
 */
export default function Configuracoes() {
  const { user, atualizarPerfil } = useAuth()
  const { cargos, atualizarPessoa, equipe } = useDados()
  const { theme, selectTheme } = useTheme()
  const entradaFoto = useRef(null)

  const [form, setForm] = useState(null)
  const [erros, setErros] = useState({})
  const [recado, setRecado] = useState('')
  const [salvando, setSalvando] = useState(false)

  /* carrega o formulario com o que a sessao tem hoje */
  useEffect(() => {
    if (!user) return
    const naEquipe = equipe.find((p) => String(p.id) === String(user.id))
    setForm({
      nome: user.name ?? '',
      email: user.email ?? '',
      telefone: formatarTelefone(user.telefone ?? naEquipe?.telefone ?? ''),
      nascimento: user.dataNascimento ?? naEquipe?.nascimento ?? '',
      cargo: user.cargoChave ?? naEquipe?.cargo ?? '',
      foto: user.foto ?? naEquipe?.foto ?? null,
    })
  }, [user, equipe])

  if (!form) return null

  const mudar = (campo) => (evento) => {
    const bruto = evento?.target ? evento.target.value : evento
    const valor = campo === 'telefone' ? formatarTelefone(bruto) : bruto
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
    setRecado('')
  }

  const escolherFoto = (evento) => {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => {
      setForm((atual) => ({ ...atual, foto: String(leitor.result) }))
      setRecado('')
    }
    leitor.readAsDataURL(arquivo)
  }

  const salvar = async (evento) => {
    evento.preventDefault()

    const novos = {}
    if (!form.nome.trim()) novos.nome = 'Informe o nome.'
    if (!validateEmail(form.email)) novos.email = 'E-mail inválido.'
    if (form.telefone && soDigitos(form.telefone).length < 10) {
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
      nascimento: form.nascimento || undefined,
      cargo: form.cargo || undefined,
      foto: form.foto,
    }

    setSalvando(true)
    try {
      /* tenta o banco; sem ele, a mudanca vale para esta sessao */
      const salvo = await editarUsuario(user.id, campos).catch(() => null)

      atualizarPerfil({
        name: campos.nome,
        email: campos.email,
        telefone: campos.telefone,
        foto: campos.foto,
        cargoChave: campos.cargo ?? user.cargoChave,
        cargoNome: cargos.find((c) => c.chave === campos.cargo)?.nome ?? user.cargoNome,
      })
      atualizarPessoa(user.id, { ...campos, nome: campos.nome })

      setRecado(
        salvo
          ? 'Dados salvos no banco.'
          : 'Dados salvos nesta sessão. Rode db/sistema.sql.txt para gravar no banco.',
      )
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

        <form className="config__bloco" onSubmit={salvar} noValidate>
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
            <CampoTexto
              rotulo="E-mail"
              type="email"
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

            <CampoTexto
              rotulo="Data de nascimento"
              type="date"
              value={form.nascimento}
              onChange={mudar('nascimento')}
            />

            {/* travado: o CPF so muda apagando e cadastrando de novo */}
            <CampoTexto
              rotulo="CPF"
              value={formatarCPF(user.cpf ?? '')}
              disabled
              readOnly
              dica="Não pode ser alterado. Para trocar, apague o cadastro e faça um novo."
            />

            <CampoSelecao
              rotulo="Cargo"
              largo
              value={form.cargo}
              onChange={mudar('cargo')}
              vazio="Sem cargo"
              opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.nome }))}
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

        <article className="config__bloco">
          <h2 className="config__titulo">Aparência</h2>
          <p className="config__nota">A escolha fica guardada neste navegador.</p>
          <div className="config__temas">
            <button
              type="button"
              className={`chip ${theme === 'light' ? 'is-atual' : ''}`.trim()}
              onClick={() => selectTheme('light')}
            >
              Modo claro
            </button>
            <button
              type="button"
              className={`chip ${theme === 'dark' ? 'is-atual' : ''}`.trim()}
              onClick={() => selectTheme('dark')}
            >
              Modo escuro
            </button>
          </div>
        </article>
      </section>
    </AppShell>
  )
}
