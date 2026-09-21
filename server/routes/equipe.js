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
    /* daqui para baixo "cargo" e a TABELA: na tela ela se chama Setor */

    const emUso = await query('SELECT count(*)::int AS n FROM usuario WHERE cargo_id = $1', [
      req.params.id,
    ])
    if (emUso.rows[0].n > 0) {
      return res
        .status(409)
        .json({ erro: `Há ${emUso.rows[0].n} usuário(s) nesse setor. Troque o setor deles antes.` })
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
   Cargos da equipe (tabela cargo_titulo)

   Aqui e o CARGO de verdade — "Analista de Qualidade",
   "Coordenador de Obras" —, e nao o setor. Ele nao tem cor e nao
   decide permissao nenhuma: serve para a pessoa aparecer com o
   titulo certo no card e nos relatorios.

   Quem mexe (e quem ATRIBUI um cargo a alguem) precisa de
   `editar_cargo_titulo`. Sem ela ninguem se promove sozinho no
   proprio perfil, que era o buraco de deixar o campo aberto.
   ------------------------------------------------------------ */

const paraTitulo = (l) => ({
  id: String(l.id),
  nome: l.nome,
  ordem: l.ordem,
})

/**
 * O cargo escolhido no cadastro, pelo id.
 *
 * Aceita tambem o nome, que e o que os cadastros antigos mandavam:
 * assim uma tela desatualizada continua gravando o cargo certo em vez
 * de silenciosamente limpar o campo.
 *
 * Devolve null quando nao veio nada — cargo e opcional.
 */
async function acharTitulo(id, nome) {
  const porId = texto(id)
  if (porId) {
    const { rows } = await query('SELECT id, nome FROM cargo_titulo WHERE id = $1', [porId])
    return rows[0] ?? null
  }
  const porNome = texto(nome)
  if (!porNome) return null
  const { rows } = await query(
    'SELECT id, nome FROM cargo_titulo WHERE lower(nome) = lower($1)',
    [porNome],
  )
  return rows[0] ?? null
}

router.get('/titulos', exigeSessao, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM cargo_titulo ORDER BY ordem, nome')
    return res.json({ titulos: rows.map(paraTitulo) })
  } catch (erro) {
    /* banco sem a atualizacao-4 ainda: a tela abre com a lista vazia
       em vez de quebrar inteira por causa de um cadastro novo */
    if (erro.code === '42P01') return res.json({ titulos: [] })
    return tratar(erro, res, 'equipe/titulos')
  }
})

router.post('/titulos', exigeSessao, exige('editar_cargo_titulo'), async (req, res) => {
  const nome = texto(req.body?.nome)
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do cargo.' })

  try {
    const { rows } = await query(
      'INSERT INTO cargo_titulo (nome) VALUES ($1) RETURNING *',
      [nome],
    )
    return res.status(201).json({ titulo: paraTitulo(rows[0]) })
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cargo com esse nome.' })
    }
    return tratar(erro, res, 'equipe/titulos-criar')
  }
})

router.patch('/titulos/:id', exigeSessao, exige('editar_cargo_titulo'), async (req, res) => {
  const nome = texto(req.body?.nome)
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do cargo.' })

  try {
    const { rows } = await query(
      'UPDATE cargo_titulo SET nome = $1 WHERE id = $2 RETURNING *',
      [nome, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Cargo não encontrado.' })
    /* a coluna de texto do usuario acompanha: e ela que as telas leem,
       e renomear um cargo tem de valer para quem ja esta nele */
    await query('UPDATE usuario SET cargo_titulo = $1 WHERE cargo_titulo_id = $2', [
      nome,
      req.params.id,
    ])
    return res.json({ titulo: paraTitulo(rows[0]) })
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cargo com esse nome.' })
    }
    return tratar(erro, res, 'equipe/titulos-editar')
  }
})

router.delete('/titulos/:id', exigeSessao, exige('editar_cargo_titulo'), async (req, res) => {
  try {
    const emUso = await query(
      'SELECT count(*)::int AS n FROM usuario WHERE cargo_titulo_id = $1',
      [req.params.id],
    )
    if (emUso.rows[0].n > 0) {
      return res.status(409).json({
        erro: `Há ${emUso.rows[0].n} pessoa(s) neste cargo. Troque o cargo delas antes.`,
      })
    }

    const { rowCount } = await query('DELETE FROM cargo_titulo WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ erro: 'Cargo não encontrado.' })
    return res.status(204).end()
  } catch (erro) {
    return tratar(erro, res, 'equipe/titulos-apagar')
  }
})

/* ------------------------------------------------------------
   Usuarios — com o cargo e a media das obras avaliadas
   ------------------------------------------------------------ */

/* SETOR x CARGO, para nao se perder na leitura daqui:

     c.* (tabela cargo) = o SETOR da pessoa. E dele que saem as
                          permissoes, a cor e os cards da obra;
     u.cargo_titulo     = o CARGO dela ("Analista de Qualidade").
                          Texto livre, opcional, sem efeito nenhum
                          em permissao.

   A tabela do banco continua se chamando `cargo` de proposito:
   renomea-la derrubaria as chaves estrangeiras de meia duzia de
   outras tabelas sem mudar nada do que o sistema faz. */
const CONSULTA_USUARIOS = `
  SELECT u.id, u.name, u.email, u.telefone, u.cpf, u.foto, u.data_nascimento,
         u.senha_temporaria, u.cargo_titulo, u.cargo_titulo_id, u.recorte_foto,
         u.outlook, u.outlook_email,
         c.id AS cargo_id, c.chave AS cargo_chave, c.nome AS cargo_nome,
         c.cor AS cargo_cor, c.curto AS cargo_curto, c.acesso_total, c.permissoes,
         t.nome AS titulo_nome,
         m.media, m.obras_avaliadas
    FROM usuario u
    LEFT JOIN cargo c          ON c.id = u.cargo_id
    LEFT JOIN cargo_titulo t   ON t.id = u.cargo_titulo_id
    LEFT JOIN usuario_media m  ON m.usuario_id = u.id
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
  /* O enquadramento vem; a imagem INTEIRA nao. Ela so serve para
     reabrir o editor, e uma copia dela por pessoa em toda carga da
     equipe pesaria a lista inteira por causa de um clique que quase
     nunca acontece. Quem precisa dela busca em /usuarios/:id/foto. */
  recorteFoto: l.recorte_foto ?? null,
  /* `cargo`/`cargoNome`/`cargoCor` continuam sendo o SETOR: e assim que
     umas trinta telas os leem, e trocar o nome do campo aqui nao mudaria
     nada alem de quebrar todas elas de uma vez */
  cargoId: l.cargo_id ? String(l.cargo_id) : null,
  cargo: l.cargo_chave,
  cargoNome: l.cargo_nome,
  cargoCor: l.cargo_cor,
  cargoCurto: l.cargo_curto,
  /* o cargo especifico da pessoa; '' quando ninguem preencheu. O nome
     vem do cadastro (cargo_titulo) quando ha vinculo — assim renomear
     um cargo la vale aqui na hora — e cai no texto antigo para quem
     ainda nao foi migrado */
  cargoTituloId: l.cargo_titulo_id ? String(l.cargo_titulo_id) : null,
  cargoTitulo: l.titulo_nome ?? l.cargo_titulo ?? '',
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
 * A foto INTEIRA da pessoa — a que o editor precisa para reenquadrar
 * sem recortar o recorte anterior.
 *
 * Rota propria porque ela e pesada e serve a um clique so. Cadastro
 * antigo nao tem original: volta a propria foto, que e o melhor que
 * existe ali.
 */
router.get('/usuarios/:id/foto', exigeSessao, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT coalesce(foto_original, foto) AS original FROM usuario WHERE id = $1',
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' })
    return res.json({ fotoOriginal: rows[0].original })
  } catch (erro) {
    return tratar(erro, res, 'equipe/usuario-foto')
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
      return res.status(403).json({ erro: 'Seu setor não pode cadastrar colaboradores.' })
    }

    const nome = texto(req.body?.nome)
    const email = texto(req.body?.email)
    const cpf = soDigitos(req.body?.cpf)
    const nascimento = req.body?.nascimento || null
    const telefone = soDigitos(req.body?.telefone)
    const chaveCargo = texto(req.body?.cargo)

    /* OBRIGATORIOS: CPF, nome e SETOR — so esses tres. Todo o resto
       (nascimento, e-mail, telefone, cargo, foto) pode ficar vazio: o
       cadastro nao pode parar por causa de um dado que ninguem tem na
       mao na hora. Vindo preenchido, continua tendo de ser valido. */
    if (!nome) return res.status(400).json({ erro: 'Informe o nome completo.' })
    if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      return res.status(400).json({ erro: 'E-mail inválido.' })
    }
    if (telefone && telefone.length < 10) {
      return res.status(400).json({ erro: 'Telefone incompleto: informe o DDD e o número.' })
    }
    if (cpf.length !== 11) return res.status(400).json({ erro: 'O CPF precisa ter 11 dígitos.' })

    const cargo = await query('SELECT id, nome FROM cargo WHERE chave = $1', [chaveCargo])
    if (!cargo.rows[0]) return res.status(400).json({ erro: 'Escolha o setor.' })

    /* atribuir CARGO e permissao a parte: quem nao a tem cadastra a
       pessoa do mesmo jeito, so que sem cargo */
    const titulo = cargoPode(meu, 'editar_cargo_titulo')
      ? await acharTitulo(req.body?.cargoTituloId, req.body?.cargoTitulo)
      : null

    const hash = await bcrypt.hash(SENHA_PADRAO, 12)

    const { rows } = await query(
      `INSERT INTO usuario (name, email, cpf, data_nascimento, telefone,
                            cargo, cargo_id, cargo_titulo, cargo_titulo_id,
                            foto, foto_original, recorte_foto, senha_hash, senha_temporaria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
       RETURNING id`,
      [
        nome,
        // '' seria um e-mail repetido em todo mundo sem e-mail: guarda NULL
        email || null,
        cpf,
        nascimento,
        telefone || null,
        cargo.rows[0].nome,
        cargo.rows[0].id,
        titulo?.nome ?? null,
        titulo?.id ?? null,
        req.body?.foto || null,
        req.body?.fotoOriginal || null,
        req.body?.recorteFoto ? JSON.stringify(req.body.recorteFoto) : null,
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
      const email = texto(req.body.email)
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
        return res.status(400).json({ erro: 'E-mail inválido.' })
      }
      por('email', email)
    }
    if (req.body?.telefone !== undefined) {
      const telefone = soDigitos(req.body.telefone)
      if (telefone && telefone.length < 10) {
        return res.status(400).json({ erro: 'Telefone incompleto: informe o DDD e o número.' })
      }
      // opcional: apagado vira NULL, nao string vazia
      por('telefone', telefone || null)
    }
    if (req.body?.foto !== undefined) por('foto', req.body.foto || null)
    if (req.body?.fotoOriginal !== undefined) por('foto_original', req.body.fotoOriginal || null)
    if (req.body?.recorteFoto !== undefined) {
      por('recorte_foto', req.body.recorteFoto ? JSON.stringify(req.body.recorteFoto) : null)
    }
    if (req.body?.nascimento !== undefined) por('data_nascimento', req.body.nascimento || null)
    /* o CARGO especifico ("Coordenador de Obras"). Nao confundir com o
       campo `cargo` logo abaixo, que e o SETOR e vem por chave.

       Atribuir cargo pede `editar_cargo_titulo`, e a trava vale
       INCLUSIVE para o proprio cadastro: sem ela, qualquer um se daria
       o cargo que quisesse em Configuracoes. */
    if (req.body?.cargoTitulo !== undefined || req.body?.cargoTituloId !== undefined) {
      if (!cargoPode(meu, 'editar_cargo_titulo')) {
        return res.status(403).json({ erro: 'Seu setor não pode definir o cargo de alguém.' })
      }
      const titulo = await acharTitulo(req.body?.cargoTituloId, req.body?.cargoTitulo)
      por('cargo_titulo_id', titulo?.id ?? null)
      por('cargo_titulo', titulo?.nome ?? null)
    }
    if (req.body?.cargo !== undefined) {
      const cargo = await query('SELECT id, nome FROM cargo WHERE chave = $1', [req.body.cargo])
      if (!cargo.rows[0]) return res.status(400).json({ erro: 'Setor não encontrado.' })
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
      return res.status(403).json({ erro: 'Seu setor não pode excluir colaboradores.' })
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
