import {
  DgennyMeResponse,
  DgennySupplierSearchRequest,
  DgennySupplierSearchResponse,
  DgennyCreateQuotationRequest,
  DgennyCreateQuotationResponse,
  DgennyStartQuotationResponse,
  DgennyQuotationDetail,
  DgennyNegotiationItem,
  DgennyMessage,
  DgennyMessageMediaResponse,
  DgennyComparisonResponse,
  DgennyBudgetItem,
  DgennyWhatsAppNumber,
  DgennyUser,
  DgennyCatalogItem,
  DgennySavedSupplier
} from './types'

export class DgennyClient {
  private baseUrl: string
  private apiKey: string | null

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || null
    this.baseUrl = (baseUrl || process.env.DGENNY_BASE_URL || 'https://api.dgenny.com').replace(/\/+$/, '')
  }

  private getApiKey(): string | null {
    return (this.apiKey || process.env.DGENNY_API_KEY || 'dgn_94f0e080f02f6fb94a190f55f30977d84912b55ba0357242').trim() || null
  }

  public isConfigured(): boolean {
    const key = this.getApiKey()
    return Boolean(key && key.length > 0)
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const key = this.getApiKey()
    if (!key) {
      throw new Error('DGENNY_API_KEY não configurada no ambiente (.env.local). Obtenha a chave junto ao comercial da dgenny.')
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }

    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store'
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Erro na API dgenny (HTTP ${response.status})`
      const error = new Error(errorMsg) as any
      error.status = response.status
      error.field = data?.field
      error.dgennyError = data?.error
      error.quotationId = data?.quotationId
      throw error
    }

    return data as T
  }

  /**
   * Confirma a chave, empresa e cotas restantes da hora
   */
  async me(): Promise<DgennyMeResponse> {
    return this.request<DgennyMeResponse>('/api/partner/v1/me')
  }

  /**
   * Lista os números de WhatsApp cadastrados e conectados na conta
   */
  async getWhatsAppNumbers(): Promise<{ ok: boolean; items: DgennyWhatsAppNumber[] }> {
    return this.request<{ ok: boolean; items: DgennyWhatsAppNumber[] }>('/api/partner/v1/whatsapp/numbers')
  }

  /**
   * Lista os usuários (compradores) autorizados na conta da empresa
   */
  async getUsers(): Promise<{ ok: boolean; items: DgennyUser[] }> {
    return this.request<{ ok: boolean; items: DgennyUser[] }>('/api/partner/v1/users')
  }

  /**
   * Lista registros de catálogo (delivery-locations, billing-locations, payment-methods)
   */
  async getCatalog(type: 'delivery-locations' | 'billing-locations' | 'payment-methods'): Promise<{ ok: boolean; items: DgennyCatalogItem[] }> {
    return this.request<{ ok: boolean; items: DgennyCatalogItem[] }>(`/api/partner/v1/catalogs/${type}`)
  }

  /**
   * Lista fornecedores já cadastrados na base da dgenny da empresa
   */
  async getSuppliers(): Promise<{ ok: boolean; items: DgennySavedSupplier[] }> {
    return this.request<{ ok: boolean; items: DgennySavedSupplier[] }>('/api/partner/v1/suppliers')
  }

  /**
   * Cadastra ou atualiza um fornecedor na base da dgenny
   */
  async upsertSupplier(supplier: { name: string; phone: string; contactName?: string; email?: string; cnpj?: string }): Promise<any> {
    return this.request('/api/partner/v1/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplier)
    })
  }

  /**
   * Busca inteligente de novos fornecedores por nicho e região geográfica
   */
  async searchSuppliers(params: DgennySupplierSearchRequest): Promise<DgennySupplierSearchResponse> {
    return this.request<DgennySupplierSearchResponse>('/api/partner/v1/suppliers/search', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  }

  /**
   * Valida se telefones existem no WhatsApp antes de disparar cotação
   */
  async checkWhatsApp(phones: string[]): Promise<{ ok: boolean; results: Array<{ phone: string; hasWhatsapp: boolean | null }> }> {
    return this.request<{ ok: boolean; results: Array<{ phone: string; hasWhatsapp: boolean | null }> }>('/api/partner/v1/suppliers/whatsapp-check', {
      method: 'POST',
      body: JSON.stringify({ phones })
    })
  }

  /**
   * Lista as cotações existentes na conta da empresa na dgenny
   */
  async listQuotations(): Promise<{ ok: boolean; items: any[]; nextCursor?: string | null }> {
    return this.request<{ ok: boolean; items: any[]; nextCursor?: string | null }>('/api/partner/v1/quotations')
  }

  /**
   * Cria uma cotação na dgenny a partir do suprimento
   */
  async createQuotation(data: DgennyCreateQuotationRequest): Promise<DgennyCreateQuotationResponse> {
    return this.request<DgennyCreateQuotationResponse>('/api/partner/v1/quotations', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  /**
   * Dispara a primeira mensagem a todos os fornecedores marcados via WhatsApp
   */
  async startQuotation(id: string, options?: { supplierIds?: string[]; at?: string; whatsappNumber?: string }): Promise<DgennyStartQuotationResponse> {
    return this.request<DgennyStartQuotationResponse>(`/api/partner/v1/quotations/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    })
  }

  /**
   * Obtém a cotação inteira com itens e status
   */
  async getQuotation(id: string): Promise<DgennyQuotationDetail> {
    return this.request<DgennyQuotationDetail>(`/api/partner/v1/quotations/${id}`)
  }

  /**
   * Obtém a lista de negociações de cada fornecedor (status, última mensagem, se tem pergunta pendente)
   */
  async getNegotiations(quotationId: string): Promise<{ ok: boolean; items: DgennyNegotiationItem[] }> {
    return this.request<{ ok: boolean; items: DgennyNegotiationItem[] }>(`/api/partner/v1/quotations/${quotationId}/negotiations`)
  }

  /**
   * Obtém o histórico de mensagens trocadas com o fornecedor no WhatsApp
   */
  async getMessages(quotationId: string, supplierId: string, since?: string): Promise<{ ok: boolean; items: DgennyMessage[] }> {
    const query = since ? `?since=${encodeURIComponent(since)}` : ''
    return this.request<{ ok: boolean; items: DgennyMessage[] }>(`/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/messages${query}`)
  }

  /**
   * Comprador humano insere mensagem manual diretamente na conversa do WhatsApp
   */
  async sendMessage(
    quotationId: string,
    supplierId: string,
    payload: { text?: string; mediaUrl?: string; mime?: string; fileName?: string; caption?: string }
  ): Promise<{ ok: boolean; messageId: string; sentAt: string }> {
    return this.request<{ ok: boolean; messageId: string; sentAt: string }>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    )
  }

  /**
   * Responde à pergunta que a IA fez à construtora (ex: aceite de marca similar ou novo prazo)
   */
  async answerAi(quotationId: string, supplierId: string, questionId: string, text: string): Promise<{ ok: boolean; questionId: string }> {
    return this.request<{ ok: boolean; questionId: string }>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/ai/answer`,
      {
        method: 'POST',
        body: JSON.stringify({ questionId, text })
      }
    )
  }

  /**
   * Pausa a resposta automática da IA para que o comprador assuma manualmente
   */
  async pauseAi(quotationId: string, supplierId: string): Promise<{ ok: boolean; aiPaused: boolean }> {
    return this.request<{ ok: boolean; aiPaused: boolean }>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/ai/pause`,
      { method: 'POST' }
    )
  }

  /**
   * Retoma a resposta automática da IA
   */
  async resumeAi(quotationId: string, supplierId: string): Promise<{ ok: boolean; aiPaused: boolean }> {
    return this.request<{ ok: boolean; aiPaused: boolean }>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/ai/resume`,
      { method: 'POST' }
    )
  }

  /**
   * Obtém a URL temporária para download de um anexo enviado na conversa do WhatsApp
   */
  async getMessageMedia(quotationId: string, supplierId: string, messageId: string): Promise<DgennyMessageMediaResponse> {
    return this.request<DgennyMessageMediaResponse>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/messages/${messageId}/media`
    )
  }

  /**
   * Interrompe a negociação com um fornecedor específico
   */
  async interruptNegotiation(quotationId: string, supplierId: string): Promise<{ ok: boolean; status: string }> {
    return this.request<{ ok: boolean; status: string }>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/interrupt`,
      { method: 'POST' }
    )
  }

  /**
   * Reabre uma negociação encerrada ou interrompida com um fornecedor
   */
  async reopenNegotiation(quotationId: string, supplierId: string): Promise<{ ok: boolean; status: string }> {
    return this.request<{ ok: boolean; status: string }>(
      `/api/partner/v1/quotations/${quotationId}/negotiations/${supplierId}/reopen`,
      { method: 'POST' }
    )
  }

  /**
   * Pede para a IA reler a conversa com o fornecedor e regravar o orçamento
   */
  async reprocessBudget(quotationId: string, supplierId: string): Promise<{ ok: boolean; jobId?: string }> {
    return this.request<{ ok: boolean; jobId?: string }>(
      `/api/partner/v1/quotations/${quotationId}/budgets/${supplierId}/reprocess`,
      { method: 'POST' }
    )
  }

  /**
   * Lista as propostas de orçamento recebidas dos fornecedores
   */
  async getBudgets(quotationId: string): Promise<{ ok: boolean; items: DgennyBudgetItem[] }> {
    return this.request<{ ok: boolean; items: DgennyBudgetItem[] }>(`/api/partner/v1/quotations/${quotationId}/budgets`)
  }

  /**
   * Retorna a matriz comparativa consolidada: item x fornecedor com totais, frete e melhor preço
   */
  async getComparison(quotationId: string): Promise<DgennyComparisonResponse> {
    return this.request<DgennyComparisonResponse>(`/api/partner/v1/quotations/${quotationId}/comparison`)
  }

  /**
   * Encerra a cotação definindo o fornecedor vencedor
   */
  async completeQuotation(quotationId: string, winnerSupplierId: string): Promise<{ ok: boolean; quotationId: string; status: string; winnerSupplierId: string }> {
    return this.request<{ ok: boolean; quotationId: string; status: string; winnerSupplierId: string }>(
      `/api/partner/v1/quotations/${quotationId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ winnerSupplierId })
      }
    )
  }

  /**
   * Cancela a cotação
   */
  async cancelQuotation(quotationId: string, reason?: string): Promise<{ ok: boolean; quotationId: string; status: string }> {
    return this.request<{ ok: boolean; quotationId: string; status: string }>(
      `/api/partner/v1/quotations/${quotationId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Cancelada pelo comprador no sistema' })
      }
    )
  }
}

// Instância singleton padrão para uso no servidor
export const dgenny = new DgennyClient()
