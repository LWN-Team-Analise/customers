import { useEffect, useMemo, useState } from 'react'
import Avatar from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { dataHora } from '@/utils/formato'
import './Rastreabilidade.css'

/**
 * A ficha completa de uma obra fechada.
 *
 * Obra encerrada nao aceita mais nada — nem check, nem mensagem, nem
 * observacao. O que ela guarda e a HISTORIA: quem marcou cada check e a que
 * horas, o que foi conversado no chat, o que foi observado, os avisos que
 * sairam, os anexos e as notas.
 *
 * Tudo isso ja estava no banco, so que espalhado por quatro pop-ups
 * diferentes. Aqui vira uma linha do tempo unica, do mais antigo para o mais
 * novo — que e como se lembra de uma obra: pela ordem em que aconteceu.
 *
 * O chat vem por chamada propria (nao entra na carga do quadro, que ficaria
 * pesada) e so quando esta tela abre.
 */

const Icone = {
  check: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  ),
  chat: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  ),
  nota: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  ),
  aviso: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  anexo: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.4-7.4" />
    </svg>
  ),
  estrela: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.99 6.75 19.75l1-5.85L3.5 9.75l5.9-.85z" />
    </svg>
  ),
}

/* os filtros do topo — o "tipo" bate com o campo de cada acontecimento */
const FILTROS = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'check', rotulo: 'Checks' },
  { id: 'chat', rotulo: 'Chat' },
  { id: 'nota', rotulo: 'Observações' },
  { id: 'aviso', rotulo: 'Avisos' },
  { id: 'avaliacao', rotulo: 'Avaliações' },
  { id: 'anexo', rotulo: 'Anexos' },
]

/** Ordena por data; sem data vai para o fim, nunca some da lista. */
function porData(a, b) {
  if (!a.quando) return 1
  if (!b.quando) return -1
  return String(a.quando).localeCompare(String(b.quando))
}

export default function Rastreabilidade({ obra, roteiro }) {
  const { pessoaPorId, cargoPorChave, nomeDoCargo, carregarChat } = useDados()

  const [mensagens, setMensagens] = useState([])
  const [carregandoChat, setCarregandoChat] = useState(true)
  const [filtro, setFiltro] = useState('tudo')

  useEffect(() => {
    let vivo = true
    setCarregandoChat(true)
    carregarChat(obra.id)
      .then((resposta) => {
        if (vivo) setMensagens(resposta?.mensagens ?? [])
      })
      .catch(() => {
        /* sem chat a linha do tempo continua valendo: o resto ja veio na
           carga do quadro */
      })
      .finally(() => {
        if (vivo) setCarregandoChat(false)
      })
    return () => {
      vivo = false
    }
  }, [obra.id, carregarChat])

  /**
   * Todos os acontecimentos, de qualquer origem, numa lista so.
   *
   * Cada um vira { tipo, quando, quem, titulo, corpo, extra } — dai a
   * pintura e uma so, em vez de seis listas parecidas lado a lado.
   */
  const linha = useMemo(() => {
    const itens = []

    /* ---- checks: quem marcou o que, e a que horas ---- */
    roteiro.forEach((etapa) => {
      etapa.cards?.forEach((card) => {
        card.checks?.forEach((check) => {
          const marca = obra.checks?.[check.id]
          if (!marca) return
          const pessoa = pessoaPorId(marca.feitoPor)
          itens.push({
            chave: `check-${check.id}`,
            tipo: 'check',
            quando: marca.feitoEm,
            quem: pessoa?.nome ?? 'Usuário removido',
            foto: pessoa?.foto,
            titulo: check.titulo,
            /* o caminho ate o check: e o que diz de qual etapa ele veio */
            corpo: `${etapa.numero}ª etapa · ${
              card.titulo || card.cargos?.map((c) => nomeDoCargo(c)).join(', ') || 'card'
            }`,
          })
        })
      })
    })

    /* ---- observacoes ---- */
    obra.observacoes?.forEach((o) => {
      const autor = pessoaPorId(o.autorId)
      itens.push({
        chave: `obs-${o.id}`,
        tipo: 'nota',
        quando: o.enviadaEm,
        quem: o.autorNome,
        foto: autor?.foto,
        titulo: 'Observação',
        corpo: o.texto,
        extra: o.editadaEm ? `editada em ${dataHora(o.editadaEm)}` : null,
      })
    })

    /* ---- chat ---- */
    mensagens.forEach((m) => {
      const autor = pessoaPorId(m.autorId)
      itens.push({
        chave: `msg-${m.id}`,
        tipo: 'chat',
        quando: m.enviadaEm,
        quem: m.autorNome,
        foto: autor?.foto,
        titulo: 'Mensagem no chat',
        corpo: m.texto,
        extra: m.arquivo ? `arquivo: ${m.arquivo.nome}` : null,
      })
    })

    /* ---- avisos aos setores ---- */
    obra.avisos?.forEach((a) => {
      itens.push({
        chave: `aviso-${a.id}`,
        tipo: 'aviso',
        quando: a.enviadoEm,
        quem: a.enviadoPorNome ?? 'Sistema',
        titulo: `Aviso para ${a.setores.map((s) => cargoPorChave(s)?.nome ?? s).join(', ')}`,
        corpo: a.mensagem || `Pendência na ${a.etapa}ª etapa.`,
      })
    })

    /* ---- avaliacoes ---- */
    obra.notas?.forEach((n) => {
      itens.push({
        chave: `nota-${n.id}`,
        tipo: 'avaliacao',
        quando: n.avaliadaEm,
        quem: n.rotulo,
        titulo: `Nota ${Number(n.nota).toFixed(1)} — ${n.rotulo}`,
        corpo: n.descricao || null,
      })
    })

    /* ---- anexos ---- */
    obra.anexos?.forEach((a) => {
      itens.push({
        chave: `anexo-${a.id}`,
        tipo: 'anexo',
        quando: a.enviadoEm ?? a.criadoEm,
        quem: a.autorNome ?? '—',
        titulo: a.nome,
        corpo: 'Documento anexado à obra',
      })
    })

    return itens.sort(porData)
  }, [obra, roteiro, mensagens, pessoaPorId, cargoPorChave, nomeDoCargo])

  /* quantos de cada tipo — o filtro mostra o numero e some quando e zero */
  const contagem = useMemo(() => {
    const mapa = { tudo: linha.length }
    linha.forEach((i) => {
      mapa[i.tipo] = (mapa[i.tipo] ?? 0) + 1
    })
    return mapa
  }, [linha])

  const visiveis = filtro === 'tudo' ? linha : linha.filter((i) => i.tipo === filtro)

  return (
    <section className="rastro vidro">
      <header className="rastro__topo">
        <h2 className="rastro__titulo">Rastreabilidade</h2>
        <div className="rastro__filtros">
          {FILTROS.map((f) => {
            const quantos = contagem[f.id] ?? 0
            if (f.id !== 'tudo' && quantos === 0) return null
            return (
              <button
                key={f.id}
                type="button"
                className={`chip ${filtro === f.id ? 'is-atual' : ''}`.trim()}
                onClick={() => setFiltro(f.id)}
                aria-pressed={filtro === f.id}
              >
                {f.rotulo}
                <em className="rastro__quantos">{quantos}</em>
              </button>
            )
          })}
        </div>
      </header>

      {carregandoChat && <p className="rastro__vazio">Carregando o histórico...</p>}

      {!carregandoChat && visiveis.length === 0 && (
        <p className="rastro__vazio">Nada registrado nesta seleção.</p>
      )}

      <ol className="rastro__linha">
        {visiveis.map((item) => {
          const Glifo = Icone[item.tipo === 'avaliacao' ? 'estrela' : item.tipo] ?? Icone.nota
          return (
            <li key={item.chave} className="rastro__item" data-tipo={item.tipo}>
              <span className="rastro__marca" aria-hidden="true">
                <Glifo />
              </span>

              <div className="rastro__corpo">
                <p className="rastro__cabeca">
                  <strong className="rastro__nome">{item.titulo}</strong>
                  <time className="rastro__quando">
                    {item.quando ? dataHora(item.quando) : 'sem data'}
                  </time>
                </p>

                {item.corpo && <p className="rastro__texto">{item.corpo}</p>}

                <p className="rastro__rodape">
                  {item.foto !== undefined || item.quem ? (
                    <span className="rastro__quem">
                      {item.foto !== undefined && (
                        <Avatar nome={item.quem} foto={item.foto} tamanho={18} />
                      )}
                      {item.quem}
                    </span>
                  ) : null}
                  {item.extra && <em className="rastro__extra">{item.extra}</em>}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
