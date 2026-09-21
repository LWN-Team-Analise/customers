import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import IconeClima from '@/components/Clima/IconeClima'
import Globo from '@/components/Globo/Globo'
import { useAuth } from '@/context/AuthContext'
import { useDados } from '@/context/DadosContext'
import { useTheme } from '@/context/ThemeContext'
import { rotuloPrioridadeObra, tituloDaObra, tomPrioridadeObra } from '@/domain/obras'
import { coordenadaDoCliente } from '@/domain/geo'
import useClima, { familiaDoTempo, nomeDoTempo } from '@/hooks/useClima'
import { dataBR, dataHora, hojeISO } from '@/utils/formato'
import useTarefas from './useTarefas'
import Painel from './Painel'
import './Home.css'

const Icone = {
  grade: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </svg>
  ),
  quadro: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M9.5 4v16M15 4v16" />
    </svg>
  ),
  painel: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  ok: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  ),
  relogio: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  ),
  cadeado: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </svg>
  ),
}

/**
 * O tempo agora, em Santana (SP), com a temperatura por cima.
 *
 * Aqui havia um sol desenhado, fixo — e num dia de chuva ele mentia.
 * Agora o icone e o tempo de verdade (ver `useClima`), e a pastilha
 * com a temperatura SOBREPOE o canto superior direito dele: o desenho
 * responde "como esta la fora" de relance, e o numero e o detalhe de
 * quem parou para olhar.
 *
 * Enquanto a resposta nao chega — ou quando o servico esta fora — sai
 * so o desenho neutro, sem pastilha. O dia da pessoa nao pode depender
 * de um servico de previsao do tempo.
 */
function Clima() {
  const clima = useClima()

  const familia = clima ? familiaDoTempo(clima.codigo, clima.dia) : 'sol-nuvem'
  const nome = clima
    ? `${nomeDoTempo(clima.codigo)} em Santana, São Paulo — ${clima.temperatura}°C`
    : 'Carregando o tempo em Santana, São Paulo'

  return (
    <div className="clima">
      <IconeClima familia={familia} titulo={nome} tamanho={54} />

      {clima && (
        <p className="clima__selo">
          <span className="clima__agora">{clima.temperatura}°</span>
          <span className="clima__faixa">
            <span className="clima__max" title="Máxima de hoje">
              ↑{clima.maxima}°
            </span>
            <span className="clima__min" title="Mínima de hoje">
              ↓{clima.minima}°
            </span>
          </span>
        </p>
      )}
    </div>
  )
}

const SAUDACAO = (hora) => {
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

const DIAS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.']
const MESES = ['JAN.', 'FEV.', 'MAR.', 'ABR.', 'MAI.', 'JUN.', 'JUL.', 'AGO.', 'SET.', 'OUT.', 'NOV.', 'DEZ.']

/**
 * O mes que a tela esta olhando.
 *
 * `{ ano, mes }` — `mes` de 0 a 11, como no Date. As setas andam um
 * mes para tras ou para a frente; a virada de ano sai de graca porque
 * `new Date(ano, mes - 1)` normaliza sozinho.
 *
 * O que ele filtra: SO o que tem data. A coluna de concluidas do
 * Quadro e os graficos do Dashboard passam por ele. A Grade e as duas
 * primeiras colunas do Quadro nao — "o que falta fazer" e sempre
 * hoje, e filtrar pendencia por mes esconderia trabalho atrasado
 * justamente de quem foi procurar o mes passado.
 */
function mesDe(ano, mes) {
  const d = new Date(ano, mes, 1)
  const agora = new Date()
  return {
    ano: d.getFullYear(),
    mes: d.getMonth(),
    /* 'AAAA-MM' — comparar por texto evita Date e fuso na filtragem */
    chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    rotulo: `${MESES[d.getMonth()].replace('.', '')} ${d.getFullYear()}`,
    atual: d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth(),
    /* nao ha o que ver no futuro: nada foi concluido ainda */
    podeAvancar: d < new Date(agora.getFullYear(), agora.getMonth(), 1),
  }
}

/** 'AAAA-MM' de um carimbo, para casar com `mes.chave`. */
function mesDoCarimbo(valor) {
  if (!valor) return null
  const t = String(valor)
  if (/^\d{4}-\d{2}/.test(t)) return t.slice(0, 7)
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** As setas de mes: < SET 2026 > */
function SeletorMes({ mes, aoMudar }) {
  return (
    <div className="mes" role="group" aria-label="Mês em exibição">
      <button
        type="button"
        onClick={() => aoMudar(mesDe(mes.ano, mes.mes - 1))}
        aria-label="Mês anterior"
        title="Mês anterior"
      >
        ‹
      </button>

      <span className="mes__rotulo" data-atual={mes.atual ? 'sim' : undefined}>
        {mes.rotulo}
      </span>

      <button
        type="button"
        onClick={() => aoMudar(mesDe(mes.ano, mes.mes + 1))}
        disabled={!mes.podeAvancar}
        aria-label="Mês seguinte"
        title={mes.podeAvancar ? 'Mês seguinte' : 'Este já é o mês atual'}
      >
        ›
      </button>
    </div>
  )
}

/* A ordem e a leitura do quadro: primeiro o que esta acontecendo, depois
   o que ainda espera a vez, por fim o que ja saiu.

   "Em andamento" sao as etapas ABERTAS — o que da para tocar hoje.
   "Não iniciado" sao as etapas futuras, travadas esperando outro cargo
   fechar a dele; e por isso que a coluna vem depois, e nao antes: ela
   nao pede acao de ninguem, so explica quem esta segurando a fila. */
const COLUNAS = [
  { id: 'andamento', rotulo: 'Em andamento', Glifo: Icone.relogio },
  { id: 'espera', rotulo: 'Não iniciado', Glifo: Icone.cadeado },
  { id: 'concluida', rotulo: 'Concluída', Glifo: Icone.ok },
]

/**
 * Pagina inicial — o "meu dia" do sistema.
 *
 * Tres modos de olhar a MESMA lista de tarefas, e a tarefa aqui e o
 * CHECK de uma obra (ver `useTarefas`):
 *
 *   Grade      — a tabela do que precisa ser feito, em ordem de urgencia;
 *   Quadro     — as mesmas tarefas em tres colunas, por estado;
 *   Dashboard  — os numeros que a lista sozinha nao mostra: quanto tempo
 *                uma obra leva, quanto tempo cada setor leva, e o quanto
 *                as entregas chegam antes ou depois do prazo.
 *
 * Nao ha "adicionar tarefa" em lugar nenhum, e isso e proposital: tarefa
 * solta nao teria obra onde ser marcada nem quem a cobrasse. Quem cria
 * tarefa e quem monta o roteiro da obra.
 */
export default function Home() {
  const { user } = useAuth()
  const { nomeDoCargo, corDoCargo, pessoaPorId, etapaDaObra, pendentesDaObra } = useDados()
  const navigate = useNavigate()
  const tarefas = useTarefas()

  const [aba, setAba] = useState('grade')
  /* o passo do Dashboard mora aqui porque o seletor dele vive na barra
     de abas, ao lado de Grade/Quadro/Dashboard */
  const [passo, setPasso] = useState('mes')
  const [mes, setMes] = useState(() => {
    const agora = new Date()
    return mesDe(agora.getFullYear(), agora.getMonth())
  })
  /* "minhas" = so o que e do meu setor. Quem nao tem setor, ou quem nao
     tem tarefa nenhuma no dele, ve tudo — senao a tela abre vazia e
     parece quebrada. */
  const [escopo, setEscopo] = useState('minhas')

  const temMinhas = useMemo(() => tarefas.some((t) => t.minha), [tarefas])
  const soMinhas = escopo === 'minhas' && temMinhas

  const visiveis = useMemo(
    () => (soMinhas ? tarefas.filter((t) => t.minha) : tarefas),
    [tarefas, soMinhas],
  )

  const hoje = hojeISO()

  /**
   * A ordem da lista: o que aperta primeiro.
   *
   * Prazo vencido na frente de tudo, depois prioridade, depois o prazo
   * mais proximo. Ordenar por nome ou por obra deixaria a emergencia
   * atrasada no meio da lista, que e exatamente onde ela nao pode estar.
   */
  const porUrgencia = useMemo(() => {
    const peso = { emergencia: 4, alta: 3, media: 2, baixa: 1 }
    const nota = (t) => (t.obra.tipo === 'emergencia' ? 4 : peso[t.obra.prioridade] ?? 0)

    return [...visiveis].sort((a, b) => {
      const venceA = a.obra.dataConclusao && a.obra.dataConclusao < hoje ? 1 : 0
      const venceB = b.obra.dataConclusao && b.obra.dataConclusao < hoje ? 1 : 0
      if (venceA !== venceB) return venceB - venceA
      if (nota(a) !== nota(b)) return nota(b) - nota(a)
      const prazoA = a.obra.dataConclusao ?? '9999-12-31'
      const prazoB = b.obra.dataConclusao ?? '9999-12-31'
      return prazoA.localeCompare(prazoB)
    })
  }, [visiveis, hoje])

  /**
   * O que falta AGORA: so a etapa que ja abriu e ainda nao fechou.
   *
   * O que esta preso na etapa seguinte fica de fora da Grade. Nao ha
   * o que fazer com ele hoje, e uma lista de afazeres que mistura o
   * que da para fazer com o que nao da deixa de ser lista de
   * afazeres — vira inventario do roteiro.
   *
   * Em "Todas" entram os checks dos OUTROS setores tambem, e eles vem
   * depois dos seus: primeiro o que voce pode marcar, depois o que
   * voce so acompanha. Misturados pela urgencia, o seu unico check do
   * dia acabava no meio de trinta que nao sao seus.
   */
  const faltando = useMemo(() => {
    const abertas = porUrgencia.filter((t) => t.status === 'andamento')
    return [...abertas].sort((a, b) => Number(b.posso) - Number(a.posso))
  }, [porUrgencia])

  const vencidas = faltando.filter(
    (t) => t.obra.dataConclusao && t.obra.dataConclusao < hoje,
  ).length

  /**
   * O que o Quadro enxerga, ja com o mes aplicado.
   *
   * O filtro pega SO as concluidas: o que esta pendente nao tem mes —
   * ele esta pendente hoje, e some-lo do quadro porque alguem foi
   * olhar agosto esconderia justamente o trabalho atrasado.
   */
  const doMes = useMemo(
    () =>
      porUrgencia.filter(
        (t) => t.status !== 'concluida' || mesDoCarimbo(t.feitoEm) === mes.chave,
      ),
    [porUrgencia, mes.chave],
  )

  const agora = new Date()
  const primeiroNome = String(user?.name ?? '').trim().split(/\s+/)[0]

  return (
    <AppShell>
      <section className="inicio">
        {/* ---------------- a faixa do dia ---------------- */}
        <header className="dia vidro">
          <p className="dia__data">
            <span className="dia__semana">{DIAS[agora.getDay()]}</span>
            <strong className="dia__numero">{String(agora.getDate()).padStart(2, '0')}</strong>
            <span className="dia__mes">{MESES[agora.getMonth()]}</span>
          </p>

          <Clima />

          <div className="dia__texto">
            <h1 className="dia__ola">
              {SAUDACAO(agora.getHours())}
              {primeiroNome ? `, ${primeiroNome}` : ''}
            </h1>
            <p className="dia__frase">
              {faltando.length === 0
                ? 'Nenhuma tarefa pendente hoje'
                : `Você tem ${faltando.length} tarefa${
                    faltando.length > 1 ? 's' : ''
                  } para fazer agora.`}
            </p>
          </div>

          <p className="dia__resumo" data-alerta={vencidas > 0 ? 'sim' : undefined}>
            {faltando.length === 0
              ? 'Nenhuma tarefa pendente'
              : `${faltando.length} tarefa${faltando.length > 1 ? 's' : ''} pendente${
                  faltando.length > 1 ? 's' : ''
                }`}
            {vencidas > 0 && (
              <em>
                {vencidas} com prazo vencido
              </em>
            )}
          </p>
        </header>

        {/* ---------------- abas + escopo ---------------- */}
        <div className="inicio__barra">
          <nav className="abas" role="tablist" aria-label="Modo de visualização">
            {[
              { id: 'grade', rotulo: 'Grade', Glifo: Icone.grade },
              { id: 'quadro', rotulo: 'Quadro', Glifo: Icone.quadro },
              { id: 'painel', rotulo: 'Dashboard', Glifo: Icone.painel },
            ].map(({ id, rotulo, Glifo }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className={`abas__aba ${aba === id ? 'is-atual' : ''}`.trim()}
                onClick={() => setAba(id)}
              >
                <Glifo />
                {rotulo}
              </button>
            ))}
          </nav>

          {/* O mês fica no meio, entre as abas e o Minhas/Todas. Ele
              filtra só o que TEM data: a coluna de concluídas do Quadro
              e os gráficos do Dashboard. */}
          <SeletorMes mes={mes} aoMudar={setMes} />

          {/* o passo do Dashboard entra na MESMA linha das abas: ele é
              um modo de olhar, como elas, e não um controle de dentro
              de um cartão */}
          {aba === 'painel' && (
            <div className="escopo" role="group" aria-label="Passo do tempo">
              <button
                type="button"
                className={passo === 'mes' ? 'is-atual' : ''}
                onClick={() => setPasso('mes')}
                title="O mês escolhido, dia a dia"
              >
                Diário
              </button>
              <button
                type="button"
                className={passo === 'ano' ? 'is-atual' : ''}
                onClick={() => setPasso('ano')}
                title="De janeiro até o mês escolhido, mês a mês"
              >
                Mensal
              </button>
            </div>
          )}

          {/* o Dashboard olha a empresa inteira: filtrar por setor ali
              daria uma média de uma pessoa só, que não é média nenhuma */}
          {aba !== 'painel' && temMinhas && (
            <div className="escopo" role="group" aria-label="De quem são as tarefas">
              <button
                type="button"
                className={escopo === 'minhas' ? 'is-atual' : ''}
                onClick={() => setEscopo('minhas')}
              >
                Minhas
              </button>
              <button
                type="button"
                className={escopo === 'todas' ? 'is-atual' : ''}
                onClick={() => setEscopo('todas')}
              >
                Todas
              </button>
            </div>
          )}
        </div>

        {/* A Grade e as duas primeiras colunas do Quadro são sempre
            HOJE: pendência não tem mês. Quando o mês escolhido não é o
            corrente, o aviso evita a leitura errada de que a lista
            também voltou no tempo. */}
        {!mes.atual && aba !== 'painel' && (
          <p className="inicio__nota" role="status">
            O que está pendente é sempre de hoje — {mes.rotulo.toLowerCase()} filtra apenas o
            que já foi concluído.
          </p>
        )}

        {aba === 'grade' && (
          <Grade
            tarefas={faltando}
            hoje={hoje}
            nomeDoCargo={nomeDoCargo}
            corDoCargo={corDoCargo}
            aoAbrir={(alvo) => navigate(`/app/obras/${alvo.obra.id}`)}
          />
        )}

        {aba === 'quadro' && (
          <Quadro
            tarefas={doMes}
            hoje={hoje}
            mes={mes}
            nomeDoCargo={nomeDoCargo}
            corDoCargo={corDoCargo}
            pessoaPorId={pessoaPorId}
            aoAbrir={(t) => navigate(`/app/obras/${t.obra.id}`)}
          />
        )}

        {aba === 'painel' && <Painel mes={mes} passo={passo} />}
      </section>
    </AppShell>
  )
}

/** O nome curto da obra no card e na linha: proposta ou empresa. */
const daObra = (t) =>
  [t.obra.proposta, t.cliente?.nome].filter(Boolean).join(' — ') || 'Obra sem nome'

/** Etiquetas dos setores donos da tarefa. */
function Setores({ cargos, nomeDoCargo, corDoCargo }) {
  return (
    <span className="tsetores">
      {cargos.map((c) => (
        <span key={c} className="tsetores__um" style={{ '--setor-cor': corDoCargo(c) }}>
          {nomeDoCargo(c)}
        </span>
      ))}
    </span>
  )
}

/**
 * O prazo da obra, com o tom certo.
 *
 * Vencido e vermelho; hoje e amarelo; o resto e texto comum. Obra sem
 * data de conclusao mostra um traco — dizer "sem prazo" em toda linha
 * so encheria a coluna de ruido.
 */
function Prazo({ iso, hoje }) {
  if (!iso) return <span className="tprazo tprazo--vazio">—</span>
  const tom = iso < hoje ? 'vencido' : iso === hoje ? 'hoje' : 'normal'
  return (
    <span className="tprazo" data-tom={tom}>
      {dataBR(iso)}
      {tom === 'vencido' && <em>vencido</em>}
      {tom === 'hoje' && <em>hoje</em>}
    </span>
  )
}

/* ============================================================
   GRADE — o que da para fazer AGORA

   Duas coisas entram, e so essas duas:

   1. os checks da etapa que ja abriu e ainda nao foram marcados —
      o que falta de verdade hoje;
   2. uma linha por obra onde nada falta para voce, dizendo o que
      aconteceu (a sua parte fechou, ou a sua vez ainda nao chegou) e
      QUEM esta segurando a passagem para a proxima etapa.

   Fica de fora o que esta preso em etapa futura: nao ha o que fazer
   com ele hoje. E fica de fora o que ja foi marcado — uma tabela que
   cresce com tudo o que terminou para de responder "o que falta" na
   terceira obra. Esses dois moram no Quadro, que e a aba do estado.
   ============================================================ */

function Grade({ tarefas, hoje, nomeDoCargo, corDoCargo, aoAbrir }) {
  if (tarefas.length === 0) {
    return (
      <Vazio titulo="Nada pendente por aqui" arte="globo" />
    )
  }

  return (
    <div className="grade vidro">
      <table className="grade__tabela">
        <thead>
          <tr>
            <th scope="col">Tarefa</th>
            <th scope="col">Obra</th>
            <th scope="col">Etapa</th>
            {/* a coluna do setor vai CENTRADA: as etiquetas tem
                larguras muito diferentes ("GQ" ao lado de "Garantia da
                Qualidade"), e encostadas a esquerda elas formavam uma
                borda irregular no meio da tabela */}
            <th scope="col" className="grade__setor">Setor</th>
            <th scope="col">Prioridade</th>
            <th scope="col">Prazo</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {tarefas.map((t) =>
            /* UMA lista, duas leituras. A linha que voce pode marcar
               abre a obra no clique; a dos outros setores traz a mesma
               informacao — nome do check, obra, etapa, setor, prazo —,
               so que travada, com o cadeado no lugar do botao.

               Antes as travadas eram uma lista a parte, e so entravam
               quando a obra nao tinha nada para voce. Em "Todas" isso
               dava o efeito errado: os checks dos outros setores
               apareciam como se fossem seus de marcar, e a aba ficava
               igual a "Minhas". */
            t.posso ? (
              /* A linha inteira responde ao clique, por conveniencia do
                 mouse. O caminho de TECLADO e o botao do primeiro campo:
                 um <tr> com tabindex e role=link quebra a leitura da
                 tabela para quem usa leitor de tela, e a linha deixaria
                 de ser uma linha. */
              <tr
                key={t.id}
                className="grade__linha"
                onClick={() => aoAbrir(t)}
                title={`Abrir ${daObra(t)}`}
              >
                <td className="grade__tarefa">
                  <button
                    type="button"
                    className="grade__link"
                    onClick={(e) => {
                      e.stopPropagation()
                      aoAbrir(t)
                    }}
                  >
                    {t.titulo}
                  </button>
                </td>
                <td data-rotulo="Obra">
                  <span className="grade__obra" data-tipo={t.obra.tipo}>
                    {daObra(t)}
                  </span>
                </td>
                <td className="grade__etapa" data-rotulo="Etapa">
                  {t.etapaNome || `${t.etapaNumero}ª`}
                  {t.cardTitulo && <em>{t.cardTitulo}</em>}
                </td>
                <td className="grade__setor" data-rotulo="Setor">
                  <Setores cargos={t.cargos} nomeDoCargo={nomeDoCargo} corDoCargo={corDoCargo} />
                </td>
                <td data-rotulo="Prioridade">
                  <span className="tpri" data-pri={tomPrioridadeObra(t.obra)}>
                    {rotuloPrioridadeObra(t.obra)}
                  </span>
                </td>
                <td data-rotulo="Prazo">
                  <Prazo iso={t.obra.dataConclusao} hoje={hoje} />
                </td>
                <td data-rotulo="Estado">
                  <span className="testado" data-estado="andamento">
                    Em andamento
                  </span>
                </td>
              </tr>
            ) : (
              <tr
                key={t.id}
                className="grade__linha grade__linha--espera"
                aria-disabled="true"
                title="Esta tarefa é de outro setor"
              >
                <td className="grade__tarefa">
                  <span className="grade__travada">
                    <Icone.cadeado />
                    {t.titulo}
                  </span>
                </td>
                <td data-rotulo="Obra">
                  <span className="grade__obra" data-tipo={t.obra.tipo}>
                    {daObra(t)}
                  </span>
                </td>
                <td className="grade__etapa" data-rotulo="Etapa">
                  {t.etapaNome || `${t.etapaNumero}ª`}
                  {t.cardTitulo && <em>{t.cardTitulo}</em>}
                </td>
                <td className="grade__setor" data-rotulo="Setor">
                  <Setores cargos={t.cargos} nomeDoCargo={nomeDoCargo} corDoCargo={corDoCargo} />
                </td>
                <td data-rotulo="Prioridade">
                  <span className="tpri" data-pri={tomPrioridadeObra(t.obra)}>
                    {rotuloPrioridadeObra(t.obra)}
                  </span>
                </td>
                <td data-rotulo="Prazo">
                  <Prazo iso={t.obra.dataConclusao} hoje={hoje} />
                </td>
                <td data-rotulo="Estado">
                  <span className="testado" data-estado="espera">
                    Aguardando
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ============================================================
   QUADRO — as mesmas tarefas em tres colunas

   Nao ha "adicionar tarefa" no pe das colunas: a tarefa nasce no
   roteiro da obra, nao aqui.

   Nao ha arrastar entre colunas pelo mesmo motivo. A coluna nao e
   uma escolha, e uma consequencia: "Em andamento" quer dizer que a
   etapa abriu, e "Concluida" que alguem marcou o check. Arrastar um
   card para "Concluida" seria marcar o check pelas costas do
   controle de quem pode marcar o que — a marcacao continua sendo na
   tela da obra, onde essa regra vive.
   ============================================================ */

function Quadro({ tarefas, hoje, mes, nomeDoCargo, corDoCargo, pessoaPorId, aoAbrir }) {
  const porColuna = useMemo(() => {
    const mapa = { espera: [], andamento: [], concluida: [] }
    tarefas.forEach((t) => mapa[t.status]?.push(t))
    return mapa
  }, [tarefas])

  /**
   * A coluna do que ja foi, agrupada por CARD.
   *
   * Antes cada check virava um card solto na coluna, e um card de
   * seis checks enchia a coluna com seis retangulos que contavam a
   * mesma historia. Agora o que aparece e o CARD — "Comercial" — com
   * os checks dele dentro, cada um com a hora em que foi marcado.
   *
   * A hora do CARD e a do ultimo check dele: e o instante em que
   * aquele setor terminou de fato. Card ainda pela metade entra na
   * mesma lista, marcado com o placar ("3 de 5"): esconde-lo faria o
   * trabalho ja feito sumir da tela sem ter para onde ir.
   *
   * Ordem: o que fechou por ultimo em cima. Esta coluna se le de tras
   * para frente — o que interessa e o que acabou de sair.
   */
  const cards = useMemo(() => {
    const mapa = new Map()

    porColuna.concluida.forEach((t) => {
      const chave = `${t.obra.id}:${t.cardId}`
      const grupo = mapa.get(chave) ?? {
        chave,
        obra: t.obra,
        cliente: t.cliente,
        etapaNome: t.etapaNome,
        etapaNumero: t.etapaNumero,
        titulo: t.cardTitulo || t.cardCargos.map((c) => nomeDoCargo(c)).join(' + ') || 'Card',
        cargos: t.cardCargos.length > 0 ? t.cardCargos : t.cargos,
        total: t.cardTotal,
        checks: [],
      }
      grupo.checks.push(t)
      mapa.set(chave, grupo)
    })

    return [...mapa.values()]
      .map((g) => {
        const checks = [...g.checks].sort((a, b) =>
          String(a.feitoEm ?? '').localeCompare(String(b.feitoEm ?? '')),
        )
        return {
          ...g,
          checks,
          /* o card fechou quando o ultimo check dele foi marcado */
          fechadoEm: checks.length === g.total ? checks[checks.length - 1]?.feitoEm : null,
          ultimo: checks[checks.length - 1]?.feitoEm ?? null,
        }
      })
      .sort((a, b) => String(b.ultimo ?? '').localeCompare(String(a.ultimo ?? '')))
  }, [porColuna.concluida, nomeDoCargo])

  if (tarefas.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma tarefa por aqui"
        texto="As tarefas vêm dos checks das obras abertas. Assim que houver uma, ela aparece nestas colunas."
      />
    )
  }

  return (
    <div className="quadrot">
      {COLUNAS.map(({ id, rotulo, Glifo }) => (
        <section key={id} className="colunat" data-coluna={id}>
          <header className="colunat__topo">
            <Glifo />
            <h2>{rotulo}</h2>
            <span className="colunat__conta">{porColuna[id].length}</span>
          </header>

          <div className="colunat__pilha">
            {(id === 'concluida' ? cards.length : porColuna[id].length) === 0 && (
              <p className="colunat__vazio">
                {id === 'espera'
                  ? 'Nada esperando etapa anterior.'
                  : id === 'andamento'
                    ? 'Nada em andamento.'
                    : mes.atual
                      ? 'Nada concluído ainda.'
                      : `Nada concluído em ${mes.rotulo}.`}
              </p>
            )}

            {/* ---- concluídas: um card, com os checks dentro ---- */}
            {id === 'concluida' &&
              cards.map((c) => (
                <article
                  key={c.chave}
                  className="cardfeito"
                  data-parcial={c.fechadoEm ? undefined : 'sim'}
                  onClick={() => aoAbrir(c.checks[0])}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      aoAbrir(c.checks[0])
                    }
                  }}
                  title={`Abrir ${daObra(c.checks[0])}`}
                >
                  <p className="cardfeito__topo">
                    <strong>{c.titulo}</strong>
                    <span className="cardfeito__placar">
                      {c.checks.length}/{c.total}
                    </span>
                  </p>

                  <p className="tcard__obra" data-tipo={c.obra.tipo}>
                    <Avatar
                      nome={c.cliente?.nome}
                      foto={c.cliente?.logo}
                      tamanho={18}
                      quadrado
                    />
                    {daObra(c.checks[0])}
                  </p>

                  <p className="tcard__meio">
                    <span className="tcard__etapa">
                      {c.etapaNome || `${c.etapaNumero}ª etapa`}
                    </span>
                    <Setores
                      cargos={c.cargos}
                      nomeDoCargo={nomeDoCargo}
                      corDoCargo={corDoCargo}
                    />
                  </p>

                  {/* cada check, com a hora em que foi marcado e por quem */}
                  <ul className="cardfeito__checks">
                    {c.checks.map((t) => {
                      const quem = t.feitoPor ? pessoaPorId(t.feitoPor) : null
                      return (
                        <li key={t.id}>
                          <span className="cardfeito__ok" aria-hidden="true">
                            <Icone.ok />
                          </span>
                          <span className="cardfeito__nome">{t.titulo}</span>
                          <span className="cardfeito__quando">
                            {dataHora(t.feitoEm)}
                            {quem && <em>{quem.nome}</em>}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  {/* o card fechou, ou ainda falta parte dele */}
                  <p className="cardfeito__pe">
                    {c.fechadoEm ? (
                      <>
                        <Icone.ok />
                        Card concluído em {dataHora(c.fechadoEm)}
                      </>
                    ) : (
                      <>
                        Faltam {c.total - c.checks.length} check
                        {c.total - c.checks.length > 1 ? 's' : ''} neste card
                      </>
                    )}
                  </p>
                </article>
              ))}

            {/* ---- não iniciado e em andamento: um card por check ---- */}
            {id !== 'concluida' &&
              porColuna[id].map((t) => (
                /* travado = de outro setor. O card continua contando o
                   que e e de quem, so nao aceita clique — a mesma
                   leitura das linhas da Grade. */
                <article
                  key={t.id}
                  className={`tcard ${t.posso ? '' : 'tcard--travado'}`.trim()}
                  onClick={t.posso ? () => aoAbrir(t) : undefined}
                  role={t.posso ? 'link' : undefined}
                  tabIndex={t.posso ? 0 : undefined}
                  aria-disabled={t.posso ? undefined : 'true'}
                  onKeyDown={(e) => {
                    if (t.posso && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      aoAbrir(t)
                    }
                  }}
                  title={t.posso ? `Abrir ${daObra(t)}` : 'Esta tarefa é de outro setor'}
                >
                  <p className="tcard__titulo">
                    {!t.posso && <Icone.cadeado />}
                    {t.titulo}
                  </p>

                  <p className="tcard__obra" data-tipo={t.obra.tipo}>
                    <Avatar
                      nome={t.cliente?.nome}
                      foto={t.cliente?.logo}
                      tamanho={18}
                      quadrado
                    />
                    {daObra(t)}
                  </p>

                  <p className="tcard__meio">
                    <span className="tcard__etapa">{t.etapaNome || `${t.etapaNumero}ª etapa`}</span>
                    <Setores
                      cargos={t.cargos}
                      nomeDoCargo={nomeDoCargo}
                      corDoCargo={corDoCargo}
                    />
                  </p>

                  <p className="tcard__pe">
                    <span
                      className="tpri"
                      data-pri={tomPrioridadeObra(t.obra)}
                    >
                      {rotuloPrioridadeObra(t.obra)}
                    </span>
                    <Prazo iso={t.obra.dataConclusao} hoje={hoje} />
                  </p>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/* As duas cores das marcas no globo. Ficam aqui, e nao nos tokens, por
   um motivo pratico: o canvas nao le variavel de CSS — ele precisa da
   cor resolvida em texto. Sao as mesmas familias do resto do sistema. */
const OBRA_FECHADA = '#3ddc97'
const OBRA_ABERTA = '#ff9f43'

/* teto de marcas no globo. Passando disso a bola vira uma sopa de
   pontos e para de dizer qualquer coisa; as mais recentes bastam. */
const MARCAS_NO_GLOBO = 60

/* A largura da nuvem, em pixels, e a folga que ela guarda das bordas.

   O numero mora aqui porque o JS precisa dele para PRENDER a nuvem
   dentro da caixa — o CSS sozinho nao tem como saber onde o ponto caiu.
   Se mudar aqui, mude no .nuvem do CSS junto. */
const NUVEM_L = 440
const NUVEM_A = 340
const NUVEM_FOLGA = 6

/**
 * A NUVEM.
 *
 * Nao e um contorno desenhado: e uma MASSA. Seis elipses sobrepostas
 * passam por um filtro de turbulencia que empurra cada ponto da borda
 * para um lado diferente, e o resultado e a silhueta irregular e fofa
 * de um cumulo — em vez do colar de bolhas iguais que todo mundo
 * reconhece como "nuvem desenhada por crianca".
 *
 * As coordenadas sao em pixels da propria nuvem (nao em 0–1) porque o
 * filtro trabalha em espaco de usuario: turbulencia numa caixa de
 * 0 a 1 sai invisivel.
 */
const MASSA = [
  /* a base deitada: e ela que da a linha de nuvem, e nao um circulo */
  { cx: 0.5, cy: 0.6, rx: 0.45, ry: 0.24 },
  { cx: 0.32, cy: 0.58, rx: 0.27, ry: 0.24 },
  { cx: 0.68, cy: 0.58, rx: 0.27, ry: 0.24 },
  /* os montes de cima, o do meio mais alto */
  { cx: 0.28, cy: 0.44, rx: 0.22, ry: 0.23 },
  { cx: 0.5, cy: 0.37, rx: 0.27, ry: 0.27 },
  { cx: 0.72, cy: 0.44, rx: 0.22, ry: 0.23 },
  /* o miolo, para nao sobrar vinco entre um monte e outro */
  { cx: 0.39, cy: 0.5, rx: 0.24, ry: 0.25 },
  { cx: 0.61, cy: 0.5, rx: 0.24, ry: 0.25 },
]

/**
 * As bolhinhas que ligam a nuvem ao pingo.
 *
 * Sao o rabicho de um balao de PENSAMENTO, e nao o bico de um balao de
 * fala: tres circulos que vao diminuindo ate a marca. E o unico jeito
 * de ligar uma nuvem a um ponto sem desenhar um risco, que numa nuvem
 * de verdade nao existiria.
 */
function bolhinhas(alvoX, alvoY, larg, alt) {
  const peX = Math.min(Math.max(alvoX, larg * 0.3), larg * 0.7)
  const paraBaixo = alvoY > alt / 2
  const peY = paraBaixo ? alt * 0.74 : alt * 0.26
  return [0.42, 0.68, 0.88].map((t, i) => ({
    cx: peX + (alvoX - peX) * t,
    cy: peY + (alvoY - peY) * t,
    r: 9 - i * 2.6,
  }))
}

/**
 * Onde a nuvem pousa, sem ultrapassar a caixa do globo.
 *
 * Ela quer nascer centrada no ponto, mas ponto perto da borda jogaria
 * metade dela para fora — e foi o que acontecia. Entao o lado esquerdo
 * e preso entre as duas margens, e a PONTA se desloca sozinha para
 * continuar apontando para o pingo, mesmo quando o corpo da nuvem
 * escorregou para o lado.
 *
 * Na vertical ela abre para cima quando o ponto esta na metade de
 * baixo, e para baixo quando esta na de cima: e sempre o lado que tem
 * mais espaco.
 */
export function pousarNuvem(onde) {
  /* o ponto vem em coordenadas da BOLA; a nuvem mora no painel, que é
     maior — somar o deslocamento da bola dentro dele é o que permite a
     nuvem usar toda a altura disponível em vez de só a do quadrado do
     globo, onde ela saía espremida */
  const px = onde.x + (onde.deslocX ?? 0)
  const py = onde.y + (onde.deslocY ?? 0)
  const larg = onde.painelL ?? onde.largura
  const alt = onde.painelA ?? onde.altura

  const teto = Math.max(NUVEM_FOLGA, larg - NUVEM_L - NUVEM_FOLGA)
  const esq = Math.min(Math.max(px - NUVEM_L / 2, NUVEM_FOLGA), teto)

  /* abre para o lado que TEM mais espaço, e não por regra fixa */
  const acima = py - NUVEM_FOLGA - 12
  const abaixo = alt - py - NUVEM_FOLGA - 12
  const paraBaixo = abaixo >= acima

  /* a nuvem tem altura fixa: o desenho dela é uma forma, e forma que
     estica com o conteúdo deixa de ser a forma que foi desenhada. O
     topo é preso dentro do painel em vez de encolher a nuvem. */
  const topo = paraBaixo
    ? Math.min(py + 12, alt - NUVEM_A - NUVEM_FOLGA)
    : Math.max(py - 12 - NUVEM_A, NUVEM_FOLGA)

  const topoFinal = Math.max(topo, NUVEM_FOLGA)

  return {
    paraBaixo,
    /* o pingo, visto de dentro da nuvem: é para cá que o rabicho aponta */
    alvo: { x: px - esq, y: py - topoFinal },
    estilo: {
      left: `${Math.round(esq)}px`,
      top: `${Math.round(topoFinal)}px`,
    },
  }
}

/** O vazio das abas: um recado, e nao uma tela em branco. */
export function Vazio({ titulo, texto, arte = 'sol' }) {
  const { isDark } = useTheme()
  const { obras, concluida, clientePorId, etapaDaObra, rotuloEtapa } = useDados()
  const navegar = useNavigate()
  /* O que a pessoa tocou no globo: as obras daquele ponto e onde o
     ponto está na tela. A nuvem nasce ali, ancorada no pingo — e não
     num painel embaixo, longe de onde o dedo encostou. */
  const [toque, setToque] = useState(null)
  /* qual das obras do ponto está aberta, quando há mais de uma */
  const [escolhida, setEscolhida] = useState(null)
  /* as duas caixas: a do globo e a do painel. É a diferença entre elas
     que diz onde o ponto caiu dentro do painel. */
  const caixaGlobo = useRef(null)
  const caixaPainel = useRef(null)

  /**
   * Uma marca por obra: verde para a que fechou, laranja para a que
   * ainda corre.
   *
   * O globo aparece quando NAO ha o que fazer hoje, e "nada a fazer"
   * nao e a mesma coisa que "nada acontecendo". As marcas sao o que
   * separa as duas leituras: a tela continua dizendo que a casa tem
   * obra, sem inventar tarefa para preencher a tabela.
   *
   * Onde cada uma pousa quem decide e o globo, a partir do id — aqui so
   * saem a chave e a cor.
   */
  const marcas = useMemo(() => {
    if (arte !== 'globo') return []
    return obras.slice(0, MARCAS_NO_GLOBO).map((obra) => {
      /* a marca pousa na cidade do cliente. Sem UF no cadastro nao ha
         lugar no mapa, e o globo cai no sorteio estavel por id: a obra
         continua aparecendo, so que fora do Brasil — o que e, tambem,
         um jeito de a falta do cadastro aparecer. */
      const onde = coordenadaDoCliente(clientePorId(obra.clienteId))
      return {
        chave: String(obra.id),
        cor: concluida(obra) ? OBRA_FECHADA : OBRA_ABERTA,
        lat: onde?.lat,
        lon: onde?.lon,
      }
    })
  }, [arte, obras, concluida, clientePorId])

  const fechadas = marcas.filter((m) => m.cor === OBRA_FECHADA).length
  const abertas = marcas.length - fechadas

  const naNuvem = (toque?.chaves ?? [])
    .map((c) => obras.find((o) => String(o.id) === c))
    .filter(Boolean)
  const obraTocada = escolhida ? naNuvem.find((o) => String(o.id) === escolhida) : null
  const clienteTocado = obraTocada ? clientePorId(obraTocada.clienteId) : null
  const fechou = obraTocada ? concluida(obraTocada) : false
  const fecharNuvem = useCallback(() => {
    setToque(null)
    setEscolhida(null)
  }, [])

  /**
   * Clicar em qualquer outro lugar fecha a nuvem.
   *
   * O botão de fechar continua onde estava — ele é a saída ÓBVIA, a
   * que se procura quando não se sabe que dá para clicar fora. O clique
   * fora é o atalho de quem já sabe, e as duas coisas convivem sem se
   * atrapalhar.
   *
   * O que NÃO fecha é o clique dentro da própria nuvem (senão escolher
   * uma obra da lista fecharia a lista) nem no globo (que tem o clique
   * dele, para abrir outro ponto).
   */
  useEffect(() => {
    if (!toque) return undefined
    const fora = (evento) => {
      if (evento.target.closest('.nuvem, .vaziot__globo')) return
      fecharNuvem()
    }
    const tecla = (evento) => evento.key === 'Escape' && fecharNuvem()
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [toque, fecharNuvem])

  return (
    <div className="vaziot vidro" ref={caixaPainel}>
      {/* O globo e do vazio da GRADE, e nao de todo vazio: e a tela do
          "o que faco agora", e quando nao ha nada a fazer ela fica sem
          assunto. Um mundo girando devagar, que responde ao cursor e
          aceita um alfinete, ocupa esse silencio melhor que um icone
          parado — e nao inventa nenhum dado que nao existe. */}
      {arte === 'globo' ? (
        <>
          <div className="vaziot__globo" ref={caixaGlobo}>
            <Globo
              /* a tinta do globo segue o tema; o fundo dele e transparente,
                 entao quem aparece atras e o vidro do painel */
              baseColor={isDark ? '#e2e4e9' : '#1d2633'}
              /* o preset do autor foi calibrado para uma tela de 1200x800.
                 Aqui a caixa tem 340px: com a densidade de la a malha do mar
                 rala some e sobram letras soltas no escuro, sem bola nenhuma
                 por tras. Estes dois numeros devolvem a esfera no tamanho que
                 ela tem nesta tela. */
              density={95}
              glyphSize={115}
              marcas={marcas}
              parado={toque !== null}
              aoTocarMarca={(chaves, onde) => {
                const g = caixaGlobo.current?.getBoundingClientRect()
                const p = caixaPainel.current?.getBoundingClientRect()
                setToque({
                  chaves,
                  onde:
                    g && p
                      ? {
                          ...onde,
                          deslocX: g.left - p.left,
                          deslocY: g.top - p.top,
                          painelL: p.width,
                          painelA: p.height,
                        }
                      : onde,
                })
                /* com uma obra só, ela já abre; com várias, a nuvem
                   primeiro pergunta qual */
                setEscolhida(chaves.length === 1 ? chaves[0] : null)
              }}
              /* zoom pela roda desligado: ligado, ele comeria a rolagem da
                 pagina de quem so passou o cursor por cima */
              pointer={{ zoom: 0, light: 100, pins: 7 }}
            />

          </div>

          {/* ---- a nuvem ----
              Nasce colada no pingo que foi tocado, com a ponta apontando
              para ele. É a diferença entre "abriu alguma coisa" e "abriu
              ISTO aqui": o olho não precisa procurar de onde veio. */}
          {toque && (
            <div
              className={`nuvem ${pousarNuvem(toque.onde).paraBaixo ? 'is-baixo' : ''}`.trim()}
              style={pousarNuvem(toque.onde).estilo}
              role="dialog"
              aria-label="Obra no globo"
            >
              {/* ---- a nuvem ----

                  Tudo o que se vê dela sai daqui: a massa de elipses
                  passa pelo filtro de turbulência, vira MÁSCARA, e a
                  máscara é o que recorta o vidro. Nada de contorno —
                  nuvem não tem linha em volta.

                  O filtro mora no próprio componente porque depende do
                  tamanho da nuvem em pixels: turbulência é um efeito de
                  espaço, não de proporção. */}
              <svg className="nuvem__oculto" aria-hidden="true">
                <defs>
                  <filter id="nuvem-fofa" x="-25%" y="-25%" width="150%" height="150%">
                    {/* o ruído que amassa a borda */}
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.011"
                      numOctaves="4"
                      seed="9"
                      result="ruido"
                    />
                    <feDisplacementMap
                      in="SourceGraphic"
                      in2="ruido"
                      scale="26"
                      xChannelSelector="R"
                      yChannelSelector="G"
                    />
                    {/* o desfoque final é o que tira a aresta e deixa a
                        borda algodão em vez de recortada */}
                    <feGaussianBlur stdDeviation="5" />
                  </filter>

                  <mask id="nuvem-mascara">
                    <g filter="url(#nuvem-fofa)" fill="#fff">
                      {MASSA.map((e, i) => (
                        <ellipse
                          key={i}
                          cx={e.cx * NUVEM_L}
                          cy={e.cy * NUVEM_A}
                          rx={e.rx * NUVEM_L}
                          ry={e.ry * NUVEM_A}
                        />
                      ))}
                      {bolhinhas(
                        pousarNuvem(toque.onde).alvo.x,
                        pousarNuvem(toque.onde).alvo.y,
                        NUVEM_L,
                        NUVEM_A,
                      ).map((b, i) => (
                        <circle key={`b${i}`} cx={b.cx} cy={b.cy} r={b.r} />
                      ))}
                    </g>
                  </mask>
                </defs>
              </svg>

              {/* a sombra segue o alfa do filho mascarado — por isso ela
                  acompanha a nuvem, e não uma caixa retangular */}
              <span className="nuvem__sombra" aria-hidden="true">
                <span className="nuvem__massa" />
              </span>

              <div className="nuvem__corpo">
                <button
                  type="button"
                  className="nuvem__fechar"
                  onClick={fecharNuvem}
                  aria-label="Fechar"
                >
                  ×
                </button>

                {/* várias obras no mesmo endereço: a lista vem antes */}
                {!obraTocada && (
                  <>
                    <p className="nuvem__titulo">
                      Obras neste ponto
                    </p>
                    <ul className="nuvem__lista">
                      {naNuvem.map((o) => (
                        <li key={o.id}>
                          <button type="button" onClick={() => setEscolhida(String(o.id))}>
                            <span
                              className="vaziot__ponto"
                              data-obra={concluida(o) ? 'fechada' : 'aberta'}
                              aria-hidden="true"
                            />
                            {tituloDaObra(o, clientePorId(o.clienteId))}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {obraTocada && (
                  <>
                    <p className="nuvem__titulo">
                      <span
                        className="vaziot__ponto"
                        data-obra={fechou ? 'fechada' : 'aberta'}
                        aria-hidden="true"
                      />
                      {tituloDaObra(obraTocada, clienteTocado)}
                    </p>

                    <dl className="nuvem__dados">
                      <div>
                        <dt>Onde</dt>
                        <dd>
                          {clienteTocado?.cidade
                            ? `${clienteTocado.cidade} — ${clienteTocado.estado}`
                            : 'Cidade não cadastrada'}
                        </dd>
                      </div>
                      <div>
                        <dt>Etapa</dt>
                        <dd>{rotuloEtapa(etapaDaObra(obraTocada))}</dd>
                      </div>
                      <div>
                        <dt>Prazo</dt>
                        <dd>
                          {obraTocada.dataConclusao ? dataBR(obraTocada.dataConclusao) : 'Sem prazo'}
                        </dd>
                      </div>
                      <div>
                        <dt>Situação</dt>
                        <dd>{fechou ? 'Concluída' : 'Em aberto'}</dd>
                      </div>
                    </dl>

                    <div className="nuvem__acoes">
                      {naNuvem.length > 1 && (
                        <button
                          type="button"
                          className="nuvem__voltar"
                          onClick={() => setEscolhida(null)}
                        >
                          ‹ as {naNuvem.length} obras
                        </button>
                      )}
                      <button
                        type="button"
                        className="nuvem__abrir"
                        onClick={() =>
                          navegar(
                            fechou
                              ? `/app/concluidas/${obraTocada.id}`
                              : `/app/obras/${obraTocada.id}`,
                          )
                        }
                      >
                        Abrir a obra
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <IconeClima familia="sol" titulo="" tamanho={54} />
      )}
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}

      {/* Sem esta linha os pontos coloridos seriam enfeite: ninguem
          adivinha que verde e obra fechada. Ela so aparece quando ha o
          que contar. */}
      {arte === 'globo' && marcas.length > 0 && (
        <p className="vaziot__legenda">
          <span className="vaziot__ponto" data-obra="fechada" aria-hidden="true" />
          {fechadas} concluída{fechadas === 1 ? '' : 's'}
          <span className="vaziot__ponto" data-obra="aberta" aria-hidden="true" />
          {abertas} em aberto
        </p>
      )}

    </div>
  )
}
