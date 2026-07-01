import { C } from '@/lib/tokens'

export function ApiBadge() {
  return (
    <span style={{
      fontSize: 9, 
      fontWeight: 800, 
      color: C.green,
      background: C.greenDim, 
      padding: '2px 8px', 
      borderRadius: 2,
      border: `1px solid ${C.green}44`,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center'
    }}>
      API ativa
    </span>
  )
}
