import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import Confirma from '@/components/Confirma/Confirma'
import { CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
/* as classes do formulario (formrot__*, formobra__acoes) moram aqui;
   o import explicito evita depender de outro modulo ter trazido o CSS */
import './ModalRoteiro.css'

/**
 * O nome que a empresa dá ao roteiro.
 *
 * Hoje o sistema chama de "Etapa" cada bloco do roteiro da obra. Essa
 * palavra não é do sistema, é da empresa: amanhã pode ser Fase, Marco,
 * Frente ou Entrega. Este pop-up troca a palavra em TODO lugar que a
 * escreve — o cabeçalho de cada bloco na tela da obra, o card do quadro,
 * os filtros da rastreabilidade, os avisos, o pop-up de criar e o de
 * editar.
 *
 * São dois campos porque o português precisa dos dois: o singular
 * aparece em "3ª Etapa" e o plural em "Etapas pendentes". Deixar o
 * sistema deduzir o plural com um "s" no fim daria "Fases" certo e
 * "Marcoss" errado — melhor perguntar.
 *
 * A troca é imediata e vale para todo mundo, e é por isso que ela pede
 * confirmação: não é a preferência de quem está mexendo, é o vocabulário
 * de quem usa o sistema.
 *
 * Quem pode: o mesmo setor que pode criar e apagar etapa. Quem manda no
 * roteiro é quem decide como o roteiro se chama.
 */
export default function ModalTermos({ aberto, aoFechar }) {
  const { termoEtapa, termoEtapas, salvarTermos } = useDados()

  const [singular, setSingular] = useState('')
  const [plural, setPlural] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conferindo, setConferindo] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setSingular(termoEtapa)
    setPlural(termoEtapas)
    setErro('')
    setConferindo(false)
  }, [aberto, termoEtapa, termoEtapas])

  const enviar = (evento) => {
    evento.preventDefault()
    if (!singular.trim() || !plural.trim()) {
      setErro('Preencha o singular e o plural.')
      return
    }
    setConferindo(true)
  }

  const gravar = async () => {
    setSalvando(true)
    try {
      await salvarTermos({
        termo_etapa: singular.trim(),
        termo_etapas: plural.trim(),
      })
      setConferindo(false)
      aoFechar()
    } catch (e) {
      setErro(e.message)
      setConferindo(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Como chamar as etapas"
      subtitulo="A palavra muda em todo o sistema, para todo mundo."
      largura={470}
      nivel={1}
    >
      <form className="formrot" onSubmit={enviar} noValidate>
        <CampoTexto
          rotulo="No singular"
          largo
          autoFocus
          placeholder="Ex.: Etapa"
          maxLength={30}
          value={singular}
          onChange={(e) => {
            setSingular(e.target.value)
            setErro('')
          }}
          dica={`Aparece em "3ª ${singular.trim() || 'Etapa'}".`}
        />

        <CampoTexto
          rotulo="No plural"
          largo
          placeholder="Ex.: Etapas"
          maxLength={30}
          value={plural}
          onChange={(e) => {
            setPlural(e.target.value)
            setErro('')
          }}
          dica={`Aparece em "${plural.trim() || 'Etapas'} pendentes".`}
        />

        {erro && (
          <p className="formrot__erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando}>
            Salvar
          </Button>
        </footer>
      </form>

      <Confirma
        aberto={conferindo}
        nivel={2}
        tom="acao"
        titulo="Trocar a palavra no sistema inteiro?"
        mensagem="Ela muda na tela da obra, no quadro, nos avisos e na rastreabilidade — para todos os usuários."
        detalhes={
          <dl>
            <dt>Uma</dt>
            <dd>3ª {singular.trim()}</dd>

            <dt>Várias</dt>
            <dd>{plural.trim()} pendentes</dd>
          </dl>
        }
        rotuloConfirmar="Trocar"
        aoConfirmar={gravar}
        aoFechar={() => setConferindo(false)}
      />
    </Modal>
  )
}
