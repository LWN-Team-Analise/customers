import AppShell from '@/components/AppShell/AppShell'
import './Home.css'

/**
 * Tela inicial.
 *
 * Os seis cartoes de resumo sairam a pedido: os mesmos numeros ja estao
 * na aba de cada assunto, e repeti-los aqui so dava mais uma tela para
 * manter em dia. O que fica e a porta de entrada.
 */
export default function Home() {
  return (
    <AppShell>
      <section className="home">
        <header>
          <h1 className="tela__titulo">Página inicial</h1>
        </header>
      </section>
    </AppShell>
  )
}
