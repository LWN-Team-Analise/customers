import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'

const router = Router()

const SEGREDO = process.env.JWT_SECRET || 'segredo-de-desenvolvimento'

/** Le o usuario do token. Sem token valido, devolve null. */
function usuarioDoToken(req) {
  const cabecalho = req.headers.authorization ?? ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null
  if (!token) return null
  try {
    return jwt.verify(token, SEGREDO)
  } catch {
    return null
  }
}

/** Toda rota daqui exige sessao. */
function exigeSessao(req, res, next) {
  const dono = usuarioDoToken(req)
  if (!dono) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' })
  req.dono = dono
  return next()
}

/** Erro de tabela que ainda nao existe vira uma mensagem util, nao um 500. */
function tratar(erro, res, onde) {
  if (erro.code === '42P01') {
    return res.status(503).json({
      erro: 'As tabelas de cargos ainda não existem. Rode o SQL de db/sistema.sql.txt.',
    })
  }
  console.error(`[equipe/${onde}]`, erro)
  return res.status(500).json({ erro: 'Não foi possível completar a operação.' })
}

const paraCargo = (linha) => ({
  id: String(linha.id),
  chave: linha.chave,
  nome: linha.nome,
  curto: linha.curto,
  cor: linha.cor,
  acessoTotal: linha.acesso_total,
  fixo: linha.fixo,
  ordem: linha.ordem,
})

/* ------------------------------------------------------------
   Cargos
   ------------------------------------------------------------ */

router.get('/cargos', exigeSessao, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM cargo ORDER BY ordem, nome')
    return res.json({ cargos: rows.map(paraCargo) })
  } catch (erro) {
    return tratar(erro, res, 'cargos')
  }
})

/** Gera a chave a partir do nome: "Recursos Humanos" -> "recursos_humanos". */
function chaveDe(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

router.post('/cargos', exigeSessao, async (req, res) => {
  const nome = String(req.body?.nome ?? '').trim()
  const cor = String(req.body?.cor ?? '#6b7280').trim()
  const curto = String(req.body?.curto ?? '').trim().slice(0, 6) || chaveDe(nome).slice(0, 3)
  const acessoTotal = Boolean(req.body?.acessoTotal)

  if (!nome) return res.status(400).json({ erro: 'Informe o nome do cargo.' })
  if (!/^#[0-9a-f]{6}$/i.test(cor)) return res.status(400).json({ erro: 'Cor inválida.' })

  const chave = chaveDe(nome)
  if (!/^[a-z][a-z0-9_]*$/.test(chave)) {
    return res.status(400).json({ erro: 'O nome precisa começar com uma letra.' })
  }

  try {
    const { rows } = await query(
      `INSERT INTO cargo (chave, nome, curto, cor, acesso_total, fixo, ordem)
       VALUES ($1, $2, $3, $4, $5, false, 100)
       RETURNING *`,
      [chave, nome, curto, cor, acessoTotal],
    )
    return res.status(201).json({ cargo: paraCargo(rows[0]) })
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cargo com esse nome.' })
    }
    return tratar(erro, res, 'cargos/criar')
  }
})

router.patch('/cargos/:id', exigeSessao, async (req, res) => {
  const campos = []
  const valores = []

  if (req.body?.nome !== undefined) {
    const nome = String(req.body.nome).trim()
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do cargo.' })
    valores.push(nome)
    campos.push(`nome = $${valores.length}`)
  }
  if (req.body?.cor !== undefined) {
    const cor = String(req.body.cor).trim()
    if (!/^#[0-9a-f]{6}$/i.test(cor)) return res.status(400).json({ erro: 'Cor inválida.' })
    valores.push(cor)
    campos.push(`cor = $${valores.length}`)
  }
  if (req.body?.curto !== undefined) {
    valores.push(String(req.body.curto).trim().slice(0, 6))
    campos.push(`curto = $${valores.length}`)
  }
  if (req.body?.acessoTotal !== undefined) {
    valores.push(Boolean(req.body.acessoTotal))
    campos.push(`acesso_total = $${valores.length}`)
  }

  if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

  valores.push(req.params.id)

  try {
    const { rows } = await query(
      `UPDATE cargo SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING *`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Cargo não encontrado.' })
    return res.json({ cargo: paraCargo(rows[0]) })
  } catch (erro) {
    return tratar(erro, res, 'cargos/editar')
  }
})

router.delete('/cargos/:id', exigeSessao, async (req, res) => {
  try {
    const alvo = await query('SELECT fixo, nome FROM cargo WHERE id = $1', [req.params.id])
    if (!alvo.rows[0]) return res.status(404).json({ erro: 'Cargo não encontrado.' })
    if (alvo.rows[0].fixo) {
      return res
        .status(409)
        .json({ erro: `"${alvo.rows[0].nome}" é usado pelas etapas da obra e não pode ser apagado.` })
    }

    const emUso = await query('SELECT count(*)::int AS n FROM usuario WHERE cargo_id = $1', [
      req.params.id,
    ])
    if (emUso.rows[0].n > 0) {
      return res
        .status(409)
        .json({ erro: `Há ${emUso.rows[0].n} usuário(s) com esse cargo. Troque o cargo deles antes.` })
    }

    await query('DELETE FROM cargo WHERE id = $1', [req.params.id])
    return res.status(204).end()
  } catch (erro) {
    if (erro.code === '23503') {
      return res.status(409).json({ erro: 'Esse cargo está em uso e não pode ser apagado.' })
    }
    return tratar(erro, res, 'cargos/apagar')
  }
})

/* ------------------------------------------------------------
   Usuarios — com o cargo e a media das obras avaliadas
   ------------------------------------------------------------ */

router.get('/usuarios', exigeSessao, async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.telefone, u.cpf, u.foto,
             c.id AS cargo_id, c.chave AS cargo_chave, c.nome AS cargo_nome,
             c.cor AS cargo_cor, c.curto AS cargo_curto, c.acesso_total,
             m.media, m.obras_avaliadas
        FROM usuario u
        LEFT JOIN cargo c        ON c.id = u.cargo_id
        LEFT JOIN usuario_media m ON m.usuario_id = u.id
       WHERE u.ativo
       ORDER BY c.ordem NULLS LAST, u.name
    `)

    return res.json({
      usuarios: rows.map((l) => ({
        id: String(l.id),
        nome: l.name,
        email: l.email,
        telefone: l.telefone,
        foto: l.foto,
        cargoId: l.cargo_id ? String(l.cargo_id) : null,
        cargo: l.cargo_chave,
        cargoNome: l.cargo_nome,
        cargoCor: l.cargo_cor,
        cargoCurto: l.cargo_curto,
        acessoTotal: l.acesso_total ?? false,
        // media vem das obras avaliadas; sem obra avaliada ainda, e null
        avaliacao: l.media === null || l.media === undefined ? null : Number(l.media),
        obrasAvaliadas: l.obras_avaliadas ?? 0,
      })),
    })
  } catch (erro) {
    return tratar(erro, res, 'usuarios')
  }
})

/**
 * PATCH /api/equipe/usuarios/:id — edita o cadastro.
 *
 * Cada um edita o proprio; cargo com acesso total edita qualquer um.
 * O CPF NAO entra aqui de proposito: uma vez cadastrado, so sai
 * apagando e cadastrando de novo.
 */
router.patch('/usuarios/:id', exigeSessao, async (req, res) => {
  const alvo = String(req.params.id)
  const souEu = String(req.dono.sub) === alvo

  try {
    if (!souEu) {
      const meu = await query(
        'SELECT c.acesso_total FROM usuario u LEFT JOIN cargo c ON c.id = u.cargo_id WHERE u.id = $1',
        [req.dono.sub],
      )
      if (!meu.rows[0]?.acesso_total) {
        return res.status(403).json({ erro: 'Você só pode editar o seu próprio cadastro.' })
      }
    }

    const campos = []
    const valores = []
    const por = (coluna, valor) => {
      valores.push(valor)
      campos.push(`${coluna} = $${valores.length}`)
    }

    if (req.body?.nome !== undefined) {
      const nome = String(req.body.nome).trim()
      if (!nome) return res.status(400).json({ erro: 'Informe o nome.' })
      por('name', nome)
    }
    if (req.body?.email !== undefined) por('email', String(req.body.email).trim())
    if (req.body?.telefone !== undefined) {
      por('telefone', String(req.body.telefone).replace(/\D/g, ''))
    }
    if (req.body?.foto !== undefined) por('foto', req.body.foto || null)
    if (req.body?.nascimento !== undefined) por('data_nascimento', req.body.nascimento)
    if (req.body?.cargo !== undefined) {
      const cargo = await query('SELECT id, nome FROM cargo WHERE chave = $1', [req.body.cargo])
      if (!cargo.rows[0]) return res.status(400).json({ erro: 'Cargo não encontrado.' })
      por('cargo_id', cargo.rows[0].id)
      por('cargo', cargo.rows[0].nome)
    }

    if (req.body?.cpf !== undefined) {
      return res.status(400).json({
        erro: 'O CPF não pode ser alterado. Apague o cadastro e faça um novo.',
      })
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

    valores.push(alvo)
    const { rows } = await query(
      `UPDATE usuario SET ${campos.join(', ')} WHERE id = $${valores.length}
       RETURNING id, name, email, telefone, cpf, foto, data_nascimento, cargo_id`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' })

    const l = rows[0]
    return res.json({
      usuario: {
        id: String(l.id),
        nome: l.name,
        email: l.email,
        telefone: l.telefone,
        cpf: l.cpf,
        foto: l.foto,
        nascimento: l.data_nascimento,
      },
    })
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe alguém com esse e-mail.' })
    }
    // o usuario id=1 e protegido por gatilho no banco
    if (erro.message?.includes('protegido')) {
      return res.status(409).json({
        erro: 'Este usuário está protegido no banco. Destrave com SET LOCAL app.desbloqueio.',
      })
    }
    return tratar(erro, res, 'usuarios/editar')
  }
})

export default router
