import { useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { useAuth } from '@/context/AuthContext'
import { useDados } from '@/context/DadosContext'
import CardSetor from './CardSetor'
import { Icone } from './IconesObra'
import ModalCard from './ModalCard'
import ModalCheck from './ModalCheck'
import ModalEtapa from './ModalEtapa'
import { textoDaVersao, useArrasteDeChecks } from './arrasteChecks'
import './ObraDetalhe.css'
import './ModalModeloObra.css'

/* a obra "de mentira" do modelo: nada marcado, sem prazo, sem ensaio */
const OBRA_DO_MODELO = {
  id: null,
  tipo: 'padrao',
  checks: {},
  prazos: { etapas: {}, checks: {} },
  ensaios: [],
  execucao: {},
}

const nada = () => {}

/**
 * O MODELO DA OBRA — o botao "Editar" do quadro.
 *
 * Mostra o roteiro que vale HOJE (o que uma obra criada agora vai ter),
 * com todas as etapas abertas, para editar etapas, cards e checks sem
 * precisar entrar numa obra (antes o jeito era abrir uma obra de
 * emergencia, que libera todas as etapas).
 *
 * Tudo aqui vai sem \`obraId\`: o corte e "de agora em diante".
 *   - criar e excluir valem para as obras criadas a partir de agora;
 *   - editar ou levar para outro card um check que alguma obra JA
 *     marcou vira versao nova — as obras que ja existem continuam com
 *     ele como estava;
 *   - check que ninguem marcou ainda muda no proprio lugar.
 *
 * Os checks nao se marcam aqui (nao ha obra); o pegador de cada um
 * muda a ordem e o card, como dentro da obra.
 */
export default function ModalModeloObra({ aberto, aoFechar }) {
  const { user } = useAuth()
  const {
    roteiro,
    rotuloEtapa,
    corSuaveDoCargo,
    nomeDoCargo,
    cargoPorChave,
    pessoaPorId,
    pode,
    ordenarChecks,
  } = useDados()
  const podeEtapa = pode('editar_etapa')
  const podeCards = pode('editar_cards')
  const podeChecks = pode('editar_checks')

  const [editandoEtapa, setEditandoEtapa] = useState(null) // { etapa } | { novo: true }
  const [editandoCard, setEditandoCard] = useState(null) // { etapa, card? }
  const [editandoCheck, setEditandoCheck] = useState(null) // { card, check? }
  const [aviso, setAviso] = useState(null)

  const arraste = useArrasteDeChecks({
    ordenar: async (cardId, checkIds) => {
      const r = await ordenarChecks(cardId, checkIds, null)
      if (r?.versionados?.length > 0) setAviso(textoDaVersao(r.versionados))
    },
    aoRecusar: setAviso,
  })

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Modelo da obra"
      subtitulo="Vale para as obras criadas a partir de agora."
      largura={1240}
    >
      <div className="modelo">
        {podeEtapa && (
          <div className="modelo__barra">
            <button
              type="button"
              className="modelo__nova"
              onClick={() => setEditandoEtapa({ novo: true })}
            >
              <Icone.mais tamanho={14} />
              Etapa
            </button>
          </div>
        )}

        <div className="trilho modelo__trilho">
          {roteiro.map((etapa) => {
            const nomeEtapa = etapa.nome || rotuloEtapa(etapa.numero)
            return (
              <section key={etapa.id} className="etapa vidro" data-estado="atual">
                <header className="etapa__topo">
                  <h2 className="etapa__titulo" title={rotuloEtapa(etapa.numero)}>
                    {nomeEtapa}
                  </h2>
                  {(podeCards || (podeEtapa && !etapa.fixa)) && (
                    <span className="etapa__ferramentas">
                      {podeCards && (
                        <button
                          type="button"
                          className="etapa__botao"
                          onClick={() => setEditandoCard({ etapa })}
                          title="Novo card nesta etapa"
                          aria-label={`Novo card em ${nomeEtapa}`}
                        >
                          <Icone.mais tamanho={15} />
                        </button>
                      )}
                      {podeEtapa && !etapa.fixa && (
                        <button
                          type="button"
                          className="etapa__botao"
                          onClick={() => setEditandoEtapa({ etapa })}
                          title="Editar o nome e a descrição desta etapa"
                          aria-label={`Editar ${nomeEtapa}`}
                        >
                          <Icone.lapis />
                        </button>
                      )}
                    </span>
                  )}
                </header>

                {etapa.descricao && <p className="etapa__desc">{etapa.descricao}</p>}

                <div className="etapa__cards">
                  {etapa.cards.map((card) => (
                    <CardSetor
                      key={card.id}
                      card={card}
                      etapa={etapa}
                      obra={OBRA_DO_MODELO}
                      modelo
                      arraste={arraste}
                      travado={false}
                      usuario={user}
                      podeCards={podeCards}
                      podeChecks={podeChecks}
                      podePrazos={false}
                      hoje=""
                      execucao={null}
                      corSuaveDoCargo={corSuaveDoCargo}
                      nomeDoCargo={nomeDoCargo}
                      cargoPorChave={cargoPorChave}
                      pessoaPorId={pessoaPorId}
                      aoMarcar={nada}
                      aoEditarCard={() => setEditandoCard({ etapa, card })}
                      aoNovoCheck={() => setEditandoCheck({ card })}
                      aoEditarCheck={(check) => setEditandoCheck({ card, check })}
                      aoPrazoCheck={nada}
                    />
                  ))}
                  {etapa.cards.length === 0 && <p className="modelo__vazio">Sem card ainda.</p>}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <ModalEtapa
        aberto={Boolean(editandoEtapa)}
        etapa={editandoEtapa?.etapa ?? null}
        obraId={null}
        aoFechar={() => setEditandoEtapa(null)}
      />

      <ModalCard
        aberto={Boolean(editandoCard)}
        etapa={editandoCard?.etapa}
        card={editandoCard?.card ?? null}
        obraId={null}
        aoFechar={() => setEditandoCard(null)}
      />

      <ModalCheck
        aberto={Boolean(editandoCheck)}
        card={editandoCheck?.card}
        check={editandoCheck?.check ?? null}
        obraId={null}
        aoFechar={() => setEditandoCheck(null)}
      />

      <Modal aberto={Boolean(aviso)} aoFechar={() => setAviso(null)} titulo="Roteiro" largura={440}>
        <div className="formrot">
          <p className="formrot__sistema" role="note">
            {aviso}
          </p>
          <footer className="formobra__acoes">
            <Button type="button" onClick={() => setAviso(null)}>
              Entendi
            </Button>
          </footer>
        </div>
      </Modal>
    </Modal>
  )
}
