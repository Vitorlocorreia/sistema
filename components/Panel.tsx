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
      borderRadius: 6, 
      border: `1px solid ${C.border}`, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
    }}>
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{
          padding: '14px 20px', 
          borderBottom: `1px solid ${C.border}`,
          background: C.bgPanel
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 8, height: 8, background: '#FFE500', borderRadius: 1 }} />
          <span style={{ 
            fontSize: 12, 
            fontWeight: 900, 
            color: C.ink, 
            textTransform: 'uppercase', 
            letterSpacing: 0.8,
            fontFamily: 'var(--font-display)' 
          }}>{title}</span>
        </div>
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
