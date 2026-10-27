'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Bot,
  MessageSquare,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  TrendingDown,
  RefreshCw,
  Check,
  HelpCircle,
  Plus,
  X,
  Play,
  Pause,
  RotateCcw,
  Phone,
  UserCheck,
  ShieldCheck,
  FileText,
  Download,
  CheckCheck,
  Ban,
  Mic,
  Image as ImageIcon,
  Layers
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { toast } from '@/components/Toast'

interface DgennyCotacaoTabProps {
  suprimento: any
  obra?: { id: string; nome: string; endereco?: string | null; cliente?: string | null } | null
  fornecedoresDisponiveis: Array<{
    id: string
    razao_social: string
    nome_fantasia?: string | null
    telefone?: string | null
    cnpj?: string | null
    responsavel?: string | null
    endereco?: string | null
  }>
  onSuprimentoUpdated: (updatedItem: any) => void
}

export function DgennyCotacaoTab({
  suprimento,
  obra,
  fornecedoresDisponiveis,
  onSuprimentoUpdated
}: DgennyCotacaoTabProps) {
  // Status da API dgenny + dados da conta JWA
  const [apiStatus, setApiStatus] = useState<{
    configured: boolean
    company?: any
    limits?: any
    whatsappNumbers?: any[]
    users?: Array<{ id: string; name: string; email: string; assistantName: string | null }>
    dgennySuppliers?: Array<{
      supplierId: string
      name: string
      contactName: string | null
      phone: string
      email: string | null
      cnpj: string | null
    }>
    catalogs?: {
      billingLocations?: any[]
      paymentMethods?: any[]
      deliveryLocations?: any[]
    }
    loading: boolean
    error?: string
  }>({
    configured: false,
    loading: true
  })

  // Cotação ativa vinculada e lista de cotações existentes na conta dgenny
  const [quotationId, setQuotationId] = useState<string | null>(null)
  const [quotationData, setQuotationData] = useState<any | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [cotacoesExistentes, setCotacoesExistentes] = useState<any[]>([])

  // Seletor de sub-aba quando há cotação ativa: 'comparativo' | 'conversas'
  const [subTabAtiva, setSubTabAtiva] = useState<'comparativo' | 'conversas'>('conversas')

  // Criação de nova cotação
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])
  const [buyerEmail, setBuyerEmail] = useState<string>('')
  const [frete, setFrete] = useState<'CIF' | 'FOB' | 'NEGOTIABLE' | 'INSTALLED'>('CIF')
  const [prazoDias, setPrazoDias] = useState<number>(3)
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>('A Combinar')
  const [politicaMarca, setPoliticaMarca] = useState<string>('aceita_equivalente')
  const [enderecoEntregaObra, setEnderecoEntregaObra] = useState<string>(
    obra?.endereco || suprimento?.obra_nome_manual || obra?.nome || ''
  )
  const [orientacaoDescargaObra, setOrientacaoDescargaObra] = useState<string>('')
  const [obsPorItem, setObsPorItem] = useState<Record<number, string>>({})
  const [anexosSelecionadosUrls, setAnexosSelecionadosUrls] = useState<string[]>([])
  const [observacaoIa, setObservacaoIa] = useState<string>('')
  const [dispararImediatamente, setDispararImediatamente] = useState<boolean>(true)
  const [criandoCotacao, setCriandoCotacao] = useState(false)

  // Adição manual rápida de fornecedor (Nome + WhatsApp)
  const [manualNome, setManualNome] = useState('')
  const [manualTelefone, setManualTelefone] = useState('')
  const [manualContato, setManualContato] = useState('')
  const [fornecedoresManuais, setFornecedoresManuais] = useState<
    Array<{ name: string; phone: string; contactName?: string }>
  >([])

  // Busca inteligente de fornecedores na região (Radar dgenny)
  const [abaBuscaAberta, setAbaBuscaAberta] = useState(false)
  const [termoBusca, setTermoBusca] = useState(suprimento?.titulo || '')
  const [localBusca, setLocalBusca] = useState(obra?.nome || 'São Paulo, SP')
  const [buscando, setBuscando] = useState(false)
  const [fornecedoresEncontrados, setFornecedoresEncontrados] = useState<any[]>([])

  // Central de Conversas WhatsApp (Split-Pane)
  const [chatSupplier, setChatSupplier] = useState<any | null>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [carregandoChat, setCarregandoChat] = useState(false)
  const [msgManual, setMsgManual] = useState('')
  const [enviandoManual, setEnviandoManual] = useState(false)
  const [togglingAi, setTogglingAi] = useState<string | null>(null)
  const [baixandoMidiaId, setBaixandoMidiaId] = useState<string | null>(null)
  const [reprocessandoOrcamento, setReprocessandoOrcamento] = useState(false)
  const [alterandoStatusNeg, setAlterandoStatusNeg] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)

  // Resposta a pergunta da IA
  const [respostaIa, setRespostaIa] = useState<Record<string, string>>({})
  const [enviandoRespostaIa, setEnviandoRespostaIa] = useState(false)

  // Concluir com vencedor / Ações da cotação
  const [concluindo, setConcluindo] = useState(false)
  const [executandoAcao, setExecutandoAcao] = useState(false)

  // Normaliza telefone para dígitos com DDI 55
  const normalizePhone = (raw: string) => {
    const digits = (raw || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55') && digits.length >= 12) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
  }

  // Lista consolidada de fornecedores (Sistema + Base dgenny + Manuais + Radar)
  const listaFornecedoresConsolidada = useMemo(() => {
    const map = new Map<
      string,
      {
        phone: string
        name: string
        contactName?: string | null
        cnpj?: string | null
        origem: 'sistema' | 'dgenny' | 'manual' | 'radar'
      }
    >()

    // 1. Fornecedores do sistema (Supabase)
    fornecedoresDisponiveis.forEach(f => {
      const phone = normalizePhone(f.telefone || '')
      if (phone.length >= 12) {
        map.set(phone, {
          phone,
          name: f.nome_fantasia || f.razao_social,
          contactName: f.responsavel || null,
          cnpj: f.cnpj,
          origem: 'sistema'
        })
      }
    })

    // 2. Fornecedores já salvos na conta dgenny da JWA
    ;(apiStatus.dgennySuppliers || []).forEach(ds => {
      const phone = normalizePhone(ds.phone || '')
      if (phone.length >= 12 && !map.has(phone)) {
        const displayName =
          ds.name && ds.name !== 'Compartilhado'
            ? ds.name
            : ds.contactName
            ? `${ds.contactName}${ds.cnpj ? ` (${ds.cnpj})` : ''}`
            : ds.cnpj
            ? `Fornecedor CNPJ ${ds.cnpj}`
            : `Fornecedor ${phone}`
        map.set(phone, {
          phone,
          name: displayName,
          contactName: ds.contactName,
          cnpj: ds.cnpj,
          origem: 'dgenny'
        })
      }
    })

    // 3. Fornecedores adicionados manualmente nesta sessão
    fornecedoresManuais.forEach(m => {
      const phone = normalizePhone(m.phone)
      if (phone.length >= 12) {
        map.set(phone, {
          phone,
          name: m.name,
          contactName: m.contactName,
          origem: 'manual'
        })
      }
    })

    // 4. Fornecedores encontrados no Radar regional e selecionados
    fornecedoresEncontrados.forEach(fn => {
      const phone = normalizePhone(fn.phone || '')
      if (phone.length >= 12 && !map.has(phone)) {
        map.set(phone, {
          phone,
          name: fn.name,
          origem: 'radar'
        })
      }
    })

    return Array.from(map.values())
  }, [fornecedoresDisponiveis, apiStatus.dgennySuppliers, fornecedoresManuais, fornecedoresEncontrados])

  // 1. Verifica status da conexão com dgenny e carrega catálogos/usuários
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/dgenny/status')
        const data = await res.json()
        const users = data.users || []
        const defaultUser =
          users.find((u: any) => u.email?.toLowerCase().includes('victor')) ||
          users.find((u: any) => u.email?.toLowerCase().includes('kassio')) ||
          users[0]

        if (defaultUser?.email) {
          setBuyerEmail(defaultUser.email)
        }

        setApiStatus({
          configured: Boolean(data.configured),
          company: data.company,
          limits: data.limits,
          whatsappNumbers: data.whatsappNumbers || [],
          users,
          dgennySuppliers: data.dgennySuppliers || [],
          catalogs: data.catalogs,
          loading: false,
          error: data.error
        })
      } catch (err: any) {
        setApiStatus({ configured: false, loading: false, error: err?.message })
      }
    }
    checkStatus()
    fetch('/api/dgenny/quotations')
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.items)) {
          setCotacoesExistentes(d.items)
        }
      })
      .catch(() => {})
  }, [])

  // 2. Identifica se o suprimento já possui cotação dgenny no histórico (ou casamento automático pelo código/título) e sincroniza endereço/anexos
  useEffect(() => {
    if (!suprimento) return
    setEnderecoEntregaObra(obra?.endereco || suprimento?.obra_nome_manual || obra?.nome || '')
    const anexosAtuais = Array.isArray(suprimento.anexos) ? suprimento.anexos : []
    setAnexosSelecionadosUrls(anexosAtuais.slice(0, 3).map((a: any) => a.url).filter(Boolean))

    const historico = Array.isArray(suprimento.historico_atividades) ? suprimento.historico_atividades : []
    const atividadeDgenny = historico.find(
      (a: any) => a.dgenny_quotation_id || (a.acao === 'dgenny_cotacao_iniciada' && a.dgenny_quotation_id)
    )
    if (atividadeDgenny?.dgenny_quotation_id) {
      setQuotationId(atividadeDgenny.dgenny_quotation_id)
      return
    }

    // Tenta casar pelo código ou título do card nas cotações já abertas na dgenny
    const cod = (suprimento.codigo || '').trim().toLowerCase()
    const tit = (suprimento.titulo || '').trim().toLowerCase()
    const matchExistente = cotacoesExistentes.find((q: any) => {
      const qName = (q.name || '').toLowerCase()
      if (cod && cod.length >= 4 && qName.includes(cod)) return true
      if (tit && tit.length >= 6 && (qName.includes(tit) || tit.includes(qName))) return true
      return false
    })

    if (matchExistente?.id) {
      setQuotationId(matchExistente.id)
    } else {
      setQuotationId(null)
      setQuotationData(null)
    }
  }, [suprimento, obra, cotacoesExistentes])

  // 3. Carrega os dados da cotação se houver ID
  const carregarDadosCotacao = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoadingData(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${id}`)
      const data = await res.json()
      if (data.ok) {
        setQuotationData(data)
        const negsList = data.negotiations || []
        if (negsList.length > 0) {
          setChatSupplier((prev: any) => {
            if (!prev) return negsList[0]
            const updated = negsList.find((n: any) => n.supplierId === prev.supplierId)
            return updated || prev
          })
        }
      } else if (!silent) {
        toast(data.message || 'Erro ao consultar cotação dgenny', 'warning')
      }
    } catch {
      if (!silent) toast('Falha ao comunicar com dgenny', 'error')
    } finally {
      if (!silent) setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (quotationId) {
      carregarDadosCotacao(quotationId)
    }
  }, [quotationId, carregarDadosCotacao])

  // Carregar mensagens do fornecedor selecionado na Central de Conversas
  const carregarMensagensFornecedor = useCallback(
    async (supplierId: string, silent = false) => {
      if (!quotationId || !supplierId) return
      if (!silent) setCarregandoChat(true)
      try {
        const res = await fetch(
          `/api/dgenny/quotations/${quotationId}/messages?supplierId=${encodeURIComponent(supplierId)}`
        )
        const data = await res.json()
        if (data.ok) {
          setChatMessages(data.items || [])
        }
      } catch {
        if (!silent) toast('Erro ao buscar mensagens do fornecedor', 'error')
      } finally {
        if (!silent) setCarregandoChat(false)
      }
    },
    [quotationId]
  )

  // Quando muda o fornecedor selecionado ou entra na aba 'conversas', carrega as mensagens
  useEffect(() => {
    if (quotationId && chatSupplier?.supplierId && subTabAtiva === 'conversas') {
      carregarMensagensFornecedor(chatSupplier.supplierId)
    }
  }, [quotationId, chatSupplier?.supplierId, subTabAtiva, carregarMensagensFornecedor])

  // Scroll automático para o fim das mensagens
  useEffect(() => {
    if (subTabAtiva === 'conversas') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, subTabAtiva])

  // Adicionar fornecedor manual rápido
  const handleAdicionarFornecedorManual = () => {
    const phone = normalizePhone(manualTelefone)
    if (!manualNome.trim() || phone.length < 12) {
      toast('Informe o nome do fornecedor e o WhatsApp com DDD (ex: 11999999999).', 'warning')
      return
    }
    setFornecedoresManuais(prev => [
      ...prev.filter(f => normalizePhone(f.phone) !== phone),
      {
        name: manualNome.trim(),
        phone,
        contactName: manualContato.trim() || undefined
      }
    ])
    if (!selectedPhones.includes(phone)) {
      setSelectedPhones(prev => [...prev, phone])
    }
    setManualNome('')
    setManualTelefone('')
    setManualContato('')
    toast('Fornecedor adicionado e selecionado para a cotação.', 'success')
  }

  // Toggle seleção de fornecedor por telefone
  const togglePhoneSelection = (phone: string) => {
    setSelectedPhones(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    )
  }

  // Busca inteligente de fornecedores no Radar dgenny
  const handleBuscarFornecedores = async () => {
    if (!termoBusca.trim() || !localBusca.trim()) {
      toast('Informe o material/nicho e a cidade/UF para buscar.', 'warning')
      return
    }
    setBuscando(true)
    try {
      const res = await fetch('/api/dgenny/suppliers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: termoBusca.trim(),
          location: localBusca.trim(),
          limit: 8,
          includeNearbyCities: true
        })
      })
      const data = await res.json()
      if (data.ok) {
        setFornecedoresEncontrados(data.suppliers || [])
        toast(`${data.suppliers?.length || 0} fornecedores localizados na região.`, 'success')
      } else {
        toast(data.message || 'Erro na busca de fornecedores', 'error')
      }
    } catch {
      toast('Erro de rede na busca de fornecedores', 'error')
    } finally {
      setBuscando(false)
    }
  }

  // Disparo da cotação com IA
  const handleIniciarCotacao = async () => {
    const fornecedoresSelecionados = listaFornecedoresConsolidada.filter(f =>
      selectedPhones.includes(f.phone)
    )

    if (!fornecedoresSelecionados.length) {
      toast('Selecione ou adicione ao menos 1 fornecedor com WhatsApp.', 'warning')
      return
    }

    const checklist = Array.isArray(suprimento?.itens_checklist) ? suprimento.itens_checklist : []
    let itensParaCotar = []
    if (checklist.length > 0) {
      itensParaCotar = checklist.map((chk: any, idx: number) => ({
        description: chk.descricao,
        quantity: Number(chk.qtd_pedida || 1),
        unit: chk.unidade || 'UN',
        observation: obsPorItem[idx]?.trim() || undefined
      }))
    } else {
      itensParaCotar = [
        {
          description: suprimento.titulo,
          quantity: Number(suprimento.quantidade || 1),
          unit: suprimento.unidade || 'UN',
          estimatedPrice: suprimento.valor ? Number(suprimento.valor) : undefined,
          observation: obsPorItem[0]?.trim() || undefined
        }
      ]
    }

    const prazo = new Date(Date.now() + prazoDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const obraNomeFinal = suprimento.obra_nome_manual || obra?.nome || 'Canteiro JWA'
    const enderecoFinal = enderecoEntregaObra.trim() || obra?.endereco || obraNomeFinal

    const textoPoliticaMarca =
      politicaMarca === 'somente_especificada'
        ? 'Cotar estritamente a marca especificada nos itens (não aceitar similar).'
        : politicaMarca === 'consultar_antes'
        ? 'Caso o fornecedor ofereça marca similar/equivalente, perguntar ao comprador antes de aceitar.'
        : 'Aceita marca equivalente/similar de primeira linha com a mesma norma técnica.'

    const observacaoFinalCombinada = [textoPoliticaMarca, observacaoIa.trim()]
      .filter(Boolean)
      .join(' | ')

    const anexosCartao = Array.isArray(suprimento?.anexos) ? suprimento.anexos : []
    const documentosSelecionados = anexosCartao
      .filter((a: any) => a.url && anexosSelecionadosUrls.includes(a.url))
      .slice(0, 3)
      .map((a: any) => ({
        url: a.url,
        description: a.nome || 'Anexo Técnico do Pedido',
        filename: a.nome || undefined
      }))

    setCriandoCotacao(true)
    try {
      const res = await fetch('/api/dgenny/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suprimentoId: suprimento.id,
          codigo: suprimento.codigo || undefined,
          name: `${suprimento.codigo ? `${suprimento.codigo} - ` : ''}${suprimento.titulo} (${obraNomeFinal})`,
          observation: observacaoFinalCombinada || undefined,
          freight: frete,
          proposalDeadline: prazo,
          deliveryDeadline: suprimento.data_previsao_entrega || null,
          deliveryLocation: {
            externalId: obra?.id ? `OBRA-${obra.id.slice(0, 8)}` : 'OBRA-JWA',
            title: obraNomeFinal,
            address: enderecoFinal,
            observation: orientacaoDescargaObra.trim() || undefined
          },
          paymentMethod: {
            title: condicaoPagamento,
            description: condicaoPagamento
          },
          buyerEmail: buyerEmail || undefined,
          items: itensParaCotar,
          suppliers: fornecedoresSelecionados.map((f, idx) => ({
            externalId: `FORN-${idx + 1}-${f.phone}`,
            name: f.name,
            contactName: f.contactName || undefined,
            phone: f.phone
          })),
          documents: documentosSelecionados.length > 0 ? documentosSelecionados : undefined,
          startImmediately: dispararImediatamente,
          resend: true
        })
      })

      const data = await res.json()
      if (data.ok && data.quotation?.quotationId) {
        toast(
          dispararImediatamente
            ? 'Cotação criada e iniciada! A IA já está negociando no WhatsApp dos fornecedores.'
            : 'Cotação criada em rascunho na dgenny.',
          'success'
        )
        setQuotationId(data.quotation.quotationId)
        onSuprimentoUpdated({
          ...suprimento,
          status: 'Em Cotação'
        })
      } else {
        toast(data.message || 'Erro ao criar cotação na dgenny', 'error')
      }
    } catch {
      toast('Falha ao disparar cotação na dgenny', 'error')
    } finally {
      setCriandoCotacao(false)
    }
  }

  // Disparar cotação que estava em draft ou cancelar
  const handleAcaoCotacao = async (action: 'start' | 'cancel') => {
    if (!quotationId) return
    setExecutandoAcao(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (data.ok) {
        toast(
          action === 'start'
            ? 'Disparo iniciado no WhatsApp dos fornecedores!'
            : 'Cotação cancelada na dgenny.',
          'success'
        )
        carregarDadosCotacao(quotationId)
      } else {
        toast(data.message || 'Não foi possível executar a ação', 'warning')
      }
    } catch {
      toast('Erro ao comunicar com a dgenny', 'error')
    } finally {
      setExecutandoAcao(false)
    }
  }

  // Pausar ou Retomar IA para um fornecedor específico
  const handleToggleAiSupplier = async (supplierId: string, currentlyPaused: boolean) => {
    if (!quotationId) return
    setTogglingAi(supplierId)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentlyPaused ? 'resume_ai' : 'pause_ai',
          supplierId
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast(
          currentlyPaused
            ? 'IA retomada para este fornecedor.'
            : 'IA pausada. Você pode conversar manualmente pelo WhatsApp.',
          'success'
        )
        if (chatSupplier?.supplierId === supplierId) {
          setChatSupplier((prev: any) => (prev ? { ...prev, aiPaused: data.aiPaused } : prev))
        }
        carregarDadosCotacao(quotationId, true)
      } else {
        toast(data.message || 'Erro ao alternar status da IA', 'warning')
      }
    } catch {
      toast('Falha ao alternar status da IA', 'error')
    } finally {
      setTogglingAi(null)
    }
  }

  // Interromper ou Reabrir negociação com fornecedor
  const handleAlterarStatusNegociacao = async (supplierId: string, action: 'interrupt' | 'reopen') => {
    if (!quotationId) return
    setAlterandoStatusNeg(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, supplierId })
      })
      const data = await res.json()
      if (data.ok) {
        toast(
          action === 'interrupt'
            ? 'Negociação interrompida com este fornecedor.'
            : 'Negociação reaberta com este fornecedor.',
          'success'
        )
        carregarDadosCotacao(quotationId, true)
      } else {
        toast(data.message || 'Não foi possível alterar a negociação', 'warning')
      }
    } catch {
      toast('Erro ao comunicar com a dgenny', 'error')
    } finally {
      setAlterandoStatusNeg(false)
    }
  }

  // Pedir para a IA reler a conversa e atualizar o orçamento do fornecedor
  const handleReprocessarOrcamento = async (supplierId: string) => {
    if (!quotationId) return
    setReprocessandoOrcamento(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprocess_budget', supplierId })
      })
      const data = await res.json()
      if (data.ok) {
        toast('A IA está relendo a conversa para atualizar o orçamento deste fornecedor.', 'success')
        setTimeout(() => carregarDadosCotacao(quotationId, true), 2500)
      } else {
        toast(data.message || 'Não foi possível reprocessar o orçamento', 'warning')
      }
    } catch {
      toast('Erro ao solicitar releitura de orçamento', 'error')
    } finally {
      setReprocessandoOrcamento(false)
    }
  }

  // Baixar ou abrir anexo (PDF, imagem, áudio, planilha) enviado pelo fornecedor no WhatsApp
  const handleAbrirMidiaMensagem = async (supplierId: string, messageId: string) => {
    if (!quotationId) return
    setBaixandoMidiaId(messageId)
    try {
      const res = await fetch(
        `/api/dgenny/quotations/${quotationId}/messages?supplierId=${encodeURIComponent(supplierId)}&messageId=${encodeURIComponent(messageId)}`
      )
      const data = await res.json()
      if (data.ok && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        toast(data.message || 'Não foi possível obter o arquivo desta mensagem.', 'warning')
      }
    } catch {
      toast('Falha ao buscar anexo na dgenny', 'error')
    } finally {
      setBaixandoMidiaId(null)
    }
  }

  // Selecionar fornecedor e abrir tela de conversas
  const selecionarConversaFornecedor = (neg: any) => {
    setChatSupplier(neg)
    setSubTabAtiva('conversas')
    carregarMensagensFornecedor(neg.supplierId)
  }

  // Enviar mensagem manual na conversa do WhatsApp
  const handleEnviarMensagemManual = async () => {
    if (!msgManual.trim() || !chatSupplier || !quotationId) return
    setEnviandoManual(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: chatSupplier.supplierId,
          text: msgManual.trim()
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast('Mensagem enviada no WhatsApp do fornecedor!', 'success')
        setChatMessages(prev => [
          ...prev,
          {
            id: data.messageId || String(Date.now()),
            author: 'operator',
            direction: 'out',
            kind: 'text',
            text: msgManual.trim(),
            sentAt: data.sentAt || new Date().toISOString(),
            status: 'sent'
          }
        ])
        setMsgManual('')
      } else {
        toast(data.message || 'Erro ao enviar mensagem', 'error')
      }
    } catch {
      toast('Falha de envio', 'error')
    } finally {
      setEnviandoManual(false)
    }
  }

  // Responder dúvida da IA
  const handleResponderIa = async (supplierId: string, questionId: string) => {
    const texto = respostaIa[questionId]?.trim()
    if (!texto) {
      toast('Digite uma instrução para a IA.', 'warning')
      return
    }
    setEnviandoRespostaIa(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          questionId,
          text: texto
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast('Instrução enviada! A IA continuará negociando com base na sua orientação.', 'success')
        setRespostaIa(prev => ({ ...prev, [questionId]: '' }))
        if (quotationId) carregarDadosCotacao(quotationId, true)
      } else {
        toast(data.message || 'Erro ao responder IA', 'error')
      }
    } catch {
      toast('Falha ao enviar resposta à IA', 'error')
    } finally {
      setEnviandoRespostaIa(false)
    }
  }

  // Fechar cotação com vencedor
  const handleConcluirVencedor = async (supplierId: string, supplierName: string, total: string, paymentMethod?: string, freight?: string, deliveryTerm?: string) => {
    if (!quotationId) return
    setConcluindo(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suprimentoId: suprimento.id,
          winnerSupplierId: supplierId,
          winnerSupplierName: supplierName,
          finalPrice: parseFloat(total),
          paymentMethod,
          freight,
          deliveryTerm
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast(`Cotação fechada com ${supplierName}! Suprimento movido para Aprovação.`, 'success')
        onSuprimentoUpdated({
          ...suprimento,
          status: 'Aprovação',
          fornecedor: supplierName,
          valor: parseFloat(total),
          condicao_pagamento: paymentMethod || suprimento.condicao_pagamento,
          tipo_frete: freight && parseFloat(freight) > 0 ? `Frete R$ ${freight}` : (suprimento.tipo_frete || 'CIF (Incluso)')
        })
        carregarDadosCotacao(quotationId)
      } else {
        toast(data.message || 'Erro ao encerrar cotação', 'error')
      }
    } catch {
      toast('Falha ao registrar vencedor', 'error')
    } finally {
      setConcluindo(false)
    }
  }

  const defaultWhatsApp = apiStatus.whatsappNumbers?.[0]

  // Helper de tradução de status da negociação
  const getNegotiationStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Orçamento Recebido', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)' }
      case 'active':
        return { label: 'Em Conversa', color: C.amber, bg: 'rgba(245, 158, 11, 0.14)' }
      case 'queued':
        return { label: 'Na Fila de Disparo', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)' }
      case 'scheduled':
        return { label: 'Disparo Agendado', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' }
      case 'on_hold':
        return { label: 'Aguardando Vez', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' }
      case 'interrupted':
        return { label: 'Interrompida', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)' }
      case 'failed':
        return { label: 'Falha no WhatsApp', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)' }
      default:
        return { label: 'Não Iniciada', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' }
    }
  }

  // ─── RENDER: CARREGANDO STATUS ──────────────────────────────────────────────
  if (apiStatus.loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: C.inkSoft, fontSize: 12 }}>
        Conectando à plataforma dgenny (JWA S.A.)...
      </div>
    )
  }

  // ─── RENDER: API NÃO CONFIGURADA ───────────────────────────────────────────
  if (!apiStatus.configured) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 12,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.12)',
            color: C.amber,
            marginBottom: 12
          }}
        >
          <Bot size={32} />
        </div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 800, color: C.ink }}>
          Conexão dgenny (IA de Cotação)
        </h4>
        <p style={{ margin: '0 auto 16px auto', maxWidth: 440, fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
          A API oficial da <strong>dgenny</strong> automatiza a cotação com múltiplos fornecedores diretamente pelo WhatsApp e gera uma matriz comparativa com IA.
        </p>
        {apiStatus.error && (
          <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 12 }}>
            Detalhe: {apiStatus.error}
          </div>
        )}
      </div>
    )
  }

  // ─── RENDER: COTAÇÃO ATIVA (MAPA COMPARATIVO + TELA DE CONVERSAS WHATSAPP) ─
  if (quotationId) {
    const cotacao = quotationData?.quotation
    const negs = quotationData?.negotiations || []
    const comp = quotationData?.comparison
    const budgets = quotationData?.budgets || []
    const statusCotacao = cotacao?.status || 'active'
    const pendenciasCount = negs.filter((n: any) => n.pendingQuestion || n.unansweredFromSupplier).length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Barra de Identidade da Conta Conectada */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 6,
            fontSize: 11
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 700 }}>
            <CheckCircle2 size={13} />
            <span>
              Conectado: <strong>{apiStatus.company?.name || 'JWA S.A.'}</strong>
              {defaultWhatsApp ? ` · WhatsApp ${defaultWhatsApp.displayName || ''} (+${defaultWhatsApp.phone})` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {cotacoesExistentes.length > 1 && (
              <select
                aria-label="Trocar cotação ativa"
                value={quotationId || ''}
                onChange={e => {
                  if (e.target.value) setQuotationId(e.target.value)
                }}
                style={{
                  background: C.bgCard,
                  color: C.ink,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {cotacoesExistentes.map((q: any) => (
                  <option key={q.id} value={q.id}>
                    📲 {q.name} ({q.selectedSuppliersCount || q.suppliersCount || 0} forn.)
                  </option>
                ))}
              </select>
            )}
          <button
            type="button"
            onClick={() => {
              setQuotationId(null)
              setQuotationData(null)
            }}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.inkSoft,
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
            title="Iniciar uma nova rodada de cotação para este pedido"
          >
            <RotateCcw size={10} /> + Criar Nova Cotação
          </button>
          </div>
        </div>

        {/* Banner do Status da Cotação */}
        <div
          style={{
            padding: '12px 14px',
            background: C.bgWhite,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: statusCotacao === 'completed' ? C.greenDim : C.amberDim,
                color: statusCotacao === 'completed' ? C.green : C.amber,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{cotacao?.name || `Cotação #${quotationId.slice(0, 8)}`}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    background:
                      statusCotacao === 'completed'
                        ? C.greenDim
                        : statusCotacao === 'draft'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : C.amberDim,
                    color:
                      statusCotacao === 'completed'
                        ? C.green
                        : statusCotacao === 'draft'
                        ? '#3B82F6'
                        : C.amber
                  }}
                >
                  {statusCotacao === 'completed'
                    ? 'Concluída'
                    : statusCotacao === 'draft'
                    ? 'Rascunho (Aguardando Disparo)'
                    : statusCotacao === 'cancelled'
                    ? 'Cancelada'
                    : 'Negociando no WhatsApp'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>
                {negs.length || cotacao?.suppliers?.length || 0} fornecedor(es) · Frete: {cotacao?.conditions?.freight || 'CIF'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {statusCotacao === 'draft' && (
              <button
                type="button"
                onClick={() => handleAcaoCotacao('start')}
                disabled={executandoAcao}
                style={{
                  background: '#10B981',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Play size={12} /> Disparar WhatsApp Agora
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                carregarDadosCotacao(quotationId)
                if (subTabAtiva === 'conversas' && chatSupplier?.supplierId) {
                  carregarMensagensFornecedor(chatSupplier.supplierId)
                }
              }}
              disabled={loadingData}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: C.ink,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={12} className={loadingData ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* ─── SELETOR DE VISÃO: MAPA COMPARATIVO vs CONVERSAS COM FORNECEDORES ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            background: C.bgPanel,
            padding: 4,
            borderRadius: 8,
            border: `1px solid ${C.border}`
          }}
        >
          <button
            type="button"
            onClick={() => setSubTabAtiva('comparativo')}
            style={{
              border: subTabAtiva === 'comparativo' ? `1px solid ${C.amber}` : '1px solid transparent',
              background: subTabAtiva === 'comparativo' ? C.bgCard : 'transparent',
              color: subTabAtiva === 'comparativo' ? C.amber : C.inkSoft,
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={14} />
            <span>Mapa Comparativo & Resumo</span>
            {comp?.suppliers?.length > 0 && (
              <span
                style={{
                  fontSize: 9.5,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontWeight: 800
                }}
              >
                {comp.suppliers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSubTabAtiva('conversas')
              if (!chatSupplier && negs.length > 0) {
                setChatSupplier(negs[0])
              }
            }}
            style={{
              border: subTabAtiva === 'conversas' ? '1px solid #10B981' : '1px solid transparent',
              background: subTabAtiva === 'conversas' ? C.bgCard : 'transparent',
              color: subTabAtiva === 'conversas' ? '#10B981' : C.inkSoft,
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <MessageSquare size={14} />
            <span>Conversas com Fornecedores (WhatsApp)</span>
            <span
              style={{
                fontSize: 9.5,
                background: pendenciasCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.08)',
                color: pendenciasCount > 0 ? C.amber : C.inkSoft,
                padding: '1px 6px',
                borderRadius: 10,
                fontWeight: 800
              }}
            >
              {negs.length}
            </span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            VISÃO 2: TELA DE CONVERSAS COM OS FORNECEDORES (SPLIT-PANE WHATSAPP)
           ═══════════════════════════════════════════════════════════════════════ */}
        {subTabAtiva === 'conversas' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr',
              height: 530,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: 'hidden'
            }}
          >
            {/* Coluna Esquerda: Lista de Fornecedores na Conversa */}
            <div
              style={{
                borderRight: `1px solid ${C.border}`,
                background: C.bgPanel,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: C.inkSoft,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Fornecedores ({negs.length})</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {negs.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 11, color: C.inkSoft, textAlign: 'center' }}>
                    Nenhum fornecedor em negociação ainda.
                  </div>
                ) : (
                  negs.map((n: any) => {
                    const isSelected = chatSupplier?.supplierId === n.supplierId
                    const st = getNegotiationStatusInfo(n.status)
                    const budgetForn = budgets.find((b: any) => b.supplierId === n.supplierId)

                    return (
                      <div
                        key={n.supplierId}
                        onClick={() => selecionarConversaFornecedor(n)}
                        style={{
                          padding: '10px 10px',
                          borderBottom: `1px solid ${C.border}`,
                          background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          borderLeft: isSelected ? '3px solid #10B981' : '3px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 800,
                              color: C.ink,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {n.name || `+${n.phone}`}
                          </span>
                          {n.lastMessageAt && (
                            <span style={{ fontSize: 9, color: C.inkSoft, flexShrink: 0 }}>
                              {new Date(n.lastMessageAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 10, color: C.inkSoft }}>+{n.phone}</div>

                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: st.bg,
                              color: st.color
                            }}
                          >
                            {st.label}
                          </span>

                          {n.aiPaused && (
                            <span
                              style={{
                                fontSize: 8.5,
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: 3,
                                background: 'rgba(239, 68, 68, 0.16)',
                                color: '#EF4444'
                              }}
                            >
                              IA PAUSADA
                            </span>
                          )}

                          {n.pendingQuestion && (
                            <span
                              style={{
                                fontSize: 8.5,
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: 3,
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: C.amber
                              }}
                            >
                              DÚVIDA IA
                            </span>
                          )}

                          {n.unansweredFromSupplier && (
                            <span
                              style={{
                                fontSize: 8.5,
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: 3,
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: '#3B82F6'
                              }}
                            >
                              RESPONDEU
                            </span>
                          )}

                          {budgetForn?.total && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                color: '#10B981',
                                fontFamily: 'monospace'
                              }}
                            >
                              R$ {Number(budgetForn.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Coluna Direita: Conversa Ativa no WhatsApp */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {!chatSupplier ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: C.inkSoft,
                    fontSize: 12,
                    padding: 20,
                    textAlign: 'center'
                  }}
                >
                  Selecione um fornecedor à esquerda para visualizar e interagir na conversa do WhatsApp.
                </div>
              ) : (
                <>
                  {/* Cabeçalho da Conversa */}
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#075E54',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{chatSupplier.name}</span>
                        <span
                          style={{
                            fontSize: 9,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: chatSupplier.aiPaused ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                            color: '#FFF',
                            fontWeight: 800
                          }}
                        >
                          {chatSupplier.aiPaused ? 'Modo Manual (IA Pausada)' : 'IA Ativa'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
                        WhatsApp +{chatSupplier.phone} · {getNegotiationStatusInfo(chatSupplier.status).label}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => carregarMensagensFornecedor(chatSupplier.supplierId)}
                        disabled={carregandoChat}
                        style={{
                          background: 'rgba(255,255,255,0.14)',
                          border: '1px solid rgba(255,255,255,0.25)',
                          color: '#FFF',
                          borderRadius: 4,
                          padding: '4px 7px',
                          fontSize: 9.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                        title="Atualizar mensagens desta conversa"
                      >
                        <RefreshCw size={10} className={carregandoChat ? 'animate-spin' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReprocessarOrcamento(chatSupplier.supplierId)}
                        disabled={reprocessandoOrcamento}
                        style={{
                          background: 'rgba(255,255,255,0.14)',
                          border: '1px solid rgba(255,255,255,0.25)',
                          color: '#FFF',
                          borderRadius: 4,
                          padding: '4px 7px',
                          fontSize: 9.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Pedir para a IA reler a conversa e atualizar os preços do orçamento"
                      >
                        <Sparkles size={10} />
                        <span>{reprocessandoOrcamento ? 'Relendo...' : 'Reler Orçamento'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleAiSupplier(chatSupplier.supplierId, Boolean(chatSupplier.aiPaused))}
                        disabled={togglingAi === chatSupplier.supplierId}
                        style={{
                          background: chatSupplier.aiPaused ? '#10B981' : 'rgba(255,255,255,0.18)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          color: '#FFF',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 9.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {chatSupplier.aiPaused ? <Play size={10} /> : <Pause size={10} />}
                        <span>{chatSupplier.aiPaused ? 'Retomar IA' : 'Pausar IA'}</span>
                      </button>

                      {chatSupplier.status === 'interrupted' || chatSupplier.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => handleAlterarStatusNegociacao(chatSupplier.supplierId, 'reopen')}
                          disabled={alterandoStatusNeg}
                          style={{
                            background: 'rgba(255,255,255,0.14)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            color: '#FFF',
                            borderRadius: 4,
                            padding: '4px 7px',
                            fontSize: 9.5,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          title="Reabrir negociação com este fornecedor"
                        >
                          Reabrir
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAlterarStatusNegociacao(chatSupplier.supplierId, 'interrupt')}
                          disabled={alterandoStatusNeg}
                          style={{
                            background: 'rgba(239, 68, 68, 0.3)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            color: '#FFF',
                            borderRadius: 4,
                            padding: '4px 7px',
                            fontSize: 9.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                          title="Interromper negociação com este fornecedor"
                        >
                          <Ban size={10} /> Parar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alerta de Pergunta Pendente da IA neste fornecedor */}
                  {chatSupplier.pendingQuestion && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(245, 158, 11, 0.14)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.amber, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <HelpCircle size={13} />
                        <span>A IA precisa da sua orientação para continuar com {chatSupplier.name}:</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.ink, fontStyle: 'italic' }}>
                        &ldquo;{chatSupplier.pendingQuestion.text}&rdquo;
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Responda para a IA (ex: Pode aceitar a marca equivalente)..."
                          value={respostaIa[chatSupplier.pendingQuestion.messageId] || ''}
                          onChange={e =>
                            setRespostaIa({
                              ...respostaIa,
                              [chatSupplier.pendingQuestion.messageId]: e.target.value
                            })
                          }
                          onKeyDown={e =>
                            e.key === 'Enter' &&
                            handleResponderIa(chatSupplier.supplierId, chatSupplier.pendingQuestion.messageId)
                          }
                          style={{
                            flex: 1,
                            background: C.bgWhite,
                            border: `1px solid ${C.border}`,
                            borderRadius: 5,
                            padding: '5px 8px',
                            fontSize: 11,
                            color: C.ink,
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleResponderIa(chatSupplier.supplierId, chatSupplier.pendingQuestion.messageId)
                          }
                          disabled={enviandoRespostaIa}
                          style={{
                            background: C.amber,
                            color: '#0A0A0A',
                            border: 'none',
                            borderRadius: 5,
                            padding: '5px 10px',
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Instruir IA
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Corpo do Histórico de Mensagens */}
                  <div
                    style={{
                      flex: 1,
                      padding: 12,
                      overflowY: 'auto',
                      background: '#ECE5DD',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    {carregandoChat ? (
                      <div style={{ textAlign: 'center', color: '#555', fontSize: 12, marginTop: 40 }}>
                        Carregando histórico do WhatsApp...
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#555', fontSize: 12, marginTop: 40 }}>
                        Nenhuma mensagem trocada ainda com este fornecedor.
                      </div>
                    ) : (
                      chatMessages.map((m: any) => {
                        // Cartão interno de sistema (resumo de fechamento ou aviso da IA)
                        if (m.kind === 'card' || m.author === 'system') {
                          return (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: 'center',
                                maxWidth: '88%',
                                background: '#FFF8E1',
                                border: '1px solid #FDE68A',
                                color: '#78350F',
                                padding: '6px 12px',
                                borderRadius: 6,
                                fontSize: 11,
                                textAlign: 'center',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase', marginBottom: 2 }}>
                                Registro do Sistema dgenny
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                            </div>
                          )
                        }

                        const isOut = m.direction === 'out'
                        const isAi = m.author === 'ai'
                        const isOperator = m.author === 'operator'

                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: isOut ? 'flex-end' : 'flex-start',
                              maxWidth: '82%',
                              background: isOut ? (isOperator ? '#D1E7FF' : '#DCF8C6') : '#FFFFFF',
                              color: '#111827',
                              padding: '7px 11px',
                              borderRadius: 8,
                              fontSize: 11.5,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.12)'
                            }}
                          >
                            {/* Identificação do Autor */}
                            <div
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: isOut ? (isOperator ? '#1D4ED8' : '#075E54') : '#B45309',
                                marginBottom: 3,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8
                              }}
                            >
                              <span>
                                {isOut
                                  ? isAi
                                    ? 'IA dgenny (JWA)'
                                    : 'Comprador JWA (Manual)'
                                  : chatSupplier.name || 'Fornecedor'}
                              </span>
                              {m.kind === 'template' && (
                                <span style={{ fontSize: 8.5, opacity: 0.75, fontWeight: 700 }}>
                                  ABERTURA OFICIAL
                                </span>
                              )}
                              {m.kind === 'audio' && (
                                <span style={{ fontSize: 8.5, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <Mic size={10} /> Áudio transcrito pela IA
                                </span>
                              )}
                              {m.kind === 'image' && (
                                <span style={{ fontSize: 8.5, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <ImageIcon size={10} /> Imagem lida pela IA
                                </span>
                              )}
                            </div>

                            {/* Texto da Mensagem */}
                            {m.text && (
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                {m.text}
                              </div>
                            )}

                            {/* Botão de Download / Visualização de Anexo (PDF, Planilha, Imagem, Áudio) */}
                            {m.media && (
                              <div
                                style={{
                                  marginTop: 6,
                                  padding: '6px 8px',
                                  background: 'rgba(0,0,0,0.05)',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: '#1F2937' }}>
                                  <FileText size={13} color="#075E54" />
                                  <span style={{ wordBreak: 'break-all' }}>
                                    {m.media.fileName || m.media.mime || 'Anexo enviado'}
                                  </span>
                                </div>
                                {m.media.hasContent && (
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirMidiaMensagem(chatSupplier.supplierId, m.id)}
                                    disabled={baixandoMidiaId === m.id}
                                    style={{
                                      background: '#075E54',
                                      color: '#FFF',
                                      border: 'none',
                                      borderRadius: 4,
                                      padding: '4px 8px',
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      flexShrink: 0
                                    }}
                                  >
                                    <Download size={10} />
                                    <span>{baixandoMidiaId === m.id ? 'Abrindo...' : 'Abrir'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Rodapé de Horário e Status de Entrega WhatsApp */}
                            <div
                              style={{
                                fontSize: 9,
                                color: '#6B7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 4,
                                marginTop: 4
                              }}
                            >
                              {m.sentAt && (
                                <span>
                                  {new Date(m.sentAt).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                              {isOut && m.status && (
                                <span
                                  style={{
                                    color: m.status === 'read' ? '#0284C7' : m.status === 'failed' ? '#EF4444' : '#6B7280',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2
                                  }}
                                >
                                  <CheckCheck size={11} />
                                  {m.status === 'read'
                                    ? 'Lida'
                                    : m.status === 'delivered'
                                    ? 'Entregue'
                                    : m.status === 'failed'
                                    ? 'Falhou'
                                    : 'Enviada'}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Barra de Envio de Mensagem Direta para o WhatsApp do Fornecedor */}
                  <div
                    style={{
                      padding: '8px 10px',
                      background: C.bgCard,
                      borderTop: `1px solid ${C.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder={`Escrever mensagem no WhatsApp para ${chatSupplier.name}...`}
                        value={msgManual}
                        onChange={e => setMsgManual(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEnviarMensagemManual()}
                        style={{
                          flex: 1,
                          background: C.bgWhite,
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          padding: '7px 10px',
                          fontSize: 11.5,
                          color: C.ink,
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleEnviarMensagemManual}
                        disabled={enviandoManual || !msgManual.trim()}
                        style={{
                          background: '#075E54',
                          color: '#FFF',
                          border: 0,
                          borderRadius: 6,
                          padding: '0 14px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Send size={13} />
                        <span>{enviandoManual ? 'Enviando...' : 'Enviar'}</span>
                      </button>
                    </div>
                    <div style={{ fontSize: 9.5, color: C.inkSoft, display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        Dica: Se quiser assumir a negociação sem interferência da IA, clique em <strong>Pausar IA</strong> no topo.
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════
             VISÃO 1: MAPA COMPARATIVO & RESUMO DAS NEGOCIAÇÕES
             ═══════════════════════════════════════════════════════════════════════ */
          <>
            {/* Alerta de Pergunta Pendente da IA (se houver) */}
            {negs.some((n: any) => n.pendingQuestion) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {negs
                  .filter((n: any) => n.pendingQuestion)
                  .map((n: any) => (
                    <div
                      key={n.supplierId}
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 8
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.amber, fontWeight: 800, fontSize: 12 }}>
                          <HelpCircle size={15} />
                          <span>Dúvida da IA com {n.name}:</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => selecionarConversaFornecedor(n)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: C.amber,
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Abrir conversa completa
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: C.ink, marginBottom: 8, fontStyle: 'italic' }}>
                        &ldquo;{n.pendingQuestion.text}&rdquo;
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Ex: Pode aceitar a marca similar; ou Negocie 5% de desconto..."
                          value={respostaIa[n.pendingQuestion.messageId] || ''}
                          onChange={e => setRespostaIa({ ...respostaIa, [n.pendingQuestion.messageId]: e.target.value })}
                          style={{
                            flex: 1,
                            background: C.bgCard,
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 11,
                            color: C.ink,
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleResponderIa(n.supplierId, n.pendingQuestion.messageId)}
                          disabled={enviandoRespostaIa}
                          style={{
                            background: C.amber,
                            color: '#000',
                            border: 0,
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Instruir IA
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* ─── MATRIZ COMPARATIVA DE PROPOSTAS ─── */}
            {comp && comp.suppliers && comp.suppliers.length > 0 && (
              <div
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: C.ink }}>
                    <TrendingDown size={16} color={C.green} />
                    <span>Mapa Comparativo de Propostas (dgenny IA)</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.inkSoft }}>
                    {comp.suppliers.length} proposta(s) recebidas
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left', color: C.inkSoft }}>
                        <th style={{ padding: '8px 10px', fontWeight: 800 }}>FORNECEDOR</th>
                        <th style={{ padding: '8px 10px', fontWeight: 800 }}>CONDIÇÃO</th>
                        <th style={{ padding: '8px 10px', fontWeight: 800 }}>FRETE</th>
                        <th style={{ padding: '8px 10px', fontWeight: 800 }}>PRAZO</th>
                        <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>TOTAL</th>
                        <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comp.suppliers.map((s: any) => {
                        const isBest = comp.bestTotalSupplierId === s.supplierId
                        return (
                          <tr
                            key={s.supplierId}
                            style={{
                              borderBottom: `1px solid ${C.border}`,
                              background: isBest ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '10px 10px' }}>
                              <div style={{ fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 5 }}>
                                {s.name}
                                {isBest && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 800,
                                      background: C.greenDim,
                                      color: C.green,
                                      padding: '1px 5px',
                                      borderRadius: 4
                                    }}
                                  >
                                    MENOR PREÇO
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: C.inkSoft }}>
                                {s.itemsQuoted} cotados {s.itemsMissing > 0 && `(${s.itemsMissing} faltantes)`}
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px', color: C.inkSoft }}>
                              {s.paymentMethod || 'A combinar'}
                            </td>
                            <td style={{ padding: '10px 10px', color: C.inkSoft }}>
                              {parseFloat(s.freight) > 0 ? `R$ ${s.freight}` : 'Incluso/CIF'}
                            </td>
                            <td style={{ padding: '10px 10px', color: C.inkSoft }}>
                              {s.deliveryTerm || 'A combinar'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: isBest ? C.green : C.ink, fontSize: 13 }}>
                              R$ {Number(s.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              {statusCotacao !== 'completed' ? (
                                <button
                                  type="button"
                                  onClick={() => handleConcluirVencedor(s.supplierId, s.name, s.total, s.paymentMethod, s.freight, s.deliveryTerm)}
                                  disabled={concluindo}
                                  style={{
                                    background: isBest ? C.green : C.bgWhite,
                                    color: isBest ? '#FFF' : C.ink,
                                    border: isBest ? 0 : `1px solid ${C.border}`,
                                    borderRadius: 5,
                                    padding: '5px 10px',
                                    fontSize: 10,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  <Check size={11} />
                                  Selecionar Vencedor
                                </button>
                              ) : (
                                <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700 }}>
                                  {cotacao?.suppliers?.find((sp: any) => sp.supplierId === s.supplierId)?.winner ? 'Vencedor' : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── STATUS DOS FORNECEDORES NA CONVERSA ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Andamento das Conversas no WhatsApp ({negs.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {negs.map((n: any) => {
                  const st = getNegotiationStatusInfo(n.status)

                  return (
                    <div
                      key={n.supplierId}
                      style={{
                        padding: '10px 12px',
                        background: C.bgCard,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: st.color
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 12, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{n.name}</span>
                            {n.aiPaused && (
                              <span style={{ fontSize: 9, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                                IA PAUSADA
                              </span>
                            )}
                            {n.hasBudget && (
                              <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                                PROPOSTA PRONTA
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: C.inkSoft }}>
                            {st.label} · +{n.phone}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleAiSupplier(n.supplierId, Boolean(n.aiPaused))}
                          disabled={togglingAi === n.supplierId}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${C.border}`,
                            borderRadius: 5,
                            padding: '5px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            color: n.aiPaused ? '#10B981' : C.inkSoft,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title={n.aiPaused ? 'Retomar negociação automática da IA' : 'Pausar IA para assumir conversa manualmente'}
                        >
                          {n.aiPaused ? <Play size={11} /> : <Pause size={11} />}
                          <span>{n.aiPaused ? 'Retomar IA' : 'Pausar IA'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => selecionarConversaFornecedor(n)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            borderRadius: 5,
                            padding: '5px 9px',
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#10B981',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <MessageSquare size={12} />
                          Abrir Conversa
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── RENDER: FORMULÁRIO DE NOVA COTAÇÃO ─────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Central Rápida: Cotações & Conversas no WhatsApp já em andamento na dgenny */}
      {cotacoesExistentes.length > 0 && (
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase' }}>
              <MessageSquare size={14} />
              <span>💬 Negociações no WhatsApp em Andamento ({cotacoesExistentes.length})</span>
            </div>
            <span style={{ fontSize: 10.5, color: C.inkSoft }}>
              Clique em uma cotação abaixo para acompanhar as conversas no WhatsApp ao vivo:
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cotacoesExistentes.slice(0, 8).map((q: any) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setSubTabAtiva('conversas')
                  setQuotationId(q.id)
                }}
                style={{
                  background: C.bgCard,
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.ink,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
                title="Abrir tela de conversas no WhatsApp e mapa comparativo desta cotação"
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: q.status === 'active' ? '#10B981' : C.amber }} />
                <span>{q.name}</span>
                <span style={{ fontSize: 9.5, color: '#06B6D4', background: 'rgba(6, 182, 212, 0.14)', padding: '1px 5px', borderRadius: 4 }}>
                  {q.selectedSuppliersCount || q.suppliersCount || 0} forn. no WhatsApp
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Status da Conta JWA Conectada */}
      <div
        style={{
          padding: '10px 12px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 11
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 700 }}>
          <ShieldCheck size={14} />
          <span>
            Empresa Conectada: <strong>{apiStatus.company?.name || 'JWA S.A.'}</strong>
          </span>
        </div>
        {defaultWhatsApp && (
          <div style={{ color: C.inkSoft, fontSize: 10.5 }}>
            WhatsApp Oficial: <strong style={{ color: C.ink }}>{defaultWhatsApp.displayName || 'JWA'} (+{defaultWhatsApp.phone})</strong>
          </div>
        )}
      </div>

      {/* Itens que serão cotados + Especificação/Marca por Item */}
      <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 8 }}>
          Materiais que serão enviados para cotação ({Array.isArray(suprimento?.itens_checklist) && suprimento.itens_checklist.length > 0 ? suprimento.itens_checklist.length : 1})
        </div>
        {Array.isArray(suprimento?.itens_checklist) && suprimento.itens_checklist.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suprimento.itens_checklist.map((chk: any, idx: number) => (
              <div
                key={chk.id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  borderBottom: `1px solid ${C.border}`,
                  paddingBottom: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ink }}>
                  <span style={{ fontWeight: 700 }}>{idx + 1}. {chk.descricao}</span>
                  <span style={{ fontWeight: 800, color: C.amber }}>{chk.qtd_pedida} {chk.unidade || 'UN'}</span>
                </div>
                <input
                  type="text"
                  placeholder="Marca de referência ou norma técnica deste item (Opcional - ex: Tigre / NBR 5648)"
                  value={obsPorItem[idx] || ''}
                  onChange={e => setObsPorItem(prev => ({ ...prev, [idx]: e.target.value }))}
                  style={{
                    width: '100%',
                    background: C.bgPanel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 10.5,
                    color: C.ink,
                    outline: 'none'
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ink }}>
              <span style={{ fontWeight: 700 }}>1. {suprimento.titulo}</span>
              <span style={{ fontWeight: 800, color: C.amber }}>{suprimento.quantidade || 1} {suprimento.unidade || 'UN'}</span>
            </div>
            <input
              type="text"
              placeholder="Marca de referência ou detalhe técnico do material (Opcional)"
              value={obsPorItem[0] || ''}
              onChange={e => setObsPorItem(prev => ({ ...prev, 0: e.target.value }))}
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 10.5,
                color: C.ink,
                outline: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Anexos Técnicos do Cartão para enviar no WhatsApp dos Fornecedores */}
      {Array.isArray(suprimento?.anexos) && suprimento.anexos.length > 0 && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>
            Anexos do Pedido para Enviar aos Fornecedores no WhatsApp (Máx. 3)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {suprimento.anexos.map((anx: any, idx: number) => {
              const checked = anexosSelecionadosUrls.includes(anx.url)
              return (
                <label
                  key={anx.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    background: checked ? 'rgba(16, 185, 129, 0.08)' : C.bgPanel,
                    border: `1px solid ${checked ? 'rgba(16, 185, 129, 0.35)' : C.border}`,
                    borderRadius: 5,
                    fontSize: 11,
                    color: C.ink,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setAnexosSelecionadosUrls(prev => {
                          if (prev.includes(anx.url)) return prev.filter(u => u !== anx.url)
                          if (prev.length >= 3) {
                            toast('A dgenny permite anexar no máximo 3 arquivos por cotação.', 'warning')
                            return prev
                          }
                          return [...prev, anx.url]
                        })
                      }}
                    />
                    <FileText size={13} color={C.amber} />
                    <span style={{ fontWeight: 700 }}>{anx.nome || `Anexo ${idx + 1}`}</span>
                  </div>
                  <span style={{ fontSize: 9.5, color: C.inkSoft }}>Enviar via IA</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Seleção de Fornecedores (Sistema + Base dgenny JWA) */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: C.inkSoft }}>
            1. Selecionar Fornecedores ({selectedPhones.length} marcados)
          </label>
          {listaFornecedoresConsolidada.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (selectedPhones.length === listaFornecedoresConsolidada.length) {
                  setSelectedPhones([])
                } else {
                  setSelectedPhones(listaFornecedoresConsolidada.map(f => f.phone))
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: C.amber,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {selectedPhones.length === listaFornecedoresConsolidada.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          )}
        </div>

        <div
          style={{
            maxHeight: 165,
            overflowY: 'auto',
            background: C.bgPanel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          {listaFornecedoresConsolidada.length === 0 ? (
            <div style={{ padding: 10, fontSize: 11, color: C.inkSoft, textAlign: 'center' }}>
              Nenhum fornecedor com telefone cadastrado. Adicione abaixo ou use o Radar por Região.
            </div>
          ) : (
            listaFornecedoresConsolidada.map(f => {
              const isSelected = selectedPhones.includes(f.phone)
              return (
                <label
                  key={f.phone}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(245, 158, 11, 0.35)' : 'transparent'}`,
                    cursor: 'pointer',
                    fontSize: 11,
                    color: C.ink
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePhoneSelection(f.phone)}
                    />
                    <div>
                      <span style={{ fontWeight: 700 }}>{f.name}</span>
                      <span style={{ color: C.inkSoft, marginLeft: 6, fontSize: 10.5 }}>+{f.phone}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '1px 5px',
                      borderRadius: 3,
                      background:
                        f.origem === 'sistema'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : f.origem === 'dgenny'
                          ? 'rgba(139, 92, 246, 0.12)'
                          : 'rgba(59, 130, 246, 0.12)',
                      color:
                        f.origem === 'sistema'
                          ? '#10B981'
                          : f.origem === 'dgenny'
                          ? '#8B5CF6'
                          : '#3B82F6'
                    }}
                  >
                    {f.origem === 'sistema' ? 'Sistema' : f.origem === 'dgenny' ? 'Base dgenny' : f.origem === 'radar' ? 'Radar IA' : 'Manual'}
                  </span>
                </label>
              )
            })
          )}
        </div>

        {/* Adicionar Fornecedor Manual Rápido */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Phone size={11} /> Incluir Fornecedor Avulso por WhatsApp
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Nome da empresa / fornecedor"
              value={manualNome}
              onChange={e => setManualNome(e.target.value)}
              style={{
                flex: 1,
                minWidth: 130,
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                outline: 'none'
              }}
            />
            <input
              type="text"
              placeholder="WhatsApp (ex: 11999999999)"
              value={manualTelefone}
              onChange={e => setManualTelefone(e.target.value)}
              style={{
                width: 155,
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={handleAdicionarFornecedorManual}
              style={{
                background: C.amber,
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Plus size={12} /> Incluir
            </button>
          </div>
        </div>
      </div>

      {/* Widget de Busca Inteligente por Região (Radar IA) */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div
          onClick={() => setAbaBuscaAberta(!abaBuscaAberta)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 12,
            color: C.ink
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} color={C.amber} />
            <span>Radar de Novos Fornecedores por Região (dgenny IA)</span>
          </div>
          <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>
            {abaBuscaAberta ? 'Ocultar' : 'Buscar novos na região'}
          </span>
        </div>

        {abaBuscaAberta && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Material / Especialidade</label>
                <input
                  type="text"
                  value={termoBusca}
                  onChange={e => setTermoBusca(e.target.value)}
                  placeholder="Ex: ferramentas, cimento, elétrica..."
                  style={{
                    width: '100%',
                    background: C.bgPanel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: '6px 8px',
                    fontSize: 11,
                    color: C.ink,
                    marginTop: 3
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Cidade / UF da Obra</label>
                <input
                  type="text"
                  value={localBusca}
                  onChange={e => setLocalBusca(e.target.value)}
                  placeholder="Ex: São Paulo, SP ou Recife, PE"
                  style={{
                    width: '100%',
                    background: C.bgPanel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: '6px 8px',
                    fontSize: 11,
                    color: C.ink,
                    marginTop: 3
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleBuscarFornecedores}
              disabled={buscando}
              style={{
                background: C.bgPanel,
                border: `1px solid ${C.amber}`,
                borderRadius: 5,
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 800,
                color: C.amber,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Search size={12} className={buscando ? 'animate-spin' : ''} />
              {buscando ? 'Localizando fornecedores na região...' : 'Buscar Fornecedores com WhatsApp Verificado'}
            </button>

            {fornecedoresEncontrados.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {fornecedoresEncontrados.map((fn: any) => {
                  const phone = normalizePhone(fn.phone || '')
                  const marcado = selectedPhones.includes(phone)
                  return (
                    <div
                      key={phone}
                      onClick={() => togglePhoneSelection(phone)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 5,
                        background: marcado ? 'rgba(16, 185, 129, 0.08)' : C.bgPanel,
                        border: `1px solid ${marcado ? C.green : C.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: 11
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: C.ink }}>{fn.name}</div>
                        <div style={{ fontSize: 10, color: C.inkSoft }}>
                          {fn.distanceKm ? `${fn.distanceKm} km · ` : ''}{fn.address || `+${phone}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {fn.whatsappVerified && (
                          <span style={{ fontSize: 9, background: C.greenDim, color: C.green, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                            WhatsApp OK
                          </span>
                        )}
                        <input type="checkbox" checked={marcado} readOnly />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Condições da Cotação & Comprador Responsável */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>
          2. Parâmetros da Negociação com IA
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
              <UserCheck size={11} /> Comprador que Assina (dgenny)
            </label>
            <select
              value={buyerEmail}
              onChange={e => setBuyerEmail(e.target.value)}
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                marginTop: 4
              }}
            >
              {(apiStatus.users || []).map(u => (
                <option key={u.id} value={u.email}>
                  {u.name} ({u.email})
                </option>
              ))}
              {(!apiStatus.users || apiStatus.users.length === 0) && (
                <option value="victor@jwasa.com.br">Victor Wiziack Ajame (victor@jwasa.com.br)</option>
              )}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
              Condição de Pagamento
            </label>
            <select
              value={condicaoPagamento}
              onChange={e => setCondicaoPagamento(e.target.value)}
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                marginTop: 4
              }}
            >
              <option value="A Combinar">A Combinar (Opções do Fornecedor)</option>
              <option value="Boleto 28 dias">Boleto Faturado 28 dias</option>
              <option value="Boleto 14/28 dias">Boleto Faturado 14/28 dias</option>
              <option value="PIX à vista com desconto">PIX à vista (negociar desconto)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
              Modalidade de Frete
            </label>
            <select
              value={frete}
              onChange={e => setFrete(e.target.value as any)}
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                marginTop: 4
              }}
            >
              <option value="CIF">CIF (Entrega na Obra pelo Fornecedor)</option>
              <option value="FOB">FOB (Retirada pela Construtora)</option>
              <option value="NEGOTIABLE">Negociável</option>
              <option value="INSTALLED">Instalado no Local</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
              Prazo Limite das Propostas
            </label>
            <select
              value={prazoDias}
              onChange={e => setPrazoDias(Number(e.target.value))}
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                marginTop: 4
              }}
            >
              <option value={1}>24 horas (Urgente)</option>
              <option value={2}>48 horas (2 dias)</option>
              <option value={3}>3 dias (Recomendado)</option>
              <option value={5}>5 dias</option>
            </select>
          </div>
        </div>

        {/* Endereço Completo de Entrega da Obra + Orientação de Descarga */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
              Endereço Completo de Entrega da Obra (CEP, Rua, Cidade/UF) *
            </label>
            <input
              type="text"
              value={enderecoEntregaObra}
              onChange={e => setEnderecoEntregaObra(e.target.value)}
              placeholder="Ex: Av. Mascarenhas de Moraes, 1200, Imbiribeira, Recife/PE - CEP 51150-000"
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${!enderecoEntregaObra.trim() || enderecoEntregaObra.toLowerCase() === 'diversos' ? C.amber : C.border}`,
                borderRadius: 5,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                marginTop: 4
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
              Política de Marca Equivalente / Similar
            </label>
            <select
              value={politicaMarca}
              onChange={e => setPoliticaMarca(e.target.value)}
              style={{
                width: '100%',
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '6px 8px',
                fontSize: 11,
                color: C.ink,
                marginTop: 4
              }}
            >
              <option value="aceita_equivalente">Aceita equivalente de 1ª linha (normatizada)</option>
              <option value="consultar_antes">Consultar comprador antes de aceitar similar</option>
              <option value="somente_especificada">Somente marca especificada (não aceita similar)</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
            Restrições de Recebimento / Horário de Descarga no Canteiro (Opcional)
          </label>
          <input
            type="text"
            value={orientacaoDescargaObra}
            onChange={e => setOrientacaoDescargaObra(e.target.value)}
            placeholder="Ex: Recebimento seg a sex das 07h30 às 16h30; caminhão munck necessário; procurar almoxarife..."
            style={{
              width: '100%',
              background: C.bgPanel,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '6px 8px',
              fontSize: 11,
              color: C.ink,
              marginTop: 4
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkSoft }}>
            Observações Gerais / Instruções de Negociação para a IA (Opcional)
          </label>
          <input
            type="text"
            value={observacaoIa}
            onChange={e => setObservacaoIa(e.target.value)}
            placeholder="Ex: Confirmar disponibilidade para entrega imediata; pedir desconto para pagamento à vista..."
            style={{
              width: '100%',
              background: C.bgPanel,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '6px 8px',
              fontSize: 11,
              color: C.ink,
              marginTop: 4
            }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink, cursor: 'pointer', marginTop: 2 }}>
          <input
            type="checkbox"
            checked={dispararImediatamente}
            onChange={e => setDispararImediatamente(e.target.checked)}
          />
          <span>Disparar mensagens no WhatsApp imediatamente após criar</span>
        </label>
      </div>

      {/* Botão de Disparo */}
      <button
        type="button"
        onClick={handleIniciarCotacao}
        disabled={criandoCotacao}
        style={{
          background: C.amber,
          color: '#000',
          border: 0,
          borderRadius: 6,
          padding: '12px 16px',
          fontSize: 12,
          fontWeight: 900,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
        }}
      >
        <Sparkles size={16} />
        {criandoCotacao
          ? 'Conectando à dgenny e iniciando cotação...'
          : dispararImediatamente
          ? `Disparar Cotação IA no WhatsApp (${selectedPhones.length} fornecedor${selectedPhones.length === 1 ? '' : 'es'})`
          : `Salvar Rascunho de Cotação na dgenny (${selectedPhones.length} fornecedor${selectedPhones.length === 1 ? '' : 'es'})`}
      </button>
    </div>
  )
}
