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
    // Debounce: coalesce bursts of events into a single fetch
    let timer: ReturnType<typeof setTimeout> | null = null
    const trigger = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        startTransition(() => { void load(true) })
      }, 120)
    }

    // 1. Re-fetch silently when the tab comes back into focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') trigger()
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)

    // 2. Subscribe to Supabase Realtime WebSocket events
    let channel = supabase.channel(channelName)

    if (tables && tables.length > 0) {
      tables.forEach(table => {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          trigger,
        )
      })
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        trigger,
      )
    }

    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, channelName, JSON.stringify(tables)])
}
