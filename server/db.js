import 'dotenv/config'
import pg from 'pg'

const { Pool, types } = pg

// DATE (oid 1082) volta como texto 'AAAA-MM-DD': sem Date, sem deslocamento de fuso
types.setTypeParser(1082, (valor) => valor)
// BIGINT (oid 20) volta como numero: nossos ids cabem com folga em Number
types.setTypeParser(20, (valor) => Number(valor))

/* ------------------------------------------------------------
   De onde sai a conexao

   Duas formas, e a primeira ganha quando existe:

     DATABASE_URL   uma linha so, do jeito que o Neon entrega e que a
                    Vercel guarda. E o que vale em producao.
     DB_HOST/...    os campos separados, do Postgres instalado na
                    maquina. Continua valendo para quem roda local,
                    sem precisar mudar nada no .env de ninguem.

   O tamanho do pool muda conforme onde o codigo esta rodando. Num
   processo comum, um pool de dez conexoes e reaproveitado por todo
   mundo. Em serverless nao ha processo comum: cada chamada acorda uma
   copia da funcao e cada copia abre o proprio pool — dez copias com
   dez conexoes cada estouram o limite do banco sem precisar de dez
   pessoas usando o sistema. Por isso `max` cai para 1 na Vercel.
   ------------------------------------------------------------ */

const url = process.env.DATABASE_URL?.trim()
const naVercel = Boolean(process.env.VERCEL)

/* Banco na nuvem exige TLS; o da maquina nao fala TLS nenhum. Decidir
   pelo endereco evita mais uma variavel de ambiente so para conseguir
   rodar local. */
const ehLocal = (endereco) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(endereco)

export const pool = new Pool(
  url
    ? {
        connectionString: url,
        ssl: ehLocal(url) ? false : { rejectUnauthorized: true },
        max: naVercel ? 1 : 10,
        idleTimeoutMillis: 30_000,
        /* o compute do Neon dorme quando ninguem usa e leva alguns
           segundos para acordar: com os 5s de antes, a primeira
           chamada depois de um tempo parado morria no timeout */
        connectionTimeoutMillis: 15_000,
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      },
)

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
