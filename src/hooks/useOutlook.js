import { useCallback, useEffect, useRef, useState } from 'react'
import { inicioDoOutlook, outlookConfigurado } from '@/services/authService'

/**
 * A janelinha do login com Outlook.
 *
 * Duas telas usam o mesmo caminho — a de Login (para entrar) e a de
 * Configuracoes (para vincular) —, e as duas precisam da MESMA coisa:
 * abrir a janela da Microsoft e esperar o `code` voltar.
 *
 * Uso:
 *     const outlook = useOutlook()
 *     const { codigo, redirecionar } = await outlook.abrir()
 *
 * `outlook.disponivel` diz se o servidor esta configurado; enquanto
 * nao estiver, a tela mostra o recado em vez do botao.
 */

/** O endereco que a Microsoft chama de volta (ver src/routes/AppRoutes.jsx). */
const RETORNO = () => `${window.location.origin}/outlook`

export default function useOutlook() {
  const [disponivel, setDisponivel] = useState(false)
  const [conferindo, setConferindo] = useState(true)
  const janela = useRef(null)

  useEffect(() => {
    let vivo = true
    outlookConfigurado().then((tem) => {
      if (!vivo) return
      setDisponivel(tem)
      setConferindo(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  /* se a pessoa sair da tela com a janelinha aberta, fecha junto */
  useEffect(
    () => () => {
      if (janela.current && !janela.current.closed) janela.current.close()
    },
    [],
  )

  const abrir = useCallback(async () => {
    const redirecionar = RETORNO()
    const { url } = await inicioDoOutlook(redirecionar)

    /* a janela e aberta ANTES do await sempre que possivel; como aqui
       ela vem depois de uma chamada, alguns navegadores podem barrar —
       por isso o recado especifico quando `popup` volta nulo */
    const popup = window.open(url, 'outlook-lwn', 'width=520,height=680')
    janela.current = popup
    if (!popup) {
      throw new Error('O navegador bloqueou a janela do Outlook. Libere os pop-ups e tente de novo.')
    }

    return new Promise((resolver, recusar) => {
      let fim = false

      const terminar = (acao, valor) => {
        if (fim) return
        fim = true
        window.removeEventListener('message', ouvir)
        window.clearInterval(vigia)
        acao(valor)
      }

      const ouvir = (evento) => {
        if (evento.origin !== window.location.origin) return
        if (evento.data?.origem !== 'outlook') return
        if (evento.data.erro) terminar(recusar, new Error(evento.data.erro))
        else if (evento.data.codigo) terminar(resolver, { codigo: evento.data.codigo, redirecionar })
        else terminar(recusar, new Error('A Microsoft não devolveu o código de entrada.'))
      }

      /* fechar a janelinha no X tambem tem que encerrar a espera, senao
         a tela ficaria travada em "entrando..." para sempre */
      const vigia = window.setInterval(() => {
        if (popup.closed) terminar(recusar, new Error('Entrada com Outlook cancelada.'))
      }, 600)

      window.addEventListener('message', ouvir)
    })
  }, [])

  return { disponivel, conferindo, abrir }
}
