/**
 * Envio de e-mail do sistema.
 *
 * Hoje so serve para uma coisa: mandar o codigo de recuperacao de
 * senha. A conta que assina e a corporativa da LWN — as credenciais
 * ficam no .env (que nao vai para o Git), com o valor de fabrica aqui
 * embaixo so para o ambiente de desenvolvimento subir sem configurar
 * nada.
 *
 * O servidor e o do Microsoft 365 (a conta e @lwnengenharia.com.br).
 * Se a conta tiver verificacao em duas etapas, o SMTP recusa a senha
 * normal: nesse caso gere uma "senha de aplicativo" no portal da
 * Microsoft e ponha ela no MAIL_SENHA.
 */
import nodemailer from 'nodemailer'

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

/** true quando o envio de e-mail esta configurado. */
export function temEmail() {
  return Boolean(REMETENTE && SENHA)
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

  try {
    await conectar().sendMail({
      from: `"LWN Team Análise" <${REMETENTE}>`,
      to: para,
      subject: `Seu código de recuperação: ${codigo}`,
      text: `Seu código de recuperação é ${codigo}. Ele vale por ${minutos} minutos.`,
      html: corpo,
    })
    return { ok: true }
  } catch (erro) {
    console.error('[email/codigo]', erro.message)
    return { ok: false, motivo: 'Não foi possível enviar o e-mail agora. Tente de novo.' }
  }
}
