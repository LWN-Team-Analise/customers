/**
 * O jeito unico de falar com a API.
 *
 * Cuida do token, do JSON e da mensagem de erro — as telas so recebem o
 * corpo pronto ou uma Error com texto que da para mostrar na tela.
 */

const CHAVE_SESSAO = 'customers.session'

function tokenGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? 'null')?.token ?? null
  } catch {
    return null
  }
}

/**
 * O token tambem vive aqui na memoria — e esta copia e a que vale.
 *
 * Quem escreve no localStorage e um efeito do AuthContext, e efeito so
 * roda DEPOIS que a tela pinta. So que o DadosProvider e filho do
 * AuthProvider, e efeito de filho roda ANTES do efeito do pai: no
 * instante em que o login abria a sessao, a primeira carga do quadro ja
 * saia — e saia SEM token, porque o localStorage ainda estava vazio.
 * Voltava 401, a sessao recem-aberta era derrubada, e o login dizia
 * "sua sessao expirou" logo depois de a pessoa acertar a senha.
 *
 * Com a copia em memoria o token existe no mesmo instante em que o
 * login responde, sem depender de quando o efeito roda.
 */
let tokenNaMemoria = tokenGuardado()

/** Chamado pelo AuthContext no mesmo passo em que a sessao muda. */
export function guardarToken(token) {
  tokenNaMemoria = token ?? null
}

export function tokenAtual() {
  return tokenNaMemoria ?? tokenGuardado()
}

/**
 * O aviso de que a sessao morreu.
 *
 * O token vale 8 horas. Passado esse tempo, TODA chamada volta 401 — mas
 * a sessao continuava guardada aqui, entao a tela seguia com cara de
 * logada, mostrando os dados que ja tinha carregado, e so o primeiro
 * "salvar" e que revelava o problema.
 *
 * Agora, no primeiro 401 de sessao, a sessao e apagada e este evento
 * avisa o AuthContext, que manda a pessoa para o login.
 */
export const SESSAO_CAIU = 'customers:sessao-caiu'

function derrubarSessao() {
  tokenNaMemoria = null
  try {
    localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    /* storage bloqueado: o evento abaixo ja resolve nesta aba */
  }
  window.dispatchEvent(new CustomEvent(SESSAO_CAIU))
}

/** Erro que a tela sabe distinguir: o servidor nao respondeu. */
export class SemServidor extends Error {
  constructor() {
    super('Sem conexão com o servidor. Suas alterações não foram salvas.')
    this.name = 'SemServidor'
  }
}

/**
 * Chama a API. Devolve o corpo (ou {} em 204).
 * Lanca SemServidor quando nem deu para falar com o servidor, e Error
 * comum quando o servidor respondeu recusando.
 */
export async function chamar(caminho, opcoes = {}) {
  const token = tokenAtual()

  let resposta
  try {
    resposta = await fetch(`/api${caminho}`, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
      },
      body: opcoes.corpo === undefined ? opcoes.body : JSON.stringify(opcoes.corpo),
    })
  } catch {
    throw new SemServidor()
  }

  if (resposta.status === 204) return {}

  const corpo = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    /* `sessao: false` so vem quando o token morreu de verdade. Um 401 sem
       essa marca e outra coisa — a troca de senha, por exemplo, responde
       401 quando a senha atual esta errada, e ali derrubar a sessao seria
       o pior a fazer. */
    if (resposta.status === 401 && corpo?.sessao === false) {
      derrubarSessao()
      throw new Error(corpo.erro ?? 'Sessão expirada. Entre de novo.')
    }
    // 5xx sem corpo util e servidor fora do ar para efeito da tela
    if (resposta.status >= 500 && !corpo?.erro) throw new SemServidor()
    throw new Error(corpo?.erro ?? 'Não foi possível completar a operação.')
  }

  return corpo ?? {}
}

export const get = (caminho) => chamar(caminho)
export const post = (caminho, corpo) => chamar(caminho, { method: 'POST', corpo })
export const patch = (caminho, corpo) => chamar(caminho, { method: 'PATCH', corpo })
export const put = (caminho, corpo) => chamar(caminho, { method: 'PUT', corpo })
export const del = (caminho) => chamar(caminho, { method: 'DELETE' })
