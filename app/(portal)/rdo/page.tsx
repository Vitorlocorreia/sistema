'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, FileText, Calendar, Building, Sun, CloudRain, Cloud,
  UserCheck, AlertTriangle, Hammer, CheckCircle2, FileUp,
  Search, X, Check, Eye, Printer, Award, Clock, Trash2
} from 'lucide-react'
import { Panel } from '@/components/Panel'
import { PageTitle } from '@/components/PageTitle'
import { StatusBadge } from '@/components/StatusBadge'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'motion/react'
import type { Obra, Rdo, RdoCompleto } from '@/lib/types'

type EfetivoTerceiroForm = { empresa_nome: string; funcao: string; quantidade: string; observacoes: string; valor_diaria: string }
type PlanejadoExecutadoForm = { servico: string; unidade: string; planejada: string; executada: string; observacoes: string }

// ─── STYLES ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: '#0B0C0E',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.ink,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: C.inkSoft,
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 4,
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function RDO() {
  const [rdos, setRdos] = useState<RdoCompleto[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [selectedRdo, setSelectedRdo] = useState<RdoCompleto | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formTab, setFormTab] = useState<'geral' | 'recursos' | 'atividades'>('geral')
  const [loading, setLoading] = useState(true)

  // Search/Filter & Selection states
  const [search, setSearch] = useState('')
  const [filterObra, setFilterObra] = useState('Todas')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [selectedRdoIds, setSelectedRdoIds] = useState<string[]>([])
  const [overridePrintRdos, setOverridePrintRdos] = useState<RdoCompleto[] | null>(null)

  // Form states
  const [newObraId, setNewObraId] = useState('')
  const [newData, setNewData] = useState(new Date().toISOString().split('T')[0])
  const [newResponsavel, setNewResponsavel] = useState('')
  const [newCargo, setNewCargo] = useState('')
  const [colaboradorAtivo, setColaboradorAtivo] = useState<any>(null)
  const [newCrea, setNewCrea] = useState('CREA-SP 999999')
  const [newClimaManha, setNewClimaManha] = useState('Sol')
  const [newClimaTarde, setNewClimaTarde] = useState('Sol')
  const [newCondicaoSolo, setNewCondicaoSolo] = useState('Seco')
  const [newEfetivoProprio, setNewEfetivoProprio] = useState('10')
  const [newEfetivoTerceiros, setNewEfetivoTerceiros] = useState('5')
  const [newTerceiros, setNewTerceiros] = useState<EfetivoTerceiroForm[]>([{ empresa_nome: '', funcao: '', quantidade: '1', observacoes: '', valor_diaria: '' }])
  const [newPlanejadoExecutado, setNewPlanejadoExecutado] = useState<PlanejadoExecutadoForm[]>([{ servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])
  const [newResumo, setNewResumo] = useState('')
  const [newOcorrencias, setNewOcorrencias] = useState('')
  const [newDefinicaoServico, setNewDefinicaoServico] = useState('')
  const [newLiberacoes, setNewLiberacoes] = useState('')
  const [newFotos, setNewFotos] = useState<File[]>([])

  // Equipments state in form
  const [equipForm, setEquipForm] = useState<{ nome: string; status: 'OPERANDO' | 'PARADO' | 'MANUTENÇÃO' }[]>([
    { nome: 'Retroescavadeira', status: 'OPERANDO' },
    { nome: 'Betoneira', status: 'OPERANDO' }
  ])

  // Activities state in form
  const [actForm, setActForm] = useState<string[]>([''])

  const loadData = useCallback(async () => {
    setLoading(true)
    const session = localStorage.getItem('colaborador_sessao')
    let colab = null
    try { 
      colab = session ? JSON.parse(session) : null
      if (colab) {
        setColaboradorAtivo(colab)
        if (!newResponsavel) setNewResponsavel(colab.nome || '')
        if (!newCargo) setNewCargo(colab.cargo || '')
      }
    } catch { }

    const [
      { data: r },
      { data: o }
    ] = await Promise.all([
      supabase.from('rdos').select('*, obra:obras(nome), atividades:rdo_atividades(*), equipamentos:rdo_equipamentos(*), terceiros:rdo_efetivos_terceiros(*), planejado_executado:rdo_planejado_executado(*), fotos(*)').order('data', { ascending: false }),
      supabase.from('obras').select('*').order('nome')
    ])

    const rdosList = (r as RdoCompleto[]) ?? []
    setRdos(rdosList)
    setObras(o ?? [])

    if (o && o.length > 0) {
      setNewObraId(prev => prev || o[0].id)
    }

    if (rdosList.length > 0) {
      setSelectedRdo(prev => prev || rdosList[0])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredRdos = useMemo(() => {
    return rdos.filter(r => {
      const matchesSearch =
        r.responsavel.toLowerCase().includes(search.toLowerCase()) ||
        (r.resumo ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesObra = filterObra === 'Todas' || r.obra?.nome === filterObra
      const matchesStatus = filterStatus === 'Todos' || r.status === filterStatus
      return matchesSearch && matchesObra && matchesStatus
    })
  }, [rdos, search, filterObra, filterStatus])

  const toggleSelectRdo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRdoIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAllFiltered = () => {
    if (selectedRdoIds.length === filteredRdos.length && filteredRdos.length > 0) {
      setSelectedRdoIds([])
    } else {
      setSelectedRdoIds(filteredRdos.map(r => r.id))
    }
  }

  const rdosToPrint = useMemo(() => {
    if (overridePrintRdos) return overridePrintRdos
    if (selectedRdoIds.length > 0) return rdos.filter(r => selectedRdoIds.includes(r.id))
    return selectedRdo ? [selectedRdo] : []
  }, [overridePrintRdos, selectedRdoIds, rdos, selectedRdo])

  const triggerPrintSingle = (rdo: RdoCompleto) => {
    setOverridePrintRdos([rdo])
    setTimeout(() => {
      window.print()
      setOverridePrintRdos(null)
    }, 50)
  }

  const triggerPrintBatch = () => {
    setOverridePrintRdos(null)
    setTimeout(() => {
      window.print()
    }, 50)
  }

  const getWeatherIcon = (weather: string) => {
    switch (weather.toLowerCase()) {
      case 'sol':
      case 'ensolarado':
        return <Sun size={16} color={C.amber} />
      case 'chuva':
      case 'chuvoso':
        return <CloudRain size={16} color="#3B82F6" />
      default:
        return <Cloud size={16} color={C.inkSoft} />
    }
  }

  const handleCreateRdo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newObraId || !newResponsavel) return

    // 1. Insert RDO
    const { data: rdoData, error: rdoErr } = await supabase.from('rdos').insert({
      obra_id: newObraId,
      data: newData,
      responsavel: newResponsavel,
      cargo: newCargo,
      crea: newCrea,
      clima_manha: newClimaManha,
      clima_tarde: newClimaTarde,
      condicao_solo: newCondicaoSolo,
      efetivo_proprio: parseInt(newEfetivoProprio) || 0,
      efetivo_terceiros: parseInt(newEfetivoTerceiros) || 0,
      status: 'Rascunho',
      resumo: newResumo || `Diário preenchido por ${newResponsavel}.`,
      ocorrencias: newOcorrencias || null,
      definicao_servico: newDefinicaoServico || null,
      liberacoes: newLiberacoes || null
    }).select().single()

    if (rdoErr || !rdoData) {
      toast('Erro ao criar diário de obra', 'error')
      return
    }

    // 2. Insert activities
    const validActivities = actForm.filter(a => a.trim() !== '')
    if (validActivities.length > 0) {
      await supabase.from('rdo_atividades').insert(
        validActivities.map(desc => ({ rdo_id: rdoData.id, descricao: desc }))
      )
    }

    // 3. Insert equipments
    const validEquips = equipForm.filter(eq => eq.nome.trim() !== '')
    if (validEquips.length > 0) {
      await supabase.from('rdo_equipamentos').insert(
        validEquips.map(eq => ({ rdo_id: rdoData.id, nome: eq.nome, status: eq.status }))
      )
    }

    const validTerceiros = newTerceiros.filter(item => item.empresa_nome.trim() !== '')
    if (validTerceiros.length > 0) {
      await supabase.from('rdo_efetivos_terceiros').insert(validTerceiros.map(item => ({
        rdo_id: rdoData.id,
        empresa_nome: item.empresa_nome.trim(),
        funcao: item.funcao.trim() || null,
        quantidade: parseInt(item.quantidade) || 1,
        observacoes: item.observacoes.trim() || null,
        valor_diaria: item.valor_diaria ? parseFloat(item.valor_diaria) : null,
        pagamento_status: 'pendente',
      })))
    }

    const validPlanejamento = newPlanejadoExecutado.filter(item => item.servico.trim() !== '')
    if (validPlanejamento.length > 0) {
      await supabase.from('rdo_planejado_executado').insert(validPlanejamento.map(item => ({
        rdo_id: rdoData.id,
        servico: item.servico.trim(),
        unidade: item.unidade.trim() || null,
        quantidade_planejada: parseFloat(item.planejada) || 0,
        quantidade_executada: parseFloat(item.executada) || 0,
        observacoes: item.observacoes.trim() || null,
      })))
    }

    for (const foto of newFotos) {
      const path = `${newObraId}/${rdoData.id}/${crypto.randomUUID()}-${foto.name}`
      const { error: uploadError } = await supabase.storage.from('rdo-fotos').upload(path, foto)
      if (!uploadError) await supabase.from('fotos').insert({ obra_id: newObraId, rdo_id: rdoData.id, legenda: `Foto do RDO ${newData}`, imagem_url: path, data_iso: newData })
    }

    setIsCreateOpen(false)
    toast('Diário de Obra criado com sucesso!', 'success')

    // Reset form
    setActForm([''])
    setNewResumo(''); setNewOcorrencias(''); setNewDefinicaoServico(''); setNewLiberacoes(''); setNewFotos([])
    setNewTerceiros([{ empresa_nome: '', funcao: '', quantidade: '1', observacoes: '', valor_diaria: '' }])
    setNewPlanejadoExecutado([{ servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])
    setEquipForm([
      { nome: 'Retroescavadeira', status: 'OPERANDO' },
      { nome: 'Betoneira', status: 'OPERANDO' }
    ])

    // Refresh
    loadData()
  }

  const handleSignDigital = async (id: string) => {
    const ip = '177.85.122.9' // Simulated IP
    const nomeAssinatura = colaboradorAtivo?.nome || newResponsavel || 'Desconhecido'
    const { error } = await supabase.from('rdos').update({
      status: 'Aprovado',
      assinatura_ip: ip,
      assinatura_at: new Date().toISOString(),
      assinado_por: nomeAssinatura
    }).eq('id', id)

    if (error) {
      toast('Erro ao assinar RDO', 'error')
      return
    }

    toast('Diário assinado digitalmente com sucesso!', 'success')
    loadData()
    if (selectedRdo?.id === id) {
      setSelectedRdo(prev => prev ? {
        ...prev,
        status: 'Aprovado',
        assinatura_ip: ip,
        assinatura_at: new Date().toISOString(),
        assinado_por: nomeAssinatura
      } : null)
    }
  }

  const handleDeleteRdo = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm('Deseja realmente excluir este Diário de Obra (RDO)? Esta ação não pode ser desfeita.')) return

    try {
      await Promise.all([
        supabase.from('rdo_atividades').delete().eq('rdo_id', id),
        supabase.from('rdo_equipamentos').delete().eq('rdo_id', id),
        supabase.from('rdo_efetivos_terceiros').delete().eq('rdo_id', id),
        supabase.from('rdo_planejado_executado').delete().eq('rdo_id', id),
        supabase.from('fotos').delete().eq('rdo_id', id),
      ])

      const { error } = await supabase.from('rdos').delete().eq('id', id)
      if (error) {
        toast('Erro ao excluir RDO: ' + error.message, 'error')
        return
      }

      toast('Diário de Obra excluído com sucesso!', 'success')
      if (selectedRdo?.id === id) {
        setSelectedRdo(null)
      }
      setSelectedRdoIds(prev => prev.filter(item => item !== id))
      loadData()
    } catch {
      toast('Erro ao excluir RDO', 'error')
    }
  }

  return (
    <>
      <PageTitle modulo="Escout" titulo="Diário de Obra Digital" />

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando diários...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List Section (5 Cols) */}
          <div className="lg:col-span-5 flex flex-column gap-4">
            <Panel
              title="Diários Emitidos"
              action={
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsCreateOpen(true)}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    background: C.amber, color: '#0B0C0E',
                    padding: '6px 12px', borderRadius: 2,
                    fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <Plus size={12} /> Novo Diário
                </motion.button>
              }
            >
              {/* Search & Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    style={{ ...inputStyle, paddingLeft: 30 }}
                    placeholder="Buscar por diário, obra, resumo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select
                    value={filterObra}
                    onChange={e => setFilterObra(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Todas">Todas as Obras</option>
                    {obras.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Todos">Todos os Status</option>
                    <option value="Rascunho">Rascunho</option>
                    <option value="Aprovado">Aprovado</option>
                  </select>
                </div>
              </div>

              {/* Selection Bar for Batch Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '8px 10px', background: '#0F1115', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.inkSoft, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={filteredRdos.length > 0 && selectedRdoIds.length === filteredRdos.length}
                    onChange={toggleSelectAllFiltered}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Selecionar todos ({filteredRdos.length})</span>
                </label>
                {selectedRdoIds.length > 0 && (
                  <button
                    onClick={triggerPrintBatch}
                    style={{
                      background: C.amber,
                      color: '#0B0C0E',
                      border: 'none',
                      borderRadius: 3,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer'
                    }}
                  >
                    <Printer size={13} /> Imprimir ({selectedRdoIds.length})
                  </button>
                )}
              </div>

              {/* RDO List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                {filteredRdos.map(r => {
                  const active = selectedRdo?.id === r.id
                  const isChecked = selectedRdoIds.includes(r.id)
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 2,
                        background: active ? `${C.amber}0a` : C.bgCard,
                        border: `1px solid ${active ? C.amber : C.border}`,
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        onClick={(e) => toggleSelectRdo(r.id, e)}
                        style={{ cursor: 'pointer', width: 15, height: 15 }}
                      />
                      <div
                        onClick={() => setSelectedRdo(r)}
                        style={{ flex: 1, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 900, color: C.amber }}>RDO-DIGITAL</span>
                          <span style={{ fontSize: 10, color: C.inkSoft }}>{new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{r.obra?.nome ?? 'Sem Obra'}</div>
                        <div style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.resumo}</div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteRdo(r.id, e)}
                        title="Excluir RDO"
                        style={{ all: 'unset', cursor: 'pointer', color: '#F87171aa', padding: 4, display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
                {filteredRdos.length === 0 && <p style={{ color: C.inkSoft, fontSize: 12 }}>Nenhum diário encontrado.</p>}
              </div>
            </Panel>
          </div>

          {/* Details Section (7 Cols) */}
          <div className="lg:col-span-7 rdo-detail-scroll">
            {selectedRdo ? (
              <Panel
                title={`Detalhes do Diário de Obra`}
                action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => triggerPrintSingle(selectedRdo)}
                      style={{ ...inputStyle, background: 'none', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                      <Printer size={13} /> Imprimir Este
                    </button>
                    <button
                      onClick={(e) => handleDeleteRdo(selectedRdo.id, e)}
                      title="Excluir Diário de Obra"
                      style={{ ...inputStyle, background: 'none', border: `1px solid #F8717155`, color: '#F87171', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                    {selectedRdo.status !== 'Aprovado' && (
                      <button
                        onClick={() => handleSignDigital(selectedRdo.id)}
                        style={{ ...inputStyle, background: C.amber, color: '#0b0c0e', border: 'none', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}
                      >
                        <Check size={13} /> Assinar
                      </button>
                    )}
                  </div>
                }
              >
                {/* RDO Doc Render */}
                <div style={{ padding: 16, background: '#0F1115', border: `1px solid ${C.border}`, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Doc Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>{selectedRdo.obra?.nome ?? 'Obra'}</h4>
                      <p style={{ fontSize: 11, color: C.inkSoft }}>Responsável: {selectedRdo.responsavel} {selectedRdo.cargo ? `(${selectedRdo.cargo})` : ''}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: C.amber }}>RDO-DIGITAL</span>
                      <p style={{ fontSize: 11, color: C.inkSoft }}>Data: {new Date(selectedRdo.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div style={{ background: C.bgCard, padding: 8, borderRadius: 2, border: `1px solid ${C.border}` }}>
                      <span style={labelStyle}>Clima</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: C.ink }}>
                        {getWeatherIcon(selectedRdo.clima_manha)} M / {getWeatherIcon(selectedRdo.clima_tarde)} T
                      </div>
                    </div>
                    <div style={{ background: C.bgCard, padding: 8, borderRadius: 2, border: `1px solid ${C.border}` }}>
                      <span style={labelStyle}>Solo</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{selectedRdo.condicao_solo}</span>
                    </div>
                    <div style={{ background: C.bgCard, padding: 8, borderRadius: 2, border: `1px solid ${C.border}` }}>
                      <span style={labelStyle}>Efetivo</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{Number(selectedRdo.efetivo_proprio) + Number(selectedRdo.efetivo_terceiros)} colab.</span>
                    </div>
                  </div>

                  {/* Activities */}
                  <div>
                    <span style={labelStyle}>Atividades Realizadas</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedRdo.atividades?.map((a, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.ink, display: 'flex', gap: 8 }}>
                          <span style={{ color: C.amber, fontWeight: 900 }}>•</span>
                          <span>{a.descricao}</span>
                        </div>
                      ))}
                      {(!selectedRdo.atividades || selectedRdo.atividades.length === 0) && <p style={{ fontSize: 11, color: C.inkSoft }}>Nenhuma atividade registrada.</p>}
                    </div>
                  </div>

                  {/* Equipments */}
                  <div>
                    <span style={labelStyle}>Equipamentos em Canteiro</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {selectedRdo.equipamentos?.map((eq, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 11 }}>
                          <span style={{ color: C.ink, fontWeight: 700 }}>{eq.nome}</span>
                          <span style={{ color: eq.status === 'OPERANDO' ? C.green : C.amber, fontWeight: 800 }}>{eq.status}</span>
                        </div>
                      ))}
                      {(!selectedRdo.equipamentos || selectedRdo.equipamentos.length === 0) && <p style={{ fontSize: 11, color: C.inkSoft }}>Nenhum equipamento registrado.</p>}
                    </div>
                  </div>

                  <div>
                    <span style={labelStyle}>Efetivo terceirizado — log de empresas e pagamento</span>
                    {(selectedRdo as any).terceiros?.length ? <div style={{ display: 'grid', gap: 7 }}>{(selectedRdo as any).terceiros.map((item: any) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 60px 110px 120px', gap: 8, alignItems: 'center', padding: '8px 10px', background: C.bgCard, border: `1px solid ${C.border}`, fontSize: 11 }}><strong>{item.empresa_nome}</strong><span>{item.funcao || '—'}</span><span>{item.quantidade} col.</span><span>{item.valor_diaria ? `R$ ${Number(item.valor_diaria).toFixed(2)}/dia` : 'Sem valor'}</span><span style={{ color: item.pagamento_status === 'pago' ? C.green : C.amber, fontWeight: 800 }}>{item.pagamento_status}</span>{item.observacoes && <small style={{ gridColumn: '1 / -1', color: C.inkSoft }}>{item.observacoes}</small>}</div>)}</div> : <p style={{ fontSize: 11, color: C.inkSoft }}>Nenhuma empresa terceirizada detalhada neste RDO.</p>}
                  </div>

                  <div>
                    <span style={labelStyle}>Planejado x executado</span>
                    {(selectedRdo as any).planejado_executado?.length ? <div style={{ display: 'grid', gap: 7 }}>{(selectedRdo as any).planejado_executado.map((item: any) => { const planned = Number(item.quantidade_planejada) || 0; const executed = Number(item.quantidade_executada) || 0; const percentage = planned > 0 ? Math.min(100, executed / planned * 100) : 0; return <div key={item.id} style={{ padding: 9, background: C.bgCard, border: `1px solid ${C.border}`, fontSize: 11 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{item.servico}</strong><span>{executed} / {planned} {item.unidade || ''} ({percentage.toFixed(1)}%)</span></div><div style={{ height: 5, marginTop: 6, background: '#222530', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${percentage}%`, height: '100%', background: percentage >= 100 ? C.green : C.amber }} /></div>{item.observacoes && <small style={{ display: 'block', marginTop: 5, color: C.inkSoft }}>{item.observacoes}</small>}</div> })}</div> : <p style={{ fontSize: 11, color: C.inkSoft }}>Nenhum serviço planejado registrado.</p>}
                  </div>

                  {/* Comments */}
                  {(selectedRdo.definicao_servico || selectedRdo.liberacoes) && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={labelStyle}>Definição dos serviços</span><p style={{ fontSize: 12, color: C.ink }}>{selectedRdo.definicao_servico || '—'}</p></div>
                    <div><span style={labelStyle}>Liberações</span><p style={{ fontSize: 12, color: C.ink }}>{selectedRdo.liberacoes || '—'}</p></div>
                  </div>}
                  {selectedRdo.ocorrencias && (
                    <div>
                      <span style={labelStyle}>Ocorrências / Observações</span>
                      <div style={{ fontSize: 12, color: C.red, background: `${C.red}05`, border: `1px solid ${C.red}22`, padding: 10, borderRadius: 2 }}>
                        {selectedRdo.ocorrencias}
                      </div>
                    </div>
                  )}

                  {/* Signature block */}
                  <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 14, marginTop: 10 }}>
                    {selectedRdo.status === 'Aprovado' && selectedRdo.assinatura_at ? (
                      <div style={{ background: '#10B98110', border: '1px solid #10B98133', borderRadius: 2, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Award size={18} color="#10B981" />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#10B981' }}>ASSINADO DIGITALMENTE</div>
                          <div style={{ fontSize: 10, color: C.inkSoft }}>Resp. Relatório: {selectedRdo.responsavel} · IP: {selectedRdo.assinatura_ip} · Data/Hora: {new Date(selectedRdo.assinatura_at).toLocaleString('pt-BR')}</div>
                          {selectedRdo.assinado_por && <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>✓ Assinado por: {selectedRdo.assinado_por}</div>}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.amber, fontSize: 11, fontWeight: 700 }}>
                        <Clock size={14} /> Aguardando assinatura digital do Engenheiro Responsável.
                      </div>
                    )}
                  </div>

                </div>
              </Panel>
            ) : (
              <p style={{ color: C.inkSoft, fontSize: 13 }}>Selecione um RDO na lista para visualizar.</p>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div onWheel={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden', overscrollBehavior: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2, width: '100%', maxWidth: 460, maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable', boxSizing: 'border-box', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>Novo Diário de Obra</span>
                <button onClick={() => setIsCreateOpen(false)} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}><X size={15} /></button>
              </div>

              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                {(['geral', 'recursos', 'atividades'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFormTab(tab)}
                    style={{
                      background: 'none', border: 'none',
                      borderBottom: formTab === tab ? `2px solid ${C.amber}` : '2px solid transparent',
                      color: formTab === tab ? C.amber : C.inkSoft,
                      padding: '8px 16px', fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreateRdo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {formTab === 'geral' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Obra *</label>
                        <select value={newObraId} onChange={e => setNewObraId(e.target.value)} style={inputStyle}>
                          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Data *</label>
                        <input type="date" value={newData} onChange={e => setNewData(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div><label style={labelStyle}>Relato livre do dia</label><textarea rows={3} value={newResumo} onChange={e => setNewResumo(e.target.value)} style={inputStyle} placeholder="Escreva livremente o que aconteceu no dia" /></div>
                    <div><label style={labelStyle}>Ocorrências</label><textarea rows={2} value={newOcorrencias} onChange={e => setNewOcorrencias(e.target.value)} style={inputStyle} placeholder="Ocorrências, impactos e providências" /></div>
                    <div>
                      <label style={labelStyle}>Responsável Técnico *</label>
                      <input type="text" value={newResponsavel} onChange={e => setNewResponsavel(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Cargo</label>
                        <input type="text" value={newCargo} onChange={e => setNewCargo(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>CREA</label>
                        <input type="text" value={newCrea} onChange={e => setNewCrea(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                  </>
                )}

                {formTab === 'recursos' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Clima Manhã</label>
                        <select value={newClimaManha} onChange={e => setNewClimaManha(e.target.value)} style={inputStyle}>
                          <option value="Sol">Sol</option>
                          <option value="Nublado">Nublado</option>
                          <option value="Chuva">Chuva</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Clima Tarde</label>
                        <select value={newClimaTarde} onChange={e => setNewClimaTarde(e.target.value)} style={inputStyle}>
                          <option value="Sol">Sol</option>
                          <option value="Nublado">Nublado</option>
                          <option value="Chuva">Chuva</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Solo</label>
                        <select value={newCondicaoSolo} onChange={e => setNewCondicaoSolo(e.target.value)} style={inputStyle}>
                          <option value="Seco">Seco</option>
                          <option value="Lama">Lama</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Efetivo Próprio</label>
                        <input type="number" value={newEfetivoProprio} onChange={e => setNewEfetivoProprio(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Efetivo Terceirizado</label>
                        <input type="number" value={newEfetivoTerceiros} onChange={e => setNewEfetivoTerceiros(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 5, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <label style={labelStyle}>Terceirizados por empresa — controle para conferência e pagamento</label>
                        <button type="button" onClick={() => setNewTerceiros(items => [...items, { empresa_nome: '', funcao: '', quantidade: '1', observacoes: '', valor_diaria: '' }])} style={{ all: 'unset', cursor: 'pointer', color: C.amber, fontSize: 10, fontWeight: 800 }}>+ EMPRESA</button>
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {newTerceiros.map((item, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 80px 110px', gap: 8, alignItems: 'end' }}>
                          <div><label style={labelStyle}>Empresa terceirizada *</label><input style={inputStyle} placeholder="Nome da empresa" value={item.empresa_nome} onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, empresa_nome: e.target.value } : x))} /></div>
                          <div><label style={labelStyle}>Função/serviço</label><input style={inputStyle} placeholder="Ex.: elétrica" value={item.funcao} onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, funcao: e.target.value } : x))} /></div>
                          <div><label style={labelStyle}>Qtd.</label><input type="number" min="1" style={inputStyle} value={item.quantidade} onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, quantidade: e.target.value } : x))} /></div>
                          <div><label style={labelStyle}>Diária (R$)</label><input type="number" step="0.01" style={inputStyle} placeholder="0,00" value={item.valor_diaria} onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, valor_diaria: e.target.value } : x))} /></div>
                          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Observações</label><textarea rows={2} style={inputStyle} placeholder="Medição, frente, período ou informação para conferência" value={item.observacoes} onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, observacoes: e.target.value } : x))} /></div>
                          {newTerceiros.length > 1 && <button type="button" onClick={() => setNewTerceiros(items => items.filter((_, i) => i !== index))} style={{ ...btnGhost, justifySelf: 'start' }}><X size={12} /> Remover empresa</button>}
                        </div>)}
                      </div>
                    </div>
                  </>
                )}

                {formTab === 'atividades' && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={labelStyle}>Atividades Realizadas</label>
                        <button type="button" onClick={() => setActForm(a => [...a, ''])} style={{ all: 'unset', cursor: 'pointer', color: C.amber, fontSize: 10, fontWeight: 800 }}>+ ATIVIDADE</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                        {actForm.map((a, idx) => (
                          <input
                            key={idx} style={inputStyle} placeholder={`Atividade ${idx + 1}`}
                            value={a} onChange={e => setActForm(prev => {
                              const n = [...prev]
                              n[idx] = e.target.value
                              return n
                            })}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><label style={labelStyle}>Planejado x executado</label><button type="button" onClick={() => setNewPlanejadoExecutado(items => [...items, { servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])} style={{ all: 'unset', cursor: 'pointer', color: C.amber, fontSize: 10, fontWeight: 800 }}>+ SERVIÇO</button></div>
                      <div style={{ display: 'grid', gap: 9 }}>{newPlanejadoExecutado.map((item, index) => { const planned = parseFloat(item.planejada) || 0; const executed = parseFloat(item.executada) || 0; const percentage = planned > 0 ? Math.min(100, (executed / planned) * 100) : 0; return <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.5fr 80px 110px 110px', gap: 8, alignItems: 'end' }}><div><label style={labelStyle}>Serviço *</label><input style={inputStyle} placeholder="Ex.: alvenaria" value={item.servico} onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, servico: e.target.value } : x))} /></div><div><label style={labelStyle}>Unidade</label><input style={inputStyle} placeholder="m²" value={item.unidade} onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, unidade: e.target.value } : x))} /></div><div><label style={labelStyle}>Planejado</label><input type="number" step="0.001" style={inputStyle} value={item.planejada} onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, planejada: e.target.value } : x))} /></div><div><label style={labelStyle}>Executado</label><input type="number" step="0.001" style={inputStyle} value={item.executada} onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, executada: e.target.value } : x))} /></div><div style={{ gridColumn: '1 / -1' }}><div style={{ height: 5, background: '#222530', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${percentage}%`, height: '100%', background: percentage >= 100 ? C.green : C.amber }} /></div><small style={{ color: percentage >= 100 ? C.green : C.inkSoft, fontSize: 9 }}>{percentage.toFixed(1)}% executado</small></div><div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Observações</label><input style={inputStyle} placeholder="Frente, motivo de diferença ou evidência" value={item.observacoes} onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, observacoes: e.target.value } : x))} /></div>{newPlanejadoExecutado.length > 1 && <button type="button" onClick={() => setNewPlanejadoExecutado(items => items.filter((_, i) => i !== index))} style={{ ...btnGhost, justifySelf: 'start' }}><X size={12} /> Remover</button>}</div> })}</div>
                    </div>
                    <div><label style={labelStyle}>Definição dos serviços</label><textarea rows={2} style={inputStyle} value={newDefinicaoServico} onChange={e => setNewDefinicaoServico(e.target.value)} /></div>
                    <div><label style={labelStyle}>Liberações</label><textarea rows={2} style={inputStyle} value={newLiberacoes} onChange={e => setNewLiberacoes(e.target.value)} placeholder="Frentes, áreas, projetos ou serviços liberados" /></div>
                    <div><label style={labelStyle}>Fotos do RDO</label><input type="file" multiple accept="image/jpeg,image/png,image/webp" style={inputStyle} onChange={e => setNewFotos(Array.from(e.target.files || []))} />{newFotos.length > 0 && <small style={{ color: C.green }}>{newFotos.length} foto(s) selecionada(s)</small>}</div>
                  </>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <button type="button" onClick={() => setIsCreateOpen(false)} style={btnGhost}>Cancelar</button>
                  <button type="submit" style={{ ...inputStyle, background: C.amber, color: '#0b0c0e', border: 'none', fontWeight: 900, width: 'auto', padding: '8px 18px', cursor: 'pointer' }}>Salvar Diário</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Area (Only visible when window.print() is called) */}
      <div id="rdo-printable-area" className="rdo-print-only">
        {rdosToPrint.map((rdo, index) => (
          <div
            key={rdo.id}
            className={`rdo-print-sheet ${index < rdosToPrint.length - 1 ? 'rdo-page-break' : ''}`}
          >
            {/* Header */}
            <div className="print-header">
              <div className="print-header-left">
                <h1 className="print-company-title">VITORLO CORREIA | ENGENHARIA</h1>
                <h2 className="print-obra-title">OBRA: {rdo.obra?.nome || 'OBRA NÃO INFORMADA'}</h2>
              </div>
              <div className="print-header-right">
                <div className="print-doc-badge">RELATÓRIO DIÁRIO DE OBRA</div>
                <div className="print-doc-date">Data: <strong>{new Date(rdo.data + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
                <div className="print-doc-status">Status: <strong>{rdo.status.toUpperCase()}</strong></div>
              </div>
            </div>

            {/* General Information Grid */}
            <table className="print-table print-meta-table">
              <tbody>
                <tr>
                  <td><strong>Responsável Técnico:</strong> {rdo.responsavel}</td>
                  <td><strong>Cargo:</strong> {rdo.cargo || '—'}</td>
                  <td><strong>CREA:</strong> {rdo.crea || '—'}</td>
                </tr>
                <tr>
                  <td><strong>Clima (M / T):</strong> {rdo.clima_manha} / {rdo.clima_tarde}</td>
                  <td><strong>Condição do Solo:</strong> {rdo.condicao_solo}</td>
                  <td><strong>Efetivo Total:</strong> {Number(rdo.efetivo_proprio || 0) + Number(rdo.efetivo_terceiros || 0)} colab. ({rdo.efetivo_proprio || 0} próprios, {rdo.efetivo_terceiros || 0} terc.)</td>
                </tr>
              </tbody>
            </table>

            {/* Resumo */}
            {rdo.resumo && (
              <div className="print-section">
                <h3 className="print-section-title">1. Resumo do Dia</h3>
                <p className="print-text-block">{rdo.resumo}</p>
              </div>
            )}

            {/* Atividades */}
            <div className="print-section">
              <h3 className="print-section-title">2. Atividades Realizadas</h3>
              {rdo.atividades && rdo.atividades.length > 0 ? (
                <ul className="print-list">
                  {rdo.atividades.map((at, i) => (
                    <li key={i}>{at.descricao}</li>
                  ))}
                </ul>
              ) : (
                <p className="print-empty">Nenhuma atividade registrada.</p>
              )}
            </div>

            {/* Equipamentos */}
            <div className="print-section">
              <h3 className="print-section-title">3. Equipamentos em Canteiro</h3>
              {rdo.equipamentos && rdo.equipamentos.length > 0 ? (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Equipamento</th>
                      <th>Status Operacional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdo.equipamentos.map((eq, i) => (
                      <tr key={i}>
                        <td>{eq.nome}</td>
                        <td><strong>{eq.status}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="print-empty">Nenhum equipamento registrado.</p>
              )}
            </div>

            {/* Terceirizados */}
            {rdo.terceiros && rdo.terceiros.length > 0 && (
              <div className="print-section">
                <h3 className="print-section-title">4. Efetivo Terceirizado</h3>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Função</th>
                      <th>Qtd</th>
                      <th>Diária</th>
                      <th>Status Pgto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdo.terceiros.map((item: any) => (
                      <tr key={item.id}>
                        <td><strong>{item.empresa_nome}</strong></td>
                        <td>{item.funcao || '—'}</td>
                        <td>{item.quantidade} col.</td>
                        <td>{item.valor_diaria ? `R$ ${Number(item.valor_diaria).toFixed(2)}` : '—'}</td>
                        <td>{item.pagamento_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Planejado vs Executado */}
            {rdo.planejado_executado && rdo.planejado_executado.length > 0 && (
              <div className="print-section">
                <h3 className="print-section-title">5. Serviços Planejados vs Executados</h3>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Serviço</th>
                      <th>Planejado</th>
                      <th>Executado</th>
                      <th>Aproveitamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdo.planejado_executado.map((item: any) => {
                      const p = Number(item.quantidade_planejada) || 0
                      const e = Number(item.quantidade_executada) || 0
                      const perc = p > 0 ? ((e / p) * 100).toFixed(1) : '0.0'
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.servico}</strong></td>
                          <td>{p} {item.unidade}</td>
                          <td>{e} {item.unidade}</td>
                          <td><strong>{perc}%</strong></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Definições / Liberações / Ocorrências */}
            {(rdo.definicao_servico || rdo.liberacoes || rdo.ocorrencias) && (
              <div className="print-section">
                <h3 className="print-section-title">6. Ocorrências e Definições</h3>
                {rdo.definicao_servico && <p className="print-text-block"><strong>Definição dos Serviços:</strong> {rdo.definicao_servico}</p>}
                {rdo.liberacoes && <p className="print-text-block" style={{ marginTop: 4 }}><strong>Liberações:</strong> {rdo.liberacoes}</p>}
                {rdo.ocorrencias && (
                  <div className="print-alert-box">
                    <strong>⚠️ Ocorrências do Dia:</strong> {rdo.ocorrencias}
                  </div>
                )}
              </div>
            )}

            {/* Fotos anexadas */}
            {rdo.fotos && rdo.fotos.length > 0 && (
              <div className="print-section">
                <h3 className="print-section-title">7. Registro Fotográfico de Campo</h3>
                <div className="print-photos-grid">
                  {rdo.fotos.map(foto => {
                    const url = foto.imagem_url?.startsWith('http')
                      ? foto.imagem_url
                      : supabase.storage.from('rdo-fotos').getPublicUrl(foto.imagem_url).data.publicUrl
                    return (
                      <div key={foto.id} className="print-photo-item">
                        <img src={url} alt={foto.legenda || 'Foto do RDO'} />
                        <span className="print-photo-caption">{foto.legenda || 'Sem legenda'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Signatures & Stamp */}
            <div className="print-signature-section">
              {rdo.status === 'Aprovado' && rdo.assinatura_at ? (
                <div className="print-stamp-box">
                  <div className="print-stamp-title">✓ ASSINADO DIGITALMENTE VIA SISTEMA VITORLO CORREIA</div>
                  <div className="print-stamp-details">
                    <span><strong>Engenheiro Responsável:</strong> {rdo.responsavel}</span>
                    <span><strong>Assinado por:</strong> {rdo.assinado_por || rdo.responsavel}</span>
                    <span><strong>IP de Origem:</strong> {rdo.assinatura_ip}</span>
                    <span><strong>Data/Hora de Autenticação:</strong> {new Date(rdo.assinatura_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ) : (
                <div className="print-pending-box">
                  <span>DOCUMENTO EM RASCUNHO — PENDENTE DE ASSINATURA DIGITAL</span>
                </div>
              )}

              <div className="print-signatures-lines">
                <div className="print-sig-line">
                  <div className="line"></div>
                  <span>Engenheiro Responsável</span>
                  <small>{rdo.responsavel}</small>
                </div>
                <div className="print-sig-line">
                  <div className="line"></div>
                  <span>Fiscalização da Obra / Cliente</span>
                  <small>{rdo.obra?.nome}</small>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .rdo-print-only {
          display: none;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          
          #rdo-printable-area, #rdo-printable-area * {
            visibility: visible !important;
          }

          #rdo-printable-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          .rdo-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }

          .rdo-print-sheet {
            padding: 24px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #111827 !important;
          }

          .print-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            border-bottom: 3px solid #1e293b !important;
            padding-bottom: 12px !important;
            margin-bottom: 16px !important;
          }

          .print-company-title {
            font-size: 16px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            margin: 0 0 4px 0 !important;
            letter-spacing: 0.5px !important;
          }

          .print-obra-title {
            font-size: 13px !important;
            font-weight: 700 !important;
            color: #334155 !important;
            margin: 0 !important;
          }

          .print-header-right {
            text-align: right !important;
          }

          .print-doc-badge {
            display: inline-block !important;
            background: #0f172a !important;
            color: #ffffff !important;
            font-size: 10px !important;
            font-weight: 900 !important;
            padding: 3px 8px !important;
            border-radius: 2px !important;
            margin-bottom: 4px !important;
            letter-spacing: 0.5px !important;
          }

          .print-doc-date, .print-doc-status {
            font-size: 11px !important;
            color: #475569 !important;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
            margin-bottom: 14px !important;
          }

          .print-table th, .print-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 10px !important;
            text-align: left !important;
            color: #1e293b !important;
          }

          .print-table th {
            background: #f1f5f9 !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            text-transform: uppercase !important;
            font-size: 10px !important;
          }

          .print-meta-table td {
            background: #f8fafc !important;
            font-size: 11px !important;
          }

          .print-section {
            margin-bottom: 16px !important;
          }

          .print-section-title {
            font-size: 12px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            border-bottom: 1.5px solid #cbd5e1 !important;
            padding-bottom: 4px !important;
            margin: 0 0 8px 0 !important;
            text-transform: uppercase !important;
          }

          .print-text-block {
            font-size: 11px !important;
            line-height: 1.5 !important;
            color: #334155 !important;
            margin: 0 !important;
          }

          .print-list {
            margin: 0 !important;
            padding-left: 18px !important;
            font-size: 11px !important;
            color: #1e293b !important;
          }

          .print-list li {
            margin-bottom: 4px !important;
          }

          .print-empty {
            font-size: 10px !important;
            color: #64748b !important;
            font-style: italic !important;
            margin: 0 !important;
          }

          .print-alert-box {
            background: #fef2f2 !important;
            border: 1px solid #fca5a5 !important;
            color: #991b1b !important;
            padding: 8px 12px !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            margin-top: 6px !important;
          }

          .print-photos-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
            margin-top: 8px !important;
          }

          .print-photo-item {
            border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
            border-radius: 4px !important;
            background: #f8fafc !important;
            text-align: center !important;
          }

          .print-photo-item img {
            max-width: 100% !important;
            max-height: 180px !important;
            object-fit: cover !important;
            border-radius: 2px !important;
          }

          .print-photo-caption {
            display: block !important;
            font-size: 9px !important;
            color: #475569 !important;
            margin-top: 4px !important;
          }

          .print-signature-section {
            margin-top: 24px !important;
            border-top: 2px solid #0f172a !important;
            padding-top: 14px !important;
            page-break-inside: avoid !important;
          }

          .print-stamp-box {
            background: #f0fdf4 !important;
            border: 1.5px solid #86efac !important;
            border-radius: 4px !important;
            padding: 10px 14px !important;
            margin-bottom: 24px !important;
          }

          .print-stamp-title {
            font-size: 11px !important;
            font-weight: 900 !important;
            color: #166534 !important;
            margin-bottom: 6px !important;
          }

          .print-stamp-details {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 4px 12px !important;
            font-size: 10px !important;
            color: #15803d !important;
          }

          .print-pending-box {
            background: #fffbeb !important;
            border: 1.5px solid #fde68a !important;
            color: #b45309 !important;
            padding: 8px 12px !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            border-radius: 4px !important;
            margin-bottom: 24px !important;
            text-align: center !important;
          }

          .print-signatures-lines {
            display: flex !important;
            justify-content: space-around !important;
            margin-top: 36px !important;
          }

          .print-sig-line {
            text-align: center !important;
            width: 200px !important;
          }

          .print-sig-line .line {
            border-bottom: 1px solid #334155 !important;
            margin-bottom: 6px !important;
          }

          .print-sig-line span {
            display: block !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
          }

          .print-sig-line small {
            display: block !important;
            font-size: 9px !important;
            color: #64748b !important;
          }
        }
      `}</style>
    </>
  )
}

// ─── STYLES REUSABLE ─────────────────────────────────────────────────────────
const btnGhost: React.CSSProperties = {
  background: 'none',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  padding: '8px 16px',
  fontSize: 11,
  fontWeight: 700,
  color: C.inkSoft,
  cursor: 'pointer'
}
