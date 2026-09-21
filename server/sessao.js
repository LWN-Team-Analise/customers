/**
 * Pecas de sessao usadas por todas as rotas: quem esta falando, se ele
 * pode, e como transformar erro do Postgres em resposta util.
 */
import jwt from 'jsonwebtoken'
import { query } from './db.js'
/* a lista de permissoes e a MESMA da tela: um arquivo so, sem React
   dentro, importado pelos dois lados. Assim nao existe a chance de o
   servidor aceitar uma chave que a tela nao conhece (ou o contrario). */
import { normalizar } from '../src/domain/permissoes.js'

export const SEGREDO = process.env.JWT_SECRET || 'segredo-de-desenvolvimento'

/** Le o usuario do token. Sem token valido, devolve null. */
export function usuarioDoToken(req) {
  const cabecalho = req.headers.authorization ?? ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null
  if (!token) return null
  try {
    return jwt.verify(token, SEGREDO)
  } catch {
    return null
  }
}

/**
 * Toda rota protegida passa por aqui. Deixa o dono em req.dono.
 *
 * O `sessao: false` na resposta e o que diz a tela "a sessao morreu,
 * mande a pessoa entrar de novo". Ele existe porque 401 sozinho nao
 * basta: a troca de senha tambem devolve 401 quando a senha atual esta
 * errada, e ali derrubar a sessao seria o pior a fazer — a pessoa
 * perderia o que estava mexendo por causa de um erro de digitacao.
 */
export function exigeSessao(req, res, next) {
  const dono = usuarioDoToken(req)
  if (!dono) {
    return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.', sessao: false })
  }
  req.dono = dono
  return next()
}

/** Tabela que ainda nao existe vira recado, nao 500. */
export function tratar(erro, res, onde) {
  if (erro.code === '42P01' || erro.code === '42703') {
    return res.status(503).json({
      erro:
        'O banco ainda não tem as tabelas novas. Rode, na ordem, os arquivos de db/: ' +
        'atualizacao.sql.txt, atualizacao-2.sql.txt, atualizacao-3.sql.txt, ' +
        'atualizacao-4.sql.txt e atualizacao-5.sql.txt. Ou, de uma vez: npm run db:atualizar.',
    })
  }
  console.error(`[${onde}]`, erro)
  return res.status(500).json({ erro: 'Não foi possível completar a operação.' })
}

/**
 * O cargo de quem esta logado — chave, nome, se manda em tudo e a
 * lista de permissoes marcadas nele.
 *
 * A coluna cargo.permissoes so existe depois de db/atualizacao.sql.txt.
 * Enquanto ela nao existe, a consulta cai na versao sem ela e o sistema
 * continua de pe (so o acesso_total decide).
 */
export async function meuCargo(usuarioId) {
  let rows
  try {
    ;({ rows } = await query(
      `SELECT c.chave, c.nome, c.acesso_total, c.permissoes
         FROM usuario u LEFT JOIN cargo c ON c.id = u.cargo_id
        WHERE u.id = $1`,
      [usuarioId],
    ))
  } catch (erro) {
    if (erro.code !== '42703' && erro.code !== '42P01') throw erro
    ;({ rows } = await query(
      `SELECT c.chave, c.nome, c.acesso_total
         FROM usuario u LEFT JOIN cargo c ON c.id = u.cargo_id
        WHERE u.id = $1`,
      [usuarioId],
    ))
  }

  return {
    chave: rows[0]?.chave ?? null,
    nome: rows[0]?.nome ?? null,
    acessoTotal: rows[0]?.acesso_total ?? false,
    permissoes: normalizar(rows[0]?.permissoes ?? []),
  }
}

/** Setor com acesso total (diretoria) passa por qualquer permissao. */
export function cargoPode(cargo, chave) {
  if (!cargo) return false
  if (cargo.acessoTotal) return true
  return (cargo.permissoes ?? []).includes(chave)
}

/**
 * Trava de rota por permissao. A tela ja esconde o botao; isto aqui e
 * o que impede alguem de chamar a API na mao.
 *
 *   router.post('/x', exigeSessao, exige('editar_obras'), handler)
 */
export function exige(chave) {
  return async function checar(req, res, next) {
    try {
      const cargo = await meuCargo(req.dono.sub)
      if (!cargoPode(cargo, chave)) {
        return res.status(403).json({ erro: 'Seu setor não tem permissão para esta ação.' })
      }
      req.cargo = cargo
      return next()
    } catch (erro) {
      return tratar(erro, res, 'sessao/permissao')
    }
  }
}

/**
 * Quem edita o roteiro e os cadastros do quadro: cargo com acesso
 * total. Continua existindo para as rotas que sao mesmo de diretoria.
 */
export async function exigeAcessoTotal(req, res, next) {
  try {
    const { acessoTotal } = await meuCargo(req.dono.sub)
    if (!acessoTotal) {
      return res.status(403).json({ erro: 'Seu setor não tem permissão para esta alteração.' })
    }
    return next()
  } catch (erro) {
    return tratar(erro, res, 'sessao/acesso')
  }
}
