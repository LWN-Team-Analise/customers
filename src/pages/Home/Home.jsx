import AppShell from '@/components/AppShell/AppShell'
import './Home.css'

/**
 * Tela inicial depois do login: a casca (barra lateral + barra superior)
 * com a area de conteudo ainda livre para os modulos.
 */
export default function Home() {
  return (
    <AppShell ativo="inicio">
      <section className="home">
        <p className="home__vazio">
          Escolha um módulo na barra lateral para começar.
        </p>
      </section>
    </AppShell>
  )
}
