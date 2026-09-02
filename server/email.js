/**
 * Envio de e-mail do sistema.
 *
 * Hoje so serve para uma coisa: mandar o codigo de recuperacao de
 * senha. A conta que assina e a corporativa da LWN — as credenciais
 * ficam no .env, que nao vai para o Git.
 *
 * Ha DOIS caminhos, e o primeiro que estiver configurado ganha:
 *
 *   1. API da Microsoft (Graph), em graph.js. E o caminho bom, e o
 *      unico que funciona no tenant da LWN: o SMTP autenticado esta
 *      desligado la, e nenhuma senha faz o servidor aceitar
 *      ("535 5.7.139 ... SmtpClientAuthentication is disabled").
 *
 *   2. SMTP comum, com nodemailer. Continua aqui para quem roda o
 *      sistema em outro provedor (Gmail, Zoho, um SMTP proprio) e
 *      para o ambiente de desenvolvimento.
 *
 * Se a conta do SMTP tiver verificacao em duas etapas, o servidor
 * recusa a senha normal: nesse caso gere uma "senha de aplicativo" no
 * portal do provedor e ponha ela no MAIL_SENHA.
 */
import nodemailer from 'nodemailer'
import * as graph from './graph.js'

/* As credenciais vem SO do .env — nunca escritas aqui. Este arquivo vai
   para o Git; o .env, nao. Se MAIL_SENHA estiver vazia, `temEmail()`
   devolve false e a tela avisa em vez de tentar enviar. */
const REMETENTE = process.env.MAIL_USUARIO || ''
const SENHA = process.env.MAIL_SENHA || ''
const SERVIDOR = process.env.MAIL_HOST || 'smtp.office365.com'
const PORTA = Number(process.env.MAIL_PORT ?? 587)

let carteiro = null

/** O transporte e criado uma vez so e reaproveitado. */
function conectar() {
  if (carteiro) return carteiro
  carteiro = nodemailer.createTransport({
    host: SERVIDOR,
    port: PORTA,
    // 587 e STARTTLS: comeca em texto e sobe para TLS
    secure: PORTA === 465,
    auth: { user: REMETENTE, pass: SENHA },
    requireTLS: PORTA !== 465,
  })
  return carteiro
}

/** true quando existe ALGUM caminho de envio configurado. */
export function temEmail() {
  return graph.configurado() || Boolean(REMETENTE && SENHA)
}

/** Qual caminho vai ser usado — aparece no log ao subir a API. */
export function comoEnvia() {
  if (graph.configurado()) return 'api-microsoft'
  if (REMETENTE && SENHA) return 'smtp'
  return 'nenhum'
}

const escapar = (texto) =>
  String(texto ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Manda o codigo de recuperacao.
 *
 * Devolve { ok: true } quando saiu, ou { ok: false, motivo } quando o
 * servidor de e-mail recusou — a rota decide o que contar para a tela
 * (nunca "esse e-mail nao existe", que entregaria quem esta cadastrado).
 */
export async function enviarCodigo({ para, nome, codigo, minutos = 3 }) {
  if (!temEmail()) {
    return { ok: false, motivo: 'O envio de e-mail não está configurado no servidor.' }
  }

  const primeiro = String(nome ?? '').trim().split(/\s+/)[0] || 'Olá'

  const corpo = `
    <div style="font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f4f6fb;padding:28px">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;
                  padding:28px 30px;border:1px solid #e3e8f2">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;
                  color:#7b8798">LWN Engenharia</p>
        <h1 style="margin:0 0 18px;font-size:20px;color:#0d1b33">Recuperação de senha</h1>

        <p style="margin:0 0 14px;font-size:15px;color:#33415c;line-height:1.55">
          ${escapar(primeiro)}, use o código abaixo para criar uma nova senha no
          Trajetória de Clientes:
        </p>

        <p style="margin:0 0 16px;text-align:center">
          <span style="display:inline-block;padding:14px 26px;border-radius:12px;
                       background:#0f2a52;color:#fff;font-size:30px;font-weight:700;
                       letter-spacing:.28em">${escapar(codigo)}</span>
        </p>

        <p style="margin:0 0 14px;font-size:14px;color:#5a6a85;line-height:1.55">
          O código vale por <strong>${minutos} minutos</strong>. Depois disso ele deixa de
          funcionar e você precisa pedir outro na própria tela.
        </p>

        <p style="margin:0;font-size:13px;color:#8a97ab;line-height:1.55">
          Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.
        </p>
      </div>
    </div>`

  const assunto = `Seu código de recuperação: ${codigo}`
  const simples = `Seu código de recuperação é ${codigo}. Ele vale por ${minutos} minutos.`

  /* a API da Microsoft na frente: no tenant da LWN e a unica que sai */
  if (graph.configurado()) {
    return graph.enviar({ para, assunto, html: corpo, texto: simples })
  }

  try {
    await conectar().sendMail({
      from: `"LWN Team Análise" <${REMETENTE}>`,
      to: para,
      subject: assunto,
      text: simples,
      html: corpo,
    })
    return { ok: true }
  } catch (erro) {
    console.error('[email/codigo]', erro.message)

    /* Este erro tem nome e sobrenome, e a resposta generica escondia
       ele: a conta e a senha estao certas, o que esta desligado e o
       SMTP do tenant inteiro. Sem dizer isso, a diretoria procura o
       problema no lugar errado. */
    if (erro.message?.includes('SmtpClientAuthentication is disabled')) {
      return {
        ok: false,
        motivo:
          'A Microsoft bloqueia o envio por SMTP neste domínio. Configure o envio pela API (GRAPH_TENANT_ID, GRAPH_CLIENT_ID e GRAPH_CLIENT_SECRET no .env) — veja o README.',
      }
    }
    if (erro.responseCode === 535 || erro.code === 'EAUTH') {
      return {
        ok: false,
        motivo: 'O servidor de e-mail recusou a conta configurada. Confira MAIL_USUARIO e MAIL_SENHA.',
      }
    }
    return { ok: false, motivo: 'Não foi possível enviar o e-mail agora. Tente de novo.' }
  }
}
