import Avatar, { PilhaAvatares } from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import { rotuloDaPrioridade, tituloDaObra } from '@/domain/obras'
import { useTheme } from '@/context/ThemeContext'
import { textoSobre } from '@/utils/cor'
import { dataBR } from '@/utils/formato'
import './CardObra.css'

/**
 * Card da obra no quadro. A cor de fundo vem do tipo (padrao = azul de
 * "Obras padrao", emergencia = laranja/vermelho, aviso = amarelo); as
 * etiquetas de setor puxam a cor do cargo cadastrado.
 *
 *   foto da empresa · proposta - nome · etapa atual   [téc] [gq]
 *   descricao
 *   prioridade + data de conclusao        fotos de quem mexeu
 *
 * O titulo e "1042/2026 - Acme": o n. da proposta na frente, porque e
 * por ele que a obra e procurada. Obra antiga, sem proposta cadastrada,
 * mostra so o nome do cliente.
 *
 * Com `aoAbrir` o card inteiro vira botao — e assim que a coluna de
 * avisos dispara o aviso clicando em qualquer lugar.
 */
export default function CardObra({ obra, cliente, pessoas = [], tom, aoAbrir, rotuloAcao, children }) {
  const {
    cargoPorChave,
    roteiroDaObra,
    etapaDaObra,
    pendentesDaObra,
    concluida,
    etiquetasDaObra,
    termoEtapa,
  } = useDados()
  const { isDark } = useTheme()

  const numeroEtapa = etapaDaObra(obra)
  /* o roteiro desta obra, nao o de agora: obra antiga desenha a etapa
     que ela realmente tem */
  const etapa = roteiroDaObra(obra).find((e) => e.numero === numeroEtapa)
  const marcas = etiquetasDaObra(obra)
  const pendentes = pendentesDaObra(obra, numeroEtapa)
  const fechada = concluida(obra)
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
          <strong className="obracard__empresa">{tituloDaObra(obra, cliente)}</strong>
          <span className="obracard__etapa">
            {termoEtapa} atual:{' '}
            {fechada || !etapa ? 'concluída' : `${etapa.numero}ª — ${etapa.nome.toLowerCase()}`}
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

      {/* a descricao e opcional: sem ela o card nao abre um vazio no meio */}
      {obra.descricao && <p className="obracard__desc">{obra.descricao}</p>}

      {marcas.length > 0 && (
        <span className="obracard__etiquetas">
          {marcas.map((e) => (
            <span
              key={e.id}
              className="obracard__etiqueta"
              style={{ background: e.cor, color: textoSobre(e.cor, isDark) }}
            >
              {e.nome}
            </span>
          ))}
        </span>
      )}

      <footer className="obracard__base">
        <span className="obracard__meta">
          {/* a cor vem do data-pri, e e a mesma em toda tela que fala de
              prioridade: vermelho alta, amarelo media, verde baixa */}
          <span className="obracard__pri" data-pri={obra.prioridade}>
            Prioridade: <strong>{rotuloDaPrioridade(obra.prioridade)}</strong>
          </span>
          {obra.dataConclusao && (
            <span className="obracard__data">conclusão: {dataBR(obra.dataConclusao)}</span>
          )}
        </span>
        {pessoas.length > 0 && <PilhaAvatares pessoas={pessoas} tamanho={24} limite={3} />}
      </footer>

      {children}
    </Elemento>
  )
}
