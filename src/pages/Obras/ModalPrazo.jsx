import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoTexto } from '@/components/Campo/Campo'
import { AVISO_ANTES_DIAS } from '@/domain/obras'
import '@/pages/Obras/ModalRoteiro.css'

/**
 * O prazo de uma etapa ou de um check, NESTA obra.
 *
 * So abre para quem tem `definir_prazos` — a tela nem mostra o botao
 * sem ela, e a API recusa do mesmo jeito. Salvar vazio, ou "Tirar
 * prazo", apaga.
 *
 * `alvo` e { tipo: 'etapa' | 'check', nome, prazo }.
 */
export default function ModalPrazo({ aberto, alvo, aoSalvar, aoFechar }) {
  const [data, setData] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setData(alvo?.prazo ?? '')
    setErro('')
  }, [aberto, alvo])

  const gravar = async (valor) => {
    setSalvando(true)
    try {
      await aoSalvar(valor)
      aoFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={alvo?.prazo ? 'Alterar prazo' : 'Definir prazo'}
      subtitulo={alvo ? `${alvo.tipo === 'etapa' ? 'Etapa' : 'Check'}: ${alvo.nome}` : undefined}
      largura={420}
    >
      <form
        className="formrot"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          gravar(data)
        }}
      >
        <CampoTexto
          rotulo="Data limite"
          type="date"
          largo
          value={data}
          onChange={(e) => setData(e.target.value)}
          autoFocus
        />
        <p className="formrot__dica formrot__dica--colada">
          Vencido o prazo sem terminar, o card da obra fica amarelo no quadro. Também fica
          amarelo {AVISO_ANTES_DIAS} dias antes, se ainda estiver longe de terminar.
        </p>

        {erro && (
          <p className="formrot__erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="formobra__acoes">
          {alvo?.prazo && (
            <button
              type="button"
              className="formrot__apagar"
              onClick={() => gravar('')}
              disabled={salvando}
            >
              Tirar prazo
            </button>
          )}
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit" loading={salvando} disabled={!data && !alvo?.prazo}>
            Salvar prazo
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
