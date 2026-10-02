import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { supplierId, questionId, text } = body

    if (!id || !supplierId || !questionId || !text) {
      return NextResponse.json(
        { ok: false, message: 'Parâmetros "supplierId", "questionId" e "text" são obrigatórios.' },
        { status: 400 }
      )
    }

    const result = await dgenny.answerAi(id, supplierId, questionId, text)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'answer_ai_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}
