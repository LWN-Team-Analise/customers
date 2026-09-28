import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import { SeletorMulti } from '@/components/Seletor/Seletor'
import Seletor from '@/components/Seletor/Seletor'
import { useDados } from '@/context/DadosContext'
import {
  CATEGORIAS,
  CHAVES_CATEGORIA,
  MESES,
  rotuloDaCategoria,
  rotuloDoTipo,
} from '@/domain/despesas'
import * as despesasApi from '@/services/despesasService'
import { dataBR, dataHora, hojeISO, reais } from '@/utils/formato'
import { IconeBaixar, IconeCategoria, IconeSeta, IconeVoltar } from './icones'
import './Despesas.css'

/**
 * Meus envios — o que a pessoa ja mandou, por mes ou por ano.
 *
 *   Mensal  os envios do mes, agrupados por dia, com o total de cada
 *           dia e o total do mes no fim;
 *   Anual   os doze meses com o total de cada um, e o total do ano.
 *
 * Nenhum total e somado aqui: todos vem prontos da API, que soma no
 * banco. A tela so escreve.
 *
 * Quem tem `revisar_despesa_geral` ganha o filtro de PESSOAS: so os
 * seus, todos os usuarios, ou as pessoas que escolher. Sem a
 * permissao o filtro nem aparece — e, mais importante, a API recusa
 * qualquer pedido que nao seja dos proprios envios.
 *
 * A visao, o mes e o ano ficam no endereco (?visao=ano&ano=2026): o
 * "voltar" do navegador desfaz o clique num mes da visao anual, e o
 * link copiado abre no mesmo lugar.
 */

const DIAS_DA_SEMANA = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
]

function diaDaSemana(iso) {
  const [ano, mes, dia] = String(iso).split('-').map(Number)
  return DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? ''
}

/** '2026-09' + 1 -> '2026-10' */
function somarMes(mes, passo) {
  const [ano, m] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) + passo
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

export default function MeusEnvios() {
  const { equipe, pessoaPorId, pode } = useDados()
  const revisor = pode('revisar_despesa_geral')

  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)
  const anoAtual = Number(hoje.slice(0, 4))

  const [busca, setBusca] = useSearchParams()
  const visao = busca.get('visao') === 'ano' ? 'ano' : 'mes'
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(busca.get('mes') ?? '') ? busca.get('mes') : mesAtual
  const ano = /^\d{4}$/.test(busca.get('ano') ?? '') ? Number(busca.get('ano')) : Number(mes.slice(0, 4))

  const ir = (mudancas) => {
    const proxima = new URLSearchParams(busca)
    Object.entries(mudancas).forEach(([chave, valor]) => proxima.set(chave, String(valor)))
    setBusca(proxima)
  }

  /* ---- de quem ----
     'eu' | 'todos' | 'escolher'. Sem a permissao e sempre 'eu'. */
  const [quem, setQuem] = useState('eu')
  const [escolhidos, setEscolhidos] = useState([])
  const deQuem = revisor ? quem : 'eu'
  const usuarios =
    deQuem === 'todos' ? 'todos' : deQuem === 'escolher' ? escolhidos.map(String) : undefined
  const chaveUsuarios = Array.isArray(usuarios) ? usuarios.join(',') : usuarios ?? ''
  const faltaEscolher = deQuem === 'escolher' && escolhidos.length === 0
  /* com mais de uma pessoa na tela, cada envio mostra de quem e */
  const mostraPessoa = deQuem !== 'eu'

  /* ---- a carga ---- */
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const carga = useRef(0)

  useEffect(() => {
    if (faltaEscolher) {
      setDados(null)
      setCarregando(false)
      return
    }
    const minha = (carga.current += 1)
    setCarregando(true)
    setErro('')
    const pedido = visao === 'ano' ? despesasApi.carregarAno(ano, usuarios) : despesasApi.carregarMes(mes, usuarios)
    pedido
      .then((resposta) => {
        if (minha === carga.current) setDados({ ...resposta, visao })
      })
      .catch((e) => {
        if (minha === carga.current) {
          setDados(null)
          setErro(e.message)
        }
      })
      .finally(() => {
        if (minha === carga.current) setCarregando(false)
      })
    /* `usuarios` entra pela chave (texto): a lista em si e recriada a
       cada render, e como dependencia recarregaria sem parar */
  }, [visao, mes, ano, chaveUsuarios, faltaEscolher])

  const [anos] = useState(() => Array.from({ length: 7 }, (_, i) => anoAtual - 6 + i))
  const opcoesAno = (anos.includes(ano) ? anos : [...anos, ano].sort()).map((a) => ({
    valor: String(a),
    rotulo: String(a),
  }))

  const baixar = async (anexo) => {
    try {
      const { conteudo, nome } = await despesasApi.baixarAnexo(anexo.id)
      const link = document.createElement('a')
      link.href = conteudo
      link.download = nome
      link.click()
    } catch (e) {
      setErro(e.message)
    }
  }

  const titulo = { eu: 'Meus envios', todos: 'Envios da equipe', escolher: 'Envios por pessoa' }[deQuem]
  const [anoDoMes, numeroDoMes] = mes.split('-').map(Number)
  const periodo = visao === 'ano' ? String(ano) : `${MESES[numeroDoMes - 1]} de ${anoDoMes}`
  const noFim = visao === 'ano' ? ano >= anoAtual : mes >= mesAtual

  const valido = dados && dados.visao === visao

  return (
    <AppShell>
      <section className="envios">
        <header className="envios__topo">
          <Link to="/app/despesas" className="envios__voltar">
            <IconeVoltar />
            Despesas
          </Link>
          <h1 className="tela__titulo">{titulo}</h1>
          <p className="tela__lead">
            {visao === 'ano'
              ? 'O ano mês a mês. Clique num mês para ver os envios dele.'
              : 'Os envios do mês, dia a dia.'}
          </p>
        </header>

        {/* ---------------- filtros ---------------- */}
        <div className="envios__filtros">
          <div className="envios__visao" role="group" aria-label="Visão">
            <button
              type="button"
              className={`chip ${visao === 'mes' ? 'is-atual' : ''}`.trim()}
              onClick={() => ir({ visao: 'mes', mes: visao === 'ano' && ano !== anoDoMes ? `${ano}-01` : mes })}
            >
              Mensal
            </button>
            <button
              type="button"
              className={`chip ${visao === 'ano' ? 'is-atual' : ''}`.trim()}
              onClick={() => ir({ visao: 'ano', ano: visao === 'mes' ? anoDoMes : ano })}
            >
              Anual
            </button>
          </div>

          <div className="envios__periodo">
            <button
              type="button"
              className="envios__passo"
              onClick={() => (visao === 'ano' ? ir({ ano: ano - 1 }) : ir({ mes: somarMes(mes, -1) }))}
              aria-label={visao === 'ano' ? 'Ano anterior' : 'Mês anterior'}
            >
              <IconeSeta lado="esquerda" />
            </button>

            {visao === 'mes' && (
              <Seletor
                valor={String(numeroDoMes)}
                aoMudar={(m) => ir({ mes: `${anoDoMes}-${String(m).padStart(2, '0')}` })}
                opcoes={MESES.map((nome, i) => ({ valor: String(i + 1), rotulo: nome }))}
                aria-label="Mês"
              />
            )}
            <Seletor
              valor={String(visao === 'ano' ? ano : anoDoMes)}
              aoMudar={(a) =>
                visao === 'ano' ? ir({ ano: a }) : ir({ mes: `${a}-${String(numeroDoMes).padStart(2, '0')}` })
              }
              opcoes={opcoesAno}
              aria-label="Ano"
            />

            <button
              type="button"
              className="envios__passo"
              onClick={() => (visao === 'ano' ? ir({ ano: ano + 1 }) : ir({ mes: somarMes(mes, 1) }))}
              disabled={noFim}
              aria-label={visao === 'ano' ? 'Próximo ano' : 'Próximo mês'}
            >
              <IconeSeta lado="direita" />
            </button>
          </div>

          {revisor && (
            <div className="envios__quem">
              <div className="envios__quemchips" role="group" aria-label="De quem">
                <button
                  type="button"
                  className={`chip ${deQuem === 'eu' ? 'is-atual' : ''}`.trim()}
                  onClick={() => setQuem('eu')}
                >
                  Só os meus
                </button>
                <button
                  type="button"
                  className={`chip ${deQuem === 'todos' ? 'is-atual' : ''}`.trim()}
                  onClick={() => setQuem('todos')}
                >
                  Todos os usuários
                </button>
                <button
                  type="button"
                  className={`chip ${deQuem === 'escolher' ? 'is-atual' : ''}`.trim()}
                  onClick={() => setQuem('escolher')}
                >
                  Escolher pessoas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* a lista de pessoas ganha uma linha propria: dentro da barra de
            filtros ela empurrava as pastilhas para o meio da tela */}
        {revisor && deQuem === 'escolher' && (
          <div className="envios__pessoasfiltro">
            <SeletorMulti
              largo
              valores={escolhidos}
              aoMudar={setEscolhidos}
              opcoes={equipe.map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
              vazio="Escolha uma ou mais pessoas..."
              aria-label="Pessoas"
            />
          </div>
        )}

        {erro && (
          <p className="envios__erro" role="alert">
            {erro}
          </p>
        )}

        {faltaEscolher ? (
          <p className="envios__vazio">Escolha ao menos uma pessoa para ver os envios.</p>
        ) : !valido ? (
          !erro && <p className="envios__vazio">Carregando...</p>
        ) : (
          <div className={`envios__conteudo ${carregando ? 'is-carregando' : ''}`.trim()} aria-busy={carregando}>
            <Resumo dados={dados} periodo={periodo} visao={visao} />

            {mostraPessoa && dados.pessoas.length > 0 && (
              <PorPessoa pessoas={dados.pessoas} pessoaPorId={pessoaPorId} visao={visao} />
            )}

            {visao === 'mes' ? (
              <Mes dados={dados} periodo={periodo} mostraPessoa={mostraPessoa} pessoaPorId={pessoaPorId} aoBaixar={baixar} />
            ) : (
              <Ano dados={dados} aoAbrirMes={(m) => ir({ visao: 'mes', mes: `${ano}-${String(m).padStart(2, '0')}` })} />
            )}

            <footer className="envios__rodape">
              <span>{visao === 'ano' ? 'Total anual' : 'Total do mês'}</span>
              <strong>{reais(dados.total)}</strong>
            </footer>
          </div>
        )}
      </section>
    </AppShell>
  )
}

/** O total do periodo e a divisao por categoria. */
function Resumo({ dados, periodo, visao }) {
  return (
    <div className="envios__resumo">
      <div className="envios__total">
        <span>{visao === 'ano' ? `Total de ${periodo}` : periodo}</span>
        <strong>{reais(dados.total)}</strong>
        <em>{plural(dados.quantidade, 'envio', 'envios')}</em>
      </div>
      {CHAVES_CATEGORIA.map((categoria) => {
        const parte = dados.categorias?.[categoria]
        return (
          <div key={categoria} className="envios__cat" data-categoria={categoria}>
            <span className="envios__caticone" aria-hidden="true">
              <IconeCategoria categoria={categoria} tamanho={18} />
            </span>
            <span className="envios__catnome">{CATEGORIAS[categoria].plural}</span>
            <strong>{reais(parte?.total ?? 0)}</strong>
            <em>{plural(parte?.quantidade ?? 0, 'envio', 'envios')}</em>
          </div>
        )
      })}
    </div>
  )
}

/** Total de cada pessoa no periodo — so quando ha mais de uma na tela. */
function PorPessoa({ pessoas, pessoaPorId, visao }) {
  return (
    <section className="envios__porpessoa" aria-label="Total por pessoa">
      <h2 className="envios__subtitulo">Por pessoa {visao === 'ano' ? 'no ano' : 'no mês'}</h2>
      <ul>
        {pessoas.map((p) => (
          <li key={p.usuarioId}>
            <Avatar nome={p.nome} foto={pessoaPorId(p.usuarioId)?.foto} tamanho={28} />
            <span className="envios__pnome">{p.nome}</span>
            <em>{plural(p.quantidade, 'envio', 'envios')}</em>
            <strong>{reais(p.total)}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Visao mensal: um bloco por dia, na ordem do calendario. */
function Mes({ dados, periodo, mostraPessoa, pessoaPorId, aoBaixar }) {
  const porDia = useMemo(() => {
    const mapa = new Map()
    dados.envios.forEach((e) => {
      const lista = mapa.get(e.data) ?? []
      lista.push(e)
      mapa.set(e.data, lista)
    })
    return mapa
  }, [dados.envios])

  if (dados.dias.length === 0) {
    return <p className="envios__vazio">Nenhum envio em {periodo.toLowerCase()}.</p>
  }

  return (
    <div className="envios__dias">
      {dados.dias.map((dia) => (
        <section key={dia.data} className="envios__dia">
          <header className="envios__diatopo">
            <h2>
              {dataBR(dia.data)} <span>{diaDaSemana(dia.data)}</span>
            </h2>
            <strong>{reais(dia.total)}</strong>
          </header>
          <ul className="envios__lista">
            {(porDia.get(dia.data) ?? []).map((envio) => (
              <ItemEnvio
                key={envio.id}
                envio={envio}
                mostraPessoa={mostraPessoa}
                foto={pessoaPorId(envio.usuarioId)?.foto}
                aoBaixar={aoBaixar}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ItemEnvio({ envio, mostraPessoa, foto, aoBaixar }) {
  const obra = envio.obraId
    ? [envio.clienteNome || 'Cliente removido', envio.obraProposta].filter(Boolean).join(' · ')
    : 'Obra excluída'

  return (
    <li className="envio" data-categoria={envio.categoria}>
      {mostraPessoa && (
        <Avatar nome={envio.usuarioNome} foto={foto} tamanho={34} titulo={envio.usuarioNome} className="envio__avatar" />
      )}

      <div className="envio__corpo">
        {mostraPessoa && <strong className="envio__pessoa">{envio.usuarioNome}</strong>}
        <span className="envio__titulo">
          <span className="envio__selo" data-categoria={envio.categoria}>
            {rotuloDaCategoria(envio.categoria)}
          </span>
          {rotuloDoTipo(envio.tipo)}
        </span>
        <span className={`envio__obra ${envio.obraId ? '' : 'is-removida'}`.trim()}>
          {obra}
          {envio.obraConcluida && <em> (concluída)</em>}
        </span>
        {envio.justificativa && (
          <span className="envio__texto">
            <b>Justificativa:</b> {envio.justificativa}
          </span>
        )}
        {envio.observacao && (
          <span className="envio__texto">
            <b>Observação:</b> {envio.observacao}
          </span>
        )}
        <span className="envio__meta">Enviado em {dataHora(envio.criadoEm)}</span>
      </div>

      <div className="envio__lado">
        <strong className="envio__valor">{reais(envio.valor)}</strong>
        {envio.anexos.map((anexo) => (
          <button
            key={anexo.id}
            type="button"
            className="envio__anexo"
            onClick={() => aoBaixar(anexo)}
            title={`Baixar ${anexo.nome}`}
          >
            <IconeBaixar />
            <span>{anexo.nome}</span>
          </button>
        ))}
      </div>
    </li>
  )
}

/** Visao anual: os doze meses, cada um com o seu total. */
function Ano({ dados, aoAbrirMes }) {
  return (
    <ul className="envios__meses">
      {dados.meses.map((m) => {
        const partes = CHAVES_CATEGORIA.filter((c) => m.categorias?.[c]?.quantidade > 0)
        return (
          <li key={m.mes}>
            <button
              type="button"
              className={`envios__mes ${m.quantidade === 0 ? 'is-vazio' : ''}`.trim()}
              onClick={() => aoAbrirMes(m.mes)}
            >
              <span className="envios__mesnome">{MESES[m.mes - 1]}</span>
              <span className="envios__mesdetalhe">
                {partes.length === 0
                  ? 'Nenhum envio'
                  : partes
                      .map((c) => `${CATEGORIAS[c].plural} ${reais(m.categorias[c].total)}`)
                      .join(' · ')}
              </span>
              <span className="envios__mestotal">
                Total: <strong>{reais(m.total)}</strong>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
