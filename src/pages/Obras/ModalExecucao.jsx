import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { useDados } from '@/context/DadosContext'
import { diasAte } from '@/domain/obras'
import { dataBR, hojeISO } from '@/utils/formato'
import './ModalEnsaios.css'

/* acima disto a fila de dias vira so os dias com registro + o campo de data */
const MAX_DIAS_NA_FILA = 45

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** 'AAAA-MM-DD' + n dias. */
function somarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d + n))
  return data.toISOString().slice(0, 10)
}

const diaDaSemana = (iso) => {
  const [a, m, d] = iso.split('-').map(Number)
  return SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
}

/** Quanto falta para o prazo da execucao — so informa: a cor do card vem do prazo final. */
function textoDoPrazo(restam) {
  if (restam < 0) return `atrasada há ${-restam} dia${restam < -1 ? 's' : ''}`
  if (restam === 0) return 'vence hoje'
  if (restam === 1) return 'vence amanhã'
  return `faltam ${restam} dias`
}

/**
 * EXECUCAO DOS ENSAIOS — o check do Time Tecnico na 3a etapa.
 *
 * Mostra so os ensaios escolhidos no Planejamento de ensaios. O
 * responsavel escolhe um DIA dentro do periodo de execucao (da entrada
 * em campo ao prazo da execucao — e, se ele ja passou, ate hoje) e diz
 * quanto cada ensaio estava feito naquele dia:
 *
 *   06/10  Vazao 50%   Smoke Test 50%
 *   07/10  Vazao 100%  Smoke Test 70%
 *
 * Cada dia e um registro proprio — salvar o dia 07 nao mexe no 06. O
 * andamento de um ensaio e o do dia mais recente, e o da execucao e a
 * media dos ensaios: Vazao 100% + Smoke Test 50% = 75%.
 *
 * O check so fecha com TODOS em 100%. Antes disso o botao de concluir
 * fica travado, e o servidor recusa do mesmo jeito.
 */
export default function ModalExecucao({
  aberto,
  obra,
  /* registra e conclui: quem marca o check (o setor dele) */
  podeEditar,
  marcado,
  /* quem pode definir o periodo (definir_prazos) */
  podePeriodo,
  aoDefinirPeriodo,
  aoConcluir,
  aoDesmarcar,
  aoFechar,
}) {
  const { execucaoDaObra, registrarExecucaoDia } = useDados()
  const hoje = hojeISO()

  const execucao = obra ? execucaoDaObra(obra) : null
  const itens = execucao?.itens ?? []
  const inicio = obra?.execucaoInicio ?? obra?.dataInicio ?? null
  /* o prazo DA EXECUCAO (so a 3a etapa), e nao o final da obra */
  const prazo = obra?.execucaoPrazo ?? null
  const semPrazo = !prazo

  /* os dias que dao para registrar: do inicio ate hoje (inclusive os
     depois do prazo, quando ele ja passou — a obra atrasada continua
     sendo executada). Os dias futuros do periodo aparecem travados. */
  const fila = useMemo(() => {
    if (!inicio || !prazo) return []
    const ultimo = prazo > hoje ? prazo : hoje
    const total = diasAte(ultimo, inicio)
    if (total < 0) return []
    if (total + 1 > MAX_DIAS_NA_FILA) return null
    return Array.from({ length: total + 1 }, (_, i) => somarDias(inicio, i))
  }, [inicio, prazo, hoje])

  const registrados = execucao?.dias ?? []

  const [dia, setDia] = useState('')
  const [valores, setValores] = useState({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  /* o que ja esta gravado no dia escolhido, por ensaio */
  const doDia = (d) =>
    Object.fromEntries(
      itens.map((i) => [i.id, i.dias.find((x) => x.dia === d)?.percentual ?? null]),
    )

  useEffect(() => {
    if (!aberto) return
    const dentro = inicio && hoje >= inicio
    const inicial = dentro ? hoje : (registrados.at(-1) ?? inicio ?? hoje)
    setDia(inicial)
    setErro('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, obra?.id])

  /* trocar de dia recarrega os campos com o que aquele dia tem */
  useEffect(() => {
    if (!aberto || !dia) return
    const gravado = doDia(dia)
    setValores(Object.fromEntries(itens.map((i) => [i.id, gravado[i.id] ?? ''])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, dia, obra])

  const gravado = dia ? doDia(dia) : {}
  const mudancas = itens.filter((i) => {
    const antes = gravado[i.id]
    const agora = valores[i.id]
    return String(antes ?? '') !== String(agora ?? '')
  })

  const diaValido = Boolean(dia) && Boolean(inicio) && dia >= inicio && dia <= hoje

  const salvarDia = async () => {
    for (const i of mudancas) {
      const v = valores[i.id]
      if (v !== '' && !(Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100)) {
        setErro(`O percentual de ${i.nome} vai de 0 a 100, sem casas decimais.`)
        return
      }
    }
    setSalvando(true)
    setErro('')
    try {
      await registrarExecucaoDia(
        obra.id,
        dia,
        mudancas.map((i) => ({
          ensaioId: i.id,
          percentual: valores[i.id] === '' ? null : Number(valores[i.id]),
        })),
      )
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const restam = prazo ? diasAte(prazo, hoje) : null

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Execução dos ensaios"
      largura={760}
    >
      <div className="execucao">
        {/* ---- o periodo e o prazo da execucao ---- */}
        <div className="execucao__periodo" data-tom={semPrazo ? 'vencido' : undefined}>
          <span className="execucao__rotulo">Período de execução</span>
          {semPrazo ? (
            <strong>Sem prazo da execução</strong>
          ) : (
            <strong>
              {dataBR(inicio)} → {dataBR(prazo)}
            </strong>
          )}
          {!semPrazo && <em className="execucao__selo">{textoDoPrazo(restam)}</em>}
          {podePeriodo && (
            <button type="button" className="execucao__periodobotao" onClick={aoDefinirPeriodo}>
              {semPrazo ? 'Definir período' : 'Alterar período'}
            </button>
          )}
        </div>

        {semPrazo && (
          <p className="ensaios__aviso" role="alert">
            A execução precisa do prazo dela: sem ele não há período para registrar.{' '}
            {podePeriodo
              ? 'Defina o período acima.'
              : 'Peça a quem pode definir prazos para preenchê-lo.'}
          </p>
        )}

        {itens.length === 0 ? (
          <p className="ensaios__vazio">
            Nenhum ensaio foi planejado para esta obra. Os ensaios são escolhidos no check
            "Planejamento de ensaios", na 1ª etapa.
          </p>
        ) : (
          <>
            {/* ---- o andamento: geral e por ensaio ---- */}
            <section className="execucao__geral">
              <header>
                <span className="execucao__rotulo">Execução geral</span>
                <strong>{execucao.geral}%</strong>
              </header>
              <span className="execucao__barra" role="img" aria-label={`${execucao.geral}% executado`}>
                <span style={{ width: `${execucao.geral}%` }} />
              </span>
              <ul className="execucao__ensaios">
                {itens.map((i) => (
                  <li key={i.id} data-pronto={i.percentual >= 100 ? 'sim' : undefined}>
                    <span className="execucao__nome">{i.nome}</span>
                    <span className="execucao__barra execucao__barra--fina">
                      <span style={{ width: `${i.percentual}%` }} />
                    </span>
                    <span className="execucao__pct">
                      {i.percentual}%{i.percentual >= 100 ? ' ✓' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ---- o dia ---- */}
            {!semPrazo && (
              <section className="execucao__dia">
                <header className="execucao__diatopo">
                  <span className="execucao__rotulo">Dia</span>
                  {fila === null && (
                    <input
                      type="date"
                      className="execucao__data"
                      value={dia}
                      min={inicio ?? undefined}
                      max={hoje}
                      onChange={(e) => setDia(e.target.value)}
                      aria-label="Dia da execução"
                    />
                  )}
                </header>

                <div className="execucao__dias" role="listbox" aria-label="Dias do período">
                  {(fila ?? registrados).map((d) => {
                    const futuro = d > hoje
                    const depoisDoPrazo = d > prazo
                    return (
                      <button
                        key={d}
                        type="button"
                        role="option"
                        aria-selected={d === dia}
                        className={`execucao__chip ${d === dia ? 'is-atual' : ''}`.trim()}
                        data-registrado={registrados.includes(d) ? 'sim' : undefined}
                        data-atrasado={depoisDoPrazo ? 'sim' : undefined}
                        disabled={futuro}
                        onClick={() => setDia(d)}
                        title={
                          futuro
                            ? 'Dia que ainda não chegou'
                            : depoisDoPrazo
                              ? 'Depois do prazo da execução'
                              : registrados.includes(d)
                                ? 'Tem registro'
                                : undefined
                        }
                      >
                        <small>{diaDaSemana(d)}</small>
                        {d.slice(8)}/{d.slice(5, 7)}
                      </button>
                    )
                  })}
                </div>

                {diaValido ? (
                  <div className="execucao__campos">
                    {itens.map((i) => (
                      <label key={i.id} className="execucao__campo">
                        <span>{i.nome}</span>
                        <span className="execucao__entrada">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            inputMode="numeric"
                            placeholder="—"
                            value={valores[i.id] ?? ''}
                            disabled={!podeEditar}
                            onChange={(e) => setValores((v) => ({ ...v, [i.id]: e.target.value }))}
                          />
                          %
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="ensaios__vazio">
                    {dia > hoje ? 'Dia que ainda não chegou.' : 'Escolha um dia dentro do período.'}
                  </p>
                )}

                {podeEditar && diaValido && (
                  <div className="execucao__salvar">
                    <Button
                      type="button"
                      variant="ghost"
                      loading={salvando}
                      disabled={mudancas.length === 0}
                      onClick={salvarDia}
                    >
                      Salvar {dataBR(dia).slice(0, 5)}
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* ---- o historico: os dias em que houve registro ---- */}
            {registrados.length > 0 && (
              <section className="execucao__historico">
                <span className="execucao__rotulo">Registros por dia</span>
                <div className="execucao__tabela">
                  <table>
                    <thead>
                      <tr>
                        <th>Dia</th>
                        {itens.map((i) => (
                          <th key={i.id}>{i.nome}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...registrados].reverse().map((d) => {
                        const linha = doDia(d)
                        return (
                          <tr key={d}>
                            <td>{dataBR(d)}</td>
                            {itens.map((i) => (
                              <td key={i.id}>{linha[i.id] === null ? '—' : `${linha[i.id]}%`}</td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {podeEditar && !marcado && itens.length > 0 && !execucao.completo && (
          <p className="formrot__dica formrot__dica--colada">
            O check só fecha com todos os ensaios em 100%. Ainda faltam:{' '}
            {itens
              .filter((i) => i.percentual < 100)
              .map((i) => `${i.nome} (${i.percentual}%)`)
              .join(', ')}
            .
          </p>
        )}

        {erro && (
          <p className="formrot__erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="formobra__acoes">
          {podeEditar && marcado && (
            <button
              type="button"
              className="formobra__cancelar"
              onClick={async () => {
                await aoDesmarcar()
                aoFechar()
              }}
            >
              Reabrir o check
            </button>
          )}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Fechar
          </button>
          {podeEditar && !marcado && (
            <Button
              type="button"
              disabled={!execucao?.completo || semPrazo}
              title={
                execucao?.completo
                  ? undefined
                  : 'Só conclui com todos os ensaios em 100%'
              }
              onClick={async () => {
                await aoConcluir()
                aoFechar()
              }}
            >
              Concluir execução dos ensaios
            </Button>
          )}
        </footer>
      </div>
    </Modal>
  )
}
