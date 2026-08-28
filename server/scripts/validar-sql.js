/**
 * Roda db/usuario.sql.txt num banco descartavel e confere se tudo funciona:
 * schema, protecao do usuario id=1, restricoes e senha.
 * O banco de teste e criado e removido pelo proprio script.
 *
 *   npm run db:validar
 */
import 'dotenv/config'
import fs from 'node:fs'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const base = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
}

const TESTE = 'trajeto_teste_tmp'
const SENHA_INICIAL = '123456'

const sql = fs.readFileSync('db/usuario.sql.txt', 'utf8')
// pula a PARTE 1 (CREATE DATABASE): aqui o banco ja e o descartavel
const corpo = sql.slice(sql.indexOf('CREATE TABLE usuario'))

const admin = new pg.Client({ ...base, database: 'postgres' })
await admin.connect()
await admin.query(`DROP DATABASE IF EXISTS ${TESTE}`)
await admin.query(`CREATE DATABASE ${TESTE}`)
await admin.end()

const c = new pg.Client({ ...base, database: TESTE })
await c.connect()

const resultado = {}

const tenta = async (rotulo, comando) => {
  try {
    await c.query(comando)
    resultado[rotulo] = 'passou'
  } catch (erro) {
    resultado[rotulo] = `bloqueado (${erro.message.slice(0, 52)})`
  }
}

try {
  await c.query(corpo)
  resultado.scriptRodou = true

  const { rows } = await c.query(
    'SELECT id, name, email, cpf, cargo, avaliacao, outlook, protegido, senha_hash FROM usuario',
  )
  resultado.usuario = { ...rows[0], senha_hash: `${rows[0].senha_hash.slice(0, 14)}...` }
  resultado.senhaConfere = await bcrypt.compare(SENHA_INICIAL, rows[0].senha_hash)

  // o registro protegido nao pode ser editado nem excluido...
  await tenta('editarNome', "UPDATE usuario SET name = 'Outro' WHERE id = 1")
  await tenta('excluir', 'DELETE FROM usuario WHERE id = 1')
  // ...mas o carimbo de login precisa continuar funcionando
  await tenta('carimboDeLogin', 'UPDATE usuario SET ultimo_acesso = now() WHERE id = 1')

  // com desbloqueio explicito, a edicao passa
  await c.query('BEGIN')
  await c.query("SET LOCAL app.desbloqueio = 'on'")
  await tenta('editarComDesbloqueio', "UPDATE usuario SET telefone = '(11) 90000-0000' WHERE id = 1")
  await c.query('ROLLBACK')

  // restricoes
  await tenta(
    'cpfInvalido',
    "INSERT INTO usuario (name,email,cpf,data_nascimento,cargo,senha_hash) VALUES ('X','x@y.com','123','2000-01-01','a','h')",
  )
  await tenta(
    'avaliacaoForaDaFaixa',
    "INSERT INTO usuario (name,email,cpf,data_nascimento,cargo,avaliacao,senha_hash) VALUES ('X','x@y.com','12345678901','2000-01-01','a',11,'h')",
  )
  await tenta(
    'emailDuplicadoOutraCaixa',
    "INSERT INTO usuario (name,email,cpf,data_nascimento,cargo,senha_hash) VALUES ('X','WILLIAN@lwnengenharia.com.br','12345678901','2000-01-01','a','h')",
  )
  await tenta(
    'segundoUsuarioNormal',
    "INSERT INTO usuario (name,email,cpf,data_nascimento,cargo,avaliacao,outlook,senha_hash) VALUES ('Teste','t@lwn.com','12345678901','1990-05-10','analista',8.5,true,'h')",
  )

  const ids = await c.query('SELECT id FROM usuario ORDER BY id')
  resultado.idsAposInsercao = ids.rows.map((r) => Number(r.id))
} catch (erro) {
  resultado.erroNoScript = erro.message
} finally {
  await c.end()
  const limpeza = new pg.Client({ ...base, database: 'postgres' })
  await limpeza.connect()
  await limpeza.query(`DROP DATABASE IF EXISTS ${TESTE}`)
  await limpeza.end()
  resultado.bancoDeTesteRemovido = true
}

console.log(JSON.stringify(resultado, null, 2))
