import { createClient } from '@supabase/supabase-js'

let rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xqackyuxipcxvmliecow.supabase.co').trim()
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = rawUrl.includes('.') ? `https://${rawUrl}` : `https://${rawUrl}.supabase.co`
}
const url = rawUrl
const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk'

export const supabase = createClient(url, anon)

/**
 * Utilitário para buscar TODOS os registros de uma tabela no Supabase,
 * superando o limite padrão de 1.000 linhas do PostgREST via paginação automática por chunks.
 */
export async function fetchAllChunks<T = any>(
  buildQuery: (supabaseClient: typeof supabase) => any,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> {
  let all: T[] = []
  let page = 0
  while (true) {
    const q = buildQuery(supabase)
    const { data, error } = await q.range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) return { data: all, error }
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    page++
  }
  return { data: all, error: null }
}
