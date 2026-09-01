import outlookLogo from '@/assets/outlook.png'
import './SocialRow.css'

/**
 * A outra porta de entrada: a conta Microsoft da empresa.
 *
 * A logo nao entra como imagem colorida nem em cinza — ela e usada
 * como RECORTE, e a cor que aparece por dentro dele e a mesma do botao
 * Entrar (--btn-bg). Assim as duas formas de entrar falam a mesma cor.
 */
export default function SocialRow({ onSelect, ocupado = false, rotulo = 'Entrar com Outlook' }) {
  return (
    <div className="social">
      <div className="social__divider">
        <span>ou entre com</span>
      </div>
      <div className="social__list">
        <button
          type="button"
          className="social__btn"
          aria-label={rotulo}
          title={rotulo}
          disabled={ocupado}
          onClick={() => onSelect?.('outlook')}
        >
          {/* a URL vem do bundler (com hash); o CSS a usa como mascara */}
          <span
            className="social__logo"
            style={{ '--logo': `url(${outlookLogo})` }}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  )
}
