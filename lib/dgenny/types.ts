/**
 * Tipos TypeScript baseados na especificação OpenAPI da dgenny (api.dgenny.com)
 * Arquivo fonte de referência: api-1.json (v0.1.0)
 */

export interface DgennyCompany {
  id: string
  name: string | null
}

export interface DgennyKey {
  keyId: string
  partner: string
  scopes: Array<'read' | 'write'>
}

export interface DgennyLimits {
  reads: {
    limit: number
    remaining: number
    resetAt: string
  }
  writes: {
    limit: number
    remaining: number
    resetAt: string
  }
  searches: {
    limit: number
    remaining: number
    resetAt: string
  }
}

export interface DgennyMeResponse {
  ok: boolean
  company: DgennyCompany
  key: DgennyKey
  limits: DgennyLimits
}

export interface DgennyError {
  ok: false
  error: string
  message: string
  field?: string
}

// ─── FORNECEDORES & BUSCA ───────────────────────────────────────────────────

export interface DgennySupplierSearchRequest {
  type: string
  location: string
  limit?: number
  page?: number
  excludePhones?: string[]
  includeNearbyCities?: boolean
  correlationId?: string
}

export interface DgennyFoundSupplier {
  name: string
  phone: string
  address: string | null
  website: string | null
  rating: number | null
  distanceKm: number | null
  whatsappVerified: boolean
}

export interface DgennySupplierSearchResponse {
  ok: boolean
  searchId: string
  suppliers: DgennyFoundSupplier[]
}

export interface DgennyWhatsAppNumber {
  id: string
  phone: string
  displayName: string | null
  provider: 'meta' | 'evolution' | 'zapi' | 'twilio'
  connected: boolean
  isDefault: boolean
}

// ─── COTAÇÕES ───────────────────────────────────────────────────────────────

export type DgennyFreight = 'CIF' | 'FOB' | 'INSTALLED' | 'PICKUP' | 'NO_FREIGHT' | 'NEGOTIABLE'
export type DgennyQuotationStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled' | 'closed'

export interface DgennyQuotationItemInput {
  itemNumber: number
  description: string
  quantity: number
  unit: string
  estimatedPrice?: string | number
  observation?: string
  purchaseRequestId?: number
}

export interface DgennyQuotationSupplierInput {
  externalId?: string
  name: string
  contactName?: string
  phone: string // Com DDI (apenas dígitos, ex: 5548999990000)
}

export interface DgennyCreateQuotationRequest {
  externalId: string
  name: string
  observation?: string
  freight: DgennyFreight
  proposalDeadline: string // YYYY-MM-DD
  deliveryDeadline?: string | null // YYYY-MM-DD ou null
  deliveryLocation: {
    id?: string
    externalId?: string
    title?: string
    address?: string
    observation?: string
  }
  billingLocation: {
    id?: string
    externalId?: string
    title?: string
    cnpj?: string
    razaoSocial?: string
    nomeFantasia?: string
    address?: string
    observation?: string
  }
  paymentMethod: {
    id?: string
    externalId?: string
    title?: string
    description?: string
    observation?: string
  }
  buyer?: {
    email: string
  }
  whatsappNumber?: string
  items: DgennyQuotationItemInput[]
  suppliers: DgennyQuotationSupplierInput[]
  start?: {
    at?: string // ISO 8601 com timezone
  }
  engine?: 'b2b' | 'b2c'
}

export interface DgennyCreateQuotationResponse {
  ok: boolean
  quotationId: string
  externalId: string
  status: DgennyQuotationStatus
  suppliers: Array<{
    supplierId: string
    externalId?: string
    accepted: boolean
  }>
  dispatch?: {
    queued: number
    onHold: number
    scheduled: number
    errors: Array<{
      supplierId: string
      supplierName: string
      error: string
      message: string
    }>
  }
}

export interface DgennyStartQuotationResponse {
  ok: boolean
  quotationId: string
  status: DgennyQuotationStatus
  scheduledFor: string | null
  dispatch: {
    queued: number
    onHold: number
    scheduled: number
    errors: Array<{
      supplierId: string
      supplierName: string
      error: string
      message: string
    }>
  }
}

export interface DgennyQuotationDetail {
  ok: boolean
  id: string
  externalId: string
  name: string
  status: DgennyQuotationStatus
  source: string
  engine: string
  createdAt: string
  updatedAt: string
  scheduledFor: string | null
  whatsappNumber?: string
  observation?: string
  conditions: {
    freight: DgennyFreight
    paymentMethod: { id: string; name: string }
    billingLocation: { id: string; name: string }
    deliveryLocation: { id: string; name: string }
    proposalDeadline: string
    deliveryDeadline: string | null
  }
  items: Array<{
    itemNumber: number
    description: string
    quantity: number
    unit: string
    estimatedPrice?: string
    observation?: string
    purchaseRequestId?: number
  }>
  suppliers: Array<{
    supplierId: string
    name: string
    contactName: string | null
    phone: string
    selected: boolean
    negotiationStatus: 'not_started' | 'queued' | 'scheduled' | 'on_hold' | 'active' | 'completed' | 'interrupted' | 'failed'
    winner: boolean
  }>
}

// ─── NEGOCIAÇÕES & MENSAGENS ────────────────────────────────────────────────

export interface DgennyPendingQuestion {
  messageId: string
  text: string
  askedAt: string
}

export interface DgennyNegotiationItem {
  supplierId: string
  name: string
  phone: string
  status: 'not_started' | 'queued' | 'scheduled' | 'on_hold' | 'active' | 'completed' | 'interrupted' | 'failed'
  holdPosition: number | null
  scheduledFor: string | null
  winner: boolean
  aiPaused: boolean
  followupPaused: boolean
  lastMessageAt: string | null
  lastMessageFrom: 'supplier' | 'ai' | 'operator' | 'system' | null
  unansweredFromSupplier: boolean
  hasBudget: boolean
  pendingQuestion: DgennyPendingQuestion | null
}

export interface DgennyMessage {
  id: string
  direction: 'in' | 'out'
  author: 'supplier' | 'ai' | 'operator' | 'system'
  kind: 'text' | 'template' | 'document' | 'card'
  text: string
  media?: {
    mime: string
    fileName: string
    hasContent: boolean
  } | null
  sentAt: string
  status: 'sent' | 'delivered' | 'read' | null
  isFirstMessage: boolean
  truncated: boolean
}

// ─── ORÇAMENTOS & COMPARATIVO ───────────────────────────────────────────────

export interface DgennyOffer {
  supplierId: string
  unitPrice: string
  total: string
  ipiPercent: number | null
  quantity: number
  onList: boolean
  substitute: boolean
  description: string | null
}

export interface DgennyComparisonItem {
  itemNumber: number | null
  description: string
  quantity: number
  unit: string | null
  offers: DgennyOffer[]
  bestSupplierId: string | null
  bestTotal: string | null
}

export interface DgennyComparisonSupplier {
  supplierId: string
  name: string
  itemsQuoted: number
  itemsMissing: number
  complete: boolean
  subtotal: string
  ipiTotal: string
  freight: string
  discount: string
  otherItems: string
  total: string
  settled: boolean
  paymentTerms: Array<{
    days: number
    percentage: number
    amount: string | null
  }>
  paymentMethod: string | null
  deliveryTerm: string | null
}

export interface DgennyComparisonResponse {
  ok: boolean
  quotationId: string
  items: DgennyComparisonItem[]
  suppliers: DgennyComparisonSupplier[]
  bestTotalSupplierId: string | null
  generatedAt: string
}

export interface DgennyBudgetItem {
  supplierId: string
  supplierName: string
  status: 'received' | 'manual'
  total: string
  discount: string | null
  freight: string | null
  paymentMethod: string | null
  paymentTerms: Array<{
    days: number
    percentage: number
    amount: string | null
  }>
  deliveryTerm: string | null
  supplierDocument: string | null
  summary: string | null
  notes: string | null
  savingsPercent: number | null
  coverage: {
    complete: boolean | null
    note: string | null
  }
  receivedAt: string
}
