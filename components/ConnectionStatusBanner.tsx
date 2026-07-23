'use client'

import { useEffect, useState } from 'react'
import { C } from '@/lib/tokens'

/**
 * Banner fixo no topo da tela que aparece quando:
 * - O navegador perde conexão com a internet (navigator.onLine / offline event)
 * - O Supabase Realtime WebSocket cai (canal com status 'CLOSED' ou 'CHANNEL_ERROR')
 *
 * Desaparece automaticamente quando a conexão é restaurada.
 */
export function ConnectionStatusBanner() {
  const [offline, setOffline] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    // 1. Detecção de internet pelo browser
    const handleOffline = () => { setOffline(true); setReconnecting(false) }
    const handleOnline = () => {
      setReconnecting(true)
      // Aguarda 1.5s para confirmar que a conexão está estável
      setTimeout(() => { setOffline(false); setReconnecting(false) }, 1500)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Verifica estado inicial (ex: página carregada offline)
    if (!navigator.onLine) setOffline(true)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!offline && !reconnecting) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '10px 20px',
        fontSize: 12,
        fontWeight: 700,
        background: reconnecting ? '#065F46' : '#7F1D1D',
        color: reconnecting ? '#6EE7B7' : '#FCA5A5',
        borderBottom: `1px solid ${reconnecting ? '#059669' : '#991B1B'}`,
        transition: 'background 0.4s ease',
      }}
    >
      {reconnecting ? (
        <>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 1s infinite' }} />
          Conexão restaurada — sincronizando dados…
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
          Sem conexão com a internet — as alterações não estão sendo salvas
        </>
      )}
    </div>
  )
}
