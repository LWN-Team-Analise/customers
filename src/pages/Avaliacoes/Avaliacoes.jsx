import { useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoArea } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { ETAPAS, etapaAtual, obraConcluida } from '@/domain/obras'
import { dataBR } from '@/utils/formato'
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

/**
 * Avaliacao por OBRA: a empresa da a nota do servico prestado e a
 * descricao. Cada pessoa que participou recebe essa nota, e a nota dela
 * no sistema e a media de todas as obras avaliadas em que entrou.
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
            {lista.map((obra) => {
              const cliente = clientePorId(obra.clienteId)
              const participantes = obra.membros.map(pessoaPorId).filter(Boolean)
              const numero = etapaAtual(obra)
              const modelo = ETAPAS.find((e) => e.numero === numero)

              return (
                <li key={obra.id}>
                  <button
                    type="button"
                    className={`avaobra ${obra.avaliacao ? 'is-avaliada' : ''}`.trim()}
                    data-tipo={obra.tipo}
                    onClick={() => setAbrindo(obra.id)}
                  >
                    <header className="avaobra__topo">
                      <Avatar nome={cliente?.nome} foto={cliente?.logo} tamanho={30} quadrado />
                      <span className="avaobra__quem">
                        <strong>{cliente?.nome ?? 'Cliente removido'}</strong>
                        <span>
                          {obraConcluida(obra)
                            ? 'concluída'
                            : `${numero}ª etapa — ${modelo?.nome.toLowerCase()}`}
                        </span>
                      </span>
                      <span className="avaobra__selo" data-tipo={obra.tipo}>
                        {obra.tipo === 'emergencia' ? 'emergência' : 'padrão'}
                      </span>
                    </header>

                    <p className="avaobra__desc">{obra.descricao}</p>

                    <div className="avaobra__nota">
                      {obra.avaliacao ? (
                        <>
                          <Estrelas nota={obra.avaliacao.nota} />
                          <strong>{Number(obra.avaliacao.nota).toFixed(1)}</strong>
                          <span className="avaobra__data">
                            {dataBR(obra.avaliacao.avaliadaEm?.slice(0, 10))}
                          </span>
                        </>
                      ) : (
                        <span className="avaobra__sem">Sem avaliação</span>
                      )}
                    </div>

                    {obra.avaliacao?.descricao && (
                      <p className="avaobra__comentario">“{obra.avaliacao.descricao}”</p>
                    )}

                    <footer className="avaobra__base">
                      <span className="avaobra__avatares">
                        {participantes.slice(0, 4).map((p) => (
                          <Avatar key={p.id} nome={p.nome} foto={p.foto} tamanho={22} />
                        ))}
                      </span>
                      <span className="avaobra__quantos">
                        {participantes.length} participante
                        {participantes.length === 1 ? '' : 's'}
                      </span>
                    </footer>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ModalAvaliar
        obraId={abrindo}
        aoFechar={() => setAbrindo(null)}
      />
    </AppShell>
  )
}

/** Pop-up da avaliacao: nota, descricao e quem recebe. */
function ModalAvaliar({ obraId, aoFechar }) {
  const { obraPorId, clientePorId, pessoaPorId, cargoPorChave, avaliarObra, limparAvaliacao, mediaDoUsuario } =
    useDados()
  const { user } = useAuth()

  const obra = obraId ? obraPorId(obraId) : null

  const [nota, setNota] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  /* cada abertura carrega o que ja estava gravado na obra */
  useEffect(() => {
    if (!obra) return
    setNota(obra.avaliacao ? String(obra.avaliacao.nota) : '')
    setDescricao(obra.avaliacao?.descricao ?? '')
    setErro('')
  }, [obraId, obra])

  if (!obra) return null

  const cliente = clientePorId(obra.clienteId)
  const participantes = obra.membros.map(pessoaPorId).filter(Boolean)

  const salvar = (evento) => {
    evento.preventDefault()
    const valor = Number(String(nota).replace(',', '.'))
    if (nota === '' || Number.isNaN(valor) || valor < 0 || valor > 10) {
      setErro('A nota vai de 0 a 10.')
      return
    }
    avaliarObra(obra.id, { nota: valor, descricao, autorNome: user?.name })
    aoFechar()
  }

  const apagar = () => {
    limparAvaliacao(obra.id)
    aoFechar()
  }

  return (
    <Modal
      aberto={Boolean(obraId)}
      aoFechar={aoFechar}
      titulo={`Avaliar — ${cliente?.nome ?? 'obra'}`}
      subtitulo="A nota que a empresa deu ao serviço. Ela entra na média de cada participante."
      largura={560}
    >
      <form className="formava" onSubmit={salvar}>
        <p className="formava__obra">{obra.descricao}</p>

        <div className="formava__nota">
          <label className="formava__campo">
            <span>Nota de 0 a 10</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={nota}
              onChange={(e) => {
                setNota(e.target.value)
                setErro('')
              }}
              placeholder="—"
              autoFocus
            />
          </label>
          <Estrelas nota={Number(nota) || 0} tamanho={22} />
        </div>

        {erro && (
          <p className="formava__erro" role="alert">
            {erro}
          </p>
        )}

        <CampoArea
          rotulo="Descrição da avaliação"
          largo
          linhas={3}
          placeholder="O que a empresa comentou sobre o serviço?"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

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
          {obra.avaliacao && (
            <button type="button" className="formava__apagar" onClick={apagar}>
              Remover avaliação
            </button>
          )}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit">{obra.avaliacao ? 'Salvar nota' : 'Avaliar obra'}</Button>
        </footer>
      </form>
    </Modal>
  )
}
