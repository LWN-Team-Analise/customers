import { Router } from 'express'
import { query } from '../db.js'
import { cargoPode, exige, exigeSessao, meuCargo, tratar } from '../sessao.js'

const router = Router()

const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')
const texto = (valor) => String(valor ?? '').trim()

/* ============================================================
   LEITURA — tudo o que o quadro precisa, numa resposta so.

   Sao poucas tabelas e o volume e pequeno (uma empresa, um
   quadro): buscar tudo de uma vez sai mais barato que uma
   chamada por tela e mantem o front sem estado pela metade.

   Duas coisas ficam DE FORA de proposito, porque sao pesadas e
   so interessam quando a pessoa abre a obra:
     - o conteudo dos anexos (aqui vem so nome/tamanho);
     - o chat (tem rota propria, /obras/:id/chat).
   ============================================================ */

const paraSetor = (l) => ({
  id: String(l.id),
  nome: l.nome,
  cor: l.cor,
})
const paraCliente = (l) => ({
  id: String(l.id),
  nome: l.nome,
  logo: l.logo,
  /* o setor e opcional: cliente antigo, ou ainda nao classificado, vem
     com null e a tela mostra "sem setor" */
  setorId: l.setor_id === null || l.setor_id === undefined ? null : String(l.setor_id),
  endereco: l.endereco ?? '',
  bairro: l.bairro ?? '',
  cidade: l.cidade ?? '',
  estado: l.estado ?? '',
  cep: l.cep ?? '',
  criadoEm: l.criado_em,
})

async function lerTudo(usuarioId) {
  const [
    clientes,
    setores,
    obras,
    marcados,
    membros,
    observacoes,
    avisos,
    avisoCargos,
    avaliacoes,
    quadro,
    etiquetas,
    obraEtiquetas,
    anexos,
    lidos,
  ] = await Promise.all([
    query('SELECT * FROM cliente ORDER BY lower(nome)'),
    /* os setores vem junto: sao poucos e a tela de Clientes precisa
       deles para pintar a etiqueta de cada card */
    query('SELECT * FROM setor_cliente ORDER BY lower(nome)').catch(() => ({ rows: [] })),
    query(`SELECT o.*, c.concluida_em,
                  autor.name  AS criado_por_nome,
                  editor.name AS atualizado_por_nome
             FROM obra o
             LEFT JOIN obra_conclusao c ON c.obra_id = o.id
             LEFT JOIN usuario autor    ON autor.id  = o.criado_por
             LEFT JOIN usuario editor   ON editor.id = o.atualizado_por
            ORDER BY o.criado_em`),
    query('SELECT obra_id, check_id, feito_por, feito_em FROM obra_check'),
    query('SELECT obra_id, usuario_id FROM obra_membro'),
    query('SELECT * FROM obra_observacao ORDER BY enviada_em DESC'),
    query(`SELECT a.*, u.name AS enviado_por_nome
             FROM obra_aviso a LEFT JOIN usuario u ON u.id = a.enviado_por
            ORDER BY a.enviado_em DESC`),
    query(`SELECT ac.aviso_id, c.chave
             FROM obra_aviso_cargo ac JOIN cargo c ON c.id = ac.cargo_id`),
    query('SELECT * FROM obra_avaliacao_item ORDER BY avaliado_em'),
    query('SELECT * FROM observacao_quadro ORDER BY enviada_em DESC'),
    query('SELECT * FROM etiqueta ORDER BY lower(nome)'),
    query('SELECT obra_id, etiqueta_id FROM obra_etiqueta'),
    query(`SELECT id, obra_id, nome, tipo, tamanho, autor_nome, enviado_por, enviado_em
             FROM obra_anexo ORDER BY enviado_em DESC`),
    query('SELECT aviso_id FROM aviso_leitura WHERE usuario_id = $1', [usuarioId]),
  ])

  const junta = (linhas, chave, monta) => {
    const mapa = {}
    linhas.forEach((l) => {
      const lista = mapa[l[chave]] ?? []
      lista.push(monta(l))
      mapa[l[chave]] = lista
    })
    return mapa
  }

  const checksDaObra = {}
  marcados.rows.forEach((l) => {
    const mapa = checksDaObra[l.obra_id] ?? {}
    mapa[String(l.check_id)] = {
      feitoPor: l.feito_por === null ? null : String(l.feito_por),
      feitoEm: l.feito_em,
    }
    checksDaObra[l.obra_id] = mapa
  })

  const membrosDaObra = junta(membros.rows, 'obra_id', (l) => String(l.usuario_id))
  const obsDaObra = junta(observacoes.rows, 'obra_id', (l) => ({
    id: String(l.id),
    autorId: l.usuario_id === null ? null : String(l.usuario_id),
    autorNome: l.autor_nome,
    texto: l.texto,
    enviadaEm: l.enviada_em,
    editadaEm: l.editada_em ?? null,
  }))

  const jaLidos = new Set(lidos.rows.map((l) => String(l.aviso_id)))
  const cargosDoAviso = junta(avisoCargos.rows, 'aviso_id', (l) => l.chave)
  const avisosDaObra = junta(avisos.rows, 'obra_id', (l) => ({
    id: String(l.id),
    etapa: l.etapa,
    mensagem: l.mensagem ?? '',
    setores: cargosDoAviso[l.id] ?? [],
    enviadoEm: l.enviado_em,
    enviadoPorNome: l.enviado_por_nome ?? null,
    lido: jaLidos.has(String(l.id)),
  }))

  /* a obra tem N notas (diretor, cliente, ...); a media delas e o que
     entra na media de cada participante — o gatilho do banco cuida */
  const notasDaObra = junta(avaliacoes.rows, 'obra_id', (l) => ({
    id: String(l.id),
    rotulo: l.rotulo,
    nota: Number(l.nota),
    descricao: l.descricao ?? '',
    avaliadaEm: l.avaliado_em,
  }))

  const etiquetasDaObra = junta(obraEtiquetas.rows, 'obra_id', (l) => String(l.etiqueta_id))
  const anexosDaObra = junta(anexos.rows, 'obra_id', (l) => ({
    id: String(l.id),
    nome: l.nome,
    tipo: l.tipo ?? '',
    tamanho: l.tamanho ?? 0,
    autorNome: l.autor_nome,
    enviadoPor: l.enviado_por === null ? null : String(l.enviado_por),
    enviadoEm: l.enviado_em,
  }))

  const media = (notas) => {
    if (!notas?.length) return null
    const soma = notas.reduce((total, n) => total + n.nota, 0)
    return {
      nota: Math.round((soma / notas.length) * 10) / 10,
      descricao: notas.map((n) => n.descricao).filter(Boolean).join(' | '),
      avaliadaEm: notas[notas.length - 1].avaliadaEm,
    }
  }

  return {
    clientes: clientes.rows.map(paraCliente),
    setores: setores.rows.map(paraSetor),
    etiquetas: etiquetas.rows.map((l) => ({
      id: String(l.id),
      nome: l.nome,
      cor: l.cor,
    })),
    obras: obras.rows.map((o) => ({
      id: String(o.id),
      clienteId: String(o.cliente_id),
      descricao: o.descricao,
      tipo: o.tipo,
      prioridade: o.prioridade,
      dataInicio: o.data_inicio,
      dataConclusao: o.data_conclusao,
      criadoEm: o.criado_em,
      criadoPor: o.criado_por === null ? null : String(o.criado_por),
      criadoPorNome: o.criado_por_nome ?? null,
      atualizadoEm: o.atualizado_em,
      atualizadoPor: o.atualizado_por === null ? null : String(o.atualizado_por),
      atualizadoPorNome: o.atualizado_por_nome ?? null,
      concluidaEm: o.concluida_em ?? null,
      checks: checksDaObra[o.id] ?? {},
      membros: membrosDaObra[o.id] ?? [],
      observacoes: obsDaObra[o.id] ?? [],
      avisos: avisosDaObra[o.id] ?? [],
      etiquetas: etiquetasDaObra[o.id] ?? [],
      anexos: anexosDaObra[o.id] ?? [],
      notas: notasDaObra[o.id] ?? [],
      avaliacao: media(notasDaObra[o.id]),
    })),
    observacoesQuadro: quadro.rows.map((l) => ({
      id: String(l.id),
      autorId: l.usuario_id === null ? null : String(l.usuario_id),
      autorNome: l.autor_nome,
      texto: l.texto,
      enviadaEm: l.enviada_em,
      editadaEm: l.editada_em ?? null,
    })),
  }
}

router.get('/', exigeSessao, async (req, res) => {
  try {
    return res.json(await lerTudo(req.dono.sub))
  } catch (erro) {
    return tratar(erro, res, 'dados/ler')
  }
})

/* ============================================================
   VITRINE — as logos dos clientes que giram na esfera do login

   E a UNICA rota de dados sem sessao, e de proposito: a esfera
   fica na tela de login, antes de existir token.

   Por isso ela devolve so a imagem, nada mais: nem nome, nem id,
   nem endereco. Quem abrir a resposta na mao ve um punhado de
   logos — a mesma coisa que ja ve na tela — e nada que ligue uma
   logo a um cadastro.

   O filtro `logo IS NOT NULL` e o que atende ao pedido de so
   aparecer quem TEM foto: cliente cadastrado sem logo (o "teste"
   da vida) simplesmente nao entra na esfera.
   ============================================================ */

const LIMITE_VITRINE = 24

router.get('/vitrine', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT logo FROM cliente
         WHERE logo IS NOT NULL AND logo <> ''
         ORDER BY lower(nome)
         LIMIT $1`,
      [LIMITE_VITRINE],
    )
    return res.json({ fotos: rows.map((l) => l.logo) })
  } catch (erro) {
    /* a esfera tem foto de reserva; um banco fora do ar nao pode
       derrubar a tela de login por causa de enfeite */
    console.error('[dados/vitrine]', erro.message)
    return res.json({ fotos: [] })
  }
})

/* ============================================================
   CLIENTES
   ============================================================ */

/** Campos do cliente vindos da tela, ja no formato do banco. */
function camposCliente(corpo) {
  const nome = texto(corpo?.nome)
  const cidade = texto(corpo?.cidade)
  const estado = texto(corpo?.estado).toUpperCase()
  const cep = soDigitos(corpo?.cep)

  if (!nome) return { erro: 'Informe o nome da empresa.' }
  if (!cidade) return { erro: 'Informe a cidade.' }
  if (!/^[A-Z]{2}$/.test(estado)) return { erro: 'Informe a UF com duas letras.' }
  if (cep && cep.length !== 8) return { erro: 'O CEP precisa ter 8 dígitos.' }

  return {
    valores: [
      nome,
      corpo?.logo || null,
      texto(corpo?.endereco) || null,
      texto(corpo?.bairro) || null,
      cidade,
      estado,
      cep || null,
      /* setor vazio vira NULL, e nao a string "": a coluna e uma chave
         estrangeira e so aceita id de verdade ou nada */
      texto(corpo?.setorId) || null,
    ],
  }
}

/* ============================================================
   SETORES DO CLIENTE

   O ramo em que a empresa atua. Quem mexe e quem pode mexer em
   cliente — e a mesma tela e a mesma decisao.

   Apagar um setor NAO apaga os clientes dele: a chave estrangeira
   e ON DELETE SET NULL, entao eles voltam para "sem setor" e a
   pessoa reclassifica com calma.
   ============================================================ */


const SEM_TABELA_SETOR = 'A tabela de setores ainda não existe. Rode o SQL de db/setores-e-chat.sql.txt.'

router.post('/setores', exigeSessao, exige('editar_clientes'), async (req, res) => {
  const nome = texto(req.body?.nome)
  const cor = texto(req.body?.cor) || '#3a63e8'
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do setor.' })

  try {
    const { rows } = await query(
      'INSERT INTO setor_cliente (nome, cor) VALUES ($1, $2) RETURNING *',
      [nome, cor],
    )
    return res.status(201).json({ setor: paraSetor(rows[0]) })
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um setor com esse nome.' })
    }
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_SETOR })
    return tratar(e, res, 'dados/setor-criar')
  }
})

router.patch('/setores/:id', exigeSessao, exige('editar_clientes'), async (req, res) => {
  const nome = texto(req.body?.nome)
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do setor.' })

  try {
    const { rows } = await query(
      'UPDATE setor_cliente SET nome = $1, cor = coalesce($2, cor) WHERE id = $3 RETURNING *',
      [nome, texto(req.body?.cor) || null, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Setor não encontrado.' })
    return res.json({ setor: paraSetor(rows[0]) })
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um setor com esse nome.' })
    }
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_SETOR })
    return tratar(e, res, 'dados/setor-editar')
  }
})

router.delete('/setores/:id', exigeSessao, exige('editar_clientes'), async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM setor_cliente WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ erro: 'Setor não encontrado.' })
    return res.status(204).end()
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_SETOR })
    return tratar(e, res, 'dados/setor-apagar')
  }
})

router.post('/clientes', exigeSessao, exige('editar_clientes'), async (req, res) => {
  const { erro, valores } = camposCliente(req.body)
  if (erro) return res.status(400).json({ erro })

  try {
    const { rows } = await query(
      `INSERT INTO cliente (nome, logo, endereco, bairro, cidade, estado, cep, setor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      valores,
    )
    return res.status(201).json({ cliente: paraCliente(rows[0]) })
  } catch (e) {
    return tratar(e, res, 'dados/cliente-criar')
  }
})

router.patch('/clientes/:id', exigeSessao, exige('editar_clientes'), async (req, res) => {
  const { erro, valores } = camposCliente(req.body)
  if (erro) return res.status(400).json({ erro })

  try {
    const { rows } = await query(
      `UPDATE cliente SET nome = $1, logo = $2, endereco = $3, bairro = $4,
                          cidade = $5, estado = $6, cep = $7, setor_id = $8
        WHERE id = $9 RETURNING *`,
      [...valores, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Cliente não encontrado.' })
    return res.json({ cliente: paraCliente(rows[0]) })
  } catch (e) {
    return tratar(e, res, 'dados/cliente-editar')
  }
})

/** Apagar cliente leva junto as obras dele — a tela ja avisa disso. */
router.delete('/clientes/:id', exigeSessao, exige('editar_clientes'), async (req, res) => {
  try {
    await query('DELETE FROM obra WHERE cliente_id = $1', [req.params.id])
    const { rowCount } = await query('DELETE FROM cliente WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' })
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/cliente-apagar')
  }
})

/* ============================================================
   CHAT DO SITE

   A conversa geral da equipe — a que o botao flutuante abre em
   qualquer tela. E separada do chat da obra de proposito: aquele
   morre com a obra e vira historico dela; este e do dia a dia e
   nao pertence a obra nenhuma.

   Nao exige permissao: conversar e de todo mundo que entra. O que
   se controla e QUEM APAGA — cada um tira so a propria mensagem.
   ============================================================ */

const SEM_TABELA_CHAT = 'O chat do site ainda não existe no banco. Rode o SQL de db/setores-e-chat.sql.txt.'

const paraMensagemSite = (l) => ({
  id: String(l.id),
  autorId: l.usuario_id === null ? null : String(l.usuario_id),
  autorNome: l.autor_nome,
  texto: l.texto ?? '',
  enviadaEm: l.enviada_em,
  editadaEm: l.editada_em ?? null,
})

/* As 300 ultimas. E conversa de equipe, nao arquivo: ninguem rola tres
   mil mensagens para tras, e mandar todas engorda a resposta a toa. */
const LIMITE_CHAT = 300

router.get('/chat', exigeSessao, async (_req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM (SELECT * FROM chat_site ORDER BY enviada_em DESC LIMIT $1) t ORDER BY enviada_em',
      [LIMITE_CHAT],
    )
    return res.json({ mensagens: rows.map(paraMensagemSite) })
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_CHAT })
    return tratar(e, res, 'dados/chat-site-ler')
  }
})

router.post('/chat', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a mensagem.' })

  try {
    const { rows } = await query(
      `INSERT INTO chat_site (usuario_id, autor_nome, texto)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.dono.sub, texto(req.body?.autorNome) || 'Usuário', conteudo],
    )
    return res.status(201).json({ mensagem: paraMensagemSite(rows[0]) })
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_CHAT })
    return tratar(e, res, 'dados/chat-site-criar')
  }
})

/* Cada um apaga so a propria mensagem. A conferencia e aqui, e nao na
   tela: esconder o botao nao impede a chamada na mao. */
router.delete('/chat/:id', exigeSessao, async (req, res) => {
  try {
    const dona = await query('SELECT usuario_id FROM chat_site WHERE id = $1', [req.params.id])
    if (!dona.rows[0]) return res.status(404).json({ erro: 'Mensagem não encontrada.' })
    if (String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Só quem escreveu pode apagar a mensagem.' })
    }
    await query('DELETE FROM chat_site WHERE id = $1', [req.params.id])
    return res.status(204).end()
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_CHAT })
    return tratar(e, res, 'dados/chat-site-apagar')
  }
})

/* ============================================================
   OBRAS
   ============================================================ */

const PRIORIDADES = ['baixa', 'media', 'alta']

router.post('/obras', exigeSessao, exige('editar_obras'), async (req, res) => {
  const clienteId = texto(req.body?.clienteId)
  const descricao = texto(req.body?.descricao)
  const tipo = req.body?.tipo === 'emergencia' ? 'emergencia' : 'padrao'
  // emergencia e sempre alta; o gatilho do banco garante, aqui so evita ida a toa
  const prioridade = tipo === 'emergencia' ? 'alta' : (req.body?.prioridade ?? 'media')

  if (!clienteId) return res.status(400).json({ erro: 'Escolha a empresa.' })
  if (!descricao) return res.status(400).json({ erro: 'Descreva a obra.' })
  if (!PRIORIDADES.includes(prioridade)) return res.status(400).json({ erro: 'Prioridade inválida.' })

  try {
    const { rows } = await query(
      `INSERT INTO obra (cliente_id, descricao, tipo, prioridade,
                         data_inicio, data_conclusao, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, coalesce($5::date, CURRENT_DATE), $6, $7, $7)
       RETURNING id`,
      [
        clienteId,
        descricao,
        tipo,
        prioridade,
        req.body?.dataInicio || null,
        req.body?.dataConclusao || null,
        req.dono.sub,
      ],
    )
    return res.status(201).json({ id: String(rows[0].id) })
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ erro: 'Cliente não encontrado.' })
    return tratar(e, res, 'dados/obra-criar')
  }
})

router.patch('/obras/:id', exigeSessao, exige('editar_obras'), async (req, res) => {
  const campos = []
  const valores = []
  const por = (coluna, valor) => {
    valores.push(valor)
    campos.push(`${coluna} = $${valores.length}`)
  }

  if (req.body?.descricao !== undefined) por('descricao', texto(req.body.descricao))
  if (req.body?.clienteId !== undefined) por('cliente_id', req.body.clienteId)
  if (req.body?.dataInicio !== undefined) por('data_inicio', req.body.dataInicio || null)
  if (req.body?.dataConclusao !== undefined) por('data_conclusao', req.body.dataConclusao || null)
  if (req.body?.tipo !== undefined) {
    if (!['padrao', 'emergencia'].includes(req.body.tipo)) {
      return res.status(400).json({ erro: 'Tipo de obra inválido.' })
    }
    por('tipo', req.body.tipo)
  }
  if (req.body?.prioridade !== undefined) {
    if (!PRIORIDADES.includes(req.body.prioridade)) {
      return res.status(400).json({ erro: 'Prioridade inválida.' })
    }
    por('prioridade', req.body.prioridade)
  }
  if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

  // toda edicao carimba quem mexeu; o atualizado_em fica com o gatilho
  por('atualizado_por', req.dono.sub)

  valores.push(req.params.id)
  try {
    const { rows } = await query(
      `UPDATE obra SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Obra não encontrada.' })
    return res.json({ ok: true })
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ erro: 'Cliente não encontrado.' })
    return tratar(e, res, 'dados/obra-editar')
  }
})

router.delete('/obras/:id', exigeSessao, exige('editar_obras'), async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM obra WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ erro: 'Obra não encontrada.' })
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/obra-apagar')
  }
})

/* ------------------------------------------------------------
   Marcar / desmarcar check

   A regra e a mesma da tela: cada cargo mexe no card que e dele.
   Repetida aqui porque a tela pode ser burlada e o banco, nao.

   Duas saidas dessa trava:
     - o cargo tem a permissao "check em todas as etapas";
     - a obra e de EMERGENCIA (ali ninguem espera por setor).
   ------------------------------------------------------------ */

async function podeMarcar(usuarioId, checkId, obraId) {
  const meu = await meuCargo(usuarioId)
  if (cargoPode(meu, 'check_todas_etapas')) return true

  const obra = await query('SELECT tipo FROM obra WHERE id = $1', [obraId])
  if (obra.rows[0]?.tipo === 'emergencia') return true

  /* o check pode ter dono proprio; se tiver, e ele quem decide, e o
     cargo do card nao entra na conta */
  const proprio = await query(
    `SELECT c.chave
       FROM etapa_check_cargo kc JOIN cargo c ON c.id = kc.cargo_id
      WHERE kc.check_id = $1`,
    [checkId],
  )
  if (proprio.rows.length > 0) return proprio.rows.some((l) => l.chave === meu.chave)

  const { rows } = await query(
    `SELECT c.chave
       FROM etapa_check ck
       JOIN etapa_card_cargo cc ON cc.card_id = ck.card_id
       JOIN cargo c             ON c.id = cc.cargo_id
      WHERE ck.id = $1`,
    [checkId],
  )
  return rows.some((l) => l.chave === meu.chave)
}

router.put('/obras/:id/checks/:checkId', exigeSessao, async (req, res) => {
  try {
    if (!(await podeMarcar(req.dono.sub, req.params.checkId, req.params.id))) {
      return res.status(403).json({ erro: 'Este check é de outro setor.' })
    }
    await query(
      `INSERT INTO obra_check (obra_id, check_id, feito_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (obra_id, check_id) DO NOTHING`,
      [req.params.id, req.params.checkId, req.dono.sub],
    )
    return res.json({ ok: true })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra ou check não encontrado.' })
    return tratar(e, res, 'dados/check-marcar')
  }
})

router.delete('/obras/:id/checks/:checkId', exigeSessao, async (req, res) => {
  try {
    if (!(await podeMarcar(req.dono.sub, req.params.checkId, req.params.id))) {
      return res.status(403).json({ erro: 'Este check é de outro setor.' })
    }
    await query('DELETE FROM obra_check WHERE obra_id = $1 AND check_id = $2', [
      req.params.id,
      req.params.checkId,
    ])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/check-desmarcar')
  }
})

/* ------------------------------------------------------------
   Observacoes da obra

   Cada um edita e apaga a PROPRIA observacao. Quando edita, fica
   o carimbo de editada_em — e a tela mostra "editada" no rodape.
   Cargo com acesso total continua podendo limpar qualquer uma.
   ------------------------------------------------------------ */

router.post('/obras/:id/observacoes', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a observação.' })

  try {
    const { rows } = await query(
      `INSERT INTO obra_observacao (obra_id, usuario_id, autor_nome, texto)
       VALUES ($1, $2, $3, $4) RETURNING id, enviada_em`,
      [req.params.id, req.dono.sub, texto(req.body?.autorNome) || 'Usuário', conteudo],
    )
    return res.status(201).json({ id: String(rows[0].id), enviadaEm: rows[0].enviada_em })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra não encontrada.' })
    return tratar(e, res, 'dados/obs-criar')
  }
})

router.patch('/obras/:id/observacoes/:obsId', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a observação.' })

  try {
    const dona = await query('SELECT usuario_id FROM obra_observacao WHERE id = $1', [
      req.params.obsId,
    ])
    if (!dona.rows[0]) return res.status(404).json({ erro: 'Observação não encontrada.' })
    if (String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só edita a sua própria observação.' })
    }

    const { rows } = await query(
      `UPDATE obra_observacao SET texto = $1, editada_em = now()
        WHERE id = $2 AND obra_id = $3 RETURNING editada_em`,
      [conteudo, req.params.obsId, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Observação não encontrada.' })
    return res.json({ editadaEm: rows[0].editada_em })
  } catch (e) {
    return tratar(e, res, 'dados/obs-editar')
  }
})

router.delete('/obras/:id/observacoes/:obsId', exigeSessao, async (req, res) => {
  try {
    const dona = await query('SELECT usuario_id FROM obra_observacao WHERE id = $1', [
      req.params.obsId,
    ])
    if (!dona.rows[0]) return res.status(204).end()

    const meu = await meuCargo(req.dono.sub)
    if (!meu.acessoTotal && String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só apaga a sua própria observação.' })
    }

    await query('DELETE FROM obra_observacao WHERE id = $1 AND obra_id = $2', [
      req.params.obsId,
      req.params.id,
    ])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/obs-apagar')
  }
})

/* ------------------------------------------------------------
   Observacoes do quadro (tela de Obras, valem para o quadro todo)
   ------------------------------------------------------------ */

router.post('/observacoes', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a observação.' })

  try {
    const { rows } = await query(
      `INSERT INTO observacao_quadro (usuario_id, autor_nome, texto)
       VALUES ($1, $2, $3) RETURNING id, enviada_em`,
      [req.dono.sub, texto(req.body?.autorNome) || 'Usuário', conteudo],
    )
    return res.status(201).json({ id: String(rows[0].id), enviadaEm: rows[0].enviada_em })
  } catch (e) {
    return tratar(e, res, 'dados/obs-quadro-criar')
  }
})

router.patch('/observacoes/:id', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a observação.' })

  try {
    const dona = await query('SELECT usuario_id FROM observacao_quadro WHERE id = $1', [
      req.params.id,
    ])
    if (!dona.rows[0]) return res.status(404).json({ erro: 'Observação não encontrada.' })
    if (String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só edita a sua própria observação.' })
    }

    const { rows } = await query(
      'UPDATE observacao_quadro SET texto = $1, editada_em = now() WHERE id = $2 RETURNING editada_em',
      [conteudo, req.params.id],
    )
    return res.json({ editadaEm: rows[0].editada_em })
  } catch (e) {
    return tratar(e, res, 'dados/obs-quadro-editar')
  }
})

router.delete('/observacoes/:id', exigeSessao, async (req, res) => {
  try {
    const dona = await query('SELECT usuario_id FROM observacao_quadro WHERE id = $1', [
      req.params.id,
    ])
    if (!dona.rows[0]) return res.status(204).end()

    const meu = await meuCargo(req.dono.sub)
    if (!meu.acessoTotal && String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só apaga a sua própria observação.' })
    }

    await query('DELETE FROM observacao_quadro WHERE id = $1', [req.params.id])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/obs-quadro-apagar')
  }
})

/* ------------------------------------------------------------
   Avisos aos setores pendentes
   ------------------------------------------------------------ */

router.post('/obras/:id/avisos', exigeSessao, exige('enviar_avisos'), async (req, res) => {
  const setores = (req.body?.setores ?? []).map(texto).filter(Boolean)
  if (setores.length === 0) return res.status(400).json({ erro: 'Nenhum setor para avisar.' })

  try {
    const { rows } = await query(
      `INSERT INTO obra_aviso (obra_id, etapa, mensagem, enviado_por)
       VALUES ($1, $2, $3, $4) RETURNING id, enviado_em`,
      [req.params.id, Number(req.body?.etapa) || 1, texto(req.body?.mensagem), req.dono.sub],
    )
    await query(
      `INSERT INTO obra_aviso_cargo (aviso_id, cargo_id)
       SELECT $1, id FROM cargo WHERE chave = ANY($2)`,
      [rows[0].id, setores],
    )
    /* quem disparou ja "leu" o proprio aviso: senao o sininho dele
       apitaria por um recado que ele mesmo escreveu */
    await query(
      'INSERT INTO aviso_leitura (aviso_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [rows[0].id, req.dono.sub],
    )
    return res.status(201).json({ id: String(rows[0].id), enviadoEm: rows[0].enviado_em })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra não encontrada.' })
    return tratar(e, res, 'dados/aviso-criar')
  }
})

/** Marca avisos como lidos — e o que zera o selo do sininho. */
router.post('/avisos/lidos', exigeSessao, async (req, res) => {
  const ids = (req.body?.ids ?? []).map((n) => Number(n)).filter(Number.isFinite)
  if (ids.length === 0) return res.json({ ok: true })

  try {
    await query(
      `INSERT INTO aviso_leitura (aviso_id, usuario_id)
       SELECT unnest($1::bigint[]), $2
       ON CONFLICT DO NOTHING`,
      [ids, req.dono.sub],
    )
    return res.json({ ok: true })
  } catch (e) {
    return tratar(e, res, 'dados/aviso-lido')
  }
})

/* ------------------------------------------------------------
   Avaliacoes da obra

   Sao varias por obra: a do diretor, a do cliente e quantas mais
   quiserem. A media delas e o que o banco guarda em
   obra_avaliacao (por gatilho) e o que entra na nota de cada
   participante. Uma obra avaliada precisa ter pelo menos uma.
   ------------------------------------------------------------ */

const nota = (valor) => {
  const n = Number(String(valor ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null
}

router.post('/obras/:id/avaliacoes', exigeSessao, exige('editar_avaliacoes'), async (req, res) => {
  const valor = nota(req.body?.nota)
  if (valor === null) return res.status(400).json({ erro: 'A nota vai de 0 a 10.' })

  try {
    const { rows } = await query(
      `INSERT INTO obra_avaliacao_item (obra_id, rotulo, nota, descricao, avaliado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, avaliado_em`,
      [
        req.params.id,
        texto(req.body?.rotulo) || 'Avaliação',
        valor,
        texto(req.body?.descricao) || null,
        req.dono.sub,
      ],
    )
    return res.status(201).json({ id: String(rows[0].id), avaliadaEm: rows[0].avaliado_em })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra não encontrada.' })
    return tratar(e, res, 'dados/avaliacao-criar')
  }
})

router.patch('/avaliacoes/:id', exigeSessao, exige('editar_avaliacoes'), async (req, res) => {
  const campos = []
  const valores = []
  const por = (coluna, valor) => {
    valores.push(valor)
    campos.push(`${coluna} = $${valores.length}`)
  }

  if (req.body?.nota !== undefined) {
    const valor = nota(req.body.nota)
    if (valor === null) return res.status(400).json({ erro: 'A nota vai de 0 a 10.' })
    por('nota', valor)
  }
  if (req.body?.rotulo !== undefined) por('rotulo', texto(req.body.rotulo) || 'Avaliação')
  if (req.body?.descricao !== undefined) por('descricao', texto(req.body.descricao) || null)
  if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

  valores.push(req.params.id)
  try {
    const { rows } = await query(
      `UPDATE obra_avaliacao_item SET ${campos.join(', ')}
        WHERE id = $${valores.length} RETURNING id`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Avaliação não encontrada.' })
    return res.json({ ok: true })
  } catch (e) {
    return tratar(e, res, 'dados/avaliacao-editar')
  }
})

router.delete('/avaliacoes/:id', exigeSessao, exige('editar_avaliacoes'), async (req, res) => {
  try {
    const alvo = await query('SELECT obra_id FROM obra_avaliacao_item WHERE id = $1', [
      req.params.id,
    ])
    if (!alvo.rows[0]) return res.status(204).end()

    /* obra avaliada tem que ficar com pelo menos uma nota: para tirar
       a avaliacao inteira existe o DELETE /obras/:id/avaliacao */
    const quantas = await query(
      'SELECT count(*)::int AS n FROM obra_avaliacao_item WHERE obra_id = $1',
      [alvo.rows[0].obra_id],
    )
    if (quantas.rows[0].n <= 1) {
      return res.status(409).json({
        erro: 'A obra precisa ficar com ao menos uma avaliação. Use "Remover avaliação" para tirar todas.',
      })
    }

    await query('DELETE FROM obra_avaliacao_item WHERE id = $1', [req.params.id])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/avaliacao-apagar')
  }
})

/** Tira a avaliacao inteira da obra (todas as notas de uma vez). */
router.delete('/obras/:id/avaliacao', exigeSessao, exige('editar_avaliacoes'), async (req, res) => {
  try {
    await query('DELETE FROM obra_avaliacao_item WHERE obra_id = $1', [req.params.id])
    await query('DELETE FROM obra_avaliacao WHERE obra_id = $1', [req.params.id])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/avaliacao-limpar')
  }
})

/* ------------------------------------------------------------
   Etiquetas

   A etiqueta e do sistema (da para reaproveitar em varias obras)
   e obra_etiqueta e quem usa qual. Criar uma etiqueta com nome
   que ja existe apenas reaproveita a que existe.
   ------------------------------------------------------------ */

router.post('/obras/:id/etiquetas', exigeSessao, exige('editar_obras'), async (req, res) => {
  const nome = texto(req.body?.nome)
  const cor = texto(req.body?.cor) || '#6b7280'
  if (!nome) return res.status(400).json({ erro: 'Escreva o nome da etiqueta.' })
  if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(cor)) {
    return res.status(400).json({ erro: 'Cor inválida.' })
  }

  try {
    let etiqueta
    if (req.body?.etiquetaId) {
      const achada = await query('SELECT * FROM etiqueta WHERE id = $1', [req.body.etiquetaId])
      etiqueta = achada.rows[0]
    }
    if (!etiqueta) {
      const criada = await query(
        `INSERT INTO etiqueta (nome, cor) VALUES ($1, $2)
         ON CONFLICT (lower(btrim(nome))) DO UPDATE SET cor = excluded.cor
         RETURNING *`,
        [nome, cor],
      )
      etiqueta = criada.rows[0]
    }

    await query(
      'INSERT INTO obra_etiqueta (obra_id, etiqueta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, etiqueta.id],
    )
    await query('UPDATE obra SET atualizado_por = $1 WHERE id = $2', [req.dono.sub, req.params.id])

    return res.status(201).json({
      etiqueta: { id: String(etiqueta.id), nome: etiqueta.nome, cor: etiqueta.cor },
    })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra não encontrada.' })
    return tratar(e, res, 'dados/etiqueta-criar')
  }
})

router.patch('/etiquetas/:id', exigeSessao, exige('editar_obras'), async (req, res) => {
  const campos = []
  const valores = []

  if (req.body?.nome !== undefined) {
    const nome = texto(req.body.nome)
    if (!nome) return res.status(400).json({ erro: 'Escreva o nome da etiqueta.' })
    valores.push(nome)
    campos.push(`nome = $${valores.length}`)
  }
  if (req.body?.cor !== undefined) {
    const cor = texto(req.body.cor)
    if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(cor)) {
      return res.status(400).json({ erro: 'Cor inválida.' })
    }
    valores.push(cor)
    campos.push(`cor = $${valores.length}`)
  }
  if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

  valores.push(req.params.id)
  try {
    const { rows } = await query(
      `UPDATE etiqueta SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING *`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Etiqueta não encontrada.' })
    return res.json({
      etiqueta: { id: String(rows[0].id), nome: rows[0].nome, cor: rows[0].cor },
    })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'Já existe uma etiqueta com esse nome.' })
    return tratar(e, res, 'dados/etiqueta-editar')
  }
})

/** Tira a etiqueta DESTA obra; a etiqueta continua existindo para as outras. */
router.delete('/obras/:id/etiquetas/:etiquetaId', exigeSessao, exige('editar_obras'), async (req, res) => {
  try {
    await query('DELETE FROM obra_etiqueta WHERE obra_id = $1 AND etiqueta_id = $2', [
      req.params.id,
      req.params.etiquetaId,
    ])
    /* etiqueta que nao esta em nenhuma obra some da lista: senao a
       caixa de sugestoes vira um cemiterio de nomes antigos */
    await query(
      `DELETE FROM etiqueta e
        WHERE e.id = $1
          AND NOT EXISTS (SELECT 1 FROM obra_etiqueta oe WHERE oe.etiqueta_id = e.id)`,
      [req.params.etiquetaId],
    )
    await query('UPDATE obra SET atualizado_por = $1 WHERE id = $2', [req.dono.sub, req.params.id])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/etiqueta-tirar')
  }
})

/* ------------------------------------------------------------
   Anexos da obra

   O conteudo (data URL) NAO vem na leitura do quadro: seria
   arrastar megabytes a cada carregamento. A lista traz nome e
   tamanho; o arquivo em si so quando alguem clica para baixar.
   ------------------------------------------------------------ */

router.post('/obras/:id/anexos', exigeSessao, exige('editar_obras'), async (req, res) => {
  const nome = texto(req.body?.nome)
  const conteudo = String(req.body?.conteudo ?? '')

  if (!nome) return res.status(400).json({ erro: 'O arquivo precisa de um nome.' })
  if (!conteudo.startsWith('data:')) {
    return res.status(400).json({ erro: 'Arquivo inválido.' })
  }

  try {
    const { rows } = await query(
      `INSERT INTO obra_anexo (obra_id, nome, tipo, tamanho, conteudo, enviado_por, autor_nome)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, enviado_em`,
      [
        req.params.id,
        nome,
        texto(req.body?.tipo) || null,
        Number(req.body?.tamanho) || conteudo.length,
        conteudo,
        req.dono.sub,
        texto(req.body?.autorNome) || 'Usuário',
      ],
    )
    await query('UPDATE obra SET atualizado_por = $1 WHERE id = $2', [req.dono.sub, req.params.id])
    return res.status(201).json({ id: String(rows[0].id), enviadoEm: rows[0].enviado_em })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra não encontrada.' })
    return tratar(e, res, 'dados/anexo-criar')
  }
})

router.get('/anexos/:id', exigeSessao, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT nome, tipo, conteudo FROM obra_anexo WHERE id = $1',
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Anexo não encontrado.' })
    return res.json({
      nome: rows[0].nome,
      tipo: rows[0].tipo ?? '',
      conteudo: rows[0].conteudo,
    })
  } catch (e) {
    return tratar(e, res, 'dados/anexo-ler')
  }
})

router.delete('/anexos/:id', exigeSessao, exige('editar_obras'), async (req, res) => {
  try {
    await query('DELETE FROM obra_anexo WHERE id = $1', [req.params.id])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/anexo-apagar')
  }
})

/* ------------------------------------------------------------
   Chat da obra

   Cada obra tem a sua conversa, e ela fica gravada. A mensagem
   pode responder outra, levar um arquivo e mencionar pessoas —
   as mencoes viram uma lista de ids, para a tela destacar.
   ------------------------------------------------------------ */

const paraMensagem = (l) => ({
  id: String(l.id),
  autorId: l.usuario_id === null ? null : String(l.usuario_id),
  autorNome: l.autor_nome,
  texto: l.texto ?? '',
  respondeA: l.responde_a === null ? null : String(l.responde_a),
  arquivo: l.arquivo_nome
    ? { nome: l.arquivo_nome, tipo: l.arquivo_tipo ?? '', conteudo: l.arquivo_conteudo }
    : null,
  enviadaEm: l.enviada_em,
  editadaEm: l.editada_em ?? null,
  mencoes: [],
})

router.get('/obras/:id/chat', exigeSessao, async (req, res) => {
  try {
    const [mensagens, mencoes] = await Promise.all([
      query('SELECT * FROM obra_chat WHERE obra_id = $1 ORDER BY enviada_em', [req.params.id]),
      query(
        `SELECT m.mensagem_id, m.usuario_id
           FROM obra_chat_mencao m JOIN obra_chat c ON c.id = m.mensagem_id
          WHERE c.obra_id = $1`,
        [req.params.id],
      ),
    ])

    const porMensagem = {}
    mencoes.rows.forEach((l) => {
      const lista = porMensagem[l.mensagem_id] ?? []
      lista.push(String(l.usuario_id))
      porMensagem[l.mensagem_id] = lista
    })

    return res.json({
      mensagens: mensagens.rows.map((l) => ({
        ...paraMensagem(l),
        mencoes: porMensagem[l.id] ?? [],
      })),
    })
  } catch (e) {
    return tratar(e, res, 'dados/chat-ler')
  }
})

router.post('/obras/:id/chat', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  const arquivo = req.body?.arquivo ?? null

  if (!conteudo && !arquivo?.conteudo) {
    return res.status(400).json({ erro: 'Escreva uma mensagem ou anexe um arquivo.' })
  }
  if (arquivo?.conteudo && !String(arquivo.conteudo).startsWith('data:')) {
    return res.status(400).json({ erro: 'Arquivo inválido.' })
  }

  try {
    const { rows } = await query(
      `INSERT INTO obra_chat (obra_id, usuario_id, autor_nome, texto, responde_a,
                              arquivo_nome, arquivo_tipo, arquivo_conteudo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.params.id,
        req.dono.sub,
        texto(req.body?.autorNome) || 'Usuário',
        conteudo || null,
        req.body?.respondeA || null,
        arquivo?.nome ? texto(arquivo.nome) : null,
        arquivo?.tipo ? texto(arquivo.tipo) : null,
        arquivo?.conteudo ?? null,
      ],
    )

    const mencoes = [...new Set((req.body?.mencoes ?? []).map((n) => Number(n)).filter(Number.isFinite))]
    if (mencoes.length > 0) {
      await query(
        `INSERT INTO obra_chat_mencao (mensagem_id, usuario_id)
         SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`,
        [rows[0].id, mencoes],
      )
    }

    return res.status(201).json({
      mensagem: { ...paraMensagem(rows[0]), mencoes: mencoes.map(String) },
    })
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ erro: 'Obra não encontrada.' })
    return tratar(e, res, 'dados/chat-enviar')
  }
})

router.delete('/obras/:id/chat/:mensagemId', exigeSessao, async (req, res) => {
  try {
    const dona = await query('SELECT usuario_id FROM obra_chat WHERE id = $1', [
      req.params.mensagemId,
    ])
    if (!dona.rows[0]) return res.status(204).end()

    const meu = await meuCargo(req.dono.sub)
    if (!meu.acessoTotal && String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só apaga as suas próprias mensagens.' })
    }

    await query('DELETE FROM obra_chat WHERE id = $1 AND obra_id = $2', [
      req.params.mensagemId,
      req.params.id,
    ])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/chat-apagar')
  }
})

export default router
