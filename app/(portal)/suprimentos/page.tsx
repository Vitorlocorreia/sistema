'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Plus, Layers, Calendar, User, DollarSign, Building, 
  ArrowRight, ArrowLeft, Eye, Check, X, Truck, PackageCheck,
  AlertCircle, ChevronRight, Edit3, ShoppingBag, ClipboardList, Clock,
  Wrench, Shield, Hammer, Briefcase, Tag, Search
} from 'lucide-react'
import { Panel } from '@/components/Panel'
import { PageTitle } from '@/components/PageTitle'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'motion/react'
import type { Obra, Suprimento, Tarefa } from '@/lib/types'

// ─── STYLES & HELPERS ────────────────────────────────────────────────────────
const input: React.CSSProperties = {
  background: '#0B0C0E',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.ink,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
}

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: C.inkSoft,
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 4,
}

const selectStyle: React.CSSProperties = {
  ...input,
  cursor: 'pointer',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

const btn = (accent = C.amber): React.CSSProperties => ({
  background: accent, color: '#0B0C0E', border: 'none', borderRadius: 4,
  padding: '8px 18px', fontSize: 11, fontWeight: 900, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  textTransform: 'uppercase' as const, letterSpacing: .4,
})

const btnGhost: React.CSSProperties = {
  background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
  padding: '8px 16px', fontSize: 11, fontWeight: 700, color: C.inkSoft, cursor: 'pointer',
}

// Colunas Kanban de Suprimentos
const colunasSuprimentos = [
  { id: 'Solicitado', label: '1. Solicitado', color: C.inkSoft },
  { id: 'Em Cotação', label: '2. Em Cotação', color: '#3B82F6' },
  { id: 'Aprovação',  label: '3. Aguardando Aprovação', color: C.amber },
  { id: 'Em Trânsito', label: '4. Em Trânsito', color: C.green },
  { id: 'Entregue',   label: '5. Entregue', color: '#6B7280' }
] as const

type StatusSuprimento = typeof colunasSuprimentos[number]['id']

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Suprimentos() {
  const [supplies, setSupplies] = useState<(Suprimento & { obra?: Pick<Obra, 'nome'> })[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [confirmApproveItem, setConfirmApproveItem] = useState<any | null>(null)

  // Filters
  const [selectedObra, setSelectedObra] = useState('Todas')

  // Form states
  const [newMaterial, setNewMaterial] = useState('')
  const [newQuantidade, setNewQuantidade] = useState('')
  const [newUnidade, setNewUnidade] = useState('un')
  const [newObraId, setNewObraId] = useState('')
  const [newPrioridade, setNewPrioridade] = useState<'alta' | 'media' | 'baixa'>('media')
  const [newValor, setNewValor] = useState('')
  const [newFornecedor, setNewFornecedor] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: o }] = await Promise.all([
      supabase.from('suprimentos').select('*, obra:obras(nome)').order('created_at', { ascending: false }),
      supabase.from('obras').select('*').order('nome'),
    ])
    setSupplies(s ?? [])
    setObras(o ?? [])
    if (o && o.length > 0 && !newObraId) {
      setNewObraId(o[0].id)
    }
    setLoading(false)
  }, [newObraId])

  useEffect(() => { loadData() }, [loadData])

  const today = new Date().toISOString().split('T')[0]
  const isOverdue = (item: Suprimento) =>
    !!item.data_vencimento && item.data_vencimento < today && item.status !== 'Entregue'

  const filteredSupplies = supplies.filter(s => selectedObra === 'Todas' || s.obra?.nome === selectedObra)

  const moveItem = async (id: string, direction: 'forward' | 'backward') => {
    const statusOrder: StatusSuprimento[] = ['Solicitado', 'Em Cotação', 'Aprovação', 'Em Trânsito', 'Entregue']
    const item = supplies.find(s => s.id === id)
    if (!item) return

    const currentIndex = statusOrder.indexOf(item.status as StatusSuprimento)
    const nextIndex = currentIndex + (direction === 'forward' ? 1 : -1)

    if (nextIndex >= 0 && nextIndex < statusOrder.length) {
      const nextStatus = statusOrder[nextIndex]
      const { error } = await supabase.from('suprimentos').update({ status: nextStatus }).eq('id', id)
      if (error) {
        toast('Erro ao atualizar status', 'error')
        return
      }
      toast(`Status alterado para ${nextStatus}`, 'success')
      loadData()
      if (selectedItem?.id === id) {
        setSelectedItem({ ...selectedItem, status: nextStatus })
      }
    }
  }

  const approvePurchase = async (id: string) => {
    const { error } = await supabase
      .from('suprimentos')
      .update({ status: 'Em Trânsito', fornecedor: confirmApproveItem.fornecedor || 'Fornecedor Homologado' })
      .eq('id', id)

    if (error) {
      toast('Erro ao aprovar pedido', 'error')
      return
    }

    setConfirmApproveItem(null)
    setSelectedItem(null)
    toast('Compra aprovada! Material movido para Em Trânsito.', 'success')
    loadData()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMaterial.trim() || !newObraId) return

    const { error } = await supabase.from('suprimentos').insert({
      titulo: newMaterial,
      quantidade: newQuantidade || '1',
      unidade: newUnidade,
      obra_id: newObraId,
      valor: parseFloat(newValor) || 0,
      prioridade: newPrioridade,
      status: 'Solicitado',
      solicitante: 'Portal Corporativo',
      fornecedor: newFornecedor || null
    })

    if (error) {
      toast('Erro ao criar solicitação', 'error')
      return
    }

    setIsCreateOpen(false)
    setNewMaterial('')
    setNewQuantidade('')
    setNewValor('')
    setNewFornecedor('')
    toast(`Solicitação de "${newMaterial}" criada com sucesso!`, 'success')
    loadData()
  }

  // KPIs
  const totalAprovacao = filteredSupplies.filter(s => s.status === 'Aprovação').reduce((sum, item) => sum + Number(item.valor || 0), 0)
  const countAprovacao = filteredSupplies.filter(s => s.status === 'Aprovação').length
  const totalGeral = filteredSupplies.reduce((sum, item) => sum + Number(item.valor || 0), 0)

  return (
    <>
      <PageTitle modulo="Portal Nativo" titulo="Gestão de Suprimentos" />

      {/* Top Aggregations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>Total Planejado/Gasto</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, fontFamily: 'var(--font-display)' }}>
            {fmt(totalGeral)}
          </div>
          <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>Volume acumulado de todos os pedidos</div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>Aguardando Aprovação</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.amber, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{fmt(totalAprovacao)}</span>
            <span style={{ fontSize: 11, background: C.amberDim, border: `1px solid ${C.amber}33`, color: C.amber, padding: '1px 6px', borderRadius: 2 }}>
              {countAprovacao} itens
            </span>
          </div>
          <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>Orçamentos pendentes de visto técnico</div>
        </div>

        {/* Filter Obra */}
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>Filtrar por Obra</label>
          <select 
            value={selectedObra}
            onChange={e => setSelectedObra(e.target.value)}
            style={selectStyle}
          >
            <option value="Todas">Todas as Obras</option>
            {obras.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
          </select>
        </div>

        {/* Action Button */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsCreateOpen(true)}
          style={{ 
            all: 'unset',
            cursor: 'pointer',
            background: C.amber,
            color: '#0B0C0E',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            padding: 16
          }}
        >
          <Plus size={16} /> Solicitar Material
        </motion.button>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13, marginBottom: 28 }}>Carregando dados da nuvem...</p>
      ) : (
        <Panel title="Fluxo de Suprimentos da Construtora">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: 14, overflowX: 'auto', paddingBottom: 10 }}>
            {colunasSuprimentos.map(col => {
              const items = filteredSupplies.filter(s => s.status === col.id)
              return (
                <div 
                  key={col.id}
                  style={{ 
                    background: '#0F1115', 
                    padding: 12, 
                    borderRadius: 2, 
                    border: `1px solid ${C.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minWidth: 220
                  }}
                >
                  {/* Column Header */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderBottom: `1px solid ${C.border}`,
                    paddingBottom: 8,
                  }}>
                    <span style={{ 
                      fontSize: 10, 
                      fontWeight: 900, 
                      color: C.ink, 
                      textTransform: 'uppercase', 
                      letterSpacing: 0.5,
                      fontFamily: 'var(--font-display)'
                    }}>{col.label}</span>
                    <span style={{ 
                      fontSize: 9, 
                      fontWeight: 800, 
                      color: col.color,
                      background: `${col.color}15`,
                      border: `1px solid ${col.color}33`,
                      padding: '1px 5px',
                      borderRadius: 2
                    }}>{items.length}</span>
                  </div>

                  {/* Column Cards Container */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 300 }}>
                    {items.map((item) => (
                      <div 
                        key={item.id} 
                        style={{ 
                          padding: 12, 
                          background: C.bgCard, 
                          borderRadius: 2, 
                          border: `1px solid ${isOverdue(item) ? '#EF444466' : item.prioridade === 'alta' ? `${C.red}33` : C.border}`,
                          boxShadow: isOverdue(item) ? '0 0 0 1px #EF444422' : '0 2px 4px rgba(0,0,0,0.15)',
                          position: 'relative',
                        }}
                      >
                        {isOverdue(item) && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: '#EF444418', border: '1px solid #EF444444',
                            borderRadius: 2, padding: '2px 6px',
                            fontSize: 8, fontWeight: 900, color: '#EF4444',
                            textTransform: 'uppercase', marginBottom: 6
                          }}>
                            <Clock size={8} /> Atrasado
                          </div>
                        )}
                        <span style={{
                          fontSize: 8,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          padding: '1px 4px',
                          borderRadius: 2,
                          background: item.prioridade === 'alta' ? `${C.red}22` : item.prioridade === 'media' ? `${C.amber}22` : `${C.inkSoft}22`,
                          color: item.prioridade === 'alta' ? C.red : item.prioridade === 'media' ? C.amber : C.inkSoft,
                          border: `1px solid ${item.prioridade === 'alta' ? C.red : item.prioridade === 'media' ? C.amber : C.inkSoft}33`,
                          display: 'inline-block',
                          marginBottom: 6
                        }}>
                          {item.prioridade ?? 'média'}
                        </span>

                        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 4 }}>
                          {item.titulo}
                        </div>
                        
                        <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 8 }}>
                          {item.quantidade} {item.unidade ?? 'un'}
                        </div>

                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: C.inkSoft }}>{item.obra?.nome?.split(' ')[0] ?? 'N/A'}</span>
                          <span style={{ fontSize: 11, fontWeight: 900, color: C.ink }}>{fmt(Number(item.valor || 0))}</span>
                        </div>

                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 10, borderTop: `1px solid ${C.border}33`, paddingTop: 6 }}>
                          <button 
                            onClick={() => setSelectedItem(item)}
                            style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.inkSoft }}
                            title="Detalhes"
                          >
                            <Eye size={12} />
                          </button>
                          
                          {item.status !== 'Solicitado' && (
                            <button 
                              onClick={() => moveItem(item.id, 'backward')}
                              style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.inkSoft }}
                            >
                              <ArrowLeft size={12} />
                            </button>
                          )}

                          {item.status !== 'Entregue' && (
                            <button 
                              onClick={() => moveItem(item.id, 'forward')}
                              style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.amber }}
                            >
                              <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {items.length === 0 && (
                      <div style={{ 
                        padding: '40px 10px', 
                        textAlign: 'center', 
                        color: C.inkSoft, 
                        fontSize: 11, 
                        border: `1px dashed ${C.border}`,
                        borderRadius: 2
                      }}>
                        Sem itens
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2,
                width: '100%', maxWidth: 500, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>Solicitação</span>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '2px 0 0' }}>{selectedItem.titulo}</h3>
                </div>
                <button onClick={() => setSelectedItem(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Quantidade</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.quantidade} {selectedItem.unidade ?? 'un'}</span>
                </div>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Obra</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.obra?.nome ?? 'Sem obra'}</span>
                </div>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Valor da Cotação</span>
                  <span style={{ fontWeight: 800, color: C.amber }}>{fmt(Number(selectedItem.valor || 0))}</span>
                </div>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Solicitado por</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.solicitante ?? 'Não informado'}</span>
                </div>
              </div>

              {selectedItem.fornecedor && (
                <div style={{ background: C.bgCard, padding: 12, borderRadius: 2, border: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Fornecedor</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.fornecedor}</span>
                </div>
              )}

              {selectedItem.status === 'Aprovação' && (
                <div style={{ background: `${C.amber}11`, border: `1px solid ${C.amber}44`, padding: 12, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <AlertCircle size={14} color={C.amber} />
                    <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>Aprovação Pendente</span>
                  </div>
                  <button 
                    onClick={() => setConfirmApproveItem(selectedItem)}
                    style={{
                      background: C.amber, border: 'none', color: '#0B0C0E', fontSize: 10, fontWeight: 900,
                      padding: '6px 12px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase'
                    }}
                  >
                    Aprovar Compra
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2,
                width: '100%', maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nova Solicitação de Material</span>
                <button onClick={() => setIsCreateOpen(false)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={label}>Material/Insumo *</label>
                  <input 
                    type="text" required placeholder="Ex: Cimento CP-II"
                    value={newMaterial} onChange={e => setNewMaterial(e.target.value)}
                    style={input}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Quantidade *</label>
                    <input 
                      type="text" required placeholder="Ex: 200"
                      value={newQuantidade} onChange={e => setNewQuantidade(e.target.value)}
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={label}>Unidade *</label>
                    <input 
                      type="text" required placeholder="Ex: sacos, un, kg"
                      value={newUnidade} onChange={e => setNewUnidade(e.target.value)}
                      style={input}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Orçamento Estimado (R$)</label>
                    <input 
                      type="number" placeholder="Ex: 6400"
                      value={newValor} onChange={e => setNewValor(e.target.value)}
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={label}>Fornecedor Indicado</label>
                    <input 
                      type="text" placeholder="Ex: Gerdau S.A."
                      value={newFornecedor} onChange={e => setNewFornecedor(e.target.value)}
                      style={input}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Obra Destino *</label>
                    <select 
                      value={newObraId} onChange={e => setNewObraId(e.target.value)}
                      style={selectStyle}
                    >
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Prioridade</label>
                    <select 
                      value={newPrioridade} onChange={e => setNewPrioridade(e.target.value as any)}
                      style={selectStyle}
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button 
                    type="button" onClick={() => setIsCreateOpen(false)}
                    style={btnGhost}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    style={{
                      ...btn(),
                      fontSize: 10, padding: '8px 18px'
                    }}
                  >
                    Enviar Solicitação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Approval Modal */}
      <ConfirmModal
        open={!!confirmApproveItem}
        title="Confirmar Aprovação"
        description={`Você está prestes a autorizar a compra de "${confirmApproveItem?.titulo}" no valor de R$ ${confirmApproveItem?.valor?.toLocaleString('pt-BR')}. Esta ação não pode ser desfeita.`}
        confirmLabel="Aprovar Compra"
        confirmColor={C.amber}
        onConfirm={() => confirmApproveItem && approvePurchase(confirmApproveItem.id)}
        onCancel={() => setConfirmApproveItem(null)}
      >
        {confirmApproveItem && (
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 2, padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: C.inkSoft }}>Fornecedor:</span>
              <span style={{ color: C.ink, fontWeight: 800 }}>{confirmApproveItem.fornecedor || 'Fornecedor Homologado'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: C.inkSoft }}>Obra destino:</span>
              <span style={{ color: C.ink, fontWeight: 800 }}>{confirmApproveItem.obra?.nome ?? 'Sem obra'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.inkSoft }}>Valor total:</span>
              <span style={{ color: C.amber, fontWeight: 900 }}>{fmt(Number(confirmApproveItem.valor || 0))}</span>
            </div>
          </div>
        )}
      </ConfirmModal>

      <QuadroTarefas obrasList={obras} />
    </>
  )
}

// ════════════════════════════════════════════════════════
//  QUADRO DE TAREFAS INTEGRADO
// ════════════════════════════════════════════════════════
type TarefaStatus = 'A Fazer' | 'Em Andamento' | 'Em Revisão' | 'Concluído'
type TarefaCategoria = 'Manutenção' | 'Segurança' | 'Engenharia' | 'Administrativo' | 'Qualidade'

const categoriaConfig: Record<TarefaCategoria, { label: string; color: string }> = {
  'Manutenção':    { label: 'Manutenção',   color: '#F59E0B' },
  'Segurança':     { label: 'Segurança',    color: '#EF4444' },
  'Engenharia':    { label: 'Engenharia',   color: '#3B82F6' },
  'Administrativo':{ label: 'Administrativo', color: '#8B5CF6' },
  'Qualidade':     { label: 'Qualidade',    color: '#10B981' },
}

const colunasTarefas = [
  { id: 'A Fazer',      label: 'A Fazer',      color: '#6B7280' },
  { id: 'Em Andamento', label: 'Em Andamento', color: '#3B82F6' },
  { id: 'Em Revisão',   label: 'Em Revisão',   color: '#F59E0B' },
  { id: 'Concluído',    label: 'Concluído',    color: '#10B981' },
] as const

function QuadroTarefas({ obrasList }: { obrasList: Obra[] }) {
  const [tarefas, setTarefas] = useState<(Tarefa & { obra?: Pick<Obra, 'nome'> })[]>([])
  const [filtroTipo, setFiltroTipo] = useState<TarefaCategoria | 'todos'>('todos')
  const [filtroObra, setFiltroObra] = useState('Todas')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newTarefa, setNewTarefa] = useState<Partial<Tarefa>>({
    categoria: 'Engenharia', status: 'A Fazer',
    responsavel: ''
  })

  const load = useCallback(async () => {
    const { data } = await supabase.from('tarefas').select('*, obra:obras(nome)').order('created_at')
    setTarefas(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().split('T')[0]
  const isPrazoVencido = (t: Tarefa) => !!t.prazo && t.prazo < today && t.status !== 'Concluído'

  const tarefasFiltradas = tarefas.filter(t => {
    const matchTipo = filtroTipo === 'todos' || t.categoria === filtroTipo
    const matchObra = filtroObra === 'Todas' || t.obra?.nome === filtroObra
    return matchTipo && matchObra
  })

  const moverTarefa = async (id: string, dir: 'forward' | 'backward') => {
    const order: TarefaStatus[] = ['A Fazer', 'Em Andamento', 'Em Revisão', 'Concluído']
    const t = tarefas.find(x => x.id === id)
    if (!t) return

    const idx = order.indexOf(t.status as TarefaStatus)
    const next = idx + (dir === 'forward' ? 1 : -1)
    if (next < 0 || next >= order.length) return

    const { error } = await supabase.from('tarefas').update({ status: order[next] }).eq('id', id)
    if (error) {
      toast('Erro ao atualizar tarefa', 'error')
      return
    }
    toast(`Tarefa movida para ${order[next]}`, 'success')
    load()
  }

  const criarTarefa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTarefa.titulo?.trim()) return

    const { error } = await supabase.from('tarefas').insert({
      titulo: newTarefa.titulo,
      descricao: newTarefa.descricao || '',
      obra_id: newTarefa.obra_id || null,
      responsavel: newTarefa.responsavel || 'Não definido',
      categoria: newTarefa.categoria as TarefaCategoria,
      status: 'A Fazer',
      prazo: newTarefa.prazo || null
    })

    if (error) {
      toast('Erro ao criar tarefa', 'error')
      return
    }

    setIsAddOpen(false)
    setNewTarefa({ categoria: 'Engenharia', status: 'A Fazer', responsavel: '' })
    toast(`Tarefa "${newTarefa.titulo}" criada!`, 'success')
    load()
  }

  return (
    <Panel
      title="Quadro de Tarefas — Operações Integradas"
      action={
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {/* Filtro tipo */}
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}
            style={{ ...selectStyle, width: 'auto', padding: '4px 8px' }}
          >
            <option value="todos">Todos os tipos</option>
            {(Object.keys(categoriaConfig) as TarefaCategoria[]).map(k => (
              <option key={k} value={k}>{categoriaConfig[k].label}</option>
            ))}
          </select>
          {/* Filtro obra */}
          <select
            value={filtroObra}
            onChange={e => setFiltroObra(e.target.value)}
            style={{ ...selectStyle, width: 'auto', padding: '4px 8px' }}
          >
            <option value="Todas">Todas as Obras</option>
            {obrasList.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
          </select>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (obrasList.length > 0) {
                setNewTarefa(t => ({ ...t, obra_id: obrasList[0].id }))
              }
              setIsAddOpen(true)
            }}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 2, background: C.amber, color: '#0B0C0E', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}
          >
            <Plus size={11} /> Nova Tarefa
          </motion.button>
        </div>
      }
    >
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {(Object.entries(categoriaConfig) as [TarefaCategoria, typeof categoriaConfig[TarefaCategoria]][]).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: C.inkSoft }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Kanban Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 10 }}>
        {colunasTarefas.map(col => {
          const items = tarefasFiltradas.filter(t => t.status === col.id)
          return (
            <div key={col.id} style={{ background: '#0F1115', padding: 10, borderRadius: 2, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.label}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: col.color, background: `${col.color}18`, border: `1px solid ${col.color}33`, padding: '1px 5px', borderRadius: 2 }}>{items.length}</span>
              </div>

              {/* Column Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220 }}>
                {items.map(t => {
                  const cfg = categoriaConfig[t.categoria] || categoriaConfig['Engenharia']
                  const venc = isPrazoVencido(t)
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: 10, background: C.bgCard, borderRadius: 2,
                        border: `1px solid ${venc ? '#EF444466' : C.border}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      {venc && (
                        <div style={{ color: '#EF4444', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 }}>
                          Prazo Vencido
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                        <span style={{ fontSize: 9, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>{cfg.label}</span>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{t.titulo}</div>
                      {t.descricao && <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8, lineHeight: 1.3 }}>{t.descricao}</div>}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}33`, paddingTop: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: C.inkSoft }}>{t.responsavel}</span>
                        {t.prazo && <span style={{ fontSize: 9, color: venc ? '#EF4444' : C.inkSoft, fontWeight: 700 }}>Até {fmtDate(t.prazo)}</span>}
                      </div>

                      {/* Move controls */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8, borderTop: `1px solid ${C.border}33`, paddingTop: 4 }}>
                        {t.status !== 'A Fazer' && (
                          <button onClick={() => moverTarefa(t.id, 'backward')} style={{ all: 'unset', cursor: 'pointer', padding: 2, color: C.inkSoft }}>
                            <ArrowLeft size={10} />
                          </button>
                        )}
                        {t.status !== 'Concluído' && (
                          <button onClick={() => moverTarefa(t.id, 'forward')} style={{ all: 'unset', cursor: 'pointer', padding: 2, color: C.amber }}>
                            <ArrowRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {items.length === 0 && <div style={{ padding: '24px 8px', textAlign: 'center', color: C.inkSoft, fontSize: 10, border: `1px dashed ${C.border}`, borderRadius: 2 }}>Sem tarefas</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2, width: '100%', maxWidth: 400, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>Nova Tarefa</span>
                <button onClick={() => setIsAddOpen(false)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={15} /></button>
              </div>

              <form onSubmit={criarTarefa} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={label}>Título *</label>
                  <input type="text" required value={newTarefa.titulo || ''} onChange={e => setNewTarefa(t => ({ ...t, titulo: e.target.value }))} style={input} placeholder="O que precisa ser feito?" />
                </div>
                <div>
                  <label style={label}>Descrição</label>
                  <textarea value={newTarefa.descricao || ''} onChange={e => setNewTarefa(t => ({ ...t, descricao: e.target.value }))} style={{ ...input, height: 60, resize: 'none' }} placeholder="Detalhes da atividade" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Obra Destino *</label>
                    <select value={newTarefa.obra_id || ''} onChange={e => setNewTarefa(t => ({ ...t, obra_id: e.target.value }))} style={selectStyle}>
                      {obrasList.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Categoria</label>
                    <select value={newTarefa.categoria || 'Engenharia'} onChange={e => setNewTarefa(t => ({ ...t, categoria: e.target.value as any }))} style={selectStyle}>
                      {Object.keys(categoriaConfig).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Responsável</label>
                    <input type="text" value={newTarefa.responsavel || ''} onChange={e => setNewTarefa(t => ({ ...t, responsavel: e.target.value }))} style={input} placeholder="Ex: Mestre Carlos" />
                  </div>
                  <div>
                    <label style={label}>Prazo</label>
                    <input type="date" value={newTarefa.prazo || ''} onChange={e => setNewTarefa(t => ({ ...t, prazo: e.target.value }))} style={input} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" onClick={() => setIsAddOpen(false)} style={btnGhost}>Cancelar</button>
                  <button type="submit" style={{ ...btn(), fontSize: 10, padding: '8px 16px' }}>Criar Tarefa</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
