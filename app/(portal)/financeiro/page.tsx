'use client'
import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, Fragment } from 'react'
import * as XLSX from 'xlsx'
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus,
  Building2, Users, FileText, CheckCircle, Clock, X,
  Search, RefreshCw, ArrowUpRight, ArrowDownRight, Calendar,
  Shield, Check, AlertTriangle, Paperclip, Eye, UserPlus, ToggleLeft, ToggleRight,
  Edit3, Sliders, Camera, Trash2, FileSpreadsheet, Upload, Download, CheckCircle2,
  ChevronDown, ChevronUp, Ruler, BarChart3, Activity, MapPin, Receipt, ShieldCheck, User, Image as ImageIcon, Layers,
  Briefcase, ArrowLeft, Phone, Mail, Landmark, Filter, RotateCcw
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { PageTitle } from '@/components/PageTitle'
import { supabase, fetchAllChunks } from '@/lib/supabase'
import { toast } from '@/components/Toast'
import type { Empresa, Fornecedor, Conta, ContaComRelacoes, Obra, Colaborador, ConfigPermissao, CargoSistema, ItemNegociacao, ItemMedicao } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { motion, AnimatePresence } from 'motion/react'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v || 0))

const fmtDate = (d: string) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

const fmtCodigo = (c: { tipo?: string; codigo_sequencial?: number | null }) => {
  if (!c || !c.codigo_sequencial) return ''
  const pref = c.tipo === 'receber' ? 'REC' : 'PAG'
  return `${pref}-${String(c.codigo_sequencial).padStart(5, '0')}`
}

const parseCurrency = (val: string | number | undefined | null): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const str = String(val).trim()
  if (!str) return 0
  // Aceita tanto o formato brasileiro (1.234,56) quanto o decimal (1234.56).
  // O ponto só é separador de milhar quando existe vírgula decimal.
  const cleanStr = str.includes(',')
    ? str.replace(/\./g, '').replace(',', '.')
    : str
  const num = Number(cleanStr)
  return isNaN(num) ? 0 : num
}

export const CATEGORIAS = ['Material de Construção', 'Serviço Terceirizado', 'Equipamento', 'Locação', 'Imposto', 'Mão de Obra / CLT', 'Energia / Água', 'Escritório', 'Reembolso', 'Medição Recebida', 'Outros']

const isVencido = (d: string, status: string) => {
  if (status === 'Pago' || status === 'Pago sem Nota Fiscal') return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(d + 'T00:00:00');
  return vencimento < hoje;
}

export function parseAnexos(url: string | null | undefined): string[] {
  if (!url) return []
  const trimmed = url.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return arr.filter(Boolean).map(s => String(s).trim())
    } catch {}
  }
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [trimmed]
}

function ObservacaoExpandivel({ text, maxLength = 60, showTitleLabel = true }: { text: string | null | undefined; maxLength?: number; showTitleLabel?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return <span style={{ color: C.inkSoft, fontStyle: 'italic', fontSize: 11 }}>Nenhuma observação</span>

  const isLong = text.length > maxLength

  if (!isLong) {
    return (
      <div 
        title={text} 
        style={{ fontSize: 11, color: C.inkSoft, wordBreak: 'break-word', lineHeight: 1.4 }}
      >
        {showTitleLabel && <span style={{ color: C.amber, fontWeight: 700 }}>Obs: </span>}
        {text}
      </div>
    )
  }

  const displayText = expanded ? text : text.slice(0, maxLength) + '...'

  return (
    <div 
      title={text} 
      style={{ fontSize: 11, color: C.inkSoft, wordBreak: 'break-word', lineHeight: 1.4 }}
    >
      {showTitleLabel && <span style={{ color: C.amber, fontWeight: 700 }}>Obs: </span>}
      <span>{displayText}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
        title={expanded ? "Recolher texto" : "Ver observação completa (passe o mouse para ler tudo)"}
        style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: C.amber,
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          marginLeft: 6,
          verticalAlign: 'middle',
          transition: 'all 0.2s ease'
        }}
      >
        {expanded ? (
          <>
            menos <ChevronUp size={10} />
          </>
        ) : (
          <>
            mais <ChevronDown size={10} />
          </>
        )}
      </button>
    </div>
  )
}

// ─── NAV TABS ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'historico',    label: 'Histórico & Fluxo',    icon: FileText  },
  { id: 'contas',       label: 'Lançar Conta',        icon: Plus      },
] as const

const ALL_TABS = ['historico', 'contas', 'obras', 'empresas', 'fornecedores', 'permissoes'] as const
type Tab = typeof ALL_TABS[number]

// Nomes legíveis para os perfis/cargos
const NOMES_CARGOS: Record<string, string> = {
  admin_geral: 'Administrador Geral',
  admin_empresa: 'Administrador por Empresa',
  operador: 'Operador Financeiro',
  visualizador: 'Visualizador',
  rh: 'RH / Admissões',
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: C.bgPanel,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '20px 24px',
}

const input: React.CSSProperties = {
  background: C.bgWhite,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.ink,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
}

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.inkSoft,
  textTransform: 'uppercase' as const,
  letterSpacing: '.6px',
  marginBottom: 6,
  display: 'block',
}

const btn = (accent = C.amber): React.CSSProperties => ({
  background: accent,
  color: '#0B0C0E',
  border: 'none',
  borderRadius: 6,
  padding: '9px 18px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  letterSpacing: .4,
  textTransform: 'uppercase' as const,
})

const btnGhost: React.CSSProperties = {
  background: 'none',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 700,
  color: C.inkSoft,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

import { useConfirm } from '@/hooks/useConfirm'
import { usePrompt } from '@/hooks/usePrompt'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useRouter, useSearchParams } from 'next/navigation'

function FinanceiroContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get('tab') as Tab | null)
  const { confirm, ConfirmDialog } = useConfirm()
  const { prompt, PromptDialog } = usePrompt()
  const [tab, setTab] = useState<Tab>(tabParam && ALL_TABS.includes(tabParam as any) ? tabParam : 'historico')

  useEffect(() => {
    if (tabParam && ALL_TABS.includes(tabParam as any)) {
      setTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab)
    const current = searchParams.get('tab')
    if (current !== newTab) {
      router.push(`/financeiro?tab=${newTab}`, { scroll: false })
    }
  }, [router, searchParams])

  const [activeFornecedorId, setActiveFornecedorId] = useState<string>('')
  
  // Colaborador atualmente conectado neste navegador/dispositivo
  const [colaboradorAtivo, setColaboradorAtivo] = useState<Colaborador | null>(null)
  // Regras de permissões ativas para o cargo do colaborador atual
  const [permissaoAtiva, setPermissaoAtiva] = useState<ConfigPermissao | null>(null)
  
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loadingAcesso, setLoadingAcesso] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)

  // Carrega colaborador da sessão de login
  const carregarSessaoColaborador = useCallback(async () => {
    setLoadingAcesso(true)

    // Lê a sessão do sistema de login
    const raw = typeof window !== 'undefined' ? localStorage.getItem('colaborador_sessao') : null
    if (!raw) {
      setLoadingAcesso(false)
      return
    }

    let logado: Colaborador | null = null
    try { logado = JSON.parse(raw) } catch { }

    if (logado && logado.id) {
      // Busca dados mais recentes do colaborador no Supabase para garantir permissões atualizadas
      const { data: freshColab } = await supabase.from('colaboradores').select('*').eq('id', logado.id).maybeSingle()
      const activeUser = (freshColab as Colaborador) || logado
      setColaboradorAtivo(activeUser)
      if (typeof window !== 'undefined' && freshColab) {
        localStorage.setItem('colaborador_sessao', JSON.stringify(freshColab))
      }

      // Busca permissões do cargo
      const { data: perm } = await supabase.from('config_permissoes').select('*').eq('cargo', activeUser.cargo).maybeSingle()

      if (activeUser.cargo === 'admin_geral') {
        setPermissaoAtiva({
          cargo: 'admin_geral',
          pode_empresas: true,
          pode_fornecedores: true,
          pode_lancar: true,
          pode_pagar: true,
          pode_aprovar: true,
          limite_valor: 99999999,
          apps: 'rh,ponto,financeiro,suprimentos,obras,rdo,frota,usuarios',
          abas_financeiro: 'dashboard,historico,contas,empresas,fornecedores,obras,permissoes',
          pode_alterar_status: true,
          pode_excluir_lancamento: true,
        })
      } else if (activeUser.override_permissoes) {
        setPermissaoAtiva({
          cargo: activeUser.cargo,
          pode_empresas: activeUser.pode_empresas ?? perm?.pode_empresas ?? false,
          pode_fornecedores: activeUser.pode_fornecedores ?? perm?.pode_fornecedores ?? false,
          pode_lancar: activeUser.pode_lancar ?? perm?.pode_lancar ?? true,
          pode_pagar: activeUser.pode_pagar ?? perm?.pode_pagar ?? false,
          pode_aprovar: activeUser.pode_aprovar ?? perm?.pode_aprovar ?? false,
          limite_valor: activeUser.limite_valor ?? perm?.limite_valor ?? 0,
          apps: activeUser.apps || perm?.apps || 'financeiro',
          abas_financeiro: activeUser.abas_financeiro || perm?.abas_financeiro || null,
          pode_alterar_status: activeUser.pode_alterar_status ?? perm?.pode_alterar_status ?? true,
          pode_excluir_lancamento: activeUser.pode_excluir_lancamento ?? perm?.pode_excluir_lancamento ?? false,
        })
      } else {
        setPermissaoAtiva({
          cargo: activeUser.cargo,
          pode_empresas: perm?.pode_empresas ?? activeUser.pode_empresas ?? false,
          pode_fornecedores: perm?.pode_fornecedores ?? activeUser.pode_fornecedores ?? false,
          pode_lancar: perm?.pode_lancar ?? activeUser.pode_lancar ?? true,
          pode_pagar: perm?.pode_pagar ?? activeUser.pode_pagar ?? false,
          pode_aprovar: perm?.pode_aprovar ?? activeUser.pode_aprovar ?? false,
          limite_valor: perm?.limite_valor ?? activeUser.limite_valor ?? 0,
          apps: perm?.apps || activeUser.apps || 'financeiro',
          abas_financeiro: perm?.abas_financeiro || activeUser.abas_financeiro || null,
          pode_alterar_status: perm?.pode_alterar_status ?? activeUser.pode_alterar_status ?? true,
          pode_excluir_lancamento: perm?.pode_excluir_lancamento ?? activeUser.pode_excluir_lancamento ?? false,
        })
      }
    }

    // Carrega lista de colaboradores para a aba de permissões
    const { data: cols } = await supabase
      .from('colaboradores')
      .select('id, nome, email, cargo, empresa_id, empresas_ids, override_permissoes, apps, pode_empresas, pode_fornecedores, pode_lancar, pode_pagar, pode_aprovar, limite_valor, abas_financeiro, pode_alterar_status, pode_excluir_lancamento, obras_ids')
      .order('nome')
    setColaboradores(cols ?? [])

    setLoadingAcesso(false)
  }, [])

  useEffect(() => {
    carregarSessaoColaborador()
  }, [carregarSessaoColaborador])

  // Retorna a lista de abas visíveis de acordo com as permissões reais do cargo
  function getAbasPermitidas() {
    const isAdminGeral = colaboradorAtivo?.cargo === 'admin_geral'

    // Se o cargo/usuário tem abas_financeiro configurado, usa ele
    const abasConfig = (colaboradorAtivo?.override_permissoes
      ? colaboradorAtivo.abas_financeiro
      : permissaoAtiva?.abas_financeiro)

    if (abasConfig !== null && abasConfig !== undefined) {
      const abas = abasConfig.split(',').map(a => a.trim()).filter(Boolean)
      if (isAdminGeral && !abas.includes('permissoes')) abas.push('permissoes')
      if (abas.includes('dashboard') && !abas.includes('obras')) abas.push('obras')
      return abas
    }

    // Fallback legado baseado nas permissões individuais
    const apps = (colaboradorAtivo?.override_permissoes ? colaboradorAtivo.apps : permissaoAtiva?.apps) || ''
    const tem = (app: string) => apps.split(',').map(item => item.trim()).includes(app)
    const abas: string[] = []
    abas.push('historico')
    if (tem('financeiro')) abas.push('contas')
    if (permissaoAtiva?.pode_empresas) abas.push('empresas')
    if (permissaoAtiva?.pode_fornecedores) abas.push('fornecedores')
    if (tem('obras') || isAdminGeral) abas.push('obras')
    if (isAdminGeral) abas.push('permissoes')
    return abas
  }

  // Garante que o tab ativo seja sempre válido
  useEffect(() => {
    if (colaboradorAtivo) {
      const permitidas = getAbasPermitidas()
      if (!permitidas.includes(tab)) {
        handleTabChange((permitidas[0] as Tab) || 'historico')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorAtivo?.cargo, colaboradorAtivo?.abas_financeiro, permissaoAtiva?.abas_financeiro])

  if (loadingAcesso) {
    return <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando permissões...</p>
  }

  const cargoNome = colaboradorAtivo ? NOMES_CARGOS[colaboradorAtivo.cargo] : '—'
  const abasVisiveis = getAbasPermitidas()

  return (
    <div style={{ minHeight: '100%' }}>
      {/* ── TOP HEADER COM ASSINATURA EXECUTIVA JWA ──────────────── */}
      <PageTitle
        modulo="Financeiro"
        titulo="Gestão Financeira & Medições"
        subtitle="Fluxo de caixa, conciliação de contas a pagar/receber, medições de obras e governança orçamentária."
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTabChange('contas')}
              style={{
                ...btn(C.amber),
                fontSize: 11.5,
                fontWeight: 900,
                padding: '7px 14px',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
              }}
            >
              <Plus size={14} strokeWidth={2.5} /> Lançar Nova Conta
            </motion.button>
          </div>
        }
      />

      {/* ── BARRA DE ABAS SEGMENTADA E DEFINIDA ──────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, overflowX: 'auto' }}>
        {TABS.filter(t => abasVisiveis.includes(t.id)).map(t => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              style={{
                background: active ? C.bgPanel : 'transparent',
                border: `1px solid ${active ? C.border : 'transparent'}`,
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                color: active ? C.ink : C.inkSoft,
                padding: '8px 16px',
                fontSize: 11.5,
                fontWeight: active ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                borderRadius: 6,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              className="hover:text-amber-500"
            >
              <Icon size={13} color={active ? C.amber : undefined} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'empresas' && (
        <EmpresasTab 
          colaboradorAtivo={colaboradorAtivo!} 
          permissaoAtiva={permissaoAtiva!} 
          confirm={confirm}
        />
      )}
      {tab === 'fornecedores' && (
        <FornecedoresTab 
          colaboradorAtivo={colaboradorAtivo!} 
          permissaoAtiva={permissaoAtiva!} 
          confirm={confirm}
          goToHistoricoByFornecedor={(id) => {
            setActiveFornecedorId(id)
            setTab('historico')
          }}
        />
      )}
      {/* Conteúdo das Tabs */}
      {tab === 'contas' && abasVisiveis.includes('contas') && (
        <ContasTab 
          colaboradorAtivo={colaboradorAtivo!} 
          permissaoAtiva={permissaoAtiva!} 
          confirm={confirm}
          colaboradores={colaboradores}
        />
      )}
      {tab === 'historico' && abasVisiveis.includes('historico') && (
        <HistoricoTab 
          colaboradorAtivo={colaboradorAtivo!} 
          permissaoAtiva={permissaoAtiva!} 
          confirm={confirm}
          prompt={prompt}
          initialFornecedorId={activeFornecedorId}
          colaboradores={colaboradores}
        />
      )}
      {tab === 'obras' && abasVisiveis.includes('obras') && <ObrasFinanceiroTab colaboradorAtivo={colaboradorAtivo!} permissaoAtiva={permissaoAtiva!} confirm={confirm} colaboradores={colaboradores} />}
      {tab === 'permissoes' && abasVisiveis.includes('permissoes') && (
        <PermissoesTab 

          colaboradorAtivo={colaboradorAtivo!} 
          colaboradores={colaboradores} 
          onRefresh={carregarSessaoColaborador} 
          confirm={confirm}
        />
      )}
      {ConfirmDialog}
      {PromptDialog}

      {showImportModal && (
        <ImportarExcelModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          colaboradorAtivo={colaboradorAtivo!}
          onSuccess={() => {
            setTab('historico')
          }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: DASHBOARD
// ════════════════════════════════════════════════════════
function ObrasFinanceiroTab({ colaboradorAtivo, permissaoAtiva, confirm, colaboradores = [] }: TabProps) {
  const [obras, setObras] = useState<Obra[]>([])
  const [obraId, setObraId] = useState<string>('todas')
  const [fotos, setFotos] = useState<any[]>([])
  const [form, setForm] = useState({ nome: '', cliente: '', endereco: '', valor: '' })
  const [legenda, setLegenda] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [metricasForm, setMetricasForm] = useState({ bm_atual: '', medido_acumulado: '', observacao: '' })
  const [editandoMedicaoId, setEditandoMedicaoId] = useState<string | null>(null)
  const [editMedicaoForm, setEditMedicaoForm] = useState({ bm: '', medido_acumulado: '', observacao: '' })
  const [editandoFotoId, setEditandoFotoId] = useState<string | null>(null)
  const [editFotoLegenda, setEditFotoLegenda] = useState('')
  const [editandoObra, setEditandoObra] = useState<Obra | null>(null)
  const [editObraForm, setEditObraForm] = useState({ nome: '', cliente: '', endereco: '', valor: '', status: 'Em dia', proximo_urb_data: '', proximo_urb_valor: '', proximo_urb_desc: '' })
  const [fotoExpandida, setFotoExpandida] = useState<any | null>(null)
  const [selecionadasFotos, setSelecionadasFotos] = useState<string[]>([])
  const [processandoLote, setProcessandoLote] = useState(false)
  
  // Acessos
  const [acessosObra, setAcessosObra] = useState<Obra | null>(null)
  const [searchColab, setSearchColab] = useState('')
  const [filtroAcesso, setFiltroAcesso] = useState<'todos' | 'com_acesso' | 'sem_acesso'>('todos')
  const [updatingColabId, setUpdatingColabId] = useState<string | null>(null)

  const podeGerenciar = Boolean(permissaoAtiva?.pode_lancar || permissaoAtiva?.pode_aprovar)

  const toggleAcessoColaboradorObra = async (colab: Colaborador, obraId: string) => {
    if (colab.cargo === 'admin_geral') {
      return toast('Administradores gerais possuem acesso automático a todas as obras.', 'info')
    }
    setUpdatingColabId(colab.id)
    try {
      const currentIds: string[] = colab.obras_ids || []
      const hasAccess = currentIds.includes(obraId)
      let nextIds: string[] = []
      if (hasAccess) {
        nextIds = currentIds.filter(id => id !== obraId)
      } else {
        nextIds = Array.from(new Set([...currentIds, obraId]))
      }
      const { data, error } = await supabase
        .from('colaboradores')
        .update({ obras_ids: nextIds })
        .eq('id', colab.id)
        .select('id, obras_ids')
      console.log('Update obras_ids result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Acesso não atualizado no banco (possível bloqueio de permissão).')
      if (data[0].obras_ids === undefined) throw new Error('A coluna obras_ids não está ativa no banco de dados. Atualize o cache do Supabase.')
      colab.obras_ids = nextIds // Update local object
      toast(hasAccess ? `Acesso revogado para ${colab.nome}` : `Acesso concedido para ${colab.nome}`, 'success')
      // Trigger a re-render
      setAcessosObra(prev => prev ? { ...prev } : null)
    } catch (err: any) {
      const msg = err?.message || 'Erro ao atualizar acesso'
      toast(msg, 'error')
    } finally {
      setUpdatingColabId(null)
    }
  }

  const toggleFotoSelecionada = (id: string) => {
    setSelecionadasFotos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selecionarTodasFotos = (lista: any[]) => {
    if (selecionadasFotos.length === lista.length) {
      setSelecionadasFotos([])
    } else {
      setSelecionadasFotos(lista.map(f => f.id))
    }
  }

  async function excluirFotosEmLote() {
    if (selecionadasFotos.length === 0) return
    if (!(await confirm('Excluir Fotos Selecionadas', `Deseja realmente excluir as ${selecionadasFotos.length} fotos selecionadas?`, { confirmLabel: `Excluir (${selecionadasFotos.length})`, confirmColor: C.red }))) return
    
    setProcessandoLote(true)
    const { error } = await supabase.from('fotos').delete().in('id', selecionadasFotos)
    setProcessandoLote(false)
    if (error) return toast(error.message, 'error')
    
    setSelecionadasFotos([])
    await load()
    toast(`${selecionadasFotos.length} fotos excluídas com sucesso.`, 'success')
  }

  async function baixarFotosEmLote(lista: any[]) {
    const fotosParaBaixar = lista.filter(f => selecionadasFotos.includes(f.id))
    if (fotosParaBaixar.length === 0) return
    toast(`Iniciando download de ${fotosParaBaixar.length} foto(s)...`, 'info')
    
    for (let i = 0; i < fotosParaBaixar.length; i++) {
      const f = fotosParaBaixar[i]
      try {
        const response = await fetch(f.resolvedUrl || f.imagem_url)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const ext = f.imagem_url.includes('.png') ? 'png' : 'jpg'
        a.download = `${f.legenda || 'foto_obra'}_${i + 1}.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch {
        // Fallback para abrir link direto
        window.open(f.resolvedUrl || f.imagem_url, '_blank')
      }
    }
  }
  
  const load = useCallback(async (isBackground = false) => {
    const [{ data: o }, { data: f }] = await Promise.all([
      supabase.from('obras').select('*').order('nome'),
      supabase.from('fotos').select('*').not('obra_id', 'is', null).order('created_at', { ascending: false }).limit(60),
    ])
    let obrasList = (o as Obra[]) || []
    const obraGeral = { id: 'geral', nome: 'Geral / Administrativo', cliente: '', endereco: '', valor_contrato: 0, progresso: 0, status: 'Em dia' } as Obra
    obrasList = [obraGeral, ...obrasList]
    
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const allowedIds = colaboradorAtivo.obras_ids || []
      obrasList = obrasList.filter(obra => allowedIds.includes(obra.id))
    }
    setObras(obrasList); setFotos(f || []);
  }, [colaboradorAtivo])
  
  useRealtimeSync(load, 'financeiro-obras')
  useEffect(() => { void load() }, [load])
  
  async function criarObra(e: React.FormEvent) {
    e.preventDefault(); if (!form.nome.trim()) return toast('Informe o nome da obra.', 'error')
    const { data, error } = await supabase.from('obras').insert({ nome: form.nome.trim(), cliente: form.cliente || null, endereco: form.endereco || null, valor_contrato: parseCurrency(form.valor) || 0, progresso: 0, status: 'Em dia' }).select().single()
    if (error) return toast(error.message, 'error'); setForm({ nome: '', cliente: '', endereco: '', valor: '' }); setShowForm(false); setObraId(data.id); await load(); toast('Obra criada.', 'success')
  }

  function abrirEdicaoObra(o: Obra) {
    setEditandoObra(o)
    setEditObraForm({
      nome: o.nome || '',
      cliente: o.cliente || '',
      endereco: o.endereco || '',
      valor: o.valor_contrato ? String(o.valor_contrato) : '',
      status: o.status || 'Em dia',
      proximo_urb_data: o.proximo_urb_data || '',
      proximo_urb_valor: o.proximo_urb_valor ? String(o.proximo_urb_valor) : '',
      proximo_urb_desc: o.proximo_urb_desc || ''
    })
  }

  async function salvarEdicaoObra(e: React.FormEvent) {
    e.preventDefault()
    if (!editandoObra) return
    if (!editObraForm.nome.trim()) return toast('Informe o nome da obra.', 'error')
    const novoValorContrato = parseCurrency(editObraForm.valor)
    const proximoValor = parseCurrency(editObraForm.proximo_urb_valor)
    const medidoAcum = Number(editandoObra.medido_acumulado || 0)
    const novoProgresso = novoValorContrato > 0 ? Math.min(100, Math.round((medidoAcum / novoValorContrato) * 100)) : 0
    const { error } = await supabase.from('obras').update({
      nome: editObraForm.nome.trim(),
      cliente: editObraForm.cliente.trim() || null,
      endereco: editObraForm.endereco.trim() || null,
      valor_contrato: novoValorContrato,
      status: editObraForm.status || 'Em dia',
      progresso: novoProgresso,
      proximo_urb_data: editObraForm.proximo_urb_data || null,
      proximo_urb_valor: proximoValor > 0 ? proximoValor : null,
      proximo_urb_desc: editObraForm.proximo_urb_desc.trim() || null
    }).eq('id', editandoObra.id)
    if (error) return toast(error.message, 'error')
    setEditandoObra(null)
    await load()
    toast('Obra atualizada com sucesso!', 'success')
  }
  
  async function anexarFoto(file: File) {
    if (!obraId || obraId === 'todas') return toast('Selecione uma obra primeiro.', 'error')
    const path = `${obraId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const upload = await supabase.storage.from('comprovantes').upload(path, file)
    if (upload.error) return toast(upload.error.message, 'error')
    const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(path)
    const { error } = await supabase.from('fotos').insert({ obra_id: obraId, imagem_url: pub.publicUrl, legenda: legenda || file.name, data_iso: new Date().toISOString().slice(0, 10) })
    if (error) return toast(error.message, 'error'); setLegenda(''); await load(); toast('Foto anexada.', 'success')
  }

  async function excluirFoto(fotoId: string) {
    if (!(await confirm('Excluir Foto', 'Deseja realmente remover esta foto da galeria?', { confirmLabel: 'Excluir', confirmColor: C.red }))) return
    const { error } = await supabase.from('fotos').delete().eq('id', fotoId)
    if (error) return toast(error.message, 'error')
    await load(); toast('Foto excluída com sucesso.', 'success')
  }

  async function salvarEdicaoFoto(fotoId: string) {
    if (!editFotoLegenda.trim()) return toast('Informe a legenda.', 'error')
    const { error } = await supabase.from('fotos').update({ legenda: editFotoLegenda.trim() }).eq('id', fotoId)
    if (error) return toast(error.message, 'error')
    setEditandoFotoId(null)
    await load(); toast('Legenda da foto atualizada.', 'success')
  }

  async function salvarMetricasObra(id: string) {
    if (!metricasForm.bm_atual.trim()) return toast('Informe o BM (ex: BM-004)', 'error')
    if (!metricasForm.medido_acumulado) return toast('Informe o Valor Medido', 'error')
    const medidoNovoPeriodo = parseCurrency(metricasForm.medido_acumulado)
    const obra = obras.find(o => o.id === id)
    const acumuladoAnterior = Number(obra?.medido_acumulado || 0)
    const medidoTotalAcumulado = acumuladoAnterior + medidoNovoPeriodo
    const valorContrato = Number(obra?.valor_contrato || 0)
    const saldo = Math.max(0, valorContrato - medidoTotalAcumulado)
    const historicoAtual: ItemMedicao[] = Array.isArray(obra?.historico_medicoes) ? obra!.historico_medicoes as ItemMedicao[] : []
    const novoItem: ItemMedicao = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      autor: colaboradorAtivo.nome || 'Usuário',
      bm: metricasForm.bm_atual.trim(),
      medido_acumulado: medidoTotalAcumulado,
      saldo_a_medir: saldo,
      observacao: metricasForm.observacao.trim() || undefined
    }
    const novoProgresso = valorContrato > 0 ? Math.min(100, Math.round((medidoTotalAcumulado / valorContrato) * 100)) : 0
    const { error } = await supabase.from('obras').update({
      bm_atual: novoItem.bm,
      medido_acumulado: medidoTotalAcumulado,
      progresso: novoProgresso,
      historico_medicoes: [...historicoAtual, novoItem]
    }).eq('id', id)
    if (error) return toast(error.message, 'error')
    setMetricasForm({ bm_atual: '', medido_acumulado: '', observacao: '' })
    await load()
    toast('Medição registrada no histórico!', 'success')
  }
  
  const isObraConcluida = (status?: string) => ['concluída', 'concluida', 'concluído', 'concluido', 'finalizada'].includes(String(status || '').toLowerCase())

  async function alternarStatusObra(o: Obra) {
    const jaConcluida = isObraConcluida(o.status)
    const novoStatus = jaConcluida ? 'Em dia' : 'Concluído'
    const acao = jaConcluida ? 'reabrir a obra' : 'marcar a obra como Concluída'
    const sub = jaConcluida 
      ? `Ao reabrir a obra "${o.nome}", ela voltará a ser calculada no portfólio de obras ativas.` 
      : `Ao concluir a obra "${o.nome}", ela sairá dos cálculos do portfólio de obras ativas.`
    if (!(await confirm(jaConcluida ? 'Reabrir Obra' : 'Concluir Obra', sub, { confirmLabel: jaConcluida ? 'Reabrir Obra' : 'Concluir Obra', confirmColor: jaConcluida ? C.amber : C.green }))) return
    const { error } = await supabase.from('obras').update({ status: novoStatus, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) return toast(error.message, 'error')
    await load(); toast(jaConcluida ? 'Obra reaberta com sucesso!' : 'Obra marcada como Concluída!', 'success')
  }

  async function excluirObra(id: string, nome: string) {
    if (!(await confirm('Atenção', `Deseja realmente excluir a obra "${nome}"? Isso removerá os dados vinculados.`, { confirmLabel: 'Excluir', confirmColor: C.red }))) return
    const { error } = await supabase.from('obras').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    if (obraId === id) setObraId('todas'); 
    await load(); toast('Obra excluída.', 'success')
  }

  async function excluirMedicao(obraIdAlvo: string, medicaoId: string) {
    if (!(await confirm('Excluir Medição', 'Deseja excluir este registro de medição do histórico?', { confirmLabel: 'Excluir', confirmColor: C.red }))) return
    const obra = obras.find(o => o.id === obraIdAlvo)
    const historico: ItemMedicao[] = Array.isArray(obra?.historico_medicoes) ? obra!.historico_medicoes as ItemMedicao[] : []
    const novoHistorico = historico.filter(h => h.id !== medicaoId)
    // recalc bm_atual e medido_acumulado pelo último item restante
    const ultimo = novoHistorico[novoHistorico.length - 1]
    const novoMedido = ultimo?.medido_acumulado ?? 0
    const valorContrato = Number(obra?.valor_contrato || 0)
    const novoProgresso = valorContrato > 0 ? Math.min(100, Math.round((novoMedido / valorContrato) * 100)) : 0
    const { error } = await supabase.from('obras').update({
      historico_medicoes: novoHistorico,
      bm_atual: ultimo?.bm ?? null,
      medido_acumulado: novoMedido,
      progresso: novoProgresso
    }).eq('id', obraIdAlvo)
    if (error) return toast(error.message, 'error')
    await load(); toast('Medição excluída.', 'success')
  }

  async function salvarEdicaoMedicao(obraIdAlvo: string, medicaoId: string) {
    if (!editMedicaoForm.bm.trim()) return toast('Informe o BM.', 'error')
    if (!editMedicaoForm.medido_acumulado) return toast('Informe o Medido Acumulado.', 'error')
    const obra = obras.find(o => o.id === obraIdAlvo)
    const historico: ItemMedicao[] = Array.isArray(obra?.historico_medicoes) ? obra!.historico_medicoes as ItemMedicao[] : []
    const medido = parseCurrency(editMedicaoForm.medido_acumulado)
    const saldo = Math.max(0, Number(obra?.valor_contrato || 0) - medido)
    const novoHistorico = historico.map(h => h.id !== medicaoId ? h : {
      ...h,
      bm: editMedicaoForm.bm.trim(),
      medido_acumulado: medido,
      saldo_a_medir: saldo,
      observacao: editMedicaoForm.observacao.trim() || undefined
    })
    // recalc bm_atual e medido_acumulado pelo último item do histórico
    const ultimo = novoHistorico[novoHistorico.length - 1]
    const novoMedido = ultimo?.medido_acumulado ?? 0
    const valorContrato = Number(obra?.valor_contrato || 0)
    const novoProgresso = valorContrato > 0 ? Math.min(100, Math.round((novoMedido / valorContrato) * 100)) : 0
    const { error } = await supabase.from('obras').update({
      historico_medicoes: novoHistorico,
      bm_atual: ultimo?.bm ?? null,
      medido_acumulado: novoMedido,
      progresso: novoProgresso
    }).eq('id', obraIdAlvo)
    if (error) return toast(error.message, 'error')
    setEditandoMedicaoId(null)
    await load(); toast('Medição atualizada.', 'success')
  }
  
  const obraSelecionada = obras.find(o => o.id === obraId)
  const fotosObra = useMemo(() => {
    const raw = fotos.filter(f => f.obra_id === obraId)
    const seen = new Set<string>()
    return raw.filter(f => {
      if (!f.imagem_url || seen.has(f.imagem_url)) return false
      seen.add(f.imagem_url)
      return true
    })
  }, [fotos, obraId])
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Visão Geral */}
      {obraId === 'todas' && (
        <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── CABEÇALHO DO MÓDULO DE OBRAS ────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} color={C.amber} />
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Portfólio de Obras & Medições
                </h2>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: C.inkSoft }}>
                Governança executiva de contratos, boletins de medição (BMs), avanço físico e previsões financeiras.
              </p>
            </div>

            {podeGerenciar && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowForm(!showForm)}
                style={{
                  ...btn(C.amber),
                  fontSize: 11.5,
                  fontWeight: 900,
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Plus size={14} strokeWidth={2.5} />
                {showForm ? 'Fechar Formulário' : 'Nova Obra'}
              </motion.button>
            )}
          </div>

          {/* ─── FORMULÁRIO DE NOVA OBRA ─────────────────────────────── */}
          {showForm && podeGerenciar && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={criarObra}
              style={{
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '18px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                alignItems: 'end'
              }}
            >
              <div>
                <label style={label}>Nome da Obra *</label>
                <input
                  style={input}
                  placeholder="Ex: Reforma Hospital Regional"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={label}>Cliente / Órgão</label>
                <input
                  style={input}
                  placeholder="Ex: Governo do Estado / CEHAB"
                  value={form.cliente}
                  onChange={e => setForm({ ...form, cliente: e.target.value })}
                />
              </div>
              <div>
                <label style={label}>Endereço / Local</label>
                <input
                  style={input}
                  placeholder="Ex: Av. Principal, 100 - Recife/PE"
                  value={form.endereco}
                  onChange={e => setForm({ ...form, endereco: e.target.value })}
                />
              </div>
              <div>
                <label style={label}>Valor do Contrato (R$)</label>
                <input
                  style={input}
                  placeholder="0,00"
                  value={form.valor}
                  onChange={e => setForm({ ...form, valor: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ ...btn(C.amber), flex: 1, padding: '9px 16px', fontSize: 11.5 }}>
                  Cadastrar Obra
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ ...btnGhost, padding: '9px 14px', fontSize: 11.5 }}>
                  Cancelar
                </button>
              </div>
            </motion.form>
          )}

          {/* ─── DASHBOARD GLOBAL DE PORTFÓLIO ──────────────────────────── */}
          {obras.length > 0 && (() => {
            const obrasAtivasList = obras.filter(o => !isObraConcluida(o.status))
            const totalContrato  = obrasAtivasList.reduce((s, o) => s + Number(o.valor_contrato || 0), 0)
            const totalMedido    = obrasAtivasList.reduce((s, o) => s + Number(o.medido_acumulado || 0), 0)
            const totalPrevistoBM = obrasAtivasList.reduce((s, o) => s + Number(o.proximo_urb_valor || 0), 0)
            const totalMedidoPrevisto = totalMedido + totalPrevistoBM
            const saldoMedir     = Math.max(0, totalContrato - totalMedido)
            const progressoMedio = obrasAtivasList.length ? obrasAtivasList.reduce((s, o) => s + Number(o.progresso || 0), 0) / obrasAtivasList.length : 0
            const obrasAtivasCount = obrasAtivasList.length
            const obrasConcluidasCount = obras.length - obrasAtivasCount

            const kpis = [
              { label: 'Total de Obras',       value: String(obras.length),         sub: `${obrasAtivasCount} ativas · ${obrasConcluidasCount} concluídas`, color: C.amber,   icon: Building2 },
              { label: 'Portfólio Contratos',  value: fmt(totalContrato),           sub: 'soma das obras ativas',                                                  color: C.amber, icon: FileText },
              { label: 'Medido Acumulado',     value: fmt(totalMedido),             sub: `${totalContrato > 0 ? ((totalMedido / totalContrato) * 100).toFixed(1) : 0}% das ativas`, color: '#8B5CF6', icon: Ruler },
              { label: 'Medido Previsto (BMs)', value: fmt(totalMedidoPrevisto),     sub: `+${fmt(totalPrevistoBM)} nos BMs previstos`,                            color: C.amber, icon: TrendingUp },
              { label: 'Saldo a Medir',        value: fmt(saldoMedir),              sub: 'obras ativas restantes',                                                 color: C.green, icon: DollarSign },
              { label: 'Progresso Médio',      value: `${progressoMedio.toFixed(1)}%`, sub: 'avanço físico médio',                                                color: C.amber, icon: Activity },
            ]

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* KPI cards com alto contraste e acabamento executivo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                  {kpis.map(k => {
                    const IconComponent = k.icon
                    return (
                      <div
                        key={k.label}
                        style={{
                          background: C.bgPanel,
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          padding: '16px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minWidth: 0,
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <IconComponent size={14} color={k.color} />
                          </div>
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</span>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 900, color: C.ink, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all' }} title={k.value}>{k.value}</span>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Painel de Avanço e Medições por Obra */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 5, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BarChart3 size={14} color={C.amber} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>Portfólio de Obras — Avanço & Medições</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 600 }}>{obras.length} obras cadastradas · média física {progressoMedio.toFixed(1)}%</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...obras].sort((a, b) => Number(b.medido_acumulado || 0) - Number(a.medido_acumulado || 0)).map(o => {
                      const valContrato = Number(o.valor_contrato || 0)
                      const valMedido   = Number(o.medido_acumulado || 0)
                      const pctMedido   = valContrato > 0 ? Math.min(100, (valMedido / valContrato) * 100) : 0
                      const pctFisico   = Math.min(100, Number(o.progresso || 0))
                      const statusColor = o.status === 'Atrasado' ? '#EF4444' : o.status === 'Concluído' ? C.green : C.amber
                      return (
                        <div
                          key={o.id}
                          style={{
                            background: C.bgCard,
                            border: `1px solid ${C.border}`,
                            borderRadius: 8,
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={() => setObraId(o.id)}
                                style={{
                                  all: 'unset',
                                  cursor: 'pointer',
                                  fontSize: 12.5,
                                  fontWeight: 900,
                                  color: C.ink,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.3,
                                  transition: 'color 0.15s'
                                }}
                                className="hover:text-amber-500"
                              >
                                {o.nome}
                              </button>
                              <span style={{ fontSize: 8.5, fontWeight: 900, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' }}>
                                {o.status || 'Em dia'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 800 }}>{fmt(valMedido)} medido</span>
                              {o.proximo_urb_valor ? (
                                <span style={{ fontSize: 10.5, color: C.amber, fontWeight: 800 }}>+{fmt(Number(o.proximo_urb_valor))} (previsto)</span>
                              ) : null}
                              <span style={{ fontSize: 10.5, color: C.inkSoft }}>/ {fmt(valContrato)}</span>
                              <span style={{ fontSize: 11.5, fontWeight: 900, color: pctMedido >= 70 ? C.green : pctMedido >= 30 ? C.amber : C.inkSoft, minWidth: 46, textAlign: 'right' }}>
                                {pctMedido.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Barra de Progresso Duplo */}
                          <div style={{ height: 8, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pctMedido}%`, background: 'rgba(139, 92, 246, 0.45)', borderRadius: 4 }} />
                            <div style={{ position: 'absolute', top: '25%', left: 0, height: '50%', width: `${pctFisico}%`, background: pctFisico >= 70 ? C.green : C.amber, borderRadius: 4 }} />
                          </div>

                          {/* Notificação de Próximo BM */}
                          {o.proximo_urb_data && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245, 158, 11, 0.08)', padding: '6px 12px', borderRadius: 5, borderLeft: `3px solid ${C.amber}`, marginTop: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={12} color={C.amber} />
                                <span style={{ fontSize: 10, color: C.amber, fontWeight: 800, textTransform: 'uppercase' }}>
                                  Próximo BM: {new Date(o.proximo_urb_data + 'T12:00:00').toLocaleDateString('pt-BR')} {o.proximo_urb_desc ? `· ${o.proximo_urb_desc}` : ''}
                                </span>
                              </div>
                              {o.proximo_urb_valor ? <span style={{ fontSize: 10.5, fontWeight: 900, color: C.ink }}>{fmt(Number(o.proximo_urb_valor))}</span> : null}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.inkSoft }}>
                      <div style={{ width: 12, height: 4, background: 'rgba(139, 92, 246, 0.6)', border: `1px solid #8B5CF6`, borderRadius: 2 }} />
                      Medição financeira acumulada
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.inkSoft }}>
                      <div style={{ width: 12, height: 4, background: C.amber, borderRadius: 2 }} />
                      Avanço físico informado
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Grid de Obras */}
          {obras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.inkSoft, fontSize: 12 }}>Nenhuma obra cadastrada no sistema.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {obras.map(o => (
                <div key={o.id} style={{ background: C.bgPanel, borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Card Header */}
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <Building2 size={15} color={C.amber} />
                        </div>
                        <div>
                          <h3 style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.3 }}>{o.nome}</h3>
                          <p style={{ margin: 0, fontSize: 10.5, color: C.inkSoft }}>{o.cliente || 'Sem cliente vinculado'}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: o.status === 'Em dia' ? `${C.green}18` : `${C.amber}18`, color: o.status === 'Em dia' ? C.green : C.amber, border: `1px solid ${o.status === 'Em dia' ? C.green : C.amber}44`, textTransform: 'uppercase' }}>
                        {o.status || 'Em dia'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Card Body */}
                  <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {o.endereco && (
                      <div style={{ fontSize: 10.5, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={12} color={C.amber} />
                        <span>{o.endereco}</span>
                      </div>
                    )}
                    {(() => {
                      const valContrato = Number(o.valor_contrato || 0)
                      const valMedido = Number(o.medido_acumulado || 0)
                      const pctRaw = valContrato > 0 ? (valMedido / valContrato) * 100 : (o.progresso || 0)
                      const pctFormatado = pctRaw === 0 ? '0%' : pctRaw < 0.01 ? '<0,01%' : (pctRaw % 1 === 0 ? pctRaw.toFixed(0) + '%' : pctRaw.toFixed(2).replace('.', ',') + '%')
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                            <span style={{ color: C.inkSoft, fontWeight: 700 }}>Progresso Físico</span>
                            <strong style={{ color: C.amber, fontWeight: 900 }}>{pctFormatado}</strong>
                          </div>
                          <div style={{ width: '100%', height: 6, background: C.bgCard, borderRadius: 3, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, pctRaw))}%`, height: '100%', background: C.amber, borderRadius: 3 }} />
                          </div>
                        </>
                      )
                    })()}
                    
                    <div style={{ display: 'flex', gap: 16, marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Contrato</span>
                        <strong style={{ fontSize: 13, color: C.ink, fontWeight: 800 }}>{fmt(Number(o.valor_contrato || 0))}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Medido</span>
                        <strong style={{ fontSize: 13, color: '#A78BFA', fontWeight: 800 }}>{fmt(Number(o.medido_acumulado || 0))}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Fotos</span>
                        <strong style={{ fontSize: 13, color: C.ink, fontWeight: 800 }}>{new Set(fotos.filter(f => f.obra_id === o.id).map(f => f.imagem_url).filter(Boolean)).size}</strong>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Footer */}
                  <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => setObraId(o.id)} style={{ ...btnGhost, color: C.amber, borderColor: `${C.amber}44`, padding: '6px 12px', fontSize: 10.5, fontWeight: 800 }}>
                      Ver Detalhes <ArrowUpRight size={13} />
                    </button>
                    {podeGerenciar && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => abrirEdicaoObra(o)} style={{ all: 'unset', cursor: 'pointer', padding: 6, color: C.inkSoft }} title="Editar dados da obra">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => excluirObra(o.id, o.nome)} style={{ all: 'unset', cursor: 'pointer', padding: 6, color: '#EF4444' }} title="Excluir obra">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detalhes da Obra Selecionada */}
      {obraId !== 'todas' && obraSelecionada && (
        <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ─── BARRA DE NAVEGAÇÃO & IDENTIDADE DA OBRA ────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <button
                onClick={() => { setObraId('todas'); setMetricasForm({ bm_atual: '', medido_acumulado: '', observacao: '' }) }}
                style={{
                  ...btnGhost,
                  color: C.inkSoft,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                className="hover:text-amber-500"
              >
                <ArrowLeft size={13} /> Voltar ao Portfólio
              </button>

              {podeGerenciar && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {obraSelecionada.id !== 'geral' && (
                    <>
                      <button
                        onClick={() => alternarStatusObra(obraSelecionada)}
                        style={{
                          ...btnGhost,
                          color: isObraConcluida(obraSelecionada.status) ? C.amber : C.green,
                          borderColor: isObraConcluida(obraSelecionada.status) ? `${C.amber}44` : `${C.green}44`,
                          background: isObraConcluida(obraSelecionada.status) ? `${C.amber}11` : `${C.green}11`,
                          padding: '6px 14px',
                          fontSize: 10.5,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <CheckCircle2 size={13} />
                        {isObraConcluida(obraSelecionada.status) ? 'Reabrir Obra' : 'Concluir Obra'}
                      </button>
                      <button
                        onClick={() => abrirEdicaoObra(obraSelecionada)}
                        style={{ ...btnGhost, color: C.ink, padding: '6px 14px', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Edit3 size={13} color={C.amber} /> Editar Obra
                      </button>
                      <button
                        onClick={() => excluirObra(obraSelecionada.id, obraSelecionada.nome)}
                        style={{ ...btnGhost, color: '#EF4444', borderColor: '#EF444433', padding: '6px 14px', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Trash2 size={13} /> Excluir
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setAcessosObra(obraSelecionada)}
                    style={{ ...btn(C.amber), padding: '6px 14px', fontSize: 10.5, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Shield size={13} /> Permissões & Equipe
                  </button>
                </div>
              )}
            </div>

            {/* Identidade da Obra */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={20} color={C.amber} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {obraSelecionada.nome}
                    </h1>
                    <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 4, background: isObraConcluida(obraSelecionada.status) ? `${C.green}18` : obraSelecionada.status === 'Atrasado' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: isObraConcluida(obraSelecionada.status) ? C.green : obraSelecionada.status === 'Atrasado' ? '#EF4444' : C.amber, border: `1px solid ${isObraConcluida(obraSelecionada.status) ? `${C.green}44` : obraSelecionada.status === 'Atrasado' ? '#EF444444' : `${C.amber}44`}`, textTransform: 'uppercase' }}>
                      {obraSelecionada.status || 'Em dia'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: C.inkSoft }}>
                    {obraSelecionada.cliente && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Briefcase size={12} color={C.amber} /> {obraSelecionada.cliente}
                      </span>
                    )}
                    {obraSelecionada.endereco && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={12} color={C.amber} /> {obraSelecionada.endereco}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ─── 4 CARDS DE KPIS EXECUTIVOS COM ALTO CONTRASTE ────── */}
            {(() => {
              const valContrato = Number(obraSelecionada.valor_contrato || 0)
              const valMedido   = Number(obraSelecionada.medido_acumulado || 0)
              const saldoMedir  = Math.max(0, valContrato - valMedido)
              const pctMedido   = valContrato > 0 ? (valMedido / valContrato) * 100 : (obraSelecionada.progresso || 0)
              const pctFormatado = pctMedido === 0 ? '0%' : pctMedido < 0.01 ? '<0,01%' : (pctMedido % 1 === 0 ? pctMedido.toFixed(0) + '%' : pctMedido.toFixed(2).replace('.', ',') + '%')
              const pctFisico = Math.min(100, Number(obraSelecionada.progresso || 0))

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ background: C.bgPanel, padding: '16px 18px', borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={13} color={C.amber} />
                        </div>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Valor Contratual Total</span>
                      </div>
                      <strong style={{ fontSize: 16, color: C.ink, fontWeight: 900, marginTop: 4 }}>{fmt(valContrato)}</strong>
                      <span style={{ fontSize: 9.5, color: C.inkSoft }}>Orçamento global aprovado</span>
                    </div>

                    <div style={{ background: C.bgPanel, padding: '16px 18px', borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Ruler size={13} color="#8B5CF6" />
                        </div>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Medição Acumulada</span>
                      </div>
                      <strong style={{ fontSize: 16, color: '#8B5CF6', fontWeight: 900, marginTop: 4 }}>{fmt(valMedido)}</strong>
                      <span style={{ fontSize: 9.5, color: C.inkSoft }}>{pctFormatado} do contrato faturado</span>
                    </div>

                    <div style={{ background: C.bgPanel, padding: '16px 18px', borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={13} color="#10B981" />
                        </div>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Saldo Restante a Medir</span>
                      </div>
                      <strong style={{ fontSize: 16, color: '#10B981', fontWeight: 900, marginTop: 4 }}>{fmt(saldoMedir)}</strong>
                      <span style={{ fontSize: 9.5, color: C.inkSoft }}>Disponível para faturamento</span>
                    </div>

                    <div style={{ background: C.bgPanel, padding: '16px 18px', borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Activity size={13} color={C.amber} />
                        </div>
                        <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Avanço Físico Global</span>
                      </div>
                      <strong style={{ fontSize: 16, color: C.amber, fontWeight: 900, marginTop: 4 }}>{pctFisico.toFixed(1)}%</strong>
                      <span style={{ fontSize: 9.5, color: C.inkSoft }}>Execução física informada</span>
                    </div>
                  </div>

                  {/* Régua de Progresso Visual */}
                  <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: C.ink, marginBottom: 8 }}>
                      <span>Acompanhamento Geral de Execução</span>
                      <span>{pctFormatado} medido · {pctFisico.toFixed(1)}% físico</span>
                    </div>
                    <div style={{ height: 10, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, pctMedido)}%`, background: 'rgba(139, 92, 246, 0.5)', borderRadius: 5 }} />
                      <div style={{ position: 'absolute', top: '20%', left: 0, height: '60%', width: `${pctFisico}%`, background: pctFisico >= 70 ? C.green : C.amber, borderRadius: 3 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 10, color: C.inkSoft }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 4, background: 'rgba(139, 92, 246, 0.6)', border: `1px solid #8B5CF6`, borderRadius: 2 }} />
                        Medição financeira acumulada ({pctFormatado})
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 4, background: C.amber, borderRadius: 2 }} />
                        Avanço físico executado ({pctFisico.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
            
            {/* ─── PREVISÃO DO PRÓXIMO BM & LANÇAMENTOS ───────────────── */}
            <div style={{ background: C.bgPanel, padding: 20, borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ruler size={14} color={C.amber} />
                </div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Governança de Medição & Boletins (BMs)
                </h3>
              </div>

              {/* Previsão do Próximo BM Card */}
              <div style={{ marginBottom: 18, padding: '16px 18px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.22)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Calendar size={14} color={C.amber} />
                    <span style={{ fontSize: 11, color: C.amber, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Previsão Orçamentária do Próximo BM
                    </span>
                  </div>
                  {podeGerenciar && (
                    <button onClick={() => abrirEdicaoObra(obraSelecionada)} style={{ ...btnGhost, color: C.amber, borderColor: `${C.amber}44`, padding: '4px 10px', fontSize: 10, fontWeight: 800 }}>
                      <Edit3 size={11} /> Editar Previsão
                    </button>
                  )}
                </div>
                {obraSelecionada.proximo_urb_valor || obraSelecionada.proximo_urb_data ? (
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                    {obraSelecionada.proximo_urb_valor && (
                      <div>
                        <span style={{ fontSize: 9, color: C.inkSoft, display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>VALOR PREVISTO</span>
                        <strong style={{ fontSize: 15, color: C.amber, fontWeight: 900 }}>{fmt(Number(obraSelecionada.proximo_urb_valor))}</strong>
                      </div>
                    )}
                    {obraSelecionada.proximo_urb_data && (
                      <div>
                        <span style={{ fontSize: 9, color: C.inkSoft, display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>DATA PREVISTA</span>
                        <strong style={{ fontSize: 13, color: C.ink, fontWeight: 800 }}>{new Date(obraSelecionada.proximo_urb_data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                      </div>
                    )}
                    {obraSelecionada.proximo_urb_desc && (
                      <div>
                        <span style={{ fontSize: 9, color: C.inkSoft, display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>LOTE / OBSERVAÇÃO</span>
                        <span style={{ fontSize: 11, color: C.ink, fontWeight: 600 }}>{obraSelecionada.proximo_urb_desc}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: C.inkSoft }}>
                    Nenhuma previsão de BM cadastrada para esta obra. {podeGerenciar && <button onClick={() => abrirEdicaoObra(obraSelecionada)} style={{ all: 'unset', cursor: 'pointer', color: C.amber, textDecoration: 'underline', fontWeight: 700 }}>Cadastrar agora</button>}
                  </div>
                )}
              </div>

              {/* Formulário Nova Medição */}
              {podeGerenciar && (
                <div style={{ background: C.bgCard, padding: 18, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.ink, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
                    <Plus size={14} color={C.amber} /> Lançar Novo Boletim de Medição (BM)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 9.5, color: C.inkSoft, display: 'block', marginBottom: 4, fontWeight: 800, textTransform: 'uppercase' }}>BM de Referência *</label>
                      <input style={input} placeholder="Ex: BM-005" value={metricasForm.bm_atual} onChange={e => setMetricasForm({ ...metricasForm, bm_atual: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 9.5, color: C.inkSoft, display: 'block', marginBottom: 4, fontWeight: 800, textTransform: 'uppercase' }}>Medido Neste BM (R$) *</label>
                      <input style={input} placeholder="0,00" value={metricasForm.medido_acumulado} onChange={e => setMetricasForm({ ...metricasForm, medido_acumulado: e.target.value })} />
                      {metricasForm.medido_acumulado && (
                        <div style={{ fontSize: 9.5, color: '#8B5CF6', marginTop: 4, fontWeight: 800 }}>
                          Novo Total Acumulado: {fmt(Number(obraSelecionada.medido_acumulado || 0) + parseCurrency(metricasForm.medido_acumulado))}
                        </div>
                      )}
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 9.5, color: C.inkSoft, display: 'block', marginBottom: 4, fontWeight: 800, textTransform: 'uppercase' }}>Observação Técnica / Escopo Medido</label>
                      <input style={input} placeholder="Ex: Medição referente à fase de alvenaria e instalações elétricas..." value={metricasForm.observacao} onChange={e => setMetricasForm({ ...metricasForm, observacao: e.target.value })} />
                    </div>
                  </div>
                  <button onClick={() => salvarMetricasObra(obraSelecionada.id)} style={{ ...btn(C.amber), padding: '8px 20px', fontSize: 11.5, fontWeight: 900 }}>
                    Registrar Medição Oficial
                  </button>
                </div>
              )}

              {/* Histórico e Timeline dos Boletins */}
              <div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
                  Histórico Oficial de Boletins ({(obraSelecionada.historico_medicoes || []).length} registros)
                </div>
                {(obraSelecionada.historico_medicoes || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: C.inkSoft, fontSize: 11.5, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                    Nenhuma medição registrada ainda nesta obra.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[...(obraSelecionada.historico_medicoes || [])].reverse().map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                        {/* Linha vertical da Timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? C.amber : 'rgba(245, 158, 11, 0.4)', marginTop: 12, zIndex: 1, border: `2px solid ${idx === 0 ? C.amber : C.border}` }} />
                          {idx < (obraSelecionada.historico_medicoes || []).length - 1 && (
                            <div style={{ width: 1, flex: 1, background: C.border, marginTop: 2 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingBottom: 16 }}>
                          {editandoMedicaoId === item.id ? (
                            // ─── Modo Edição Inline ───
                            <div style={{ background: C.bgCard, border: `1px solid ${C.amber}`, borderRadius: 8, padding: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.amber, fontWeight: 900, textTransform: 'uppercase', marginBottom: 10 }}>
                                <Edit3 size={12} /> Editando Registro de Medição
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
                                <div>
                                  <label style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>BM *</label>
                                  <input style={input} value={editMedicaoForm.bm} onChange={e => setEditMedicaoForm(f => ({ ...f, bm: e.target.value }))} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>Medido Acumulado (R$) *</label>
                                  <input style={input} value={editMedicaoForm.medido_acumulado} onChange={e => setEditMedicaoForm(f => ({ ...f, medido_acumulado: e.target.value }))} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>Observação</label>
                                  <input style={input} value={editMedicaoForm.observacao} onChange={e => setEditMedicaoForm(f => ({ ...f, observacao: e.target.value }))} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => salvarEdicaoMedicao(obraSelecionada.id, item.id)} style={{ ...btn(C.amber), padding: '6px 14px', fontSize: 10.5 }}>Salvar</button>
                                <button onClick={() => setEditandoMedicaoId(null)} style={{ ...btnGhost, padding: '6px 14px', fontSize: 10.5 }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            // ─── Modo Exibição Executivo ───
                            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                                <span style={{ fontSize: 11, fontWeight: 900, color: idx === 0 ? C.amber : C.ink, background: idx === 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${idx === 0 ? 'rgba(245, 158, 11, 0.35)' : C.border}`, padding: '3px 9px', borderRadius: 4 }}>
                                  {item.bm}
                                </span>
                                <span style={{ fontSize: 10.5, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Clock size={11} /> {new Date(item.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span style={{ fontSize: 10.5, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <User size={11} /> {item.autor}
                                </span>
                                {podeGerenciar && (
                                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                                    <button
                                      onClick={() => { setEditandoMedicaoId(item.id); setEditMedicaoForm({ bm: item.bm, medido_acumulado: String(item.medido_acumulado), observacao: item.observacao || '' }) }}
                                      style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: '3px 6px', borderRadius: 3 }}
                                      title="Editar medição"
                                    ><Edit3 size={13} /></button>
                                    <button
                                      onClick={() => excluirMedicao(obraSelecionada.id, item.id)}
                                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '3px 6px', borderRadius: 3 }}
                                      title="Excluir medição"
                                    ><Trash2 size={13} /></button>
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const historicoArray = obraSelecionada.historico_medicoes || []
                                const itemAnterior = historicoArray[historicoArray.length - 1 - idx - 1]
                                const medidoDesteBM = itemAnterior ? Math.max(0, item.medido_acumulado - itemAnterior.medido_acumulado) : item.medido_acumulado
                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                                    <div>
                                      <span style={{ fontSize: 9, color: C.amber, textTransform: 'uppercase', fontWeight: 800 }}>Medido Neste BM</span>
                                      <div style={{ fontSize: 13.5, fontWeight: 900, color: C.amber }}>{fmt(medidoDesteBM)}</div>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Total Acumulado</span>
                                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{fmt(item.medido_acumulado)}</div>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Saldo Remanescente</span>
                                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#10B981' }}>{fmt(item.saldo_a_medir)}</div>
                                    </div>
                                    {item.observacao && (
                                      <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 4, border: `1px solid ${C.border}` }}>
                                        <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Observação Técnica: </span>
                                        <span style={{ fontSize: 11, color: C.ink }}>{item.observacao}</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* ─── GALERIA DE FOTOS & COMPROVANTES DA OBRA ───────────── */}
            <div style={{ background: C.bgPanel, padding: 20, borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={14} color={C.amber} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Galeria de Evidências & Vistorias da Obra
                  </h3>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.amber, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '2px 8px', borderRadius: 4 }}>
                    {fotosObra.length} registros
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {fotosObra.length > 0 && (
                    <button
                      onClick={() => selecionarTodasFotos(fotosObra)}
                      style={{ ...btnGhost, padding: '6px 12px', fontSize: 10.5, color: C.ink, fontWeight: 700 }}
                    >
                      {selecionadasFotos.length === fotosObra.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  )}

                  {selecionadasFotos.length > 0 && (
                    <>
                      <button
                        onClick={() => void baixarFotosEmLote(fotosObra)}
                        style={{ ...btn(C.amber), padding: '6px 12px', fontSize: 10.5 }}
                      >
                        <Download size={12} /> Baixar ({selecionadasFotos.length})
                      </button>

                      {podeGerenciar && (
                        <button
                          onClick={() => void excluirFotosEmLote()}
                          disabled={processandoLote}
                          style={{ ...btn('#EF4444'), padding: '6px 12px', fontSize: 10.5 }}
                        >
                          <Trash2 size={12} /> {processandoLote ? 'Excluindo...' : `Excluir (${selecionadasFotos.length})`}
                        </button>
                      )}
                    </>
                  )}

                  {podeGerenciar && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...input, width: 190, fontSize: 11 }} placeholder="Legenda da foto..." value={legenda} onChange={e => setLegenda(e.target.value)} />
                      <label style={{ ...btn(C.amber), cursor: 'pointer', padding: '0 14px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Upload size={13} /> Anexar
                        <input hidden type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void anexarFoto(f); e.currentTarget.value = '' }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {fotosObra.map(f => {
                  const isRdo = Boolean(f.rdo_id) || (f.imagem_url && !f.imagem_url.includes('comprovantes'))
                  const fotoUrl = !f.imagem_url ? '' : f.imagem_url.startsWith('http')
                    ? f.imagem_url
                    : supabase.storage.from(isRdo ? 'rdo-fotos' : 'comprovantes').getPublicUrl(f.imagem_url).data.publicUrl

                  const isChecked = selecionadasFotos.includes(f.id)

                  return (
                    <div key={f.id} style={{ border: `1px solid ${isChecked ? C.amber : C.border}`, borderRadius: 8, overflow: 'hidden', background: isChecked ? 'rgba(245, 158, 11, 0.12)' : C.bgCard, position: 'relative', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setFotoExpandida({ ...f, resolvedUrl: fotoUrl })}>
                        <img src={fotoUrl} alt={f.legenda || 'Foto'} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                        
                        {/* Checkbox de Seleção */}
                        <div
                          onClick={e => { e.stopPropagation(); toggleFotoSelecionada(f.id) }}
                          style={{
                            position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 4,
                            background: isChecked ? C.amber : 'rgba(11,12,14,0.85)',
                            border: `1.5px solid ${isChecked ? C.amber : '#fff'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', zIndex: 2, backdropFilter: 'blur(4px)'
                          }}
                          title={isChecked ? 'Desmarcar foto' : 'Selecionar foto'}
                        >
                          {isChecked && <Check size={14} color="#0B0C0E" strokeWidth={3} />}
                        </div>

                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: isRdo ? 'rgba(245, 158, 11, 0.92)' : 'rgba(16, 185, 129, 0.92)', padding: '2px 7px', borderRadius: 4, fontSize: 8.5, fontWeight: 900, color: '#0B0C0E', backdropFilter: 'blur(3px)', textTransform: 'uppercase' }}>
                          {isRdo ? 'Diário RDO' : 'Financeiro'}
                        </div>
                        {podeGerenciar && (
                          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, background: 'rgba(11,12,14,0.85)', padding: '2px 4px', borderRadius: 4, backdropFilter: 'blur(4px)' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => { setEditandoFotoId(f.id); setEditFotoLegenda(f.legenda || '') }}
                              style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center' }}
                              title="Editar legenda"
                            >
                              <Edit3 size={12} color={C.amber} />
                            </button>
                            <button
                              onClick={() => excluirFoto(f.id)}
                              style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center' }}
                              title="Excluir foto"
                            >
                              <Trash2 size={12} color="#F87171" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        {editandoFotoId === f.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                              style={{ ...input, fontSize: 11, padding: '4px 6px' }}
                              value={editFotoLegenda}
                              onChange={e => setEditFotoLegenda(e.target.value)}
                              placeholder="Legenda da foto..."
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button onClick={() => salvarEdicaoFoto(f.id)} style={{ ...btn(C.amber), padding: '3px 10px', fontSize: 10 }}>Salvar</button>
                              <button onClick={() => setEditandoFotoId(null)} style={{ ...btnGhost, padding: '3px 10px', fontSize: 10 }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.legenda}>{f.legenda || 'Sem legenda informada'}</div>
                            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>{new Date(f.data_iso).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
                {fotosObra.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '36px 0', textAlign: 'center', color: C.inkSoft, border: `1px dashed ${C.border}`, borderRadius: 8, fontSize: 11.5 }}>
                    Nenhuma evidência ou foto anexada a esta obra até o momento.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR OBRA */}
      <AnimatePresence>
        {editandoObra && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={16} color={C.amber} />
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: C.ink, margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>Editar Dados da Obra</h3>
                </div>
                <button onClick={() => setEditandoObra(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={salvarEdicaoObra} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={label}>Nome da Obra *</label>
                  <input style={input} value={editObraForm.nome} onChange={e => setEditObraForm({ ...editObraForm, nome: e.target.value })} placeholder="Ex: LOTE 07" />
                </div>
                <div>
                  <label style={label}>Cliente / Contratante</label>
                  <input style={input} value={editObraForm.cliente} onChange={e => setEditObraForm({ ...editObraForm, cliente: e.target.value })} placeholder="Ex: Incorporadora Alfa" />
                </div>
                <div>
                  <label style={label}>Endereço / Localização</label>
                  <input style={input} value={editObraForm.endereco} onChange={e => setEditObraForm({ ...editObraForm, endereco: e.target.value })} placeholder="Ex: Av. Principal, 500" />
                </div>
                <div>
                  <label style={label}>Valor do Contrato (R$)</label>
                  <input style={input} value={editObraForm.valor} onChange={e => setEditObraForm({ ...editObraForm, valor: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <label style={label}>Status</label>
                  <select style={input} value={editObraForm.status} onChange={e => setEditObraForm({ ...editObraForm, status: e.target.value })}>
                    <option value="Em dia">Em dia</option>
                    <option value="Atenção">Atenção</option>
                    <option value="Atrasado">Atrasado</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>

                <div style={{ padding: 14, background: 'rgba(245, 158, 11, 0.08)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Calendar size={13} color={C.amber} />
                    <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5 }}>Previsão do Próximo BM</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    <div>
                      <label style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Data Prevista</label>
                      <input type="date" style={input} value={editObraForm.proximo_urb_data} onChange={e => setEditObraForm({ ...editObraForm, proximo_urb_data: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Valor Estimado (R$)</label>
                      <input style={input} value={editObraForm.proximo_urb_valor} onChange={e => setEditObraForm({ ...editObraForm, proximo_urb_valor: e.target.value })} placeholder="0,00" />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Descrição / Lote</label>
                    <input style={input} value={editObraForm.proximo_urb_desc} onChange={e => setEditObraForm({ ...editObraForm, proximo_urb_desc: e.target.value })} placeholder="Ex: Liberar Medição Lote 3" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" onClick={() => setEditandoObra(null)} style={{ ...btnGhost, padding: '8px 16px', fontSize: 11 }}>Cancelar</button>
                  <button type="submit" style={{ ...btn(C.amber), padding: '8px 20px', fontSize: 11, fontWeight: 900 }}>Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL VISUALIZAR FOTO EXPANDIDA */}
      <AnimatePresence>
        {fotoExpandida && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(5px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setFotoExpandida(null)}
          >
            <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <a
                href={fotoExpandida.resolvedUrl || fotoExpandida.imagem_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ ...btnGhost, color: C.amber, border: `1px solid ${C.amber}40`, textDecoration: 'none', padding: '6px 14px', fontSize: 11, fontWeight: 700 }}
              >
                Abrir em nova aba ↗
              </a>
              <button
                onClick={() => setFotoExpandida(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
              onClick={e => e.stopPropagation()}
            >
              <img
                src={fotoExpandida.resolvedUrl || fotoExpandida.imagem_url}
                alt={fotoExpandida.legenda || 'Foto da Obra'}
                style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 6, objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', border: `1px solid ${C.border}` }}
              />
              <div style={{ textAlign: 'center', background: C.bgPanel, padding: '12px 24px', borderRadius: 6, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{fotoExpandida.legenda || 'Sem legenda'}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 10.5, color: C.inkSoft }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} color={C.amber} /> {new Date(fotoExpandida.data_iso).toLocaleDateString('pt-BR')}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} color={C.inkSoft} /> {fotoExpandida.rdo_id ? 'Foto enviada via RDO' : 'Anexada pelo Financeiro'}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE GERENCIAMENTO DE ACESSOS (OBRAS) ── */}
      {acessosObra && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 22, maxWidth: 580, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} color={C.amber} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Permissões da Obra: <span style={{ color: C.amber }}>{acessosObra.nome}</span>
                  </h3>
                  <p style={{ fontSize: 10.5, color: C.inkSoft, margin: '2px 0 0' }}>
                    Defina os colaboradores autorizados a acessar esta obra no sistema.
                  </p>
                </div>
              </div>
              <button style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer' }} onClick={() => setAcessosObra(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setFiltroAcesso('todos')}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                  background: filtroAcesso === 'todos' ? C.amber : C.bgCard,
                  color: filtroAcesso === 'todos' ? '#0B0C0E' : C.inkSoft
                }}
              >
                Todos ({colaboradores.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroAcesso('com_acesso')}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                  background: filtroAcesso === 'com_acesso' ? 'rgba(34, 197, 94, 0.2)' : C.bgCard,
                  color: filtroAcesso === 'com_acesso' ? '#4ADE80' : C.inkSoft,
                  borderColor: filtroAcesso === 'com_acesso' ? '#22C55E55' : C.border
                }}
              >
                ✓ Com Acesso ({colaboradores.filter(c => c.cargo === 'admin_geral' || (c.obras_ids || []).includes(acessosObra.id)).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroAcesso('sem_acesso')}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                  background: filtroAcesso === 'sem_acesso' ? 'rgba(239, 68, 68, 0.2)' : C.bgCard,
                  color: filtroAcesso === 'sem_acesso' ? '#F87171' : C.inkSoft,
                  borderColor: filtroAcesso === 'sem_acesso' ? '#EF444455' : C.border
                }}
              >
                ✕ Sem Acesso ({colaboradores.filter(c => c.cargo !== 'admin_geral' && !(c.obras_ids || []).includes(acessosObra.id)).length})
              </button>
            </div>

            <div style={{ marginBottom: 12, position: 'relative' }}>
              <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                style={{ ...input, fontSize: 11, padding: '7px 10px 7px 32px' }}
                placeholder="Buscar colaborador por nome, cargo ou e-mail..."
                value={searchColab}
                onChange={e => setSearchColab(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 4 }}>
              {colaboradores
                .filter(colab => {
                  const isAdmin = colab.cargo === 'admin_geral'
                  const ids: string[] = colab.obras_ids || []
                  const hasAccess = isAdmin || ids.includes(acessosObra.id)

                  if (filtroAcesso === 'com_acesso' && !hasAccess) return false
                  if (filtroAcesso === 'sem_acesso' && hasAccess) return false

                  if (!searchColab.trim()) return true
                  const q = searchColab.toLowerCase()
                  return colab.nome.toLowerCase().includes(q) || (colab.cargo || '').toLowerCase().includes(q) || (colab.email || '').toLowerCase().includes(q)
                })
                .sort((a, b) => {
                  const aAdmin = a.cargo === 'admin_geral'
                  const bAdmin = b.cargo === 'admin_geral'

                  const aIds: string[] = a.obras_ids || []
                  const bIds: string[] = b.obras_ids || []

                  const aAccess = aAdmin || aIds.includes(acessosObra.id)
                  const bAccess = bAdmin || bIds.includes(acessosObra.id)

                  if (aAdmin && !bAdmin) return -1
                  if (!aAdmin && bAdmin) return 1
                  if (aAccess && !bAccess) return -1
                  if (!aAccess && bAccess) return 1

                  return a.nome.localeCompare(b.nome, 'pt-BR')
                })
                .map(colab => {
                  const isAdmin = colab.cargo === 'admin_geral'
                  const ids: string[] = colab.obras_ids || []
                  const hasAccess = isAdmin || ids.includes(acessosObra.id)
                  const isUpdating = updatingColabId === colab.id

                  return (
                    <div key={colab.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.bgCard, border: `1px solid ${hasAccess ? `${C.amber}44` : C.border}`, borderRadius: 6 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ fontSize: 12, color: C.ink }}>{colab.nome}</strong>
                          {isAdmin && (
                            <span style={{ fontSize: 8.5, fontWeight: 900, background: `${C.amber}18`, color: C.amber, border: `1px solid ${C.amber}44`, padding: '1px 5px', borderRadius: 3 }}>
                              ADMIN GERAL
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: C.inkSoft }}>
                          {colab.cargo || 'Sem cargo'} · {colab.email || 'Sem e-mail'}
                        </span>
                      </div>
                      <div>
                        {isAdmin ? (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: C.amber }}>
                            Acesso Total
                          </span>
                        ) : (
                          <button
                            disabled={isUpdating}
                            onClick={() => void toggleAcessoColaboradorObra(colab, acessosObra.id)}
                            style={{
                              borderRadius: 4, padding: '5px 12px', fontSize: 10, fontWeight: 800, cursor: isUpdating ? 'not-allowed' : 'pointer',
                              background: hasAccess ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                              color: hasAccess ? '#4ADE80' : C.inkSoft,
                              border: `1px solid ${hasAccess ? '#22C55E55' : C.border}`,
                              opacity: isUpdating ? 0.5 : 1
                            }}
                          >
                            {isUpdating ? 'Salvando...' : hasAccess ? '✓ Com Acesso' : '+ Liberar Acesso'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{ ...btn(C.amber), fontSize: 11, padding: '7px 18px', fontWeight: 900 }} onClick={() => setAcessosObra(null)}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TabProps {
  colaboradorAtivo: Colaborador
  permissaoAtiva: ConfigPermissao
  confirm: (title: string, desc: string, options?: any) => Promise<boolean>
  prompt?: (title: string, options?: { description?: string; placeholder?: string; confirmLabel?: string }) => Promise<string | null>
  goToHistoricoByFornecedor?: (idFornecedor: string) => void
  initialFornecedorId?: string
  colaboradores?: Colaborador[]
}

function DashboardTab({ colaboradorAtivo, permissaoAtiva }: TabProps) {
  const [contas, setContas]     = useState<ContaComRelacoes[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const buildContasQuery = (sb: typeof supabase) => {
      let q = sb.from('contas').select('*, empresa:empresas(nome_fantasia,razao_social,cor), fornecedor:fornecedores(razao_social,nome_fantasia), obra:obras(nome)').order('data_previsao', { ascending: false })
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
        if (ids.length > 0) {
          q = q.in('empresa_id', ids)
        }
        q = q.or(`is_privada.eq.false,is_privada.is.null,usuarios_permitidos.cs.{${colaboradorAtivo.id}}`)
      }
      return q
    }

    let qE = supabase.from('empresas').select('*').order('razao_social').limit(1000)
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qE = qE.in('id', ids)
      }
    }
    
    const [{ data: c }, { data: e }] = await Promise.all([
      fetchAllChunks<ContaComRelacoes>(buildContasQuery),
      qE
    ])
    
    let fetchedContas = (c as ContaComRelacoes[]) ?? []
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const oIds = colaboradorAtivo.obras_ids || []
      fetchedContas = fetchedContas.filter(conta => (conta.obra_id && conta.obra_id !== 'geral') ? oIds.includes(conta.obra_id) : oIds.includes('geral'))
    }
    
    setContas(fetchedContas)
    setEmpresas(e ?? [])
    setLoading(false)
  }, [colaboradorAtivo])

  useRealtimeSync(load, 'financeiro-dashboard')
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (colaboradorAtivo.cargo === 'admin_geral') return contas
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    return ids.length > 0 ? contas.filter(c => ids.includes(c.empresa_id)) : contas
  }, [contas, colaboradorAtivo])

  const { receitas, despesas, resultado } = useMemo(() => {
    const rec = filtered.filter(c => c.tipo === 'receber' && (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal')).reduce((s, c) => s + c.valor, 0)
    const des = filtered.filter(c => c.tipo === 'pagar'   && (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal')).reduce((s, c) => s + c.valor, 0)
    return { receitas: rec, despesas: des, resultado: rec - des }
  }, [filtered])

  const { vencidas, vencendo7, vencendo30, totalVencido, total7d, total30d } = useMemo(() => {
    const hoje = new Date()
    const mais7 = new Date()
    mais7.setDate(hoje.getDate() + 7)
    const mais30 = new Date()
    mais30.setDate(hoje.getDate() + 30)

    const v = filtered.filter(c => isVencido(c.data_previsao || c.data_vencimento, c.status))
    const v7 = filtered.filter(c => {
      if (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal') return false
      const d = new Date((c.data_previsao || c.data_vencimento) + 'T00:00:00')
      return d >= hoje && d <= mais7
    })
    const v30 = filtered.filter(c => {
      if (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal') return false
      const d = new Date((c.data_previsao || c.data_vencimento) + 'T00:00:00')
      return d >= hoje && d <= mais30
    })

    return {
      vencidas: v,
      vencendo7: v7,
      vencendo30: v30,
      totalVencido: v.reduce((s, c) => s + c.valor, 0),
      total7d: v7.reduce((s, c) => s + c.valor, 0),
      total30d: v30.reduce((s, c) => s + c.valor, 0)
    }
  }, [filtered])

  // Gráfico Recharts
  const chartData = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const atual = new Date().getMonth()
    
    const ultimos6 = Array.from({ length: 6 }).map((_, idx) => {
      const mIdx = (atual - 5 + idx + 12) % 12
      return {
        name: meses[mIdx],
        mesNum: mIdx,
        Entradas: 0,
        Saídas: 0,
      }
    })

    filtered.forEach(c => {
      if ((c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal') && c.pago_em) {
        const dt = new Date(c.pago_em)
        const m = dt.getMonth()
        const mesData = ultimos6.find(u => u.mesNum === m)
        if (mesData) {
          if (c.tipo === 'receber') {
            mesData.Entradas += c.valor
          } else {
            mesData.Saídas += c.valor
          }
        }
      }
    })
    return ultimos6
  }, [filtered])

  // DRE
  const dre = useMemo(() => {
    const categoriasReceita: Record<string, number> = {}
    const categoriasDespesa: Record<string, number> = {}

    filtered.filter(c => c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal').forEach(c => {
      const cat = c.categoria || 'Outros'
      if (c.tipo === 'receber') {
        categoriasReceita[cat] = (categoriasReceita[cat] || 0) + c.valor
      } else {
        categoriasDespesa[cat] = (categoriasDespesa[cat] || 0) + c.valor
      }
    })

    return {
      receitas: Object.entries(categoriasReceita).map(([cat, val]) => ({ cat, val })),
      despesas: Object.entries(categoriasDespesa).map(([cat, val]) => ({ cat, val })),
    }
  }, [filtered])

  const kpis = [
    { label: 'Saldo Recebido',   value: fmt(resultado),    icon: DollarSign,    color: resultado >= 0 ? '#34D399' : '#F87171' },
    { label: 'Contas Vencidas',  value: fmt(totalVencido),  icon: AlertCircle,   color: totalVencido > 0 ? '#EF4444' : C.inkSoft },
    { label: 'Vence em 7 dias',  value: fmt(total7d),      icon: Calendar,      color: C.amber },
    { label: 'Vence em 30 dias', value: fmt(total30d),     icon: Clock,         color: C.amber },
  ]

  return (
    <div>
      {/* Empresas exibidas conforme as empresas vinculadas no perfil */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => void load()} style={btnGhost}><RefreshCw size={13} /></button>
      </div>

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando dados financeiros...</p>
      ) : (
        <>
          {vencidas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#EF444415', border: '1px solid #EF444433', borderRadius: 8, padding: '12px 18px', marginBottom: 24, color: '#EF4444' }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Atenção: Existem {vencidas.length} contas vencidas e pendentes de pagamento que totalizam {fmt(totalVencido)}.
              </div>
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: .6 }}>{k.label}</span>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: k.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={14} color={k.color} />
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>{k.value}</div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28, alignItems: 'stretch' }}>
            {/* Gráfico */}
            <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 800, color: C.ink, marginBottom: 16, fontSize: 14 }}>Fluxo de Caixa (Entradas vs Saídas)</div>
              <div style={{ width: '100%', height: 260, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="name" stroke={C.inkSoft} style={{ fontSize: 10 }} />
                    <YAxis stroke={C.inkSoft} style={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#18181B', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11 }} />
                    <Line type="monotone" dataKey="Entradas" stroke="#34D399" strokeWidth={3} dot={{ fill: '#34D399' }} />
                    <Line type="monotone" dataKey="Saídas" stroke="#F87171" strokeWidth={3} dot={{ fill: '#F87171' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DRE */}
            <div style={card}>
              <div style={{ fontWeight: 800, color: C.ink, marginBottom: 16, fontSize: 14 }}>DRE Simplificado (Realizado)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#34D399', textTransform: 'uppercase' }}>(+) Receitas</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#34D399' }}>{fmt(receitas)}</span>
                  </div>
                  {dre.receitas.length === 0 ? (
                    <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', paddingLeft: 8 }}>Nenhuma receita registrada</div>
                  ) : (
                    dre.receitas.map(r => (
                      <div key={r.cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 8px', color: C.inkSoft }}>
                        <span>{r.cat}</span>
                        <span>{fmt(r.val)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#F87171', textTransform: 'uppercase' }}>(-) Despesas</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#F87171' }}>{fmt(despesas)}</span>
                  </div>
                  {dre.despesas.length === 0 ? (
                    <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', paddingLeft: 8 }}>Nenhuma despesa registrada</div>
                  ) : (
                    dre.despesas.map(d => (
                      <div key={d.cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 8px', color: C.inkSoft }}>
                        <span>{d.cat}</span>
                        <span>{fmt(d.val)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>(=) Resultado do Período</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: resultado >= 0 ? '#34D399' : '#F87171' }}>{fmt(resultado)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: EMPRESAS
// ════════════════════════════════════════════════════════
function EmpresasTab({ colaboradorAtivo, permissaoAtiva, confirm }: TabProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ razao_social: '', nome_fantasia: '', cnpj: '', cor: '#F59E0B' })
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Edição de empresa
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null)
  const [editForm, setEditForm] = useState({ razao_social: '', nome_fantasia: '', cnpj: '', cor: '#F59E0B' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Gerenciamento de acessos
  const [acessosEmpresa, setAcessosEmpresa] = useState<Empresa | null>(null)
  const [searchColab, setSearchColab] = useState('')
  const [filtroAcesso, setFiltroAcesso] = useState<'todos' | 'com_acesso' | 'sem_acesso'>('todos')
  const [updatingColabId, setUpdatingColabId] = useState<string | null>(null)

  const PRESET_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B', '#D97706']

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const [{ data: empData }, { data: colabData }] = await Promise.all([
      supabase.from('empresas').select('*').order('razao_social'),
      supabase.from('colaboradores').select('*').order('nome')
    ])
    setEmpresas(empData ?? [])
    setColaboradores((colabData as Colaborador[]) ?? [])
    setLoading(false)
  }, [])

  useRealtimeSync(load, 'financeiro-empresas')
  useEffect(() => { void load() }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.razao_social.trim()) return toast('Informe a Razão Social da empresa.', 'error')
    setSaving(true)
    const { error } = await supabase.from('empresas').insert({
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: form.cnpj.trim() || null,
      cor: form.cor || '#F59E0B'
    })
    if (error) {
      setSaving(false)
      return toast(`Não foi possível salvar a empresa: ${error.message}`, 'error')
    }
    setForm({ razao_social: '', nome_fantasia: '', cnpj: '', cor: '#F59E0B' })
    setShowForm(false)
    setSaving(false)
    await load()
    toast('Empresa cadastrada com sucesso.', 'success')
  }

  const openEdit = (emp: Empresa) => {
    setEditingEmpresa(emp)
    setEditForm({
      razao_social: emp.razao_social || '',
      nome_fantasia: emp.nome_fantasia || '',
      cnpj: emp.cnpj || '',
      cor: emp.cor || '#F59E0B'
    })
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEmpresa) return
    if (!editForm.razao_social.trim()) return toast('Informe a Razão Social.', 'error')
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          razao_social: editForm.razao_social.trim(),
          nome_fantasia: editForm.nome_fantasia.trim() || null,
          cnpj: editForm.cnpj.trim() || null,
          cor: editForm.cor || '#F59E0B'
        })
        .eq('id', editingEmpresa.id)

      if (error) throw error

      toast('Dados da empresa atualizados com sucesso!', 'success')
      setEditingEmpresa(null)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar empresa'
      toast(msg, 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleAcessoColaborador = async (colab: Colaborador, empresaId: string) => {
    if (colab.cargo === 'admin_geral') {
      return toast('Administradores gerais possuem acesso irrestrito a todas as empresas.', 'info')
    }

    setUpdatingColabId(colab.id)
    try {
      const currentIds: string[] = colab.empresas_ids || (colab.empresa_id ? [colab.empresa_id] : [])
      const hasAccess = currentIds.includes(empresaId)

      let nextIds: string[] = []
      if (hasAccess) {
        nextIds = currentIds.filter(id => id !== empresaId)
      } else {
        nextIds = Array.from(new Set([...currentIds, empresaId]))
      }

      const { error } = await supabase
        .from('colaboradores')
        .update({ empresas_ids: nextIds })
        .eq('id', colab.id)

      if (error) throw error

      toast(hasAccess ? `Acesso revogado para ${colab.nome}` : `Acesso concedido para ${colab.nome}`, 'success')
      await load()
    } catch (err: any) {
      const msg = err?.message || 'Erro ao atualizar acesso'
      toast(msg, 'error')
    } finally {
      setUpdatingColabId(null)
    }
  }

  const remove = async (id: string, nome: string) => {
    if (!(await confirm('Excluir Empresa', `Deseja realmente remover a empresa "${nome}"? Esta ação removerá os vínculos do sistema.`, { confirmLabel: 'Excluir Empresa', confirmColor: C.red }))) return
    const { error } = await supabase.from('empresas').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    await load()
    toast('Empresa removida com sucesso.', 'success')
  }

  const podeGerenciar = Boolean(permissaoAtiva?.pode_empresas && colaboradorAtivo.cargo !== 'admin_empresa')

  const empresasFiltradas = useMemo(() => {
    let list = empresas.filter(e => {
      if (colaboradorAtivo.cargo !== 'admin_empresa') return true
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      return ids.includes(e.id)
    })
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(e =>
        (e.razao_social || '').toLowerCase().includes(q) ||
        (e.nome_fantasia || '').toLowerCase().includes(q) ||
        (e.cnpj || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [empresas, colaboradorAtivo, searchQuery])

  // KPIs de Empresas
  const totalEmpresas = empresas.length
  const empresasComCnpj = empresas.filter(e => Boolean(e.cnpj)).length
  const totalUsuariosVinculados = colaboradores.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── CABEÇALHO DA SEÇÃO DE EMPRESAS ──────────────────────────── */}
      <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={16} color={C.amber} />
              </div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Gestão de Empresas & Filiais
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.inkSoft }}>
              Administração de entidades jurídicas, cadastro de CNPJ, identidade visual e controle de acesso por usuário.
            </p>
          </div>

          {podeGerenciar && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(!showForm)}
              style={{
                ...btn(C.amber),
                fontSize: 11.5,
                fontWeight: 900,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              {showForm ? 'Fechar Formulário' : 'Nova Empresa'}
            </motion.button>
          )}
        </div>

        {/* ─── FORMULÁRIO DE NOVA EMPRESA ────────────────────────────── */}
        {showForm && podeGerenciar && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={save}
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} color={C.amber} /> Cadastrar Nova Entidade
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={label}>Razão Social *</label>
                <input
                  style={input}
                  placeholder="Nome empresarial oficial"
                  value={form.razao_social}
                  onChange={e => setForm({ ...form, razao_social: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={label}>Nome Fantasia</label>
                <input
                  style={input}
                  placeholder="Nome comercial / Como é conhecida"
                  value={form.nome_fantasia}
                  onChange={e => setForm({ ...form, nome_fantasia: e.target.value })}
                />
              </div>
              <div>
                <label style={label}>CNPJ</label>
                <input
                  style={input}
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={e => setForm({ ...form, cnpj: e.target.value })}
                />
              </div>
              <div>
                <label style={label}>Cor de Identificação</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, cor: c })}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: c,
                          border: form.cor === c ? '2px solid #FFFFFF' : '1px solid rgba(0,0,0,0.2)',
                          cursor: 'pointer',
                          boxShadow: form.cor === c ? '0 0 0 2px #F59E0B' : 'none'
                        }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={form.cor}
                    onChange={e => setForm({ ...form, cor: e.target.value })}
                    style={{ width: 34, height: 32, borderRadius: 4, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', padding: 1 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btnGhost, padding: '8px 16px', fontSize: 11.5 }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ ...btn(C.amber), padding: '8px 18px', fontSize: 11.5, fontWeight: 900 }}>
                {saving ? 'Cadastrando...' : 'Salvar Empresa'}
              </button>
            </div>
          </motion.form>
        )}

        {/* ─── 4 CARDS DE KPIS EXECUTIVOS ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={14} color={C.amber} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total de Empresas</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginTop: 2 }}>{totalEmpresas}</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Entidades jurídicas cadastradas</span>
          </div>

          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={14} color="#10B981" />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>CNPJs Ativos</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: '#10B981', marginTop: 2 }}>{empresasComCnpj} de {totalEmpresas}</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Cadastros com CNPJ informado</span>
          </div>

          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={14} color="#8B5CF6" />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Equipe no Sistema</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: '#8B5CF6', marginTop: 2 }}>{totalUsuariosVinculados}</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Colaboradores e gestores</span>
          </div>

          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={14} color={C.amber} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Segregação de Acesso</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginTop: 2 }}>Multi-Empresa</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Permissões isoladas por filial</span>
          </div>
        </div>

        {/* ─── BARRA DE PESQUISA & FILTROS ────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                style={{ ...input, paddingLeft: 32, fontSize: 11 }}
                placeholder="Buscar empresa por Razão Social, Nome Fantasia ou CNPJ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
            {empresasFiltradas.length} {empresasFiltradas.length === 1 ? 'empresa listada' : 'empresas listadas'}
          </span>
        </div>

        {/* ─── GRID DE CARDS EXECUTIVOS DE EMPRESAS ──────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.inkSoft, fontSize: 12 }}>Carregando dados das empresas...</div>
        ) : empresasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.inkSoft, fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 8 }}>
            Nenhuma empresa encontrada com os filtros selecionados.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {empresasFiltradas.map(e => {
              const colabsComAcesso = colaboradores.filter(c => {
                if (c.cargo === 'admin_geral') return true
                const ids: string[] = c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])
                return ids.includes(e.id)
              })

              const corDestaque = e.cor || '#F59E0B'

              return (
                <div
                  key={e.id}
                  style={{
                    background: C.bgPanel,
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${corDestaque}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 6, background: `${corDestaque}18`, border: `1px solid ${corDestaque}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <Building2 size={17} color={corDestaque} />
                        </div>
                        <div>
                          <h3 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                            {e.nome_fantasia || e.razao_social}
                          </h3>
                          {e.nome_fantasia && (
                            <p style={{ margin: 0, fontSize: 10.5, color: C.inkSoft }}>{e.razao_social}</p>
                          )}
                        </div>
                      </div>

                      {podeGerenciar && (
                        <button
                          onClick={() => remove(e.id, e.nome_fantasia || e.razao_social)}
                          title="Excluir empresa"
                          style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft, padding: 4, transition: 'color 0.15s' }}
                          className="hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft }}>
                        <FileText size={12} color={C.amber} />
                        <span>CNPJ: <strong style={{ color: C.ink }}>{e.cnpj || 'Não informado'}</strong></span>
                      </div>

                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: corDestaque, border: '1px solid rgba(255,255,255,0.3)' }} title={`Cor: ${corDestaque}`} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: C.bgCard, borderRadius: 6, border: `1px solid ${C.border}`, marginTop: 'auto' }}>
                      <Users size={13} color={C.amber} />
                      <span style={{ fontSize: 10.5, color: C.ink }}>
                        <strong style={{ color: C.amber, fontWeight: 900 }}>{colabsComAcesso.length}</strong> usuário(s) com acesso autorizado
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  {podeGerenciar && (
                    <div style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.15)', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
                      <button
                        style={{ ...btnGhost, flex: 1, fontSize: 10.5, fontWeight: 800, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        onClick={() => openEdit(e)}
                      >
                        <Edit3 size={12} color={C.amber} /> Editar Dados
                      </button>
                      <button
                        style={{ ...btn(C.amber), flex: 1, fontSize: 10.5, fontWeight: 900, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        onClick={() => setAcessosEmpresa(e)}
                      >
                        <Shield size={12} /> Acessos & Equipe
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL DE EDIÇÃO DE EMPRESA ──────────────────────────────── */}
      <AnimatePresence>
        {editingEmpresa && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, maxWidth: 500, width: '100%', boxShadow: '0 12px 36px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={16} color={C.amber} />
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: C.ink, margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Editar Entidade Empresarial
                  </h3>
                </div>
                <button onClick={() => setEditingEmpresa(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={label}>Razão Social *</label>
                  <input style={input} value={editForm.razao_social} onChange={e => setEditForm({ ...editForm, razao_social: e.target.value })} placeholder="Nome empresarial oficial" required />
                </div>
                <div>
                  <label style={label}>Nome Fantasia</label>
                  <input style={input} value={editForm.nome_fantasia} onChange={e => setEditForm({ ...editForm, nome_fantasia: e.target.value })} placeholder="Como é conhecida" />
                </div>
                <div>
                  <label style={label}>CNPJ</label>
                  <input style={input} value={editForm.cnpj} onChange={e => setEditForm({ ...editForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label style={label}>Cor de Identificação</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, cor: c })}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            background: c,
                            border: editForm.cor === c ? '2px solid #FFFFFF' : '1px solid rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            boxShadow: editForm.cor === c ? '0 0 0 2px #F59E0B' : 'none'
                          }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={editForm.cor}
                      onChange={e => setEditForm({ ...editForm, cor: e.target.value })}
                      style={{ width: 34, height: 32, borderRadius: 4, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', padding: 1 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <button type="button" style={btnGhost} onClick={() => setEditingEmpresa(null)} disabled={savingEdit}>Cancelar</button>
                  <button type="submit" style={{ ...btn(C.amber), fontWeight: 900 }} disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar Alterações'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL DE GERENCIAMENTO DE ACESSOS ───────────────────────── */}
      <AnimatePresence>
        {acessosEmpresa && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 36px rgba(0,0,0,0.5)', gap: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shield size={16} color={C.amber} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Acessos & Equipe: <span style={{ color: C.amber }}>{acessosEmpresa.nome_fantasia || acessosEmpresa.razao_social}</span>
                    </h3>
                    <p style={{ fontSize: 10.5, color: C.inkSoft, margin: '2px 0 0' }}>
                      Defina os colaboradores autorizados a visualizar e lançar contas desta empresa.
                    </p>
                  </div>
                </div>
                <button style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer' }} onClick={() => setAcessosEmpresa(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* Filtros de Acesso */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setFiltroAcesso('todos')}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                    background: filtroAcesso === 'todos' ? C.amber : C.bgCard,
                    color: filtroAcesso === 'todos' ? '#0B0C0E' : C.inkSoft
                  }}
                >
                  Todos ({colaboradores.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroAcesso('com_acesso')}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                    background: filtroAcesso === 'com_acesso' ? 'rgba(34, 197, 94, 0.2)' : C.bgCard,
                    color: filtroAcesso === 'com_acesso' ? '#4ADE80' : C.inkSoft,
                    borderColor: filtroAcesso === 'com_acesso' ? '#22C55E55' : C.border
                  }}
                >
                  ✓ Com Acesso ({colaboradores.filter(c => c.cargo === 'admin_geral' || (c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])).includes(acessosEmpresa.id)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroAcesso('sem_acesso')}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                    background: filtroAcesso === 'sem_acesso' ? 'rgba(239, 68, 68, 0.2)' : C.bgCard,
                    color: filtroAcesso === 'sem_acesso' ? '#F87171' : C.inkSoft,
                    borderColor: filtroAcesso === 'sem_acesso' ? '#EF444455' : C.border
                  }}
                >
                  ✕ Sem Acesso ({colaboradores.filter(c => c.cargo !== 'admin_geral' && !(c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])).includes(acessosEmpresa.id)).length})
                </button>
              </div>

              {/* Busca de Colaborador */}
              <div style={{ position: 'relative' }}>
                <Search size={13} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  style={{ ...input, paddingLeft: 30, fontSize: 11 }}
                  placeholder="Buscar colaborador por nome, cargo ou e-mail..."
                  value={searchColab}
                  onChange={e => setSearchColab(e.target.value)}
                />
              </div>

              {/* Lista com Scroll */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {colaboradores
                  .filter(colab => {
                    const isAdmin = colab.cargo === 'admin_geral'
                    const ids: string[] = colab.empresas_ids || (colab.empresa_id ? [colab.empresa_id] : [])
                    const hasAccess = isAdmin || ids.includes(acessosEmpresa.id)

                    if (filtroAcesso === 'com_acesso' && !hasAccess) return false
                    if (filtroAcesso === 'sem_acesso' && hasAccess) return false

                    if (!searchColab.trim()) return true
                    const q = searchColab.toLowerCase()
                    return (colab.nome || '').toLowerCase().includes(q) || (colab.cargo || '').toLowerCase().includes(q) || (colab.email || '').toLowerCase().includes(q)
                  })
                  .sort((a, b) => {
                    const aAdmin = a.cargo === 'admin_geral'
                    const bAdmin = b.cargo === 'admin_geral'

                    const aIds: string[] = a.empresas_ids || (a.empresa_id ? [a.empresa_id] : [])
                    const bIds: string[] = b.empresas_ids || (b.empresa_id ? [b.empresa_id] : [])

                    const aAccess = aAdmin || aIds.includes(acessosEmpresa.id)
                    const bAccess = bAdmin || bIds.includes(acessosEmpresa.id)

                    if (aAdmin && !bAdmin) return -1
                    if (!aAdmin && bAdmin) return 1
                    if (aAccess && !bAccess) return -1
                    if (!aAccess && bAccess) return 1
                    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
                  })
                  .map(colab => {
                    const isAdmin = colab.cargo === 'admin_geral'
                    const ids: string[] = colab.empresas_ids || (colab.empresa_id ? [colab.empresa_id] : [])
                    const hasAccess = isAdmin || ids.includes(acessosEmpresa.id)
                    const isUpdating = updatingColabId === colab.id

                    return (
                      <div
                        key={colab.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: C.bgCard,
                          border: `1px solid ${hasAccess ? 'rgba(245, 158, 11, 0.35)' : C.border}`,
                          borderRadius: 6
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={13} color={C.amber} />
                          </div>
                          <div>
                            <strong style={{ fontSize: 12, color: C.ink, display: 'block' }}>{colab.nome}</strong>
                            <span style={{ fontSize: 10, color: C.inkSoft }}>
                              {colab.cargo ? NOMES_CARGOS[colab.cargo] || colab.cargo : 'Sem cargo'} · {colab.email || 'Sem e-mail'}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isAdmin ? (
                            <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(245, 158, 11, 0.12)', color: C.amber, border: '1px solid rgba(245, 158, 11, 0.35)', padding: '3px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Shield size={10} /> Admin Geral
                            </span>
                          ) : (
                            <button
                              disabled={isUpdating}
                              onClick={() => void toggleAcessoColaborador(colab, acessosEmpresa.id)}
                              style={{
                                borderRadius: 4,
                                padding: '5px 12px',
                                fontSize: 10,
                                fontWeight: 800,
                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                background: hasAccess ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                color: hasAccess ? '#4ADE80' : C.inkSoft,
                                border: `1px solid ${hasAccess ? '#22C55E55' : C.border}`,
                                opacity: isUpdating ? 0.5 : 1
                              }}
                            >
                              {isUpdating ? 'Salvando...' : hasAccess ? '✓ Com Acesso' : '+ Liberar Acesso'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>

              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <button style={{ ...btn(C.amber), fontSize: 11, padding: '7px 18px', fontWeight: 900 }} onClick={() => setAcessosEmpresa(null)}>
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: FORNECEDORES
// ════════════════════════════════════════════════════════
function formatCnpjCpf(val: string, tipo: 'PJ' | 'PF'): string {
  const digits = (val || '').replace(/\D/g, '')
  if (tipo === 'PF') {
    return digits.slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits.slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatTelefone(val: string): string {
  const digits = (val || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

function FornecedoresTab({ colaboradorAtivo, permissaoAtiva, confirm, goToHistoricoByFornecedor }: TabProps) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [contasFornecedores, setContasFornecedores] = useState<Conta[]>([])
  const [empresas, setEmpresas]         = useState<Empresa[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null)
  const [search, setSearch]             = useState('')
  const [filtroTipo, setFiltroTipo]     = useState<'todos' | 'PJ' | 'PF' | 'aberto' | 'vencidas'>('todos')
  const [form, setForm] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', tipo: 'PJ' as 'PJ'|'PF',
    telefone: '', email: '', responsavel: '', pix: '', categoria: '', empresa_id: '',
    endereco: '', banco: '', agencia: '', conta: ''
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const buildContasQuery = (sb: typeof supabase) => {
      let q = sb.from('contas').select('*')
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
        if (ids.length > 0) {
          q = q.in('empresa_id', ids)
        }
        q = q.or(`is_privada.eq.false,is_privada.is.null,usuarios_permitidos.cs.{${colaboradorAtivo.id}}`)
      }
      return q
    }

    let qF = supabase.from('fornecedores').select('*').order('razao_social')
    let qE = supabase.from('empresas').select('*').order('razao_social')

    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qF = qF.or(`empresa_id.in.(${ids.join(',')}),empresa_id.is.null`)
        qE = qE.in('id', ids)
      }
    }

    const [{ data: f }, { data: e }, { data: c }] = await Promise.all([
      fetchAllChunks<Fornecedor>(() => qF),
      qE.limit(1000),
      fetchAllChunks<Conta>(buildContasQuery)
    ])
    setFornecedores(f ?? [])
    setEmpresas(e ?? [])
    
    let fetchedContasFornecedores = c ?? []
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const oIds = colaboradorAtivo.obras_ids || []
      fetchedContasFornecedores = fetchedContasFornecedores.filter(conta => (conta.obra_id && conta.obra_id !== 'geral') ? oIds.includes(conta.obra_id) : oIds.includes('geral'))
    }
    setContasFornecedores(fetchedContasFornecedores)
    setLoading(false)
  }, [colaboradorAtivo])

  useRealtimeSync(load, 'financeiro-fornecedores')
  useEffect(() => { void load() }, [load])

  const abrirNovoForm = () => {
    setEditingFornecedor(null)
    setForm({
      razao_social: '', nome_fantasia: '', cnpj: '', tipo: 'PJ',
      telefone: '', email: '', responsavel: '', pix: '', categoria: '', empresa_id: '',
      endereco: '', banco: '', agencia: '', conta: ''
    })
    setShowForm(prev => !prev)
  }

  const iniciarEdicaoFornecedor = (f: Fornecedor) => {
    setEditingFornecedor(f)
    setShowForm(false)
    const docTipo = (f.tipo as 'PJ'|'PF') || (f.cnpj && f.cnpj.replace(/\D/g, '').length === 11 ? 'PF' : 'PJ')
    setForm({
      razao_social: f.razao_social || '',
      nome_fantasia: f.nome_fantasia || '',
      cnpj: formatCnpjCpf(f.cnpj || '', docTipo),
      tipo: docTipo,
      telefone: f.telefone ? formatTelefone(f.telefone) : '',
      email: f.email || '',
      responsavel: f.responsavel || '',
      pix: f.pix || '',
      categoria: f.categoria || '',
      empresa_id: f.empresa_id || '',
      endereco: f.endereco || '',
      banco: f.banco || '',
      agencia: f.agencia || '',
      conta: f.conta || ''
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.razao_social.trim()) {
      return toast(form.tipo === 'PJ' ? 'Informe a Razão Social (*)' : 'Informe o Nome Completo (*)', 'error')
    }

    const docDigits = (form.cnpj || '').replace(/\D/g, '')
    if (form.tipo === 'PF' && docDigits.length > 0 && docDigits.length !== 11) {
      return toast('CPF inválido. O CPF deve conter 11 dígitos.', 'error')
    }
    if (form.tipo === 'PJ' && docDigits.length > 0 && docDigits.length !== 14) {
      return toast('CNPJ inválido. O CNPJ deve conter 14 dígitos.', 'error')
    }

    setSaving(true)
    const payload = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.tipo === 'PJ' ? (form.nome_fantasia.trim() || null) : null,
      cnpj: form.cnpj.trim() || null,
      tipo: form.tipo,
      telefone: form.telefone.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      responsavel: form.responsavel.trim() || null,
      categoria: form.categoria.trim() || null,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      pix: form.pix.trim() || null,
      empresa_id: form.empresa_id || null,
      endereco: form.endereco.trim() || null,
      prazo_pagamento: editingFornecedor?.prazo_pagamento ?? 0
    }

    if (editingFornecedor) {
      const { error } = await supabase.from('fornecedores').update(payload).eq('id', editingFornecedor.id)
      if (error) {
        setSaving(false)
        return toast(`Não foi possível atualizar o fornecedor: ${error.message}`, 'error')
      }
      toast('Fornecedor atualizado com sucesso!', 'success')
    } else {
      const { error } = await supabase.from('fornecedores').insert(payload)
      if (error) {
        setSaving(false)
        return toast(`Não foi possível salvar o fornecedor: ${error.message}`, 'error')
      }
      toast('Fornecedor cadastrado com sucesso!', 'success')
    }

    setForm({
      razao_social: '', nome_fantasia: '', cnpj: '', tipo: 'PJ',
      telefone: '', email: '', responsavel: '', pix: '', categoria: '', empresa_id: '',
      endereco: '', banco: '', agencia: '', conta: ''
    })
    setEditingFornecedor(null)
    setShowForm(false)
    setSaving(false)
    await load()
  }

  const remove = async (id: string, nome: string) => {
    if (!(await confirm('Excluir Fornecedor', `Deseja realmente remover o fornecedor "${nome}"? Esta ação removerá o vínculo com contas não lançadas.`, { confirmLabel: 'Excluir Fornecedor', confirmColor: C.red }))) return
    const { error } = await supabase.from('fornecedores').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    await load()
    toast('Fornecedor removido com sucesso.', 'success')
  }

  const empresasIds = colaboradorAtivo.empresas_ids?.length ? colaboradorAtivo.empresas_ids : (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])

  // Indexador O(1): pré-computa totais de contas por fornecedor
  const contasResumoMap = useMemo(() => {
    const map: Record<string, { totalEmAberto: number; totalPago: number; totalPagasCount: number; temVencidas: boolean }> = {}
    contasFornecedores.forEach(c => {
      if (!c.fornecedor_id) return
      if (!map[c.fornecedor_id]) {
        map[c.fornecedor_id] = { totalEmAberto: 0, totalPago: 0, totalPagasCount: 0, temVencidas: false }
      }
      const item = map[c.fornecedor_id]
      if (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal') {
        item.totalPago += Number(c.valor || 0)
        item.totalPagasCount += 1
      } else {
        item.totalEmAberto += Number(c.valor || 0)
      }
      if (isVencido(c.data_previsao || c.data_vencimento, c.status)) {
        item.temVencidas = true
      }
    })
    return map
  }, [contasFornecedores])

  // KPIs
  const totalFornecedores = fornecedores.length
  const totalPJ = fornecedores.filter(f => f.tipo !== 'PF').length
  const totalPF = fornecedores.filter(f => f.tipo === 'PF').length
  const totalGeralEmAberto = useMemo(() => Object.values(contasResumoMap).reduce((acc, curr) => acc + curr.totalEmAberto, 0), [contasResumoMap])
  const totalGeralPago = useMemo(() => Object.values(contasResumoMap).reduce((acc, curr) => acc + curr.totalPago, 0), [contasResumoMap])

  const filtered = useMemo(() =>
    fornecedores.filter(f => {
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        if (f.empresa_id && !empresasIds.includes(f.empresa_id)) {
          return false
        }
      }

      const resumo = contasResumoMap[f.id] || { totalEmAberto: 0, totalPago: 0, totalPagasCount: 0, temVencidas: false }

      if (filtroTipo === 'PJ' && f.tipo === 'PF') return false
      if (filtroTipo === 'PF' && f.tipo !== 'PF') return false
      if (filtroTipo === 'aberto' && resumo.totalEmAberto <= 0) return false
      if (filtroTipo === 'vencidas' && !resumo.temVencidas) return false

      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        f.razao_social.toLowerCase().includes(q) ||
        (f.nome_fantasia ?? '').toLowerCase().includes(q) ||
        (f.categoria ?? '').toLowerCase().includes(q) ||
        (f.responsavel ?? '').toLowerCase().includes(q) ||
        (f.cnpj ?? '').includes(search)
      )
    })
  , [fornecedores, search, filtroTipo, colaboradorAtivo, empresasIds, contasResumoMap])

  const temAbaFornecedores = permissaoAtiva?.abas_financeiro ? permissaoAtiva.abas_financeiro.split(',').map(a => a.trim()).includes('fornecedores') : false
  const podeCriar = Boolean(permissaoAtiva?.pode_fornecedores || temAbaFornecedores || colaboradorAtivo.cargo === 'admin_geral')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── CABEÇALHO DA SEÇÃO DE FORNECEDORES ──────────────────────── */}
      <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} color={C.amber} />
              </div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Gestão de Fornecedores & Prestadores
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.inkSoft }}>
              Cadastro unificado de fornecedores (PJ/PF), chaves PIX, domicílio bancário e monitoramento de contas correntes.
            </p>
          </div>

          {podeCriar && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={abrirNovoForm}
              style={{
                ...btn(C.amber),
                fontSize: 11.5,
                fontWeight: 900,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              {showForm ? 'Fechar Formulário' : 'Novo Fornecedor'}
            </motion.button>
          )}
        </div>

        {/* ─── FORMULÁRIO DE CADASTRO / EDIÇÃO RÁPIDA ────────────────── */}
        {showForm && !editingFornecedor && podeCriar && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={save}
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} color={C.amber} /> Cadastrar Fornecedor
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>
                {form.tipo === 'PJ' ? 'Pessoa Jurídica (CNPJ)' : 'Pessoa Física (CPF)'}
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={label}>Tipo de Registro</label>
                <select style={input} value={form.tipo} onChange={e => {
                  const novoTipo = e.target.value as 'PJ'|'PF'
                  setForm(f => ({ ...f, tipo: novoTipo, cnpj: formatCnpjCpf(f.cnpj, novoTipo) }))
                }}>
                  <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                  <option value="PF">Pessoa Física (CPF)</option>
                </select>
              </div>
              <div>
                <label style={label}>{form.tipo === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
                <input style={input} value={form.razao_social} onChange={e => setForm(prev => ({ ...prev, razao_social: e.target.value }))} placeholder={form.tipo === 'PJ' ? "Ex: Construtora & Materiais Ltda" : "Ex: Carlos Eduardo"} required />
              </div>
              {form.tipo === 'PJ' && (
                <div>
                  <label style={label}>Nome Fantasia</label>
                  <input style={input} value={form.nome_fantasia} onChange={e => setForm(prev => ({ ...prev, nome_fantasia: e.target.value }))} placeholder="Ex: Cimento Forte" />
                </div>
              )}
              <div>
                <label style={label}>{form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</label>
                <input style={input} value={form.cnpj} onChange={e => setForm(prev => ({ ...prev, cnpj: formatCnpjCpf(e.target.value, prev.tipo) }))} placeholder={form.tipo === 'PJ' ? "00.000.000/0000-00" : "000.000.000-00"} />
              </div>
              <div>
                <label style={label}>Telefone / WhatsApp</label>
                <input style={input} value={form.telefone} onChange={e => setForm(prev => ({ ...prev, telefone: formatTelefone(e.target.value) }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label style={label}>E-mail Comercial</label>
                <input style={input} type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="financeiro@fornecedor.com.br" />
              </div>
              <div>
                <label style={label}>Contato Responsável</label>
                <input style={input} value={form.responsavel} onChange={e => setForm(prev => ({ ...prev, responsavel: e.target.value }))} placeholder="Ex: Ricardo Silva" />
              </div>
              <div>
                <label style={label}>Categoria de Fornecimento</label>
                <input style={input} value={form.categoria} onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value }))} placeholder="Ex: Concreto, Aço, Locação" />
              </div>
              <div>
                <label style={label}>Chave PIX</label>
                <input style={input} value={form.pix} onChange={e => setForm(prev => ({ ...prev, pix: e.target.value }))} placeholder="CNPJ, CPF, E-mail, Celular ou Aleatória" />
              </div>
              <div>
                <label style={label}>Banco</label>
                <input style={input} value={form.banco} onChange={e => setForm(prev => ({ ...prev, banco: e.target.value }))} placeholder="Ex: Itaú (341)" />
              </div>
              <div>
                <label style={label}>Agência</label>
                <input style={input} value={form.agencia} onChange={e => setForm(prev => ({ ...prev, agencia: e.target.value }))} placeholder="0001" />
              </div>
              <div>
                <label style={label}>Conta Corrente</label>
                <input style={input} value={form.conta} onChange={e => setForm(prev => ({ ...prev, conta: e.target.value }))} placeholder="12345-6" />
              </div>
              <div>
                <label style={label}>Empresa Vinculada</label>
                <select style={input} value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}>
                  <option value="">Compartilhado entre todas</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Endereço Completo</label>
                <input style={input} value={form.endereco} onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))} placeholder="Rua, Número, Bairro, Cidade/UF - CEP" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <button type="button" style={btnGhost} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ ...btn(C.amber), fontWeight: 900 }}>
                {saving ? 'Cadastrando...' : 'Salvar Fornecedor'}
              </button>
            </div>
          </motion.form>
        )}

        {/* ─── 4 CARDS DE KPIS EXECUTIVOS ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={14} color={C.amber} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total de Fornecedores</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginTop: 2 }}>{totalFornecedores}</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Parceiros cadastrados</span>
          </div>

          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={14} color="#3B82F6" />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Entidades PJ / PF</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: '#3B82F6', marginTop: 2 }}>{totalPJ} PJ · {totalPF} PF</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Empresas vs Autônomos</span>
          </div>

          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={14} color="#EF4444" />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total em Aberto</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: totalGeralEmAberto > 0 ? '#EF4444' : C.ink, marginTop: 2 }}>{fmt(totalGeralEmAberto)}</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Contas pendentes de liquidação</span>
          </div>

          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={14} color="#10B981" />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total Liquidado</span>
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: '#10B981', marginTop: 2 }}>{fmt(totalGeralPago)}</strong>
            <span style={{ fontSize: 9.5, color: C.inkSoft }}>Volume faturado e pago</span>
          </div>
        </div>

        {/* ─── BARRA DE PESQUISA & FILTROS INTELIGENTES ───────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                style={{ ...input, paddingLeft: 32, fontSize: 11 }}
                placeholder="Buscar fornecedor por Razão Social, Nome Fantasia, CNPJ/CPF, Categoria ou Responsável..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
              {filtered.length} {filtered.length === 1 ? 'fornecedor listado' : 'fornecedores listados'}
            </span>
          </div>

          {/* Filtros Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFiltroTipo('todos')}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                background: filtroTipo === 'todos' ? C.amber : C.bgCard,
                color: filtroTipo === 'todos' ? '#0B0C0E' : C.inkSoft
              }}
            >
              Todos ({totalFornecedores})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('PJ')}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                background: filtroTipo === 'PJ' ? 'rgba(59, 130, 246, 0.2)' : C.bgCard,
                color: filtroTipo === 'PJ' ? '#60A5FA' : C.inkSoft,
                borderColor: filtroTipo === 'PJ' ? '#3B82F655' : C.border
              }}
            >
              Empresas (PJ) ({totalPJ})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('PF')}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                background: filtroTipo === 'PF' ? 'rgba(245, 158, 11, 0.2)' : C.bgCard,
                color: filtroTipo === 'PF' ? C.amber : C.inkSoft,
                borderColor: filtroTipo === 'PF' ? `${C.amber}55` : C.border
              }}
            >
              Pessoa Física (PF) ({totalPF})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('aberto')}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                background: filtroTipo === 'aberto' ? 'rgba(245, 158, 11, 0.2)' : C.bgCard,
                color: filtroTipo === 'aberto' ? C.amber : C.inkSoft,
                borderColor: filtroTipo === 'aberto' ? `${C.amber}55` : C.border
              }}
            >
              Com Saldo em Aberto
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('vencidas')}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: `1px solid ${C.border}`,
                background: filtroTipo === 'vencidas' ? 'rgba(239, 68, 68, 0.2)' : C.bgCard,
                color: filtroTipo === 'vencidas' ? '#F87171' : C.inkSoft,
                borderColor: filtroTipo === 'vencidas' ? '#EF444455' : C.border
              }}
            >
              Com Contas Vencidas
            </button>
          </div>
        </div>

        {/* ─── LISTAGEM EXECUTIVA DE FORNECEDORES ────────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.inkSoft, fontSize: 12 }}>Carregando dados de fornecedores...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.inkSoft, fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 8 }}>
            Nenhum fornecedor encontrado com os critérios pesquisados.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {filtered.map(f => {
              const resumo = contasResumoMap[f.id] || { totalEmAberto: 0, totalPago: 0, totalPagasCount: 0, temVencidas: false }
              const { totalEmAberto, totalPago, totalPagasCount, temVencidas: temContasVencidas } = resumo
              const docLabel = f.tipo === 'PF' ? 'CPF' : 'CNPJ'
              const isPJ = f.tipo !== 'PF'

              return (
                <div
                  key={f.id}
                  style={{
                    background: C.bgPanel,
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${temContasVencidas ? '#EF4444' : totalEmAberto > 0 ? C.amber : '#10B981'}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Card Top */}
                  <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 6, background: isPJ ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${isPJ ? 'rgba(59, 130, 246, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          {isPJ ? <Building2 size={17} color="#3B82F6" /> : <User size={17} color={C.amber} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              {f.razao_social || f.nome_fantasia}
                            </h3>
                          </div>
                          {f.nome_fantasia && (
                            <p style={{ margin: '2px 0 0', fontSize: 10.5, color: C.inkSoft }}>{f.nome_fantasia}</p>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, background: isPJ ? 'rgba(59, 130, 246, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: isPJ ? '#60A5FA' : C.amber, border: `1px solid ${isPJ ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`, textTransform: 'uppercase' }}>
                              {isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}
                            </span>
                            {f.categoria && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: C.bgCard, color: C.inkSoft, border: `1px solid ${C.border}` }}>
                                {f.categoria}
                              </span>
                            )}
                            {temContasVencidas && (
                              <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={10} /> Contas Vencidas
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {podeCriar && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            onClick={() => iniciarEdicaoFornecedor(f)}
                            title="Editar Fornecedor"
                            style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft, padding: 4 }}
                            className="hover:text-amber-500"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => remove(f.id, f.razao_social || f.nome_fantasia || 'Fornecedor')}
                            title="Excluir Fornecedor"
                            style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft, padding: 4 }}
                            className="hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Financial Bar */}
                  <div style={{ padding: '10px 18px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Em Aberto</span>
                      <strong style={{ fontSize: 13, color: temContasVencidas ? '#EF4444' : totalEmAberto > 0 ? C.amber : C.ink, fontWeight: 900 }}>
                        {fmt(totalEmAberto)}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Total Liquidado ({totalPagasCount})</span>
                      <strong style={{ fontSize: 13, color: '#10B981', fontWeight: 900 }}>
                        {fmt(totalPago)}
                      </strong>
                    </div>
                  </div>

                  {/* Card Metadata Details */}
                  <div style={{ padding: '14px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.inkSoft }}>
                      <FileText size={12} color={C.amber} />
                      <span>{docLabel}: <strong style={{ color: C.ink }}>{f.cnpj || 'Não informado'}</strong></span>
                    </div>

                    {(f.telefone || f.email || f.responsavel) && (
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: C.inkSoft }}>
                        {f.telefone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Phone size={12} color={C.amber} /> {f.telefone}
                          </div>
                        )}
                        {f.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Mail size={12} color={C.amber} /> {f.email}
                          </div>
                        )}
                        {f.responsavel && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <User size={12} color={C.amber} /> {f.responsavel}
                          </div>
                        )}
                      </div>
                    )}

                    {(f.banco || f.pix || f.endereco) && (
                      <div style={{ background: C.bgCard, padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        {f.endereco && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.inkSoft }}>
                            <MapPin size={11} color={C.amber} /> <span>{f.endereco}</span>
                          </div>
                        )}
                        {f.banco && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.inkSoft }}>
                            <Landmark size={11} color={C.amber} />
                            <span>{f.banco} {f.agencia ? `· Ag: ${f.agencia}` : ''} {f.conta ? `· Cc: ${f.conta}` : ''}</span>
                          </div>
                        )}
                        {f.pix && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.inkSoft }}>
                            <DollarSign size={11} color={C.amber} />
                            <span>PIX: <strong style={{ color: C.amber }}>{f.pix}</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  {goToHistoricoByFornecedor && (
                    <div style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.15)', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
                      <button
                        style={{ ...btnGhost, flex: 1, fontSize: 10.5, fontWeight: 800, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: C.amber, borderColor: 'rgba(245, 158, 11, 0.35)' }}
                        onClick={() => goToHistoricoByFornecedor(f.id)}
                      >
                        <ArrowUpRight size={13} /> Ver Contas & Histórico
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL DE EDIÇÃO DE FORNECEDOR ───────────────────────────── */}
      <AnimatePresence>
        {editingFornecedor && podeCriar && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={16} color={C.amber} />
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: C.ink, margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Editar Fornecedor: {editingFornecedor.razao_social}
                  </h3>
                </div>
                <button onClick={() => setEditingFornecedor(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={label}>Tipo de Registro</label>
                    <select style={input} value={form.tipo} onChange={e => {
                      const novoTipo = e.target.value as 'PJ'|'PF'
                      setForm(f => ({ ...f, tipo: novoTipo, cnpj: formatCnpjCpf(f.cnpj, novoTipo) }))
                    }}>
                      <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                      <option value="PF">Pessoa Física (CPF)</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>{form.tipo === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
                    <input style={input} value={form.razao_social} onChange={e => setForm(prev => ({ ...prev, razao_social: e.target.value }))} required />
                  </div>
                  {form.tipo === 'PJ' && (
                    <div>
                      <label style={label}>Nome Fantasia</label>
                      <input style={input} value={form.nome_fantasia} onChange={e => setForm(prev => ({ ...prev, nome_fantasia: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label style={label}>{form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</label>
                    <input style={input} value={form.cnpj} onChange={e => setForm(prev => ({ ...prev, cnpj: formatCnpjCpf(e.target.value, prev.tipo) }))} />
                  </div>
                  <div>
                    <label style={label}>Telefone / WhatsApp</label>
                    <input style={input} value={form.telefone} onChange={e => setForm(prev => ({ ...prev, telefone: formatTelefone(e.target.value) }))} />
                  </div>
                  <div>
                    <label style={label}>E-mail Comercial</label>
                    <input style={input} type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Contato Responsável</label>
                    <input style={input} value={form.responsavel} onChange={e => setForm(prev => ({ ...prev, responsavel: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Categoria</label>
                    <input style={input} value={form.categoria} onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Chave PIX</label>
                    <input style={input} value={form.pix} onChange={e => setForm(prev => ({ ...prev, pix: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Banco</label>
                    <input style={input} value={form.banco} onChange={e => setForm(prev => ({ ...prev, banco: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Agência</label>
                    <input style={input} value={form.agencia} onChange={e => setForm(prev => ({ ...prev, agencia: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Conta Corrente</label>
                    <input style={input} value={form.conta} onChange={e => setForm(prev => ({ ...prev, conta: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Empresa Vinculada</label>
                    <select style={input} value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}>
                      <option value="">Compartilhado entre todas</option>
                      {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Endereço Completo</label>
                    <input style={input} value={form.endereco} onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <button type="button" style={btnGhost} onClick={() => setEditingFornecedor(null)} disabled={saving}>Cancelar</button>
                  <button type="submit" style={{ ...btn(C.amber), fontWeight: 900 }} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: LANÇAR CONTA
// ════════════════════════════════════════════════════════
function ContasTab({ colaboradorAtivo, permissaoAtiva, colaboradores = [] }: TabProps) {
  const [empresas, setEmpresas]         = useState<Empresa[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [obras, setObras]               = useState<Obra[]>([])
  const [saving, setSaving]             = useState(false)
  const [ok, setOk]                     = useState(false)
  const [anexoFiles, setAnexoFiles]     = useState<File[]>([])
  const [showNovoFornModal, setShowNovoFornModal] = useState(false)
  const [salvandoForn, setSalvandoForn] = useState(false)
  const [fornForm, setFornForm]         = useState({ razao_social: '', nome_fantasia: '', cnpj: '', tipo: 'PJ' as 'PJ'|'PF', pix: '', categoria: '' })

  const salvarNovoFornecedorRapido = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fornForm.razao_social.trim()) return toast('Informe a Razão Social / Nome (*)', 'error')
    setSalvandoForn(true)
    const payload = {
      razao_social: fornForm.razao_social.trim(),
      nome_fantasia: fornForm.tipo === 'PJ' ? (fornForm.nome_fantasia.trim() || null) : null,
      cnpj: fornForm.cnpj.trim() || null,
      tipo: fornForm.tipo,
      pix: fornForm.pix.trim() || null,
      categoria: fornForm.categoria.trim() || null,
    }
    const { data, error } = await supabase.from('fornecedores').insert(payload).select().single()
    setSalvandoForn(false)
    if (error) return toast(`Erro ao salvar fornecedor: ${error.message}`, 'error')
    toast('Fornecedor cadastrado com sucesso!', 'success')
    setShowNovoFornModal(false)
    setFornForm({ razao_social: '', nome_fantasia: '', cnpj: '', tipo: 'PJ', pix: '', categoria: '' })
    // Reload fornecedores e seleciona o novo
    const { data: listF } = await supabase.from('fornecedores').select('*').order('razao_social')
    setFornecedores(listF || [])
    if (data) setForm(f => ({ ...f, possui_fornecedor: true, fornecedor_id: data.id }))
  }

  const [form, setForm] = useState({
    tipo: 'pagar' as 'pagar'|'receber',
    empresa_id: '',
    fornecedor_id: '',
    obra_id: '',
    categoria: '',
    descricao: '',
    valor: '',
    data_previsao: '',
    data_vencimento: '',
    possui_fornecedor: false,
    observacoes: '',
    recorrencia: 'unico' as 'unico'|'mensal'|'semanal',
    is_privada: false,
    usuarios_permitidos: [] as string[],
  })

  const load = useCallback(() => {
    let qE = supabase.from('empresas').select('*').order('razao_social')
    let qF = supabase.from('fornecedores').select('*').order('razao_social')
    let qO = supabase.from('obras').select('*').order('nome')
    
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qE = qE.in('id', ids)
        qF = qF.or(`empresa_id.in.(${ids.join(',')}),empresa_id.is.null`)
      }
    }

    Promise.all([qE, qF, qO]).then(([{ data: e }, { data: f }, { data: o }]) => {
      setEmpresas(e ?? [])
      setFornecedores(f ?? [])
      
      let oList = o ?? []
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        const oIds = colaboradorAtivo.obras_ids || []
        oList = oList.filter(ob => oIds.includes(ob.id))
      }
      setObras(oList)
    })
  }, [colaboradorAtivo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    if (ids.length === 1) {
      setForm(f => ({ ...f, empresa_id: ids[0] }))
    }
  }, [colaboradorAtivo])

  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const dataBase = form.tipo === 'pagar' ? form.data_vencimento : form.data_previsao
    if (!form.empresa_id || !form.descricao || !form.valor || !dataBase) {
      toast('Preencha todos os campos obrigatórios (*)', 'error')
      return
    }
    setSaving(true)

    // Upload real de múltiplos comprovantes/documentos para o Supabase Storage
    let comprovanteUrl: string | null = null
    if (anexoFiles.length > 0) {
      const urls: string[] = []
      for (const file of anexoFiles) {
        const ext = file.name.split('.').pop()
        const fileName = `comprovante_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
        const uploadPath = form.empresa_id ? `${form.empresa_id}/${fileName}` : fileName
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('comprovantes')
          .upload(uploadPath, file, { upsert: true })
        if (!uploadErr && uploadData?.path) {
          const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(uploadData.path)
          urls.push(publicUrl)
        }
      }
      if (urls.length > 0) {
        comprovanteUrl = JSON.stringify(urls)
      }
    }

    const valorNum = parseCurrency(form.valor)
    
    // Limite fixo de autoliberação: R$ 30.000
    const limiteAprovacao = 30000
    
    let statusInicial: 'Lançado' | 'Bloqueado' = 'Lançado'
    if (form.tipo === 'pagar' && valorNum > limiteAprovacao) {
      statusInicial = 'Bloqueado'
    }

    const parcelas = []
    const vencimentoBase = new Date(dataBase + 'T00:00:00')
    const totalParcelas = form.recorrencia === 'mensal' ? 12 : form.recorrencia === 'semanal' ? 4 : 1

    for (let i = 0; i < totalParcelas; i++) {
      const dataParcela = new Date(vencimentoBase)
      if (form.recorrencia === 'mensal') {
        dataParcela.setMonth(vencimentoBase.getMonth() + i)
      } else if (form.recorrencia === 'semanal') {
        dataParcela.setDate(vencimentoBase.getDate() + (i * 7))
      }

      const isoDateString = dataParcela.toISOString().split('T')[0]

      parcelas.push({
        empresa_id: form.empresa_id,
        tipo: form.tipo,
        descricao: form.recorrencia !== 'unico' ? `${form.descricao} (${i + 1}/${totalParcelas})` : form.descricao,
        valor: valorNum,
        data_previsao: isoDateString,
        data_vencimento: isoDateString,
        status: statusInicial,
        recorrencia: form.recorrencia,
        fornecedor_id: form.possui_fornecedor ? (form.fornecedor_id || null) : null,
        possui_fornecedor: form.possui_fornecedor,
        observacoes: form.observacoes || null,
        pagamento_antecipado: false,
        tipo_antecipacao: null,
        valor_antecipado: null,
        data_antecipacao: null,
        justificativa_antecipacao: null,
        obra_id: form.obra_id || null,
        categoria: form.categoria || null,
        comprovante_url: comprovanteUrl,
        is_privada: form.is_privada,
        usuarios_permitidos: form.is_privada ? Array.from(new Set([...form.usuarios_permitidos, colaboradorAtivo.id])) : [],
        criado_por: colaboradorAtivo.nome,
        historico_negociacao: [{
          id: Date.now().toString(),
          data: new Date().toISOString(),
          autor: colaboradorAtivo.nome || 'Usuário',
          tipo: 'alteracao_status',
          descricao: `Lançamento cadastrado no sistema com status "${statusInicial}"`
        }]
      })
    }

    const { error: insertError } = await supabase.from('contas').insert(parcelas)
    if (insertError) {
      setSaving(false)
      return toast(`Não foi possível lançar a conta: ${insertError.message}`, 'error')
    }

    setSaving(false)
    setOk(true)
    setAnexoFiles([])
    setTimeout(() => setOk(false), 4000)
    
    setForm({
      tipo: form.tipo,
      empresa_id: colaboradorAtivo.cargo === 'admin_empresa' ? colaboradorAtivo.empresa_id! : '',
      fornecedor_id: '',
      obra_id: '',
      categoria: '',
      descricao: '',
      valor: '',
      data_previsao: '',
      data_vencimento: '',
      possui_fornecedor: false,
      observacoes: '',
      recorrencia: 'unico',
      is_privada: false,
      usuarios_permitidos: []
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setAnexoFiles(prev => [...prev, ...newFiles])
      e.target.value = ''
    }
  }

  const removeAnexoFile = (index: number) => {
    setAnexoFiles(prev => prev.filter((_, i) => i !== index))
  }

  const podeRegistrar = permissaoAtiva?.pode_lancar

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── CABEÇALHO DO LANÇAMENTO ──────────────────────────────────── */}
      <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={18} color={C.amber} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Novo Lançamento Financeiro
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: C.inkSoft }}>
                Registro de títulos a pagar, contas a receber, notas fiscais e anexação de comprovantes.
              </p>
            </div>
          </div>
        </div>

        {!podeRegistrar ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, padding: 20, color: C.inkSoft, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Shield size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#EF4444', display: 'block', fontSize: 13, marginBottom: 4 }}>Acesso Restrito</strong>
              Seu perfil de acesso atual não possui permissões administrativas para registrar novos lançamentos financeiros ou despesas.
            </div>
          </div>
        ) : (
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Mensagem de Sucesso */}
            {ok && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, padding: '14px 18px', color: '#10B981', fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <CheckCircle2 size={16} /> Lançamento financeiro registrado e indexado com sucesso no sistema!
              </motion.div>
            )}

            {/* ── SELETOR DUAL: A PAGAR vs A RECEBER ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: 'pagar' }))}
                style={{
                  padding: '14px 18px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: 12,
                  border: `1.5px solid ${form.tipo === 'pagar' ? '#EF4444' : C.border}`,
                  background: form.tipo === 'pagar' ? 'rgba(239, 68, 68, 0.1)' : C.bgCard,
                  color: form.tipo === 'pagar' ? '#F87171' : C.inkSoft,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowDownRight size={16} strokeWidth={2.5} />
                Conta a Pagar (Despesa / Saída)
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: 'receber' }))}
                style={{
                  padding: '14px 18px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: 12,
                  border: `1.5px solid ${form.tipo === 'receber' ? '#10B981' : C.border}`,
                  background: form.tipo === 'receber' ? 'rgba(16, 185, 129, 0.1)' : C.bgCard,
                  color: form.tipo === 'receber' ? '#34D399' : C.inkSoft,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowUpRight size={16} strokeWidth={2.5} />
                Conta a Receber (Receita / Entrada)
              </button>
            </div>

            {/* ── SEÇÃO 1: ENTIDADES & VÍNCULOS CORPORATIVOS ── */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <Building2 size={13} color={C.amber} /> 1. Entidades & Vínculos Corporativos
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <label style={label}>Empresa Pagadora / Receptora *</label>
                  <select
                    style={input}
                    disabled={(() => {
                      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                      return ids.length === 1
                    })()}
                    value={form.empresa_id}
                    onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecione a empresa</option>
                    {empresas.filter(e => {
                      if (colaboradorAtivo.cargo === 'admin_geral') return true
                      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                      return ids.length === 0 || ids.includes(e.id)
                    }).map((e: any) => (
                      <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={label}>Obra / Centro de Custo Vinculado</label>
                  <select style={input} value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}>
                    {(() => {
                      const temGeral = colaboradorAtivo.cargo === 'admin_geral' || (colaboradorAtivo.obras_ids || []).includes('geral') || obras.some(o => o.id === 'geral')
                      const dbObras = obras.filter(o => o.id !== 'geral')
                      return (
                        <>
                          {temGeral ? (
                            <option value="">Geral / Administrativo</option>
                          ) : (
                            <option value="">Selecione a Obra</option>
                          )}
                          {dbObras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </>
                      )
                    })()}
                  </select>
                </div>

                <div>
                  <label style={label}>Categoria Financeira</label>
                  <select style={input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Selecione a categoria</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Vínculo de Fornecedor / Favorecido */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, background: C.bgPanel, padding: '12px 14px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={form.possui_fornecedor}
                      onChange={e => setForm(f => ({ ...f, possui_fornecedor: e.target.checked, fornecedor_id: e.target.checked ? f.fornecedor_id : '' }))}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 800, color: form.possui_fornecedor ? C.ink : C.inkSoft }}>
                      Vincular Fornecedor / Prestador de Serviço
                    </span>
                  </label>

                  {form.possui_fornecedor && permissaoAtiva?.pode_fornecedores && (
                    <button
                      type="button"
                      onClick={() => setShowNovoFornModal(true)}
                      style={{ background: 'none', border: 'none', color: C.amber, fontSize: 10.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                    >
                      <Plus size={12} /> Cadastrar Novo Fornecedor Rápido
                    </button>
                  )}
                </div>

                {form.possui_fornecedor && (
                  <select
                    style={{ ...input, background: C.bgCard }}
                    value={form.fornecedor_id}
                    onChange={e => setForm(f => ({ ...f, fornecedor_id: e.target.value }))}
                  >
                    <option value="">Selecione o fornecedor / prestador</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia} {f.cnpj ? `(${f.cnpj})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* ── SEÇÃO 2: DADOS DO TÍTULO & CONDIÇÕES FINANCEIRAS ── */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <DollarSign size={13} color={C.amber} /> 2. Dados do Título & Valores
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label}>Descrição do Lançamento ou Referência NF *</label>
                  <input
                    style={input}
                    value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex: Fornecimento de Aço CA-50 10mm - NF 004829"
                    required
                  />
                </div>

                <div>
                  <label style={label}>Valor do Título (R$) *</label>
                  <input
                    style={{ ...input, fontWeight: 800, fontSize: 13, color: form.tipo === 'pagar' ? '#F87171' : '#34D399' }}
                    type="text"
                    inputMode="decimal"
                    value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div>
                  <label style={label}>{form.tipo === 'pagar' ? 'Data de Vencimento *' : 'Data de Previsão *'}</label>
                  <input
                    style={input}
                    type="date"
                    value={form.tipo === 'pagar' ? form.data_vencimento : form.data_previsao}
                    onChange={e => form.tipo === 'pagar' ? setForm(f => ({ ...f, data_vencimento: e.target.value })) : setForm(f => ({ ...f, data_previsao: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label style={label}>Recorrência / Parcelamento</label>
                  <select style={input} value={form.recorrencia} onChange={e => setForm(f => ({ ...f, recorrencia: e.target.value as any }))}>
                    <option value="unico">Parcela Única</option>
                    <option value="mensal">Mensal Recorrente (12 parcelas)</option>
                    <option value="semanal">Semanal Recorrente (4 parcelas)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={label}>Observações Internas / Justificativa</label>
                <textarea
                  style={{ ...input, resize: 'vertical' }}
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Informações adicionais para conferência, dados de medição ou instruções bancárias..."
                />
              </div>
            </div>

            {/* ── SEÇÃO 3: DOCUMENTAÇÃO & CONFIDENCIALIDADE ── */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <Paperclip size={13} color={C.amber} /> 3. Documentação, Anexos & Segurança
              </div>

              {/* Upload Dropzone */}
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: 16, background: C.bgPanel, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.ink, display: 'block' }}>Anexar Boletos, Notas Fiscais e Comprovantes</span>
                    <span style={{ fontSize: 10, color: C.inkSoft }}>Formatos aceitos: PDF, Imagens (PNG/JPG), XML, Excel e Documentos.</span>
                  </div>

                  <label style={{ ...btn(C.amber), cursor: 'pointer', padding: '6px 14px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Upload size={13} />
                    Selecionar Arquivos
                    <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                  </label>
                </div>

                {anexoFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {anexoFiles.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 11,
                          color: '#34D399',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          padding: '6px 12px',
                          borderRadius: 6
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <CheckCircle2 size={13} color="#10B981" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAnexoFile(idx)}
                          style={{ all: 'unset', color: '#EF4444', cursor: 'pointer', padding: 2 }}
                          title="Remover este arquivo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lançamento Confidencial */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  background: form.is_privada ? 'rgba(245, 158, 11, 0.08)' : C.bgPanel,
                  border: `1px solid ${form.is_privada ? 'rgba(245, 158, 11, 0.35)' : C.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setForm(f => ({ ...f, is_privada: !f.is_privada }))}
              >
                <div style={{ width: 18, height: 18, border: `1.5px solid ${form.is_privada ? C.amber : C.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: form.is_privada ? C.amber : 'transparent', flexShrink: 0 }}>
                  {form.is_privada && <Check size={13} color="#0B0C0E" strokeWidth={3} />}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: form.is_privada ? C.amber : C.ink, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    <Shield size={14} /> Lançamento Confidencial / Sigiloso
                  </span>
                  <span style={{ fontSize: 10, color: C.inkSoft, display: 'block', marginTop: 2 }}>
                    Apenas o Administrador Geral e os colaboradores selecionados terão visibilidade deste lançamento.
                  </span>
                </div>
              </div>

              {form.is_privada && (
                <div style={{ background: C.bgPanel, padding: 14, borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  <span style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase' }}>Colaboradores com acesso autorizado:</span>
                  {colaboradores.map(colab => {
                    const isPermitido = (form.usuarios_permitidos || []).includes(colab.id);
                    const isAdmin = colab.cargo === 'admin_geral';
                    return (
                      <label key={colab.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: isPermitido || isAdmin ? 'rgba(52, 211, 153, 0.08)' : 'transparent', border: `1px solid ${isPermitido || isAdmin ? 'rgba(52, 211, 153, 0.25)' : 'transparent'}`, cursor: isAdmin ? 'not-allowed' : 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={isPermitido || isAdmin} 
                          disabled={isAdmin}
                          onChange={() => {
                            if (isAdmin) return
                            setForm(f => {
                              const atuais = f.usuarios_permitidos || []
                              return { ...f, usuarios_permitidos: atuais.includes(colab.id) ? atuais.filter(x => x !== colab.id) : [...atuais, colab.id] }
                            })
                          }} 
                        />
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isPermitido || isAdmin ? '#34D399' : C.ink }}>{colab.nome}</span>
                          <span style={{ fontSize: 10, color: C.inkSoft }}>({colab.cargo.replace('_', ' ')})</span>
                          {isAdmin && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.amber }}>(Acesso permanente)</span>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Aviso de Alçada de Aprovação */}
              {form.tipo === 'pagar' && form.valor && parseCurrency(form.valor) > 30000 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: C.amber, borderRadius: 6, padding: '10px 14px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} /> Lançamento com valor superior a R$ 30.000,00 será registrado com status inicial "Bloqueado", exigindo liberação de Diretoria.
                </div>
              )}
            </div>

            {/* ── BOTÃO DE SUBMISSÃO ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={saving}
                style={{
                  ...btn(C.amber),
                  padding: '10px 24px',
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {saving ? (
                  <>Registrando Lançamento...</>
                ) : (
                  <>
                    <Plus size={15} strokeWidth={2.5} />
                    Confirmar Lançamento Financeiro
                  </>
                )}
              </motion.button>
            </div>
          </form>
        )}
      </div>

      {/* ── MODAL CADASTRAR NOVO FORNECEDOR RÁPIDO ───────────────────── */}
      <AnimatePresence>
        {showNovoFornModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 12px 36px rgba(0,0,0,0.5)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color={C.amber} />
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: C.ink, margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>Cadastrar Novo Fornecedor</h3>
                </div>
                <button onClick={() => setShowNovoFornModal(false)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={salvarNovoFornecedorRapido} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setFornForm(f => ({ ...f, tipo: 'PJ' }))}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: `1px solid ${fornForm.tipo === 'PJ' ? C.amber : C.border}`, background: fornForm.tipo === 'PJ' ? 'rgba(245, 158, 11, 0.12)' : 'none', color: fornForm.tipo === 'PJ' ? C.amber : C.inkSoft }}
                  >Pessoa Jurídica (PJ)</button>
                  <button
                    type="button"
                    onClick={() => setFornForm(f => ({ ...f, tipo: 'PF' }))}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: `1px solid ${fornForm.tipo === 'PF' ? C.amber : C.border}`, background: fornForm.tipo === 'PF' ? 'rgba(245, 158, 11, 0.12)' : 'none', color: fornForm.tipo === 'PF' ? C.amber : C.inkSoft }}
                  >Pessoa Física (PF)</button>
                </div>

                <div>
                  <label style={label}>{fornForm.tipo === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
                  <input style={input} value={fornForm.razao_social} onChange={e => setFornForm({ ...fornForm, razao_social: e.target.value })} placeholder={fornForm.tipo === 'PJ' ? 'Ex: Fornecedor Cimentos LTDA' : 'Ex: João da Silva'} required />
                </div>

                {fornForm.tipo === 'PJ' && (
                  <div>
                    <label style={label}>Nome Fantasia</label>
                    <input style={input} value={fornForm.nome_fantasia} onChange={e => setFornForm({ ...fornForm, nome_fantasia: e.target.value })} placeholder="Ex: Cimentos Brasil" />
                  </div>
                )}

                <div>
                  <label style={label}>{fornForm.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</label>
                  <input style={input} value={fornForm.cnpj} onChange={e => setFornForm({ ...fornForm, cnpj: formatCnpjCpf(e.target.value, fornForm.tipo) })} placeholder={fornForm.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Chave PIX</label>
                    <input style={input} value={fornForm.pix} onChange={e => setFornForm({ ...fornForm, pix: e.target.value })} placeholder="Chave PIX" />
                  </div>
                  <div>
                    <label style={label}>Categoria</label>
                    <input style={input} value={fornForm.categoria} onChange={e => setFornForm({ ...fornForm, categoria: e.target.value })} placeholder="Ex: Materiais, Serviços..." />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <button type="button" onClick={() => setShowNovoFornModal(false)} style={btnGhost}>Cancelar</button>
                  <button type="submit" disabled={salvandoForn} style={{ ...btn(C.amber), fontWeight: 900 }}>{salvandoForn ? 'Cadastrando...' : 'Cadastrar Fornecedor'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: CONTAS / HISTÓRICO
// ════════════════════════════════════════════════════════
function HistoricoTab({ colaboradorAtivo, permissaoAtiva, confirm, prompt, initialFornecedorId, colaboradores = [] }: TabProps) {
  const [contas, setContas]     = useState<ContaComRelacoes[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtEmpresa, setFiltEmpresa] = useState('')
  const [filtObra, setFiltObra] = useState('')
  const [filtFornecedor, setFiltFornecedor] = useState(initialFornecedorId || '')
  const [filtTipo, setFiltTipo]       = useState<'todos'|'pagar'|'receber'>('todos')
  const [filtStatus, setFiltStatus]   = useState<'todos'|'Lançado'|'Bloqueado'|'Aguardando aprovação'|'Liberado/OK'|'A pagar'|'Pago Parcial'|'Pago'|'Pago sem Nota Fiscal'|'Negado'>('todos')
  const [filtDataInicio, setFiltDataInicio] = useState('')
  const [filtDataFim, setFiltDataFim] = useState('')
  const [filtTipoData, setFiltTipoData] = useState<'previsao_vencimento' | 'vencimento' | 'previsao' | 'pago_em' | 'created_at'>('previsao_vencimento')
  const [filtValorMin, setFiltValorMin] = useState('')
  const [filtValorMax, setFiltValorMax] = useState('')
  const [filtOrdem, setFiltOrdem] = useState<'novo' | 'antigo' | 'pago_recente' | 'pago_antigo' | 'venc_prox' | 'venc_dist' | 'maior_valor' | 'menor_valor' | 'az' | 'za'>('novo')
  const [search, setSearch]           = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [modoExportacao, setModoExportacao] = useState(false)
  const [modoSelecao, setModoSelecao] = useState(false)
  const [statusEmLote, setStatusEmLote] = useState<ContaComRelacoes['status'] | ''>('')
  const [aplicandoLote, setAplicandoLote] = useState(false)
  const [selecionadasContas, setSelecionadasContas] = useState<string[]>([])
  const [editandoConta, setEditandoConta] = useState<ContaComRelacoes | null>(null)
  const [formEdicao, setFormEdicao] = useState<Partial<ContaComRelacoes>>({})
  const [acessosContaPrivada, setAcessosContaPrivada] = useState<ContaComRelacoes | null>(null)


  const toggleContaSelecionada = (id: string) => {
    setSelecionadasContas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selecionarTodasContas = (lista: ContaComRelacoes[]) => {
    if (selecionadasContas.length === lista.length) {
      setSelecionadasContas([])
    } else {
      setSelecionadasContas(lista.map(c => c.id))
    }
  }

  const exportarContasCSV = (listaExportar: ContaComRelacoes[]) => {
    if (listaExportar.length === 0) return toast('Nenhum lançamento selecionado para exportar.', 'error')

    const headers = [
      'Código', 'ID', 'Tipo', 'Descrição', 'Empresa', 'Fornecedor', 'CNPJ/CPF Fornecedor',
      'PIX', 'Banco', 'Agência', 'Conta Bancária', 'Obra', 'Categoria',
      'Valor Original (R$)', 'Status', 'Data Vencimento/Previsao', 'Pago Em',
      'Criado Por', 'Aprovado Por', 'Observacoes'
    ]

    const rows = listaExportar.map(c => {
      const forn = c.fornecedor
      return [
        fmtCodigo(c) || `#${c.id.slice(0, 5)}`,
        c.id,
        c.tipo === 'pagar' ? 'Conta a Pagar' : 'Conta a Receber',
        `"${(c.descricao || '').replace(/"/g, '""')}"`,
        `"${(c.empresa?.nome_fantasia || c.empresa?.razao_social || '').replace(/"/g, '""')}"`,
        `"${(forn?.razao_social || forn?.nome_fantasia || 'Geral').replace(/"/g, '""')}"`,
        `"${forn?.cnpj || ''}"`,
        `"${forn?.pix || ''}"`,
        `"${forn?.banco || ''}"`,
        `"${forn?.agencia || ''}"`,
        `"${forn?.conta || ''}"`,
        `"${(c.obra?.nome || 'Geral').replace(/"/g, '""')}"`,
        `"${(c.categoria || '').replace(/"/g, '""')}"`,
        c.valor ? c.valor.toFixed(2).replace('.', ',') : '0,00',
        c.status,
        c.data_vencimento || c.data_previsao || '',
        c.pago_em ? new Date(c.pago_em).toLocaleDateString('pt-BR') : '',
        `"${(c.criado_por || '').replace(/"/g, '""')}"`,
        `"${(c.aprovado_por || '').replace(/"/g, '""')}"`,
        `"${(c.observacoes || '').replace(/"/g, '""')}"`
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const qtd = listaExportar.length
    link.download = `relatorio_pagamentos_${qtd}_itens_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast(`${qtd} lançamento(s) exportado(s) com sucesso!`, 'success')
  }

  const [expandedContaId, setExpandedContaId] = useState<string | null>(null)
  const [formNegociacao, setFormNegociacao] = useState({
    tipo: 'observacao' as 'pagamento_parcial' | 'desconto' | 'prorrogacao' | 'observacao',
    descricao: '',
    valor_pago: '',
    valor_novo: '',
    nova_data: ''
  })
  const [savingNegociacao, setSavingNegociacao] = useState(false)

  const salvarNegociacao = async (conta: ContaComRelacoes) => {
    if (!formNegociacao.descricao.trim()) return toast('Informe uma descrição/observação do acordo ou pagamento.', 'error')

    if (formNegociacao.tipo === 'pagamento_parcial') {
      const val = Number(formNegociacao.valor_pago)
      if (isNaN(val) || val <= 0) {
        return toast('Informe o valor pago parcialmente (maior que zero).', 'error')
      }
    }
    if (formNegociacao.tipo === 'desconto') {
      const val = Number(formNegociacao.valor_novo)
      if (isNaN(val) || val < 0) {
        return toast('Informe o novo valor negociado.', 'error')
      }
    }
    if (formNegociacao.tipo === 'prorrogacao' && !formNegociacao.nova_data) {
      return toast('Informe a nova data prorrogada.', 'error')
    }

    setSavingNegociacao(true)
    try {
      const novoItem = {
        id: crypto.randomUUID(),
        data: new Date().toISOString(),
        autor: colaboradorAtivo.nome,
        tipo: formNegociacao.tipo,
        descricao: formNegociacao.descricao.trim(),
        valor_pago: formNegociacao.tipo === 'pagamento_parcial' ? Number(formNegociacao.valor_pago) : undefined,
        valor_novo: formNegociacao.tipo === 'desconto' ? Number(formNegociacao.valor_novo) : undefined,
        nova_data: formNegociacao.tipo === 'prorrogacao' ? formNegociacao.nova_data : undefined
      }

      const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
      const novoHistorico = [...historicoAtual, novoItem]

      const { error: dbError } = await supabase
        .from('contas')
        .update({ historico_negociacao: novoHistorico })
        .eq('id', conta.id)

      if (dbError) throw dbError

      toast(
        formNegociacao.tipo === 'pagamento_parcial' 
          ? 'Pagamento parcial registrado com sucesso!' 
          : 'Acordo / negociação salvo com sucesso!', 
        'success'
      )
      setFormNegociacao({ tipo: 'observacao', descricao: '', valor_pago: '', valor_novo: '', nova_data: '' })
      await load()
    } catch (err: any) {
      toast('Erro ao salvar negociação: ' + (err?.message || err), 'error')
    } finally {
      setSavingNegociacao(false)
    }
  }

  // ── Edição, Exclusão e Restauração de Valor Cheio das Negociações ──
  const [editingNegociacaoItem, setEditingNegociacaoItem] = useState<{ contaId: string; item: any } | null>(null)
  const [formEditNegociacao, setFormEditNegociacao] = useState({ tipo: 'observacao', descricao: '', valor_pago: '', valor_novo: '', nova_data: '' })
  const [savingEditNegociacao, setSavingEditNegociacao] = useState(false)

  const openEditNegociacao = (contaId: string, item: any) => {
    setEditingNegociacaoItem({ contaId, item })
    setFormEditNegociacao({
      tipo: item.tipo || 'observacao',
      descricao: item.descricao || '',
      valor_pago: item.valor_pago ? String(item.valor_pago) : '',
      valor_novo: item.valor_novo ? String(item.valor_novo) : '',
      nova_data: item.nova_data || ''
    })
  }

  const salvarEdicaoNegociacao = async () => {
    if (!editingNegociacaoItem) return
    const { contaId, item: targetItem } = editingNegociacaoItem
    const conta = contas.find(c => c.id === contaId)
    if (!conta) return

    setSavingEditNegociacao(true)
    try {
      const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
      const novoHistorico = historicoAtual.map(item => {
        if (item.id === targetItem.id) {
          return {
            ...item,
            tipo: formEditNegociacao.tipo,
            descricao: formEditNegociacao.descricao.trim(),
            valor_pago: formEditNegociacao.tipo === 'pagamento_parcial' ? Number(formEditNegociacao.valor_pago) : undefined,
            valor_novo: formEditNegociacao.tipo === 'desconto' ? Number(formEditNegociacao.valor_novo) : undefined,
            nova_data: formEditNegociacao.tipo === 'prorrogacao' ? formEditNegociacao.nova_data : undefined,
            editado_em: new Date().toISOString(),
            editado_por: colaboradorAtivo.nome
          }
        }
        return item
      })

      const updatePayload: Record<string, any> = { historico_negociacao: novoHistorico }

      if (formEditNegociacao.tipo === 'desconto' && formEditNegociacao.valor_novo) {
        updatePayload.valor = Number(formEditNegociacao.valor_novo)
      }
      if (formEditNegociacao.tipo === 'prorrogacao' && formEditNegociacao.nova_data) {
        updatePayload.data_vencimento = formEditNegociacao.nova_data
      }

      const { error: dbError } = await supabase.from('contas').update(updatePayload).eq('id', contaId)
      if (dbError) throw dbError

      toast('Registro de negociação atualizado com sucesso!', 'success')
      setEditingNegociacaoItem(null)
      await load()
    } catch (err: any) {
      toast('Erro ao atualizar negociação: ' + (err?.message || err), 'error')
    } finally {
      setSavingEditNegociacao(false)
    }
  }

  const excluirNegociacaoItem = async (conta: ContaComRelacoes, itemId: string) => {
    if (!(await confirm('Remover Acordo', 'Deseja remover este registro do histórico da conta?', { confirmLabel: 'Remover', confirmColor: C.red }))) return

    const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
    const novoHistorico = historicoAtual.filter(item => item.id !== itemId)

    const { error } = await supabase.from('contas').update({ historico_negociacao: novoHistorico }).eq('id', conta.id)
    if (error) return toast('Erro ao excluir negociação: ' + error.message, 'error')

    toast('Registro removido do histórico.', 'success')
    await load()
  }

  // ── Restauração de Valor Cheio via Modal React ──
  const [restaurarContaModal, setRestaurarContaModal] = useState<ContaComRelacoes | null>(null)
  const [formRestaurarValor, setFormRestaurarValor] = useState('')
  const [formRestaurarObs, setFormRestaurarObs] = useState('')
  const [savingRestaurar, setSavingRestaurar] = useState(false)

  const openRestaurarValorCheioModal = (conta: ContaComRelacoes) => {
    setRestaurarContaModal(conta)
    setFormRestaurarValor(conta.valor_original ? String(conta.valor_original) : String(conta.valor))
    setFormRestaurarObs('')
  }

  const confirmarRestaurarValorCheio = async () => {
    if (!restaurarContaModal) return
    const numValor = parseCurrency(formRestaurarValor)
    if (isNaN(numValor) || numValor <= 0) {
      return toast('Informe um valor válido maior que zero.', 'error')
    }

    setSavingRestaurar(true)
    try {
      const historicoAtual = Array.isArray(restaurarContaModal.historico_negociacao) ? restaurarContaModal.historico_negociacao : []
      const obsTexto = formRestaurarObs.trim() ? ` Motivo: ${formRestaurarObs.trim()}` : ''
      const logItem = {
        id: crypto.randomUUID(),
        data: new Date().toISOString(),
        autor: colaboradorAtivo.nome,
        tipo: 'restauracao',
        descricao: `🔄 Acordo cancelado por ${colaboradorAtivo.nome}. Lançamento retornado ao valor cheio original de R$ ${numValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.${obsTexto}`
      }

      const { error } = await supabase.from('contas').update({
        valor: numValor,
        historico_negociacao: [logItem] // Ignora (apaga) todas as negociações anteriores
      }).eq('id', restaurarContaModal.id)

      if (error) throw error

      toast('Valor cheio restaurado com sucesso!', 'success')
      setRestaurarContaModal(null)
      await load()
    } catch (err: any) {
      toast('Erro ao restaurar valor cheio: ' + (err?.message || err), 'error')
    } finally {
      setSavingRestaurar(false)
    }
  }

  const [obras, setObras]       = useState<Obra[]>([])

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const buildContasQuery = (sb: typeof supabase) => {
      let q = sb.from('contas').select('*, empresa:empresas(nome_fantasia,razao_social,cor), fornecedor:fornecedores(razao_social,nome_fantasia,banco,agencia,conta,pix,cnpj), obra:obras(nome)').order('data_previsao', { ascending: false })
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
        if (ids.length > 0) {
          q = q.in('empresa_id', ids)
        }
        q = q.or(`is_privada.eq.false,is_privada.is.null,usuarios_permitidos.cs.{${colaboradorAtivo.id}}`)
      }
      return q
    }

    let qE = supabase.from('empresas').select('*').order('razao_social')
    let qF = supabase.from('fornecedores').select('id, razao_social, nome_fantasia').order('razao_social')
    let qO = supabase.from('obras').select('*').order('nome')

    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qE = qE.in('id', ids)
        qF = qF.or(`empresa_id.in.(${ids.join(',')}),empresa_id.is.null`)
      }
    }

    const [{ data: c }, { data: e }, { data: f }, { data: o }] = await Promise.all([
      fetchAllChunks<ContaComRelacoes>(buildContasQuery),
      qE.limit(1000),
      fetchAllChunks<Fornecedor>(() => qF),
      qO.limit(1000)
    ])
    
    let fetchedContas = (c as ContaComRelacoes[]) ?? []
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const oIds = colaboradorAtivo.obras_ids || []
      fetchedContas = fetchedContas.filter(conta => (conta.obra_id && conta.obra_id !== 'geral') ? oIds.includes(conta.obra_id) : oIds.includes('geral'))
    }
    setContas(fetchedContas)
    setEmpresas(e ?? [])
    setFornecedores(f ?? [])
    
    let oList = o ?? []
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const oIds = colaboradorAtivo.obras_ids || []
      oList = oList.filter(ob => oIds.includes(ob.id))
    }
    setObras(oList)
    
    setLoading(false)
  }, [colaboradorAtivo])

  const toggleAcessoColaboradorContaPrivada = async (colaboradorId: string) => {
    if (!acessosContaPrivada) return
    const atuais = acessosContaPrivada.usuarios_permitidos || []
    const novoArray = atuais.includes(colaboradorId) ? atuais.filter(id => id !== colaboradorId) : [...atuais, colaboradorId]

    const { error } = await supabase.from('contas').update({ usuarios_permitidos: novoArray }).eq('id', acessosContaPrivada.id)
    if (error) return toast('Erro ao atualizar permissão: ' + error.message, 'error')

    setAcessosContaPrivada({ ...acessosContaPrivada, usuarios_permitidos: novoArray })
    toast('Acesso atualizado', 'success')
  }

  const podeLancar = permissaoAtiva?.pode_lancar;

  useRealtimeSync(load, 'financeiro-historico')
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    if (ids.length === 1) {
      setFiltEmpresa(ids[0])
    } else {
      setFiltEmpresa('')
    }
  }, [colaboradorAtivo])

  const marcarPago = async (id: string) => {
    await supabase.from('contas').update({ status: 'Pago', pago_em: new Date().toISOString() }).eq('id', id)
    load()
  }

  const aprovarLançamento = async (id: string) => {
    const conta = contas.find(c => c.id === id)
    if (!conta) return

    const nomeAprovador = colaboradorAtivo.nome || 'Administrador'
    const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
    const novoLogItem: ItemNegociacao = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      autor: nomeAprovador,
      tipo: 'alteracao_status',
      descricao: `Aprovou o lançamento (Status alterado de "${conta.status}" para "Liberado/OK")`
    }

    await supabase.from('contas').update({
      status: 'Liberado/OK',
      aprovado_por: nomeAprovador,
      aprovado_em: new Date().toISOString(),
      historico_negociacao: [...historicoAtual, novoLogItem]
    }).eq('id', id)

    try {
      await supabase.from('historico_edicoes').insert({
        entidade: 'contas',
        entidade_id: id,
        acao: 'UPDATE',
        dados_anteriores: { status: conta.status },
        dados_novos: { status: 'Liberado/OK', aprovado_por: nomeAprovador },
        usuario_nome: nomeAprovador
      })
    } catch {}

    load()
  }

  const avancarStatus = async (conta: ContaComRelacoes) => {
    const proximo: Partial<Record<ContaComRelacoes['status'], ContaComRelacoes['status']>> = {
      'Lançado': 'Bloqueado',
      'Liberado/OK': 'A pagar',
    }
    const status = proximo[conta.status]
    if (!status) return
    
    const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
    const novoLogItem: ItemNegociacao = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      autor: colaboradorAtivo.nome || 'Usuário',
      tipo: 'alteracao_status',
      descricao: `Avançou status de "${conta.status}" para "${status}"`
    }

    await supabase.from('contas').update({ 
      status, 
      historico_negociacao: [...historicoAtual, novoLogItem] 
    }).eq('id', conta.id)
    await load()
    toast('Status alterado.', 'success')
  }

  const alterarStatus = async (id: string, status: ContaComRelacoes['status']) => {
    const conta = contas.find(c => c.id === id)
    if (!conta) return

    const payload: Record<string, any> = { status }
    if (status === 'Pago' || status === 'Pago sem Nota Fiscal') payload.pago_em = new Date().toISOString()
    if (status !== 'Pago' && status !== 'Pago sem Nota Fiscal') payload.pago_em = null
    
    let descLog = `Status alterado de "${conta.status}" para "${status}"`

    if (status === 'Negado') {
      const justificativa = await prompt?.(
        'Justificativa de Negação',
        {
          description: 'O lançamento será marcado como Negado. Informe a justificativa (obrigatório).',
          placeholder: 'Ex: Documento inválido, valor incorreto…',
          confirmLabel: 'Negar Lançamento',
        }
      )
      if (!justificativa) return
      payload.justificativa_negacao = justificativa
      descLog += `. Motivo: ${justificativa}`
    } else {
      payload.justificativa_negacao = null
    }

    const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
    const novoLogItem: ItemNegociacao = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      autor: colaboradorAtivo.nome || 'Usuário',
      tipo: 'alteracao_status',
      descricao: descLog
    }
    payload.historico_negociacao = [...historicoAtual, novoLogItem]

    const { error } = await supabase.from('contas').update(payload).eq('id', id)
    if (error) return toast(error.message, 'error')

    try {
      await supabase.from('historico_edicoes').insert({
        entidade: 'contas',
        entidade_id: id,
        acao: 'UPDATE',
        dados_anteriores: { status: conta.status },
        dados_novos: { status, justificativa: payload.justificativa_negacao },
        usuario_nome: colaboradorAtivo.nome || 'Usuário'
      })
    } catch {}

    await load()
  }

  const alterarStatusEmLote = async () => {
    if (!statusEmLote || selecionadasContas.length === 0) return

    const contasSelecionadas = contas.filter(c => selecionadasContas.includes(c.id))
    const qtd = contasSelecionadas.length

    // Status "Negado" requer justificativa única aplicada a todos
    let justificativa: string | null = null
    if (statusEmLote === 'Negado') {
      const j = await prompt?.(
        'Justificativa de Negação em Lote',
        {
          description: `Será aplicada a ${qtd} lançamento(s). Informe a justificativa (obrigatório).`,
          placeholder: 'Ex: Documento inválido, valor incorreto…',
          confirmLabel: `Negar ${qtd} Lançamento(s)`,
        }
      )
      if (!j) return
      justificativa = j
    } else {
      const ok = await confirm(
        `Alterar ${qtd} lançamento(s)`,
        `Deseja alterar o status de ${qtd} lançamento(s) para "${statusEmLote}"? Esta ação ficará registrada no histórico de cada lançamento.`,
        { confirmLabel: `Alterar ${qtd} Lançamentos`, confirmColor: C.amber }
      )
      if (!ok) return
    }

    setAplicandoLote(true)
    const autor = colaboradorAtivo.nome || 'Usuário'
    const agora = new Date().toISOString()

    try {
      await Promise.all(
        contasSelecionadas.map(async (conta) => {
          const payload: Record<string, any> = { status: statusEmLote }
          if (statusEmLote === 'Pago' || statusEmLote === 'Pago sem Nota Fiscal') payload.pago_em = agora
          else payload.pago_em = null
          if (justificativa) payload.justificativa_negacao = justificativa
          else payload.justificativa_negacao = null

          const historicoAtual = Array.isArray(conta.historico_negociacao) ? conta.historico_negociacao : []
          const logItem: ItemNegociacao = {
            id: Date.now().toString() + Math.random(),
            data: agora,
            autor,
            tipo: 'alteracao_status',
            descricao: `[Em lote] Status alterado de "${conta.status}" para "${statusEmLote}"${justificativa ? `. Motivo: ${justificativa}` : ''}`
          }
          payload.historico_negociacao = [...historicoAtual, logItem]

          await supabase.from('contas').update(payload).eq('id', conta.id)
        })
      )

      // Registro de auditoria em lote no historico_edicoes
      try {
        await supabase.from('historico_edicoes').insert(
          contasSelecionadas.map(conta => ({
            entidade: 'contas',
            entidade_id: conta.id,
            acao: 'UPDATE' as const,
            dados_anteriores: { status: conta.status },
            dados_novos: { status: statusEmLote, alterado_em_lote: true },
            usuario_nome: autor
          }))
        )
      } catch {}

      toast(`✅ ${qtd} lançamento(s) alterado(s) para "${statusEmLote}".`, 'success')
      setSelecionadasContas([])
      setStatusEmLote('')
      setModoSelecao(false)
      await load()
    } catch (err: any) {
      toast(`Erro ao aplicar em lote: ${err?.message ?? 'tente novamente'}`, 'error')
    } finally {
      setAplicandoLote(false)
    }
  }

  const excluir = async (id: string) => {
    if (!(await confirm('Excluir Lançamento', 'Deseja realmente excluir este lançamento financeiro?', { confirmLabel: 'Excluir', confirmColor: C.red }))) return
    
    // Agora usamos a exclusão direta via Client porque as regras de RLS no Postgres foram corrigidas
    // para espelhar as configurações do painel (como pode_excluir_lancamento).
    const { error } = await supabase.from('contas').delete().eq('id', id)
    
    if (error) {
      return toast('Erro ao excluir: ' + error.message, 'error')
    }

    toast('Lançamento excluído com sucesso.', 'success')
    load()
  }

  async function anexarComprovantePosterior(contaId: string, empresaId: string, filesInput: FileList | File[] | File) {
    const filesArray = filesInput instanceof File ? [filesInput] : Array.from(filesInput)
    if (!filesArray.length) return

    const { data: contaAtual } = await supabase.from('contas').select('comprovante_url').eq('id', contaId).maybeSingle()
    const existentes = parseAnexos(contaAtual?.comprovante_url)

    const novasUrls: string[] = []

    for (const file of filesArray) {
      const ext = file.name.split('.').pop()
      const fileName = `comprovante_posterior_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
      const uploadPath = empresaId ? `${empresaId}/${fileName}` : fileName

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('comprovantes')
        .upload(uploadPath, file, { upsert: true })

      if (!uploadErr && uploadData?.path) {
        const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(uploadData.path)
        novasUrls.push(publicUrl)
      }
    }

    if (novasUrls.length === 0) {
      return toast('Erro ao enviar anexo(s).', 'error')
    }

    const todasUrls = [...existentes, ...novasUrls]
    const finalUrlValue = todasUrls.length === 1 ? todasUrls[0] : JSON.stringify(todasUrls)

    const { error } = await supabase.from('contas').update({ comprovante_url: finalUrlValue }).eq('id', contaId)
    if (error) return toast(`Erro ao salvar anexo(s): ${error.message}`, 'error')

    toast(`${novasUrls.length} anexo(s) adicionado(s) com sucesso.`, 'success')
    void load()
  }

  async function removerAnexoPosterior(contaId: string, urlParaRemover: string) {
    const { data: contaAtual } = await supabase.from('contas').select('comprovante_url').eq('id', contaId).maybeSingle()
    const existentes = parseAnexos(contaAtual?.comprovante_url)
    const filtradas = existentes.filter(u => u !== urlParaRemover)

    const finalUrlValue = filtradas.length === 0 ? null : (filtradas.length === 1 ? filtradas[0] : JSON.stringify(filtradas))

    const { error } = await supabase.from('contas').update({ comprovante_url: finalUrlValue }).eq('id', contaId)
    if (error) return toast(`Erro ao remover anexo: ${error.message}`, 'error')

    toast('Anexo removido com sucesso.', 'success')
    void load()
  }

  function iniciarEdicao(c: ContaComRelacoes) {
    setEditandoConta(c)
    setFormEdicao({
      tipo: c.tipo,
      empresa_id: c.empresa_id,
      fornecedor_id: c.fornecedor_id || '',
      obra_id: c.obra_id || '',
      descricao: c.descricao,
      valor: c.valor,
      data_previsao: c.data_previsao,
      data_vencimento: c.data_vencimento,
      status: c.status,
      categoria: c.categoria || '',
      observacoes: c.observacoes || '',
      recorrencia: c.recorrencia || 'unico',
      possui_fornecedor: Boolean(c.fornecedor_id),
      is_privada: c.is_privada || false,
      usuarios_permitidos: c.usuarios_permitidos || []
    })
  }

  async function salvarEdicaoConta() {
    if (!editandoConta) return

    const valorEditadoNum = parseCurrency(formEdicao.valor)
    const mudancas: string[] = []
    if (editandoConta.tipo !== formEdicao.tipo) mudancas.push(`tipo para "${formEdicao.tipo === 'pagar' ? 'A Pagar' : 'A Receber'}"`)
    if (editandoConta.empresa_id !== formEdicao.empresa_id) mudancas.push(`empresa`)
    if (editandoConta.fornecedor_id !== (formEdicao.fornecedor_id || null)) mudancas.push(`fornecedor`)
    if (editandoConta.obra_id !== (formEdicao.obra_id || null)) mudancas.push(`obra`)
    if (editandoConta.status !== formEdicao.status) mudancas.push(`status de "${editandoConta.status}" para "${formEdicao.status}"`)
    if (editandoConta.descricao !== formEdicao.descricao) mudancas.push(`descrição para "${formEdicao.descricao}"`)
    if (editandoConta.valor !== valorEditadoNum) mudancas.push(`valor para ${fmt(valorEditadoNum)}`)
    if (editandoConta.data_vencimento !== formEdicao.data_vencimento) mudancas.push(`vencimento para ${formEdicao.data_vencimento}`)
    if (editandoConta.categoria !== (formEdicao.categoria || null)) mudancas.push(`categoria`)
    if (editandoConta.is_privada !== formEdicao.is_privada) mudancas.push(`confidencialidade para ${formEdicao.is_privada ? 'Privado' : 'Público'}`)

    const historicoAtual = Array.isArray(editandoConta.historico_negociacao) ? editandoConta.historico_negociacao : []
    let novoHistorico = historicoAtual
    if (mudancas.length > 0) {
      const novoLogItem: ItemNegociacao = {
        id: Date.now().toString(),
        data: new Date().toISOString(),
        autor: colaboradorAtivo.nome || 'Usuário',
        tipo: 'alteracao_status',
        descricao: `Edição completa do lançamento: alterou ${mudancas.join(', ')}`
      }
      novoHistorico = [...historicoAtual, novoLogItem]
    }

    const { error } = await supabase.from('contas').update({
      tipo: formEdicao.tipo,
      empresa_id: formEdicao.empresa_id,
      fornecedor_id: formEdicao.fornecedor_id || null,
      obra_id: formEdicao.obra_id || null,
      descricao: formEdicao.descricao,
      valor: valorEditadoNum,
      data_previsao: formEdicao.data_previsao,
      data_vencimento: formEdicao.data_vencimento,
      status: formEdicao.status,
      categoria: formEdicao.categoria || null,
      observacoes: formEdicao.observacoes || null,
      recorrencia: formEdicao.recorrencia || 'unico',
      possui_fornecedor: Boolean(formEdicao.fornecedor_id),
      historico_negociacao: novoHistorico,
      is_privada: Boolean(formEdicao.is_privada),
      usuarios_permitidos: formEdicao.is_privada ? (formEdicao.usuarios_permitidos || []) : []
    }).eq('id', editandoConta.id)
    if (error) return toast(error.message, 'error')

    try {
      await supabase.from('historico_edicoes').insert({
        entidade: 'contas',
        entidade_id: editandoConta.id,
        acao: 'UPDATE',
        dados_anteriores: { status: editandoConta.status, valor: editandoConta.valor, descricao: editandoConta.descricao },
        dados_novos: { status: formEdicao.status, valor: Number(formEdicao.valor), descricao: formEdicao.descricao },
        usuario_nome: colaboradorAtivo.nome || 'Usuário'
      })
    } catch {}

    setEditandoConta(null)
    toast('Lançamento atualizado', 'success')
    void load()
  }

  const contasDaEmpresa = useMemo(() => {
    if (colaboradorAtivo.cargo === 'admin_geral') return contas
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    return ids.length > 0 ? contas.filter(c => ids.includes(c.empresa_id)) : contas
  }, [contas, colaboradorAtivo])

  const deferredSearch = useDeferredValue(search)

  const filtered = useMemo(() => {
    return contasDaEmpresa.filter(c => {
      const matchEmpresa = !filtEmpresa || c.empresa_id === filtEmpresa
      const matchObra = !filtObra || (filtObra === 'geral' ? (!c.obra_id || c.obra_id === 'geral') : c.obra_id === filtObra)
      const matchFornecedor = !filtFornecedor || c.fornecedor_id === filtFornecedor
      const matchTipo    = filtTipo === 'todos' || c.tipo === filtTipo
      const matchStatus  = filtStatus === 'todos' || c.status === filtStatus
      let data = c.data_previsao || c.data_vencimento || ''
      if (filtTipoData === 'vencimento') data = c.data_vencimento || ''
      else if (filtTipoData === 'previsao') data = c.data_previsao || ''
      else if (filtTipoData === 'pago_em') data = c.pago_em ? c.pago_em.slice(0, 10) : ''
      else if (filtTipoData === 'created_at') data = c.created_at ? c.created_at.slice(0, 10) : ''

      const matchInicio = !filtDataInicio || (data !== '' && data >= filtDataInicio)
      const matchFim = !filtDataFim || (data !== '' && data <= filtDataFim)
      const codFormatted = fmtCodigo(c)
      const rawSearch = deferredSearch.trim().toLowerCase()

      const isExactCodeSearch = rawSearch && (
        codFormatted.toLowerCase() === rawSearch ||
        String(c.codigo_sequencial || '') === rawSearch ||
        (rawSearch.startsWith('pag-') && codFormatted.toLowerCase().includes(rawSearch)) ||
        (rawSearch.startsWith('rec-') && codFormatted.toLowerCase().includes(rawSearch))
      )

      if (isExactCodeSearch) {
        return matchEmpresa
      }

      const numValorMin = filtValorMin !== '' ? parseFloat(filtValorMin) : null
      const numValorMax = filtValorMax !== '' ? parseFloat(filtValorMax) : null
      const matchValorMin = numValorMin === null || isNaN(numValorMin) || Number(c.valor || 0) >= numValorMin
      const matchValorMax = numValorMax === null || isNaN(numValorMax) || Number(c.valor || 0) <= numValorMax

      const matchSearch  = !deferredSearch ||
        c.descricao.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.obra?.nome ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fornecedor?.razao_social ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fornecedor?.nome_fantasia ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        codFormatted.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        String(c.codigo_sequencial || '').includes(deferredSearch.trim())
      return matchEmpresa && matchObra && matchFornecedor && matchTipo && matchStatus && matchSearch && matchInicio && matchFim && matchValorMin && matchValorMax
    }).sort((a, b) => {
      const da = new Date(a.created_at || a.data_previsao || '').getTime()
      const db = new Date(b.created_at || b.data_previsao || '').getTime()
      if (filtOrdem === 'maior_valor') return b.valor - a.valor
      if (filtOrdem === 'menor_valor') return a.valor - b.valor
      if (filtOrdem === 'az') return a.descricao.localeCompare(b.descricao, 'pt-BR')
      if (filtOrdem === 'za') return b.descricao.localeCompare(a.descricao, 'pt-BR')
      if (filtOrdem === 'venc_prox' || filtOrdem === 'venc_dist') {
        const vA = new Date(a.data_vencimento || a.data_previsao || a.created_at || '').getTime()
        const vB = new Date(b.data_vencimento || b.data_previsao || b.created_at || '').getTime()
        return filtOrdem === 'venc_prox' ? vA - vB : vB - vA
      }
      return filtOrdem === 'novo' ? db - da : da - db
    })
  }, [contasDaEmpresa, filtEmpresa, filtObra, filtFornecedor, filtTipo, filtStatus, filtTipoData, filtDataInicio, filtDataFim, filtValorMin, filtValorMax, deferredSearch, filtOrdem])

  // Controles de Paginação de Alta Performance
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState<number | 'todos'>(50)

  useEffect(() => {
    setPaginaAtual(1)
  }, [search, filtStatus, filtTipo, filtEmpresa, filtFornecedor, filtDataInicio, filtDataFim, filtValorMin, filtValorMax, filtOrdem])

  const totalPaginas = itensPorPagina === 'todos' ? 1 : Math.max(1, Math.ceil(filtered.length / Number(itensPorPagina)))

  const contasExibidas = useMemo(() => {
    if (itensPorPagina === 'todos') return filtered
    const perPage = Number(itensPorPagina)
    const inicio = (paginaAtual - 1) * perPage
    return filtered.slice(inicio, inicio + perPage)
  }, [filtered, paginaAtual, itensPorPagina])

  const [viewMode, setViewMode] = useState<'tabela' | 'projecao'>('tabela')

  // Filtro base com useMemo para contagem de status ultra rápida O(N)
  const contasBaseFiltro = useMemo(() => {
    return contas.filter(c => {
      const matchEmpresa = !filtEmpresa || c.empresa_id === filtEmpresa
      const matchFornecedor = !filtFornecedor || c.fornecedor_id === filtFornecedor
      const matchTipo    = filtTipo === 'todos' || c.tipo === filtTipo
      let data = c.data_previsao || c.data_vencimento || ''
      if (filtTipoData === 'vencimento') data = c.data_vencimento || ''
      else if (filtTipoData === 'previsao') data = c.data_previsao || ''
      else if (filtTipoData === 'pago_em') data = c.pago_em ? c.pago_em.slice(0, 10) : ''
      else if (filtTipoData === 'created_at') data = c.created_at ? c.created_at.slice(0, 10) : ''

      const matchInicio = !filtDataInicio || (data !== '' && data >= filtDataInicio)
      const matchFim = !filtDataFim || (data !== '' && data <= filtDataFim)
      const numValorMin = filtValorMin !== '' ? parseFloat(filtValorMin) : null
      const numValorMax = filtValorMax !== '' ? parseFloat(filtValorMax) : null
      const matchValorMin = numValorMin === null || isNaN(numValorMin) || Number(c.valor || 0) >= numValorMin
      const matchValorMax = numValorMax === null || isNaN(numValorMax) || Number(c.valor || 0) <= numValorMax
      const codFormatted = fmtCodigo(c)
      const matchSearch  = !deferredSearch ||
        c.descricao.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.obra?.nome ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fornecedor?.razao_social ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fornecedor?.nome_fantasia ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        codFormatted.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        String(c.codigo_sequencial || '').includes(deferredSearch.trim())
      return matchEmpresa && matchFornecedor && matchTipo && matchSearch && matchInicio && matchFim && matchValorMin && matchValorMax
    })
  }, [contas, filtEmpresa, filtFornecedor, filtTipo, filtTipoData, filtDataInicio, filtDataFim, filtValorMin, filtValorMax, deferredSearch])

  // Dicionário de estatísticas pré-computado em 1 único loop O(N)
  const statusStatsMap = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    let countGeral = 0
    let totalGeral = 0
    for (const c of contasBaseFiltro) {
      if (!map[c.status]) {
        map[c.status] = { count: 0, total: 0 }
      }
      map[c.status].count++
      map[c.status].total += (c.valor || 0)
      countGeral++
      totalGeral += (c.valor || 0)
    }
    map['todos'] = { count: countGeral, total: totalGeral }
    return map
  }, [contasBaseFiltro])

  const getStatsByStatus = (st: string) => {
    return statusStatsMap[st] || { count: 0, total: 0 }
  }

  // Data de hoje no fuso horário oficial de Brasília (YYYY-MM-DD)
  const hojeLocalStr = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      return formatter.format(new Date())
    } catch {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }, [])

  // Contas filtradas pelo contexto ativo (Empresa, Fornecedor, Busca, Tipo, Faixa de Valor),
  // sem aplicar o filtro estrito de data para permitir o cálculo correto da régua dos 5 dias
  const contasFiltradasContexto = useMemo(() => {
    return contasDaEmpresa.filter(c => {
      const matchEmpresa = !filtEmpresa || c.empresa_id === filtEmpresa
      const matchFornecedor = !filtFornecedor || c.fornecedor_id === filtFornecedor
      const matchTipo = filtTipo === 'todos' || c.tipo === filtTipo
      const numValorMin = filtValorMin !== '' ? parseFloat(filtValorMin) : null
      const numValorMax = filtValorMax !== '' ? parseFloat(filtValorMax) : null
      const matchValorMin = numValorMin === null || isNaN(numValorMin) || Number(c.valor || 0) >= numValorMin
      const matchValorMax = numValorMax === null || isNaN(numValorMax) || Number(c.valor || 0) <= numValorMax
      const codFormatted = fmtCodigo(c)
      const matchSearch = !deferredSearch ||
        c.descricao.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.obra?.nome ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fornecedor?.razao_social ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fornecedor?.nome_fantasia ?? '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        codFormatted.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        String(c.codigo_sequencial || '').includes(deferredSearch.trim())
      return matchEmpresa && matchFornecedor && matchTipo && matchSearch && matchValorMin && matchValorMax
    })
  }, [contasDaEmpresa, filtEmpresa, filtFornecedor, filtTipo, filtValorMin, filtValorMax, deferredSearch])

  // Somatória A Pagar do Dia (Hoje) - Pendente respeitando o filtro contextual ativo
  const totalAPagarHoje = useMemo(() => {
    return contasFiltradasContexto.filter(c => {
      const isLiquidado = c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal' || c.status === 'Negado'
      if (isLiquidado || c.tipo !== 'pagar') return false
      const dataRef = (c.data_vencimento || c.data_previsao || '').slice(0, 10)
      return dataRef === hojeLocalStr
    }).reduce((s, c) => s + (c.valor || 0), 0)
  }, [contasFiltradasContexto, hojeLocalStr])

  // Régua Sequencial de Pagamentos dos Próximos 5 Dias (Fuso de Brasília com Filtros Ativos)
  const reguaProximosDias = useMemo(() => {
    const hojeStr = hojeLocalStr
    const [ano, mes, dia] = hojeStr.split('-').map(Number)
    const lista = []

    for (let offset = 0; offset < 5; offset++) {
      const dObj = new Date(Date.UTC(ano, mes - 1, dia + offset, 12, 0, 0))
      const yyyy = dObj.getUTCFullYear()
      const mm = String(dObj.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(dObj.getUTCDate()).padStart(2, '0')
      const dataStr = `${yyyy}-${mm}-${dd}`
      
      const diaSemana = dObj.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace('.', '').toUpperCase()
      const diaMes = `${dd}/${mm}`

      let label = ''
      if (offset === 0) label = 'Hoje'
      else if (offset === 1) label = 'Amanhã'
      else label = `Em +${offset} dias`

      const contasDoDia = contasFiltradasContexto.filter(c => {
        const isLiquidado = c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal' || c.status === 'Negado'
        if (isLiquidado || c.tipo !== 'pagar') return false
        const dataRef = (c.data_vencimento || c.data_previsao || '').slice(0, 10)
        return dataRef === dataStr
      })

      const totalValor = contasDoDia.reduce((s, c) => s + (c.valor || 0), 0)
      const totalContas = contasDoDia.length

      lista.push({
        offset,
        label,
        diaSemana,
        diaMes,
        dataStr,
        totalValor,
        totalContas
      })
    }
    return lista
  }, [contasFiltradasContexto, hojeLocalStr])

  // Somatórias do resultado filtrado
  const totalValorFiltrado = useMemo(() => filtered.reduce((s, c) => s + (c.valor || 0), 0), [filtered])
  const totalAPagarFiltrado = useMemo(() => filtered.filter(c => c.status !== 'Pago' && c.status !== 'Pago sem Nota Fiscal' && c.status !== 'Negado' && c.tipo === 'pagar').reduce((s, c) => s + (c.valor || 0), 0), [filtered])
  const totalReceberFiltrado = useMemo(() => filtered.filter(c => c.status !== 'Pago' && c.status !== 'Pago sem Nota Fiscal' && c.status !== 'Negado' && c.tipo === 'receber').reduce((s, c) => s + (c.valor || 0), 0), [filtered])
  const totalPagoFiltrado   = useMemo(() => filtered.filter(c => (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal') && c.tipo === 'pagar').reduce((s, c) => s + (c.valor || 0), 0), [filtered])
  const totalRecebidoFiltrado = useMemo(() => filtered.filter(c => (c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal') && c.tipo === 'receber').reduce((s, c) => s + (c.valor || 0), 0), [filtered])
  const saldoLiquidoFiltrado = (totalReceberFiltrado + totalRecebidoFiltrado) - (totalAPagarFiltrado + totalPagoFiltrado)

  const listaStatusOpcoes = [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'Lançado', label: 'Lançado' },
    { value: 'Bloqueado', label: 'Bloqueado' },
    { value: 'Aguardando aprovação', label: 'Aguardando aprovação' },
    { value: 'Liberado/OK', label: 'Liberado/OK' },
    { value: 'A pagar', label: 'A pagar' },
    { value: 'Pago Parcial', label: 'Pago Parcial' },
    { value: 'Pago', label: 'Pago' },
    { value: 'Pago sem Nota Fiscal', label: 'Paga S/NF' },
    { value: 'Negado', label: 'Negado' },
  ]

  // Projeção Mensal de Fluxo de Caixa agrupada por mês
  const projecaoMensal = useMemo(() => {
    const map = new Map<string, { mes: string; aPagar: number; aReceber: number; pago: number; recebido: number; saldo: number }>()
    contasDaEmpresa.forEach(c => {
      const d = c.data_vencimento || c.data_previsao || c.created_at || ''
      if (!d) return
      const mesChave = d.slice(0, 7) // YYYY-MM
      if (!mesChave || mesChave.length < 7) return
      
      const mesFormatado = new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      if (!map.has(mesChave)) {
        map.set(mesChave, { mes: mesFormatado.toUpperCase(), aPagar: 0, aReceber: 0, pago: 0, recebido: 0, saldo: 0 })
      }
      const item = map.get(mesChave)!
      const isLiquidado = c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal'
      if (c.tipo === 'pagar') {
        if (isLiquidado) item.pago += (c.valor || 0)
        else if (c.status !== 'Negado') item.aPagar += (c.valor || 0)
      } else {
        if (isLiquidado) item.recebido += (c.valor || 0)
        else if (c.status !== 'Negado') item.aReceber += (c.valor || 0)
      }
      item.saldo = (item.recebido + item.aReceber) - (item.pago + item.aPagar)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([_, val]) => val).slice(-6)
  }, [contasDaEmpresa])

  // Permissões dinâmicas
  const isAdminGeral = colaboradorAtivo.cargo === 'admin_geral'
  const podePagar = permissaoAtiva?.pode_pagar || isAdminGeral
  const podeAprovar = permissaoAtiva?.pode_aprovar || isAdminGeral
  const podeAlterarStatus = permissaoAtiva?.pode_alterar_status !== false || isAdminGeral // default true
  const podeDeletar = (permissaoAtiva?.pode_excluir_lancamento === true) || isAdminGeral || colaboradorAtivo.cargo === 'admin_empresa'
  const podeEditar = (permissaoAtiva?.pode_lancar === true) || (permissaoAtiva?.pode_alterar_status === true) || (permissaoAtiva?.pode_pagar === true) || (permissaoAtiva?.pode_aprovar === true) || (permissaoAtiva?.pode_excluir_lancamento === true) || isAdminGeral || colaboradorAtivo.cargo === 'admin_empresa'

  const activeFiltrosCount = [
    filtEmpresa,
    filtFornecedor,
    filtTipo !== 'todos' ? filtTipo : '',
    filtStatus !== 'todos' ? filtStatus : '',
    filtTipoData !== 'previsao_vencimento' ? filtTipoData : '',
    filtDataInicio,
    filtDataFim,
    filtValorMin !== '' ? `min:${filtValorMin}` : '',
    filtValorMax !== '' ? `max:${filtValorMax}` : '',
    filtOrdem !== 'novo' ? filtOrdem : ''
  ].filter(Boolean).length

  const clearFiltros = () => {
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    setFiltEmpresa(ids.length === 1 ? ids[0] : '')
    setFiltFornecedor('')
    setFiltTipoData('previsao_vencimento')
    setFiltDataInicio('')
    setFiltDataFim('')
    setFiltValorMin('')
    setFiltValorMax('')
    setFiltOrdem('novo')
  }

  const clearAllFiltersAndSearch = () => {
    clearFiltros()
    setSearch('')
    setFiltTipo('todos')
    setFiltStatus('todos')
  }

  const aplicarPresetData = (preset: 'hoje' | 'esta_semana' | 'este_mes' | 'prox_30' | 'ultimos_30' | 'este_ano') => {
    const hoje = new Date()
    const fmtISO = (d: Date) => d.toISOString().split('T')[0]
    
    if (preset === 'hoje') {
      const dStr = fmtISO(hoje)
      setFiltDataInicio(dStr)
      setFiltDataFim(dStr)
    } else if (preset === 'esta_semana') {
      const primeiro = new Date(hoje)
      primeiro.setDate(hoje.getDate() - hoje.getDay())
      const ultimo = new Date(primeiro)
      ultimo.setDate(primeiro.getDate() + 6)
      setFiltDataInicio(fmtISO(primeiro))
      setFiltDataFim(fmtISO(ultimo))
    } else if (preset === 'este_mes') {
      const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      setFiltDataInicio(fmtISO(primeiro))
      setFiltDataFim(fmtISO(ultimo))
    } else if (preset === 'prox_30') {
      const fim = new Date(hoje)
      fim.setDate(hoje.getDate() + 30)
      setFiltDataInicio(fmtISO(hoje))
      setFiltDataFim(fmtISO(fim))
    } else if (preset === 'ultimos_30') {
      const inicio = new Date(hoje)
      inicio.setDate(hoje.getDate() - 30)
      setFiltDataInicio(fmtISO(inicio))
      setFiltDataFim(fmtISO(hoje))
    } else if (preset === 'este_ano') {
      const primeiro = new Date(hoje.getFullYear(), 0, 1)
      const ultimo = new Date(hoje.getFullYear(), 11, 31)
      setFiltDataInicio(fmtISO(primeiro))
      setFiltDataFim(fmtISO(ultimo))
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* ── 2. SELETOR DE MODO DE VISÃO & CONTROLES DE BARRA ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        {/* Toggle de Visualização: Tabela vs Projeção */}
        <div style={{ display: 'flex', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }}>
          <button
            onClick={() => setViewMode('tabela')}
            style={{
              background: viewMode === 'tabela' ? C.bgPanel : 'transparent',
              border: `1px solid ${viewMode === 'tabela' ? C.border : 'transparent'}`,
              color: viewMode === 'tabela' ? C.ink : C.inkSoft,
              fontWeight: viewMode === 'tabela' ? 800 : 600,
              fontSize: 11.5,
              padding: '6px 14px',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <FileText size={13} color={viewMode === 'tabela' ? C.amber : C.inkSoft} />
            Lançamentos & Conciliação ({filtered.length})
          </button>
          <button
            onClick={() => setViewMode('projecao')}
            style={{
              background: viewMode === 'projecao' ? C.bgPanel : 'transparent',
              border: `1px solid ${viewMode === 'projecao' ? C.border : 'transparent'}`,
              color: viewMode === 'projecao' ? C.ink : C.inkSoft,
              fontWeight: viewMode === 'projecao' ? 800 : 600,
              fontSize: 11.5,
              padding: '6px 14px',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Calendar size={13} color={viewMode === 'projecao' ? C.amber : C.inkSoft} />
            Projeção de Fluxo Mensal
          </button>
        </div>

        {/* Botões de Ação Rápida */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {podeAlterarStatus && (
            <button
              onClick={() => {
                if (modoSelecao) {
                  setModoSelecao(false)
                  setSelecionadasContas([])
                  setStatusEmLote('')
                } else {
                  setModoSelecao(true)
                  setModoExportacao(false)
                  setSelecionadasContas([])
                }
              }}
              style={{
                background: modoSelecao ? 'rgba(245, 158, 11, 0.15)' : C.bgWhite,
                border: `1px solid ${modoSelecao ? C.amber : C.border}`,
                color: modoSelecao ? C.amber : C.ink,
                borderRadius: 6,
                padding: '7px 13px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CheckCircle2 size={13} color={modoSelecao ? C.amber : C.inkSoft} />
              {modoSelecao ? 'Cancelar Seleção' : 'Seleção em Lote'}
            </button>
          )}

          <button
            onClick={() => {
              if (modoExportacao) {
                setModoExportacao(false)
                setSelecionadasContas([])
              } else {
                setModoExportacao(true)
                setModoSelecao(false)
                setSelecionadasContas([])
              }
            }}
            style={{
              background: modoExportacao ? 'rgba(16, 185, 129, 0.15)' : C.bgWhite,
              border: `1px solid ${modoExportacao ? '#10B981' : C.border}`,
              color: modoExportacao ? '#10B981' : C.ink,
              borderRadius: 6,
              padding: '7px 13px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download size={13} color={modoExportacao ? '#10B981' : C.inkSoft} />
            {modoExportacao ? 'Cancelar Exportação' : 'Exportar Relatório'}
          </button>
        </div>
      </div>

      {/* ── 3. PAINEL DE BUSCA & FILTROS INTELIGENTES ── */}
      <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Linha 1: Input de Busca + Seletor de Natureza + Botões de Filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Input de Busca */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              style={{ ...input, paddingLeft: 36, paddingRight: search ? 32 : 12, fontSize: 12.5 }}
              placeholder="Buscar por descrição, código (ex: PAG-0123), obra ou fornecedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                title="Limpar texto de busca"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtro Rápido de Natureza (Dual) */}
          <div style={{ display: 'flex', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }}>
            {(['todos', 'pagar', 'receber'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltTipo(t)}
                style={{
                  background: filtTipo === t ? (t === 'pagar' ? '#EF444418' : t === 'receber' ? '#05966918' : C.bgPanel) : 'transparent',
                  border: `1px solid ${filtTipo === t ? (t === 'pagar' ? '#EF4444' : t === 'receber' ? '#059669' : C.border) : 'transparent'}`,
                  color: filtTipo === t ? (t === 'pagar' ? '#EF4444' : t === 'receber' ? '#059669' : C.ink) : C.inkSoft,
                  fontSize: 11,
                  fontWeight: filtTipo === t ? 800 : 600,
                  padding: '5px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t === 'todos' ? 'Todas' : t === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber'}
              </button>
            ))}
          </div>

          {/* Botão de Filtros Avançados */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFiltros(f => !f)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                border: `1px solid ${activeFiltrosCount > 0 ? C.amber : C.border}`,
                borderRadius: 6,
                background: activeFiltrosCount > 0 ? '#F59E0B18' : C.bgWhite,
                color: activeFiltrosCount > 0 ? C.amber : C.ink,
                padding: '7px 13px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Filter size={13} color={activeFiltrosCount > 0 ? C.amber : C.inkSoft} />
              <span>Filtros Avançados</span>
              {activeFiltrosCount > 0 && (
                <span style={{ background: C.amber, color: '#000', fontSize: 10, fontWeight: 900, padding: '1px 5px', borderRadius: 10 }}>
                  {activeFiltrosCount}
                </span>
              )}
              <ChevronDown size={12} style={{ transform: showFiltros ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Popover de Filtros Avançados */}
            {showFiltros && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 100,
                width: 400,
                background: C.bgWhite,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 18,
                boxShadow: '0 16px 36px -4px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)',
                display: 'grid',
                gap: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Sliders size={15} color={C.amber} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Filtros Avançados</span>
                    {activeFiltrosCount > 0 && (
                      <span style={{ background: '#F59E0B20', color: C.amber, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4 }}>
                        {activeFiltrosCount} ativo(s)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setShowFiltros(false)} style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Ordenação */}
                <div style={{ display: 'grid', gap: 5 }}>
                  <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ordenação</label>
                  <select style={{ ...input, background: C.bgPanel }} value={filtOrdem} onChange={e => setFiltOrdem(e.target.value as any)}>
                    <option value="novo">↓ Lançamento mais recente (Cadastro)</option>
                    <option value="antigo">↑ Lançamento mais antigo (Cadastro)</option>
                    <option value="pago_recente">✅ ↓ Pagamento efetivo mais recente (mais novo → mais velho)</option>
                    <option value="pago_antigo">✅ ↑ Pagamento efetivo mais antigo (mais velho → mais novo)</option>
                    <option value="venc_prox">↓ Vencimento mais próximo</option>
                    <option value="venc_dist">↑ Vencimento mais distante</option>
                    <option value="maior_valor">↓ Maior valor primeiro</option>
                    <option value="menor_valor">↑ Menor valor primeiro</option>
                    <option value="az">A → Z (descrição)</option>
                    <option value="za">Z → A (descrição)</option>
                  </select>
                </div>

                {/* Empresa & Obra */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 5 }}>
                    <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Empresa</label>
                    <select 
                      style={{ ...input, background: C.bgPanel }} 
                      disabled={(() => {
                        const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                        return colaboradorAtivo.cargo !== 'admin_geral' && ids.length === 1
                      })()} 
                      value={filtEmpresa} 
                      onChange={e => setFiltEmpresa(e.target.value)}
                    >
                      <option value="">Todas empresas</option>
                      {empresas.filter(e => {
                        if (colaboradorAtivo.cargo === 'admin_geral') return true
                        const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                        return ids.length === 0 || ids.includes(e.id)
                      }).map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Obra / Unidade</label>
                    <select style={{ ...input, background: C.bgPanel }} value={filtObra} onChange={e => setFiltObra(e.target.value)}>
                      <option value="">Todas as obras</option>
                      <option value="geral">Geral / Sede</option>
                      {obras.filter(o => o.id !== 'geral').map(o => (
                        <option key={o.id} value={o.id}>{o.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fornecedor */}
                <div style={{ display: 'grid', gap: 5 }}>
                  <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fornecedor</label>
                  <select style={{ ...input, background: C.bgPanel }} value={filtFornecedor} onChange={e => setFiltFornecedor(e.target.value)}>
                    <option value="">Todos fornecedores</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social ?? f.nome_fantasia}</option>)}
                  </select>
                </div>

                {/* Filtrar por data + Presets Rápidos */}
                <div style={{ display: 'grid', gap: 6, background: C.bgPanel, padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Período & Datas</label>
                    <select style={{ ...input, width: 'auto', padding: '3px 8px', fontSize: 10.5, background: C.bgWhite }} value={filtTipoData} onChange={e => setFiltTipoData(e.target.value as any)}>
                      <option value="previsao_vencimento">Vencimento/Previsão</option>
                      <option value="vencimento">Data de Vencimento</option>
                      <option value="previsao">Data Prevista</option>
                      <option value="pago_em">Data Pagamento</option>
                      <option value="created_at">Data Cadastro</option>
                    </select>
                  </div>

                  {/* Chips de Presets de Data */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {[
                      { id: 'hoje', label: 'Hoje' },
                      { id: 'esta_semana', label: 'Esta Semana' },
                      { id: 'este_mes', label: 'Este Mês' },
                      { id: 'prox_30', label: 'Próx. 30d' },
                      { id: 'ultimos_30', label: 'Últimos 30d' },
                      { id: 'este_ano', label: 'Ano' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => aplicarPresetData(p.id as any)}
                        style={{
                          fontSize: 10,
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: C.bgWhite,
                          border: `1px solid ${C.border}`,
                          color: C.ink,
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.inkSoft, fontWeight: 700 }}>De</span>
                      <input style={{ ...input, background: C.bgWhite, padding: '5px 8px' }} type="date" value={filtDataInicio} onChange={e => setFiltDataInicio(e.target.value)} />
                    </div>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.inkSoft, fontWeight: 700 }}>Até</span>
                      <input style={{ ...input, background: C.bgWhite, padding: '5px 8px' }} type="date" value={filtDataFim} onChange={e => setFiltDataFim(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Faixa de Valor */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor Mín (R$)</label>
                    <input placeholder="0,00" style={{ ...input, background: C.bgPanel }} type="number" value={filtValorMin} onChange={e => setFiltValorMin(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor Máx (R$)</label>
                    <input placeholder="0,00" style={{ ...input, background: C.bgPanel }} type="number" value={filtValorMax} onChange={e => setFiltValorMax(e.target.value)} />
                  </div>
                </div>

                {/* Rodapé: Limpar Filtros + Aplicar Filtros */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <button 
                    type="button" 
                    onClick={clearFiltros} 
                    style={{ ...btnGhost, fontSize: 11, padding: '7px 14px', color: activeFiltrosCount > 0 ? C.amber : C.inkSoft, borderColor: activeFiltrosCount > 0 ? C.amber : C.border, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <RotateCcw size={12} /> Limpar Filtros
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowFiltros(false)} 
                    style={{ ...btn(C.amber), flex: 1, justifyContent: 'center', padding: '7px 16px' }}
                  >
                    Aplicar Filtros
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Limpar Tudo na Barra Principal (Visível quando houver qualquer filtro ou busca ativo) */}
          {(search || filtTipo !== 'todos' || filtStatus !== 'todos' || activeFiltrosCount > 0) && (
            <button
              onClick={clearAllFiltersAndSearch}
              title="Resetar todos os filtros e busca"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: C.bgWhite,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.inkSoft,
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={12} color={C.amber} />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* Linha 2: Pílulas de Status Rápidas com Contadores */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {listaStatusOpcoes.map(st => {
            const stats = getStatsByStatus(st.value)
            const isSel = filtStatus === st.value
            return (
              <button
                key={st.value}
                onClick={() => setFiltStatus(st.value as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 11px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: isSel ? 800 : 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: `1px solid ${isSel ? C.amber : C.border}`,
                  background: isSel ? '#F59E0B18' : C.bgWhite,
                  color: isSel ? C.amber : C.inkSoft,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{st.label}</span>
                <span style={{
                  fontSize: 9.5,
                  background: isSel ? C.amber : 'rgba(255,255,255,0.06)',
                  color: isSel ? '#0B0C0E' : C.inkSoft,
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontWeight: 900
                }}>
                  {stats.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Linha 3: Tags de Filtros Ativos (Feedback visual imediato com remoção em 1 clique) */}
        {(search || filtTipo !== 'todos' || filtStatus !== 'todos' || activeFiltrosCount > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtros Ativos:</span>
            
            {search && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.ink, fontWeight: 600 }}>
                Busca: "{search}"
                <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {filtTipo !== 'todos' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: filtTipo === 'pagar' ? '#EF4444' : '#059669', fontWeight: 700 }}>
                {filtTipo === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber'}
                <button onClick={() => setFiltTipo('todos')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {filtStatus !== 'todos' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.amber, fontWeight: 700 }}>
                Status: {filtStatus}
                <button onClick={() => setFiltStatus('todos')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {filtEmpresa && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.ink, fontWeight: 600 }}>
                Empresa: {empresas.find(e => e.id === filtEmpresa)?.nome_fantasia || 'Selecionada'}
                <button onClick={() => setFiltEmpresa('')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {filtObra && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.ink, fontWeight: 600 }}>
                Obra: {filtObra === 'geral' ? 'Geral / Sede' : (obras.find(o => o.id === filtObra)?.nome || 'Selecionada')}
                <button onClick={() => setFiltObra('')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {filtFornecedor && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.ink, fontWeight: 600 }}>
                Fornecedor: {fornecedores.find(f => f.id === filtFornecedor)?.nome_fantasia || fornecedores.find(f => f.id === filtFornecedor)?.razao_social || 'Selecionado'}
                <button onClick={() => setFiltFornecedor('')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {(filtDataInicio || filtDataFim) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.ink, fontWeight: 600 }}>
                Período: {filtDataInicio ? fmtDate(filtDataInicio) : 'Início'} até {filtDataFim ? fmtDate(filtDataFim) : 'Fim'}
                <button onClick={() => { setFiltDataInicio(''); setFiltDataFim('') }} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            {(filtValorMin || filtValorMax) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, color: C.ink, fontWeight: 600 }}>
                Valor: {filtValorMin ? `R$ ${filtValorMin}` : 'R$ 0'} a {filtValorMax ? `R$ ${filtValorMax}` : '∞'}
                <button onClick={() => { setFiltValorMin(''); setFiltValorMax('') }} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft, padding: 0, display: 'flex' }}><X size={11} /></button>
              </span>
            )}

            <button
              onClick={clearAllFiltersAndSearch}
              style={{ border: 0, background: 'transparent', color: C.amber, fontSize: 10.5, fontWeight: 800, cursor: 'pointer', marginLeft: 4, textDecoration: 'underline' }}
            >
              Limpar Todos
            </button>
          </div>
        )}

      {/* ── RÉGUA EXECUTIVA DE PAGAMENTOS: PRÓXIMOS 5 DIAS (FUSO DE BRASÍLIA) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏱️ Régua de Pagamentos (Próximos 5 Dias)</span>
            <span style={{ fontSize: 9, background: 'rgba(245, 158, 11, 0.12)', color: C.amber, padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
              Horário de Brasília (GMT-3)
            </span>
          </span>

          {/* Badge Executivo de Total Filtrado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(245, 158, 11, 0.12)',
              border: `1px solid rgba(245, 158, 11, 0.35)`,
              padding: '3px 10px',
              borderRadius: 6
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Total Filtrado:
              </span>
              <strong style={{ fontSize: 13, fontWeight: 900, color: C.ink, fontFamily: 'monospace' }}>
                {fmt(totalValorFiltrado)}
              </strong>
              <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700 }}>
                ({filtered.length} {filtered.length === 1 ? 'item' : 'itens'})
              </span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8
        }}>
          {reguaProximosDias.map((diaItem) => {
            const isAtivoFiltro = filtDataInicio === diaItem.dataStr && filtDataFim === diaItem.dataStr
            const temPendencia = diaItem.totalValor > 0
            const isHoje = diaItem.offset === 0
            const isAmanha = diaItem.offset === 1

            return (
              <div
                key={diaItem.dataStr}
                onClick={() => {
                  if (isAtivoFiltro) {
                    setFiltDataInicio('')
                    setFiltDataFim('')
                  } else {
                    setFiltTipoData('previsao_vencimento')
                    setFiltDataInicio(diaItem.dataStr)
                    setFiltDataFim(diaItem.dataStr)
                  }
                }}
                title={`Clique para ${isAtivoFiltro ? 'limpar filtro de' : 'filtrar contas de'} ${diaItem.label} (${diaItem.diaSemana}, ${diaItem.diaMes})`}
                style={{
                  background: isAtivoFiltro ? 'rgba(245, 158, 11, 0.1)' : C.bgWhite,
                  border: isAtivoFiltro ? `1.5px solid ${C.amber}` : (isHoje && temPendencia ? `1px solid #EF444488` : `1px solid ${C.border}`),
                  borderRadius: 7,
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isAtivoFiltro ? '0 0 8px rgba(245, 158, 11, 0.25)' : '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                {/* Cabeçalho do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    color: isHoje ? (temPendencia ? '#EF4444' : C.amber) : (isAmanha ? '#F59E0B' : C.inkSoft)
                  }}>
                    {diaItem.label}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: C.inkSoft,
                    background: 'rgba(0,0,0,0.04)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontFamily: 'monospace'
                  }}>
                    {diaItem.diaSemana} · {diaItem.diaMes}
                  </span>
                </div>

                {/* Valor a Pagar */}
                <strong style={{
                  fontSize: 13,
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: temPendencia ? (isHoje ? '#EF4444' : C.ink) : '#10B981',
                  marginTop: 2
                }}>
                  {fmt(diaItem.totalValor)}
                </strong>

                {/* Quantidade de Contas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
                  <span style={{ fontSize: 9.5, color: temPendencia ? C.inkSoft : '#10B981', fontWeight: 600 }}>
                    {diaItem.totalContas > 0 ? `${diaItem.totalContas} conta(s)` : 'Sem pendências'}
                  </span>
                  {isAtivoFiltro && (
                    <span style={{ fontSize: 8.5, color: C.amber, fontWeight: 900, textTransform: 'uppercase' }}>
                      Ativo ✓
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>

      {/* ── BARRA FLUTUANTE DE SELEÇÃO EM LOTE ── */}
      {modoSelecao && (
        <div style={{
          background: C.bgPanel,
          border: `1.5px solid ${C.amber}`,
          borderRadius: 8,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} /> Seleção em Lote
            </span>
            <span style={{ fontSize: 11, color: C.inkSoft, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              {selecionadasContas.length} de {filtered.length} selecionados
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => selecionarTodasContas(filtered)}
              style={{ background: C.bgWhite, border: `1px solid ${C.border}`, color: C.ink, borderRadius: 6, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              {selecionadasContas.length === filtered.length ? 'Desmarcar Todos' : `Selecionar Todos (${filtered.length})`}
            </button>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                aria-label="Novo status para selecionados"
                value={statusEmLote}
                onChange={e => setStatusEmLote(e.target.value as any)}
                style={{ ...input, width: 190, padding: '6px 10px', fontSize: 11, fontWeight: 600, background: C.bgWhite, color: C.ink, borderColor: C.border }}
              >
                <option value="" style={{ color: '#0A0A0A', background: '#FFFFFF' }}>Selecione o Novo Status...</option>
                {listaStatusOpcoes.filter(o => o.value !== 'todos').map(st => (
                  <option key={st.value} value={st.value} style={{ color: '#0A0A0A', background: '#FFFFFF' }}>{st.label}</option>
                ))}
              </select>

              <button
                disabled={!statusEmLote || selecionadasContas.length === 0 || aplicandoLote}
                onClick={alterarStatusEmLote}
                style={{
                  ...btn(C.amber),
                  padding: '7px 16px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#0A0A0A',
                  opacity: (!statusEmLote || selecionadasContas.length === 0 || aplicandoLote) ? 0.5 : 1,
                  cursor: (!statusEmLote || selecionadasContas.length === 0 || aplicandoLote) ? 'not-allowed' : 'pointer'
                }}
              >
                {aplicandoLote ? 'Aplicando...' : `Aplicar a ${selecionadasContas.length} item(ns)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BARRA FLUTUANTE DE EXPORTAÇÃO ── */}
      {modoExportacao && (
        <div style={{
          background: C.bgPanel,
          border: `1.5px solid #10B981`,
          borderRadius: 8,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={15} /> Exportação de Relatório CSV / Excel
            </span>
            <span style={{ fontSize: 11, color: C.inkSoft, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              {selecionadasContas.length} de {filtered.length} selecionados
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => selecionarTodasContas(filtered)}
              style={{ background: C.bgWhite, border: `1px solid ${C.border}`, color: C.ink, borderRadius: 6, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              {selecionadasContas.length === filtered.length ? 'Desmarcar Todos' : `Selecionar Todos (${filtered.length})`}
            </button>

            {selecionadasContas.length > 0 && (
              <button
                onClick={() => exportarContasCSV(filtered.filter(c => selecionadasContas.includes(c.id)))}
                style={{ ...btn('#10B981'), padding: '7px 14px', fontSize: 11, color: '#FFFFFF', fontWeight: 800 }}
              >
                Baixar Selecionados ({selecionadasContas.length})
              </button>
            )}

            <button
              onClick={() => exportarContasCSV(filtered)}
              style={{ ...btn(C.amber), padding: '7px 14px', fontSize: 11, color: '#0A0A0A', fontWeight: 800 }}
            >
              Baixar Todas as Filtradas ({filtered.length})
            </button>
          </div>
        </div>
      )}

      {/* ── 4. CONTEÚDO PRINCIPAL: PROJEÇÃO DE FLUXO OU TABELA DE LANÇAMENTOS ── */}
      {viewMode === 'projecao' ? (
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.ink }}>Projeção Mensal de Fluxo de Caixa</h3>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: C.inkSoft }}>Comparativo mensal entre despesas projetadas vs receitas e balanço líquido.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {projecaoMensal.map((item, idx) => (
              <div key={idx} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: C.amber }}>{item.mes}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: item.saldo >= 0 ? '#10B981' : '#EF4444' }}>
                    Saldo: {fmt(item.saldo)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: C.inkSoft }}>Entradas:</span>
                  <span style={{ color: '#34D399', fontWeight: 700 }}>{fmt(item.recebido + item.aReceber)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: C.inkSoft }}>Saídas:</span>
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>{fmt(item.pago + item.aPagar)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* VISÃO TABELA ANALÍTICA DE LANÇAMENTOS */
        loading ? (
          <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando lançamentos...</p>
        ) : (
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.bgWhite, borderBottom: `2px solid ${C.border}` }}>
                  {(modoExportacao || modoSelecao) && (
                    <th style={{ padding: '11px 10px', textAlign: 'center', width: 40, borderBottom: `2px solid ${C.border}` }}>
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selecionadasContas.length === filtered.length}
                        onChange={() => selecionarTodasContas(filtered)}
                        title={selecionadasContas.length === filtered.length ? 'Desmarcar todos' : 'Marcar todos os filtrados'}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: C.amber }}
                      />
                    </th>
                  )}
                  {['Código / Tipo', 'Descrição & Vínculo', 'Empresa / Obra', 'Fornecedor', 'Vencimento', 'Valor', 'Status', 'Ações'].map(h => {
                    const isAcoes = h === 'Ações'
                    return (
                      <th
                        key={h}
                        style={{
                          padding: '9px 8px',
                          textAlign: 'left',
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.inkSoft,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          whiteSpace: 'nowrap',
                          borderBottom: `2px solid ${C.border}`,
                          ...(isAcoes ? {
                            position: 'sticky',
                            right: 0,
                            background: C.bgWhite,
                            borderLeft: `1px solid ${C.border}`,
                            zIndex: 10
                          } : {})
                        }}
                      >
                        {h}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {contasExibidas.map(c => {
                  const dataReferencia = c.tipo === 'pagar' ? (c.data_vencimento || c.data_previsao) : (c.data_previsao || c.data_vencimento)
                  const dataPrevisao = dataReferencia || ''
                  const venc = isVencido(dataReferencia || '', c.status)
                  const pago = c.status === 'Pago' || c.status === 'Pago sem Nota Fiscal'
                  const pagoParcial = c.status === 'Pago Parcial'
                  const aguardandoAprovacao = c.status === 'Bloqueado' || c.status === 'Aguardando aprovação'
                  
                  const isExpanded = expandedContaId === c.id
                  const historico = c.historico_negociacao || []
                  
                  // Ignora histórico antes da última restauração
                  const indexUltimaRestauracao = [...historico].reverse().findIndex(h => h.tipo === 'restauracao' || h.descricao?.includes('🔄 Acordo cancelado'))
                  const historicoAtivo = indexUltimaRestauracao !== -1 
                    ? historico.slice(historico.length - indexUltimaRestauracao) 
                    : historico

                  const totalPagoHistorico = historicoAtivo.reduce((acc, h) => {
                    const val = Number(h.valor_pago || (h.tipo === 'pagamento_parcial' ? h.valor_novo : 0) || 0)
                    return acc + (val > 0 ? val : 0)
                  }, 0)

                  const ultimoDesconto = [...historicoAtivo].reverse().find(h => h.tipo === 'desconto' && h.valor_novo)
                  const valorBase = ultimoDesconto?.valor_novo !== undefined ? Number(ultimoDesconto.valor_novo) : Number(c.valor || 0)
                  const totalAbatido = Math.min(valorBase, totalPagoHistorico)
                  const valorCheioAbatido = Math.max(0, valorBase - totalAbatido)

                  const ultimaNegociacao = [...historico].reverse().find(h => Number(h.valor_pago || 0) > 0 || Number(h.valor_novo || 0) > 0)
                  const valorNegociadoHoje = ultimaNegociacao ? (Number(ultimaNegociacao.valor_pago || 0) || Number(ultimaNegociacao.valor_novo || 0)) : undefined

                  const isSelected = selecionadasContas.includes(c.id)

                  return (
                    <Fragment key={c.id}>
                      <tr 
                        onClick={() => setExpandedContaId(isExpanded ? null : c.id)}
                        style={{ 
                          borderBottom: isExpanded ? 'none' : `1px solid ${C.border}`, 
                          background: isSelected ? 'rgba(245, 158, 11, 0.08)' : c.status === 'Bloqueado' ? '#F9731610' : c.status === 'Aguardando aprovação' ? '#F59E0B08' : (isExpanded ? C.bgWhite : 'transparent'),
                          borderLeft: isSelected ? `3px solid ${C.amber}` : c.status === 'Bloqueado' ? '3px solid #F97316' : c.status === 'Aguardando aprovação' ? '3px solid #F59E0B' : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {(modoExportacao || modoSelecao) && (
                          <td style={{ padding: '12px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selecionadasContas.includes(c.id)}
                              onChange={() => toggleContaSelecionada(c.id)}
                              style={{ cursor: 'pointer', width: 15, height: 15, accentColor: C.amber }}
                            />
                          </td>
                        )}
                        {/* Código & Tipo Unificados */}
                        <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 4, background: c.tipo === 'receber' ? '#34D39918' : '#F8717118', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title={c.tipo === 'receber' ? 'Recebimento' : 'Pagamento'}>
                              {c.tipo === 'receber' ? <ArrowUpRight size={12} color="#34D399" /> : <ArrowDownRight size={12} color="#F87171" />}
                            </div>
                            <span style={{ fontSize: 9.5, fontWeight: 800, background: 'rgba(245, 158, 11, 0.1)', color: c.tipo === 'receber' ? '#10B981' : C.amber, border: `1px solid rgba(245, 158, 11, 0.3)`, padding: '2px 5px', borderRadius: 4, letterSpacing: 0.3, fontFamily: 'monospace' }}>
                              {fmtCodigo(c) || `#${c.id.slice(0, 5)}`}
                            </span>
                          </div>
                        </td>
                        {/* Descrição & Vínculo */}
                        <td style={{ padding: '8px 8px', color: C.ink, fontWeight: 600, maxWidth: 200, fontSize: 11.5 }}>
                          <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span>{c.descricao}</span>
                            {(() => {
                              const anexos = parseAnexos(c.comprovante_url)
                              if (anexos.length === 0) return null
                              return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                                  {anexos.map((url, idx) => (
                                    <a
                                      key={idx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={`Abrir Anexo ${idx + 1}`}
                                      onClick={e => e.stopPropagation()}
                                      style={{ color: C.amber, display: 'inline-flex', alignItems: 'center', gap: 2, textDecoration: 'none', background: 'rgba(245, 158, 11, 0.12)', padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}
                                    >
                                      <Eye size={11} />
                                      <span>{anexos.length > 1 ? `${idx + 1}` : ''}</span>
                                    </a>
                                  ))}
                                </div>
                              )
                            })()}
                          </div>
                          {c.categoria && (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: C.inkSoft, background: '#ffffff0a', padding: '1px 6px', borderRadius: 3 }}>
                                {c.categoria}
                              </span>
                            </div>
                          )}
                          {c.observacoes && (
                            <div style={{ marginTop: 6 }} onClick={e => e.stopPropagation()}>
                              <ObservacaoExpandivel text={c.observacoes} maxLength={55} />
                            </div>
                          )}
                        </td>
                        {/* Empresa / Obra */}
                        <td style={{ padding: '8px 8px', color: C.inkSoft }}>
                          <div style={{ borderLeft: `2px solid ${c.empresa?.cor ?? '#fff'}`, paddingLeft: 6, fontWeight: 600, color: C.ink }}>
                            {c.empresa?.nome_fantasia ?? c.empresa?.razao_social ?? '—'}
                          </div>
                          {c.obra && (
                            <div style={{ fontSize: 10, color: C.amber, paddingLeft: 6, marginTop: 2 }}>
                              Obra: {c.obra.nome}
                            </div>
                          )}
                        </td>
                        {/* Fornecedor & Domicílio Bancário */}
                        <td style={{ padding: '8px 8px', color: C.inkSoft, maxWidth: 150, fontSize: 11, wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 600, color: C.ink }}>{c.fornecedor?.razao_social ?? c.fornecedor?.nome_fantasia ?? 'Geral'}</div>
                          {c.fornecedor?.pix && <div style={{ fontSize: 10, color: '#34D399', marginTop: 2 }}>PIX: {c.fornecedor.pix}</div>}
                          {(c.fornecedor?.banco) && <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                            Bc: {c.fornecedor.banco} {c.fornecedor.agencia ? `Ag: ${c.fornecedor.agencia}` : ''} {c.fornecedor.conta ? `Cc: ${c.fornecedor.conta}` : ''}
                          </div>}
                        </td>
                        {/* Vencimento */}
                        <td style={{ padding: '8px 8px', color: venc ? '#F87171' : C.inkSoft, whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: venc ? '#EF4444' : C.ink }}>{fmtDate(dataPrevisao)}</div>
                          {venc && <div style={{ fontSize: 8.5, fontWeight: 900, color: '#EF4444' }}>ATRASADO</div>}
                        </td>
                        {/* Valor */}
                        <td style={{ padding: '8px 8px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          <div style={{ color: c.tipo === 'receber' ? '#34D399' : '#F87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
                            <span>{fmt((pagoParcial || totalPagoHistorico > 0) ? valorCheioAbatido : valorBase)}</span>
                            {ultimoDesconto?.valor_novo !== undefined && (
                              <span style={{ fontSize: 9, color: '#34D399', background: '#34D39918', border: '1px solid #34D39933', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                                C/ Desconto
                              </span>
                            )}
                          </div>
                          {valorNegociadoHoje !== undefined && valorNegociadoHoje > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ fontSize: 10, color: C.amber, fontWeight: 800 }}>
                                {c.tipo === 'receber' ? 'A receber (hoje): ' : 'A pagar (hoje): '}{fmt(valorNegociadoHoje)}
                              </div>
                            </div>
                          )}
                        </td>
                        {/* Status */}
                        <td style={{ padding: '8px 8px' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                            letterSpacing: 0.4,
                            background: c.status === 'Bloqueado' ? '#F9731622' : c.status === 'Aguardando aprovação' ? '#F59E0B20' : c.status === 'Negado' ? '#F8717120' : pago ? '#34D39920' : pagoParcial ? '#F59E0B20' : venc ? '#F8717120' : C.amber + '20',
                            color: c.status === 'Bloqueado' ? '#FB923C' : c.status === 'Aguardando aprovação' ? '#F59E0B' : c.status === 'Negado' ? '#F87171' : pago ? '#34D399' : pagoParcial ? '#F59E0B' : venc ? '#F87171' : C.amber,
                            border: c.status === 'Bloqueado' ? '1px solid #F9731666' : c.status === 'Aguardando aprovação' ? '1px solid #F59E0B44' : 'none',
                            boxShadow: c.status === 'Bloqueado' ? '0 0 8px #F9731633' : 'none'
                          }}>
                            {c.status === 'Bloqueado' ? 'BLOQUEADO' : c.status === 'Aguardando aprovação' ? 'AGUARDANDO APROVAÇÃO' : c.status === 'Pago sem Nota Fiscal' ? 'PAGA S/NF' : (c.status || 'LANÇADO').toUpperCase()}
                          </span>
                          {c.criado_por && (
                            <div style={{ fontSize: 9, color: C.inkSoft, marginTop: 4 }}>
                              Por: {c.criado_por}
                            </div>
                          )}
                        </td>
                        {/* Ações */}
                        <td
                          style={{
                            padding: '10px 14px',
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            right: 0,
                            background: isExpanded ? C.bgWhite : C.bgPanel,
                            borderLeft: `1px solid ${C.border}`,
                            zIndex: 5
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {podeAlterarStatus && (
                              <select aria-label="Alterar status" value={c.status} onChange={e => void alterarStatus(c.id, e.target.value as ContaComRelacoes['status'])} style={{ ...input, width: 100, padding: '3px 4px', fontSize: 9.5 }}>
                                <option value="Lançado">Lançado</option>
                                <option value="Bloqueado">Bloqueado</option>
                                <option value="Aguardando aprovação">Aguardando aprovação</option>
                                <option value="Liberado/OK">Liberado/OK</option>
                                <option value="A pagar">A pagar</option>
                                <option value="Pago Parcial">Pago Parcial</option>
                                <option value="Pago">Pago</option>
                                <option value="Pago sem Nota Fiscal">Paga S/NF</option>
                                <option value="Negado">Negado</option>
                              </select>
                            )}

                            {c.is_privada && (
                              <button onClick={() => setAcessosContaPrivada(c)} title="Gerenciar Acessos" style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', padding: 4 }}>
                                <Shield size={13} />
                              </button>
                            )}
                            {podeEditar && (
                              <button onClick={() => iniciarEdicao(c)} title="Editar Lançamento" style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                                <Edit3 size={13} />
                              </button>
                            )}
                            <label title="Anexar Comprovantes / Documentos" style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', padding: 4 }}>
                              <Paperclip size={13} />
                              <input hidden type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={e => { const files = e.target.files; if(files && files.length > 0) void anexarComprovantePosterior(c.id, c.empresa_id, files); e.currentTarget.value = '' }} />
                            </label>
                            {podeDeletar && (
                              <button onClick={() => excluir(c.id)} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}><X size={13} /></button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expansion Row */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bgWhite }}>
                            <td colSpan={(modoExportacao || modoSelecao) ? 9 : 8} style={{ padding: 0 }}>
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{
                                  position: 'sticky',
                                  left: 0,
                                  maxWidth: 'calc(100vw - 320px)',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  padding: '20px 24px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 18,
                                  background: C.bgWhite
                                }}>
                                  {/* Standard Details */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                                    <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                                      <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800 }}>Data e Horário do Lançamento</div>
                                      <div style={{ fontSize: 13, color: C.ink, marginTop: 6, fontWeight: 600 }}>
                                        {c.created_at ? new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                      </div>
                                      {c.criado_por && (
                                        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                                          Lançado por: <strong style={{ color: C.ink }}>{c.criado_por}</strong>
                                        </div>
                                      )}
                                      {c.aprovado_por && (
                                        <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 700 }}>
                                          ✓ Aprovado por: {c.aprovado_por}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                                      <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800 }}>Observações do Lançamento</div>
                                      <div style={{ marginTop: 6 }}>
                                        <ObservacaoExpandivel text={c.observacoes} maxLength={120} showTitleLabel={false} />
                                      </div>
                                    </div>

                                    <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                                      <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>
                                        Documentos Anexados ({parseAnexos(c.comprovante_url).length})
                                      </div>
                                      {(() => {
                                        const anexos = parseAnexos(c.comprovante_url)
                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {anexos.length > 0 ? (
                                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                {anexos.map((url, idx) => {
                                                  const isImg = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url)
                                                  return (
                                                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '5px 10px', borderRadius: 6 }}>
                                                      <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ ...btnGhost, fontSize: 11, color: C.amber, border: 'none', padding: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                                                      >
                                                        <Paperclip size={13} />
                                                        <span>{isImg ? `Imagem ${idx + 1}` : `Documento ${idx + 1}`} ↗</span>
                                                      </a>
                                                      <button
                                                        type="button"
                                                        onClick={() => void removerAnexoPosterior(c.id, url)}
                                                        title="Remover este anexo"
                                                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                                                      >
                                                        <X size={12} />
                                                      </button>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            ) : (
                                              <div style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: 'italic' }}>Nenhum documento anexado.</div>
                                            )}

                                            <label style={{ ...btnGhost, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: C.amber, border: `1px solid ${C.amber}66`, padding: '6px 12px', alignSelf: 'flex-start', marginTop: 4, background: C.bgWhite }}>
                                              <Paperclip size={13} /> + Adicionar Anexo(s)
                                              <input
                                                hidden
                                                type="file"
                                                multiple
                                                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                                                onChange={e => {
                                                  const files = e.target.files
                                                  if (files && files.length > 0) void anexarComprovantePosterior(c.id, c.empresa_id, files)
                                                  e.currentTarget.value = ''
                                                }}
                                              />
                                            </label>
                                          </div>
                                        )
                                      })()}
                                    </div>

                                    <div style={{ background: C.bgPanel, padding: 14, borderRadius: 8, border: `1px solid ${C.border}` }}>
                                      <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>Resumo Financeiro</div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft, marginBottom: 5 }}>
                                        <span>Valor Original:</span>
                                        <span style={{ fontWeight: 700, color: C.ink }}>{fmt(c.valor)}</span>
                                      </div>
                                      {ultimoDesconto?.valor_novo !== undefined && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#059669', marginBottom: 5, fontWeight: 700 }}>
                                          <span>Valor c/ Desconto:</span>
                                          <span>{fmt(Number(ultimoDesconto.valor_novo))}</span>
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#059669', marginBottom: 5 }}>
                                        <span>Total Pago (Amortizado):</span>
                                        <span style={{ fontWeight: 700 }}>{fmt(totalAbatido)}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.amber, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                                        <span>{c.tipo === 'receber' ? 'Saldo a Receber:' : 'Saldo a Pagar:'}</span>
                                        <span style={{ fontFamily: 'monospace' }}>{fmt(valorCheioAbatido)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Negotiation Panel */}
                                  {(isAdminGeral || podePagar || podeAprovar || podeLancar || colaboradorAtivo.cargo === 'admin_empresa') && (
                                    <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <Shield size={16} color={C.amber} />
                                          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: C.ink }}>Gestão de Pagamentos Parciais & Acordos</h3>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => openRestaurarValorCheioModal(c)}
                                          style={{ ...btnGhost, fontSize: 10, padding: '4px 10px', borderColor: C.amber, color: C.amber, display: 'inline-flex', alignItems: 'center', gap: 5, background: C.bgWhite }}
                                        >
                                          <RefreshCw size={11} /> Restaurar Valor Cheio
                                        </button>
                                      </div>
                                      
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, alignItems: 'start' }}>
                                        {/* Left: Nova Negociação */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: C.bgWhite, padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
                                          <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>Registrar Nova Negociação</div>
                                          
                                          <select 
                                            style={input} 
                                            value={formNegociacao.tipo} 
                                            onChange={e => setFormNegociacao(f => ({ ...f, tipo: e.target.value as any, valor_pago: '', valor_novo: '', nova_data: '' }))}
                                          >
                                            <option value="observacao">Apenas Observação / Registro</option>
                                            <option value="desconto">Acordo de Desconto</option>
                                            <option value="pagamento_parcial">Pagamento Parcial (Amortização)</option>
                                            <option value="prorrogacao">Prorrogação de Vencimento</option>
                                          </select>

                                          {formNegociacao.tipo === 'desconto' && (
                                            <input style={input} type="number" step="0.01" placeholder="Novo Valor Acordado (R$)" value={formNegociacao.valor_novo} onChange={e => setFormNegociacao(f => ({ ...f, valor_novo: e.target.value }))} />
                                          )}

                                          {formNegociacao.tipo === 'pagamento_parcial' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                              <input style={input} type="number" step="0.01" placeholder="Valor Pago Agora (R$)" value={formNegociacao.valor_pago} onChange={e => setFormNegociacao(f => ({ ...f, valor_pago: e.target.value }))} />
                                              {formNegociacao.valor_pago && (
                                                <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                                                  Saldo Devedor Calculado: {fmt(c.valor - Number(formNegociacao.valor_pago))}
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {formNegociacao.tipo === 'prorrogacao' && (
                                            <input style={input} type="date" placeholder="Nova Data" value={formNegociacao.nova_data} onChange={e => setFormNegociacao(f => ({ ...f, nova_data: e.target.value }))} />
                                          )}

                                          <textarea 
                                            style={{ ...input, resize: 'vertical', minHeight: 65 }} 
                                            placeholder="Histórico, justificativa ou observações do acordo..." 
                                            value={formNegociacao.descricao} 
                                            onChange={e => setFormNegociacao(f => ({ ...f, descricao: e.target.value }))} 
                                          />

                                          <button 
                                            onClick={() => void salvarNegociacao(c)} 
                                            disabled={savingNegociacao}
                                            style={{ ...btn(C.amber), alignSelf: 'flex-start' }}
                                          >
                                            {savingNegociacao ? 'Salvando...' : 'Salvar Registro'}
                                          </button>
                                        </div>

                                        {/* Right: Histórico */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                          <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            Histórico de Acordos & Movimentações
                                          </div>

                                          {(!c.historico_negociacao || c.historico_negociacao.length === 0) ? (
                                            <div style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: 'italic', padding: 16, background: C.bgWhite, borderRadius: 8, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                                              Nenhum acordo ou movimentação registrado para esta conta.
                                            </div>
                                          ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                                              {[...c.historico_negociacao].reverse().map(hist => {
                                                const isStatus = hist.tipo === 'alteracao_status'
                                                const borderColor = isStatus ? C.amber : hist.tipo === 'desconto' ? '#059669' : hist.tipo === 'pagamento_parcial' ? '#059669' : C.amber
                                                const tipoTitulo = isStatus ? 'Alteração de Status' : hist.tipo === 'desconto' ? 'Acordo de Desconto' : hist.tipo === 'pagamento_parcial' ? 'Pagamento Parcial' : hist.tipo === 'prorrogacao' ? 'Prorrogação' : 'Observação'
                                                return (
                                                  <div key={hist.id} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, padding: 12, borderRadius: 8, borderLeft: `3px solid ${borderColor}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                      <strong style={{ fontSize: 11.5, color: borderColor, fontWeight: 800 }}>
                                                        {tipoTitulo}
                                                      </strong>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: 10.5, color: C.inkSoft }}>
                                                          {new Date(hist.data).toLocaleDateString('pt-BR')} {new Date(hist.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {!isStatus && (
                                                          <>
                                                            <button
                                                              onClick={() => openEditNegociacao(c.id, hist)}
                                                              title="Editar negociação"
                                                              style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 2 }}
                                                            >
                                                              <Edit3 size={12} />
                                                            </button>
                                                            <button
                                                              onClick={() => void excluirNegociacaoItem(c, hist.id)}
                                                              title="Excluir negociação"
                                                              style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 2 }}
                                                            >
                                                              <X size={12} />
                                                            </button>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: C.ink, fontWeight: 700, marginBottom: 4 }}>
                                                      Por: {hist.autor || 'Usuário'}
                                                      {hist.editado_por && <span style={{ color: C.inkSoft, fontSize: 9.5, marginLeft: 6, fontWeight: 400 }}>(editado por {hist.editado_por})</span>}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{hist.descricao}</div>
                                                    
                                                    {hist.tipo === 'desconto' && hist.valor_novo && (
                                                      <div style={{ marginTop: 6, fontSize: 11, color: '#059669', fontWeight: 700 }}>Novo Valor: {fmt(hist.valor_novo)}</div>
                                                    )}
                                                    {hist.tipo === 'pagamento_parcial' && hist.valor_pago && (
                                                      <div style={{ marginTop: 6, fontSize: 11, color: '#059669', fontWeight: 700 }}>Pago: {fmt(hist.valor_pago)}</div>
                                                    )}
                                                    {hist.tipo === 'prorrogacao' && hist.nova_data && (
                                                      <div style={{ marginTop: 6, fontSize: 11, color: C.amber, fontWeight: 700 }}>Nova Data: {fmtDate(hist.nova_data)}</div>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px 14px', color: C.inkSoft, textAlign: 'center' }}>Nenhum lançamento financeiro encontrado.</td></tr>
                )}
              </tbody>
            </table>
            </div>

            {/* ── BARRA DE PAGINAÇÃO & CONTROLE DE PERFORMANCE ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 16px', background: C.bgPanel, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>
                  {filtered.length === 0 ? 'Nenhum lançamento encontrado' : (
                    itensPorPagina === 'todos' 
                      ? `Exibindo todos os ${filtered.length} lançamentos`
                      : `Exibindo ${(paginaAtual - 1) * Number(itensPorPagina) + 1}–${Math.min(paginaAtual * Number(itensPorPagina), filtered.length)} de ${filtered.length} lançamentos`
                  )}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.inkSoft }}>Por página:</span>
                  <select
                    value={itensPorPagina}
                    onChange={e => {
                      const val = e.target.value === 'todos' ? 'todos' : Number(e.target.value)
                      setItensPorPagina(val)
                      setPaginaAtual(1)
                    }}
                    style={{ ...input, width: 'auto', padding: '3px 8px', fontSize: 11, height: 28, background: C.bgWhite }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50 (Padrão)</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value="todos">Todos</option>
                  </select>
                </div>
              </div>

              {itensPorPagina !== 'todos' && totalPaginas > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPaginaAtual(1)}
                    style={{ ...btnGhost, padding: '4px 8px', fontSize: 11, opacity: paginaAtual <= 1 ? 0.4 : 1, cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer' }}
                    title="Primeira página"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                    style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, opacity: paginaAtual <= 1 ? 0.4 : 1, cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Anterior
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 2)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1]
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && <span style={{ fontSize: 11, color: C.inkSoft, padding: '0 2px' }}>...</span>}
                            <button
                              type="button"
                              onClick={() => setPaginaAtual(p)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: paginaAtual === p ? 800 : 600,
                                background: paginaAtual === p ? C.amber : C.bgWhite,
                                color: paginaAtual === p ? '#000' : C.ink,
                                border: `1px solid ${paginaAtual === p ? C.amber : C.border}`,
                                cursor: 'pointer'
                              }}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        )
                      })}
                  </div>

                  <button
                    type="button"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                    style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, opacity: paginaAtual >= totalPaginas ? 0.4 : 1, cursor: paginaAtual >= totalPaginas ? 'not-allowed' : 'pointer' }}
                  >
                    Próxima
                  </button>
                  <button
                    type="button"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPaginaAtual(totalPaginas)}
                    style={{ ...btnGhost, padding: '4px 8px', fontSize: 11, opacity: paginaAtual >= totalPaginas ? 0.4 : 1, cursor: paginaAtual >= totalPaginas ? 'not-allowed' : 'pointer' }}
                    title="Última página"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}
      
      {/* Modal de Edição de Conta Completa */}
      {editandoConta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ ...card, padding: 24, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink }}>✏️ Editar Lançamento Financeiro</h3>
              <button onClick={() => setEditandoConta(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              {/* Tipo de Lançamento */}
              <div style={{ display: 'flex', gap: 10 }}>
                {(['pagar','receber'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormEdicao(f => ({ ...f, tipo: t }))}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 11,
                      border: `1px solid ${formEdicao.tipo === t ? (t === 'pagar' ? '#F87171' : '#34D399') : C.border}`,
                      background: formEdicao.tipo === t ? (t === 'pagar' ? '#F8717118' : '#34D39918') : 'none',
                      color: formEdicao.tipo === t ? (t === 'pagar' ? '#F87171' : '#34D399') : C.inkSoft,
                      textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {t === 'pagar' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                    Conta a {t === 'pagar' ? 'Pagar' : 'Receber'}
                  </button>
                ))}
              </div>

              {/* Empresa & Obra */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Empresa *</label>
                  <select
                    style={input}
                    value={formEdicao.empresa_id || ''}
                    onChange={e => setFormEdicao(f => ({ ...f, empresa_id: e.target.value }))}
                  >
                    <option value="">Selecione a empresa</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={label}>Obra Vinculada</label>
                  <select style={input} value={formEdicao.obra_id || ''} onChange={e => setFormEdicao(f => ({ ...f, obra_id: e.target.value }))}>
                    {(() => {
                      const temGeral = colaboradorAtivo.cargo === 'admin_geral' || (colaboradorAtivo.obras_ids || []).includes('geral') || obras.some(o => o.id === 'geral')
                      const dbObras = obras.filter(o => o.id !== 'geral')
                      return (
                        <>
                          {temGeral ? (
                            <option value="">Geral / Administrativo</option>
                          ) : (
                            <option value="">Selecione a Obra</option>
                          )}
                          {dbObras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </>
                      )
                    })()}
                  </select>
                </div>
              </div>

              {/* Fornecedor */}
              <div>
                <label style={label}>Fornecedor</label>
                <select style={input} value={formEdicao.fornecedor_id || ''} onChange={e => setFormEdicao(f => ({ ...f, fornecedor_id: e.target.value }))}>
                  <option value="">Sem Fornecedor / Outros</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social ?? f.nome_fantasia}</option>)}
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label style={label}>Descrição do Lançamento *</label>
                <input style={input} value={formEdicao.descricao || ''} onChange={e => setFormEdicao(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: NF Cimento CP-II" />
              </div>

              {/* Valor & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Valor (R$) *</label>
                  <input style={input} type="number" step="0.01" value={formEdicao.valor ?? ''} onChange={e => setFormEdicao(f => ({ ...f, valor: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={label}>Status</label>
                  <select style={input} value={formEdicao.status || ''} onChange={e => setFormEdicao(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="Lançado">Lançado</option>
                    <option value="Bloqueado">Bloqueado</option>
                    <option value="Aguardando aprovação">Aguardando aprovação</option>
                    <option value="Liberado/OK">Liberado/OK</option>
                    <option value="A pagar">A pagar</option>
                    <option value="Pago Parcial">Pago Parcial</option>
                    <option value="Pago">Pago</option>
                    <option value="Negado">Negado</option>
                  </select>
                </div>
              </div>

              {/* Categoria, Previsão e Vencimento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Categoria</label>
                  <select style={input} value={formEdicao.categoria || ''} onChange={e => setFormEdicao(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Selecione a categoria</option>
                    {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Data Previsão</label>
                  <input style={input} type="date" value={formEdicao.data_previsao || ''} onChange={e => setFormEdicao(f => ({ ...f, data_previsao: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Vencimento</label>
                  <input style={input} type="date" value={formEdicao.data_vencimento || ''} onChange={e => setFormEdicao(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
              </div>

              {/* Recorrência */}
              <div>
                <label style={label}>Recorrência</label>
                <select style={input} value={formEdicao.recorrencia || 'unico'} onChange={e => setFormEdicao(f => ({ ...f, recorrencia: e.target.value as any }))}>
                  <option value="unico">Lançamento Único</option>
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>

              {/* Observações */}
              <div>
                <label style={label}>Observações / Anotações</label>
                <textarea
                  style={{ ...input, height: 64, resize: 'vertical' }}
                  value={formEdicao.observacoes || ''}
                  onChange={e => setFormEdicao(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Anotações adicionais do lançamento..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: formEdicao.is_privada ? '#F59E0B11' : '#111', border: `1px solid ${formEdicao.is_privada ? '#F59E0B44' : C.border}`, borderRadius: 8, cursor: 'pointer', marginBottom: formEdicao.is_privada ? 6 : 20 }} onClick={() => setFormEdicao(f => ({ ...f, is_privada: !f.is_privada, usuarios_permitidos: !f.is_privada ? Array.from(new Set([...(f.usuarios_permitidos || []), colaboradorAtivo.id])) : [] }))}>
              <div style={{ width: 16, height: 16, border: `1px solid ${formEdicao.is_privada ? C.amber : C.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: formEdicao.is_privada ? C.amber : 'transparent' }}>
                {formEdicao.is_privada && <Check size={12} color="#000" />}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: formEdicao.is_privada ? C.amber : C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={14} /> Lançamento Confidencial / Privado
                </span>
                <span style={{ fontSize: 10, color: C.inkSoft, display: 'block', marginTop: 2 }}>Apenas o Admin Geral e as pessoas que você marcar poderão ver este lançamento.</span>
              </div>
            </div>

            {formEdicao.is_privada && (
              <div style={{ background: '#12141C', padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>Marque quem poderá visualizar este lançamento:</div>
                {colaboradores.map(colab => {
                  const isPermitido = (formEdicao.usuarios_permitidos || []).includes(colab.id);
                  const isAdmin = colab.cargo === 'admin_geral';
                  return (
                    <label key={colab.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 6, background: isPermitido ? '#34D39910' : 'transparent', border: `1px solid ${isPermitido ? '#34D39930' : 'transparent'}`, cursor: isAdmin ? 'not-allowed' : 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={isPermitido || isAdmin} 
                        disabled={isAdmin}
                        onChange={() => {
                          if (isAdmin) return
                          setFormEdicao(f => {
                            const atuais = f.usuarios_permitidos || []
                            return { ...f, usuarios_permitidos: atuais.includes(colab.id) ? atuais.filter(x => x !== colab.id) : [...atuais, colab.id] }
                          })
                        }} 
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, color: isPermitido || isAdmin ? '#34D399' : C.ink }}>{colab.nome}</span>
                        <span style={{ fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>({colab.cargo.replace('_', ' ')})</span>
                        {isAdmin && <span style={{ fontSize: 10, marginLeft: 8, color: C.amber }}>(Acesso obrigatório)</span>}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setEditandoConta(null)} style={{ ...btnGhost, color: C.inkSoft }}>Cancelar</button>
              <button onClick={() => void salvarEdicaoConta()} style={btn(C.amber)}>Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Registro de Negociação */}
      {editingNegociacaoItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ ...card, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                ✏️ Editar Registro de Negociação
              </h3>
              <button onClick={() => setEditingNegociacaoItem(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={label}>Tipo de Registro</label>
                <select
                  style={input}
                  value={formEditNegociacao.tipo}
                  onChange={e => setFormEditNegociacao({ ...formEditNegociacao, tipo: e.target.value })}
                >
                  <option value="observacao">📝 Observação / Registro</option>
                  <option value="desconto">💰 Desconto / Novo Valor Negociado</option>
                  <option value="pagamento_parcial">💳 Pagamento Parcial</option>
                  <option value="prorrogacao">📆 Prorrogação de Vencimento</option>
                </select>
              </div>

              {formEditNegociacao.tipo === 'desconto' && (
                <div>
                  <label style={label}>Novo Valor Negociado (R$)</label>
                  <input
                    style={input}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formEditNegociacao.valor_novo}
                    onChange={e => setFormEditNegociacao({ ...formEditNegociacao, valor_novo: e.target.value })}
                  />
                </div>
              )}

              {formEditNegociacao.tipo === 'pagamento_parcial' && (
                <div>
                  <label style={label}>Valor Pago Parcialmente (R$)</label>
                  <input
                    style={input}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formEditNegociacao.valor_pago}
                    onChange={e => setFormEditNegociacao({ ...formEditNegociacao, valor_pago: e.target.value })}
                  />
                </div>
              )}

              {formEditNegociacao.tipo === 'prorrogacao' && (
                <div>
                  <label style={label}>Nova Data Prorrogada</label>
                  <input
                    style={input}
                    type="date"
                    value={formEditNegociacao.nova_data}
                    onChange={e => setFormEditNegociacao({ ...formEditNegociacao, nova_data: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label style={label}>Descrição / Detalhes da Negociação</label>
                <textarea
                  style={{ ...input, minHeight: 70, resize: 'vertical' }}
                  value={formEditNegociacao.descricao}
                  onChange={e => setFormEditNegociacao({ ...formEditNegociacao, descricao: e.target.value })}
                  placeholder="Informe os detalhes do acordo..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={btnGhost} onClick={() => setEditingNegociacaoItem(null)} disabled={savingEditNegociacao}>
                Cancelar
              </button>
              <button style={btn()} onClick={() => void salvarEdicaoNegociacao()} disabled={savingEditNegociacao}>
                {savingEditNegociacao ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restauração de Valor Cheio (Cancelar Acordo) */}
      {restaurarContaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ ...card, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: C.amber, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={16} /> Cancelar Acordo & Restaurar Valor Cheio
              </h3>
              <button onClick={() => setRestaurarContaModal(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
            </div>

            <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.06)', border: `1px solid ${C.amber}33`, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                {restaurarContaModal.descricao}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>
                {restaurarContaModal.fornecedor?.razao_social || restaurarContaModal.fornecedor?.nome_fantasia || 'Sem fornecedor'} · Valor Atual: <span style={{ color: C.amber, fontWeight: 800 }}>{fmt(restaurarContaModal.valor)}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={label}>Informe o Valor Cheio Original (R$) *</label>
                <input
                  style={input}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formRestaurarValor}
                  onChange={e => setFormRestaurarValor(e.target.value)}
                />
              </div>

              <div>
                <label style={label}>Motivo / Justificativa do Cancelamento do Acordo (Opcional)</label>
                <textarea
                  style={{ ...input, minHeight: 65, resize: 'vertical' }}
                  value={formRestaurarObs}
                  onChange={e => setFormRestaurarObs(e.target.value)}
                  placeholder="Ex: Fornecedor não aceitou o parcelamento e solicitou pagamento integral..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <button style={btnGhost} onClick={() => setRestaurarContaModal(null)} disabled={savingRestaurar}>
                Cancelar
              </button>
              <button style={btn(C.amber)} onClick={() => void confirmarRestaurarValorCheio()} disabled={savingRestaurar}>
                {savingRestaurar ? 'Restaurando...' : 'Confirmar e Restaurar Valor Cheio'}
              </button>
            </div>
          </div>
        </div>
      )}
      {acessosContaPrivada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setAcessosContaPrivada(null)}>
          <div style={{ ...card, background: C.bgPanel, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color={C.amber} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.ink }}>Gerenciar Acessos</h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: 11.5, color: C.inkSoft }}>Lançamento Confidencial: {acessosContaPrivada.descricao}</p>
                </div>
              </div>
              <button onClick={() => setAcessosContaPrivada(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
            </div>
            <div style={{ background: C.bgWhite, padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
              {colaboradores.map(colab => {
                const isPermitido = acessosContaPrivada.usuarios_permitidos?.includes(colab.id) || false;
                const isAdmin = colab.cargo === 'admin_geral';
                return (
                  <label key={colab.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: isPermitido || isAdmin ? '#F59E0B12' : 'transparent', border: `1px solid ${isPermitido || isAdmin ? '#F59E0B33' : 'transparent'}`, cursor: isAdmin ? 'not-allowed' : 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isPermitido || isAdmin} 
                      disabled={isAdmin}
                      onChange={() => toggleAcessoColaboradorContaPrivada(colab.id)} 
                      style={{ cursor: isAdmin ? 'not-allowed' : 'pointer', accentColor: C.amber }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12.5, fontWeight: isPermitido || isAdmin ? 700 : 500, color: C.ink }}>{colab.nome}</span>
                      <span style={{ fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>({colab.cargo.replace('_', ' ')})</span>
                      {isAdmin && <span style={{ fontSize: 10, marginLeft: 8, color: C.amber, fontWeight: 700 }}>(Acesso obrigatório)</span>}
                    </div>
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setAcessosContaPrivada(null)} style={{ ...btn(C.amber), padding: '7px 18px' }}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: USUÁRIOS, CARGOS & PERMISSÕES (ADMIN GERAL APENAS)
// ════════════════════════════════════════════════════════
interface PermissoesTabProps {
  colaboradorAtivo: Colaborador
  colaboradores: Colaborador[]
  onRefresh: () => Promise<void>
  confirm: (title: string, desc: string, options?: any) => Promise<boolean>
}

import type { SolicitacaoAcesso } from '@/lib/types'

const ALL_APPS = [
  { id: 'financeiro',   nome: 'Financeiro' },
  { id: 'ponto',        nome: 'Ponto & RH' },
  { id: 'suprimentos',  nome: 'Suprimentos' },
  { id: 'rdo',          nome: 'Diário de Obra' },
  { id: 'frota',        nome: 'Frota & GPS' },
]

function SeletorMultiEmpresas({
  empresas,
  selectedIds,
  onChange
}: {
  empresas: Empresa[]
  selectedIds: string[]
  onChange: (newIds: string[]) => void
}) {
  const todasSelecionadas = empresas.length > 0 && empresas.every(e => selectedIds.includes(e.id))

  const toggleAll = () => {
    if (todasSelecionadas) {
      onChange([])
    } else {
      onChange(empresas.map(e => e.id))
    }
  }

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, marginTop: 6, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft }}>
          EMPRESAS VINCULADAS ({selectedIds.length}/{empresas.length})
        </span>
        <button
          type="button"
          onClick={toggleAll}
          style={{ background: 'transparent', border: 0, color: C.amber, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
        >
          {todasSelecionadas ? 'Desmarcar todas' : '✓ Selecionar todas'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
        {empresas.map(emp => {
          const checked = selectedIds.includes(emp.id)
          return (
            <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: C.ink, cursor: 'pointer', background: checked ? '#F59E0B14' : '#FFFFFF05', padding: '5px 8px', borderRadius: 4, border: `1px solid ${checked ? '#F59E0B55' : 'transparent'}` }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(emp.id)}
                style={{ accentColor: C.amber, cursor: 'pointer' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.nome_fantasia ?? emp.razao_social}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function SeletorMultiObras({
  obras,
  selectedIds,
  onChange
}: {
  obras: Obra[]
  selectedIds: string[]
  onChange: (newIds: string[]) => void
}) {
  const todasSelecionadas = obras.length > 0 && obras.every(o => selectedIds.includes(o.id))

  const toggleAll = () => {
    if (todasSelecionadas) {
      onChange([])
    } else {
      onChange(obras.map(o => o.id))
    }
  }

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, marginTop: 6, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft }}>
          OBRAS VINCULADAS ({selectedIds.length}/{obras.length})
        </span>
        <button
          type="button"
          onClick={toggleAll}
          style={{ background: 'transparent', border: 0, color: C.amber, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
        >
          {todasSelecionadas ? 'Desmarcar todas' : '✓ Selecionar todas'}
        </button>
      </div>
      
      {obras.length === 0 ? (
        <div style={{ fontSize: 11, color: C.inkSoft, padding: '10px 0', textAlign: 'center' }}>Nenhuma obra cadastrada</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
          {obras.map(o => {
            const isSel = selectedIds.includes(o.id)
            return (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isSel ? C.amber : C.ink, cursor: 'pointer', background: isSel ? '#F59E0B11' : 'transparent', border: `1px solid ${isSel ? '#F59E0B44' : 'transparent'}`, padding: '4px 6px', borderRadius: 4 }}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggleOne(o.id)}
                  style={{ accentColor: C.amber, cursor: 'pointer' }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.nome}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PermissoesTab({ colaboradorAtivo, colaboradores, onRefresh, confirm }: PermissoesTabProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [configPermissoes, setConfigPermissoes] = useState<ConfigPermissao[]>([])
  const [cargos, setCargos] = useState<CargoSistema[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPerms, setSavingPerms] = useState<string | null>(null)
  const [globalLimite, setGlobalLimite] = useState<number>(0)
  const [savingGlobalLimite, setSavingGlobalLimite] = useState(false)
  const [editingCargoNome, setEditingCargoNome] = useState<string | null>(null)
  const [editingCargoNomeValue, setEditingCargoNomeValue] = useState('')
  const [savingCargoNome, setSavingCargoNome] = useState(false)
  
  // Busca & Filtros de Colaboradores
  const [searchColab, setSearchColab] = useState('')
  const [filterCargo, setFilterCargo] = useState('todos')
  const [cargoAtivoMatriz, setCargoAtivoMatriz] = useState<string>('todos')

  // States do Novo Colaborador & Novo Cargo
  const [showColForm, setShowColForm] = useState(false)
  const [savingCol, setSavingCol] = useState(false)
  const [showCargoForm, setShowCargoForm] = useState(false)
  const [savingCargo, setSavingCargo] = useState(false)
  const [cargoForm, setCargoForm] = useState({ codigo: '', nome: '', descricao: '', apps: 'financeiro,rh' })
  const [colForm, setColForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'operador',
    empresa_id: ''
  })

  // State para Edição de Colaborador Individual
  const [editColForm, setEditColForm] = useState<Colaborador | null>(null)
  const [savingEditCol, setSavingEditCol] = useState(false)

  // State para overrides de cargo e empresas nas solicitações pendentes
  const [solOverrides, setSolOverrides] = useState<Record<string, { cargo: string; empresas_ids: string[] }>>({})

  // Lista unificada de todos os cargos disponíveis
  const listaCargosDisponiveis = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string }>()
    
    Object.entries(NOMES_CARGOS).forEach(([codigo, nome]) => {
      map.set(codigo, { codigo, nome })
    })

    configPermissoes.forEach(cp => {
      if (!map.has(cp.cargo)) {
        map.set(cp.cargo, { codigo: cp.cargo, nome: NOMES_CARGOS[cp.cargo] || cp.cargo })
      }
    })

    cargos.forEach(c => {
      map.set(c.codigo, { codigo: c.codigo, nome: c.nome || NOMES_CARGOS[c.codigo] || c.codigo })
    })

    colaboradores.forEach(c => {
      if (c.cargo && !map.has(c.cargo)) {
        map.set(c.cargo, { codigo: c.cargo, nome: NOMES_CARGOS[c.cargo] || c.cargo })
      }
    })

    return Array.from(map.values())
  }, [cargos, configPermissoes, colaboradores])

  // Lista resiliente de configurações de permissões
  const listaConfigExibicao = useMemo(() => {
    const map = new Map<string, ConfigPermissao>()
    configPermissoes.forEach(cp => {
      map.set(cp.cargo, cp)
    })

    listaCargosDisponiveis.forEach(cargo => {
      if (!map.has(cargo.codigo)) {
        map.set(cargo.codigo, {
          cargo: cargo.codigo,
          pode_empresas: cargo.codigo === 'admin_geral',
          pode_fornecedores: true,
          pode_lancar: true,
          pode_pagar: cargo.codigo === 'admin_geral',
          pode_aprovar: cargo.codigo === 'admin_geral',
          limite_valor: cargo.codigo === 'admin_geral' ? 99999999 : 0,
          apps: 'financeiro',
          abas_financeiro: 'historico,contas,empresas,fornecedores,obras',
          pode_alterar_status: true,
          pode_excluir_lancamento: false,
        })
      }
    })

    return Array.from(map.values())
  }, [configPermissoes, listaCargosDisponiveis])

  useEffect(() => {
    if (colaboradorAtivo.cargo === 'admin_empresa' && colaboradorAtivo.empresa_id) {
      setColForm(f => ({
        ...f,
        cargo: 'operador',
        empresa_id: colaboradorAtivo.empresa_id || ''
      }))
    }
  }, [colaboradorAtivo])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: e }, { data: p }, { data: c }, { data: o }] = await Promise.all([
        supabase.from('empresas').select('*').order('razao_social'),
        supabase.from('config_permissoes').select('*').order('cargo'),
        supabase.from('cargos_sistema').select('*').eq('ativo', true).order('nome'),
        supabase.from('obras').select('*').order('nome')
      ])
      
      setEmpresas(e ?? [])
      setObras(o ?? [])
      setConfigPermissoes((p as ConfigPermissao[]) ?? [])
      setCargos((c as CargoSistema[]) ?? [])
      if (p && (p as ConfigPermissao[]).length > 0) {
        setGlobalLimite((p as ConfigPermissao[])[0].limite_valor || 0)
      }

      let querySol = supabase.from('solicitacoes_acesso').select('*').eq('status', 'pendente')
      if (colaboradorAtivo.cargo === 'admin_empresa' && colaboradorAtivo.empresa_id) {
        querySol = querySol.eq('empresa_id', colaboradorAtivo.empresa_id)
      }
      const { data: s } = await querySol.order('created_at', { ascending: false })
      setSolicitacoes((s as SolicitacaoAcesso[]) ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [colaboradorAtivo])

  useEffect(() => {
    loadData()
  }, [loadData])

  const criarCargo = async () => {
    if (!isGeral) return
    const codigo = cargoForm.codigo.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    const nome = cargoForm.nome.trim()
    if (!codigo || !nome) return toast('Informe o código e o nome do novo cargo.', 'error')
    if (['admin_geral', 'admin_empresa'].includes(codigo)) return toast('Este código é reservado.', 'error')
    setSavingCargo(true)
    const { error: cargoError } = await supabase.from('cargos_sistema').insert({ codigo, nome, descricao: cargoForm.descricao.trim() || null })
    if (cargoError) {
      setSavingCargo(false)
      return toast('Erro ao criar cargo: ' + cargoError.message, 'error')
    }
    const { error: permError } = await supabase.from('config_permissoes').insert({
      cargo: codigo,
      pode_empresas: false,
      pode_fornecedores: false,
      pode_lancar: true,
      pode_pagar: false,
      pode_aprovar: false,
      limite_valor: 0,
      apps: cargoForm.apps.trim() || 'financeiro',
      abas_financeiro: 'historico,contas',
      pode_alterar_status: true,
      pode_excluir_lancamento: false
    })
    if (permError) {
      await supabase.from('cargos_sistema').delete().eq('codigo', codigo)
      setSavingCargo(false)
      return toast('Cargo criado parcialmente: ' + permError.message, 'error')
    }
    setCargoForm({ codigo: '', nome: '', descricao: '', apps: 'financeiro,rh' })
    setShowCargoForm(false)
    setSavingCargo(false)
    await loadData()
    toast(`Cargo "${nome}" criado com sucesso!`, 'success')
  }

  const salvarConfigCargo = async (cargo: string, config: ConfigPermissao) => {
    setSavingPerms(cargo)
    await supabase.from('config_permissoes').update({
      pode_empresas: config.pode_empresas,
      pode_fornecedores: config.pode_fornecedores,
      pode_lancar: config.pode_lancar,
      pode_pagar: config.pode_pagar,
      pode_aprovar: config.pode_aprovar,
      limite_valor: Number(config.limite_valor),
      apps: config.apps,
      abas_financeiro: config.abas_financeiro || null,
      pode_alterar_status: config.pode_alterar_status ?? true,
      pode_excluir_lancamento: config.pode_excluir_lancamento ?? false,
    }).eq('cargo', cargo)
    
    await loadData()
    setSavingPerms(null)
    toast('Regras do cargo atualizadas!', 'success')
    onRefresh()
  }

  const salvarNomeCargo = async (codigo: string) => {
    if (!editingCargoNomeValue.trim()) return
    setSavingCargoNome(true)
    try {
      const { error } = await supabase
        .from('cargos_sistema')
        .update({ nome: editingCargoNomeValue.trim() })
        .eq('codigo', codigo)
      if (error) throw error
      toast('Nome do cargo atualizado!', 'success')
      setEditingCargoNome(null)
      await loadData()
    } catch (err: any) {
      toast('Erro ao atualizar nome: ' + (err?.message || err), 'error')
    } finally {
      setSavingCargoNome(false)
    }
  }

  const excluirCargo = async (codigo: string) => {
    if (['admin_geral', 'admin_empresa'].includes(codigo)) {
      return toast('Não é possível excluir cargos nativos do sistema.', 'error')
    }

    const cargoObj = cargos.find(c => c.codigo === codigo)
    const nomeCargo = cargoObj?.nome || NOMES_CARGOS[codigo] || codigo

    const colsAfetados = colaboradores.filter(c => c.cargo === codigo)
    if (colsAfetados.length > 0) {
      if (!(await confirm('Excluir Cargo', `Existem ${colsAfetados.length} colaborador(es) com o cargo "${nomeCargo}". Ao excluir, o cargo deles será alterado para "Operador". Deseja continuar?`, { confirmLabel: 'Continuar', confirmColor: C.red }))) {
        return
      }
    } else {
      if (!(await confirm('Excluir Cargo', `Tem certeza que deseja excluir o cargo "${nomeCargo}"?`, { confirmLabel: 'Excluir', confirmColor: C.red }))) return
    }

    try {
      setLoading(true)
      if (colsAfetados.length > 0) {
        await supabase
          .from('colaboradores')
          .update({ cargo: 'operador' })
          .eq('cargo', codigo)
      }

      await supabase.from('config_permissoes').delete().eq('cargo', codigo)
      await supabase.from('cargos_sistema').delete().eq('codigo', codigo)

      toast(`Cargo "${nomeCargo}" excluído!`, 'success')
      onRefresh()
      await loadData()
    } catch (err: any) {
      toast('Erro ao excluir cargo: ' + (err?.message || err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const criarColaborador = async () => {
    if (!colForm.nome.trim()) { toast('Informe o nome do colaborador.', 'error'); return }
    if (!colForm.email.trim()) { toast('Informe um e-mail para o colaborador.', 'error'); return }
    if (colForm.senha.trim().length < 8) { toast('Defina uma senha com no mínimo 8 caracteres.', 'error'); return }
    setSavingCol(true)
    
    const empresaIdDestino = colaboradorAtivo.cargo === 'admin_empresa'
      ? colaboradorAtivo.empresa_id 
      : colForm.cargo === 'admin_geral' ? null : (colForm.empresa_id || null)

    const { data: result, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'create_user', admin_id: colaboradorAtivo.id, nome: colForm.nome.trim(), email: colForm.email.trim().toLowerCase(), senha: colForm.senha, cargo: colForm.cargo, empresa_id: empresaIdDestino }
    })

    if (error || result?.error) {
      let detail = result?.error || error?.message || 'não foi possível concluir'
      toast('Erro ao criar colaborador: ' + detail, 'error')
    } else {
      setColForm({
        nome: '',
        email: '',
        senha: '',
        cargo: colaboradorAtivo.cargo === 'admin_empresa' ? 'operador' : 'operador',
        empresa_id: colaboradorAtivo.cargo === 'admin_empresa' ? (colaboradorAtivo.empresa_id || '') : ''
      })
      setShowColForm(false)
      toast('Colaborador criado com sucesso!', 'success')
      onRefresh()
      await loadData()
    }
    setSavingCol(false)
  }

  const handleSaveColaboradorPerms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editColForm) return
    setSavingEditCol(true)

    try {
      const selectedEmpresasIds = editColForm.empresas_ids || (editColForm.empresa_id ? [editColForm.empresa_id] : [])
      const mainEmpresaId = editColForm.cargo === 'admin_geral' ? null : (selectedEmpresasIds[0] || editColForm.empresa_id || null)

      const { error } = await supabase
        .from('colaboradores')
        .update({
          cargo: editColForm.cargo,
          empresa_id: mainEmpresaId,
          empresas_ids: editColForm.cargo === 'admin_geral' ? null : selectedEmpresasIds,
          override_permissoes: editColForm.override_permissoes,
          pode_empresas: editColForm.pode_empresas,
          pode_fornecedores: editColForm.pode_fornecedores,
          pode_lancar: editColForm.pode_lancar,
          pode_pagar: editColForm.pode_pagar,
          pode_aprovar: editColForm.pode_aprovar,
          limite_valor: Number(editColForm.limite_valor || 0),
          apps: editColForm.apps,
          abas_financeiro: editColForm.abas_financeiro || null,
          pode_alterar_status: editColForm.pode_alterar_status ?? true,
          pode_excluir_lancamento: editColForm.pode_excluir_lancamento ?? false,
          obras_ids: editColForm.cargo === 'admin_geral' ? null : (editColForm.obras_ids || []),
        })
        .eq('id', editColForm.id)

      if (error) throw error
      toast('Acessos atualizados para ' + editColForm.nome, 'success')
      setEditColForm(null)
      onRefresh()
      await loadData()
    } catch (err: any) {
      toast('Erro ao salvar permissões: ' + err.message, 'error')
    } finally {
      setSavingEditCol(false)
    }
  }

  const alterarCargoColaborador = async (id: string, novoCargo: string) => {
    try {
      const updateData: Record<string, string | string[] | null> = { cargo: novoCargo }
      if (novoCargo === 'admin_geral') {
        updateData.empresa_id = null
        updateData.empresas_ids = []
      }
      const { error } = await supabase
        .from('colaboradores')
        .update(updateData)
        .eq('id', id)

      if (error) throw error
      toast('Cargo alterado com sucesso!', 'success')
      await loadData()
      onRefresh()
    } catch (err: any) {
      toast('Erro ao alterar cargo: ' + (err?.message || err), 'error')
    }
  }

  const aprovarSolicitacao = async (sol: SolicitacaoAcesso) => {
    const override = solOverrides[sol.id]
    const cargoDefinido = override?.cargo || sol.cargo_solicitado
    const empresasIdsDefinidas = override?.empresas_ids !== undefined
      ? override.empresas_ids
      : (sol.empresas_ids || (sol.empresa_id ? [sol.empresa_id] : []))

    setLoading(true)
    try {
      const { data: result, error: functionError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create_user',
          admin_id: colaboradorAtivo.id,
          nome: sol.nome,
          email: sol.email,
          senha: sol.senha_provisoria,
          cargo: cargoDefinido,
          empresa_id: cargoDefinido === 'admin_geral' ? null : (empresasIdsDefinidas[0] ?? null),
          empresas_ids: cargoDefinido === 'admin_geral' ? null : (empresasIdsDefinidas.length > 0 ? empresasIdsDefinidas : null),
        }
      })

      if (functionError || result?.error) {
        let detail = result?.error || functionError?.message || 'não foi possível criar o colaborador'
        toast('Erro ao aprovar colaborador: ' + detail, 'error')
        setLoading(false)
        return
      }

      await supabase.from('solicitacoes_acesso').update({
        status: 'aprovado',
        aprovado_por: colaboradorAtivo.id,
        aprovado_em: new Date().toISOString()
      }).eq('id', sol.id)

      toast(`Acesso aprovado e conta criada para ${sol.nome}!`, 'success')
      onRefresh()
      await loadData()
    } catch (err: any) {
      toast('Erro na aprovação: ' + (err?.message || err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const rejeitarSolicitacao = async (id: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('solicitacoes_acesso').update({
        status: 'rejeitado',
        aprovado_por: colaboradorAtivo.id,
        aprovado_em: new Date().toISOString()
      }).eq('id', id)

      if (error) {
        toast('Erro ao rejeitar: ' + error.message, 'error')
        setLoading(false)
        return
      }

      toast('Solicitação de acesso rejeitada.', 'info')
      await loadData()
    } catch (err: any) {
      toast('Erro na rejeição: ' + (err?.message || err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const excluirColaborador = async (id: string) => {
    if (id === colaboradorAtivo.id) {
      toast('Você não pode excluir o usuário conectado.', 'error')
      return
    }

    const colabTarget = colaboradores.find(c => c.id === id)
    const nomeColab = colabTarget?.nome ? `"${colabTarget.nome}"` : 'este colaborador'

    const confirmado = await confirm(
      'Excluir Colaborador',
      `Tem certeza que deseja excluir ${nomeColab}? Esta ação removerá o acesso do usuário do sistema e não poderá ser desfeita.`,
      { confirmLabel: 'Excluir', confirmColor: C.red }
    )

    if (!confirmado) return

    setSavingCol(true)
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete_user', admin_id: colaboradorAtivo.id, collaborator_id: id }
      })
      if (error || result?.error) {
        let detail = result?.error || error?.message || 'nao foi possivel excluir'
        toast('Erro ao excluir colaborador: ' + detail, 'error')
        return
      }
      toast('Colaborador excluído com sucesso.', 'success')
      onRefresh()
      await loadData()
    } catch (err: any) {
      toast('Erro ao excluir: ' + (err?.message || err), 'error')
    } finally {
      setSavingCol(false)
    }
  }

  const handleToggle = (cargo: string, campo: keyof ConfigPermissao) => {
    setConfigPermissoes(prev => prev.map(c => {
      if (c.cargo === cargo) {
        return { ...c, [campo]: !c[campo] } as ConfigPermissao
      }
      return c
    }))
  }

  const handleToggleAppCargo = (cargo: string, appId: string) => {
    setConfigPermissoes(prev => prev.map(c => {
      if (c.cargo === cargo) {
        const appsList = c.apps ? c.apps.split(',').map((x: string) => x.trim()).filter(Boolean) : []
        let newAppsList: string[]
        if (appsList.includes(appId)) {
          newAppsList = appsList.filter((x: string) => x !== appId)
        } else {
          newAppsList = [...appsList, appId]
        }
        return { ...c, apps: newAppsList.join(',') }
      }
      return c
    }))
  }

  const handleToggleAppColaborador = (appId: string) => {
    if (!editColForm) return
    const appsList = editColForm.apps ? editColForm.apps.split(',').map((x: string) => x.trim()).filter(Boolean) : []
    let newAppsList: string[]
    if (appsList.includes(appId)) {
      newAppsList = appsList.filter((x: string) => x !== appId)
    } else {
      newAppsList = [...appsList, appId]
    }
    setEditColForm({
      ...editColForm,
      apps: newAppsList.join(',')
    })
  }

  const handleToggleAbaFinanceiro = (cargo: string, abaId: string) => {
    setConfigPermissoes(prev => prev.map(c => {
      if (c.cargo === cargo) {
        const abasList = c.abas_financeiro ? c.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
        const newAbasList = abasList.includes(abaId)
          ? abasList.filter((x: string) => x !== abaId)
          : [...abasList, abaId]
        return { ...c, abas_financeiro: newAbasList.join(',') }
      }
      return c
    }))
  }

  const handleToggleAbaFinanceiroColaborador = (abaId: string) => {
    if (!editColForm) return
    const abasList = editColForm.abas_financeiro ? editColForm.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
    const newAbasList = abasList.includes(abaId)
      ? abasList.filter((x: string) => x !== abaId)
      : [...abasList, abaId]
    setEditColForm({ ...editColForm, abas_financeiro: newAbasList.join(',') })
  }

  // Filtragem de colaboradores
  const colaboradoresFiltrados = useMemo(() => {
    return colaboradores.filter(c => {
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        const idsAtivo = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
        if (idsAtivo.length > 0) {
          const idsColab = c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])
          const matchEmpresa = idsColab.some(id => idsAtivo.includes(id)) || (c.empresa_id ? idsAtivo.includes(c.empresa_id) : false)
          if (!matchEmpresa) return false
        }
      }

      if (filterCargo !== 'todos' && c.cargo !== filterCargo) return false

      if (searchColab.trim()) {
        const q = searchColab.toLowerCase().trim()
        const matchNome = c.nome && c.nome.toLowerCase().includes(q)
        const matchEmail = c.email && c.email.toLowerCase().includes(q)
        const cargoNome = listaCargosDisponiveis.find(cargo => cargo.codigo === c.cargo)?.nome || ''
        const matchCargo = cargoNome.toLowerCase().includes(q)
        if (!matchNome && !matchEmail && !matchCargo) return false
      }

      return true
    })
  }, [colaboradores, colaboradorAtivo, filterCargo, searchColab, listaCargosDisponiveis])

  const isGeral = colaboradorAtivo.cargo === 'admin_geral'

  // Estatísticas de Gestão de Acessos
  const totalColabs = colaboradores.length
  const totalSolicitacoes = solicitacoes.length
  const totalCargos = listaCargosDisponiveis.length
  const totalAdmins = colaboradores.filter(c => c.cargo === 'admin_geral' || c.cargo === 'admin_empresa').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── KPI HEADER: VISÃO GERAL DE IDENTIDADE & ACESSOS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F59E0B15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} color={C.amber} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Colaboradores</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, marginTop: 1 }}>{totalColabs}</div>
          </div>
        </div>

        <div style={{ background: totalSolicitacoes > 0 ? '#F59E0B10' : C.bgPanel, border: `1px solid ${totalSolicitacoes > 0 ? C.amber : C.border}`, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: totalSolicitacoes > 0 ? '#F59E0B25' : C.bgWhite, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} color={totalSolicitacoes > 0 ? C.amber : C.inkSoft} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: totalSolicitacoes > 0 ? C.amber : C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Solicitações Pendentes</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: totalSolicitacoes > 0 ? C.amber : C.ink, marginTop: 1 }}>
              {totalSolicitacoes} {totalSolicitacoes > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', background: C.amber, color: '#000', borderRadius: 10, marginLeft: 6 }}>Requer Ação</span>}
            </div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#10B98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="#10B981" />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cargos & Perfis</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, marginTop: 1 }}>{totalCargos} perfis</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#6366F115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="#6366F1" />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Administradores</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, marginTop: 1 }}>{totalAdmins} gestores</div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO: NOVO CARGO (DRAWER / FORM) ── */}
      {isGeral && showCargoForm && (
        <div style={{ ...card, background: C.bgPanel, border: `1px solid ${C.amber}`, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={16} color={C.amber} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink }}>Criar Novo Perfil de Cargo</h4>
            </div>
            <button onClick={() => setShowCargoForm(false)} style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={label}>Código Interno *</label>
              <input style={input} value={cargoForm.codigo} onChange={e => setCargoForm({ ...cargoForm, codigo: e.target.value })} placeholder="ex: engenheiro_chefe" />
            </div>
            <div>
              <label style={label}>Nome de Exibição *</label>
              <input style={input} value={cargoForm.nome} onChange={e => setCargoForm({ ...cargoForm, nome: e.target.value })} placeholder="ex: Engenheiro Chefe" />
            </div>
            <div>
              <label style={label}>Descrição de Funções</label>
              <input style={input} value={cargoForm.descricao} onChange={e => setCargoForm({ ...cargoForm, descricao: e.target.value })} placeholder="ex: Aprovação técnica e medições" />
            </div>
            <div>
              <label style={label}>Módulos Iniciais</label>
              <input style={input} value={cargoForm.apps} onChange={e => setCargoForm({ ...cargoForm, apps: e.target.value })} placeholder="financeiro,rh,obras" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...btn(C.amber), flex: 1, padding: '9px 14px' }} disabled={savingCargo} onClick={() => void criarCargo()}>
                {savingCargo ? 'Salvando...' : 'Salvar Cargo'}
              </button>
              <button style={btnGhost} onClick={() => setShowCargoForm(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LAYOUT PRINCIPAL DE GESTÃO EM DUAS COLUNAS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1.1fr) minmax(360px, 0.9fr)', gap: 20, alignItems: 'start' }}>
        
        {/* ══ COLUNA ESQUERDA: COLABORADORES & SOLICITAÇÕES ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* SEÇÃO: SOLICITAÇÕES PENDENTES */}
          {solicitacoes.length > 0 && (
            <div style={{ background: '#F59E0B08', border: `1.5px solid ${C.amber}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.amber, animation: 'pulse 1.5s infinite' }} />
                  <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: C.ink }}>Solicitações de Acesso Pendentes ({solicitacoes.length})</h4>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.amber, background: '#F59E0B20', padding: '2px 8px', borderRadius: 4 }}>Ação Requerida</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {solicitacoes.map(sol => {
                  const currentOverride = solOverrides[sol.id]
                  const cargoSelecionado = currentOverride?.cargo || sol.cargo_solicitado
                  return (
                    <div key={sol.id} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: C.ink }}>{sol.nome}</div>
                          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                            {sol.email} · Pedido em: <strong>{new Date(sol.created_at).toLocaleDateString('pt-BR')}</strong>
                          </div>
                          {sol.mensagem && (
                            <div style={{ fontSize: 11, background: C.bgPanel, borderLeft: `3px solid ${C.amber}`, padding: '6px 10px', marginTop: 8, color: C.ink, borderRadius: '0 4px 4px 0' }}>
                              &ldquo;{sol.mensagem}&rdquo;
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase' }}>Atribuir Cargo:</span>
                              <select
                                value={cargoSelecionado}
                                onChange={e => setSolOverrides(prev => ({
                                  ...prev,
                                  [sol.id]: { cargo: e.target.value, empresas_ids: e.target.value === 'admin_geral' ? [] : (prev[sol.id]?.empresas_ids || (sol.empresas_ids || (sol.empresa_id ? [sol.empresa_id] : []))) }
                                }))}
                                style={{ ...input, width: 190, padding: '3px 8px', fontSize: 11, background: C.bgPanel }}
                              >
                                {listaCargosDisponiveis.map(cargo => (
                                  <option key={cargo.codigo} value={cargo.codigo}>{cargo.nome}</option>
                                ))}
                              </select>
                            </div>

                            {isGeral && cargoSelecionado !== 'admin_geral' && (
                              <SeletorMultiEmpresas
                                empresas={empresas}
                                selectedIds={currentOverride?.empresas_ids !== undefined ? currentOverride.empresas_ids : (sol.empresas_ids || (sol.empresa_id ? [sol.empresa_id] : []))}
                                onChange={newIds => setSolOverrides(prev => ({
                                  ...prev,
                                  [sol.id]: { cargo: prev[sol.id]?.cargo || sol.cargo_solicitado, empresas_ids: newIds }
                                }))}
                              />
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => aprovarSolicitacao(sol)}
                            style={{ ...btn('#059669'), padding: '6px 12px', fontSize: 11 }}
                          >
                            <Check size={13} /> Aprovar
                          </button>
                          <button
                            onClick={() => rejeitarSolicitacao(sol.id)}
                            style={{ ...btnGhost, borderColor: '#EF444455', color: '#EF4444', padding: '6px 10px', fontSize: 11 }}
                          >
                            <X size={13} /> Recusar
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* BARRA DE CONTROLE: LISTA DE COLABORADORES */}
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color={C.amber} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink }}>
                  {isGeral ? 'Equipe & Colaboradores do Grupo' : 'Colaboradores da Unidade'}
                </h3>
                <span style={{ fontSize: 10.5, fontWeight: 800, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '1px 6px', borderRadius: 10, color: C.inkSoft }}>
                  {colaboradoresFiltrados.length}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {isGeral && (
                  <button style={{ ...btnGhost, padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setShowCargoForm(v => !v)}>
                    <Sliders size={12} /> Novo Cargo
                  </button>
                )}
                <button style={{ ...btn(C.amber), padding: '6px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setShowColForm(v => !v)}>
                  <UserPlus size={13} /> Convidar Usuário
                </button>
              </div>
            </div>

            {/* Filtro e Busca de Colaboradores */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <Search size={13} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  style={{ ...input, paddingLeft: 30, paddingRight: searchColab ? 28 : 10, fontSize: 11.5, height: 32 }}
                  placeholder="Buscar colaborador por nome, e-mail ou cargo..."
                  value={searchColab}
                  onChange={e => setSearchColab(e.target.value)}
                />
                {searchColab && (
                  <button onClick={() => setSearchColab('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', display: 'flex' }}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                style={{ ...input, width: 'auto', minWidth: 140, fontSize: 11, height: 32, padding: '4px 8px' }}
                value={filterCargo}
                onChange={e => setFilterCargo(e.target.value)}
              >
                <option value="todos">Todos os Cargos</option>
                {listaCargosDisponiveis.map(c => (
                  <option key={c.codigo} value={c.codigo}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* FORMULÁRIO RÁPIDO DE CONVITE / NOVO COLABORADOR */}
            {showColForm && (
              <div style={{ background: C.bgWhite, border: `1px solid ${C.amber}`, borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>Novo Colaborador</span>
                  <button onClick={() => setShowColForm(false)} style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer' }}><X size={14} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={label}>Nome Completo *</label>
                    <input style={input} value={colForm.nome} onChange={e => setColForm(c => ({ ...c, nome: e.target.value }))} placeholder="Ex: Lucas Ferreira" />
                  </div>
                  <div>
                    <label style={label}>E-mail de Acesso *</label>
                    <input style={input} type="email" value={colForm.email} onChange={e => setColForm(c => ({ ...c, email: e.target.value }))} placeholder="lucas@empresa.com" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={label}>Senha Inicial (mín. 8 caracteres) *</label>
                    <input style={input} type="password" minLength={8} value={colForm.senha} onChange={e => setColForm(c => ({ ...c, senha: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <div>
                    <label style={label}>Cargo / Nível de Acesso</label>
                    <select style={input} value={colForm.cargo} onChange={e => setColForm(c => ({ ...c, cargo: e.target.value }))}>
                      {listaCargosDisponiveis.filter(c => isGeral ? true : c.codigo !== 'admin_geral').map(cargo => (
                        <option key={cargo.codigo} value={cargo.codigo}>{cargo.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isGeral && colForm.cargo === 'admin_empresa' && (
                  <div>
                    <label style={label}>Empresa Atribuída</label>
                    <select style={input} value={colForm.empresa_id} onChange={e => setColForm(c => ({ ...c, empresa_id: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button style={btnGhost} onClick={() => setShowColForm(false)}>Cancelar</button>
                  <button style={btn(C.amber)} onClick={criarColaborador} disabled={savingCol}>{savingCol ? 'Criando...' : 'Cadastrar Usuário'}</button>
                </div>
              </div>
            )}

            {/* LISTA DE COLABORADORES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto', paddingRight: 2 }}>
              {colaboradoresFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: C.inkSoft, fontSize: 12 }}>
                  Nenhum colaborador encontrado com os filtros atuais.
                </div>
              ) : (
                colaboradoresFiltrados.map(c => {
                  const isAtivo = c.id === colaboradorAtivo.id
                  const linkedEmpresaIds = c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])
                  const empresasLabels = linkedEmpresaIds.length > 0
                    ? linkedEmpresaIds.map(id => empresas.find(e => e.id === id)?.nome_fantasia || empresas.find(e => e.id === id)?.razao_social).filter(Boolean)
                    : ['Todas Empresas (Global)']

                  const cargoInfo = listaCargosDisponiveis.find(cargo => cargo.codigo === c.cargo)?.nome || NOMES_CARGOS[c.cargo] || c.cargo
                  const iniciais = (c.nome || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

                  return (
                    <div key={c.id} style={{ background: C.bgWhite, border: `1px solid ${isAtivo ? C.amber : C.border}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.15s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAtivo ? C.amber : '#F4F4F6', color: isAtivo ? '#000' : C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, border: `1px solid ${isAtivo ? C.amber : C.border}`, flexShrink: 0 }}>
                            {iniciais}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{c.nome}</span>
                              {isAtivo && (
                                <span style={{ fontSize: 9, background: '#F59E0B20', color: C.amber, padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                  VOCÊ
                                </span>
                              )}
                              {c.override_permissoes && (
                                <span style={{ fontSize: 9, background: '#10B98118', color: '#10B981', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                  CUSTOMIZADO
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                              {c.email || 'Sem e-mail informado'}
                            </div>
                          </div>
                        </div>

                        {/* Ações Rápidas */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          {isGeral && (
                            <select
                              value={c.cargo}
                              disabled={isAtivo}
                              onChange={e => void alterarCargoColaborador(c.id, e.target.value)}
                              style={{
                                ...input,
                                width: 140,
                                padding: '3px 6px',
                                fontSize: 10.5,
                                fontWeight: 700,
                                height: 28,
                                background: C.bgPanel,
                                cursor: isAtivo ? 'not-allowed' : 'pointer'
                              }}
                              title="Alterar cargo"
                            >
                              {listaCargosDisponiveis.map(cargo => (
                                <option key={cargo.codigo} value={cargo.codigo}>
                                  {cargo.nome}
                                </option>
                              ))}
                            </select>
                          )}

                          <button
                            onClick={() => setEditColForm(c)}
                            title="Editar acessos e empresas desta pessoa"
                            style={{ ...btnGhost, padding: '4px 8px', fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4, color: C.amber, borderColor: `${C.amber}44` }}
                          >
                            <Edit3 size={12} /> Acessos
                          </button>

                          {isGeral && !isAtivo && (
                            <button
                              onClick={() => excluirColaborador(c.id)}
                              title="Excluir Colaborador"
                              style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 4, display: 'flex' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Chips de Empresas & Cargo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
                        <span style={{ fontSize: 10, color: C.ink, fontWeight: 700, background: C.bgPanel, padding: '2px 7px', borderRadius: 4, border: `1px solid ${C.border}` }}>
                          {cargoInfo}
                        </span>
                        {empresasLabels.slice(0, 2).map((empNome, idx) => (
                          <span key={idx} style={{ fontSize: 9.5, color: C.inkSoft, background: C.bgPanel, padding: '2px 6px', borderRadius: 4 }}>
                            🏢 {empNome}
                          </span>
                        ))}
                        {empresasLabels.length > 2 && (
                          <span style={{ fontSize: 9.5, color: C.inkSoft, background: C.bgPanel, padding: '2px 5px', borderRadius: 4 }}>
                            +{empresasLabels.length - 2} empresas
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ══ COLUNA DIREITA: MATRIZ DE REGRAS & PERMISSÕES DOS CARGOS ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color={C.amber} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink }}>Regras & Permissões dos Cargos</h3>
              </div>
              {!isGeral && (
                <span style={{ fontSize: 10, color: C.inkSoft, background: C.bgWhite, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  Somente Leitura
                </span>
              )}
            </div>

            {/* Pílulas de Seleção de Cargo para navegação rápida */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                type="button"
                onClick={() => setCargoAtivoMatriz('todos')}
                style={{
                  fontSize: 10.5,
                  padding: '4px 9px',
                  borderRadius: 6,
                  fontWeight: cargoAtivoMatriz === 'todos' ? 800 : 600,
                  cursor: 'pointer',
                  border: `1px solid ${cargoAtivoMatriz === 'todos' ? C.amber : C.border}`,
                  background: cargoAtivoMatriz === 'todos' ? '#F59E0B18' : C.bgWhite,
                  color: cargoAtivoMatriz === 'todos' ? C.amber : C.ink,
                  whiteSpace: 'nowrap'
                }}
              >
                Todos os Cargos ({listaConfigExibicao.length})
              </button>
              {listaConfigExibicao.map(cfg => {
                const labelCargo = listaCargosDisponiveis.find(c => c.codigo === cfg.cargo)?.nome || NOMES_CARGOS[cfg.cargo] || cfg.cargo
                const isSel = cargoAtivoMatriz === cfg.cargo
                return (
                  <button
                    key={cfg.cargo}
                    type="button"
                    onClick={() => setCargoAtivoMatriz(cfg.cargo)}
                    style={{
                      fontSize: 10.5,
                      padding: '4px 9px',
                      borderRadius: 6,
                      fontWeight: isSel ? 800 : 600,
                      cursor: 'pointer',
                      border: `1px solid ${isSel ? C.amber : C.border}`,
                      background: isSel ? '#F59E0B18' : C.bgWhite,
                      color: isSel ? C.amber : C.ink,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {labelCargo}
                  </button>
                )
              })}
            </div>

            {/* CARDS DE CONFIGURAÇÃO DE CADA CARGO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 680, overflowY: 'auto', paddingRight: 2 }}>
              {listaConfigExibicao
                .filter(cfg => cargoAtivoMatriz === 'todos' || cargoAtivoMatriz === cfg.cargo)
                .map(cfg => {
                  const saving = savingPerms === cfg.cargo
                  const labelCargo = listaCargosDisponiveis.find(c => c.codigo === cfg.cargo)?.nome || NOMES_CARGOS[cfg.cargo] || cfg.cargo
                  const appsList = cfg.apps ? cfg.apps.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                  const abasList = cfg.abas_financeiro ? cfg.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                  const membrosCount = colaboradores.filter(c => c.cargo === cfg.cargo).length

                  return (
                    <div key={cfg.cargo} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Header do Cargo */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {editingCargoNome === cfg.cargo ? (
                            <>
                              <input
                                value={editingCargoNomeValue}
                                onChange={e => setEditingCargoNomeValue(e.target.value)}
                                style={{ ...input, width: 160, padding: '2px 8px', fontSize: 12.5, fontWeight: 800, color: C.amber }}
                                onKeyDown={e => { if (e.key === 'Enter') salvarNomeCargo(cfg.cargo); if (e.key === 'Escape') setEditingCargoNome(null) }}
                                autoFocus
                              />
                              <button onClick={() => salvarNomeCargo(cfg.cargo)} disabled={savingCargoNome} style={{ ...btn(C.amber), padding: '3px 8px', fontSize: 10 }}>
                                OK
                              </button>
                              <button onClick={() => setEditingCargoNome(null)} style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer' }}>
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 900, fontSize: 13.5, color: C.ink }}>{labelCargo}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, background: C.bgPanel, padding: '1px 6px', borderRadius: 10 }}>
                                {membrosCount} usuário(s)
                              </span>
                              {isGeral && cfg.cargo !== 'admin_geral' && (
                                <button
                                  title="Editar nome deste cargo"
                                  onClick={() => { setEditingCargoNome(cfg.cargo); setEditingCargoNomeValue(labelCargo) }}
                                  style={{ border: 0, background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 2, display: 'flex' }}
                                >
                                  <Edit3 size={11} />
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {cfg.cargo !== 'admin_geral' ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button 
                              style={{ ...btn(C.amber), padding: '4px 10px', fontSize: 10 }}
                              onClick={() => salvarConfigCargo(cfg.cargo, cfg)}
                              disabled={saving}
                            >
                              {saving ? 'Salvando...' : 'Salvar Regras'}
                            </button>
                            {cfg.cargo !== 'admin_empresa' && isGeral && (
                              <button
                                style={{ ...btnGhost, borderColor: '#EF444444', color: '#EF4444', padding: '4px 7px', fontSize: 10 }}
                                onClick={() => excluirCargo(cfg.cargo)}
                                title="Excluir este cargo"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 9.5, color: C.inkSoft, fontStyle: 'italic' }}>Acesso Irrestrito (Geral)</span>
                        )}
                      </div>

                      {/* Seção 1: Módulos do Sistema */}
                      <div>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                          1. Módulos Autorizados na Sidebar
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {ALL_APPS.map(app => {
                            const desabilitar = cfg.cargo === 'admin_geral'
                            const valorCheck = desabilitar || appsList.includes(app.id)
                            return (
                              <label key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: desabilitar ? 'default' : 'pointer', fontSize: 11, color: C.ink, background: valorCheck ? '#F59E0B0A' : 'transparent', padding: '4px 6px', borderRadius: 4, border: `1px solid ${valorCheck ? '#F59E0B22' : 'transparent'}` }}>
                                <button type="button" disabled={desabilitar} onClick={() => handleToggleAppCargo(cfg.cargo, app.id)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: desabilitar ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}>
                                  {valorCheck ? <ToggleRight size={18} color={desabilitar ? C.inkSoft : C.amber} /> : <ToggleLeft size={18} color={C.border} />}
                                </button>
                                <span>{app.nome}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      {/* Seção 2: Abas do Financeiro */}
                      {cfg.cargo !== 'admin_geral' && (
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              2. Abas do Financeiro
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const ALL_ABAS_IDS = ['historico','contas','empresas','fornecedores','obras']
                                const todasMarcadas = ALL_ABAS_IDS.every(a => abasList.includes(a))
                                setConfigPermissoes(prev => prev.map(c => c.cargo === cfg.cargo
                                  ? { ...c, abas_financeiro: todasMarcadas ? '' : ALL_ABAS_IDS.join(',') }
                                  : c
                                ))
                              }}
                              style={{ background: 'transparent', border: 0, color: C.amber, fontSize: 9.5, fontWeight: 800, cursor: 'pointer' }}
                            >
                              {(() => {
                                const ALL_ABAS_IDS = ['historico','contas','empresas','fornecedores','obras']
                                return ALL_ABAS_IDS.every(a => abasList.includes(a)) ? 'Desmarcar todas' : '✓ Selecionar todas'
                              })()}
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {([
                              ['historico',    'Histórico & Fluxo'],
                              ['contas',       'Lançar Conta'],
                              ['empresas',     'Empresas'],
                              ['fornecedores', 'Fornecedores'],
                              ['obras',        'Obras & Métricas'],
                            ] as const).map(([abaId, abaLabel]) => {
                              const checked = abasList.includes(abaId)
                              return (
                                <label key={abaId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink, cursor: 'pointer', background: checked ? '#F59E0B0A' : 'transparent', padding: '4px 6px', borderRadius: 4, border: `1px solid ${checked ? '#F59E0B22' : 'transparent'}` }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleAbaFinanceiro(cfg.cargo, abaId)}
                                    style={{ accentColor: C.amber, cursor: 'pointer' }}
                                  />
                                  {abaLabel}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Seção 3: Governança & Ações Críticas */}
                      {cfg.cargo !== 'admin_geral' && (
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                            3. Governança & Ações Críticas
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {([
                              ['pode_lancar',              'Lançar Contas'],
                              ['pode_alterar_status',      'Alterar Status'],
                              ['pode_aprovar',             'Aprovar Contas'],
                              ['pode_pagar',               'Marcar como Pago'],
                              ['pode_empresas',            'Editar Empresas'],
                              ['pode_fornecedores',        'Editar Fornecedores'],
                              ['pode_excluir_lancamento',  'Excluir Lançamentos'],
                            ] as const).map(([campo, desc]) => {
                              const valorCheck = cfg[campo as keyof ConfigPermissao] as boolean
                              return (
                                <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 11, color: C.ink, background: valorCheck ? '#F59E0B0A' : 'transparent', padding: '4px 6px', borderRadius: 4, border: `1px solid ${valorCheck ? '#F59E0B22' : 'transparent'}` }}>
                                  <button type="button" onClick={() => handleToggle(cfg.cargo, campo as keyof ConfigPermissao)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    {valorCheck ? <ToggleRight size={18} color={C.amber} /> : <ToggleLeft size={18} color={C.border} />}
                                  </button>
                                  <span>{desc}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODAL: PERMISSÕES INDIVIDUAIS (POR COLABORADOR) ══ */}
      <AnimatePresence>
        {editColForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setEditColForm(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ ...card, background: C.bgPanel, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={18} color={C.amber} />
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>Acessos & Vinculações</span>
                    <h3 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: 0 }}>{editColForm.nome}</h3>
                  </div>
                </div>
                <button onClick={() => setEditColForm(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveColaboradorPerms} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={label}>Cargo Principal</label>
                  <select
                    style={{ ...input, background: C.bgWhite, color: C.ink, fontWeight: 700 }}
                    value={editColForm.cargo}
                    onChange={e => setEditColForm({ ...editColForm, cargo: e.target.value })}
                  >
                    {listaCargosDisponiveis.map(cargo => (
                      <option key={cargo.codigo} value={cargo.codigo}>
                        {cargo.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Empresas Vinculadas */}
                {editColForm.cargo !== 'admin_geral' && (
                  <div>
                    <label style={label}>Empresas Autorizadas</label>
                    <SeletorMultiEmpresas
                      empresas={empresas}
                      selectedIds={editColForm.empresas_ids || (editColForm.empresa_id ? [editColForm.empresa_id] : [])}
                      onChange={newIds => setEditColForm({
                        ...editColForm,
                        empresas_ids: newIds,
                        empresa_id: newIds[0] || null
                      })}
                    />
                  </div>
                )}

                {/* Obras Vinculadas */}
                {editColForm.cargo !== 'admin_geral' && (
                  <div>
                    <label style={label}>Obras Vinculadas</label>
                    <SeletorMultiObras
                      obras={obras}
                      selectedIds={editColForm.obras_ids || []}
                      onChange={newIds => setEditColForm({
                        ...editColForm,
                        obras_ids: newIds
                      })}
                    />
                  </div>
                )}

                {/* Toggle Override */}
                <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, padding: 12, borderRadius: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: C.ink }}>
                    <button type="button" onClick={() => setEditColForm({ ...editColForm, override_permissoes: !editColForm.override_permissoes })} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      {editColForm.override_permissoes ? <ToggleRight size={24} color={C.amber} /> : <ToggleLeft size={24} color={C.border} />}
                    </button>
                    Personalizar acessos desta conta (Sobrescrever cargo)
                  </label>
                  <p style={{ fontSize: 10.5, color: C.inkSoft, margin: '6px 0 0 34px', lineHeight: 1.4 }}>
                    Se ativado, este colaborador usará permissões exclusivas personalizadas abaixo em vez de herdar as regras globais do cargo.
                  </p>
                </div>

                {editColForm.override_permissoes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: C.bgWhite, padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>Ações Financeiras Específicas</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {([
                        ['pode_lancar',              'Lançar Contas'],
                        ['pode_alterar_status',      'Alterar Status'],
                        ['pode_aprovar',             'Aprovar Contas'],
                        ['pode_pagar',               'Marcar como Pago'],
                        ['pode_empresas',            'Editar Empresas'],
                        ['pode_fornecedores',        'Editar Fornecedores'],
                        ['pode_excluir_lancamento',  'Excluir Lançamentos'],
                      ] as const).map(([campo, desc]) => (
                        <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 11, color: C.ink }}>
                          <button type="button" onClick={() => setEditColForm({ ...editColForm, [campo]: !editColForm[campo] })} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            {editColForm[campo] ? <ToggleRight size={18} color={C.amber} /> : <ToggleLeft size={18} color={C.border} />}
                          </button>
                          {desc}
                        </label>
                      ))}
                    </div>

                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Módulos Autorizados</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {ALL_APPS.map(app => {
                          const appsCol = editColForm.apps ? editColForm.apps.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                          const valorCheck = appsCol.includes(app.id)
                          return (
                            <label key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 11, color: C.ink }}>
                              <button type="button" onClick={() => handleToggleAppColaborador(app.id)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                {valorCheck ? <ToggleRight size={18} color={C.amber} /> : <ToggleLeft size={18} color={C.border} />}
                              </button>
                              {app.nome}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Abas do Financeiro</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {([
                          ['historico',    'Histórico & Fluxo'],
                          ['contas',       'Lançar Conta'],
                          ['empresas',     'Empresas'],
                          ['fornecedores', 'Fornecedores'],
                          ['obras',        'Obras & Métricas'],
                        ] as const).map(([abaId, abaLabel]) => {
                          const abasList = editColForm.abas_financeiro ? editColForm.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                          const checked = abasList.includes(abaId)
                          return (
                            <label key={abaId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.ink, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleAbaFinanceiroColaborador(abaId)}
                                style={{ accentColor: C.amber, cursor: 'pointer' }}
                              />
                              {abaLabel}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <button type="button" onClick={() => setEditColForm(null)} style={btnGhost}>Cancelar</button>
                  <button type="submit" disabled={savingEditCol} style={btn(C.amber)}>{savingEditCol ? 'Salvando...' : 'Salvar Alterações'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ════════════════════════════════════════════════════════
//  MODAL IMPORTAÇÃO DE EXCEL / HISTÓRICO RETROATIVO
// ════════════════════════════════════════════════════════
function ImportarExcelModal({
  isOpen,
  onClose,
  colaboradorAtivo,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  colaboradorAtivo: Colaborador
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [sheetData, setSheetData] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  
  const [colMap, setColMap] = useState<Record<string, string>>({
    descricao: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
    status: '',
    fornecedor: '',
    obra: '',
    categoria: '',
    observacoes: ''
  })

  const [empresaPadraoId, setEmpresaPadraoId] = useState<string>('')
  const [statusPadrao, setStatusPadrao] = useState<string>('Pago')
  const [tipoPadrao, setTipoPadrao] = useState<'pagar'|'receber'>('pagar')
  
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    Promise.all([
      supabase.from('empresas').select('*').order('razao_social'),
      supabase.from('fornecedores').select('*').order('razao_social'),
      supabase.from('obras').select('*').order('nome')
    ]).then(([{ data: e }, { data: f }, { data: o }]) => {
      const empList = e ?? []
      setEmpresas(empList)
      setFornecedores(f ?? [])
      
      let oList = o ?? []
      if (colaboradorAtivo.cargo !== 'admin_geral') {
        const oIds = colaboradorAtivo.obras_ids || []
        oList = oList.filter(ob => oIds.includes(ob.id))
      }
      setObras(oList)
      
      if (empList.length > 0) setEmpresaPadraoId(empList[0].id)
    })
  }, [isOpen, colaboradorAtivo])

  const baixarModeloExcel = () => {
    const modelo = [
      {
        'Tipo': 'pagar',
        'Descrição': 'Compra de Materiais para Estrutura',
        'Valor': 4500.50,
        'Data Vencimento': '2024-01-15',
        'Status': 'Pago',
        'Empresa': 'Sua Empresa LTDA',
        'Fornecedor': 'Distribuidora de Aço S/A',
        'Obra': 'Residencial Alphaville',
        'Categoria': 'Material de Construção',
        'Observações': 'Lançamento retroativo importado'
      },
      {
        'Tipo': 'pagar',
        'Descrição': 'Locação de Gerador a Diesel',
        'Valor': 1200.00,
        'Data Vencimento': '2024-02-10',
        'Status': 'Pago',
        'Empresa': 'Sua Empresa LTDA',
        'Fornecedor': 'Locadora de Equipamentos',
        'Obra': 'Residencial Alphaville',
        'Categoria': 'Locação',
        'Observações': 'Pago via PIX em Fev/2024'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(modelo)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importação')
    XLSX.writeFile(wb, 'modelo_importacao_financeiro.xlsx')
  }

  const processarArquivo = async (uploadedFile: File) => {
    setFile(uploadedFile)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' })

        if (json.length === 0) {
          toast('Planilha vazia ou em formato não reconhecido.', 'error')
          return
        }

        const detectedCols = Object.keys(json[0] || {})
        setColumns(detectedCols)
        setSheetData(json)

        const autoMap: Record<string, string> = {
          descricao: detectedCols.find(c => /descri|hist|titulo|ref|lancamento/i.test(c)) || '',
          valor: detectedCols.find(c => /valor|quantia|preco|montante|total/i.test(c)) || '',
          data_vencimento: detectedCols.find(c => /venc|data|dt_venc|vencimento|pagamento/i.test(c)) || '',
          tipo: detectedCols.find(c => /tipo|natureza|operacao/i.test(c)) || '',
          status: detectedCols.find(c => /status|situacao|pago|estado/i.test(c)) || '',
          fornecedor: detectedCols.find(c => /fornecedor|cliente|favorecido|credor/i.test(c)) || '',
          obra: detectedCols.find(c => /obra|projeto|centro/i.test(c)) || '',
          categoria: detectedCols.find(c => /categoria|grupo|classificacao/i.test(c)) || '',
          observacoes: detectedCols.find(c => /obs|observa|detalhe|nota/i.test(c)) || '',
        }
        setColMap(autoMap)
      } catch (err) {
        toast('Erro ao ler arquivo Excel: ' + (err instanceof Error ? err.message : 'Arquivo inválido'), 'error')
      }
    }
    reader.readAsArrayBuffer(uploadedFile)
  }

  const parseExcelDateStr = (val: any): string => {
    if (!val) return new Date().toISOString().slice(0, 10)
    if (val instanceof Date) return val.toISOString().slice(0, 10)
    if (typeof val === 'number') {
      const parsed = XLSX.SSF.parse_date_code(val)
      if (parsed) {
        const y = parsed.y
        const m = String(parsed.m).padStart(2, '0')
        const d = String(parsed.d).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    }
    const str = String(val).trim()
    const matchBR = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (matchBR) {
      const [, d, m, y] = matchBR
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const matchISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
    if (matchISO) {
      const [, y, m, d] = matchISO
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return new Date().toISOString().slice(0, 10)
  }

  const executarImportacao = async () => {
    if (!colMap.descricao || !colMap.valor) {
      toast('Mapeie pelo menos os campos Descrição e Valor!', 'error')
      return
    }
    if (!empresaPadraoId) {
      toast('Selecione uma Empresa Padrão!', 'error')
      return
    }

    setImportando(true)
    setProgresso({ atual: 0, total: sheetData.length })

    try {
      const payloadContas: any[] = []

      for (const row of sheetData) {
        const desc = String(row[colMap.descricao] || '').trim()
        if (!desc) continue

        const valRaw = row[colMap.valor]
        const valorNum = parseCurrency(valRaw)

        const dtVenc = colMap.data_vencimento ? parseExcelDateStr(row[colMap.data_vencimento]) : new Date().toISOString().slice(0, 10)

        let st = statusPadrao
        if (colMap.status && row[colMap.status]) {
          const stStr = String(row[colMap.status]).toLowerCase()
          if (/pago|quitado|liquidado|efetuado|realizado/i.test(stStr)) st = 'Pago'
          else if (/pendente|aberto|a pagar/i.test(stStr)) st = 'Pendente'
          else if (/bloqueado/i.test(stStr)) st = 'Bloqueado'
        }

        let tp = tipoPadrao
        if (colMap.tipo && row[colMap.tipo]) {
          const tpStr = String(row[colMap.tipo]).toLowerCase()
          if (/receb|entrada|receita/i.test(tpStr)) tp = 'receber'
          else if (/pag|saida|despesa/i.test(tpStr)) tp = 'pagar'
        }

        let fornId: string | null = null
        let possuiForn = false
        if (colMap.fornecedor && row[colMap.fornecedor]) {
          const fornNome = String(row[colMap.fornecedor]).trim().toLowerCase()
          const foundForn = fornecedores.find(f => 
            (f.razao_social && f.razao_social.toLowerCase().includes(fornNome)) ||
            (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(fornNome))
          )
          if (foundForn) {
            fornId = foundForn.id
            possuiForn = true
          }
        }

        let obraId: string | null = null
        if (colMap.obra && row[colMap.obra]) {
          const obraNome = String(row[colMap.obra]).trim().toLowerCase()
          const foundObra = obras.find(o => o.nome && o.nome.toLowerCase().includes(obraNome))
          if (foundObra) obraId = foundObra.id
        }

        const cat = colMap.categoria && row[colMap.categoria] ? String(row[colMap.categoria]).trim() : 'Outros'
        const obs = colMap.observacoes && row[colMap.observacoes] ? String(row[colMap.observacoes]).trim() : 'Importado via planilha retroativa'

        payloadContas.push({
          empresa_id: empresaPadraoId,
          tipo: tp,
          descricao: desc,
          valor: valorNum,
          data_vencimento: dtVenc,
          data_previsao: dtVenc,
          status: st,
          pago_em: (st === 'Pago' || st === 'Pago sem Nota Fiscal') ? `${dtVenc}T12:00:00.000Z` : null,
          fornecedor_id: fornId,
          possui_fornecedor: possuiForn,
          obra_id: obraId,
          categoria: cat,
          observacoes: obs,
          criado_por: colaboradorAtivo?.nome || 'Importador Excel',
          recorrencia: 'unico',
        })
      }

      if (payloadContas.length === 0) {
        toast('Nenhum registro válido encontrado para importação.', 'error')
        setImportando(false)
        return
      }

      const BATCH_SIZE = 50
      let inseridos = 0
      for (let i = 0; i < payloadContas.length; i += BATCH_SIZE) {
        const batch = payloadContas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('contas').insert(batch)
        if (error) throw error
        inseridos += batch.length
        setProgresso({ atual: inseridos, total: payloadContas.length })
      }

      toast(`${inseridos} lançamento(s) importados com sucesso!`, 'success')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast('Erro ao importar registros: ' + (err instanceof Error ? err.message : 'Falha no banco'), 'error')
    } finally {
      setImportando(false)
      setProgresso(null)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10, width: '100%', maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={22} color="#34D399" />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink }}>Importar Planilha Retroativa (Excel/CSV)</h3>
              <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>Importe dados de pagamentos antigos para transicionar totalmente para o sistema.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!file ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(52,211,153,0.05)', border: `1px solid rgba(52,211,153,0.2)`, borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#34D399', marginBottom: 2 }}>Precisa de uma estrutura pronta?</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>Baixe nosso modelo preenchido de exemplo e adicione seus lançamentos.</div>
                </div>
                <button onClick={baixarModeloExcel} style={{ ...btnGhost, color: '#34D399', borderColor: '#34D399', fontSize: 11, padding: '6px 14px', gap: 6, display: 'flex', alignItems: 'center' }}>
                  <Download size={14} /> Baixar Planilha Modelo (.xlsx)
                </button>
              </div>

              <div style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: 40, textAlign: 'center', background: C.bgWhite, cursor: 'pointer' }} onClick={() => document.getElementById('excel-input-file')?.click()}>
                <input id="excel-input-file" type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && processarArquivo(e.target.files[0])} />
                <Upload size={36} color={C.amber} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 4 }}>Clique para selecionar a planilha (.xlsx, .csv)</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>Arraste seu arquivo ou selecione do computador</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileSpreadsheet size={20} color={C.amber} />
                  <div>
                    <strong style={{ fontSize: 13, color: C.ink }}>{file.name}</strong>
                    <span style={{ fontSize: 11, color: C.inkSoft, marginLeft: 10 }}>({sheetData.length} registros detectados)</span>
                  </div>
                </div>
                <button onClick={() => { setFile(null); setSheetData([]); setColumns([]) }} style={{ ...btnGhost, color: '#EF4444', fontSize: 10, padding: '4px 10px' }}>Trocar arquivo</button>
              </div>

              <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: C.amber, textTransform: 'uppercase' }}>🔗 Mapeamento de Colunas da Planilha</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Descrição do Lançamento *</label>
                    <select style={input} value={colMap.descricao} onChange={e => setColMap({ ...colMap, descricao: e.target.value })}>
                      <option value="">-- Selecione --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Valor (R$) *</label>
                    <select style={input} value={colMap.valor} onChange={e => setColMap({ ...colMap, valor: e.target.value })}>
                      <option value="">-- Selecione --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Data Vencimento/Pagamento</label>
                    <select style={input} value={colMap.data_vencimento} onChange={e => setColMap({ ...colMap, data_vencimento: e.target.value })}>
                      <option value="">-- Usar Data Atual --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Status (Pago / Pendente)</label>
                    <select style={input} value={colMap.status} onChange={e => setColMap({ ...colMap, status: e.target.value })}>
                      <option value="">-- Usar Status Padrão --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Fornecedor / Cliente</label>
                    <select style={input} value={colMap.fornecedor} onChange={e => setColMap({ ...colMap, fornecedor: e.target.value })}>
                      <option value="">-- Opcional --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Obra</label>
                    <select style={input} value={colMap.obra} onChange={e => setColMap({ ...colMap, obra: e.target.value })}>
                      <option value="">-- Opcional --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Categoria</label>
                    <select style={input} value={colMap.categoria} onChange={e => setColMap({ ...colMap, categoria: e.target.value })}>
                      <option value="">-- Opcional --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Observações</label>
                    <select style={input} value={colMap.observacoes} onChange={e => setColMap({ ...colMap, observacoes: e.target.value })}>
                      <option value="">-- Opcional --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: C.ink, textTransform: 'uppercase' }}>⚙️ Definições para os Lançamentos</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Empresa Padrão *</label>
                    <select style={input} value={empresaPadraoId} onChange={e => setEmpresaPadraoId(e.target.value)}>
                      {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.razao_social || emp.nome_fantasia}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Status Padrão (caso não especificado na planilha)</label>
                    <select style={input} value={statusPadrao} onChange={e => setStatusPadrao(e.target.value)}>
                      <option value="Pago">Pago (Histórico Retroativo)</option>
                      <option value="Pendente">Pendente / A Pagar</option>
                      <option value="Lançado">Lançado</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, display: 'block', marginBottom: 4 }}>Tipo Padrão</label>
                    <select style={input} value={tipoPadrao} onChange={e => setTipoPadrao(e.target.value as any)}>
                      <option value="pagar">Contas a Pagar (Saída / Custos)</option>
                      <option value="receber">Contas a Receber (Entrada / Faturamento)</option>
                    </select>
                  </div>
                </div>
              </div>

              {sheetData.length > 0 && (
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>📋 Prévia dos primeiros lançamentos ({sheetData.length} total)</span>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 180, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: C.ink }}>
                      <thead>
                        <tr style={{ background: C.bgWhite, borderBottom: `1px solid ${C.border}`, color: C.inkSoft, textAlign: 'left' }}>
                          <th style={{ padding: '6px 10px' }}>Descrição</th>
                          <th style={{ padding: '6px 10px' }}>Valor</th>
                          <th style={{ padding: '6px 10px' }}>Data</th>
                          <th style={{ padding: '6px 10px' }}>Fornecedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheetData.slice(0, 5).map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                            <td style={{ padding: '6px 10px' }}>{String(row[colMap.descricao] || '—')}</td>
                            <td style={{ padding: '6px 10px', color: C.amber, fontWeight: 700 }}>{fmt(parseCurrency(row[colMap.valor]))}</td>
                            <td style={{ padding: '6px 10px' }}>{colMap.data_vencimento ? parseExcelDateStr(row[colMap.data_vencimento]) : 'Hoje'}</td>
                            <td style={{ padding: '6px 10px', color: C.inkSoft }}>{colMap.fornecedor ? String(row[colMap.fornecedor] || '—') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F1115' }}>
          <button onClick={onClose} disabled={importando} style={{ ...btnGhost, fontSize: 11 }}>Cancelar</button>
          {file && (
            <button onClick={executarImportacao} disabled={importando || !colMap.descricao || !colMap.valor} style={{ ...btn(C.amber), padding: '8px 20px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
              {importando ? (
                <>Importando... ({progresso?.atual} / {progresso?.total})</>
              ) : (
                <><CheckCircle2 size={15} /> Confirmar Importação de {sheetData.length} Lançamento(s)</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FinanceiroPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>Carregando Financeiro...</div>}>
      <FinanceiroContent />
    </React.Suspense>
  )
}
