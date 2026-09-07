import { useEffect, startTransition } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Silently refreshes data when Supabase Realtime fires a postgres_changes event
 * or when the browser tab regains focus.
 *
 * Uses React's startTransition so the update is treated as non-urgent —
 * React keeps the current UI visible and swaps in the new data only when ready,
 * producing a seamless, Gmail-like update with zero visible flash.
 */
export function useRealtimeSync(
  load: (isBackground?: boolean) => Promise<void> | void,
  channelName: string,
  tables?: string[],
) {
  useEffect(() => {
    // Debounce alargado (800ms): agrupa rajadas e evita múltiplos downloads pesados
    let timer: ReturnType<typeof setTimeout> | null = null
    const trigger = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        // Se a aba estiver em segundo plano/oculta, não gasta tráfego à toa
        if (typeof document !== 'undefined' && document.hidden) return
        startTransition(() => { void load(true) })
      }, 800)
    }

    // 2. Subscribe to Supabase Realtime WebSocket events SOMENTE nas tabelas solicitadas
    let channel = supabase.channel(channelName)

    if (tables && tables.length > 0) {
      tables.forEach(table => {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          trigger,
        )
      })
      channel.subscribe()
    }

    return () => {
      if (timer) clearTimeout(timer)
      if (tables && tables.length > 0) {
        supabase.removeChannel(channel)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, channelName, JSON.stringify(tables)])
}
