import { Router } from 'express'
import { query } from '../db.js'
import { cargoPode, exigeSessao, meuCargo, tratar } from '../sessao.js'
/* os tipos, os valores fixos e os limites sao os MESMOS da tela: um
   arquivo so, sem React dentro, importado pelos dois lados (ver o
   comentario no topo dele) */
import {
  ANEXO_BYTES_MAXIMOS,
  CHAVES_CATEGORIA,
  JUSTIFICATIVA_MAXIMA,
  OBSERVACAO_MAXIMA,
  VALOR_MAXIMO,
  anexoAceito,
  lerValor,
  tipoValido,
  valorFixo,
} from '../../src/domain/despesas.js'

/* ============================================================
   DESPESAS — /api/despesas

     POST /envios                 envia uma despesa, refeicao ou bonus
     GET  /envios?mes=AAAA-MM     os envios do mes, dia a dia, com totais
     GET  /resumo?ano=AAAA        o ano, mes a mes, com o total anual
     GET  /anexos/:id             o comprovante (o arquivo em si)

   Quem enxerga o que:

     Todo mundo ve os PROPRIOS envios. Ver os de outra pessoa exige
     `revisar_despesa_geral` — e isso e conferido AQUI, a cada
     chamada, a partir do token. A tela esconde o filtro de pessoas
     de quem nao tem a permissao, mas esconder nao protege nada:
     `?usuarios=` com o id de outra pessoa, sem a permissao, volta
     403. E o comprovante de outra pessoa volta 404, como se nao
     existisse — o id de um anexo nao conta se ele existe.

   Os TOTAIS (do dia, do mes, do ano, por pessoa) saem do banco,
   com SUM sobre NUMERIC. A tela so escreve o que recebeu.
   ============================================================ */

const router = Router()

const texto = (valor) => String(valor ?? '').trim()
const PERMISSAO_REVISAR = 'revisar_despesa_geral'

/** Tabela que ainda nao existe vira recado com o arquivo certo, nao 500. */
function falhou(erro, res, onde) {
  if (erro.code === '42P01' || erro.code === '42703') {
    return res.status(503).json({
      erro:
        'O banco ainda não tem as tabelas de despesas. Rode db/atualizacao-8.sql.txt ' +
        '(ou, de uma vez: npm run db:atualizar) e suba a API de novo.',
    })
  }
  return tratar(erro, res, onde)
}

/** Recusa com o campo que causou, para a tela acender o campo certo. */
const recusa = (res, campo, erro, status = 400) => res.status(status).json({ erro, campo })

/* ------------------------------------------------------------
   Datas

   Tudo em 'AAAA-MM-DD', comparado como texto — nessa forma a ordem
   alfabetica e a cronologica. "Hoje" e o do Brasil, e nao o do
   servidor: na Vercel o relogio e UTC, e as 21h de Sao Paulo ja
   seriam amanha, recusando a despesa do proprio dia como futura.
   ------------------------------------------------------------ */

const FUSO = 'America/Sao_Paulo'

function hojeNoBrasil() {
  /* en-CA escreve a data como AAAA-MM-DD */
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** '2026-02-30' nao passa: a data tem de existir no calendario. */
function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [ano, mes, dia] = valor.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

const DATA_MINIMA = '2000-01-01'

/** O primeiro dia do mes e o primeiro do mes seguinte: [inicio, fim). */
function limitesDoMes(mes) {
  const [ano, m] = mes.split('-').map(Number)
  const proximo = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`
  return [`${mes}-01`, `${proximo}-01`]
}

/* ------------------------------------------------------------
   O comprovante

   Chega como data URL, do mesmo jeito que os anexos da obra. Aqui
   ele e conferido de verdade — a tela confere antes, mas quem chama
   a API na mao passa por cima da tela:

     - o nome tem uma extensao da lista aceita (imagem, PDF, ZIP,
       documento — ver ANEXO_EXTENSOES);
     - o conteudo e mesmo um data URL em base64, e nao lixo;
     - o arquivo DECODIFICADO cabe no teto de 3 MB.
   ------------------------------------------------------------ */

function lerAnexo(bruto) {
  if (!bruto || typeof bruto !== 'object') return { erro: 'Anexe o comprovante da despesa.' }

  /* so o nome do arquivo, sem caminho: "C:\fakepath\nota.pdf" vira "nota.pdf" */
  const nome = texto(bruto.nome).split(/[\\/]/).pop().slice(0, 255)
  const conteudo = String(bruto.conteudo ?? '')

  if (!nome || !conteudo) return { erro: 'Anexe o comprovante da despesa.' }
  if (!anexoAceito(nome)) {
    return {
      erro: 'Tipo de arquivo não aceito. Envie imagem, PDF, ZIP, RAR, 7Z ou documento (Word, Excel, TXT, CSV, XML).',
    }
  }

  const cabecalho = /^data:([\w.+-]+\/[\w.+-]+)?((?:;[\w.+-]+=[^;,]*)*);base64,/i.exec(conteudo)
  if (!cabecalho) return { erro: 'O arquivo chegou corrompido. Escolha de novo e reenvie.' }

  const base64 = conteudo.slice(cabecalho[0].length)
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    return { erro: 'O arquivo chegou corrompido. Escolha de novo e reenvie.' }
  }

  const sobra = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const bytes = (base64.length / 4) * 3 - sobra
  if (bytes <= 0) return { erro: 'O arquivo está vazio.' }
  if (bytes > ANEXO_BYTES_MAXIMOS) return { erro: 'O arquivo passa de 3 MB. Envie um menor.' }

  return {
    anexo: {
      nome,
      tipo: (cabecalho[1] || texto(bruto.tipo) || 'application/octet-stream').slice(0, 120),
      tamanho: bytes,
      conteudo,
    },
  }
}

/* ------------------------------------------------------------
   De quem sao os envios que a chamada pediu

   ?usuarios=           (vazio)  so os meus
   ?usuarios=todos               a equipe inteira
   ?usuarios=4,9,12              essas pessoas

   Qualquer coisa alem de "so eu" exige a permissao. Pedir a si
   mesmo pela lista (`?usuarios=7`, sendo o 7) continua livre.

   Devolve `ids` (null = todos) ou ja respondeu a recusa.
   ------------------------------------------------------------ */

async function escopoDaConsulta(req, res) {
  const eu = Number(req.dono.sub)
  const cargo = await meuCargo(eu)
  const revisor = cargoPode(cargo, PERMISSAO_REVISAR)
  const bruto = texto(req.query.usuarios)

  let ids
  if (!bruto) {
    ids = [eu]
  } else if (bruto === 'todos') {
    ids = null
  } else {
    const partes = bruto.split(',').map((p) => p.trim()).filter(Boolean)
    if (partes.length === 0 || partes.length > 500 || partes.some((p) => !/^\d{1,15}$/.test(p))) {
      res.status(400).json({ erro: 'Filtro de usuários inválido.' })
      return null
    }
    ids = [...new Set(partes.map(Number))]
  }

  const soEu = ids !== null && ids.length === 1 && ids[0] === eu
  if (!soEu && !revisor) {
    res.status(403).json({ erro: 'Você só pode ver os seus próprios envios.' })
    return null
  }

  return { ids, revisor }
}

/** O pedaco de WHERE do escopo. `$n` e o proximo parametro livre. */
function filtroDeUsuarios(ids, n) {
  return ids === null ? { sql: '', params: [] } : { sql: `AND e.usuario_id = ANY($${n}::bigint[])`, params: [ids] }
}

/* ------------------------------------------------------------
   O envio como a tela recebe
   ------------------------------------------------------------ */

const paraEnvio = (l) => ({
  id: String(l.id),
  categoria: l.categoria,
  tipo: l.tipo,
  data: String(l.data).slice(0, 10),
  valor: Number(l.valor),
  justificativa: l.justificativa ?? '',
  observacao: l.observacao ?? '',
  usuarioId: String(l.usuario_id),
  usuarioNome: l.usuario_nome ?? '',
  /* obra excluida depois do envio: tudo null, e a tela diz isso */
  obraId: l.obra_id === null || l.obra_id === undefined ? null : String(l.obra_id),
  obraProposta: l.obra_proposta ?? '',
  obraDescricao: l.obra_descricao ?? '',
  obraConcluida: Boolean(l.obra_concluida_em),
  clienteId: l.cliente_id === null || l.cliente_id === undefined ? null : String(l.cliente_id),
  clienteNome: l.cliente_nome ?? '',
  criadoEm: l.criado_em,
  /* so nome e tamanho: o arquivo vem em /anexos/:id, no clique */
  anexos: (l.anexos ?? []).map((a) => ({
    id: String(a.id),
    nome: a.nome,
    tipo: a.tipo ?? '',
    tamanho: a.tamanho ?? 0,
  })),
})

const CONSULTA_ENVIOS = `
  SELECT e.id, e.categoria, e.tipo, e.data, e.valor, e.justificativa, e.observacao,
         e.criado_em, e.usuario_id, u.name AS usuario_nome,
         e.obra_id, o.proposta AS obra_proposta, o.descricao AS obra_descricao,
         o.concluida_em AS obra_concluida_em,
         o.cliente_id, c.nome AS cliente_nome,
         (SELECT coalesce(json_agg(json_build_object(
                   'id', a.id, 'nome', a.nome, 'tipo', a.tipo, 'tamanho', a.tamanho
                 ) ORDER BY a.id), '[]'::json)
            FROM despesa_anexo a WHERE a.envio_id = e.id) AS anexos
    FROM despesa_envio e
    JOIN usuario u      ON u.id = e.usuario_id
    LEFT JOIN obra o    ON o.id = e.obra_id
    LEFT JOIN cliente c ON c.id = o.cliente_id`

const soma = (l) => ({ total: Number(l?.total ?? 0), quantidade: Number(l?.quantidade ?? 0) })

/* ============================================================
   ENVIAR
   ============================================================ */

router.post('/envios', exigeSessao, async (req, res) => {
  const corpo = req.body ?? {}
  const categoria = texto(corpo.categoria)
  const tipo = texto(corpo.tipo)
  const data = texto(corpo.data)
  const obraId = texto(corpo.obraId)

  if (!CHAVES_CATEGORIA.includes(categoria)) {
    return recusa(res, 'categoria', 'Tipo de envio inválido.')
  }

  /* ---- data ---- */
  if (!data) return recusa(res, 'data', 'Informe a data.')
  if (!dataValida(data) || data < DATA_MINIMA) return recusa(res, 'data', 'Data inválida.')
  if (data > hojeNoBrasil()) return recusa(res, 'data', 'A data não pode ser no futuro.')

  /* ---- tipo ---- */
  const nomeDoTipo = { despesa: 'despesa', refeicao: 'refeição', bonus: 'bônus' }[categoria]
  if (!tipo) return recusa(res, 'tipo', `Escolha o tipo de ${nomeDoTipo}.`)
  if (!tipoValido(categoria, tipo)) return recusa(res, 'tipo', `Tipo de ${nomeDoTipo} inválido.`)

  /* ---- obra ---- */
  if (!obraId) return recusa(res, 'obraId', 'Escolha o cliente e a obra.')
  if (!/^\d{1,15}$/.test(obraId)) return recusa(res, 'obraId', 'Obra inválida.')

  /* ---- valor ----
     Tipo com valor fixo (a refeicao) grava o numero da casa, e o que
     vier no pedido nao conta: e isso que torna o campo travado da tela
     uma regra, e nao so uma sugestao. */
  const fixo = valorFixo(tipo)
  let valor = fixo
  if (fixo === null) {
    if (corpo.valor === undefined || corpo.valor === null || texto(corpo.valor) === '') {
      return recusa(res, 'valor', 'Informe o valor.')
    }
    valor = lerValor(corpo.valor)
    if (valor === null) {
      return recusa(res, 'valor', 'Valor inválido. Use só números, com até duas casas decimais.')
    }
    if (valor <= 0) return recusa(res, 'valor', 'O valor precisa ser maior que zero.')
    if (valor > VALOR_MAXIMO) return recusa(res, 'valor', 'O valor passa do limite de R$ 100.000,00 por envio.')
  }

  /* ---- textos livres ---- */
  const justificativa = tipo === 'outros' ? texto(corpo.justificativa) : ''
  if (justificativa.length > JUSTIFICATIVA_MAXIMA) {
    return recusa(res, 'justificativa', `A justificativa passa de ${JUSTIFICATIVA_MAXIMA} caracteres.`)
  }
  const observacao = texto(corpo.observacao)
  if (observacao.length > OBSERVACAO_MAXIMA) {
    return recusa(res, 'observacao', `A observação passa de ${OBSERVACAO_MAXIMA} caracteres.`)
  }

  /* ---- comprovante: obrigatorio na despesa, e so nela ---- */
  let anexo = null
  if (categoria === 'despesa') {
    const lido = lerAnexo(corpo.anexo)
    if (lido.erro) return recusa(res, 'anexo', lido.erro)
    anexo = lido.anexo
  }

  try {
    const obra = await query('SELECT id FROM obra WHERE id = $1', [obraId])
    if (!obra.rows[0]) {
      return recusa(res, 'obraId', 'A obra escolhida não existe mais. Escolha outra.')
    }

    /* O envio e o comprovante numa instrucao SO. Uma instrucao e
       atomica no Postgres: ou os dois entram, ou nenhum — nunca fica
       despesa sem o comprovante que ela exige. */
    const { rows } = await query(
      `WITH envio AS (
         INSERT INTO despesa_envio
                (usuario_id, obra_id, categoria, tipo, data, valor, justificativa, observacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, criado_em, valor
       ), anexo AS (
         INSERT INTO despesa_anexo (envio_id, nome, tipo, tamanho, conteudo)
         SELECT envio.id, $9, $10, $11, $12 FROM envio WHERE $12::text IS NOT NULL
         RETURNING id
       )
       SELECT envio.id, envio.criado_em, envio.valor, (SELECT id FROM anexo) AS anexo_id FROM envio`,
      [
        req.dono.sub,
        obraId,
        categoria,
        tipo,
        data,
        valor.toFixed(2),
        justificativa || null,
        observacao || null,
        anexo?.nome ?? null,
        anexo?.tipo ?? null,
        anexo?.tamanho ?? null,
        anexo?.conteudo ?? null,
      ],
    )

    return res.status(201).json({
      id: String(rows[0].id),
      criadoEm: rows[0].criado_em,
      valor: Number(rows[0].valor),
      anexoId: rows[0].anexo_id === null ? null : String(rows[0].anexo_id),
    })
  } catch (erro) {
    /* a obra sumiu entre a conferencia e a gravacao */
    if (erro.code === '23503') {
      return recusa(res, 'obraId', 'A obra escolhida não existe mais. Escolha outra.')
    }
    if (erro.code === '23514') {
      return res.status(400).json({ erro: 'Algum campo não passou na conferência do banco. Revise e envie de novo.' })
    }
    return falhou(erro, res, 'despesas/enviar')
  }
})

/* ============================================================
   MES — os envios, dia a dia
   ============================================================ */

router.get('/envios', exigeSessao, async (req, res) => {
  const mes = texto(req.query.mes) || hojeNoBrasil().slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || mes < '2000-01' || mes > '2100-12') {
    return res.status(400).json({ erro: 'Mês inválido. Use AAAA-MM.' })
  }

  try {
    const escopo = await escopoDaConsulta(req, res)
    if (!escopo) return undefined

    const [inicio, fim] = limitesDoMes(mes)
    const f = filtroDeUsuarios(escopo.ids, 3)
    const params = [inicio, fim, ...f.params]
    const onde = `WHERE e.data >= $1 AND e.data < $2 ${f.sql}`

    const [envios, dias, categorias, pessoas, total] = await Promise.all([
      query(`${CONSULTA_ENVIOS} ${onde} ORDER BY e.data, e.criado_em, e.id`, params),
      query(
        `SELECT e.data, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e ${onde}
          GROUP BY e.data ORDER BY e.data`,
        params,
      ),
      query(
        `SELECT e.categoria, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e ${onde}
          GROUP BY e.categoria`,
        params,
      ),
      query(
        `SELECT e.usuario_id, u.name, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e JOIN usuario u ON u.id = e.usuario_id ${onde}
          GROUP BY e.usuario_id, u.name ORDER BY u.name`,
        params,
      ),
      query(
        `SELECT count(*)::int AS quantidade, coalesce(sum(e.valor), 0) AS total
           FROM despesa_envio e ${onde}`,
        params,
      ),
    ])

    return res.json({
      mes,
      revisor: escopo.revisor,
      envios: envios.rows.map(paraEnvio),
      dias: dias.rows.map((l) => ({ data: String(l.data).slice(0, 10), ...soma(l) })),
      categorias: Object.fromEntries(categorias.rows.map((l) => [l.categoria, soma(l)])),
      pessoas: pessoas.rows.map((l) => ({ usuarioId: String(l.usuario_id), nome: l.name, ...soma(l) })),
      ...soma(total.rows[0]),
    })
  } catch (erro) {
    return falhou(erro, res, 'despesas/mes')
  }
})

/* ============================================================
   ANO — mes a mes, e o total anual
   ============================================================ */

router.get('/resumo', exigeSessao, async (req, res) => {
  const ano = Number(texto(req.query.ano) || hojeNoBrasil().slice(0, 4))
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return res.status(400).json({ erro: 'Ano inválido.' })
  }

  try {
    const escopo = await escopoDaConsulta(req, res)
    if (!escopo) return undefined

    const f = filtroDeUsuarios(escopo.ids, 3)
    const params = [`${ano}-01-01`, `${ano + 1}-01-01`, ...f.params]
    const onde = `WHERE e.data >= $1 AND e.data < $2 ${f.sql}`
    const mesDe = 'extract(month FROM e.data)::int'

    const [porMes, porMesCategoria, categorias, pessoas, total] = await Promise.all([
      query(
        `SELECT ${mesDe} AS mes, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e ${onde}
          GROUP BY 1`,
        params,
      ),
      query(
        `SELECT ${mesDe} AS mes, e.categoria, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e ${onde}
          GROUP BY 1, 2`,
        params,
      ),
      query(
        `SELECT e.categoria, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e ${onde}
          GROUP BY e.categoria`,
        params,
      ),
      query(
        `SELECT e.usuario_id, u.name, count(*)::int AS quantidade, sum(e.valor) AS total
           FROM despesa_envio e JOIN usuario u ON u.id = e.usuario_id ${onde}
          GROUP BY e.usuario_id, u.name ORDER BY u.name`,
        params,
      ),
      query(
        `SELECT count(*)::int AS quantidade, coalesce(sum(e.valor), 0) AS total
           FROM despesa_envio e ${onde}`,
        params,
      ),
    ])

    /* os doze meses sempre, mesmo os vazios: "marco: R$ 0,00" tambem e
       uma resposta, e um ano com buracos parece um ano com erro */
    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const linha = porMes.rows.find((l) => Number(l.mes) === mes)
      return {
        mes,
        ...soma(linha),
        categorias: Object.fromEntries(
          porMesCategoria.rows
            .filter((l) => Number(l.mes) === mes)
            .map((l) => [l.categoria, soma(l)]),
        ),
      }
    })

    return res.json({
      ano,
      revisor: escopo.revisor,
      meses,
      categorias: Object.fromEntries(categorias.rows.map((l) => [l.categoria, soma(l)])),
      pessoas: pessoas.rows.map((l) => ({ usuarioId: String(l.usuario_id), nome: l.name, ...soma(l) })),
      ...soma(total.rows[0]),
    })
  } catch (erro) {
    return falhou(erro, res, 'despesas/ano')
  }
})

/* ============================================================
   O COMPROVANTE

   Do dono do envio, ou de quem revisa. Para qualquer outro, o anexo
   "nao existe" — 404, e nao 403, para o id nao servir de sonda.
   ============================================================ */

router.get('/anexos/:id', exigeSessao, async (req, res) => {
  const id = texto(req.params.id)
  const naoAchou = () => res.status(404).json({ erro: 'Anexo não encontrado.' })
  if (!/^\d{1,15}$/.test(id)) return naoAchou()

  try {
    const { rows } = await query(
      `SELECT a.nome, a.tipo, a.conteudo, e.usuario_id
         FROM despesa_anexo a JOIN despesa_envio e ON e.id = a.envio_id
        WHERE a.id = $1`,
      [id],
    )
    const anexo = rows[0]
    if (!anexo) return naoAchou()

    if (Number(anexo.usuario_id) !== Number(req.dono.sub)) {
      const cargo = await meuCargo(req.dono.sub)
      if (!cargoPode(cargo, PERMISSAO_REVISAR)) return naoAchou()
    }

    return res.json({ nome: anexo.nome, tipo: anexo.tipo ?? '', conteudo: anexo.conteudo })
  } catch (erro) {
    return falhou(erro, res, 'despesas/anexo')
  }
})

export default router
