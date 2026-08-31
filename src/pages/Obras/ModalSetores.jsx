import Modal from '@/components/Modal/Modal'
import { useDados } from '@/context/DadosContext'
import { ETAPAS, etapaAtual, setoresPendentes } from '@/domain/obras'
import './ModalSetores.css'

/**
 * O que cada cargo esta devendo. Abre pelo botao "+N" da linha de
 * setores, quando ha mais cargos do que cabem no filtro.
 *
 * `obras` sao as que estao em exibicao no quadro — a conta e sobre elas,
 * nao sobre o sistema inteiro.
 */
export default function ModalSetores({ aberto, aoFechar, obras = [], aoFiltrar, selecionados = [] }) {
  const { cargos, clientePorId } = useDados()

  /* para cada cargo, as obras em que ele ainda deve algo na etapa atual */
  const pendencias = cargos.map((cargo) => {
    const devendo = obras
      .filter((o) => setoresPendentes(o, etapaAtual(o)).includes(cargo.chave))
      .map((o) => ({
        obra: o,
        cliente: clientePorId(o.clienteId),
        etapa: etapaAtual(o),
      }))
    return { cargo, devendo }
  })

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Setores pendentes"
      subtitulo="O que cada cargo ainda deve nas obras em exibição."
      largura={600}
    >
      <div className="setores">
        {pendencias.map(({ cargo, devendo }) => {
          const ativo = selecionados.includes(cargo.chave)
          return (
            <article key={cargo.id} className={`setores__cargo ${ativo ? 'is-ativo' : ''}`.trim()}>
              <header className="setores__topo">
                <span
                  className="setores__bolha"
                  style={{ background: cargo.cor }}
                  aria-hidden="true"
                />
                <span className="setores__quem">
                  <strong>{cargo.nome}</strong>
                  <span>
                    {cargo.acessoTotal
                      ? 'edita todos os setores'
                      : `sigla ${cargo.curto}`}
                  </span>
                </span>

                <span
                  className={`setores__contagem ${devendo.length > 0 ? 'is-devendo' : ''}`.trim()}
                >
                  {devendo.length > 0
                    ? `${devendo.length} pendente${devendo.length === 1 ? '' : 's'}`
                    : 'em dia'}
                </span>

                {aoFiltrar && (
                  <button
                    type="button"
                    className="setores__filtrar"
                    onClick={() => {
                      aoFiltrar(cargo.chave)
                      aoFechar()
                    }}
                  >
                    {ativo ? 'Tirar do filtro' : 'Filtrar'}
                  </button>
                )}
              </header>

              {devendo.length > 0 && (
                <ul className="setores__obras">
                  {devendo.map(({ obra, cliente, etapa }) => (
                    <li key={obra.id}>
                      <span className="setores__tipo" data-tipo={obra.tipo} aria-hidden="true" />
                      <span className="setores__obra">
                        {cliente?.nome ?? 'Cliente removido'}
                        <em>{obra.descricao}</em>
                      </span>
                      <span className="setores__etapa">
                        {etapa}ª — {ETAPAS.find((e) => e.numero === etapa)?.nome.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </Modal>
  )
}
