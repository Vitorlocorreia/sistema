'use client'

import { useState } from 'react'
import { 
  Plus, Layers, Calendar, User, DollarSign, Building, 
  ArrowRight, ArrowLeft, Eye, Check, X, Truck, PackageCheck,
  AlertCircle, ChevronRight, Edit3, ShoppingBag, ClipboardList, Clock,
  Wrench, Shield, Hammer, FileText, Briefcase, Tag
} from 'lucide-react'
import { Panel } from '@/components/Panel'
import { PageTitle } from '@/components/PageTitle'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { motion, AnimatePresence } from 'motion/react'

interface SupplyItem {
  id: string
  material: string
  quantidade: string
  obra: string
  solicitante: string
  fornecedor?: string
  valor: number
  prioridade: 'alta' | 'media' | 'baixa'
  dataSolicitacao: string
  previsaoEntrega?: string
  status: 'solicitado' | 'cotacao' | 'aprovacao' | 'transito' | 'entregue'
  historico: { status: string; data: string; descricao: string }[]
}

const initialSupplies: SupplyItem[] = [
  {
    id: 'SUP-2026-001',
    material: 'Cimento CP-II Votoran',
    quantidade: '200 sacos (50kg)',
    obra: 'Residencial Bela Vista',
    solicitante: 'Mestre Carlos Eduardo',
    fornecedor: 'Distribuidora Anhanguera Ltda',
    valor: 6400,
    prioridade: 'alta',
    dataSolicitacao: '2026-06-28',
    previsaoEntrega: '2026-07-03',
    status: 'transito',
    historico: [
      { status: 'solicitado', data: '2026-06-28', descricao: 'Solicitação gerada pelo mestre de obras.' },
      { status: 'cotacao', data: '2026-06-29', descricao: 'Cotação de R$ 32,00 por saco obtida.' },
      { status: 'aprovacao', data: '2026-06-29', descricao: 'Aprovado pelo Diretor Técnico.' },
      { status: 'transito', data: '2026-06-30', descricao: 'Material faturado e enviado pela transportadora.' }
    ]
  },
  {
    id: 'SUP-2026-002',
    material: 'Aço CA-50 Gerdau 10mm',
    quantidade: '3 toneladas',
    obra: 'Edifício Horizonte',
    solicitante: 'Eng. Lucas Ramos',
    fornecedor: 'Metalúrgica Gerdau SP',
    valor: 18900,
    prioridade: 'alta',
    dataSolicitacao: '2026-06-29',
    status: 'aprovacao',
    historico: [
      { status: 'solicitado', data: '2026-06-29', descricao: 'Solicitação de urgência para fundação do 8º pavimento.' },
      { status: 'cotacao', data: '2026-06-30', descricao: 'Melhor cotação fechada em R$ 18.900,00.' }
    ]
  },
  {
    id: 'SUP-2026-003',
    material: 'Tijolo Cerâmico 8 Furos',
    quantidade: '15.000 unidades',
    obra: 'Condomínio Parque Sul',
    solicitante: 'Mestre João Pedro',
    fornecedor: 'Cerâmica São José',
    valor: 9200,
    prioridade: 'media',
    dataSolicitacao: '2026-06-25',
    previsaoEntrega: '2026-06-29',
    status: 'entregue',
    historico: [
      { status: 'solicitado', data: '2026-06-25', descricao: 'Solicitado para fechamento do muro perimetral.' },
      { status: 'cotacao', data: '2026-06-26', descricao: 'Cotação fechada.' },
      { status: 'aprovacao', data: '2026-06-26', descricao: 'Compra autorizada.' },
      { status: 'transito', data: '2026-06-27', descricao: 'Carga em trânsito.' },
      { status: 'entregue', data: '2026-06-29', descricao: 'Material recebido e conferido no canteiro. Tudo conforme pedido.' }
    ]
  },
  {
    id: 'SUP-2026-004',
    material: 'Tubos PVC Soldável 25mm',
    quantidade: '80 barras (6m)',
    obra: 'Residencial Bela Vista',
    solicitante: 'Encarregado Marcos Vinícius',
    valor: 1600,
    prioridade: 'baixa',
    dataSolicitacao: '2026-06-30',
    status: 'solicitado',
    historico: [
      { status: 'solicitado', data: '2026-06-30', descricao: 'Solicitado para instalações elétricas/hidráulicas.' }
    ]
  },
  {
    id: 'SUP-2026-005',
    material: 'Areia Fina Lavada',
    quantidade: '2 caminhões truck (24m³)',
    obra: 'Condomínio Parque Sul',
    solicitante: 'Mestre João Pedro',
    valor: 2800,
    prioridade: 'media',
    dataSolicitacao: '2026-06-30',
    status: 'cotacao',
    historico: [
      { status: 'solicitado', data: '2026-06-30', descricao: 'Necessário para argamassa de reboco.' }
    ]
  }
]

const colunas = [
  { id: 'solicitado', label: '1. Solicitado', color: C.inkSoft },
  { id: 'cotacao',    label: '2. Em Cotação', color: '#3B82F6' },
  { id: 'aprovacao',  label: '3. Aguardando Aprovação', color: C.amber },
  { id: 'transito',   label: '4. Em Trânsito', color: C.green },
  { id: 'entregue',   label: '5. Entregue', color: '#6B7280' }
] as const

type StatusType = typeof colunas[number]['id']

export default function Suprimentos() {
  const [supplies, setSupplies] = useState<SupplyItem[]>(initialSupplies)
  const [selectedItem, setSelectedItem] = useState<SupplyItem | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [confirmApproveItem, setConfirmApproveItem] = useState<SupplyItem | null>(null)

  // Filters
  const [selectedObra, setSelectedObra] = useState('Todas')

  // Form states
  const [newMaterial, setNewMaterial] = useState('')
  const [newQuantidade, setNewQuantidade] = useState('')
  const [newObra, setNewObra] = useState('Residencial Bela Vista')
  const [newPrioridade, setNewPrioridade] = useState<'alta' | 'media' | 'baixa'>('media')
  const [newValor, setNewValor] = useState('')

  // Overdue check
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = (item: SupplyItem) =>
    !!item.previsaoEntrega && item.previsaoEntrega < today && item.status !== 'entregue'

  // Filter logic
  const filteredSupplies = supplies.filter(s => selectedObra === 'Todas' || s.obra === selectedObra)

  // Move item through columns (Click actions)
  const moveItem = (id: string, direction: 'forward' | 'backward') => {
    const statusOrder: StatusType[] = ['solicitado', 'cotacao', 'aprovacao', 'transito', 'entregue']
    
    setSupplies(prev => prev.map(item => {
      if (item.id === id) {
        const currentIndex = statusOrder.indexOf(item.status)
        let nextIndex = currentIndex + (direction === 'forward' ? 1 : -1)
        
        if (nextIndex >= 0 && nextIndex < statusOrder.length) {
          const nextStatus = statusOrder[nextIndex]
          const updatedItem = {
            ...item,
            status: nextStatus,
            historico: [
              ...item.historico,
              {
                status: nextStatus,
                data: new Date().toISOString().split('T')[0],
                descricao: `Movido para a coluna: ${nextStatus.toUpperCase()}`
              }
            ]
          }
          if (selectedItem?.id === id) {
            setSelectedItem(updatedItem)
          }
          return updatedItem
        }
      }
      return item
    }))
  }

  // Handle direct approval (called after confirmation)
  const approvePurchase = (id: string) => {
    setSupplies(prev => prev.map(item => {
      if (item.id === id) {
        const updated = {
          ...item,
          status: 'transito' as const,
          fornecedor: item.fornecedor || 'Fornecedor Homologado',
          historico: [
            ...item.historico,
            {
              status: 'transito',
              data: new Date().toISOString().split('T')[0],
              descricao: 'Compra autorizada pelo Diretor. Emitida ordem de servico.'
            }
          ]
        }
        if (selectedItem?.id === id) setSelectedItem(updated)
        return updated
      }
      return item
    }))
    setConfirmApproveItem(null)
    toast('Compra aprovada! Material movido para Em Transito.', 'success')
  }

  // Create new request
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMaterial.trim()) return

    const id = `SUP-2026-0${supplies.length + 1}`
    const newItem: SupplyItem = {
      id,
      material: newMaterial,
      quantidade: newQuantidade || '1 un',
      obra: newObra,
      solicitante: 'Diretor / Engenheiro Visitante',
      valor: Number(newValor) || 0,
      prioridade: newPrioridade,
      dataSolicitacao: new Date().toISOString().split('T')[0],
      status: 'solicitado',
      historico: [
        { status: 'solicitado', data: new Date().toISOString().split('T')[0], descricao: 'Solicitacao criada no portal corporativo.' }
      ]
    }

    setSupplies(prev => [...prev, newItem])
    setIsCreateOpen(false)
    setNewMaterial('')
    setNewQuantidade('')
    setNewValor('')
    toast(`Solicitacao de "${newMaterial}" criada com sucesso!`, 'success')
  }

  // KPIs
  const totalAprovacao = filteredSupplies.filter(s => s.status === 'aprovacao').reduce((sum, item) => sum + item.valor, 0)
  const countAprovacao = filteredSupplies.filter(s => s.status === 'aprovacao').length
  const totalGeral = filteredSupplies.reduce((sum, item) => sum + item.valor, 0)

  return (
    <>
      <PageTitle modulo="Portal Nativo" titulo="Gestão de Suprimentos" />

      {/* Top Aggregations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>Total Planejado/Gasto</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, fontFamily: 'var(--font-display)' }}>
            R$ {totalGeral.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>Volume acumulado de todos os pedidos</div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>Aguardando Aprovação</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.amber, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>R$ {totalAprovacao.toLocaleString('pt-BR')}</span>
            <span style={{ fontSize: 11, background: C.amberDim, border: `1px solid ${C.amber}33`, color: C.amber, padding: '1px 6px', borderRadius: 2 }}>
              {countAprovacao} itens
            </span>
          </div>
          <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>Orçamentos pendentes do seu visto técnico</div>
        </div>

        {/* Filter Obra */}
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 6 }}>Filtrar por Obra</label>
          <select 
            value={selectedObra}
            onChange={e => setSelectedObra(e.target.value)}
            style={{
              width: '100%',
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              padding: '6px 10px',
              borderRadius: 2,
              fontSize: 12,
              color: C.ink,
              outline: 'none'
            }}
          >
            <option value="Todas">Todas as Obras</option>
            <option value="Residencial Bela Vista">Residencial Bela Vista</option>
            <option value="Edifício Horizonte">Edifício Horizonte</option>
            <option value="Condomínio Parque Sul">Condomínio Parque Sul</option>
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
      <Panel title="Fluxo de Suprimentos da Construtora">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: 14, overflowX: 'auto', paddingBottom: 10 }}>
          {colunas.map(col => {
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
                      {/* Overdue badge */}
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
                      {/* Priority Tag */}
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
                        {item.prioridade}
                      </span>

                      {/* Material and Details */}
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 4 }}>
                        {item.material}
                      </div>
                      
                      <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 8 }}>
                        {item.quantidade}
                      </div>

                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: C.inkSoft }}>{item.obra.split(' ')[0]}</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: C.ink }}>R$ {item.valor.toLocaleString('pt-BR')}</span>
                      </div>

                      {/* Card Actions (Arrows to move status + Eye to view) */}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 10, borderTop: `1px solid ${C.border}33`, paddingTop: 6 }}>
                        <button 
                          onClick={() => setSelectedItem(item)}
                          style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.inkSoft }}
                          title="Detalhes"
                        >
                          <Eye size={12} />
                        </button>
                        
                        {item.status !== 'solicitado' && (
                          <button 
                            onClick={() => moveItem(item.id, 'backward')}
                            style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.inkSoft }}
                          >
                            <ArrowLeft size={12} />
                          </button>
                        )}

                        {item.status !== 'entregue' && (
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

      {/* Drawer/Modal Detail View */}
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
                  <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>{selectedItem.id}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: '2px 0 0' }}>{selectedItem.material}</h3>
                </div>
                <button onClick={() => setSelectedItem(null)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}>
                  <X size={16} />
                </button>
              </div>

              {/* Specs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Quantidade</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.quantidade}</span>
                </div>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Obra</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.obra}</span>
                </div>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Valor da Cotação</span>
                  <span style={{ fontWeight: 800, color: C.amber }}>R$ {selectedItem.valor.toLocaleString('pt-BR')}</span>
                </div>
                <div style={{ background: C.bgCard, padding: 10, borderRadius: 2, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Solicitado por</span>
                  <span style={{ fontWeight: 800, color: C.ink }}>{selectedItem.solicitante}</span>
                </div>
              </div>

              {selectedItem.fornecedor && (
                <div style={{ background: C.bgCard, padding: 12, borderRadius: 2, border: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginBottom: 2 }}>Fornecedor Escolhido</span>
                  <span style={{ fontWeight: 850, color: C.ink }}>{selectedItem.fornecedor}</span>
                  {selectedItem.previsaoEntrega && (
                    <span style={{ color: C.inkSoft, fontSize: 10, display: 'block', marginTop: 4 }}>
                      Previsão de Entrega: <strong style={{ color: C.green }}>{selectedItem.previsaoEntrega}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Status Action Banner */}
              {selectedItem.status === 'aprovacao' && (
                <div style={{ background: `${C.amber}11`, border: `1px solid ${C.amber}44`, padding: 12, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <AlertCircle size={14} color={C.amber} />
                    <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>Aprovação Pendente do Diretor</span>
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

              {/* Logs Timeline */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 900, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Linha do Tempo</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 6, borderLeft: `1px solid ${C.border}` }}>
                  {selectedItem.historico.map((h, i) => (
                    <div key={i} style={{ position: 'relative', paddingLeft: 12 }}>
                      <span style={{
                        position: 'absolute', left: -16, top: 4, width: 9, height: 9, borderRadius: '50%',
                        background: i === selectedItem.historico.length - 1 ? C.amber : C.border,
                        border: `2px solid ${C.bg}`
                      }} />
                      <div style={{ fontSize: 11, fontWeight: 900, color: C.ink }}>
                        {h.status.toUpperCase()} <span style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700 }}>· {h.data}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{h.descricao}</div>
                    </div>
                  ))}
                </div>
              </div>
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
                  <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Material/Insumo</label>
                  <input 
                    type="text" required placeholder="Ex: Cimento CP-II"
                    value={newMaterial} onChange={e => setNewMaterial(e.target.value)}
                    style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Quantidade/Unidade</label>
                    <input 
                      type="text" placeholder="Ex: 200 sacos"
                      value={newQuantidade} onChange={e => setNewQuantidade(e.target.value)}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Orçamento Estimado</label>
                    <input 
                      type="number" placeholder="Ex: 6400"
                      value={newValor} onChange={e => setNewValor(e.target.value)}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Obra Destino</label>
                    <select 
                      value={newObra} onChange={e => setNewObra(e.target.value)}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}
                    >
                      <option value="Residencial Bela Vista">Bela Vista</option>
                      <option value="Edifício Horizonte">Horizonte</option>
                      <option value="Condomínio Parque Sul">Parque Sul</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prioridade</label>
                    <select 
                      value={newPrioridade} onChange={e => setNewPrioridade(e.target.value as any)}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}
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
                    style={{ background: 'none', border: `1px solid ${C.border}`, color: C.ink, fontSize: 10, fontWeight: 800, padding: '8px 14px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    style={{ background: C.amber, border: 'none', color: '#0B0C0E', fontSize: 10, fontWeight: 900, padding: '8px 18px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}
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
        title="Confirmar Aprovacao"
        description={`Voce esta prestes a autorizar a compra de "${confirmApproveItem?.material}" no valor de R$ ${confirmApproveItem?.valor.toLocaleString('pt-BR')}. Esta acao nao pode ser desfeita.`}
        confirmLabel="Aprovar Compra"
        confirmColor={C.amber}
        onConfirm={() => confirmApproveItem && approvePurchase(confirmApproveItem.id)}
        onCancel={() => setConfirmApproveItem(null)}
      >
        {confirmApproveItem && (
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 2, padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: C.inkSoft }}>Fornecedor:</span>
              <span style={{ color: C.ink, fontWeight: 800 }}>{confirmApproveItem.fornecedor || 'A definir'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: C.inkSoft }}>Obra destino:</span>
              <span style={{ color: C.ink, fontWeight: 800 }}>{confirmApproveItem.obra}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.inkSoft }}>Valor total:</span>
              <span style={{ color: C.amber, fontWeight: 900 }}>R$ {confirmApproveItem.valor.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        )}
      </ConfirmModal>

      <QuadroTarefas />
    </>
  )
}

// =======================================================================
// QUADRO DE TAREFAS GERAL
// =======================================================================

type TarefaStatus = 'a_fazer' | 'em_andamento' | 'revisao' | 'concluido'
type TarefaTipo = 'manutencao' | 'seguranca' | 'engenharia' | 'administrativo' | 'qualidade'

interface Tarefa {
  id: string
  titulo: string
  descricao: string
  obra: string
  responsavel: string
  tipo: TarefaTipo
  prioridade: 'alta' | 'media' | 'baixa'
  status: TarefaStatus
  prazo?: string
}

const tipoConfig: Record<TarefaTipo, { label: string; color: string; Icon: any }> = {
  manutencao:    { label: 'Manutencao',   color: '#F59E0B', Icon: Wrench },
  seguranca:     { label: 'Seguranca',    color: '#EF4444', Icon: Shield },
  engenharia:    { label: 'Engenharia',   color: '#3B82F6', Icon: Hammer },
  administrativo:{ label: 'Administrativo', color: '#8B5CF6', Icon: Briefcase },
  qualidade:     { label: 'Qualidade',    color: '#10B981', Icon: Check },
}

const colunasGeral = [
  { id: 'a_fazer',      label: 'A Fazer',      color: '#6B7280' },
  { id: 'em_andamento', label: 'Em Andamento', color: '#3B82F6' },
  { id: 'revisao',      label: 'Em Revisao',   color: '#F59E0B' },
  { id: 'concluido',    label: 'Concluido',    color: '#10B981' },
] as const

const initialTarefas: Tarefa[] = [
  { id: 'TAR-001', titulo: 'Inspecao de andaimes — Bloco C', descricao: 'Verificar fixacao e nivelamento de todos os andaimes do bloco C antes da concretagem.', obra: 'Residencial Bela Vista', responsavel: 'Eng. Carlos Eduardo', tipo: 'seguranca', prioridade: 'alta', status: 'a_fazer', prazo: '2026-07-05' },
  { id: 'TAR-002', titulo: 'Calibrar bomba de concreto', descricao: 'Manutencao preventiva da bomba de concreto CP-3000. Trocar filtros e verificar pressao.', obra: 'Residencial Bela Vista', responsavel: 'Mecanico Pedro', tipo: 'manutencao', prioridade: 'alta', status: 'em_andamento', prazo: '2026-07-02' },
  { id: 'TAR-003', titulo: 'Revisao do projeto estrutural — 8 pav.', descricao: 'Conferir compatibilidade entre projeto de estrutura e instalacoes hidraulicas do 8 pavimento.', obra: 'Edificio Horizonte', responsavel: 'Eng. Lucas Ramos', tipo: 'engenharia', prioridade: 'alta', status: 'em_andamento', prazo: '2026-07-03' },
  { id: 'TAR-004', titulo: 'Relatorio mensal de conformidade', descricao: 'Emitir relatorio de conformidade com NR-18 para o CREA. Prazo legal: dia 10.', obra: 'Todas', responsavel: 'Eng. Amanda Lima', tipo: 'administrativo', prioridade: 'media', status: 'a_fazer', prazo: '2026-07-10' },
  { id: 'TAR-005', titulo: 'Ensaio de abatimento (slump test)', descricao: 'Realizar ensaio de consistencia do concreto usinado antes da concretagem da laje.', obra: 'Residencial Bela Vista', responsavel: 'Laboratorio Teste', tipo: 'qualidade', prioridade: 'alta', status: 'revisao' },
  { id: 'TAR-006', titulo: 'Instalar sinalizacao de seguranca', descricao: 'Fixar placas de EPI obrigatorio, saidas de emergencia e areas de risco em todos os andares.', obra: 'Edificio Horizonte', responsavel: 'SESMT', tipo: 'seguranca', prioridade: 'media', status: 'concluido' },
  { id: 'TAR-007', titulo: 'Aprovacao de fachada com prefeitura', descricao: 'Protocolar projeto de fachada para aprovacao. Anexar ART do responsavel tecnico.', obra: 'Condominio Parque Sul', responsavel: 'Arq. Fernanda', tipo: 'administrativo', prioridade: 'baixa', status: 'revisao' },
  { id: 'TAR-008', titulo: 'Concretagem laje cobertura', descricao: 'Executar concretagem da laje de cobertura apos aprovacao do slump test.', obra: 'Residencial Bela Vista', responsavel: 'Mestre Carlos', tipo: 'engenharia', prioridade: 'alta', status: 'a_fazer', prazo: '2026-07-04' },
]

function QuadroTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>(initialTarefas)
  const [filtroTipo, setFiltroTipo] = useState<TarefaTipo | 'todos'>('todos')
  const [filtroObra, setFiltroObra] = useState('Todas')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newTarefa, setNewTarefa] = useState<Partial<Tarefa>>({
    tipo: 'engenharia', prioridade: 'media', status: 'a_fazer',
    obra: 'Residencial Bela Vista', responsavel: ''
  })

  const today = new Date().toISOString().split('T')[0]
  const isPrazoVencido = (t: Tarefa) => !!t.prazo && t.prazo < today && t.status !== 'concluido'

  const tarefasFiltradas = tarefas.filter(t => {
    const matchTipo = filtroTipo === 'todos' || t.tipo === filtroTipo
    const matchObra = filtroObra === 'Todas' || t.obra === filtroObra || t.obra === 'Todas'
    return matchTipo && matchObra
  })

  const moverTarefa = (id: string, dir: 'forward' | 'backward') => {
    const order: TarefaStatus[] = ['a_fazer', 'em_andamento', 'revisao', 'concluido']
    setTarefas(prev => prev.map(t => {
      if (t.id !== id) return t
      const idx = order.indexOf(t.status)
      const next = idx + (dir === 'forward' ? 1 : -1)
      if (next < 0 || next >= order.length) return t
      return { ...t, status: order[next] }
    }))
  }

  const criarTarefa = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTarefa.titulo?.trim()) return
    const id = `TAR-${String(tarefas.length + 1).padStart(3, '0')}`
    setTarefas(prev => [...prev, {
      id, titulo: newTarefa.titulo!, descricao: newTarefa.descricao || '',
      obra: newTarefa.obra!, responsavel: newTarefa.responsavel || 'Nao definido',
      tipo: newTarefa.tipo as TarefaTipo, prioridade: newTarefa.prioridade as any,
      status: 'a_fazer', prazo: newTarefa.prazo
    }])
    setIsAddOpen(false)
    setNewTarefa({ tipo: 'engenharia', prioridade: 'media', status: 'a_fazer', obra: 'Residencial Bela Vista', responsavel: '' })
    toast(`Tarefa "${newTarefa.titulo}" criada!`, 'success')
  }

  const obras = ['Todas', 'Residencial Bela Vista', 'Edificio Horizonte', 'Condominio Parque Sul']

  return (
    <Panel
      title="Quadro de Tarefas — Substituto do Trello"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro tipo */}
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}
            style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: '4px 8px', borderRadius: 2, fontSize: 10, color: C.inkSoft, outline: 'none' }}
          >
            <option value="todos">Todos os tipos</option>
            {(Object.keys(tipoConfig) as TarefaTipo[]).map(k => (
              <option key={k} value={k}>{tipoConfig[k].label}</option>
            ))}
          </select>
          {/* Filtro obra */}
          <select
            value={filtroObra}
            onChange={e => setFiltroObra(e.target.value)}
            style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: '4px 8px', borderRadius: 2, fontSize: 10, color: C.inkSoft, outline: 'none' }}
          >
            {obras.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setIsAddOpen(true)}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 2, background: C.amber, color: '#0B0C0E', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}
          >
            <Plus size={11} /> Nova Tarefa
          </motion.button>
        </div>
      }
    >
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {(Object.entries(tipoConfig) as [TarefaTipo, typeof tipoConfig[TarefaTipo]][]).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: C.inkSoft }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Kanban Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 10 }}>
        {colunasGeral.map(col => {
          const items = tarefasFiltradas.filter(t => t.status === col.id)
          return (
            <div key={col.id} style={{ background: '#0F1115', padding: 10, borderRadius: 2, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.label}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: col.color, background: `${col.color}18`, border: `1px solid ${col.color}33`, padding: '1px 5px', borderRadius: 2 }}>{items.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                {items.map(t => {
                  const tipo = tipoConfig[t.tipo]
                  const vencido = isPrazoVencido(t)
                  return (
                    <div key={t.id} style={{
                      padding: 10, background: C.bgCard, borderRadius: 2,
                      border: `1px solid ${vencido ? '#EF444466' : C.border}`,
                      boxShadow: vencido ? '0 0 0 1px #EF444422' : 'none',
                    }}>
                      {/* Tipo badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, fontWeight: 900, color: tipo.color, background: `${tipo.color}15`, border: `1px solid ${tipo.color}33`, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase' }}>
                          <tipo.Icon size={8} /> {tipo.label}
                        </div>
                        {vencido && (
                          <div style={{ fontSize: 8, fontWeight: 900, color: '#EF4444', background: '#EF444418', border: '1px solid #EF444444', padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase' }}>
                            Vencido
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.ink, lineHeight: 1.3, marginBottom: 5 }}>{t.titulo}</div>

                      {/* Meta */}
                      <div style={{ fontSize: 9.5, color: C.inkSoft, fontWeight: 700, marginBottom: 8 }}>
                        {t.obra !== 'Todas' ? t.obra.split(' ')[0] : 'Geral'} &middot; {t.responsavel.split(' ')[0]}
                        {t.prazo && <span style={{ marginLeft: 4, color: vencido ? '#EF4444' : C.inkSoft }}>&middot; {t.prazo}</span>}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}33`, paddingTop: 6 }}>
                        {t.status !== 'a_fazer' && (
                          <button onClick={() => moverTarefa(t.id, 'backward')} style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.inkSoft }}>
                            <ArrowLeft size={11} />
                          </button>
                        )}
                        {t.status !== 'concluido' && (
                          <button onClick={() => moverTarefa(t.id, 'forward')} style={{ all: 'unset', cursor: 'pointer', padding: 4, color: C.amber }}>
                            <ArrowRight size={11} />
                          </button>
                        )}
                        {t.status === 'concluido' && (
                          <span style={{ fontSize: 9, color: C.green, fontWeight: 900 }}>Concluido</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {items.length === 0 && (
                  <div style={{ padding: '30px 10px', textAlign: 'center', color: C.inkSoft, fontSize: 10, border: `1px dashed ${C.border}`, borderRadius: 2 }}>
                    Sem tarefas
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2, width: '100%', maxWidth: 460, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nova Tarefa</span>
                <button onClick={() => setIsAddOpen(false)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={16} /></button>
              </div>

              <form onSubmit={criarTarefa} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Titulo da Tarefa *</label>
                  <input required placeholder="Ex: Inspecao de andaimes" value={newTarefa.titulo || ''} onChange={e => setNewTarefa(p => ({ ...p, titulo: e.target.value }))}
                    style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: '8px 10px', borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }} />
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Descricao</label>
                  <textarea placeholder="Detalhes da tarefa..." value={newTarefa.descricao || ''} onChange={e => setNewTarefa(p => ({ ...p, descricao: e.target.value }))}
                    rows={2}
                    style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: '8px 10px', borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none', resize: 'vertical' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Tipo</label>
                    <select value={newTarefa.tipo} onChange={e => setNewTarefa(p => ({ ...p, tipo: e.target.value as any }))}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}>
                      {(Object.keys(tipoConfig) as TarefaTipo[]).map(k => <option key={k} value={k}>{tipoConfig[k].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prioridade</label>
                    <select value={newTarefa.prioridade} onChange={e => setNewTarefa(p => ({ ...p, prioridade: e.target.value as any }))}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}>
                      <option value="baixa">Baixa</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Obra</label>
                    <select value={newTarefa.obra} onChange={e => setNewTarefa(p => ({ ...p, obra: e.target.value }))}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }}>
                      {obras.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prazo</label>
                    <input type="date" value={newTarefa.prazo || ''} onChange={e => setNewTarefa(p => ({ ...p, prazo: e.target.value }))}
                      style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 8, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Responsavel</label>
                  <input placeholder="Ex: Eng. Carlos Eduardo" value={newTarefa.responsavel || ''} onChange={e => setNewTarefa(p => ({ ...p, responsavel: e.target.value }))}
                    style={{ width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: '8px 10px', borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" onClick={() => setIsAddOpen(false)}
                    style={{ background: 'none', border: `1px solid ${C.border}`, color: C.inkSoft, fontSize: 10, fontWeight: 800, padding: '8px 14px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}>
                    Cancelar
                  </button>
                  <button type="submit"
                    style={{ background: C.amber, border: 'none', color: '#0B0C0E', fontSize: 10, fontWeight: 900, padding: '8px 18px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}>
                    Criar Tarefa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
