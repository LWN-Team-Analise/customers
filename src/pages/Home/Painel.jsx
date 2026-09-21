import { useMemo, useState } from 'react'
import { useDados } from '@/context/DadosContext'
import { chaveDoCargo } from '@/domain/obras'
import { dataBR } from '@/utils/formato'
import { Colunas, Linha, Rosca } from './graficos'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/* ============================================================
   Contas de tempo

   Tudo aqui e feito em DIAS INTEIROS de calendario, e o calculo passa
   por Date.UTC nas duas pontas de proposito: `new Date(a) - new Date(b)`
   erra por uma hora em toda virada de horario de verao, e um relatorio
   que muda de resultado em outubro nao serve para nada.

   As datas chegam em dois formatos, porque as colunas sao de dois
   tipos: `data_inicio` e `data_conclusao` sao DATE e chegam como
   'AAAA-MM-DD'; `criado_em`, `concluida_em` e `feito_em` sao timestamp
   e chegam como ISO. `soDia` nivela os dois.
   ============================================================ */

/** 'AAAA-MM' de um carimbo — e por ele que o filtro de mes casa. */
function mesDoCarimbo(valor) {
  const dia = soDia(valor)
  return dia ? dia.slice(0, 7) : null
}

/** 'AAAA-MM-DD' de um timestamp ou de uma data, no calendario local. */
export function soDia(valor) {
  if (!valor) return null
  const texto = String(valor)
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** '31/08' — a data curta que cabe embaixo de uma coluna do grafico. */
function diaEMes(valor) {
  const dia = soDia(valor)
  return dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : ''
}

/** Dias inteiros de `de` ate `ate`. Negativo = `ate` veio antes. */
function diasEntre(de, ate) {
  const a = soDia(de)
  const b = soDia(ate)
  if (!a || !b) return null
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Diferenca em HORAS entre dois carimbos — para as marcacoes do mesmo dia. */
function horasEntre(de, ate) {
  const a = new Date(de).getTime()
  const b = new Date(ate).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return (b - a) / 3_600_000
}

const media = (lista) =>
  lista.length === 0 ? null : lista.reduce((s, n) => s + n, 0) / lista.length

/** 18 -> "18 dias" | 0.4 -> "10 h" | 1 -> "1 dia" */
function emTempo(dias) {
  if (dias === null || dias === undefined) return '—'
  if (Math.abs(dias) < 1) {
    const h = Math.round(Math.abs(dias) * 24)
    return h < 1 ? '<1 h' : `${h} h`
  }
  const n = Math.round(dias * 10) / 10
  const texto = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
  return `${texto} ${Math.abs(n) === 1 ? 'dia' : 'dias'}`
}

/**
 * O Dashboard da pagina inicial.
 *
 * Ele responde tres perguntas que a lista de tarefas nao responde, e
 * que so aparecem quando se olha o historico inteiro:
 *
 *   1. quanto tempo uma obra leva do inicio ate ser concluida;
 *   2. quanto tempo cada setor (ou cada pessoa) leva para dar a sua
 *      resposta dentro da obra;
 *   3. o quanto as obras chegam antes ou depois do prazo combinado.
 *
 * Tudo sai do que ja esta gravado — nao ha coluna nova, nem cronometro,
 * nem ninguem apontando hora. Os numeros vem de tres carimbos que o
 * sistema ja fazia: `obra.data_inicio`, `obra.concluida_em` e o
 * `feito_em` de cada check.
 *
 * O painel olha a EMPRESA INTEIRA, e nao so o setor de quem esta
 * vendo: uma media de uma pessoa so nao e media de nada.
 */
export default function Painel({ mes, passo = 'mes' }) {
  const { obras, equipe, concluida, roteiroDaObra, clientePorId, nomeDoCargo, corDoCargo } =
    useDados()

  /* o grafico de resposta troca de eixo: por setor ou por pessoa */
  const [eixo, setEixo] = useState('setor')


  /**
   * O mes escolhido nas setas do topo, como 'AAAA-MM'.
   *
   * Ele recorta o HISTORICO: as obras concluidas naquele mes e as
   * marcacoes feitas nele. O que ele NAO recorta e a foto do agora —
   * "obras em andamento" e quantas estao abertas neste instante, e
   * nao quantas estavam abertas em marco. Essa e a unica caixa do
   * painel que ignora as setas, e o rodape dela diz isso.
   */
  const noMes = (carimbo) => mesDoCarimbo(carimbo) === mes.chave

  /**
   * Os seis meses que os graficos de linha desenham, terminando no mes
   * escolhido nas setas.
   *
   * As setas deixam de recortar so um mes e passam a DESLIZAR a
   * janela: uma linha precisa de mais de um ponto para dizer se a
   * coisa esta melhorando, que e a unica pergunta que linha responde.
   * Os cartoes que nao sao linha (a rosca, os numeros de cima)
   * continuam olhando so o mes escolhido.
   */
  /**
   * As colunas do painel — e o que cada uma significa.
   *
   * No passo MENSAL são os dias do mês escolhido: o mês corrente vai
   * até hoje (dia que ainda não chegou não é dado, é espaço vazio) e
   * um mês passado vai até o último dia dele.
   *
   * No passo ANUAL são os meses de janeiro até o mês escolhido. Não
   * é o ano inteiro de propósito: dezembro em março seria uma fileira
   * de nada no fim do gráfico.
   */
  const fatias = useMemo(() => {
    const doisDigitos = (n) => String(n).padStart(2, '0')

    if (passo === 'ano') {
      return Array.from({ length: mes.mes + 1 }, (_, i) => `${mes.ano}-${doisDigitos(i + 1)}`)
    }

    const ultimo = mes.atual
      ? new Date().getDate()
      : new Date(mes.ano, mes.mes + 1, 0).getDate()
    return Array.from(
      { length: ultimo },
      (_, i) => `${mes.ano}-${doisDigitos(mes.mes + 1)}-${doisDigitos(i + 1)}`,
    )
  }, [passo, mes.ano, mes.mes, mes.atual])
  /** 'AAAA-MM' -> 'set/26', que e o que cabe embaixo de um ponto. */
  const rotuloMes = (chave) => {
    const [ano, m] = chave.split('-')
    return `${MESES_CURTOS[Number(m) - 1]}/${ano.slice(2)}`
  }

  /* 'AAAA-MM-DD' -> '11'. Só o número do dia: o mês já está na seta
     em cima, e repeti-lo trinta vezes embaixo do gráfico é ruído.
     Quem decide se algum rótulo precisa ser pulado é o gráfico, que
     sabe a largura que tem. */
  const rotuloDia = (chave) => chave.slice(8)

  /** o rótulo certo para o passo em vigor */
  const rotuloDaFatia = (chave, i) =>
    passo === 'ano' ? rotuloMes(chave) : rotuloDia(chave, i)

  /** a chave do carimbo no passo em vigor: o mês ou o dia.
      Os dois passam por `soDia`, que nivela timestamp e data no
      calendário LOCAL — sem ele, uma marcação da noite cairia no dia
      seguinte por causa do fuso. */
  const fatiaDoCarimbo = (carimbo) =>
    passo === 'ano' ? mesDoCarimbo(carimbo) : soDia(carimbo)

  const fechadas = useMemo(
    () => obras.filter((o) => concluida(o) && noMes(o.concluidaEm)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obras, concluida, mes.chave],
  )
  const abertas = useMemo(() => obras.filter((o) => !concluida(o)), [obras, concluida])

  /* ---------------------------------------------------------
     1. Quanto tempo uma obra leva

     Do INICIO ate a conclusao. O inicio e `dataInicio` quando ela
     tem; sem ela, a data em que a obra foi cadastrada — que e o
     primeiro instante em que ela existiu para a empresa.
     --------------------------------------------------------- */
  const duracoes = useMemo(
    () =>
      fechadas
        .map((o) => ({
          obra: o,
          nome: [o.proposta, clientePorId(o.clienteId)?.nome].filter(Boolean).join(' — ') || 'Obra',
          dias: diasEntre(o.dataInicio ?? o.criadoEm, o.concluidaEm),
          fim: o.concluidaEm,
        }))
        .filter((d) => d.dias !== null && d.dias >= 0)
        /* em ordem cronologica: o grafico de colunas e uma linha do
           tempo, e linha do tempo que anda para tras nao se le */
        .sort((a, b) => String(a.fim).localeCompare(String(b.fim))),
    [fechadas, clientePorId],
  )

  const duracaoMedia = media(duracoes.map((d) => d.dias))

  /* ---------------------------------------------------------
     1b. Obras INICIADAS por mes

     Conta quantas obras comecaram em cada mes da janela — abertas e
     fechadas, porque o que se conta aqui e a entrada de trabalho, e
     obra que ja terminou entrou do mesmo jeito.

     O inicio e `dataInicio`; sem ela, a data de cadastro, que e o
     primeiro instante em que a obra existiu para a empresa.
     --------------------------------------------------------- */
  const iniciadas = useMemo(
    () =>
      fatias.map((chave, i) => ({
        chave,
        rotulo: rotuloDaFatia(chave, i),
        valor: obras.filter((o) => fatiaDoCarimbo(o.dataInicio ?? o.criadoEm) === chave).length,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obras, fatias, passo],
  )

  /* ---------------------------------------------------------
     2. Tempo de resposta por setor / por pessoa

     Nao ha "inicio da tarefa" gravado em lugar nenhum — so o
     instante em que ela foi MARCADA. Entao o que da para medir, e o
     que este grafico mede, e o intervalo entre uma marcacao e a
     seguinte DENTRO DA MESMA OBRA: quanto tempo a obra ficou parada
     esperando aquele check depois que o anterior saiu.

     A primeira marcacao de cada obra conta a partir do inicio dela.

     Quem leva o credito e QUEM MARCOU (`feitoPor`), e nao o setor
     dono do check no roteiro: numa emergencia qualquer um pode
     marcar, e atribuir o tempo a quem nao encostou na obra seria
     inventar numero.
     --------------------------------------------------------- */
  const resposta = useMemo(() => {
    const porPessoa = {}
    const porSetor = {}

    obras.forEach((obra) => {
      const roteiro = roteiroDaObra(obra)
      const todos = roteiro.flatMap((e) => e.cards.flatMap((c) => c.checks ?? []))

      const marcadas = todos
        .map((check) => obra.checks?.[check.id])
        .filter((m) => m?.feitoEm)
        .sort((a, b) => String(a.feitoEm).localeCompare(String(b.feitoEm)))

      let marco = obra.dataInicio ?? obra.criadoEm

      marcadas.forEach((m) => {
        const horas = horasEntre(marco, m.feitoEm)
        marco = m.feitoEm
        /* carimbo fora de ordem (importacao antiga) nao entra: um
           numero negativo aqui viraria uma media que mente */
        if (horas === null || horas < 0) return
        if (!m.feitoPor) return

        /* o intervalo e calculado sobre a obra INTEIRA — pular as
           marcacoes de fora da janela aqui daria distancias erradas.
           O que o mes decide e em qual COLUNA do grafico o intervalo
           cai, e nao se ele existe. */
        const quando = fatiaDoCarimbo(m.feitoEm)
        if (!fatias.includes(quando)) return

        const dias = horas / 24
        const pessoa = String(m.feitoPor)
        ;((porPessoa[pessoa] ??= {})[quando] ??= []).push(dias)

        const setor = chaveDoCargo(equipe.find((p) => String(p.id) === pessoa))
        if (setor) ((porSetor[setor] ??= {})[quando] ??= []).push(dias)
      })
    })

    /* uma SERIE por setor (ou por pessoa), com um ponto por mes da
       janela. Mes sem marcacao vira null, e nao zero: zero diria "o
       setor respondeu na hora", quando o que houve foi nada */
    const monta = (mapa, resolve) =>
      Object.entries(mapa)
        .map(([chave, porMes]) => ({
          chave,
          ...resolve(chave),
          pontos: fatias.map((f) => (porMes[f] ? media(porMes[f]) : null)),
          texto: (v) => emTempo(v),
          /* ordena pela media geral: a serie mais lenta vem primeiro na
             legenda, que e por onde se comeca a ler */
          peso: media(Object.values(porMes).flat()) ?? 0,
        }))
        .sort((a, b) => b.peso - a.peso)

    return {
      setor: monta(porSetor, (c) => ({ rotulo: nomeDoCargo(c), cor: corDoCargo(c) })),
      pessoa: monta(porPessoa, (id) => {
        const p = equipe.find((x) => String(x.id) === id)
        return {
          rotulo: p?.nome ?? 'Usuário removido',
          cor: corDoCargo(chaveDoCargo(p)),
        }
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras, roteiroDaObra, equipe, nomeDoCargo, corDoCargo, mes.chave, passo, fatias])

  const lista = resposta[eixo] ?? []

  /* ---------------------------------------------------------
     3. Atraso e adiantamento

     A unica das tres que compara o combinado com o acontecido:
     `dataConclusao` e a data prometida, `concluidaEm` e a real.

     Positivo = entregou depois. Negativo = entregou antes.

     Obra sem data de conclusao combinada fica de fora — nao da para
     estar atrasado em relacao a um prazo que nunca existiu.
     --------------------------------------------------------- */
  const desvios = useMemo(
    () =>
      fechadas
        .filter((o) => o.dataConclusao)
        .map((o) => {
          const dias = diasEntre(o.dataConclusao, o.concluidaEm)
          return {
            chave: o.id,
            rotulo:
              [o.proposta, clientePorId(o.clienteId)?.nome].filter(Boolean).join(' — ') || 'Obra',
            /* o eixo da linha e curto por obrigacao — cabe a proposta e
               mais nada. O nome inteiro fica para a dica. */
            curto: o.proposta || 'obra',
            fim: o.concluidaEm,
            valor: dias,
            texto: dias === 0 ? 'no dia' : `${dias > 0 ? '+' : '−'}${emTempo(dias)}`,
          }
        })
        .filter((d) => d.valor !== null)
        .sort((a, b) => b.valor - a.valor),
    [fechadas, clientePorId],
  )

  /* As duas metades, cada uma ja pronta para um grafico de barras: o
     valor vai em MODULO, porque a barra so cresce para um lado e o
     titulo do cartao ja diz de que lado ela e.

     "No dia" (desvio zero) conta como no prazo na rosca, mas nao entra
     em Adiantamento: entregar no dia combinado nao e chegar antes. */
  const atrasadas = desvios
    .filter((d) => d.valor > 0)
    .map((d) => ({ ...d, texto: emTempo(d.valor) }))
    .sort((a, b) => b.valor - a.valor)

  const adiantadas = desvios
    .filter((d) => d.valor < 0)
    .map((d) => ({ ...d, valor: -d.valor, texto: emTempo(-d.valor) }))
    .sort((a, b) => b.valor - a.valor)

  /* as duas listas viram SERIE: um ponto por obra, na ordem em que
     elas foram concluidas. E a ordem que faz a linha dizer alguma
     coisa — ordenada por tamanho do atraso, a linha so desceria */
  const serieDeDesvio = (itens, cor, rotulo) => {
    const ordenadas = [...itens].sort((a, b) => String(a.fim).localeCompare(String(b.fim)))
    return {
      eixoX: ordenadas.map((d) => d.curto),
      series: [
        {
          chave: rotulo,
          rotulo,
          cor,
          pontos: ordenadas.map((d) => d.valor),
          texto: (v) => emTempo(v),
        },
      ],
    }
  }

  const noPrazo = desvios.filter((d) => d.valor <= 0)
  const desvioMedio = media(desvios.map((d) => d.valor))

  /* quantos checks a empresa tem em aberto agora — o contexto dos
     numeros de cima, para uma media de 3 obras nao parecer um censo */
  const checksAbertos = useMemo(
    () =>
      abertas.reduce((total, obra) => {
        const todos = roteiroDaObra(obra).flatMap((e) => e.cards.flatMap((c) => c.checks ?? []))
        return total + todos.filter((c) => !obra.checks?.[c.id]).length
      }, 0),
    [abertas, roteiroDaObra],
  )


  return (
    <PainelVista
      eixo={eixo}
      setEixo={setEixo}
      lista={lista}
      eixoMeses={fatias.map(rotuloDaFatia)}
      passo={passo}
      iniciadas={iniciadas}
      atrasoLinha={serieDeDesvio(atrasadas, 'var(--gr-ruim)', 'Atraso')}
      adiantoLinha={serieDeDesvio(adiantadas, 'var(--gr-bom)', 'Adiantamento')}
      desvios={desvios}
      noPrazo={noPrazo}
      atrasadas={atrasadas}
      adiantadas={adiantadas}
      duracaoMedia={duracaoMedia}
      desvioMedio={desvioMedio}
      abertas={abertas.length}
      checksAbertos={checksAbertos}
      totalConcluidas={duracoes.length}
    />
  )
}

/**
 * O desenho do painel, sem conta nenhuma.
 *
 * Separado do componente de cima de proposito: tudo o que esta acima
 * depende do banco, e tudo o que esta aqui depende so de numeros ja
 * prontos.
 */
export function PainelVista({
  eixo,
  setEixo,
  lista,
  eixoMeses,
  passo,
  iniciadas,
  atrasoLinha,
  adiantoLinha,
  desvios,
  noPrazo,
  atrasadas,
  adiantadas,
  duracaoMedia,
  desvioMedio,
  abertas,
  checksAbertos,
  totalConcluidas,
}) {
  return (
    <div className="dash">
      {/* ---------------- os numeros de cima ---------------- */}
      <div className="dash__tiles">
        <Tile
          rotulo="Duração média da obra"
          valor={emTempo(duracaoMedia)}
          nota={
            totalConcluidas === 0
              ? 'nenhuma obra concluída ainda'
              : `média de ${totalConcluidas} obra${totalConcluidas > 1 ? 's' : ''} concluída${
                  totalConcluidas > 1 ? 's' : ''
                }`
          }
        />
        <Tile
          /* A CAIXA TROCA DE ASSUNTO em vez de mostrar numero
             negativo. "Desvio médio: −3 dias" obriga a lembrar de que
             lado o sinal cai antes de saber se a noticia e boa; com o
             rotulo dizendo "Adiantamento médio" e o numero sempre
             positivo, a leitura acaba no titulo. */
          rotulo={
            desvioMedio === null || desvioMedio === 0
              ? 'Prazo das entregas'
              : desvioMedio > 0
                ? 'Atraso médio do prazo'
                : 'Adiantamento médio'
          }
          valor={
            desvioMedio === null
              ? '—'
              : desvioMedio === 0
                ? 'no prazo'
                : emTempo(Math.abs(desvioMedio))
          }
          tom={desvioMedio === null ? undefined : desvioMedio > 0 ? 'ruim' : 'bom'}
          nota={
            desvios.length === 0
              ? 'nenhuma obra com prazo combinado'
              : desvioMedio > 0
                ? 'em média, depois do combinado'
                : desvioMedio < 0
                  ? 'em média, antes do combinado'
                  : 'em média, no dia combinado'
          }
        />
        <Tile
          rotulo="Obras em andamento"
          valor={String(abertas)}
          /* a única caixa que ignora as setas: é a foto de AGORA */
          nota={`${checksAbertos} check${checksAbertos === 1 ? '' : 's'} em aberto · hoje`}
        />
        <Tile
          rotulo="Tempo de resposta médio"
          /* a media de TODOS os pontos de TODAS as series — a serie
             agora e um ponto por mes, e nao um numero so por setor.
             Mes sem marcacao e `null` e fica de fora: entrasse como
             zero, ele puxaria a media para baixo dizendo que o setor
             respondeu na hora num mes em que nao houve nada. */
          valor={emTempo(
            media(lista.flatMap((s) => s.pontos.filter((v) => v !== null && v !== undefined))),
          )}
          nota={
            lista.length === 0
              ? 'nenhum check marcado ainda'
              : `entre ${lista.length} ${eixo === 'setor' ? 'setores' : 'pessoas'} · ${
                  passo === 'ano' ? 'no ano' : 'no mês, dia a dia'
                }`
          }
        />
      </div>

      {/* ---------------- os graficos, no mosaico ----------------

          Os dois de comparacao dividem a primeira linha — o de barras
          com sete das doze colunas, a rosca com cinco — e os dois que
          tem um item por obra atravessam a largura inteira embaixo.

          Quem iguala a altura dos vizinhos de linha e o CSS; aqui a
          ordem e so a de leitura: primeiro quanto cada setor demora,
          depois se a obra chegou no prazo, e por fim obra a obra. */}
      <div className="dash__grade">
        <section className="cartao cartao--largo vidro">
          <header className="cartao__topo">
            <div>
              <h2 className="cartao__titulo">Tempo de resposta</h2>
            </div>

            <div className="cartao__escolhas">
              <div className="escopo escopo--peq" role="group" aria-label="Agrupar por">
                <button
                  type="button"
                  className={eixo === 'setor' ? 'is-atual' : ''}
                  onClick={() => setEixo('setor')}
                >
                  Setor
                </button>
                <button
                  type="button"
                  className={eixo === 'pessoa' ? 'is-atual' : ''}
                  onClick={() => setEixo('pessoa')}
                >
                  Pessoa
                </button>
              </div>
            </div>
          </header>

          <div className="cartao__corpo">
            {lista.length === 0 ? (
              <p className="cartao__vazio">
                Nenhum check marcado ainda — sem marcação não há tempo para medir.
              </p>
            ) : (
              <Linha
                series={lista}
                eixoX={eixoMeses}
                unidade="dias"
                alturaTotal={250}
                /* dia é um número de dois dígitos; mês é "set/26" */
                larguraRotulo={passo === 'ano' ? 38 : 16}
              />
            )}
          </div>
        </section>

        <section className="cartao cartao--estreito vidro">
          <header className="cartao__topo">
            <div>
              <h2 className="cartao__titulo">Entregas no prazo</h2>
            </div>
          </header>

          <div className="cartao__corpo">
            {desvios.length === 0 ? (
              <p className="cartao__vazio">Nenhuma obra concluída com data de conclusão combinada.</p>
            ) : (
              <Rosca
                tamanho={196}
                fatias={[
                  { rotulo: 'No prazo', valor: noPrazo.length, cor: 'var(--gr-bom)' },
                  { rotulo: 'Atrasadas', valor: atrasadas.length, cor: 'var(--gr-ruim)' },
                ]}
                centro={{
                  valor: `${Math.round((noPrazo.length / desvios.length) * 100)}%`,
                  rotulo: 'no prazo',
                }}
                rodape={`${desvios.length} obra${desvios.length > 1 ? 's' : ''} com prazo combinado`}
              />
            )}
          </div>
        </section>

        <section className="cartao vidro">
          <header className="cartao__topo">
            <div>
              <h2 className="cartao__titulo">
                Obras iniciadas {passo === 'ano' ? 'por mês' : 'por dia'}
              </h2>
            </div>
          </header>

          <div className="cartao__corpo">
            {iniciadas.every((m) => m.valor === 0) ? (
              <p className="cartao__vazio">Nenhuma obra iniciada nestes seis meses.</p>
            ) : (
              <Colunas
                itens={iniciadas.map((m) => ({ ...m, texto: String(m.valor) }))}
                unidade="obras"
              />
            )}
          </div>
        </section>

        {/* ---- Atraso e adiantamento, em DOIS cartoes ----

            Eram um so, com o zero no meio e as barras saindo para os
            dois lados. Um grafico divergente responde "de que lado a
            empresa esta" — mas nao responde "quais obras atrasaram",
            que e a pergunta que se faz olhando esta tela: as
            atrasadas ficavam misturadas com as adiantadas, separadas
            so pela cor e pelo lado.

            Separados, cada cartao e uma lista ordenada da pior para a
            melhor, e o titulo ja diz do que ela trata. */}
        <section className="cartao cartao--metade vidro">
          <header className="cartao__topo">
            <div>
              <h2 className="cartao__titulo">Atraso</h2>
            </div>
            <span className="cartao__selo" data-tom="ruim">
              {atrasadas.length}
            </span>
          </header>

          <div className="cartao__corpo">
            {atrasadas.length === 0 ? (
              <p className="cartao__vazio">Nenhuma obra passou do prazo combinado.</p>
            ) : (
              <Linha
                series={atrasoLinha.series}
                eixoX={atrasoLinha.eixoX}
                unidade="dias"
                alturaTotal={220}
              />
            )}
          </div>
        </section>

        <section className="cartao cartao--metade vidro">
          <header className="cartao__topo">
            <div>
              <h2 className="cartao__titulo">Adiantamento</h2>
            </div>
            <span className="cartao__selo" data-tom="bom">
              {adiantadas.length}
            </span>
          </header>

          <div className="cartao__corpo">
            {adiantadas.length === 0 ? (
              <p className="cartao__vazio">Nenhuma obra chegou antes do prazo combinado.</p>
            ) : (
              <Linha
                series={adiantoLinha.series}
                eixoX={adiantoLinha.eixoX}
                unidade="dias"
                alturaTotal={220}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/** Um numero grande com o que ele quer dizer embaixo. */
function Tile({ rotulo, valor, nota, tom }) {
  return (
    <article className="tile vidro" data-tom={tom}>
      <p className="tile__rotulo">{rotulo}</p>
      <strong className="tile__valor">{valor}</strong>
      <p className="tile__nota">{nota}</p>
    </article>
  )
}
