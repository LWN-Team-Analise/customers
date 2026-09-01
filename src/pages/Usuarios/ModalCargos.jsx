import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import { useDados } from '@/context/DadosContext'
import ModalCargo from './ModalCargo'
import './ModalCargos.css'

const Mais = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

/**
 * Lista dos cargos, em linha unica que quebra quando chega no fim do
 * pop-up:  ADM | GQ | EXCELENCIA ...
 *
 * Clicar em um deles ja abre a edicao, em OUTRO pop-up por cima deste —
 * antes o formulario ficava embaixo da lista e os dois disputavam a
 * mesma tela.
 */
export default function ModalCargos({ aberto, aoFechar }) {
  const { cargos, equipe } = useDados()

  /* null = fechado | { cargo } = editando | { novo: true } = criando */
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    if (!aberto) setEditando(null)
  }, [aberto])

  const quantos = (chave) => equipe.filter((p) => p.cargo === chave).length

  return (
    <>
      <Modal
        aberto={aberto}
        aoFechar={aoFechar}
        titulo="Cargos"
        subtitulo="Clique em um cargo para editar. A cor dele pinta as etiquetas do card e os blocos das etapas."
        largura={560}
      >
        <div className="cargos">
          <ul className="cargos__linha">
            {cargos.map((cargo) => (
              <li key={cargo.id}>
                <button
                  type="button"
                  className="cargos__etiqueta"
                  style={{ '--cargo-cor': cargo.cor }}
                  onClick={() => setEditando({ cargo })}
                  title={`Editar ${cargo.nome}`}
                >
                  {cargo.nome}
                  <span className="cargos__quantos">{quantos(cargo.chave)}</span>
                </button>
              </li>
            ))}

            <li>
              <button
                type="button"
                className="cargos__novo"
                onClick={() => setEditando({ novo: true })}
              >
                <Mais />
                Novo cargo
              </button>
            </li>
          </ul>

          <p className="cargos__legenda">
            O número ao lado é quantas pessoas estão nesse cargo. Os cargos usados pelas etapas
            da obra podem mudar de nome e de cor, mas não podem ser apagados.
          </p>
        </div>
      </Modal>

      {/* por cima da lista: nivel={1} */}
      <ModalCargo
        aberto={Boolean(editando)}
        cargo={editando?.cargo ?? null}
        aoFechar={() => setEditando(null)}
      />
    </>
  )
}
