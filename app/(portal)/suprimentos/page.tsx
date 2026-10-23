'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Package,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  DollarSign,
  Filter,
  Plus,
  Search,
  FileText,
  Check,
  ExternalLink,
  UploadCloud,
  X,
  ChevronRight,
  Eye,
  Trash2,
  Edit3,
  Layers,
  Settings2,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Building,
  Calendar,
  User,
  ShieldCheck,
  FileCheck2,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Share2,
  Bot,
  GripVertical
} from 'lucide-react'
import { PageTitle } from '@/components/PageTitle'
import { toast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/tokens'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useConfirm } from '@/hooks/useConfirm'
import { NotificationCenter } from '@/components/NotificationCenter'
import { SuprimentoCardDrawer, ColaboradorOption } from '@/components/SuprimentoCardDrawer'

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export interface SuprimentoItem {
  id: string
  codigo?: string | null
  obra_id: string | null
  obra_nome_manual?: string | null
  titulo: string
  quantidade: string | null
  unidade: string | null
  fornecedor: string | null
  valor: number | null
  status: 'Solicitado' | 'Em Cotação' | 'Aprovação' | 'Em Trânsito' | 'Entregue'
  data_vencimento: string | null
  solicitante: string | null
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  created_at: string
  responsavel_id?: string | null
  responsavel_nome?: string | null
  proximo_responsavel_id?: string | null
  proximo_responsavel_nome?: string | null
  itens_checklist?: any[]
  chat_mensagens?: any[]
  historico_atividades?: any[]
  anexos?: any[]
  data_previsao_entrega?: string | null
}

export interface ObraItem {
  id: string
  nome: string
  cliente?: string | null
  endereco?: string | null
}

export interface FornecedorItem {
  id: string
  razao_social: string
  nome_fantasia?: string | null
  cnpj?: string | null
  pix?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  telefone?: string | null
  responsavel?: string | null
  endereco?: string | null
  prazo_pagamento?: string | null
}

export interface ContaVinculada {
  id: string
  status: string
  valor: number
  data_vencimento: string
  pago_em?: string | null
  comprovante_url?: string | null
  observacoes?: string | null
  codigo_sequencial?: number | null
}

export interface MesaPersonalizada {
  id: string
  nome: string
  obra_id?: string
  prioridade?: string
  isDefault?: boolean
}

// ─── ESTILOS BASE ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.bgCard,
  color: C.ink,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: '8px 12px',
  outline: 'none',
  fontSize: 12,
  boxSizing: 'border-box'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: C.inkSoft,
  marginBottom: 5
}

const btnBase: React.CSSProperties = {
  border: 0,
  borderRadius: 5,
  padding: '8px 14px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'all 0.15s ease'
}

const COLUNAS_ESTEIRA: Array<{
  id: SuprimentoItem['status']
  nome: string
  descricao: string
  cor: string
  bg: string
  icone: any
}> = [
  { id: 'Solicitado', nome: '1. Solicitação da Obra', descricao: 'Pedidos abertos no canteiro', cor: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', icone: ShoppingCart },
  { id: 'Em Cotação', nome: '2. Em Cotação', descricao: 'Negociação com fornecedores', cor: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', icone: Layers },
  { id: 'Aprovação', nome: '3. Aguardando Aprovação', descricao: 'Alçada da diretoria', cor: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', icone: ShieldCheck },
  { id: 'Em Trânsito', nome: '4. Aprovado / Em Trânsito', descricao: 'Lançado no Financeiro', cor: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)', icone: Truck },
  { id: 'Entregue', nome: '5. Recebido no Canteiro', descricao: 'Conferido com foto/NF', cor: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icone: CheckCircle2 }
]

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function SuprimentosPage() {
  const { confirm, ConfirmDialog } = useConfirm()

  // Estados principais
  const [suprimentos, setSuprimentos] = useState<SuprimentoItem[]>([])
  const [obras, setObras] = useState<ObraItem[]>([])
  const [fornecedores, setFornecedores] = useState<FornecedorItem[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorOption[]>([])
  const [contasVinculadas, setContasVinculadas] = useState<Record<string, ContaVinculada>>({})
  const [loading, setLoading] = useState(true)
  const [colaboradorAtivo, setColaboradorAtivo] = useState<any>(null)

  // Drawer 360 do Card
  const [drawerItem, setDrawerItem] = useState<SuprimentoItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerInitialTab, setDrawerInitialTab] = useState<'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico'>('checklist')

  // Mesas e Filtros
  const [mesaAtiva, setMesaAtiva] = useState<string>('todas')
  const [mesasCustom, setMesasCustom] = useState<MesaPersonalizada[]>([])
  const [busca, setBusca] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas')
  const [filtroStatusFinanceiro, setFiltroStatusFinanceiro] = useState('todos')
  const [visao, setVisao] = useState<'esteira' | 'tabela'>('esteira')

  // Drag and Drop da Esteira
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<SuprimentoItem['status'] | null>(null)
  const justDraggedRef = useRef(false)
  const cardPointerDownRef = useRef<{ id: string; x: number; y: number; time: number } | null>(null)
  const lastDrawerOpenedTimeRef = useRef<number>(0)

  const handleAbrirCardDrawer = useCallback((item: SuprimentoItem, tab: 'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico' = 'checklist') => {
    const now = Date.now()
    if (now - lastDrawerOpenedTimeRef.current < 250) return
    lastDrawerOpenedTimeRef.current = now
    setDrawerInitialTab(tab)
    setDrawerItem(item)
    setDrawerOpen(true)
  }, [])

  // Modais
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [modalAprovarOpen, setModalAprovarOpen] = useState(false)
  const [modalReceberOpen, setModalReceberOpen] = useState(false)
  const [modalNovaMesaOpen, setModalNovaMesaOpen] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState<SuprimentoItem | null>(null)

  // Formulário Novo Pedido
  const [novoForm, setNovoForm] = useState({
    codigo: '',
    obra_id: '',
    obra_nome_manual: '',
    titulo: '',
    itens: [
      { id: 'item-1', descricao: '', quantidade: '', unidade: 'un' }
    ],
    fornecedor_id: '',
    valor: '',
    prioridade: 'media' as SuprimentoItem['prioridade'],
    data_vencimento: '',
    responsavel_id: '',
    responsavel_nome: '',
    proximo_responsavel_id: '',
    proximo_responsavel_nome: '',
    status: 'Solicitado' as SuprimentoItem['status']
  })
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  const handleAdicionarItemForm = () => {
    setNovoForm(prev => ({
      ...prev,
      itens: [...prev.itens, { id: `item-${Date.now()}-${prev.itens.length}`, descricao: '', quantidade: '', unidade: 'un' }]
    }))
  }

  const handleRemoverItemForm = (id: string) => {
    setNovoForm(prev => {
      if (prev.itens.length <= 1) return prev
      return {
        ...prev,
        itens: prev.itens.filter(it => it.id !== id)
      }
    })
  }

  const handleAtualizarItemForm = (id: string, campo: 'descricao' | 'quantidade' | 'unidade', valor: string) => {
    setNovoForm(prev => ({
      ...prev,
      itens: prev.itens.map(it => it.id === id ? { ...it, [campo]: valor } : it)
    }))
  }

  // Criação Rápida Direto na Coluna
  const [colunaCriacaoAtiva, setColunaCriacaoAtiva] = useState<SuprimentoItem['status'] | null>(null)
  const [quickTitulo, setQuickTitulo] = useState('')
  const [quickObraId, setQuickObraId] = useState('')
  const [quickPrioridade, setQuickPrioridade] = useState<SuprimentoItem['prioridade']>('media')
  const [salvandoQuick, setSalvandoQuick] = useState(false)

  // Formulário Aprovação Financeira
  const [aprovForm, setAprovForm] = useState({
    fornecedor_id: '',
    valor_final: '',
    data_vencimento: '',
    condicao_pagamento: '28 dias',
    anexo_file: null as File | null,
    anexo_url: '',
    lancar_financeiro: true,
    copiar_oc_ao_aprovar: true,
    enviar_oc_dgenny: true
  })
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)

  // Formulário Recebimento na Obra
  const [recebForm, setRecebForm] = useState({
    quantidade_recebida: '',
    observacao: '',
    foto_file: null as File | null
  })
  const [salvandoRecebimento, setSalvandoRecebimento] = useState(false)

  // Formulário Nova Mesa
  const [mesaForm, setMesaForm] = useState({
    nome: '',
    obra_id: '',
    prioridade: 'todas'
  })

  // ─── CARREGAMENTO DE DADOS ─────────────────────────────────────────────────

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const [
        { data: sups, error: supErr },
        { data: obs, error: obErr },
        { data: forns, error: fornErr },
        { data: contas, error: contasErr },
        { data: cols, error: colErr }
      ] = await Promise.all([
        supabase.from('suprimentos').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('obras').select('id, nome, cliente, endereco').order('nome'),
        supabase.from('fornecedores').select('id, razao_social, nome_fantasia, cnpj, pix, banco, agencia, conta, telefone, responsavel, endereco, prazo_pagamento').order('razao_social').limit(1000),
        supabase.from('contas').select('id, status, valor, data_vencimento, pago_em, comprovante_url, observacoes, codigo_sequencial').ilike('observacoes', '%Suprimentos ID:%').limit(2000),
        supabase.from('colaboradores').select('id, nome, cargo, email').order('nome')
      ])

      if (supErr) console.error('Erro suprimentos:', supErr)
      if (obErr) console.error('Erro obras:', obErr)
      if (fornErr) console.error('Erro fornecedores:', fornErr)
      if (colErr) console.error('Erro colaboradores:', colErr)

      if (sups) {
        setSuprimentos(sups as SuprimentoItem[])
        setDrawerItem(prev => {
          if (!prev) return null
          const found = (sups as SuprimentoItem[]).find(s => s.id === prev.id)
          return found || prev
        })

        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const cardId = urlParams.get('cardId')
          if (cardId) {
            const itemFromUrl = (sups as SuprimentoItem[]).find(s => s.id === cardId)
            if (itemFromUrl) {
              setDrawerItem(itemFromUrl)
              setDrawerOpen(true)
            }
          }
        }
      }
      if (obs) setObras(obs as ObraItem[])
      if (forns) setFornecedores(forns as FornecedorItem[])
      if (cols) setColaboradores(cols as ColaboradorOption[])

      // Mapear contas pelo suprimento_id salvo em observacoes
      const cMap: Record<string, ContaVinculada> = {}
      if (contas) {
        contas.forEach(c => {
          if (c.observacoes) {
            const match = c.observacoes.match(/Suprimentos ID:\s*([a-f0-9-]+)/i)
            if (match && match[1]) {
              cMap[match[1]] = c as ContaVinculada
            }
          }
        })
      }
      setContasVinculadas(cMap)
    } catch (e: any) {
      toast('Falha ao sincronizar dados de Suprimentos: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeSync(loadData, 'suprimentos-sync', ['suprimentos', 'contas', 'obras', 'fornecedores'])

  useEffect(() => {
    loadData()

    // Carregar usuário logado
    if (typeof window !== 'undefined') {
      const rawUser = localStorage.getItem('colaborador_sessao')
      if (rawUser) {
        try {
          const u = JSON.parse(rawUser)
          setColaboradorAtivo(u)
          setNovoForm(prev => ({ ...prev, solicitante: u.nome || '' }))
        } catch {}
      }

      // Carregar mesas personalizadas do localStorage
      const savedMesas = localStorage.getItem('jwa_suprimentos_mesas')
      if (savedMesas) {
        try { setMesasCustom(JSON.parse(savedMesas)) } catch {}
      }
    }
  }, [loadData])

  // ─── FILTROS & MESAS ───────────────────────────────────────────────────────

  const suprimentosFiltrados = useMemo(() => {
    return suprimentos.filter(item => {
      // 1. Filtro da Mesa Ativa
      if (mesaAtiva === 'minhas') {
        if (item.responsavel_id !== colaboradorAtivo?.id) return false
      } else if (mesaAtiva === 'urgentes') {
        if (item.prioridade !== 'alta' && item.prioridade !== 'urgente') return false
      } else if (mesaAtiva.startsWith('obra-')) {
        const targetObraId = mesaAtiva.replace('obra-', '')
        if (item.obra_id !== targetObraId) return false
      } else if (mesaAtiva !== 'todas') {
        // Mesa customizada
        const custom = mesasCustom.find(m => m.id === mesaAtiva)
        if (custom) {
          if (custom.obra_id && item.obra_id !== custom.obra_id) return false
          if (custom.prioridade && custom.prioridade !== 'todas' && item.prioridade !== custom.prioridade) return false
        }
      }

      // 2. Filtro de Texto (busca completa)
      if (busca.trim()) {
        const q = busca.toLowerCase().trim()
        const obraNome = obras.find(o => o.id === item.obra_id)?.nome?.toLowerCase() || ''
        const matchTitle = item.titulo?.toLowerCase().includes(q)
        const matchCodigo = item.codigo?.toLowerCase().includes(q)
        const matchId = item.id?.toLowerCase().includes(q)
        const matchForn = item.fornecedor?.toLowerCase().includes(q)
        const matchSol = item.solicitante?.toLowerCase().includes(q)
        const matchResp = item.responsavel_nome?.toLowerCase().includes(q)
        const matchProxResp = item.proximo_responsavel_nome?.toLowerCase().includes(q)
        const matchObra = obraNome.includes(q) || (item.obra_nome_manual && item.obra_nome_manual.toLowerCase().includes(q))
        const matchChecklist = Array.isArray(item.itens_checklist) && item.itens_checklist.some((c: any) => c.descricao?.toLowerCase().includes(q))
        if (!matchTitle && !matchCodigo && !matchId && !matchForn && !matchSol && !matchResp && !matchProxResp && !matchObra && !matchChecklist) return false
      }

      // 3. Filtro de Prioridade
      if (filtroPrioridade !== 'todas' && item.prioridade !== filtroPrioridade) return false

      // 4. Filtro de Status Financeiro
      if (filtroStatusFinanceiro !== 'todos') {
        const conta = contasVinculadas[item.id]
        if (filtroStatusFinanceiro === 'lancado' && conta?.status !== 'Lançado') return false
        if (filtroStatusFinanceiro === 'pago' && conta?.status !== 'Pago') return false
        if (filtroStatusFinanceiro === 'pendente_financeiro' && (conta || (item.status !== 'Em Trânsito' && item.status !== 'Entregue'))) return false
        if (filtroStatusFinanceiro === 'sem_conta' && conta) return false
      }

      return true
    })
  }, [suprimentos, mesaAtiva, mesasCustom, busca, filtroPrioridade, filtroStatusFinanceiro, obras, contasVinculadas])

  // KPIs
  const kpis = useMemo(() => {
    const totalAberto = suprimentos.filter(s => s.status !== 'Entregue').reduce((acc, s) => acc + (s.valor || 0), 0)
    const emCotacao = suprimentos.filter(s => s.status === 'Em Cotação').length
    const aguardandoAprovacao = suprimentos.filter(s => s.status === 'Aprovação').length
    const lancadosNoFinanceiro = Object.values(contasVinculadas).length
    const valorLancado = Object.values(contasVinculadas).reduce((acc, c) => acc + (c.valor || 0), 0)
    const entreguesNaObra = suprimentos.filter(s => s.status === 'Entregue').length

    return { totalAberto, emCotacao, aguardandoAprovacao, lancadosNoFinanceiro, valorLancado, entreguesNaObra }
  }, [suprimentos, contasVinculadas])

  // ─── AÇÕES DA ESTEIRA ──────────────────────────────────────────────────────

  // 1. Criar Solicitação de Compra
  async function handleCriarSolicitacao(e: React.FormEvent) {
    e.preventDefault()

    const itensValidos = novoForm.itens.filter(it => it.descricao.trim())
    if (itensValidos.length === 0 && !novoForm.titulo.trim()) {
      return toast('Informe ao menos um material ou insumo a ser solicitado.', 'error')
    }

    setSalvandoNovo(true)
    try {
      const selectedForn = fornecedores.find(f => f.id === novoForm.fornecedor_id)
      const fornNome = selectedForn ? (selectedForn.nome_fantasia || selectedForn.razao_social) : ''

      const cleanValor = novoForm.valor ? parseFloat(novoForm.valor.replace(/\./g, '').replace(',', '.')) : null

      const responsavelEscolhido = colaboradores.find(c => c.id === novoForm.responsavel_id)
      const respNome = responsavelEscolhido?.nome || null
      const respId = responsavelEscolhido?.id || null

      const proximoEscolhido = colaboradores.find(c => c.id === novoForm.proximo_responsavel_id)
      const proxNome = proximoEscolhido?.nome || null
      const proxId = proximoEscolhido?.id || null

      const solicitanteNome = colaboradorAtivo?.nome || 'Usuário Atual'
      const obraDestinoId = novoForm.obra_id === '__outros__' ? null : (novoForm.obra_id || null)
      const obraNomeManual = novoForm.obra_id === '__outros__' ? (novoForm.obra_nome_manual.trim() || 'Outros (Não cadastrado)') : null

      // Título inteligente
      let tituloFinal = novoForm.titulo.trim()
      if (!tituloFinal) {
        if (novoForm.codigo.trim()) {
          tituloFinal = `${novoForm.codigo.trim()} - ${itensValidos[0]?.descricao || 'MATERIAIS'}`
        } else if (itensValidos.length === 1) {
          tituloFinal = itensValidos[0].descricao.trim()
        } else {
          tituloFinal = `${itensValidos[0].descricao.trim()} (+${itensValidos.length - 1} itens)`
        }
      }

      const checklistInicial = itensValidos.map((it, idx) => ({
        id: `chk-${Date.now()}-${idx}`,
        descricao: it.descricao.trim(),
        qtd_pedida: parseFloat((it.quantidade || '1').replace(',', '.')) || 1,
        qtd_entregue: 0,
        unidade: it.unidade || 'un',
        status: 'pendente'
      }))

      const qtdFinal = itensValidos.length > 1 ? `${itensValidos.length} itens` : (itensValidos[0]?.quantidade?.trim() || '1')
      const unidadeFinal = itensValidos.length > 1 ? 'itens' : (itensValidos[0]?.unidade?.trim() || 'un')

      const historicoInicial = [{
        id: 'act-' + Date.now(),
        data: new Date().toISOString(),
        autor_nome: solicitanteNome,
        acao: 'criacao_demanda',
        detalhe: `Solicitação criada no sistema por ${solicitanteNome}.${respNome ? ` Responsável da Demanda: ${respNome}.` : ''}${proxNome ? ` Próximo responsável: ${proxNome}.` : ''}`
      }]

      const { data, error } = await supabase.from('suprimentos').insert({
        codigo: novoForm.codigo.trim() || null,
        obra_id: obraDestinoId,
        obra_nome_manual: obraNomeManual,
        titulo: tituloFinal,
        quantidade: qtdFinal,
        unidade: unidadeFinal,
        fornecedor: fornNome || null,
        valor: cleanValor,
        status: novoForm.status || 'Solicitado',
        data_vencimento: novoForm.data_vencimento || null,
        solicitante: solicitanteNome,
        prioridade: novoForm.prioridade,
        responsavel_id: respId,
        responsavel_nome: respNome,
        proximo_responsavel_id: proxId,
        proximo_responsavel_nome: proxNome,
        itens_checklist: checklistInicial,
        historico_atividades: historicoInicial,
        chat_mensagens: [],
        anexos: []
      }).select().single()

      if (error) throw error

      if (respId && respId !== colaboradorAtivo?.id) {
        await supabase.from('notificacoes').insert({
          destinatario_id: respId,
          remetente_id: colaboradorAtivo?.id || null,
          remetente_nome: solicitanteNome,
          tipo: 'transferencia_responsavel',
          titulo: 'Nova Demanda de Suprimentos',
          mensagem: `${solicitanteNome} atribuiu a nova demanda "${tituloFinal}" para você.`,
          link: `/suprimentos?cardId=${data.id}`,
          lida: false
        })
      }

      if (proxId && proxId !== respId && proxId !== colaboradorAtivo?.id) {
        await supabase.from('notificacoes').insert({
          destinatario_id: proxId,
          remetente_id: colaboradorAtivo?.id || null,
          remetente_nome: solicitanteNome,
          tipo: 'transferencia_responsavel',
          titulo: 'Próximo Passo em Suprimentos',
          mensagem: `${solicitanteNome} definiu você como próximo responsável pela demanda "${tituloFinal}".`,
          link: `/suprimentos?cardId=${data.id}`,
          lida: false
        })
      }

      toast('Solicitação de compra criada com sucesso!', 'success')
      setModalNovoOpen(false)
      setNovoForm({
        codigo: '',
        obra_id: '',
        obra_nome_manual: '',
        titulo: '',
        itens: [
          { id: 'item-1', descricao: '', quantidade: '', unidade: 'un' }
        ],
        fornecedor_id: '',
        valor: '',
        prioridade: 'media',
        data_vencimento: '',
        responsavel_id: '',
        responsavel_nome: '',
        proximo_responsavel_id: '',
        proximo_responsavel_nome: '',
        status: 'Solicitado'
      })
      await loadData(true)
    } catch (err: any) {
      toast('Erro ao criar solicitação: ' + err.message, 'error')
    } finally {
      setSalvandoNovo(false)
    }
  }

  // 1.1 Criar Demanda Rápida Diretamente na Coluna da Esteira
  async function handleSalvarQuickDemanda(statusColuna: SuprimentoItem['status']) {
    if (!quickTitulo.trim()) return toast('Informe o que precisa ser comprado.', 'error')

    setSalvandoQuick(true)
    try {
      const historicoInicial = [{
        id: 'act-' + Date.now(),
        data: new Date().toISOString(),
        autor_nome: colaboradorAtivo?.nome || 'Canteiro de Obras',
        acao: 'criacao_demanda',
        detalhe: `Demanda criada diretamente na coluna "${statusColuna}".`
      }]

      const checklistInicial = [{
        id: 'chk-' + Date.now(),
        descricao: quickTitulo.trim(),
        qtd_pedida: 1,
        qtd_entregue: 0,
        unidade: 'un',
        status: 'pendente'
      }]

      const { data, error } = await supabase.from('suprimentos').insert({
        obra_id: quickObraId || null,
        titulo: quickTitulo.trim(),
        quantidade: '1',
        unidade: 'un',
        fornecedor: null,
        valor: null,
        status: statusColuna,
        data_vencimento: null,
        solicitante: colaboradorAtivo?.nome || 'Canteiro de Obras',
        prioridade: quickPrioridade,
        responsavel_id: colaboradorAtivo?.id || null,
        responsavel_nome: colaboradorAtivo?.nome || null,
        itens_checklist: checklistInicial,
        historico_atividades: historicoInicial,
        chat_mensagens: [],
        anexos: []
      }).select().single()

      if (error) throw error

      if (data) {
        setSuprimentos(prev => [data as SuprimentoItem, ...prev])
      }
      toast(`Demanda adicionada com sucesso na coluna "${statusColuna}"!`, 'success')
      setQuickTitulo('')
      setColunaCriacaoAtiva(null)
      await loadData(true)
    } catch (err: any) {
      toast('Erro ao criar demanda: ' + err.message, 'error')
    } finally {
      setSalvandoQuick(false)
    }
  }

  // 1.2 Abrir Modal Completo a partir da Coluna
  function abrirModalCompleto(statusColuna: SuprimentoItem['status']) {
    const currentObraId = quickObraId || (mesaAtiva.startsWith('obra-') ? mesaAtiva.replace('obra-', '') : '')
    setNovoForm(prev => ({
      ...prev,
      titulo: quickTitulo || prev.titulo,
      obra_id: currentObraId || prev.obra_id,
      prioridade: quickPrioridade || prev.prioridade,
      status: statusColuna
    }))
    setColunaCriacaoAtiva(null)
    setModalNovoOpen(true)
  }

  // 2. Mover Card de Etapa Manualmente / Arrastando
  async function handleMoverEtapa(item: SuprimentoItem, novoStatus: SuprimentoItem['status']) {
    if (novoStatus === 'Em Trânsito' && !contasVinculadas[item.id]) {
      // Se tentar mover para Em Trânsito sem ter gerado conta, abre o modal de aprovação
      abrirModalAprovacao(item)
      return
    }

    const statusAntigo = item.status
    if (statusAntigo === novoStatus) return

    // Atualização otimista imediata na UI
    setSuprimentos(prev => prev.map(s => s.id === item.id ? { ...s, status: novoStatus } : s))

    try {
      const autorAtual = colaboradorAtivo?.nome || 'Usuário do Sistema'
      const novaAtividade = {
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        data: new Date().toISOString(),
        autor_nome: autorAtual,
        acao: 'mudanca_etapa',
        detalhe: `Moveu o pedido da etapa "${statusAntigo}" para "${novoStatus}"`,
        de: statusAntigo,
        para: novoStatus
      }
      const historicoAtual = Array.isArray(item.historico_atividades) ? item.historico_atividades : []
      const novoHistorico = [novaAtividade, ...historicoAtual]

      const { error } = await supabase.from('suprimentos').update({
        status: novoStatus,
        historico_atividades: novoHistorico
      }).eq('id', item.id)

      if (error) {
        setSuprimentos(prev => prev.map(s => s.id === item.id ? { ...s, status: statusAntigo } : s))
        throw error
      }
      toast(`Pedido movido para "${novoStatus}"`, 'success')
      await loadData(true)
    } catch (err: any) {
      toast('Erro ao atualizar etapa: ' + err.message, 'error')
    }
  }

  // Helper para gerar o texto formatado da Ordem de Compra (OC) para WhatsApp
  function gerarTextoOrdemCompra(
    item: SuprimentoItem,
    fornId?: string,
    valorStr?: string,
    vencimentoStr?: string,
    condicaoStr?: string
  ) {
    const ocCodigo = item.codigo || `OC-${item.id.slice(0, 6).toUpperCase()}`
    const obra = obras.find(o => o.id === item.obra_id)
    const nomeObra = obra?.nome || item.obra_nome_manual || 'Geral / Sede'
    const enderecoObra = obra?.endereco ? `\n📍 *Endereço de Entrega:* ${obra.endereco}` : ''
    const selectedForn = fornId
      ? fornecedores.find(f => f.id === fornId)
      : fornecedores.find(f =>
          (f.nome_fantasia && f.nome_fantasia.toLowerCase() === item.fornecedor?.toLowerCase()) ||
          (f.razao_social && f.razao_social.toLowerCase() === item.fornecedor?.toLowerCase())
        )
    const fornNome = selectedForn?.nome_fantasia || selectedForn?.razao_social || item.fornecedor || 'Fornecedor'
    const cnpjForn = selectedForn?.cnpj ? ` (CNPJ: ${selectedForn.cnpj})` : ''

    const checklist = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    const listaMateriais = checklist.length > 0
      ? checklist.map((c: any, idx: number) => `  ${idx + 1}. ${c.descricao} — *${c.quantidade || '1'} ${c.unidade || 'un'}*`).join('\n')
      : `  • ${item.titulo} — *${item.quantidade || '1'} ${item.unidade || 'un'}*`

    const valNum = valorStr
      ? parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.'))
      : (item.valor || 0)
    const valFormatado = valNum > 0
      ? `R$ ${valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Conforme proposta aprovada'

    const vencData = vencimentoStr || item.data_vencimento
    const vencFormatado = vencData ? new Date(vencData + 'T00:00:00').toLocaleDateString('pt-BR') : 'A combinar'
    const condicao = condicaoStr || 'Conforme negociado'

    return [
      `✅ *ORDEM DE COMPRA OFICIAL — ${ocCodigo}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏢 *Fornecedor:* ${fornNome}${cnpjForn}`,
      `🏗️ *Obra / Destino:* ${nomeObra}${enderecoObra}`,
      ``,
      `📦 *Itens Aprovados:*`,
      listaMateriais,
      ``,
      `💰 *Valor Total Aprovado:* ${valFormatado}`,
      `💳 *Condição de Pagamento:* ${condicao}`,
      `📅 *Previsão / Vencimento:* ${vencFormatado}`,
      `👤 *Aprovado por:* ${colaboradorAtivo?.nome || 'Diretoria / Suprimentos'}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Favor confirmar o recebimento desta Ordem de Compra e a previsão de entrega no canteiro.`
    ].join('\n')
  }

  // 3. Abrir Modal de Aprovação
  function abrirModalAprovacao(item: SuprimentoItem, forcarLancamentoFinanceiro = true) {
    setItemSelecionado(item)
    // Tenta casar fornecedor existente
    const matchForn = fornecedores.find(f =>
      (f.nome_fantasia && f.nome_fantasia.toLowerCase() === item.fornecedor?.toLowerCase()) ||
      (f.razao_social && f.razao_social.toLowerCase() === item.fornecedor?.toLowerCase())
    )

    setAprovForm({
      fornecedor_id: matchForn?.id || '',
      valor_final: item.valor ? String(item.valor) : '',
      data_vencimento: item.data_vencimento || new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0],
      condicao_pagamento: matchForn?.prazo_pagamento ? `${matchForn.prazo_pagamento} dias` : '28 dias',
      anexo_file: null,
      anexo_url: '',
      lancar_financeiro: forcarLancamentoFinanceiro,
      copiar_oc_ao_aprovar: true,
      enviar_oc_dgenny: true
    })
    setModalAprovarOpen(true)
  }

  // 4. Executar Aprovação & Disparo para o Financeiro (ou Aprovação sem Financeiro Automático)
  async function handleAprovarEEnviarFinanceiro(e: React.FormEvent) {
    e.preventDefault()
    if (!itemSelecionado) return

    const valorNum = aprovForm.valor_final
      ? parseFloat(aprovForm.valor_final.replace(/\./g, '').replace(',', '.'))
      : (itemSelecionado.valor || 0)

    if (aprovForm.lancar_financeiro) {
      if (!aprovForm.fornecedor_id) return toast('Selecione o fornecedor vencedor da cotação para lançar no Financeiro.', 'error')
      if (!valorNum || valorNum <= 0) return toast('Informe o valor final aprovado da compra para lançar no Financeiro.', 'error')
    }

    setSalvandoAprovacao(true)
    try {
      const selectedForn = fornecedores.find(f => f.id === aprovForm.fornecedor_id)
      const fornNome = selectedForn?.nome_fantasia || selectedForn?.razao_social || itemSelecionado.fornecedor || 'Compra Direta / A definir'
      const obra = obras.find(o => o.id === itemSelecionado.obra_id)
      const nomeObra = obra?.nome || itemSelecionado.obra_nome_manual || 'Geral / Sede'
      const jaEstavaAprovado = itemSelecionado.status === 'Em Trânsito' || itemSelecionado.status === 'Entregue'
      const novoStatusDestino: SuprimentoItem['status'] = itemSelecionado.status === 'Entregue' ? 'Entregue' : 'Em Trânsito'

      // Copiar OC formatada para a área de transferência se marcado
      const textoOC = gerarTextoOrdemCompra(
        itemSelecionado,
        aprovForm.fornecedor_id,
        aprovForm.valor_final,
        aprovForm.data_vencimento,
        aprovForm.condicao_pagamento
      )
      if (aprovForm.copiar_oc_ao_aprovar && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textoOC)
        } catch {}
      }

      // Se houver cotação dgenny vinculada e enviar_oc_dgenny estiver ativo, tenta enviar a OC no chat do fornecedor
      const dgennyAct = Array.isArray(itemSelecionado.historico_atividades)
        ? itemSelecionado.historico_atividades.find((a: any) => a.dgenny_quotation_id)
        : null
      if (aprovForm.enviar_oc_dgenny && dgennyAct?.dgenny_quotation_id) {
        try {
          const qRes = await fetch(`/api/dgenny/quotations/${dgennyAct.dgenny_quotation_id}`)
          if (qRes.ok) {
            const qData = await qRes.json()
            const proposals = Array.isArray(qData?.proposals) ? qData.proposals : []
            const matchProp = proposals.find((p: any) => {
              const supName = (p.supplier?.name || p.supplier_name || '').toLowerCase()
              return supName && fornNome.toLowerCase().includes(supName)
            }) || proposals[0]
            if (matchProp?.id) {
              await fetch(`/api/dgenny/quotations/${dgennyAct.dgenny_quotation_id}/proposals/${matchProp.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: textoOC })
              })
            }
          }
        } catch (errDgenny) {
          console.warn('Aviso ao enviar OC via dgenny:', errDgenny)
        }
      }

      // 1. Upload do Anexo se houver
      let anexoUrl = ''
      if (aprovForm.anexo_file) {
        const safeName = aprovForm.anexo_file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
        const path = `suprimentos/${itemSelecionado.id}-${Date.now()}-${safeName}`
        const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, aprovForm.anexo_file, { upsert: true })
        if (!upErr) {
          const { data: pubData } = supabase.storage.from('comprovantes').getPublicUrl(path)
          anexoUrl = pubData.publicUrl
        }
      }

      let novaConta: any = null

      // 2. Criar Lançamento na tabela 'contas' se lancar_financeiro === true
      if (aprovForm.lancar_financeiro) {
        const observacaoTexto = `Suprimentos ID: ${itemSelecionado.id} | Solicitante: ${itemSelecionado.solicitante || 'Canteiro'} | Prioridade: ${itemSelecionado.prioridade.toUpperCase()} | Condição: ${aprovForm.condicao_pagamento}`
        const descricaoTexto = `[OC-${itemSelecionado.id.slice(0, 6).toUpperCase()}] ${itemSelecionado.titulo} (${itemSelecionado.quantidade || ''} ${itemSelecionado.unidade || ''}) - Obra: ${nomeObra}`

        const historicoInicial = [{
          id: String(Date.now()),
          data: new Date().toISOString(),
          tipo: 'aprovacao_suprimentos',
          autor: colaboradorAtivo?.nome || 'Suprimentos',
          descricao: `Compra aprovada na esteira de Suprimentos (OC-${itemSelecionado.id.slice(0, 6).toUpperCase()}). Lançamento gerado automaticamente para conferência e liquidação.`
        }]

        const { data: contaInserida, error: contaErr } = await supabase.from('contas').insert({
          obra_id: itemSelecionado.obra_id || null,
          fornecedor_id: selectedForn?.id || null,
          tipo: 'pagar',
          status: 'Lançado',
          descricao: descricaoTexto,
          valor: valorNum,
          data_vencimento: aprovForm.data_vencimento,
          data_previsao: aprovForm.data_vencimento,
          categoria: 'Materiais de Construção',
          observacoes: observacaoTexto,
          comprovante_url: anexoUrl || null,
          criado_por: `Suprimentos (${colaboradorAtivo?.nome || 'Automático'})`,
          historico_negociacao: historicoInicial,
          possui_fornecedor: true
        }).select().single()

        if (contaErr) throw contaErr
        novaConta = contaInserida
      }

      // 3. Atualizar item em 'suprimentos' para 'Em Trânsito' com log de auditoria
      const autorAtualAprov = colaboradorAtivo?.nome || 'Usuário do Sistema'
      const detalheAprov = aprovForm.lancar_financeiro && novaConta
        ? `${jaEstavaAprovado ? 'Lançou no Financeiro a compra' : 'Aprovou a compra'} com "${fornNome}", valor R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, vencimento: ${aprovForm.data_vencimento}. Lançamento financeiro gerado (#${novaConta.codigo_sequencial || novaConta.id.slice(0, 6)}).`
        : `Aprovou a compra (${fornNome})${valorNum > 0 ? `, valor R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''} SEM lançamento automático no Financeiro (pendente lançamento manual pelo engenheiro/responsável).`

      const novaAtividadeAprov = {
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        data: new Date().toISOString(),
        autor_nome: autorAtualAprov,
        acao: aprovForm.lancar_financeiro ? 'aprovacao_compra' : 'aprovacao_sem_financeiro',
        sem_financeiro: !aprovForm.lancar_financeiro,
        detalhe: detalheAprov,
        de: itemSelecionado.status,
        para: novoStatusDestino
      }
      const historicoAprov = Array.isArray(itemSelecionado.historico_atividades) ? itemSelecionado.historico_atividades : []
      const novoHistoricoAprov = [novaAtividadeAprov, ...historicoAprov]

      const { error: supUpdateErr } = await supabase.from('suprimentos').update({
        status: novoStatusDestino,
        fornecedor: fornNome !== 'Compra Direta / A definir' ? fornNome : itemSelecionado.fornecedor,
        valor: valorNum > 0 ? valorNum : itemSelecionado.valor,
        data_vencimento: aprovForm.data_vencimento || itemSelecionado.data_vencimento,
        historico_atividades: novoHistoricoAprov
      }).eq('id', itemSelecionado.id)

      if (supUpdateErr) throw supUpdateErr

      if (aprovForm.lancar_financeiro && novaConta) {
        toast(`Compra aprovada e lançada no Financeiro (#${novaConta.codigo_sequencial || novaConta.id.slice(0, 6)})!${aprovForm.copiar_oc_ao_aprovar ? ' OC copiada p/ WhatsApp!' : ''}`, 'success')
      } else {
        toast(`Compra aprovada e movida para Em Trânsito (Marcada p/ Lançamento Manual no Financeiro).${aprovForm.copiar_oc_ao_aprovar ? ' OC copiada p/ WhatsApp!' : ''}`, 'success')
      }
      setModalAprovarOpen(false)
      setItemSelecionado(null)
      await loadData(true)
    } catch (err: any) {
      toast('Erro ao aprovar compra: ' + err.message, 'error')
    } finally {
      setSalvandoAprovacao(false)
    }
  }

  // 5. Abrir Modal de Recebimento no Canteiro
  function abrirModalRecebimento(item: SuprimentoItem) {
    setItemSelecionado(item)
    setRecebForm({
      quantidade_recebida: item.quantidade || '',
      observacao: 'Conferido no canteiro conforme pedido.',
      foto_file: null
    })
    setModalReceberOpen(true)
  }

  // 6. Confirmar Recebimento na Obra & Retroalimentar Financeiro
  async function handleConfirmarRecebimento(e: React.FormEvent) {
    e.preventDefault()
    if (!itemSelecionado) return

    setSalvandoRecebimento(true)
    try {
      let fotoUrl = ''
      if (recebForm.foto_file) {
        const safeName = recebForm.foto_file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
        const path = `suprimentos/recebimento-${itemSelecionado.id}-${Date.now()}-${safeName}`
        const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, recebForm.foto_file, { upsert: true })
        if (!upErr) {
          const { data: pubData } = supabase.storage.from('comprovantes').getPublicUrl(path)
          fotoUrl = pubData.publicUrl
        }
      }

      // 1. Atualizar suprimentos para 'Entregue' com log de auditoria
      const autorAtualRec = colaboradorAtivo?.nome || 'Usuário do Sistema'
      const novaAtividadeRec = {
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        data: new Date().toISOString(),
        autor_nome: autorAtualRec,
        acao: 'entrega_recebida',
        detalhe: `Recebido e conferido no canteiro. Qtd conferida: ${recebForm.quantidade_recebida || itemSelecionado.quantidade} ${itemSelecionado.unidade || ''}. Obs: ${recebForm.observacao}`,
        de: 'Em Trânsito',
        para: 'Entregue'
      }
      const historicoRec = Array.isArray(itemSelecionado.historico_atividades) ? itemSelecionado.historico_atividades : []
      const novoHistoricoRec = [novaAtividadeRec, ...historicoRec]

      const { error: supErr } = await supabase.from('suprimentos').update({
        status: 'Entregue',
        historico_atividades: novoHistoricoRec
      }).eq('id', itemSelecionado.id)

      if (supErr) throw supErr

      // 2. Retroalimentar Financeiro se houver conta vinculada
      const contaVinculada = contasVinculadas[itemSelecionado.id]
      if (contaVinculada) {
        const msgEntrega = `[RECEBIMENTO NO CANTEIRO]: Material entregue e conferido por ${colaboradorAtivo?.nome || 'Equipe de Obra'} em ${new Date().toLocaleDateString('pt-BR')}. Qtd: ${recebForm.quantidade_recebida || itemSelecionado.quantidade} ${itemSelecionado.unidade || ''}. Obs: ${recebForm.observacao}`

        // Atualizar comprovante_url na conta
        let novoComprovante = contaVinculada.comprovante_url
        if (fotoUrl) {
          try {
            if (novoComprovante && novoComprovante.startsWith('[')) {
              const list = JSON.parse(novoComprovante)
              list.push(fotoUrl)
              novoComprovante = JSON.stringify(list)
            } else if (novoComprovante) {
              novoComprovante = JSON.stringify([novoComprovante, fotoUrl])
            } else {
              novoComprovante = fotoUrl
            }
          } catch {
            novoComprovante = fotoUrl
          }
        }

        await supabase.from('contas').update({
          comprovante_url: novoComprovante,
          observacoes: (contaVinculada.observacoes || '') + '\n' + msgEntrega
        }).eq('id', contaVinculada.id)
      }

      toast('Recebimento confirmado no canteiro! O Financeiro foi notificado da entrega.', 'success')
      setModalReceberOpen(false)
      setItemSelecionado(null)
      await loadData(true)
    } catch (err: any) {
      toast('Erro ao confirmar recebimento: ' + err.message, 'error')
    } finally {
      setSalvandoRecebimento(false)
    }
  }

  // 7. Salvar Nova Mesa Personalizada
  function handleSalvarMesa(e: React.FormEvent) {
    e.preventDefault()
    if (!mesaForm.nome.trim()) return toast('Informe o nome da mesa.', 'error')

    const novaMesa: MesaPersonalizada = {
      id: 'custom-' + Date.now(),
      nome: mesaForm.nome.trim(),
      obra_id: mesaForm.obra_id || undefined,
      prioridade: mesaForm.prioridade !== 'todas' ? mesaForm.prioridade : undefined
    }

    const novas = [...mesasCustom, novaMesa]
    setMesasCustom(novas)
    if (typeof window !== 'undefined') {
      localStorage.setItem('jwa_suprimentos_mesas', JSON.stringify(novas))
    }

    setMesaAtiva(novaMesa.id)
    setModalNovaMesaOpen(false)
    setMesaForm({ nome: '', obra_id: '', prioridade: 'todas' })
    toast(`Mesa "${novaMesa.nome}" criada com sucesso!`, 'success')
  }

  // Excluir Mesa Personalizada
  function handleExcluirMesa(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const novas = mesasCustom.filter(m => m.id !== id)
    setMesasCustom(novas)
    if (typeof window !== 'undefined') {
      localStorage.setItem('jwa_suprimentos_mesas', JSON.stringify(novas))
    }
    if (mesaAtiva === id) setMesaAtiva('todas')
    toast('Mesa removida.', 'success')
  }

  // Excluir Solicitação de Compra
  async function handleExcluirSuprimento(item: SuprimentoItem) {
    if (!(await confirm(
      'Excluir Solicitação de Compra',
      `Deseja realmente excluir a solicitação "${item.titulo}"? Esta ação não pode ser desfeita.`,
      { confirmLabel: 'Sim, Excluir', confirmColor: '#EF4444' }
    ))) return

    try {
      const { error } = await supabase.from('suprimentos').delete().eq('id', item.id)
      if (error) throw error
      toast('Solicitação excluída com sucesso.', 'success')
      await loadData(true)
    } catch (err: any) {
      toast('Erro ao excluir: ' + err.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <PageTitle
            modulo="SUPRIMENTOS"
            titulo="Esteira de Suprimentos & Compras"
            subtitle="Pipeline integrado: Solicitação do Canteiro ➔ Cotação ➔ Aprovação ➔ Lançamento no Financeiro ➔ Recebimento na Obra."
          />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Alternância de Visão */}
          <div style={{ display: 'flex', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 5, padding: 2 }}>
            <button
              onClick={() => setVisao('esteira')}
              style={{
                ...btnBase,
                padding: '6px 12px',
                background: visao === 'esteira' ? C.amber : 'transparent',
                color: visao === 'esteira' ? '#0A0A0A' : C.inkSoft
              }}
            >
              <Layers size={13} /> Esteira (Kanban)
            </button>
            <button
              onClick={() => setVisao('tabela')}
              style={{
                ...btnBase,
                padding: '6px 12px',
                background: visao === 'tabela' ? C.amber : 'transparent',
                color: visao === 'tabela' ? '#0A0A0A' : C.inkSoft
              }}
            >
              <FileText size={13} /> Tabela Geral
            </button>
          </div>

          <button
            onClick={() => loadData()}
            disabled={loading}
            style={{ ...btnBase, background: C.bgCard, color: C.ink, border: `1px solid ${C.border}` }}
            title="Atualizar dados da esteira"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          <NotificationCenter />

          <button
            onClick={() => {
              const currentObraId = mesaAtiva.startsWith('obra-') ? mesaAtiva.replace('obra-', '') : ''
              setNovoForm(prev => ({
                ...prev,
                obra_id: currentObraId || prev.obra_id
              }))
              setModalNovoOpen(true)
            }}
            style={{ ...btnBase, background: C.amber, color: '#0A0A0A', fontWeight: 900, boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)' }}
          >
            <Plus size={15} /> Nova Solicitação de Compra
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: 10, borderRadius: 6 }}>
            <ShoppingCart size={18} color="#3B82F6" />
          </div>
          <div>
            <span style={labelStyle}>Total em Aberto</span>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, fontFamily: 'monospace' }}>
              R$ {kpis.totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: 10, borderRadius: 6 }}>
            <Layers size={18} color={C.amber} />
          </div>
          <div>
            <span style={labelStyle}>Em Cotação</span>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.amber }}>
              {kpis.emCotacao} <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>pedidos</span>
            </div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: 10, borderRadius: 6 }}>
            <ShieldCheck size={18} color="#8B5CF6" />
          </div>
          <div>
            <span style={labelStyle}>Aguardando Aprovação</span>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#8B5CF6' }}>
              {kpis.aguardandoAprovacao} <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>pedidos</span>
            </div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: 10, borderRadius: 6 }}>
            <DollarSign size={18} color="#06B6D4" />
          </div>
          <div>
            <span style={labelStyle}>Lançados no Financeiro</span>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#06B6D4', fontFamily: 'monospace' }}>
              R$ {kpis.valorLancado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{kpis.lancadosNoFinanceiro} contas geradas</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 10, borderRadius: 6 }}>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div>
            <span style={labelStyle}>Entregues no Canteiro</span>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10B981' }}>
              {kpis.entreguesNaObra} <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>concluídos</span>
            </div>
          </div>
        </div>
      </div>

      {/* MESAS DE OPERAÇÃO (TABS PADRÃO + PERSONALIZADAS) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Mesas Fixas Padrão */}
          <button
            onClick={() => setMesaAtiva('todas')}
            style={{
              ...btnBase,
              padding: '6px 12px',
              background: mesaAtiva === 'todas' ? C.amber : 'transparent',
              color: mesaAtiva === 'todas' ? '#0A0A0A' : C.inkSoft,
              border: `1px solid ${mesaAtiva === 'todas' ? C.amber : C.border}`
            }}
          >
            <Building2 size={12} /> Todas as Obras (Geral)
          </button>

          <button
            onClick={() => setMesaAtiva('minhas')}
            style={{
              ...btnBase,
              padding: '6px 12px',
              background: mesaAtiva === 'minhas' ? C.amber : 'transparent',
              color: mesaAtiva === 'minhas' ? '#0A0A0A' : C.inkSoft,
              border: `1px solid ${mesaAtiva === 'minhas' ? C.amber : C.border}`
            }}
          >
            <User size={12} /> Minhas Demandas
            {suprimentos.filter(s => s.responsavel_id === colaboradorAtivo?.id).length > 0 && (
              <span style={{
                marginLeft: 5,
                fontSize: 9.5,
                fontWeight: 900,
                background: mesaAtiva === 'minhas' ? '#0A0A0A' : C.amber,
                color: mesaAtiva === 'minhas' ? C.amber : '#0A0A0A',
                padding: '1px 5px',
                borderRadius: 8
              }}>
                {suprimentos.filter(s => s.responsavel_id === colaboradorAtivo?.id).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMesaAtiva('urgentes')}
            style={{
              ...btnBase,
              padding: '6px 12px',
              background: mesaAtiva === 'urgentes' ? '#EF4444' : 'transparent',
              color: mesaAtiva === 'urgentes' ? '#FFFFFF' : C.inkSoft,
              border: `1px solid ${mesaAtiva === 'urgentes' ? '#EF4444' : C.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <AlertTriangle size={12} /> ⚡ Urgentes & Críticas
            {suprimentos.filter(s => (s.prioridade === 'urgente' || s.prioridade === 'alta') && s.status !== 'Entregue').length > 0 && (
              <span style={{
                fontSize: 9.5,
                fontWeight: 900,
                background: mesaAtiva === 'urgentes' ? '#FFFFFF' : '#EF4444',
                color: mesaAtiva === 'urgentes' ? '#EF4444' : '#FFFFFF',
                padding: '1px 5px',
                borderRadius: 8
              }}>
                {suprimentos.filter(s => (s.prioridade === 'urgente' || s.prioridade === 'alta') && s.status !== 'Entregue').length}
              </span>
            )}
          </button>

          {/* Mesas Automáticas por Obra Cadastrada */}
          {obras.map(o => {
            const countObra = suprimentos.filter(s => s.obra_id === o.id && s.status !== 'Entregue').length
            const isAtiva = mesaAtiva === `obra-${o.id}`
            return (
              <button
                key={o.id}
                onClick={() => setMesaAtiva(`obra-${o.id}`)}
                style={{
                  ...btnBase,
                  padding: '6px 12px',
                  background: isAtiva ? C.amber : 'transparent',
                  color: isAtiva ? '#0A0A0A' : C.inkSoft,
                  border: `1px solid ${isAtiva ? C.amber : C.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title={`Mesa da obra: ${o.nome}${o.cliente ? ` (${o.cliente})` : ''}`}
              >
                <span>🏢 {o.nome}</span>
                {countObra > 0 && (
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 900,
                    background: isAtiva ? '#0A0A0A' : C.amber,
                    color: isAtiva ? C.amber : '#0A0A0A',
                    padding: '1px 5px',
                    borderRadius: 8
                  }}>
                    {countObra}
                  </span>
                )}
              </button>
            )
          })}

          {/* Mesas Personalizadas Criadas pelo Usuário */}
          {mesasCustom.map(m => (
            <div
              key={m.id}
              onClick={() => setMesaAtiva(m.id)}
              style={{
                ...btnBase,
                padding: '6px 10px',
                background: mesaAtiva === m.id ? C.amber : 'transparent',
                color: mesaAtiva === m.id ? '#0A0A0A' : C.inkSoft,
                border: `1px solid ${mesaAtiva === m.id ? C.amber : C.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>📁 {m.nome}</span>
              <button
                type="button"
                onClick={(e) => handleExcluirMesa(m.id, e)}
                style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.6, padding: 0 }}
                title="Remover mesa personalizada"
              >
                <X size={11} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setModalNovaMesaOpen(true)}
            style={{
              ...btnBase,
              padding: '6px 12px',
              background: 'transparent',
              color: C.inkSoft,
              border: `1px dashed ${C.border}`
            }}
            title="Criar nova mesa operacional personalizada"
          >
            <Plus size={12} /> Nova Mesa Personalizada
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS & BUSCA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px' }}>
        <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
          <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            style={{ ...inputStyle, paddingLeft: 32 }}
            placeholder="Buscar por material, fornecedor, obra, solicitante..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft }}>Prioridade:</span>
            <select
              style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 11 }}
              value={filtroPrioridade}
              onChange={e => setFiltroPrioridade(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft }}>Financeiro:</span>
            <select
              style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 11 }}
              value={filtroStatusFinanceiro}
              onChange={e => setFiltroStatusFinanceiro(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="lancado">Lançado (Pendente)</option>
              <option value="pago">Pago</option>
              <option value="pendente_financeiro">⚠️ Aprovado s/ Financeiro (Manual)</option>
              <option value="sem_conta">Ainda não Aprovado</option>
            </select>
          </div>

          {(busca || filtroPrioridade !== 'todas' || filtroStatusFinanceiro !== 'todos') && (
            <button
              onClick={() => {
                setBusca('')
                setFiltroPrioridade('todas')
                setFiltroStatusFinanceiro('todos')
              }}
              style={{ ...btnBase, padding: '6px 10px', background: C.bgCard, color: C.inkSoft, border: `1px solid ${C.border}` }}
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: ESTEIRA OU TABELA */}
      {visao === 'esteira' ? (
        /* VISÃO 1: ESTEIRA KANBAN COM AS 5 ETAPAS (TODAS LADO A LADO) */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(290px, 1fr))',
          gap: 14,
          alignItems: 'start',
          overflowX: 'auto',
          paddingBottom: 16,
          scrollbarWidth: 'thin'
        }}>
          {COLUNAS_ESTEIRA.map(col => {
            const cardsDaColuna = suprimentosFiltrados.filter(s => s.status === col.id)
            const valorTotalColuna = cardsDaColuna.reduce((acc, s) => acc + (s.valor || 0), 0)
            const Icon = col.icone
            const isDragOver = dragOverCol === col.id

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverCol !== col.id) setDragOverCol(col.id)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCol(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverCol(null)
                  const cardId = e.dataTransfer.getData('text/plain') || draggingCardId
                  if (cardId) {
                    const itemArrastado = suprimentos.find(s => s.id === cardId)
                    if (itemArrastado && itemArrastado.status !== col.id) {
                      handleMoverEtapa(itemArrastado, col.id)
                    }
                  }
                  setDraggingCardId(null)
                }}
                style={{
                  background: isDragOver ? `${col.cor}0D` : C.bgPanel,
                  border: isDragOver ? `2px dashed ${col.cor}` : `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  minHeight: 520,
                  transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: isDragOver ? `0 0 20px ${col.cor}25` : 'none'
                }}
              >
                {/* Cabeçalho da Coluna */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: col.bg, border: `1px solid ${col.cor}44`, padding: 6, borderRadius: 5 }}>
                      <Icon size={14} color={col.cor} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 12, fontWeight: 900, color: C.ink }}>
                        {col.nome}
                      </h4>
                      <p style={{ margin: '1px 0 0', fontSize: 10, color: C.inkSoft }}>
                        {col.descricao}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, background: col.bg, color: col.cor, padding: '2px 7px', borderRadius: 12 }}>
                      {cardsDaColuna.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentObra = mesaAtiva.startsWith('obra-') ? mesaAtiva.replace('obra-', '') : ''
                        setQuickObraId(currentObra)
                        setQuickTitulo('')
                        setColunaCriacaoAtiva(col.id)
                      }}
                      style={{
                        border: 'none',
                        background: col.bg,
                        color: col.cor,
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease'
                      }}
                      title={`Criar nova demanda na etapa "${col.nome}"`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Subtotal da Coluna */}
                {valorTotalColuna > 0 && (
                  <div style={{ fontSize: 10, color: C.inkSoft, display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span>Subtotal:</span>
                    <strong style={{ color: C.ink, fontFamily: 'monospace' }}>
                      R$ {valorTotalColuna.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}

                {/* Lista de Cards da Coluna */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Formulário Rápido Inline ou Botão + Adicionar */}
                  {colunaCriacaoAtiva === col.id ? (
                    <div style={{
                      background: C.bgCard,
                      border: `1.5px solid ${col.cor}`,
                      borderRadius: 6,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: `0 4px 16px ${col.cor}25`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: col.cor, textTransform: 'uppercase' }}>
                          + Nova Demanda nesta coluna
                        </span>
                        <button
                          type="button"
                          onClick={() => setColunaCriacaoAtiva(null)}
                          style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 2 }}
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <input
                        autoFocus
                        style={{
                          ...inputStyle,
                          fontSize: 11.5,
                          padding: '7px 10px',
                          background: C.bgWhite
                        }}
                        placeholder="Material ou insumo (Ex: 50 sacos de areia)"
                        value={quickTitulo}
                        onChange={e => setQuickTitulo(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSalvarQuickDemanda(col.id)
                          }
                          if (e.key === 'Escape') {
                            setColunaCriacaoAtiva(null)
                          }
                        }}
                      />

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 6 }}>
                        <select
                          style={{ ...inputStyle, fontSize: 10.5, padding: '4px 6px' }}
                          value={quickObraId}
                          onChange={e => setQuickObraId(e.target.value)}
                        >
                          <option value="">🏢 Geral / Sede</option>
                          {obras.map(o => (
                            <option key={o.id} value={o.id}>{o.nome}</option>
                          ))}
                        </select>

                        <select
                          style={{ ...inputStyle, fontSize: 10.5, padding: '4px 6px' }}
                          value={quickPrioridade}
                          onChange={e => setQuickPrioridade(e.target.value as any)}
                        >
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                          <option value="urgente">⚡ Urgente</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => abrirModalCompleto(col.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: C.inkSoft,
                            fontSize: 10,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Mais detalhes...
                        </button>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setColunaCriacaoAtiva(null)}
                            style={{ ...btnBase, padding: '4px 8px', fontSize: 10.5, background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}` }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={salvandoQuick}
                            onClick={() => handleSalvarQuickDemanda(col.id)}
                            style={{ ...btnBase, padding: '4px 10px', fontSize: 10.5, background: C.amber, color: '#0A0A0A', fontWeight: 900 }}
                          >
                            {salvandoQuick ? 'Salvando...' : 'Adicionar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const currentObra = mesaAtiva.startsWith('obra-') ? mesaAtiva.replace('obra-', '') : ''
                        setQuickObraId(currentObra)
                        setQuickTitulo('')
                        setColunaCriacaoAtiva(col.id)
                      }}
                      style={{
                        border: `1px dashed ${C.border}`,
                        background: 'rgba(255,255,255,0.02)',
                        color: C.inkSoft,
                        borderRadius: 6,
                        padding: '7px 10px',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = col.cor
                        e.currentTarget.style.color = C.ink
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = C.border
                        e.currentTarget.style.color = C.inkSoft
                      }}
                      title={`Adicionar demanda diretamente em ${col.nome}`}
                    >
                      <Plus size={12} color={col.cor} />
                      <span>Adicionar nesta coluna</span>
                    </button>
                  )}
                  {cardsDaColuna.length === 0 ? (
                    <div style={{
                      padding: '40px 10px',
                      textAlign: 'center',
                      color: isDragOver ? col.cor : C.inkSoft,
                      fontSize: 11,
                      border: `1px dashed ${isDragOver ? col.cor : C.border}`,
                      borderRadius: 6,
                      background: isDragOver ? `${col.cor}12` : 'transparent',
                      transition: 'all 0.15s ease'
                    }}>
                      {isDragOver ? 'Solte o card aqui' : 'Nenhum pedido nesta etapa'}
                    </div>
                  ) : (
                    cardsDaColuna.map(item => {
                      const obra = obras.find(o => o.id === item.obra_id)
                      const contaVinculada = contasVinculadas[item.id]

                      const prioridadeBg =
                        item.prioridade === 'urgente' ? 'rgba(239, 68, 68, 0.15)' :
                        item.prioridade === 'alta' ? 'rgba(245, 158, 11, 0.15)' :
                        item.prioridade === 'media' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(156, 163, 175, 0.12)'

                      const prioridadeCor =
                        item.prioridade === 'urgente' ? '#EF4444' :
                        item.prioridade === 'alta' ? C.amber :
                        item.prioridade === 'media' ? '#3B82F6' : '#9CA3AF'

                      const checklist = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
                      const totalChecklist = checklist.length
                      const entreguesChecklist = checklist.filter((c: any) => c.status === 'entregue').length
                      const anexosCount = Array.isArray(item.anexos) ? item.anexos.length : 0
                      const chatCount = Array.isArray(item.chat_mensagens) ? item.chat_mensagens.length : 0
                      const isDraggingThis = draggingCardId === item.id

                      return (
                        <div
                          key={item.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', item.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggingCardId(item.id)
                            justDraggedRef.current = true
                          }}
                          onDragEnd={() => {
                            setDraggingCardId(null)
                            setDragOverCol(null)
                            setTimeout(() => {
                              justDraggedRef.current = false
                            }, 200)
                          }}
                          onPointerDown={(e) => {
                            if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
                              return
                            }
                            cardPointerDownRef.current = {
                              id: item.id,
                              x: e.clientX,
                              y: e.clientY,
                              time: Date.now()
                            }
                          }}
                          onPointerUp={(e) => {
                            if (!cardPointerDownRef.current || cardPointerDownRef.current.id !== item.id) return
                            const dx = Math.abs(e.clientX - cardPointerDownRef.current.x)
                            const dy = Math.abs(e.clientY - cardPointerDownRef.current.y)
                            const dt = Date.now() - cardPointerDownRef.current.time
                            cardPointerDownRef.current = null

                            if (dx < 8 && dy < 8 && dt < 450 && !justDraggedRef.current) {
                              handleAbrirCardDrawer(item)
                            }
                          }}
                          onClick={() => {
                            if (justDraggedRef.current) return
                            handleAbrirCardDrawer(item)
                          }}
                          style={{
                            background: C.bgCard,
                            border: `1px solid ${isDraggingThis ? C.amber : C.border}`,
                            borderRadius: 6,
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 9,
                            boxShadow: isDraggingThis ? '0 8px 24px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.05)',
                            opacity: isDraggingThis ? 0.35 : 1,
                            transform: isDraggingThis ? 'scale(0.97)' : 'none',
                            transition: 'transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                            cursor: isDraggingThis ? 'grabbing' : 'pointer',
                            touchAction: 'pan-y',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!draggingCardId) e.currentTarget.style.borderColor = C.amber
                          }}
                          onMouseLeave={(e) => {
                            if (!draggingCardId) e.currentTarget.style.borderColor = C.border
                          }}
                        >
                          {/* Topo do Card */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '2px 4px',
                                  borderRadius: 4,
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  cursor: 'grab',
                                  marginRight: 2
                                }}
                                title="Segure e arraste para mover entre etapas"
                              >
                                <GripVertical size={13} color={C.inkSoft} style={{ opacity: 0.8 }} />
                              </div>
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 900,
                                fontFamily: 'monospace',
                                color: C.amber,
                                background: item.codigo ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                                border: item.codigo ? '1px solid rgba(245, 158, 11, 0.3)' : 'none',
                                padding: item.codigo ? '1px 5px' : '0',
                                borderRadius: 3
                              }}>
                                {item.codigo ? item.codigo : `OC-${item.id.slice(0, 6).toUpperCase()}`}
                              </span>
                              {(obra || item.obra_nome_manual) && (
                                <span style={{ fontSize: 9.5, fontWeight: 800, background: 'rgba(245, 158, 11, 0.08)', color: C.amber, border: `1px solid rgba(245, 158, 11, 0.25)`, padding: '1px 5px', borderRadius: 3 }}>
                                  🏢 {obra ? obra.nome : item.obra_nome_manual}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <button
                                type="button"
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAbrirCardDrawer(item)
                                }}
                                style={{
                                  border: `1px solid ${C.border}`,
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  color: C.inkSoft,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = C.amber
                                  e.currentTarget.style.color = C.amber
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = C.border
                                  e.currentTarget.style.color = C.inkSoft
                                }}
                                title="Abrir demanda para ver detalhes e editar"
                              >
                                <Edit3 size={10} />
                                <span>Editar</span>
                              </button>

                              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', background: prioridadeBg, color: prioridadeCor, padding: '2px 5px', borderRadius: 3 }}>
                                {item.prioridade}
                              </span>
                            </div>
                          </div>

                          {/* Título & Detalhes */}
                          <div>
                            <h5 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>
                              {item.titulo}
                            </h5>
                            {totalChecklist > 0 ? (
                              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                                Materiais: <strong style={{ color: C.ink }}>{totalChecklist} item(ns) no pedido</strong>
                              </div>
                            ) : (item.quantidade || item.unidade) ? (
                              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                                Quantidade: <strong style={{ color: C.ink }}>{item.quantidade} {item.unidade}</strong>
                              </div>
                            ) : null}
                          </div>

                          {/* Solicitante & Responsáveis da Demanda */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                              {/* Solicitante (Login de Origem) */}
                              {item.solicitante && (
                                <span style={{ color: C.inkSoft, fontSize: 9.5 }}>
                                  👤 Solicitante: <strong style={{ color: C.ink }}>{item.solicitante}</strong>
                                </span>
                              )}

                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.inkSoft, marginLeft: 'auto' }}>
                                {totalChecklist > 0 && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    color: entreguesChecklist === totalChecklist ? '#10B981' : C.amber,
                                    fontWeight: 700
                                  }} title={`Checklist: ${entreguesChecklist}/${totalChecklist} entregues`}>
                                    <CheckSquare size={11} /> {entreguesChecklist}/{totalChecklist}
                                  </span>
                                )}
                                {anexosCount > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title={`${anexosCount} arquivo(s) anexado(s)`}>
                                    <Paperclip size={11} /> {anexosCount}
                                  </span>
                                )}
                                {chatCount > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title={`${chatCount} mensagem(ns) no chat`}>
                                    <MessageSquare size={11} /> {chatCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
                              {/* Responsável Atual (Engenheiro) */}
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                color: item.responsavel_nome ? C.ink : C.inkSoft,
                                background: item.responsavel_nome ? 'rgba(255,255,255,0.04)' : 'transparent',
                                padding: item.responsavel_nome ? '2px 5px' : '0',
                                borderRadius: 3,
                                border: item.responsavel_nome ? `1px solid ${C.border}` : 'none',
                                fontSize: 9.5
                              }}>
                                <User size={10} color={item.responsavel_nome ? C.amber : C.inkSoft} />
                                <span style={{ fontWeight: item.responsavel_nome ? 700 : 400 }}>
                                  {item.responsavel_nome || 'Sem resp.'}
                                </span>
                              </div>

                              {/* Próximo Responsável */}
                              {item.proximo_responsavel_nome && (
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  color: '#3B82F6',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                  padding: '2px 5px',
                                  borderRadius: 3,
                                  fontSize: 9.5,
                                  fontWeight: 700
                                }}>
                                  <span>➡️ Próx: {item.proximo_responsavel_nome}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Fornecedor & Valor */}
                          <div style={{ fontSize: 11, background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: C.inkSoft }}>Fornecedor:</span>
                              <strong style={{ color: item.fornecedor ? C.ink : C.inkSoft, fontSize: 10.5 }}>
                                {item.fornecedor || 'A definir'}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: C.inkSoft }}>Valor Total:</span>
                              <strong style={{ color: '#10B981', fontFamily: 'monospace', fontSize: 12 }}>
                                {item.valor ? `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Em cotação'}
                              </strong>
                            </div>
                          </div>

                          {/* BADGES SÍNCRONOS DA INTEGRAÇÃO */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {/* Alerta de Divergência de Valor Financeiro vs Suprimentos */}
                            {contaVinculada && item.valor && Math.abs(contaVinculada.valor - item.valor) > 0.01 && (
                              <div
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  color: '#EF4444',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  padding: '3px 6px',
                                  borderRadius: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                title={`Valor no Financeiro (R$ ${contaVinculada.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do Suprimentos`}
                              >
                                <AlertTriangle size={11} color="#EF4444" />
                                <span>Valor divergente: Fin. R$ {contaVinculada.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}

                            {/* 1. Badge Financeiro Vivo */}
                            {contaVinculada ? (
                              <div style={{
                                fontSize: 10,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: contaVinculada.status === 'Pago' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                color: contaVinculada.status === 'Pago' ? '#10B981' : C.amber,
                                border: `1px solid ${contaVinculada.status === 'Pago' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                padding: '3px 7px',
                                borderRadius: 4
                              }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <DollarSign size={11} />
                                  {contaVinculada.status === 'Pago'
                                    ? `Pago em ${contaVinculada.pago_em ? new Date(contaVinculada.pago_em).toLocaleDateString('pt-BR') : 'OK'}`
                                    : `Financeiro: ${contaVinculada.status}`}
                                </span>
                                {contaVinculada.comprovante_url && (
                                  <a
                                    href={contaVinculada.comprovante_url.startsWith('[') ? JSON.parse(contaVinculada.comprovante_url)[0] : contaVinculada.comprovante_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                    title="Ver comprovante anexado"
                                  >
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <>
                                {item.status === 'Aprovação' && (
                                  <div style={{ fontSize: 9.5, color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={10} /> Aguardando aprovação da compra
                                  </div>
                                )}
                                {(item.status === 'Em Trânsito' || item.status === 'Entregue') && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      abrirModalAprovacao(item, true)
                                    }}
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      color: '#F97316',
                                      background: 'rgba(249, 115, 22, 0.14)',
                                      border: '1px solid rgba(249, 115, 22, 0.4)',
                                      padding: '4px 7px',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 6,
                                      cursor: 'pointer'
                                    }}
                                    title="Clique para lançar manualmente esta compra no Financeiro"
                                  >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <AlertTriangle size={11} /> ⚠️ Sem Financeiro (Lançamento Manual)
                                    </span>
                                    <span style={{ background: '#F97316', color: '#0A0A0A', padding: '1px 5px', borderRadius: 3, fontSize: 8.5, fontWeight: 900 }}>
                                      + Lançar
                                    </span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* 2. Badge Canteiro Vivo */}
                            {item.status === 'Em Trânsito' && (
                              <div style={{ fontSize: 9.5, color: '#06B6D4', background: 'rgba(6, 182, 212, 0.1)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Truck size={10} /> A caminho da obra (Previsão: {item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'A definir'})
                              </div>
                            )}

                            {item.status === 'Entregue' && (
                              <div style={{ fontSize: 9.5, color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={10} /> Recebido e conferido no canteiro
                              </div>
                            )}

                            {Array.isArray(item.historico_atividades) && item.historico_atividades.some((a: any) => a.dgenny_quotation_id || a.acao === 'dgenny_cotacao_iniciada') && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAbrirCardDrawer(item, 'dgenny')
                                }}
                                style={{ fontSize: 9.5, color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, cursor: 'pointer' }}
                                title="Abrir mapa de cotação IA dgenny"
                              >
                                <Bot size={11} /> Cotação IA dgenny no WhatsApp
                              </div>
                            )}
                          </div>

                          {/* AÇÕES NO CARD */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 2 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <button
                                type="button"
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAbrirCardDrawer(item)
                                }}
                                style={{
                                  border: `1px solid ${C.border}`,
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  color: C.inkSoft,
                                  padding: '3px 7px',
                                  borderRadius: 4,
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = C.amber
                                  e.currentTarget.style.color = C.amber
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = C.border
                                  e.currentTarget.style.color = C.inkSoft
                                }}
                                title="Ver detalhes completos e editar"
                              >
                                <ExternalLink size={10} />
                                <span>Detalhes</span>
                              </button>

                              {(item.status === 'Solicitado' || item.status === 'Em Cotação') && (
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAbrirCardDrawer(item, 'dgenny')
                                  }}
                                  style={{
                                    border: '1px solid rgba(139, 92, 246, 0.35)',
                                    background: 'rgba(139, 92, 246, 0.12)',
                                    color: '#A78BFA',
                                    padding: '3px 7px',
                                    borderRadius: 4,
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Abrir agente IA dgenny para cotar no WhatsApp"
                                >
                                  <Bot size={10} />
                                  <span>Cotar IA</span>
                                </button>
                              )}

                              <button
                                type="button"
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleExcluirSuprimento(item)
                                }}
                                style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 4, borderRadius: 3 }}
                                title="Excluir pedido"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {/* Botão de Ação Primária dependendo da etapa */}
                            {item.status === 'Solicitado' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMoverEtapa(item, 'Em Cotação')
                                  }}
                                  style={{ ...btnBase, padding: '4px 7px', fontSize: 9.5, background: 'rgba(245, 158, 11, 0.15)', color: C.amber, border: `1px solid rgba(245, 158, 11, 0.3)` }}
                                  title="Enviar para cotação com fornecedores"
                                >
                                  Cotar <ArrowRight size={10} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMoverEtapa(item, 'Aprovação')
                                  }}
                                  style={{ ...btnBase, padding: '4px 7px', fontSize: 9.5, background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.35)' }}
                                  title="Pular cotação e enviar direto para Aprovação (compra direta)"
                                >
                                  Direto p/ Aprovação
                                </button>
                              </div>
                            )}

                            {item.status === 'Em Cotação' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMoverEtapa(item, 'Aprovação')
                                }}
                                style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', border: `1px solid rgba(139, 92, 246, 0.3)` }}
                              >
                                Enviar p/ Aprovação <ArrowRight size={11} />
                              </button>
                            )}

                            {item.status === 'Aprovação' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  abrirModalAprovacao(item)
                                }}
                                style={{ ...btnBase, padding: '5px 9px', fontSize: 10.5, background: C.amber, color: '#0A0A0A', fontWeight: 900 }}
                              >
                                <ShieldCheck size={12} /> Aprovar Compra
                              </button>
                            )}

                            {item.status === 'Em Trânsito' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const txt = gerarTextoOrdemCompra(item)
                                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                      await navigator.clipboard.writeText(txt)
                                      toast('Ordem de Compra (OC) copiada para colar no WhatsApp do fornecedor!', 'success')
                                    }
                                  }}
                                  style={{ ...btnBase, padding: '4px 7px', fontSize: 9.5, background: 'rgba(6, 182, 212, 0.14)', color: '#06B6D4', border: '1px solid rgba(6, 182, 212, 0.3)' }}
                                  title="Copiar Ordem de Compra (OC) para enviar ao fornecedor no WhatsApp"
                                >
                                  📋 Copiar OC
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    abrirModalRecebimento(item)
                                  }}
                                  style={{ ...btnBase, padding: '5px 8px', fontSize: 10, background: '#10B981', color: '#0A0A0A', fontWeight: 900 }}
                                >
                                  <CheckSquare size={11} /> Receber
                                </button>
                              </div>
                            )}

                            {item.status === 'Entregue' && (
                              <span style={{ fontSize: 10, color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Check size={12} /> Concluído
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                  {isDragOver && cardsDaColuna.length > 0 && (
                    <div style={{
                      padding: '10px',
                      textAlign: 'center',
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: col.cor,
                      border: `1px dashed ${col.cor}`,
                      borderRadius: 6,
                      background: `${col.cor}12`
                    }}>
                      Soltar aqui em {col.nome}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* VISÃO 2: TABELA GERAL OPERACIONAL */
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.bgWhite, borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Código / Material</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Responsável</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Obra</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Etapa Esteira</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Fornecedor</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Valor</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft }}>Status Financeiro</th>
                <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: C.inkSoft, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {suprimentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 12px', textAlign: 'center', color: C.inkSoft, fontSize: 12 }}>
                    Nenhum pedido encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                suprimentosFiltrados.map(item => {
                  const obra = obras.find(o => o.id === item.obra_id)
                  const conta = contasVinculadas[item.id]
                  const checklist = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
                  const entregues = checklist.filter((c: any) => c.status === 'entregue').length
                  const totalChk = checklist.length
                  const anexosCount = Array.isArray(item.anexos) ? item.anexos.length : 0
                  const chatCount = Array.isArray(item.chat_mensagens) ? item.chat_mensagens.length : 0

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setDrawerItem(item)
                        setDrawerOpen(true)
                      }}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background 0.1s ease' }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800, color: C.ink }}>{item.titulo}</div>
                        <div style={{ fontSize: 10, color: C.inkSoft, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>OC-{item.id.slice(0, 6).toUpperCase()} · {item.quantidade || ''} {item.unidade || ''}</span>
                          {totalChk > 0 && (
                            <span style={{ color: entregues === totalChk ? '#10B981' : C.amber, fontWeight: 700 }}>
                              ☑ {entregues}/{totalChk}
                            </span>
                          )}
                          {anexosCount > 0 && <span>📎 {anexosCount}</span>}
                          {chatCount > 0 && <span>💬 {chatCount}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, color: item.responsavel_nome ? C.ink : C.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} color={item.responsavel_nome ? C.amber : C.inkSoft} />
                          {item.responsavel_nome || 'Sem responsável'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: C.ink }}>
                        {obra ? obra.nome : 'Geral / Sede'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: item.status === 'Entregue' ? 'rgba(16, 185, 129, 0.15)' :
                                      item.status === 'Em Trânsito' ? 'rgba(6, 182, 212, 0.15)' :
                                      item.status === 'Aprovação' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: item.status === 'Entregue' ? '#10B981' :
                                 item.status === 'Em Trânsito' ? '#06B6D4' :
                                 item.status === 'Aprovação' ? '#8B5CF6' : C.amber
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: C.ink }}>
                        {item.fornecedor || <span style={{ color: C.inkSoft }}>Em cotação</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#10B981' }}>
                        {item.valor ? `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {conta ? (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: conta.status === 'Pago' ? '#10B981' : C.amber,
                            background: conta.status === 'Pago' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            padding: '2px 6px',
                            borderRadius: 3
                          }}>
                            {conta.status === 'Pago' ? 'Pago' : `Lançado (#${conta.codigo_sequencial || conta.id.slice(0, 5)})`}
                          </span>
                        ) : (item.status === 'Em Trânsito' || item.status === 'Entregue') ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirModalAprovacao(item, true)
                            }}
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              color: '#F97316',
                              background: 'rgba(249, 115, 22, 0.14)',
                              border: '1px solid rgba(249, 115, 22, 0.4)',
                              padding: '3px 7px',
                              borderRadius: 4,
                              cursor: 'pointer'
                            }}
                          >
                            ⚠️ Pendente Financeiro (+ Lançar)
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: C.inkSoft }}>Aguardando Aprovação</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {item.status === 'Aprovação' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                abrirModalAprovacao(item)
                              }}
                              style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: C.amber, color: '#0A0A0A' }}
                            >
                              Aprovar
                            </button>
                          )}
                          {item.status === 'Em Trânsito' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                abrirModalRecebimento(item)
                              }}
                              style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: '#10B981', color: '#0A0A0A' }}
                            >
                              Receber
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExcluirSuprimento(item)
                            }}
                            style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 4 }}
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL 1: NOVA SOLICITAÇÃO DE COMPRA ────────────────────────────── */}
      {modalNovoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 22, maxWidth: 560, width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingCart size={16} color={C.amber} />
                  Nova Solicitação de Compra
                </h3>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                  Aberto pela equipe de obra ou canteiro para iniciar o fluxo de suprimentos.
                </p>
              </div>
              <button onClick={() => setModalNovoOpen(false)} style={{ border: 'none', background: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCriarSolicitacao} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 1. Código & Título do Cartão */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={labelStyle}>Código / Identificador (Estilo Trello)</span>
                  <input
                    style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700 }}
                    placeholder="Ex: SG-BC 0069/26"
                    value={novoForm.codigo}
                    onChange={e => setNovoForm({ ...novoForm, codigo: e.target.value })}
                    autoFocus
                  />
                  <span style={{ fontSize: 9.5, color: C.inkSoft, marginTop: 2, display: 'block' }}>
                    Identificador único do pedido ou cartão da demanda.
                  </span>
                </div>

                <div>
                  <span style={labelStyle}>Título / Categoria Geral</span>
                  <input
                    style={inputStyle}
                    placeholder="Ex: FERRAMENTAS, CIMENTO, ELÉTRICA (opcional)"
                    value={novoForm.titulo}
                    onChange={e => setNovoForm({ ...novoForm, titulo: e.target.value })}
                  />
                  <span style={{ fontSize: 9.5, color: C.inkSoft, marginTop: 2, display: 'block' }}>
                    Se vazio, será gerado automaticamente pelos materiais.
                  </span>
                </div>
              </div>

              {/* 2. Lista Dinâmica de Materiais com Botão "+" */}
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ ...labelStyle, marginBottom: 0, color: C.ink }}>
                    📦 Materiais ou Insumos Solicitados ({novoForm.itens.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAdicionarItemForm}
                    style={{
                      ...btnBase,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: C.amber,
                      border: `1px solid ${C.amber}44`,
                      padding: '4px 8px',
                      fontSize: 10.5
                    }}
                  >
                    <Plus size={12} /> Adicionar Material
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {novoForm.itens.map((it, idx) => (
                    <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 32px', gap: 6, alignItems: 'center' }}>
                      <input
                        style={inputStyle}
                        placeholder={`Material ${idx + 1} (Ex: Furadeira de impacto, 20 sacos de cimento)`}
                        value={it.descricao}
                        onChange={e => handleAtualizarItemForm(it.id, 'descricao', e.target.value)}
                        required={idx === 0 && !novoForm.titulo}
                      />
                      <input
                        style={inputStyle}
                        placeholder="Qtd (Ex: 10)"
                        value={it.quantidade}
                        onChange={e => handleAtualizarItemForm(it.id, 'quantidade', e.target.value)}
                      />
                      <select
                        style={inputStyle}
                        value={it.unidade}
                        onChange={e => handleAtualizarItemForm(it.id, 'unidade', e.target.value)}
                      >
                        <option value="un">un (Unidade)</option>
                        <option value="saco">saco (Sacos)</option>
                        <option value="barra">barra (Barras)</option>
                        <option value="m">m (Metros)</option>
                        <option value="m²">m² (Metro Quad.)</option>
                        <option value="m³">m³ (Metro Cúb.)</option>
                        <option value="kg">kg (Quilograma)</option>
                        <option value="litro">litro (Litros)</option>
                        <option value="caixa">caixa (Caixas)</option>
                        <option value="rolo">rolo (Rolos)</option>
                        <option value="peça">peça (Peças)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoverItemForm(it.id)}
                        disabled={novoForm.itens.length <= 1}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: novoForm.itens.length <= 1 ? C.inkSoft : '#EF4444',
                          cursor: novoForm.itens.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: novoForm.itens.length <= 1 ? 0.3 : 1
                        }}
                        title="Remover item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Obra Destino com Suporte a "Outros" */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={labelStyle}>Obra Destino</span>
                  <select
                    style={inputStyle}
                    value={novoForm.obra_id}
                    onChange={e => setNovoForm({ ...novoForm, obra_id: e.target.value })}
                  >
                    <option value="">🏢 Geral / Sede</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                    <option value="__outros__">📍 Outros / Local não cadastrado...</option>
                  </select>
                </div>

                <div>
                  <span style={labelStyle}>Etapa Inicial da Esteira</span>
                  <select
                    style={inputStyle}
                    value={novoForm.status}
                    onChange={e => setNovoForm({ ...novoForm, status: e.target.value as any })}
                  >
                    {COLUNAS_ESTEIRA.map(col => (
                      <option key={col.id} value={col.id}>
                        {col.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Se selecionou "Outros" na obra, abre campo manual */}
              {novoForm.obra_id === '__outros__' && (
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 6, padding: 10 }}>
                  <span style={{ ...labelStyle, color: C.amber }}>Nome do Local / Obra Destino (Preenchimento Manual) *</span>
                  <input
                    style={inputStyle}
                    placeholder="Digite o local ou canteiro onde o material será entregue..."
                    value={novoForm.obra_nome_manual}
                    onChange={e => setNovoForm({ ...novoForm, obra_nome_manual: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* 4. Solicitante Automático (Login) & Responsáveis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Solicitante: Automático pelo Login */}
                <div>
                  <span style={labelStyle}>Solicitante (Registrado pelo Login)</span>
                  <div style={{
                    ...inputStyle,
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: C.ink,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'default'
                  }}>
                    <User size={13} color={C.amber} />
                    <span style={{ fontWeight: 800 }}>{colaboradorAtivo?.nome || 'Usuário Atual'}</span>
                    <span style={{ fontSize: 9, color: C.inkSoft, marginLeft: 'auto', background: C.bgCard, padding: '1px 5px', borderRadius: 3 }}>
                      Sessão Ativa
                    </span>
                  </div>
                </div>

                {/* Responsável da Demanda (Engenheiro) */}
                <div>
                  <span style={labelStyle}>Responsável da Demanda (Engenheiro)</span>
                  <select
                    style={inputStyle}
                    value={novoForm.responsavel_id || ''}
                    onChange={e => {
                      const colab = colaboradores.find(c => c.id === e.target.value)
                      setNovoForm({
                        ...novoForm,
                        responsavel_id: e.target.value,
                        responsavel_nome: colab ? colab.nome : ''
                      })
                    }}
                  >
                    <option value="">Sem responsável inicial</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Próximo Responsável & Prioridade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ ...labelStyle, color: '#3B82F6' }}>
                    ➡️ Próximo Responsável (Direto pelo próximo passo)
                  </span>
                  <select
                    style={{ ...inputStyle, borderColor: 'rgba(59, 130, 246, 0.4)' }}
                    value={novoForm.proximo_responsavel_id || ''}
                    onChange={e => {
                      const colab = colaboradores.find(c => c.id === e.target.value)
                      setNovoForm({
                        ...novoForm,
                        proximo_responsavel_id: e.target.value,
                        proximo_responsavel_nome: colab ? colab.nome : ''
                      })
                    }}
                  >
                    <option value="">Selecione o próximo responsável...</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span style={labelStyle}>Prioridade</span>
                  <select
                    style={inputStyle}
                    value={novoForm.prioridade}
                    onChange={e => setNovoForm({ ...novoForm, prioridade: e.target.value as any })}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* 6. Fornecedor Sugerido & Valor Estimado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={labelStyle}>Fornecedor Sugerido (Opcional)</span>
                  <select
                    style={inputStyle}
                    value={novoForm.fornecedor_id}
                    onChange={e => setNovoForm({ ...novoForm, fornecedor_id: e.target.value })}
                  >
                    <option value="">A definir na cotação</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nome_fantasia || f.razao_social}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span style={labelStyle}>Valor Estimado (R$)</span>
                  <input
                    style={inputStyle}
                    placeholder="Ex: 6.400,00"
                    value={novoForm.valor}
                    onChange={e => setNovoForm({ ...novoForm, valor: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setModalNovoOpen(false)}
                  style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNovo}
                  style={{ ...btnBase, background: C.amber, color: '#0A0A0A', fontWeight: 900 }}
                >
                  {salvandoNovo ? 'Salvando...' : 'Abrir Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: APROVAÇÃO, ENVIO DE OC & LANÇAMENTO FINANCEIRO ─────────── */}
      {modalAprovarOpen && itemSelecionado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 22, maxWidth: 580, width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color={C.amber} />
                  {itemSelecionado.status === 'Em Trânsito' || itemSelecionado.status === 'Entregue'
                    ? 'Lançar Compra Aprovada no Financeiro'
                    : 'Aprovação de Compra, Ordem de Compra (OC) & Financeiro'}
                </h3>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                  Gere/envie a Ordem de Compra ao fornecedor e escolha se deseja lançar no Financeiro agora ou deixar para lançamento manual posterior.
                </p>
              </div>
              <button onClick={() => setModalAprovarOpen(false)} style={{ border: 'none', background: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {/* Resumo do Pedido */}
            <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>
                  Pedido {itemSelecionado.codigo || `OC-${itemSelecionado.id.slice(0, 6).toUpperCase()}`}
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.amber }}>
                  Obra: {obras.find(o => o.id === itemSelecionado.obra_id)?.nome || itemSelecionado.obra_nome_manual || 'Geral'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginTop: 2 }}>{itemSelecionado.titulo}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                Quantidade: <strong>{itemSelecionado.quantidade} {itemSelecionado.unidade}</strong>
                {itemSelecionado.fornecedor && <> · Fornecedor sugerido/cotado: <strong>{itemSelecionado.fornecedor}</strong></>}
              </div>
            </div>

            <form onSubmit={handleAprovarEEnviarFinanceiro} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Chave seletora: Lançar no Financeiro Automático vs Lançamento Manual Posterior */}
              {itemSelecionado.status !== 'Em Trânsito' && itemSelecionado.status !== 'Entregue' && (
                <div style={{
                  background: aprovForm.lancar_financeiro ? 'rgba(16, 185, 129, 0.08)' : 'rgba(249, 115, 22, 0.1)',
                  border: `1px solid ${aprovForm.lancar_financeiro ? 'rgba(16, 185, 129, 0.3)' : 'rgba(249, 115, 22, 0.35)'}`,
                  borderRadius: 6,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <span style={{ fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', color: C.ink }}>
                    Modo de Integração com o Financeiro:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAprovForm(prev => ({ ...prev, lancar_financeiro: true }))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 5,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1.5px solid ${aprovForm.lancar_financeiro ? '#10B981' : C.border}`,
                        background: aprovForm.lancar_financeiro ? 'rgba(16, 185, 129, 0.15)' : C.bgCard,
                        color: C.ink
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 900, color: aprovForm.lancar_financeiro ? '#10B981' : C.ink }}>
                        ✅ Lançar no Financeiro Agora
                      </div>
                      <div style={{ fontSize: 9.5, color: C.inkSoft, marginTop: 2 }}>
                        Cria a conta a pagar automaticamente ao aprovar.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAprovForm(prev => ({ ...prev, lancar_financeiro: false }))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 5,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1.5px solid ${!aprovForm.lancar_financeiro ? '#F97316' : C.border}`,
                        background: !aprovForm.lancar_financeiro ? 'rgba(249, 115, 22, 0.15)' : C.bgCard,
                        color: C.ink
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 900, color: !aprovForm.lancar_financeiro ? '#F97316' : C.ink }}>
                        ⚠️ Sem Financeiro (Manual Depois)
                      </div>
                      <div style={{ fontSize: 9.5, color: C.inkSoft, marginTop: 2 }}>
                        Aprova e move p/ Em Trânsito com tarja p/ engenheiro lançar depois.
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span style={labelStyle}>
                  Fornecedor Vencedor / Compra {aprovForm.lancar_financeiro ? '*' : '(Opcional se definir depois)'}
                </span>
                <select
                  style={inputStyle}
                  value={aprovForm.fornecedor_id}
                  onChange={e => setAprovForm({ ...aprovForm, fornecedor_id: e.target.value })}
                  required={aprovForm.lancar_financeiro}
                >
                  <option value="">Selecione o Fornecedor...</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome_fantasia ? `${f.nome_fantasia} (${f.razao_social})` : f.razao_social} {f.cnpj ? `· CNPJ: ${f.cnpj}` : ''}
                    </option>
                  ))}
                </select>

                {(() => {
                  const forn = fornecedores.find(f => f.id === aprovForm.fornecedor_id)
                  if (!forn) return null
                  return (
                    <div style={{ fontSize: 10, color: '#10B981', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '5px 8px', borderRadius: 4, marginTop: 4 }}>
                      {forn.cnpj && <span><strong>CNPJ:</strong> {forn.cnpj} </span>}
                      {forn.telefone && <span>· <strong>WhatsApp:</strong> {forn.telefone} </span>}
                      {forn.pix && <span>· <strong>PIX:</strong> {forn.pix} </span>}
                      {forn.banco && <span>· <strong>Banco:</strong> {forn.banco} (Ag: {forn.agencia} / Cc: {forn.conta})</span>}
                    </div>
                  )
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={labelStyle}>Valor Final Aprovado (R$) {aprovForm.lancar_financeiro ? '*' : '(Opcional)'}</span>
                  <input
                    style={inputStyle}
                    placeholder="Ex: 6.400,00"
                    value={aprovForm.valor_final}
                    onChange={e => setAprovForm({ ...aprovForm, valor_final: e.target.value })}
                    required={aprovForm.lancar_financeiro}
                  />
                </div>

                <div>
                  <span style={labelStyle}>Data de Vencimento / Previsão {aprovForm.lancar_financeiro ? '*' : ''}</span>
                  <input
                    type="date"
                    style={inputStyle}
                    value={aprovForm.data_vencimento}
                    onChange={e => setAprovForm({ ...aprovForm, data_vencimento: e.target.value })}
                    required={aprovForm.lancar_financeiro}
                  />
                </div>
              </div>

              <div>
                <span style={labelStyle}>Condição de Pagamento Acordada</span>
                <input
                  style={inputStyle}
                  placeholder="Ex: 28 dias após entrega, 30/60 dias, À vista no PIX..."
                  value={aprovForm.condicao_pagamento}
                  onChange={e => setAprovForm({ ...aprovForm, condicao_pagamento: e.target.value })}
                />
              </div>

              {/* Bloco de Envio da Ordem de Compra (OC) antes/junto do Financeiro */}
              <div style={{
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase' }}>
                    📄 Envio da Ordem de Compra (OC) ao Fornecedor
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const txt = gerarTextoOrdemCompra(
                          itemSelecionado,
                          aprovForm.fornecedor_id,
                          aprovForm.valor_final,
                          aprovForm.data_vencimento,
                          aprovForm.condicao_pagamento
                        )
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          await navigator.clipboard.writeText(txt)
                          toast('Ordem de Compra (OC) copiada! Cole no WhatsApp do fornecedor.', 'success')
                        }
                      }}
                      style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: C.bgCard, color: '#06B6D4', border: '1px solid rgba(6, 182, 212, 0.4)' }}
                    >
                      📋 Copiar OC Agora
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const txt = gerarTextoOrdemCompra(
                          itemSelecionado,
                          aprovForm.fornecedor_id,
                          aprovForm.valor_final,
                          aprovForm.data_vencimento,
                          aprovForm.condicao_pagamento
                        )
                        const forn = fornecedores.find(f => f.id === aprovForm.fornecedor_id)
                        const foneLimpo = (forn?.telefone || '').replace(/\D/g, '')
                        const foneUrl = foneLimpo ? (foneLimpo.startsWith('55') ? foneLimpo : `55${foneLimpo}`) : ''
                        const waUrl = foneUrl
                          ? `https://wa.me/${foneUrl}?text=${encodeURIComponent(txt)}`
                          : `https://wa.me/?text=${encodeURIComponent(txt)}`
                        window.open(waUrl, '_blank')
                      }}
                      style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: '#10B981', color: '#0A0A0A', fontWeight: 900 }}
                    >
                      📲 Enviar OC no WhatsApp
                    </button>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={aprovForm.copiar_oc_ao_aprovar}
                    onChange={e => setAprovForm(prev => ({ ...prev, copiar_oc_ao_aprovar: e.target.checked }))}
                  />
                  <span>Copiar Ordem de Compra (OC) automaticamente ao confirmar aprovação</span>
                </label>

                {Array.isArray(itemSelecionado.historico_atividades) && itemSelecionado.historico_atividades.some((a: any) => a.dgenny_quotation_id) && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A78BFA', cursor: 'pointer', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={aprovForm.enviar_oc_dgenny}
                      onChange={e => setAprovForm(prev => ({ ...prev, enviar_oc_dgenny: e.target.checked }))}
                    />
                    <span>🤖 Disparar OC automaticamente via dgenny IA no WhatsApp do fornecedor cotado</span>
                  </label>
                )}
              </div>

              <div>
                <span style={labelStyle}>Anexar Ordem de Compra / Cotação / Proposta (Opcional)</span>
                <input
                  type="file"
                  style={{ ...inputStyle, padding: 6 }}
                  onChange={e => {
                    const f = e.target.files?.[0] || null
                    setAprovForm({ ...aprovForm, anexo_file: f })
                  }}
                  accept=".pdf,image/*"
                />
                <span style={{ fontSize: 10, color: C.inkSoft }}>
                  O arquivo será anexado automaticamente no comprovante da conta no Financeiro.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setModalAprovarOpen(false)}
                  style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoAprovacao}
                  style={{ ...btnBase, background: aprovForm.lancar_financeiro ? C.amber : '#F97316', color: '#0A0A0A', fontWeight: 900 }}
                >
                  {salvandoAprovacao
                    ? 'Processando...'
                    : aprovForm.lancar_financeiro
                      ? 'Confirmar Aprovação & Lançar no Financeiro'
                      : 'Aprovar Compra (Lançar no Financeiro Depois)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CONFIRMAÇÃO DE RECEBIMENTO NO CANTEIRO ─────────────────── */}
      {modalReceberOpen && itemSelecionado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 22, maxWidth: 500, width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckSquare size={16} color="#10B981" />
                  Conferência & Recebimento no Canteiro
                </h3>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                  Confirme a entrega física. O Financeiro será informado de que o material está na obra.
                </p>
              </div>
              <button onClick={() => setModalReceberOpen(false)} style={{ border: 'none', background: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{itemSelecionado.titulo}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                Fornecedor: <strong>{itemSelecionado.fornecedor}</strong> · Pedido: <strong>{itemSelecionado.quantidade} {itemSelecionado.unidade}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmarRecebimento} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={labelStyle}>Quantidade Física Entregue</span>
                <input
                  style={inputStyle}
                  value={recebForm.quantidade_recebida}
                  onChange={e => setRecebForm({ ...recebForm, quantidade_recebida: e.target.value })}
                  placeholder="Ex: 200"
                  required
                />
              </div>

              <div>
                <span style={labelStyle}>Foto da Entrega / Canhoto da Nota Fiscal</span>
                <input
                  type="file"
                  style={{ ...inputStyle, padding: 6 }}
                  onChange={e => {
                    const f = e.target.files?.[0] || null
                    setRecebForm({ ...recebForm, foto_file: f })
                  }}
                  accept="image/*,.pdf"
                />
                <span style={{ fontSize: 10, color: C.inkSoft }}>
                  A foto do canhoto comprova a entrega física para liberação do pagamento.
                </span>
              </div>

              <div>
                <span style={labelStyle}>Observações da Conferência</span>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  value={recebForm.observacao}
                  onChange={e => setRecebForm({ ...recebForm, observacao: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setModalReceberOpen(false)}
                  style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoRecebimento}
                  style={{ ...btnBase, background: '#10B981', color: '#0A0A0A', fontWeight: 900 }}
                >
                  {salvandoRecebimento ? 'Confirmando...' : 'Confirmar Recebimento na Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: CRIAR MESA PERSONALIZADA ───────────────────────────────── */}
      {modalNovaMesaOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 22, maxWidth: 440, width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Settings2 size={16} color={C.amber} />
                  Criar Mesa Personalizada
                </h3>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                  Crie uma mesa dedicada com filtros rápidos salvos na sua sessão.
                </p>
              </div>
              <button onClick={() => setModalNovaMesaOpen(false)} style={{ border: 'none', background: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSalvarMesa} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={labelStyle}>Nome da Mesa *</span>
                <input
                  style={inputStyle}
                  placeholder="Ex: Compras Estruturais, Elétrica, Obra Torres..."
                  value={mesaForm.nome}
                  onChange={e => setMesaForm({ ...mesaForm, nome: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <span style={labelStyle}>Filtrar por Obra Específica (Opcional)</span>
                <select
                  style={inputStyle}
                  value={mesaForm.obra_id}
                  onChange={e => setMesaForm({ ...mesaForm, obra_id: e.target.value })}
                >
                  <option value="">Todas as Obras</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span style={labelStyle}>Filtrar por Prioridade (Opcional)</span>
                <select
                  style={inputStyle}
                  value={mesaForm.prioridade}
                  onChange={e => setMesaForm({ ...mesaForm, prioridade: e.target.value })}
                >
                  <option value="todas">Todas as Prioridades</option>
                  <option value="urgente">Apenas Urgente</option>
                  <option value="alta">Apenas Alta</option>
                  <option value="media">Apenas Média</option>
                  <option value="baixa">Apenas Baixa</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setModalNovaMesaOpen(false)}
                  style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ ...btnBase, background: C.amber, color: '#0A0A0A', fontWeight: 900 }}
                >
                  Salvar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DRAWER 360: DETALHES, CHECKLIST, ANEXOS, CHAT & HISTÓRICO ─── */}
      <SuprimentoCardDrawer
        item={drawerItem}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdateItem={(updatedItem) => {
          setSuprimentos(prev => prev.map(s => s.id === updatedItem.id ? updatedItem : s))
          setDrawerItem(updatedItem)
        }}
        colaboradores={colaboradores}
        obras={obras}
        fornecedores={fornecedores}
        colaboradorAtivo={colaboradorAtivo}
        contaVinculada={drawerItem ? contasVinculadas[drawerItem.id] : undefined}
        initialTab={drawerInitialTab}
      />

      {ConfirmDialog}
    </div>
  )
}
