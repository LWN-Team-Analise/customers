/**
 * Aplica no banco os arquivos de ATUALIZACAO de db/, na ordem.
 *
 *   npm run db:atualizar
 *
 * Usa a mesma conexao da API (server/db.js, credenciais do .env), entao
 * nao precisa de psql no PATH nem de digitar senha.
 *
 * SO os arquivos de atualizacao entram aqui. Os de instalacao
 * (usuario.sql.txt, sistema.sql.txt, quadro.sql.txt) ficam de fora de
 * proposito: num banco que ja roda eles nao acrescentam nada, e o
 * sistema.sql.txt ainda desfaz o que o quadro.sql.txt fez — ele repoe
 * as views antigas, que olham a tabela obra_tarefa. Instalacao nova
 * continua sendo pelos arquivos, na ordem do README.
 *
 * Todos sao idempotentes: rodar de novo nao quebra nada, e e assim que
 * se descobre se falta algum.
 */
import fs from 'node:fs'
import { pool, query } from '../db.js'

const ARQUIVOS = [
  'db/atualizacao.sql.txt',
  'db/setores-e-chat.sql.txt',
  'db/atualizacao-2.sql.txt',
  'db/atualizacao-3.sql.txt',
]

/**
 * O que cada arquivo tinha de deixar pronto.
 *
 * Serve para o script responder "deu certo?" sem a pessoa ter de ler
 * o SQL: se alguma linha vier FALTA, aquele arquivo nao passou.
 */
const CONFERENCIA = [
  ['etiqueta', "SELECT to_regclass('public.etiqueta') IS NOT NULL AS ok"],
  ['obra_anexo', "SELECT to_regclass('public.obra_anexo') IS NOT NULL AS ok"],
  ['obra_chat', "SELECT to_regclass('public.obra_chat') IS NOT NULL AS ok"],
  ['cargo.permissoes', col('cargo', 'permissoes')],
  ['setor_cliente', "SELECT to_regclass('public.setor_cliente') IS NOT NULL AS ok"],
  ['obra.proposta', col('obra', 'proposta')],
  ['obra.concluida_em', col('obra', 'concluida_em')],
  ['obra.concluida_por', col('obra', 'concluida_por')],
  ['obra.conclusao_obs', col('obra', 'conclusao_obs')],
  ['usuario.cargo_titulo', col('usuario', 'cargo_titulo')],
  ['obra.descricao aceita NULL', nulavel('obra', 'descricao')],
  ['usuario.email aceita NULL', nulavel('usuario', 'email')],
  ['gatilho obra_check_sai', "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='obra_check_sai_tg') AS ok"],
  ['configuracao', "SELECT to_regclass('public.configuracao') IS NOT NULL AS ok"],
  ['termo_etapa', "SELECT EXISTS (SELECT 1 FROM configuracao WHERE chave='termo_etapa') AS ok"],
  ['obra_chat.apagada_em', col('obra_chat', 'apagada_em')],
  ['obra_chat_oculta', "SELECT to_regclass('public.obra_chat_oculta') IS NOT NULL AS ok"],
]

function col(tabela, coluna) {
  return `SELECT EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='${tabela}' AND column_name='${coluna}') AS ok`
}

function nulavel(tabela, coluna) {
  return `SELECT coalesce((SELECT is_nullable='YES' FROM information_schema.columns
            WHERE table_schema='public' AND table_name='${tabela}' AND column_name='${coluna}'), false) AS ok`
}

let falhou = false

try {
  const { rows } = await query('SELECT current_database() AS banco')
  console.log(`\nBanco: ${rows[0].banco}\n`)

  for (const arquivo of ARQUIVOS) {
    if (!fs.existsSync(arquivo)) {
      console.log(`  pulado  ${arquivo} (arquivo nao encontrado)`)
      continue
    }
    try {
      await query(fs.readFileSync(arquivo, 'utf8'))
      console.log(`  ok      ${arquivo}`)
    } catch (erro) {
      falhou = true
      console.log(`  ERRO    ${arquivo}`)
      console.log(`          ${erro.message}`)
    }
  }

  console.log('\nConferindo o que ficou no banco:\n')
  for (const [rotulo, consulta] of CONFERENCIA) {
    try {
      const { rows: r } = await query(consulta)
      const ok = r[0]?.ok === true
      if (!ok) falhou = true
      console.log(`  ${ok ? 'ok     ' : 'FALTA  '} ${rotulo}`)
    } catch (erro) {
      falhou = true
      console.log(`  ERRO    ${rotulo}: ${erro.message}`)
    }
  }
} catch (erro) {
  falhou = true
  console.error('\nNao foi possivel falar com o banco:', erro.message)
  console.error('Confira DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME no .env.')
} finally {
  await pool.end().catch(() => {})
}

console.log(
  falhou
    ? '\nAlgo nao passou. Nada foi perdido: os arquivos so acrescentam, e da para rodar de novo.\n'
    : '\nBanco atualizado. Suba a API de novo (npm run api) para ela enxergar as colunas novas.\n',
)
process.exit(falhou ? 1 : 0)
