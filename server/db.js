import 'dotenv/config'
import pg from 'pg'

const { Pool, types } = pg

// DATE (oid 1082) volta como texto 'AAAA-MM-DD': sem Date, sem deslocamento de fuso
types.setTypeParser(1082, (valor) => valor)
// BIGINT (oid 20) volta como numero: nossos ids cabem com folga em Number
types.setTypeParser(20, (valor) => Number(valor))

/**
 * Pool unico de conexoes. As credenciais vem do .env (nunca versionado).
 * O nome do banco tem maiuscula, por isso a criacao dele precisa de aspas:
 *   CREATE DATABASE "TrajetoClientes";
 */
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (erro) => {
  console.error('[db] erro em conexao ociosa:', erro.message)
})

/** Consulta simples; usa sempre parametros ($1, $2...) para evitar SQL injection. */
export function query(text, params) {
  return pool.query(text, params)
}

/** Confere se o banco responde e se a tabela usuario ja existe. */
export async function checarConexao() {
  const { rows } = await pool.query(
    "SELECT to_regclass('public.usuario') IS NOT NULL AS tem_tabela, current_database() AS banco",
  )
  return rows[0]
}
