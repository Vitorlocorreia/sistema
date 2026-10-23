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

function sanitizeExternalId(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_:-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return (cleaned || `ID-${Date.now()}`).slice(0, 120)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      suprimentoId,
      codigo,
      name,
      observation,
      freight = 'CIF',
      proposalDeadline,
      deliveryDeadline,
      deliveryLocation,
      billingLocation,
      paymentMethod,
      buyerEmail,
      whatsappNumber,
      items,
      suppliers,
      documents,
      startImmediately = true,
      resend = true
    } = body

    if (!items || !items.length) {
      return NextResponse.json({ ok: false, message: 'Ao menos 1 item deve ser incluído na cotação.' }, { status: 400 })
    }

    if (!suppliers || !suppliers.length) {
      return NextResponse.json({ ok: false, message: 'Ao menos 1 fornecedor com telefone WhatsApp deve ser selecionado.' }, { status: 400 })
    }

    // Normaliza e remove duplicatas de fornecedores por telefone (exige DDI em dígitos, min 12 dígitos)
    const seenPhones = new Set<string>()
    const formattedSuppliers: any[] = []

    suppliers.forEach((s: any, idx: number) => {
      const phone = formatPhoneToE164Digits(s.phone || s.telefone || '')
      if (phone.length >= 12 && !seenPhones.has(phone)) {
        seenPhones.add(phone)
        formattedSuppliers.push({
          externalId: sanitizeExternalId(s.externalId || s.id || `FORN-${idx + 1}`),
          name: (s.name || s.razao_social || 'Fornecedor').trim(),
          contactName: s.contactName ? String(s.contactName).trim() : undefined,
          phone
        })
      }
    })

    if (!formattedSuppliers.length) {
      return NextResponse.json(
        { ok: false, message: 'Nenhum fornecedor possui telefone válido com DDD/DDI (ex: 5511999999999).' },
        { status: 400 }
      )
    }

    // Normaliza itens conforme especificação OpenAPI dgenny
    const formattedItems = items.map((it: any, idx: number) => {
      const rawPrice = it.estimatedPrice ?? it.valor
      const numPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== '' ? Number(rawPrice) : NaN
      return {
        itemNumber: idx + 1,
        description: String(it.description || it.descricao || 'Material solicitado').trim(),
        quantity: Math.max(0.01, Number(it.quantity || it.qtd_pedida || 1)),
        unit: String(it.unit || it.unidade || 'UN').trim().toUpperCase().slice(0, 10) || 'UN',
        estimatedPrice: !isNaN(numPrice) && numPrice > 0 ? Number(numPrice.toFixed(2)) : undefined,
        observation: it.observation ? String(it.observation).trim() : undefined
      }
    })

    // Resolve buyerEmail obrigatório na API dgenny
    let resolvedBuyerEmail = buyerEmail ? String(buyerEmail).trim() : ''
    if (!resolvedBuyerEmail) {
      try {
        const usersRes = await dgenny.getUsers()
        const users = usersRes?.items || []
        const preferred =
          users.find(u => u.email.toLowerCase().includes('victor')) ||
          users.find(u => u.email.toLowerCase().includes('kassio')) ||
          users[0]
        if (preferred?.email) {
          resolvedBuyerEmail = preferred.email
        }
      } catch {
        // fallback abaixo
      }
    }
    if (!resolvedBuyerEmail) {
      resolvedBuyerEmail = 'victor@jwasa.com.br'
    }

    // Resolve billingLocation oficial da JWA se não enviado com ID
    let resolvedBillingLocation: any = billingLocation?.id
      ? { id: billingLocation.id }
      : null

    if (!resolvedBillingLocation) {
      try {
        const billingCat = await dgenny.getCatalog('billing-locations')
        const firstBilling = billingCat?.items?.[0]
        if (firstBilling?.id) {
          resolvedBillingLocation = { id: firstBilling.id }
        }
      } catch {
        // fallback abaixo
      }
    }
    if (!resolvedBillingLocation) {
      resolvedBillingLocation = {
        externalId: sanitizeExternalId(billingLocation?.externalId || 'FAT-JWA-MATRIZ'),
        title: billingLocation?.title || 'JWA S.A.',
        cnpj: (billingLocation?.cnpj || '37995880000193').replace(/\D/g, '') || '37995880000193',
        razaoSocial: 'Jwa S.A.'
      }
    }

    // Resolve paymentMethod
    let resolvedPaymentMethod: any = paymentMethod?.id
      ? { id: paymentMethod.id }
      : null

    if (!resolvedPaymentMethod && !paymentMethod?.title) {
      try {
        const payCat = await dgenny.getCatalog('payment-methods')
        const firstPay = payCat?.items?.[0]
        if (firstPay?.id) {
          resolvedPaymentMethod = { id: firstPay.id }
        }
      } catch {
        // fallback abaixo
      }
    }
    if (!resolvedPaymentMethod) {
      resolvedPaymentMethod = {
        externalId: sanitizeExternalId(paymentMethod?.externalId || `PAG-${paymentMethod?.title || 'COMBINAR'}`),
        title: paymentMethod?.title || 'A Combinar',
        description: paymentMethod?.description || 'Pagamento de acordo com as condições negociadas'
      }
    }

    // Resolve deliveryLocation da Obra
    const resolvedDeliveryLocation = deliveryLocation?.id
      ? { id: deliveryLocation.id }
      : {
          externalId: sanitizeExternalId(deliveryLocation?.externalId || `OBRA-${deliveryLocation?.title || 'CANTEIRO'}`),
          title: deliveryLocation?.title || 'Canteiro da Obra JWA',
          address: deliveryLocation?.address || deliveryLocation?.title || 'Canteiro da Obra JWA',
          observation: deliveryLocation?.observation ? String(deliveryLocation.observation).trim() : undefined
        }

    const baseExtId = codigo
      ? sanitizeExternalId(codigo)
      : suprimentoId
      ? sanitizeExternalId(`SUP-${suprimentoId.slice(0, 8)}`)
      : `SUP-${Date.now()}`

    const createPayload: any = {
      externalId: baseExtId,
      resend: Boolean(resend),
      name: name || `Cotação ${codigo || baseExtId}`,
      observation: observation || undefined,
      freight,
      proposalDeadline: proposalDeadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      deliveryDeadline: deliveryDeadline || null,
      deliveryLocation: resolvedDeliveryLocation,
      billingLocation: resolvedBillingLocation,
      paymentMethod: resolvedPaymentMethod,
      buyer: { email: resolvedBuyerEmail },
      items: formattedItems,
      suppliers: formattedSuppliers
    }

    if (whatsappNumber) {
      createPayload.whatsappNumber = whatsappNumber
    }

    if (Array.isArray(documents) && documents.length > 0) {
      createPayload.documents = documents.slice(0, 10)
    }

    // Cria a cotação no dgenny
    const createdQuotation = await dgenny.createQuotation(createPayload)

    // Se solicitado disparo imediato e nasceu como draft, dispara a negociação no WhatsApp
    let startResult = null
    if (startImmediately && createdQuotation.quotationId && createdQuotation.status === 'draft') {
      try {
        startResult = await dgenny.startQuotation(createdQuotation.quotationId)
      } catch (startErr: any) {
        startResult = { ok: false, error: startErr.dgennyError, message: startErr.message }
      }
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
        detalhe: `Cotação com IA no WhatsApp criada na dgenny (${formattedSuppliers.length} fornecedor(es), Comprador: ${resolvedBuyerEmail}). ID: ${createdQuotation.quotationId}`,
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
      {
        ok: false,
        error: error.dgennyError || 'quotation_create_error',
        message: error.message,
        field: error.field,
        quotationId: error.quotationId
      },
      { status: error.status || 500 }
    )
  }
}
