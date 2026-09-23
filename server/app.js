import 'dotenv/config'
import express from 'express'
import { checarConexao } from './db.js'
import authRouter from './routes/auth.js'
import equipeRouter from './routes/equipe.js'
import dadosRouter from './routes/dados.js'
import roteiroRouter from './routes/roteiro.js'
import botRouter from './routes/bot.js'

/**
 * A API — so as rotas, sem servidor nenhum em volta.
 *
 * A separacao existe por causa da hospedagem. Na maquina local um
 * processo fica ouvindo a porta 3001 e atende tudo; na Vercel nao ha
 * processo nenhum parado esperando — cada chamada acorda uma funcao,
 * que recebe o pedido pronto e devolve a resposta.
 *
 * Os dois caminhos montam ESTE mesmo `app`:
 *
 *   server/index.js -> da um listen nele (desenvolvimento);
 *   api/index.js    -> entrega ele para a Vercel (producao).
 *
 * Como as rotas sao as mesmas, o que funciona num funciona no outro —
 * e nao ha uma "versao de producao" do comportamento para ninguem
 * descobrir quebrada depois do deploy.
 */

const app = express()

// foto de perfil e logo de cliente viajam como data URL: o limite
// padrao do express (100kb) barraria qualquer imagem de verdade
app.use(express.json({ limit: '8mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    const info = await checarConexao()
    res.json({ ok: true, ...info })
  } catch (erro) {
    res.status(503).json({ ok: false, erro: erro.message })
  }
})

app.use('/api/auth', authRouter)
app.use('/api/equipe', equipeRouter)
app.use('/api/dados', dadosRouter)
app.use('/api/roteiro', roteiroRouter)
app.use('/api/bot', botRouter)

app.use((erro, _req, res, _next) => {
  /* imagem grande demais chegava aqui como 500 sem explicacao, e a tela
     so dizia "nao foi possivel". Agora o recado diz o que houve. */
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({
      erro: 'A imagem é grande demais para ser salva. Escolha uma menor.',
    })
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O conteúdo enviado veio corrompido.' })
  }
  console.error('[api]', erro)
  return res.status(500).json({ erro: 'Erro interno no servidor.' })
})

export default app
