'use client'
import { Truck, ExternalLink } from 'lucide-react'
import { PageTitle } from '@/components/PageTitle'
import { C } from '@/lib/tokens'
import { motion } from 'motion/react'

export default function Frota() {
  return (
    <>
      <PageTitle modulo="Atalho direto" titulo="Frota & GPS" />
      
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
        margin: '0 auto'
      }}>
        <div style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 2, 
          background: C.border, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: 20 
        }}>
          <Truck size={28} color={C.amber} />
        </div>
        
        <div style={{ 
          fontSize: 18, 
          fontWeight: 900, 
          color: C.ink, 
          marginBottom: 10,
          fontFamily: 'var(--font-display)',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        }}>Acesso Direto ao Infleet</div>
        
        <div style={{ 
          fontSize: 13, 
          color: C.inkSoft, 
          maxWidth: 360, 
          lineHeight: 1.6, 
          marginBottom: 24,
          fontWeight: 600
        }}>
          O Infleet continua sendo usado normalmente. O portal centraliza o acesso — clique para abrir em uma nova aba, sem precisar guardar outro link.
        </div>
        
        <motion.a
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          href="https://app.infleet.com.br"
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '10px 22px', 
            borderRadius: 2, 
            background: C.amber, 
            color: '#0B0C0E', 
            fontSize: 12, 
            fontWeight: 900, 
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            boxShadow: `0 4px 12px ${C.amber}22`
          }}
        >
          Abrir Infleet <ExternalLink size={14} />
        </motion.a>
      </div>
    </>
  )
}
