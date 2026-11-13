'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  DollarSign,
  Building2,
  Truck,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  FileText,
  ShieldCheck,
  CheckSquare,
  Edit2,
  ExternalLink,
  ArchiveRestore
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { toast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

export interface MedicaoMensalItem {
  id: string
  mes_indice: number
  mes_ano: string
  valor_previsto: number
  valor_medido?: number | null
  status: 'previsto' | 'medido' | 'pago'
  nota_fiscal?: string | null
  pago_em?: string | null
  observacao?: string | null
}

interface SuprimentoContratoTabProps {
  item: any
  empresas: Array<{ id: string; razao_social: string; nome_fantasia?: string | null }>
  fornecedores: Array<{ id: string; razao_social: string; nome_fantasia?: string | null; cnpj?: string | null; telefone?: string | null; responsavel?: string | null }>
  obras: Array<{ id: string; nome: string; cliente?: string | null }>
  colaboradorAtivo: any
  onUpdateItem: (updated: any) => void
  onRegistrarMexida: (acao: string, detalhe: string, de?: string, para?: string, updatePayload?: any) => Promise<boolean>
}

export function SuprimentoContratoTab({
  item,
  empresas = [],
  fornecedores = [],
  obras = [],
  colaboradorAtivo,
  onUpdateItem,
  onRegistrarMexida
}: SuprimentoContratoTabProps) {
  const [salvando, setSalvando] = useState(false)
  const [modalEncerrarOpen, setModalEncerrarOpen] = useState(false)
  const [motivoEncerramento, setMotivoEncerramento] = useState('')

  // Tipo de Demanda Atual
  const tipoDemanda = item.tipo_demanda || item.dados_contrato?.tipo_demanda || 'servico'
  const isLocacao = tipoDemanda === 'locacao'

  // Dados Básicos do Contrato
  const [empresaId, setEmpresaId] = useState<string>(item.empresa_id || item.dados_contrato?.empresa_id || empresas[0]?.id || '')
  const [fornecedorNome, setFornecedorNome] = useState<string>(item.fornecedor || '')
  const [dataInicio, setDataInicio] = useState<string>(item.data_inicio || item.dados_contrato?.data_inicio || (item.created_at ? item.created_at.slice(0, 10) : ''))
  const [dataTermino, setDataTermino] = useState<string>(item.data_termino || item.dados_contrato?.data_termino || '')
  const [valorTotal, setValorTotal] = useState<string>(item.valor ? String(item.valor) : '')
  const [valorMensal, setValorMensal] = useState<string>(item.valor_mensal ? String(item.valor_mensal) : '')

  useEffect(() => {
    setEmpresaId(item.empresa_id || item.dados_contrato?.empresa_id || empresas[0]?.id || '')
    setFornecedorNome(item.fornecedor || '')
    setDataInicio(item.data_inicio || item.dados_contrato?.data_inicio || (item.created_at ? item.created_at.slice(0, 10) : ''))
    setDataTermino(item.data_termino || item.dados_contrato?.data_termino || '')
    setValorTotal(item.valor ? String(item.valor) : '')
    setValorMensal(item.valor_mensal ? String(item.valor_mensal) : '')
  }, [item?.id])

  // Lista de Medições Mensais
  const medicoes: MedicaoMensalItem[] = useMemo(() => {
    if (Array.isArray(item.acompanhamento_mensal) && item.acompanhamento_mensal.length > 0) {
      return item.acompanhamento_mensal
    }
    if (Array.isArray(item.dados_contrato?.acompanhamento_mensal) && item.dados_contrato.acompanhamento_mensal.length > 0) {
      return item.dados_contrato.acompanhamento_mensal
    }

    // Se ainda não tem medições salvas, gera a projeção inicial
    const dtIni = dataInicio ? new Date(dataInicio + 'T12:00:00') : new Date()
    const dtFim = dataTermino ? new Date(dataTermino + 'T12:00:00') : new Date(dtIni.getFullYear(), dtIni.getMonth() + 5, dtIni.getDate())
    
    let ano = dtIni.getFullYear()
    let mes = dtIni.getMonth()
    const fimAno = dtFim.getFullYear()
    const fimMes = dtFim.getMonth()
    
    const lista: MedicaoMensalItem[] = []
    let indice = 1
    
    const vTotalNum = parseFloat(valorTotal.replace(',', '.')) || 0
    const vMensalNum = parseFloat(valorMensal.replace(',', '.')) || 0
    const totalMesesProj = Math.max(1, (fimAno - ano) * 12 + (fimMes - mes) + 1)
    const vPrevistoPadrao = vMensalNum || (vTotalNum > 0 ? Math.round((vTotalNum / totalMesesProj) * 100) / 100 : 0)

    while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
      const dataRef = new Date(ano, mes, 1)
      const nomeMes = dataRef.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      lista.push({
        id: `mes-${indice}-${ano}-${mes + 1}`,
        mes_indice: indice,
        mes_ano: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
        valor_previsto: vPrevistoPadrao,
        valor_medido: null,
        status: 'previsto',
        nota_fiscal: '',
        pago_em: null,
        observacao: ''
      })
      indice++
      mes++
      if (mes > 11) {
        mes = 0
        ano++
      }
      if (indice > 60) break // trava de segurança
    }

    return lista
  }, [item?.acompanhamento_mensal, item?.dados_contrato, dataInicio, dataTermino, valorTotal, valorMensal])

  // Cálculos Financeiros e de Vigência
  const totalContratadoNum = parseFloat(valorTotal.replace(',', '.')) || (item.valor || 0)
  const totalMedidoOuPago = useMemo(() => {
    return medicoes.reduce((acc, m) => {
      if (m.status === 'medido' || m.status === 'pago') {
        const val = m.valor_medido != null ? m.valor_medido : m.valor_previsto
        return acc + (val || 0)
      }
      return acc
    }, 0)
  }, [medicoes])

  const totalPagoEfetivo = useMemo(() => {
    return medicoes.filter(m => m.status === 'pago').reduce((acc, m) => {
      const val = m.valor_medido != null ? m.valor_medido : m.valor_previsto
      return acc + (val || 0)
    }, 0)
  }, [medicoes])

  const saldoRestante = Math.max(0, totalContratadoNum - totalMedidoOuPago)

  // Indicador de Vigência e Progresso
  const progressoVigencia = useMemo(() => {
    if (item.contrato_encerrado) {
      return {
        label: isLocacao ? 'Locação Desmobilizada / Encerrada' : 'Contrato Encerrado',
        corStatus: '#94A3B8',
        corBarra: '#64748B',
        porcentagem: 100,
        texto: item.contrato_encerrado_motivo ? `Motivo: ${item.contrato_encerrado_motivo}` : 'Finalizado',
        diasRestantes: 0
      }
    }

    if (!dataInicio) {
      return {
        label: 'Vigência a definir',
        corStatus: C.inkSoft,
        corBarra: C.border,
        porcentagem: 0,
        texto: 'Informe as datas de início e término',
        diasRestantes: 0
      }
    }

    const dIni = new Date(dataInicio + 'T00:00:00')
    const agora = new Date()
    const dFim = dataTermino ? new Date(dataTermino + 'T23:59:59') : new Date(dIni.getFullYear(), dIni.getMonth() + 6, dIni.getDate())

    const diffTotalMs = dFim.getTime() - dIni.getTime()
    const diffDecorridoMs = agora.getTime() - dIni.getTime()
    const diffRestanteMs = dFim.getTime() - agora.getTime()

    const diasRestantes = Math.ceil(diffRestanteMs / (1000 * 60 * 60 * 24))
    const totalMeses = Math.max(1, Math.round(diffTotalMs / (1000 * 60 * 60 * 24 * 30.4)))
    const mesesDecorridos = Math.max(1, Math.min(totalMeses, Math.ceil(diffDecorridoMs / (1000 * 60 * 60 * 24 * 30.4))))

    let pct = Math.round((diffDecorridoMs / diffTotalMs) * 100)
    if (isNaN(pct)) pct = 0
    pct = Math.max(0, Math.min(100, pct))

    if (diasRestantes <= 0) {
      return {
        label: `Prazo Expirado (Mês ${mesesDecorridos} de ${totalMeses})`,
        corStatus: '#EF4444',
        corBarra: '#EF4444',
        porcentagem: 100,
        texto: `Venceu há ${Math.abs(diasRestantes)} dia(s) - Pendente de Renovação ou Encerramento`,
        diasRestantes
      }
    }

    if (diasRestantes <= 30) {
      return {
        label: `Atenção: Término Próximo (Mês ${mesesDecorridos} de ${totalMeses})`,
        corStatus: '#F59E0B',
        corBarra: '#F59E0B',
        porcentagem: pct,
        texto: `Restam apenas ${diasRestantes} dia(s) para o encerramento`,
        diasRestantes
      }
    }

    return {
      label: `Vigência Ativa: Mês ${mesesDecorridos} de ${totalMeses}`,
      corStatus: '#10B981',
      corBarra: '#10B981',
      porcentagem: pct,
      texto: `Em andamento normal (${diasRestantes} dias restantes)`,
      diasRestantes
    }
  }, [item.contrato_encerrado, item.contrato_encerrado_motivo, dataInicio, dataTermino, isLocacao])

  // Salvar alterações nos dados do contrato
  async function handleSalvarDadosContrato() {
    setSalvando(true)
    try {
      const vTot = parseFloat(valorTotal.replace(',', '.')) || null
      const vMen = parseFloat(valorMensal.replace(',', '.')) || null
      const emp = empresas.find(e => e.id === empresaId)
      const empNome = emp ? (emp.nome_fantasia || emp.razao_social) : ''

      const dadosContratoPayload = {
        tipo_demanda: tipoDemanda,
        empresa_id: empresaId || null,
        empresa_nome: empNome || null,
        data_inicio: dataInicio || null,
        data_termino: dataTermino || null,
        valor_mensal: vMen,
        acompanhamento_mensal: medicoes
      }

      const updatePayload: any = {
        empresa_id: empresaId || null,
        empresa_nome: empNome || null,
        fornecedor: fornecedorNome.trim() || null,
        data_inicio: dataInicio || null,
        data_termino: dataTermino || null,
        valor: vTot,
        valor_mensal: vMen,
        acompanhamento_mensal: medicoes,
        tipo_demanda: tipoDemanda,
        dados_contrato: dadosContratoPayload
      }

      const ok = await onRegistrarMexida(
        'edicao_contrato',
        `Atualizou os parâmetros do contrato/locação: ${empNome ? `Empresa: ${empNome}. ` : ''}Vigência: ${dataInicio || 'início'} até ${dataTermino || 'fim'}. Valor: R$ ${vTot?.toLocaleString('pt-BR') || '0'}.`,
        'Dados Anteriores',
        'Contrato Atualizado',
        updatePayload
      )

      if (ok) {
        toast('Dados do contrato atualizados com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // Alternar Tipo de Demanda (Material / Serviço / Locação)
  async function handleMudarTipoDemanda(novoTipo: 'material' | 'servico' | 'locacao') {
    if (novoTipo === tipoDemanda) return
    const ok = await onRegistrarMexida(
      'mudanca_tipo_demanda',
      `Alterou a categoria da demanda de "${tipoDemanda}" para "${novoTipo}"`,
      tipoDemanda,
      novoTipo,
      {
        tipo_demanda: novoTipo,
        dados_contrato: {
          ...(item.dados_contrato || {}),
          tipo_demanda: novoTipo
        }
      }
    )
    if (ok) {
      toast(`Demanda alterada para ${novoTipo === 'material' ? 'Material' : novoTipo === 'servico' ? 'Serviço' : 'Locação'}.`, 'success')
    }
  }

  // Atualizar Medição Específica
  async function handleAtualizarMedicao(medicaoId: string, updates: Partial<MedicaoMensalItem>) {
    const novaLista = medicoes.map(m => m.id === medicaoId ? { ...m, ...updates } : m)
    
    // Atualiza otimista no item pai
    const updatedItem = {
      ...item,
      acompanhamento_mensal: novaLista,
      dados_contrato: {
        ...(item.dados_contrato || {}),
        acompanhamento_mensal: novaLista
      }
    }
    onUpdateItem(updatedItem)

    // Salva no Supabase
    try {
      const { error } = await supabase.from('suprimentos').update({
        acompanhamento_mensal: novaLista,
        dados_contrato: updatedItem.dados_contrato
      }).eq('id', item.id)

      if (error && error.code === 'PGRST204') {
        // Fallback se coluna não existe ainda
        await supabase.from('suprimentos').update({
          observacoes_oc: (item.observacoes_oc || '') + `\n[MEDICOES_ATUALIZADAS]: ${JSON.stringify(novaLista)}`
        }).eq('id', item.id)
      }
      toast('Medição mensal atualizada!', 'success')
    } catch (err: any) {
      toast('Erro ao atualizar medição: ' + err.message, 'error')
    }
  }

  // Adicionar Parcela / Medição Extra
  async function handleAdicionarParcelaExtra() {
    const proximoIndice = medicoes.length + 1
    const novaMedicao: MedicaoMensalItem = {
      id: `mes-${proximoIndice}-${Date.now()}`,
      mes_indice: proximoIndice,
      mes_ano: `Parcela Extra #${proximoIndice}`,
      valor_previsto: parseFloat(valorMensal.replace(',', '.')) || 0,
      valor_medido: null,
      status: 'previsto',
      nota_fiscal: '',
      pago_em: null,
      observacao: ''
    }
    const novaLista = [...medicoes, novaMedicao]
    
    const updatedItem = {
      ...item,
      acompanhamento_mensal: novaLista,
      dados_contrato: { ...(item.dados_contrato || {}), acompanhamento_mensal: novaLista }
    }
    onUpdateItem(updatedItem)

    await supabase.from('suprimentos').update({
      acompanhamento_mensal: novaLista,
      dados_contrato: updatedItem.dados_contrato
    }).eq('id', item.id)

    toast('Nova medição adicionada!', 'success')
  }

  // Encerrar Contrato / Devolver Locação
  async function handleConfirmarEncerramento() {
    setSalvando(true)
    try {
      const autorNome = colaboradorAtivo?.nome || 'Usuário'
      const dataIso = new Date().toISOString()
      const detalheAcao = isLocacao
        ? `Locação finalizada e equipamento desmobilizado/devolvido por ${autorNome}.${motivoEncerramento ? ` Motivo/Laudo: ${motivoEncerramento}.` : ''}`
        : `Contrato de serviço finalizado e encerrado por ${autorNome}.${motivoEncerramento ? ` Motivo: ${motivoEncerramento}.` : ''}`

      const payload = {
        contrato_encerrado: true,
        contrato_encerrado_em: dataIso,
        contrato_encerrado_motivo: motivoEncerramento.trim() || 'Concluído na obra',
        status: 'Entregue', // Move para a etapa de finalizado
        dados_contrato: {
          ...(item.dados_contrato || {}),
          contrato_encerrado: true,
          contrato_encerrado_em: dataIso,
          contrato_encerrado_motivo: motivoEncerramento.trim() || 'Concluído na obra'
        }
      }

      const ok = await onRegistrarMexida(
        'encerramento_contrato',
        detalheAcao,
        'Em Vigência',
        'Encerrado',
        payload
      )

      if (ok) {
        setModalEncerrarOpen(false)
        toast(isLocacao ? 'Locação desmobilizada e encerrada!' : 'Contrato encerrado com sucesso!', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // Reabrir Contrato Encerrado
  async function handleReabrirContrato() {
    const ok = await onRegistrarMexida(
      'reabertura_contrato',
      `Contrato reaberto por ${colaboradorAtivo?.nome || 'Usuário'} para continuidade da vigência/medições.`,
      'Encerrado',
      'Em Vigência',
      {
        contrato_encerrado: false,
        contrato_encerrado_em: null,
        contrato_encerrado_motivo: null,
        dados_contrato: {
          ...(item.dados_contrato || {}),
          contrato_encerrado: false
        }
      }
    )
    if (ok) toast('Contrato reaberto para acompanhamento.', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── 1. SELETOR DE CATEGORIA NO TOPO ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        background: 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '8px 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft }}>Categoria da Demanda:</span>
          <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 5, padding: 2, border: `1px solid ${C.border}` }}>
            {(['material', 'servico', 'locacao'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleMudarTipoDemanda(t)}
                style={{
                  border: 'none',
                  background: tipoDemanda === t ? C.amber : 'transparent',
                  color: tipoDemanda === t ? '#0A0A0A' : C.inkSoft,
                  fontWeight: 800,
                  fontSize: 10.5,
                  padding: '4px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t === 'material' ? '📦 Material' : t === 'servico' ? '🛠️ Serviço' : '🚜 Locação'}
              </button>
            ))}
          </div>
        </div>

        <div>
          {item.contrato_encerrado ? (
            <button
              type="button"
              onClick={handleReabrirContrato}
              style={{
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.05)',
                color: C.ink,
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <ArchiveRestore size={12} />
              Reabrir Vigência
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalEncerrarOpen(true)}
              style={{
                background: isLocacao ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: isLocacao ? '#EF4444' : C.amber,
                border: `1px solid ${isLocacao ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                padding: '5px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CheckSquare size={13} />
              {isLocacao ? 'Desmobilizar / Devolver Locação' : 'Encerrar Contrato de Serviço'}
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. BANNER DE VIGÊNCIA & PROGRESSO TEMPORAL ─── */}
      <div style={{
        background: C.bgCard,
        border: `1px solid ${progressoVigencia.corStatus}44`,
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color={progressoVigencia.corStatus} />
            <strong style={{ fontSize: 13, color: C.ink }}>
              {progressoVigencia.label}
            </strong>
          </div>
          <span style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: progressoVigencia.corStatus,
            background: `${progressoVigencia.corStatus}18`,
            padding: '2px 8px',
            borderRadius: 4
          }}>
            {progressoVigencia.texto}
          </span>
        </div>

        {/* Barra de Progresso do Contrato */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 6, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressoVigencia.porcentagem}%`,
              background: progressoVigencia.corBarra,
              borderRadius: 3,
              transition: 'width 0.4s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.inkSoft }}>
            <span>Início: <strong>{dataInicio || 'A definir'}</strong></span>
            <span>{progressoVigencia.porcentagem}% decorrido</span>
            <span>Término: <strong>{dataTermino || 'A definir'}</strong></span>
          </div>
        </div>
      </div>

      {/* ─── 3. FORMULÁRIO DE PARÂMETROS DO CONTRATO ─── */}
      <div style={{
        background: C.bgPanel,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase' }}>
            📋 Dados da Contratação
          </span>
          <button
            type="button"
            onClick={handleSalvarDadosContrato}
            disabled={salvando}
            style={{
              border: 'none',
              background: C.amber,
              color: '#0A0A0A',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Empresa do Grupo Contratante */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
              🏢 Empresa do Grupo (Contratante)
            </label>
            <select
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${C.border}`,
                color: C.ink,
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
            >
              <option value="">Selecione a empresa...</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome_fantasia || emp.razao_social}
                </option>
              ))}
            </select>
          </div>

          {/* Fornecedor / Prestador / Locadora */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
              🤝 {isLocacao ? 'Locadora de Equipamentos' : 'Prestador / Empreiteiro'}
            </label>
            <input
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${C.border}`,
                color: C.ink,
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
              placeholder="Razão social ou nome fantasia..."
              value={fornecedorNome}
              onChange={e => setFornecedorNome(e.target.value)}
              list="lista-fornecedores-contrato"
            />
            <datalist id="lista-fornecedores-contrato">
              {fornecedores.map(f => (
                <option key={f.id} value={f.nome_fantasia || f.razao_social} />
              ))}
            </datalist>
          </div>

          {/* Valor Total Contratado */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
              💰 Valor Total do Contrato (R$)
            </label>
            <input
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${C.border}`,
                color: '#10B981',
                fontFamily: 'monospace',
                fontWeight: 700,
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 12
              }}
              placeholder="Ex: 36000.00"
              value={valorTotal}
              onChange={e => setValorTotal(e.target.value)}
            />
          </div>

          {/* Valor Mensal Estimado */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
              📅 Parcela / Mensalidade Estimada (R$)
            </label>
            <input
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${C.border}`,
                color: C.ink,
                fontFamily: 'monospace',
                fontWeight: 700,
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 12
              }}
              placeholder="Ex: 6000.00"
              value={valorMensal}
              onChange={e => setValorMensal(e.target.value)}
            />
          </div>

          {/* Data de Início */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
              🗓️ Início da Vigência / Chegada na Obra
            </label>
            <input
              type="date"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${C.border}`,
                color: C.ink,
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </div>

          {/* Data de Término */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
              🏁 Término Previsto / Devolução
            </label>
            <input
              type="date"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${C.border}`,
                color: C.ink,
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
              value={dataTermino}
              onChange={e => setDataTermino(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ─── 4. CARDS DE RESUMO FINANCEIRO DO CONTRATO ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>
            Valor Total Contratado
          </span>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: 'monospace', marginTop: 2 }}>
            R$ {totalContratadoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>
            Já Medido / Pago
          </span>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#10B981', fontFamily: 'monospace', marginTop: 2 }}>
            R$ {totalMedidoOuPago.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 9.5, color: C.inkSoft }}>
            (R$ {totalPagoEfetivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} quitado)
          </span>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, textTransform: 'uppercase' }}>
            Saldo a Medir / Pagar
          </span>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.amber, fontFamily: 'monospace', marginTop: 2 }}>
            R$ {saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* ─── 5. TABELA DE ACOMPANHAMENTO MÊS A MÊS ─── */}
      <div style={{
        background: C.bgPanel,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color={C.amber} />
              Acompanhamento Mês a Mês ({medicoes.length} ciclos)
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: 10.5, color: C.inkSoft }}>
              Acompanhe as medições, notas fiscais e pagamentos mensais até o encerramento da contratação.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAdicionarParcelaExtra}
            style={{
              border: `1px solid ${C.border}`,
              background: 'rgba(255, 255, 255, 0.04)',
              color: C.ink,
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Plus size={11} /> Adicionar Mês / Parcela
          </button>
        </div>

        {/* Tabela de Medições */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left', color: C.inkSoft, fontSize: 10 }}>
                <th style={{ padding: '8px 6px' }}>MÊS</th>
                <th style={{ padding: '8px 6px' }}>COMPETÊNCIA</th>
                <th style={{ padding: '8px 6px' }}>PREVISTO (R$)</th>
                <th style={{ padding: '8px 6px' }}>VALOR MEDIDO (R$)</th>
                <th style={{ padding: '8px 6px' }}>STATUS</th>
                <th style={{ padding: '8px 6px' }}>NF / OBSERVAÇÃO</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {medicoes.map((m, idx) => {
                const isPago = m.status === 'pago'
                const isMedido = m.status === 'medido'

                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}44` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 800, color: C.ink }}>
                      #{m.mes_indice || idx + 1}
                    </td>
                    <td style={{ padding: '8px 6px', color: C.ink }}>
                      <input
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: C.ink,
                          fontWeight: 700,
                          fontSize: 11,
                          width: 85
                        }}
                        value={m.mes_ano}
                        onChange={e => handleAtualizarMedicao(m.id, { mes_ano: e.target.value })}
                      />
                    </td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', color: C.inkSoft }}>
                      R$ {(m.valor_previsto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <input
                        style={{
                          width: 95,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${C.border}`,
                          color: isMedido || isPago ? '#10B981' : C.ink,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: 11,
                          padding: '3px 6px',
                          borderRadius: 3
                        }}
                        placeholder="R$ medido..."
                        value={m.valor_medido != null ? m.valor_medido : ''}
                        onChange={e => {
                          const val = e.target.value ? parseFloat(e.target.value.replace(',', '.')) : null
                          handleAtualizarMedicao(m.id, { valor_medido: val })
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{
                        fontSize: 9.5,
                        fontWeight: 900,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: isPago ? 'rgba(16, 185, 129, 0.15)' : isMedido ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: isPago ? '#10B981' : isMedido ? C.amber : '#94A3B8'
                      }}>
                        {isPago ? '✅ PAGO' : isMedido ? '🟡 MEDIDO' : '⚪ PREVISTO'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <input
                        style={{
                          width: '100%',
                          minWidth: 120,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${C.border}`,
                          color: C.ink,
                          fontSize: 10.5,
                          padding: '3px 6px',
                          borderRadius: 3
                        }}
                        placeholder="Nº da NF ou detalhes..."
                        value={m.nota_fiscal || ''}
                        onChange={e => handleAtualizarMedicao(m.id, { nota_fiscal: e.target.value })}
                      />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {!isMedido && !isPago && (
                          <button
                            type="button"
                            onClick={() => handleAtualizarMedicao(m.id, {
                              status: 'medido',
                              valor_medido: m.valor_medido != null ? m.valor_medido : m.valor_previsto
                            })}
                            style={{
                              border: 'none',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: C.amber,
                              padding: '3px 6px',
                              borderRadius: 3,
                              fontSize: 9.5,
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title="Aprovar medição para envio ao financeiro"
                          >
                            Aprovar Medição
                          </button>
                        )}
                        {isMedido && !isPago && (
                          <button
                            type="button"
                            onClick={() => handleAtualizarMedicao(m.id, { status: 'pago', pago_em: new Date().toISOString() })}
                            style={{
                              border: 'none',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981',
                              padding: '3px 6px',
                              borderRadius: 3,
                              fontSize: 9.5,
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title="Confirmar pagamento liquidado"
                          >
                            Marcar Pago
                          </button>
                        )}
                        {isPago && (
                          <button
                            type="button"
                            onClick={() => handleAtualizarMedicao(m.id, { status: 'medido', pago_em: null })}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: C.inkSoft,
                              fontSize: 9,
                              cursor: 'pointer'
                            }}
                            title="Estornar status para Medido"
                          >
                            ↩ Desfazer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL DE ENCERRAMENTO / DESMOBILIZAÇÃO ─── */}
      {modalEncerrarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={16} color={isLocacao ? '#EF4444' : C.amber} />
              {isLocacao ? 'Desmobilização & Devolução da Locação' : 'Encerramento de Contrato de Serviço'}
            </h4>
            <p style={{ margin: 0, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
              {isLocacao
                ? 'Confirma que o equipamento foi retirado/coletado pela locadora no canteiro de obras e que as diárias foram finalizadas?'
                : 'Confirma que o escopo contratado foi 100% executado e aceito pelo engenheiro de obra?'}
            </p>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, display: 'block', marginBottom: 4 }}>
                Motivo / Observações do Encerramento
              </label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: 65,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${C.border}`,
                  color: C.ink,
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 11
                }}
                placeholder="Ex: Obra entregue com termo de encerramento assinado / Caçamba retirada com laudo OK..."
                value={motivoEncerramento}
                onChange={e => setMotivoEncerramento(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setModalEncerrarOpen(false)}
                style={{
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.inkSoft,
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEncerramento}
                disabled={salvando}
                style={{
                  border: 'none',
                  background: isLocacao ? '#EF4444' : C.amber,
                  color: '#0A0A0A',
                  padding: '6px 14px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {salvando ? 'Encerrando...' : isLocacao ? 'Sim, Confirmar Devolução' : 'Sim, Encerrar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
