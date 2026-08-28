import outlookLogo from '@/assets/outlook.png'
import './SocialRow.css'

export default function SocialRow({ onSelect }) {
  return (
    <div className="social">
      <div className="social__divider">
        <span>ou entre com</span>
      </div>
      <div className="social__list">
        <button
          type="button"
          className="social__btn"
          aria-label="Entrar com Outlook"
          onClick={() => onSelect?.('outlook')}
        >
          {/* importada pelo bundler: caminho resolvido no build, com hash */}
          <img className="social__logo" src={outlookLogo} alt="" />
        </button>
      </div>
    </div>
  )
}
