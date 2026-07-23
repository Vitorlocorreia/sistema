'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { Building2, FileText, Camera, TrendingUp, Plus } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Panel } from '@/components/Panel'
import { ApiBadge } from '@/components/ApiBadge'
import { PageTitle } from '@/components/PageTitle'
import { C } from '@/lib/tokens'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'motion/react'

type MetricType = 'obras' | 'rdos' | 'fotos'

export default function Dashboard() {
  const router = useRouter()
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('obras')
  const [loading, setLoading] = useState(true)
  const [isAdminGeral, setIsAdminGeral] = useState(false)

  // Dynamic states
  const [obrasList, setObrasList] = useState<any[]>([])
  const [rdosList, setRdosList] = useState<any[]>([])
  const [suprimentosList, setSuprimentosList] = useState<any[]>([])
  const [fotosList, setFotosList] = useState<any[]>([])

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const [
      { data: ob },
      { data: rd },
      { data: sp },
      { data: ft }
    ] = await Promise.all([
      supabase.from('obras').select('id, nome, status, progresso').order('nome'),
      supabase.from('rdos').select('id, resumo, status, obra:obras(nome)').order('data', { ascending: false }),
      supabase.from('suprimentos').select('id, titulo, quantidade, unidade, status, obra:obras(nome)').order('created_at', { ascending: false }),
      supabase.from('fotos').select('id, legenda, imagem_url, data_iso, created_at, obra:obras(nome)').order('created_at', { ascending: false })
    ])

    setObrasList(ob ?? [])
    setRdosList(rd ?? [])
    setSuprimentosList(sp ?? [])
    setFotosList(ft ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('colaborador_sessao')
    let cargo = ''
    try { cargo = session ? JSON.parse(session).cargo || '' : '' } catch { cargo = '' }
    if (cargo !== 'admin_geral') {
      router.replace('/rh')
      setLoading(false)
      return
    }
    setIsAdminGeral(true)
    loadData()
  }, [router, loadData])

  useRealtimeSync(loadData, 'dashboard-geral-sync', ['obras', 'rdos', 'suprimentos', 'fotos'])

  const obrasAtivas = useMemo(() => obrasList.filter(obra => !['concluída', 'concluida', 'finalizada', 'arquivada'].includes(String(obra.status || '').toLowerCase())).length, [obrasList])
  const rdosParaAssinar = useMemo(() => rdosList.filter(rdo => rdo.status !== 'Aprovado').length, [rdosList])
  const fotosSemana = useMemo(() => {
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000
    return fotosList.filter(foto => new Date(foto.created_at || foto.data_iso || 0).getTime() >= limite).length
  }, [fotosList])

  const metricConfig = useMemo(() => ({
    obras: {
      label: 'Obras ativas',
      value: String(obrasAtivas),
      delta: 'Em andamento',
      positivo: true,
      icon: Building2,
      color: '#3B82F6',
      yAxisFormatter: (v: number) => `${v}`,
      tooltipFormatter: (v: number) => `${v} obras`
    },
    rdos: {
      label: 'Diários de Obra (RDO)',
      value: String(rdosParaAssinar),
      delta: 'Aguardando assinatura',
      positivo: true,
      icon: FileText,
      color: C.amber,
      yAxisFormatter: (v: number) => `${v}`,
      tooltipFormatter: (v: number) => `${v} RDOs finalizados`
    },
    fotos: {
      label: 'Imagens de campo novas (7 dias)',
      value: String(fotosSemana),
      delta: 'Última semana',
      positivo: true,
      icon: Camera,
      color: '#06B6D4',
      yAxisFormatter: (v: number) => `${v}`,
      tooltipFormatter: (v: number) => `${v} fotos`
    }
  }), [obrasAtivas, rdosParaAssinar, fotosSemana])

  const currentConfig = metricConfig[selectedMetric]

  // Dynamic AI insights
  const insights = useMemo(() => {
    const pendingApproval = suprimentosList.filter(s => s.status === 'Aprovação')
    const atrasados = rdosList.filter(r => (r.resumo ?? '').toLowerCase().includes('atraso'))
    
    return [
      ...(pendingApproval.length > 0 ? [{
        emoji: '💰', color: C.amber,
        text: `Aprovação Pendente: ${pendingApproval.length} pedido(s) de material aguardando liberação em `,
        link: { label: 'Suprimentos', href: '/suprimentos' }
      }] : []),
      ...(atrasados.length > 0 ? [{
        emoji: '⚠️', color: '#EF4444',
        text: `Atenção (${atrasados[0].obra?.nome ?? 'Obra'}): ${atrasados[0].resumo}`,
      }] : []),
      ...(obrasList.length === 0 ? [{
        emoji: '🏗️', color: C.amber,
        text: 'Bem-vindo ao sistema! Comece cadastrando suas obras em Suprimentos ou gerando o primeiro Diário de Obra.',
      }] : []),
      ...(obrasList.length > 0 && pendingApproval.length === 0 && atrasados.length === 0 ? [{
        emoji: '✅', color: '#10B981',
        text: `Tudo em ordem: ${obrasList.length} obra(s) ativa(s), sem alertas pendentes.`,
      }] : []),
    ]
  }, [suprimentosList, rdosList, obrasList])

  // Historical data fallback
  const chartHistory = useMemo(() => [
    { data: 'Jan', obras: 1, rdos: Math.max(0, rdosList.length - 4), fotos: Math.max(0, fotosList.length - 3) },
    { data: 'Fev', obras: 1, rdos: Math.max(0, rdosList.length - 3), fotos: Math.max(0, fotosList.length - 2) },
    { data: 'Mar', obras: 2, rdos: Math.max(0, rdosList.length - 2), fotos: Math.max(0, fotosList.length - 2) },
    { data: 'Abr', obras: 2, rdos: Math.max(0, rdosList.length - 1), fotos: Math.max(0, fotosList.length - 1) },
    { data: 'Mai', obras: 3, rdos: rdosList.length, fotos: fotosList.length },
    { data: 'Jun', obras: obrasList.length, rdos: rdosList.length, fotos: fotosList.length },
  ], [obrasList.length, rdosList.length, fotosList.length])

  return (
    <>{isAdminGeral && <>
      <PageTitle modulo="Painel Principal" titulo="Visão Geral" />

      {/* Quick Action Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: '+ Novo RDO', href: '/rdo', color: C.amber },
          { label: '+ Solicitar Material', href: '/suprimentos', color: C.green },
          { label: 'Ver Obras', href: '/obras', color: '#3B82F6' },
        ].map(a => (
          <motion.button
            key={a.label}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(a.href)}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 2,
              border: `1px solid ${a.color}44`,
              background: `${a.color}10`,
              fontSize: 11, fontWeight: 800, color: a.color,
              transition: 'all 0.15s',
            }}
          >
            <Plus size={11} />{a.label}
          </motion.button>
        ))}
      </div>

      {/* Cognitive AI Insights Panel */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.03)',
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.amber}`,
        padding: '14px 20px',
        borderRadius: 2,
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              width: 7, height: 7, borderRadius: '50%', background: C.amber,
              boxShadow: `0 0 8px ${C.amber}`
            }} />
            <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 1 }}>
              Assistente de IA Cognitiva (Analítica de Campo)
            </span>
          </div>
          <span style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Processamento Supabase · Conectado
          </span>
        </div>

        {/* Insights list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
              <span style={{ color: ins.color, fontWeight: 900, lineHeight: 1 }}>{ins.emoji}</span>
              <div style={{ color: C.inkSoft, lineHeight: 1.4 }}>
                {ins.text}
                {ins.link && (
                  <a href={ins.link.href} style={{ color: C.amber, fontWeight: 800, textDecoration: 'underline' }}>
                    {ins.link.label}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando painel analítico...</p>
      ) : (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {(Object.keys(metricConfig) as MetricType[]).map((key) => {
              const config = metricConfig[key]
              return (
                <KpiCard
                  key={key}
                  label={config.label}
                  valor={config.value}
                  delta={config.delta}
                  positivo={config.positivo}
                  icon={config.icon}
                  active={selectedMetric === key}
                  onClick={() => setSelectedMetric(key)}
                />
              )
            })}
          </div>

          {/* Recharts Analytics Panel */}
          <div style={{ marginBottom: 24 }}>
            <Panel 
              title={`Histórico de Desempenho — ${currentConfig.label}`} 
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft }}>
                  <TrendingUp size={14} color={currentConfig.color} />
                  <span>Dados atualizados hoje</span>
                </div>
              }
            >
              <div style={{ height: 320, width: '100%', background: '#0F1115', padding: '16px 8px 8px', borderRadius: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartHistory} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor={currentConfig.color} floodOpacity="0.3" />
                      </filter>
                    </defs>
                    <XAxis 
                      dataKey="data" 
                      stroke={C.border} 
                      tick={{ fill: C.inkSoft, fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: C.border }}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke={C.border}
                      tick={{ fill: C.inkSoft, fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: C.border }}
                      tickLine={false}
                      tickFormatter={currentConfig.yAxisFormatter}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const dataVal = payload[0].value as number
                          return (
                            <div style={{ 
                              background: C.bgPanel, 
                              border: `1px solid ${C.border}`, 
                              padding: '10px 14px', 
                              borderRadius: 2 
                            }}>
                              <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>
                                {payload[0].payload.data}
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: currentConfig.color }}>
                                {currentConfig.tooltipFormatter(dataVal)}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      stroke={currentConfig.color} 
                      strokeWidth={3} 
                      dot={{ r: 4, stroke: C.bg, strokeWidth: 2, fill: currentConfig.color }}
                      activeDot={{ r: 6, stroke: C.ink, strokeWidth: 2, fill: currentConfig.color }}
                      filter="url(#glowFilter)"
                      animationDuration={600}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Obras + Suprimentos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <Panel title="Andamento das Obras">
              <div style={{ display: 'grid', gap: 16 }}>
                {obrasList.map(o => (
                  <div key={o.id} style={{ padding: '12px 16px', background: '#16181D', border: `1px solid ${C.border}`, borderRadius: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{o.nome}</span>
                      <span style={{
                        fontSize: 9, 
                        fontWeight: 900, 
                        padding: '2px 8px', 
                        borderRadius: 2,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        background: o.status === 'Em dia' ? C.greenDim : '#3D2A08',
                        color: o.status === 'Em dia' ? C.green : C.amber,
                        border: o.status === 'Em dia' ? `1px solid ${C.green}44` : `1px solid ${C.amber}44`,
                      }}>{o.status}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 1, background: '#1A1D26', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${o.progresso}%`, background: o.status === 'Em dia' ? C.green : C.amber }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, marginTop: 6, fontWeight: 700 }}>
                      <span>Progresso geral</span>
                      <span>{o.progresso}% concluído</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Suprimentos — Recentes">
              <div style={{ display: 'grid', gap: 12 }}>
                {suprimentosList.slice(0, 3).map((s, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#16181D', borderRadius: 2, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 6 }}>{s.titulo} ({s.quantidade} {s.unidade})</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>{s.obra?.nome ?? 'Obra não informada'}</span>
                      <span style={{ 
                        fontSize: 10, 
                        fontWeight: 900, 
                        color: C.amber, 
                        textTransform: 'uppercase', 
                        letterSpacing: 0.5,
                        background: C.amberDim,
                        padding: '2px 6px',
                        borderRadius: 2,
                        border: `1px solid ${C.amber}33`
                      }}>{s.status}</span>
                    </div>
                  </div>
                ))}
                {suprimentosList.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Nenhum pedido recente.</p>}
              </div>
            </Panel>
          </div>

          {/* Fotos */}
          <Panel title="Fotos Recentes — Google Drive" action={<ApiBadge />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {fotosList.map((f, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4 }}
                  onClick={() => router.push('/obras')}
                  style={{ borderRadius: 2, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#16181D', cursor: 'pointer' }}
                >
                  <div style={{ height: 110, overflow: 'hidden', position: 'relative' }}>
                    <img src={f.imagem_url ?? '/obra_fundacao.png'} alt={f.legenda ?? 'Foto'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(11,12,14,0.6) 0%, transparent 60%)'
                    }} />
                  </div>
                  <div style={{ padding: '9px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{f.legenda}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 3, fontWeight: 700 }}>{f.obra?.nome ?? 'Obra'} · {f.data_iso}</div>
                  </div>
                </motion.div>
              ))}
              {fotosList.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Nenhuma foto enviada.</p>}
            </div>
          </Panel>
        </>
      )}
    </>}
    </>
  )
}
