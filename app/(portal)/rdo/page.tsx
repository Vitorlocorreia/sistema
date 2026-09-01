'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, FileText, Calendar, Building, Sun, CloudRain, Cloud,
  UserCheck, AlertTriangle, Hammer, CheckCircle2, FileUp,
  Search, X, Check, Eye, Printer, Award, Clock, Trash2, Edit3, History, Save,
  ChevronDown, ChevronUp, Users, Wrench, Camera, ShieldCheck,
  ArrowRight, ArrowLeft, UploadCloud
} from 'lucide-react'
import { Panel } from '@/components/Panel'
import { PageTitle } from '@/components/PageTitle'
import { StatusBadge } from '@/components/StatusBadge'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'motion/react'
import type { Obra, Rdo, RdoCompleto } from '@/lib/types'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { flushSync } from 'react-dom'
import { useConfirm } from '@/hooks/useConfirm'

type EfetivoTerceiroForm = { empresa_nome: string; funcao: string; quantidade: string; observacoes: string }
type PlanejadoExecutadoForm = { servico: string; unidade: string; planejada: string; executada: string; observacoes: string }
type HistoricoEdicao = { id: string; data: string; autor: string; resumo_alteracao: string; campos: { campo: string; antes: string; depois: string }[] }

function TextoExpandivel({ text, maxLength = 120, textColor = C.ink }: { text: string | null | undefined; maxLength?: number; textColor?: string }) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const isLong = text.length > maxLength

  if (!isLong) {
    return (
      <p title={text} style={{ fontSize: 12, color: textColor, wordBreak: 'break-word', lineHeight: 1.5, margin: 0 }}>
        {text}
      </p>
    )
  }

  const displayText = expanded ? text : text.slice(0, maxLength) + '...'

  return (
    <div title={text} style={{ fontSize: 12, color: textColor, wordBreak: 'break-word', lineHeight: 1.5 }}>
      <span>{displayText}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
        title={expanded ? "Recolher texto" : "Ver relato completo (passe o mouse para ler tudo)"}
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

// ─── STYLES & INDUSTRIAL TOKENS ──────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.ink,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: C.inkSoft,
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 5,
  letterSpacing: '0.05em',
}

const cardIndustrial: React.CSSProperties = {
  background: C.bgWhite,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '14px',
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function RDO() {
  const { confirm, ConfirmDialog } = useConfirm()
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
  const [filterDatePreset, setFilterDatePreset] = useState<'todos' | 'hoje' | '7dias' | 'mes'>('todos')
  const [selectedRdoIds, setSelectedRdoIds] = useState<string[]>([])
  const [overridePrintRdos, setOverridePrintRdos] = useState<RdoCompleto[] | null>(null)
  const [fotoExpandida, setFotoExpandida] = useState<{ url: string; legenda: string } | null>(null)

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
  const [newEfetivoTerceiros, setNewEfetivoTerceiros] = useState('0')
  const [temTerceirizados, setTemTerceirizados] = useState(false)
  const [newTerceiros, setNewTerceiros] = useState<EfetivoTerceiroForm[]>([{ empresa_nome: '', funcao: '', quantidade: '1', observacoes: '' }])
  const [newPlanejadoExecutado, setNewPlanejadoExecutado] = useState<PlanejadoExecutadoForm[]>([{ servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])
  const [newResumo, setNewResumo] = useState('')
  const [newOcorrencias, setNewOcorrencias] = useState('')
  const [newDefinicaoServico, setNewDefinicaoServico] = useState('')
  const [newLiberacoes, setNewLiberacoes] = useState('')
  const [newFotos, setNewFotos] = useState<File[]>([])
  const [isCreatingRdo, setIsCreatingRdo] = useState(false)

  // Equipments state in form
  const [equipForm, setEquipForm] = useState<{ nome: string; status: 'OPERANDO' | 'PARADO' | 'MANUTENÇÃO' }[]>([
    { nome: '', status: 'OPERANDO' }
  ])

  // Activities state in form
  const [actForm, setActForm] = useState<string[]>([''])

  // ─── EDIT MODE STATES ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editGeral, setEditGeral] = useState({ resumo: '', ocorrencias: '', responsavel: '', cargo: '', crea: '', clima_manha: 'Sol', clima_tarde: 'Sol', condicao_solo: 'Seco', efetivo_proprio: '0', efetivo_terceiros: '0', definicao_servico: '', liberacoes: '' })
  const [editAtividades, setEditAtividades] = useState<string[]>([''])
  const [editEquipamentos, setEditEquipamentos] = useState<{ nome: string; status: 'OPERANDO' | 'PARADO' | 'MANUTENÇÃO' }[]>([{ nome: '', status: 'OPERANDO' }])
  const [editPlanejado, setEditPlanejado] = useState<PlanejadoExecutadoForm[]>([{ servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])

  function openEditMode(rdo: RdoCompleto) {
    setEditGeral({
      resumo: rdo.resumo ?? '',
      ocorrencias: rdo.ocorrencias ?? '',
      responsavel: rdo.responsavel ?? '',
      cargo: rdo.cargo ?? '',
      crea: rdo.crea ?? '',
      clima_manha: rdo.clima_manha ?? 'Sol',
      clima_tarde: rdo.clima_tarde ?? 'Sol',
      condicao_solo: rdo.condicao_solo ?? 'Seco',
      efetivo_proprio: String(rdo.efetivo_proprio ?? 0),
      efetivo_terceiros: String(rdo.efetivo_terceiros ?? 0),
      definicao_servico: rdo.definicao_servico ?? '',
      liberacoes: rdo.liberacoes ?? '',
    })
    setEditAtividades(rdo.atividades?.map(a => a.descricao) ?? [''])
    setEditEquipamentos(rdo.equipamentos?.map(eq => ({ nome: eq.nome, status: eq.status as 'OPERANDO' | 'PARADO' | 'MANUTENÇÃO' })) ?? [{ nome: '', status: 'OPERANDO' }])
    setEditPlanejado((rdo as any).planejado_executado?.map((p: any) => ({
      servico: p.servico ?? '',
      unidade: p.unidade ?? '',
      planejada: String(p.quantidade_planejada ?? ''),
      executada: String(p.quantidade_executada ?? ''),
      observacoes: p.observacoes ?? '',
    })) ?? [{ servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])
    setEditMode(true)
  }

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
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
      { data: r, error: rError },
      { data: o, error: oError }
    ] = await Promise.all([
      supabase.from('rdos').select('*, obra:obras(nome), atividades:rdo_atividades(*), equipamentos:rdo_equipamentos(*), terceiros:rdo_efetivos_terceiros(*), planejado_executado:rdo_planejado_executado(*), fotos(*)').order('data', { ascending: false }),
      supabase.from('obras').select('*').order('nome')
    ])

    if (rError) console.error('[RDO] Erro ao carregar RDOs:', rError)
    if (oError) console.error('[RDO] Erro ao carregar Obras:', oError)

    let rdosList = (r as RdoCompleto[]) ?? []
    let oList = o ?? []

    // Filtrar por acesso à obra (somente se restrição for explicitamente configurada)
    if (colab && colab.cargo && colab.cargo !== 'admin_geral' && Array.isArray(colab.obras_ids) && colab.obras_ids.length > 0) {
      const oIds = colab.obras_ids
      oList = oList.filter((ob: any) => oIds.includes(ob.id))
      rdosList = rdosList.filter((rdo: any) => oIds.includes(rdo.obra_id))
    }

    setRdos(rdosList)
    setObras(oList)

    if (oList && oList.length > 0) {
      setNewObraId(prev => prev || oList[0].id)
    }

    if (rdosList.length > 0) {
      setSelectedRdo(prev => {
        if (!prev) return rdosList[0]
        // Re-sync with fresh data: find updated version, close if deleted
        const fresh = rdosList.find(r => r.id === prev.id)
        return fresh ?? null
      })
    } else {
      setSelectedRdo(null)
    }
    setLoading(false)
  }, [])

  useRealtimeSync(loadData, 'rdo-sync', ['rdos', 'rdo_efetivos_terceiros', 'rdo_planejado_executado', 'obras'])
  useEffect(() => { loadData() }, [loadData])

  const filteredRdos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    return rdos.filter(r => {
      const matchesSearch =
        (r.responsavel ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.resumo ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.obra?.nome ?? '').toLowerCase().includes(search.toLowerCase())

      const matchesObra = filterObra === 'Todas' || r.obra?.nome === filterObra
      const matchesStatus = filterStatus === 'Todos' || r.status === filterStatus

      let matchesDate = true
      if (filterDatePreset === 'hoje') {
        matchesDate = r.data === today
      } else if (filterDatePreset === '7dias') {
        matchesDate = r.data >= sevenDaysAgo
      } else if (filterDatePreset === 'mes') {
        matchesDate = r.data >= firstDayOfMonth
      }

      return matchesSearch && matchesObra && matchesStatus && matchesDate
    })
  }, [rdos, search, filterObra, filterStatus, filterDatePreset])

  // KPIs
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const totalMes = rdos.length
    const emitidosHoje = rdos.filter(r => r.data === todayStr).length
    const pendentes = rdos.filter(r => r.status !== 'Aprovado').length
    const totalEfetivo = selectedRdo 
      ? Number(selectedRdo.efetivo_proprio || 0) + Number(selectedRdo.efetivo_terceiros || 0)
      : 0
    return { totalMes, emitidosHoje, pendentes, totalEfetivo }
  }, [rdos, selectedRdo])

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

  const waitForImagesAndPrint = async () => {
    const printArea = document.getElementById('rdo-printable-area')
    if (printArea) {
      const imgs = Array.from(printArea.querySelectorAll('img'))
      await Promise.all(
        imgs.map(img => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve()
          return new Promise(resolve => {
            img.onload = resolve
            img.onerror = resolve
            setTimeout(resolve, 2500)
          })
        })
      )
    }
    await new Promise(res => setTimeout(res, 150))
    window.print()
  }

  const triggerPrintSingle = async (rdo: RdoCompleto) => {
    flushSync(() => {
      setOverridePrintRdos([rdo])
    })
    await waitForImagesAndPrint()
    setOverridePrintRdos(null)
  }

  const triggerPrintBatch = async () => {
    flushSync(() => {
      setOverridePrintRdos(null)
    })
    await waitForImagesAndPrint()
  }

  const handleDeleteBatch = async () => {
    if (selectedRdoIds.length === 0) return
    const confirmado = await confirm(
      'Excluir RDOs Selecionados',
      `Deseja excluir ${selectedRdoIds.length} diário(s) de obra? Esta ação não pode ser desfeita.`,
      { confirmLabel: `Excluir ${selectedRdoIds.length}`, confirmColor: '#EF4444' }
    )
    if (!confirmado) return
    // Excluir tabelas relacionadas e depois os RDOs
    await Promise.all([
      supabase.from('rdo_atividades').delete().in('rdo_id', selectedRdoIds),
      supabase.from('rdo_equipamentos').delete().in('rdo_id', selectedRdoIds),
      supabase.from('rdo_efetivos_terceiros').delete().in('rdo_id', selectedRdoIds),
      supabase.from('rdo_planejado_executado').delete().in('rdo_id', selectedRdoIds),
    ])
    const { error } = await supabase.from('rdos').delete().in('id', selectedRdoIds)
    if (error) return toast(error.message, 'error')
    setSelectedRdoIds([])
    if (selectedRdo && selectedRdoIds.includes(selectedRdo.id)) setSelectedRdo(null)
    await loadData(true)
    toast(`${selectedRdoIds.length} diário(s) excluído(s).`, 'success')
  }

  const getWeatherIcon = (weather?: string, size = 15) => {
    switch ((weather || '').toLowerCase()) {
      case 'sol':
      case 'ensolarado':
        return <Sun size={size} color={C.amber} />
      case 'chuva':
      case 'chuvoso':
        return <CloudRain size={size} color={C.inkSoft} />
      case 'nublado':
        return <Cloud size={size} color="#9CA3AF" />
      default:
        return <Sun size={size} color="#FFE500" />
    }
  }

  const handleCreateRdo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newObraId || !newResponsavel) return
    if (isCreatingRdo) return

    setIsCreatingRdo(true)
    try {
      // Trava de duplicidade: verifica se ja existe RDO para esta mesma obra nesta mesma data
      const { data: existingRdo } = await supabase
        .from('rdos')
        .select('id')
        .eq('obra_id', newObraId)
        .eq('data', newData)
        .limit(1)

      if (existingRdo && existingRdo.length > 0) {
        toast('Atenção: Já existe um Diário de Obra lançado para esta obra nesta mesma data!', 'error')
        return
      }

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
        efetivo_terceiros: temTerceirizados ? (parseInt(newEfetivoTerceiros) || 0) : 0,
        status: 'Rascunho',
        resumo: newResumo || `Diário preenchido por ${newResponsavel}.`,
        ocorrencias: newOcorrencias || null,
        definicao_servico: newDefinicaoServico || null,
        liberacoes: newLiberacoes || null
      }).select().single()

      if (rdoErr || !rdoData) {
        toast('Erro ao criar diário de obra: ' + (rdoErr?.message || ''), 'error')
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

      if (temTerceirizados) {
        const validTerceiros = newTerceiros.filter(item => item.empresa_nome.trim() !== '')
        if (validTerceiros.length > 0) {
          await supabase.from('rdo_efetivos_terceiros').insert(validTerceiros.map(item => ({
            rdo_id: rdoData.id,
            empresa_nome: item.empresa_nome.trim(),
            funcao: item.funcao.trim() || null,
            quantidade: parseInt(item.quantidade) || 1,
            observacoes: item.observacoes.trim() || null,
            pagamento_status: 'pendente'
          })))
        }
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
      setTemTerceirizados(false)
      setNewEfetivoTerceiros('0')
      setNewTerceiros([{ empresa_nome: '', funcao: '', quantidade: '1', observacoes: '' }])
      setNewPlanejadoExecutado([{ servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])
      setEquipForm([{ nome: '', status: 'OPERANDO' }])

      // Refresh
      await loadData()
    } catch (err: any) {
      toast('Falha ao criar RDO: ' + (err.message || 'Erro inesperado'), 'error')
    } finally {
      setIsCreatingRdo(false)
    }
  }

  async function handleUpdateRdo() {
    if (!selectedRdo) return
    setSavingEdit(true)
    try {
      // Build diff for history
      const campos: HistoricoEdicao['campos'] = []
      const check = (campo: string, antes: string, depois: string) => { if (antes !== depois) campos.push({ campo, antes, depois }) }
      check('Resumo', selectedRdo.resumo ?? '', editGeral.resumo)
      check('Ocorrências', selectedRdo.ocorrencias ?? '', editGeral.ocorrencias)
      check('Responsável', selectedRdo.responsavel ?? '', editGeral.responsavel)
      check('Cargo', selectedRdo.cargo ?? '', editGeral.cargo)
      check('CREA', selectedRdo.crea ?? '', editGeral.crea)
      check('Clima Manhã', selectedRdo.clima_manha ?? '', editGeral.clima_manha)
      check('Clima Tarde', selectedRdo.clima_tarde ?? '', editGeral.clima_tarde)
      check('Cond. Solo', selectedRdo.condicao_solo ?? '', editGeral.condicao_solo)
      check('Efetivo Próprio', String(selectedRdo.efetivo_proprio ?? 0), editGeral.efetivo_proprio)
      check('Efetivo Terceiros', String(selectedRdo.efetivo_terceiros ?? 0), editGeral.efetivo_terceiros)
      check('Def. Serviços', selectedRdo.definicao_servico ?? '', editGeral.definicao_servico)
      check('Liberações', selectedRdo.liberacoes ?? '', editGeral.liberacoes)

      const novaEntrada: HistoricoEdicao = {
        id: crypto.randomUUID(),
        data: new Date().toISOString(),
        autor: colaboradorAtivo?.nome ?? 'Usuário',
        resumo_alteracao: campos.length > 0 ? `${campos.length} campo(s) alterado(s)` : 'Atividades/equipamentos atualizados',
        campos,
      }
      const historicoAtual: HistoricoEdicao[] = Array.isArray((selectedRdo as any).historico_edicoes) ? (selectedRdo as any).historico_edicoes : []

      const { error } = await supabase.from('rdos').update({
        resumo: editGeral.resumo || null,
        ocorrencias: editGeral.ocorrencias || null,
        responsavel: editGeral.responsavel,
        cargo: editGeral.cargo || null,
        crea: editGeral.crea || null,
        clima_manha: editGeral.clima_manha,
        clima_tarde: editGeral.clima_tarde,
        condicao_solo: editGeral.condicao_solo,
        efetivo_proprio: parseInt(editGeral.efetivo_proprio) || 0,
        efetivo_terceiros: parseInt(editGeral.efetivo_terceiros) || 0,
        definicao_servico: editGeral.definicao_servico || null,
        liberacoes: editGeral.liberacoes || null,
        historico_edicoes: [...historicoAtual, novaEntrada],
        updated_at: new Date().toISOString(),
      }).eq('id', selectedRdo.id)
      if (error) throw error

      // Atividades: delete all + re-insert
      await supabase.from('rdo_atividades').delete().eq('rdo_id', selectedRdo.id)
      const validActs = editAtividades.filter(a => a.trim())
      if (validActs.length) await supabase.from('rdo_atividades').insert(validActs.map(desc => ({ rdo_id: selectedRdo.id, descricao: desc })))

      // Equipamentos: delete all + re-insert
      await supabase.from('rdo_equipamentos').delete().eq('rdo_id', selectedRdo.id)
      const validEquips = editEquipamentos.filter(eq => eq.nome.trim())
      if (validEquips.length) await supabase.from('rdo_equipamentos').insert(validEquips.map(eq => ({ rdo_id: selectedRdo.id, nome: eq.nome, status: eq.status })))

      // Planejado×Executado: delete all + re-insert
      await supabase.from('rdo_planejado_executado').delete().eq('rdo_id', selectedRdo.id)
      const validPlan = editPlanejado.filter(p => p.servico.trim())
      if (validPlan.length) await supabase.from('rdo_planejado_executado').insert(validPlan.map(p => ({ rdo_id: selectedRdo.id, servico: p.servico.trim(), unidade: p.unidade || null, quantidade_planejada: parseFloat(p.planejada) || 0, quantidade_executada: parseFloat(p.executada) || 0, observacoes: p.observacoes || null })))

      toast('RDO atualizado com sucesso!', 'success')
      setEditMode(false)
      await loadData(true)
    } catch (err: unknown) {
      toast('Erro ao salvar: ' + (err instanceof Error ? err.message : 'falha'), 'error')
    } finally {
      setSavingEdit(false)
    }
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
    if (!(await confirm('Atenção', 'Deseja realmente excluir este Diário de Obra (RDO)? Esta ação não pode ser desfeita.', { confirmLabel: 'Excluir', confirmColor: '#EF4444' }))) return

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
      <PageTitle
        modulo="Escout"
        titulo="Diário de Obra Digital"
        subtitle="Registro diário de avanço físico, condições meteorológicas, efetivo de canteiro e controle de qualidade."
        action={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreateOpen(true)}
            style={{
              background: '#F59E0B',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: 4,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
            }}
          >
            <Plus size={16} strokeWidth={3} />
            Novo Diário de Obra
          </motion.button>
        }
      />

      {/* KPI Top Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ background: 'rgba(255, 229, 0, 0.15)', border: '1px solid rgba(255, 229, 0, 0.3)', padding: 10, borderRadius: 6 }}>
            <FileText size={20} color={C.amber} />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total de Diários</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{stats.totalMes}</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: 10, borderRadius: 6 }}>
            <Calendar size={20} color={C.amber} />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emitidos Hoje</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{stats.emitidosHoje}</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: 10, borderRadius: 6 }}>
            <Users size={20} color="#10B981" />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Efetivo no RDO Atual</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{stats.totalEfetivo} colab.</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: 10, borderRadius: 6 }}>
            <Clock size={20} color="#F59E0B" />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendentes Assinatura</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: stats.pendentes > 0 ? '#F59E0B' : '#10B981', lineHeight: 1.2 }}>{stats.pendentes}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: C.inkSoft, gap: 12 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Carregando diários de obra...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List Section (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <Panel
              title={`Histórico de Emissões (${filteredRdos.length})`}
              action={
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['todos', 'hoje', '7dias', 'mes'] as const).map(preset => (
                    <button
                      key={preset}
                      onClick={() => setFilterDatePreset(preset)}
                      style={{
                        background: filterDatePreset === preset ? C.amber : C.bgWhite,
                        color: filterDatePreset === preset ? '#0A0A0A' : C.inkSoft,
                        border: `1px solid ${filterDatePreset === preset ? C.amber : C.border}`,
                        borderRadius: 3,
                        padding: '3px 8px',
                        fontSize: 9.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                    >
                      {preset === '7dias' ? '7 dias' : preset === 'mes' ? 'Mês' : preset}
                    </button>
                  ))}
                </div>
              }
            >
              {/* Search & Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    style={{ ...inputStyle, paddingLeft: 32 }}
                    placeholder="Buscar por diário, obra, responsável..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '7px 10px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.inkSoft, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={filteredRdos.length > 0 && selectedRdoIds.length === filteredRdos.length}
                    onChange={toggleSelectAllFiltered}
                    style={{ cursor: 'pointer', accentColor: '#F59E0B' }}
                  />
                  <span style={{ fontWeight: 600 }}>Selecionar todos ({filteredRdos.length})</span>
                </label>
                {selectedRdoIds.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={triggerPrintBatch}
                      style={{
                        background: C.bgCard,
                        color: C.ink,
                        border: `1px solid ${C.border}`,
                        borderRadius: 3,
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer'
                      }}
                    >
                      <Printer size={12} /> Imprimir ({selectedRdoIds.length})
                    </button>
                    <button
                      onClick={handleDeleteBatch}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#F87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 3,
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={12} /> Excluir ({selectedRdoIds.length})
                    </button>
                  </div>
                )}
              </div>

              {/* RDO List Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 280px)', minHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                {filteredRdos.map(r => {
                  const active = selectedRdo?.id === r.id
                  const isChecked = selectedRdoIds.includes(r.id)
                  const totalColab = Number(r.efetivo_proprio || 0) + Number(r.efetivo_terceiros || 0)
                  const qtdFotos = r.fotos?.length || 0

                  return (
                    <motion.div
                      key={r.id}
                      whileHover={{ x: 2, scale: 1.005 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => setSelectedRdo(r)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        borderRadius: 6,
                        background: active ? C.amberDim : C.bgCard,
                        border: `1px solid ${active ? C.amber : C.border}`,
                        borderLeft: `4px solid ${active ? C.amber : r.status === 'Aprovado' ? C.green : C.amber}`,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 0 0 1px rgba(245, 158, 11, 0.2), 0 4px 16px rgba(0, 0, 0, 0.06)' : '0 1px 3px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      {/* Top Row: Date, Checkbox, Status & Delete */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              onClick={(e) => toggleSelectRdo(r.id, e)}
                              style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#F59E0B' }}
                            />
                          </div>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 900,
                            color: active ? C.amber : C.ink,
                            background: C.bgWhite,
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`
                          }}>
                            <Calendar size={11} color="#FFE500" />
                            {new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: r.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: r.status === 'Aprovado' ? '#10B981' : '#F59E0B',
                            border: `1px solid ${r.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            letterSpacing: '0.04em'
                          }}>
                            {r.status === 'Aprovado' ? '✓ APROVADO' : '● RASCUNHO'}
                          </span>
                          <button
                            onClick={(e) => handleDeleteRdo(r.id, e)}
                            title="Excluir RDO"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 3 }}
                            className="hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Obra Name */}
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: C.ink, letterSpacing: '0.01em', marginTop: 2 }}>
                        {r.obra?.nome ?? 'Obra não informada'}
                      </div>

                      {/* Indicators Row: Clima, Efetivo, Fotos, Responsavel */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 11, color: C.inkSoft }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, padding: '2px 7px', borderRadius: 3, border: `1px solid ${C.border}` }}>
                          {getWeatherIcon(r.clima_manha, 12)}
                          <span style={{ color: C.ink }}>{r.clima_manha}</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, padding: '2px 7px', borderRadius: 3, border: `1px solid ${C.border}` }}>
                          <Users size={11} color="#10B981" />
                          <span style={{ color: C.ink }}>{totalColab} colab.</span>
                        </span>
                        {qtdFotos > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.bgWhite, padding: '2px 7px', borderRadius: 3, border: `1px solid ${C.border}`, color: C.inkSoft }}>
                            <Camera size={11} color={C.amber} />
                            <span style={{ color: C.ink }}>{qtdFotos} fotos</span>
                          </span>
                        )}
                        {r.responsavel && (
                          <span style={{ fontSize: 10.5, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                            👤 {r.responsavel}
                          </span>
                        )}
                      </div>

                      {/* Brief narrative preview */}
                      {r.resumo && (
                        <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 10px', fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>
                          <TextoExpandivel text={r.resumo} maxLength={85} textColor={C.inkSoft} />
                        </div>
                      )}
                    </motion.div>
                  )
                })}
                {filteredRdos.length === 0 && (
                  <div style={{ padding: '40px 15px', textAlign: 'center', color: C.inkSoft, fontSize: 12, background: C.bgCard, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                    Nenhum diário de obra encontrado com os filtros selecionados.
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Details Section (7 Cols) */}
          <div className="lg:col-span-7 rdo-detail-scroll">
            {selectedRdo ? (
              <Panel
                title={`RDO: ${selectedRdo.obra?.nome || 'Obra'} — ${new Date(selectedRdo.data + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                action={
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!editMode ? (
                      <>
                        <button
                          onClick={() => openEditMode(selectedRdo)}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#F59E0B',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Edit3 size={13} /> Editar
                        </button>
                        <button
                          onClick={() => triggerPrintSingle(selectedRdo)}
                          style={{
                            background: C.bgCard,
                        color: C.ink,
                        border: `1px solid ${C.border}`,
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Printer size={13} /> Imprimir A4
                        </button>
                        {selectedRdo.status !== 'Aprovado' && (
                          <button
                            onClick={() => handleSignDigital(selectedRdo.id)}
                            style={{
                              background: '#10B981',
                              color: '#0A0A0A',
                              border: 'none',
                              borderRadius: 4,
                              fontWeight: 900,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 14px',
                              fontSize: 11,
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <Check size={14} strokeWidth={3} /> Assinar
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditMode(false)}
                          style={{
                            background: 'none',
                            border: `1px solid ${C.border}`,
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            fontSize: 11,
                            cursor: 'pointer',
                            color: C.inkSoft
                          }}
                        >
                          <X size={13} /> Cancelar
                        </button>
                        <button
                          onClick={() => void handleUpdateRdo()}
                          disabled={savingEdit}
                          style={{
                            background: '#F59E0B',
                            color: '#0A0A0A',
                            border: 'none',
                            borderRadius: 4,
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 14px',
                            fontSize: 11,
                            cursor: 'pointer',
                            opacity: savingEdit ? 0.6 : 1
                          }}
                        >
                          <Save size={13} /> {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </>
                    )}
                  </div>
                }
              >
                {/* RDO Document Render */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Document Official Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 12, height: 4, background: C.ink, borderRadius: 1 }} />
                        <div style={{ width: 12, height: 4, background: '#FFE500', borderRadius: 1 }} />
                        <span style={{ fontSize: 9.5, fontWeight: 900, color: '#FFE500', letterSpacing: '0.1em' }}>JWA ENGENHARIA</span>
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: C.ink, textTransform: 'uppercase', margin: 0 }}>
                        {selectedRdo.obra?.nome ?? 'Obra sem nome'}
                      </h3>
                      {editMode ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                          <div><span style={labelStyle}>Responsável</span><input style={inputStyle} value={editGeral.responsavel} onChange={e => setEditGeral(f => ({ ...f, responsavel: e.target.value }))} /></div>
                          <div><span style={labelStyle}>Cargo</span><input style={inputStyle} value={editGeral.cargo} onChange={e => setEditGeral(f => ({ ...f, cargo: e.target.value }))} /></div>
                          <div><span style={labelStyle}>CREA</span><input style={inputStyle} value={editGeral.crea} onChange={e => setEditGeral(f => ({ ...f, crea: e.target.value }))} /></div>
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
                          Responsável Técnico: <strong style={{ color: C.ink }}>{selectedRdo.responsavel}</strong> {selectedRdo.cargo ? `· ${selectedRdo.cargo}` : ''} {selectedRdo.crea ? `· CREA: ${selectedRdo.crea}` : ''}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block',
                        background: selectedRdo.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        border: `1px solid ${selectedRdo.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                        color: selectedRdo.status === 'Aprovado' ? '#10B981' : '#F59E0B',
                        fontSize: 10,
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: 3,
                        marginBottom: 4
                      }}>
                        {selectedRdo.status.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>
                        {new Date(selectedRdo.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Conditions & Weather Cards */}
                  {editMode ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                      <div><span style={labelStyle}>Clima Manhã</span><select style={inputStyle} value={editGeral.clima_manha} onChange={e => setEditGeral(f => ({ ...f, clima_manha: e.target.value }))}><option>Sol</option><option>Nublado</option><option>Chuva</option></select></div>
                      <div><span style={labelStyle}>Clima Tarde</span><select style={inputStyle} value={editGeral.clima_tarde} onChange={e => setEditGeral(f => ({ ...f, clima_tarde: e.target.value }))}><option>Sol</option><option>Nublado</option><option>Chuva</option></select></div>
                      <div><span style={labelStyle}>Solo</span><select style={inputStyle} value={editGeral.condicao_solo} onChange={e => setEditGeral(f => ({ ...f, condicao_solo: e.target.value }))}><option>Seco</option><option>Lama</option><option>Úmido</option></select></div>
                      <div><span style={labelStyle}>Ef. Próprio</span><input type="number" style={inputStyle} value={editGeral.efetivo_proprio} onChange={e => setEditGeral(f => ({ ...f, efetivo_proprio: e.target.value }))} /></div>
                      <div><span style={labelStyle}>Ef. Terc.</span><input type="number" style={inputStyle} value={editGeral.efetivo_terceiros} onChange={e => setEditGeral(f => ({ ...f, efetivo_terceiros: e.target.value }))} /></div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <div style={cardIndustrial}>
                        <span style={labelStyle}>Clima Manhã / Tarde</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: C.ink }}>
                            {getWeatherIcon(selectedRdo.clima_manha)} {selectedRdo.clima_manha} (M)
                          </div>
                          <span style={{ color: C.border }}>|</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: C.ink }}>
                            {getWeatherIcon(selectedRdo.clima_tarde)} {selectedRdo.clima_tarde} (T)
                          </div>
                        </div>
                      </div>

                      <div style={cardIndustrial}>
                        <span style={labelStyle}>Condição do Solo</span>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginTop: 4 }}>
                          {selectedRdo.condicao_solo || 'Seco'}
                        </div>
                      </div>

                      <div style={cardIndustrial}>
                        <span style={labelStyle}>Efetivo Total</span>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                          {Number(selectedRdo.efetivo_proprio || 0) + Number(selectedRdo.efetivo_terceiros || 0)} colaboradores
                        </div>
                        <span style={{ fontSize: 10, color: C.inkSoft }}>
                          ({selectedRdo.efetivo_proprio || 0} próprios, {selectedRdo.efetivo_terceiros || 0} terc.)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Resumo do Dia & Ocorrências */}
                  {editMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div><span style={labelStyle}>Relato do dia</span><textarea rows={3} style={inputStyle} value={editGeral.resumo} onChange={e => setEditGeral(f => ({ ...f, resumo: e.target.value }))} /></div>
                      <div><span style={labelStyle}>Ocorrências</span><textarea rows={2} style={inputStyle} value={editGeral.ocorrencias} onChange={e => setEditGeral(f => ({ ...f, ocorrencias: e.target.value }))} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div><span style={labelStyle}>Def. de Serviços</span><textarea rows={2} style={inputStyle} value={editGeral.definicao_servico} onChange={e => setEditGeral(f => ({ ...f, definicao_servico: e.target.value }))} /></div>
                        <div><span style={labelStyle}>Liberações</span><textarea rows={2} style={inputStyle} value={editGeral.liberacoes} onChange={e => setEditGeral(f => ({ ...f, liberacoes: e.target.value }))} /></div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedRdo.resumo && (
                        <div style={cardIndustrial}>
                          <span style={labelStyle}>Relato Operacional do Dia</span>
                          <div style={{ marginTop: 4 }}>
                            <TextoExpandivel text={selectedRdo.resumo} maxLength={220} />
                          </div>
                        </div>
                      )}

                      {selectedRdo.ocorrencias && (
                        <div style={{ ...cardIndustrial, background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertTriangle size={14} color="#EF4444" />
                            <span style={{ ...labelStyle, color: '#EF4444', marginBottom: 0 }}>Ocorrências & Intercorrências</span>
                          </div>
                          <TextoExpandivel text={selectedRdo.ocorrencias} maxLength={200} textColor="#FCA5A5" />
                        </div>
                      )}

                      {(selectedRdo.definicao_servico || selectedRdo.liberacoes) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {selectedRdo.definicao_servico && (
                            <div style={cardIndustrial}>
                              <span style={labelStyle}>Definição de Serviços</span>
                              <TextoExpandivel text={selectedRdo.definicao_servico} maxLength={120} />
                            </div>
                          )}
                          {selectedRdo.liberacoes && (
                            <div style={cardIndustrial}>
                              <span style={labelStyle}>Liberações Técnicas</span>
                              <TextoExpandivel text={selectedRdo.liberacoes} maxLength={120} />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Activities List */}
                  <div style={cardIndustrial}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={labelStyle}>Atividades Realizadas</span>
                      {editMode && (
                        <button type="button" onClick={() => setEditAtividades(a => [...a, ''])} style={{ fontSize: 10, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>
                          + Adicionar Atividade
                        </button>
                      )}
                    </div>

                    {editMode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {editAtividades.map((a, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6 }}>
                            <input style={{ ...inputStyle, flex: 1 }} value={a} onChange={e => setEditAtividades(arr => arr.map((x, j) => j === i ? e.target.value : x))} placeholder={`Atividade ${i + 1}`} />
                            <button type="button" onClick={() => setEditAtividades(arr => arr.filter((_, j) => j !== i))} style={{ color: '#F87171', background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {selectedRdo.atividades?.map((a, i) => (
                          <div key={i} style={{ fontSize: 12, color: C.ink, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFE500', marginTop: 6, flexShrink: 0 }} />
                            <span>{a.descricao}</span>
                          </div>
                        ))}
                        {(!selectedRdo.atividades || selectedRdo.atividades.length === 0) && (
                          <p style={{ fontSize: 11, color: C.inkSoft, margin: 0 }}>Nenhuma atividade registrada.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Planned vs Executed Services */}
                  {((selectedRdo as any).planejado_executado?.length > 0 || editMode) && (
                    <div style={cardIndustrial}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={labelStyle}>Planejado vs Executado</span>
                        {editMode && (
                          <button type="button" onClick={() => setEditPlanejado(p => [...p, { servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])} style={{ fontSize: 10, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>
                            + Adicionar Meta
                          </button>
                        )}
                      </div>

                      {editMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {editPlanejado.map((p, i) => (
                            <div key={i} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, padding: 8 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 30px', gap: 6, marginBottom: 6 }}>
                                <input style={inputStyle} value={p.servico} onChange={e => setEditPlanejado(arr => arr.map((x, j) => j === i ? { ...x, servico: e.target.value } : x))} placeholder="Serviço" />
                                <input style={inputStyle} value={p.unidade} onChange={e => setEditPlanejado(arr => arr.map((x, j) => j === i ? { ...x, unidade: e.target.value } : x))} placeholder="Unidade" />
                                <input style={inputStyle} type="number" value={p.planejada} onChange={e => setEditPlanejado(arr => arr.map((x, j) => j === i ? { ...x, planejada: e.target.value } : x))} placeholder="Planejado" />
                                <input style={inputStyle} type="number" value={p.executada} onChange={e => setEditPlanejado(arr => arr.map((x, j) => j === i ? { ...x, executada: e.target.value } : x))} placeholder="Executado" />
                                <button type="button" onClick={() => setEditPlanejado(arr => arr.filter((_, j) => j !== i))} style={{ color: '#F87171', background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
                              </div>
                              <input style={inputStyle} value={p.observacoes} onChange={e => setEditPlanejado(arr => arr.map((x, j) => j === i ? { ...x, observacoes: e.target.value } : x))} placeholder="Observações (opcional)" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(selectedRdo as any).planejado_executado?.map((item: any) => {
                            const planned = Number(item.quantidade_planejada) || 0
                            const executed = Number(item.quantidade_executada) || 0
                            const percentage = planned > 0 ? Math.min(100, (executed / planned) * 100) : 0

                            return (
                              <div key={item.id} style={{ padding: 10, background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                                  <strong style={{ color: C.ink }}>{item.servico}</strong>
                                  <span style={{ fontWeight: 700, color: percentage >= 100 ? '#10B981' : '#F59E0B' }}>
                                    {executed} / {planned} {item.unidade || ''} ({percentage.toFixed(1)}%)
                                  </span>
                                </div>
                                <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${percentage}%`, height: '100%', background: percentage >= 100 ? '#10B981' : '#F59E0B', transition: 'width 0.3s ease' }} />
                                </div>
                                {item.observacoes && <small style={{ display: 'block', marginTop: 5, color: C.inkSoft }}>{item.observacoes}</small>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Equipments Section */}
                  <div style={cardIndustrial}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={labelStyle}>Equipamentos em Canteiro</span>
                      {editMode && (
                        <button type="button" onClick={() => setEditEquipamentos(e => [...e, { nome: '', status: 'OPERANDO' }])} style={{ fontSize: 10, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>
                          + Adicionar Equipamento
                        </button>
                      )}
                    </div>

                    {editMode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {editEquipamentos.map((eq, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 30px', gap: 6 }}>
                            <input style={inputStyle} value={eq.nome} onChange={e => setEditEquipamentos(arr => arr.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} placeholder="Nome do equipamento" />
                            <select style={inputStyle} value={eq.status} onChange={e => setEditEquipamentos(arr => arr.map((x, j) => j === i ? { ...x, status: e.target.value as any } : x))}>
                              <option value="OPERANDO">OPERANDO</option>
                              <option value="PARADO">PARADO</option>
                              <option value="MANUTENÇÃO">MANUTENÇÃO</option>
                            </select>
                            <button type="button" onClick={() => setEditEquipamentos(arr => arr.filter((_, j) => j !== i))} style={{ color: '#F87171', background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                        {selectedRdo.equipamentos?.map((eq, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11 }}>
                            <span style={{ color: C.ink, fontWeight: 700 }}>{eq.nome}</span>
                            <span style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 3,
                              color: eq.status === 'OPERANDO' ? '#10B981' : eq.status === 'PARADO' ? '#EF4444' : '#F59E0B',
                              background: eq.status === 'OPERANDO' ? 'rgba(16, 185, 129, 0.1)' : eq.status === 'PARADO' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'
                            }}>
                              {eq.status}
                            </span>
                          </div>
                        ))}
                        {(!selectedRdo.equipamentos || selectedRdo.equipamentos.length === 0) && (
                          <p style={{ fontSize: 11, color: C.inkSoft, margin: 0 }}>Nenhum equipamento registrado.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Subcontractor Team Log */}
                  {(selectedRdo as any).terceiros?.length > 0 && (
                    <div style={cardIndustrial}>
                      <span style={labelStyle}>Efetivo Terceirizado ({((selectedRdo as any).terceiros?.length)} equipes)</span>
                      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                        {(selectedRdo as any).terceiros.map((item: any) => (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 70px 100px 100px', gap: 8, alignItems: 'center', padding: '7px 10px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11 }}>
                            <strong style={{ color: C.ink }}>{item.empresa_nome}</strong>
                            <span style={{ color: C.inkSoft }}>{item.funcao || '—'}</span>
                            <span style={{ color: C.ink }}>{item.quantidade} col.</span>
                            <span style={{ color: C.inkSoft }}>{item.valor_diaria ? `R$ ${Number(item.valor_diaria).toFixed(2)}` : '—'}</span>
                            <span style={{ color: item.pagamento_status === 'pago' ? '#10B981' : '#F59E0B', fontWeight: 800 }}>
                              {item.pagamento_status?.toUpperCase() || 'PENDENTE'}
                            </span>
                            {item.observacoes && <small style={{ gridColumn: '1 / -1', color: C.inkSoft }}>Obs: {item.observacoes}</small>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photo Gallery & Evidence */}
                  <div style={cardIndustrial}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={labelStyle}>📷 Registro Fotográfico de Campo ({selectedRdo.fotos?.length || 0})</span>
                      <label style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={12} /> Anexar Fotos
                        <input
                          hidden
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          onChange={e => {
                            if (e.target.files && e.target.files.length > 0) {
                              void (async () => {
                                const filesArray = Array.from(e.target.files || [])
                                let count = 0
                                for (const file of filesArray) {
                                  const path = `${selectedRdo.obra_id}/${selectedRdo.id}/${crypto.randomUUID()}-${file.name}`
                                  const { error: uploadError } = await supabase.storage.from('rdo-fotos').upload(path, file)
                                  if (!uploadError) {
                                    await supabase.from('fotos').insert({
                                      obra_id: selectedRdo.obra_id,
                                      rdo_id: selectedRdo.id,
                                      legenda: file.name,
                                      imagem_url: path,
                                      data_iso: selectedRdo.data
                                    })
                                    count++
                                  }
                                }
                                if (count > 0) {
                                  toast(`${count} anexo(s) adicionado(s)!`, 'success')
                                  void loadData()
                                }
                              })()
                              e.currentTarget.value = ''
                            }
                          }}
                        />
                      </label>
                    </div>

                    {selectedRdo.fotos && selectedRdo.fotos.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                        {selectedRdo.fotos.map(foto => {
                          const url = foto.imagem_url?.startsWith('http')
                            ? foto.imagem_url
                            : foto.imagem_url
                              ? supabase.storage.from(foto.imagem_url.includes('comprovantes') ? 'comprovantes' : 'rdo-fotos').getPublicUrl(foto.imagem_url).data.publicUrl
                              : ''
                          if (!url) return null
                          const isPdf = foto.imagem_url?.toLowerCase().endsWith('.pdf') || foto.legenda?.toLowerCase().endsWith('.pdf')

                          return (
                            <div
                              key={foto.id}
                              style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', padding: 6, position: 'relative' }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void (async () => {
                                    const { error } = await supabase.from('fotos').delete().eq('id', foto.id)
                                    if (!error) {
                                      toast('Anexo removido do RDO.', 'success')
                                      void loadData()
                                    }
                                  })()
                                }}
                                title="Excluir este anexo"
                                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', border: 'none', color: '#F87171', borderRadius: 3, padding: 3, cursor: 'pointer', zIndex: 5, display: 'flex', alignItems: 'center' }}
                              >
                                <Trash2 size={12} />
                              </button>

                              {isPdf ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, background: C.bgWhite, borderRadius: 2 }}
                                >
                                  <FileText size={24} color="#F59E0B" />
                                  <span style={{ fontSize: 9.5, color: C.ink, marginTop: 4, fontWeight: 700 }}>Documento PDF ↗</span>
                                </a>
                              ) : (
                                <img
                                  src={url}
                                  alt={foto.legenda || 'Foto RDO'}
                                  onClick={() => setFotoExpandida({ url, legenda: foto.legenda || 'Foto do RDO' })}
                                  style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 2, cursor: 'pointer' }}
                                  title="Clique para expandir"
                                />
                              )}
                              <span style={{ fontSize: 9.5, color: C.inkSoft, display: 'block', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {foto.legenda || 'Foto em campo'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p style={{ fontSize: 11, color: C.inkSoft, margin: 0 }}>Nenhuma evidência fotográfica anexada.</p>
                    )}
                  </div>

                  {/* Digital Signature & Certification Stamp */}
                  <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>
                    {selectedRdo.status === 'Aprovado' && selectedRdo.assinatura_at ? (
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 10, borderRadius: '50%' }}>
                          <ShieldCheck size={24} color="#10B981" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#10B981', letterSpacing: '0.04em' }}>
                            DOCUMENTO AUTENTICADO E ASSINADO DIGITALMENTE
                          </div>
                          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                            Assinado por: <strong style={{ color: C.ink }}>{selectedRdo.assinado_por || selectedRdo.responsavel}</strong> · IP: {selectedRdo.assinatura_ip} · Data: {new Date(selectedRdo.assinatura_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#F59E0B', fontSize: 12, fontWeight: 700 }}>
                          <Clock size={16} />
                          Documento em rascunho — aguardando validação e assinatura do Responsável Técnico.
                        </div>
                        <button
                          onClick={() => handleSignDigital(selectedRdo.id)}
                          style={{
                            background: '#F59E0B',
                            color: '#0A0A0A',
                            border: 'none',
                            borderRadius: 4,
                            fontWeight: 900,
                            padding: '6px 14px',
                            fontSize: 11,
                            cursor: 'pointer'
                          }}
                        >
                          Assinar Agora
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Change History Timeline */}
                  {(() => {
                    const historico: HistoricoEdicao[] = Array.isArray((selectedRdo as any).historico_edicoes) ? (selectedRdo as any).historico_edicoes : []
                    const criacao: HistoricoEdicao = {
                      id: 'criacao',
                      data: selectedRdo.created_at ?? new Date().toISOString(),
                      autor: selectedRdo.responsavel ?? 'Sistema',
                      resumo_alteracao: 'RDO criado',
                      campos: []
                    }
                    const timeline = [criacao, ...historico].reverse()
                    return (
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <History size={14} color="#F59E0B" />
                          <span style={{ fontSize: 10, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Histórico de Alterações</span>
                          <span style={{ fontSize: 9.5, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1px 6px', borderRadius: 3 }}>
                            {timeline.length} registro(s)
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                          {timeline.map((item, idx) => (
                            <div key={item.id} style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: idx === 0 ? C.amber : C.border, marginTop: 5, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <strong style={{ color: idx === 0 ? '#FFE500' : C.ink }}>{item.resumo_alteracao}</strong>
                                  <span style={{ fontSize: 10, color: C.inkSoft }}>{new Date(item.data).toLocaleString('pt-BR')}</span>
                                </div>
                                <span style={{ fontSize: 10, color: C.inkSoft }}>por {item.autor}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                </div>
              </Panel>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: C.inkSoft, fontSize: 13, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                Selecione um diário de obra na coluna ao lado para visualizar os detalhes completos.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div
            onWheel={event => event.stopPropagation()}
            onTouchMove={event => event.stopPropagation()}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              background: 'rgba(5, 6, 8, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflow: 'hidden',
              overscrollBehavior: 'none'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                width: '100%',
                maxWidth: 780,
                maxHeight: 'calc(100dvh - 32px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                scrollbarGutter: 'stable',
                boxSizing: 'border-box',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 229, 0, 0.15)'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 12, height: 4, background: C.ink, borderRadius: 1 }} />
                    <div style={{ width: 12, height: 4, background: '#FFE500', borderRadius: 1 }} />
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#FFE500', letterSpacing: '0.1em' }}>JWA ENGENHARIA</span>
                    <span style={{ fontSize: 10, color: '#4B5563' }}>•</span>
                    <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700 }}>MÓDULO ESCOUT</span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: C.ink, textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>
                    Novo Diário de Obra Digital
                  </h2>
                  <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '3px 0 0' }}>
                    Registro diário de conformidade técnica, condições de canteiro e avanço físico.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '6px',
                    color: C.inkSoft,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  title="Fechar (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Stepper / Tabs Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: C.bgWhite, padding: 4, borderRadius: 6, border: `1px solid ${C.border}` }}>
                {[
                  { id: 'geral', label: '1. Geral & Clima', icon: <Sun size={13} /> },
                  { id: 'recursos', label: '2. Efetivo & Equipamentos', icon: <Users size={13} /> },
                  { id: 'atividades', label: '3. Metas, Avanço & Fotos', icon: <Camera size={13} /> },
                ].map(tab => {
                  const active = formTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormTab(tab.id as any)}
                      style={{
                        background: active ? C.bgPanel : 'transparent',
                        border: `1px solid ${active ? C.amber : 'transparent'}`,
                        borderRadius: 4,
                        color: active ? C.amber : C.inkSoft,
                        padding: '8px 10px',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreateRdo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {formTab === 'geral' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Card: Obra & Responsável */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Building size={14} color="#F59E0B" />
                        <span style={labelStyle}>Identificação da Obra & Responsabilidade Técnica</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={labelStyle}>Obra *</label>
                          <select
                            value={newObraId}
                            onChange={e => setNewObraId(e.target.value)}
                            style={{ ...inputStyle, background: C.bgCard }}
                          >
                            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Data da Emissão *</label>
                          <input
                            type="date"
                            value={newData}
                            onChange={e => setNewData(e.target.value)}
                            style={{ ...inputStyle, background: C.bgCard }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={labelStyle}>Responsável Técnico *</label>
                          <input
                            type="text"
                            placeholder="Nome do engenheiro ou técnico"
                            value={newResponsavel}
                            onChange={e => setNewResponsavel(e.target.value)}
                            style={{ ...inputStyle, background: C.bgCard }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Cargo / Função</label>
                          <input
                            type="text"
                            placeholder="Ex: Engenheiro Residente"
                            value={newCargo}
                            onChange={e => setNewCargo(e.target.value)}
                            style={{ ...inputStyle, background: C.bgCard }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>CREA / Registro</label>
                          <input
                            type="text"
                            placeholder="Ex: 506987452-SP"
                            value={newCrea}
                            onChange={e => setNewCrea(e.target.value)}
                            style={{ ...inputStyle, background: C.bgCard }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card: Clima & Solo */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Sun size={14} color="#FFE500" />
                        <span style={labelStyle}>Condições Meteorológicas & Canteiro</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        <div>
                          <label style={labelStyle}>Clima Manhã</label>
                          <select value={newClimaManha} onChange={e => setNewClimaManha(e.target.value)} style={{ ...inputStyle, background: C.bgCard }}>
                            <option value="Sol">☀️ Ensolarado / Sol</option>
                            <option value="Nublado">☁️ Nublado</option>
                            <option value="Chuva">🌧️ Chuvoso</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Clima Tarde</label>
                          <select value={newClimaTarde} onChange={e => setNewClimaTarde(e.target.value)} style={{ ...inputStyle, background: C.bgCard }}>
                            <option value="Sol">☀️ Ensolarado / Sol</option>
                            <option value="Nublado">☁️ Nublado</option>
                            <option value="Chuva">🌧️ Chuvoso</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Condição do Solo</label>
                          <select value={newCondicaoSolo} onChange={e => setNewCondicaoSolo(e.target.value)} style={{ ...inputStyle, background: C.bgCard }}>
                            <option value="Seco">Seco / Firme</option>
                            <option value="Úmido">Úmido / Transitável</option>
                            <option value="Lama">Lama / Intransitável</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Card: Relato & Ocorrências */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Relato Operacional do Dia</label>
                        <textarea
                          rows={3}
                          value={newResumo}
                          onChange={e => setNewResumo(e.target.value)}
                          style={{ ...inputStyle, background: C.bgCard, lineHeight: 1.5 }}
                          placeholder="Descreva as principais frentes trabalhadas, avanços do dia e diretrizes técnicas..."
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <AlertTriangle size={12} color="#EF4444" />
                          <label style={{ ...labelStyle, color: '#F87171', marginBottom: 0 }}>Ocorrências / Paralisações / Intercorrências</label>
                        </div>
                        <textarea
                          rows={2}
                          value={newOcorrencias}
                          onChange={e => setNewOcorrencias(e.target.value)}
                          style={{ ...inputStyle, background: C.bgCard, border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444' }}
                          placeholder="Acidentes, atrasos de fornecedores, falta de energia/água ou impedimentos..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formTab === 'recursos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Card: Efetivo */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Users size={14} color="#10B981" />
                        <span style={labelStyle}>Controle de Mão de Obra e Efetivo</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: temTerceirizados ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={labelStyle}>Efetivo Próprio (Colaboradores JWA) *</label>
                          <input
                            type="number"
                            min="0"
                            value={newEfetivoProprio}
                            onChange={e => setNewEfetivoProprio(e.target.value)}
                            style={{ ...inputStyle, background: C.bgCard }}
                          />
                        </div>
                        {temTerceirizados && (
                          <div>
                            <label style={labelStyle}>Total Efetivo Terceirizado</label>
                            <input
                              type="number"
                              min="0"
                              value={newEfetivoTerceiros}
                              onChange={e => setNewEfetivoTerceiros(e.target.value)}
                              style={{ ...inputStyle, background: C.bgCard }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Toggle Terceirizados */}
                      <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={temTerceirizados}
                            onChange={e => {
                              setTemTerceirizados(e.target.checked)
                              if (!e.target.checked) {
                                setNewEfetivoTerceiros('0')
                              } else if (newEfetivoTerceiros === '0') {
                                setNewEfetivoTerceiros('1')
                              }
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#F59E0B' }}
                          />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>Houve equipes ou subempreiteiros terceirizados hoje?</div>
                            <div style={{ fontSize: 10, color: C.inkSoft }}>Habilita a discriminação por empresa e função para auditoria e controle financeiro.</div>
                          </div>
                        </label>
                      </div>

                      {temTerceirizados && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>Subempreiteiros & Empresas</span>
                            <button
                              type="button"
                              onClick={() => setNewTerceiros(items => [...items, { empresa_nome: '', funcao: '', quantidade: '1', observacoes: '' }])}
                              style={{ background: 'none', border: 'none', color: '#F59E0B', fontSize: 10.5, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Plus size={12} /> Adicionar Empresa
                            </button>
                          </div>

                          {newTerceiros.map((item, index) => (
                            <div key={index} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 5, padding: 10, display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 80px auto', gap: 8, alignItems: 'end' }}>
                              <div>
                                <label style={labelStyle}>Empresa *</label>
                                <input
                                  style={{ ...inputStyle, background: C.bgCard }}
                                  placeholder="Nome da empresa"
                                  value={item.empresa_nome}
                                  onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, empresa_nome: e.target.value } : x))}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Função / Frente</label>
                                <input
                                  style={{ ...inputStyle, background: C.bgCard }}
                                  placeholder="Ex: Armação / Instalações"
                                  value={item.funcao}
                                  onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, funcao: e.target.value } : x))}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Qtd.</label>
                                <input
                                  type="number"
                                  min="1"
                                  style={{ ...inputStyle, background: C.bgCard }}
                                  value={item.quantidade}
                                  onChange={e => setNewTerceiros(items => items.map((x, i) => i === index ? { ...x, quantidade: e.target.value } : x))}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewTerceiros(items => items.filter((_, i) => i !== index))}
                                disabled={newTerceiros.length === 1}
                                style={{ background: 'none', border: 'none', color: newTerceiros.length === 1 ? '#333' : '#F87171', cursor: newTerceiros.length === 1 ? 'default' : 'pointer', padding: 8 }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card: Equipamentos */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Wrench size={14} color="#F59E0B" />
                          <span style={labelStyle}>Equipamentos e Maquinário em Canteiro</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEquipForm(eq => [...eq, { nome: '', status: 'OPERANDO' }])}
                          style={{ background: 'none', border: 'none', color: '#F59E0B', fontSize: 10.5, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Plus size={12} /> Adicionar Equipamento
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {equipForm.map((eq, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 8, alignItems: 'center', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 5, padding: '8px 10px' }}>
                            <div>
                              <input
                                style={{ ...inputStyle, background: C.bgCard }}
                                placeholder="Ex: Retroescavadeira JCB 3CX, Betoneira 400L..."
                                value={eq.nome}
                                onChange={e => setEquipForm(prev => prev.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))}
                              />
                            </div>
                            <div>
                              <select
                                style={{ ...inputStyle, background: C.bgCard }}
                                value={eq.status}
                                onChange={e => setEquipForm(prev => prev.map((x, i) => i === idx ? { ...x, status: e.target.value as any } : x))}
                              >
                                <option value="OPERANDO">🟢 OPERANDO</option>
                                <option value="PARADO">🔴 PARADO</option>
                                <option value="MANUTENÇÃO">🟡 MANUTENÇÃO</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEquipForm(prev => prev.filter((_, i) => i !== idx))}
                              disabled={equipForm.length === 1}
                              style={{ background: 'none', border: 'none', color: equipForm.length === 1 ? '#333' : '#F87171', cursor: equipForm.length === 1 ? 'default' : 'pointer', padding: 6 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {formTab === 'atividades' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Card: Planejado vs Executado */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={14} color="#10B981" />
                          <span style={labelStyle}>Metas Físicas: Planejado x Executado</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewPlanejadoExecutado(items => [...items, { servico: '', unidade: '', planejada: '', executada: '', observacoes: '' }])}
                          style={{ background: 'none', border: 'none', color: '#F59E0B', fontSize: 10.5, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Plus size={12} /> Adicionar Serviço
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {newPlanejadoExecutado.map((item, index) => {
                          const planned = parseFloat(item.planejada) || 0
                          const executed = parseFloat(item.executada) || 0
                          const percentage = planned > 0 ? Math.min(100, (executed / planned) * 100) : 0

                          return (
                            <div key={index} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
                                <div>
                                  <label style={labelStyle}>Serviço / Frente *</label>
                                  <input
                                    style={{ ...inputStyle, background: C.bgCard }}
                                    placeholder="Ex: Concretagem de Laje"
                                    value={item.servico}
                                    onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, servico: e.target.value } : x))}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>Unidade</label>
                                  <input
                                    style={{ ...inputStyle, background: C.bgCard }}
                                    placeholder="m², m³"
                                    value={item.unidade}
                                    onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, unidade: e.target.value } : x))}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>Planejado</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    style={{ ...inputStyle, background: C.bgCard }}
                                    value={item.planejada}
                                    onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, planejada: e.target.value } : x))}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>Executado</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    style={{ ...inputStyle, background: C.bgCard }}
                                    value={item.executada}
                                    onChange={e => setNewPlanejadoExecutado(items => items.map((x, i) => i === index ? { ...x, executada: e.target.value } : x))}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setNewPlanejadoExecutado(items => items.filter((_, i) => i !== index))}
                                  disabled={newPlanejadoExecutado.length === 1}
                                  style={{ background: 'none', border: 'none', color: newPlanejadoExecutado.length === 1 ? '#333' : '#F87171', cursor: newPlanejadoExecutado.length === 1 ? 'default' : 'pointer', padding: 6 }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              {/* Progress bar preview */}
                              {planned > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.inkSoft, marginBottom: 4 }}>
                                    <span>Avanço desta frente</span>
                                    <strong style={{ color: percentage >= 100 ? '#10B981' : '#F59E0B' }}>{percentage.toFixed(1)}% concluído</strong>
                                  </div>
                                  <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${percentage}%`, height: '100%', background: percentage >= 100 ? '#10B981' : '#F59E0B', transition: 'width 0.3s ease' }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Card: Atividades em Lista */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={labelStyle}>Atividades Realizadas (Lista de Ações)</span>
                        <button
                          type="button"
                          onClick={() => setActForm(a => [...a, ''])}
                          style={{ background: 'none', border: 'none', color: '#F59E0B', fontSize: 10.5, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Plus size={12} /> Adicionar Item
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {actForm.map((a, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFE500', flexShrink: 0 }} />
                            <input
                              style={{ ...inputStyle, background: C.bgCard, flex: 1 }}
                              placeholder={`Ex: Conclusão do respaldo da alvenaria no bloco B (Item ${idx + 1})`}
                              value={a}
                              onChange={e => setActForm(prev => {
                                const n = [...prev]
                                n[idx] = e.target.value
                                return n
                              })}
                            />
                            {actForm.length > 1 && (
                              <button type="button" onClick={() => setActForm(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', padding: 4 }}>
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card: Definições & Liberações */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                        <label style={labelStyle}>Definição dos Serviços Próximos</label>
                        <textarea
                          rows={2}
                          style={{ ...inputStyle, background: C.bgCard }}
                          value={newDefinicaoServico}
                          onChange={e => setNewDefinicaoServico(e.target.value)}
                          placeholder="Frentes programadas para o próximo dia útil..."
                        />
                      </div>
                      <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                        <label style={labelStyle}>Liberações & Validações</label>
                        <textarea
                          rows={2}
                          style={{ ...inputStyle, background: C.bgCard }}
                          value={newLiberacoes}
                          onChange={e => setNewLiberacoes(e.target.value)}
                          placeholder="Projetos liberados, vistorias concluídas..."
                        />
                      </div>
                    </div>

                    {/* Card: Fotos & Anexos */}
                    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
                      <label style={labelStyle}>Registro Fotográfico & Documentos Técnicos</label>
                      <label style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        border: `2px dashed ${C.border}`,
                        borderRadius: 6,
                        background: C.bgCard,
                        cursor: 'pointer',
                        marginTop: 6,
                        transition: 'all 0.15s ease'
                      }}>
                        <UploadCloud size={24} color="#F59E0B" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>Clique para anexar fotos ou PDFs</span>
                        <span style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>Imagens JPG, PNG ou Relatórios em PDF</span>
                        <input
                          type="file"
                          multiple
                          hidden
                          accept="image/*,application/pdf"
                          onChange={e => setNewFotos(Array.from(e.target.files || []))}
                        />
                      </label>

                      {newFotos.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {newFotos.map((f, i) => (
                            <span key={i} style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              📷 {f.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Modal Navigation Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    style={{
                      background: 'none',
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      color: C.inkSoft,
                      padding: '8px 16px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    disabled={isCreatingRdo}
                  >
                    Cancelar
                  </button>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {formTab !== 'geral' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (formTab === 'atividades') setFormTab('recursos')
                          else if (formTab === 'recursos') setFormTab('geral')
                        }}
                        style={{
                          background: C.bgWhite,
                          border: `1px solid ${C.border}`,
                          borderRadius: 4,
                          color: C.ink,
                          padding: '8px 16px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <ArrowLeft size={13} /> Voltar
                      </button>
                    )}

                    {formTab !== 'atividades' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (formTab === 'geral') setFormTab('recursos')
                          else if (formTab === 'recursos') setFormTab('atividades')
                        }}
                        style={{
                          background: C.bgWhite,
                          border: `1px solid ${C.border}`,
                          borderRadius: 4,
                          color: C.ink,
                          padding: '8px 18px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        Próximo Passo <ArrowRight size={13} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isCreatingRdo}
                        style={{
                          background: '#F59E0B',
                          color: '#0A0A0A',
                          border: 'none',
                          borderRadius: 4,
                          fontWeight: 900,
                          padding: '8px 22px',
                          fontSize: 12,
                          cursor: isCreatingRdo ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                          opacity: isCreatingRdo ? 0.6 : 1
                        }}
                      >
                        <Check size={15} strokeWidth={3} />
                        {isCreatingRdo ? 'Emitindo Diário...' : 'Finalizar e Emitir RDO'}
                      </button>
                    )}
                  </div>
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
            <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '12px' }}>
              <div className="print-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img src="/logo-jwa.png" alt="JWA Engenharia" style={{ height: '36px', width: 'auto', filter: 'brightness(0)' }} />
                <div>
                  <h1 className="print-company-title" style={{ fontSize: '15px', fontWeight: 900, margin: 0, letterSpacing: '0.04em' }}>JWA ENGENHARIA</h1>
                  <h2 className="print-obra-title" style={{ fontSize: '12px', fontWeight: 700, margin: '2px 0 0', color: '#333' }}>OBRA: {rdo.obra?.nome || 'OBRA NÃO INFORMADA'}</h2>
                </div>
              </div>
              <div className="print-header-right" style={{ textAlign: 'right' }}>
                <div className="print-doc-badge" style={{ fontSize: '11px', fontWeight: 900, background: '#000', color: '#FFF', padding: '2px 8px', borderRadius: '3px', display: 'inline-block' }}>RELATÓRIO DIÁRIO DE OBRA</div>
                <div className="print-doc-date" style={{ fontSize: '10px', marginTop: '3px' }}>Data: <strong>{new Date(rdo.data + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
                <div className="print-doc-status" style={{ fontSize: '10px' }}>Status: <strong>{rdo.status.toUpperCase()}</strong></div>
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
                <h3 className="print-section-title">7. Registro Fotográfico de Campo ({rdo.fotos.length} foto{rdo.fotos.length > 1 ? 's' : ''})</h3>
                <div className="print-photos-grid">
                  {rdo.fotos.map(foto => {
                    const url = foto.imagem_url?.startsWith('http')
                      ? foto.imagem_url
                      : foto.imagem_url
                        ? supabase.storage.from(foto.imagem_url.includes('comprovantes') ? 'comprovantes' : 'rdo-fotos').getPublicUrl(foto.imagem_url).data.publicUrl
                        : ''
                    if (!url) return null
                    return (
                      <div key={foto.id} className="print-photo-item">
                        <img src={url} alt={foto.legenda || 'Foto do RDO'} crossOrigin="anonymous" />
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
                  <div className="print-stamp-title">✓ ASSINADO DIGITALMENTE VIA SISTEMA JWA</div>
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

      {/* Lightbox Modal para fotos expandidas */}
      <AnimatePresence>
        {fotoExpandida && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFotoExpandida(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              cursor: 'zoom-out'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 16,
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
              }}
            >
              <button
                onClick={() => setFotoExpandida(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                <X size={18} />
              </button>

              <img
                src={fotoExpandida.url}
                alt={fotoExpandida.legenda}
                style={{
                  maxWidth: '100%',
                  maxHeight: '72vh',
                  objectFit: 'contain',
                  borderRadius: 4
                }}
              />

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                  {fotoExpandida.legenda}
                </span>
                <a
                  href={fotoExpandida.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: C.amber, fontWeight: 700, textDecoration: 'underline' }}
                >
                  Abrir imagem original ↗
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .rdo-print-only {
          position: absolute;
          left: -9999px;
          top: -9999px;
          width: 210mm;
          opacity: 0;
          pointer-events: none;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          
          #rdo-printable-area, #rdo-printable-area * {
            visibility: visible !important;
            opacity: 1 !important;
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
      
      {ConfirmDialog}
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
