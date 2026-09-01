/**
 * O roteiro de fabrica das obras: 5 etapas, os cards de cada etapa e os
 * checks de cada card.
 *
 * Mora aqui, e nao no .sql, por causa do acento: colar "Integracao" com
 * cedilha no psql do Windows depende do code page do terminal. Pela API
 * o texto vai em UTF-8 e chega inteiro.
 *
 * Roda sozinho quando a API sobe e SO age se a tabela etapa estiver
 * vazia — depois disso o roteiro e do usuario, e subir a API de novo nao
 * mexe em nada.
 */

/** cargos: chaves da tabela cargo. Mais de uma = card com gradiente. */
export const ROTEIRO = [
  {
    nome: 'Comercial',
    cards: [
      {
        cargos: ['comercial'],
        checks: [
          'Proposta técnica',
          'Data de execução',
          'Ciente da proposta de consultoria',
          'Reunião interna',
          'Apresentar todas as propostas',
          'Venda alinhada com técnica e qualidade',
        ],
      },
    ],
  },
  {
    nome: 'Planejamento',
    cards: [
      {
        cargos: ['adm'],
        checks: ['Integração', 'Liberação de documento', 'Hotel'],
      },
      {
        cargos: ['gq'],
        checks: [
          'Elaboração',
          'Determinar Focal Point',
          'Revisão interna',
          'Envio revisão externa',
          'Entrar em contato e se apresentar',
          'Mat. Gases',
        ],
      },
      {
        cargos: ['tecnico'],
        checks: ['Se tiver data inserir no agendamento do cliente'],
      },
    ],
  },
  {
    nome: 'Execução',
    cards: [
      {
        cargos: ['tecnico'],
        checks: [
          'Execução',
          'Cronograma de ensaio detalhado',
          'Lançar dados da obra em % de execução',
        ],
      },
      {
        cargos: ['gq'],
        checks: ['Execução em campo protocolo / escritório', 'Garantir integridade dos dados'],
      },
      { cargos: ['excelencia'], checks: ['Instrumentos'] },
      { cargos: ['comercial'], checks: ['Acompanhamento reuniões'] },
    ],
  },
  {
    nome: 'Entrega',
    cards: [
      {
        cargos: ['gq'],
        checks: [
          'Revisão pós obra',
          'Envio p/ revisão cliente',
          'Apresentação dos resultados p/ cliente',
        ],
      },
      { cargos: ['comercial'], checks: ['Fatura após término de obra'] },
      { cargos: ['adm'], checks: ['ADM'] },
    ],
  },
  {
    nome: 'Encerramento',
    cards: [
      { cargos: ['comercial'], checks: ['Faturar após envio de doc'] },
      { cargos: ['adm'], checks: ['Gerar etiqueta p/ pasta de correio'] },
      { cargos: ['gq'], checks: ['Envio pasta física.'] },
    ],
  },
]

/**
 * Planta o roteiro de fabrica se ainda nao houver nenhuma etapa.
 * Devolve quantas etapas criou (0 = ja existia roteiro, nada a fazer).
 */
export async function plantarRoteiro(pool) {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    // trava a tabela para duas APIs subindo juntas nao plantarem duas vezes
    await cliente.query('LOCK TABLE etapa IN EXCLUSIVE MODE')
    const { rows } = await cliente.query('SELECT count(*)::int AS n FROM etapa')
    if (rows[0].n > 0) {
      await cliente.query('COMMIT')
      return 0
    }

    const cargos = await cliente.query('SELECT id, chave FROM cargo')
    const idDoCargo = Object.fromEntries(cargos.rows.map((c) => [c.chave, c.id]))

    for (const [i, etapa] of ROTEIRO.entries()) {
      const { rows: nova } = await cliente.query(
        'INSERT INTO etapa (ordem, nome) VALUES ($1, $2) RETURNING id',
        [i + 1, etapa.nome],
      )

      for (const [j, card] of etapa.cards.entries()) {
        const { rows: novoCard } = await cliente.query(
          'INSERT INTO etapa_card (etapa_id, ordem) VALUES ($1, $2) RETURNING id',
          [nova[0].id, j],
        )

        for (const [k, chave] of card.cargos.entries()) {
          if (!idDoCargo[chave]) continue
          await cliente.query(
            'INSERT INTO etapa_card_cargo (card_id, cargo_id, ordem) VALUES ($1, $2, $3)',
            [novoCard[0].id, idDoCargo[chave], k],
          )
        }

        for (const [k, titulo] of card.checks.entries()) {
          await cliente.query(
            'INSERT INTO etapa_check (card_id, ordem, titulo) VALUES ($1, $2, $3)',
            [novoCard[0].id, k, titulo],
          )
        }
      }
    }

    await cliente.query('COMMIT')
    return ROTEIRO.length
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}
