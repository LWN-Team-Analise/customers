import Modal from '@/components/Modal/Modal'
import './Confirma.css'

/**
 * A confirmacao do sistema, no lugar do window.confirm — que em alguns
 * navegadores nem chega a aparecer.
 *
 * Serve para dois casos:
 *
 *   DESTRUTIVO (padrao) — apagar. O botao sai vermelho.
 *   `tom="acao"`        — criar, sair, gravar. O botao sai na cor do
 *                         sistema, porque pintar de vermelho um "Criar
 *                         obra" faz a pessoa hesitar sem motivo.
 *
 * `aviso` e o recado extra que pesa na decisao ("isso apaga tambem as 2
 * obras"); `detalhes` e a conferencia do que vai ser feito — e onde o
 * cadastro de colaborador mostra o que o cargo escolhido libera.
 *
 * `nivel` sobe a confirmacao acima de um pop-up que ja esteja aberto:
 * sem ele, confirmar de dentro de um formulario abriria a caixa ATRAS
 * dele.
 */
export default function Confirma({
  aberto,
  titulo,
  mensagem,
  aviso,
  detalhes,
  tom = 'perigo',
  nivel = 0,
  rotuloConfirmar = 'Apagar',
  aoConfirmar,
  aoFechar,
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} largura={430} nivel={nivel}>
      <div className="confirma">
        <p className="confirma__texto">{mensagem}</p>

        {detalhes && <div className="confirma__detalhes">{detalhes}</div>}

        {aviso && <p className="confirma__aviso">{aviso}</p>}

        <footer className="confirma__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`confirma__ok confirma__ok--${tom}`}
            onClick={async () => {
              /* a exclusao grava no banco e pode falhar; o motivo aparece
                 na faixa do AppShell, entao aqui so nao deixamos a
                 promessa estourar sem ninguem pegar */
              try {
                await aoConfirmar()
              } catch {
                /* ja mostrado ao usuario */
              }
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
