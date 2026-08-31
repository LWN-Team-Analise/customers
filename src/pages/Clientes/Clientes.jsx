import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import Avatar from '@/components/Avatar/Avatar'
import { useDados } from '@/context/DadosContext'
import useCorDaLogo from '@/hooks/useCorDaLogo'
import { obraConcluida } from '@/domain/obras'
import Confirma from '@/components/Confirma/Confirma'
import ModalCliente from './ModalCliente'
import './Clientes.css'

const Icone = {
  mais: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  lapis: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
  pino: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  ),
}

export default function Clientes() {
  const { clientes, obras, adicionarCliente, atualizarCliente, removerCliente, removerObra } =
    useDados()
  const navigate = useNavigate()

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [busca, setBusca] = useState('')
  const [apagando, setApagando] = useState(null)

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    const filtrados = alvo
      ? clientes.filter((c) =>
          `${c.nome} ${c.cidade} ${c.estado}`.toLowerCase().includes(alvo),
        )
      : clientes
    return [...filtrados].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [clientes, busca])

  /* quantas obras cada cliente tem, e quantas ainda estao abertas */
  const contagem = useMemo(() => {
    const mapa = {}
    obras.forEach((o) => {
      const atual = mapa[o.clienteId] ?? { total: 0, abertas: 0 }
      atual.total += 1
      if (!obraConcluida(o)) atual.abertas += 1
      mapa[o.clienteId] = atual
    })
    return mapa
  }, [obras])

  const abrirNovo = () => {
    setEditando(null)
    setModal(true)
  }

  const abrirEdicao = (cliente) => {
    setEditando(cliente)
    setModal(true)
  }

  /* Antes o botao so avisava e travava quando o cliente tinha obra.
     Agora ele abre a confirmacao e, se o usuario mandar, apaga o
     cliente junto com as obras dele. */
  const confirmarExclusao = () => {
    if (!apagando) return
    obras
      .filter((o) => o.clienteId === apagando.id)
      .forEach((o) => removerObra(o.id))
    removerCliente(apagando.id)
  }

  const salvar = (campos) => {
    if (editando) atualizarCliente(editando.id, campos)
    else adicionarCliente(campos)
  }

  return (
    <AppShell>
      <section className="clientes">
        {/* titulo, filtro e acao na mesma linha */}
        <header className="clientes__topo">
          <h1 className="clientes__titulo">Clientes</h1>

          <label className="procura">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa ou cidade..."
              aria-label="Buscar cliente"
            />
          </label>

          <button type="button" className="acao acao--padrao" onClick={abrirNovo}>
            <Icone.mais />
            Novo cliente
          </button>
        </header>

        {lista.length === 0 ? (
          <p className="clientes__vazio">
            {busca
              ? 'Nenhum cliente encontrado com esse termo.'
              : 'Nenhum cliente cadastrado ainda. Comece pelo botão “Novo cliente”.'}
          </p>
        ) : (
          <ul className="clientes__grade">
            {lista.map((cliente) => (
              <CardCliente
                key={cliente.id}
                cliente={cliente}
                numeros={contagem[cliente.id] ?? { total: 0, abertas: 0 }}
                aoEditar={() => abrirEdicao(cliente)}
                aoApagar={() => setApagando(cliente)}
                aoVer={() => navigate('/app/obras')}
              />
            ))}
          </ul>
        )}
      </section>

      <ModalCliente
        aberto={modal}
        cliente={editando}
        aoFechar={() => setModal(false)}
        aoSalvar={salvar}
      />

      <Confirma
        aberto={Boolean(apagando)}
        titulo={`Apagar ${apagando?.nome ?? 'cliente'}?`}
        mensagem="O cadastro sai da lista e não dá para desfazer."
        aviso={
          (contagem[apagando?.id]?.total ?? 0) > 0
            ? `Este cliente tem ${contagem[apagando.id].total} obra(s). Elas serão apagadas junto, com as etapas, observações e avaliações.`
            : undefined
        }
        rotuloConfirmar="Apagar cliente"
        aoConfirmar={confirmarExclusao}
        aoFechar={() => setApagando(null)}
      />
    </AppShell>
  )
}

/** Card do cliente. A borda esquerda usa a cor predominante da logo. */
function CardCliente({ cliente, numeros, aoEditar, aoApagar, aoVer }) {
  const cor = useCorDaLogo(cliente.logo, cliente.nome)

  return (
    <li className="cliente" style={{ '--cor-logo': cor }}>
      <header className="cliente__topo">
        <Avatar nome={cliente.nome} foto={cliente.logo} tamanho={46} quadrado titulo={cliente.nome} />
        <div className="cliente__quem">
          <h2 className="cliente__nome">{cliente.nome}</h2>
          <p className="cliente__local">
            <Icone.pino />
            {cliente.cidade}
            {cliente.estado ? `/${cliente.estado}` : ''}
          </p>
        </div>

        <div className="cliente__botoes">
          <button type="button" onClick={aoEditar} aria-label={`Editar ${cliente.nome}`} title="Editar">
            <Icone.lapis />
          </button>
          <button type="button" onClick={aoApagar} aria-label={`Apagar ${cliente.nome}`} title="Apagar">
            <Icone.lixo />
          </button>
        </div>
      </header>

      <dl className="cliente__dados">
        <div>
          <dt>Endereço</dt>
          <dd>{cliente.endereco || '—'}</dd>
        </div>
        <div>
          <dt>Bairro</dt>
          <dd>{cliente.bairro || '—'}</dd>
        </div>
        <div>
          <dt>CEP</dt>
          <dd>{cliente.cep || '—'}</dd>
        </div>
      </dl>

      <footer className="cliente__base">
        <span className="cliente__obras">
          <strong>{numeros.total}</strong> obra{numeros.total === 1 ? '' : 's'}
          {numeros.abertas > 0 && <em>{numeros.abertas} em andamento</em>}
        </span>
        <button type="button" className="cliente__ver" onClick={aoVer}>
          Ver no quadro
        </button>
      </footer>
    </li>
  )
}
