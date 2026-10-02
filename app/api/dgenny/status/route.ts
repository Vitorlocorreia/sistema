import { NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'

export async function GET() {
  try {
    if (!dgenny.isConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'DGENNY_API_KEY não configurada no arquivo .env.local.'
      })
    }

    const me = await dgenny.me()

    return NextResponse.json({
      configured: true,
      company: me.company,
      key: {
        keyId: me.key.keyId,
        scopes: me.key.scopes
      },
      limits: me.limits
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        configured: false,
        error: error.message || 'Falha ao autenticar com a API dgenny',
        status: error.status || 500
      },
      { status: 200 } // Retornamos 200 para a UI exibir o estado sem quebrar a tela
    )
  }
}
