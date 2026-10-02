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
