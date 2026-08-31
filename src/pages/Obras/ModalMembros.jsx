import Modal from '@/components/Modal/Modal'
import Avatar from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { ETAPAS, etapaAtual, setorConcluido } from '@/domain/obras'
import './ModalMembros.css'

/**
 * Quem esta em quais obras. Abre ao clicar na fila de avatares do
 * cabecalho do quadro: por pessoa, as obras em que ela entrou, a etapa
 * de cada uma e se o setor dela ja fechou aquela etapa.
 */
export default function ModalMembros({ aberto, aoFechar, pessoas = [] }) {
  const { obrasDaPessoa, cargoPorChave } = useDados()

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Membros nas obras"
      subtitulo="Quem está participando e em que etapa cada obra parou."
      largura={620}
    >
      <div className="membros">
        {pessoas.length === 0 && (
          <p className="membros__vazio">Ninguém marcou tarefa nas obras em exibição.</p>
        )}

        {pessoas.map((pessoa) => {
          const cargo = cargoPorChave(pessoa.cargo)
          const participacoes = obrasDaPessoa(pessoa.id)

          return (
            <article key={pessoa.id} className="membros__pessoa">
              <header className="membros__topo">
                <Avatar nome={pessoa.nome} foto={pessoa.foto} tamanho={38} titulo={pessoa.nome} />
                <div className="membros__quem">
                  <strong>{pessoa.nome}</strong>
                  <span
                    className="membros__cargo"
                    style={{ '--cargo-cor': cargo?.cor ?? '#6b7280' }}
                  >
                    {cargo?.nome ?? pessoa.cargoNome ?? 'Sem cargo'}
                  </span>
                </div>
                <span className="membros__contagem">
                  {participacoes.length} obra{participacoes.length === 1 ? '' : 's'}
                </span>
              </header>

              {participacoes.length === 0 ? (
                <p className="membros__semobra">Sem obra em andamento no momento.</p>
              ) : (
                <ul className="membros__obras">
                  {participacoes.map(({ obra, cliente }) => {
                    const numero = etapaAtual(obra)
                    const modelo = ETAPAS.find((e) => e.numero === numero)
                    const etapaObra = obra.etapas.find((e) => e.numero === numero)
                    // o setor dele ja fechou esta etapa?
                    const meuSetor = etapaObra?.setores?.[pessoa.cargo]
                    const fechou = meuSetor ? setorConcluido(etapaObra, pessoa.cargo) : null

                    return (
                      <li key={obra.id} className="membros__obra">
                        <span className="membros__tipo" data-tipo={obra.tipo} aria-hidden="true" />
                        <span className="membros__nomeobra">
                          {cliente?.nome ?? 'Cliente removido'}
                          <em>{obra.descricao}</em>
                        </span>
                        <span className="membros__etapa">
                          {numero}ª — {modelo?.nome.toLowerCase()}
                        </span>
                        {fechou !== null && (
                          <span
                            className={`membros__estado ${fechou ? 'is-ok' : 'is-devendo'}`.trim()}
                          >
                            {fechou ? 'em dia' : 'pendente'}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </Modal>
  )
}
