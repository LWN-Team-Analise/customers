import { useMemo, useState } from 'react'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Confirma from '@/components/Confirma/Confirma'
import { useDados } from '@/context/DadosContext'
import { Estrelas } from '@/pages/Avaliacoes/Avaliacoes'
import { formatarTelefone } from '@/utils/formato'
import ModalCargos from './ModalCargos'
import ModalColaborador from './ModalColaborador'
import './Usuarios.css'

const Icone = {
  etiqueta: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12.5V5a2 2 0 0 1 2-2h7.5L21 11.5 12.5 20z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </svg>
  ),
  mais: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
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
}

/**
 * A equipe por cargo, com a nota de cada um — que e a media das obras
 * avaliadas em que a pessoa participou (tela de Avaliacoes).
 */
export default function Usuarios() {
  const {
    equipe,
    cargos,
    origemEquipe,
    cargoPorChave,
    mediaDoUsuario,
    obrasDaPessoa,
    adicionarPessoa,
    atualizarPessoa,
    removerPessoa,
  } = useDados()

  const [modalCargos, setModalCargos] = useState(false)
  const [modalColab, setModalColab] = useState(false)
  const [editando, setEditando] = useState(null)
  const [apagando, setApagando] = useState(null)
  const [filtro, setFiltro] = useState(null)

  const lista = useMemo(() => {
    const filtrada = filtro ? equipe.filter((p) => p.cargo === filtro) : equipe
    return [...filtrada].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [equipe, filtro])

  const abrirNovo = () => {
    setEditando(null)
    setModalColab(true)
  }

  const abrirEdicao = (pessoa) => {
    setEditando(pessoa)
    setModalColab(true)
  }

  const salvar = (campos) => {
    if (editando) atualizarPessoa(editando.id, campos)
    else adicionarPessoa(campos)
  }

  return (
    <AppShell>
      <section className="usuarios">
        <header className="usuarios__topo">
          <h1 className="tela__titulo">Usuários</h1>

          <div className="usuarios__acoes">
            <button
              type="button"
              className="acao acao--fraca"
              onClick={() => setModalCargos(true)}
            >
              <Icone.etiqueta />
              Adicionar cargo
            </button>
            <button type="button" className="acao acao--padrao" onClick={abrirNovo}>
              <Icone.mais />
              Adicionar colaborador
            </button>
          </div>
        </header>

        {origemEquipe === 'local' && (
          <p className="usuarios__nota">
            Mostrando a equipe de exemplo. Rode <code>db/sistema.sql.txt</code> e cadastre os
            usuários no banco para esta lista virar a de verdade.
          </p>
        )}

        <div className="usuarios__filtro">
          <button
            type="button"
            className={`chip ${filtro === null ? 'is-atual' : ''}`.trim()}
            onClick={() => setFiltro(null)}
          >
            Todos
          </button>
          {cargos.map((c) => {
            const ativo = filtro === c.chave
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${ativo ? 'is-atual' : ''}`.trim()}
                style={ativo ? { '--tom': c.cor, '--tom-fg': '#fff' } : undefined}
                onClick={() => setFiltro((atual) => (atual === c.chave ? null : c.chave))}
              >
                {c.nome}
              </button>
            )
          })}
        </div>

        {lista.length === 0 ? (
          <p className="usuarios__vazio">Nenhum usuário com esse cargo.</p>
        ) : (
          <ul className="usuarios__grade">
            {lista.map((pessoa) => {
              const cargo = cargoPorChave(pessoa.cargo)
              const { media, obrasAvaliadas } = mediaDoUsuario(pessoa.id)
              const emAndamento = obrasDaPessoa(pessoa.id).length

              return (
                <li
                  key={pessoa.id}
                  className={`pessoa ${pessoa.souEu ? 'is-eu' : ''}`.trim()}
                  style={{ '--cargo-cor': cargo?.cor ?? '#6b7280' }}
                >
                  <header className="pessoa__topo">
                    <Avatar nome={pessoa.nome} foto={pessoa.foto} tamanho={46} titulo={pessoa.nome} />
                    <div className="pessoa__quem">
                      <h2 className="pessoa__nome">
                        {pessoa.nome}
                        {pessoa.souEu && <span className="pessoa__eu">você</span>}
                      </h2>
                      <span className="pessoa__cargo">
                        {cargo?.nome ?? pessoa.cargoNome ?? 'Sem cargo'}
                        {(cargo?.acessoTotal || pessoa.acessoTotal) && ' · acesso total'}
                      </span>
                    </div>

                    {/* aparecem ao passar o mouse pelo card */}
                    <div className="pessoa__botoes">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(pessoa)}
                        aria-label={`Editar ${pessoa.nome}`}
                        title="Editar"
                      >
                        <Icone.lapis />
                      </button>
                      <button
                        type="button"
                        onClick={() => setApagando(pessoa)}
                        aria-label={`Excluir ${pessoa.nome}`}
                        title="Excluir"
                      >
                        <Icone.lixo />
                      </button>
                    </div>
                  </header>

                  {(pessoa.email || pessoa.telefone) && (
                    <dl className="pessoa__contato">
                      {pessoa.email && (
                        <div>
                          <dt>E-mail</dt>
                          <dd>{pessoa.email}</dd>
                        </div>
                      )}
                      {pessoa.telefone && (
                        <div>
                          <dt>Telefone</dt>
                          <dd>{formatarTelefone(pessoa.telefone)}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  <footer className="pessoa__base">
                    <span className="pessoa__nota">
                      {media === null ? (
                        <span className="pessoa__semnota">Sem avaliação</span>
                      ) : (
                        <>
                          <Estrelas nota={media} tamanho={13} />
                          <strong>{media.toFixed(1)}</strong>
                          <em>
                            {obrasAvaliadas} obra{obrasAvaliadas === 1 ? '' : 's'}
                          </em>
                        </>
                      )}
                    </span>
                    <span className="pessoa__andamento">{emAndamento} em andamento</span>
                  </footer>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ModalCargos aberto={modalCargos} aoFechar={() => setModalCargos(false)} />

      <ModalColaborador
        aberto={modalColab}
        colaborador={editando}
        aoFechar={() => setModalColab(false)}
        aoSalvar={salvar}
      />

      <Confirma
        aberto={Boolean(apagando)}
        titulo={`Excluir ${apagando?.nome ?? 'colaborador'}?`}
        mensagem="O cadastro sai da equipe. As obras em que a pessoa participou continuam como estão."
        aviso={
          apagando?.souEu
            ? 'Este é o seu próprio usuário — você perde o acesso à lista até entrar de novo.'
            : undefined
        }
        rotuloConfirmar="Excluir colaborador"
        aoConfirmar={() => removerPessoa(apagando.id)}
        aoFechar={() => setApagando(null)}
      />
    </AppShell>
  )
}
