/**
 * Envio de e-mail pela API da Microsoft (Graph).
 *
 * Existe porque o caminho antigo parou de funcionar: o tenant da LWN
 * tem o SMTP autenticado DESLIGADO, e o servidor recusa a conta com
 *
 *   535 5.7.139 Authentication unsuccessful,
 *   SmtpClientAuthentication is disabled for the Tenant.
 *
 * A senha estava certa o tempo todo — o que a Microsoft nao aceita
 * mais e login por SMTP. O Graph e a porta que ela deixou aberta: em
 * vez de "conectar na caixa e mandar", o servidor pede um token para o
 * Entra ID e chama /sendMail.
 *
 * O fluxo aqui e o de CREDENCIAIS DE CLIENTE: quem se autentica e o
 * aplicativo, nao uma pessoa. Nao ha tela de login, nao ha senha de
 * caixa e nao ha MFA para atrapalhar — o que existe e uma permissao de
 * aplicativo (Mail.Send) concedida pelo administrador do tenant.
 *
 * O .env precisa de tres valores do registro no Entra ID:
 *
 *   GRAPH_TENANT_ID=...      o ID do diretorio (GUID) ou o dominio
 *   GRAPH_CLIENT_ID=...      o ID do aplicativo
 *   GRAPH_CLIENT_SECRET=...  o valor do segredo do cliente
 *
 * e o MAIL_USUARIO, que e a caixa de onde a mensagem sai.
 *
 * Faltando qualquer um deles, `configurado()` devolve false e o
 * email.js cai no SMTP de antes — que continua servindo para quem
 * roda o sistema fora do tenant da LWN.
 */

/* Se o registro do Entra ID for o MESMO do login com Outlook, basta
   acrescentar Mail.Send nele e o resto ja esta preenchido. So o tenant
   nao serve: credenciais de cliente exigem o ID do diretorio, e
   'organizations' nao e um diretorio. */
const INQUILINO = process.env.GRAPH_TENANT_ID || ''
const CLIENTE = process.env.GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID || ''
const SEGREDO = process.env.GRAPH_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || ''
const CAIXA = process.env.MAIL_USUARIO || ''

export function configurado() {
  return Boolean(INQUILINO && CLIENTE && SEGREDO && CAIXA)
}

/** O remetente configurado — o email.js usa nos recados de erro. */
export function caixaDeSaida() {
  return CAIXA
}

/* O token vale cerca de uma hora. Guardar evita uma ida ao Entra ID a
   cada e-mail; a folga de 60s cobre o relogio fora de sincronia. */
let guardado = { token: null, vence: 0 }

async function pegarToken() {
  const agora = Date.now()
  if (guardado.token && agora < guardado.vence) return guardado.token

  const resposta = await fetch(
    `https://login.microsoftonline.com/${INQUILINO}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENTE,
        client_secret: SEGREDO,
        grant_type: 'client_credentials',
        /* .default = "tudo o que o administrador ja concedeu a este
           aplicativo". Nao se pede Mail.Send aqui: a permissao mora no
           registro, nao na chamada. */
        scope: 'https://graph.microsoft.com/.default',
      }),
    },
  )

  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok || !corpo?.access_token) {
    throw new Error(corpo?.error_description ?? 'O Entra ID recusou as credenciais do aplicativo.')
  }

  guardado = {
    token: corpo.access_token,
    vence: agora + (Number(corpo.expires_in ?? 3600) - 60) * 1000,
  }
  return guardado.token
}

/**
 * Manda a mensagem pela caixa configurada.
 *
 * Devolve { ok: true } ou { ok: false, motivo } — nunca estoura, para
 * a rota poder decidir o que contar na tela.
 */
export async function enviar({ para, assunto, html, texto }) {
  if (!configurado()) {
    return { ok: false, motivo: 'O envio pela API da Microsoft não está configurado.' }
  }

  try {
    const token = await pegarToken()

    const resposta = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(CAIXA)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: assunto,
            body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: para } }],
          },
          /* false = a copia fica em "Itens Enviados" da caixa. E o que
             deixa rastro de que o codigo saiu mesmo. */
          saveToSentItems: true,
        }),
      },
    )

    // 202 Accepted, sem corpo: a Microsoft aceitou e vai entregar
    if (resposta.status === 202) return { ok: true }

    const erro = await resposta.json().catch(() => null)
    const recado = erro?.error?.message ?? `A Microsoft recusou o envio (HTTP ${resposta.status}).`
    console.error('[graph/sendMail]', recado)
    return { ok: false, motivo: traduzir(resposta.status, recado) }
  } catch (erro) {
    console.error('[graph/sendMail]', erro.message)
    return { ok: false, motivo: 'Não foi possível falar com a API da Microsoft agora.' }
  }
}

/**
 * Os erros que a Microsoft devolve sao para quem programa. Aqui eles
 * viram um recado que a pessoa na tela consegue levar para a diretoria.
 */
function traduzir(status, recado) {
  if (status === 401) {
    return 'O aplicativo não está autorizado no Entra ID. Confira o segredo do cliente (ele vence).'
  }
  if (status === 403) {
    return 'Falta a permissão Mail.Send no aplicativo, ou o consentimento do administrador.'
  }
  if (status === 404) {
    return `A caixa ${CAIXA} não foi encontrada no tenant.`
  }
  return recado
}
