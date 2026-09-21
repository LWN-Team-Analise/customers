import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Seletor from '@/components/Seletor/Seletor'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { nomeProprioDaEtapa, PRIORIDADES, PRIORIDADE_PESO } from '@/domain/obras'
import { dataExtensa, dataHora } from '@/utils/formato'
import CardObra from './CardObra'
import ModalObra from './ModalObra'
import ModalMembros from './ModalMembros'
import ModalSetores from './ModalSetores'
import ModalObservacoes from './ModalObservacoes'
import ModalFechaEtapa from './ModalFechaEtapa'
import './Obras.css'

const ORDENACOES = [
  { valor: 'prioridade', rotulo: 'Prioridade' },
  { valor: 'data', rotulo: 'Data de conclusão' },
  { valor: 'empresa', rotulo: 'Empresa' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
]

/* o filtro de setor mostra ate cinco cargos; o resto vai para o "+N" */
const LIMITE_SETORES = 5

const Mais = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const Sino = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
)

/* o relogio com a seta para tras: o historico das observacoes */
const Historico = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4v5h5" />
    <path d="M3.1 13.2A9 9 0 1 0 6.1 6.1L3 9" />
    <path d="M12 8v4.3l3.4 1.9" />
  </svg>
)

/* o icone da opcao "Adicionar observação" no botao flutuante */
const NotaGlifo = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M8 11h8M8 15h5" />
  </svg>
)

export default function Obras() {
  const {
    obras,
    clientes,
    cargos,
    observacoesQuadro,
    historicoObservacoes,
    clientePorId,
    pessoaPorId,
    cargoPorChave,
    adicionarObra,
    registrarAviso,
    concluida,
    etapaDaObra,
    roteiroDaObra,
    pendentesDaObra,
    rotuloEtapa,
    pode,
  } = useDados()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [modalObra, setModalObra] = useState(null) // 'padrao' | 'emergencia' | null
  const [modalMembros, setModalMembros] = useState(false)
  const [modalSetores, setModalSetores] = useState(false)
  /* qual aba do pop-up de observacoes abrir: 'atuais', 'historico' ou
     null quando ele esta fechado */
  const [modalObs, setModalObs] = useState(null)
  const [recado, setRecado] = useState('')
  /* o recado de "acabei a minha parte desta etapa". Ele mora AQUI, e
     nao no card: quando a etapa fecha, a obra troca de grupo no quadro
     e o card e remontado — o aviso morreria antes de ser lido */
  const [avisoEtapa, setAvisoEtapa] = useState(null)

  /* sem a permissao, o botao nem aparece — e a API recusa igual */
  const podeCriarObra = pode('editar_obras')
  const podeAvisar = pode('enviar_avisos')

  const [prioridade, setPrioridade] = useState(null)
  const [ateData, setAteData] = useState('')
  const [setores, setSetores] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('prioridade')

  /**
   * Os cargos que aparecem na linha do filtro.
   *
   * Cargo filtrado vem sempre na frente, mesmo que ele estivesse fora
   * dos cinco primeiros: quem escolhe um cargo pelo "+N" precisa ver a
   * escolha na linha, e nao continuar escondida atras do botao. Quem sai
   * da linha e um dos que NAO foram filtrados.
   */
  const cargosVisiveis = useMemo(() => {
    const escolhidos = cargos.filter((c) => setores.includes(c.chave))
    const resto = cargos.filter((c) => !setores.includes(c.chave))
    return [...escolhidos, ...resto].slice(0, Math.max(LIMITE_SETORES, escolhidos.length))
  }, [cargos, setores])

  const cargosRestantes = Math.max(0, cargos.length - cargosVisiveis.length)

  /**
   * Os clientes que aparecem no filtro: so os que tem obra ABERTA.
   *
   * A lista vinha do cadastro inteiro, e num cadastro de sessenta
   * empresas o filtro do quadro oferecia cinquenta e cinco escolhas
   * que so podiam devolver tela vazia — a obra daquelas ja fechou, e o
   * quadro nao mostra obra concluida.
   *
   * O cliente ESCOLHIDO fica na lista mesmo que a ultima obra dele
   * feche enquanto a tela esta aberta: some-lo dali deixaria o filtro
   * ligado num cliente que nao da para desmarcar.
   */
  const clientesComObra = useMemo(() => {
    const ativos = new Set(
      obras.filter((o) => !concluida(o)).map((o) => String(o.clienteId)),
    )
    return clientes
      .filter((c) => ativos.has(String(c.id)) || String(c.id) === String(clienteId))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [obras, clientes, concluida, clienteId])

  const alternarSetor = (id) =>
    setSetores((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]))

  const limparFiltros = () => {
    setPrioridade(null)
    setAteData('')
    setSetores([])
    setClienteId('')
    setBusca('')
  }

  const filtrosAtivos =
    (prioridade ? 1 : 0) +
    (ateData ? 1 : 0) +
    setores.length +
    (clienteId ? 1 : 0) +
    (busca.trim() ? 1 : 0)

  /* ------- filtro + ordenacao (as obras concluidas saem do quadro) ------- */
  const visiveis = useMemo(() => {
    const alvo = busca.trim().toLowerCase()

    const filtradas = obras.filter((obra) => {
      if (concluida(obra)) return false
      if (prioridade && obra.prioridade !== prioridade) return false
      if (clienteId && String(obra.clienteId) !== String(clienteId)) return false
      if (ateData && obra.dataConclusao && obra.dataConclusao > ateData) return false

      if (setores.length > 0) {
        const pendentes = pendentesDaObra(obra)
        if (!setores.some((s) => pendentes.includes(s))) return false
      }

      if (alvo) {
        /* a busca acha pelo n. da proposta também — é por ele que a obra
           costuma ser procurada, e a descrição agora pode estar vazia */
        const empresa = clientePorId(obra.clienteId)?.nome ?? ''
        const texto = `${obra.proposta ?? ''} ${empresa} ${obra.descricao ?? ''}`.toLowerCase()
        if (!texto.includes(alvo)) return false
      }

      return true
    })

    const comparar = {
      prioridade: (a, b) => PRIORIDADE_PESO[b.prioridade] - PRIORIDADE_PESO[a.prioridade],
      data: (a, b) => String(a.dataConclusao ?? '9999').localeCompare(String(b.dataConclusao ?? '9999')),
      empresa: (a, b) =>
        (clientePorId(a.clienteId)?.nome ?? '').localeCompare(
          clientePorId(b.clienteId)?.nome ?? '',
          'pt-BR',
        ),
      recentes: (a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)),
    }[ordem]

    return [...filtradas].sort(comparar)
  }, [
    obras,
    prioridade,
    clienteId,
    ateData,
    setores,
    busca,
    ordem,
    clientePorId,
    concluida,
    pendentesDaObra,
  ])

  /**
   * As obras de uma coluna, separadas pela etapa em que estao AGORA.
   *
   * Cada obra aparece uma vez so, no grupo da sua etapa atual — nao
   * uma vez por etapa do roteiro. Uma coluna de trinta cards seguidos
   * nao responde "o que esta parado no Comercial?"; separada por
   * etapa, ela responde de longe, so pelo tamanho das pilhas.
   *
   * Etapa sem nenhuma obra nao vira titulo: um "2ª Etapa" com nada
   * embaixo so gasta altura da coluna.
   *
   * O nome do grupo sai do roteiro da PRIMEIRA obra dele. Obras
   * antigas podem ter roteiro proprio, e nesse caso duas obras na
   * "2ª" podem ter nomes diferentes para ela — o numero, que e o que
   * o titulo garante, continua certo para as duas.
   */
  const porEtapa = useMemo(() => {
    const agrupar = (lista) => {
      const grupos = new Map()
      lista.forEach((obra) => {
        const numero = etapaDaObra(obra)
        if (!grupos.has(numero)) grupos.set(numero, [])
        grupos.get(numero).push(obra)
      })
      return [...grupos.entries()]
        .sort(([a], [b]) => a - b)
        .map(([numero, obras]) => {
          const rotulo = rotuloEtapa(numero)
          return {
            numero,
            rotulo,
            /* o nome so entra quando ACRESCENTA. Nada impede alguem de
               chamar a etapa de "3° Etapa" no roteiro, e ai o titulo
               saia com a mesma informacao duas vezes, escrita de dois
               jeitos: "3ª Etapa   3° Etapa". */
            nome: nomeProprioDaEtapa(
              roteiroDaObra(obras[0]).find((e) => e.numero === numero)?.nome,
              rotulo,
            ),
            obras,
          }
        })
    }
    return agrupar
  }, [etapaDaObra, rotuloEtapa, roteiroDaObra])

  const padrao = visiveis.filter((o) => o.tipo === 'padrao')
  const emergencia = visiveis.filter((o) => o.tipo === 'emergencia')
  /* so entram na coluna de aviso as obras que realmente devem algo */
  const pendentes = visiveis.filter((o) => pendentesDaObra(o).length > 0)

  const pessoasDa = (obra) => obra.membros.map(pessoaPorId).filter(Boolean)

  /* Membros do cabecalho: so quem esta participando das obras em
     exibicao — nao a equipe inteira. */
  const participantes = useMemo(() => {
    const ids = new Set(visiveis.flatMap((o) => o.membros.map(String)))
    return [...ids].map(pessoaPorId).filter(Boolean)
  }, [visiveis, pessoaPorId])

  /** Avisa todos os setores que ainda devem informacao na etapa da obra. */
  /* O pedaço que conta se a cobrança saiu também da caixa de entrada.
     Aviso que só acende o sininho cobra apenas quem está com o sistema
     aberto, e vale dizer qual dos dois foi.

     Quando NÃO saiu, a tela diz o motivo. Silêncio aqui é o pior dos
     mundos: o aviso é gravado do mesmo jeito, a tela diz "enviado", e
     não há como descobrir que o e-mail morreu no caminho sem ir ler o
     log do servidor. */
  const porEmail = (quantos, motivo) => {
    if (quantos > 0) {
      return ` ${quantos} pessoa${quantos > 1 ? 's' : ''} recebeu por e-mail.`
    }
    return motivo ? ` Nenhum e-mail saiu: ${motivo}.` : ''
  }

  const avisarObra = async (obra) => {
    const faltando = pendentesDaObra(obra)
    if (faltando.length === 0) return
    const etapa = etapaDaObra(obra)
    const saida = await registrarAviso(obra.id, {
      setores: faltando,
      /* "Pendência na 3ª Etapa." — a palavra "Etapa" vem da configuração
         da empresa, não do código */
      mensagem: `Pendência na ${rotuloEtapa(etapa)}.`,
      etapa,
    }).catch(() => null)
    const nomes = faltando.map((s) => cargoPorChave(s)?.nome ?? s).join(', ')
    const empresa = clientePorId(obra.clienteId)?.nome ?? 'obra'
    setRecado(
      `Aviso enviado para ${nomes} — ${empresa}.${porEmail(
        saida?.emails ?? 0,
        saida?.emailMotivo,
      )}`,
    )
  }

  const avisarTodas = async () => {
    if (pendentes.length === 0) return
    let emails = 0
    let motivo = null
    for (const obra of pendentes) {
      const etapa = etapaDaObra(obra)
      const saida = await registrarAviso(obra.id, {
        setores: pendentesDaObra(obra),
        mensagem: `Pendência na ${rotuloEtapa(etapa)}.`,
        etapa,
      }).catch(() => null)
      emails += saida?.emails ?? 0
      /* o primeiro motivo basta: se o e-mail está quebrado, ele está
         quebrado igual nas dez obras */
      motivo = motivo ?? saida?.emailMotivo ?? null
    }
    setRecado(
      `Aviso enviado a todos os setores pendentes de ${pendentes.length} obra${
        pendentes.length > 1 ? 's' : ''
      }.${porEmail(emails, motivo)}`,
    )
  }

  return (
    /* Aqui o botao flutuante ganha uma segunda opcao: alem do chat da
       equipe, a observacao do quadro — que so existe nesta tela. Com duas
       coisas a acrescentar, ele vira um "+" e pergunta qual. */
    <AppShell
      acoesFlutuantes={[
        {
          id: 'obs-quadro',
          rotulo: 'Adicionar observação',
          Glifo: NotaGlifo,
          aoClicar: () => setModalObs('atuais'),
        },
      ]}
    >
      <section className="obras">
        {/* ---------------- cabecalho de filtros ----------------

            Sempre aberto. Havia um botao "Filtros" na barra de baixo
            que escondia este painel; ele saiu porque escondia
            justamente o que a tela usa o tempo todo — e um filtro
            fechado e um filtro esquecido ligado, que faz a pessoa
            procurar a obra que "sumiu". O "Limpar" continua ali. */}
        <div className="painel vidro">
            <div className="painel__filtros">
              <div className="filtro">
                <span className="filtro__nome">Prioridade</span>
                <div className="filtro__linha">
                  {PRIORIDADES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`chip ${prioridade === p.id ? 'is-atual' : ''}`.trim()}
                      data-tom={p.id}
                      aria-pressed={prioridade === p.id}
                      onClick={() => setPrioridade((atual) => (atual === p.id ? null : p.id))}
                    >
                      {p.rotulo}
                    </button>
                  ))}
                </div>
              </div>

              {/* com muitos clientes, a lista e o caminho mais rapido ate a obra */}
              <div className="filtro">
                <span className="filtro__nome">Cliente</span>
                <div className="filtro__linha">
                  <Seletor
                    valor={clienteId}
                    aoMudar={setClienteId}
                    vazio="Todos os clientes"
                    aria-label="Filtrar por cliente"
                    opcoes={[
                      { valor: '', rotulo: 'Todos os clientes' },
                      ...clientesComObra.map((c) => ({ valor: c.id, rotulo: c.nome })),
                    ]}
                  />
                </div>
              </div>

              <div className="filtro">
                <span className="filtro__nome">
                  Data <em>até</em>
                </span>
                <div className="filtro__linha">
                  <input
                    type="date"
                    className="filtro__data"
                    value={ateData}
                    onChange={(e) => setAteData(e.target.value)}
                    aria-label="Mostrar obras com conclusão até esta data"
                  />
                  <span className="filtro__dataleg">
                    {ateData ? dataExtensa(ateData) : 'todas as datas'}
                  </span>
                </div>
              </div>

              {/* mostra ate 5 cargos; o que for filtrado pelo "+N" sobe
                  para a frente da linha e passa a aparecer aqui.

                  E o unico filtro ELASTICO da fila (`--setores`): ele e
                  o mais largo e o unico cujo conteudo quebra bem, entao
                  e ele que cede quando falta espaco — as pastilhas
                  passam para uma segunda linha dentro do proprio bloco
                  e os cinco rotulos continuam alinhados em cima. */}
              <div className="filtro filtro--setores">
                <span className="filtro__nome">Setor pendente</span>
                <div className="filtro__linha">
                  {cargosVisiveis.map((cargo) => {
                    const ativo = setores.includes(cargo.chave)
                    return (
                      <button
                        key={cargo.id}
                        type="button"
                        className={`chip ${ativo ? 'is-atual' : ''}`.trim()}
                        style={ativo ? { '--tom': cargo.cor, '--tom-fg': '#fff' } : undefined}
                        aria-pressed={ativo}
                        onClick={() => alternarSetor(cargo.chave)}
                      >
                        {cargo.nome}
                      </button>
                    )
                  })}

                  {cargosRestantes > 0 && (
                    <button
                      type="button"
                      className="chip chip--mais"
                      onClick={() => setModalSetores(true)}
                      title="Ver todos os setores e o que falta em cada um"
                    >
                      +{cargosRestantes}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Membros: a SEGUNDA coluna da grade do painel, presa no
                alto da direita. O rotulo fica na altura de
                "Prioridade" e as fotos na altura das pastilhas.
                Dentro da fila dos filtros ele caia para a linha de
                baixo — ali sobrava sempre um pouco menos do que ele
                precisava. */}
            <div className="filtro filtro--membros">
              <span className="filtro__nome">Membros</span>
              <button
                type="button"
                className="equipe"
                onClick={() => setModalMembros(true)}
                title="Ver em que obra cada um está"
                disabled={participantes.length === 0}
              >
                {participantes.length === 0 ? (
                  <span className="equipe__vazio">ninguém ainda</span>
                ) : (
                  <>
                    <span className="equipe__avatares">
                      {participantes.slice(0, 5).map((p) => (
                        <Avatar
                          key={p.id}
                          nome={p.nome}
                          foto={p.foto}
                          tamanho={30}
                          titulo={p.nome}
                        />
                      ))}
                    </span>
                    {participantes.length > 5 && (
                      <span className="equipe__resto">+{participantes.length - 5}</span>
                    )}
                  </>
                )}
              </button>
            </div>
        </div>

        {/* ---------------- barra de acoes ---------------- */}
        <div className="barra">
          <p className="barra__total">
            <strong>{visiveis.length}</strong> Obras
          </p>

          {podeCriarObra && (
            <>
              <button
                type="button"
                className="acao acao--padrao"
                onClick={() => setModalObra('padrao')}
              >
                <Mais />
                Adicionar obra padrão
              </button>
              <button
                type="button"
                className="acao acao--emergencia"
                onClick={() => setModalObra('emergencia')}
              >
                <Mais />
                Adicionar obra emergência
              </button>
            </>
          )}

          <div className="barra__direita">
            <label className="procura">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar proposta, obra ou empresa..."
                aria-label="Buscar obra ou empresa"
              />
            </label>

            {filtrosAtivos > 0 && (
              <button type="button" className="ferramenta ferramenta--fraca" onClick={limparFiltros}>
                Limpar {filtrosAtivos} filtro{filtrosAtivos > 1 ? 's' : ''}
              </button>
            )}

            {/* largura fixa: "Data de conclusão" e a opcao mais longa, e
                sem espaco para ela o botao cortava o proprio rotulo com
                reticencias — a pessoa lia "Data de conclu..." e nao
                sabia por que a lista estava naquela ordem */}
            <div className="barra__ordem">
              <Seletor
                valor={ordem}
                aoMudar={setOrdem}
                aria-label="Ordenar por"
                opcoes={ORDENACOES.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
              />
            </div>
          </div>
        </div>

        {recado && (
          <p className="recado" role="status">
            {recado}
            <button type="button" onClick={() => setRecado('')} aria-label="Fechar aviso">
              ×
            </button>
          </p>
        )}

        {/* ---------------- quadro + observacoes ----------------
            As tres colunas a esquerda, o painel de observacoes a
            direita — o mesmo desenho da tela de dentro da obra. */}
        <div className="areaquadro">
          <div className="quadro">
          <Coluna
            titulo="Obras padrão"
            tom="padrao"
            total={padrao.length}
            aoAdicionar={podeCriarObra ? () => setModalObra('padrao') : undefined}
            vazio="Nenhuma obra padrão por aqui."
          >
            {porEtapa(padrao).map((grupo) => (
              <GrupoEtapa key={grupo.numero} grupo={grupo}>
                {grupo.obras.map((obra) => (
                  <CardObra
                    key={obra.id}
                    obra={obra}
                    cliente={clientePorId(obra.clienteId)}
                    pessoas={pessoasDa(obra)}
                    /* os checks do seu setor vem dentro do card nas duas
                       colunas de obra; na de aviso nao, porque la o card
                       inteiro dispara a cobranca */
                    comChecks
                    aoAvisarEtapa={setAvisoEtapa}
                    aoAbrir={() => navigate(`/app/obras/${obra.id}`)}
                  />
                ))}
              </GrupoEtapa>
            ))}
          </Coluna>

          <Coluna
            titulo="Obras emergência"
            tom="emergencia"
            total={emergencia.length}
            aoAdicionar={podeCriarObra ? () => setModalObra('emergencia') : undefined}
            vazio="Nenhuma emergência aberta."
          >
            {porEtapa(emergencia).map((grupo) => (
              <GrupoEtapa key={grupo.numero} grupo={grupo}>
                {grupo.obras.map((obra) => (
                  <CardObra
                    key={obra.id}
                    obra={obra}
                    cliente={clientePorId(obra.clienteId)}
                    pessoas={pessoasDa(obra)}
                    /* os checks do seu setor vem dentro do card nas duas
                       colunas de obra; na de aviso nao, porque la o card
                       inteiro dispara a cobranca */
                    comChecks
                    aoAvisarEtapa={setAvisoEtapa}
                    aoAbrir={() => navigate(`/app/obras/${obra.id}`)}
                  />
                ))}
              </GrupoEtapa>
            ))}
          </Coluna>

          {/* o card inteiro dispara o aviso; o botao Todos fica no topo */}
          <Coluna
            titulo="Enviar aviso"
            tom="aviso"
            total={pendentes.length}
            vazio="Ninguém está devendo informação agora."
            acaoTopo={
              podeAvisar &&
              pendentes.length > 0 && (
                <button type="button" className="coluna__todos" onClick={avisarTodas}>
                  <Sino />
                  Todos
                </button>
              )
            }
          >
            {pendentes.map((obra) => {
              const faltando = pendentesDaObra(obra)
              const nomes = faltando.map((s) => cargoPorChave(s)?.nome ?? s).join(', ')
              return (
                <CardObra
                  key={obra.id}
                  obra={obra}
                  cliente={clientePorId(obra.clienteId)}
                  pessoas={pessoasDa(obra)}
                  /* o aviso herda a cor do tipo da obra e vai virando
                     amarelo — e o data-tom que o CSS usa para o gradiente */
                  tom={`aviso-${obra.tipo}`}
                  aoAbrir={podeAvisar ? () => avisarObra(obra) : undefined}
                  rotuloAcao={podeAvisar ? `Avisar ${nomes}` : undefined}
                >
                  <span className="avisar__dica">
                    <Sino />
                    {podeAvisar ? `Clique para avisar ${nomes}` : `Falta ${nomes}`}
                  </span>
                </CardObra>
              )
            })}
          </Coluna>
          </div>

          {/* ---------------- observacoes do quadro ----------------
              Valem para o quadro inteiro, nao para uma obra: e o
              bloco de recados da equipe sobre as obras em geral.
              Fica a direita da coluna de aviso. */}
          <aside className="quadroobs">
            <header className="quadroobs__topo">
              <h2 className="quadroobs__titulo">Observações</h2>
              <span className="quadroobs__contagem">{observacoesQuadro.length}</span>
              {/* O historico e o lugar da observacao que TINHA duracao e
                  venceu: ela sai do painel sozinha, mas nao e apagada.
                  Sem esta porta, o unico jeito de chegar la era abrir o
                  pop-up por outro motivo e reparar na aba.

                  O botao fica no lugar mesmo com o historico vazio —
                  cabecalho que muda de forma e cabecalho que ninguem
                  aprende. Vazio, ele abre a aba que explica em uma linha
                  o que entra ali.

                  So existe para as observacoes do QUADRO: as de dentro
                  de uma obra nao tem duracao, entao nunca vencem e nao
                  tem historico para abrir. */}
              <button
                type="button"
                className={`quadroobs__historico ${
                  historicoObservacoes.length > 0 ? 'is-contando' : ''
                }`.trim()}
                onClick={() => setModalObs('historico')}
                title="Histórico de observações"
                aria-label={
                  historicoObservacoes.length === 0
                    ? 'Histórico de observações'
                    : historicoObservacoes.length === 1
                      ? 'Histórico: 1 observação vencida'
                      : `Histórico: ${historicoObservacoes.length} observações vencidas`
                }
              >
                <Historico />
                {historicoObservacoes.length > 0 && <em>{historicoObservacoes.length}</em>}
              </button>
              <button
                type="button"
                className="quadroobs__mais"
                onClick={() => setModalObs('atuais')}
                title="Nova observação"
                aria-label="Nova observação"
              >
                <Mais />
              </button>
            </header>

            {observacoesQuadro.length === 0 ? (
              <p className="quadroobs__vazio">
                Nada registrado ainda. Use o + para escrever a primeira.
              </p>
            ) : (
              <ul className="quadroobs__lista">
                {observacoesQuadro.slice(0, 6).map((o) => (
                  <li key={o.id} className="quadroobs__item">
                    <Avatar nome={o.autorNome} foto={pessoaPorId(o.autorId)?.foto} tamanho={28} />
                    <div>
                      <p className="quadroobs__quem">
                        <strong>{o.autorNome}</strong>
                        <span>{dataHora(o.enviadaEm)}</span>
                      </p>
                      <p className="quadroobs__texto">{o.texto}</p>
                    </div>
                  </li>
                ))}
                {observacoesQuadro.length > 6 && (
                  <li>
                    <button
                      type="button"
                      className="quadroobs__ver"
                      onClick={() => setModalObs('atuais')}
                    >
                      Ver as {observacoesQuadro.length} observações
                    </button>
                  </li>
                )}
              </ul>
            )}
          </aside>
        </div>
      </section>

      <ModalFechaEtapa aviso={avisoEtapa} aoFechar={() => setAvisoEtapa(null)} />

      <ModalObra
        aberto={modalObra !== null}
        tipo={modalObra ?? 'padrao'}
        clientes={clientes}
        aoFechar={() => setModalObra(null)}
        aoSalvar={(campos) => adicionarObra(campos)}
      />

      <ModalSetores
        aberto={modalSetores}
        aoFechar={() => setModalSetores(false)}
        obras={visiveis}
        selecionados={setores}
        aoFiltrar={alternarSetor}
      />

      <ModalMembros
        aberto={modalMembros}
        aoFechar={() => setModalMembros(false)}
        pessoas={participantes}
      />

      <ModalObservacoes
        aberto={modalObs !== null}
        abaInicial={modalObs ?? 'atuais'}
        aoFechar={() => setModalObs(null)}
        autor={user}
      />
    </AppShell>
  )
}

/** Coluna do quadro: titulo, contador, acao e a pilha de cards. */
function Coluna({ titulo, tom, total, aoAdicionar, acaoTopo, vazio, children }) {
  return (
    <section className="coluna">
      <header className="coluna__topo">
        <span className="coluna__titulo" data-tom={tom}>
          {titulo}
        </span>
        <span className="coluna__contador">{total}</span>
        {acaoTopo}
        {aoAdicionar && (
          <button
            type="button"
            className="coluna__mais"
            onClick={aoAdicionar}
            title="Adicionar"
            aria-label="Adicionar"
          >
            <Mais />
          </button>
        )}
      </header>

      <div className="coluna__pilha">
        {total === 0 ? <p className="coluna__vazio">{vazio}</p> : children}
      </div>
    </section>
  )
}

/**
 * Um degrau da coluna: "2ª Etapa — Técnico", e embaixo as obras que
 * estao nela.
 *
 * O numero da etapa vem numa pastilha, o nome dela ao lado e a
 * contagem na ponta — a mesma leitura do cabecalho da coluna, um
 * degrau abaixo.
 */
function GrupoEtapa({ grupo, children }) {
  return (
    <section className="etapagrupo">
      <h3 className="etapagrupo__topo">
        <span className="etapagrupo__numero">{grupo.rotulo}</span>
        {grupo.nome && <span className="etapagrupo__nome">{grupo.nome}</span>}
        <span className="etapagrupo__conta">{grupo.obras.length}</span>
      </h3>

      <div className="etapagrupo__pilha">{children}</div>
    </section>
  )
}
