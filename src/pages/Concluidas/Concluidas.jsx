import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { dataBR } from '@/utils/formato'
import './Concluidas.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const Seta = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

/**
 * Quando a obra fechou. Vale o carimbo do banco (view obra_conclusao:
 * o horario do ultimo check marcado); sem ele, cai na data de conclusao e,
 * em ultimo caso, na de criacao — assim nenhuma fica fora do
 * agrupamento.
 */
function quandoFechou(obra) {
  const iso = obra.concluidaEm ?? obra.dataConclusao ?? obra.criadoEm
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export default function Concluidas() {
  const { obras, clientePorId, pessoaPorId, concluida } = useDados()
  const navigate = useNavigate()

  const [ano, setAno] = useState(null)
  const [mesAberto, setMesAberto] = useState(null)

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
  /* so os meses que tem obra, do mais recente para o mais antigo */
  const mesesComObra = Object.keys(meses).map(Number).sort((x, y) => y - x)

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
            {/* ano no topo */}
            <div className="anos">
              {anos.map((a) => {
                const quantas = Object.values(porAno[a]).reduce((n, l) => n + l.length, 0)
                return (
                  <button
                    key={a}
                    type="button"
                    className={`ano ${a === anoAtual ? 'is-atual' : ''}`.trim()}
                    onClick={() => {
                      setAno(a)
                      setMesAberto(null)
                    }}
                  >
                    <strong>{a}</strong>
                    <span>
                      {quantas} obra{quantas === 1 ? '' : 's'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* meses do ano escolhido, cada um ocupando a linha inteira */}
            <div className="meses">
              {mesesComObra.map((m) => {
                const doMes = meses[m]
                const aberto = mesAberto === m
                const emergencias = doMes.filter((o) => o.tipo === 'emergencia').length
                const avaliadas = doMes.filter((o) => o.avaliacao)
                const media =
                  avaliadas.length > 0
                    ? avaliadas.reduce((s, o) => s + Number(o.avaliacao.nota), 0) / avaliadas.length
                    : null

                return (
                  <section key={m} className={`mes ${aberto ? 'is-aberto' : ''}`.trim()}>
                    <button
                      type="button"
                      className="mes__cabeca"
                      onClick={() => setMesAberto(aberto ? null : m)}
                      aria-expanded={aberto}
                    >
                      <span className="mes__seta">
                        <Seta />
                      </span>

                      <span className="mes__nome">{MESES[m]}</span>

                      <span className="mes__info">
                        <span className="mes__dado">
                          <strong>{doMes.length}</strong> concluída{doMes.length === 1 ? '' : 's'}
                        </span>
                        {emergencias > 0 && (
                          <span className="mes__dado mes__dado--emerg">
                            <strong>{emergencias}</strong> emergência{emergencias === 1 ? '' : 's'}
                          </span>
                        )}
                        <span className="mes__dado">
                          {media === null ? (
                            <em>sem avaliação</em>
                          ) : (
                            <>
                              nota média <strong>{media.toFixed(1)}</strong>
                            </>
                          )}
                        </span>
                      </span>
                    </button>

                    {aberto && (
                      <ul className="mes__obras">
                        {doMes.map((obra) => {
                          const cliente = clientePorId(obra.clienteId)
                          const pessoas = obra.membros.map(pessoaPorId).filter(Boolean)
                          return (
                            <li key={obra.id}>
                              <button
                                type="button"
                                className="fechada"
                                data-tipo={obra.tipo}
                                onClick={() => navigate(`/app/obras/${obra.id}`)}
                              >
                                <Avatar
                                  nome={cliente?.nome}
                                  foto={cliente?.logo}
                                  tamanho={32}
                                  quadrado
                                />
                                <span className="fechada__quem">
                                  <strong>{cliente?.nome ?? 'Cliente removido'}</strong>
                                  <span>{obra.descricao}</span>
                                </span>

                                <span className="fechada__data">
                                  {dataBR(quandoFechou(obra).toISOString().slice(0, 10))}
                                </span>

                                <span className="fechada__nota">
                                  {obra.avaliacao ? (
                                    Number(obra.avaliacao.nota).toFixed(1)
                                  ) : (
                                    <em>—</em>
                                  )}
                                </span>

                                <span className="fechada__avatares">
                                  {pessoas.slice(0, 3).map((p) => (
                                    <Avatar key={p.id} nome={p.nome} foto={p.foto} tamanho={22} />
                                  ))}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          </>
        )}
      </section>
    </AppShell>
  )
}
