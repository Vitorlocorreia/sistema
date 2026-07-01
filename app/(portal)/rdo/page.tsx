'use client'

import { useState } from 'react'
import { 
  Plus, FileText, Calendar, Building, Sun, CloudRain, Cloud, 
  UserCheck, AlertTriangle, Hammer, CheckCircle2, FileUp, 
  Search, X, Check, Eye, Printer, Award, Clock, Sparkles
} from 'lucide-react'
import { Panel } from '@/components/Panel'
import { PageTitle } from '@/components/PageTitle'
import { StatusBadge } from '@/components/StatusBadge'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { motion, AnimatePresence } from 'motion/react'

// Rich Mock Data for Enterprise RDOs
interface RdoData {
  id: string
  obra: string
  data: string
  responsavel: string
  cargo: string
  climaManha: 'ensolarado' | 'nublado' | 'chuvoso'
  climaTarde: 'ensolarado' | 'nublado' | 'chuvoso'
  condicaoSolo: 'trabalhavel' | 'impeditivo'
  efetivoProprio: number
  efetivoTerceirizado: number
  equipamentos: { nome: string; quantidade: number; status: 'operando' | 'parado' }[]
  atividades: string[]
  ocorrencias: string
  resumo: string
  status: 'rascunho' | 'aprovado'
  assinaturaDigital?: {
    responsavel: string
    ip: string
    timestamp: string
  }
}

const initialRdos: RdoData[] = [
  {
    id: 'RDO-2026-001',
    obra: 'Residencial Bela Vista',
    data: '2026-06-30',
    responsavel: 'Eng. Carlos Eduardo',
    cargo: 'Gerente de Obra / CREA-SP 129481',
    climaManha: 'ensolarado',
    climaTarde: 'nublado',
    condicaoSolo: 'trabalhavel',
    efetivoProprio: 12,
    efetivoTerceirizado: 8,
    equipamentos: [
      { nome: 'Grua Torre A', quantidade: 1, status: 'operando' },
      { nome: 'Betoneira 400L', quantidade: 2, status: 'operando' },
      { nome: 'Minicarregadeira', quantidade: 1, status: 'parado' }
    ],
    atividades: [
      'Concretagem da laje de cobertura do Bloco B - Volume total: 45m³.',
      'Instalação de tubulações hidráulicas nos banheiros do 3º pavimento.',
      'Início do reboco interno nos apartamentos finais 1 e 2.'
    ],
    ocorrencias: 'A minicarregadeira apresentou falha na bomba de combustível às 11:30. Manutenção programada acionada para amanhã cedo.',
    resumo: 'Concretagem do bloco B finalizada. Clima firme na maior parte do dia. 20 colaboradores em campo.',
    status: 'aprovado',
    assinaturaDigital: {
      responsavel: 'Eng. Carlos Eduardo',
      ip: '177.85.122.9',
      timestamp: '2026-06-30 18:15:22'
    }
  },
  {
    id: 'RDO-2026-002',
    obra: 'Edifício Horizonte',
    data: '2026-06-29',
    responsavel: 'Mestre João Pedro',
    cargo: 'Supervisor Geral de Obra',
    climaManha: 'chuvoso',
    climaTarde: 'chuvoso',
    condicaoSolo: 'impeditivo',
    efetivoProprio: 6,
    efetivoTerceirizado: 15,
    equipamentos: [
      { nome: 'Escavadeira Hidráulica', quantidade: 1, status: 'parado' },
      { nome: 'Caminhão Caçamba', quantidade: 2, status: 'parado' }
    ],
    atividades: [
      'Serviços internos de montagem de fôrmas do 8º pavimento.',
      'Passagem de fiação elétrica nas prumadas principais.'
    ],
    ocorrencias: 'Chuvas fortes ininterruptas impediram os serviços de movimentação de terra e concretagem das sapatas. Solo lamacento e inseguro para maquinário pesado.',
    resumo: 'Atraso na entrega de aço e chuvas intensas. Estrutura do 8º pavimento aguardando melhoria climática.',
    status: 'rascunho'
  },
  {
    id: 'RDO-2026-003',
    obra: 'Condomínio Parque Sul',
    data: '2026-06-29',
    responsavel: 'Engª. Amanda Lima',
    cargo: 'Engenheira de Segurança / CREA-PR 94812',
    climaManha: 'ensolarado',
    climaTarde: 'ensolarado',
    condicaoSolo: 'trabalhavel',
    efetivoProprio: 18,
    efetivoTerceirizado: 12,
    equipamentos: [
      { nome: 'Plataforma Elevatória (Pillar)', quantidade: 2, status: 'operando' },
      { nome: 'Gerador 150kVA', quantidade: 1, status: 'operando' }
    ],
    atividades: [
      'Aplicação de textura acrílica na fachada externa norte.',
      'Instalação de esquadrias de alumínio nas janelas do bloco C.',
      'Limpeza pós-obra das áreas comuns entregues.'
    ],
    ocorrencias: 'Nenhuma intercorrência operacional ou de segurança do trabalho registrada hoje.',
    resumo: 'Início do acabamento da fachada lateral. Condições climáticas favoráveis. Sem intercorrências.',
    status: 'aprovado',
    assinaturaDigital: {
      responsavel: 'Engª. Amanda Lima',
      ip: '186.220.10.45',
      timestamp: '2026-06-29 17:45:00'
    }
  }
]

export default function RDO() {
  const [rdos, setRdos] = useState<RdoData[]>(initialRdos)
  const [selectedRdo, setSelectedRdo] = useState<RdoData | null>(initialRdos[0])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formTab, setFormTab] = useState<'geral' | 'recursos' | 'atividades'>('geral')

  // Search/Filter states
  const [search, setSearch] = useState('')
  const [filterObra, setFilterObra] = useState('Todas')
  const [filterStatus, setFilterStatus] = useState('Todos')

  // Form states
  const [newRdo, setNewRdo] = useState<Partial<RdoData>>({
    obra: 'Residencial Bela Vista',
    data: new Date().toISOString().split('T')[0],
    responsavel: 'Eng. Visitante',
    cargo: 'Gestor Corporativo / CREA-SP 999999',
    climaManha: 'ensolarado',
    climaTarde: 'ensolarado',
    condicaoSolo: 'trabalhavel',
    efetivoProprio: 10,
    efetivoTerceirizado: 5,
    equipamentos: [
      { nome: 'Retroescavadeira', quantidade: 1, status: 'operando' },
      { nome: 'Betoneira', quantidade: 1, status: 'operando' }
    ],
    atividades: [''],
    ocorrencias: '',
    resumo: '',
    status: 'rascunho'
  })

  // Filter logic
  const filteredRdos = rdos.filter(r => {
    const matchesSearch = r.responsavel.toLowerCase().includes(search.toLowerCase()) || 
                          r.resumo.toLowerCase().includes(search.toLowerCase()) ||
                          r.id.toLowerCase().includes(search.toLowerCase())
    const matchesObra = filterObra === 'Todas' || r.obra === filterObra
    const matchesStatus = filterStatus === 'Todos' || r.status === filterStatus
    return matchesSearch && matchesObra && matchesStatus
  })

  // Unique Obras list for filters
  const uniqueObras = ['Todas', 'Residencial Bela Vista', 'Edifício Horizonte', 'Condomínio Parque Sul']

  // Weather icon selector
  const getWeatherIcon = (weather: 'ensolarado' | 'nublado' | 'chuvoso') => {
    switch (weather) {
      case 'ensolarado': return <Sun size={16} color={C.amber} />
      case 'nublado': return <Cloud size={16} color={C.inkSoft} />
      case 'chuvoso': return <CloudRain size={16} color="#3B82F6" />
    }
  }

  // Handle adding an activity field in the form
  const addActivityField = () => {
    setNewRdo(prev => ({
      ...prev,
      atividades: [...(prev.atividades || []), '']
    }))
  }

  // Handle changing an activity field
  const handleActivityChange = (index: number, value: string) => {
    const nextActivities = [...(newRdo.atividades || [])]
    nextActivities[index] = value
    setNewRdo(prev => ({ ...prev, atividades: nextActivities }))
  }

  // Handle submitting the form
  const handleCreateRdo = (e: React.FormEvent) => {
    e.preventDefault()
    
    const id = `RDO-2026-0${rdos.length + 1}`
    const rdoToSave: RdoData = {
      id,
      obra: newRdo.obra || 'Residencial Bela Vista',
      data: newRdo.data || new Date().toISOString().split('T')[0],
      responsavel: newRdo.responsavel || 'Eng. Convidado',
      cargo: newRdo.cargo || 'Gestor Corporativo',
      climaManha: newRdo.climaManha as any,
      climaTarde: newRdo.climaTarde as any,
      condicaoSolo: newRdo.condicaoSolo as any,
      efetivoProprio: Number(newRdo.efetivoProprio) || 0,
      efetivoTerceirizado: Number(newRdo.efetivoTerceirizado) || 0,
      equipamentos: newRdo.equipamentos || [],
      atividades: (newRdo.atividades || []).filter(act => act.trim() !== ''),
      ocorrencias: newRdo.ocorrencias || 'Nenhuma ocorrência registrada.',
      resumo: newRdo.resumo || 'Diário de obra preenchido com sucesso.',
      status: newRdo.status as any
    }

    setRdos(prev => [rdoToSave, ...prev])
    setSelectedRdo(rdoToSave)
    setIsCreateOpen(false)
    
    // Reset form
    setNewRdo({
      obra: 'Residencial Bela Vista',
      data: new Date().toISOString().split('T')[0],
      responsavel: 'Eng. Visitante',
      cargo: 'Gestor Corporativo / CREA-SP 999999',
      climaManha: 'ensolarado',
      climaTarde: 'ensolarado',
      condicaoSolo: 'trabalhavel',
      efetivoProprio: 10,
      efetivoTerceirizado: 5,
      equipamentos: [
        { nome: 'Retroescavadeira', quantidade: 1, status: 'operando' },
        { nome: 'Betoneira', quantidade: 1, status: 'operando' }
      ],
      atividades: [''],
      ocorrencias: '',
      resumo: '',
      status: 'rascunho'
    })
  }

  // Simulate digital signature
  const handleSignDigital = (id: string) => {
    setRdos(prev => prev.map(r => {
      if (r.id === id) {
        const signed: RdoData = {
          ...r,
          status: 'aprovado',
          assinaturaDigital: {
            responsavel: r.responsavel,
            ip: '192.168.10.12',
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
          }
        }
        if (selectedRdo?.id === id) setSelectedRdo(signed)
        return signed
      }
      return r
    }))
    toast('Diario de Obra assinado digitalmente com sucesso!', 'success')
  }

  // Export via browser print
  const handleExportPdf = (rdo: RdoData) => {
    toast(`Abrindo impressao para ${rdo.id}...`, 'info')
    setTimeout(() => window.print(), 400)
  }

  // Badge: RDO criado nas ultimas 24h
  const isNew = (data: string) => {
    const rdoDate = new Date(data).getTime()
    return Date.now() - rdoDate < 86400000
  }

  // KPI summary values
  const totalRdos = rdos.length
  const aprovados = rdos.filter(r => r.status === 'aprovado').length
  const rascunhos = rdos.filter(r => r.status === 'rascunho').length
  const aguardandoAssinatura = rdos.filter(r => r.status === 'rascunho').length

  return (
    <>
      <PageTitle modulo="Corporativo" titulo="Diario de Obra (RDO)" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total no Mes', value: totalRdos, color: C.inkSoft },
          { label: 'Aprovados', value: aprovados, color: C.green },
          { label: 'Rascunhos', value: rascunhos, color: C.amber },
          { label: 'Aguardando Assinatura', value: aguardandoAssinatura, color: '#3B82F6' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: C.bgPanel, border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color, fontFamily: 'var(--font-display)' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        
        {/* Left Side: Filter Panel and List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Action Button */}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreateOpen(true)}
            style={{ 
              all: 'unset',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 8, 
              fontSize: 12, 
              fontWeight: 900, 
              color: '#0B0C0E', 
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              background: C.amber,
              padding: '12px 16px',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Plus size={16} /> Criar Novo RDO
          </motion.button>

          {/* Filters card */}
          <div style={{ 
            background: C.bgPanel, 
            border: `1px solid ${C.border}`, 
            padding: 16, 
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Buscar RDO..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  padding: '8px 12px 8px 30px',
                  borderRadius: 2,
                  fontSize: 12,
                  color: C.ink,
                  outline: 'none',
                }}
              />
            </div>

            {/* Obra Filter */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Obra</label>
              <select 
                value={filterObra}
                onChange={e => setFilterObra(e.target.value)}
                style={{
                  width: '100%',
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  padding: 8,
                  borderRadius: 2,
                  fontSize: 12,
                  color: C.ink,
                  outline: 'none',
                }}
              >
                {uniqueObras.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  padding: 8,
                  borderRadius: 2,
                  fontSize: 12,
                  color: C.ink,
                  outline: 'none',
                }}
              >
                <option value="Todos">Todos</option>
                <option value="aprovado">Aprovados</option>
                <option value="rascunho">Rascunhos</option>
              </select>
            </div>
          </div>

          {/* RDOs List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', paddingLeft: 4 }}>
              Registros Encontrados ({filteredRdos.length})
            </div>
            
            {filteredRdos.map((r) => (
              <div 
                key={r.id} 
                onClick={() => setSelectedRdo(r)}
                style={{ 
                  padding: '12px 16px', 
                  background: selectedRdo?.id === r.id ? `${C.amber}11` : C.bgPanel, 
                  borderRadius: 2, 
                  border: `1px solid ${selectedRdo?.id === r.id ? C.amber : C.border}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: C.inkSoft }}>{r.id}</span>
                    {isNew(r.data) && (
                      <span style={{
                        fontSize: 8, fontWeight: 900, color: C.green,
                        background: `${C.green}18`, border: `1px solid ${C.green}33`,
                        padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase'
                      }}>Novo</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 2,
                    background: r.status === 'aprovado' ? `${C.green}22` : `${C.amber}22`,
                    color: r.status === 'aprovado' ? C.green : C.amber,
                    border: `1px solid ${r.status === 'aprovado' ? C.green : C.amber}44`,
                  }}>
                    {r.status === 'aprovado' ? 'APROVADO' : 'RASCUNHO'}
                  </span>
                </div>

                <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
                  {r.obra}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: C.inkSoft }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} />
                    <span>{r.data}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getWeatherIcon(r.climaManha)}
                    {getWeatherIcon(r.climaTarde)}
                  </div>
                </div>
              </div>
            ))}

            {filteredRdos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2, color: C.inkSoft, fontSize: 12 }}>
                Nenhum diário encontrado.
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Detailed Technical Panel View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedRdo ? (
            <div style={{ 
              background: C.bgPanel, 
              border: `1px solid ${C.border}`, 
              borderRadius: 2, 
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}>
              {/* Header */}
              <div 
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4"
                style={{ borderBottom: `1px solid ${C.border}` }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <FileText size={18} color={C.amber} />
                    <span style={{ fontSize: 16, fontWeight: 900, color: C.ink, fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                      RELATÓRIO DIÁRIO DE OBRA ({selectedRdo.id})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
                    Responsável: <span style={{ color: C.ink }}>{selectedRdo.responsavel}</span> ({selectedRdo.cargo})
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleExportPdf(selectedRdo)}
                    style={{
                      background: C.bgCard,
                      border: `1px solid ${C.border}`,
                      color: C.ink,
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '8px 12px',
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    <Printer size={12} /> Exportar PDF
                  </motion.button>

                  {selectedRdo.status === 'rascunho' && (
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSignDigital(selectedRdo.id)}
                      style={{
                        background: C.green,
                        border: 'none',
                        color: '#0B0C0E',
                        fontSize: 11,
                        fontWeight: 900,
                        padding: '8px 14px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        textTransform: 'uppercase',
                      }}
                    >
                      <Award size={12} /> Assinar Digitalmente
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Grid Geral (Obra, Data, Clima, Condição Solo) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: '12px 14px', borderRadius: 2 }}>
                  <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Obra Atribuída</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{selectedRdo.obra}</div>
                </div>

                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: '12px 14px', borderRadius: 2 }}>
                  <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Data Operacional</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{selectedRdo.data}</div>
                </div>

                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: '12px 14px', borderRadius: 2 }}>
                  <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Clima (Manhã / Tarde)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink, fontWeight: 700 }}>
                      {getWeatherIcon(selectedRdo.climaManha)}
                      <span style={{ textTransform: 'capitalize' }}>{selectedRdo.climaManha}</span>
                    </div>
                    <span style={{ color: C.border }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink, fontWeight: 700 }}>
                      {getWeatherIcon(selectedRdo.climaTarde)}
                      <span style={{ textTransform: 'capitalize' }}>{selectedRdo.climaTarde}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: '12px 14px', borderRadius: 2 }}>
                  <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Condição do Solo</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ 
                      width: 6, height: 6, borderRadius: '50%', 
                      background: selectedRdo.condicaoSolo === 'trabalhavel' ? C.green : C.red 
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: selectedRdo.condicaoSolo === 'trabalhavel' ? C.green : C.red }}>
                      {selectedRdo.condicaoSolo}
                    </span>
                  </div>
                </div>

              </div>

              {/* Atividades Executadas */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.ink, textTransform: 'uppercase', borderLeft: `2px solid ${C.amber}`, paddingLeft: 8, marginBottom: 12 }}>
                  Atividades Executadas no Dia
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 10 }}>
                  {selectedRdo.atividades.map((atividade, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: C.amber, fontWeight: 900, fontSize: 13, lineHeight: 1 }}>•</span>
                      <span style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{atividade}</span>
                    </div>
                  ))}
                  {selectedRdo.atividades.length === 0 && (
                    <span style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic' }}>Nenhuma atividade descrita.</span>
                  )}
                </div>
              </div>

              {/* Mão de Obra e Equipamentos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* Mão de Obra / Efetivo */}
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <UserCheck size={14} color={C.amber} />
                    <span style={{ fontSize: 11, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>Efetivo Total em Campo</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ textAlign: 'center', background: C.bgPanel, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: C.ink }}>{selectedRdo.efetivoProprio}</div>
                      <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Equipe Própria</div>
                    </div>
                    <div style={{ textAlign: 'center', background: C.bgPanel, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: C.ink }}>{selectedRdo.efetivoTerceirizado}</div>
                      <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Terceirizados</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: 800, color: C.inkSoft }}>
                    Total Geral: <span style={{ color: C.amber }}>{selectedRdo.efetivoProprio + selectedRdo.efetivoTerceirizado}</span> colaboradores
                  </div>
                </div>

                {/* Equipamentos */}
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Hammer size={14} color={C.amber} />
                    <span style={{ fontSize: 11, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>Controle de Equipamentos</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedRdo.equipamentos.map((eq, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 6, fontSize: 11 }}>
                        <span style={{ color: C.ink, fontWeight: 700 }}>{eq.nome} ({eq.quantidade} un)</span>
                        <span style={{ 
                          fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                          color: eq.status === 'operando' ? C.green : C.red,
                          background: eq.status === 'operando' ? `${C.green}22` : `${C.red}22`,
                          padding: '2px 6px', borderRadius: 2, border: `1px solid ${eq.status === 'operando' ? C.green : C.red}44`
                        }}>
                          {eq.status}
                        </span>
                      </div>
                    ))}
                    {selectedRdo.equipamentos.length === 0 && (
                      <span style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic' }}>Nenhum equipamento registrado hoje.</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Ocorrências */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.ink, textTransform: 'uppercase', borderLeft: `2px solid ${C.red}`, paddingLeft: 8, marginBottom: 10 }}>
                  Ocorrências / Anotações
                </div>
                <div style={{ background: `${C.bgCard}`, border: `1px solid ${C.border}`, padding: 16, borderRadius: 2, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} color={selectedRdo.ocorrencias.includes('Nenhuma') ? C.inkSoft : C.red} style={{ marginTop: 2 }} />
                  <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: 0 }}>
                    {selectedRdo.ocorrencias}
                  </p>
                </div>
              </div>

              {/* Assinatura Digital Stamp */}
              {selectedRdo.assinaturaDigital && (
                <div style={{ 
                  marginTop: 10,
                  alignSelf: 'flex-end',
                  border: `2px dashed ${C.green}`,
                  padding: '10px 18px',
                  borderRadius: 2,
                  background: `${C.green}08`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ background: C.greenDim, borderRadius: 2, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} color={C.green} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assinado Eletronicamente</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{selectedRdo.assinaturaDigital.responsavel}</div>
                    <div style={{ fontSize: 9, color: C.inkSoft }}>IP: {selectedRdo.assinaturaDigital.ip} · {selectedRdo.assinaturaDigital.timestamp}</div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 80, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2, color: C.inkSoft }}>
              Selecione um relatório na lista para visualizar o diário detalhado.
            </div>
          )}
        </div>

      </div>

      {/* New RDO Modal Overlay */}
      <AnimatePresence>
        {isCreateOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 2,
                width: '100%',
                maxWidth: 680,
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building size={16} color={C.amber} />
                  <span style={{ fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>Novo Registro Diário de Obra</span>
                </div>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgCard }}>
                {(['geral', 'recursos', 'atividades'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFormTab(tab)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: formTab === tab ? `2px solid ${C.amber}` : 'none',
                      color: formTab === tab ? C.ink : C.inkSoft,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {tab === 'geral' ? '1. Geral & Clima' : tab === 'recursos' ? '2. Efetivo & Equipamento' : '3. Atividades & Notas'}
                  </button>
                ))}
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateRdo} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                
                {/* Form Body Container */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* TAB 1: GERAL */}
                  {formTab === 'geral' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Obra</label>
                          <select 
                            value={newRdo.obra}
                            onChange={e => setNewRdo(prev => ({ ...prev, obra: e.target.value }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          >
                            <option value="Residencial Bela Vista">Residencial Bela Vista</option>
                            <option value="Edifício Horizonte">Edifício Horizonte</option>
                            <option value="Condomínio Parque Sul">Condomínio Parque Sul</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Data</label>
                          <input 
                            type="date" 
                            value={newRdo.data}
                            onChange={e => setNewRdo(prev => ({ ...prev, data: e.target.value }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Responsável Técnico</label>
                          <input 
                            type="text" 
                            required
                            value={newRdo.responsavel}
                            onChange={e => setNewRdo(prev => ({ ...prev, responsavel: e.target.value }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Cargo / Registro</label>
                          <input 
                            type="text" 
                            required
                            value={newRdo.cargo}
                            onChange={e => setNewRdo(prev => ({ ...prev, cargo: e.target.value }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Clima Manhã</label>
                          <select 
                            value={newRdo.climaManha}
                            onChange={e => setNewRdo(prev => ({ ...prev, climaManha: e.target.value as any }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          >
                            <option value="ensolarado">☀️ Ensolarado</option>
                            <option value="nublado">☁️ Nublado</option>
                            <option value="chuvoso">🌧️ Chuvoso</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Clima Tarde</label>
                          <select 
                            value={newRdo.climaTarde}
                            onChange={e => setNewRdo(prev => ({ ...prev, climaTarde: e.target.value as any }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          >
                            <option value="ensolarado">☀️ Ensolarado</option>
                            <option value="nublado">☁️ Nublado</option>
                            <option value="chuvoso">🌧️ Chuvoso</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Condição do Solo</label>
                          <select 
                            value={newRdo.condicaoSolo}
                            onChange={e => setNewRdo(prev => ({ ...prev, condicaoSolo: e.target.value as any }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          >
                            <option value="trabalhavel">Trabalhável</option>
                            <option value="impeditivo">Impeditivo</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* TAB 2: RECURSOS */}
                  {formTab === 'recursos' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Efetivo Próprio (Campo)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={newRdo.efetivoProprio}
                            onChange={e => setNewRdo(prev => ({ ...prev, efetivoProprio: Number(e.target.value) }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Efetivo Terceirizado</label>
                          <input 
                            type="number" 
                            min="0"
                            value={newRdo.efetivoTerceirizado}
                            onChange={e => setNewRdo(prev => ({ ...prev, efetivoTerceirizado: Number(e.target.value) }))}
                            style={{
                              width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Equipamentos Mapeados</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {newRdo.equipamentos?.map((eq, index) => (
                            <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: C.ink, width: 140, fontWeight: 800 }}>{eq.nome}</span>
                              <input 
                                type="number" 
                                min="0" 
                                value={eq.quantidade}
                                onChange={e => {
                                  const nextEqs = [...(newRdo.equipamentos || [])]
                                  nextEqs[index].quantidade = Number(e.target.value)
                                  setNewRdo(prev => ({ ...prev, equipamentos: nextEqs }))
                                }}
                                style={{
                                  width: 60, background: C.bgCard, border: `1px solid ${C.border}`, padding: '6px 8px', borderRadius: 2, fontSize: 12, color: C.ink
                                }}
                              />
                              <select 
                                value={eq.status}
                                onChange={e => {
                                  const nextEqs = [...(newRdo.equipamentos || [])]
                                  nextEqs[index].status = e.target.value as any
                                  setNewRdo(prev => ({ ...prev, equipamentos: nextEqs }))
                                }}
                                style={{
                                  background: C.bgCard, border: `1px solid ${C.border}`, padding: 6, borderRadius: 2, fontSize: 12, color: C.ink
                                }}
                              >
                                <option value="operando">Operando</option>
                                <option value="parado">Parado</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* TAB 3: ATIVIDADES & NOTAS */}
                  {formTab === 'atividades' && (
                    <>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase' }}>Atividades do Dia</label>
                          <button 
                            type="button"
                            onClick={addActivityField}
                            style={{ background: 'none', border: 'none', color: C.amber, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            + Adicionar Linha
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {newRdo.atividades?.map((act, index) => (
                            <input 
                              key={index}
                              type="text"
                              placeholder={`Atividade #${index + 1}`}
                              value={act}
                              onChange={e => handleActivityChange(index, e.target.value)}
                              style={{
                                width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Ocorrências relevantes ou acidentes</label>
                        <textarea 
                          placeholder="Informe se houve quebra de equipamentos, acidentes, chuvas ou atrasos..."
                          value={newRdo.ocorrencias}
                          onChange={e => setNewRdo(prev => ({ ...prev, ocorrencias: e.target.value }))}
                          rows={3}
                          style={{
                            width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none', resize: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 10, fontWeight: 850, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Resumo do Dia (Será exibido na listagem externa)</label>
                        <input 
                          type="text"
                          required
                          placeholder="Ex: Alvenaria do Bloco B adiantada. Clima seco."
                          value={newRdo.resumo}
                          onChange={e => setNewRdo(prev => ({ ...prev, resumo: e.target.value }))}
                          style={{
                            width: '100%', background: C.bgCard, border: `1px solid ${C.border}`, padding: 10, borderRadius: 2, fontSize: 12, color: C.ink, outline: 'none'
                          }}
                        />
                      </div>
                    </>
                  )}

                </div>

                {/* Modal Footer */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '16px 24px', borderTop: `1px solid ${C.border}`, background: C.bgCard }}>
                  <button 
                    type="button" 
                    onClick={() => setIsCreateOpen(false)}
                    style={{
                      background: 'none', border: `1px solid ${C.border}`, color: C.ink, fontSize: 11, fontWeight: 800, padding: '8px 16px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase'
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    style={{
                      background: C.amber, border: 'none', color: '#0B0C0E', fontSize: 11, fontWeight: 900, padding: '8px 20px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase'
                    }}
                  >
                    Salvar Rascunho
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
