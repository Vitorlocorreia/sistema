'use client'
import { LucideIcon } from 'lucide-react'
import { C } from '@/lib/tokens'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { motion } from 'motion/react'

interface Props {
  label: string
  valor: string
  delta?: string
  positivo?: boolean
  icon: LucideIcon
  active?: boolean
  onClick?: () => void
}

export function KpiCard({ label, valor, delta, positivo, icon: Icon, active, onClick }: Props) {
  const isClickable = !!onClick;
  
  return (
    <motion.div
      whileHover={isClickable ? { scale: 1.01, y: -2 } : {}}
      whileTap={isClickable ? { scale: 0.98 } : {}}
      onClick={onClick}
      style={{
        background: active ? C.amberDim : C.bgPanel,
        borderRadius: 2,
        padding: '18px 20px',
        border: active ? `1px solid ${C.amber}` : `1px solid ${C.border}`,
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
      }}
      className="group select-none"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, minWidth: 0 }}>
        <span style={{ 
          fontSize: 10, 
          color: active ? C.amber : C.inkSoft, 
          fontWeight: 800, 
          textTransform: 'uppercase', 
          letterSpacing: 0.8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>{label}</span>
        <Icon size={16} color={active ? C.amber : C.inkSoft} className="group-hover:text-amber-500 transition-colors shrink-0" />
      </div>
      <div 
        style={{ 
          fontSize: 20, 
          fontWeight: 900, 
          color: C.ink, 
          letterSpacing: -0.5, 
          fontFamily: 'var(--font-display)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-all'
        }}
        title={valor}
      >
        {valor}
      </div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {positivo
            ? <ArrowUpRight size={13} color={C.green} />
            : <ArrowDownRight size={13} color={C.red} />}
          <span style={{ fontSize: 11, fontWeight: 800, color: positivo ? C.green : C.red }}>
            {delta}
          </span>
        </div>
      )}
    </motion.div>
  )
}
