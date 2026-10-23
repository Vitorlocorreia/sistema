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

    const [meRes, whatsappRes, usersRes, suppliersRes, billingRes, paymentRes, deliveryRes] = await Promise.allSettled([
      dgenny.me(),
      dgenny.getWhatsAppNumbers(),
      dgenny.getUsers(),
      dgenny.getSuppliers(),
      dgenny.getCatalog('billing-locations'),
      dgenny.getCatalog('payment-methods'),
      dgenny.getCatalog('delivery-locations')
    ])

    if (meRes.status === 'rejected') {
      throw meRes.reason
    }

    const me = meRes.value

    return NextResponse.json({
      configured: true,
      company: me.company,
      key: {
        keyId: me.key.keyId,
        partner: me.key.partner,
        scopes: me.key.scopes
      },
      limits: me.limits,
      whatsappNumbers: whatsappRes.status === 'fulfilled' ? whatsappRes.value?.items || [] : [],
      users: usersRes.status === 'fulfilled' ? usersRes.value?.items || [] : [],
      dgennySuppliers: suppliersRes.status === 'fulfilled' ? suppliersRes.value?.items || [] : [],
      catalogs: {
        billingLocations: billingRes.status === 'fulfilled' ? billingRes.value?.items || [] : [],
        paymentMethods: paymentRes.status === 'fulfilled' ? paymentRes.value?.items || [] : [],
        deliveryLocations: deliveryRes.status === 'fulfilled' ? deliveryRes.value?.items || [] : []
      }
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
