import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const suppliers = Array.isArray(body?.suppliers) ? body.suppliers : []

    if (!id) {
      return NextResponse.json({ ok: false, message: 'ID da cotação é obrigatório.' }, { status: 400 })
    }

    if (suppliers.length === 0) {
      return NextResponse.json({ ok: false, message: 'Informe ao menos um fornecedor para adicionar.' }, { status: 400 })
    }

    // Normaliza os telefones garantindo somente dígitos e DDI 55 se aplicável
    const formattedSuppliers = suppliers.map((s: any) => {
      let phone = String(s.phone || '').replace(/\D/g, '')
      if (phone.length === 10 || phone.length === 11) {
        phone = '55' + phone
      }
      return {
        name: String(s.name || '').trim(),
        phone,
        contactName: s.contactName ? String(s.contactName).trim() : undefined,
        externalId: s.externalId ? String(s.externalId).trim() : undefined
      }
    })

    const res = await dgenny.addSuppliers(id, formattedSuppliers)
    return NextResponse.json(res)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'add_suppliers_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}
