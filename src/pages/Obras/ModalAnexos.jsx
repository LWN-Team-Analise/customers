import { useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import { useDados } from '@/context/DadosContext'
import { useAuth } from '@/context/AuthContext'
import { dataHora } from '@/utils/formato'
import './ModalAnexos.css'

/**
 * Documentos da obra.
 *
 * O arquivo e guardado no banco como data URL, igual a foto de perfil.
 * Por isso o teto de 4 MB por arquivo: acima disso o JSON nao passa no
 * limite da API.
 *
 * A lista que chega com o quadro traz so nome, tipo e tamanho — o
 * arquivo em si so e buscado no clique de abrir. Sem isso, cada
 * carregamento do sistema arrastaria todos os documentos de todas as
 * obras junto.
 */

const BYTES_MAXIMOS = 4 * 1024 * 1024

const Icone = {
  mais: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  papel: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V8z" />
      <path d="M13.5 3v5h5" />
    </svg>
  ),
  baixar: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  ),
  lixo: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </svg>
  ),
}

const tamanhoLegivel = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function lerArquivo(arquivo) {
  return new Promise((resolver, recusar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(leitor.result)
    leitor.onerror = () => recusar(new Error('Não foi possível ler este arquivo.'))
    leitor.readAsDataURL(arquivo)
  })
}

export default function ModalAnexos({ aberto, obra, aoFechar }) {
  const { user } = useAuth()
  const { adicionarAnexo, baixarAnexo, removerAnexo, pode } = useDados()

  const entrada = useRef(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [apagando, setApagando] = useState(null)

  const podeMexer = pode('editar_obras')
  const anexos = obra?.anexos ?? []

  const escolher = async (evento) => {
    const arquivos = [...(evento.target.files ?? [])]
    evento.target.value = ''
    if (arquivos.length === 0) return

    const grande = arquivos.find((a) => a.size > BYTES_MAXIMOS)
    if (grande) {
      setErro(`"${grande.name}" tem ${tamanhoLegivel(grande.size)}. O limite é 4 MB por arquivo.`)
      return
    }

    setEnviando(true)
    setErro('')
    try {
      /* um de cada vez: mandar tudo junto estouraria o corpo da
         requisicao quando alguem escolhe cinco PDFs de uma vez */
      for (const arquivo of arquivos) {
        await adicionarAnexo(obra.id, {
          nome: arquivo.name,
          tipo: arquivo.type || 'application/octet-stream',
          tamanho: arquivo.size,
          conteudo: await lerArquivo(arquivo),
        })
      }
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const abrir = async (anexo) => {
    setErro('')
    try {
      const { conteudo, nome } = await baixarAnexo(anexo.id)
      const link = document.createElement('a')
      link.href = conteudo
      link.download = nome
      link.click()
    } catch (e) {
      setErro(e.message)
    }
  }

  const excluir = async (anexo) => {
    try {
      await removerAnexo(anexo.id)
      setApagando(null)
    } catch (e) {
      setErro(e.message)
    }
  }

  if (!obra) return null

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Anexos da obra"
      subtitulo="Os documentos ficam guardados nesta obra. Até 4 MB por arquivo."
      largura={520}
    >
      <div className="anexos">
        {podeMexer && (
          <>
            <button
              type="button"
              className="anexos__novo"
              onClick={() => entrada.current?.click()}
              disabled={enviando}
            >
              <Icone.mais />
              {enviando ? 'Enviando...' : 'Anexar documento'}
            </button>
            <input
              ref={entrada}
              type="file"
              multiple
              className="sr-only"
              onChange={escolher}
              tabIndex={-1}
            />
          </>
        )}

        {erro && (
          <p className="anexos__erro" role="alert">
            {erro}
          </p>
        )}

        {anexos.length === 0 ? (
          <p className="anexos__vazio">
            Nenhum documento anexado ainda.
            {podeMexer ? ' Use o botão acima para enviar o primeiro.' : ''}
          </p>
        ) : (
          <ul className="anexos__lista">
            {anexos.map((a) => (
              <li key={a.id}>
                <span className="anexos__icone" aria-hidden="true">
                  <Icone.papel />
                </span>

                <span className="anexos__quem">
                  <strong>{a.nome}</strong>
                  <span>
                    {tamanhoLegivel(a.tamanho)} · {a.autorNome} · {dataHora(a.enviadoEm)}
                  </span>
                </span>

                <button
                  type="button"
                  className="anexos__acao"
                  onClick={() => abrir(a)}
                  title="Baixar"
                  aria-label={`Baixar ${a.nome}`}
                >
                  <Icone.baixar />
                </button>

                {/* apaga quem pode editar a obra, ou quem enviou o arquivo */}
                {(podeMexer || String(a.enviadoPor) === String(user?.id)) &&
                  (apagando === a.id ? (
                    <button
                      type="button"
                      className="anexos__acao anexos__acao--confirma"
                      onClick={() => excluir(a)}
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="anexos__acao anexos__acao--perigo"
                      onClick={() => setApagando(a.id)}
                      title="Excluir"
                      aria-label={`Excluir ${a.nome}`}
                    >
                      <Icone.lixo />
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
