import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { cargoPode, exige, exigeSessao, meuCargo, tratar } from '../sessao.js'
import { normalizar } from '../../src/domain/permissoes.js'

const router = Router()

/** Senha com que todo colaborador novo entra; a tela obriga a trocar depois. */
export const SENHA_PADRAO = '123456'

const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')
const texto = (valor) => String(valor ?? '').trim()

const paraCargo = (linha) => ({
  id: String(linha.id),
  chave: linha.chave,
  nome: linha.nome,
  curto: linha.curto,
  cor: linha.cor,
  acessoTotal: linha.acesso_total,
  fixo: linha.fixo,
  ordem: linha.ordem,
  // cargo novo nasce sem nenhuma; quem administra marca uma a uma
  permissoes: normalizar(linha.permissoes ?? []),
})

/* ------------------------------------------------------------
   Cargos
   ------------------------------------------------------------ */

router.get('/cargos', exigeSessao, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM cargo ORDER BY ordem, nome')
    return res.json({ cargos: rows.map(paraCargo) })
  } catch (erro) {
    return tratar(erro, res, 'equipe/cargos')
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

router.post('/cargos', exigeSessao, exige('editar_cargo'), async (req, res) => {
  const nome = texto(req.body?.nome)
  const cor = texto(req.body?.cor) || '#6b7280'
  const curto = texto(req.body?.curto).slice(0, 6) || chaveDe(nome).slice(0, 3)
  const acessoTotal = Boolean(req.body?.acessoTotal)
  const permissoes = normalizar(req.body?.permissoes)

  if (!nome) return res.status(400).json({ erro: 'Informe o nome do cargo.' })
  if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(cor)) return res.status(400).json({ erro: 'Cor inválida.' })

  const chave = chaveDe(nome)
  if (!/^[a-z][a-z0-9_]*$/.test(chave)) {
    return res.status(400).json({ erro: 'O nome precisa começar com uma letra.' })
  }

  try {
    const { rows } = await query(
      `INSERT INTO cargo (chave, nome, curto, cor, acesso_total, fixo, ordem, permissoes)
       VALUES ($1, $2, $3, $4, $5, false, 100, $6)
       RETURNING *`,
      [chave, nome, curto, cor, acessoTotal, permissoes],
    )
    return res.status(201).json({ cargo: paraCargo(rows[0]) })
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cargo com esse nome.' })
    }
    return tratar(erro, res, 'equipe/cargos-criar')
  }
})

router.patch('/cargos/:id', exigeSessao, exige('editar_cargo'), async (req, res) => {
  const campos = []
  const valores = []

  if (req.body?.nome !== undefined) {
    const nome = texto(req.body.nome)
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do cargo.' })
    valores.push(nome)
    campos.push(`nome = $${valores.length}`)
  }
  if (req.body?.cor !== undefined) {
    const cor = texto(req.body.cor)
    if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(cor)) return res.status(400).json({ erro: 'Cor inválida.' })
    valores.push(cor)
    campos.push(`cor = $${valores.length}`)
  }
  if (req.body?.curto !== undefined) {
    valores.push(texto(req.body.curto).slice(0, 6))
    campos.push(`curto = $${valores.length}`)
  }
  if (req.body?.acessoTotal !== undefined) {
    valores.push(Boolean(req.body.acessoTotal))
    campos.push(`acesso_total = $${valores.length}`)
  }
  /* a lista passa pelo mesmo `normalizar` da tela: alteracao sem a
     visualizacao dela nao entra, venha de onde vier */
  if (req.body?.permissoes !== undefined) {
    valores.push(normalizar(req.body.permissoes))
    campos.push(`permissoes = $${valores.length}`)
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
    return tratar(erro, res, 'equipe/cargos-editar')
  }
})

router.delete('/cargos/:id', exigeSessao, exige('editar_cargo'), async (req, res) => {
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
    return tratar(erro, res, 'equipe/cargos-apagar')
  }
})

/* ------------------------------------------------------------
   Usuarios — com o cargo e a media das obras avaliadas
   ------------------------------------------------------------ */

const CONSULTA_USUARIOS = `
  SELECT u.id, u.name, u.email, u.telefone, u.cpf, u.foto, u.data_nascimento,
         u.senha_temporaria,
         u.outlook, u.outlook_email,
         c.id AS cargo_id, c.chave AS cargo_chave, c.nome AS cargo_nome,
         c.cor AS cargo_cor, c.curto AS cargo_curto, c.acesso_total, c.permissoes,
         m.media, m.obras_avaliadas
    FROM usuario u
    LEFT JOIN cargo c         ON c.id = u.cargo_id
    LEFT JOIN usuario_media m ON m.usuario_id = u.id
   WHERE u.ativo
`

const paraUsuario = (l) => ({
  id: String(l.id),
  nome: l.name,
  email: l.email,
  telefone: l.telefone,
  cpf: l.cpf,
  nascimento: l.data_nascimento,
  foto: l.foto,
  cargoId: l.cargo_id ? String(l.cargo_id) : null,
  cargo: l.cargo_chave,
  cargoNome: l.cargo_nome,
  cargoCor: l.cargo_cor,
  cargoCurto: l.cargo_curto,
  acessoTotal: l.acesso_total ?? false,
  cargoPermissoes: normalizar(l.permissoes ?? []),
  outlook: l.outlook ?? false,
  outlookEmail: l.outlook_email ?? null,
  senhaTemporaria: l.senha_temporaria ?? false,
  // media vem das obras avaliadas; sem obra avaliada ainda, e null
  avaliacao: l.media === null || l.media === undefined ? null : Number(l.media),
  obrasAvaliadas: l.obras_avaliadas ?? 0,
})

router.get('/usuarios', exigeSessao, async (_req, res) => {
  try {
    const { rows } = await query(`${CONSULTA_USUARIOS} ORDER BY c.ordem NULLS LAST, u.name`)
    return res.json({ usuarios: rows.map(paraUsuario) })
  } catch (erro) {
    return tratar(erro, res, 'equipe/usuarios')
  }
})

/**
 * POST /api/equipe/usuarios — cadastra o colaborador.
 *
 * Entra com a senha padrao 123456 e senha_temporaria = true: no
 * primeiro acesso a tela obriga a trocar. Quem cadastra precisa de
 * cargo com acesso total.
 */
router.post('/usuarios', exigeSessao, async (req, res) => {
  try {
    const meu = await meuCargo(req.dono.sub)
    if (!cargoPode(meu, 'editar_usuario')) {
      return res.status(403).json({ erro: 'Seu cargo não pode cadastrar colaboradores.' })
    }

    const nome = texto(req.body?.nome)
    const email = texto(req.body?.email)
    const cpf = soDigitos(req.body?.cpf)
    const nascimento = req.body?.nascimento || null
    const telefone = soDigitos(req.body?.telefone)
    const chaveCargo = texto(req.body?.cargo)

    if (!nome) return res.status(400).json({ erro: 'Informe o nome completo.' })
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      return res.status(400).json({ erro: 'E-mail inválido.' })
    }
    if (cpf.length !== 11) return res.status(400).json({ erro: 'O CPF precisa ter 11 dígitos.' })
    if (!nascimento) return res.status(400).json({ erro: 'Informe a data de nascimento.' })

    const cargo = await query('SELECT id, nome FROM cargo WHERE chave = $1', [chaveCargo])
    if (!cargo.rows[0]) return res.status(400).json({ erro: 'Escolha o cargo.' })

    const hash = await bcrypt.hash(SENHA_PADRAO, 12)

    const { rows } = await query(
      `INSERT INTO usuario (name, email, cpf, data_nascimento, telefone,
                            cargo, cargo_id, foto, senha_hash, senha_temporaria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id`,
      [
        nome,
        email,
        cpf,
        nascimento,
        telefone || null,
        cargo.rows[0].nome,
        cargo.rows[0].id,
        req.body?.foto || null,
        hash,
      ],
    )

    const criado = await query(`${CONSULTA_USUARIOS} AND u.id = $1`, [rows[0].id])
    return res
      .status(201)
      .json({ usuario: paraUsuario(criado.rows[0]), senhaPadrao: SENHA_PADRAO })
  } catch (erro) {
    if (erro.code === '23505') {
      const qual = String(erro.detail ?? '').includes('cpf') ? 'CPF' : 'e-mail'
      return res.status(409).json({ erro: `Já existe alguém cadastrado com esse ${qual}.` })
    }
    return tratar(erro, res, 'equipe/usuarios-criar')
  }
})

/**
 * PATCH /api/equipe/usuarios/:id — edita o cadastro.
 *
 * Cada um edita o proprio; cargo com acesso total edita qualquer um.
 * O CPF e a excecao: so o cargo "diretor" mexe nele. Nao passa por
 * permissao configuravel de proposito — e trava de cargo mesmo.
 */
router.patch('/usuarios/:id', exigeSessao, async (req, res) => {
  const alvo = String(req.params.id)
  const souEu = String(req.dono.sub) === alvo

  try {
    const meu = await meuCargo(req.dono.sub)
    if (!souEu && !cargoPode(meu, 'editar_usuario')) {
      return res.status(403).json({ erro: 'Você só pode editar o seu próprio cadastro.' })
    }

    const campos = []
    const valores = []
    const por = (coluna, valor) => {
      valores.push(valor)
      campos.push(`${coluna} = $${valores.length}`)
    }

    if (req.body?.nome !== undefined) {
      const nome = texto(req.body.nome)
      if (!nome) return res.status(400).json({ erro: 'Informe o nome.' })
      por('name', nome)
    }
    /* o e-mail e a porta de entrada (e o vinculo com o Outlook): ninguem
       troca o proprio. Quem cadastra colaborador troca o dos outros. */
    if (req.body?.email !== undefined && texto(req.body.email) !== '') {
      if (souEu) {
        return res.status(403).json({
          erro: 'O e-mail do seu acesso não pode ser alterado. Fale com a diretoria.',
        })
      }
      por('email', texto(req.body.email))
    }
    if (req.body?.telefone !== undefined) por('telefone', soDigitos(req.body.telefone))
    if (req.body?.foto !== undefined) por('foto', req.body.foto || null)
    if (req.body?.nascimento !== undefined) por('data_nascimento', req.body.nascimento || null)
    if (req.body?.cargo !== undefined) {
      const cargo = await query('SELECT id, nome FROM cargo WHERE chave = $1', [req.body.cargo])
      if (!cargo.rows[0]) return res.status(400).json({ erro: 'Cargo não encontrado.' })
      por('cargo_id', cargo.rows[0].id)
      por('cargo', cargo.rows[0].nome)
    }

    if (req.body?.cpf !== undefined) {
      if (meu.chave !== 'diretor') {
        return res.status(403).json({ erro: 'Somente a diretoria pode alterar o CPF.' })
      }
      const cpf = soDigitos(req.body.cpf)
      if (cpf.length !== 11) return res.status(400).json({ erro: 'O CPF precisa ter 11 dígitos.' })
      por('cpf', cpf)
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nada para alterar.' })

    valores.push(alvo)
    const { rows } = await query(
      `UPDATE usuario SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id`,
      valores,
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' })

    const salvo = await query(`${CONSULTA_USUARIOS} AND u.id = $1`, [alvo])
    return res.json({ usuario: paraUsuario(salvo.rows[0]) })
  } catch (erro) {
    if (erro.code === '23505') {
      const qual = String(erro.detail ?? '').includes('cpf') ? 'CPF' : 'e-mail'
      return res.status(409).json({ erro: `Já existe alguém cadastrado com esse ${qual}.` })
    }
    // o usuario id=1 e protegido por gatilho no banco
    if (erro.message?.includes('protegido')) {
      return res.status(409).json({
        erro: 'Este usuário está protegido no banco. Destrave com SET LOCAL app.desbloqueio.',
      })
    }
    return tratar(erro, res, 'equipe/usuarios-editar')
  }
})

/**
 * DELETE /api/equipe/usuarios/:id — tira o colaborador da equipe.
 *
 * Desativa em vez de apagar: as obras em que a pessoa participou
 * continuam com o historico dela (quem marcou o que, e quando).
 */
router.delete('/usuarios/:id', exigeSessao, async (req, res) => {
  try {
    const meu = await meuCargo(req.dono.sub)
    if (!cargoPode(meu, 'editar_usuario') && String(req.dono.sub) !== String(req.params.id)) {
      return res.status(403).json({ erro: 'Seu cargo não pode excluir colaboradores.' })
    }

    const { rows } = await query(
      'UPDATE usuario SET ativo = false WHERE id = $1 RETURNING id',
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' })
    return res.status(204).end()
  } catch (erro) {
    if (erro.message?.includes('protegido')) {
      return res.status(409).json({
        erro: 'Este usuário está protegido no banco e não pode ser excluído pela tela.',
      })
    }
    return tratar(erro, res, 'equipe/usuarios-apagar')
  }
})

export default router
