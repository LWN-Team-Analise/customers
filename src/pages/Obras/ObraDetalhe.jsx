import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar, { PilhaAvatares } from '@/components/Avatar/Avatar'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import Confirma from '@/components/Confirma/Confirma'
import { CampoArea } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  avisoDeEtapa,
  cardConcluido,
  cardsQueValem,
  chaveDoCargo,
  checkTemDonoProprio,
  fundoDoCard,
  nomeDoCard,
  podeEditarCheck,
  rotuloPrioridadeObra,
  tituloDaObra,
  tomPrioridadeObra,
} from '@/domain/obras'
import { textoSobre } from '@/utils/cor'
import { dataExtensa, dataHora } from '@/utils/formato'
import ModalCard from './ModalCard'
import ModalCheck from './ModalCheck'
import ModalEtapa from './ModalEtapa'
import ModalFechaEtapa from './ModalFechaEtapa'
import ModalChat from './ModalChat'
import Rastreabilidade from './Rastreabilidade'
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
  lixo: ({ tamanho = 15 }) => (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
  clipe: ({ tamanho = 16 }) => (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7-7L13 4.4a3.4 3.4 0 0 1 4.8 4.8l-7.7 7.7a1.8 1.8 0 0 1-2.5-2.5l7.2-7.2" />
    </svg>
  ),
}

/**
 * A tela da obra.
 *
 * `somenteLeitura` e o modo que a aba Concluidas usa: a obra aparece
 * INTEIRA — capa, etapas, checks marcados, observacoes, chat, etiquetas,
 * anexos —, so que nada aceita escrita. Nao e "esconder os botoes": os
 * botoes de gravar somem, os campos ficam desabilitados e o servidor
 * recusa igual, porque obra encerrada e registro, e registro que se pode
 * alterar depois de fechado nao serve de registro.
 *
 * A prop e so a PORTA de entrada: quem manda de verdade e `soLeitura`,
 * logo abaixo, que soma a ela o estado da propria obra. Uma obra fechada
 * aberta pela rota de Obras (um link antigo, o botao de voltar do
 * navegador) tem de vir travada do mesmo jeito — a trava e da obra, nao
 * do caminho por onde se chegou nela.
 *
 * `voltarPara` diz de onde a pessoa veio. Aberta pela aba Concluidas, ela
 * volta para la — nao faria sentido cair no quadro de obras abertas.
 */
export default function ObraDetalhe({ somenteLeitura = false, voltarPara = '/app/obras' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const {
    obraPorId,
    clientePorId,
    pessoaPorId,
    clientes,
    roteiroDaObra,
    cargoPorChave,
    corDoCargo,
    nomeDoCargo,
    alternarCheck,
    removerObra,
    adicionarObservacao,
    editarObservacao,
    removerObservacao,
    etiquetasDaObra,
    atualizarObra,
    etapaDaObra,
    progresso,
    estadoEtapa,
    concluida,
    prontaParaConcluir,
    concluirObra,
    rotuloEtapa,
    carregando,
    pode,
  } = useDados()

  const [novaObs, setNovaObs] = useState(false)
  const [texto, setTexto] = useState('')
  const [editandoObs, setEditandoObs] = useState(null)

  /* Concluir a obra: dois passos de propósito.
     `concluindo` abre o formulário (a observação, que é opcional);
     `confirmandoFim` é o segundo clique, o que grava. */
  const [concluindo, setConcluindo] = useState(false)
  const [obsFinal, setObsFinal] = useState('')
  const [confirmandoFim, setConfirmandoFim] = useState(false)
  const [fechando, setFechando] = useState(false)

  /* pop-ups do roteiro: guardam o alvo (etapa/card/check) e abrem */
  const [editandoEtapa, setEditandoEtapa] = useState(null) // {etapa} | {novo:true}
  const [editandoCard, setEditandoCard] = useState(null) // {etapa, card?}
  const [editandoCheck, setEditandoCheck] = useState(null) // {card, check?}
  /* o recado de "acabei a minha parte desta etapa" — o mesmo do card
     do quadro, para a resposta nao depender de por onde se marcou */
  const [avisoEtapa, setAvisoEtapa] = useState(null)
  const [menuFlutuante, setMenuFlutuante] = useState(false)

  /* pop-ups da obra */
  const [chat, setChat] = useState(false)
  const [etiquetas, setEtiquetas] = useState(false)
  const [anexos, setAnexos] = useState(false)
  const [editandoObra, setEditandoObra] = useState(false)
  /* a exclusao da obra concluida — o "sim" que abre a caixa de
     confirmacao, que por sua vez pede o segundo */
  const [apagando, setApagando] = useState(false)

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
  const nomeDaObra = tituloDaObra(obra, cliente)
  /* a trava vale pela ROTA (aba Concluídas) ou pela própria obra estar
     encerrada — o que vier primeiro */
  const soLeitura = somenteLeitura || concluida(obra)
  /* o roteiro que ESTA obra enxerga: o que foi criado depois dela nao
     entra, e o que saiu depois dela continua aqui */
  const roteiro = roteiroDaObra(obra)

  /**
   * Marcar um check, e — quando for o caso — anunciar o fechamento.
   *
   * A conta do aviso e feita ANTES de gravar, com o mapa de checks que
   * a tela tem agora: depois da gravacao o `recarregar` ja trouxe o
   * estado novo, e nao daria mais para saber se ESTE clique foi o que
   * fechou a sua parte. Desmarcar nunca anuncia nada.
   */
  const marcarCheck = (checkId) => {
    if (!obra.checks?.[checkId]) {
      const novo = avisoDeEtapa(roteiro, obra.checks, checkId, chaveDoCargo(user))
      if (novo) setAvisoEtapa(novo)
    }
    alternarCheck(obra.id, checkId)
  }
  const numeroAtual = etapaDaObra(obra)
  const etapaCorrente = roteiro.find((e) => e.numero === numeroAtual)
  const pct = progresso(obra)
  const membros = obra.membros.map(pessoaPorId).filter(Boolean)
  const marcas = etiquetasDaObra(obra)


  /* No modo leitura TODA permissao cai junto, num lugar so. Espalhar o
     `!soLeitura` por quinze condicoes e como se esquece uma. */
  const podeEtapa = !soLeitura && pode('editar_etapa')
  const podeCards = !soLeitura && pode('editar_cards')
  const podeChecks = !soLeitura && pode('editar_checks')
  const podeObra = !soLeitura && pode('editar_obras')
  /**
   * Apagar a obra — DUAS permissoes, porque sao dois gestos:
   *
   *   obra ABERTA    'editar_obras'. Apagar uma obra em andamento e
   *                  parte de tocar o quadro (a obra criada errada, a
   *                  duplicada);
   *   obra CONCLUIDA 'excluir_concluidas'. Ali nao se apaga trabalho
   *                  em andamento, apaga-se o REGISTRO do que a
   *                  empresa entregou.
   *
   * E a mesma divisao que o servidor faz em DELETE /obras/:id — sem
   * ela, o botao apareceria para quem a API vai recusar.
   */
  const podeExcluir = pode(soLeitura ? 'excluir_concluidas' : 'editar_obras')
  const mexeNoRoteiro = podeEtapa || podeCards || podeChecks

  /* O botão "Concluir obra" só existe quando as três valem:
     a obra está aberta, a barra chegou a 100% (nenhum check em
     aberto) e quem está olhando pode editar obra. Antes disso ele
     nem aparece — botão desabilitado só faz perguntar por quê.

     UM argumento, e não dois: este `prontaParaConcluir` é o do
     CONTEXTO, que já resolve sozinho o roteiro que esta obra
     enxerga. O do domínio (src/domain/obras.js) tem o mesmo nome e
     pede (roteiro, obra) — é fácil confundir os dois, e passar o
     roteiro aqui faz o contexto tratá-lo como se fosse a obra: a
     resposta vira false para sempre e o botão some. */
  const podeConcluir = podeObra && prontaParaConcluir(obra)

  const encerrar = async () => {
    setFechando(true)
    try {
      await concluirObra(obra.id, obsFinal.trim())
      setConfirmandoFim(false)
      setConcluindo(false)
      setObsFinal('')
      /* A obra sai do quadro e passa a viver em Concluídas: é para lá que
         a pessoa vai, e não para uma tela que ela acabou de fechar.

         Só que nem todo setor enxerga Concluídas — mandar para lá quem
         não pode abrir a aba daria uma volta pelo login. Nesse caso ela
         volta para o quadro, que é de onde veio. */
      navigate(pode('ver_concluidas') ? `/app/concluidas/${obra.id}` : '/app/obras')
    } catch {
      /* o motivo já aparece na faixa do AppShell */
      setConfirmandoFim(false)
    } finally {
      setFechando(false)
    }
  }

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
    /* semChat: dentro da obra o chat que vale e o DELA, no botao flutuante
       proprio desta tela. Dois botoes de chat lado a lado so confundiriam. */
    <AppShell semChat>
      <section className="detalhe">
        {/* ---------------- faixa da obra ----------------
            A foto do cliente estica para ocupar a faixa inteira e vai
            de 0% de opacidade na esquerda a 15% na ponta direita. */}
        <header className="capa" data-tom={obra.tipo}>
          {/* O recorte de HEADER da logo, quando o cliente tem um: ele
              já vem na proporção desta faixa, então entra em `cover` e
              aparece exatamente como foi enquadrado.

              Sem ele (cliente cadastrado antes do editor) cai na
              própria logo — e ali continua esticada, como sempre foi:
              `cover` numa logo quadrada daria um zoom que ninguém
              escolheu. */}
          {(cliente?.capa || cliente?.logo) && (
            <span
              className="capa__marca"
              style={{
                backgroundImage: `url(${cliente.capa ?? cliente.logo})`,
                backgroundSize: cliente.capa ? 'cover' : '100% 100%',
              }}
              aria-hidden="true"
            />
          )}

          <div className="capa__texto">
            {/* o voltar fica ACIMA da trilha e do nome, na propria linha */}
            <button
              type="button"
              className="capa__voltar"
              onClick={() => navigate(voltarPara)}
              aria-label="Voltar"
            >
              <Icone.voltar />
            </button>

            <p className="capa__trilha">
              {/* o rótulo é da ROTA, não do estado da obra: quem chegou
                  aqui pela aba Obras volta para Obras */}
              <Link to={voltarPara}>{somenteLeitura ? 'Concluídas' : 'Obras'}</Link>/
              {nomeDaObra}
            </p>
            {/* "1042/2026 - Acme": a proposta na frente, que é como a obra
                é procurada no resto da empresa */}
            <h1 className="capa__titulo">{nomeDaObra}</h1>

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
            {/* a descrição é opcional; sem ela a capa diz isso em vez de
                deixar um vazio entre o selo e os botões */}
            <p className="capa__desc">
              {obra.descricao || <em className="capa__semdesc">sem descrição</em>}
            </p>

            {/* Etiquetas e Anexos ficam na obra FECHADA também — só que
                em modo consulta. Antes os dois botões sumiam junto com o
                Editar, e o efeito era que tudo o que tinha sido etiquetado
                ou anexado durante a obra desaparecia no dia em que ela era
                concluída: justo quando esse material vira registro e passa
                a ser o que alguém volta para consultar.

                O Editar continua sumindo: aquele grava de verdade. */}
            <span className="capa__acoes">
              <button
                type="button"
                className="capa__acao"
                onClick={() => setEtiquetas(true)}
                title={soLeitura ? 'Etiquetas desta obra (consulta)' : 'Etiquetas desta obra'}
              >
                <Icone.etiqueta tamanho={15} />
                Etiquetas
                {marcas.length > 0 && <em>{marcas.length}</em>}
              </button>

              <button
                type="button"
                className="capa__acao"
                onClick={() => setAnexos(true)}
                title={
                  soLeitura
                    ? 'Documentos desta obra (consulta)'
                    : 'Documentos anexados a esta obra'
                }
              >
                <Icone.clipe tamanho={15} />
                Anexos
                {obra.anexos?.length > 0 && <em>{obra.anexos.length}</em>}
              </button>

              {/* Excluir mora aqui, ao lado de Anexos, aberta ou
                  concluida. Nao numa lista: apagar uma obra e uma
                  decisao que se toma olhando a obra, e nao passando o
                  olho por doze linhas onde um lixo por linha e um
                  clique errado esperando acontecer. */}
              {podeExcluir && (
                <button
                  type="button"
                  className="capa__acao capa__acao--perigo"
                  onClick={() => setApagando(true)}
                  title={soLeitura ? 'Excluir esta obra concluída' : 'Excluir esta obra'}
                >
                  <Icone.lixo />
                  Excluir
                </button>
              )}

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
            {/* só a palavra. O "emergência é sempre alta" que ficava colado
                aqui transformava a pastilha num parágrafo e, de quebra,
                escondia a própria cor da prioridade — que é o que essa
                pastilha existe para mostrar. Quem quiser a regra a lê no
                cadastro, onde ela muda alguma coisa. */}
            <span className="info__valor info__valor--pri" data-pri={tomPrioridadeObra(obra)}>
              {rotuloPrioridadeObra(obra)}
            </span>
          </div>

          <div className="info">
            <span className="info__nome">Data de início</span>
            <span className="info__valor">{dataExtensa(obra.dataInicio) || '—'}</span>
          </div>

          {/* ---------------- Data de conclusão ----------------

              Obra PADRÃO sem data fica com um (!) piscando no canto.
              Não é enfeite: sem prazo a obra nunca aparece como
              atrasada na página inicial e fica de fora da conta de
              atraso do painel — ela some dos dois lugares que existem
              para cobrá-la, sem ninguém perceber.

              O sinal é um botão: clicar abre o cadastro, que é onde a
              data se preenche. Aviso que aponta um buraco sem levar
              até ele obriga a pessoa a procurar sozinha onde conserta.

              Na EMERGÊNCIA ele não aparece porque não pode acontecer:
              ali a data é obrigatória no cadastro. E na obra já
              concluída também não — o prazo daquela já passou, e
              piscar sobre registro fechado é ruído. */}
          <div className="info info--conclusao">
            <span className="info__nome">Data de conclusão</span>
            <span className="info__valor">
              {dataExtensa(obra.dataConclusao) || <em className="info__vazio">sem data</em>}
            </span>

            {!obra.dataConclusao && !soLeitura && obra.tipo !== 'emergencia' && (
              <button
                type="button"
                className="pendencia"
                onClick={() => setEditandoObra(true)}
                title="Esta obra está sem data de conclusão. Clique para preencher."
                aria-label="Pendente: informe a data de conclusão desta obra"
              >
                !
              </button>
            )}
          </div>

          <div className="info">
            <span className="info__nome">Setores da {rotuloEtapa(numeroAtual)}</span>
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
            {/* a barra e a porcentagem numa coluna, o botão AO LADO
                dela — e não embaixo, onde ele empurrava a faixa inteira
                para baixo toda vez que a obra ficava pronta */}
            <span className="info__coluna">
              <span className="info__nome">Progresso</span>
              <span className="barrinha" role="img" aria-label={`${pct}% concluído`}>
                <span className="barrinha__cheio" style={{ width: `${pct}%` }} />
              </span>
              <span className="info__valor">{pct}%</span>
            </span>

            {/* À DIREITA do Progresso, e só quando a barra fecha em
                100%. A obra não se encerra mais sozinha ao marcar o
                último check: marcar tudo faz o botão aparecer, encerrar
                é o clique — com uma segunda confirmação depois dele. */}
            {podeConcluir && (
              <button
                type="button"
                className="concluir"
                onClick={() => {
                  setObsFinal('')
                  setConcluindo(true)
                }}
                title="Encerrar esta obra e mandá-la para Concluídas"
              >
                <Icone.ok />
                Concluir obra
              </button>
            )}
          </div>

          {/* Membros a esquerda, "Abrir chat" logo a direita deles — os
              dois no mesmo bloco para nunca se separarem na quebra */}
          <div className="infos__fim">
            {/* Membro da obra é quem MARCOU algum check nela — mais
                ninguém. Antes, obra sem nenhum check marcado mostrava aqui
                os quatro primeiros da equipe como se fossem os
                participantes: gente que nunca tinha encostado naquela obra
                aparecia como responsável por ela. Sem membro, agora, a
                tela diz que não há. */}
            <div className="info info--membros">
              <span className="info__nome">Membros</span>
              {membros.length === 0 ? (
                <span className="info__vazio">ninguém marcou check ainda</span>
              ) : (
                <span className="info__avatares">
                  {membros.map((p) => (
                    <Avatar key={p.id} nome={p.nome} foto={p.foto} tamanho={30} titulo={p.nome} />
                  ))}
                </span>
              )}
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

          {/* "Concluída em" e "Concluída por" só existem na obra fechada —
              é o pedido, e é o que faz sentido: numa obra em andamento os
              dois seriam duas linhas vazias ocupando a faixa. */}
          {soLeitura && obra.concluidaEm && (
            <>
              <p className="carimbo__item">
                <span className="carimbo__nome">Concluída em</span>
                <span className="carimbo__valor">{dataHora(obra.concluidaEm)}</span>
              </p>
              <p className="carimbo__item">
                <span className="carimbo__nome">Concluída por</span>
                <span className="carimbo__valor">{obra.concluidaPorNome ?? '—'}</span>
              </p>
              {obra.conclusaoObs && (
                <p className="carimbo__item carimbo__item--largo">
                  <span className="carimbo__nome">Observação da conclusão</span>
                  <span className="carimbo__valor">{obra.conclusaoObs}</span>
                </p>
              )}
            </>
          )}
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
                    {/* O NOME da etapa é o título ("Comercial"). Antes
                        aqui ficava o rótulo automático ("1ª Etapa") e o
                        nome ia embaixo, pequeno — o lugar de destaque
                        gasto para dizer uma coisa que a ordem das
                        colunas já diz. Etapa sem nome cai no rótulo. */}
                    <h2 className="etapa__titulo" title={rotuloEtapa(etapa.numero)}>
                      {etapa.nome || rotuloEtapa(etapa.numero)}
                    </h2>
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
                            aria-label={`Novo card em ${etapa.nome || rotuloEtapa(etapa.numero)}`}
                          >
                            <Icone.mais tamanho={15} />
                          </button>
                        )}
                        {podeEtapa && (
                          <button
                            type="button"
                            className="etapa__botao"
                            onClick={() => setEditandoEtapa({ etapa })}
                            title="Editar o nome e a descrição desta etapa"
                            aria-label={`Editar ${etapa.nome || rotuloEtapa(etapa.numero)}`}
                          >
                            <Icone.lapis />
                          </button>
                        )}
                      </span>
                    )}
                  </header>

                  {/* a linha de apoio: em que pé a etapa está. Só
                      aparece quando alguém escreveu alguma coisa. */}
                  {etapa.descricao && <p className="etapa__desc">{etapa.descricao}</p>}

                  <div className="etapa__cards">
                    {etapa.cards.map((card) => (
                      <CardSetor
                        key={card.id}
                        card={card}
                        obra={obra}
                        /* na obra fechada todo check e so leitura, mesmo
                           os da etapa que estava aberta */
                        travado={soLeitura || estado === 'bloqueada'}
                        /* a permissao e olhada check a check: um deles
                           pode ter dono proprio, diferente do card */
                        usuario={user}
                        podeCards={podeCards}
                        podeChecks={podeChecks}
                        corDoCargo={corDoCargo}
                        nomeDoCargo={nomeDoCargo}
                        cargoPorChave={cargoPorChave}
                        pessoaPorId={pessoaPorId}
                        aoMarcar={marcarCheck}
                        aoEditarCard={() => setEditandoCard({ etapa, card })}
                        aoNovoCheck={() => setEditandoCheck({ card })}
                        aoEditarCheck={(check) => setEditandoCheck({ card, check })}
                      />
                    ))}
                  </div>

                  {estado === 'bloqueada' && (
                    <p className="etapa__aviso">
                      Liberada quando a {rotuloEtapa(etapa.numero - 1)} fechar.
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
              {!soLeitura && (
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
              )}
            </header>

            <div className="obs__lista">
              {obra.observacoes.length === 0 && (
                <p className="obs__vazio">
                  {soLeitura
                    ? 'Nenhuma observação nesta obra.'
                    : 'Nada registrado ainda. Use o + para escrever a primeira.'}
                </p>
              )}

              {obra.observacoes.map((o) => {
                const autor = pessoaPorId(o.autorId)
                /* cada um mexe so na propria observacao — a API confere
                   de novo antes de gravar */
                /* obra fechada: nem a propria observacao se edita mais */
                const minha =
                  !soLeitura && String(o.autorId) === String(user?.id)
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

        {/* A ficha vale para QUALQUER obra, aberta ou fechada: saber quem
            marcou o que e a que horas serve tanto para conferir o passado
            quanto para acompanhar o que esta acontecendo agora. */}
        <Rastreabilidade obra={obra} roteiro={roteiro} />
      </section>

      {/* ---------------- botao flutuante ----------------
          Some na obra fechada: todas as acoes dele gravam. */}
      {!soLeitura && (
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
      )}

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
            : undefined
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

      <ModalFechaEtapa aviso={avisoEtapa} aoFechar={() => setAvisoEtapa(null)} />

      {/* DOIS passos para apagar: o botao abre a caixa, e a caixa so
          libera o "Excluir" depois que a pessoa marca que entendeu o
          que vai junto. Nao ha desfazer, e um clique unico num botao
          de lixo nao e decisao suficiente para isso. */}
      <Confirma
        aberto={apagando}
        titulo={soLeitura ? 'Excluir esta obra concluída?' : 'Excluir esta obra?'}
        mensagem={
          soLeitura
            ? 'O registro da obra sai do sistema e não há como voltar atrás.'
            : 'A obra sai do quadro e do sistema. Não há como voltar atrás.'
        }
        aviso="Vão junto a rastreabilidade dos checks, o chat, as observações, as etiquetas, os anexos e as avaliações desta obra."
        ciencia="Entendi que esta obra e tudo o que está nela serão apagados."
        detalhes={
          <dl className="fechada__resumo">
            <dt>Obra</dt>
            <dd>{tituloDaObra(obra, cliente)}</dd>
            {soLeitura ? (
              <>
                <dt>Concluída em</dt>
                <dd>{dataHora(obra.concluidaEm) || '—'}</dd>
                <dt>Concluída por</dt>
                <dd>{obra.concluidaPorNome ?? '—'}</dd>
              </>
            ) : (
              <>
                <dt>Progresso</dt>
                <dd>{pct}% dos checks marcados</dd>
              </>
            )}
          </dl>
        }
        rotuloConfirmar="Excluir obra"
        aoConfirmar={async () => {
          await removerObra(obra.id)
          navigate(soLeitura ? '/app/concluidas' : '/app/obras')
        }}
        aoFechar={() => setApagando(false)}
      />


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

      {/* os três em modo consulta quando a obra está fechada: a conversa
          inteira continua à vista, sem a caixa de escrever */}
      <ModalChat
        aberto={chat}
        obra={obra}
        somenteLeitura={soLeitura}
        aoFechar={() => setChat(false)}
      />

      <ModalEtiquetas
        aberto={etiquetas}
        obra={obra}
        somenteLeitura={soLeitura}
        aoFechar={() => setEtiquetas(false)}
      />

      <ModalAnexos
        aberto={anexos}
        obra={obra}
        somenteLeitura={soLeitura}
        aoFechar={() => setAnexos(false)}
      />

      {/* ---------------- concluir a obra ----------------
          Passo 1: a observação (opcional).
          Passo 2: a confirmação, que é onde a obra fecha de verdade. */}
      <Modal
        aberto={concluindo}
        aoFechar={() => setConcluindo(false)}
        titulo="Concluir esta obra?"
        largura={470}
      >
        <form
          className="formobs"
          onSubmit={(e) => {
            e.preventDefault()
            setConfirmandoFim(true)
          }}
        >
          <div className="formobs__autor">
            <Avatar nome={user?.name} foto={user?.foto} tamanho={38} titulo={user?.name} />
            <p>
              <strong>{user?.name ?? 'Usuário'}</strong>
            </p>
          </div>

          <CampoArea
            rotulo="Observação da conclusão"
            largo
            linhas={4}
            placeholder="Alguma coisa que precise ficar registrada no encerramento?"
            value={obsFinal}
            onChange={(e) => setObsFinal(e.target.value)}
          />

          <footer className="formobra__acoes">
            <button
              type="button"
              className="formobra__cancelar"
              onClick={() => setConcluindo(false)}
            >
              Cancelar
            </button>
            <Button type="submit" loading={fechando}>
              Concluir obra
            </Button>
          </footer>
        </form>
      </Modal>

      <Confirma
        aberto={confirmandoFim}
        nivel={1}
        tom="acao"
        titulo="Encerrar a obra agora?"
        mensagem="Depois disso ninguém escreve mais nada nela: nem check, nem chat, nem observação, nem anexo."
        detalhes={
          <dl>
            <dt>Obra</dt>
            <dd>{nomeDaObra}</dd>

            <dt>Concluída por</dt>
            <dd>{user?.name ?? '—'}</dd>

            <dt>Observação</dt>
            <dd>{obsFinal.trim() || <em>sem observação</em>}</dd>
          </dl>
        }
        aviso="A obra continua inteira em Concluídas — etapas, checks, chat, etiquetas e anexos —, mas só para leitura."
        rotuloConfirmar="Concluir obra"
        aoConfirmar={encerrar}
        aoFechar={() => setConfirmandoFim(false)}
      />

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

  /**
   * Os rostos de quem marcou algum check DESTE card.
   *
   * Antes aparecia so o ultimo. Mas um card costuma ser trabalho de mais
   * de uma pessoa — o tecnico marca um check, o GQ marca outro — e mostrar
   * so quem chegou por ultimo apagava o outro da tela. Agora aparecem os
   * dois, do mais recente para o mais antigo.
   *
   * Sem repetir: quem marcou tres checks aparece uma vez so.
   */
  const responsaveis = useMemo(() => {
    const marcas = card.checks
      .map((c) => obra.checks[c.id])
      .filter(Boolean)
      .sort((a, b) => String(b.feitoEm).localeCompare(String(a.feitoEm)))

    const vistos = new Set()
    const gente = []
    marcas.forEach((marca) => {
      const id = String(marca.feitoPor ?? "")
      if (!id || vistos.has(id)) return
      vistos.add(id)
      const pessoa = pessoaPorId(id)
      if (pessoa) gente.push(pessoa)
    })
    return gente
  }, [card.checks, obra.checks, pessoaPorId])

  const donos = card.cargos.map((c) => cargoPorChave(c)?.nome ?? c).join(', ')

  return (
    <article
      className={`setorcard ${pronto ? 'is-pronto' : ''} ${
        semPermissao && !travado ? 'is-deoutro' : ''
      }`.trim()}
      style={{ '--setor-cor': fundo, '--setor-cor-solida': corDoCargo(card.cargos[0]) }}
    >
      <header className="setorcard__topo">
        {/* o nome inteiro na dica: o titulo corta com reticencias para
            a fila do cabecalho caber sempre */}
        <h3 className="setorcard__titulo" title={titulo}>
          {titulo}
        </h3>
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
        {responsaveis.length > 0 && (
          <PilhaAvatares pessoas={responsaveis} tamanho={20} limite={4} />
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

      {/* as etiquetas DESTE card. Nada a ver com as da obra: outro
          catalogo, outra caixa, e nenhuma das duas puxa a outra. */}
      {(card.etiquetas ?? []).length > 0 && (
        <ul className="setorcard__etiquetas">
          {card.etiquetas.map((e) => (
            <li key={e.id} style={{ background: e.cor }}>
              {e.nome}
            </li>
          ))}
        </ul>
      )}

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
