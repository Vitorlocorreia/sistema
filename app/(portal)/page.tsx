'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, FileText, Package, Camera, TrendingUp, Plus, Zap } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Panel } from '@/components/Panel'
import { ApiBadge } from '@/components/ApiBadge'
import { PageTitle } from '@/components/PageTitle'
import { obras, suprimentos, fotos, rdos, chartHistory } from '@/lib/mock'
import { C } from '@/lib/tokens'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { motion, AnimatePresence } from 'motion/react'

type MetricType = 'obras' | 'rdos' | 'suprimentos' | 'fotos'

const metricConfig = {
  obras: {
    label: 'Obras ativas',
    value: '3',
    delta: '100% no cronograma',
    positivo: true,
    icon: Building2,
    color: '#3B82F6', // Tech Blue
    yAxisFormatter: (v: number) => `${v}`,
    tooltipFormatter: (v: number) => `${v} obras`
  },
  rdos: {
    label: 'Diários de Obra (RDO)',
    value: '35',
    delta: '2 assinados hoje',
    positivo: true,
    icon: FileText,
    color: C.amber,
    yAxisFormatter: (v: number) => `${v}`,
    tooltipFormatter: (v: number) => `${v} RDOs finalizados`
  },
  suprimentos: {
    label: 'Pedidos de Material',
    value: '28',
    delta: 'Portal Nativo',
    positivo: true,
    icon: Package,
    color: C.green,
    yAxisFormatter: (v: number) => `${v}`,
    tooltipFormatter: (v: number) => `${v} pedidos`
  },
  fotos: {
    label: 'Imagens de Campo',
    value: '40',
    delta: 'Drive integrado',
    positivo: true,
    icon: Camera,
    color: '#06B6D4', // Tech Cyan
    yAxisFormatter: (v: number) => `${v}`,
    tooltipFormatter: (v: number) => `${v} fotos enviadas`
  }
}

export default function Dashboard() {
  const router = useRouter()
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('obras')
  const currentConfig = metricConfig[selectedMetric]

  // ── Dynamic AI insights based on real mock data ────────────────
  const pendingApproval = suprimentos.filter(s => s.lista === 'Aprovação')
  const atrasados = rdos.filter(r => r.resumo.toLowerCase().includes('atraso'))
  const insights = [
    ...(pendingApproval.length > 0 ? [{
      emoji: '💰', color: C.amber,
      text: `Aprovação Pendente: ${pendingApproval.length} pedido(s) de material aguardando liberação em `,
      link: { label: 'Suprimentos', href: '/suprimentos' }
    }] : []),
    ...(atrasados.length > 0 ? [{
      emoji: '⚠️', color: '#EF4444',
      text: `Atraso Operacional (${atrasados[0].obra}): ${atrasados[0].resumo}`,
    }] : []),
    { emoji: '🔧', color: C.amber, text: 'Alerta de Equipamento (Residencial Bela Vista): Falha na bomba de combustível registrada na Minicarregadeira. Manutenção corretiva agendada.' },
  ]

  return (
    <>
      <PageTitle modulo="Painel Principal" titulo="Visao Geral" />

      {/* Quick Action Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: '+ Novo RDO', href: '/rdo', color: C.amber },
          { label: '+ Solicitar Material', href: '/suprimentos', color: C.green },
          { label: 'Ver Galeria', href: '/obras', color: '#3B82F6' },
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
            Processamento Local · Custo Zero
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

      {/* KPIs Grid */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
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

      {/* Recharts Analytics Panel - inspired by 21st.dev */}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
        <Panel title="Andamento das Obras">
          <div style={{ display: 'grid', gap: 16 }}>
            {obras.map(o => (
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

        <Panel title="Suprimentos — Portal Nativo">
          <div style={{ display: 'grid', gap: 12 }}>
            {suprimentos.map((s, i) => (
              <div key={i} style={{ padding: '12px 14px', background: '#16181D', borderRadius: 2, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 6 }}>{s.titulo}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>{s.obra}</span>
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
                  }}>{s.lista}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Fotos — imagens reais do canteiro */}
      <Panel title="Fotos Recentes — Google Drive" action={<ApiBadge />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {fotos.map((f, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4 }}
              onClick={() => router.push('/obras')}
              style={{ borderRadius: 2, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#16181D', cursor: 'pointer' }}
            >
              <div style={{ height: 110, overflow: 'hidden', position: 'relative' }}>
                <img src={f.imagem} alt={f.legenda} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(11,12,14,0.6) 0%, transparent 60%)'
                }} />
              </div>
              <div style={{ padding: '9px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{f.legenda}</div>
                <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 3, fontWeight: 700 }}>{f.obra} · {f.dataISO}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>
    </>
  )
}
