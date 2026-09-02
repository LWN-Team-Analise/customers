import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Confirma from '@/components/Confirma/Confirma'
import { useDados } from '@/context/DadosContext'
import { tituloDaObra } from '@/domain/obras'
import { dataBR, dataHora } from '@/utils/formato'
import './Concluidas.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/* a grade do calendario mostra os doze o ano inteiro, entao o nome curto */
const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const SetaEsq = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 6-6 6 6 6" />
  </svg>
)

const SetaDir = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

const Lixo = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </svg>
)

/* os dois tipos de obra, na ordem em que se leem no quadro */
const GRUPOS = [
  { id: 'padrao', rotulo: 'Obras padrão' },
  { id: 'emergencia', rotulo: 'Obras emergência' },
]

/**
 * Quando a obra fechou. Vale o carimbo do banco (obra.concluida_em, a
 * hora em que alguem clicou em "Concluir obra"); sem ele, cai na data de
 * conclusao e, em ultimo caso, na de criacao — assim nenhuma fica fora
 * do agrupamento.
 */
function quandoFechou(obra) {
  const iso = obra.concluidaEm ?? obra.dataConclusao ?? obra.criadoEm
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export default function Concluidas() {
  const { obras, clientePorId, pessoaPorId, concluida, removerObra, pode } = useDados()
  const navigate = useNavigate()

  const [ano, setAno] = useState(null)
  const [mesAberto, setMesAberto] = useState(null)
  /* a obra que esta esperando confirmacao de exclusao */
  const [apagando, setApagando] = useState(null)

  /**
   * Apagar obra concluida tem permissao PROPRIA.
   *
   * Nao e a mesma coisa que "editar obras": aqui nao se mexe em trabalho
   * em andamento, apaga-se o REGISTRO do que a empresa entregou — com o
   * chat, os anexos, a rastreabilidade e as avaliacoes junto. Quem toca
   * o quadro no dia a dia nao precisa disso; quem precisa, recebe a
   * permissao marcada no setor. Sem ela o botao nem aparece, e a API
   * recusa do mesmo jeito.
   */
  const podeExcluir = pode('excluir_concluidas')

  /* agrupa as concluidas por ano e, dentro dele, por mes */
  const { anos, porAno } = useMemo(() => {
    const mapa = {}
    obras.filter(concluida).forEach((obra) => {
      const d = quandoFechou(obra)
      const a = d.getFullYear()
      const m = d.getMonth()
      mapa[a] ??= {}
      mapa[a][m] ??= []
      mapa[a][m].push(obra)
    })
    return {
      anos: Object.keys(mapa).map(Number).sort((x, y) => y - x),
      porAno: mapa,
    }
  }, [obras, concluida])

  const anoAtual = ano ?? anos[0] ?? new Date().getFullYear()
  const meses = porAno[anoAtual] ?? {}

  /* `anos` esta do mais novo para o mais antigo, entao andar +1 na lista e
     ir para TRAS no tempo — dai o sinal invertido aqui dentro. */
  const indiceDoAno = Math.max(0, anos.indexOf(anoAtual))
  const quantasNoAno = Object.values(meses).reduce((n, l) => n + l.length, 0)

  const trocarAno = (passo) => {
    const destino = anos[indiceDoAno - passo]
    if (destino === undefined) return
    setAno(destino)
    setMesAberto(null)
  }

  const total = obras.filter(concluida).length

  return (
    <AppShell>
      <section className="concluidas">
        <header className="concluidas__topo">
          <h1 className="tela__titulo">Concluídas</h1>
          <span className="concluidas__total">
            {total} obra{total === 1 ? '' : 's'}
          </span>
        </header>

        {anos.length === 0 ? (
          <p className="concluidas__vazio">Nenhuma obra concluída</p>
        ) : (
          <>
            {/* ---------------- Ano ----------------

                Uma seta de cada lado e o ano no meio, como num calendario de
                parede. Antes era uma fila de botoes: com dois anos ela ficava
                perdida na esquerda, e com oito nao caberia.

                As setas andam pelos anos QUE TEM OBRA, e nao de um em um: um
                ano vazio nao tem o que mostrar, e passar por ele so faria a
                pessoa clicar duas vezes. */}
            <div className="anos">
              <button
                type="button"
                className="anos__seta"
                onClick={() => trocarAno(-1)}
                disabled={indiceDoAno >= anos.length - 1}
                aria-label="Ano anterior"
                title="Ano anterior"
              >
                <SetaEsq />
              </button>

              <span className="anos__atual">
                <strong>{anoAtual}</strong>
                <span>
                  {quantasNoAno} obra{quantasNoAno === 1 ? '' : 's'}
                </span>
              </span>

              <button
                type="button"
                className="anos__seta"
                onClick={() => trocarAno(1)}
                disabled={indiceDoAno <= 0}
                aria-label="Próximo ano"
                title="Próximo ano"
              >
                <SetaDir />
              </button>
            </div>
            {/* ---------------- calendario: os doze meses do ano ----------------

                Os doze aparecem sempre, e nao so os que tem obra: e assim que
                se le um calendario, e o mes vazio tambem informa — foi um mes
                em que nada fechou. O mes sem obra nao abre.  */}
            <div className="calendario">
              {MESES_CURTOS.map((nome, m) => {
                const doMes = meses[m] ?? []
                const aberto = mesAberto === m
                const vazio = doMes.length === 0
                const emergencias = doMes.filter((o) => o.tipo === "emergencia").length
                return (
                  <button
                    key={nome}
                    type="button"
                    className={`calmes ${aberto ? "is-atual" : ""} ${vazio ? "is-vazio" : ""}`.trim()}
                    onClick={() => setMesAberto(aberto ? null : m)}
                    disabled={vazio}
                    aria-pressed={aberto}
                    title={vazio ? `Nenhuma obra fechou em ${MESES[m]}` : `${doMes.length} obra(s) em ${MESES[m]}`}
                  >
                    <span className="calmes__nome">{nome}</span>
                    <span className="calmes__quantas">{doMes.length}</span>
                    {emergencias > 0 && (
                      <span className="calmes__emerg" title={`${emergencias} emergência(s)`}>
                        {emergencias}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ---------------- o mes escolhido, aberto ---------------- */}
            {mesAberto !== null && meses[mesAberto]?.length > 0 && (
              <section className="mesaberto">
                <header className="mesaberto__topo">
                  <h2 className="mesaberto__titulo">
                    {MESES[mesAberto]} de {anoAtual}
                  </h2>
                  <span className="mesaberto__resumo">
                    {(() => {
                      const doMes = meses[mesAberto]
                      const avaliadas = doMes.filter((o) => o.avaliacao)
                      const media =
                        avaliadas.length > 0
                          ? avaliadas.reduce((sm, o) => sm + Number(o.avaliacao.nota), 0) /
                            avaliadas.length
                          : null
                      return media === null
                        ? "sem avaliação"
                        : `nota média ${media.toFixed(1)}`
                    })()}
                  </span>
                </header>

                {/* Padrao e emergencia em blocos separados: sao dois tipos de
                    trabalho diferentes, e misturados na mesma lista a conta de
                    emergencias do mes se perde. */}
                {GRUPOS.map((grupo) => {
                  const doGrupo = meses[mesAberto].filter((o) => o.tipo === grupo.id)
                  if (doGrupo.length === 0) return null
                  return (
                    <div key={grupo.id} className="grupo" data-tipo={grupo.id}>
                      <h3 className="grupo__titulo">
                        {grupo.rotulo}
                        <span className="grupo__quantas">{doGrupo.length}</span>
                      </h3>

                      <ul className="mes__obras">
                        {doGrupo.map((obra) => {
                          const cliente = clientePorId(obra.clienteId)
                          const pessoas = obra.membros.map(pessoaPorId).filter(Boolean)
                          return (
                            <li key={obra.id} className="fechada__linha">
                              <button
                                type="button"
                                className="fechada"
                                data-tipo={obra.tipo}
                                onClick={() => navigate(`/app/concluidas/${obra.id}`)}
                                title="Abrir a obra com a rastreabilidade completa"
                              >
                                <Avatar
                                  nome={cliente?.nome}
                                  foto={cliente?.logo}
                                  tamanho={32}
                                  quadrado
                                />
                                <span className="fechada__quem">
                                  {/* "1042/2026 - Acme", igual ao card do quadro */}
                                  <strong>{tituloDaObra(obra, cliente)}</strong>
                                  <span>
                                    {obra.descricao || (
                                      <em className="fechada__semdesc">sem descrição</em>
                                    )}
                                  </span>
                                </span>

                                <span className="fechada__data">
                                  {dataBR(quandoFechou(obra).toISOString().slice(0, 10))}
                                  {obra.concluidaPorNome && (
                                    <em>por {obra.concluidaPorNome}</em>
                                  )}
                                </span>

                                <span className="fechada__nota">
                                  {obra.avaliacao ? (
                                    Number(obra.avaliacao.nota).toFixed(1)
                                  ) : (
                                    <em>—</em>
                                  )}
                                </span>

                                <span className="fechada__avatares">
                                  {pessoas.slice(0, 3).map((pe) => (
                                    <Avatar key={pe.id} nome={pe.nome} foto={pe.foto} tamanho={22} />
                                  ))}
                                </span>
                              </button>

                              {/* fora do botão de abrir, e não dentro: um
                                  clique no lixo não pode virar um clique
                                  em "abrir a obra" por um pixel de erro */}
                              {podeExcluir && (
                                <button
                                  type="button"
                                  className="fechada__apagar"
                                  onClick={() => setApagando(obra)}
                                  title="Excluir esta obra"
                                  aria-label={`Excluir a obra ${tituloDaObra(obra, cliente)}`}
                                >
                                  <Lixo />
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </section>
            )}
          </>
        )}
      </section>

      {/* Excluir obra concluída apaga o registro inteiro dela — e por isso
          a confirmação lista o que vai junto. Não há desfazer. */}
      <Confirma
        aberto={Boolean(apagando)}
        titulo="Excluir esta obra concluída?"
        mensagem="Ela sai da lista de concluídas e não dá para recuperar."
        detalhes={
          apagando && (
            <dl>
              <dt>Obra</dt>
              <dd>{tituloDaObra(apagando, clientePorId(apagando.clienteId))}</dd>

              <dt>Concluída em</dt>
              <dd>{dataHora(apagando.concluidaEm) || '—'}</dd>

              <dt>Concluída por</dt>
              <dd>{apagando.concluidaPorNome ?? '—'}</dd>
            </dl>
          )
        }
        aviso="Vão junto a rastreabilidade dos checks, o chat, as observações, as etiquetas, os anexos e as avaliações desta obra."
        rotuloConfirmar="Excluir obra"
        aoConfirmar={() => removerObra(apagando.id)}
        aoFechar={() => setApagando(null)}
      />
    </AppShell>
  )
}
