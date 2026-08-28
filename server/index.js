import 'dotenv/config'
import express from 'express'
import { checarConexao } from './db.js'
import authRouter from './routes/auth.js'

const app = express()
const porta = Number(process.env.API_PORT ?? 3001)

app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    const info = await checarConexao()
    res.json({ ok: true, ...info })
  } catch (erro) {
    res.status(503).json({ ok: false, erro: erro.message })
  }
})

app.use('/api/auth', authRouter)

app.use((erro, _req, res, _next) => {
  console.error('[api]', erro)
  res.status(500).json({ erro: 'Erro interno no servidor.' })
})

app.listen(porta, () => {
  console.log(`[api] ouvindo em http://localhost:${porta}`)
  checarConexao()
    .then((info) => {
      console.log(`[api] banco "${info.banco}" conectado.`)
      if (!info.tem_tabela) {
        console.warn('[api] atencao: a tabela "usuario" ainda nao existe — rode o SQL do arquivo db/usuario.sql.txt')
      }
    })
    .catch((erro) => console.error('[api] falha ao conectar no banco:', erro.message))
})
