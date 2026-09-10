import { Router } from 'express'
import { query } from '../db.js'
import { exige, exigeSessao, tratar } from '../sessao.js'

const router = Router()

/* ============================================================
   O roteiro anda para a FRENTE

   Regra da casa: mexer no roteiro dentro de uma obra vale para
   ELA e para as proximas — nunca para as que ja passaram. Uma
   obra fechada em marco nao pode ganhar um check novo em maio e
   voltar a aparecer como pendente.

   Como isso funciona: cada peca (etapa, card, check) tem uma
   JANELA DE VIGENCIA.

     vigente_de  = quando a peca passou a valer
     vigente_ate = quando ela saiu (NULL = ainda vale)

   Uma obra criada em X enxerga a peca quando
       vigente_de <= X  e  (vigente_ate IS NULL OU X < vigente_ate)

   Criar dentro da obra X carimba vigente_de com a data de X;
   excluir carimba vigente_ate com a mesma data. Por isso o
   `obraId` viaja junto em toda alteracao: e ele que diz a
   partir de quando a mudanca conta.

   Sem obraId (alteracao feita fora de uma obra), o carimbo e
   `now()`: vale so para as obras criadas dali em diante.
   ============================================================ */

/** O momento que carimba a alteracao: a criacao da obra, ou agora. */
async function momento(obraId) {
  if (!obraId) return new Date()
  const { rows } = await query('SELECT criado_em FROM obra WHERE id = $1', [obraId])
  return rows[0]?.criado_em ?? new Date()
}

/** De onde vem o obraId: corpo (POST/PATCH) ou query (DELETE). */
const obraDaChamada = (req) => req.body?.obraId ?? req.query?.obraId ?? null

/* ------------------------------------------------------------
   Leitura — o roteiro inteiro em uma resposta so.

   Vem em arvore (etapa > cards > checks) porque e assim que a
   tela desenha; montar isso no front custaria tres varreduras.

   Vem TUDO, inclusive o que ja saiu de circulacao: e a tela que
   filtra pela data de cada obra (src/domain/obras.js). Assim uma
   obra antiga continua desenhando o roteiro que ela teve.
   ------------------------------------------------------------ */

export async function lerRoteiro() {
  const [etapas, cards, cargos, checks, cargosCheck, etiquetas] = await Promise.all([
    query(
      'SELECT id, ordem, nome, descricao, vigente_de, vigente_ate FROM etapa ORDER BY ordem, id',
    ),
    query(`SELECT id, etapa_id, ordem, titulo, vigente_de, vigente_ate
             FROM etapa_card ORDER BY ordem, id`),
    query(`SELECT cc.card_id, c.chave, cc.ordem
             FROM etapa_card_cargo cc JOIN cargo c ON c.id = cc.cargo_id
            ORDER BY cc.ordem`),
    query(`SELECT id, card_id, ordem, titulo, vigente_de, vigente_ate
             FROM etapa_check ORDER BY ordem, id`),
    query(`SELECT kc.check_id, c.chave, kc.ordem
             FROM etapa_check_cargo kc JOIN cargo c ON c.id = kc.cargo_id
            ORDER BY kc.ordem`),
    /* as etiquetas do card. Num banco sem a atualizacao 7 a tabela nao
       existe, e o roteiro inteiro nao pode parar por causa disso: o
       catch devolve lista vazia e os cards vem sem etiqueta */
    query(`SELECT ce.card_id, e.id, e.nome, e.cor
             FROM card_etiqueta ce JOIN etiqueta_card e ON e.id = ce.etiqueta_id
            ORDER BY lower(e.nome)`).catch((erro) => {
      if (erro.code === '42P01') return { rows: [] }
      throw erro
    }),
  ])

  const etiquetasDoCard = {}
  etiquetas.rows.forEach((l) => {
    const lista = etiquetasDoCard[l.card_id] ?? []
    lista.push({ id: String(l.id), nome: l.nome, cor: l.cor })
    etiquetasDoCard[l.card_id] = lista
  })

  const cargosDoCard = {}
  cargos.rows.forEach((l) => {
    const lista = cargosDoCard[l.card_id] ?? []
    lista.push(l.chave)
    cargosDoCard[l.card_id] = lista
  })

  /* cargos: [] = o check segue o card. Com nomes aqui, esta lista manda. */
  const cargosDoCheck = {}
  cargosCheck.rows.forEach((l) => {
    const lista = cargosDoCheck[l.check_id] ?? []
    lista.push(l.chave)
    cargosDoCheck[l.check_id] = lista
  })

  const checksDoCard = {}
  checks.rows.forEach((l) => {
    const lista = checksDoCard[l.card_id] ?? []
    lista.push({
      id: String(l.id),
      ordem: l.ordem,
      titulo: l.titulo,
      cargos: cargosDoCheck[l.id] ?? [],
      vigenteDe: l.vigente_de,
      vigenteAte: l.vigente_ate,
    })
    checksDoCard[l.card_id] = lista
  })

  const cardsDaEtapa = {}
  cards.rows.forEach((l) => {
    const lista = cardsDaEtapa[l.etapa_id] ?? []
    lista.push({
      id: String(l.id),
      ordem: l.ordem,
      titulo: l.titulo,
      cargos: cargosDoCard[l.id] ?? [],
      etiquetas: etiquetasDoCard[l.id] ?? [],
      checks: checksDoCard[l.id] ?? [],
      vigenteDe: l.vigente_de,
      vigenteAte: l.vigente_ate,
    })
    cardsDaEtapa[l.etapa_id] = lista
  })

  return etapas.rows.map((e) => ({
    id: String(e.id),
    ordem: e.ordem,
    // numero e recalculado por obra na tela; aqui vai a posicao geral
    numero: e.ordem,
    nome: e.nome,
    /* a linha de apoio embaixo do nome ("aguardando aprovacao").
       Texto livre e opcional: etapa sem descricao mostra so o nome. */
    descricao: e.descricao ?? '',
    cards: cardsDaEtapa[e.id] ?? [],
    vigenteDe: e.vigente_de,
    vigenteAte: e.vigente_ate,
  }))
}

router.get('/', exigeSessao, async (_req, res) => {
  try {
    return res.json({ etapas: await lerRoteiro() })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/ler')
  }
})

/* ------------------------------------------------------------
   Etapas
   ------------------------------------------------------------ */

router.post('/etapas', exigeSessao, exige('editar_etapa'), async (req, res) => {
  const nome = String(req.body?.nome ?? '').trim()
  const descricao = String(req.body?.descricao ?? '').trim()
  if (!nome) return res.status(400).json({ erro: 'Informe o nome da etapa.' })

  try {
    const desde = await momento(obraDaChamada(req))
    const { rows } = await query(
      `INSERT INTO etapa (ordem, nome, descricao, vigente_de)
       VALUES (coalesce((SELECT max(ordem) FROM etapa), 0) + 1, $1, $2, $3)
       RETURNING id, ordem, nome, descricao, vigente_de`,
      [nome, descricao || null, desde],
    )
    return res.status(201).json({
      etapa: {
        id: String(rows[0].id),
        numero: rows[0].ordem,
        ordem: rows[0].ordem,
        nome: rows[0].nome,
        descricao: rows[0].descricao ?? '',
        cards: [],
        vigenteDe: rows[0].vigente_de,
        vigenteAte: null,
      },
    })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/etapa-criar')
  }
})

/**
 * Renomear vale para todas as obras: e a mesma etapa, so trocou o
 * nome. A descricao segue a mesma regra — ela conta o ESTADO da
 * etapa ("aguardando aprovacao"), e esse estado e um so.
 *
 * `descricao` vem separada do `nome` de proposito: mandar so uma das
 * duas nao apaga a outra, e e isso que deixa a tela salvar o campo
 * que a pessoa mexeu sem ter de reenviar o resto.
 */
router.patch('/etapas/:id', exigeSessao, exige('editar_etapa'), async (req, res) => {
  const temNome = req.body?.nome !== undefined
  const temDescricao = req.body?.descricao !== undefined
  const nome = String(req.body?.nome ?? '').trim()
  const descricao = String(req.body?.descricao ?? '').trim()

  if (temNome && !nome) return res.status(400).json({ erro: 'Informe o nome da etapa.' })
  if (!temNome && !temDescricao) {
    return res.status(400).json({ erro: 'Nada para alterar na etapa.' })
  }

  try {
    const { rows } = await query(
      `UPDATE etapa
          SET nome      = coalesce($1, nome),
              descricao = CASE WHEN $2::boolean THEN $3 ELSE descricao END
        WHERE id = $4
      RETURNING id`,
      [temNome ? nome : null, temDescricao, descricao || null, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Etapa não encontrada.' })
    return res.json({ ok: true })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/etapa-editar')
  }
})

/**
 * Excluir NAO apaga: fecha a janela de vigencia.
 *
 * A etapa some desta obra e das proximas, e continua inteira nas
 * anteriores — com os cards, os checks e o que elas ja marcaram. Se
 * fosse DELETE de verdade, o historico das obras antigas ia junto.
 */
router.delete('/etapas/:id', exigeSessao, exige('editar_etapa'), async (req, res) => {
  try {
    const ate = await momento(obraDaChamada(req))
    const { rowCount } = await query(
      'UPDATE etapa SET vigente_ate = $1 WHERE id = $2 AND vigente_ate IS NULL',
      [ate, req.params.id],
    )
    if (rowCount === 0) return res.status(404).json({ erro: 'Etapa não encontrada.' })
    return res.status(204).end()
  } catch (erro) {
    return tratar(erro, res, 'roteiro/etapa-apagar')
  }
})

/* ------------------------------------------------------------
   Cards — um card pertence a 1..N cargos
   ------------------------------------------------------------ */

/** Regrava os cargos do card. Lista vazia nao passa: card sem dono nao marca nada. */
async function gravarCargos(cardId, chaves) {
  const limpas = [...new Set((chaves ?? []).map((c) => String(c).trim()).filter(Boolean))]
  if (limpas.length === 0) return { erro: 'Escolha ao menos um cargo para o card.' }

  const { rows } = await query('SELECT id, chave FROM cargo WHERE chave = ANY($1)', [limpas])
  if (rows.length !== limpas.length) return { erro: 'Cargo não encontrado.' }

  await query('DELETE FROM etapa_card_cargo WHERE card_id = $1', [cardId])
  // a ordem segue a que o usuario escolheu: e ela que decide o sentido do gradiente
  for (const [i, chave] of limpas.entries()) {
    const cargo = rows.find((r) => r.chave === chave)
    await query('INSERT INTO etapa_card_cargo (card_id, cargo_id, ordem) VALUES ($1, $2, $3)', [
      cardId,
      cargo.id,
      i,
    ])
  }
  return { ok: true }
}

router.post('/etapas/:id/cards', exigeSessao, exige('editar_cards'), async (req, res) => {
  const titulo = String(req.body?.titulo ?? '').trim() || null

  try {
    const etapa = await query('SELECT id FROM etapa WHERE id = $1', [req.params.id])
    if (!etapa.rows[0]) return res.status(404).json({ erro: 'Etapa não encontrada.' })

    const desde = await momento(obraDaChamada(req))
    const { rows } = await query(
      `INSERT INTO etapa_card (etapa_id, ordem, titulo, vigente_de)
       VALUES ($1, coalesce((SELECT max(ordem) FROM etapa_card WHERE etapa_id = $1), -1) + 1, $2, $3)
       RETURNING id`,
      [req.params.id, titulo, desde],
    )

    const posto = await gravarCargos(rows[0].id, req.body?.cargos)
    if (posto.erro) {
      await query('DELETE FROM etapa_card WHERE id = $1', [rows[0].id])
      return res.status(400).json({ erro: posto.erro })
    }

    return res.status(201).json({ id: String(rows[0].id) })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/card-criar')
  }
})

router.patch('/cards/:id', exigeSessao, exige('editar_cards'), async (req, res) => {
  try {
    const card = await query('SELECT id FROM etapa_card WHERE id = $1', [req.params.id])
    if (!card.rows[0]) return res.status(404).json({ erro: 'Card não encontrado.' })

    if (req.body?.titulo !== undefined) {
      await query('UPDATE etapa_card SET titulo = $1 WHERE id = $2', [
        String(req.body.titulo).trim() || null,
        req.params.id,
      ])
    }
    /* trocar o cargo dono do card e permissao propria: da para deixar
       alguem organizar cards sem poder mudar de quem eles sao */
    if (req.body?.cargos !== undefined) {
      if (!req.cargo?.acessoTotal && !(req.cargo?.permissoes ?? []).includes('editar_cargos_card')) {
        return res.status(403).json({ erro: 'Seu cargo não pode alterar os cargos do card.' })
      }
      const posto = await gravarCargos(req.params.id, req.body.cargos)
      if (posto.erro) return res.status(400).json({ erro: posto.erro })
    }
    return res.json({ ok: true })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/card-editar')
  }
})

router.delete('/cards/:id', exigeSessao, exige('editar_cards'), async (req, res) => {
  try {
    const ate = await momento(obraDaChamada(req))
    const { rowCount } = await query(
      'UPDATE etapa_card SET vigente_ate = $1 WHERE id = $2 AND vigente_ate IS NULL',
      [ate, req.params.id],
    )
    if (rowCount === 0) return res.status(404).json({ erro: 'Card não encontrado.' })
    return res.status(204).end()
  } catch (erro) {
    return tratar(erro, res, 'roteiro/card-apagar')
  }
})

/* ------------------------------------------------------------
   Checks
   ------------------------------------------------------------ */

/**
 * Regrava os cargos donos de UM check.
 *
 * Lista vazia apaga a excecao: o check volta a seguir o cargo do card.
 */
async function gravarCargosDoCheck(checkId, chaves) {
  const limpas = [...new Set((chaves ?? []).map((c) => String(c).trim()).filter(Boolean))]

  await query('DELETE FROM etapa_check_cargo WHERE check_id = $1', [checkId])
  if (limpas.length === 0) return { ok: true }

  const { rows } = await query('SELECT id, chave FROM cargo WHERE chave = ANY($1)', [limpas])
  if (rows.length !== limpas.length) return { erro: 'Cargo não encontrado.' }

  for (const [i, chave] of limpas.entries()) {
    const cargo = rows.find((r) => r.chave === chave)
    await query(
      'INSERT INTO etapa_check_cargo (check_id, cargo_id, ordem) VALUES ($1, $2, $3)',
      [checkId, cargo.id, i],
    )
  }
  return { ok: true }
}

router.post('/cards/:id/checks', exigeSessao, exige('editar_checks'), async (req, res) => {
  const titulo = String(req.body?.titulo ?? '').trim()
  if (!titulo) return res.status(400).json({ erro: 'Escreva o que precisa ser feito.' })

  try {
    const card = await query('SELECT id FROM etapa_card WHERE id = $1', [req.params.id])
    if (!card.rows[0]) return res.status(404).json({ erro: 'Card não encontrado.' })

    const desde = await momento(obraDaChamada(req))
    const { rows } = await query(
      `INSERT INTO etapa_check (card_id, ordem, titulo, vigente_de)
       VALUES ($1, coalesce((SELECT max(ordem) FROM etapa_check WHERE card_id = $1), -1) + 1, $2, $3)
       RETURNING id, ordem, titulo, vigente_de`,
      [req.params.id, titulo, desde],
    )

    if (req.body?.cargos !== undefined) {
      const posto = await gravarCargosDoCheck(rows[0].id, req.body.cargos)
      if (posto.erro) {
        await query('DELETE FROM etapa_check WHERE id = $1', [rows[0].id])
        return res.status(400).json({ erro: posto.erro })
      }
    }

    return res.status(201).json({
      check: {
        id: String(rows[0].id),
        ordem: rows[0].ordem,
        titulo: rows[0].titulo,
        cargos: req.body?.cargos ?? [],
        vigenteDe: rows[0].vigente_de,
        vigenteAte: null,
      },
    })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/check-criar')
  }
})

router.patch('/checks/:id', exigeSessao, exige('editar_checks'), async (req, res) => {
  try {
    if (req.body?.titulo !== undefined) {
      const titulo = String(req.body.titulo).trim()
      if (!titulo) return res.status(400).json({ erro: 'Escreva o que precisa ser feito.' })
      const { rows } = await query(
        'UPDATE etapa_check SET titulo = $1 WHERE id = $2 RETURNING id',
        [titulo, req.params.id],
      )
      if (!rows[0]) return res.status(404).json({ erro: 'Check não encontrado.' })
    }

    if (req.body?.cargos !== undefined) {
      const alvo = await query('SELECT id FROM etapa_check WHERE id = $1', [req.params.id])
      if (!alvo.rows[0]) return res.status(404).json({ erro: 'Check não encontrado.' })
      const posto = await gravarCargosDoCheck(req.params.id, req.body.cargos)
      if (posto.erro) return res.status(400).json({ erro: posto.erro })
    }

    return res.json({ ok: true })
  } catch (erro) {
    return tratar(erro, res, 'roteiro/check-editar')
  }
})

router.delete('/checks/:id', exigeSessao, exige('editar_checks'), async (req, res) => {
  try {
    const ate = await momento(obraDaChamada(req))
    const { rowCount } = await query(
      'UPDATE etapa_check SET vigente_ate = $1 WHERE id = $2 AND vigente_ate IS NULL',
      [ate, req.params.id],
    )
    if (rowCount === 0) return res.status(404).json({ erro: 'Check não encontrado.' })
    return res.status(204).end()
  } catch (erro) {
    return tratar(erro, res, 'roteiro/check-apagar')
  }
})

/* ------------------------------------------------------------
   Etiquetas de CARD

   Catalogo proprio (`etiqueta_card`), separado do das obras. As
   duas etiquetagens respondem a perguntas diferentes — a da obra
   diz o que a obra e, a do card diz o que aquele pedaco do
   roteiro e —, e compartilhar o catalogo faria a sugestao de uma
   aparecer na outra e uma renomeada de um lado mexer no outro.

   Precisa da atualizacao 7 do banco (db/atualizacao-7.sql.txt).
   Sem ela as tabelas nao existem, e as rotas respondem 501 em vez
   de derrubar a tela.
   ------------------------------------------------------------ */

const semTabela = (erro, res) =>
  erro.code === '42P01'
    ? res.status(501).json({
        erro: 'Etiquetas de card ainda não foram habilitadas no banco (atualização 7).',
      })
    : null

router.post('/cards/:id/etiquetas', exigeSessao, exige('editar_cards'), async (req, res) => {
  const nome = String(req.body?.nome ?? '').trim()
  const cor = String(req.body?.cor ?? '').trim() || '#6b7280'
  if (!nome) return res.status(400).json({ erro: 'Escreva o nome da etiqueta.' })
  if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(cor)) {
    return res.status(400).json({ erro: 'Cor inválida.' })
  }

  try {
    let etiqueta
    /* etiqueta escolhida da lista: reaproveita sem mexer no nome nem
       na cor dela — renomear e outra acao, com rota propria */
    if (req.body?.etiquetaId) {
      const achada = await query('SELECT * FROM etiqueta_card WHERE id = $1', [req.body.etiquetaId])
      etiqueta = achada.rows[0]
    }
    if (!etiqueta) {
      const criada = await query(
        `INSERT INTO etiqueta_card (nome, cor) VALUES ($1, $2)
         ON CONFLICT (lower(btrim(nome))) DO UPDATE SET cor = excluded.cor
         RETURNING *`,
        [nome, cor],
      )
      etiqueta = criada.rows[0]
    }

    await query(
      'INSERT INTO card_etiqueta (card_id, etiqueta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, etiqueta.id],
    )

    return res.status(201).json({
      etiqueta: { id: String(etiqueta.id), nome: etiqueta.nome, cor: etiqueta.cor },
    })
  } catch (erro) {
    if (semTabela(erro, res)) return undefined
    if (erro.code === '23503') return res.status(404).json({ erro: 'Card não encontrado.' })
    return tratar(erro, res, 'roteiro/etiqueta-card-criar')
  }
})

router.patch('/cards/etiquetas/:id', exigeSessao, exige('editar_cards'), async (req, res) => {
  const campos = []
  const valores = []

  if (req.body?.nome !== undefined) {
    const nome = String(req.body.nome ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Escreva o nome da etiqueta.' })
    valores.push(nome)
    campos.push(`nome = ${valores.length}`)
  }
  if (req.body?.cor !== undefined) {
    const cor = String(req.body.cor ?? '').trim()
    if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(cor)) {
      return res.status(400).json({ erro: 'Cor inválida.' })
    }
    valores.push(cor)
    campos.push(`cor = ${valores.length}`)
  }
  if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

  valores.push(req.params.id)
  try {
    const { rows } = await query(
      `UPDATE etiqueta_card SET ${campos.join(', ')} WHERE id = ${valores.length} RETURNING *`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Etiqueta não encontrada.' })
    return res.json({
      etiqueta: { id: String(rows[0].id), nome: rows[0].nome, cor: rows[0].cor },
    })
  } catch (erro) {
    if (semTabela(erro, res)) return undefined
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma etiqueta de card com esse nome.' })
    }
    return tratar(erro, res, 'roteiro/etiqueta-card-editar')
  }
})

/** Tira a etiqueta DESTE card; ela continua no catalogo para os outros. */
router.delete('/cards/:id/etiquetas/:etiquetaId', exigeSessao, exige('editar_cards'), async (req, res) => {
  try {
    await query('DELETE FROM card_etiqueta WHERE card_id = $1 AND etiqueta_id = $2', [
      req.params.id,
      req.params.etiquetaId,
    ])
    return res.status(204).end()
  } catch (erro) {
    if (semTabela(erro, res)) return undefined
    return tratar(erro, res, 'roteiro/etiqueta-card-tirar')
  }
})

export default router
