import Modal from '@/components/Modal/Modal'
import { useDados } from '@/context/DadosContext'
import './ModalFechaEtapa.css'

/**
 * O recado de quando a SUA parte de uma etapa fecha.
 *
 * Nao confundir com `ModalEtapa`, que e o formulario de criar e
 * renomear etapa do roteiro. Este aqui nao edita nada: ele so conta o
 * que acabou de acontecer.
 *
 * Ele aparece uma vez so, no check que fecha o ultimo pendente do seu
 * setor naquela etapa (quem decide isso e `avisoDeEtapa`, no dominio).
 * Sao dois recados diferentes, e a diferenca entre eles e a unica
 * razao de a caixa existir:
 *
 *   A etapa INTEIRA fechou — a obra anda sozinha para a proxima, e o
 *   recado e a confirmacao disso.
 *
 *   So a SUA parte fechou — a obra NAO anda ainda, e a caixa diz de
 *   quem ela esta esperando. Sem esse aviso, quem marcou o ultimo
 *   check do seu setor sai da tela achando que entregou a etapa, e a
 *   obra fica parada sem ninguem saber em quem cobrar.
 *
 * Nao ha "cancelar": nada aqui e uma decisao. O check ja foi gravado
 * quando a caixa abriu — ela conta o que aconteceu, nao pergunta.
 */
export default function ModalFechaEtapa({ aviso, aoFechar }) {
  const { nomeDoCargo, corDoCargo, rotuloEtapa, termoEtapa } = useDados()

  if (!aviso) return null

  const nomeDaEtapa = aviso.nome
    ? `${rotuloEtapa(aviso.numero)} — ${aviso.nome}`
    : rotuloEtapa(aviso.numero)

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={aviso.fechou ? `${termoEtapa} concluída` : 'Sua parte está concluída'}
      largura={440}
      /* acima de qualquer pop-up que ja esteja aberto: dentro da obra
         este aviso nasce de um clique feito DENTRO do trilho */
      nivel={2}
    >
      <div className="metapa">
        <p className="metapa__etapa" data-tom={aviso.fechou ? 'ok' : 'espera'}>
          {nomeDaEtapa}
        </p>

        {aviso.fechou ? (
          <p className="metapa__texto">
            {aviso.ultima
              ? 'Era a última etapa do roteiro. Todos os checks da obra foram marcados — ela já pode ser concluída na tela da obra.'
              : `Nenhum setor tem check em aberto nesta ${termoEtapa.toLowerCase()}. A obra segue para a seguinte.`}
          </p>
        ) : (
          <>
            <p className="metapa__texto">
              Você marcou o último check do seu setor. Para a obra avançar para a{' '}
              {rotuloEtapa(aviso.numero + 1).toLowerCase()}, ainda é preciso esperar:
            </p>

            <ul className="metapa__setores">
              {aviso.pendentes.map((c) => (
                <li key={c} style={{ '--setor-cor': corDoCargo(c) }}>
                  {nomeDoCargo(c)}
                </li>
              ))}
            </ul>
          </>
        )}

        <footer className="metapa__acoes">
          <button type="button" className="metapa__ok" onClick={aoFechar}>
            Entendi
          </button>
        </footer>
      </div>
    </Modal>
  )
}
