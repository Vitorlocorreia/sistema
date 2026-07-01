'use client'
import { Clock, ExternalLink, UserCheck, CalendarDays, Shield } from 'lucide-react'
import { PageTitle } from '@/components/PageTitle'
import { C } from '@/lib/tokens'
import { motion } from 'motion/react'

const features = [
  { icon: UserCheck,    label: 'Reconhecimento facial' },
  { icon: CalendarDays, label: 'Espelho de ponto digital' },
  { icon: Shield,       label: 'Conformidade Portaria 671' },
]

export default function Ponto() {
  return (
    <>
      <PageTitle modulo="Atalho direto" titulo="Ponto & RH" />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        background: C.bgPanel,
        borderRadius: 2,
        border: `1px solid ${C.border}`,
        textAlign: 'center',
        maxWidth: 580,
        margin: '0 auto',
      }}>
        {/* Ícone */}
        <div style={{
          width: 64, height: 64, borderRadius: 2,
          background: `${C.green}22`,
          border: `1px solid ${C.green}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Clock size={28} color={C.green} />
        </div>

        <div style={{
          fontSize: 18, fontWeight: 900, color: C.ink, marginBottom: 10,
          fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          Acesso Direto ao FacePonto
        </div>

        <div style={{
          fontSize: 13, color: C.inkSoft, maxWidth: 360,
          lineHeight: 1.6, marginBottom: 28, fontWeight: 600,
        }}>
          O controle de jornada, reconhecimento facial, espelho de ponto e relatórios de RH continuam sendo gerenciados no FacePonto. Este portal centraliza o acesso.
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
          {features.map(({ icon: Icon, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 2,
              background: C.bgCard, border: `1px solid ${C.border}`,
              fontSize: 11, fontWeight: 700, color: C.inkSoft,
            }}>
              <Icon size={12} color={C.inkSoft} />
              {label}
            </div>
          ))}
        </div>

        <motion.a
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          href="https://faceponto.com.br"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 2,
            background: C.green, color: '#0B0C0E',
            fontSize: 12, fontWeight: 900, textDecoration: 'none',
            textTransform: 'uppercase', letterSpacing: 0.5,
            boxShadow: `0 4px 12px ${C.green}22`,
          }}
        >
          Abrir FacePonto <ExternalLink size={14} />
        </motion.a>
      </div>
    </>
  )
}
