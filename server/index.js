import 'dotenv/config'
import express from 'express'
import { checarConexao, pool } from './db.js'
import { plantarRoteiro } from './roteiro.js'
import { comoEnvia, diagnostico } from './email.js'
import authRouter from './routes/auth.js'
import equipeRouter from './routes/equipe.js'
import dadosRouter from './routes/dados.js'
import roteiroRouter from './routes/roteiro.js'
import botRouter, { aquecer } from './routes/bot.js'

const app = express()
const porta = Number(process.env.API_PORT ?? 3001)

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

app.listen(porta, async () => {
  console.log(`[api] ouvindo em http://localhost:${porta}`)
  /* o modelo do bot entra na memoria agora, sem ninguem esperando: a
     primeira pergunta do dia custa 50s com ele frio e 7s com ele quente */
  aquecer()
  /* saber por onde o e-mail sai poupa meia hora de investigacao quando
     o "esqueci minha senha" nao chega */
  const modo = comoEnvia()
  const caminho = {
    'api-microsoft': 'API da Microsoft (Graph)',
    smtp: 'SMTP',
    nenhum: 'NAO CONFIGURADO — o "esqueci minha senha" nao envia',
  }[modo]
  console.log(`[api] envio de e-mail: ${caminho}`)

  /* Autenticar e uma coisa, ter permissao e outra: o registro pode
     estar certinho e o envio falhar com 403 porque ninguem concedeu
     Mail.Send. O token responde isso sem mandar e-mail nenhum, e dizer
     aqui poupa a investigacao de "por que o codigo nao chega". */
  if (modo === 'api-microsoft') {
    const check = await diagnostico()
    console.log(`[api] ${check.ok ? 'permissao ok:' : 'ATENCAO:'} ${check.motivo}`)
  }
  try {
    const info = await checarConexao()
    console.log(`[api] banco "${info.banco}" conectado.`)
    if (!info.tem_tabela) {
      console.warn('[api] atencao: a tabela "usuario" ainda nao existe — rode db/usuario.sql.txt')
      return
    }
    /* planta o roteiro de fabrica so na primeira vez; depois disso o
       roteiro e do usuario e subir a API de novo nao mexe em nada */
    const plantadas = await plantarRoteiro(pool)
    if (plantadas > 0) console.log(`[api] roteiro de fabrica criado: ${plantadas} etapas.`)
  } catch (erro) {
    if (erro.code === '42P01' || erro.code === '42703') {
      console.warn(
        '[api] atencao: faltam tabelas/colunas novas — rode db/quadro.sql.txt e db/atualizacao.sql.txt',
      )
      return
    }
    console.error('[api] falha ao conectar no banco:', erro.message)
  }
})
