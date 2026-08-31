import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as dados from '@/services/dadosService'
import * as equipeApi from '@/services/equipeService'
import { useAuth } from '@/context/AuthContext'
import { chaveDoCargo, obraConcluida } from '@/domain/obras'

/**
 * Estado compartilhado das obras, clientes, cargos, equipe e avisos.
 *
 * Cargos e usuarios vem da API quando o banco ja tem as tabelas de
 * db/sistema.sql.txt; sem elas, valem os do localStorage. Obras e
 * clientes ainda sao locais.
 */
const DadosContext = createContext(null)

export function DadosProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [estado, setEstado] = useState(() => dados.carregar())
  const [origemEquipe, setOrigemEquipe] = useState('local')

  useEffect(() => {
    dados.salvar(estado)
  }, [estado])

  /* ------------------------------------------------------------
     Sincroniza cargos e usuarios com o banco. Se a API nao responder
     (ou o SQL ainda nao tiver rodado), fica o que esta no storage.
     ------------------------------------------------------------ */
  useEffect(() => {
    if (!isAuthenticated) return undefined
    let valido = true

    equipeApi
      .carregarEquipe()
      .then((vindo) => {
        if (!valido || !vindo) return
        setEstado((atual) => ({
          ...atual,
          cargos: vindo.cargos.length > 0 ? vindo.cargos : atual.cargos,
          equipe: vindo.usuarios.length > 0 ? vindo.usuarios : atual.equipe,
        }))
        setOrigemEquipe('banco')
      })
      .catch(() => {
        /* sem API: segue com o local, e a tela avisa */
      })

    return () => {
      valido = false
    }
  }, [isAuthenticated])

  /* ---------------- Cargos ---------------- */

  const adicionarCargo = useCallback(
    async (campos) => {
      const local = dados.criarCargo(campos)
      setEstado((atual) => ({ ...atual, cargos: [...atual.cargos, local] }))
      // se o banco estiver ligado, ele e quem manda no id
      const salvo = await equipeApi.criarCargo(campos).catch(() => null)
      if (salvo) {
        setEstado((atual) => ({
          ...atual,
          cargos: atual.cargos.map((c) => (c.id === local.id ? salvo : c)),
        }))
      }
      return salvo ?? local
    },
    [],
  )

  const atualizarCargo = useCallback(async (id, campos) => {
    setEstado((atual) => ({
      ...atual,
      cargos: atual.cargos.map((c) => (c.id === id ? { ...c, ...campos } : c)),
    }))
    await equipeApi.editarCargo(id, campos).catch(() => null)
  }, [])

  const removerCargo = useCallback(async (id) => {
    const alvo = estado.cargos.find((c) => c.id === id)
    if (alvo?.fixo) {
      throw new Error(`"${alvo.nome}" é usado pelas etapas da obra e não pode ser apagado.`)
    }
    const emUso = estado.equipe.filter((p) => p.cargo === alvo?.chave).length
    if (emUso > 0) {
      throw new Error(`Há ${emUso} usuário(s) com esse cargo. Troque o cargo deles antes.`)
    }

    await equipeApi.apagarCargo(id).catch(() => null)
    setEstado((atual) => ({ ...atual, cargos: atual.cargos.filter((c) => c.id !== id) }))
  }, [estado.cargos, estado.equipe])

  const cargoPorChave = useCallback(
    (chave) => estado.cargos.find((c) => c.chave === chave) ?? null,
    [estado.cargos],
  )

  /** Cor do cargo, com um cinza de reserva para cargo que sumiu. */
  const corDoCargo = useCallback(
    (chave) => cargoPorChave(chave)?.cor ?? '#6b7280',
    [cargoPorChave],
  )

  /* ---------------- Clientes ---------------- */

  const adicionarCliente = useCallback((campos) => {
    const cliente = dados.criarCliente(campos)
    setEstado((atual) => ({ ...atual, clientes: [...atual.clientes, cliente] }))
    return cliente
  }, [])

  const atualizarCliente = useCallback((id, campos) => {
    setEstado((atual) => ({
      ...atual,
      clientes: atual.clientes.map((c) => (c.id === id ? { ...c, ...campos } : c)),
    }))
  }, [])

  const removerCliente = useCallback((id) => {
    setEstado((atual) => ({
      ...atual,
      clientes: atual.clientes.filter((c) => c.id !== id),
    }))
  }, [])

  /* ---------------- Obras ---------------- */

  const adicionarObra = useCallback((campos) => {
    const obra = dados.criarObra(campos)
    setEstado((atual) => ({ ...atual, obras: [...atual.obras, obra] }))
    return obra
  }, [])

  const atualizarObra = useCallback((id, campos) => {
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((o) => (o.id === id ? { ...o, ...campos } : o)),
    }))
  }, [])

  const removerObra = useCallback((id) => {
    setEstado((atual) => ({ ...atual, obras: atual.obras.filter((o) => o.id !== id) }))
  }, [])

  /** Marca/desmarca uma tarefa e registra quem mexeu (vai para os avatares do card). */
  const alternarTarefa = useCallback((obraId, numeroEtapa, setor, indice, autorId) => {
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((obra) => {
        if (obra.id !== obraId) return obra
        const etapas = obra.etapas.map((etapa) => {
          if (etapa.numero !== numeroEtapa) return etapa
          const bloco = etapa.setores[setor]
          if (!bloco) return etapa
          const tarefas = bloco.tarefas.map((t, i) => (i === indice ? { ...t, feito: !t.feito } : t))
          return {
            ...etapa,
            setores: {
              ...etapa.setores,
              [setor]: { ...bloco, tarefas, responsavelId: autorId ?? bloco.responsavelId },
            },
          }
        })
        const membros = autorId && !obra.membros.includes(autorId)
          ? [...obra.membros, autorId]
          : obra.membros

        /* carimba a conclusao na hora em que a ultima tarefa fecha —
           e essa data que agrupa a tela de Concluidas por ano/mes.
           Se a obra reabrir (desmarcaram algo), o carimbo sai. */
        const atualizada = { ...obra, etapas, membros }
        const fechou = obraConcluida(atualizada)
        return {
          ...atualizada,
          concluidaEm: fechou ? (obra.concluidaEm ?? new Date().toISOString()) : null,
        }
      }),
    }))
  }, [])

  const adicionarObservacao = useCallback((obraId, campos) => {
    const observacao = dados.criarObservacao(campos)
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((o) =>
        o.id === obraId ? { ...o, observacoes: [observacao, ...o.observacoes] } : o,
      ),
    }))
    return observacao
  }, [])

  const removerObservacao = useCallback((obraId, observacaoId) => {
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((o) =>
        o.id === obraId
          ? { ...o, observacoes: o.observacoes.filter((obs) => obs.id !== observacaoId) }
          : o,
      ),
    }))
  }, [])

  /** Registra o aviso enviado aos setores que ainda devem informacao. */
  const registrarAviso = useCallback((obraId, { setores, mensagem, autorNome }) => {
    const aviso = {
      id: dados.novoId('aviso'),
      setores,
      mensagem: String(mensagem ?? '').trim(),
      autorNome,
      enviadoEm: new Date().toISOString(),
    }
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((o) => (o.id === obraId ? { ...o, avisos: [aviso, ...o.avisos] } : o)),
    }))
    return aviso
  }, [])

  /* ---------------- Avaliacao da obra ---------------- */

  /** A nota que a empresa deu ao servico. E dela que sai a media da equipe. */
  const avaliarObra = useCallback((obraId, campos) => {
    const avaliacao = dados.criarAvaliacao(campos)
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((o) => (o.id === obraId ? { ...o, avaliacao } : o)),
    }))
    return avaliacao
  }, [])

  const limparAvaliacao = useCallback((obraId) => {
    setEstado((atual) => ({
      ...atual,
      obras: atual.obras.map((o) => (o.id === obraId ? { ...o, avaliacao: null } : o)),
    }))
  }, [])

  /* ---------------- Equipe ---------------- */

  const adicionarPessoa = useCallback((pessoa) => {
    const registro = { id: dados.novoId('u'), foto: null, ...pessoa }
    setEstado((atual) => ({ ...atual, equipe: [...atual.equipe, registro] }))
    return registro
  }, [])

  const removerPessoa = useCallback((id) => {
    setEstado((atual) => ({
      ...atual,
      equipe: atual.equipe.filter((p) => String(p.id) !== String(id)),
      // sai tambem das obras em que era membro, senao vira avatar fantasma
      obras: atual.obras.map((o) => ({
        ...o,
        membros: o.membros.filter((m) => String(m) !== String(id)),
      })),
    }))
  }, [])

  const atualizarPessoa = useCallback((id, campos) => {
    setEstado((atual) => ({
      ...atual,
      equipe: atual.equipe.map((p) => (p.id === id ? { ...p, ...campos } : p)),
    }))
  }, [])

  /* ------------------------------------------------------------
     A equipe que as telas enxergam: a do estado mais o usuario
     logado. Sem isso, quem entrou nao aparece na lista de Usuarios
     enquanto o banco nao tiver as tabelas novas.
     ------------------------------------------------------------ */
  const equipe = useMemo(() => {
    if (!user) return estado.equipe
    const meuId = String(user.id)
    if (estado.equipe.some((p) => String(p.id) === meuId)) return estado.equipe
    return [
      {
        id: meuId,
        nome: user.name,
        email: user.email,
        telefone: user.telefone ?? null,
        cargo: chaveDoCargo(user),
        cargoNome: user.cargoNome ?? user.cargo,
        foto: user.foto ?? null,
        acessoTotal: Boolean(user.acessoTotal),
        souEu: true,
      },
      ...estado.equipe,
    ]
  }, [estado.equipe, user])

  /* ------------------------------------------------------------
     Media do usuario: a nota das obras avaliadas em que ele
     participou. Duas obras com 8 e 5 dao 6.5. Sem obra avaliada,
     a nota e null ("sem avaliacao").
     ------------------------------------------------------------ */
  const mediasPorUsuario = useMemo(() => {
    const acumulado = {}
    estado.obras.forEach((obra) => {
      if (!obra.avaliacao) return
      obra.membros.forEach((id) => {
        const atual = acumulado[id] ?? { soma: 0, quantas: 0 }
        atual.soma += Number(obra.avaliacao.nota)
        atual.quantas += 1
        acumulado[id] = atual
      })
    })
    return Object.fromEntries(
      Object.entries(acumulado).map(([id, { soma, quantas }]) => [
        id,
        { media: Math.round((soma / quantas) * 10) / 10, obrasAvaliadas: quantas },
      ]),
    )
  }, [estado.obras])

  const mediaDoUsuario = useCallback(
    (id) => mediasPorUsuario[id] ?? { media: null, obrasAvaliadas: 0 },
    [mediasPorUsuario],
  )

  /* ---------------- Consultas ---------------- */

  const clientePorId = useCallback(
    (id) => estado.clientes.find((c) => c.id === id) ?? null,
    [estado.clientes],
  )

  const pessoaPorId = useCallback(
    (id) => equipe.find((p) => String(p.id) === String(id)) ?? null,
    [equipe],
  )

  const obraPorId = useCallback((id) => estado.obras.find((o) => o.id === id) ?? null, [estado.obras])

  /** Em que obras a pessoa esta e em que etapa cada uma parou. */
  const obrasDaPessoa = useCallback(
    (id) =>
      estado.obras
        .filter((o) => o.membros.map(String).includes(String(id)) && !obraConcluida(o))
        .map((o) => ({ obra: o, cliente: clientePorId(o.clienteId) })),
    [estado.obras, clientePorId],
  )

  const valor = useMemo(
    () => ({
      ...estado,
      equipe,
      origemEquipe,
      adicionarCargo,
      atualizarCargo,
      removerCargo,
      cargoPorChave,
      corDoCargo,
      adicionarCliente,
      atualizarCliente,
      removerCliente,
      adicionarObra,
      atualizarObra,
      removerObra,
      alternarTarefa,
      adicionarObservacao,
      removerObservacao,
      registrarAviso,
      avaliarObra,
      limparAvaliacao,
      adicionarPessoa,
      atualizarPessoa,
      removerPessoa,
      mediaDoUsuario,
      clientePorId,
      pessoaPorId,
      obraPorId,
      obrasDaPessoa,
    }),
    [
      estado,
      equipe,
      origemEquipe,
      adicionarCargo,
      atualizarCargo,
      removerCargo,
      cargoPorChave,
      corDoCargo,
      adicionarCliente,
      atualizarCliente,
      removerCliente,
      adicionarObra,
      atualizarObra,
      removerObra,
      alternarTarefa,
      adicionarObservacao,
      removerObservacao,
      registrarAviso,
      avaliarObra,
      limparAvaliacao,
      adicionarPessoa,
      atualizarPessoa,
      removerPessoa,
      mediaDoUsuario,
      clientePorId,
      pessoaPorId,
      obraPorId,
      obrasDaPessoa,
    ],
  )

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>
}

export function useDados() {
  const ctx = useContext(DadosContext)
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>')
  return ctx
}
