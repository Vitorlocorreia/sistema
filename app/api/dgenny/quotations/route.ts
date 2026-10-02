import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'
import { supabase } from '@/lib/supabase'

function formatPhoneToE164Digits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      suprimentoId,
      name,
      freight = 'CIF',
      proposalDeadline,
      deliveryDeadline,
      deliveryLocation,
      billingLocation,
      paymentMethod,
      buyerEmail,
      items,
      suppliers,
      startImmediately = true
    } = body

    if (!items || !items.length) {
      return NextResponse.json({ ok: false, message: 'Ao menos 1 item deve ser incluído na cotação.' }, { status: 400 })
    }

    if (!suppliers || !suppliers.length) {
      return NextResponse.json({ ok: false, message: 'Ao menos 1 fornecedor com telefone deve ser selecionado.' }, { status: 400 })
    }

    // Normaliza fornecedores para dgenny (exige DDI em dígitos)
    const formattedSuppliers = suppliers.map((s: any, idx: number) => ({
      externalId: s.externalId || s.id || `FORN-${idx + 1}`,
      name: s.name || s.razao_social || 'Fornecedor',
      contactName: s.contactName || undefined,
      phone: formatPhoneToE164Digits(s.phone || s.telefone || '')
    }))

    // Normaliza itens
    const formattedItems = items.map((it: any, idx: number) => ({
      itemNumber: idx + 1,
      description: it.description || it.descricao || 'Item sem descrição',
      quantity: Number(it.quantity || it.qtd_pedida || 1),
      unit: (it.unit || it.unidade || 'UN').toUpperCase().slice(0, 10),
      estimatedPrice: it.estimatedPrice || it.valor ? Number(it.estimatedPrice || it.valor) : undefined,
      observation: it.observation || undefined
    }))

    const extId = `SUP-${suprimentoId ? suprimentoId.slice(0, 8) : Date.now()}`

    const createPayload: any = {
      externalId: extId,
      name: name || `Cotação ${extId}`,
      freight,
      proposalDeadline: proposalDeadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      deliveryDeadline: deliveryDeadline || null,
      deliveryLocation: deliveryLocation?.id
        ? { id: deliveryLocation.id }
        : {
            externalId: deliveryLocation?.externalId || 'OBRA-PADRAO',
            title: deliveryLocation?.title || 'Canteiro da Obra',
            address: deliveryLocation?.address || 'Endereço da Obra'
          },
      billingLocation: billingLocation?.id
        ? { id: billingLocation.id }
        : {
            externalId: billingLocation?.externalId || 'FAT-MATRIZ',
            title: billingLocation?.title || 'Construtora',
            cnpj: (billingLocation?.cnpj || '00.000.000/0001-00').replace(/\D/g, '') || '12345678000195'
          },
      paymentMethod: paymentMethod?.id
        ? { id: paymentMethod.id }
        : {
            externalId: paymentMethod?.externalId || 'COND-28',
            title: paymentMethod?.title || 'Boleto 28 dias',
            description: paymentMethod?.description || 'Faturado 28 dias'
          },
      items: formattedItems,
      suppliers: formattedSuppliers
    }

    if (buyerEmail) {
      createPayload.buyer = { email: buyerEmail }
    }

    // Cria a cotação no dgenny
    const createdQuotation = await dgenny.createQuotation(createPayload)

    // Se solicitado, já dispara a negociação no WhatsApp
    let startResult = null
    if (startImmediately && createdQuotation.quotationId) {
      startResult = await dgenny.startQuotation(createdQuotation.quotationId)
    }

    // Se temos um suprimento vinculado, atualiza status para 'Em Cotação' e salva no histórico
    if (suprimentoId) {
      const { data: currentSup } = await supabase
        .from('suprimentos')
        .select('historico_atividades')
        .eq('id', suprimentoId)
        .single()

      const historicoAtual = Array.isArray(currentSup?.historico_atividades) ? currentSup.historico_atividades : []
      const novaAtividade = {
        id: `act-dgenny-${Date.now()}`,
        acao: 'dgenny_cotacao_iniciada',
        data: new Date().toISOString(),
        detalhe: `Cotação com IA no WhatsApp disparada pela dgenny (${formattedSuppliers.length} fornecedores). ID: ${createdQuotation.quotationId}`,
        autor_nome: 'IA dgenny',
        dgenny_quotation_id: createdQuotation.quotationId
      }

      await supabase
        .from('suprimentos')
        .update({
          status: 'Em Cotação',
          historico_atividades: [novaAtividade, ...historicoAtual]
        })
        .eq('id', suprimentoId)
    }

    return NextResponse.json({
      ok: true,
      quotation: createdQuotation,
      startResult
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'quotation_create_error', message: error.message, field: error.field },
      { status: error.status || 500 }
    )
  }
}
