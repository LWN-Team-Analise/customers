import { useEffect, useMemo, useState } from 'react'
import Avatar from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { dataHora } from '@/utils/formato'
import ModalTermos from './ModalTermos'
import './Rastreabilidade.css'

/**
 * A ficha completa da obra: tudo o que aconteceu nela, em ordem.
 *
 * Quem marcou cada check e a que horas, o que foi conversado no chat, o que
 * foi observado, os avisos que sairam, os anexos e as notas.
 *
 * Tudo isso ja estava no banco, so que espalhado por quatro pop-ups
 * diferentes. Aqui vira uma linha do tempo unica, do mais antigo para o mais
 * novo — que e como se lembra de uma obra: pela ordem em que aconteceu.
 *
 * Vale para QUALQUER obra, aberta ou fechada. Na fechada ela e o registro do
 * que foi feito; na aberta, o acompanhamento de quem esta segurando o que —
 * e a pergunta ("quem marcou isso?") e a mesma nos dois casos.
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

const Engrenagem = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.78-.32 1.6 1.6 0 0 0-1 1.47V21a1.9 1.9 0 0 1-3.8 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a1.9 1.9 0 0 1 0-3.8h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 1-1.47V3a1.9 1.9 0 0 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.78-.32l.05-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a1.9 1.9 0 0 1 0 3.8h-.1a1.6 1.6 0 0 0-1.47 1z" />
  </svg>
)

/* Os filtros que NAO dependem do roteiro. Os das etapas entram no meio
   deles, montados a partir da obra — ver `filtros`, mais abaixo. */
const FILTROS_FIXOS = [
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
  const { pessoaPorId, cargoPorChave, nomeDoCargo, carregarChat, rotuloEtapa, termoEtapas, pode } =
    useDados()

  const [mensagens, setMensagens] = useState([])
  const [carregandoChat, setCarregandoChat] = useState(true)
  const [filtro, setFiltro] = useState('tudo')
  const [trocandoTermo, setTrocandoTermo] = useState(false)

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
            /* de qual etapa este check veio. É o que o filtro por etapa
               usa para separar "[1ª Etapa]" de "[2ª Etapa]" — antes
               havia um filtro só, "Checks", que jogava as cinco etapas
               na mesma pilha e não respondia à pergunta que se faz
               olhando a ficha: "o que aconteceu na 3ª?". */
            etapa: etapa.numero,
            quando: marca.feitoEm,
            quem: pessoa?.nome ?? 'Usuário removido',
            foto: pessoa?.foto,
            titulo: check.titulo,
            corpo: `${rotuloEtapa(etapa.numero)} · ${
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
        corpo: a.mensagem || `Pendência na ${rotuloEtapa(a.etapa)}.`,
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
  }, [obra, roteiro, mensagens, pessoaPorId, cargoPorChave, nomeDoCargo, rotuloEtapa])

  /**
   * Os filtros do topo, na ordem em que se leem:
   *
   *   [Tudo] [1ª Etapa] [2ª Etapa] ... [Chat] [Observações] [Avisos] ...
   *
   * As etapas vêm do roteiro DESTA obra, e por isso são quantas ela
   * tiver — uma obra de cinco etapas mostra cinco chips, e uma que
   * ganhou a sexta em maio mostra seis. Elas ocupam o lugar do antigo
   * filtro "Checks", que existia sozinho e não separava nada.
   */
  const filtros = useMemo(
    () => [
      { id: 'tudo', rotulo: 'Tudo' },
      ...roteiro.map((e) => ({
        id: `etapa-${e.numero}`,
        rotulo: rotuloEtapa(e.numero),
        etapa: e.numero,
        /* o nome da etapa ("Integração") não cabe no chip, mas cabe na
           dica: é o que diz de qual parte do roteiro se trata */
        dica: e.nome,
      })),
      ...FILTROS_FIXOS,
    ],
    [roteiro, rotuloEtapa],
  )

  /* quantos de cada filtro — o chip mostra o numero e some quando e zero */
  const contagem = useMemo(() => {
    const mapa = { tudo: linha.length }
    linha.forEach((i) => {
      mapa[i.tipo] = (mapa[i.tipo] ?? 0) + 1
      if (i.tipo === 'check' && i.etapa) {
        const chave = `etapa-${i.etapa}`
        mapa[chave] = (mapa[chave] ?? 0) + 1
      }
    })
    return mapa
  }, [linha])

  const visiveis = useMemo(() => {
    if (filtro === 'tudo') return linha
    if (filtro.startsWith('etapa-')) {
      const numero = Number(filtro.slice(6))
      return linha.filter((i) => i.tipo === 'check' && i.etapa === numero)
    }
    return linha.filter((i) => i.tipo === filtro)
  }, [linha, filtro])

  /* trocar o nome de "Etapa" muda o sistema inteiro: é de quem já
     manda no roteiro */
  const podeTrocarTermo = pode('editar_etapa')

  return (
    <section className="rastro vidro">
      <header className="rastro__topo">
        <h2 className="rastro__titulo">Rastreabilidade</h2>
        <div className="rastro__filtros">
          {filtros.map((f) => {
            const quantos = contagem[f.id] ?? 0
            if (f.id !== 'tudo' && quantos === 0) return null
            return (
              <button
                key={f.id}
                type="button"
                className={`chip ${filtro === f.id ? 'is-atual' : ''}`.trim()}
                onClick={() => setFiltro(f.id)}
                aria-pressed={filtro === f.id}
                title={f.dica}
              >
                {f.rotulo}
                <em className="rastro__quantos">{quantos}</em>
              </button>
            )
          })}

          {/* Renomear "Etapa" para o que a empresa usar. Fica aqui, ao
              lado dos chips, porque é olhando para eles que se percebe
              que a palavra não é a certa. */}
          {podeTrocarTermo && (
            <button
              type="button"
              className="rastro__termo"
              onClick={() => setTrocandoTermo(true)}
              title={`Renomear "${termoEtapas}" no sistema inteiro`}
              aria-label={`Renomear ${termoEtapas}`}
            >
              <Engrenagem />
            </button>
          )}
        </div>
      </header>

      <ModalTermos aberto={trocandoTermo} aoFechar={() => setTrocandoTermo(false)} />

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
