import { useId, useRef } from 'react'
import Avatar from '@/components/Avatar/Avatar'
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

export function CampoArea({ rotulo, dica, erro, largo, linhas = 3, ...rest }) {
  const id = useId()
  return (
    <Moldura id={id} rotulo={rotulo} dica={dica} erro={erro} largo={largo}>
      <textarea id={id} className="campo__controle campo__area" rows={linhas} {...rest} />
    </Moldura>
  )
}

/** opcoes: lista de { valor, rotulo } */
export function CampoSelecao({
  rotulo,
  dica,
  erro,
  largo,
  opcoes = [],
  vazio = 'Selecione...',
  ...rest
}) {
  const id = useId()
  return (
    <Moldura id={id} rotulo={rotulo} dica={dica} erro={erro} largo={largo}>
      <div className="campo__envelope">
        <select
          id={id}
          className="campo__controle campo__select"
          aria-invalid={Boolean(erro)}
          {...rest}
        >
          <option value="">{vazio}</option>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <svg
          className="campo__seta"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
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

  const escolher = (evento) => {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => aoMudar(String(leitor.result))
    leitor.readAsDataURL(arquivo)
  }

  return (
    <Moldura rotulo={rotulo} dica={dica}>
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
