import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Avatar from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { prepararImagem } from '@/utils/imagem'
import { tituloDaObra } from '@/domain/obras'
import { dataHora } from '@/utils/formato'
import './ModalChat.css'

/**
 * O chat da obra.
 *
 * Cada obra tem a sua conversa, e ela fica gravada no banco — abrir
 * pelo botao "Abrir chat" (ao lado de Membros) ou pelo "+" do canto
 * leva ao mesmo lugar.
 *
 * O que da para fazer numa mensagem:
 *   - escrever;
 *   - anexar um arquivo (qualquer um; imagem entra reduzida);
 *   - tirar uma foto na hora, pela camera;
 *   - responder UMA mensagem especifica (ela fica citada em cima);
 *   - mencionar alguem com @ — a lista abre enquanto se digita.
 *
 * `somenteLeitura` e o chat da obra CONCLUIDA. A conversa inteira
 * continua a vista — e ela costuma ser a melhor explicacao do que
 * aconteceu na obra —, mas a caixa de escrever some, junto com o
 * responder e o apagar de cada mensagem. Uma obra encerrada nao recebe
 * mais nada: se recebesse, o registro dela mudaria depois de fechado.
 */

const Icone = {
  clipe: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7-7L13 4.4a3.4 3.4 0 0 1 4.8 4.8l-7.7 7.7a1.8 1.8 0 0 1-2.5-2.5l7.2-7.2" />
    </svg>
  ),
  camera: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5h2.6l1.2-2h8.4l1.2 2H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.6" r="3.4" />
    </svg>
  ),
  arroba: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.6" />
      <path d="M15.6 9v4.6a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.4 7" />
    </svg>
  ),
  enviar: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12 20 4.5 15 20l-3.6-5.6L4.5 12z" />
    </svg>
  ),
  responder: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7 4 12l5 5M4 12h9a6 6 0 0 1 6 6v1" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
  fechar: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ),
}

/** Arquivo que nao e imagem: 4 MB e o teto que cabe no limite da API. */
const BYTES_MAXIMOS = 4 * 1024 * 1024

const tamanhoLegivel = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Le um arquivo qualquer como data URL (o que o banco guarda). */
function lerArquivo(arquivo) {
  return new Promise((resolver, recusar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(leitor.result)
    leitor.onerror = () => recusar(new Error('Não foi possível ler este arquivo.'))
    leitor.readAsDataURL(arquivo)
  })
}

export default function ModalChat({ aberto, obra, somenteLeitura = false, aoFechar }) {
  const { user } = useAuth()
  const { equipe, pessoaPorId, clientePorId, carregarChat, enviarMensagem, apagarMensagem } =
    useDados()

  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState(null) // { nome, tipo, conteudo, tamanho }
  const [respondendo, setRespondendo] = useState(null)
  const [mencoes, setMencoes] = useState([])
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [camera, setCamera] = useState(false)

  /* a caixinha de @: fica aberta enquanto se digita depois do arroba */
  const [buscaMencao, setBuscaMencao] = useState(null)

  const entradaArquivo = useRef(null)
  const entradaCamera = useRef(null)
  const campo = useRef(null)
  const fimDaLista = useRef(null)

  const cliente = obra ? clientePorId(obra.clienteId) : null

  /* quem participa da obra vem primeiro na lista de mencao; o resto da
     equipe continua disponivel, so mais abaixo */
  const mencionaveis = useMemo(() => {
    const daObra = new Set((obra?.membros ?? []).map(String))
    return [...equipe].sort((a, b) => {
      const pesoA = daObra.has(String(a.id)) ? 0 : 1
      const pesoB = daObra.has(String(b.id)) ? 0 : 1
      if (pesoA !== pesoB) return pesoA - pesoB
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR')
    })
  }, [equipe, obra?.membros])

  const buscar = useCallback(async () => {
    if (!obra) return
    setCarregando(true)
    try {
      setMensagens(await carregarChat(obra.id))
      setErro('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [obra, carregarChat])

  useEffect(() => {
    if (!aberto) {
      setCamera(false)
      return
    }
    setTexto('')
    setAnexo(null)
    setRespondendo(null)
    setMencoes([])
    setErro('')
    setBuscaMencao(null)
    buscar()
  }, [aberto, buscar])

  /* a conversa abre sempre no fim, na mensagem mais nova */
  useEffect(() => {
    if (!aberto) return
    fimDaLista.current?.scrollIntoView({ block: 'end' })
  }, [aberto, mensagens.length])

  /* ---------------- mencao com @ ---------------- */

  const aoDigitar = (evento) => {
    const valor = evento.target.value
    setTexto(valor)
    setErro('')

    /* olha so o pedaco entre o ultimo @ e o cursor: se tiver espaco no
       meio, a pessoa ja passou da mencao e a lista fecha */
    const ateOCursor = valor.slice(0, evento.target.selectionStart)
    const arroba = ateOCursor.lastIndexOf('@')
    if (arroba === -1) {
      setBuscaMencao(null)
      return
    }
    const trecho = ateOCursor.slice(arroba + 1)
    setBuscaMencao(/\s/.test(trecho) ? null : trecho.toLowerCase())
  }

  const sugestoes = useMemo(() => {
    if (buscaMencao === null) return []
    return mencionaveis
      .filter((p) => String(p.nome).toLowerCase().includes(buscaMencao))
      .slice(0, 6)
  }, [buscaMencao, mencionaveis])

  const escolherMencao = (pessoa) => {
    const cursor = campo.current?.selectionStart ?? texto.length
    const antes = texto.slice(0, cursor)
    const arroba = antes.lastIndexOf('@')
    const novo = `${texto.slice(0, arroba)}@${pessoa.nome} ${texto.slice(cursor)}`

    setTexto(novo)
    setMencoes((atual) =>
      atual.includes(String(pessoa.id)) ? atual : [...atual, String(pessoa.id)],
    )
    setBuscaMencao(null)
    campo.current?.focus()
  }

  /* ---------------- arquivo e foto ---------------- */

  const escolherArquivo = async (evento) => {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return

    try {
      /* imagem entra reduzida (o mesmo tratamento da foto de perfil);
         o resto vai como esta, dentro do limite */
      if (arquivo.type.startsWith('image/')) {
        const conteudo = await prepararImagem(arquivo)
        setAnexo({ nome: arquivo.name, tipo: arquivo.type, conteudo, tamanho: conteudo.length })
        return
      }
      if (arquivo.size > BYTES_MAXIMOS) {
        setErro(`"${arquivo.name}" tem ${tamanhoLegivel(arquivo.size)}. O limite é 4 MB.`)
        return
      }
      setAnexo({
        nome: arquivo.name,
        tipo: arquivo.type || 'application/octet-stream',
        conteudo: await lerArquivo(arquivo),
        tamanho: arquivo.size,
      })
      setErro('')
    } catch (e) {
      setErro(e.message)
    }
  }

  /* ---------------- enviar ---------------- */

  const enviar = async (evento) => {
    evento?.preventDefault()
    if (!texto.trim() && !anexo) return

    setEnviando(true)
    try {
      const nova = await enviarMensagem(obra.id, {
        texto: texto.trim(),
        respondeA: respondendo?.id ?? null,
        /* so vao as mencoes de quem continua citado no texto: apagar o
           "@Fulano" tem que tirar o Fulano da lista tambem */
        mencoes: mencoes.filter((id) => {
          const pessoa = pessoaPorId(id)
          return pessoa && texto.includes(`@${pessoa.nome}`)
        }),
        arquivo: anexo,
      })

      setMensagens((atual) => [...atual, nova])
      setTexto('')
      setAnexo(null)
      setRespondendo(null)
      setMencoes([])
      setErro('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Apagar uma mensagem: dois destinos, e a diferença importa.
   *
   *   'todos' — some da conversa de TODO MUNDO. A mensagem não
   *     desaparece: fica no lugar dela a marca "mensagem apagada". Sem
   *     essa marca, quem tivesse respondido aquela mensagem ficaria com
   *     uma resposta solta no meio da conversa, sem entender a quê. Só o
   *     autor pode (e a diretoria, para o caso de alguém deixar algo
   *     indevido ao sair da empresa).
   *
   *   'mim' — some só da MINHA tela; para os outros a conversa continua
   *     inteira. Vale para qualquer mensagem, minha ou não.
   *
   * O pop-up de escolha só aparece quando existem os dois caminhos. Na
   * mensagem de outra pessoa há um só ("apagar para mim"), e perguntar
   * ali seria oferecer uma escolha que não existe.
   */
  const [apagandoMsg, setApagandoMsg] = useState(null)

  const apagar = async (mensagem, escopo) => {
    setApagandoMsg(null)
    try {
      await apagarMensagem(obra.id, mensagem.id, escopo)
      setMensagens((atual) =>
        escopo === 'todos'
          ? atual.map((m) =>
              m.id === mensagem.id
                ? { ...m, apagada: true, texto: '', arquivo: null, editadaEm: null }
                : m,
            )
          : atual.filter((m) => m.id !== mensagem.id),
      )
    } catch (e) {
      setErro(e.message)
    }
  }

  const porId = (id) => mensagens.find((m) => m.id === id) ?? null

  if (!obra) return null

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Chat — ${tituloDaObra(obra, cliente)}`}
      subtitulo={
        somenteLeitura
          ? 'Obra concluída: a conversa fica para consulta e não recebe mais mensagens.'
          : 'A conversa fica gravada nesta obra. Cada obra tem a sua.'
      }
      largura={640}
    >
      <div className="chat">
        {/* ---------------- conversa ---------------- */}
        <div className="chat__lista">
          {carregando && <p className="chat__vazio">Carregando a conversa...</p>}

          {!carregando && mensagens.length === 0 && (
            <p className="chat__vazio">
              {somenteLeitura ? (
                'Esta obra foi concluída sem nenhuma mensagem no chat.'
              ) : (
                <>
                  Nenhuma mensagem ainda. Escreva a primeira aqui embaixo — dá para anexar
                  arquivo, tirar foto e mencionar alguém com <strong>@</strong>.
                </>
              )}
            </p>
          )}

          {mensagens.map((m) => {
            const meu = String(m.autorId) === String(user?.id)
            const autor = pessoaPorId(m.autorId)
            const citada = m.respondeA ? porId(m.respondeA) : null
            const citoAlguem = (m.mencoes ?? []).includes(String(user?.id))

            return (
              <article
                key={m.id}
                className={`fala ${meu ? 'is-minha' : ''} ${citoAlguem ? 'is-citado' : ''}`.trim()}
              >
                {!meu && <Avatar nome={m.autorNome} foto={autor?.foto} tamanho={30} titulo={m.autorNome} />}

                <div className={`fala__balao ${m.apagada ? 'is-apagada' : ''}`.trim()}>
                  {!meu && <p className="fala__quem">{m.autorNome}</p>}

                  {/* a mensagem respondida aparece citada em cima */}
                  {citada && (
                    <p className="fala__citada">
                      <strong>{citada.autorNome}</strong>
                      <span>
                        {citada.texto || citada.arquivo?.nome || 'mensagem'}
                      </span>
                    </p>
                  )}
                  {m.respondeA && !citada && (
                    <p className="fala__citada fala__citada--sumiu">mensagem apagada</p>
                  )}

                  {m.arquivo && <Anexo arquivo={m.arquivo} />}

                  {/* apagada para todos: o conteúdo já veio vazio do
                      servidor, e o que fica no lugar é o rastro */}
                  {m.apagada ? (
                    <p className="fala__apagada">
                      <Icone.lixo />
                      mensagem apagada
                    </p>
                  ) : (
                    m.texto && (
                      <p className="fala__texto">
                        <ComMencoes texto={m.texto} equipe={mencionaveis} />
                      </p>
                    )
                  )}

                  {/* na obra fechada sobra só a hora: responder e apagar
                      escreveriam no registro de uma obra encerrada */}
                  <p className="fala__pe">
                    <span>{dataHora(m.enviadaEm)}</span>
                    {!somenteLeitura && !m.apagada && (
                      <button
                        type="button"
                        onClick={() => {
                          setRespondendo(m)
                          campo.current?.focus()
                        }}
                        title="Responder esta mensagem"
                        aria-label={`Responder ${m.autorNome}`}
                      >
                        <Icone.responder />
                      </button>
                    )}
                    {/* o lixo vale para QUALQUER mensagem: a de outra
                        pessoa também some da minha tela quando eu peço.
                        O que muda é o que o pop-up oferece. */}
                    {!somenteLeitura && (
                      <button
                        type="button"
                        onClick={() => setApagandoMsg(m)}
                        title="Apagar"
                        aria-label="Apagar mensagem"
                      >
                        <Icone.lixo />
                      </button>
                    )}
                  </p>
                </div>
              </article>
            )
          })}

          <span ref={fimDaLista} />
        </div>

        {/* ---------------- apagar mensagem ---------------- */}
        {apagandoMsg && (
          <div
            className="chat__apagar"
            role="dialog"
            aria-label="Apagar mensagem"
            onClick={(e) => {
              if (e.target === e.currentTarget) setApagandoMsg(null)
            }}
          >
            <div className="chat__apagarcaixa">
              <p className="chat__apagartitulo">Apagar mensagem</p>

              {/* "para todos" só existe na própria mensagem: apagar da
                  conversa a fala de outra pessoa é reescrever o que foi
                  dito na obra */}
              {String(apagandoMsg.autorId) === String(user?.id) && !apagandoMsg.apagada && (
                <button
                  type="button"
                  className="chat__apagaropcao chat__apagaropcao--forte"
                  onClick={() => apagar(apagandoMsg, 'todos')}
                >
                  <strong>Apagar para todos</strong>
                  <span>Some da conversa de todo mundo e fica a marca "mensagem apagada".</span>
                </button>
              )}

              <button
                type="button"
                className="chat__apagaropcao"
                onClick={() => apagar(apagandoMsg, 'mim')}
              >
                <strong>Apagar para mim</strong>
                <span>Some só da sua tela. Os outros continuam vendo a conversa inteira.</span>
              </button>

              <button
                type="button"
                className="chat__apagarcancelar"
                onClick={() => setApagandoMsg(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ---------------- camera ---------------- */}
        {!somenteLeitura && camera && (
          <Camera
            aoFechar={() => setCamera(false)}
            aoTirar={(foto) => {
              setAnexo(foto)
              setCamera(false)
            }}
            aoFalhar={(motivo) => {
              setCamera(false)
              setErro(motivo)
              // sem getUserMedia, cai no input com capture: no celular
              // ele abre a camera direto
              entradaCamera.current?.click()
            }}
          />
        )}

        {/* ---------------- escrever ----------------
            Obra concluída não tem caixa de escrever: no lugar dela fica
            o aviso de por quê. Esconder o formulário e deixar o resto
            igual é o que faz a tela dizer "aqui acabou" sem precisar de
            um cadeado em cada botão. */}
        {somenteLeitura ? (
          <p className="chat__encerrado" role="status">
            Esta obra foi concluída — a conversa continua aqui para consulta, mas não é
            mais possível enviar mensagens.
          </p>
        ) : (
        <form className="chat__escrever" onSubmit={enviar}>
          {respondendo && (
            <p className="chat__respondendo">
              <Icone.responder />
              <span>
                Respondendo <strong>{respondendo.autorNome}</strong>:{' '}
                {respondendo.texto || respondendo.arquivo?.nome || 'mensagem'}
              </span>
              <button type="button" onClick={() => setRespondendo(null)} aria-label="Cancelar resposta">
                <Icone.fechar />
              </button>
            </p>
          )}

          {anexo && (
            <p className="chat__anexo">
              {anexo.tipo?.startsWith('image/') ? (
                <img src={anexo.conteudo} alt="" />
              ) : (
                <Icone.clipe />
              )}
              <span>
                {anexo.nome}
                <em>{tamanhoLegivel(anexo.tamanho)}</em>
              </span>
              <button type="button" onClick={() => setAnexo(null)} aria-label="Tirar o anexo">
                <Icone.fechar />
              </button>
            </p>
          )}

          {erro && (
            <p className="chat__erro" role="alert">
              {erro}
            </p>
          )}

          {/* a lista de @ abre por cima da caixa de texto */}
          {sugestoes.length > 0 && (
            <ul className="chat__mencoes" role="listbox">
              {sugestoes.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => escolherMencao(p)}>
                    <Avatar nome={p.nome} foto={p.foto} tamanho={22} />
                    <strong>{p.nome}</strong>
                    <em>{p.cargoNome ?? ''}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="chat__linha">
            <textarea
              ref={campo}
              className="chat__campo"
              rows={2}
              placeholder="Escreva a mensagem... use @ para mencionar alguém"
              value={texto}
              onChange={aoDigitar}
              onKeyDown={(e) => {
                /* Enter manda, Shift+Enter pula linha — como em qualquer chat */
                if (e.key === 'Enter' && !e.shiftKey && sugestoes.length === 0) {
                  e.preventDefault()
                  enviar()
                }
                if (e.key === 'Escape' && buscaMencao !== null) setBuscaMencao(null)
              }}
            />

            <span className="chat__ferramentas">
              <button
                type="button"
                onClick={() => entradaArquivo.current?.click()}
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
              >
                <Icone.clipe />
              </button>
              <button
                type="button"
                onClick={() => setCamera(true)}
                title="Tirar foto"
                aria-label="Tirar foto"
              >
                <Icone.camera />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTexto((t) => `${t}@`)
                  setBuscaMencao('')
                  campo.current?.focus()
                }}
                title="Mencionar alguém"
                aria-label="Mencionar alguém"
              >
                <Icone.arroba />
              </button>
              <button
                type="submit"
                className="chat__enviar"
                disabled={enviando || (!texto.trim() && !anexo)}
                title="Enviar"
                aria-label="Enviar mensagem"
              >
                <Icone.enviar />
              </button>
            </span>
          </div>

          {/* anexar: qualquer arquivo, sem forcar a camera */}
          <input
            ref={entradaArquivo}
            type="file"
            className="sr-only"
            onChange={escolherArquivo}
            tabIndex={-1}
          />
          {/* reserva da camera, quando o navegador nao abre a de verdade */}
          <input
            ref={entradaCamera}
            type="file"
            className="sr-only"
            accept="image/*"
            capture="environment"
            onChange={escolherArquivo}
            tabIndex={-1}
          />
        </form>
        )}
      </div>
    </Modal>
  )
}

/** O anexo de uma mensagem: imagem aparece; o resto vira link. */
function Anexo({ arquivo }) {
  if (arquivo.tipo?.startsWith('image/')) {
    return (
      <a className="fala__imagem" href={arquivo.conteudo} target="_blank" rel="noreferrer">
        <img src={arquivo.conteudo} alt={arquivo.nome} />
      </a>
    )
  }
  return (
    <a className="fala__arquivo" href={arquivo.conteudo} download={arquivo.nome}>
      <Icone.clipe />
      {arquivo.nome}
    </a>
  )
}

/** Pinta os "@Nome" que batem com alguem da equipe. */
function ComMencoes({ texto, equipe }) {
  const nomes = equipe.map((p) => p.nome).filter(Boolean)
  if (nomes.length === 0) return texto

  /* a expressao e montada com os nomes de verdade, do mais longo para o
     mais curto: assim "@Ana Paula" ganha de "@Ana" */
  const escapado = nomes
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const pedacos = texto.split(new RegExp(`(@(?:${escapado}))`, 'g'))

  return pedacos.map((pedaco, i) =>
    pedaco.startsWith('@') && nomes.includes(pedaco.slice(1)) ? (
      // eslint-disable-next-line react/no-array-index-key
      <mark key={i} className="fala__mencao">
        {pedaco}
      </mark>
    ) : (
      pedaco
    ),
  )
}

/**
 * A camera, ligada na hora.
 *
 * Pede a camera do aparelho, mostra o que ela ve e congela um quadro no
 * clique. Se o navegador nao der (sem permissao, sem camera, pagina
 * fora de HTTPS), avisa quem chamou — que ai abre o seletor de arquivos
 * com `capture`, o caminho que funciona no celular.
 */
function Camera({ aoTirar, aoFechar, aoFalhar }) {
  const video = useRef(null)
  const fluxo = useRef(null)
  const [pronta, setPronta] = useState(false)

  /* aoFalhar chega como funcao nova a cada render do pai. Guardada na
     ref, ela nao entra nas dependencias do efeito — se entrasse, a
     camera seria religada a cada render e ficaria piscando. */
  const falhou = useRef(aoFalhar)
  useEffect(() => {
    falhou.current = aoFalhar
  }, [aoFalhar])

  useEffect(() => {
    let vivo = true

    const ligar = async () => {
      try {
        const midia = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (!vivo) {
          midia.getTracks().forEach((t) => t.stop())
          return
        }
        fluxo.current = midia
        if (video.current) {
          video.current.srcObject = midia
          await video.current.play().catch(() => {})
        }
        setPronta(true)
      } catch {
        if (vivo) falhou.current('Não foi possível abrir a câmera. Escolha a foto pelo arquivo.')
      }
    }

    if (navigator.mediaDevices?.getUserMedia) ligar()
    else falhou.current('Este navegador não abre a câmera. Escolha a foto pelo arquivo.')

    /* desligar a camera ao fechar nao e opcional: senao a luzinha do
       aparelho fica acesa depois que o pop-up sai da tela */
    return () => {
      vivo = false
      fluxo.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capturar = () => {
    const v = video.current
    if (!v) return

    const tela = document.createElement('canvas')
    tela.width = v.videoWidth
    tela.height = v.videoHeight
    tela.getContext('2d').drawImage(v, 0, 0)

    const conteudo = tela.toDataURL('image/jpeg', 0.82)
    aoTirar({
      nome: `foto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`,
      tipo: 'image/jpeg',
      conteudo,
      tamanho: conteudo.length,
    })
  }

  return (
    <div className="camera">
      <video ref={video} playsInline muted />
      <div className="camera__acoes">
        <button type="button" className="camera__tirar" onClick={capturar} disabled={!pronta}>
          Tirar foto
        </button>
        <button type="button" className="camera__cancelar" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
