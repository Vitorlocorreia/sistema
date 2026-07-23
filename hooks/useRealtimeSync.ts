import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useRealtimeSync(load: (isBackground?: boolean) => Promise<void> | void, channelName: string, tables?: string[]) {
  useEffect(() => {
    // 1. Recarrega quando a aba do navegador volta a ter foco (Visibility Change)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void load(true)
      }
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)

    // 2. Supabase Realtime (WebSockets)
    let channel = supabase.channel(channelName)
    
    if (tables && tables.length > 0) {
      tables.forEach(table => {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          void load(true)
        })
      })
    } else {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public' }, () => {
        void load(true)
      })
    }

    channel.subscribe()

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [load, channelName, JSON.stringify(tables)])
}
