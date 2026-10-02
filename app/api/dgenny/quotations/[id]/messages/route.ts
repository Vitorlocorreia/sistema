import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const searchParams = req.nextUrl.searchParams
    const supplierId = searchParams.get('supplierId')
    const since = searchParams.get('since') || undefined

    if (!id || !supplierId) {
      return NextResponse.json({ ok: false, message: 'Parâmetros "id" e "supplierId" são obrigatórios.' }, { status: 400 })
    }

    const messages = await dgenny.getMessages(id, supplierId, since)
    return NextResponse.json(messages)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'messages_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { supplierId, text, mediaUrl, mime, fileName, caption } = body

    if (!id || !supplierId || (!text && !mediaUrl)) {
      return NextResponse.json(
        { ok: false, message: 'Informe o "supplierId" e o "text" ou "mediaUrl".' },
        { status: 400 }
      )
    }

    const result = await dgenny.sendMessage(id, supplierId, {
      text,
      mediaUrl,
      mime,
      fileName,
      caption
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'send_message_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}
