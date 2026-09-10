import { useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import Avatar from '@/components/Avatar/Avatar'
import { CampoArea, CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { dataBR, dataHora, hojeISO } from '@/utils/formato'
import './ModalObservacoes.css'

const Lixo = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </svg>
)

const Lapis = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
  </svg>
)

const Relogio = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
)

/** A janela vazia — o estado de "sem duração". */
const SEM_PRAZO = { comPrazo: false, inicioEm: '', fimEm: '' }

/** Confere as duas datas. Devolve '' quando está tudo certo. */
function conferirPrazo({ comPrazo, inicioEm, fimEm }) {
  if (!comPrazo) return ''
  if (!inicioEm || !fimEm) return 'Preencha as duas datas: de e até.'
  if (fimEm < inicioEm) return 'A data final não pode ser antes da inicial.'
  return ''
}

/** O que vai para a API: a janela, ou os dois campos vazios. */
const paraApi = ({ comPrazo, inicioEm, fimEm }) =>
  comPrazo ? { inicioEm, fimEm } : { inicioEm: '', fimEm: '' }

/**
 * Observacoes do QUADRO — as que valem para as obras em geral, e nao
 * para uma obra so (essas ficam dentro da obra).
 *
 * Da para EDITAR a propria observacao, e nao so apagar.
 *
 * Antes so havia o lixo, e quem errasse uma palavra tinha de apagar o
 * recado e escrever tudo de novo — o que, num painel que a equipe le em
 * ordem, fazia a observacao mudar de lugar na lista e perder as
 * respostas que ja tinham vindo. Editar mantem a observacao onde ela
 * esta; a marca "editada" e o que diz a quem ja tinha lido que o texto
 * nao e mais o mesmo.
 *
 * Cada um mexe so na propria — a API confere de novo antes de gravar.
 *
 * ---------------- Duracao ----------------
 *
 * Muito recado vale por um periodo e nao para sempre ("ate sexta o
 * galpao fica fechado"), e ate aqui quem escrevia tinha de lembrar de
 * voltar e apagar. Quase nunca lembrava, e o painel virava um mural de
 * recado vencido.
 *
 * Marcando "Adicionar duracao" abrem os dois calendarios, os dois
 * obrigatorios. Passada a data final, a observacao sai do painel
 * SOZINHA e vai para a aba Historico — nao e apagada, porque "o que
 * estava valendo em marco?" e uma pergunta legitima.
 *
 * Duas coisas que nao entram no historico, de proposito:
 *
 *   - a observacao SEM duracao, que nunca vence: ela fica no painel ate
 *     alguem apagar, como sempre foi;
 *   - a observacao apagada na mao: quem clicou no lixo nao queria mais
 *     ver aquilo, e ressuscitar numa aba seria o contrario do gesto.
 */
export default function ModalObservacoes({ aberto, aoFechar, autor }) {
  const {
    observacoesQuadro,
    historicoObservacoes,
    pessoaPorId,
    adicionarObservacaoQuadro,
    editarObservacaoQuadro,
    removerObservacaoQuadro,
  } = useDados()

  const [aba, setAba] = useState('atuais')
  const [texto, setTexto] = useState('')
  const [prazo, setPrazo] = useState(SEM_PRAZO)
  const [erroPrazo, setErroPrazo] = useState('')
  const [salvando, setSalvando] = useState(false)
  /* a observação que está aberta para edição (id), o texto e o prazo dela */
  const [editando, setEditando] = useState(null)
  const [rascunho, setRascunho] = useState('')
  const [prazoEdicao, setPrazoEdicao] = useState(SEM_PRAZO)
  const [erroEdicao, setErroEdicao] = useState('')

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!texto.trim()) return

    const problema = conferirPrazo(prazo)
    setErroPrazo(problema)
    if (problema) return

    setSalvando(true)
    try {
      await adicionarObservacaoQuadro({ texto: texto.trim(), ...paraApi(prazo) })
      setTexto('')
      setPrazo(SEM_PRAZO)
    } catch {
      /* o recado do erro aparece na faixa do AppShell */
    } finally {
      setSalvando(false)
    }
  }

  const abrirEdicao = (o) => {
    setEditando(o.id)
    setRascunho(o.texto)
    setPrazoEdicao(
      o.fimEm ? { comPrazo: true, inicioEm: o.inicioEm ?? '', fimEm: o.fimEm } : SEM_PRAZO,
    )
    setErroEdicao('')
  }

  const salvarEdicao = async (evento) => {
    evento.preventDefault()
    if (!rascunho.trim()) return

    const problema = conferirPrazo(prazoEdicao)
    setErroEdicao(problema)
    if (problema) return

    setSalvando(true)
    try {
      await editarObservacaoQuadro(editando, {
        texto: rascunho.trim(),
        ...paraApi(prazoEdicao),
      })
      setEditando(null)
      setRascunho('')
      setPrazoEdicao(SEM_PRAZO)
    } catch {
      /* o recado do erro aparece na faixa do AppShell */
    } finally {
      setSalvando(false)
    }
  }

  const lista = aba === 'atuais' ? observacoesQuadro : historicoObservacoes

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Observações do quadro"
      subtitulo="Recados que valem para as obras em geral. Ficam com seu nome e o horário."
      largura={560}
    >
      <form className="quadroform" onSubmit={enviar}>
        <div className="quadroform__autor">
          <Avatar nome={autor?.name} foto={autor?.foto} tamanho={34} titulo={autor?.name} />
          <strong>{autor?.name ?? 'Usuário'}</strong>
        </div>

        <CampoArea
          rotulo="Nova observação"
          largo
          linhas={3}
          placeholder="O que a equipe precisa saber?"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        <Duracao valor={prazo} aoMudar={setPrazo} erro={erroPrazo} />

        <div className="quadroform__acao">
          <Button type="submit" disabled={!texto.trim()} loading={salvando}>
            Adicionar
          </Button>
        </div>
      </form>

      {/* As duas abas. O histórico só aparece quando há o que mostrar:
          aba vazia só ensina a ignorar abas. */}
      <div className="quadroabas" role="tablist" aria-label="Observações">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'atuais'}
          className={`quadroabas__aba ${aba === 'atuais' ? 'is-atual' : ''}`.trim()}
          onClick={() => setAba('atuais')}
        >
          No quadro
          <em>{observacoesQuadro.length}</em>
        </button>

        {historicoObservacoes.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'historico'}
            className={`quadroabas__aba ${aba === 'historico' ? 'is-atual' : ''}`.trim()}
            onClick={() => setAba('historico')}
          >
            Histórico
            <em>{historicoObservacoes.length}</em>
          </button>
        )}
      </div>

      <div className="quadrolista">
        {lista.length === 0 && (
          <p className="quadrolista__vazio">
            {aba === 'atuais'
              ? 'Nenhuma observação registrada ainda.'
              : 'Nada no histórico ainda. Só entra aqui a observação que tinha duração e venceu.'}
          </p>
        )}

        {lista.map((o) => {
          /* cada um mexe só na própria; a API confere de novo */
          const minha = String(o.autorId) === String(autor?.id)
          const emEdicao = editando === o.id
          const vencida = aba === 'historico'

          return (
            <article
              key={o.id}
              className={`quadrolista__item ${vencida ? 'is-vencida' : ''}`.trim()}
            >
              <Avatar nome={o.autorNome} foto={pessoaPorId(o.autorId)?.foto} tamanho={32} />
              <div className="quadrolista__corpo">
                <p className="quadrolista__quem">
                  <strong>{o.autorNome}</strong>
                  <span>{dataHora(o.enviadaEm)}</span>
                  {/* quem já tinha lido precisa saber que o texto mudou */}
                  {o.editadaEm && <em className="quadrolista__editada">editada</em>}
                </p>

                {emEdicao ? (
                  <form className="quadrolista__form" onSubmit={salvarEdicao}>
                    <CampoArea
                      rotulo="Editar observação"
                      largo
                      linhas={3}
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                    />
                    <Duracao valor={prazoEdicao} aoMudar={setPrazoEdicao} erro={erroEdicao} />
                    <div className="quadrolista__formacoes">
                      <button
                        type="button"
                        className="formobra__cancelar"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                      <Button type="submit" disabled={!rascunho.trim()} loading={salvando}>
                        Salvar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="quadrolista__texto">{o.texto}</p>
                    {/* a janela, quando existe. No histórico ela é a
                        própria explicação de por que a observação saiu
                        do painel. */}
                    {o.fimEm && (
                      <p className="quadrolista__prazo">
                        <Relogio />
                        {vencida ? 'Valeu de' : 'De'} {dataBR(o.inicioEm)} até {dataBR(o.fimEm)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {minha && !emEdicao && (
                <span className="quadrolista__ferramentas">
                  <button
                    type="button"
                    className="quadrolista__apagar"
                    onClick={() => abrirEdicao(o)}
                    aria-label={`Editar a sua observação de ${dataHora(o.enviadaEm)}`}
                    title="Editar"
                  >
                    <Lapis />
                  </button>
                  <button
                    type="button"
                    className="quadrolista__apagar"
                    onClick={() => removerObservacaoQuadro(o.id).catch(() => {})}
                    aria-label={`Apagar a sua observação de ${dataHora(o.enviadaEm)}`}
                    title="Apagar"
                  >
                    <Lixo />
                  </button>
                </span>
              )}
            </article>
          )
        })}
      </div>
    </Modal>
  )
}

/**
 * O bloco "Adicionar duracao".
 *
 * Desmarcado ele e uma linha so — uma caixa de marcar. Marcado, abrem
 * os dois calendarios, e os dois sao obrigatorios: uma janela pela
 * metade nao diz quando a observacao sai do quadro, que e a unica
 * coisa que a duracao existe para dizer.
 *
 * Marcar ja preenche as duas datas com HOJE. Assim o caso comum ("de
 * hoje ate sexta") custa um clique em vez de dois calendarios, e a
 * conferencia nunca reclama de campo vazio na primeira olhada.
 *
 * O `min`/`max` cruzado entre os dois campos e a primeira barreira: o
 * proprio calendario ja nao deixa escolher um fim antes do inicio. A
 * conferencia no envio e a segunda, para quem digita a data na mao, e
 * a constraint do banco e a terceira.
 */
function Duracao({ valor, aoMudar, erro }) {
  const marcar = (marcado) =>
    aoMudar(
      marcado
        ? {
            comPrazo: true,
            inicioEm: valor.inicioEm || hojeISO(),
            fimEm: valor.fimEm || hojeISO(),
          }
        : SEM_PRAZO,
    )

  return (
    <div className="quadroprazo">
      <label className="quadroprazo__marca">
        <input
          type="checkbox"
          checked={valor.comPrazo}
          onChange={(e) => marcar(e.target.checked)}
        />
        <span>Adicionar duração</span>
      </label>

      {valor.comPrazo && (
        <>
          <div className="quadroprazo__datas">
            <CampoTexto
              rotulo="De"
              type="date"
              required
              value={valor.inicioEm}
              max={valor.fimEm || undefined}
              onChange={(e) => aoMudar({ ...valor, inicioEm: e.target.value })}
            />
            <CampoTexto
              rotulo="Até"
              type="date"
              required
              value={valor.fimEm}
              min={valor.inicioEm || undefined}
              onChange={(e) => aoMudar({ ...valor, fimEm: e.target.value })}
            />
          </div>

          <p
            className={`quadroprazo__nota ${erro ? 'is-erro' : ''}`.trim()}
            role={erro ? 'alert' : undefined}
          >
            {erro || 'Depois da data final a observação sai do quadro e vai para o histórico.'}
          </p>
        </>
      )}
    </div>
  )
}
