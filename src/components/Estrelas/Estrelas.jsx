/**
 * Nota de 0 a 10 desenhada como cinco estrelas — cada uma vale 2 pontos.
 *
 * A estrela parcial e um gradiente com os dois pontos na MESMA posicao: ate
 * ali pinta, dali em diante e transparente. Sai um corte reto, sem meia
 * estrela desenhada a mao e sem imagem.
 *
 * Vive em components/ porque tres telas usam: Avaliacoes, Clientes e a
 * rastreabilidade da obra fechada. Antes morava dentro da pagina de
 * Avaliacoes, e quem quisesse a estrelinha tinha que importar a pagina
 * inteira — modal, formulario e tudo.
 */
export default function Estrelas({ nota, tamanho = 15 }) {
  const cheias = (Number(nota) || 0) / 2
  return (
    <span className="estrelas" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const parte = Math.round(Math.max(0, Math.min(1, cheias - i)) * 100)
        const id = `est${i}-${parte}`
        return (
          <svg key={i} viewBox="0 0 24 24" width={tamanho} height={tamanho}>
            <defs>
              <linearGradient id={id}>
                <stop offset={`${parte}%`} stopColor="var(--pri-media)" />
                <stop offset={`${parte}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.99 6.75 19.75l1-5.85L3.5 9.75l5.9-.85z"
              fill={`url(#${id})`}
              stroke="var(--pri-media)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        )
      })}
    </span>
  )
}
