import { C } from '@/lib/tokens'

type Status = 'novo' | 'integrado' | 'atalho'

const map: Record<Status, { label: string; bg: string; fg: string; border: string }> = {
  novo:      { label: 'Novo módulo',   bg: C.amberDim,  fg: C.amber,  border: `1px solid ${C.amber}44` },
  integrado: { label: 'API conectada', bg: C.greenDim,  fg: C.green,  border: `1px solid ${C.green}44` },
  atalho:    { label: 'Atalho direto', bg: '#16181D',   fg: C.inkSoft, border: `1px solid ${C.border}`  },
}

export function StatusBadge({ status }: { status: Status }) {
  const s = map[status]
  return (
    <span style={{
      fontSize: 9, 
      fontWeight: 800, 
      letterSpacing: 0.8,
      textTransform: 'uppercase', 
      padding: '2px 8px',
      borderRadius: 2, 
      background: s.bg, 
      color: s.fg,
      border: s.border,
      display: 'inline-flex', 
      alignItems: 'center'
    }}>
      {s.label}
    </span>
  )
}
