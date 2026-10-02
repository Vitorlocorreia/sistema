import { NextRequest, NextResponse } from 'next/server'
import { dgenny } from '@/lib/dgenny/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, location, limit, excludePhones, includeNearbyCities } = body

    if (!type || !location) {
      return NextResponse.json(
        { ok: false, message: 'Os campos "type" (material/serviço) e "location" (cidade, UF) são obrigatórios.' },
        { status: 400 }
      )
    }

    const result = await dgenny.searchSuppliers({
      type,
      location,
      limit: limit ? Number(limit) : 10,
      excludePhones: Array.isArray(excludePhones) ? excludePhones : [],
      includeNearbyCities: Boolean(includeNearbyCities)
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.dgennyError || 'search_error', message: error.message },
      { status: error.status || 500 }
    )
  }
}
