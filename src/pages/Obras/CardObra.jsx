import Avatar, { PilhaAvatares } from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { ETAPAS, etapaAtual, setoresPendentes } from '@/domain/obras'
import { dataBR } from '@/utils/formato'
import './CardObra.css'

const ROTULO_PRIORIDADE = { alta: 'alta', media: 'média', baixa: 'baixa' }

/**
 * Card da obra no quadro. A cor de fundo vem do tipo (padrao = azul de
 * "Obras padrao", emergencia = laranja/vermelho, aviso = amarelo); as
 * etiquetas de setor puxam a cor do cargo cadastrado.
 *
 *   foto da empresa · nome · etapa atual        [téc] [gq]
 *   descricao
 *   prioridade + data prevista            fotos de quem mexeu
 *
 * Com `aoAbrir` o card inteiro vira botao — e assim que a coluna de
 * avisos dispara o aviso clicando em qualquer lugar.
 */
export default function CardObra({ obra, cliente, pessoas = [], tom, aoAbrir, rotuloAcao, children }) {
  const { cargoPorChave } = useDados()
  const numeroEtapa = etapaAtual(obra)
  const etapa = ETAPAS.find((e) => e.numero === numeroEtapa)
  const pendentes = setoresPendentes(obra, numeroEtapa)
  const cor = tom ?? obra.tipo

  const Elemento = aoAbrir ? 'button' : 'div'

  return (
    <Elemento
      type={aoAbrir ? 'button' : undefined}
      className={`obracard ${aoAbrir ? 'obracard--clicavel' : ''}`.trim()}
      data-tom={cor}
      onClick={aoAbrir}
      title={rotuloAcao}
    >
      <header className="obracard__topo">
        <Avatar nome={cliente?.nome} foto={cliente?.logo} tamanho={26} quadrado />
        <span className="obracard__quem">
          <strong className="obracard__empresa">{cliente?.nome ?? 'Cliente removido'}</strong>
          <span className="obracard__etapa">
            Etapa atual: {etapa ? `${etapa.numero}ª — ${etapa.nome.toLowerCase()}` : 'concluída'}
          </span>
        </span>

        {pendentes.length > 0 && (
          <span className="obracard__setores" title="Setores que ainda devem informação">
            {pendentes.map((s) => {
              const cargo = cargoPorChave(s)
              return (
                <span
                  key={s}
                  className="obracard__setor"
                  style={{ '--setor-cor': cargo?.cor ?? '#6b7280' }}
                >
                  {cargo?.curto ?? s.slice(0, 3)}
                </span>
              )
            })}
          </span>
        )}
      </header>

      <p className="obracard__desc">{obra.descricao}</p>

      <footer className="obracard__base">
        <span className="obracard__meta">
          <span className="obracard__pri">prioridade: {ROTULO_PRIORIDADE[obra.prioridade]}</span>
          {obra.dataPrevista && (
            <span className="obracard__data">data prev: {dataBR(obra.dataPrevista)}</span>
          )}
        </span>
        {pessoas.length > 0 && <PilhaAvatares pessoas={pessoas} tamanho={24} limite={3} />}
      </footer>

      {children}
    </Elemento>
  )
}
