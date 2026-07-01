import { C } from '@/lib/tokens'
import { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  children: ReactNode
}

export function Panel({ title, action, children }: Props) {
  return (
    <div style={{ 
      background: C.bgPanel, 
      borderRadius: 2, 
      border: `1px solid ${C.border}`, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{
          padding: '14px 20px', 
          borderBottom: `1px solid ${C.border}`,
          background: '#161821'
        }}
      >
        <span style={{ 
          fontSize: 12, 
          fontWeight: 900, 
          color: C.ink, 
          textTransform: 'uppercase', 
          letterSpacing: 0.8,
          fontFamily: 'var(--font-display)' 
        }}>{title}</span>
        {action && (
          <div className="flex flex-wrap items-center gap-2">
            {action}
          </div>
        )}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}
