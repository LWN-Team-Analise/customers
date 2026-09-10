import { Router } from 'express'
import { query } from '../db.js'
import { cargoPode, exige, exigeSessao, meuCargo, tratar } from '../sessao.js'
import { enviarAviso, temEmail } from '../email.js'

const router = Router()

const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')
const texto = (valor) => String(valor ?? '').trim()

/* ============================================================
   OBRA FECHADA E REGISTRO, NAO RASCUNHO

   Depois que alguem clica em "Concluir obra", nada mais entra
   nela: nem mensagem no chat, nem observacao, nem etiqueta,
   nem anexo, nem check. A tela ja esconde os botoes; isto aqui
   e o que impede chamar a API na mao — e o que garante que a
   ficha de rastreabilidade continue valendo como registro.

   Usa-se como middleware, antes do handler:

       router.post('/obras/:id/x', exigeSessao, obraAberta, ...)

   O id da obra sai de req.params.id, que e como todas as rotas
   de dentro da obra ja se chamam.
   ============================================================ */

async function obraAberta(req, res, next) {
  try {
    const { rows } = await query('SELECT concluida_em FROM obra WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ erro: 'Obra não encontrada.' })
    if (rows[0].concluida_em) {
      return res.status(409).json({
        erro: 'Esta obra foi concluída. O conteúdo dela fica só para consulta.',
      })
    }
    return next()
  } catch (erro) {
    /* banco ainda sem a coluna nova: nao trava o sistema, so deixa de
       proteger — quem rodar db/atualizacao-2.sql.txt ganha a trava */
    if (erro.code === '42703') return next()
    return tratar(erro, res, 'dados/obra-aberta')
  }
}

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
/**
 * 'AAAA-MM-DD' a partir do que o Postgres devolveu para uma coluna DATE.
 *
 * O driver entrega um Date em meia-noite LOCAL. Formatar isso com
 * toISOString() faria a data pular um dia para tras em qualquer fuso a
 * oeste de Greenwich — que e o nosso caso. Por isso as tres partes saem
 * do proprio calendario local, sem passar por UTC.
 */
function soData(valor) {
  if (!valor) return null
  if (typeof valor === 'string') return valor.slice(0, 10)
  const mes = String(valor.getMonth() + 1).padStart(2, '0')
  const dia = String(valor.getDate()).padStart(2, '0')
  return `${valor.getFullYear()}-${mes}-${dia}`
}

const paraCliente = (l) => ({
  id: String(l.id),
  nome: l.nome,
  logo: l.logo,
  /* A MESMA imagem, em dois enquadramentos: `logo` e o quadrado do
     card, `capa` e a faixa larga do header da obra.

     Cliente cadastrado antes disto so tem `logo`: a capa cai nela e a
     tela continua igual ao que era.

     A imagem INTEIRA (logo_original) fica de fora de proposito. Ela so
     serve para reabrir o editor, e mandar uma copia dela por cliente em
     toda carga do quadro dobraria o peso da lista para uma coisa que a
     tela nem desenha. Quem precisa dela busca em /clientes/:id/imagem,
     no clique. */
  recorteLogo: l.recorte_logo ?? null,
  capa: l.capa ?? null,
  recorteCapa: l.recorte_capa ?? null,
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

/* ============================================================
   TERMOS DA EMPRESA

   As palavras que a empresa pode trocar sem mexer no codigo.
   Hoje sao duas — o singular e o plural de "Etapa" —, porque o
   roteiro pode um dia se chamar Fase, Marco ou Frente, e nesse
   dia TODA tela que escreve "3ª Etapa" tem de acompanhar junto.

   Chave/valor, e nao colunas: termo novo e uma linha, nao uma
   migracao.

   Os padroes daqui sao a rede de seguranca de quem ainda nao
   rodou db/atualizacao-3.sql.txt — sem a tabela, o sistema
   continua dizendo "Etapa" em vez de quebrar.
   ============================================================ */

const TERMOS_PADRAO = { termo_etapa: 'Etapa', termo_etapas: 'Etapas' }

async function lerTermos() {
  try {
    const { rows } = await query('SELECT chave, valor FROM configuracao')
    const lidos = Object.fromEntries(rows.map((l) => [l.chave, l.valor]))
    return { ...TERMOS_PADRAO, ...lidos }
  } catch (erro) {
    if (erro.code === '42P01') return { ...TERMOS_PADRAO }
    throw erro
  }
}

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
    termos,
  ] = await Promise.all([
    query('SELECT * FROM cliente ORDER BY lower(nome)'),
    /* os setores vem junto: sao poucos e a tela de Clientes precisa
       deles para pintar a etiqueta de cada card */
    query('SELECT * FROM setor_cliente ORDER BY lower(nome)').catch(() => ({ rows: [] })),
    /* concluida_em sai da COLUNA da obra (o clique em "Concluir obra"),
       e nao mais da view obra_conclusao — que agora responde outra
       pergunta: "ja marcaram todos os checks?" */
    query(`SELECT o.*,
                  autor.name  AS criado_por_nome,
                  editor.name AS atualizado_por_nome,
                  fim.name    AS concluida_por_nome
             FROM obra o
             LEFT JOIN usuario autor    ON autor.id  = o.criado_por
             LEFT JOIN usuario editor   ON editor.id = o.atualizado_por
             LEFT JOIN usuario fim      ON fim.id    = o.concluida_por
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
    lerTermos(),
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
    termos,
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
      /* o n. da proposta vem na frente do nome do cliente no card e no
         titulo da obra: e por ele que ela e procurada na empresa */
      proposta: o.proposta ?? '',
      descricao: o.descricao ?? '',
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
      /* os tres so aparecem na aba Concluidas; na obra aberta sao null */
      concluidaEm: o.concluida_em ?? null,
      concluidaPor:
        o.concluida_por === null || o.concluida_por === undefined
          ? null
          : String(o.concluida_por),
      concluidaPorNome: o.concluida_por_nome ?? null,
      conclusaoObs: o.conclusao_obs ?? '',
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
      /* A janela de validade, quando tem. Vai como 'AAAA-MM-DD' seco:
         a data e a mesma em qualquer fuso, e mandar um timestamp faria
         "ate 05/09" virar 04/09 para quem esta a oeste de Greenwich. */
      inicioEm: soData(l.inicio_em),
      fimEm: soData(l.fim_em),
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

/* ------------------------------------------------------------
   Trocar um termo

   Mexer no vocabulario do sistema inteiro nao e edicao de
   cadastro: e configuracao. Por isso pede "editar_etapa" — quem
   ja manda no roteiro e quem decide como o roteiro se chama.
   ------------------------------------------------------------ */

const TERMOS_ACEITOS = Object.keys(TERMOS_PADRAO)

router.patch('/termos', exigeSessao, exige('editar_etapa'), async (req, res) => {
  const mudancas = Object.entries(req.body ?? {})
    .filter(([chave]) => TERMOS_ACEITOS.includes(chave))
    .map(([chave, valor]) => [chave, texto(valor)])

  if (mudancas.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })
  if (mudancas.some(([, valor]) => !valor)) {
    return res.status(400).json({ erro: 'O termo não pode ficar em branco.' })
  }
  if (mudancas.some(([, valor]) => valor.length > 30)) {
    return res.status(400).json({ erro: 'Use no máximo 30 caracteres.' })
  }

  try {
    for (const [chave, valor] of mudancas) {
      await query(
        `INSERT INTO configuracao (chave, valor, atualizado_por)
         VALUES ($1, $2, $3)
         ON CONFLICT (chave) DO UPDATE
            SET valor = excluded.valor,
                atualizado_em = now(),
                atualizado_por = excluded.atualizado_por`,
        [chave, valor, req.dono.sub],
      )
    }
    return res.json({ termos: await lerTermos() })
  } catch (e) {
    return tratar(e, res, 'dados/termos')
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

/**
 * As cinco colunas da imagem, ou null quando a tela NAO mexeu nela.
 *
 * Elas andam juntas de proposito: a logo, o header e os dois recortes
 * saem todos do mesmo gesto no editor, e gravar um sem os outros
 * deixaria o cliente com um recorte que nao corresponde a imagem.
 *
 * O null tem funcao: editar o endereco de um cliente nao pode apagar a
 * logo dele. A tela so manda `imagem` quando alguem realmente trocou,
 * reenquadrou ou removeu — e nos outros casos as colunas ficam como
 * estao, em vez de receberem o nada que veio no corpo.
 */
function camposImagem(corpo) {
  const imagem = corpo?.imagem
  if (!imagem) return null

  return {
    logo: imagem.logo || null,
    logo_original: imagem.logoOriginal || null,
    recorte_logo: imagem.recorteLogo ? JSON.stringify(imagem.recorteLogo) : null,
    capa: imagem.capa || null,
    recorte_capa: imagem.recorteCapa ? JSON.stringify(imagem.recorteCapa) : null,
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

  const imagem = camposImagem(req.body) ?? {}
  const colunas = Object.keys(imagem)

  try {
    const todos = [...valores, ...Object.values(imagem)]
    const { rows } = await query(
      `INSERT INTO cliente (nome, endereco, bairro, cidade, estado, cep, setor_id
                            ${colunas.map((c) => `, ${c}`).join('')})
       VALUES (${todos.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      todos,
    )
    return res.status(201).json({ cliente: paraCliente(rows[0]) })
  } catch (e) {
    return tratar(e, res, 'dados/cliente-criar')
  }
})

router.patch('/clientes/:id', exigeSessao, exige('editar_clientes'), async (req, res) => {
  const { erro, valores } = camposCliente(req.body)
  if (erro) return res.status(400).json({ erro })

  /* a imagem so entra no UPDATE quando a tela mexeu nela; sem isso,
     salvar um endereco novo apagaria a logo do cliente */
  const imagem = camposImagem(req.body) ?? {}
  const todos = [...valores, ...Object.values(imagem)]
  const extras = Object.keys(imagem)
    .map((coluna, i) => `, ${coluna} = $${valores.length + i + 1}`)
    .join('')

  try {
    const { rows } = await query(
      `UPDATE cliente SET nome = $1, endereco = $2, bairro = $3,
                          cidade = $4, estado = $5, cep = $6, setor_id = $7${extras}
        WHERE id = $${todos.length + 1} RETURNING *`,
      [...todos, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Cliente não encontrado.' })
    return res.json({ cliente: paraCliente(rows[0]) })
  } catch (e) {
    return tratar(e, res, 'dados/cliente-editar')
  }
})

/**
 * A imagem INTEIRA do cliente — a que o editor precisa para
 * reenquadrar sem recortar o recorte anterior.
 *
 * Rota propria porque ela e pesada e serve a um clique so. Cliente
 * cadastrado antes do editor nao tem original: volta a logo mesmo, que
 * e o melhor que existe ali.
 */
router.get('/clientes/:id/imagem', exigeSessao, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT coalesce(logo_original, logo) AS original FROM cliente WHERE id = $1',
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Cliente não encontrado.' })
    return res.json({ logoOriginal: rows[0].original })
  } catch (e) {
    return tratar(e, res, 'dados/cliente-imagem')
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

/**
 * Uma linha de chat_site como a tela consome.
 *
 * O formato e o MESMO do chat da obra (`paraMensagem`, mais abaixo), de
 * proposito: as duas conversas sao lidas pelo mesmo componente, e um
 * campo com nome diferente para a mesma coisa seria o comeco de dois
 * jeitos de tratar a mesma coisa.
 */
const paraMensagemSite = (l) => {
  const apagada = Boolean(l.apagada_em)
  return {
    id: String(l.id),
    autorId: l.usuario_id === null ? null : String(l.usuario_id),
    autorNome: l.autor_nome,
    texto: apagada ? '' : (l.texto ?? ''),
    respondeA: l.responde_a === null || l.responde_a === undefined ? null : String(l.responde_a),
    arquivo:
      !apagada && l.arquivo_nome
        ? { nome: l.arquivo_nome, tipo: l.arquivo_tipo ?? '', conteudo: l.arquivo_conteudo }
        : null,
    enviadaEm: l.enviada_em,
    editadaEm: apagada ? null : (l.editada_em ?? null),
    apagada,
    apagadaEm: l.apagada_em ?? null,
    mencoes: [],
  }
}

/* As 300 ultimas. E conversa de equipe, nao arquivo: ninguem rola tres
   mil mensagens para tras, e mandar todas engorda a resposta a toa. */
const LIMITE_CHAT = 300

router.get('/chat', exigeSessao, async (req, res) => {
  try {
    const [mensagens, mencoes] = await Promise.all([
      /* o "apagar para mim" e por pessoa: a mensagem escondida por
         alguem continua inteira na conversa de todos os outros, e por
         isso ela sai aqui, na leitura, e nao do banco */
      query(
        `SELECT * FROM (
           SELECT c.* FROM chat_site c
            WHERE NOT EXISTS (
                  SELECT 1 FROM chat_site_oculta o
                   WHERE o.mensagem_id = c.id AND o.usuario_id = $2
              )
            ORDER BY c.enviada_em DESC LIMIT $1
         ) t ORDER BY enviada_em`,
        [LIMITE_CHAT, req.dono.sub],
      ).catch((e) =>
        /* banco sem as tabelas novas ainda: le a conversa inteira, sem
           esconder nada. O chat continua funcionando como antes. */
        e.code === '42P01'
          ? query(
              'SELECT * FROM (SELECT * FROM chat_site ORDER BY enviada_em DESC LIMIT $1) t ORDER BY enviada_em',
              [LIMITE_CHAT],
            )
          : Promise.reject(e),
      ),
      query('SELECT mensagem_id, usuario_id FROM chat_site_mencao').catch((e) =>
        e.code === '42P01' ? { rows: [] } : Promise.reject(e),
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
        ...paraMensagemSite(l),
        mencoes: porMensagem[l.id] ?? [],
      })),
    })
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_CHAT })
    return tratar(e, res, 'dados/chat-site-ler')
  }
})

router.post('/chat', exigeSessao, async (req, res) => {
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
      `INSERT INTO chat_site (usuario_id, autor_nome, texto, responde_a,
                              arquivo_nome, arquivo_tipo, arquivo_conteudo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.dono.sub,
        texto(req.body?.autorNome) || 'Usuário',
        conteudo || null,
        req.body?.respondeA || null,
        arquivo?.nome ? texto(arquivo.nome) : null,
        arquivo?.tipo ? texto(arquivo.tipo) : null,
        arquivo?.conteudo ?? null,
      ],
    )

    const mencoes = [
      ...new Set((req.body?.mencoes ?? []).map((n) => Number(n)).filter(Number.isFinite)),
    ]
    if (mencoes.length > 0) {
      await query(
        `INSERT INTO chat_site_mencao (mensagem_id, usuario_id)
         SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`,
        [rows[0].id, mencoes],
      )
    }

    return res.status(201).json({
      mensagem: { ...paraMensagemSite(rows[0]), mencoes: mencoes.map(String) },
    })
  } catch (e) {
    if (e.code === '42P01') return res.status(503).json({ erro: SEM_TABELA_CHAT })
    return tratar(e, res, 'dados/chat-site-criar')
  }
})

/**
 * DELETE /chat/:id?escopo=todos|mim
 *
 * Os mesmos dois gestos do chat da obra, e a diferenca importa:
 *
 *   escopo=todos — sai da conversa de TODO MUNDO. A linha fica, mas
 *     vazia: texto e arquivo viram NULL e a tela mostra "mensagem
 *     apagada". O rastro evita o buraco — quem respondeu aquela
 *     mensagem continua entendendo a propria resposta. So o autor pode
 *     (e o cargo com acesso total, para o caso de alguem sair da
 *     empresa deixando algo indevido).
 *
 *   escopo=mim (padrao) — some so da MINHA tela. Vale para qualquer
 *     mensagem, minha ou de outra pessoa, e nao muda nada para ninguem.
 *
 * O padrao e o menos destrutivo: uma chamada sem `escopo` nao apaga a
 * mensagem de outras pessoas.
 */
router.delete('/chat/:id', exigeSessao, async (req, res) => {
  const paraTodos = String(req.query?.escopo ?? 'mim') === 'todos'

  try {
    const dona = await query('SELECT usuario_id FROM chat_site WHERE id = $1', [req.params.id])
    if (!dona.rows[0]) return res.status(204).end()

    if (!paraTodos) {
      await query(
        `INSERT INTO chat_site_oculta (mensagem_id, usuario_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, req.dono.sub],
      )
      return res.status(204).end()
    }

    const meu = await meuCargo(req.dono.sub)
    if (!meu.acessoTotal && String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só apaga para todos as suas próprias mensagens.' })
    }

    /* o conteudo some de verdade; o que sobra e a marca de que houve
       uma mensagem ali. As mencoes vao junto: elas eram do texto. */
    await query(
      `UPDATE chat_site
          SET texto = NULL, arquivo_nome = NULL, arquivo_tipo = NULL,
              arquivo_conteudo = NULL, apagada_em = now(), apagada_por = $1
        WHERE id = $2`,
      [req.dono.sub, req.params.id],
    )
    await query('DELETE FROM chat_site_mencao WHERE mensagem_id = $1', [req.params.id]).catch(
      () => {},
    )

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
  const proposta = texto(req.body?.proposta)
  /* a descricao virou opcional: quem identifica a obra e a dupla
     proposta + cliente, e obrigar um texto livre so fazia aparecer
     "obra" e "-" no lugar dela */
  const descricao = texto(req.body?.descricao)
  const tipo = req.body?.tipo === 'emergencia' ? 'emergencia' : 'padrao'
  // emergencia e sempre alta; o gatilho do banco garante, aqui so evita ida a toa
  const prioridade = tipo === 'emergencia' ? 'alta' : (req.body?.prioridade ?? 'media')

  if (!clienteId) return res.status(400).json({ erro: 'Escolha a empresa.' })
  if (!proposta) return res.status(400).json({ erro: 'Informe o n° da proposta.' })
  if (!PRIORIDADES.includes(prioridade)) return res.status(400).json({ erro: 'Prioridade inválida.' })

  /* Emergencia SEM prazo e uma contradicao: sem uma data ate a qual
     aquilo precisa estar resolvido, o que existe e uma obra urgente —
     e urgente ja e a prioridade alta da obra padrao. Alem disso e o
     prazo que faz a obra aparecer como atrasada e entrar na conta de
     atraso do painel; sem ele a emergencia seria a unica que nunca
     cobra ninguem.

     A tela ja barra isso, mas ela e so a primeira porta: quem chama a
     API direto passaria por cima dela. */
  if (tipo === 'emergencia' && !texto(req.body?.dataConclusao)) {
    return res.status(400).json({ erro: 'Obra de emergência precisa de uma data de conclusão.' })
  }

  try {
    const { rows } = await query(
      `INSERT INTO obra (cliente_id, proposta, descricao, tipo, prioridade,
                         data_inicio, data_conclusao, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, coalesce($6::date, CURRENT_DATE), $7, $8, $8)
       RETURNING id`,
      [
        clienteId,
        proposta,
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

router.patch('/obras/:id', exigeSessao, exige('editar_obras'), obraAberta, async (req, res) => {
  const campos = []
  const valores = []
  const por = (coluna, valor) => {
    valores.push(valor)
    campos.push(`${coluna} = $${valores.length}`)
  }

  if (req.body?.descricao !== undefined) por('descricao', texto(req.body.descricao))
  if (req.body?.proposta !== undefined) {
    const proposta = texto(req.body.proposta)
    if (!proposta) return res.status(400).json({ erro: 'Informe o n° da proposta.' })
    por('proposta', proposta)
  }
  if (req.body?.clienteId !== undefined) por('cliente_id', req.body.clienteId)
  if (req.body?.dataInicio !== undefined) por('data_inicio', req.body.dataInicio || null)
  if (req.body?.dataConclusao !== undefined) por('data_conclusao', req.body.dataConclusao || null)
  if (req.body?.tipo !== undefined) {
    if (!['padrao', 'emergencia'].includes(req.body.tipo)) {
      return res.status(400).json({ erro: 'Tipo de obra inválido.' })
    }
    por('tipo', req.body.tipo)
  }

  /* A mesma regra da criacao, na edicao — e aqui ela precisa olhar o
     BANCO, nao so o corpo da chamada. Sao dois caminhos ate a mesma
     contradicao: apagar a data de uma emergencia que ja existe, e
     transformar em emergencia uma obra padrao que esta sem data. */
  if (req.body?.tipo === 'emergencia' || req.body?.dataConclusao !== undefined) {
    try {
      const { rows } = await query('SELECT tipo, data_conclusao FROM obra WHERE id = $1', [
        req.params.id,
      ])
      if (!rows[0]) return res.status(404).json({ erro: 'Obra não encontrada.' })

      const tipoFinal = req.body?.tipo ?? rows[0].tipo
      const dataFinal =
        req.body?.dataConclusao !== undefined
          ? texto(req.body.dataConclusao)
          : rows[0].data_conclusao

      if (tipoFinal === 'emergencia' && !dataFinal) {
        return res
          .status(400)
          .json({ erro: 'Obra de emergência precisa de uma data de conclusão.' })
      }
    } catch (e) {
      return tratar(e, res, 'dados/obra-editar-conferir')
    }
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

/**
 * DELETE /api/dados/obras/:id — apaga a obra.
 *
 * Duas permissoes diferentes, porque sao dois gestos diferentes:
 *
 *   obra ABERTA    -> "editar_obras". Apagar uma obra em andamento e
 *                     parte de tocar o quadro;
 *   obra CONCLUIDA -> "excluir_concluidas". Ali nao se apaga trabalho
 *                     em andamento, apaga-se o REGISTRO do que a
 *                     empresa entregou — e isso e de quem tem essa
 *                     permissao marcada no setor, nao de quem edita
 *                     obra no dia a dia.
 */
router.delete('/obras/:id', exigeSessao, async (req, res) => {
  try {
    const alvo = await query('SELECT concluida_em FROM obra WHERE id = $1', [req.params.id])
      .catch((e) => (e.code === '42703' ? { rows: [{ concluida_em: null }] } : Promise.reject(e)))
    if (!alvo.rows[0]) return res.status(404).json({ erro: 'Obra não encontrada.' })

    const fechada = Boolean(alvo.rows[0].concluida_em)
    const meu = await meuCargo(req.dono.sub)
    const chave = fechada ? 'excluir_concluidas' : 'editar_obras'

    if (!cargoPode(meu, chave)) {
      return res.status(403).json({
        erro: fechada
          ? 'Seu setor não tem permissão para excluir obra concluída.'
          : 'Seu setor não tem permissão para excluir obras.',
      })
    }

    const { rowCount } = await query('DELETE FROM obra WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ erro: 'Obra não encontrada.' })
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/obra-apagar')
  }
})

/* ------------------------------------------------------------
   Concluir a obra

   A obra NAO fecha sozinha ao marcar o ultimo check. Marcar tudo
   so faz o botao "Concluir obra" aparecer ao lado do Progresso;
   fechar mesmo e o clique — com dupla confirmacao na tela e, se
   houver, uma observacao de encerramento.

   Antes o fechamento era automatico (view obra_conclusao), e um
   check marcado por engano mandava a obra inteira para o arquivo
   sem ninguem decidir nada.

   A trava daqui e a mesma da tela: so fecha quem PODE editar a
   obra, e so quando nao sobrou nenhum check do roteiro DELA.
   ------------------------------------------------------------ */

router.post('/obras/:id/concluir', exigeSessao, exige('editar_obras'), async (req, res) => {
  const observacao = texto(req.body?.observacao)

  try {
    const obra = await query('SELECT concluida_em FROM obra WHERE id = $1', [req.params.id])
    if (!obra.rows[0]) return res.status(404).json({ erro: 'Obra não encontrada.' })
    if (obra.rows[0].concluida_em) {
      return res.status(409).json({ erro: 'Esta obra já foi concluída.' })
    }

    /* "ja marcou tudo?" — a mesma conta da view, que ja respeita a
       vigencia: obra de marco nao e cobrada pelo check criado em maio */
    const pronta = await query('SELECT 1 FROM obra_conclusao WHERE obra_id = $1', [req.params.id])
    if (pronta.rows.length === 0) {
      return res.status(409).json({
        erro: 'Ainda há check em aberto nesta obra. Conclua todos antes de encerrá-la.',
      })
    }

    await query(
      `UPDATE obra
          SET concluida_em = now(), concluida_por = $1,
              conclusao_obs = $2, atualizado_por = $1
        WHERE id = $3`,
      [req.dono.sub, observacao || null, req.params.id],
    )
    return res.json({ ok: true })
  } catch (e) {
    return tratar(e, res, 'dados/obra-concluir')
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

async function podeMarcar(usuarioId, checkId) {
  const meu = await meuCargo(usuarioId)
  if (cargoPode(meu, 'check_todas_etapas')) return true

  /* A emergencia NAO libera mais o check para qualquer um. A regra
     vivia aqui e no dominio da tela, e passava por cima do cadastro de
     permissoes: bastava a obra ser emergencia para quem nao pode marcar
     fora do seu setor marcar assim mesmo, e o rastro ficava com o nome
     errado. Quem precisa disso ganha "check em todas as etapas". */

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

router.put('/obras/:id/checks/:checkId', exigeSessao, obraAberta, async (req, res) => {
  try {
    if (!(await podeMarcar(req.dono.sub, req.params.checkId))) {
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

router.delete('/obras/:id/checks/:checkId', exigeSessao, obraAberta, async (req, res) => {
  try {
    if (!(await podeMarcar(req.dono.sub, req.params.checkId))) {
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

router.post('/obras/:id/observacoes', exigeSessao, obraAberta, async (req, res) => {
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

router.patch('/obras/:id/observacoes/:obsId', exigeSessao, obraAberta, async (req, res) => {
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

router.delete('/obras/:id/observacoes/:obsId', exigeSessao, obraAberta, async (req, res) => {
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

/**
 * A janela de validade da observacao, conferida.
 *
 * Devolve { inicio, fim } ou lanca com o recado pronto para a tela. As
 * duas datas andam JUNTAS: janela pela metade nao e janela, e o banco
 * recusa de qualquer jeito (observacao_quadro_janela_ck) — conferir
 * aqui e o que troca um erro de constraint por uma frase que a pessoa
 * entende.
 */
function janela(corpo) {
  const inicio = texto(corpo?.inicioEm) || null
  const fim = texto(corpo?.fimEm) || null

  if (!inicio && !fim) return { inicio: null, fim: null }
  if (!inicio || !fim) {
    throw Object.assign(new Error('Informe as duas datas da duração: de e até.'), { tela: true })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    throw Object.assign(new Error('As datas da duração vieram em formato inválido.'), {
      tela: true,
    })
  }
  if (fim < inicio) {
    throw Object.assign(new Error('A data final não pode ser antes da inicial.'), { tela: true })
  }
  return { inicio, fim }
}

router.post('/observacoes', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a observação.' })

  try {
    const { inicio, fim } = janela(req.body)
    const { rows } = await query(
      `INSERT INTO observacao_quadro (usuario_id, autor_nome, texto, inicio_em, fim_em)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, enviada_em, inicio_em, fim_em`,
      [req.dono.sub, texto(req.body?.autorNome) || 'Usuário', conteudo, inicio, fim],
    )
    return res.status(201).json({
      id: String(rows[0].id),
      enviadaEm: rows[0].enviada_em,
      inicioEm: soData(rows[0].inicio_em),
      fimEm: soData(rows[0].fim_em),
    })
  } catch (e) {
    if (e.tela) return res.status(400).json({ erro: e.message })
    return tratar(e, res, 'dados/obs-quadro-criar')
  }
})

router.patch('/observacoes/:id', exigeSessao, async (req, res) => {
  const conteudo = texto(req.body?.texto)
  if (!conteudo) return res.status(400).json({ erro: 'Escreva a observação.' })

  try {
    const { inicio, fim } = janela(req.body)

    const dona = await query('SELECT usuario_id FROM observacao_quadro WHERE id = $1', [
      req.params.id,
    ])
    if (!dona.rows[0]) return res.status(404).json({ erro: 'Observação não encontrada.' })
    if (String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({ erro: 'Você só edita a sua própria observação.' })
    }

    /* a janela vem inteira na edicao: quem desmarcou "Adicionar
       duracao" manda as duas vazias, e e assim que a observacao volta
       a valer para sempre */
    const { rows } = await query(
      `UPDATE observacao_quadro
          SET texto = $1, inicio_em = $2, fim_em = $3, editada_em = now()
        WHERE id = $4
      RETURNING editada_em, inicio_em, fim_em`,
      [conteudo, inicio, fim, req.params.id],
    )
    return res.json({
      editadaEm: rows[0].editada_em,
      inicioEm: soData(rows[0].inicio_em),
      fimEm: soData(rows[0].fim_em),
    })
  } catch (e) {
    if (e.tela) return res.status(400).json({ erro: e.message })
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

/**
 * O aviso tambem vai por E-MAIL.
 *
 * O sininho so cobra quem esta com o sistema aberto, e quem esta
 * devendo informacao costuma ser exatamente quem nao esta. Entao a
 * mesma cobranca sai para a caixa de entrada de quem e do setor, com o
 * que a pessoa precisa para decidir se para o que esta fazendo:
 * prioridade, proposta, cliente, descricao — e um botao que abre a
 * obra na tela onde o check e marcado.
 *
 * Quem recebe: TODO MUNDO do setor cobrado, inclusive quem apertou o
 * botao. Isso e diferente do sininho, que pula o autor de proposito —
 * e o selo vermelho existe para dizer "tem coisa nova para voce", e um
 * recado que a propria pessoa escreveu nao e novidade nenhuma.
 *
 * O e-mail responde outra pergunta. Ele e o REGISTRO da cobranca, e
 * quem esta no setor cobrado esta sendo cobrado — tenha ou nao apertado
 * o botao. Alem disso, uma pessoa que avisa o proprio setor e o caso
 * mais comum de todos ("a Excelencia esta devendo, e eu sou da
 * Excelencia"), e some-la da lista fazia justamente ela nao receber
 * nada. Receber copia do que se manda e o que qualquer e-mail faz.
 *
 * Duas coisas que esta funcao NAO faz, e de proposito:
 *
 *   - nao manda para quem desmarcou `avisos_email` no cadastro;
 *   - nao estoura. O aviso ja esta gravado quando ela roda, e um
 *     e-mail que nao saiu nao pode desfazer uma cobranca que saiu.
 *     O que der errado vira log e o motivo na resposta.
 */
async function avisarPorEmail({ obraId, setores, etapa, mensagem, quem }) {
  if (!temEmail()) return { enviados: 0, motivo: 'o envio de e-mail não está configurado' }

  const alvos = await query(
    `SELECT u.email
       FROM usuario u JOIN cargo c ON c.id = u.cargo_id
      WHERE c.chave = ANY($1)
        AND u.ativo
        AND coalesce(u.avisos_email, true)
        AND u.email IS NOT NULL AND u.email <> ''`,
    [setores],
  )
  const para = [...new Set(alvos.rows.map((l) => l.email))]
  if (para.length === 0) {
    return { enviados: 0, motivo: 'ninguém desse setor tem e-mail cadastrado' }
  }

  const dados = await query(
    `SELECT o.id, o.proposta, o.descricao, o.tipo, o.prioridade,
            cl.nome AS cliente_nome, cl.logo AS cliente_logo,
            quem.name AS remetente
       FROM obra o
       JOIN cliente cl        ON cl.id = o.cliente_id
       LEFT JOIN usuario quem ON quem.id = $2
      WHERE o.id = $1`,
    [obraId, quem],
  )
  const o = dados.rows[0]
  if (!o) return { enviados: 0, motivo: 'obra não encontrada' }

  /* os nomes dos setores cobrados, como a equipe os chama */
  const nomes = await query('SELECT nome FROM cargo WHERE chave = ANY($1)', [setores])
  const termos = await lerTermos()

  const envio = await enviarAviso({
    para,
    obra: {
      id: String(o.id),
      proposta: o.proposta ?? '',
      descricao: o.descricao ?? '',
      tipo: o.tipo,
      prioridade: o.prioridade,
      setores: nomes.rows.map((l) => l.nome).join(', '),
    },
    cliente: { nome: o.cliente_nome, logo: o.cliente_logo },
    etapa: `${etapa}ª ${termos.termo_etapa}`,
    mensagem,
    remetente: o.remetente ?? '',
  })

  if (!envio.ok) {
    console.error('[dados/aviso-email]', envio.motivo)
    return { enviados: 0, motivo: envio.motivo }
  }
  return { enviados: para.length }
}

router.post('/obras/:id/avisos', exigeSessao, exige('enviar_avisos'), obraAberta, async (req, res) => {
  const setores = (req.body?.setores ?? []).map(texto).filter(Boolean)
  if (setores.length === 0) return res.status(400).json({ erro: 'Nenhum setor para avisar.' })

  const etapa = Number(req.body?.etapa) || 1
  const mensagem = texto(req.body?.mensagem)

  try {
    const { rows } = await query(
      `INSERT INTO obra_aviso (obra_id, etapa, mensagem, enviado_por)
       VALUES ($1, $2, $3, $4) RETURNING id, enviado_em`,
      [req.params.id, etapa, mensagem, req.dono.sub],
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

    /* o e-mail vem DEPOIS de gravar, e o que ele devolver nao muda o
       resultado da chamada — a tela ja pode dizer "aviso enviado" */
    const email = await avisarPorEmail({
      obraId: req.params.id,
      setores,
      etapa,
      mensagem,
      quem: req.dono.sub,
    }).catch((erro) => {
      console.error('[dados/aviso-email]', erro.message)
      return { enviados: 0, motivo: erro.message }
    })

    return res.status(201).json({
      id: String(rows[0].id),
      enviadoEm: rows[0].enviado_em,
      /* quantos e-mails sairam, para a tela poder dizer "avisado por
         e-mail" em vez de so "avisado" */
      emails: email.enviados,
      emailMotivo: email.motivo ?? null,
    })
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

router.post('/obras/:id/etiquetas', exigeSessao, exige('editar_obras'), obraAberta, async (req, res) => {
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
router.delete('/obras/:id/etiquetas/:etiquetaId', exigeSessao, exige('editar_obras'), obraAberta, async (req, res) => {
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

router.post('/obras/:id/anexos', exigeSessao, exige('editar_obras'), obraAberta, async (req, res) => {
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

/* o anexo e apagado pelo id DELE, nao pelo da obra: a checagem de
   obra fechada precisa ser feita na mao aqui dentro */
router.delete('/anexos/:id', exigeSessao, exige('editar_obras'), async (req, res) => {
  try {
    const dono = await query(
      `SELECT o.concluida_em
         FROM obra_anexo a JOIN obra o ON o.id = a.obra_id
        WHERE a.id = $1`,
      [req.params.id],
    ).catch((e) => (e.code === '42703' ? { rows: [] } : Promise.reject(e)))

    if (dono.rows[0]?.concluida_em) {
      return res.status(409).json({
        erro: 'Esta obra foi concluída. Os anexos dela ficam só para consulta.',
      })
    }

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

/**
 * A mensagem como a tela a recebe.
 *
 * Mensagem APAGADA PARA TODOS chega vazia de proposito: sem texto, sem
 * arquivo, so com o autor, a hora e a marca `apagada`. E o que permite
 * a conversa continuar fazendo sentido — quem respondeu aquela mensagem
 * ainda ve que houve algo ali — sem que o conteudo sobreviva ao pedido
 * de apagar.
 */
const paraMensagem = (l) => {
  const apagada = Boolean(l.apagada_em)
  return {
    id: String(l.id),
    autorId: l.usuario_id === null ? null : String(l.usuario_id),
    autorNome: l.autor_nome,
    texto: apagada ? '' : (l.texto ?? ''),
    respondeA: l.responde_a === null ? null : String(l.responde_a),
    arquivo:
      !apagada && l.arquivo_nome
        ? { nome: l.arquivo_nome, tipo: l.arquivo_tipo ?? '', conteudo: l.arquivo_conteudo }
        : null,
    enviadaEm: l.enviada_em,
    editadaEm: apagada ? null : (l.editada_em ?? null),
    apagada,
    apagadaEm: l.apagada_em ?? null,
    mencoes: [],
  }
}

router.get('/obras/:id/chat', exigeSessao, async (req, res) => {
  try {
    const [mensagens, mencoes] = await Promise.all([
      /* o "apagar para mim" e por pessoa: a mensagem escondida por
         alguem continua inteira na conversa de todos os outros, e por
         isso ela sai aqui, na leitura, e nao do banco */
      query(
        `SELECT c.* FROM obra_chat c
          WHERE c.obra_id = $1
            AND NOT EXISTS (
                SELECT 1 FROM obra_chat_oculta o
                 WHERE o.mensagem_id = c.id AND o.usuario_id = $2
            )
          ORDER BY c.enviada_em`,
        [req.params.id, req.dono.sub],
      ).catch((e) =>
        /* banco sem a tabela nova ainda: le a conversa inteira */
        e.code === '42P01'
          ? query('SELECT * FROM obra_chat WHERE obra_id = $1 ORDER BY enviada_em', [req.params.id])
          : Promise.reject(e),
      ),
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

router.post('/obras/:id/chat', exigeSessao, obraAberta, async (req, res) => {
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

/**
 * DELETE /obras/:id/chat/:mensagemId?escopo=todos|mim
 *
 * Dois gestos diferentes, e a diferenca importa:
 *
 *   escopo=todos — a mensagem sai da conversa de TODO MUNDO. A linha
 *     fica, mas vazia: texto e arquivo viram NULL e no lugar dela a tela
 *     mostra "mensagem apagada". O rastro e o que evita o buraco na
 *     conversa — quem respondeu aquela mensagem continua entendendo a
 *     propria resposta. So o autor pode (e o cargo com acesso total,
 *     para o caso de alguem sair da empresa deixando algo indevido).
 *
 *   escopo=mim (padrao) — some so da MINHA tela. Vale para qualquer
 *     mensagem, minha ou de outra pessoa, e nao muda nada para ninguem.
 *
 * O padrao e o menos destrutivo dos dois: uma chamada sem `escopo` nao
 * apaga a mensagem de outras pessoas.
 */
router.delete('/obras/:id/chat/:mensagemId', exigeSessao, obraAberta, async (req, res) => {
  const paraTodos = String(req.query?.escopo ?? 'mim') === 'todos'

  try {
    const dona = await query('SELECT usuario_id FROM obra_chat WHERE id = $1 AND obra_id = $2', [
      req.params.mensagemId,
      req.params.id,
    ])
    if (!dona.rows[0]) return res.status(204).end()

    if (!paraTodos) {
      await query(
        `INSERT INTO obra_chat_oculta (mensagem_id, usuario_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.mensagemId, req.dono.sub],
      )
      return res.status(204).end()
    }

    const meu = await meuCargo(req.dono.sub)
    if (!meu.acessoTotal && String(dona.rows[0].usuario_id) !== String(req.dono.sub)) {
      return res.status(403).json({
        erro: 'Você só apaga para todos as suas próprias mensagens.',
      })
    }

    /* o conteudo some de verdade; o que sobra e a marca de que houve
       uma mensagem ali. As menções vao junto: elas eram do texto. */
    await query(
      `UPDATE obra_chat
          SET texto = NULL, arquivo_nome = NULL, arquivo_tipo = NULL,
              arquivo_conteudo = NULL, apagada_em = now(), apagada_por = $1
        WHERE id = $2 AND obra_id = $3`,
      [req.dono.sub, req.params.mensagemId, req.params.id],
    )
    await query('DELETE FROM obra_chat_mencao WHERE mensagem_id = $1', [req.params.mensagemId])
    return res.status(204).end()
  } catch (e) {
    return tratar(e, res, 'dados/chat-apagar')
  }
})

export default router
