/**
 * Preparo da imagem antes de subir.
 *
 * Foto de celular tem 4000px de lado e uns 6 MB. Em base64 isso vira uns
 * 8 MB de JSON — o suficiente para estourar o limite do servidor (a
 * gravacao voltava 500 sem explicacao) e para nao caber no localStorage
 * junto com a sessao.
 *
 * Aqui a imagem e reduzida no PROPRIO navegador antes de sair: cabe no
 * banco, viaja rapido e continua boa para avatar e logo.
 */

/** Lado maior e qualidade de saida; da uma foto de ~80-150 KB. */
const LADO_MAXIMO = 640
const QUALIDADE = 0.82

/** Acima disto a gente nem tenta: e arquivo grande demais para ser foto. */
const BYTES_MAXIMOS = 25 * 1024 * 1024

export class ImagemInvalida extends Error {}

/**
 * Le o arquivo, reduz e devolve uma data URL pronta para gravar.
 *
 * PNG com transparencia continua PNG (senao o fundo vira preto);
 * o resto sai como JPEG, que e bem menor.
 */
export async function prepararImagem(arquivo) {
  if (!arquivo) return null

  if (!arquivo.type?.startsWith('image/')) {
    throw new ImagemInvalida('Escolha um arquivo de imagem.')
  }
  if (arquivo.size > BYTES_MAXIMOS) {
    throw new ImagemInvalida('A imagem é grande demais. Use uma de até 25 MB.')
  }

  const url = URL.createObjectURL(arquivo)
  try {
    const img = await carregar(url)

    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
    const largura = Math.max(1, Math.round(img.width * escala))
    const altura = Math.max(1, Math.round(img.height * escala))

    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura

    const ctx = tela.getContext('2d')
    ctx.imageSmoothingQuality = 'high'

    const transparente = arquivo.type === 'image/png' || arquivo.type === 'image/webp'
    if (!transparente) {
      // JPEG nao tem alfa: sem esse fundo, o transparente sairia preto
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, largura, altura)
    }
    ctx.drawImage(img, 0, 0, largura, altura)

    return transparente
      ? tela.toDataURL('image/png')
      : tela.toDataURL('image/jpeg', QUALIDADE)
  } catch (erro) {
    if (erro instanceof ImagemInvalida) throw erro
    throw new ImagemInvalida('Não foi possível ler esta imagem. Tente outra.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function carregar(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImagemInvalida('Não foi possível ler esta imagem.'))
    img.src = url
  })
}
