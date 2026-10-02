import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'
import { supabase } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { suprimentoId, winnerSupplierId, winnerSupplierName, finalPrice } = body

    if (!id || !winnerSupplierId) {
      return NextResponse.json(
        { ok: false, message: 'Parâmetros "id" e "winnerSupplierId" são obrigatórios.' },
        { status: 400 }
      )
    }

    // Encerra a cotação no dgenny
    const result = await dgenny.completeQuotation(id, winnerSupplierId)

    // Se tiver suprimentoId, avança para Aprovação no sistema
    if (suprimentoId) {
      const { data: currentSup } = await supabase
        .from('suprimentos')
        .select('historico_atividades')
        .eq('id', suprimentoId)
        .single()

      const historicoAtual = Array.isArray(currentSup?.historico_atividades) ? currentSup.historico_atividades : []
      const novaAtividade = {
        id: `act-dgenny-winner-${Date.now()}`,
        acao: 'cotacao_concluida',
        data: new Date().toISOString(),
        detalhe: `Cotação com IA dgenny finalizada. Fornecedor vencedor: ${winnerSupplierName || winnerSupplierId}. Valor final: R$ ${Number(finalPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        autor_nome: 'IA dgenny'
      }

      const updateData: any = {
        status: 'Aprovação',
        historico_atividades: [novaAtividade, ...historicoAtual]
      }

      if (winnerSupplierName) {
        updateData.fornecedor = winnerSupplierName
      }
      if (finalPrice) {
        updateData.valor = Number(finalPrice)
      }

      await supabase
        .from('suprimentos')
        .update(updateData)
        .eq('id', suprimentoId)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'complete_quotation_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}
