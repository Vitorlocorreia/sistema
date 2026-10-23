import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ ok: false, message: 'ID da cotação é obrigatório.' }, { status: 400 })
    }

    const [quotation, negotiationsResult, comparisonResult, budgetsResult] = await Promise.allSettled([
      dgenny.getQuotation(id),
      dgenny.getNegotiations(id),
      dgenny.getComparison(id),
      dgenny.getBudgets(id)
    ])

    return NextResponse.json({
      ok: true,
      quotation: quotation.status === 'fulfilled' ? quotation.value : null,
      negotiations: negotiationsResult.status === 'fulfilled' ? negotiationsResult.value?.items || [] : [],
      comparison: comparisonResult.status === 'fulfilled' ? comparisonResult.value : null,
      budgets: budgetsResult.status === 'fulfilled' ? budgetsResult.value?.items || [] : []
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'quotation_fetch_error', message: error.message },
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
    const { action, supplierId, reason } = body

    if (!id || !action) {
      return NextResponse.json({ ok: false, message: 'ID da cotação e ação são obrigatórios.' }, { status: 400 })
    }

    if (action === 'start') {
      const res = await dgenny.startQuotation(id)
      return NextResponse.json(res)
    }

    if (action === 'cancel') {
      const res = await dgenny.cancelQuotation(id, reason)
      return NextResponse.json(res)
    }

    if (action === 'pause_ai' && supplierId) {
      const res = await dgenny.pauseAi(id, supplierId)
      return NextResponse.json(res)
    }

    if (action === 'resume_ai' && supplierId) {
      const res = await dgenny.resumeAi(id, supplierId)
      return NextResponse.json(res)
    }

    if (action === 'interrupt' && supplierId) {
      const res = await dgenny.interruptNegotiation(id, supplierId)
      return NextResponse.json(res)
    }

    if (action === 'reopen' && supplierId) {
      const res = await dgenny.reopenNegotiation(id, supplierId)
      return NextResponse.json(res)
    }

    if (action === 'reprocess_budget' && supplierId) {
      const res = await dgenny.reprocessBudget(id, supplierId)
      return NextResponse.json(res)
    }

    return NextResponse.json({ ok: false, message: `Ação desconhecida: ${action}` }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'quotation_action_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}
