import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'

const router = Router()

const SEGREDO = process.env.JWT_SECRET || 'segredo-de-desenvolvimento'
const EXPIRA = process.env.JWT_EXPIRES || '8h'

const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')

/** Converte a linha do banco no formato que o front consome. */
function paraUsuario(linha) {
  return {
    id: linha.id,
    name: linha.name,
    email: linha.email,
    cpf: linha.cpf,
    dataNascimento: linha.data_nascimento,
    telefone: linha.telefone,
    cargo: linha.cargo,
    permissoes: linha.permissoes ?? [],
    avaliacao: linha.avaliacao === null ? null : Number(linha.avaliacao),
    outlook: linha.outlook,
    foto: linha.foto ?? null,
    // o cargo vem da tabela cargo (db/sistema.sql.txt): e dele que saem a
    // cor das etiquetas e a permissao de editar etapa de outro setor
    cargoId: linha.cargo_id ? String(linha.cargo_id) : null,
    cargoChave: linha.cargo_chave ?? null,
    cargoNome: linha.cargo_nome ?? linha.cargo,
    cargoCor: linha.cargo_cor ?? null,
    acessoTotal: linha.acesso_total ?? false,
  }
}

const CAMPOS_BASE = `u.id, u.name, u.email, u.cpf, u.data_nascimento, u.telefone,
                     u.cargo, u.permissoes, u.avaliacao, u.outlook, u.senha_hash, u.ativo`

const CAMPOS_CARGO = `, u.foto, u.cargo_id, c.chave AS cargo_chave, c.nome AS cargo_nome,
                      c.cor AS cargo_cor, c.acesso_total`

/**
 * Busca o usuario ja com o cargo. Se db/sistema.sql.txt ainda nao foi
 * rodado, a tabela cargo (ou a coluna cargo_id) nao existe: o Postgres
 * devolve 42P01/42703 e caimos na consulta simples, sem cargo. Assim o
 * login continua funcionando em quem so rodou a PARTE 1.
 */
async function buscarUsuario(condicao, valores) {
  try {
    return await query(
      `SELECT ${CAMPOS_BASE}${CAMPOS_CARGO}
         FROM usuario u LEFT JOIN cargo c ON c.id = u.cargo_id
        WHERE ${condicao} LIMIT 1`,
      valores,
    )
  } catch (erro) {
    if (erro.code !== '42P01' && erro.code !== '42703') throw erro
    return query(`SELECT ${CAMPOS_BASE} FROM usuario u WHERE ${condicao} LIMIT 1`, valores)
  }
}

/** POST /api/auth/login — aceita e-mail ou CPF no mesmo campo. */
router.post('/login', async (req, res) => {
  const identificador = String(req.body?.identifier ?? '').trim()
  const senha = String(req.body?.password ?? '')

  if (!identificador || !senha) {
    return res.status(400).json({ erro: 'Informe seu e-mail ou CPF e a senha.' })
  }

  try {
    const { rows } = await buscarUsuario(
      'lower(u.email) = lower($1) OR u.cpf = $2',
      [identificador, soDigitos(identificador)],
    )

    const linha = rows[0]
    // mensagem unica para usuario inexistente e senha errada: nao entrega
    // ao atacante a informacao de qual e-mail/CPF existe no sistema
    const generica = 'E-mail/CPF ou senha incorretos.'

    if (!linha || !linha.senha_hash) {
      return res.status(401).json({ erro: generica })
    }

    if (linha.ativo === false) {
      return res.status(403).json({ erro: 'Este acesso está desativado. Fale com o administrador.' })
    }

    const confere = await bcrypt.compare(senha, linha.senha_hash)
    if (!confere) {
      return res.status(401).json({ erro: generica })
    }

    const usuario = paraUsuario(linha)
    const token = jwt.sign({ sub: usuario.id, cargo: usuario.cargo }, SEGREDO, {
      expiresIn: EXPIRA,
    })

    await query('UPDATE usuario SET ultimo_acesso = now() WHERE id = $1', [usuario.id])

    return res.json({ token, user: usuario })
  } catch (erro) {
    if (erro.code === '42P01') {
      return res
        .status(503)
        .json({ erro: 'A tabela "usuario" ainda não existe no banco. Rode o SQL de db/usuario.sql.txt.' })
    }
    console.error('[auth/login]', erro)
    return res.status(500).json({ erro: 'Não foi possível entrar agora. Tente de novo.' })
  }
})

/** GET /api/auth/me — devolve o usuario do token. */
router.get('/me', async (req, res) => {
  const cabecalho = req.headers.authorization ?? ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null

  if (!token) return res.status(401).json({ erro: 'Sessão não informada.' })

  try {
    const { sub } = jwt.verify(token, SEGREDO)
    const { rows } = await buscarUsuario('u.id = $1', [sub])
    if (!rows[0]) return res.status(401).json({ erro: 'Sessão inválida.' })
    return res.json({ user: paraUsuario(rows[0]) })
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' })
  }
})

export default router
