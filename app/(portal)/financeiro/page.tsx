'use client'
import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus,
  Building2, Users, FileText, CheckCircle, Clock, X,
  Search, RefreshCw, ArrowUpRight, ArrowDownRight, Calendar,
  Shield, Check, AlertTriangle, Paperclip, Eye, UserPlus, ToggleLeft, ToggleRight,
  Edit3, Sliders, Camera, Trash2
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { supabase } from '@/lib/supabase'
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
  if (status === 'Pago') return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(d + 'T00:00:00');
  return vencimento < hoje;
}

// ─── NAV TABS ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'obras',      label: 'Obras & Metricas', icon: Building2 },
  { id: 'empresas',  label: 'Empresas',  icon: Building2  },
  { id: 'fornecedores', label: 'Fornecedores', icon: Users },
  { id: 'contas',    label: 'Lançar Conta', icon: Plus     },
  { id: 'historico', label: 'Histórico & Fluxo', icon: FileText },
  { id: 'permissoes', label: 'Usuários & Acessos', icon: Shield },
] as const
type Tab = typeof TABS[number]['id']

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
  background: '#0B0C0E',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.ink,
  padding: '9px 13px',
  fontSize: 13,
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

export default function FinanceiroPage() {
  const { confirm, ConfirmDialog } = useConfirm()
  const { prompt, PromptDialog } = usePrompt()
  const [tab, setTab] = useState<Tab>('historico')
  const [activeFornecedorId, setActiveFornecedorId] = useState<string>('')
  
  // Colaborador atualmente conectado neste navegador/dispositivo
  const [colaboradorAtivo, setColaboradorAtivo] = useState<Colaborador | null>(null)
  // Regras de permissões ativas para o cargo do colaborador atual
  const [permissaoAtiva, setPermissaoAtiva] = useState<ConfigPermissao | null>(null)
  
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loadingAcesso, setLoadingAcesso] = useState(true)

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
      .select('id, nome, email, cargo, empresa_id, empresas_ids, override_permissoes, apps, pode_empresas, pode_fornecedores, pode_lancar, pode_pagar, pode_aprovar, limite_valor, abas_financeiro, pode_alterar_status, pode_excluir_lancamento')
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
      : permissaoAtiva?.abas_financeiro) || null

    if (abasConfig) {
      const abas = abasConfig.split(',').map(a => a.trim()).filter(Boolean)
      if (isAdminGeral) abas.push('permissoes')
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
    if (colaboradorAtivo && !getAbasPermitidas().includes(tab)) {
      setTab('historico')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorAtivo?.cargo])

  if (loadingAcesso) {
    return <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando permissões...</p>
  }

  const cargoNome = colaboradorAtivo ? NOMES_CARGOS[colaboradorAtivo.cargo] : '—'
  const abasVisiveis = getAbasPermitidas()

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Top Header com Usuário Conectado no Navegador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.amber, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            Gestão Financeira
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.ink, margin: 0 }}>
            Portal Financeiro
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {TABS.filter(t => abasVisiveis.includes(t.id)).map(t => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: active ? `2px solid ${C.amber}` : '2px solid transparent',
                color: active ? C.amber : C.inkSoft,
                padding: '10px 18px',
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                marginBottom: -1,
                letterSpacing: .4,
                textTransform: 'uppercase',
              }}
            >
              <Icon size={13} />
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
      {tab === 'contas' && (
        <ContasTab 
          colaboradorAtivo={colaboradorAtivo!} 
          permissaoAtiva={permissaoAtiva!} 
          confirm={confirm}
        />
      )}
      {tab === 'historico' && (
        <HistoricoTab 
          colaboradorAtivo={colaboradorAtivo!} 
          permissaoAtiva={permissaoAtiva!} 
          confirm={confirm}
          prompt={prompt}
          initialFornecedorId={activeFornecedorId}
        />
      )}
      {tab === 'obras' && <ObrasFinanceiroTab colaboradorAtivo={colaboradorAtivo!} permissaoAtiva={permissaoAtiva!} confirm={confirm} />}
      {tab === 'permissoes' && (
        <PermissoesTab 
          colaboradorAtivo={colaboradorAtivo!} 
          colaboradores={colaboradores} 
          onRefresh={carregarSessaoColaborador} 
          confirm={confirm}
        />
      )}
      {ConfirmDialog}
      {PromptDialog}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: DASHBOARD
// ════════════════════════════════════════════════════════
function ObrasFinanceiroTab({ colaboradorAtivo, permissaoAtiva, confirm }: TabProps) {
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
  const [editObraForm, setEditObraForm] = useState({ nome: '', cliente: '', endereco: '', valor: '', status: 'Em dia' })
  const [fotoExpandida, setFotoExpandida] = useState<any | null>(null)
  const [selecionadasFotos, setSelecionadasFotos] = useState<string[]>([])
  const [processandoLote, setProcessandoLote] = useState(false)
  const podeGerenciar = Boolean(permissaoAtiva?.pode_lancar || permissaoAtiva?.pode_aprovar)

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
    setObras((o as Obra[]) || []); setFotos(f || []);
  }, [])
  
  useRealtimeSync(load, 'financeiro-obras')
  useEffect(() => { void load() }, [load])
  
  async function criarObra(e: React.FormEvent) {
    e.preventDefault(); if (!form.nome.trim()) return toast('Informe o nome da obra.', 'error')
    const { data, error } = await supabase.from('obras').insert({ nome: form.nome.trim(), cliente: form.cliente || null, endereco: form.endereco || null, valor_contrato: Number(form.valor) || 0, progresso: 0, status: 'Em dia' }).select().single()
    if (error) return toast(error.message, 'error'); setForm({ nome: '', cliente: '', endereco: '', valor: '' }); setShowForm(false); setObraId(data.id); await load(); toast('Obra criada.', 'success')
  }

  function abrirEdicaoObra(o: Obra) {
    setEditandoObra(o)
    setEditObraForm({
      nome: o.nome || '',
      cliente: o.cliente || '',
      endereco: o.endereco || '',
      valor: o.valor_contrato ? String(o.valor_contrato) : '',
      status: o.status || 'Em dia'
    })
  }

  async function salvarEdicaoObra(e: React.FormEvent) {
    e.preventDefault()
    if (!editandoObra) return
    if (!editObraForm.nome.trim()) return toast('Informe o nome da obra.', 'error')
    const novoValorContrato = parseCurrency(editObraForm.valor)
    const medidoAcum = Number(editandoObra.medido_acumulado || 0)
    const novoProgresso = novoValorContrato > 0 ? Math.min(100, Math.round((medidoAcum / novoValorContrato) * 100)) : 0
    const { error } = await supabase.from('obras').update({
      nome: editObraForm.nome.trim(),
      cliente: editObraForm.cliente.trim() || null,
      endereco: editObraForm.endereco.trim() || null,
      valor_contrato: novoValorContrato,
      status: editObraForm.status || 'Em dia',
      progresso: novoProgresso
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
        <div style={{ ...card, padding: 24 }}>
          {podeGerenciar && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => setShowForm(!showForm)} style={btn(showForm ? '#EF4444' : C.amber)}>
                {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Cancelar Cadastro' : 'Nova Obra'}
              </button>
            </div>
          )}
          
          {/* Formulário Retrátil */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <form onSubmit={criarObra} style={{ background: '#12141C', padding: 16, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 14, color: C.ink }}>Dados da Nova Obra</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                    <input style={input} placeholder="Nome da obra *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                    <input style={input} placeholder="Cliente" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
                    <input style={input} placeholder="Endereço" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
                    <input style={input} type="number" placeholder="Valor do contrato (Opcional)" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
                  </div>
                  <button style={{ ...btn(C.amber), marginTop: 12 }}><Plus size={14} /> Salvar e Criar Obra</button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Grid de Obras */}
          {obras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.inkSoft }}>Nenhuma obra cadastrada ainda.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {obras.map(o => (
                <div key={o.id} style={{ background: '#12141C', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Card Header */}
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: C.ink }}>{o.nome}</h3>
                        <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>{o.cliente || 'Sem cliente vinculado'}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: o.status === 'Em dia' ? `${C.green}15` : `${C.amber}15`, color: o.status === 'Em dia' ? C.green : C.amber, border: `1px solid ${o.status === 'Em dia' ? C.green : C.amber}33` }}>
                        {o.status || 'Em dia'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Card Body */}
                  <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {o.endereco && <div style={{ fontSize: 11, color: C.inkSoft }}><b style={{ color: C.ink }}>📍 Local:</b> {o.endereco}</div>}
                    {(() => {
                      const valContrato = Number(o.valor_contrato || 0)
                      const valMedido = Number(o.medido_acumulado || 0)
                      const pctRaw = valContrato > 0 ? (valMedido / valContrato) * 100 : (o.progresso || 0)
                      const pctFormatado = pctRaw === 0 ? '0%' : pctRaw < 0.01 ? '<0,01%' : (pctRaw % 1 === 0 ? pctRaw.toFixed(0) + '%' : pctRaw.toFixed(2).replace('.', ',') + '%')
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: C.inkSoft }}>Progresso Físico</span>
                            <strong style={{ color: C.amber }}>{pctFormatado}</strong>
                          </div>
                          <div style={{ width: '100%', height: 6, background: '#0B0C0E', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, pctRaw))}%`, height: '100%', background: C.amber, borderRadius: 3 }} />
                          </div>
                        </>
                      )
                    })()}
                    
                    <div style={{ display: 'flex', gap: 16, marginTop: 'auto', paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 10, color: C.inkSoft }}>Contrato</span>
                        <strong style={{ fontSize: 12, color: C.ink }}>{fmt(Number(o.valor_contrato || 0))}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 10, color: C.inkSoft }}>Fotos Anexas</span>
                        <strong style={{ fontSize: 12, color: C.ink }}>{new Set(fotos.filter(f => f.obra_id === o.id).map(f => f.imagem_url).filter(Boolean)).size}</strong>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Footer */}
                  <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => setObraId(o.id)} style={{ ...btnGhost, color: C.amber, padding: '6px 12px' }}>Ver Detalhes <ArrowUpRight size={14} /></button>
                    {podeGerenciar && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => abrirEdicaoObra(o)} style={{ all: 'unset', cursor: 'pointer', padding: 6, color: C.amber, opacity: 0.8 }} title="Editar obra">
                          <Edit3 size={15} color={C.amber} />
                        </button>
                        <button onClick={() => excluirObra(o.id, o.nome)} style={{ all: 'unset', cursor: 'pointer', padding: 6, color: C.inkSoft, opacity: 0.6 }} title="Excluir obra">
                          <Trash2 size={15} color="#EF4444" />
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
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
            <button onClick={() => { setObraId('todas'); setMetricasForm({ bm_atual: '', medido_acumulado: '', observacao: '' }) }} style={{ ...btnGhost, color: C.inkSoft, padding: '6px 10px' }}>← Voltar às Obras</button>
            <div style={{ width: 1, height: 24, background: C.border }} />
            <h2 style={{ margin: 0, fontSize: 18, color: C.ink }}>{obraSelecionada.nome}</h2>
            {podeGerenciar && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => abrirEdicaoObra(obraSelecionada)} style={{ ...btnGhost, color: C.amber, padding: '6px 12px' }}><Edit3 size={14}/> Editar Obra</button>
                <button onClick={() => excluirObra(obraSelecionada.id, obraSelecionada.nome)} style={{ ...btnGhost, color: '#EF4444', padding: '6px 12px' }}><Trash2 size={14}/> Excluir Obra</button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Metricas Rapidas */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', background: '#12141C', padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div><span style={{ fontSize: 11, color: C.inkSoft, display: 'block' }}>Cliente</span><strong style={{ fontSize: 14, color: C.ink }}>{obraSelecionada.cliente || '—'}</strong></div>
              <div><span style={{ fontSize: 11, color: C.inkSoft, display: 'block' }}>Contrato</span><strong style={{ fontSize: 14, color: C.ink }}>{fmt(Number(obraSelecionada.valor_contrato || 0))}</strong></div>
              <div>
                <span style={{ fontSize: 11, color: C.inkSoft, display: 'block' }}>Progresso</span>
                <strong style={{ fontSize: 14, color: C.amber }}>
                  {(() => {
                    const c = Number(obraSelecionada.valor_contrato || 0)
                    const m = Number(obraSelecionada.medido_acumulado || 0)
                    const pctRaw = c > 0 ? (m / c) * 100 : (obraSelecionada.progresso || 0)
                    return pctRaw === 0 ? '0%' : pctRaw < 0.01 ? '<0,01%' : (pctRaw % 1 === 0 ? pctRaw.toFixed(0) + '%' : pctRaw.toFixed(2).replace('.', ',') + '%')
                  })()}
                </strong>
              </div>
              <div><span style={{ fontSize: 11, color: C.inkSoft, display: 'block' }}>Fotos do Financeiro</span><strong style={{ fontSize: 14, color: C.ink }}>{fotosObra.length}</strong></div>
            </div>
            
            {/* Medições e BM - Sistemático com histórico */}
            <div style={{ background: '#12141C', padding: 20, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, color: C.ink }}>📏 Métricas de Medição</h3>

              {/* Resumo atual */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>BM Atual</div>
                  <div style={{ fontSize: 16, color: C.amber, fontWeight: 800, marginTop: 4 }}>{obraSelecionada.bm_atual || '—'}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Medido Acumulado (Total)</div>
                  <div style={{ fontSize: 16, color: C.ink, fontWeight: 800, marginTop: 4 }}>{fmt(Number(obraSelecionada.medido_acumulado || 0))}</div>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.06)', padding: 12, borderRadius: 6, border: `1px solid rgba(52,211,153,0.2)` }}>
                  <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Saldo a Medir</div>
                  <div style={{ fontSize: 16, color: '#34D399', fontWeight: 800, marginTop: 4 }}>{fmt(Math.max(0, Number(obraSelecionada.valor_contrato || 0) - Number(obraSelecionada.medido_acumulado || 0)))}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Nº de BMs</div>
                  <div style={{ fontSize: 16, color: C.ink, fontWeight: 800, marginTop: 4 }}>{(obraSelecionada.historico_medicoes || []).length}</div>
                </div>
              </div>

              {/* Formulário nova medição */}
              {podeGerenciar && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: `1px dashed ${C.border}`, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: C.amber, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>+ Registrar Nova Medição</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, color: C.inkSoft, display: 'block', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>BM (Referência) *</label>
                      <input style={input} placeholder="Ex: BM-004" value={metricasForm.bm_atual} onChange={e => setMetricasForm({ ...metricasForm, bm_atual: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: C.inkSoft, display: 'block', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>Medido Neste BM (R$) *</label>
                      <input style={input} placeholder="0,00" value={metricasForm.medido_acumulado} onChange={e => setMetricasForm({ ...metricasForm, medido_acumulado: e.target.value })} />
                      {metricasForm.medido_acumulado && (
                        <div style={{ fontSize: 9, color: C.amber, marginTop: 4, fontWeight: 700 }}>
                          Novo Total Acumulado: {fmt(Number(obraSelecionada.medido_acumulado || 0) + parseCurrency(metricasForm.medido_acumulado))}
                        </div>
                      )}
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 10, color: C.inkSoft, display: 'block', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>Observação</label>
                      <input style={input} placeholder="Descrição opcional desta medição..." value={metricasForm.observacao} onChange={e => setMetricasForm({ ...metricasForm, observacao: e.target.value })} />
                    </div>
                  </div>
                  <button onClick={() => salvarMetricasObra(obraSelecionada.id)} style={{ ...btn(C.amber), padding: '8px 20px' }}>
                    Registrar Medição
                  </button>
                </div>
              )}

              {/* Histórico de medições */}
              <div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Histórico de Medições</div>
                {(obraSelecionada.historico_medicoes || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: C.inkSoft, fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 6 }}>Nenhuma medição registrada ainda.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[...(obraSelecionada.historico_medicoes || [])].reverse().map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                        {/* linha da timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? C.amber : C.border, marginTop: 10, zIndex: 1, border: `2px solid ${idx === 0 ? C.amber : C.inkSoft}` }} />
                          {idx < (obraSelecionada.historico_medicoes || []).length - 1 && (
                            <div style={{ width: 1, flex: 1, background: C.border, marginTop: 2 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingBottom: 16 }}>
                          {editandoMedicaoId === item.id ? (
                            // ─── Modo edição inline ───
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.amber}44`, borderRadius: 6, padding: 12 }}>
                              <div style={{ fontSize: 10, color: C.amber, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>✏️ Editando Medição</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
                                <div>
                                  <label style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>BM *</label>
                                  <input style={input} value={editMedicaoForm.bm} onChange={e => setEditMedicaoForm(f => ({ ...f, bm: e.target.value }))} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>Medido Acumulado (R$) *</label>
                                  <input style={input} type="number" step="0.01" value={editMedicaoForm.medido_acumulado} onChange={e => setEditMedicaoForm(f => ({ ...f, medido_acumulado: e.target.value }))} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>Observação</label>
                                  <input style={input} value={editMedicaoForm.observacao} onChange={e => setEditMedicaoForm(f => ({ ...f, observacao: e.target.value }))} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => salvarEdicaoMedicao(obraSelecionada.id, item.id)} style={{ ...btn(C.amber), padding: '5px 14px', fontSize: 11 }}>Salvar</button>
                                <button onClick={() => setEditandoMedicaoId(null)} style={{ ...btnGhost, padding: '5px 14px', fontSize: 11 }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            // ─── Modo exibição ───
                            <>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: idx === 0 ? C.amber : C.ink, background: idx === 0 ? C.amber + '18' : 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>{item.bm}</span>
                                <span style={{ fontSize: 10, color: C.inkSoft }}>{new Date(item.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                <span style={{ fontSize: 10, color: C.inkSoft }}>👤 {item.autor}</span>
                                {podeGerenciar && (
                                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                                    <button
                                      onClick={() => { setEditandoMedicaoId(item.id); setEditMedicaoForm({ bm: item.bm, medido_acumulado: String(item.medido_acumulado), observacao: item.observacao || '' }) }}
                                      style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}
                                      title="Editar"
                                    ><Edit3 size={11} /></button>
                                    <button
                                      onClick={() => excluirMedicao(obraSelecionada.id, item.id)}
                                      style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}
                                      title="Excluir"
                                    ><Trash2 size={11} /></button>
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const historicoArray = obraSelecionada.historico_medicoes || []
                                // Como a lista está invertida (.reverse()), o item anterior na ordem cronológica é o índice + 1
                                const itemAnterior = historicoArray[historicoArray.length - 1 - idx - 1]
                                const medidoDesteBM = itemAnterior ? Math.max(0, item.medido_acumulado - itemAnterior.medido_acumulado) : item.medido_acumulado
                                return (
                                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    <div>
                                      <span style={{ fontSize: 9, color: C.amber, textTransform: 'uppercase', fontWeight: 800 }}>Medido Neste BM</span>
                                      <div style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>{fmt(medidoDesteBM)}</div>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase' }}>Medido Acum. (Total)</span>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{fmt(item.medido_acumulado)}</div>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase' }}>Saldo a Medir</span>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>{fmt(item.saldo_a_medir)}</div>
                                    </div>
                                    {item.observacao && (
                                      <div style={{ flex: '1 1 200px' }}>
                                        <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase' }}>Obs.</span>
                                        <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic' }}>{item.observacao}</div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Anexos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}><Camera size={16}/> Galeria de Fotos e Comprovantes</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {fotosObra.length > 0 && (
                    <button
                      onClick={() => selecionarTodasFotos(fotosObra)}
                      style={{ ...btnGhost, padding: '6px 10px', fontSize: 11, color: C.ink }}
                    >
                      {selecionadasFotos.length === fotosObra.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  )}

                  {selecionadasFotos.length > 0 && (
                    <>
                      <button
                        onClick={() => void baixarFotosEmLote(fotosObra)}
                        style={{ ...btn('#3B82F6'), padding: '6px 12px', fontSize: 11 }}
                      >
                        <ArrowDownRight size={13} /> Baixar ({selecionadasFotos.length})
                      </button>

                      {podeGerenciar && (
                        <button
                          onClick={() => void excluirFotosEmLote()}
                          disabled={processandoLote}
                          style={{ ...btn('#EF4444'), padding: '6px 12px', fontSize: 11 }}
                        >
                          <Trash2 size={13} /> {processandoLote ? 'Excluindo...' : `Excluir (${selecionadasFotos.length})`}
                        </button>
                      )}
                    </>
                  )}

                  {podeGerenciar && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...input, width: 180 }} placeholder="Legenda da nova foto..." value={legenda} onChange={e => setLegenda(e.target.value)} />
                      <label style={{ ...btn(C.amber), cursor: 'pointer', padding: '0 12px' }}>
                        <Plus size={14} /> Anexar
                        <input hidden type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void anexarFoto(f); e.currentTarget.value = '' }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {fotosObra.map(f => {
                  const isRdo = Boolean(f.rdo_id) || (f.imagem_url && !f.imagem_url.includes('comprovantes'))
                  const fotoUrl = !f.imagem_url ? '' : f.imagem_url.startsWith('http')
                    ? f.imagem_url
                    : supabase.storage.from(isRdo ? 'rdo-fotos' : 'comprovantes').getPublicUrl(f.imagem_url).data.publicUrl

                  const isChecked = selecionadasFotos.includes(f.id)

                  return (
                    <div key={f.id} style={{ border: `1px solid ${isChecked ? C.amber : C.border}`, borderRadius: 6, overflow: 'hidden', background: isChecked ? '#1E1B13' : '#12141C', position: 'relative', transition: 'all 0.2s' }}>
                      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setFotoExpandida({ ...f, resolvedUrl: fotoUrl })}>
                        <img src={fotoUrl} alt={f.legenda || 'Foto'} style={{ width: '100%', height: 130, objectFit: 'cover' }} />
                        
                        {/* Checkbox de Seleção */}
                        <div
                          onClick={e => { e.stopPropagation(); toggleFotoSelecionada(f.id) }}
                          style={{
                            position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 4,
                            background: isChecked ? C.amber : 'rgba(11,12,14,0.85)',
                            border: `1.5px solid ${isChecked ? C.amber : '#fff'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', zIndex: 2, backdropFilter: 'blur(4px)'
                          }}
                          title={isChecked ? 'Desmarcar foto' : 'Selecionar foto'}
                        >
                          {isChecked && <Check size={14} color="#0B0C0E" strokeWidth={3} />}
                        </div>

                        <div style={{ position: 'absolute', bottom: 6, left: 6, background: isRdo ? '#3B82F6DD' : '#10B981DD', padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 800, color: '#fff', backdropFilter: 'blur(3px)' }}>
                          {isRdo ? '📋 Foto RDO' : '💰 Financeiro'}
                        </div>
                        {podeGerenciar && (
                          <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, background: 'rgba(11,12,14,0.85)', padding: '2px 4px', borderRadius: 4, backdropFilter: 'blur(4px)' }} onClick={e => e.stopPropagation()}>
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
                      <div style={{ padding: '8px 10px' }}>
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
                              <button onClick={() => salvarEdicaoFoto(f.id)} style={{ ...btn(C.amber), padding: '2px 8px', fontSize: 10 }}>Salvar</button>
                              <button onClick={() => setEditandoFotoId(null)} style={{ ...btnGhost, padding: '2px 8px', fontSize: 10 }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.legenda}>{f.legenda || 'Sem legenda'}</div>
                            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>{new Date(f.data_iso).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
                {fotosObra.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '30px 0', textAlign: 'center', color: C.inkSoft, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                    Nenhuma foto anexada a esta obra.
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
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', maxWidth: 460, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: C.ink, margin: 0 }}>✏️ Editar Obra</h3>
                <button onClick={() => setEditandoObra(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={salvarEdicaoObra} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={label}>Nome da Obra *</label>
                  <input style={input} value={editObraForm.nome} onChange={e => setEditObraForm({ ...editObraForm, nome: e.target.value })} placeholder="Ex: LOTE 07" />
                </div>
                <div>
                  <label style={label}>Cliente</label>
                  <input style={input} value={editObraForm.cliente} onChange={e => setEditObraForm({ ...editObraForm, cliente: e.target.value })} placeholder="Ex: Governo do Estado" />
                </div>
                <div>
                  <label style={label}>Endereço / Localização</label>
                  <input style={input} value={editObraForm.endereco} onChange={e => setEditObraForm({ ...editObraForm, endereco: e.target.value })} placeholder="Ex: Recife - PE" />
                </div>
                <div>
                  <label style={label}>Valor do Contrato (R$)</label>
                  <input style={input} value={editObraForm.valor} onChange={e => setEditObraForm({ ...editObraForm, valor: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <label style={label}>Status</label>
                  <select style={input} value={editObraForm.status} onChange={e => setEditObraForm({ ...editObraForm, status: e.target.value })}>
                    <option value="Em dia">Em dia</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Atrasada">Atrasada</option>
                    <option value="Concluída">Concluída</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" onClick={() => setEditandoObra(null)} style={{ ...btnGhost, padding: '8px 16px' }}>Cancelar</button>
                  <button type="submit" style={{ ...btn(C.amber), padding: '8px 20px' }}>Salvar Alterações</button>
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
                style={{ ...btnGhost, color: C.amber, border: `1px solid ${C.amber}40`, textDecoration: 'none', padding: '6px 14px', fontSize: 12 }}
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
                style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', border: `1px solid ${C.border}` }}
              />
              <div style={{ textAlign: 'center', background: 'rgba(18,20,28,0.9)', padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{fotoExpandida.legenda || 'Sem legenda'}</span>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.inkSoft }}>
                  <span>📅 {new Date(fotoExpandida.data_iso).toLocaleDateString('pt-BR')}</span>
                  <span>{fotoExpandida.rdo_id ? '📋 Foto enviada via RDO' : '💰 Anexada pelo Financeiro'}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
}

function DashboardTab({ colaboradorAtivo, permissaoAtiva }: TabProps) {
  const [contas, setContas]     = useState<ContaComRelacoes[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    let qC = supabase.from('contas').select('*, empresa:empresas(nome_fantasia,razao_social,cor), fornecedor:fornecedores(razao_social,nome_fantasia), obra:obras(nome)').order('data_previsao')
    let qE = supabase.from('empresas').select('*').order('razao_social')
    
    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qC = qC.in('empresa_id', ids)
        qE = qE.in('id', ids)
      }
    }
    
    const [{ data: c }, { data: e }] = await Promise.all([qC, qE])
    setContas((c as ContaComRelacoes[]) ?? [])
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
    const rec = filtered.filter(c => c.tipo === 'receber' && c.status === 'Pago').reduce((s, c) => s + c.valor, 0)
    const des = filtered.filter(c => c.tipo === 'pagar'   && c.status === 'Pago').reduce((s, c) => s + c.valor, 0)
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
      if (c.status === 'Pago') return false
      const d = new Date((c.data_previsao || c.data_vencimento) + 'T00:00:00')
      return d >= hoje && d <= mais7
    })
    const v30 = filtered.filter(c => {
      if (c.status === 'Pago') return false
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
      if (c.status === 'Pago' && c.pago_em) {
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

    filtered.filter(c => c.status === 'Pago').forEach(c => {
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
    { label: 'Vence em 30 dias', value: fmt(total30d),     icon: Clock,         color: '#3B82F6' },
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
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ razao_social: '', nome_fantasia: '', cnpj: '', cor: '#C8A96E' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const { data } = await supabase.from('empresas').select('*').order('razao_social')
    setEmpresas(data ?? [])
    setLoading(false)
  }, [])
  useRealtimeSync(load, 'financeiro-empresas')
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.razao_social.trim()) return
    setSaving(true)
    const { error } = await supabase.from('empresas').insert({ ...form, razao_social: form.razao_social.trim(), nome_fantasia: form.nome_fantasia.trim() || null, cnpj: form.cnpj.trim() || null })
    if (error) {
      setSaving(false)
      return toast(`Não foi possível salvar a empresa: ${error.message}`, 'error')
    }
    setForm({ razao_social: '', nome_fantasia: '', cnpj: '', cor: '#C8A96E' })
    setShowForm(false)
    setSaving(false)
    await load()
    toast('Empresa cadastrada.', 'success')
  }

  const remove = async (id: string) => {
    if (!(await confirm('Remover empresa', 'Deseja realmente remover esta empresa?', { confirmLabel: 'Remover', confirmColor: C.red }))) return
    await supabase.from('empresas').delete().eq('id', id)
    load()
  }

  // Verifica permissão dinamicamente do banco
  const podeGerenciar = permissaoAtiva?.pode_empresas && colaboradorAtivo.cargo !== 'admin_empresa'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.ink }}>Empresas Cadastradas</h2>
        {podeGerenciar && (
          <button style={btn()} onClick={() => setShowForm(v => !v)}>
            <Plus size={14} /> Nova Empresa
          </button>
        )}
      </div>

      {showForm && podeGerenciar && (
        <div style={{ ...card, marginBottom: 20, borderColor: C.amber + '44' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={label}>Razão Social *</label>
              <input style={input} value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} placeholder="Nome legal da empresa" />
            </div>
            <div>
              <label style={label}>Nome Fantasia</label>
              <input style={input} value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} placeholder="Como é conhecida" />
            </div>
            <div>
              <label style={label}>CNPJ</label>
              <input style={input} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label style={label}>Cor de Identificação</label>
              <input type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} style={{ height: 38, width: '100%', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', padding: 2 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn()} onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button style={btnGhost} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando empresas...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {empresas.filter(e => {
            if (colaboradorAtivo.cargo !== 'admin_empresa') return true
            const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
            return ids.includes(e.id)
          }).map(e => (
            <div key={e.id} style={{ ...card, borderLeft: `3px solid ${e.cor}`, position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: e.cor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Building2 size={16} color={e.cor} />
              </div>
              <div style={{ fontWeight: 900, color: C.ink, marginBottom: 2 }}>{e.nome_fantasia ?? e.razao_social}</div>
              {e.nome_fantasia && <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>{e.razao_social}</div>}
              {e.cnpj && <div style={{ fontSize: 11, color: C.inkSoft }}>CNPJ: {e.cnpj}</div>}
              {podeGerenciar && (
                <button onClick={() => remove(e.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {empresas.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Nenhuma empresa cadastrada no sistema.</p>}
        </div>
      )}
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
  const [form, setForm] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', tipo: 'PJ' as 'PJ'|'PF',
    telefone: '', email: '', responsavel: '', pix: '', categoria: '', empresa_id: '',
    endereco: '', banco: '', agencia: '', conta: ''
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    let qF = supabase.from('fornecedores').select('*').order('razao_social')
    let qE = supabase.from('empresas').select('*').order('razao_social')
    let qC = supabase.from('contas').select('*')

    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qF = qF.or(`empresa_id.in.(${ids.join(',')}),empresa_id.is.null`)
        qE = qE.in('id', ids)
        qC = qC.in('empresa_id', ids)
      }
    }

    const [{ data: f }, { data: e }, { data: c }] = await Promise.all([qF, qE, qC])
    setFornecedores(f ?? [])
    setEmpresas(e ?? [])
    setContasFornecedores(c ?? [])
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
    setShowForm(true)
  }

  const iniciarEdicaoFornecedor = (f: Fornecedor) => {
    setEditingFornecedor(f)
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
    setShowForm(true)
  }

  const save = async () => {
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

  const remove = async (id: string) => {
    if (!(await confirm('Remover fornecedor', 'Deseja realmente remover este fornecedor?', { confirmLabel: 'Remover', confirmColor: C.red }))) return
    await supabase.from('fornecedores').delete().eq('id', id)
    load()
  }

  const empresasIds = colaboradorAtivo.empresas_ids?.length ? colaboradorAtivo.empresas_ids : (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])

  const filtered = useMemo(() =>
    fornecedores.filter(f => {
      // Regra de Permissões: se for admin_empresa, filtra pela empresa do usuário
      if (colaboradorAtivo.cargo === 'admin_empresa') {
        if (f.empresa_id && !empresasIds.includes(f.empresa_id)) {
          return false
        }
      }
      return (
        f.razao_social.toLowerCase().includes(search.toLowerCase()) ||
        (f.nome_fantasia ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (f.categoria ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (f.cnpj ?? '').includes(search)
      )
    })
  , [fornecedores, search, colaboradorAtivo, empresasIds])

  // Indexador O(1): pré-computa totais de contas por fornecedor uma única vez
  const contasResumoMap = useMemo(() => {
    const map: Record<string, { totalEmAberto: number; totalPago: number; totalPagasCount: number; temVencidas: boolean }> = {}
    contasFornecedores.forEach(c => {
      if (!c.fornecedor_id) return
      if (!map[c.fornecedor_id]) {
        map[c.fornecedor_id] = { totalEmAberto: 0, totalPago: 0, totalPagasCount: 0, temVencidas: false }
      }
      const item = map[c.fornecedor_id]
      if (c.status === 'Pago') {
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

  // Verifica permissão dinamicamente (seja pela flag ou pela aba ativa)
  const temAbaFornecedores = permissaoAtiva?.abas_financeiro ? permissaoAtiva.abas_financeiro.split(',').map(a => a.trim()).includes('fornecedores') : false
  const podeCriar = Boolean(permissaoAtiva?.pode_fornecedores || temAbaFornecedores || colaboradorAtivo.cargo === 'admin_geral')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.ink }}>Fornecedores centralizados</h2>
        {podeCriar && (
          <button style={btn()} onClick={abrirNovoForm}><Plus size={14} /> Novo Fornecedor</button>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <Search size={13} color={C.inkSoft} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input style={{ ...input, paddingLeft: 34 }} placeholder="Buscar por razão, fantasia, CNPJ/CPF ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showForm && podeCriar && (
        <div style={{ ...card, marginBottom: 20, borderColor: C.amber + '44' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.ink }}>
              {editingFornecedor ? `Editar Fornecedor: ${editingFornecedor.razao_social}` : 'Novo Fornecedor'}
            </h3>
            <span style={{ fontSize: 11, color: C.inkSoft }}>{form.tipo === 'PJ' ? 'Pessoa Jurídica (CNPJ)' : 'Pessoa Física (CPF)'}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={label}>Tipo de Pessoa</label>
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
              <input style={input} value={form.razao_social} onChange={e => setForm(prev => ({ ...prev, razao_social: e.target.value }))} placeholder={form.tipo === 'PJ' ? "Ex: Cimento & Cia Ltda" : "Ex: João da Silva"} />
            </div>
            {form.tipo === 'PJ' && (
              <div>
                <label style={label}>Nome Fantasia</label>
                <input style={input} value={form.nome_fantasia} onChange={e => setForm(prev => ({ ...prev, nome_fantasia: e.target.value }))} placeholder="Ex: Cimento Bela Vista" />
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
              <label style={label}>E-mail</label>
              <input style={input} type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="vendas@fornecedor.com" />
            </div>
            <div>
              <label style={label}>Contato Responsável</label>
              <input style={input} value={form.responsavel} onChange={e => setForm(prev => ({ ...prev, responsavel: e.target.value }))} placeholder="Ex: Ricardo Silva" />
            </div>
            <div>
              <label style={label}>Categoria</label>
              <input style={input} value={form.categoria} onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value }))} placeholder="Ex: Material, Serviço, Equipamentos" />
            </div>
            <div>
              <label style={label}>Banco</label>
              <input style={input} value={form.banco} onChange={e => setForm(prev => ({ ...prev, banco: e.target.value }))} placeholder="Ex: Itaú (341)" />
            </div>
            <div>
              <label style={label}>Agência</label>
              <input style={input} value={form.agencia} onChange={e => setForm(prev => ({ ...prev, agencia: e.target.value }))} placeholder="Ex: 0001" />
            </div>
            <div>
              <label style={label}>Conta Corrente</label>
              <input style={input} value={form.conta} onChange={e => setForm(prev => ({ ...prev, conta: e.target.value }))} placeholder="Ex: 12345-6" />
            </div>
            <div>
              <label style={label}>Chave PIX</label>
              <input style={input} value={form.pix} onChange={e => setForm(prev => ({ ...prev, pix: e.target.value }))} placeholder="Chave PIX" />
            </div>
            <div>
              <label style={label}>Empresa preferencial</label>
              <select style={input} value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}>
                <option value="">Compartilhado entre todas</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={label}>Endereço Completo</label>
              <input style={input} value={form.endereco} onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))} placeholder="Av. Paulista, 1000 - São Paulo/SP" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn()} onClick={save} disabled={saving}>{saving ? 'Salvando...' : editingFornecedor ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}</button>
            <button style={btnGhost} onClick={() => { setShowForm(false); setEditingFornecedor(null) }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando fornecedores...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(f => {
            const resumo = contasResumoMap[f.id] || { totalEmAberto: 0, totalPago: 0, totalPagasCount: 0, temVencidas: false }
            const { totalEmAberto, totalPago, totalPagasCount, temVencidas: temContasVencidas } = resumo
            const docLabel = f.tipo === 'PF' ? 'CPF' : 'CNPJ'

            return (
              <div key={f.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14, borderLeft: temContasVencidas ? `3px solid #EF4444` : `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: temContasVencidas ? '#EF444415' : C.amber + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={16} color={temContasVencidas ? '#EF4444' : C.amber} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: C.ink, fontSize: 14 }}>{f.nome_fantasia || f.razao_social}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: f.tipo === 'PF' ? '#3B82F620' : '#10B98120', color: f.tipo === 'PF' ? '#60A5FA' : '#34D399' }}>
                        {f.tipo === 'PF' ? 'PESSOA FÍSICA' : 'PESSOA JURÍDICA'}
                      </span>
                      {temContasVencidas && (
                        <span style={{ fontSize: 9, fontWeight: 900, background: '#EF444420', color: '#EF4444', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <AlertTriangle size={8} /> CONTAS VENCIDAS
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                      {f.cnpj ? `${docLabel}: ${f.cnpj}` : `Sem ${docLabel}`} · {f.categoria ?? 'Sem Categoria'} {f.responsavel ? `· Resp: ${f.responsavel}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 16 }}>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>Em Aberto: <strong style={{ color: temContasVencidas ? '#EF4444' : C.ink }}>{fmt(totalEmAberto)}</strong></div>
                    <div style={{ fontSize: 10, color: '#34D399' }}>Pagas: {totalPagasCount} ({fmt(totalPago)})</div>
                  </div>
                  {podeCriar && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => iniciarEdicaoFornecedor(f)} title="Editar Fornecedor" style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => remove(f.id)} title="Excluir Fornecedor" style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {(f.banco || f.pix || f.endereco) && (
                  <div style={{ background: '#0B0C0E', padding: '10px 14px', borderRadius: 6, fontSize: 11, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, border: `1px solid ${C.border}` }}>
                    {f.endereco && <div><span style={{ color: C.inkSoft, fontWeight: 700 }}>Endereço:</span> {f.endereco}</div>}
                    <div style={{ display: 'flex', gap: 16 }}>
                      {f.banco && (
                        <div>
                          <span style={{ color: C.inkSoft, fontWeight: 700 }}>Banco:</span> {f.banco} · Ag: {f.agencia} · Cc: {f.conta}
                        </div>
                      )}
                      {f.pix && (
                        <div>
                          <span style={{ color: C.inkSoft, fontWeight: 700 }}>PIX:</span> <span style={{ color: C.amber, fontWeight: 700 }}>{f.pix}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {goToHistoricoByFornecedor && (
                  <div style={{ padding: '0 14px', marginBottom: 14 }}>
                    <button 
                      style={{ ...btnGhost, color: C.amber, border: `1px solid ${C.amber}40`, width: '100%', justifyContent: 'center' }}
                      onClick={() => goToHistoricoByFornecedor(f.id)}
                    >
                      <ArrowUpRight size={14} /> Ver Contas & Negociar (Histórico)
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Nenhum fornecedor cadastrado.</p>}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: LANÇAR CONTA
// ════════════════════════════════════════════════════════
function ContasTab({ colaboradorAtivo, permissaoAtiva }: TabProps) {
  const [empresas, setEmpresas]         = useState<Empresa[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [obras, setObras]               = useState<Obra[]>([])
  const [saving, setSaving]             = useState(false)
  const [ok, setOk]                     = useState(false)
  const [anexoFile, setAnexoFile]       = useState<File | null>(null)
  const [anexoNome, setAnexoNome]       = useState('')
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
  })

  useEffect(() => {
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
      setObras(o ?? [])
    })
  }, [colaboradorAtivo])

  useEffect(() => {
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    if (ids.length === 1) {
      setForm(f => ({ ...f, empresa_id: ids[0] }))
    }
  }, [colaboradorAtivo])

  const save = async () => {
    const dataBase = form.tipo === 'pagar' ? form.data_vencimento : form.data_previsao
    if (!form.empresa_id || !form.descricao || !form.valor || !dataBase) {
      toast('Preencha os campos obrigatórios (*)', 'error')
      return
    }
    setSaving(true)

    // Upload real do comprovante para o Supabase Storage
    let comprovanteUrl: string | null = null
    if (anexoFile) {
      const ext = anexoFile.name.split('.').pop()
      const fileName = `comprovante_${Date.now()}.${ext}`
      const uploadPath = form.empresa_id ? `${form.empresa_id}/${fileName}` : fileName
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('comprovantes')
        .upload(uploadPath, anexoFile, { upsert: true })
      if (uploadErr) {
        toast('Erro ao enviar o comprovante. Verifique o bucket "comprovantes" no Supabase.', 'error')
        setSaving(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(uploadData.path)
      comprovanteUrl = publicUrl
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
    setAnexoFile(null)
    setAnexoNome('')
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
      recorrencia: 'unico'
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnexoFile(e.target.files[0])
      setAnexoNome(e.target.files[0].name)
    }
  }

  const podeRegistrar = permissaoAtiva?.pode_lancar

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 900, color: C.ink }}>Lançar Conta</h2>

      {!podeRegistrar ? (
        <div style={{ ...card, color: C.inkSoft }}>
          <Shield size={24} color={C.amber} style={{ marginBottom: 12 }} />
          <div>Seu cargo atual não possui permissões para registrar novas contas ou despesas no financeiro.</div>
        </div>
      ) : (
        <>
          {ok && (
            <div style={{ background: '#34D39920', border: '1px solid #34D39944', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#34D399', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={15} /> Lançamento financeiro registrado com sucesso!
            </div>
          )}

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['pagar','receber'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 12,
                    border: `1px solid ${form.tipo === t ? (t === 'pagar' ? '#F87171' : '#34D399') : C.border}`,
                    background: form.tipo === t ? (t === 'pagar' ? '#F8717118' : '#34D39918') : 'none',
                    color: form.tipo === t ? (t === 'pagar' ? '#F87171' : '#34D399') : C.inkSoft,
                    textTransform: 'uppercase', letterSpacing: .5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {t === 'pagar' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  Conta a {t === 'pagar' ? 'Pagar' : 'Receber'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>Empresa *</label>
                <select
                  style={input}
                  disabled={(() => {
                    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                    return ids.length === 1
                  })()}
                  value={form.empresa_id}
                  onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}
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
                <label style={label}>Possui fornecedor?</label>
                <select style={input} value={form.possui_fornecedor ? 'sim' : 'nao'} onChange={e => setForm(f => ({ ...f, possui_fornecedor: e.target.value === 'sim', fornecedor_id: e.target.value === 'sim' ? f.fornecedor_id : '' }))}>
                  <option value="nao">Não possui</option><option value="sim">Possui</option>
                </select>
              </div>
              {form.possui_fornecedor && <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...label, marginBottom: 0 }}>Fornecedor</label>
                  {permissaoAtiva?.pode_fornecedores && (
                    <button
                      type="button"
                      onClick={() => setShowNovoFornModal(true)}
                      style={{ background: 'none', border: 'none', color: C.amber, fontSize: 10, fontWeight: 800, cursor: 'pointer', padding: 0 }}
                      title="Cadastrar fornecedor rapidamente sem sair da tela"
                    >
                      + Novo Fornecedor
                    </button>
                  )}
                </div>
                <select style={input} value={form.fornecedor_id} onChange={e => setForm(f => ({ ...f, fornecedor_id: e.target.value }))}>
                  <option value="">Selecione o fornecedor</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia ?? f.razao_social}</option>)}
                </select>
              </div>}
              <div>
                <label style={label}>Obra Vinculada</label>
                <select style={input} value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}>
                  <option value="">Geral / Administrativo</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Categoria</label>
                <select style={input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Selecione a categoria</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>Descrição do Lançamento *</label>
                <input style={input} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: NF Cimento CP-II" />
              </div>
              <div>
                <label style={label}>Recorrência automática</label>
                <select style={input} value={form.recorrencia} onChange={e => setForm(f => ({ ...f, recorrencia: e.target.value as any }))}>
                  <option value="unico">Parcela Única</option>
                  <option value="mensal">Mensal (12 meses)</option>
                  <option value="semanal">Semanal (4 semanas)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>Valor do Título *</label>
                <input style={input} type="text" inputMode="decimal" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label style={label}>{form.tipo === 'pagar' ? 'Data de vencimento *' : 'Data de previsão *'}</label>
                <input style={input} type="date" value={form.tipo === 'pagar' ? form.data_vencimento : form.data_previsao} onChange={e => form.tipo === 'pagar' ? setForm(f => ({ ...f, data_vencimento: e.target.value })) : setForm(f => ({ ...f, data_previsao: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={label}>Observações do lançamento</label>
              <textarea style={input} rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informações para aprovação, pagamento ou conferência" />
            </div>

            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: '14px 18px', background: '#0B0C0E33' }}>
              <label style={{ ...label, marginBottom: 4 }}>Anexar Boleto / Nota Fiscal</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ ...btnGhost, cursor: 'pointer', background: '#111' }}>
                  <Paperclip size={13} />
                  Selecionar arquivo
                  <input type="file" onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,application/pdf" />
                </label>
                {anexoNome && (
                  <span style={{ fontSize: 11, color: '#34D399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> {anexoNome}
                  </span>
                )}
              </div>
            </div>

            {/* Exibe aviso de aprovação necessário caso ultrapasse limite */}
            {form.tipo === 'pagar' && form.valor && (permissaoAtiva?.limite_valor ?? 5000) !== 0 && parseFloat(form.valor) > (permissaoAtiva?.limite_valor ?? 5000) && !permissaoAtiva?.pode_aprovar && (
              <div style={{ background: '#3B82F618', border: '1px solid #3B82F633', color: '#3B82F6', borderRadius: 6, padding: '10px 14px', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} /> Lançamento de valor elevado exigirá aprovação de um Administrador para ser compensado.
              </div>
            )}

            <button style={{ ...btn(), alignSelf: 'flex-start' }} onClick={save} disabled={saving}>
              {saving ? 'Registrando...' : <><Plus size={14} /> Lançar Conta</>}
            </button>
          </div>
        </>
      )}

      {/* MODAL CADASTRAR NOVO FORNECEDOR RÁPIDO */}
      <AnimatePresence>
        {showNovoFornModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', maxWidth: 460, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: C.ink, margin: 0 }}>👥 Cadastrar Novo Fornecedor</h3>
                <button onClick={() => setShowNovoFornModal(false)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={salvarNovoFornecedorRapido} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setFornForm(f => ({ ...f, tipo: 'PJ' }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: `1px solid ${fornForm.tipo === 'PJ' ? C.amber : C.border}`, background: fornForm.tipo === 'PJ' ? C.amber + '18' : 'none', color: fornForm.tipo === 'PJ' ? C.amber : C.inkSoft }}
                  >Pessoa Jurídica (PJ)</button>
                  <button
                    type="button"
                    onClick={() => setFornForm(f => ({ ...f, tipo: 'PF' }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: `1px solid ${fornForm.tipo === 'PF' ? '#3B82F6' : C.border}`, background: fornForm.tipo === 'PF' ? '#3B82F618' : 'none', color: fornForm.tipo === 'PF' ? '#60A5FA' : C.inkSoft }}
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
                  <input style={input} value={fornForm.cnpj} onChange={e => setFornForm({ ...fornForm, cnpj: e.target.value })} placeholder={fornForm.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Chave PIX</label>
                    <input style={input} value={fornForm.pix} onChange={e => setFornForm({ ...fornForm, pix: e.target.value })} placeholder="CNPJ, E-mail ou Celular" />
                  </div>
                  <div>
                    <label style={label}>Categoria</label>
                    <input style={input} value={fornForm.categoria} onChange={e => setFornForm({ ...fornForm, categoria: e.target.value })} placeholder="Ex: Materiais, Serviços..." />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" onClick={() => setShowNovoFornModal(false)} style={{ ...btnGhost, padding: '8px 16px' }}>Cancelar</button>
                  <button type="submit" disabled={salvandoForn} style={{ ...btn(C.amber), padding: '8px 20px' }}>{salvandoForn ? 'Salvando...' : 'Cadastrar Fornecedor'}</button>
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
function HistoricoTab({ colaboradorAtivo, permissaoAtiva, confirm, prompt, initialFornecedorId }: TabProps) {
  const [contas, setContas]     = useState<ContaComRelacoes[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtEmpresa, setFiltEmpresa] = useState('')
  const [filtFornecedor, setFiltFornecedor] = useState(initialFornecedorId || '')
  const [filtTipo, setFiltTipo]       = useState<'todos'|'pagar'|'receber'>('todos')
  const [filtStatus, setFiltStatus]   = useState<'todos'|'Lançado'|'Bloqueado'|'Aguardando aprovação'|'Liberado/OK'|'A pagar'|'Pago Parcial'|'Pago'|'Negado'>('todos')
  const [filtDataInicio, setFiltDataInicio] = useState('')
  const [filtDataFim, setFiltDataFim] = useState('')
  const [filtOrdem, setFiltOrdem] = useState<'novo' | 'antigo' | 'maior_valor' | 'menor_valor' | 'az' | 'za'>('novo')
  const [search, setSearch]           = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [modoExportacao, setModoExportacao] = useState(false)
  const [selecionadasContas, setSelecionadasContas] = useState<string[]>([])
  const [editandoConta, setEditandoConta] = useState<ContaComRelacoes | null>(null)
  const [formEdicao, setFormEdicao] = useState<Partial<ContaComRelacoes>>({})

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
      'ID', 'Tipo', 'Descrição', 'Empresa', 'Fornecedor', 'CNPJ/CPF Fornecedor',
      'PIX', 'Banco', 'Agência', 'Conta Bancária', 'Obra', 'Categoria',
      'Valor Original (R$)', 'Status', 'Data Vencimento/Previsao', 'Pago Em',
      'Criado Por', 'Aprovado Por', 'Observacoes'
    ]

    const rows = listaExportar.map(c => {
      const forn = c.fornecedor
      return [
        c.id,
        c.tipo === 'pagar' ? 'Conta a Pagar' : 'Conta a Receber',
        `"${(c.descricao || '').replace(/"/g, '""')}"`,
        `"${(c.empresa?.nome_fantasia || c.empresa?.razao_social || '').replace(/"/g, '""')}"`,
        `"${(forn?.nome_fantasia || forn?.razao_social || 'Geral').replace(/"/g, '""')}"`,
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

  const [obras, setObras]       = useState<Obra[]>([])

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    let qC = supabase.from('contas').select('*, empresa:empresas(nome_fantasia,razao_social,cor), fornecedor:fornecedores(razao_social,nome_fantasia,banco,agencia,conta,pix,cnpj), obra:obras(nome)').order('data_previsao', { ascending: false })
    let qE = supabase.from('empresas').select('*').order('razao_social')
    let qF = supabase.from('fornecedores').select('id, razao_social, nome_fantasia').order('razao_social')
    let qO = supabase.from('obras').select('*').order('nome')

    if (colaboradorAtivo.cargo !== 'admin_geral') {
      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
      if (ids.length > 0) {
        qC = qC.in('empresa_id', ids)
        qE = qE.in('id', ids)
        qF = qF.in('empresa_id', ids)
      }
    }

    const [{ data: c }, { data: e }, { data: f }, { data: o }] = await Promise.all([qC, qE, qF, qO])
    setContas((c as ContaComRelacoes[]) ?? [])
    setEmpresas(e ?? [])
    setFornecedores(f ?? [])
    setObras(o ?? [])
    setLoading(false)
  }, [colaboradorAtivo])

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
    if (status === 'Pago') payload.pago_em = new Date().toISOString()
    if (status !== 'Pago') payload.pago_em = null
    
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

  async function anexarComprovantePosterior(contaId: string, empresaId: string, file: File) {
    if (!file) return
    const ext = file.name.split('.').pop()
    const fileName = `comprovante_posterior_${Date.now()}.${ext}`
    const uploadPath = empresaId ? `${empresaId}/${fileName}` : fileName
    
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('comprovantes')
      .upload(uploadPath, file, { upsert: true })
      
    if (uploadErr) return toast(`Erro ao enviar anexo: ${uploadErr.message}`, 'error')
    
    const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(uploadData.path || uploadPath)
    
    const { error } = await supabase.from('contas').update({ comprovante_url: publicUrl }).eq('id', contaId)
    if (error) return toast(`Erro ao salvar anexo no lançamento: ${error.message}`, 'error')
    
    toast('Comprovante anexado com sucesso.', 'success')
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
      possui_fornecedor: Boolean(c.fornecedor_id)
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
      historico_negociacao: novoHistorico
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

  const filtered = contas.filter(c => {
    const matchEmpresa = !filtEmpresa || c.empresa_id === filtEmpresa
    const matchFornecedor = !filtFornecedor || c.fornecedor_id === filtFornecedor
    const matchTipo    = filtTipo === 'todos' || c.tipo === filtTipo
    const matchStatus  = filtStatus === 'todos' || c.status === filtStatus
    const data = c.data_previsao || c.data_vencimento
    const matchInicio = !filtDataInicio || data >= filtDataInicio
    const matchFim = !filtDataFim || data <= filtDataFim
    const matchSearch  = !search || c.descricao.toLowerCase().includes(search.toLowerCase()) || (c.obra?.nome ?? '').toLowerCase().includes(search.toLowerCase())
    return matchEmpresa && matchFornecedor && matchTipo && matchStatus && matchSearch && matchInicio && matchFim
  }).sort((a, b) => {
    const da = new Date(a.created_at || a.data_previsao || '').getTime()
    const db = new Date(b.created_at || b.data_previsao || '').getTime()
    if (filtOrdem === 'maior_valor') return b.valor - a.valor
    if (filtOrdem === 'menor_valor') return a.valor - b.valor
    if (filtOrdem === 'az') return a.descricao.localeCompare(b.descricao, 'pt-BR')
    if (filtOrdem === 'za') return b.descricao.localeCompare(a.descricao, 'pt-BR')
    return filtOrdem === 'novo' ? db - da : da - db
  })

  const totalPago     = filtered.filter(c => c.status === 'Pago' && c.tipo === 'pagar').reduce((s, c) => s + c.valor, 0)
  const totalRecebido = filtered.filter(c => c.status === 'Pago' && c.tipo === 'receber').reduce((s, c) => s + c.valor, 0)

  // Permissões dinâmicas
  const isAdminGeral = colaboradorAtivo.cargo === 'admin_geral'
  const podePagar = permissaoAtiva?.pode_pagar || isAdminGeral
  const podeAprovar = permissaoAtiva?.pode_aprovar || isAdminGeral
  const podeAlterarStatus = permissaoAtiva?.pode_alterar_status !== false || isAdminGeral // default true
  const podeDeletar = (permissaoAtiva?.pode_excluir_lancamento === true) || isAdminGeral || colaboradorAtivo.cargo === 'admin_empresa'
  const podeEditar = (permissaoAtiva?.pode_lancar === true) || (permissaoAtiva?.pode_alterar_status === true) || (permissaoAtiva?.pode_pagar === true) || (permissaoAtiva?.pode_aprovar === true) || (permissaoAtiva?.pode_excluir_lancamento === true) || isAdminGeral || colaboradorAtivo.cargo === 'admin_empresa'

  const activeFiltrosCount = [filtEmpresa, filtFornecedor, filtTipo !== 'todos' ? filtTipo : '', filtStatus !== 'todos' ? filtStatus : '', filtDataInicio, filtDataFim, filtOrdem !== 'novo' ? filtOrdem : ''].filter(Boolean).length

  const clearFiltros = () => {
    const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    setFiltEmpresa(ids.length === 1 ? ids[0] : '')
    setFiltFornecedor('')
    setFiltTipo('todos')
    setFiltStatus('todos')
    setFiltDataInicio('')
    setFiltDataFim('')
    setFiltOrdem('novo')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.ink }}>Histórico Financeiro</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#34D399', fontWeight: 800 }}>Total Recebido: {fmt(totalRecebido)}</span>
          <span style={{ fontSize: 12, color: '#F87171', fontWeight: 800 }}>Total Pago: {fmt(totalPago)}</span>
        </div>
      </div>

      {/* ── Barra de busca + botão Filtros + Botão de Modo Exportação ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={12} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input style={{ ...input, paddingLeft: 30 }} placeholder="Buscar por descrição ou obra..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFiltros(f => !f)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${activeFiltrosCount > 0 ? C.amber : C.border}`, borderRadius: 5, background: activeFiltrosCount > 0 ? '#F59E0B14' : '#0B0C0E', color: activeFiltrosCount > 0 ? C.amber : C.inkSoft, padding: '8px 13px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
              Filtros{activeFiltrosCount > 0 ? ` (${activeFiltrosCount})` : ''}
              <span style={{ fontSize: 9, opacity: 0.7 }}>{showFiltros ? '▲' : '▼'}</span>
            </button>
            {showFiltros && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, width: 340, background: '#13151A', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,.6)', display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>Filtros avançados</span>
                  {activeFiltrosCount > 0 && <button onClick={clearFiltros} style={{ border: 0, background: 'transparent', color: C.amber, fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Limpar tudo</button>}
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Ordenação</label>
                  <select style={{ ...input }} value={filtOrdem} onChange={e => setFiltOrdem(e.target.value as 'novo' | 'antigo' | 'maior_valor' | 'menor_valor' | 'az' | 'za')}>
                    <option value="novo">↓ Mais recente primeiro</option>
                    <option value="antigo">↑ Mais antigo primeiro</option>
                    <option value="maior_valor">↓ Maior valor primeiro</option>
                    <option value="menor_valor">↑ Menor valor primeiro</option>
                    <option value="az">A → Z (descrição)</option>
                    <option value="za">Z → A (descrição)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Empresa</label>
                  <select 
                    style={{ ...input }} 
                    disabled={(() => {
                      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                      return colaboradorAtivo.cargo !== 'admin_geral' && ids.length === 1
                    })()} 
                    value={filtEmpresa} 
                    onChange={e => setFiltEmpresa(e.target.value)}
                  >
                    <option value="">Todas as empresas autorizadas</option>
                    {empresas.filter(e => {
                      if (colaboradorAtivo.cargo === 'admin_geral') return true
                      const ids = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
                      return ids.length === 0 || ids.includes(e.id)
                    }).map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Fornecedor</label>
                  <select style={{ ...input }} value={filtFornecedor} onChange={e => setFiltFornecedor(e.target.value)}>
                    <option value="">Todos os fornecedores</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia ?? f.razao_social}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Tipo</label>
                    <select style={{ ...input }} value={filtTipo} onChange={e => setFiltTipo(e.target.value as any)}>
                      <option value="todos">Todos</option>
                      <option value="pagar">A Pagar</option>
                      <option value="receber">A Receber</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Status</label>
                    <select style={{ ...input }} value={filtStatus} onChange={e => setFiltStatus(e.target.value as any)}>
                      <option value="todos">Todos</option>
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

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Vencimento (intervalo)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input title="De" aria-label="Vencimento de" style={{ ...input, flex: 1 }} type="date" value={filtDataInicio} onChange={e => setFiltDataInicio(e.target.value)} />
                    <span style={{ color: C.inkSoft, fontSize: 11 }}>até</span>
                    <input title="Até" aria-label="Vencimento até" style={{ ...input, flex: 1 }} type="date" value={filtDataFim} onChange={e => setFiltDataFim(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Ativar Modo Exportar */}
          <button
            onClick={() => {
              if (modoExportacao) {
                setModoExportacao(false)
                setSelecionadasContas([])
              } else {
                setModoExportacao(true)
              }
            }}
            style={{
              ...btn(modoExportacao ? '#EF4444' : '#34D399'),
              padding: '8px 14px',
              fontSize: 11
            }}
          >
            <FileText size={13} /> {modoExportacao ? 'Cancelar Exportação' : 'Exportar Pagamentos'}
          </button>
        </div>
      </div>

      {/* ── BARRA FLUTUANTE DE AÇÕES DE EXPORTAÇÃO (Quando modoExportacao estiver Ativo) ── */}
      {modoExportacao && (
        <div style={{
          background: '#1A1D26',
          border: `1px solid ${C.amber}`,
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} /> Modo Exportação Ativo
            </span>
            <span style={{ fontSize: 11, color: C.inkSoft }}>
              ({selecionadasContas.length} de {filtered.length} selecionados)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Botão Selecionar Todos */}
            <button
              onClick={() => selecionarTodasContas(filtered)}
              style={{ ...btnGhost, padding: '6px 12px', fontSize: 11, color: C.ink }}
            >
              {selecionadasContas.length === filtered.length ? 'Desmarcar Todos' : `Selecionar Todos (${filtered.length})`}
            </button>

            {/* Botão Baixar Selecionadas */}
            {selecionadasContas.length > 0 && (
              <button
                onClick={() => exportarContasCSV(filtered.filter(c => selecionadasContas.includes(c.id)))}
                style={{ ...btn('#34D399'), padding: '6px 14px', fontSize: 11 }}
              >
                Baixar Selecionados ({selecionadasContas.length}) 📥
              </button>
            )}

            {/* Botão Baixar Todas (Respeitando os Filtros atuais) */}
            <button
              onClick={() => exportarContasCSV(filtered)}
              style={{ ...btn(C.amber), padding: '6px 14px', fontSize: 11 }}
              title="Baixar todas as contas atualmente filtradas por busca, status ou obra"
            >
              Baixar Todas as Filtradas ({filtered.length}) 📥
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando lançamentos...</p>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0B0C0E' }}>
                {modoExportacao && (
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selecionadasContas.length === filtered.length}
                      onChange={() => selecionarTodasContas(filtered)}
                      title={selecionadasContas.length === filtered.length ? 'Desmarcar todos' : 'Marcar todos os filtrados'}
                      style={{ cursor: 'pointer', width: 15, height: 15, accentColor: C.amber }}
                    />
                  </th>
                )}
                {['Tipo','Descrição','Empresa','Fornecedor','Vencimento','Valor','Status','Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: .6, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const dataReferencia = c.tipo === 'pagar' ? (c.data_vencimento || c.data_previsao) : (c.data_previsao || c.data_vencimento)
                const dataPrevisao = dataReferencia || ''
                const venc = isVencido(dataReferencia || '', c.status)
                const pago = c.status === 'Pago'
                const pagoParcial = c.status === 'Pago Parcial'
                const aguardandoAprovacao = c.status === 'Bloqueado' || c.status === 'Aguardando aprovação'
                
                const isExpanded = expandedContaId === c.id

                const historico = c.historico_negociacao || []
                
                // Soma todos os pagamentos parciais registrados no histórico
                const totalPagoHistorico = historico
                  .reduce((acc, h) => {
                    const val = Number(h.valor_pago || (h.tipo === 'pagamento_parcial' ? h.valor_novo : 0) || 0)
                    return acc + (val > 0 ? val : 0)
                  }, 0)

                // Verifica se há desconto aplicado
                const ultimoDesconto = [...historico].reverse().find(h => h.tipo === 'desconto' && h.valor_novo)
                const valorBase = ultimoDesconto?.valor_novo !== undefined ? Number(ultimoDesconto.valor_novo) : Number(c.valor || 0)
                
                // Valor restante a pagar/receber (saldo devedor)
                const totalAbatido = Math.min(valorBase, totalPagoHistorico)
                const valorCheioAbatido = Math.max(0, valorBase - totalAbatido)

                // Última negociação / pagamento efetuado
                const ultimaNegociacao = [...historico].reverse().find(h => Number(h.valor_pago || 0) > 0 || Number(h.valor_novo || 0) > 0)
                const valorNegociadoHoje = ultimaNegociacao ? (Number(ultimaNegociacao.valor_pago || 0) || Number(ultimaNegociacao.valor_novo || 0)) : undefined

                return (
                  <Fragment key={c.id}>
                    <tr 
                      onClick={() => setExpandedContaId(isExpanded ? null : c.id)}
                      style={{ 
                        borderBottom: isExpanded ? 'none' : `1px solid ${C.border}`, 
                        background: c.status === 'Bloqueado' ? '#F9731610' : c.status === 'Aguardando aprovação' ? '#3B82F608' : (isExpanded ? '#12141C' : 'none'),
                        borderLeft: c.status === 'Bloqueado' ? '3px solid #F97316' : c.status === 'Aguardando aprovação' ? '3px solid #3B82F6' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      {modoExportacao && (
                        <td style={{ padding: '12px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selecionadasContas.includes(c.id)}
                            onChange={() => toggleContaSelecionada(c.id)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: C.amber }}
                          />
                        </td>
                      )}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: c.tipo === 'receber' ? '#34D39918' : '#F8717118', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.tipo === 'receber' ? <ArrowUpRight size={13} color="#34D399" /> : <ArrowDownRight size={13} color="#F87171" />}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: C.ink, fontWeight: 600, maxWidth: 260 }}>
                        <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span>{c.descricao}</span>
                          {c.comprovante_url && (
                            <a
                              href={c.comprovante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver comprovante"
                              onClick={e => e.stopPropagation()}
                              style={{ color: C.amber, display: 'inline-flex', alignItems: 'center', marginTop: 2, flexShrink: 0 }}
                            >
                              <Eye size={12} />
                            </a>
                          )}
                        </div>
                        {c.categoria && (
                          <div style={{ marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: C.inkSoft, background: '#ffffff0a', padding: '1px 6px', borderRadius: 3 }}>
                              {c.categoria}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: C.inkSoft }}>
                        <span style={{ borderLeft: `2px solid ${c.empresa?.cor ?? '#fff'}`, paddingLeft: 6 }}>
                          {c.empresa?.nome_fantasia ?? c.empresa?.razao_social ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: C.inkSoft }}>
                        <div style={{ fontWeight: 600, color: C.ink }}>{c.fornecedor?.nome_fantasia ?? c.fornecedor?.razao_social ?? 'Geral'}</div>
                        {c.obra && <div style={{ fontSize: 10, color: C.amber }}>Obra: {c.obra.nome}</div>}
                        {c.fornecedor?.pix && <div style={{ fontSize: 10, color: '#34D399', marginTop: 2 }}>PIX: {c.fornecedor.pix}</div>}
                        {(c.fornecedor?.banco) && <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                          Bc: {c.fornecedor.banco} {c.fornecedor.agencia ? `Ag: ${c.fornecedor.agencia}` : ''} {c.fornecedor.conta ? `Cc: ${c.fornecedor.conta}` : ''}
                        </div>}
                      </td>
                      <td style={{ padding: '12px 14px', color: venc ? '#F87171' : C.inkSoft, whiteSpace: 'nowrap' }}>{fmtDate(dataPrevisao)}{venc && <div style={{ fontSize: 8, fontWeight: 900 }}>VENCIMENTO ATRASADO</div>}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        <div style={{ color: c.tipo === 'receber' ? '#34D399' : '#F87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{fmt((pagoParcial || totalPagoHistorico > 0) ? valorCheioAbatido : valorBase)}</span>
                          {ultimoDesconto?.valor_novo !== undefined && (
                            <span style={{ fontSize: 9, color: '#34D399', background: '#34D39918', border: '1px solid #34D39933', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                              🏷️ C/ Desconto
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
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                          letterSpacing: 0.4,
                          background: c.status === 'Bloqueado' ? '#F9731622' : c.status === 'Aguardando aprovação' ? '#3B82F620' : c.status === 'Negado' ? '#F8717120' : pago ? '#34D39920' : pagoParcial ? '#A78BFA20' : venc ? '#F8717120' : C.amber + '20',
                          color: c.status === 'Bloqueado' ? '#FB923C' : c.status === 'Aguardando aprovação' ? '#60A5FA' : c.status === 'Negado' ? '#F87171' : pago ? '#34D399' : pagoParcial ? '#A78BFA' : venc ? '#F87171' : C.amber,
                          border: c.status === 'Bloqueado' ? '1px solid #F9731666' : c.status === 'Aguardando aprovação' ? '1px solid #3B82F644' : 'none',
                          boxShadow: c.status === 'Bloqueado' ? '0 0 8px #F9731633' : 'none'
                        }}>
                          {c.status === 'Bloqueado' ? '🔒 BLOQUEADO' : c.status === 'Aguardando aprovação' ? '⏳ AGUARDANDO APROVAÇÃO' : c.status.toUpperCase()}
                        </span>
                        {c.criado_por && (
                          <div style={{ fontSize: 9, color: C.inkSoft, marginTop: 4 }}>
                            👤 Lançado por: {c.criado_por}
                          </div>
                        )}
                        {c.created_at && (
                          <div style={{ fontSize: 9, color: C.inkSoft, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                            🕒 {new Date(c.created_at).toLocaleDateString('pt-BR')} às {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {c.aprovado_por && (
                          <div style={{ fontSize: 9, color: '#34D399', marginTop: 2 }}>
                            ✓ Aprovado por: {c.aprovado_por}
                          </div>
                        )}
                        {c.status === 'Negado' && c.justificativa_negacao && (
                          <div style={{ fontSize: 9, color: '#F87171', marginTop: 4, maxWidth: 160, whiteSpace: 'normal' }}>
                            <b style={{ fontWeight: 800 }}>Motivo:</b> {c.justificativa_negacao}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {podeAlterarStatus && <select aria-label="Alterar status" value={c.status} onChange={e => void alterarStatus(c.id, e.target.value as ContaComRelacoes['status'])} style={{ ...input, width: 150, padding: '4px 6px', fontSize: 10 }}>
                            <option value="Lançado">Lançado</option>
                            <option value="Bloqueado">Bloqueado</option>
                            <option value="Aguardando aprovação">Aguardando aprovação</option>
                            <option value="Liberado/OK">Liberado/OK</option>
                            <option value="A pagar">A pagar</option>
                            <option value="Pago Parcial">Pago Parcial</option>
                            <option value="Pago">Pago</option>
                            <option value="Negado">Negado</option>
                          </select>}


                          {podeEditar && (
                             <button onClick={() => iniciarEdicao(c)} title="Editar Lançamento" style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                               <Edit3 size={13} />
                             </button>
                          )}
                          <label title="Anexar Comprovante Posterior" style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', padding: 4 }}>
                            <Paperclip size={13} />
                            <input hidden type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if(f) void anexarComprovantePosterior(c.id, c.empresa_id, f); e.currentTarget.value = '' }} />
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
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#12141C' }}>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                
                                {/* Standard Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

                                  <div>
                                    <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800 }}>Data e Horário do Lançamento</div>
                                    <div style={{ fontSize: 13, color: C.ink, marginTop: 4 }}>
                                      🕒 {c.created_at ? new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                                      {c.criado_por ? <span style={{ color: C.inkSoft, fontSize: 11 }}> por {c.criado_por}</span> : ''}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800 }}>Observações do Lançamento</div>
                                    <div style={{ fontSize: 13, color: C.ink, marginTop: 4 }}>{c.observacoes || 'Nenhuma observação'}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, marginBottom: 6 }}>Documento / Comprovante Anexo</div>
                                    {c.comprovante_url ? (
                                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <a href={c.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, fontSize: 11, color: C.amber, border: `1px solid ${C.amber}40`, textDecoration: 'none', padding: '6px 12px' }}>
                                          <Paperclip size={13} /> Visualizar Documento ↗
                                        </a>
                                        <label style={{ ...btnGhost, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: C.inkSoft, padding: '6px 12px' }}>
                                          Substituir Anexo
                                          <input hidden type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if(f) void anexarComprovantePosterior(c.id, c.empresa_id, f); e.currentTarget.value = '' }} />
                                        </label>
                                      </div>
                                    ) : (
                                      <label style={{ ...btnGhost, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: C.amber, border: `1px solid ${C.amber}40`, padding: '6px 12px' }}>
                                        <Paperclip size={13} /> Anexar Comprovante / Documento
                                        <input hidden type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if(f) void anexarComprovantePosterior(c.id, c.empresa_id, f); e.currentTarget.value = '' }} />
                                      </label>
                                    )}
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 6, border: `1px solid rgba(255,255,255,0.05)` }}>
                                    <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>Resumo Financeiro</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>
                                      <span>Valor Cheio (Original):</span>
                                      <span style={{ fontWeight: 700, color: C.ink }}>{fmt(c.valor)}</span>
                                    </div>
                                    {ultimoDesconto?.valor_novo !== undefined && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#34D399', marginBottom: 4 }}>
                                        <span>Valor c/ Desconto:</span>
                                        <span>{fmt(Number(ultimoDesconto.valor_novo))}</span>
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#34D399', marginBottom: 4 }}>
                                      <span>Total Pago (Amortizado):</span>
                                      <span style={{ fontWeight: 700 }}>{fmt(totalAbatido)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.amber, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                      <span>{c.tipo === 'receber' ? 'A Receber:' : 'A Pagar:'}</span>
                                      <span>{fmt(valorCheioAbatido)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Negotiation Panel - Available for all management roles */}
                                {(isAdminGeral || podePagar || podeAprovar || podeLancar || colaboradorAtivo.cargo === 'admin_empresa') && (
                                  <div style={{ background: '#0B0C0E', border: `1px solid ${C.amber}40`, borderRadius: 8, padding: 16 }}>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 14, color: C.amber, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Shield size={16} /> Gestão de Pagamentos Parciais & Acordos
                                    </h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                                      
                                      {/* Left: Nova Negociação */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Registrar Nova Negociação</div>
                                        
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
                                              <div style={{ fontSize: 11, color: '#34D399', fontWeight: 600 }}>
                                                Saldo Devedor Calculado: {fmt(c.valor - Number(formNegociacao.valor_pago))}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {formNegociacao.tipo === 'prorrogacao' && (
                                          <input style={input} type="date" placeholder="Nova Data" value={formNegociacao.nova_data} onChange={e => setFormNegociacao(f => ({ ...f, nova_data: e.target.value }))} />
                                        )}

                                        <textarea 
                                          style={{ ...input, resize: 'vertical', minHeight: 60 }} 
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
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Histórico da Conta</div>
                                        {(!c.historico_negociacao || c.historico_negociacao.length === 0) ? (
                                          <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                                            Nenhum acordo ou negociação registrado.
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 8 }}>
                                            {[...c.historico_negociacao].reverse().map(hist => {
                                              const isStatus = hist.tipo === 'alteracao_status'
                                              const borderColor = isStatus ? '#3B82F6' : hist.tipo === 'desconto' ? '#10B981' : hist.tipo === 'pagamento_parcial' ? '#34D399' : C.amber
                                              const tipoTitulo = isStatus ? 'Alteração / Status' : hist.tipo === 'desconto' ? 'Desconto' : hist.tipo === 'pagamento_parcial' ? 'Pgto Parcial' : hist.tipo === 'prorrogacao' ? 'Prorrogação' : 'Observação'
                                              return (
                                                <div key={hist.id} style={{ background: isStatus ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6, borderLeft: `3px solid ${borderColor}` }}>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <strong style={{ fontSize: 11, color: borderColor }}>
                                                      {tipoTitulo}
                                                    </strong>
                                                    <span style={{ fontSize: 10, color: C.inkSoft }}>
                                                      {new Date(hist.data).toLocaleDateString('pt-BR')} {new Date(hist.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                  </div>
                                                  <div style={{ fontSize: 11, color: C.amber, fontWeight: 600, marginBottom: 4 }}>👤 Por: {hist.autor || 'Usuário'}</div>
                                                  <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{hist.descricao}</div>
                                                  
                                                  {hist.tipo === 'desconto' && hist.valor_novo && (
                                                    <div style={{ marginTop: 4, fontSize: 11, color: '#34D399', fontWeight: 600 }}>Novo Valor: {fmt(hist.valor_novo)}</div>
                                                  )}
                                                  {hist.tipo === 'pagamento_parcial' && hist.valor_pago && (
                                                    <div style={{ marginTop: 4, fontSize: 11, color: '#34D399', fontWeight: 600 }}>Pago: {fmt(hist.valor_pago)}</div>
                                                  )}
                                                  {hist.tipo === 'prorrogacao' && hist.nova_data && (
                                                    <div style={{ marginTop: 4, fontSize: 11, color: C.amber, fontWeight: 600 }}>Nova Data: {fmtDate(hist.nova_data)}</div>
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
                    <option value="">Geral / Administrativo</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Fornecedor */}
              <div>
                <label style={label}>Fornecedor</label>
                <select style={input} value={formEdicao.fornecedor_id || ''} onChange={e => setFormEdicao(f => ({ ...f, fornecedor_id: e.target.value }))}>
                  <option value="">Sem Fornecedor / Outros</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia ?? f.razao_social}</option>)}
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

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setEditandoConta(null)} style={{ ...btnGhost, color: C.inkSoft }}>Cancelar</button>
              <button onClick={() => void salvarEdicaoConta()} style={btn(C.amber)}>Salvar Alterações</button>
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
    <div style={{ background: '#0B0C0E', border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, marginTop: 6, width: '100%' }}>
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

function PermissoesTab({ colaboradorAtivo, colaboradores, onRefresh, confirm }: PermissoesTabProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [configPermissoes, setConfigPermissoes] = useState<ConfigPermissao[]>([])
  const [cargos, setCargos] = useState<CargoSistema[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPerms, setSavingPerms] = useState<string | null>(null)
  const [globalLimite, setGlobalLimite] = useState<number>(0)
  const [savingGlobalLimite, setSavingGlobalLimite] = useState(false)
  const [editingCargoNome, setEditingCargoNome] = useState<string | null>(null) // codigo do cargo em edicao
  const [editingCargoNomeValue, setEditingCargoNomeValue] = useState('')
  const [savingCargoNome, setSavingCargoNome] = useState(false)
  
  // States do Novo Colaborador
  const [showColForm, setShowColForm] = useState(false)
  const [savingCol, setSavingCol] = useState(false)
  const [showCargoForm, setShowCargoForm] = useState(false)
  const [savingCargo, setSavingCargo] = useState(false)
  const [cargoForm, setCargoForm] = useState({ codigo: '', nome: '', descricao: '', apps: 'rh' })
  const [colForm, setColForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'operador',
    empresa_id: ''
  })

  // State para Edição de Colaborador Individual (Modal de Override)
  const [editColForm, setEditColForm] = useState<Colaborador | null>(null)
  const [savingEditCol, setSavingEditCol] = useState(false)

  // State para overrides de cargo e empresas nas solicitações pendentes
  const [solOverrides, setSolOverrides] = useState<Record<string, { cargo: string; empresas_ids: string[] }>>({})

  // Se o usuário ativo for admin por empresa, já pré-define o formulário para a empresa dele
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
      const [{ data: e }, { data: p }, { data: c }] = await Promise.all([
        supabase.from('empresas').select('*').order('razao_social'),
        supabase.from('config_permissoes').select('*').order('cargo'),
        supabase.from('cargos_sistema').select('*').eq('ativo', true).order('nome')
      ])
      
      setEmpresas(e ?? [])
      setConfigPermissoes((p as ConfigPermissao[]) ?? [])
      setCargos((c as CargoSistema[]) ?? [])
      if (p && (p as ConfigPermissao[]).length > 0) {
        setGlobalLimite((p as ConfigPermissao[])[0].limite_valor || 0)
      }

      // Carrega solicitações pendentes
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

  // Salvar limite global
  const salvarLimiteGlobal = async () => {
    setSavingGlobalLimite(true)
    const { error: permError } = await supabase.from('config_permissoes').update({ limite_valor: globalLimite }).not('cargo', 'is', null)
    const { error: colError } = await supabase.from('colaboradores').update({ limite_valor: globalLimite }).not('id', 'is', null)
    
    if (permError || colError) {
      toast('Erro ao atualizar limite global.', 'error')
    } else {
      toast('Limite global de autoliberação atualizado com sucesso.', 'success')
      await loadData()
      onRefresh()
    }
    setSavingGlobalLimite(false)
  }

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
      pode_lancar: false,
      pode_pagar: false,
      pode_aprovar: false,
      limite_valor: 0,
      apps: cargoForm.apps.trim() || 'financeiro',
    })
    if (permError) {
      await supabase.from('cargos_sistema').delete().eq('codigo', codigo)
      setSavingCargo(false)
      return toast('Cargo criado parcialmente; permissões falharam: ' + permError.message, 'error')
    }
    setCargoForm({ codigo: '', nome: '', descricao: '', apps: 'rh' })
    setShowCargoForm(false)
    setSavingCargo(false)
    await loadData()
    toast(`Cargo "${nome}" criado. Agora configure as permissões na matriz abaixo.`, 'success')
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  // Salvar alterações de permissões de um cargo
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
    onRefresh() // Atualiza sessao
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

  // Excluir cargo do sistema
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

  // Cadastrar novo colaborador
  const criarColaborador = async () => {
    if (!colForm.nome.trim()) return
    if (!colForm.email.trim()) { toast('Informe um e-mail para o colaborador.', 'error'); return }
    if (colForm.senha.trim().length < 8) { toast('Defina uma senha de acesso com no mínimo 8 caracteres.', 'error'); return }
    setSavingCol(true)
    
    const empresaIdDestino = colaboradorAtivo.cargo === 'admin_empresa'
      ? colaboradorAtivo.empresa_id 
      : colForm.cargo === 'admin_geral' ? null : (colForm.empresa_id || null)

    const { data: result, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'create_user', admin_id: colaboradorAtivo.id, nome: colForm.nome.trim(), email: colForm.email.trim().toLowerCase(), senha: colForm.senha, cargo: colForm.cargo, empresa_id: empresaIdDestino }
    })

    if (error || result?.error) {
      let detail = result?.error || error?.message || 'não foi possível concluir'
      const response = (error as { context?: Response } | null)?.context
      if (response) {
        try {
          const body = await response.clone().json() as { error?: string }
          detail = body.error || detail
        } catch { /* mantém a mensagem padrão */ }
      }
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
      onRefresh()
    }
    setSavingCol(false)
  }

  // Salvar permissões customizadas de uma pessoa específica
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
          limite_valor: Number(editColForm.limite_valor),
          apps: editColForm.apps,
          abas_financeiro: editColForm.abas_financeiro || null,
          pode_alterar_status: editColForm.pode_alterar_status ?? true,
          pode_excluir_lancamento: editColForm.pode_excluir_lancamento ?? false,
        })
        .eq('id', editColForm.id)

      if (error) throw error
      toast('Configurações salvas para ' + editColForm.nome, 'success')
      setEditColForm(null)
      onRefresh()
      await loadData()
    } catch (err: any) {
      toast('Erro ao salvar permissões da pessoa: ' + err.message, 'error')
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

  const alterarEmpresasColaborador = async (id: string, novasEmpresasIds: string[]) => {
    try {
      const { error } = await supabase
        .from('colaboradores')
        .update({
          empresa_id: novasEmpresasIds[0] || null,
          empresas_ids: novasEmpresasIds
        })
        .eq('id', id)
      if (error) throw error
      toast('Empresas vinculadas com sucesso!', 'success')
      await loadData()
      onRefresh()
    } catch (err: any) {
      toast('Erro ao vincular empresas: ' + (err?.message || err), 'error')
    }
  }

  // Aprovar solicitação de acesso
  const aprovarSolicitacao = async (sol: SolicitacaoAcesso) => {
    // Aplica o cargo e empresas selecionados pelo admin no painel (ou usa os padrões da solicitação)
    const override = solOverrides[sol.id]
    const cargoDefinido = override?.cargo || sol.cargo_solicitado
    const empresasIdsDefinidas = override?.empresas_ids !== undefined
      ? override.empresas_ids
      : (sol.empresas_ids || (sol.empresa_id ? [sol.empresa_id] : []))

    setLoading(true)
    try {
      // Usamos 'create_user' porque a edge function implantada pode não ter 'approve_user'
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
        const response = (functionError as { context?: Response } | null)?.context
        if (response) {
          try {
            const body = await response.clone().json() as { error?: string }
            detail = body.error || detail
          } catch { /* mantem mensagem padrao */ }
        }
        toast('Erro ao aprovar colaborador: ' + detail, 'error')
        setLoading(false)
        return
      }

      // Atualiza a solicitação diretamente via client usando as políticas RLS do RH
      await supabase.from('solicitacoes_acesso').update({
        status: 'aprovado',
        aprovado_por: colaboradorAtivo.id,
        aprovado_em: new Date().toISOString()
      }).eq('id', sol.id)

      toast(`Acesso aprovado e conta criada para ${sol.nome}!`, 'success')
      onRefresh()
      await loadData()
    } catch (err: any) {
      toast('Erro inesperado na aprovação: ' + (err?.message || err), 'error')
    } finally {
      setLoading(false)
    }
  }

  // Rejeitar solicitação de acesso
  const rejeitarSolicitacao = async (id: string) => {
    setLoading(true)
    try {
      // Atualiza a solicitação diretamente via client usando as políticas RLS do RH
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
      toast('Erro inesperado na rejeição: ' + (err?.message || err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const excluirColaborador = async (id: string) => {
    if (id === colaboradorAtivo.id) {
      toast('Você não pode excluir o usuário conectado.', 'error')
      return
    }
    setSavingCol(true)
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete_user', admin_id: colaboradorAtivo.id, collaborator_id: id }
      })
      if (error || result?.error) {
        let detail = result?.error || error?.message || 'nao foi possivel excluir'
        const response = (error as { context?: Response } | null)?.context
        if (response) {
          try {
            const body = await response.clone().json() as { error?: string }
            detail = body.error || detail
          } catch { /* mantem */ }
        }
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

  // Alternar checkbox de uma permissão localmente antes de salvar
  const handleToggle = (cargo: string, campo: keyof ConfigPermissao) => {
    setConfigPermissoes(prev => prev.map(c => {
      if (c.cargo === cargo) {
        return { ...c, [campo]: !c[campo] } as ConfigPermissao
      }
      return c
    }))
  }

  // Toggle de aplicativos do Cargo
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

  // Toggle de aplicativos do Colaborador (Edição individual)
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

  // Toggle de aba do financeiro para um cargo
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

  // Toggle de aba do financeiro para colaborador individual
  const handleToggleAbaFinanceiroColaborador = (abaId: string) => {
    if (!editColForm) return
    const abasList = editColForm.abas_financeiro ? editColForm.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
    const newAbasList = abasList.includes(abaId)
      ? abasList.filter((x: string) => x !== abaId)
      : [...abasList, abaId]
    setEditColForm({ ...editColForm, abas_financeiro: newAbasList.join(',') })
  }

  // handleLimiteChange removido pois o limite agora é global

  // Filtra colaboradores mostrados
  // Se for admin por empresa, só vê os da mesma empresa
  const colaboradoresFiltrados = colaboradores.filter(c => {
    if (colaboradorAtivo.cargo === 'admin_geral') return true
    const idsAtivo = colaboradorAtivo.empresas_ids || (colaboradorAtivo.empresa_id ? [colaboradorAtivo.empresa_id] : [])
    if (idsAtivo.length === 0) return true
    const idsColab = c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])
    return idsColab.some(id => idsAtivo.includes(id)) || (c.empresa_id ? idsAtivo.includes(c.empresa_id) : false)
  })

  const isGeral = colaboradorAtivo.cargo === 'admin_geral'

  return (
    <div>
      {isGeral && (
        <div style={{ ...card, marginBottom: 20, borderColor: C.amber + '55' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink }}>Cargos e permissões</h3>
              <p style={{ margin: '5px 0 0', fontSize: 11, color: C.inkSoft }}>Crie um perfil uma vez, defina os módulos e depois atribua-o aos colaboradores.</p>
            </div>
            <button style={{ ...btn(), padding: '7px 12px', fontSize: 10 }} onClick={() => setShowCargoForm(value => !value)}><Sliders size={13} /> {showCargoForm ? 'Fechar' : 'Criar novo cargo'}</button>
          </div>
          {showCargoForm && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1.5fr auto', gap: 9, alignItems: 'end', marginTop: 14 }}>
              <div><label style={label}>Código</label><input style={input} value={cargoForm.codigo} onChange={event => setCargoForm({ ...cargoForm, codigo: event.target.value })} placeholder="ex: mestre_obra" /></div>
              <div><label style={label}>Nome do cargo</label><input style={input} value={cargoForm.nome} onChange={event => setCargoForm({ ...cargoForm, nome: event.target.value })} placeholder="Mestre de obra" /></div>
              <div><label style={label}>Descrição</label><input style={input} value={cargoForm.descricao} onChange={event => setCargoForm({ ...cargoForm, descricao: event.target.value })} placeholder="O que este cargo faz" /></div>
              <div><label style={label}>Módulos (separados por vírgula)</label><input style={input} value={cargoForm.apps} onChange={event => setCargoForm({ ...cargoForm, apps: event.target.value })} placeholder="rh,obras,rdo" /></div>
              <button style={{ ...btn('#10B981'), padding: '9px 12px', fontSize: 10 }} disabled={savingCargo} onClick={() => void criarCargo()}>{savingCargo ? 'Salvando...' : 'Criar cargo'}</button>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isGeral ? '1.2fr 1.8fr' : '1fr', gap: 24, alignItems: 'start' }}>
        
        {/* COLUNA ESQUERDA: LISTA DE COLABORADORES E SOLICITAÇÕES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* SEÇÃO: SOLICITAÇÕES PENDENTES */}
          {solicitacoes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.amber, animation: 'pulse 1.5s infinite' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink }}>Solicitações de Acesso Pendentes</h3>
                <style>{`@keyframes pulse { 0% { opacity: 0.3 } 50% { opacity: 1 } 100% { opacity: 0.3 } }`}</style>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {solicitacoes.map(sol => {
                  const currentOverride = solOverrides[sol.id]
                  const cargoSelecionado = currentOverride?.cargo || sol.cargo_solicitado
                  const empresaIdSelecionada = currentOverride?.empresas_ids?.[0] !== undefined ? currentOverride.empresas_ids[0] : (sol.empresa_id || '')
                  const empresaNome = empresas.find(e => e.id === empresaIdSelecionada)?.nome_fantasia || 'Sem empresa vinculada'

                  return (
                    <div key={sol.id} style={{ ...card, borderColor: C.amber, padding: 16, background: '#171410' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 240 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{sol.nome}</div>
                          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                            Solicitou acesso em: <strong>{new Date(sol.created_at).toLocaleDateString('pt-BR')}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', marginTop: 4 }}>
                            E-mail: {sol.email}
                          </div>
                          {sol.mensagem && (
                            <div style={{ fontSize: 11, background: '#0B0C0E77', borderLeft: `2px solid ${C.amber}`, padding: '6px 10px', marginTop: 8, color: C.ink, borderRadius: '0 4px 4px 0' }}>
                              &ldquo;{sol.mensagem}&rdquo;
                            </div>
                          )}

                          {/* Seletor de Cargo e Multi-Empresas para o Adm aprovar */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800 }}>CARGO DEFINIDO:</span>
                              <select
                                value={cargoSelecionado}
                                onChange={e => setSolOverrides(prev => ({
                                  ...prev,
                                  [sol.id]: { cargo: e.target.value, empresas_ids: e.target.value === 'admin_geral' ? [] : (prev[sol.id]?.empresas_ids || (sol.empresas_ids || (sol.empresa_id ? [sol.empresa_id] : []))) }
                                }))}
                                style={{ ...input, width: 200, padding: '4px 8px', fontSize: 11, height: 28, borderColor: C.amber + '88' }}
                              >
                                {cargos.map(cargo => (
                                  <option key={cargo.codigo} value={cargo.codigo}>{cargo.nome}</option>
                                ))}
                              </select>
                            </div>

                            {/* Seletor Multi-Empresas (para cargos nao-gerais) */}
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

                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 4 }}>
                          <button
                            onClick={() => aprovarSolicitacao(sol)}
                            style={{ ...btn('#10B981'), padding: '7px 14px', fontSize: 11 }}
                          >
                            <Check size={13} /> Aprovar Acesso
                          </button>
                          <button
                            onClick={() => rejeitarSolicitacao(sol.id)}
                            style={{ ...btnGhost, borderColor: '#EF444455', color: '#EF4444', padding: '7px 12px', fontSize: 11 }}
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

          {/* SEÇÃO: COLABORADORES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink }}>
                {isGeral ? 'Colaboradores Cadastrados (Grupo)' : 'Colaboradores Cadastrados (Esta Filial)'}
              </h3>
              <button style={{ ...btn(), padding: '6px 12px', fontSize: 11 }} onClick={() => setShowColForm(v => !v)}>
                <UserPlus size={13} /> Convidar
              </button>
            </div>

            {showColForm && (
              <div style={{ ...card, borderColor: C.amber + '33' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={label}>Nome Completo *</label>
                    <input style={input} value={colForm.nome} onChange={e => setColForm(c => ({ ...c, nome: e.target.value }))} placeholder="Ex: João da Silva" />
                  </div>
                  <div>
                    <label style={label}>E-mail de Acesso *</label>
                    <input style={input} type="email" value={colForm.email} onChange={e => setColForm(c => ({ ...c, email: e.target.value }))} placeholder="Ex: joao@grupo.com" />
                  </div>
                  <div>
                    <label style={label}>Senha de Acesso *</label>
                    <input style={input} type="password" minLength={8} value={colForm.senha} onChange={e => setColForm(c => ({ ...c, senha: e.target.value }))} placeholder="Mínimo 8 caracteres" />
                  </div>
                  
                  {isGeral ? (
                    <>
                      <div>
                        <label style={label}>Cargo / Nível de Acesso</label>
                        <select style={input} value={colForm.cargo} onChange={e => setColForm(c => ({ ...c, cargo: e.target.value }))}>
                          {configPermissoes.map(config => <option key={config.cargo} value={config.cargo}>{NOMES_CARGOS[config.cargo] || cargos.find(cargo => cargo.codigo === config.cargo)?.nome || config.cargo}</option>)}
                        </select>
                      </div>

                      {colForm.cargo === 'admin_empresa' && (
                        <div>
                          <label style={label}>Empresa Atribuída</label>
                          <select style={input} value={colForm.empresa_id} onChange={e => setColForm(c => ({ ...c, empresa_id: e.target.value }))}>
                            <option value="">Selecione...</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
                          </select>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <label style={label}>Cargo / Nível de Acesso</label>
                      <select style={input} value={colForm.cargo} onChange={e => setColForm(c => ({ ...c, cargo: e.target.value }))}>
                        {configPermissoes.filter(config => config.cargo !== 'admin_geral').map(config => <option key={config.cargo} value={config.cargo}>{NOMES_CARGOS[config.cargo] || cargos.find(cargo => cargo.codigo === config.cargo)?.nome || config.cargo}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button style={btn()} onClick={criarColaborador} disabled={savingCol}>{savingCol ? 'Salvando...' : 'Criar Colaborador'}</button>
                    <button style={btnGhost} onClick={() => setShowColForm(false)}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de colaboradores */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {colaboradoresFiltrados.map(c => {
                const isAtivo = c.id === colaboradorAtivo.id
                const linkedEmpresaIds = c.empresas_ids || (c.empresa_id ? [c.empresa_id] : [])
                const empresaNome = linkedEmpresaIds.length > 0
                  ? linkedEmpresaIds.map(id => empresas.find(e => e.id === id)?.nome_fantasia || empresas.find(e => e.id === id)?.razao_social).filter(Boolean).join(', ')
                  : 'Administração Geral'
                return (
                  <div key={c.id} style={{ ...card, borderColor: isAtivo ? C.amber : C.border, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.nome}
                          {isAtivo && (
                            <span style={{ fontSize: 9, background: C.amber + '22', color: C.amber, padding: '1px 5px', borderRadius: 4 }}>
                              VOCÊ (LOGADO)
                            </span>
                          )}
                          {c.override_permissoes && (
                            <span style={{ fontSize: 9, background: '#10B98122', color: '#10B981', padding: '1px 5px', borderRadius: 4 }}>
                              ACESSO INDIVIDUALIZADO
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                          {cargos.find(cargo => cargo.codigo === c.cargo)?.nome || NOMES_CARGOS[c.cargo] || c.cargo} · Empresas: {empresaNome}
                        </div>
                        {c.email && <div style={{ fontSize: 10, color: C.inkSoft }}>{c.email}</div>}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        {isGeral && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select
                              value={c.cargo}
                              disabled={isAtivo}
                              onChange={e => void alterarCargoColaborador(c.id, e.target.value)}
                              style={{ ...input, width: 145, padding: '3px 6px', fontSize: 10, height: 26 }}
                              title="Alterar cargo do colaborador"
                            >
                              {cargos.map(cargo => (
                                <option key={cargo.codigo} value={cargo.codigo}>{cargo.nome}</option>
                              ))}
                            </select>
                            {/* Botão editar permissões individuais */}
                            <button
                              onClick={() => setEditColForm(c)}
                              title="Editar Acessos desta Pessoa"
                              style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', padding: 4 }}
                            >
                              <Edit3 size={14} />
                            </button>
                            {!isAtivo && (
                              <button onClick={() => excluirColaborador(c.id)} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: MATRIZ DE PERMISSÕES DOS CARGOS (APENAS PARA ADMIN GERAL) */}
        {isGeral && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>


            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink }}>Regras & Permissões dos Cargos</h3>

            {loading ? (
              <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando permissões...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {configPermissoes.map(cfg => {
                  const saving = savingPerms === cfg.cargo
                  const labelCargo = NOMES_CARGOS[cfg.cargo] || cfg.cargo
                  const appsList = cfg.apps ? cfg.apps.split(',').map((x: string) => x.trim()).filter(Boolean) : []

                  return (
                    <div key={cfg.cargo} style={{ ...card, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {editingCargoNome === cfg.cargo ? (
                            <>
                              <input
                                value={editingCargoNomeValue}
                                onChange={e => setEditingCargoNomeValue(e.target.value)}
                                style={{ ...input, width: 160, padding: '2px 8px', fontSize: 13, fontWeight: 800, color: C.amber }}
                                onKeyDown={e => { if (e.key === 'Enter') salvarNomeCargo(cfg.cargo); if (e.key === 'Escape') setEditingCargoNome(null) }}
                                autoFocus
                              />
                              <button onClick={() => salvarNomeCargo(cfg.cargo)} disabled={savingCargoNome} style={{ ...btn(), padding: '2px 8px', fontSize: 10 }}>
                                {savingCargoNome ? '...' : 'OK'}
                              </button>
                              <button onClick={() => setEditingCargoNome(null)} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 2 }}>
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 900, fontSize: 14, color: C.amber }}>{cargos.find(c => c.codigo === cfg.cargo)?.nome || labelCargo}</span>
                              {cfg.cargo !== 'admin_geral' && (
                                <button
                                  title="Editar nome do cargo"
                                  onClick={() => { setEditingCargoNome(cfg.cargo); setEditingCargoNomeValue(cargos.find(c => c.codigo === cfg.cargo)?.nome || labelCargo) }}
                                  style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 2 }}
                                >
                                  <Edit3 size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {cfg.cargo !== 'admin_geral' && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button 
                              style={{ ...btn(), padding: '4px 10px', fontSize: 10 }}
                              onClick={() => salvarConfigCargo(cfg.cargo, cfg)}
                              disabled={saving}
                            >
                              {saving ? 'Gravando...' : 'Salvar Regras'}
                            </button>
                            {cfg.cargo !== 'admin_empresa' && (
                              <button
                                style={{ ...btnGhost, borderColor: '#EF444455', color: '#EF4444', padding: '4px 8px', fontSize: 10 }}
                                onClick={() => excluirCargo(cfg.cargo)}
                                title="Excluir este cargo"
                              >
                                <Trash2 size={12} /> Excluir
                              </button>
                            )}
                          </div>
                        )}
                        {cfg.cargo === 'admin_geral' && (
                          <span style={{ fontSize: 9, color: C.inkSoft, fontStyle: 'italic' }}>Administrador Geral (Acesso Irrestrito)</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 4 }}>Ações no Financeiro</span>
                            {([
                              ['pode_empresas', 'Gerenciar Empresas'],
                              ['pode_fornecedores', 'Gerenciar Fornecedores'],
                              ['pode_lancar', 'Registrar Lançamentos / Contas'],
                              ['pode_pagar', 'Marcar Contas como Pagas'],
                              ['pode_aprovar', 'Aprovar Contas acima do limite'],
                            ] as const).map(([campo, desc]) => {
                              const desabilitar = cfg.cargo === 'admin_geral'
                              const valorCheck = cfg[campo]
                              return (
                                <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: desabilitar ? 'default' : 'pointer', fontSize: 12, color: desabilitar ? C.inkSoft : C.ink }}>
                                  <button type="button" disabled={desabilitar} onClick={() => handleToggle(cfg.cargo, campo)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: desabilitar ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}>
                                    {valorCheck ? <ToggleRight size={22} color={desabilitar ? C.inkSoft : C.amber} /> : <ToggleLeft size={22} color={C.border} />}
                                  </button>
                                  {desc}
                                </label>
                              )
                            })}
                          </div>


                        </div>

                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Módulos Visíveis na Sidebar</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {ALL_APPS.map(app => {
                              const desabilitar = cfg.cargo === 'admin_geral'
                              const valorCheck = desabilitar || appsList.includes(app.id)
                              return (
                                <label key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: desabilitar ? 'default' : 'pointer', fontSize: 11.5, color: desabilitar ? C.inkSoft : C.ink }}>
                                  <button type="button" disabled={desabilitar} onClick={() => handleToggleAppCargo(cfg.cargo, app.id)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: desabilitar ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}>
                                    {valorCheck ? <ToggleRight size={20} color={desabilitar ? C.inkSoft : C.amber} /> : <ToggleLeft size={20} color={C.border} />}
                                  </button>
                                  {app.nome}
                                </label>
                              )
                            })}
                          </div>
                        </div>

                        {/* ABAS VISÍVEIS NO FINANCEIRO */}
                        {cfg.cargo !== 'admin_geral' && (
                          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>Abas Visíveis no Financeiro</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const ALL_ABAS_IDS = ['dashboard','historico','contas','empresas','fornecedores','obras']
                                  const abasList = cfg.abas_financeiro ? cfg.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                                  const todasMarcadas = ALL_ABAS_IDS.every(a => abasList.includes(a))
                                  setConfigPermissoes(prev => prev.map(c => c.cargo === cfg.cargo
                                    ? { ...c, abas_financeiro: todasMarcadas ? '' : ALL_ABAS_IDS.join(',') }
                                    : c
                                  ))
                                }}
                                style={{ background: 'transparent', border: 0, color: C.amber, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                              >
                                {(() => {
                                  const ALL_ABAS_IDS = ['dashboard','historico','contas','empresas','fornecedores','obras']
                                  const abasList = cfg.abas_financeiro ? cfg.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                                  return ALL_ABAS_IDS.every(a => abasList.includes(a)) ? 'Desmarcar todas' : '✓ Selecionar todas'
                                })()}
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {([
                                ['historico',    '📋 Histórico & Fluxo'],
                                ['contas',       '➕ Lançar Conta'],
                                ['empresas',     '🏢 Empresas'],
                                ['fornecedores', '👥 Fornecedores'],
                                ['obras',        '🏗️ Obras & Métricas'],
                              ] as const).map(([abaId, abaLabel]) => {
                                const abasList = cfg.abas_financeiro ? cfg.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                                const checked = abasList.includes(abaId)
                                return (
                                  <label key={abaId} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: C.ink, cursor: 'pointer', background: checked ? '#F59E0B0A' : 'transparent', padding: '4px 6px', borderRadius: 4 }}>
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

                        {/* AÇÕES NO HISTÓRICO & FLUXO */}
                        {cfg.cargo !== 'admin_geral' && (
                          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Ações no Histórico & Fluxo</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {([
                                ['pode_alterar_status',      'Alterar status dos lançamentos'],
                                ['pode_aprovar',             'Aprovar lançamentos pendentes'],
                                ['pode_pagar',               'Marcar como pago'],
                                ['pode_excluir_lancamento',  'Excluir lançamentos'],
                              ] as const).map(([campo, desc]) => {
                                const valorCheck = cfg[campo as keyof ConfigPermissao] as boolean
                                return (
                                  <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink }}>
                                    <button type="button" onClick={() => handleToggle(cfg.cargo, campo as keyof ConfigPermissao)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                      {valorCheck ? <ToggleRight size={22} color={C.amber} /> : <ToggleLeft size={22} color={C.border} />}
                                    </button>
                                    {desc}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: PERMISSÕES INDIVIDUAIS (POR PESSOA) */}
      <AnimatePresence>
        {editColForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, width: '100%', maxWidth: 500, maxHeight: '88vh', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>Permissões Individuais</span>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '2px 0 0' }}>{editColForm.nome}</h3>
                </div>
                <button onClick={() => setEditColForm(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveColaboradorPerms} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={label}>Cargo / Nível de Acesso</label>
                  <select
                    style={input}
                    value={editColForm.cargo}
                    onChange={e => setEditColForm({ ...editColForm, cargo: e.target.value })}
                  >
                    {cargos.map(cargo => (
                      <option key={cargo.codigo} value={cargo.codigo}>{cargo.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Empresas vinculadas (para cargos nao-gerais) */}
                {editColForm.cargo !== 'admin_geral' && (
                  <div>
                    <label style={label}>Empresas Vinculadas *</label>
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

                <div style={{ background: '#12141C', border: `1px solid ${C.border}`, padding: 12, borderRadius: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: C.ink }}>
                    <button type="button" onClick={() => setEditColForm({ ...editColForm, override_permissoes: !editColForm.override_permissoes })} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      {editColForm.override_permissoes ? <ToggleRight size={24} color={C.amber} /> : <ToggleLeft size={24} color={C.border} />}
                    </button>
                    Personalizar acessos desta pessoa (sobrescrever cargo)
                  </label>
                  <p style={{ fontSize: 10, color: C.inkSoft, margin: '6px 0 0 34px', lineHeight: 1.4 }}>
                    Se ativado, esta conta usa as regras abaixo em vez das regras do cargo ({NOMES_CARGOS[editColForm.cargo]}).
                  </p>
                </div>

                {editColForm.override_permissoes ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>Ações Financeiras</span>
                      {([
                        ['pode_empresas', 'Gerenciar Empresas'],
                        ['pode_fornecedores', 'Gerenciar Fornecedores'],
                        ['pode_lancar', 'Registrar Lançamentos / Contas'],
                        ['pode_pagar', 'Marcar Contas como Pagas'],
                        ['pode_aprovar', 'Aprovar Contas acima do limite'],
                      ] as const).map(([campo, desc]) => (
                        <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink }}>
                          <button type="button" onClick={() => setEditColForm({ ...editColForm, [campo]: !editColForm[campo] })} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            {editColForm[campo] ? <ToggleRight size={22} color={C.amber} /> : <ToggleLeft size={22} color={C.border} />}
                          </button>
                          {desc}
                        </label>
                      ))}
                    </div>



                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Módulos Visíveis (Sidebar)</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {ALL_APPS.map(app => {
                          const appsCol = editColForm.apps ? editColForm.apps.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                          const valorCheck = appsCol.includes(app.id)
                          return (
                            <label key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11.5, color: C.ink }}>
                              <button type="button" onClick={() => handleToggleAppColaborador(app.id)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                {valorCheck ? <ToggleRight size={20} color={C.amber} /> : <ToggleLeft size={20} color={C.border} />}
                              </button>
                              {app.nome}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* ABAS VISÍVEIS NO FINANCEIRO (individual) */}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>Abas Visíveis no Financeiro</span>
                        <button
                          type="button"
                          onClick={() => {
                            const ALL_ABAS_IDS = ['dashboard','historico','contas','empresas','fornecedores','obras']
                            const abasList = editColForm.abas_financeiro ? editColForm.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                            const todasMarcadas = ALL_ABAS_IDS.every(a => abasList.includes(a))
                            setEditColForm({ ...editColForm, abas_financeiro: todasMarcadas ? '' : ALL_ABAS_IDS.join(',') })
                          }}
                          style={{ background: 'transparent', border: 0, color: C.amber, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                        >
                          {(() => {
                            const ALL_ABAS_IDS = ['dashboard','historico','contas','empresas','fornecedores','obras']
                            const abasList = editColForm.abas_financeiro ? editColForm.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                            return ALL_ABAS_IDS.every(a => abasList.includes(a)) ? 'Desmarcar todas' : '✓ Selecionar todas'
                          })()}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {([
                          ['dashboard',    '📊 Dashboard'],
                          ['historico',    '📋 Histórico & Fluxo'],
                          ['contas',       '➕ Lançar Conta'],
                          ['empresas',     '🏢 Empresas'],
                          ['fornecedores', '👥 Fornecedores'],
                          ['obras',        '🏗️ Obras & Métricas'],
                        ] as const).map(([abaId, abaLabel]) => {
                          const abasList = editColForm.abas_financeiro ? editColForm.abas_financeiro.split(',').map((x: string) => x.trim()).filter(Boolean) : []
                          const checked = abasList.includes(abaId)
                          return (
                            <label key={abaId} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: C.ink, cursor: 'pointer', background: checked ? '#F59E0B0A' : 'transparent', padding: '4px 6px', borderRadius: 4 }}>
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

                    {/* AÇÕES NO HISTÓRICO & FLUXO (individual) */}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Ações no Histórico & Fluxo</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {([
                          ['pode_alterar_status',     'Alterar status dos lançamentos'] as const,
                          ['pode_aprovar',            'Aprovar lançamentos pendentes'] as const,
                          ['pode_pagar',              'Marcar como pago'] as const,
                          ['pode_excluir_lancamento', 'Excluir lançamentos'] as const,
                        ]).map(([campo, desc]) => (
                          <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink }}>
                            <button type="button" onClick={() => setEditColForm({ ...editColForm, [campo]: !editColForm[campo as keyof typeof editColForm] })} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              {editColForm[campo as keyof typeof editColForm] ? <ToggleRight size={22} color={C.amber} /> : <ToggleLeft size={22} color={C.border} />}
                            </button>
                            {desc}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px 10px', textAlign: 'center', color: C.inkSoft, fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                    Esta conta herdará todas as permissões globais do cargo <strong>{NOMES_CARGOS[editColForm.cargo]}</strong>.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <button type="submit" disabled={savingEditCol} style={btn(C.amber)}>{savingEditCol ? 'Gravando...' : 'Salvar Permissões'}</button>
                  <button type="button" onClick={() => setEditColForm(null)} style={btnGhost}>Cancelar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
