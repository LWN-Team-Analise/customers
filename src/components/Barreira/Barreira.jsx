import { Component } from 'react'
import './Barreira.css'

/**
 * Barreira de erro.
 *
 * Sem ela, um unico componente que estoura derruba a arvore inteira do
 * React e a tela fica BRANCA — parece que o site caiu. Com ela, o erro
 * para aqui: aparece um recado com o motivo e dois caminhos de volta
 * (tentar de novo, sem perder a pagina, ou recarregar).
 *
 * Precisa ser classe: hoje so classe tem componentDidCatch.
 */
export default class Barreira extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    // no dev isso aparece no console do navegador, com a pilha inteira
    console.error('[barreira]', erro, info?.componentStack)
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children

    return (
      <div className="barreira" role="alert">
        <div className="barreira__caixa">
          <h1 className="barreira__titulo">Algo quebrou nesta tela</h1>
          <p className="barreira__texto">
            O resto do sistema continua de pé, e nada do que você já salvou se perdeu — tudo
            fica no banco na hora em que você faz.
          </p>

          <pre className="barreira__motivo">{erro.message || String(erro)}</pre>

          <div className="barreira__acoes">
            <button
              type="button"
              className="barreira__btn barreira__btn--forte"
              onClick={() => this.setState({ erro: null })}
            >
              Tentar de novo
            </button>
            <button
              type="button"
              className="barreira__btn"
              onClick={() => window.location.reload()}
            >
              Recarregar a página
            </button>
          </div>
        </div>
      </div>
    )
  }
}
