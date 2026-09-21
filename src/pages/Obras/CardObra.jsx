import { useMemo } from 'react'
import Avatar, { PilhaAvatares } from '@/components/Avatar/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useDados } from '@/context/DadosContext'
import {
  avisoDeEtapa,
  cargosDoCheck,
  nomeProprioDaEtapa,
  chaveDoCargo,
  obraConcluida,
  podeEditarCheck,
  rotuloPrioridadeObra,
  tituloDaObra,
  tomPrioridadeObra,
} from '@/domain/obras'
import { useTheme } from '@/context/ThemeContext'
import { corAdaptada, textoSobre } from '@/utils/cor'
import { dataBR, dataHora } from '@/utils/formato'
import './CardObra.css'

/**
 * Card da obra no quadro. A cor de fundo vem do tipo (padrao = azul de
 * "Obras padrao", emergencia = laranja/vermelho, aviso = amarelo); as
 * etiquetas de setor puxam a cor do cargo cadastrado.
 *
 *   foto da empresa · proposta - nome · etapa atual   [téc] [gq]
 *   descricao
 *   prioridade + data de conclusao        fotos de quem mexeu
 *
 * O titulo e "1042/2026 - Acme": o n. da proposta na frente, porque e
 * por ele que a obra e procurada. Obra antiga, sem proposta cadastrada,
 * mostra so o nome do cliente.
 *
 * Com `aoAbrir` o card inteiro vira botao — e assim que a coluna de
 * avisos dispara o aviso clicando em qualquer lugar.
 */
export default function CardObra({
  obra,
  cliente,
  pessoas = [],
  tom,
  aoAbrir,
  rotuloAcao,
  comChecks = false,
  aoAvisarEtapa,
  children,
}) {
  const {
    cargoPorChave,
    roteiroDaObra,
    etapaDaObra,
    pendentesDaObra,
    concluida,
    etiquetasDaObra,
    termoEtapa,
    nomeDoCargo,
    alternarCheck,
  } = useDados()
  const { user } = useAuth()
  const { isDark } = useTheme()

  const numeroEtapa = etapaDaObra(obra)
  /* o roteiro desta obra, nao o de agora: obra antiga desenha a etapa
     que ela realmente tem */
  const roteiro = roteiroDaObra(obra)
  const etapa = roteiro.find((e) => e.numero === numeroEtapa)
  /* "3ª Etapa" — o rotulo automatico, com a palavra que a empresa
     escolheu. E com ele que o nome da etapa e comparado. */
  const rotuloDaEtapa = `${numeroEtapa}ª ${termoEtapa}`

  /* ---- "Concluído em" ----

     Quando o ULTIMO check da obra e marcado, o trabalho acabou — mesmo
     que ninguem tenha clicado em "Concluir obra" ainda. O card diz
     quando isso aconteceu, e a hora e a da ultima marcacao: e ela que
     responde "quando ficou pronto".

     Nao e a mesma coisa que `obra.concluidaEm`, que e o carimbo do
     clique. Enquanto o clique nao vem, a obra continua no quadro — e e
     exatamente ai que este aviso serve, porque e o que faz alguem
     lembrar de fechar. */
  const tudoMarcado = obraConcluida(roteiro, obra.checks)
  const prontaEm = tudoMarcado
    ? Object.values(obra.checks ?? {})
        .map((m) => m?.feitoEm)
        .filter(Boolean)
        .sort()
        .at(-1)
    : null
  const marcas = etiquetasDaObra(obra)
  const pendentes = pendentesDaObra(obra, numeroEtapa)
  const fechada = concluida(obra)
  const cor = tom ?? obra.tipo

  /* ---- O (!) de "falta a data de conclusao" ----

     As mesmas tres condicoes da tela da obra, e pelos mesmos motivos:
     na EMERGENCIA a data e obrigatoria no cadastro, entao ali ela nao
     pode faltar; na obra ja CONCLUIDA o prazo daquela ja passou, e
     piscar sobre registro fechado e ruido. */
  const faltaPrazo = !obra.dataConclusao && !fechada && obra.tipo !== 'emergencia'

  /* ---- Os checks da etapa, aqui mesmo ----

     Todos os setores da etapa em que a obra parou, agrupados por
     setor. Os do SEU cargo sao marcaveis daqui; os dos outros
     aparecem travados, com cadeado.

     Mostrar so os seus escondia o essencial: quem esta segurando a
     etapa. Mostrar os das outras etapas encheria o card com trabalho
     que nem comecou. Entao e a etapa atual, inteira.

     Quem decide se da para clicar e `podeEditarCheck` — a mesma
     resposta que o servidor da antes de gravar. */
  const meuSetor = chaveDoCargo(user)

  const grupos = useMemo(() => {
    if (!comChecks || fechada || !etapa) return []

    const porSetor = new Map()

    ;(etapa.cards ?? []).forEach((card) => {
      ;(card.checks ?? []).forEach((check) => {
        const donos = cargosDoCheck(check, card)
        /* check sem dono nenhum no roteiro fica com o card; sem nem
           isso, ele nao pertence a setor algum e nao entra */
        if (donos.length === 0) return
        donos.forEach((cargo) => {
          if (!porSetor.has(cargo)) porSetor.set(cargo, [])
          porSetor.get(cargo).push({ check, card })
        })
      })
    })

    return [...porSetor.entries()]
      .map(([cargo, itens]) => ({
        cargo,
        itens,
        meu: cargo === meuSetor,
        feitos: itens.filter(({ check }) => obra.checks?.[check.id]).length,
      }))
      /* o seu setor na frente: e o unico bloco em que ha o que fazer */
      .sort((a, b) => Number(b.meu) - Number(a.meu))
  }, [comChecks, fechada, etapa, meuSetor, obra.checks])

  /* Com checks dentro, o card NAO pode ser um <button>: botao dentro
     de botao e HTML invalido, e o clique no check subiria para o card
     e abriria a obra no lugar de marcar. Vira uma <div> que responde
     ao clique, e o nome da obra assume o caminho de teclado — o mesmo
     arranjo das linhas da Grade da pagina inicial. */
  /* a cor do cargo pronta para FUNDO ESCURO, sempre — e nao a do tema
     da tela. O card e azul-marinho ou laranja nos dois temas, entao um
     setor de cor escura (o azul da GQ) precisa clarear ali mesmo no
     tema claro, senao a caixinha some dentro do card. */
  const corDeSetor = (chave) => corAdaptada(cargoPorChave(chave)?.cor ?? '#6b7280', true)

  /* ---- O recado de fechamento de etapa ----

     A conta e feita ANTES de gravar, com o mapa de checks que a tela
     tem agora: depois da gravacao o `recarregar` ja trouxe o estado
     novo, e nao daria mais para saber se ESTE clique foi o que fechou
     a sua parte. Desmarcar nunca anuncia nada.

     Quem GUARDA o aviso e a pagina, nao este card. Quando a etapa
     fecha, a obra muda de grupo no quadro e o card e remontado do
     zero — e o aviso morria junto, justamente no caso que ele mais
     precisa contar. */
  const marcar = (checkId, jaMarcado) => {
    if (!jaMarcado) {
      const novo = avisoDeEtapa(roteiro, obra.checks, checkId, meuSetor)
      if (novo) aoAvisarEtapa?.(novo)
    }
    alternarCheck(obra.id, checkId)
  }

  const temChecks = grupos.length > 0
  const Elemento = aoAbrir && !temChecks ? 'button' : 'div'

  return (
    <Elemento
      type={aoAbrir ? 'button' : undefined}
      className={`obracard ${aoAbrir ? 'obracard--clicavel' : ''}`.trim()}
      data-tom={cor}
      onClick={aoAbrir}
      title={rotuloAcao}
    >
      <header className="obracard__topo">
        <Avatar nome={cliente?.nome} foto={cliente?.logo} tamanho={26} quadrado />
        <span className="obracard__quem">
          {temChecks && aoAbrir ? (
            <button
              type="button"
              className="obracard__empresa obracard__abrir"
              onClick={(e) => {
                e.stopPropagation()
                aoAbrir()
              }}
              title={rotuloAcao ?? 'Abrir a obra'}
            >
              {tituloDaObra(obra, cliente)}
            </button>
          ) : (
            <strong className="obracard__empresa">{tituloDaObra(obra, cliente)}</strong>
          )}
          {/* "3ª — comercial". O nome so entra quando acrescenta: uma
              etapa chamada "3° Etapa" no roteiro daria "3ª — 3° etapa" */}
          <span className="obracard__etapa">
            {termoEtapa} atual:{' '}
            {fechada || !etapa
              ? 'concluída'
              : [`${etapa.numero}ª`, nomeProprioDaEtapa(etapa.nome, rotuloDaEtapa).toLowerCase()]
                  .filter(Boolean)
                  .join(' — ')}
          </span>
        </span>

        {pendentes.length > 0 && (
          <span className="obracard__setores" title="Setores que ainda devem informação">
            {pendentes.map((s) => {
              const cargo = cargoPorChave(s)
              return (
                <span
                  key={s}
                  className="obracard__setor"
                  style={{ '--setor-cor': cargo?.cor ?? '#6b7280' }}
                >
                  {cargo?.curto ?? s.slice(0, 3)}
                </span>
              )
            })}
          </span>
        )}
      </header>

      {/* a descricao e opcional: sem ela o card nao abre um vazio no meio */}
      {obra.descricao && <p className="obracard__desc">{obra.descricao}</p>}

      {marcas.length > 0 && (
        <span className="obracard__etiquetas">
          {marcas.map((e) => (
            <span
              key={e.id}
              className="obracard__etiqueta"
              style={{ background: e.cor, color: textoSobre(e.cor, isDark) }}
            >
              {e.nome}
            </span>
          ))}
        </span>
      )}

      <footer className="obracard__base">
        <span className="obracard__meta">
          {/* a cor vem do data-pri, e e a mesma em toda tela que fala de
              prioridade: vermelho alta, amarelo media, verde baixa */}
          <span className="obracard__pri" data-pri={tomPrioridadeObra(obra)}>
            Prioridade: <strong>{rotuloPrioridadeObra(obra)}</strong>
          </span>

          {/* As duas pontas do prazo, uma ao lado da outra. So a data de
              conclusao aparecia aqui, e sozinha ela nao diz nada: "30/09"
              e um prazo apertado ou folgado conforme a obra tenha
              comecado ontem ou em marco.

              A conclusao aparece SEMPRE, mesmo em branco. Antes ela
              sumia quando faltava, e o card sem prazo ficava igual ao
              card cujo prazo ninguem tinha olhado — a falta nao se via
              de lugar nenhum, so entrando na obra. */}
          <span className="obracard__datas">
            {obra.dataInicio && (
              <span className="obracard__data">
                início: <strong>{dataBR(obra.dataInicio)}</strong>
              </span>
            )}

            {obra.dataConclusao ? (
              <span className="obracard__data">
                conclusão: <strong>{dataBR(obra.dataConclusao)}</strong>
              </span>
            ) : (
              <span className="obracard__data obracard__semprazo">
                conclusão: <strong>sem data</strong>
                {/* o mesmo (!) da tela da obra — mesma classe, mesma
                    piscada. Aqui ele nao e botao: o card inteiro ja
                    abre a obra, que e onde a data se preenche, e um
                    botao dentro do card disputaria esse clique. */}
                {faltaPrazo && (
                  <span
                    className="pendencia pendencia--parada"
                    title="Esta obra está sem data de conclusão. Abra a obra para preencher."
                    aria-label="Pendente: obra sem data de conclusão"
                  >
                    !
                  </span>
                )}
              </span>
            )}
          </span>
        </span>

        <span className="obracard__fim">
          {/* embaixo dos avatares, no canto: o carimbo de que não sobrou
              check nenhum nesta obra */}
          {pessoas.length > 0 && <PilhaAvatares pessoas={pessoas} tamanho={24} limite={3} />}
          {prontaEm && (
            <span className="obracard__pronta">
              Concluído em: <strong>{dataHora(prontaEm)}</strong>
            </span>
          )}
        </span>
      </footer>

      {temChecks && (
        <div className="obracard__meus">
          {grupos.map((g) => (
            /* Cada setor num bloco, e o bloco inteiro corre na cor do
               cargo: o ponto, o nome e o contorno das caixinhas. E o
               que responde "de quem e este pedaco" antes de a pessoa
               ler uma palavra. */
            <section
              key={g.cargo}
              className="obracard__setorgrupo"
              data-meu={g.meu ? 'sim' : undefined}
              style={{ '--check-cor': corDeSetor(g.cargo) }}
            >
              <p className="obracard__meustopo">
                <span className="obracard__meucargo">
                  {!g.meu && <Cadeado />}
                  {nomeDoCargo(g.cargo)}
                </span>
                <em>
                  {g.feitos} de {g.itens.length}
                </em>
              </p>

              <ul className="obracard__checks">
                {g.itens.map(({ check, card }) => {
                  const marcado = Boolean(obra.checks?.[check.id])
                  const posso = podeEditarCheck(user, check, card, obra)
                  return (
                    <li key={`${g.cargo}-${check.id}`}>
                      <button
                        type="button"
                        className="obracard__check"
                        data-feito={marcado ? 'sim' : undefined}
                        disabled={!posso}
                        aria-pressed={marcado}
                        title={
                          posso
                            ? marcado
                              ? 'Desmarcar'
                              : 'Marcar como feito'
                            : `Este check é do setor ${nomeDoCargo(g.cargo)}`
                        }
                        /* o clique para AQUI: sem isso ele sobe para o card
                           e abre a obra, que e o contrario do que o botao
                           existe para fazer */
                        onClick={(e) => {
                          e.stopPropagation()
                          marcar(check.id, marcado)
                        }}
                      >
                        <span className="obracard__caixa" aria-hidden="true">
                          <Risco />
                        </span>
                        {check.titulo}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {children}
    </Elemento>
  )
}

/** O cadeado do setor que nao e o seu. */
const Cadeado = () => (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
  </svg>
)

/** O tique de dentro da caixinha. */
const Risco = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
)
