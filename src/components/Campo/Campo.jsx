import { useId, useRef, useState } from 'react'
import Avatar from '@/components/Avatar/Avatar'
import Seletor from '@/components/Seletor/Seletor'
import useAlturaAuto from '@/hooks/useAlturaAuto'
import { prepararImagem } from '@/utils/imagem'
import './Campo.css'

/** Moldura comum: rotulo em cima, controle embaixo, erro por ultimo. */
function Moldura({ id, rotulo, dica, erro, children, largo }) {
  return (
    <div className={`campo ${largo ? 'campo--largo' : ''} ${erro ? 'has-erro' : ''}`.trim()}>
      {rotulo && (
        <label className="campo__rotulo" htmlFor={id}>
          {rotulo}
        </label>
      )}
      {children}
      {(erro || dica) && (
        <span
          className={`campo__nota ${erro ? 'campo__nota--erro' : ''}`.trim()}
          role={erro ? 'alert' : undefined}
        >
          {erro || dica}
        </span>
      )}
    </div>
  )
}

export function CampoTexto({ rotulo, dica, erro, largo, ...rest }) {
  const id = useId()
  return (
    <Moldura id={id} rotulo={rotulo} dica={dica} erro={erro} largo={largo}>
      <input id={id} className="campo__controle" aria-invalid={Boolean(erro)} {...rest} />
    </Moldura>
  )
}

/**
 * A caixa cresce e encolhe sozinha conforme o texto quebra linha — a
 * alcinha do canto inferior direito saiu (ver `useAlturaAuto`).
 *
 * `linhas` continua sendo a altura MINIMA: e o tamanho com que a caixa
 * abre e ate onde ela volta ao ser esvaziada.
 */
export function CampoArea({ rotulo, dica, erro, largo, linhas = 3, ...rest }) {
  const id = useId()
  const campo = useAlturaAuto(rest.value)

  return (
    <Moldura id={id} rotulo={rotulo} dica={dica} erro={erro} largo={largo}>
      <textarea
        ref={campo}
        id={id}
        className="campo__controle campo__area"
        rows={linhas}
        {...rest}
      />
    </Moldura>
  )
}

/**
 * Escolha de um item. opcoes: lista de { valor, rotulo, cor? }
 *
 * Por dentro e o <Seletor>, nao o <select> do navegador — a lista aberta
 * do nativo nao aceita estilo e saia quadrada, com a fonte do sistema.
 * Quem chama continua recebendo `onChange` com evento, entao os
 * formularios antigos nao precisaram mudar.
 */
export function CampoSelecao({
  rotulo,
  dica,
  erro,
  largo,
  opcoes = [],
  vazio = 'Selecione...',
  value,
  onChange,
  disabled,
  'aria-label': rotuloAria,
}) {
  const id = useId()
  return (
    <Moldura id={id} rotulo={rotulo} dica={dica} erro={erro} largo={largo}>
      <Seletor
        id={id}
        largo
        valor={value}
        aoMudar={(novo) => onChange?.({ target: { value: novo } })}
        opcoes={opcoes}
        vazio={vazio}
        desabilitado={disabled}
        aria-label={rotuloAria ?? rotulo}
      />
    </Moldura>
  )
}

/** Escolha em pastilhas — usado nas prioridades e nos setores. */
export function CampoPastilhas({ rotulo, dica, erro, valor, aoMudar, opcoes = [], largo }) {
  return (
    <Moldura rotulo={rotulo} dica={dica} erro={erro} largo={largo}>
      <div className="pastilhas" role="radiogroup" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            className={`pastilha ${valor === o.valor ? 'is-atual' : ''}`.trim()}
            data-tom={o.tom ?? o.valor}
            onClick={() => aoMudar(o.valor)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </Moldura>
  )
}

/**
 * Foto/logo: abre o seletor de arquivos e guarda a imagem como data URL,
 * que e o formato que o store sabe persistir hoje.
 */
export function CampoFoto({ rotulo, nome, valor, aoMudar, dica }) {
  const entrada = useRef(null)
  const [erro, setErro] = useState('')

  const escolher = async (evento) => {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    try {
      aoMudar(await prepararImagem(arquivo))
      setErro('')
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <Moldura rotulo={rotulo} dica={dica} erro={erro}>
      <div className="foto">
        <Avatar nome={nome || '?'} foto={valor} tamanho={62} quadrado titulo={nome} />
        <div className="foto__acoes">
          <button type="button" className="foto__btn" onClick={() => entrada.current?.click()}>
            {valor ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          {valor && (
            <button
              type="button"
              className="foto__btn foto__btn--fraco"
              onClick={() => aoMudar(null)}
            >
              Remover
            </button>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={escolher}
          tabIndex={-1}
        />
      </div>
    </Moldura>
  )
}
