import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const start = Date.now()
    const { count, error } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({
        status: 'warning',
        message: error.message,
        timestamp: new Date().toISOString()
      }, { status: 200 })
    }

    const duration = Date.now() - start

    return NextResponse.json({
      status: 'active',
      database: 'connected',
      responseTimeMs: duration,
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
