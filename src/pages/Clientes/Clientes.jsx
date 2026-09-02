import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import {
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent,
  CutoutCardFooter,
  CutoutCardImage,
  CutoutCardInsetLabel,
  CutoutCardMedia,
  CutoutCardOverlay,
  CutoutCardPin,
} from '@/components/CutoutCard/CutoutCard'
import { useDados } from '@/context/DadosContext'
import Estrelas from '@/components/Estrelas/Estrelas'
import { dataBR, dataHora } from '@/utils/formato'
import useCorDaLogo from '@/hooks/useCorDaLogo'
import Confirma from '@/components/Confirma/Confirma'
import ModalCliente from './ModalCliente'
import ModalSetores from './ModalSetores'
import './Clientes.css'

const Icone = {
  mais: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  lapis: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
  setor: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 11 4l8 3.5v9L11 20l-8-3.5z" />
      <path d="M3 7.5 11 11l8-3.5M11 11v9" />
    </svg>
  ),
  pino: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  ),
}

export default function Clientes() {
  const {
    clientes,
    setores,
    setorPorId,
    obras,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    concluida,
    pode,
  } = useDados()
  const navigate = useNavigate()

  /* sem a permissao a lista continua a mesma; o que some sao os
     botoes de cadastrar, editar e apagar */
  const podeMexer = pode('editar_clientes')

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [busca, setBusca] = useState('')
  const [apagando, setApagando] = useState(null)
  const [modalSetores, setModalSetores] = useState(false)
  /* null = todos os setores; um id filtra; "sem" mostra os nao classificados */
  const [setorFiltro, setSetorFiltro] = useState(null)

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    let filtrados = alvo
      ? clientes.filter((c) =>
          `${c.nome} ${c.cidade} ${c.estado}`.toLowerCase().includes(alvo),
        )
      : clientes

    /* "sem" e uma escolha de verdade, nao a ausencia de filtro: e assim
       que se acha quem falta classificar */
    if (setorFiltro === 'sem') filtrados = filtrados.filter((c) => !c.setorId)
    else if (setorFiltro) {
      filtrados = filtrados.filter((c) => String(c.setorId) === String(setorFiltro))
    }

    return [...filtrados].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [clientes, busca, setorFiltro])

  /* quantas obras cada cliente tem, e quantas ainda estao abertas */
  const contagem = useMemo(() => {
    const mapa = {}
    obras.forEach((o) => {
      const atual = mapa[o.clienteId] ?? { total: 0, abertas: 0 }
      atual.total += 1
      if (!concluida(o)) atual.abertas += 1
      mapa[o.clienteId] = atual
    })
    return mapa
  }, [obras, concluida])

  /**
   * A avaliacao de cada cliente.
   *
   * A nota do cliente e a MEDIA das obras avaliadas dele — a mesma conta que
   * a aba Avaliacoes faz por pessoa, so que agrupada por empresa. Obra sem
   * nota nao entra na media (e nao conta como zero, que puxaria a media para
   * baixo de graca).
   *
   * Junto vem a lista das obras avaliadas, ja com as notas separadas de cada
   * uma: e o que o card abre quando a pessoa quer ver de onde veio a media.
   */
  const avaliacoes = useMemo(() => {
    const mapa = {}
    obras.forEach((o) => {
      if (!o.avaliacao) return
      const atual = mapa[o.clienteId] ?? { soma: 0, quantas: 0, obras: [] }
      atual.soma += Number(o.avaliacao.nota)
      atual.quantas += 1
      atual.obras.push(o)
      mapa[o.clienteId] = atual
    })

    Object.values(mapa).forEach((v) => {
      v.media = Math.round((v.soma / v.quantas) * 10) / 10
      /* da avaliacao mais recente para a mais antiga */
      v.obras.sort((a, b) =>
        String(b.avaliacao.avaliadaEm ?? b.criadoEm).localeCompare(
          String(a.avaliacao.avaliadaEm ?? a.criadoEm),
        ),
      )
    })
    return mapa
  }, [obras])

  const abrirNovo = () => {
    setEditando(null)
    setModal(true)
  }

  const abrirEdicao = (cliente) => {
    setEditando(cliente)
    setModal(true)
  }

  /* O banco apaga as obras do cliente junto (server/routes/dados.js);
     a confirmacao avisa quantas sao antes de mandar. */
  const confirmarExclusao = () => {
    if (apagando) removerCliente(apagando.id)
  }

  const salvar = (campos) => {
    if (editando) atualizarCliente(editando.id, campos)
    else adicionarCliente(campos)
  }

  return (
    <AppShell>
      <section className="clientes">
        {/* titulo, filtro e acao na mesma linha */}
        <header className="clientes__topo">
          <h1 className="clientes__titulo">Clientes</h1>

          <label className="procura">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa ou cidade..."
              aria-label="Buscar cliente"
            />
          </label>

          {podeMexer && (
            <button
              type="button"
              className="acao"
              onClick={() => setModalSetores(true)}
              title="Criar, editar ou excluir setores"
            >
              <Icone.setor />
              Setores
            </button>
          )}

          {podeMexer && (
            <button type="button" className="acao acao--padrao" onClick={abrirNovo}>
              <Icone.mais />
              Novo cliente
            </button>
          )}
        </header>

        {/* Filtro por setor. So aparece quando ha setor cadastrado — uma
            linha de filtro vazia so ocuparia espaco. */}
        {setores.length > 0 && (
          <div className="clientes__setores">
            <button
              type="button"
              className={`chip ${setorFiltro === null ? 'is-atual' : ''}`.trim()}
              onClick={() => setSetorFiltro(null)}
            >
              Todos
            </button>

            {setores.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${String(setorFiltro) === String(s.id) ? 'is-atual' : ''}`.trim()}
                style={{ '--tom': s.cor, '--tom-fg': '#fff' }}
                onClick={() =>
                  setSetorFiltro((atual) =>
                    String(atual) === String(s.id) ? null : String(s.id),
                  )
                }
              >
                {s.nome}
              </button>
            ))}

            {clientes.some((c) => !c.setorId) && (
              <button
                type="button"
                className={`chip ${setorFiltro === 'sem' ? 'is-atual' : ''}`.trim()}
                onClick={() => setSetorFiltro((a) => (a === 'sem' ? null : 'sem'))}
              >
                Sem setor
              </button>
            )}
          </div>
        )}

        {lista.length === 0 ? (
          <p className="clientes__vazio">
            {busca ? 'Nenhum cliente encontrado com esse termo.' : 'Nenhum cliente cadastrado.'}
          </p>
        ) : (
          <ul className="clientes__grade">
            {lista.map((cliente) => (
              <CardCliente
                key={cliente.id}
                cliente={cliente}
                numeros={contagem[cliente.id] ?? { total: 0, abertas: 0 }}
                nota={avaliacoes[cliente.id] ?? null}
                setor={setorPorId(cliente.setorId)}
                podeMexer={podeMexer}
                aoEditar={() => abrirEdicao(cliente)}
                aoApagar={() => setApagando(cliente)}
                aoVer={() => navigate('/app/obras')}
              />
            ))}
          </ul>
        )}
      </section>

      <ModalSetores aberto={modalSetores} aoFechar={() => setModalSetores(false)} />

      <ModalCliente
        aberto={modal}
        cliente={editando}
        aoFechar={() => setModal(false)}
        aoSalvar={salvar}
      />

      <Confirma
        aberto={Boolean(apagando)}
        titulo={`Apagar ${apagando?.nome ?? 'cliente'}?`}
        mensagem="O cadastro sai da lista e não dá para desfazer."
        aviso={
          (contagem[apagando?.id]?.total ?? 0) > 0
            ? `Este cliente tem ${contagem[apagando.id].total} obra(s). Elas serão apagadas junto, com as etapas, observações e avaliações.`
            : undefined
        }
        rotuloConfirmar="Apagar cliente"
        aoConfirmar={confirmarExclusao}
        aoFechar={() => setApagando(null)}
      />
    </AppShell>
  )
}

/** Duas letras do nome da empresa, para o cartao sem logo. */
function iniciais(nome) {
  return String(nome ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}

/**
 * Card do cliente, em dois estados.
 *
 * FECHADO ele e so uma linha — logo, nome e a setinha. Com muitos
 * clientes a lista fica curta e da para achar de bater o olho.
 *
 * ABERTO ele vira o cartao de quinas recortadas: a logo ocupa o topo,
 * a cidade fica na tarja vazada de baixo e a contagem de obras no selo
 * de cima. Foi o pedido: o cartao recortado e o do cliente ABERTO.
 */
function CardCliente({ cliente, numeros, nota, setor, podeMexer, aoEditar, aoApagar, aoVer }) {
  const cor = useCorDaLogo(cliente.logo, cliente.nome)
  const [aberto, setAberto] = useState(false)
  /* a lista das obras avaliadas fica fechada ate alguem pedir: o card ja
     mostra a media, e a media e o que responde "esse cliente foi bem?" */
  const [verNotas, setVerNotas] = useState(false)

  const cabeca = (
    <button
      type="button"
      className="cliente__topo"
      onClick={() => setAberto((v) => !v)}
      aria-expanded={aberto}
      title={aberto ? 'Fechar' : 'Ver endereço e obras'}
    >
      <Avatar nome={cliente.nome} foto={cliente.logo} tamanho={40} quadrado titulo={cliente.nome} />
      <h2 className="cliente__nome">{cliente.nome}</h2>
      {setor && (
        <span className="cliente__setor" style={{ '--setor-cor': setor.cor }}>
          {setor.nome}
        </span>
      )}
      <span className="cliente__seta" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>
  )

  if (!aberto) {
    return (
      <li className="cliente" style={{ '--cor-logo': cor }}>
        {cabeca}
      </li>
    )
  }

  return (
    <li>
      <CutoutCard
        className="cliente cliente--aberto"
        style={{ '--cor-logo': cor, '--corte-cor': cor }}
        destaque
      >
        <CutoutCardMedia altura={170}>
          <CutoutCardImage
            src={cliente.logo}
            alt=""
            iniciais={iniciais(cliente.nome)}
            cor={cor}
          />
          <CutoutCardOverlay />

          <CutoutCardPin>
            {/* a nota vale mais que a contagem no canto: e o primeiro numero
                que se procura ao abrir um cliente */}
            {nota ? (
              <span className="cliente__pino cliente__pino--nota">
                <Estrelas nota={nota.media} tamanho={12} />
                {nota.media.toFixed(1)}
              </span>
            ) : (
              <span className="cliente__pino">
                {numeros.total} obra{numeros.total === 1 ? '' : 's'}
              </span>
            )}
          </CutoutCardPin>

          <CutoutCardInsetLabel>
            <Icone.pino />
            {cliente.cidade}
            {cliente.estado ? `/${cliente.estado}` : ''}
          </CutoutCardInsetLabel>

          <CutoutCardAction>
            <button type="button" className="cliente__fechar" onClick={() => setAberto(false)}>
              Fechar
            </button>
          </CutoutCardAction>
        </CutoutCardMedia>

        {cabeca}

        <CutoutCardContent>
          <dl className="cliente__dados">
            <div>
              <dt>Endereço</dt>
              <dd>{cliente.endereco || '—'}</dd>
            </div>
            <div>
              <dt>Bairro</dt>
              <dd>{cliente.bairro || '—'}</dd>
            </div>
            <div>
              <dt>CEP</dt>
              <dd>{cliente.cep || '—'}</dd>
            </div>
            <div>
              <dt>Setor</dt>
              <dd>
                {setor ? (
                  <span className="cliente__setor" style={{ '--setor-cor': setor.cor }}>
                    {setor.nome}
                  </span>
                ) : (
                  <em className="cliente__semsetor">sem setor</em>
                )}
              </dd>
            </div>
          </dl>

          {/* ---------------- Avaliação do cliente ----------------

              A media de TODAS as obras avaliadas dele. Abrindo, sai de onde
              ela veio: cada obra com a data, as estrelas e o que foi
              comentado — e, quando a obra teve mais de uma nota (diretor,
              cliente, ...), as duas aparecem separadas, porque a media da
              obra sozinha esconde uma nota baixa ao lado de uma alta. */}
          <div className="clinota">
            {nota ? (
              <>
                <button
                  type="button"
                  className={`clinota__topo ${verNotas ? 'is-aberto' : ''}`.trim()}
                  onClick={() => setVerNotas((v) => !v)}
                  aria-expanded={verNotas}
                >
                  <span className="clinota__rotulo">Avaliação geral</span>
                  <Estrelas nota={nota.media} tamanho={14} />
                  <strong className="clinota__media">{nota.media.toFixed(1)}</strong>
                  <span className="clinota__quantas">
                    {nota.quantas} obra{nota.quantas === 1 ? '' : 's'} avaliada
                    {nota.quantas === 1 ? '' : 's'}
                  </span>
                  <span className="clinota__seta" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {verNotas && (
                  <ul className="clinota__obras">
                    {nota.obras.map((o) => (
                      <li key={o.id} className="clinota__obra" data-tipo={o.tipo}>
                        <p className="clinota__obratopo">
                          <strong className="clinota__obradesc">{o.descricao}</strong>
                          <span className="clinota__obradata">
                            {dataBR(String(o.criadoEm).slice(0, 10))}
                          </span>
                        </p>

                        <p className="clinota__obranota">
                          <Estrelas nota={o.avaliacao.nota} tamanho={13} />
                          <strong>{Number(o.avaliacao.nota).toFixed(1)}</strong>
                          {o.notas?.length > 1 && (
                            <em>média de {o.notas.length} avaliações</em>
                          )}
                        </p>

                        {/* cada nota separada, com o que foi comentado nela */}
                        {o.notas?.length > 0 && (
                          <ul className="clinota__linhas">
                            {o.notas.map((n) => (
                              <li key={n.id}>
                                <span className="clinota__quem">{n.rotulo}</span>
                                <span className="clinota__valor">
                                  {Number(n.nota).toFixed(1)}
                                </span>
                                {n.descricao ? (
                                  <span className="clinota__obs">{n.descricao}</span>
                                ) : (
                                  <span className="clinota__obs clinota__obs--vazia">
                                    sem observação
                                  </span>
                                )}
                                {n.avaliadaEm && (
                                  <time className="clinota__quando">
                                    {dataHora(n.avaliadaEm)}
                                  </time>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="clinota__sem">
                Nenhuma obra deste cliente foi avaliada ainda.
              </p>
            )}
          </div>
        </CutoutCardContent>

        <CutoutCardFooter>
          <span className="cliente__obras">
            <strong>{numeros.total}</strong> obra{numeros.total === 1 ? '' : 's'}
            {numeros.abertas > 0 && <em>{numeros.abertas} em andamento</em>}
          </span>

          {podeMexer && (
            <span className="cliente__botoes">
              <button type="button" onClick={aoEditar} aria-label={`Editar ${cliente.nome}`} title="Editar">
                <Icone.lapis />
              </button>
              <button type="button" onClick={aoApagar} aria-label={`Apagar ${cliente.nome}`} title="Apagar">
                <Icone.lixo />
              </button>
            </span>
          )}

          <button type="button" className="cliente__ver" onClick={aoVer}>
            Ver no quadro
          </button>
        </CutoutCardFooter>
      </CutoutCard>
    </li>
  )
}
