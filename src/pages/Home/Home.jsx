import { Link } from 'react-router-dom'
import AppShell from '@/components/AppShell/AppShell'
import { useDados } from '@/context/DadosContext'
import './Home.css'

/** Tela inicial: um resumo curto, com atalho para cada modulo. */
export default function Home() {
  const { obras, clientes, equipe, concluida, pendentesDaObra } = useDados()

  const abertas = obras.filter((o) => !concluida(o))
  const emergencias = abertas.filter((o) => o.tipo === 'emergencia')
  const pendentes = abertas.filter((o) => pendentesDaObra(o).length > 0)
  const concluidas = obras.filter(concluida)

  const cartoes = [
    { rotulo: 'Obras em andamento', valor: abertas.length, rota: '/app/obras' },
    { rotulo: 'Emergências abertas', valor: emergencias.length, rota: '/app/obras', tom: 'alerta' },
    { rotulo: 'Aguardando setor', valor: pendentes.length, rota: '/app/obras', tom: 'aviso' },
    { rotulo: 'Concluídas', valor: concluidas.length, rota: '/app/concluidas', tom: 'ok' },
    { rotulo: 'Clientes', valor: clientes.length, rota: '/app/clientes' },
    { rotulo: 'Pessoas na equipe', valor: equipe.length, rota: '/app/usuarios' },
  ]

  return (
    <AppShell>
      <section className="home">
        <header>
          <h1 className="tela__titulo">Página inicial</h1>
          <p className="tela__lead">Como está a casa hoje.</p>
        </header>

        <ul className="home__grade">
          {cartoes.map((c) => (
            <li key={c.rotulo}>
              <Link className="resumo" to={c.rota} data-tom={c.tom}>
                <span className="resumo__valor">{c.valor}</span>
                <span className="resumo__rotulo">{c.rotulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  )
}
