import { C } from '@/lib/tokens'

export function PageTitle({ 
  modulo, 
  titulo, 
  subtitle,
  action 
}: { 
  modulo: string; 
  titulo: string; 
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
      <div>
        {/* Assinatura Visual JWA: Marcador Duplo de Seção ⬛ 🟨 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <div style={{ width: 22, height: 5, background: C.ink, borderRadius: 1 }} />
          <div style={{ width: 22, height: 5, background: C.yellow, borderRadius: 1 }} />
          <span style={{ 
            fontSize: 10, 
            fontWeight: 900, 
            color: C.ink, 
            textTransform: 'uppercase', 
            letterSpacing: 2, 
            marginLeft: 6
          }}>
            {modulo}
          </span>
        </div>
        <h1 style={{ 
          fontSize: 26, 
          fontWeight: 900, 
          color: C.ink, 
          letterSpacing: '-0.01em', 
          fontFamily: 'var(--font-display)',
          lineHeight: 1.15,
          margin: 0,
          textTransform: 'uppercase'
        }}>
          {titulo}
        </h1>
        {subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {action}
        </div>
      )}
    </div>
  )
}

