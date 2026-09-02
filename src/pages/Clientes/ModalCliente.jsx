import { useEffect, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import Button from '@/components/Button/Button'
import { CampoFoto, CampoSelecao, CampoTexto } from '@/components/Campo/Campo'
import { useDados } from '@/context/DadosContext'
import { buscarCEP, listarCidades, listarEstados } from '@/services/enderecoService'
import { formatarCEP } from '@/utils/formato'
import './ModalCliente.css'

const VAZIO = {
  nome: '',
  logo: null,
  setorId: '',
  cep: '',
  endereco: '',
  bairro: '',
  estado: '',
  cidade: '',
}

/**
 * Cadastro de cliente. O CEP puxa o resto do endereco no ViaCEP; a lista de
 * estados e de cidades vem do IBGE. Se alguma API falhar, os campos seguem
 * editaveis na mao — o cadastro nunca fica preso.
 */
export default function ModalCliente({ aberto, cliente = null, aoFechar, aoSalvar }) {
  const { setores } = useDados()
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [estados, setEstados] = useState([])
  const [cidades, setCidades] = useState([])
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [avisoCEP, setAvisoCEP] = useState('')

  /* abre limpo (ou com o cliente que veio para edicao) */
  useEffect(() => {
    if (aberto) {
      setForm(cliente ? { ...VAZIO, ...cliente, setorId: cliente.setorId ?? '' } : VAZIO)
      setErros({})
      setAvisoCEP('')
    }
  }, [aberto, cliente])

  /* estados: uma vez so, na primeira abertura */
  useEffect(() => {
    if (!aberto || estados.length > 0) return
    listarEstados()
      .then(setEstados)
      .catch(() => setEstados([]))
  }, [aberto, estados.length])

  /* cidades acompanham o estado escolhido */
  useEffect(() => {
    if (!form.estado) {
      setCidades([])
      return
    }
    let valido = true
    listarCidades(form.estado)
      .then((lista) => valido && setCidades(lista))
      .catch(() => valido && setCidades([]))
    return () => {
      valido = false
    }
  }, [form.estado])

  const mudar = (campo) => (evento) => {
    const valor = evento?.target ? evento.target.value : evento
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  /* trocar o estado na mao invalida a cidade que estava escolhida */
  const mudarEstado = (evento) => {
    const sigla = evento.target.value
    setForm((atual) => ({ ...atual, estado: sigla, cidade: '' }))
    setErros((atual) => ({ ...atual, estado: undefined }))
  }

  const mudarCEP = async (evento) => {
    const formatado = formatarCEP(evento.target.value)
    setForm((atual) => ({ ...atual, cep: formatado }))
    setErros((atual) => ({ ...atual, cep: undefined }))
    setAvisoCEP('')

    const digitos = formatado.replace(/\D/g, '')
    if (digitos.length !== 8) return

    setBuscandoCEP(true)
    try {
      const achado = await buscarCEP(digitos)
      if (!achado) {
        setAvisoCEP('CEP não encontrado — preencha o endereço manualmente.')
        return
      }
      /* o CEP manda no endereco inteiro: assim cidade e estado nunca
         ficam contradizendo o CEP digitado */
      setForm((atual) => ({ ...atual, ...achado }))
      setAvisoCEP('Endereço preenchido pelo CEP.')
    } catch {
      setAvisoCEP('Não foi possível consultar o CEP agora.')
    } finally {
      setBuscandoCEP(false)
    }
  }

  const enviar = (evento) => {
    evento.preventDefault()

    const novosErros = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe o nome da empresa.'
    if (!form.cidade.trim()) novosErros.cidade = 'Informe a cidade.'
    if (!form.estado) novosErros.estado = 'Escolha o estado.'

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    aoSalvar(form)
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={cliente ? 'Editar cliente' : 'Novo cliente'}
      subtitulo="Os dados aparecem no card de toda obra desta empresa."
      largura={600}
    >
      <form className="formcli" onSubmit={enviar} noValidate>
        <CampoFoto
          rotulo="Logo da empresa"
          nome={form.nome}
          valor={form.logo}
          aoMudar={mudar('logo')}
          dica="Aparece no canto do card da obra."
        />

        <CampoTexto
          rotulo="Nome da empresa"
          largo
          placeholder="Razão social ou nome fantasia"
          value={form.nome}
          onChange={mudar('nome')}
          erro={erros.nome}
        />

        {/* O ramo da empresa. A lista sai do botao "Setores" na tela de
            Clientes — aqui so se escolhe entre o que ja existe, para nao
            nascer "Farmaceutico" e "farmaceutica" como dois setores. */}
        <CampoSelecao
          rotulo="Setor"
          value={form.setorId ?? ''}
          onChange={mudar('setorId')}
          vazio={
            setores.length === 0
              ? 'Nenhum setor cadastrado ainda'
              : 'Sem setor'
          }
          opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome, cor: s.cor }))}
        />

        <CampoTexto
          rotulo="CEP"
          inputMode="numeric"
          placeholder="00000-000"
          value={form.cep}
          onChange={mudarCEP}
          dica={buscandoCEP ? 'Consultando...' : avisoCEP || 'Preenche o resto sozinho.'}
        />

        <CampoTexto
          rotulo="Endereço"
          placeholder="Rua e número"
          value={form.endereco}
          onChange={mudar('endereco')}
        />

        <CampoTexto
          rotulo="Bairro"
          placeholder="Bairro"
          value={form.bairro}
          onChange={mudar('bairro')}
        />

        <CampoSelecao
          rotulo="Estado"
          value={form.estado}
          onChange={mudarEstado}
          erro={erros.estado}
          vazio={estados.length === 0 ? 'Carregando...' : 'Escolha o estado...'}
          opcoes={estados.map((e) => ({ valor: e.sigla, rotulo: `${e.sigla} — ${e.nome}` }))}
        />

        {/* sem lista do IBGE (offline ou API fora), vira campo livre */}
        {cidades.length > 0 ? (
          <CampoSelecao
            rotulo="Cidade"
            value={form.cidade}
            onChange={mudar('cidade')}
            erro={erros.cidade}
            vazio="Escolha a cidade..."
            opcoes={cidades.map((c) => ({ valor: c, rotulo: c }))}
          />
        ) : (
          <CampoTexto
            rotulo="Cidade"
            placeholder={form.estado ? 'Carregando cidades...' : 'Escolha o estado antes'}
            value={form.cidade}
            onChange={mudar('cidade')}
            erro={erros.cidade}
          />
        )}

        <footer className="formobra__acoes">
          <button type="button" className="formobra__cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <Button type="submit">{cliente ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
        </footer>
      </form>
    </Modal>
  )
}
