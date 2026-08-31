import Modal from '@/components/Modal/Modal'
import './Confirma.css'

/**
 * Confirmacao de acao destrutiva, no lugar do window.confirm — que em
 * alguns navegadores nem chega a aparecer.
 *
 * `aviso` e para o recado extra (ex.: "isso apaga tambem as 2 obras").
 */
export default function Confirma({
  aberto,
  titulo,
  mensagem,
  aviso,
  rotuloConfirmar = 'Apagar',
  aoConfirmar,
  aoFechar,
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} largura={420}>
      <div className="confirma">
        <p className="confirma__texto">{mensagem}</p>

        {aviso && <p className="confirma__aviso">{aviso}</p>}

        <footer className="confirma__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="confirma__apagar"
            onClick={() => {
              aoConfirmar()
              aoFechar()
            }}
          >
            {rotuloConfirmar}
          </button>
        </footer>
      </div>
    </Modal>
  )
}
