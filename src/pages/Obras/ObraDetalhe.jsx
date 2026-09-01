import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoArea } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  PRIORIDADES,
  cardConcluido,
  cardsQueValem,
  checkTemDonoProprio,
  fundoDoCard,
  nomeDoCard,
  podeEditarCheck,
} from '@/domain/obras'
import { textoSobre } from '@/utils/cor'
import { dataExtensa, dataHora } from '@/utils/formato'
import ModalCard from './ModalCard'
import ModalCheck from './ModalCheck'
import ModalEtapa from './ModalEtapa'
import ModalChat from './ModalChat'
import ModalEtiquetas from './ModalEtiquetas'
import ModalAnexos from './ModalAnexos'
import ModalObra from './ModalObra'
import './ObraDetalhe.css'

const Icone = {
  voltar: () => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
  mais: ({ tamanho = 16 }) => (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  lapis: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
  etapa: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="7" height="16" rx="1.6" />
      <rect x="14" y="4" width="7" height="10" rx="1.6" />
    </svg>
  ),
  nota: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4.8A1.8 1.8 0 0 1 6.8 3h10.4A1.8 1.8 0 0 1 19 4.8v14.4A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </svg>
  ),
  chat: ({ tamanho = 16 }) => (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 15.5a2 2 0 0 1-2 2H8l-4 3.5v-14a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
      <path d="M8.5 9h7M8.5 12.5h4.5" />
    </svg>
  ),
  etiqueta: ({ tamanho = 16 }) => (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 11.4V4.8A1.3 1.3 0 0 1 4.8 3.5h6.6a1.3 1.3 0 0 1 .9.4l8 8a1.3 1.3 0 0 1 0 1.8l-6.6 6.6a1.3 1.3 0 0 1-1.8 0l-8-8a1.3 1.3 0 0 1-.4-.9z" />
      <circle cx="7.9" cy="7.9" r="1.3" />
    </svg>
  ),
  clipe: ({ tamanho = 16 }) => (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7-7L13 4.4a3.4 3.4 0 0 1 4.8 4.8l-7.7 7.7a1.8 1.8 0 0 1-2.5-2.5l7.2-7.2" />
    </svg>
  ),
}

export default function ObraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const {
    obraPorId,
    clientePorId,
    pessoaPorId,
    equipe,
    clientes,
    roteiroDaObra,
    cargoPorChave,
    corDoCargo,
    nomeDoCargo,
    alternarCheck,
    adicionarObservacao,
    editarObservacao,
    removerObservacao,
    etiquetasDaObra,
    atualizarObra,
    etapaDaObra,
    progresso,
    estadoEtapa,
    carregando,
    pode,
  } = useDados()

  const [novaObs, setNovaObs] = useState(false)
  const [texto, setTexto] = useState('')
  const [editandoObs, setEditandoObs] = useState(null)

  /* pop-ups do roteiro: guardam o alvo (etapa/card/check) e abrem */
  const [editandoEtapa, setEditandoEtapa] = useState(null) // {etapa} | {novo:true}
  const [editandoCard, setEditandoCard] = useState(null) // {etapa, card?}
  const [editandoCheck, setEditandoCheck] = useState(null) // {card, check?}
  const [menuFlutuante, setMenuFlutuante] = useState(false)

  /* pop-ups da obra */
  const [chat, setChat] = useState(false)
  const [etiquetas, setEtiquetas] = useState(false)
  const [anexos, setAnexos] = useState(false)
  const [editandoObra, setEditandoObra] = useState(false)

  const obra = obraPorId(id)

  if (carregando && !obra) {
    return (
      <AppShell>
        <p className="detalhe__carregando">Carregando obra...</p>
      </AppShell>
    )
  }
  if (!obra) return <Navigate to="/app/obras" replace />

  const cliente = clientePorId(obra.clienteId)
  const prioridade = PRIORIDADES.find((p) => p.id === obra.prioridade)
  /* o roteiro que ESTA obra enxerga: o que foi criado depois dela nao
     entra, e o que saiu depois dela continua aqui */
  const roteiro = roteiroDaObra(obra)
  const numeroAtual = etapaDaObra(obra)
  const etapaCorrente = roteiro.find((e) => e.numero === numeroAtual)
  const pct = progresso(obra)
  const membros = obra.membros.map(pessoaPorId).filter(Boolean)
  const marcas = etiquetasDaObra(obra)

  const podeEtapa = pode('editar_etapa')
  const podeCards = pode('editar_cards')
  const podeChecks = pode('editar_checks')
  const podeObra = pode('editar_obras')
  const mexeNoRoteiro = podeEtapa || podeCards || podeChecks

  const enviarObservacao = async (evento) => {
    evento.preventDefault()
    if (!texto.trim()) return
    try {
      if (editandoObs) await editarObservacao(obra.id, editandoObs.id, texto)
      else await adicionarObservacao(obra.id, { texto, autorNome: user?.name })
      setTexto('')
      setNovaObs(false)
      setEditandoObs(null)
    } catch {
      /* o recado do erro ja aparece na faixa do AppShell */
    }
  }

  const abrirEdicaoObs = (o) => {
    setEditandoObs(o)
    setTexto(o.texto)
    setNovaObs(true)
  }

  return (
    <AppShell>
      <section className="detalhe">
        {/* ---------------- faixa da obra ----------------
            A foto do cliente estica para ocupar a faixa inteira e vai
            de 0% de opacidade na esquerda a 15% na ponta direita. */}
        <header className="capa" data-tom={obra.tipo}>
          {cliente?.logo && (
            <span
              className="capa__marca"
              style={{ backgroundImage: `url(${cliente.logo})` }}
              aria-hidden="true"
            />
          )}

          <div className="capa__texto">
            {/* o voltar fica ACIMA da trilha e do nome, na propria linha */}
            <button
              type="button"
              className="capa__voltar"
              onClick={() => navigate('/app/obras')}
              aria-label="Voltar para as obras"
            >
              <Icone.voltar />
            </button>

            <p className="capa__trilha">
              <Link to="/app/obras">Obras</Link>/{cliente?.nome ?? 'Cliente removido'}
            </p>
            <h1 className="capa__titulo">{cliente?.nome ?? 'Cliente removido'}</h1>

            {marcas.length > 0 && (
              <span className="capa__etiquetas">
                {marcas.map((e) => (
                  <span
                    key={e.id}
                    className="capa__etiqueta"
                    style={{ background: e.cor, color: textoSobre(e.cor, isDark) }}
                  >
                    {e.nome}
                  </span>
                ))}
              </span>
            )}
          </div>

          <div className="capa__lado">
            <span className="capa__selo">{obra.tipo === 'emergencia' ? 'Emergência' : 'Padrão'}</span>
            <p className="capa__desc">{obra.descricao}</p>

            {/* etiqueta, anexo e editar: as tres acoes da obra em si */}
            <span className="capa__acoes">
              <button
                type="button"
                className="capa__acao"
                onClick={() => setEtiquetas(true)}
                title="Etiquetas desta obra"
              >
                <Icone.etiqueta tamanho={15} />
                Etiquetas
                {marcas.length > 0 && <em>{marcas.length}</em>}
              </button>

              <button
                type="button"
                className="capa__acao"
                onClick={() => setAnexos(true)}
                title="Documentos anexados a esta obra"
              >
                <Icone.clipe tamanho={15} />
                Anexos
                {obra.anexos?.length > 0 && <em>{obra.anexos.length}</em>}
              </button>

              {podeObra && (
                <button
                  type="button"
                  className="capa__acao"
                  onClick={() => setEditandoObra(true)}
                  title="Editar as informações desta obra"
                >
                  <Icone.lapis />
                  Editar
                </button>
              )}
            </span>
          </div>
        </header>

        {/* ---------------- faixa de informacoes ---------------- */}
        <div className="infos vidro">
          <div className="info">
            <span className="info__nome">Prioridade</span>
            <span className="info__valor info__valor--pri" data-pri={obra.prioridade}>
              {prioridade?.rotulo}
              {obra.tipo === 'emergencia' && <em className="info__fixa">emergência é sempre alta</em>}
            </span>
          </div>

          <div className="info">
            <span className="info__nome">Data de início</span>
            <span className="info__valor">{dataExtensa(obra.dataInicio) || '—'}</span>
          </div>

          <div className="info">
            <span className="info__nome">Data de conclusão</span>
            <span className="info__valor">
              {dataExtensa(obra.dataConclusao) || <em className="info__vazio">sem data</em>}
            </span>
          </div>

          <div className="info">
            <span className="info__nome">Setores da {numeroAtual}ª etapa</span>
            <span className="info__linha">
              {(etapaCorrente?.cards ?? []).map((card) => {
                const pronto = cardConcluido(card, obra.checks)
                return (
                  <span
                    key={card.id}
                    className={`info__setor ${pronto ? 'is-pronto' : ''}`.trim()}
                    style={{ '--setor-cor': fundoDoCard(card, corDoCargo) }}
                    title={pronto ? 'Concluído' : 'Pendente'}
                  >
                    {nomeDoCard(card, nomeDoCargo)}
                  </span>
                )
              })}
            </span>
          </div>

          <div className="info info--progresso">
            <span className="info__nome">Progresso</span>
            <span className="barrinha" role="img" aria-label={`${pct}% concluído`}>
              <span className="barrinha__cheio" style={{ width: `${pct}%` }} />
            </span>
            <span className="info__valor">{pct}%</span>
          </div>

          {/* Membros a esquerda, "Abrir chat" logo a direita deles — os
              dois no mesmo bloco para nunca se separarem na quebra */}
          <div className="infos__fim">
            <div className="info info--membros">
              <span className="info__nome">Membros</span>
              <span className="info__avatares">
                {(membros.length > 0 ? membros : equipe.slice(0, 4)).map((p) => (
                  <Avatar key={p.id} nome={p.nome} foto={p.foto} tamanho={30} titulo={p.nome} />
                ))}
              </span>
            </div>

            <button type="button" className="abrirchat" onClick={() => setChat(true)}>
              <Icone.chat tamanho={17} />
              Abrir chat
            </button>
          </div>
        </div>

        {/* ---------------- quem criou e quem mexeu por ultimo ---------------- */}
        <div className="carimbo vidro">
          <p className="carimbo__item">
            <span className="carimbo__nome">Criada em</span>
            <span className="carimbo__valor">{dataHora(obra.criadoEm)}</span>
          </p>
          <p className="carimbo__item">
            <span className="carimbo__nome">Criada por</span>
            <span className="carimbo__valor">{obra.criadoPorNome ?? '—'}</span>
          </p>
          <p className="carimbo__item">
            <span className="carimbo__nome">Última alteração</span>
            <span className="carimbo__valor">{dataHora(obra.atualizadoEm)}</span>
          </p>
          <p className="carimbo__item">
            <span className="carimbo__nome">Alterada por</span>
            <span className="carimbo__valor">
              {obra.atualizadoPorNome ?? obra.criadoPorNome ?? '—'}
            </span>
          </p>
        </div>

        {/* ---------------- etapas + observacoes ---------------- */}
        <div className="tabuleiro">
          <div className="trilho">
            {roteiro.map((etapa) => {
              const estado = estadoEtapa(obra, etapa.numero)
              /* o placar conta so os cards que ja tem check: card recem-criado,
                 ainda vazio, nao entra na conta nem trava a etapa */
              const valem = cardsQueValem(etapa)
              const prontos = valem.filter((c) => cardConcluido(c, obra.checks)).length

              return (
                <section key={etapa.id} className="etapa vidro" data-estado={estado}>
                  <header className="etapa__topo">
                    <h2 className="etapa__titulo">{etapa.numero}ª Etapa</h2>
                    {estado === 'concluida' && <Icone.ok />}
                    {estado === 'atual' && <Icone.atual />}
                    {estado === 'bloqueada' && <Icone.travada />}
                    <span className="etapa__contagem">
                      {prontos}/{valem.length}
                    </span>
                    {mexeNoRoteiro && (
                      <span className="etapa__ferramentas">
                        {podeCards && (
                          <button
                            type="button"
                            className="etapa__botao"
                            onClick={() => setEditandoCard({ etapa })}
                            title="Novo card nesta etapa"
                            aria-label={`Novo card na ${etapa.numero}ª etapa`}
                          >
                            <Icone.mais tamanho={15} />
                          </button>
                        )}
                        {podeEtapa && (
                          <button
                            type="button"
                            className="etapa__botao"
                            onClick={() => setEditandoEtapa({ etapa })}
                            title="Editar ou excluir a etapa"
                            aria-label={`Editar a ${etapa.numero}ª etapa`}
                          >
                            <Icone.lapis />
                          </button>
                        )}
                      </span>
                    )}
                  </header>

                  <p className="etapa__nome">{etapa.nome}</p>

                  <div className="etapa__cards">
                    {etapa.cards.map((card) => (
                      <CardSetor
                        key={card.id}
                        card={card}
                        obra={obra}
                        travado={estado === 'bloqueada'}
                        /* a permissao e olhada check a check: um deles
                           pode ter dono proprio, diferente do card */
                        usuario={user}
                        podeCards={podeCards}
                        podeChecks={podeChecks}
                        corDoCargo={corDoCargo}
                        nomeDoCargo={nomeDoCargo}
                        cargoPorChave={cargoPorChave}
                        pessoaPorId={pessoaPorId}
                        aoMarcar={(checkId) => alternarCheck(obra.id, checkId)}
                        aoEditarCard={() => setEditandoCard({ etapa, card })}
                        aoNovoCheck={() => setEditandoCheck({ card })}
                        aoEditarCheck={(check) => setEditandoCheck({ card, check })}
                      />
                    ))}
                  </div>

                  {estado === 'bloqueada' && (
                    <p className="etapa__aviso">
                      Liberada quando a {etapa.numero - 1}ª etapa fechar.
                    </p>
                  )}
                </section>
              )
            })}

            {roteiro.length === 0 && (
              <p className="trilho__vazio">
                Nenhuma etapa no roteiro. Use o botão <strong>+</strong> no canto para criar a
                primeira.
              </p>
            )}
          </div>

          {/* painel fixo a direita: acompanha a rolagem das etapas */}
          <aside className="obs vidro">
            <header className="obs__topo">
              <h2 className="obs__titulo">Observações</h2>
              <span className="obs__contagem">{obra.observacoes.length}</span>
              <button
                type="button"
                className="obs__mais"
                onClick={() => {
                  setEditandoObs(null)
                  setTexto('')
                  setNovaObs(true)
                }}
                aria-label="Nova observação"
                title="Nova observação"
              >
                <Icone.mais tamanho={16} />
              </button>
            </header>

            <div className="obs__lista">
              {obra.observacoes.length === 0 && (
                <p className="obs__vazio">Nada registrado ainda. Use o + para escrever a primeira.</p>
              )}

              {obra.observacoes.map((o) => {
                const autor = pessoaPorId(o.autorId)
                /* cada um mexe so na propria observacao — a API confere
                   de novo antes de gravar */
                const minha = String(o.autorId) === String(user?.id)
                return (
                  <article key={o.id} className="nota">
                    <div className="nota__texto">
                      <p className="nota__quem">
                        <strong>{o.autorNome}</strong>
                      </p>
                      <p className="nota__corpo">{o.texto}</p>
                      <p className="nota__data">
                        {dataHora(o.enviadaEm)}
                        {o.editadaEm && <em className="nota__editada">editada</em>}
                      </p>
                    </div>

                    <div className="nota__lado">
                      <Avatar nome={o.autorNome} foto={autor?.foto} tamanho={34} titulo={o.autorNome} />
                      {minha && (
                        <span className="nota__ferramentas">
                          <button
                            type="button"
                            className="nota__apagar"
                            onClick={() => abrirEdicaoObs(o)}
                            aria-label="Editar observação"
                            title="Editar"
                          >
                            <Icone.lapis />
                          </button>
                          <button
                            type="button"
                            className="nota__apagar"
                            onClick={() => removerObservacao(obra.id, o.id).catch(() => {})}
                            aria-label="Apagar observação"
                            title="Apagar"
                          >
                            <Icone.lixo />
                          </button>
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>
        </div>
      </section>

      {/* ---------------- botao flutuante ---------------- */}
      <BotaoFlutuante
        aberto={menuFlutuante}
        aoAlternar={() => setMenuFlutuante((v) => !v)}
        aoFechar={() => setMenuFlutuante(false)}
        acoes={[
          ...(podeEtapa
            ? [
                {
                  id: 'etapa',
                  rotulo: 'Adicionar etapa',
                  Glifo: Icone.etapa,
                  aoClicar: () => setEditandoEtapa({ novo: true }),
                },
              ]
            : []),
          {
            id: 'obs',
            rotulo: 'Adicionar observação',
            Glifo: Icone.nota,
            aoClicar: () => {
              setEditandoObs(null)
              setTexto('')
              setNovaObs(true)
            },
          },
          /* o mesmo chat do botao la de cima: uma conversa por obra */
          {
            id: 'chat',
            rotulo: 'Chat da obra',
            Glifo: Icone.chat,
            aoClicar: () => setChat(true),
          },
        ]}
      />

      {/* ---------------- pop-ups ---------------- */}
      <Modal
        aberto={novaObs}
        aoFechar={() => {
          setNovaObs(false)
          setEditandoObs(null)
        }}
        titulo={editandoObs ? 'Editar observação' : 'Nova observação'}
        subtitulo={
          editandoObs
            ? 'Ela vai aparecer com a marca de "editada".'
            : 'Fica registrada com seu nome e o horário.'
        }
        largura={470}
      >
        <form className="formobs" onSubmit={enviarObservacao}>
          <div className="formobs__autor">
            <Avatar nome={user?.name} foto={user?.foto} tamanho={38} titulo={user?.name} />
            <p>
              <strong>{user?.name ?? 'Usuário'}</strong>
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
            <button
              type="button"
              className="formobra__cancelar"
              onClick={() => {
                setNovaObs(false)
                setEditandoObs(null)
              }}
            >
              Cancelar
            </button>
            <Button type="submit" disabled={!texto.trim()}>
              {editandoObs ? 'Salvar observação' : 'Adicionar observação'}
            </Button>
          </footer>
        </form>
      </Modal>

      <ModalEtapa
        aberto={Boolean(editandoEtapa)}
        etapa={editandoEtapa?.etapa ?? null}
        obraId={obra.id}
        aoFechar={() => setEditandoEtapa(null)}
      />

      <ModalCard
        aberto={Boolean(editandoCard)}
        etapa={editandoCard?.etapa}
        card={editandoCard?.card ?? null}
        obraId={obra.id}
        aoFechar={() => setEditandoCard(null)}
      />

      <ModalCheck
        aberto={Boolean(editandoCheck)}
        card={editandoCheck?.card}
        nomeCard={editandoCheck?.card ? nomeDoCard(editandoCheck.card, nomeDoCargo) : ''}
        check={editandoCheck?.check ?? null}
        obraId={obra.id}
        aoFechar={() => setEditandoCheck(null)}
      />

      <ModalChat aberto={chat} obra={obra} aoFechar={() => setChat(false)} />

      <ModalEtiquetas aberto={etiquetas} obra={obra} aoFechar={() => setEtiquetas(false)} />

      <ModalAnexos aberto={anexos} obra={obra} aoFechar={() => setAnexos(false)} />

      <ModalObra
        aberto={editandoObra}
        obra={obra}
        clientes={clientes}
        aoFechar={() => setEditandoObra(false)}
        aoSalvar={(campos) => atualizarObra(obra.id, campos)}
      />
    </AppShell>
  )
}

/**
 * Card de um setor dentro da etapa: titulo na cor do cargo (gradiente
 * quando o card e de mais de um) e a lista de checks.
 *
 * Duas travas diferentes, e o cadeado diz qual e:
 *  - `travado`: a etapa ainda nao abriu (so em obra padrao);
 *  - `semPermissao`: a etapa abriu, mas o card e de outro cargo.
 */
function CardSetor({
  card,
  obra,
  travado,
  usuario,
  podeCards,
  podeChecks,
  corDoCargo,
  nomeDoCargo,
  cargoPorChave,
  pessoaPorId,
  aoMarcar,
  aoEditarCard,
  aoNovoCheck,
  aoEditarCheck,
}) {
  const feitas = card.checks.filter((c) => obra.checks[c.id]).length
  const pronto = card.checks.length > 0 && feitas === card.checks.length
  /* "de outro" e quando NENHUM check do card e do seu cargo */
  const semPermissao = !card.checks.some((c) => podeEditarCheck(usuario, c, card, obra))
  const fundo = fundoDoCard(card, corDoCargo)
  const titulo = nomeDoCard(card, nomeDoCargo)

  /* quem marcou o ultimo check do card vira o rosto dele */
  const ultimo = card.checks
    .map((c) => obra.checks[c.id])
    .filter(Boolean)
    .sort((a, b) => String(b.feitoEm).localeCompare(String(a.feitoEm)))[0]
  const responsavel = ultimo ? pessoaPorId(ultimo.feitoPor) : null

  const donos = card.cargos.map((c) => cargoPorChave(c)?.nome ?? c).join(', ')

  return (
    <article
      className={`setorcard ${pronto ? 'is-pronto' : ''} ${
        semPermissao && !travado ? 'is-deoutro' : ''
      }`.trim()}
      style={{ '--setor-cor': fundo, '--setor-cor-solida': corDoCargo(card.cargos[0]) }}
    >
      <header className="setorcard__topo">
        <h3 className="setorcard__titulo">{titulo}</h3>
        {semPermissao && !travado && (
          <span className="setorcard__cadeado" title={`Só ${donos} marca estes checks`}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
              <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
            </svg>
          </span>
        )}
        <span className="setorcard__placar">
          {feitas}/{card.checks.length}
        </span>
        {responsavel && (
          <Avatar nome={responsavel.nome} foto={responsavel.foto} tamanho={20} titulo={responsavel.nome} />
        )}

        {(podeChecks || podeCards) && (
          <span className="setorcard__ferramentas">
            {podeChecks && (
              <button
                type="button"
                onClick={aoNovoCheck}
                title="Novo check neste card"
                aria-label={`Novo check em ${titulo}`}
              >
                <Icone.mais tamanho={14} />
              </button>
            )}
            {podeCards && (
              <button
                type="button"
                onClick={aoEditarCard}
                title="Editar ou excluir o card"
                aria-label={`Editar o card ${titulo}`}
              >
                <Icone.lapis />
              </button>
            )}
          </span>
        )}
      </header>

      <ul className="setorcard__tarefas">
        {card.checks.map((check) => {
          const feito = Boolean(obra.checks[check.id])
          const meu = podeEditarCheck(usuario, check, card, obra)
          const proprio = checkTemDonoProprio(check)
          const donosDoCheck = proprio
            ? check.cargos.map((c) => cargoPorChave(c)?.nome ?? c).join(', ')
            : donos
          return (
            <li key={check.id}>
              <button
                type="button"
                className={`tarefa ${feito ? 'is-feita' : ''} ${!meu ? 'is-deoutro' : ''}`.trim()}
                onClick={() => aoMarcar(check.id)}
                disabled={travado || !meu}
                title={
                  travado
                    ? undefined
                    : meu
                      ? undefined
                      : `Somente ${donosDoCheck} marca este check`
                }
                aria-pressed={feito}
              >
                <span className="tarefa__marca" aria-hidden="true">
                  {feito && (
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  )}
                </span>
                {check.titulo}
                {/* dono diferente do card: a etiqueta diz de quem e */}
                {proprio && (
                  <span className="tarefa__dono" title={`Check de ${donosDoCheck}`}>
                    {check.cargos
                      .map((c) => cargoPorChave(c)?.curto ?? c.slice(0, 3))
                      .join('·')}
                  </span>
                )}
              </button>

              {podeChecks && (
                <button
                  type="button"
                  className="tarefa__editar"
                  onClick={() => aoEditarCheck(check)}
                  title="Editar ou excluir o check"
                  aria-label={`Editar o check ${check.titulo}`}
                >
                  <Icone.lapis />
                </button>
              )}
            </li>
          )
        })}

        {card.checks.length === 0 && (
          <li className="setorcard__semcheck">Sem check ainda.</li>
        )}
      </ul>
    </article>
  )
}

/**
 * Botao redondo no canto inferior direito. Fechado e um "+"; aberto,
 * abre as acoes acima dele.
 */
function BotaoFlutuante({ aberto, aoAlternar, aoFechar, acoes = [] }) {
  const caixa = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined

    const fora = (e) => {
      if (!caixa.current?.contains(e.target)) aoFechar()
    }
    const tecla = (e) => {
      if (e.key === 'Escape') aoFechar()
    }

    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto, aoFechar])

  return (
    <div className="flutua" ref={caixa}>
      {aberto && (
        <div className="flutua__menu" role="menu">
          {acoes.map(({ id, rotulo, Glifo, aoClicar }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="flutua__item"
              onClick={() => {
                aoFechar()
                aoClicar()
              }}
            >
              <Glifo />
              {rotulo}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`flutua__botao ${aberto ? 'is-aberto' : ''}`.trim()}
        onClick={aoAlternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Adicionar etapa, observação ou abrir o chat"
      >
        <Icone.mais tamanho={22} />
      </button>
    </div>
  )
}
