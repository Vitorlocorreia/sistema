import { C } from '@/lib/tokens'

export function PageTitle({ modulo, titulo }: { modulo: string; titulo: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ 
        fontSize: 10, 
        fontWeight: 800, 
        color: C.amber, 
        textTransform: 'uppercase', 
        letterSpacing: 1.5, 
        marginBottom: 6 
      }}>
        {modulo}
      </div>
      <h1 style={{ 
        fontSize: 32, 
        fontWeight: 900, 
        color: C.ink, 
        letterSpacing: '-0.02em', 
        fontFamily: 'var(--font-display)',
        lineHeight: 1.1
      }}>{titulo}</h1>
    </div>
  )
}
