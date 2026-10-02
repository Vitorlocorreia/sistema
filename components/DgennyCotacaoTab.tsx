'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  MessageSquare,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  RefreshCw,
  Building,
  Check,
  UserCheck,
  HelpCircle,
  Truck,
  DollarSign,
  Layers,
  X
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { toast } from '@/components/Toast'

interface DgennyCotacaoTabProps {
  suprimento: any
  obra?: { id: string; nome: string } | null
  fornecedoresDisponiveis: Array<{ id: string; razao_social: string; nome_fantasia?: string | null; telefone?: string | null }>
  onSuprimentoUpdated: (updatedItem: any) => void
}

export function DgennyCotacaoTab({
  suprimento,
  obra,
  fornecedoresDisponiveis,
  onSuprimentoUpdated
}: DgennyCotacaoTabProps) {
  // Status da API dgenny
  const [apiStatus, setApiStatus] = useState<{ configured: boolean; company?: any; limits?: any; loading: boolean }>({
    configured: false,
    loading: true
  })

  // Cotação ativa vinculada
  const [quotationId, setQuotationId] = useState<string | null>(null)
  const [quotationData, setQuotationData] = useState<any | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Criação de nova cotação
  const [selectedFornecedorIds, setSelectedFornecedorIds] = useState<string[]>([])
  const [frete, setFrete] = useState<'CIF' | 'FOB'>('CIF')
  const [prazoDias, setPrazoDias] = useState<number>(3)
  const [criandoCotacao, setCriandoCotacao] = useState(false)

  // Busca inteligente de fornecedores na região
  const [abaBuscaAberta, setAbaBuscaAberta] = useState(false)
  const [termoBusca, setTermoBusca] = useState(suprimento?.titulo || '')
  const [localBusca, setLocalBusca] = useState(obra?.nome || 'Florianópolis, SC')
  const [buscando, setBuscando] = useState(false)
  const [fornecedoresEncontrados, setFornecedoresEncontrados] = useState<any[]>([])
  const [novosFornecedoresParaCotar, setNovosFornecedoresParaCotar] = useState<any[]>([])

  // Modal de chat do WhatsApp
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatSupplier, setChatSupplier] = useState<any | null>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [carregandoChat, setCarregandoChat] = useState(false)
  const [msgManual, setMsgManual] = useState('')
  const [enviandoManual, setEnviandoManual] = useState(false)

  // Resposta a pergunta da IA
  const [respostaIa, setRespostaIa] = useState<Record<string, string>>({})
  const [enviandoRespostaIa, setEnviandoRespostaIa] = useState(false)

  // Concluir com vencedor
  const [concluindo, setConcluindo] = useState(false)

  // 1. Verifica status da conexão com dgenny
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/dgenny/status')
        const data = await res.json()
        setApiStatus({
          configured: Boolean(data.configured),
          company: data.company,
          limits: data.limits,
          loading: false
        })
      } catch (err) {
        setApiStatus({ configured: false, loading: false })
      }
    }
    checkStatus()
  }, [])

  // 2. Identifica se o suprimento já possui cotação dgenny no histórico
  useEffect(() => {
    if (!suprimento) return
    const historico = Array.isArray(suprimento.historico_atividades) ? suprimento.historico_atividades : []
    const atividadeDgenny = historico.find((a: any) => a.dgenny_quotation_id || (a.acao === 'dgenny_cotacao_iniciada' && a.dgenny_quotation_id))
    if (atividadeDgenny?.dgenny_quotation_id) {
      setQuotationId(atividadeDgenny.dgenny_quotation_id)
    }
  }, [suprimento])

  // 3. Carrega os dados da cotação se houver ID
  const carregarDadosCotacao = useCallback(async (id: string) => {
    setLoadingData(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${id}`)
      const data = await res.json()
      if (data.ok) {
        setQuotationData(data)
      } else {
        toast(data.message || 'Erro ao consultar cotação dgenny', 'warning')
      }
    } catch (err: any) {
      toast('Falha ao comunicar com dgenny', 'error')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (quotationId) {
      carregarDadosCotacao(quotationId)
    }
  }, [quotationId, carregarDadosCotacao])

  // Busca inteligente de fornecedores
  const handleBuscarFornecedores = async () => {
    if (!termoBusca || !localBusca) {
      toast('Informe o nicho/material e a região para buscar.', 'warning')
      return
    }
    setBuscando(true)
    try {
      const res = await fetch('/api/dgenny/suppliers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: termoBusca,
          location: localBusca,
          limit: 8
        })
      })
      const data = await res.json()
      if (data.ok) {
        setFornecedoresEncontrados(data.suppliers || [])
        toast(`${data.suppliers?.length || 0} fornecedores encontrados na região!`, 'success')
      } else {
        toast(data.message || 'Erro na busca de fornecedores', 'error')
      }
    } catch (err: any) {
      toast('Erro de rede na busca de fornecedores', 'error')
    } finally {
      setBuscando(false)
    }
  }

  // Toggle fornecedor encontrado para adicionar à cotação
  const toggleNovoFornecedor = (forn: any) => {
    const existe = novosFornecedoresParaCotar.some(f => f.phone === forn.phone)
    if (existe) {
      setNovosFornecedoresParaCotar(novosFornecedoresParaCotar.filter(f => f.phone !== forn.phone))
    } else {
      setNovosFornecedoresParaCotar([...novosFornecedoresParaCotar, forn])
    }
  }

  // Disparo da cotação com IA
  const handleIniciarCotacao = async () => {
    // Reúne fornecedores cadastrados selecionados + novos descobertos
    const selecionadosBase = fornecedoresDisponiveis
      .filter(f => selectedFornecedorIds.includes(f.id))
      .map(f => ({
        externalId: f.id,
        name: f.nome_fantasia || f.razao_social,
        phone: f.telefone || ''
      }))

    const novos = novosFornecedoresParaCotar.map(f => ({
      name: f.name,
      phone: f.phone
    }))

    const todosFornecedores = [...selecionadosBase, ...novos].filter(f => Boolean(f.phone))

    if (!todosFornecedores.length) {
      toast('Selecione ou busque ao menos 1 fornecedor com telefone WhatsApp.', 'warning')
      return
    }

    // Itens: checklist ou o item do suprimento
    const checklist = Array.isArray(suprimento?.itens_checklist) ? suprimento.itens_checklist : []
    let itensParaCotar = []
    if (checklist.length > 0) {
      itensParaCotar = checklist.map((chk: any) => ({
        description: chk.descricao,
        quantity: chk.qtd_pedida || 1,
        unit: chk.unidade || 'UN'
      }))
    } else {
      itensParaCotar = [
        {
          description: suprimento.titulo,
          quantity: Number(suprimento.quantidade || 1),
          unit: suprimento.unidade || 'UN',
          estimatedPrice: suprimento.valor ? Number(suprimento.valor) : undefined
        }
      ]
    }

    const prazo = new Date(Date.now() + prazoDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    setCriandoCotacao(true)
    try {
      const res = await fetch('/api/dgenny/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suprimentoId: suprimento.id,
          name: `Cotação: ${suprimento.titulo} (${obra?.nome || 'Obra'})`,
          freight: frete,
          proposalDeadline: prazo,
          items: itensParaCotar,
          suppliers: todosFornecedores,
          startImmediately: true
        })
      })

      const data = await res.json()
      if (data.ok && data.quotation?.quotationId) {
        toast('🚀 Cotação iniciada! A IA já está negociando no WhatsApp dos fornecedores.', 'success')
        setQuotationId(data.quotation.quotationId)
        onSuprimentoUpdated({
          ...suprimento,
          status: 'Em Cotação'
        })
      } else {
        toast(data.message || 'Erro ao criar cotação dgenny', 'error')
      }
    } catch (err: any) {
      toast('Falha ao disparar cotação no dgenny', 'error')
    } finally {
      setCriandoCotacao(false)
    }
  }

  // Abrir modal de chat do WhatsApp com um fornecedor
  const abrirChatFornecedor = async (neg: any) => {
    setChatSupplier(neg)
    setChatModalOpen(true)
    setCarregandoChat(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/messages?supplierId=${encodeURIComponent(neg.supplierId)}`)
      const data = await res.json()
      if (data.ok) {
        setChatMessages(data.items || [])
      }
    } catch (err) {
      toast('Erro ao buscar mensagens do fornecedor', 'error')
    } finally {
      setCarregandoChat(false)
    }
  }

  // Enviar mensagem manual na conversa
  const handleEnviarMensagemManual = async () => {
    if (!msgManual.trim() || !chatSupplier || !quotationId) return
    setEnviandoManual(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: chatSupplier.supplierId,
          text: msgManual.trim()
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast('Mensagem enviada no WhatsApp!', 'success')
        setChatMessages(prev => [
          ...prev,
          {
            id: data.messageId || String(Date.now()),
            author: 'operator',
            direction: 'out',
            text: msgManual.trim(),
            sentAt: new Date().toISOString()
          }
        ])
        setMsgManual('')
      } else {
        toast(data.message || 'Erro ao enviar mensagem', 'error')
      }
    } catch (err) {
      toast('Falha de envio', 'error')
    } finally {
      setEnviandoManual(false)
    }
  }

  // Responder dúvida da IA
  const handleResponderIa = async (supplierId: string, questionId: string) => {
    const texto = respostaIa[questionId]?.trim()
    if (!texto) {
      toast('Digite uma instrução para a IA.', 'warning')
      return
    }
    setEnviandoRespostaIa(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          questionId,
          text: texto
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast('Instrução enviada! A IA continuará negociando.', 'success')
        setRespostaIa(prev => ({ ...prev, [questionId]: '' }))
        if (quotationId) carregarDadosCotacao(quotationId)
      } else {
        toast(data.message || 'Erro ao responder IA', 'error')
      }
    } catch (err) {
      toast('Falha ao enviar resposta à IA', 'error')
    } finally {
      setEnviandoRespostaIa(false)
    }
  }

  // Fechar cotação com vencedor
  const handleConcluirVencedor = async (supplierId: string, supplierName: string, total: string) => {
    if (!quotationId) return
    setConcluindo(true)
    try {
      const res = await fetch(`/api/dgenny/quotations/${quotationId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suprimentoId: suprimento.id,
          winnerSupplierId: supplierId,
          winnerSupplierName: supplierName,
          finalPrice: parseFloat(total)
        })
      })
      const data = await res.json()
      if (data.ok) {
        toast(`🏆 Cotação fechada com ${supplierName}! Suprimento movido para Aprovação.`, 'success')
        onSuprimentoUpdated({
          ...suprimento,
          status: 'Aprovação',
          fornecedor: supplierName,
          valor: parseFloat(total)
        })
        carregarDadosCotacao(quotationId)
      } else {
        toast(data.message || 'Erro ao encerrar cotação', 'error')
      }
    } catch (err) {
      toast('Falha ao registrar vencedor', 'error')
    } finally {
      setConcluindo(false)
    }
  }

  // ─── RENDER: API NÃO CONFIGURADA ───────────────────────────────────────────
  if (!apiStatus.loading && !apiStatus.configured) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 12,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.12)',
            color: C.amber,
            marginBottom: 12
          }}
        >
          <Bot size={32} />
        </div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 800, color: C.ink }}>
          Conexão dgenny (IA de Cotação)
        </h4>
        <p style={{ margin: '0 auto 16px auto', maxWidth: 440, fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
          A API oficial da <strong>dgenny</strong> automatiza a cotação com múltiplos fornecedores diretamente pelo WhatsApp e gera uma matriz comparativa com IA.
        </p>

        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: '12px 16px',
            background: C.bgWhite,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            textAlign: 'left',
            fontSize: 11
          }}
        >
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            🔑 Como ativar a integração:
          </div>
          <div style={{ color: C.inkSoft, marginBottom: 8 }}>
            Adicione a sua chave de parceiro fornecida pela dgenny no arquivo <code style={{ background: C.bgCard, padding: '2px 5px', borderRadius: 4 }}>.env.local</code>:
          </div>
          <pre
            style={{
              background: '#18181B',
              color: '#A1A1AA',
              padding: '8px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'monospace',
              overflowX: 'auto',
              margin: 0
            }}
          >
            DGENNY_API_KEY=dgn_sua_chave_aqui
          </pre>
        </div>
      </div>
    )
  }

  // ─── RENDER: COTAÇÃO ATIVA OU HISTÓRICO ─────────────────────────────────────
  if (quotationId) {
    const cotacao = quotationData?.quotation
    const negs = quotationData?.negotiations || []
    const comp = quotationData?.comparison
    const statusCotacao = cotacao?.status || 'active'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Banner do Status */}
        <div
          style={{
            padding: '12px 14px',
            background: C.bgWhite,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: statusCotacao === 'completed' ? C.greenDim : C.amberDim,
                color: statusCotacao === 'completed' ? C.green : C.amber,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Cotação IA: {cotacao?.name || `ID #${quotationId.slice(0, 8)}`}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    background: statusCotacao === 'completed' ? C.greenDim : C.amberDim,
                    color: statusCotacao === 'completed' ? C.green : C.amber
                  }}
                >
                  {statusCotacao === 'completed' ? 'Concluída' : 'Negociando WhatsApp'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>
                {negs.length} fornecedor(es) contactados · Frete: {cotacao?.conditions?.freight || 'CIF'}
              </div>
            </div>
          </div>

          <button
            onClick={() => carregarDadosCotacao(quotationId)}
            disabled={loadingData}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: C.ink,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={12} className={loadingData ? 'animate-spin' : ''} />
            Atualizar Status
          </button>
        </div>

        {/* Alerta de Pergunta Pendente da IA (se houver) */}
        {negs.some((n: any) => n.pendingQuestion) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {negs
              .filter((n: any) => n.pendingQuestion)
              .map((n: any) => (
                <div
                  key={n.supplierId}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.amber, fontWeight: 800, fontSize: 12, marginBottom: 4 }}>
                    <HelpCircle size={15} />
                    <span>Dúvida da IA com {n.name}:</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.ink, marginBottom: 8, fontStyle: 'italic' }}>
                    &ldquo;{n.pendingQuestion.text}&rdquo;
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Ex: Pode aceitar a marca similar; ou Negocie 5% de desconto..."
                      value={respostaIa[n.pendingQuestion.messageId] || ''}
                      onChange={e => setRespostaIa({ ...respostaIa, [n.pendingQuestion.messageId]: e.target.value })}
                      style={{
                        flex: 1,
                        background: C.bgCard,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 11,
                        color: C.ink,
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => handleResponderIa(n.supplierId, n.pendingQuestion.messageId)}
                      disabled={enviandoRespostaIa}
                      style={{
                        background: C.amber,
                        color: '#000',
                        border: 0,
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Instruir IA
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ─── MATRIZ COMPARATIVA DE PROPOSTAS ─── */}
        {comp && comp.suppliers && comp.suppliers.length > 0 && (
          <div
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: C.ink }}>
                <TrendingDown size={16} color={C.green} />
                <span>Matriz Comparativa de Propostas</span>
              </div>
              <span style={{ fontSize: 11, color: C.inkSoft }}>
                {comp.suppliers.length} proposta(s) analisadas
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left', color: C.inkSoft }}>
                    <th style={{ padding: '8px 10px', fontWeight: 800 }}>FORNECEDOR</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800 }}>CONDIÇÃO</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800 }}>FRETE</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800 }}>PRAZO</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>TOTAL</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.suppliers.map((s: any) => {
                    const isBest = comp.bestTotalSupplierId === s.supplierId
                    return (
                      <tr
                        key={s.supplierId}
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          background: isBest ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {s.name}
                            {isBest && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  background: C.greenDim,
                                  color: C.green,
                                  padding: '1px 5px',
                                  borderRadius: 4
                                }}
                              >
                                MENOR PREÇO
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: C.inkSoft }}>
                            {s.itemsQuoted} cotados {s.itemsMissing > 0 && `(${s.itemsMissing} faltantes)`}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: C.inkSoft }}>
                          {s.paymentMethod || 'A combinar'}
                        </td>
                        <td style={{ padding: '10px 10px', color: C.inkSoft }}>
                          {parseFloat(s.freight) > 0 ? `R$ ${s.freight}` : 'Incluso/FOB'}
                        </td>
                        <td style={{ padding: '10px 10px', color: C.inkSoft }}>
                          {s.deliveryTerm || 'A combinar'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: isBest ? C.green : C.ink, fontSize: 13 }}>
                          R$ {Number(s.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          {statusCotacao !== 'completed' ? (
                            <button
                              onClick={() => handleConcluirVencedor(s.supplierId, s.name, s.total)}
                              disabled={concluindo}
                              style={{
                                background: isBest ? C.green : C.bgWhite,
                                color: isBest ? '#FFF' : C.ink,
                                border: isBest ? 0 : `1px solid ${C.border}`,
                                borderRadius: 5,
                                padding: '5px 10px',
                                fontSize: 10,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Check size={11} />
                              Aprovar
                            </button>
                          ) : (
                            <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700 }}>
                              {cotacao?.suppliers?.find((sp: any) => sp.supplierId === s.supplierId)?.winner ? '🏆 Vencedor' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── STATUS DOS FORNECEDORES NA CONVERSA ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Andamento das Conversas no WhatsApp ({negs.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {negs.map((n: any) => {
              const statusLabel =
                n.status === 'completed'
                  ? 'Orçamento Finalizado'
                  : n.status === 'active'
                  ? 'Conversando no WhatsApp'
                  : n.status === 'queued'
                  ? 'Na Fila de Envio'
                  : n.status

              return (
                <div
                  key={n.supplierId}
                  style={{
                    padding: '10px 12px',
                    background: C.bgCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: n.status === 'completed' ? C.green : n.status === 'active' ? C.amber : '#9CA3AF'
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: C.ink }}>
                        {n.name}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>
                        {statusLabel} · {n.phone}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => abrirChatFornecedor(n)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${C.border}`,
                      borderRadius: 5,
                      padding: '5px 9px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.ink,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <MessageSquare size={12} />
                    Ver WhatsApp
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── MODAL DE CHAT DO WHATSAPP ─── */}
        {chatModalOpen && chatSupplier && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 520,
                height: 560,
                background: C.bgCard,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
              }}
            >
              {/* Header do Chat */}
              <div
                style={{
                  padding: '12px 16px',
                  background: '#075E54',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{chatSupplier.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.85 }}>WhatsApp Negociação IA · {chatSupplier.phone}</div>
                </div>
                <button
                  onClick={() => setChatModalOpen(false)}
                  style={{ background: 'transparent', border: 0, color: '#FFF', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mensagens */}
              <div
                style={{
                  flex: 1,
                  padding: 14,
                  overflowY: 'auto',
                  background: '#ECE5DD',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                {carregandoChat ? (
                  <div style={{ textAlign: 'center', color: '#666', fontSize: 12, marginTop: 40 }}>
                    Carregando mensagens da conversa...
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#666', fontSize: 12, marginTop: 40 }}>
                    Nenhuma mensagem registrada ainda.
                  </div>
                ) : (
                  chatMessages
                    .filter((m: any) => m.kind !== 'card')
                    .map((m: any) => {
                      const isOut = m.direction === 'out'
                      const isAi = m.author === 'ai'
                      return (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: isOut ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            background: isOut ? '#DCF8C6' : '#FFFFFF',
                            color: '#111',
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                          }}
                        >
                          {isOut && (
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#075E54', marginBottom: 2 }}>
                              {isAi ? '🤖 IA dgenny' : '👤 Comprador da Construtora'}
                            </div>
                          )}
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                          {m.media && (
                            <div style={{ fontSize: 10, fontStyle: 'italic', marginTop: 4, color: '#444' }}>
                              📎 Anexo: {m.media.fileName || m.media.mime}
                            </div>
                          )}
                          <div style={{ fontSize: 9, color: '#888', textAlign: 'right', marginTop: 4 }}>
                            {new Date(m.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>

              {/* Input manual de mensagem */}
              <div
                style={{
                  padding: '10px 14px',
                  background: C.bgCard,
                  borderTop: `1px solid ${C.border}`,
                  display: 'flex',
                  gap: 8
                }}
              >
                <input
                  type="text"
                  placeholder="Enviar mensagem manual no WhatsApp..."
                  value={msgManual}
                  onChange={e => setMsgManual(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEnviarMensagemManual()}
                  style={{
                    flex: 1,
                    background: C.bgWhite,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: C.ink,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleEnviarMensagemManual}
                  disabled={enviandoManual || !msgManual.trim()}
                  style={{
                    background: '#075E54',
                    color: '#FFF',
                    border: 0,
                    borderRadius: 6,
                    padding: '0 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── RENDER: FORMULÁRIO DE NOVA COTAÇÃO ─────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Apresentação da Funcionalidade */}
      <div
        style={{
          padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.ink, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
          <Sparkles size={16} color={C.amber} />
          <span>Cotação Autônoma no WhatsApp com IA</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, lineHeight: 1.5 }}>
          A IA da dgenny negociará os itens desta solicitação diretamente pelo WhatsApp dos fornecedores, receberá os orçamentos (inclusive lendo PDFs e áudios) e gerará a matriz de preços para sua aprovação.
        </p>
      </div>

      {/* Itens que serão cotados */}
      <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', marginBottom: 8 }}>
          Itens a Cotar
        </div>
        {Array.isArray(suprimento?.itens_checklist) && suprimento.itens_checklist.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suprimento.itens_checklist.map((chk: any, idx: number) => (
              <div
                key={chk.id || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: C.ink,
                  borderBottom: `1px solid ${C.border}`,
                  paddingBottom: 4
                }}
              >
                <span>{chk.descricao}</span>
                <span style={{ fontWeight: 700 }}>{chk.qtd_pedida} {chk.unidade || 'UN'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ink }}>
            <span>{suprimento.titulo}</span>
            <span style={{ fontWeight: 700 }}>{suprimento.quantidade || 1} {suprimento.unidade || 'UN'}</span>
          </div>
        )}
      </div>

      {/* Seleção de Fornecedores Cadastrados */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: C.inkSoft }}>
            Fornecedores Cadastrados na Construtora
          </label>
          <span style={{ fontSize: 10, color: C.inkSoft }}>
            {selectedFornecedorIds.length} selecionado(s)
          </span>
        </div>

        <div
          style={{
            maxHeight: 140,
            overflowY: 'auto',
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          {fornecedoresDisponiveis.filter(f => Boolean(f.telefone)).length === 0 ? (
            <div style={{ padding: 8, fontSize: 11, color: C.inkSoft, textAlign: 'center' }}>
              Nenhum fornecedor com telefone cadastrado. Use a busca abaixo para encontrar novos.
            </div>
          ) : (
            fornecedoresDisponiveis
              .filter(f => Boolean(f.telefone))
              .map(f => {
                const isSelected = selectedFornecedorIds.includes(f.id)
                return (
                  <label
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 8px',
                      borderRadius: 4,
                      background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: C.ink
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedFornecedorIds([...selectedFornecedorIds, f.id])
                        } else {
                          setSelectedFornecedorIds(selectedFornecedorIds.filter(id => id !== f.id))
                        }
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700 }}>{f.nome_fantasia || f.razao_social}</span>
                      <span style={{ color: C.inkSoft, marginLeft: 6 }}>({f.telefone})</span>
                    </div>
                  </label>
                )
              })
          )}
        </div>
      </div>

      {/* Widget de Busca Inteligente por Região */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
        <div
          onClick={() => setAbaBuscaAberta(!abaBuscaAberta)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 12,
            color: C.ink
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} color={C.amber} />
            <span>Radar de Fornecedores por Região (dgenny IA)</span>
          </div>
          <span style={{ fontSize: 11, color: C.inkSoft }}>
            {abaBuscaAberta ? 'Ocultar' : 'Buscar na região da obra'}
          </span>
        </div>

        {abaBuscaAberta && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Material / Nicho</label>
                <input
                  type="text"
                  value={termoBusca}
                  onChange={e => setTermoBusca(e.target.value)}
                  placeholder="Ex: material elétrico, areia, brita..."
                  style={{
                    width: '100%',
                    background: C.bgWhite,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: '6px 8px',
                    fontSize: 11,
                    color: C.ink,
                    marginTop: 3
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Região / Cidade</label>
                <input
                  type="text"
                  value={localBusca}
                  onChange={e => setLocalBusca(e.target.value)}
                  placeholder="Ex: Florianópolis, SC"
                  style={{
                    width: '100%',
                    background: C.bgWhite,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: '6px 8px',
                    fontSize: 11,
                    color: C.ink,
                    marginTop: 3
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleBuscarFornecedores}
              disabled={buscando}
              style={{
                background: C.bgWhite,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                color: C.ink,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Search size={12} className={buscando ? 'animate-spin' : ''} />
              {buscando ? 'Buscando fornecedores...' : 'Localizar Fornecedores com WhatsApp'}
            </button>

            {fornecedoresEncontrados.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {fornecedoresEncontrados.map((fn: any) => {
                  const marcado = novosFornecedoresParaCotar.some(f => f.phone === fn.phone)
                  return (
                    <div
                      key={fn.phone}
                      onClick={() => toggleNovoFornecedor(fn)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 5,
                        background: marcado ? 'rgba(16, 185, 129, 0.08)' : C.bgWhite,
                        border: `1px solid ${marcado ? C.green : C.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: 11
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: C.ink }}>{fn.name}</div>
                        <div style={{ fontSize: 10, color: C.inkSoft }}>
                          {fn.distanceKm ? `${fn.distanceKm} km · ` : ''}{fn.address || fn.phone}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {fn.whatsappVerified && (
                          <span style={{ fontSize: 9, background: C.greenDim, color: C.green, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                            WhatsApp OK
                          </span>
                        )}
                        <input type="checkbox" checked={marcado} onChange={() => {}} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Condições da Cotação */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: C.inkSoft }}>
            Modalidade Frete
          </label>
          <select
            value={frete}
            onChange={e => setFrete(e.target.value as any)}
            style={{
              width: '100%',
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '6px 8px',
              fontSize: 11,
              color: C.ink,
              marginTop: 4
            }}
          >
            <option value="CIF">CIF (Entrega na Obra)</option>
            <option value="FOB">FOB (Retirada pela Construtora)</option>
            <option value="NEGOTIABLE">Negociável</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: C.inkSoft }}>
            Prazo de Resposta
          </label>
          <select
            value={prazoDias}
            onChange={e => setPrazoDias(Number(e.target.value))}
            style={{
              width: '100%',
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '6px 8px',
              fontSize: 11,
              color: C.ink,
              marginTop: 4
            }}
          >
            <option value={1}>24 horas (Urgente)</option>
            <option value={2}>48 horas (2 dias)</option>
            <option value={3}>3 dias úteis (Recomendado)</option>
            <option value={5}>5 dias úteis</option>
          </select>
        </div>
      </div>

      {/* Botão de Disparo */}
      <button
        onClick={handleIniciarCotacao}
        disabled={criandoCotacao}
        style={{
          background: C.amber,
          color: '#000',
          border: 0,
          borderRadius: 6,
          padding: '12px 16px',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
        }}
      >
        <Sparkles size={16} />
        {criandoCotacao
          ? 'Conectando e disparando cotação...'
          : `Disparar Cotação com IA (${selectedFornecedorIds.length + novosFornecedoresParaCotar.length} fornecedores)`}
      </button>
    </div>
  )
}
