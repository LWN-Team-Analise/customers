import { useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoArea } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import useCorDaLogo from '@/hooks/useCorDaLogo'
import { dataBR, dataHora } from '@/utils/formato'
import './Avaliacoes.css'

/** Estrelas de 0 a 10, desenhadas como cinco (cada uma vale 2 pontos). */
export function Estrelas({ nota, tamanho = 15 }) {
  const cheias = (Number(nota) || 0) / 2
  return (
    <span className="estrelas" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const parte = Math.round(Math.max(0, Math.min(1, cheias - i)) * 100)
        const id = `est${i}-${parte}`
        return (
          <svg key={i} viewBox="0 0 24 24" width={tamanho} height={tamanho}>
            <defs>
              <linearGradient id={id}>
                <stop offset={`${parte}%`} stopColor="var(--pri-media)" />
                <stop offset={`${parte}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.99 6.75 19.75l1-5.85L3.5 9.75l5.9-.85z"
              fill={`url(#${id})`}
              stroke="var(--pri-media)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        )
      })}
    </span>
  )
}

const FILTROS = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'sem', rotulo: 'Sem avaliação' },
  { valor: 'com', rotulo: 'Avaliadas' },
]

/** As duas notas que toda obra costuma ter. O + acrescenta outras. */
const ROTULOS = ['Diretor', 'Cliente']

const Mais = ({ tamanho = 15 }) => (
  <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const Lixo = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </svg>
)

/**
 * Avaliacao por OBRA.
 *
 * A obra pode ter mais de uma nota — a do diretor e a do cliente sao as
 * de sempre, e o + acrescenta outras. A MEDIA delas e a nota da obra, e
 * e ela que entra na media de cada pessoa que participou.
 *
 * O card e enxuto de proposito: empresa, tipo de obra, a nota e os
 * rostos de quem participou. O resto (descricao, datas, cada nota
 * separada) abre no clique.
 */
export default function Avaliacoes() {
  const { obras, clientePorId, pessoaPorId } = useDados()
  const [filtro, setFiltro] = useState('todas')
  const [abrindo, setAbrindo] = useState(null)

  const lista = useMemo(() => {
    const filtradas = obras.filter((o) => {
      if (filtro === 'sem') return !o.avaliacao
      if (filtro === 'com') return Boolean(o.avaliacao)
      return true
    })
    // sem avaliacao primeiro: sao as que pedem acao
    return [...filtradas].sort((a, b) => {
      if (Boolean(a.avaliacao) !== Boolean(b.avaliacao)) return a.avaliacao ? 1 : -1
      return String(b.criadoEm).localeCompare(String(a.criadoEm))
    })
  }, [obras, filtro])

  const avaliadas = obras.filter((o) => o.avaliacao)
  const media =
    avaliadas.length > 0
      ? avaliadas.reduce((soma, o) => soma + Number(o.avaliacao.nota), 0) / avaliadas.length
      : null

  return (
    <AppShell>
      <section className="avaliacoes">
        <header className="avaliacoes__topo">
          <h1 className="tela__titulo">Avaliações</h1>

          {media !== null && (
            <div className="avaliacoes__media">
              <span className="avaliacoes__medianum">{media.toFixed(1)}</span>
              <span className="avaliacoes__medialeg">
                média de {avaliadas.length} obra{avaliadas.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </header>

        <div className="avaliacoes__filtro">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`chip ${filtro === f.valor ? 'is-atual' : ''}`.trim()}
              onClick={() => setFiltro(f.valor)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <p className="avaliacoes__vazio">Nenhuma obra nesta seleção.</p>
        ) : (
          <ul className="avaliacoes__grade">
            {lista.map((obra) => (
              <CardAvaliacao
                key={obra.id}
                obra={obra}
                cliente={clientePorId(obra.clienteId)}
                participantes={obra.membros.map(pessoaPorId).filter(Boolean)}
                aoAbrir={() => setAbrindo(obra.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <ModalAvaliar obraId={abrindo} aoFechar={() => setAbrindo(null)} />
    </AppShell>
  )
}

/**
 * O card da lista.
 *
 * A tarja da lateral usa a MESMA cor do card do cliente na aba
 * Clientes: a predominante da logo, com o nome como reserva. Assim a
 * empresa se reconhece de longe nas duas telas.
 */
function CardAvaliacao({ obra, cliente, participantes, aoAbrir }) {
  const cor = useCorDaLogo(cliente?.logo, cliente?.nome)

  return (
    <li>
      <button
        type="button"
        className={`avaobra ${obra.avaliacao ? 'is-avaliada' : ''}`.trim()}
        style={{ '--cor-empresa': cor }}
        onClick={aoAbrir}
      >
        <header className="avaobra__topo">
          <strong className="avaobra__empresa">{cliente?.nome ?? 'Cliente removido'}</strong>
          <span className="avaobra__selo" data-tipo={obra.tipo}>
            {obra.tipo === 'emergencia' ? 'emergência' : 'padrão'}
          </span>
        </header>

        <div className="avaobra__nota">
          {obra.avaliacao ? (
            <>
              <Estrelas nota={obra.avaliacao.nota} tamanho={17} />
              <strong>{Number(obra.avaliacao.nota).toFixed(1)}</strong>
              {obra.notas?.length > 1 && (
                <span className="avaobra__quantas">
                  média de {obra.notas.length} avaliações
                </span>
              )}
            </>
          ) : (
            <span className="avaobra__sem">Sem avaliação</span>
          )}
        </div>

        {/* so os rostos: os nomes e o resto aparecem ao abrir */}
        {participantes.length > 0 && (
          <footer className="avaobra__base">
            <span className="avaobra__avatares">
              {participantes.slice(0, 6).map((p) => (
                <Avatar key={p.id} nome={p.nome} foto={p.foto} tamanho={24} titulo={p.nome} />
              ))}
            </span>
            {participantes.length > 6 && (
              <span className="avaobra__resto">+{participantes.length - 6}</span>
            )}
          </footer>
        )}
      </button>
    </li>
  )
}

/**
 * Pop-up da avaliacao.
 *
 * Aqui aparece o que o card esconde: a descricao da obra, a data da
 * avaliacao e cada nota separada. O + acrescenta uma nota, e a lixeira
 * tira — a ultima nao sai: obra avaliada tem que ficar com ao menos
 * uma, e para zerar tudo existe o "Remover avaliação".
 */
function ModalAvaliar({ obraId, aoFechar }) {
  const {
    obraPorId,
    clientePorId,
    pessoaPorId,
    cargoPorChave,
    adicionarAvaliacao,
    atualizarAvaliacao,
    removerAvaliacao,
    limparAvaliacao,
    mediaDoUsuario,
    pode,
  } = useDados()

  const obra = obraId ? obraPorId(obraId) : null

  /* rascunho: o que esta na tela antes de gravar. Cada linha e
     { id?, rotulo, nota, descricao } — sem id = nota nova. */
  const [linhas, setLinhas] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const podeAvaliar = pode('editar_avaliacoes')

  useEffect(() => {
    if (!obra) return
    setLinhas(
      obra.notas?.length > 0
        ? obra.notas.map((n) => ({
            id: n.id,
            rotulo: n.rotulo,
            nota: String(n.nota),
            descricao: n.descricao ?? '',
            avaliadaEm: n.avaliadaEm,
          }))
        : /* obra ainda sem nota: comeca com as duas de sempre, em branco */
          ROTULOS.map((rotulo) => ({ rotulo, nota: '', descricao: '' })),
    )
    setErro('')
  }, [obraId, obra])

  if (!obra) return null

  const cliente = clientePorId(obra.clienteId)
  const participantes = obra.membros.map(pessoaPorId).filter(Boolean)

  const mudar = (indice, campo) => (valor) =>
    setLinhas((atual) =>
      atual.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)),
    )

  const acrescentar = () =>
    setLinhas((atual) => [...atual, { rotulo: `Avaliação ${atual.length + 1}`, nota: '', descricao: '' }])

  const tirar = async (indice) => {
    const linha = linhas[indice]

    /* linha que ainda nao existe no banco sai so da tela */
    if (!linha.id) {
      setLinhas((atual) => atual.filter((_, i) => i !== indice))
      return
    }
    if (linhas.filter((l) => l.id).length <= 1) {
      setErro('A obra precisa ficar com ao menos uma avaliação. Use "Remover avaliação" para tirar todas.')
      return
    }

    try {
      await removerAvaliacao(linha.id)
      setLinhas((atual) => atual.filter((_, i) => i !== indice))
      setErro('')
    } catch (e) {
      setErro(e.message)
    }
  }

  /* a media do que esta na tela, para a pessoa ver o resultado antes
     mesmo de salvar */
  const preenchidas = linhas
    .map((l) => Number(String(l.nota).replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 10)
  const previa =
    preenchidas.length > 0
      ? Math.round((preenchidas.reduce((s, n) => s + n, 0) / preenchidas.length) * 10) / 10
      : null

  const salvar = async (evento) => {
    evento.preventDefault()

    const validas = linhas.filter((l) => String(l.nota).trim() !== '')
    if (validas.length === 0) {
      setErro('Informe ao menos uma nota, de 0 a 10.')
      return
    }
    const foraDaFaixa = validas.some((l) => {
      const n = Number(String(l.nota).replace(',', '.'))
      return !Number.isFinite(n) || n < 0 || n > 10
    })
    if (foraDaFaixa) {
      setErro('As notas vão de 0 a 10.')
      return
    }

    setSalvando(true)
    try {
      for (const linha of validas) {
        const campos = {
          rotulo: linha.rotulo,
          nota: Number(String(linha.nota).replace(',', '.')),
          descricao: linha.descricao,
        }
        if (linha.id) await atualizarAvaliacao(linha.id, campos)
        else await adicionarAvaliacao(obra.id, campos)
      }
      aoFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const apagarTudo = async () => {
    try {
      await limparAvaliacao(obra.id)
      aoFechar()
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <Modal
      aberto={Boolean(obraId)}
      aoFechar={aoFechar}
      titulo={`${cliente?.nome ?? 'Obra'} — ${obra.tipo === 'emergencia' ? 'emergência' : 'padrão'}`}
      subtitulo="A média das notas é a nota da obra, e ela entra na média de cada participante."
      largura={580}
    >
      <form className="formava" onSubmit={salvar}>
        {/* o que o card nao mostra: descricao e datas */}
        <div className="formava__cabeca">
          <p className="formava__obra">{obra.descricao}</p>
          <p className="formava__datas">
            <span>
              Obra criada em <strong>{dataBR(String(obra.criadoEm).slice(0, 10))}</strong>
            </span>
            {obra.avaliacao?.avaliadaEm && (
              <span>
                Última avaliação em <strong>{dataHora(obra.avaliacao.avaliadaEm)}</strong>
              </span>
            )}
          </p>
        </div>

        <div className="formava__notas">
          <header className="formava__notastopo">
            <h3>Notas desta obra</h3>
            {previa !== null && (
              <span className="formava__previa">
                <Estrelas nota={previa} tamanho={16} />
                <strong>{previa.toFixed(1)}</strong>
                <em>média geral</em>
              </span>
            )}
            {podeAvaliar && (
              <button
                type="button"
                className="formava__mais"
                onClick={acrescentar}
                title="Acrescentar outra avaliação"
                aria-label="Acrescentar outra avaliação"
              >
                <Mais />
              </button>
            )}
          </header>

          {linhas.map((linha, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <article key={linha.id ?? `nova-${i}`} className="notaitem">
              <input
                className="notaitem__rotulo"
                value={linha.rotulo}
                onChange={(e) => mudar(i, 'rotulo')(e.target.value)}
                placeholder="De quem é a nota"
                aria-label="Rótulo da avaliação"
                disabled={!podeAvaliar}
              />

              <input
                className="notaitem__nota"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={linha.nota}
                onChange={(e) => {
                  mudar(i, 'nota')(e.target.value)
                  setErro('')
                }}
                placeholder="—"
                aria-label={`Nota de ${linha.rotulo}`}
                disabled={!podeAvaliar}
              />

              <Estrelas nota={Number(String(linha.nota).replace(',', '.')) || 0} tamanho={15} />

              {podeAvaliar && linhas.length > 1 && (
                <button
                  type="button"
                  className="notaitem__tirar"
                  onClick={() => tirar(i)}
                  title="Excluir esta avaliação"
                  aria-label={`Excluir a avaliação de ${linha.rotulo}`}
                >
                  <Lixo />
                </button>
              )}

              <CampoArea
                largo
                linhas={2}
                placeholder={`O que ${linha.rotulo.toLowerCase()} comentou?`}
                value={linha.descricao}
                onChange={(e) => mudar(i, 'descricao')(e.target.value)}
                disabled={!podeAvaliar}
              />

              {linha.avaliadaEm && (
                <span className="notaitem__data">registrada em {dataHora(linha.avaliadaEm)}</span>
              )}
            </article>
          ))}
        </div>

        {erro && (
          <p className="formava__erro" role="alert">
            {erro}
          </p>
        )}

        <div className="formava__quem">
          <h3>Quem recebe esta nota</h3>
          {participantes.length === 0 ? (
            <p className="formava__ninguem">
              Ninguém marcou tarefa nesta obra ainda — a nota fica registrada, mas não entra em
              nenhuma média.
            </p>
          ) : (
            <ul>
              {participantes.map((p) => {
                const cargo = cargoPorChave(p.cargo)
                const atual = mediaDoUsuario(p.id)
                return (
                  <li key={p.id}>
                    <Avatar nome={p.nome} foto={p.foto} tamanho={30} titulo={p.nome} />
                    <span className="formava__pessoa">
                      <strong>{p.nome}</strong>
                      <span
                        className="formava__cargo"
                        style={{ '--cargo-cor': cargo?.cor ?? '#6b7280' }}
                      >
                        {cargo?.nome ?? p.cargoNome ?? 'Sem cargo'}
                      </span>
                    </span>
                    <span className="formava__media">
                      {atual.media === null ? (
                        <em>sem média</em>
                      ) : (
                        <>
                          <strong>{atual.media.toFixed(1)}</strong>
                          <em>
                            {atual.obrasAvaliadas} obra{atual.obrasAvaliadas === 1 ? '' : 's'}
                          </em>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="formobra__acoes">
          {podeAvaliar && obra.avaliacao && (
            <button type="button" className="formava__apagar" onClick={apagarTudo}>
              Remover avaliação
            </button>
          )}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            {podeAvaliar ? 'Cancelar' : 'Fechar'}
          </button>
          {podeAvaliar && (
            <Button type="submit" loading={salvando}>
              {obra.avaliacao ? 'Salvar notas' : 'Avaliar obra'}
            </Button>
          )}
        </footer>
      </form>
    </Modal>
  )
}
