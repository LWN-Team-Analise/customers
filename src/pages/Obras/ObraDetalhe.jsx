import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoArea } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import {
  ETAPAS,
  PRIORIDADES,
  estadoDaEtapa,
  etapaAtual,
  podeEditarSetor,
  progressoDaObra,
  setorConcluido,
  setoresDaEtapa,
  temAcessoTotal,
} from '@/domain/obras'
import { dataExtensa, dataHora } from '@/utils/formato'
import './ObraDetalhe.css'

const Icone = {
  voltar: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
    </svg>
  ),
  ok: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--etapa-ok)" />
      <path d="m8 12.3 2.6 2.6L16 9.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  atual: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--etapa-atual)" />
      <circle cx="12" cy="12" r="3.4" fill="#fff" />
    </svg>
  ),
  travada: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--etapa-travada)" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
    </svg>
  ),
  mais: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
}

export default function ObraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    obraPorId,
    clientePorId,
    pessoaPorId,
    equipe,
    cargoPorChave,
    alternarTarefa,
    adicionarObservacao,
    removerObservacao,
  } = useDados()

  const [novaObs, setNovaObs] = useState(false)
  const [texto, setTexto] = useState('')

  const obra = obraPorId(id)

  const numeroAtual = useMemo(() => (obra ? etapaAtual(obra) : 1), [obra])

  if (!obra) return <Navigate to="/app/obras" replace />

  const cliente = clientePorId(obra.clienteId)
  const prioridade = PRIORIDADES.find((p) => p.id === obra.prioridade)
  const setoresAtuais = setoresDaEtapa(numeroAtual)
  const progresso = progressoDaObra(obra)
  const membros = obra.membros.map(pessoaPorId).filter(Boolean)

  /* a nota do autor: primeiro a do banco (usuario logado), depois a da equipe */
  const notaDoAutor = user?.avaliacao ?? equipe.find((p) => p.nome === user?.name)?.avaliacao ?? null

  const enviarObservacao = (evento) => {
    evento.preventDefault()
    if (!texto.trim()) return
    adicionarObservacao(obra.id, {
      autorId: user?.id ?? null,
      autorNome: user?.name ?? 'Usuário',
      avaliacao: notaDoAutor,
      texto,
      foto: user?.foto ?? null,
    })
    setTexto('')
    setNovaObs(false)
  }

  return (
    <AppShell>
      <section className="detalhe">
        {/* ---------------- faixa da obra ---------------- */}
        <header className="capa" data-tom={obra.tipo}>
          <button type="button" className="capa__voltar" onClick={() => navigate('/app/obras')} aria-label="Voltar para as obras">
            <Icone.voltar />
          </button>

          <div className="capa__texto">
            <p className="capa__trilha">
              <Link to="/app/obras">Obras</Link> / {cliente?.nome ?? 'Cliente removido'}
            </p>
            <h1 className="capa__titulo">{cliente?.nome ?? 'Cliente removido'}</h1>
          </div>

          <div className="capa__lado">
            <span className="capa__selo">{obra.tipo === 'emergencia' ? 'Emergência' : 'Padrão'}</span>
            <p className="capa__desc">{obra.descricao}</p>
          </div>
        </header>

        {/* ---------------- faixa de informacoes ---------------- */}
        <div className="infos">
          <div className="info">
            <span className="info__nome">Prioridade</span>
            <span className="info__valor info__valor--pri" data-pri={obra.prioridade}>
              {prioridade?.rotulo}
            </span>
          </div>

          <div className="info">
            <span className="info__nome">Data prevista</span>
            <span className="info__valor">{dataExtensa(obra.dataPrevista)}</span>
          </div>

          <div className="info">
            <span className="info__nome">Setores da {numeroAtual}ª etapa</span>
            <span className="info__linha">
              {setoresAtuais.map((s) => {
                const pronto = setorConcluido(
                  obra.etapas.find((e) => e.numero === numeroAtual),
                  s,
                )
                const cargo = cargoPorChave(s)
                return (
                  <span
                    key={s}
                    className={`info__setor ${pronto ? 'is-pronto' : ''}`.trim()}
                    style={{ '--setor-cor': cargo?.cor ?? '#6b7280' }}
                    title={pronto ? 'Concluído' : 'Pendente'}
                  >
                    {cargo?.nome ?? s}
                  </span>
                )
              })}
            </span>
          </div>

          <div className="info info--progresso">
            <span className="info__nome">Progresso</span>
            <span className="barrinha" role="img" aria-label={`${progresso}% concluído`}>
              <span className="barrinha__cheio" style={{ width: `${progresso}%` }} />
            </span>
            <span className="info__valor">{progresso}%</span>
          </div>

          <div className="info info--membros">
            <span className="info__nome">Membros</span>
            <span className="info__avatares">
              {(membros.length > 0 ? membros : equipe.slice(0, 4)).map((p) => (
                <Avatar key={p.id} nome={p.nome} foto={p.foto} tamanho={30} titulo={p.nome} />
              ))}
            </span>
          </div>
        </div>

        {/* ---------------- etapas + observacoes ---------------- */}
        <div className="tabuleiro">
          <div className="trilho">
            {ETAPAS.map((modelo) => {
              const etapa = obra.etapas.find((e) => e.numero === modelo.numero)
              const estado = estadoDaEtapa(obra, modelo.numero)
              const setores = setoresDaEtapa(modelo.numero)
              const prontos = setores.filter((s) => setorConcluido(etapa, s)).length

              return (
                <section key={modelo.numero} className="etapa" data-estado={estado}>
                  <header className="etapa__topo">
                    <h2 className="etapa__titulo">{modelo.rotulo}</h2>
                    {estado === 'concluida' && <Icone.ok />}
                    {estado === 'atual' && <Icone.atual />}
                    {estado === 'bloqueada' && <Icone.travada />}
                    <span className="etapa__contagem">
                      {prontos}/{setores.length}
                    </span>
                  </header>

                  <p className="etapa__nome">{modelo.nome}</p>

                  <div className="etapa__cards">
                    {setores.map((setor) => (
                      <CardSetor
                        key={setor}
                        setor={setor}
                        cargo={cargoPorChave(setor)}
                        bloco={etapa.setores[setor]}
                        travado={estado === 'bloqueada'}
                        /* cada cargo marca so as tarefas do proprio setor */
                        semPermissao={!podeEditarSetor(user, setor)}
                        responsavel={pessoaPorId(etapa.setores[setor].responsavelId)}
                        aoMarcar={(indice) =>
                          alternarTarefa(obra.id, modelo.numero, setor, indice, user?.id)
                        }
                      />
                    ))}
                  </div>

                  {estado === 'bloqueada' && (
                    <p className="etapa__aviso">
                      Liberada quando a {modelo.numero - 1}ª etapa fechar.
                    </p>
                  )}
                </section>
              )
            })}
          </div>

          {/* painel fixo a direita: acompanha a rolagem das etapas */}
          <aside className="obs">
            <header className="obs__topo">
              <h2 className="obs__titulo">Observações</h2>
              <span className="obs__contagem">{obra.observacoes.length}</span>
              <button
                type="button"
                className="obs__mais"
                onClick={() => setNovaObs(true)}
                aria-label="Nova observação"
                title="Nova observação"
              >
                <Icone.mais />
              </button>
            </header>

            <div className="obs__lista">
              {obra.observacoes.length === 0 && (
                <p className="obs__vazio">Nada registrado ainda. Use o + para escrever a primeira.</p>
              )}

              {obra.observacoes.map((o) => (
                <article key={o.id} className="nota">
                  <div className="nota__texto">
                    <p className="nota__quem">
                      <strong>{o.autorNome}</strong>
                      {o.avaliacao !== null && o.avaliacao !== undefined && (
                        <span className="nota__nota" title="Avaliação do usuário">
                          {Number(o.avaliacao).toFixed(1)}
                        </span>
                      )}
                    </p>
                    <p className="nota__corpo">{o.texto}</p>
                    <p className="nota__data">{dataHora(o.enviadaEm)}</p>
                  </div>

                  <div className="nota__lado">
                    <Avatar nome={o.autorNome} foto={o.foto} tamanho={34} titulo={o.autorNome} />
                    <button
                      type="button"
                      className="nota__apagar"
                      onClick={() => removerObservacao(obra.id, o.id)}
                      aria-label="Apagar observação"
                      title="Apagar"
                    >
                      <Icone.lixo />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <Modal
        aberto={novaObs}
        aoFechar={() => setNovaObs(false)}
        titulo="Nova observação"
        subtitulo="Fica registrada com seu nome, sua avaliação e o horário."
        largura={470}
      >
        <form className="formobs" onSubmit={enviarObservacao}>
          <div className="formobs__autor">
            <Avatar nome={user?.name} foto={user?.foto} tamanho={38} titulo={user?.name} />
            <p>
              <strong>{user?.name ?? 'Usuário'}</strong>
              {notaDoAutor !== null && notaDoAutor !== undefined && (
                <span className="nota__nota">{Number(notaDoAutor).toFixed(1)}</span>
              )}
            </p>
          </div>

          <CampoArea
            rotulo="Observação"
            largo
            linhas={4}
            placeholder="O que precisa ficar registrado nesta obra?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />

          <footer className="formobra__acoes">
            <button type="button" className="formobra__cancelar" onClick={() => setNovaObs(false)}>
              Cancelar
            </button>
            <Button type="submit" disabled={!texto.trim()}>
              Adicionar observação
            </Button>
          </footer>
        </form>
      </Modal>
    </AppShell>
  )
}

/**
 * Card de um setor dentro da etapa: titulo na cor do cargo e o roteiro
 * de tarefas.
 *
 * Duas travas diferentes, e o cadeado diz qual e:
 *  - `travado`: a etapa ainda nao abriu (so em obra padrao);
 *  - `semPermissao`: a etapa abriu, mas este setor nao e o seu cargo.
 */
function CardSetor({ setor, cargo, bloco, travado, semPermissao, responsavel, aoMarcar }) {
  const pronto = bloco.tarefas.every((t) => t.feito)
  const feitas = bloco.tarefas.filter((t) => t.feito).length
  const bloqueado = travado || semPermissao
  const cor = cargo?.cor ?? '#6b7280'

  return (
    <article
      className={`setorcard ${pronto ? 'is-pronto' : ''} ${
        semPermissao && !travado ? 'is-deoutro' : ''
      }`.trim()}
      style={{ '--setor-cor': cor }}
    >
      <header className="setorcard__topo">
        <h3 className="setorcard__titulo">{cargo?.nome ?? setor}</h3>
        {semPermissao && !travado && (
          <span className="setorcard__cadeado" title="Só este cargo edita estas tarefas">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
              <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
            </svg>
          </span>
        )}
        <span className="setorcard__placar">
          {feitas}/{bloco.tarefas.length}
        </span>
        {responsavel && <Avatar nome={responsavel.nome} foto={responsavel.foto} tamanho={20} titulo={responsavel.nome} />}
      </header>

      <ul className="setorcard__tarefas">
        {bloco.tarefas.map((tarefa, indice) => (
          <li key={tarefa.titulo}>
            <button
              type="button"
              className={`tarefa ${tarefa.feito ? 'is-feita' : ''}`.trim()}
              onClick={() => aoMarcar(indice)}
              disabled={bloqueado}
              title={semPermissao && !travado ? `Somente ${cargo?.nome ?? setor} marca esta tarefa` : undefined}
              aria-pressed={tarefa.feito}
            >
              <span className="tarefa__marca" aria-hidden="true">
                {tarefa.feito && (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                )}
              </span>
              {tarefa.titulo}
            </button>
          </li>
        ))}
      </ul>
    </article>
  )
}
