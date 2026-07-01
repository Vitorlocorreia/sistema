'use client'
import { DollarSign, ExternalLink, BarChart3, FileText, CreditCard } from 'lucide-react'
import { PageTitle } from '@/components/PageTitle'
import { C } from '@/lib/tokens'
import { motion } from 'motion/react'

const features = [
  { icon: BarChart3,  label: 'DRE e fluxo de caixa' },
  { icon: FileText,   label: 'Relatórios financeiros' },
  { icon: CreditCard, label: 'Contas a pagar e receber' },
]

export default function Financeiro() {
  return (
    <>
      <PageTitle modulo="Atalho direto" titulo="Financeiro" />

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
        gap: 0,
      }}>
        {/* Ícone */}
        <div style={{
          width: 64, height: 64, borderRadius: 2,
          background: `${C.amber}22`,
          border: `1px solid ${C.amber}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <DollarSign size={28} color={C.amber} />
        </div>

        <div style={{
          fontSize: 18, fontWeight: 900, color: C.ink, marginBottom: 10,
          fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          Acesso Direto ao Total ERP
        </div>

        <div style={{
          fontSize: 13, color: C.inkSoft, maxWidth: 360,
          lineHeight: 1.6, marginBottom: 28, fontWeight: 600,
        }}>
          O módulo financeiro completo — DRE, fluxo de caixa, contas a pagar e relatórios — continua sendo gerenciado no Total ERP. Este portal centraliza o acesso.
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
          href="https://totalerp.com.br"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 2,
            background: C.amber, color: '#0B0C0E',
            fontSize: 12, fontWeight: 900, textDecoration: 'none',
            textTransform: 'uppercase', letterSpacing: 0.5,
            boxShadow: `0 4px 12px ${C.amber}22`,
          }}
        >
          Abrir Total ERP <ExternalLink size={14} />
        </motion.a>
      </div>
    </>
  )
}
