import { useMemo } from 'react'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { cargosDoCheck, chaveDoCargo, estadoDaEtapa, podeEditarCheck } from '@/domain/obras'

/**
 * As TAREFAS da pagina inicial.
 *
 * Nao existe cadastro de tarefa neste sistema, e nao e para existir: a
 * tarefa e o CHECK de uma obra. Quem cria tarefa e quem monta o roteiro;
 * a pagina inicial so junta os checks de todas as obras abertas numa
 * lista so e responde "o que precisa ser feito".
 *
 * E por isso que nao ha botao de "adicionar tarefa" em lugar nenhum
 * dela: uma tarefa solta, sem obra, nao teria onde ser marcada nem quem
 * a cobrasse — o sininho, os avisos e a rastreabilidade so sabem falar
 * de check de obra.
 *
 * Cada tarefa vira:
 *
 *   { id, titulo, obra, cliente, etapaNumero, etapaNome, cardTitulo,
 *     cargos, status, feitoPor, feitoEm, minha }
 *
 * O STATUS sai de duas perguntas, nesta ordem:
 *
 *   marcado?                    -> 'concluida'
 *   a etapa dele ja abriu?      -> 'andamento'  (da para fazer agora)
 *   ainda nao abriu             -> 'espera'     (a etapa anterior segura)
 *
 * Obra de EMERGENCIA nao tem 'espera': ali todas as etapas abrem de uma
 * vez, e quem decide isso e o `estadoEtapa` do dominio — nao este hook.
 *
 * Obra ENCERRADA fica de fora inteira. Ela e registro, e um quadro que
 * mistura o que ja acabou com o que falta fazer para de responder a
 * pergunta que ele existe para responder.
 */
export default function useTarefas() {
  const { obras, roteiroDaObra, concluida, clientePorId } = useDados()
  const { user } = useAuth()

  /* o setor de quem esta logado: e ele que separa "minhas" de "todas" */
  const meuSetor = chaveDoCargo(user)

  return useMemo(() => {
    const lista = []

    obras
      .filter((obra) => !concluida(obra))
      .forEach((obra) => {
        const cliente = clientePorId(obra.clienteId)
        /* o roteiro sai UMA vez por obra. O `estadoEtapa` do contexto
           faria essa conta de novo a cada etapa — cinco vezes por obra,
           em toda renderizacao da tela. */
        const roteiro = roteiroDaObra(obra)

        roteiro.forEach((etapa) => {
          const estado = estadoDaEtapa(roteiro, obra, etapa.numero)

          etapa.cards.forEach((card) => {
            ;(card.checks ?? []).forEach((check) => {
              const marca = obra.checks?.[check.id]
              const cargos = cargosDoCheck(check, card)

              lista.push({
                id: `${obra.id}:${check.id}`,
                checkId: check.id,
                titulo: check.titulo,
                obra,
                cliente,
                etapaNumero: etapa.numero,
                etapaNome: etapa.nome,
                /* o CARD e o dono da tarefa no roteiro. O Quadro agrupa a
                   coluna de concluidas por ele: um card fechado conta uma
                   historia ("o Comercial terminou"), e vinte checks
                   soltos contam vinte vezes a mesma. */
                cardId: card.id,
                cardTitulo: card.titulo ?? '',
                cardCargos: card.cargos ?? [],
                /* quantos checks o card tem — e o denominador do "3 de 5" */
                cardTotal: (card.checks ?? []).length,
                cargos,
                status: marca ? 'concluida' : estado === 'bloqueada' ? 'espera' : 'andamento',
                feitoPor: marca?.feitoPor ?? null,
                feitoEm: marca?.feitoEm ?? null,
                /* sem setor no cadastro ninguem tem tarefa "sua" — e a
                   tela cai no modo "todas" para nao ficar vazia */
                minha: meuSetor ? cargos.includes(meuSetor) : false,
                /* DA para marcar? Nao e a mesma pergunta que "e minha":
                   a diretoria marca qualquer check, e em obra de
                   emergencia qualquer um marca. E esta resposta, e nao
                   o setor, que decide se a linha aparece travada — a
                   mesma que o servidor da antes de gravar. */
                posso: podeEditarCheck(user, check, card, obra),
              })
            })
          })
        })
      })

    return lista
  }, [obras, roteiroDaObra, concluida, clientePorId, meuSetor, user])
}
