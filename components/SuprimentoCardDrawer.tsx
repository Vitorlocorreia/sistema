'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  User,
  Clock,
  CheckSquare,
  Paperclip,
  MessageSquare,
  History,
  Send,
  UploadCloud,
  FileText,
  Trash2,
  Plus,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Edit2,
  Check,
  PackageCheck,
  ShieldCheck,
  Share2,
  Bot,
  Printer,
  Copy,
  CheckCheck
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/tokens'
import { toast } from '@/components/Toast'
import { DgennyCotacaoTab } from '@/components/DgennyCotacaoTab'

export interface ItemChecklist {
  id: string
  descricao: string
  qtd_pedida: number
  qtd_entregue: number
  unidade: string
  status: 'pendente' | 'comprado' | 'parcial' | 'entregue'
}

export interface MensagemChat {
  id: string
  autor_id: string
  autor_nome: string
  mensagem: string
  data: string
  anexo_url?: string
}

export interface AtividadeHistorico {
  id: string
  data: string
  autor_nome: string
  acao: string
  detalhe: string
  de?: string
  para?: string
}

export interface AnexoItem {
  id: string
  nome: string
  url: string
  tamanho?: string
  autor: string
  data: string
}

export interface ColaboradorOption {
  id: string
  nome: string
  cargo: string
  email: string
}

interface SuprimentoCardDrawerProps {
  item: any | null
  isOpen: boolean
  onClose: () => void
  onUpdateItem: (updated: any) => void
  colaboradores: ColaboradorOption[]
  obras: Array<{ id: string; nome: string; endereco?: string | null; cliente?: string | null }>
  fornecedores: Array<{
    id: string
    razao_social: string
    nome_fantasia?: string | null
    telefone?: string | null
    cnpj?: string | null
    responsavel?: string | null
    endereco?: string | null
  }>
  colaboradorAtivo: any
  contaVinculada?: any
  initialTab?: 'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico'
}

export function SuprimentoCardDrawer({
  item,
  isOpen,
  onClose,
  onUpdateItem,
  colaboradores,
  obras,
  fornecedores,
  colaboradorAtivo,
  contaVinculada,
  initialTab
}: SuprimentoCardDrawerProps) {
  // Aba ativa: 'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico'
  const [tabAtiva, setTabAtiva] = useState<'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico'>(initialTab || 'checklist')

  useEffect(() => {
    if (isOpen && initialTab) {
      setTabAtiva(initialTab)
    }
  }, [isOpen, initialTab, item?.id])

  // Modo de Edição Completa da Ficha
  const [modoEdicaoCompleta, setModoEdicaoCompleta] = useState(false)
  const [formEdicao, setFormEdicao] = useState({
    codigo: '',
    titulo: '',
    status: 'Solicitado',
    solicitante: '',
    responsavel_id: '',
    responsavel_nome: '',
    proximo_responsavel_id: '',
    proximo_responsavel_nome: '',
    obra_id: '',
    obra_nome_manual: '',
    usar_obra_manual: false,
    fornecedor: '',
    valor: '',
    quantidade: '',
    unidade: 'un',
    prioridade: 'media',
    data_previsao_entrega: '',
    data_vencimento: ''
  })

  // Estados de edição inline
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [editandoCodigo, setEditandoCodigo] = useState(false)
  const [novoCodigo, setNovoCodigo] = useState('')
  const [editandoSolicitante, setEditandoSolicitante] = useState(false)
  const [novoSolicitante, setNovoSolicitante] = useState('')
  const [editandoValor, setEditandoValor] = useState(false)
  const [novoValor, setNovoValor] = useState('')
  const [editandoQtd, setEditandoQtd] = useState(false)
  const [novaQtd, setNovaQtd] = useState('')
  const [novaUnidade, setNovaUnidade] = useState('un')
  const [editandoFornecedor, setEditandoFornecedor] = useState(false)
  const [novoFornecedor, setNovoFornecedor] = useState('')
  const [editandoObraManual, setEditandoObraManual] = useState(false)
  const [novaObraManual, setNovaObraManual] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Chat
  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviandoMsg, setEnviandoMsg] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Checklist
  const [novoItemDesc, setNovoItemDesc] = useState('')
  const [novoItemQtd, setNovoItemQtd] = useState('')
  const [novoItemUnidade, setNovoItemUnidade] = useState('un')
  const [editandoChecklistId, setEditandoChecklistId] = useState<string | null>(null)
  const [editChecklistDesc, setEditChecklistDesc] = useState('')
  const [editChecklistQtd, setEditChecklistQtd] = useState('')
  const [editChecklistUnidade, setEditChecklistUnidade] = useState('un')

  // Nota de Auditoria / Parecer de Segurança
  const [novaNotaAuditoria, setNovaNotaAuditoria] = useState('')
  const [salvandoNotaAuditoria, setSalvandoNotaAuditoria] = useState(false)

  // Upload anexo
  const [fazendoUpload, setFazendoUpload] = useState(false)

  // Exportação Ordem de Compra (OC)
  const [modalExportarOC, setModalExportarOC] = useState(false)
  const [copiadoWhats, setCopiadoWhats] = useState(false)

  useEffect(() => {
    if (item) {
      setNovoTitulo(item.titulo || '')
      setEditandoTitulo(false)
      setNovoCodigo(item.codigo || '')
      setEditandoCodigo(false)
      setNovoSolicitante(item.solicitante || '')
      setEditandoSolicitante(false)
      setNovoValor(item.valor !== null && item.valor !== undefined ? String(item.valor) : '')
      setEditandoValor(false)
      setNovaQtd(item.quantidade || '')
      setNovaUnidade(item.unidade || 'un')
      setEditandoQtd(false)
      setNovoFornecedor(item.fornecedor || '')
      setEditandoFornecedor(false)
      setNovaObraManual(item.obra_nome_manual || '')
      setEditandoObraManual(false)
      setEditandoChecklistId(null)

      setFormEdicao({
        codigo: item.codigo || '',
        titulo: item.titulo || '',
        status: item.status || 'Solicitado',
        solicitante: item.solicitante || '',
        responsavel_id: item.responsavel_id || '',
        responsavel_nome: item.responsavel_nome || '',
        proximo_responsavel_id: item.proximo_responsavel_id || '',
        proximo_responsavel_nome: item.proximo_responsavel_nome || '',
        obra_id: item.obra_id || '',
        obra_nome_manual: item.obra_nome_manual || '',
        usar_obra_manual: Boolean(item.obra_nome_manual),
        fornecedor: item.fornecedor || '',
        valor: item.valor !== null && item.valor !== undefined ? String(item.valor) : '',
        quantidade: item.quantidade || '',
        unidade: item.unidade || 'un',
        prioridade: item.prioridade || 'media',
        data_previsao_entrega: item.data_previsao_entrega || '',
        data_vencimento: item.data_vencimento || ''
      })
    }
  }, [item])

  useEffect(() => {
    if (tabAtiva === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [tabAtiva, item?.chat_mensagens])

  if (!isOpen || !item) return null

  const autorAtual = colaboradorAtivo?.nome || 'Usuário do Sistema'

  // Helper para registrar atividades no histórico
  async function registrarMexida(acao: string, detalhe: string, de?: string, para?: string, updatePayload: any = {}) {
    const novaAtividade: AtividadeHistorico = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      data: new Date().toISOString(),
      autor_nome: autorAtual,
      acao,
      detalhe,
      de,
      para
    }

    const historicoAtual: AtividadeHistorico[] = Array.isArray(item.historico_atividades) ? item.historico_atividades : []
    const novoHistorico = [novaAtividade, ...historicoAtual]

    const fullPayload = {
      ...updatePayload,
      historico_atividades: novoHistorico
    }

    const { error } = await supabase.from('suprimentos').update(fullPayload).eq('id', item.id)
    if (error) {
      toast('Erro ao registrar histórico: ' + error.message, 'error')
      return false
    }

    const updated = { ...item, ...fullPayload }
    onUpdateItem(updated)
    return true
  }

  // 1. TRANSFERÊNCIA DE RESPONSÁVEL
  async function handleTransferirResponsavel(novoColabId: string) {
    if (!novoColabId) return
    const novoColab = colaboradores.find(c => c.id === novoColabId)
    if (!novoColab) return

    const antigoNome = item.responsavel_nome || 'Não atribuído'
    if (novoColab.nome === antigoNome) return

    setSalvando(true)
    try {
      const detalhe = `Transferiu a responsabilidade de ${antigoNome} para ${novoColab.nome}`

      // Registrar mexida e atualizar suprimento
      const ok = await registrarMexida(
        'transferencia_responsavel',
        detalhe,
        antigoNome,
        novoColab.nome,
        {
          responsavel_id: novoColab.id,
          responsavel_nome: novoColab.nome
        }
      )

      if (ok) {
        // Disparar notificação interna para o novo responsável
        await supabase.from('notificacoes').insert({
          destinatario_id: novoColab.id,
          remetente_id: colaboradorAtivo?.id || null,
          remetente_nome: autorAtual,
          tipo: 'transferencia_responsavel',
          titulo: 'Demanda de Suprimentos Atribuída',
          mensagem: `${autorAtual} transferiu a demanda "${item.titulo}" para você.`,
          link: `/suprimentos?cardId=${item.id}`,
          lida: false
        })

        toast(`Demanda atribuída a ${novoColab.nome}! Notificação enviada.`, 'success')
      }
    } catch (err: any) {
      toast('Erro ao transferir: ' + err.message, 'error')
    } finally {
      setSalvando(false)
    }
  }

  // 1.1 ATUALIZAR PRÓXIMO RESPONSÁVEL
  async function handleTransferirProximoResponsavel(novoColabId: string) {
    const novoColab = colaboradores.find(c => c.id === novoColabId)
    const novoNome = novoColab ? novoColab.nome : null
    const antigoNome = item.proximo_responsavel_nome || 'Nenhum'
    if (novoNome === antigoNome) return

    setSalvando(true)
    try {
      const detalhe = novoColab
        ? `Definiu o próximo responsável como ${novoColab.nome}`
        : `Removeu o próximo responsável (era ${antigoNome})`

      const ok = await registrarMexida(
        'proximo_responsavel',
        detalhe,
        antigoNome,
        novoNome || 'Nenhum',
        {
          proximo_responsavel_id: novoColab?.id || null,
          proximo_responsavel_nome: novoNome
        }
      )

      if (ok && novoColab) {
        await supabase.from('notificacoes').insert({
          destinatario_id: novoColab.id,
          remetente_id: colaboradorAtivo?.id || null,
          remetente_nome: autorAtual,
          tipo: 'transferencia_responsavel',
          titulo: 'Próximo Passo em Suprimentos',
          mensagem: `${autorAtual} definiu você como próximo responsável pela demanda "${item.titulo}".`,
          link: `/suprimentos?cardId=${item.id}`,
          lida: false
        })

        toast(`Próximo responsável definido como ${novoColab.nome}!`, 'success')
      }
    } catch (err: any) {
      toast('Erro ao atualizar próximo responsável: ' + err.message, 'error')
    } finally {
      setSalvando(false)
    }
  }

  // 1.2 ATUALIZAR CÓDIGO DO CARTÃO
  async function handleSalvarCodigo() {
    if (novoCodigo.trim() === (item.codigo || '')) {
      setEditandoCodigo(false)
      return
    }

    setSalvando(true)
    try {
      const antigo = item.codigo || 'Sem código'
      const novo = novoCodigo.trim()
      const ok = await registrarMexida(
        'edicao_codigo',
        `Alterou o código do cartão de "${antigo}" para "${novo}"`,
        antigo,
        novo,
        { codigo: novo || null }
      )
      if (ok) {
        setEditandoCodigo(false)
        toast('Código do cartão atualizado com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 2. ATUALIZAR TÍTULO
  async function handleSalvarTitulo() {
    if (!novoTitulo.trim() || novoTitulo.trim() === item.titulo) {
      setEditandoTitulo(false)
      return
    }

    setSalvando(true)
    try {
      const antigo = item.titulo
      const novo = novoTitulo.trim()
      const ok = await registrarMexida(
        'edicao_titulo',
        `Alterou o título de "${antigo}" para "${novo}"`,
        antigo,
        novo,
        { titulo: novo }
      )
      if (ok) {
        setEditandoTitulo(false)
        toast('Título atualizado com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3. ATUALIZAR PROPRIEDADES RÁPIDAS (Obra, Prioridade, Previsão, Status)
  async function handleAtualizarPropriedade(campo: string, valor: any, rotulo: string) {
    setSalvando(true)
    try {
      const antigo = item[campo] || 'Vazio'
      const ok = await registrarMexida(
        `edicao_${campo}`,
        `Alterou ${rotulo} para "${valor}"`,
        String(antigo),
        String(valor),
        { [campo]: valor }
      )
      if (ok) {
        toast(`${rotulo} atualizado.`, 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.1 SALVAR SOLICITANTE
  async function handleSalvarSolicitante(valorNovo: string) {
    const limpo = valorNovo.trim()
    const antigo = item.solicitante || 'Não informado'
    if (limpo === antigo) {
      setEditandoSolicitante(false)
      return
    }

    setSalvando(true)
    try {
      const ok = await registrarMexida(
        'edicao_solicitante',
        `Alterou o solicitante de "${antigo}" para "${limpo || 'Não informado'}"`,
        antigo,
        limpo || 'Não informado',
        { solicitante: limpo || null }
      )
      if (ok) {
        setEditandoSolicitante(false)
        toast('Solicitante atualizado com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.2 SALVAR VALOR TOTAL
  async function handleSalvarValor(valorTexto: string) {
    const limpo = valorTexto.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.')
    const valorNum = parseFloat(limpo) || 0
    const antigoNum = item.valor || 0
    if (valorNum === antigoNum) {
      setEditandoValor(false)
      return
    }

    setSalvando(true)
    try {
      const antigoFmt = antigoNum ? `R$ ${antigoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Em cotação'
      const novoFmt = valorNum ? `R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Em cotação'
      const ok = await registrarMexida(
        'edicao_valor',
        `Alterou o valor total do pedido de "${antigoFmt}" para "${novoFmt}"`,
        antigoFmt,
        novoFmt,
        { valor: valorNum || null }
      )
      if (ok) {
        setEditandoValor(false)
        toast('Valor total atualizado com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.3 SALVAR QUANTIDADE E UNIDADE
  async function handleSalvarQtd(qtd: string, un: string) {
    const limpoQtd = qtd.trim()
    const limpoUn = un.trim() || 'un'
    const antigoQtd = `${item.quantidade || ''} ${item.unidade || ''}`.trim() || 'Vazio'
    const novoQtd = `${limpoQtd} ${limpoUn}`.trim() || 'Vazio'

    if (limpoQtd === (item.quantidade || '') && limpoUn === (item.unidade || 'un')) {
      setEditandoQtd(false)
      return
    }

    setSalvando(true)
    try {
      const ok = await registrarMexida(
        'edicao_quantidade',
        `Alterou a quantidade/unidade de "${antigoQtd}" para "${novoQtd}"`,
        antigoQtd,
        novoQtd,
        { quantidade: limpoQtd || null, unidade: limpoUn }
      )
      if (ok) {
        setEditandoQtd(false)
        toast('Quantidade e unidade atualizadas com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.4 SALVAR FORNECEDOR
  async function handleSalvarFornecedor(fornNovo: string) {
    const limpo = fornNovo.trim()
    const antigo = item.fornecedor || 'A definir'
    if (limpo === antigo) {
      setEditandoFornecedor(false)
      return
    }

    setSalvando(true)
    try {
      const ok = await registrarMexida(
        'edicao_fornecedor',
        `Alterou o fornecedor de "${antigo}" para "${limpo || 'A definir'}"`,
        antigo,
        limpo || 'A definir',
        { fornecedor: limpo || null }
      )
      if (ok) {
        setEditandoFornecedor(false)
        toast('Fornecedor atualizado com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.5 SALVAR OBRA MANUAL
  async function handleSalvarObraManual(obraManualNova: string) {
    const limpo = obraManualNova.trim()
    const antigo = item.obra_nome_manual || 'Não informada'
    if (limpo === antigo) {
      setEditandoObraManual(false)
      return
    }

    setSalvando(true)
    try {
      const ok = await registrarMexida(
        'edicao_obra_manual',
        `Alterou o destino da obra manual de "${antigo}" para "${limpo || 'Geral'}"`,
        antigo,
        limpo || 'Geral',
        { obra_id: null, obra_nome_manual: limpo || null }
      )
      if (ok) {
        setEditandoObraManual(false)
        toast('Destino da obra manual atualizado com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.6 SALVAR EDIÇÃO COMPLETA DA FICHA (AUDITORIA CONSOLIDADA)
  async function handleSalvarEdicaoCompleta() {
    setSalvando(true)
    try {
      const mudancas: string[] = []

      // 1. Título
      const limpoTitulo = formEdicao.titulo.trim() || item.titulo
      if (limpoTitulo !== item.titulo) {
        mudancas.push(`Título: "${item.titulo}" ➔ "${limpoTitulo}"`)
      }

      // 2. Código
      const limpoCodigo = formEdicao.codigo.trim() || null
      if (limpoCodigo !== (item.codigo || null)) {
        mudancas.push(`Código: "${item.codigo || 'Sem código'}" ➔ "${limpoCodigo || 'Sem código'}"`)
      }

      // 3. Status
      if (formEdicao.status !== item.status) {
        mudancas.push(`Etapa da Esteira: "${item.status}" ➔ "${formEdicao.status}"`)
      }

      // 4. Solicitante
      const limpoSolicitante = formEdicao.solicitante.trim() || null
      if (limpoSolicitante !== (item.solicitante || null)) {
        mudancas.push(`Solicitante: "${item.solicitante || 'Não informado'}" ➔ "${limpoSolicitante || 'Não informado'}"`)
      }

      // 5. Responsável
      let novoRespNome = item.responsavel_nome
      let novoRespId = item.responsavel_id
      if (formEdicao.responsavel_id !== item.responsavel_id) {
        const colabMatch = colaboradores.find(c => c.id === formEdicao.responsavel_id)
        novoRespId = formEdicao.responsavel_id || null
        novoRespNome = colabMatch ? colabMatch.nome : null
        mudancas.push(`Responsável: "${item.responsavel_nome || 'Nenhum'}" ➔ "${novoRespNome || 'Nenhum'}"`)
      }

      // 6. Próximo Responsável
      let novoProxNome = item.proximo_responsavel_nome
      let novoProxId = item.proximo_responsavel_id
      if (formEdicao.proximo_responsavel_id !== item.proximo_responsavel_id) {
        const colabMatch = colaboradores.find(c => c.id === formEdicao.proximo_responsavel_id)
        novoProxId = formEdicao.proximo_responsavel_id || null
        novoProxNome = colabMatch ? colabMatch.nome : null
        mudancas.push(`Próximo Responsável: "${item.proximo_responsavel_nome || 'Nenhum'}" ➔ "${novoProxNome || 'Nenhum'}"`)
      }

      // 7. Obra
      const novaObraId = formEdicao.usar_obra_manual ? null : (formEdicao.obra_id || null)
      const novaObraManualVal = formEdicao.usar_obra_manual ? (formEdicao.obra_nome_manual.trim() || null) : null
      if (novaObraId !== item.obra_id || novaObraManualVal !== item.obra_nome_manual) {
        const obraAntigaNome = item.obra_nome_manual ? `Manual: ${item.obra_nome_manual}` : (obras.find(o => o.id === item.obra_id)?.nome || 'Sem Obra')
        const obraNovaNome = novaObraManualVal ? `Manual: ${novaObraManualVal}` : (obras.find(o => o.id === novaObraId)?.nome || 'Sem Obra')
        mudancas.push(`Obra: "${obraAntigaNome}" ➔ "${obraNovaNome}"`)
      }

      // 8. Fornecedor
      const limpoFornecedor = formEdicao.fornecedor.trim() || null
      if (limpoFornecedor !== (item.fornecedor || null)) {
        mudancas.push(`Fornecedor: "${item.fornecedor || 'A definir'}" ➔ "${limpoFornecedor || 'A definir'}"`)
      }

      // 9. Valor
      const valorLimpo = formEdicao.valor ? parseFloat(formEdicao.valor.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.')) : null
      if (valorLimpo !== (item.valor || null)) {
        const vAntigo = item.valor ? `R$ ${item.valor.toFixed(2)}` : 'Em cotação'
        const vNovo = valorLimpo ? `R$ ${valorLimpo.toFixed(2)}` : 'Em cotação'
        mudancas.push(`Valor Total: "${vAntigo}" ➔ "${vNovo}"`)
      }

      // 10. Quantidade e Unidade
      const limpoQtd = formEdicao.quantidade.trim() || null
      const limpoUn = formEdicao.unidade.trim() || 'un'
      if (limpoQtd !== item.quantidade || limpoUn !== item.unidade) {
        mudancas.push(`Qtd/Unidade: "${item.quantidade || ''} ${item.unidade || ''}" ➔ "${limpoQtd || ''} ${limpoUn}"`)
      }

      // 11. Prioridade
      if (formEdicao.prioridade !== item.prioridade) {
        mudancas.push(`Prioridade: "${item.prioridade}" ➔ "${formEdicao.prioridade}"`)
      }

      // 12. Previsão de Entrega
      const limpaPrevisao = formEdicao.data_previsao_entrega || null
      if (limpaPrevisao !== (item.data_previsao_entrega || null)) {
        mudancas.push(`Previsão Entrega: "${item.data_previsao_entrega || 'Não definida'}" ➔ "${limpaPrevisao || 'Não definida'}"`)
      }

      // 13. Data de Vencimento
      const limpoVencimento = formEdicao.data_vencimento || null
      if (limpoVencimento !== (item.data_vencimento || null)) {
        mudancas.push(`Vencimento: "${item.data_vencimento || 'Não definido'}" ➔ "${limpoVencimento || 'Não definido'}"`)
      }

      if (mudancas.length === 0) {
        setModoEdicaoCompleta(false)
        toast('Nenhuma alteração detectada.', 'info')
        return
      }

      const detalheAuditoria = `Edição geral da ficha realizada por ${autorAtual}: ` + mudancas.join('; ')
      const updatePayload = {
        titulo: limpoTitulo,
        codigo: limpoCodigo,
        status: formEdicao.status,
        solicitante: limpoSolicitante,
        responsavel_id: novoRespId,
        responsavel_nome: novoRespNome,
        proximo_responsavel_id: novoProxId,
        proximo_responsavel_nome: novoProxNome,
        obra_id: novaObraId,
        obra_nome_manual: novaObraManualVal,
        fornecedor: limpoFornecedor,
        valor: valorLimpo,
        quantidade: limpoQtd,
        unidade: limpoUn,
        prioridade: formEdicao.prioridade,
        data_previsao_entrega: limpaPrevisao,
        data_vencimento: limpoVencimento
      }

      const ok = await registrarMexida('edicao_geral_ficha', detalheAuditoria, undefined, undefined, updatePayload)
      if (ok) {
        setModoEdicaoCompleta(false)
        toast('Ficha do pedido e log de auditoria salvos com sucesso.', 'success')
      }
    } finally {
      setSalvando(false)
    }
  }

  // 3.7 EDIÇÃO DE ITEM EXISTENTE DO CHECKLIST
  function iniciarEdicaoChecklist(chk: ItemChecklist) {
    setEditandoChecklistId(chk.id)
    setEditChecklistDesc(chk.descricao)
    setEditChecklistQtd(String(chk.qtd_pedida))
    setEditChecklistUnidade(chk.unidade || 'un')
  }

  async function handleSalvarEdicaoItemChecklist(chkId: string) {
    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    const itemTarget = listaAtual.find(i => i.id === chkId)
    if (!itemTarget) return

    const qtdNum = parseFloat(editChecklistQtd.replace(',', '.')) || itemTarget.qtd_pedida
    const novaDesc = editChecklistDesc.trim() || itemTarget.descricao
    const novaUn = editChecklistUnidade.trim() || itemTarget.unidade

    const novaLista = listaAtual.map(i => {
      if (i.id === chkId) {
        const novoStatus: ItemChecklist['status'] =
          i.qtd_entregue >= qtdNum ? 'entregue' : i.qtd_entregue > 0 ? 'parcial' : 'pendente'
        return {
          ...i,
          descricao: novaDesc,
          qtd_pedida: qtdNum,
          unidade: novaUn,
          status: novoStatus
        }
      }
      return i
    })

    const detalhe = `Editou item do checklist de "${itemTarget.descricao}" (${itemTarget.qtd_pedida} ${itemTarget.unidade}) para "${novaDesc}" (${qtdNum} ${novaUn})`
    const ok = await registrarMexida(
      'checklist_edicao',
      detalhe,
      `${itemTarget.descricao} (${itemTarget.qtd_pedida} ${itemTarget.unidade})`,
      `${novaDesc} (${qtdNum} ${novaUn})`,
      { itens_checklist: novaLista }
    )
    if (ok) {
      setEditandoChecklistId(null)
      toast('Item do checklist atualizado com sucesso.', 'success')
    }
  }

  // 3.8 NOTA FORMAL DE AUDITORIA NO HISTÓRICO
  async function handleAdicionarNotaAuditoria(e: React.FormEvent) {
    e.preventDefault()
    if (!novaNotaAuditoria.trim() || salvandoNotaAuditoria) return

    setSalvandoNotaAuditoria(true)
    try {
      const notaTexto = novaNotaAuditoria.trim()
      const ok = await registrarMexida(
        'nota_auditoria',
        `Nota de auditoria registrada por ${autorAtual}: "${notaTexto}"`,
        undefined,
        notaTexto
      )
      if (ok) {
        setNovaNotaAuditoria('')
        toast('Nota de auditoria registrada com sucesso no histórico.', 'success')
      }
    } finally {
      setSalvandoNotaAuditoria(false)
    }
  }

  // 4. CHECKLIST: ADICIONAR ITEM
  async function handleAdicionarItemChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!novoItemDesc.trim()) return

    const qtdNum = parseFloat(novoItemQtd.replace(',', '.')) || 1
    const novoCheck: ItemChecklist = {
      id: 'chk-' + Date.now(),
      descricao: novoItemDesc.trim(),
      qtd_pedida: qtdNum,
      qtd_entregue: 0,
      unidade: novoItemUnidade.trim() || 'un',
      status: 'pendente'
    }

    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    const novaLista = [...listaAtual, novoCheck]

    const ok = await registrarMexida(
      'checklist_adicionar',
      `Adicionou item ao pedido: "${novoCheck.descricao}" (${novoCheck.qtd_pedida} ${novoCheck.unidade})`,
      undefined,
      novoCheck.descricao,
      { itens_checklist: novaLista }
    )

    if (ok) {
      setNovoItemDesc('')
      setNovoItemQtd('')
      toast('Item adicionado ao pedido.', 'success')
    }
  }

  // 5. CHECKLIST: ATUALIZAR QTD ENTREGUE / STATUS
  async function handleAtualizarQtdItem(itemId: string, novaQtdEntregue: number) {
    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    const itemTarget = listaAtual.find(i => i.id === itemId)
    if (!itemTarget) return

    const cleanQtd = Math.max(0, novaQtdEntregue)
    const novoStatus: ItemChecklist['status'] =
      cleanQtd >= itemTarget.qtd_pedida ? 'entregue' : cleanQtd > 0 ? 'parcial' : 'pendente'

    const novaLista = listaAtual.map(i => {
      if (i.id === itemId) {
        return { ...i, qtd_entregue: cleanQtd, status: novoStatus }
      }
      return i
    })

    await registrarMexida(
      'checklist_entrega',
      `Atualizou conferência de "${itemTarget.descricao}": ${cleanQtd}/${itemTarget.qtd_pedida} ${itemTarget.unidade} (${novoStatus.toUpperCase()})`,
      `${itemTarget.qtd_entregue}`,
      `${cleanQtd}`,
      { itens_checklist: novaLista }
    )
  }

  // 5.1 CHECKLIST: ALTERAR STATUS DO ITEM (Pendente, Comprado, Parcial, Entregue)
  async function handleMudarStatusItemChecklist(itemId: string, novoStatus: ItemChecklist['status']) {
    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    const itemTarget = listaAtual.find(i => i.id === itemId)
    if (!itemTarget || itemTarget.status === novoStatus) return

    let novaQtdEntregue = itemTarget.qtd_entregue
    if (novoStatus === 'entregue') {
      novaQtdEntregue = itemTarget.qtd_pedida
    } else if (novoStatus === 'pendente' || novoStatus === 'comprado') {
      if (itemTarget.status === 'entregue') {
        novaQtdEntregue = 0
      }
    }

    const novaLista = listaAtual.map(i => {
      if (i.id === itemId) {
        return { ...i, status: novoStatus, qtd_entregue: novaQtdEntregue }
      }
      return i
    })

    const ok = await registrarMexida(
      'checklist_status',
      `Alterou status de "${itemTarget.descricao}" de ${itemTarget.status.toUpperCase()} para ${novoStatus.toUpperCase()}`,
      itemTarget.status,
      novoStatus,
      { itens_checklist: novaLista }
    )
    if (ok) {
      toast(`Status do item alterado para ${novoStatus.toUpperCase()}.`, 'success')
    }
  }

  // 5.2 CHECKLIST: MARCAR TODOS OS ITENS COMO COMPRADOS
  async function handleMarcarTodosComprados() {
    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    if (listaAtual.length === 0) return

    const novaLista = listaAtual.map(i => {
      if (i.status === 'entregue') return i
      return { ...i, status: 'comprado' as const }
    })

    const ok = await registrarMexida(
      'checklist_status_lote',
      'Marcou todos os itens do pedido como COMPRADOS',
      undefined,
      'Todos comprados',
      { itens_checklist: novaLista }
    )
    if (ok) {
      toast('Todos os itens foram marcados como COMPRADOS.', 'success')
    }
  }

  // 5.3 EXPORTAÇÃO: FORMATAR E COPIAR ORDEM DE COMPRA PARA WHATSAPP
  function handleCopiarOCWhatsApp() {
    const numOC = item.codigo || ('OC-' + item.id.slice(0, 8).toUpperCase())
    const obraNomeFinal = item.obra_nome_manual || obras.find(o => o.id === item.obra_id)?.nome || 'Não informada'
    const previsao = item.data_previsao_entrega ? new Date(item.data_previsao_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'A combinar'
    const vencimento = item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'A combinar'
    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []

    let texto = `*ORDEM DE COMPRA: ${numOC}*\n`
    texto += `Data de Emissao: ${new Date().toLocaleDateString('pt-BR')}\n`
    texto += `Obra / Destino: ${obraNomeFinal}\n`
    if (item.fornecedor) texto += `Fornecedor: ${item.fornecedor}\n`
    texto += `Previsao de Entrega: ${previsao}\n`
    texto += `Condicao / Vencimento: ${vencimento}\n`
    if (item.solicitante) texto += `Solicitante: ${item.solicitante}\n`
    if (item.responsavel_nome) texto += `Responsavel: ${item.responsavel_nome}\n`
    texto += `\n*ITENS SOLICITADOS:*\n`

    if (listaAtual.length > 0) {
      listaAtual.forEach((chk, idx) => {
        texto += `${idx + 1}. ${chk.descricao} - ${chk.qtd_pedida} ${chk.unidade} [Status: ${chk.status.toUpperCase()}]\n`
      })
    } else {
      texto += `1. ${item.titulo} - ${item.quantidade || '1'} ${item.unidade || 'un'}\n`
    }

    if (item.valor) {
      texto += `\n*Valor Total:* R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    }

    const aprovAct = (Array.isArray(item.historico_atividades) ? item.historico_atividades : []).find(
      (a: any) => a.acao === 'aprovacao_compra' || a.acao === 'aprovacao_sem_financeiro' || a.acao === 'assinatura_exportacao_oc'
    )
    const nomeAssinante = aprovAct?.autor_nome || autorAtual
    texto += `\n✍️ *Assinado/Emitido digitalmente por:* ${nomeAssinante} (Emitido por: ${autorAtual} em ${new Date().toLocaleString('pt-BR')})`
    texto += `\nJWA Engenharia & Construcao`

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto)
      setCopiadoWhats(true)
      toast('Ordem de Compra copiada para envio via WhatsApp.', 'success')
      setTimeout(() => setCopiadoWhats(false), 3000)
    }
  }

  // 6. CHECKLIST: REMOVER ITEM
  async function handleRemoverItemChecklist(itemId: string) {
    const listaAtual: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
    const itemTarget = listaAtual.find(i => i.id === itemId)
    const novaLista = listaAtual.filter(i => i.id !== itemId)

    await registrarMexida(
      'checklist_remover',
      `Removeu item do pedido: "${itemTarget?.descricao || 'Item'}"`,
      itemTarget?.descricao,
      undefined,
      { itens_checklist: novaLista }
    )
    toast('Item removido.', 'success')
  }

  // 7. ANEXOS: UPLOAD DE NOVO ARQUIVO
  async function handleUploadAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFazendoUpload(true)
    try {
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const path = `suprimentos/anexos/${item.id}-${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: pubData } = supabase.storage.from('comprovantes').getPublicUrl(path)
      const novoAnexo: AnexoItem = {
        id: 'att-' + Date.now(),
        nome: file.name,
        url: pubData.publicUrl,
        tamanho: (file.size / 1024).toFixed(1) + ' KB',
        autor: autorAtual,
        data: new Date().toISOString()
      }

      const listaAtual: AnexoItem[] = Array.isArray(item.anexos) ? item.anexos : []
      const novaLista = [novoAnexo, ...listaAtual]

      const ok = await registrarMexida(
        'anexo_adicionar',
        `Anexou o arquivo "${novoAnexo.nome}" (${novoAnexo.tamanho})`,
        undefined,
        novoAnexo.nome,
        { anexos: novaLista }
      )

      if (ok) {
        toast('Anexo incluído com sucesso!', 'success')
      }
    } catch (err: any) {
      toast('Erro no upload: ' + err.message, 'error')
    } finally {
      setFazendoUpload(false)
      e.target.value = ''
    }
  }

  // 8. ANEXOS: EXCLUIR ANEXO
  async function handleRemoverAnexo(anexoId: string) {
    const listaAtual: AnexoItem[] = Array.isArray(item.anexos) ? item.anexos : []
    const target = listaAtual.find(a => a.id === anexoId)
    const novaLista = listaAtual.filter(a => a.id !== anexoId)

    await registrarMexida(
      'anexo_remover',
      `Removeu o anexo "${target?.nome || 'Arquivo'}"`,
      target?.nome,
      undefined,
      { anexos: novaLista }
    )
    toast('Anexo removido.', 'success')
  }

  // 9. CHAT: ENVIAR MENSAGEM
  async function handleEnviarMensagem(e: React.FormEvent) {
    e.preventDefault()
    if (!novaMensagem.trim() || enviandoMsg) return

    setEnviandoMsg(true)
    try {
      const msgTexto = novaMensagem.trim()
      const novaMsg: MensagemChat = {
        id: 'msg-' + Date.now(),
        autor_id: colaboradorAtivo?.id || 'anon',
        autor_nome: autorAtual,
        mensagem: msgTexto,
        data: new Date().toISOString()
      }

      const chatAtual: MensagemChat[] = Array.isArray(item.chat_mensagens) ? item.chat_mensagens : []
      const novoChat = [...chatAtual, novaMsg]

      const ok = await registrarMexida(
        'chat_mensagem',
        `Enviou mensagem no chat: "${msgTexto.slice(0, 40)}${msgTexto.length > 40 ? '...' : ''}"`,
        undefined,
        undefined,
        { chat_mensagens: novoChat }
      )

      if (ok) {
        setNovaMensagem('')

        // Se o autor não for o responsável, notifica o responsável
        if (item.responsavel_id && item.responsavel_id !== colaboradorAtivo?.id) {
          await supabase.from('notificacoes').insert({
            destinatario_id: item.responsavel_id,
            remetente_id: colaboradorAtivo?.id || null,
            remetente_nome: autorAtual,
            tipo: 'chat_mencao',
            titulo: `Mensagem em: ${item.titulo}`,
            mensagem: `${autorAtual}: "${msgTexto.slice(0, 70)}"`,
            link: `/suprimentos?cardId=${item.id}`,
            lida: false
          })
        }
      }
    } finally {
      setEnviandoMsg(false)
    }
  }

  // Totais do checklist
  const itensChecklist: ItemChecklist[] = Array.isArray(item.itens_checklist) ? item.itens_checklist : []
  const totalItens = itensChecklist.length
  const itensConcluidos = itensChecklist.filter(i => i.status === 'entregue').length
  const itensComprados = itensChecklist.filter(i => i.status === 'comprado').length
  const itensParciais = itensChecklist.filter(i => i.status === 'parcial').length
  const itensPendentes = itensChecklist.filter(i => i.status === 'pendente').length
  const historicoList: AtividadeHistorico[] = Array.isArray(item.historico_atividades) ? item.historico_atividades : []
  const anexosList: AnexoItem[] = Array.isArray(item.anexos) ? item.anexos : []
  const chatList: MensagemChat[] = Array.isArray(item.chat_mensagens) ? item.chat_mensagens : []

  return (
    <>
      <div
        style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 620,
          maxWidth: '96vw',
          height: '100%',
          background: C.bgPanel,
          borderLeft: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── 1. TOPO DA GAVETA: TÍTULO, ETAPA E FECHAR ──────────────────────── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bgCard,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {editandoCodigo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      value={novoCodigo}
                      onChange={e => setNovoCodigo(e.target.value)}
                      placeholder="Ex: SG-BC 0069/26"
                      autoFocus
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        background: C.bgPanel,
                        border: `1px solid ${C.amber}`,
                        color: C.ink,
                        padding: '2px 6px',
                        borderRadius: 4,
                        outline: 'none'
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSalvarCodigo()
                        if (e.key === 'Escape') setEditandoCodigo(false)
                      }}
                    />
                    <button
                      onClick={handleSalvarCodigo}
                      disabled={salvando}
                      style={{ background: C.amber, color: '#0A0A0A', border: 'none', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontWeight: 800, fontSize: 10 }}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => setEditandoCodigo(false)}
                      style={{ background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => { setNovoCodigo(item.codigo || ''); setEditandoCodigo(true); }}
                    title="Clique para editar o código / identificador"
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: C.amber,
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {item.codigo ? item.codigo : `OC-${item.id.slice(0, 6).toUpperCase()}`}
                    <Edit2 size={9} style={{ opacity: 0.7 }} />
                  </span>
                )}

                <select
                  value={item.status}
                  onChange={e => handleAtualizarPropriedade('status', e.target.value, 'Etapa da Esteira')}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: C.bgWhite,
                    color: C.ink,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '3px 8px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Solicitado">1. Solicitado</option>
                  <option value="Em Cotação">2. Em Cotação</option>
                  <option value="Aprovação">3. Aguardando Aprovação</option>
                  <option value="Em Trânsito">4. Em Trânsito</option>
                  <option value="Entregue">5. Entregue no Canteiro</option>
                </select>
              </div>

              {/* Título Editável */}
              {editandoTitulo ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    value={novoTitulo}
                    onChange={e => setNovoTitulo(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      background: C.bgPanel,
                      border: `1px solid ${C.amber}`,
                      color: C.ink,
                      fontSize: 14,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 4,
                      outline: 'none'
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSalvarTitulo()
                      if (e.key === 'Escape') setEditandoTitulo(false)
                    }}
                  />
                  <button
                    onClick={handleSalvarTitulo}
                    disabled={salvando}
                    style={{ background: C.amber, color: '#0A0A0A', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditandoTitulo(false)}
                    style={{ background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.ink }}>
                    {item.titulo}
                  </h3>
                  <button
                    onClick={() => { setNovoTitulo(item.titulo); setEditandoTitulo(true); }}
                    title="Editar título do pedido"
                    style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 2 }}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={async () => {
                  setModalExportarOC(true)
                  // Registra automaticamente no histórico quem exportou/assinou digitalmente a OC pelo login
                  const numOC = item.codigo || ('OC-' + item.id.slice(0, 8).toUpperCase())
                  const emailOuCargo = colaboradorAtivo?.email || colaboradorAtivo?.cargo || 'Login autenticado'
                  await registrarMexida(
                    'assinatura_exportacao_oc',
                    `Emitiu e assinou digitalmente a Ordem de Compra (${numOC}) pelo login ${autorAtual} (${emailOuCargo})`
                  )
                }}
                style={{
                  border: `1px solid ${C.border}`,
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: C.ink,
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '4px 9px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease'
                }}
                title="Visualizar e exportar Ordem de Compra oficial (PDF / WhatsApp)"
              >
                <Printer size={11} />
                <span>Exportar OC</span>
              </button>

              <button
                type="button"
                onClick={() => setModoEdicaoCompleta(!modoEdicaoCompleta)}
                style={{
                  border: `1px solid ${modoEdicaoCompleta ? C.amber : C.border}`,
                  background: modoEdicaoCompleta ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: modoEdicaoCompleta ? C.amber : C.ink,
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '4px 9px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease'
                }}
                title="Editar todos os dados da ficha de uma só vez com auditoria"
              >
                <Edit2 size={11} />
                <span>{modoEdicaoCompleta ? 'Fechar Edição' : 'Editar Ficha Completa'}</span>
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.inkSoft,
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4
                }}
                title="Fechar gaveta (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ─── PAINEL DE EDIÇÃO COMPLETA DA FICHA OU VISUALIZAÇÃO PADRÃO ──── */}
          {modoEdicaoCompleta ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.04)',
              border: `1.5px solid ${C.amber}`,
              borderRadius: 8,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: C.amber, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} /> Edição Geral da Ficha (Auditoria Ativa)
                </span>
                <span style={{ fontSize: 10, color: C.inkSoft }}>
                  Responsável pela alteração: <strong style={{ color: C.ink }}>{autorAtual}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
                {/* Título */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Título / Material Solicitado</label>
                  <input
                    value={formEdicao.titulo}
                    onChange={e => setFormEdicao(prev => ({ ...prev, titulo: e.target.value }))}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 12, fontWeight: 700, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>

                {/* Código */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Código / Identificador do Cartão</label>
                  <input
                    value={formEdicao.codigo}
                    onChange={e => setFormEdicao(prev => ({ ...prev, codigo: e.target.value }))}
                    placeholder="Ex: SG-BC 0069/26"
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, fontFamily: 'monospace', padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>

                {/* Status da Esteira */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Etapa da Esteira</label>
                  <select
                    value={formEdicao.status}
                    onChange={e => setFormEdicao(prev => ({ ...prev, status: e.target.value as any }))}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  >
                    <option value="Solicitado">1. Solicitado</option>
                    <option value="Em Cotação">2. Em Cotação</option>
                    <option value="Aprovação">3. Aguardando Aprovação</option>
                    <option value="Em Trânsito">4. Em Trânsito</option>
                    <option value="Entregue">5. Entregue no Canteiro</option>
                  </select>
                </div>

                {/* Solicitante */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Solicitante</label>
                  <input
                    value={formEdicao.solicitante}
                    onChange={e => setFormEdicao(prev => ({ ...prev, solicitante: e.target.value }))}
                    placeholder="Nome de quem solicitou"
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>

                {/* Prioridade */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Prioridade</label>
                  <select
                    value={formEdicao.prioridade}
                    onChange={e => setFormEdicao(prev => ({ ...prev, prioridade: e.target.value as any }))}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">⚡ Urgente</option>
                  </select>
                </div>

                {/* Responsável Atual (Engenheiro) */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Responsável Atual (Engenheiro)</label>
                  <select
                    value={formEdicao.responsavel_id}
                    onChange={e => {
                      const val = e.target.value
                      const match = colaboradores.find(c => c.id === val)
                      setFormEdicao(prev => ({
                        ...prev,
                        responsavel_id: val,
                        responsavel_nome: match ? match.nome : ''
                      }))
                    }}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  >
                    <option value="">Não atribuído</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>
                    ))}
                  </select>
                </div>

                {/* Próximo Responsável */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Próximo Responsável (Próximo Passo)</label>
                  <select
                    value={formEdicao.proximo_responsavel_id}
                    onChange={e => {
                      const val = e.target.value
                      const match = colaboradores.find(c => c.id === val)
                      setFormEdicao(prev => ({
                        ...prev,
                        proximo_responsavel_id: val,
                        proximo_responsavel_nome: match ? match.nome : ''
                      }))
                    }}
                    style={{ width: '100%', background: C.bgPanel, border: '1px solid rgba(59, 130, 246, 0.4)', color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  >
                    <option value="">Nenhum definido</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>
                    ))}
                  </select>
                </div>

                {/* Obra / Destino */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Obra / Destino</label>
                    <button
                      type="button"
                      onClick={() => setFormEdicao(prev => ({ ...prev, usar_obra_manual: !prev.usar_obra_manual }))}
                      style={{ border: 'none', background: 'transparent', color: C.amber, fontSize: 9.5, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {formEdicao.usar_obra_manual ? 'Escolher da lista de obras' : 'Digitar destino manual (Outros)'}
                    </button>
                  </div>
                  {formEdicao.usar_obra_manual ? (
                    <input
                      value={formEdicao.obra_nome_manual}
                      onChange={e => setFormEdicao(prev => ({ ...prev, obra_nome_manual: e.target.value }))}
                      placeholder="Nome do local / obra personalizada (Ex: Galpão Anexo)"
                      style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                    />
                  ) : (
                    <select
                      value={formEdicao.obra_id}
                      onChange={e => setFormEdicao(prev => ({ ...prev, obra_id: e.target.value }))}
                      style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                    >
                      <option value="">🏢 Geral / Sede</option>
                      {obras.map(o => (
                        <option key={o.id} value={o.id}>{o.nome}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Fornecedor */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Fornecedor</label>
                  <input
                    value={formEdicao.fornecedor}
                    onChange={e => setFormEdicao(prev => ({ ...prev, fornecedor: e.target.value }))}
                    list="fornecedores-drawer-list"
                    placeholder="Nome do fornecedor"
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                  <datalist id="fornecedores-drawer-list">
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.nome_fantasia || f.razao_social} />
                    ))}
                  </datalist>
                </div>

                {/* Valor Total */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Valor Total (R$)</label>
                  <input
                    value={formEdicao.valor}
                    onChange={e => setFormEdicao(prev => ({ ...prev, valor: e.target.value }))}
                    placeholder="0,00"
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: '#10B981', fontWeight: 800, fontFamily: 'monospace', fontSize: 12, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>

                {/* Quantidade e Unidade */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Quantidade Geral</label>
                  <input
                    value={formEdicao.quantidade}
                    onChange={e => setFormEdicao(prev => ({ ...prev, quantidade: e.target.value }))}
                    placeholder="Ex: 50"
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Unidade de Medida</label>
                  <select
                    value={formEdicao.unidade}
                    onChange={e => setFormEdicao(prev => ({ ...prev, unidade: e.target.value }))}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  >
                    <option value="un">un (Unidade)</option>
                    <option value="saco">saco (Sacos)</option>
                    <option value="barra">barra (Barras)</option>
                    <option value="m">m (Metros)</option>
                    <option value="m²">m² (Metro Quad.)</option>
                    <option value="m³">m³ (Metro Cúb.)</option>
                    <option value="kg">kg (Quilograma)</option>
                    <option value="litro">litro (Litros)</option>
                    <option value="caixa">caixa (Caixas)</option>
                    <option value="rolo">rolo (Rolos)</option>
                    <option value="peça">peça (Peças)</option>
                  </select>
                </div>

                {/* Previsão de Entrega */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Previsão de Entrega</label>
                  <input
                    type="date"
                    value={formEdicao.data_previsao_entrega}
                    onChange={e => setFormEdicao(prev => ({ ...prev, data_previsao_entrega: e.target.value }))}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>

                {/* Vencimento Financeiro */}
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Vencimento Financeiro</label>
                  <input
                    type="date"
                    value={formEdicao.data_vencimento}
                    onChange={e => setFormEdicao(prev => ({ ...prev, data_vencimento: e.target.value }))}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>
              </div>

              {/* Botões do Formulário Completo */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setModoEdicaoCompleta(false)}
                  style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.inkSoft, padding: '6px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={handleSalvarEdicaoCompleta}
                  style={{ border: 'none', background: C.amber, color: '#0A0A0A', padding: '6px 16px', borderRadius: 4, fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Check size={12} />
                  {salvando ? 'Salvando Auditoria...' : 'Salvar Alterações da Ficha'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ─── BARRA DE TRANSFERÊNCIA DE RESPONSÁVEL (ENGENHEIRO) ──────────── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: C.bgPanel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: item.responsavel_nome ? C.amber : 'rgba(156, 163, 175, 0.2)',
                      color: item.responsavel_nome ? '#0A0A0A' : C.inkSoft,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 11
                    }}
                  >
                    {item.responsavel_nome ? item.responsavel_nome.charAt(0).toUpperCase() : <User size={13} />}
                  </div>
                  <div>
                    <span style={{ fontSize: 9.5, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Responsável pela Demanda (Engenheiro)
                    </span>
                    <strong style={{ fontSize: 12, color: C.ink }}>
                      {item.responsavel_nome || 'Nenhum responsável atribuído'}
                    </strong>
                  </div>
                </div>

                {/* Dropdown de Transferência */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Share2 size={12} color={C.amber} />
                  <select
                    aria-label="Transferir responsável"
                    id="drawer-select-responsavel"
                    value={item.responsavel_id || ''}
                    onChange={e => handleTransferirResponsavel(e.target.value)}
                    disabled={salvando}
                    style={{
                      background: C.bgWhite,
                      color: C.ink,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: 180
                    }}
                  >
                    <option value="">Transferir para...</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.cargo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ─── BARRA DO PRÓXIMO RESPONSÁVEL (QUEM EXECUTARÁ O PRÓXIMO PASSO) ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: item.proximo_responsavel_nome ? '#3B82F6' : 'rgba(59, 130, 246, 0.2)',
                      color: item.proximo_responsavel_nome ? '#FFFFFF' : '#3B82F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 11
                    }}
                  >
                    {item.proximo_responsavel_nome ? item.proximo_responsavel_nome.charAt(0).toUpperCase() : '➡️'}
                  </div>
                  <div>
                    <span style={{ fontSize: 9.5, color: '#3B82F6', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                      Próximo Responsável (Próximo Passo)
                    </span>
                    <strong style={{ fontSize: 12, color: C.ink }}>
                      {item.proximo_responsavel_nome || 'Nenhum definido'}
                    </strong>
                  </div>
                </div>

                {/* Dropdown de Próximo Responsável */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    aria-label="Definir próximo responsável"
                    value={item.proximo_responsavel_id || ''}
                    onChange={e => handleTransferirProximoResponsavel(e.target.value)}
                    disabled={salvando}
                    style={{
                      background: C.bgWhite,
                      color: C.ink,
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: 180
                    }}
                  >
                    <option value="">Definir próximo...</option>
                    {colaboradores.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.cargo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ─── GRID DE PROPRIEDADES RÁPIDAS (TOTALMENTE EDITÁVEL) ─────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 11 }}>
                {/* 1. Obra ou Obra Manual */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Obra / Destino</span>
                    <button
                      type="button"
                      onClick={() => setEditandoObraManual(!editandoObraManual)}
                      title="Alternar entre obra cadastrada ou manual"
                      style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 0 }}
                    >
                      <Edit2 size={9} />
                    </button>
                  </div>
                  {editandoObraManual ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        value={novaObraManual}
                        onChange={e => setNovaObraManual(e.target.value)}
                        placeholder="Nome manual..."
                        style={{ width: '100%', background: C.bgWhite, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 10.5, padding: '2px 4px', borderRadius: 3 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSalvarObraManual(novaObraManual)
                          if (e.key === 'Escape') setEditandoObraManual(false)
                        }}
                      />
                      <button onClick={() => handleSalvarObraManual(novaObraManual)} style={{ background: C.amber, border: 'none', borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <Check size={10} color="#000" />
                      </button>
                      <button onClick={() => setEditandoObraManual(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkSoft, borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : item.obra_nome_manual ? (
                    <div
                      onClick={() => { setNovaObraManual(item.obra_nome_manual || ''); setEditandoObraManual(true); }}
                      style={{ color: C.amber, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                      title="Clique para editar obra manual"
                    >
                      📍 {item.obra_nome_manual}
                    </div>
                  ) : (
                    <select
                      value={item.obra_id || ''}
                      onChange={e => {
                        if (e.target.value === '__manual__') {
                          setNovaObraManual('')
                          setEditandoObraManual(true)
                        } else {
                          handleAtualizarPropriedade('obra_id', e.target.value || null, 'Obra')
                        }
                      }}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 11, fontWeight: 600, outline: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <option value="">🏢 Sem Obra</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      <option value="__manual__">📍 Outros (Digitar manual...)</option>
                    </select>
                  )}
                </div>

                {/* 2. Solicitante */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Solicitante</span>
                    <button
                      type="button"
                      onClick={() => { setNovoSolicitante(item.solicitante || ''); setEditandoSolicitante(!editandoSolicitante); }}
                      title="Editar solicitante do pedido"
                      style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 0 }}
                    >
                      <Edit2 size={9} />
                    </button>
                  </div>
                  {editandoSolicitante ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        value={novoSolicitante}
                        onChange={e => setNovoSolicitante(e.target.value)}
                        placeholder="Nome do solicitante"
                        autoFocus
                        style={{ width: '100%', background: C.bgWhite, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 10.5, padding: '2px 4px', borderRadius: 3 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSalvarSolicitante(novoSolicitante)
                          if (e.key === 'Escape') setEditandoSolicitante(false)
                        }}
                      />
                      <button onClick={() => handleSalvarSolicitante(novoSolicitante)} style={{ background: C.amber, border: 'none', borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <Check size={10} color="#000" />
                      </button>
                      <button onClick={() => setEditandoSolicitante(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkSoft, borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setNovoSolicitante(item.solicitante || ''); setEditandoSolicitante(true); }}
                      style={{ color: C.ink, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                      title="Clique para editar solicitante"
                    >
                      👤 {item.solicitante || 'Clique p/ definir'}
                    </div>
                  )}
                </div>

                {/* 3. Fornecedor */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Fornecedor</span>
                    <button
                      type="button"
                      onClick={() => { setNovoFornecedor(item.fornecedor || ''); setEditandoFornecedor(!editandoFornecedor); }}
                      title="Editar fornecedor"
                      style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 0 }}
                    >
                      <Edit2 size={9} />
                    </button>
                  </div>
                  {editandoFornecedor ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        value={novoFornecedor}
                        onChange={e => setNovoFornecedor(e.target.value)}
                        placeholder="Nome fornecedor..."
                        list="fornecedores-quick-list"
                        autoFocus
                        style={{ width: '100%', background: C.bgWhite, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 10.5, padding: '2px 4px', borderRadius: 3 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSalvarFornecedor(novoFornecedor)
                          if (e.key === 'Escape') setEditandoFornecedor(false)
                        }}
                      />
                      <datalist id="fornecedores-quick-list">
                        {fornecedores.map(f => (
                          <option key={f.id} value={f.nome_fantasia || f.razao_social} />
                        ))}
                      </datalist>
                      <button onClick={() => handleSalvarFornecedor(novoFornecedor)} style={{ background: C.amber, border: 'none', borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <Check size={10} color="#000" />
                      </button>
                      <button onClick={() => setEditandoFornecedor(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkSoft, borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setNovoFornecedor(item.fornecedor || ''); setEditandoFornecedor(true); }}
                      style={{ color: item.fornecedor ? C.ink : C.inkSoft, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                      title="Clique para editar fornecedor"
                    >
                      🏬 {item.fornecedor || 'Clique p/ definir'}
                    </div>
                  )}
                </div>

                {/* 4. Valor Total */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>Valor Total</span>
                    <button
                      type="button"
                      onClick={() => { setNovoValor(item.valor ? String(item.valor) : ''); setEditandoValor(!editandoValor); }}
                      title="Editar valor total"
                      style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 0 }}
                    >
                      <Edit2 size={9} />
                    </button>
                  </div>
                  {editandoValor ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        value={novoValor}
                        onChange={e => setNovoValor(e.target.value)}
                        placeholder="0,00"
                        autoFocus
                        style={{ width: '100%', background: C.bgWhite, border: `1px solid ${C.amber}`, color: '#10B981', fontFamily: 'monospace', fontWeight: 800, fontSize: 11, padding: '2px 4px', borderRadius: 3 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSalvarValor(novoValor)
                          if (e.key === 'Escape') setEditandoValor(false)
                        }}
                      />
                      <button onClick={() => handleSalvarValor(novoValor)} style={{ background: C.amber, border: 'none', borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <Check size={10} color="#000" />
                      </button>
                      <button onClick={() => setEditandoValor(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkSoft, borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setNovoValor(item.valor ? String(item.valor) : ''); setEditandoValor(true); }}
                      style={{ color: '#10B981', fontWeight: 800, fontFamily: 'monospace', fontSize: 11.5, cursor: 'pointer' }}
                      title="Clique para editar valor"
                    >
                      {item.valor ? `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Clique p/ cotar'}
                    </div>
                  )}
                </div>

                {/* 5. Quantidade e Materiais do Pedido */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700 }}>
                      {itensChecklist.length > 0 ? 'Materiais no Pedido' : 'Quantidade Geral'}
                    </span>
                    {itensChecklist.length === 0 && (
                      <button
                        type="button"
                        onClick={() => { setNovaQtd(item.quantidade || ''); setNovaUnidade(item.unidade || 'un'); setEditandoQtd(!editandoQtd); }}
                        title="Editar quantidade e unidade avulsa"
                        style={{ border: 'none', background: 'transparent', color: C.inkSoft, cursor: 'pointer', padding: 0 }}
                      >
                        <Edit2 size={9} />
                      </button>
                    )}
                  </div>
                  {itensChecklist.length > 0 ? (
                    <div
                      onClick={() => setTabAtiva('checklist')}
                      style={{ color: C.amber, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Ver lista de materiais na aba de itens"
                    >
                      <CheckSquare size={12} />
                      <span>{itensChecklist.length} material(is) no pedido</span>
                    </div>
                  ) : editandoQtd ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        value={novaQtd}
                        onChange={e => setNovaQtd(e.target.value)}
                        placeholder="Qtd"
                        style={{ width: 45, background: C.bgWhite, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 10.5, padding: '2px 4px', borderRadius: 3 }}
                      />
                      <input
                        value={novaUnidade}
                        onChange={e => setNovaUnidade(e.target.value)}
                        placeholder="Un"
                        style={{ width: 40, background: C.bgWhite, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 10.5, padding: '2px 4px', borderRadius: 3 }}
                      />
                      <button onClick={() => handleSalvarQtd(novaQtd, novaUnidade)} style={{ background: C.amber, border: 'none', borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <Check size={10} color="#000" />
                      </button>
                      <button onClick={() => setEditandoQtd(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.inkSoft, borderRadius: 3, padding: '2px 4px', cursor: 'pointer' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setNovaQtd(item.quantidade || ''); setNovaUnidade(item.unidade || 'un'); setEditandoQtd(true); }}
                      style={{ color: C.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      title="Clique para editar quantidade"
                    >
                      {item.quantidade || item.unidade ? `${item.quantidade || ''} ${item.unidade || ''}` : 'Clique p/ definir'}
                    </div>
                  )}
                </div>

                {/* 6. Prioridade */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 2 }}>Prioridade</span>
                  <select
                    value={item.prioridade || 'media'}
                    onChange={e => handleAtualizarPropriedade('prioridade', e.target.value, 'Prioridade')}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 11, fontWeight: 700, outline: 'none', cursor: 'pointer', padding: 0, textTransform: 'capitalize' }}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">⚡ Urgente</option>
                  </select>
                </div>

                {/* 7. Previsão de Entrega */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 2 }}>Previsão Entrega</span>
                  <input
                    type="date"
                    value={item.data_previsao_entrega || ''}
                    onChange={e => handleAtualizarPropriedade('data_previsao_entrega', e.target.value, 'Previsão de Entrega')}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 10.5, outline: 'none', cursor: 'pointer', padding: 0 }}
                  />
                </div>

                {/* 8. Vencimento Financeiro */}
                <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 2 }}>Vencimento Fin.</span>
                  <input
                    type="date"
                    value={item.data_vencimento || ''}
                    onChange={e => handleAtualizarPropriedade('data_vencimento', e.target.value, 'Vencimento Financeiro')}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 10.5, outline: 'none', cursor: 'pointer', padding: 0 }}
                  />
                </div>
              </div>

              {/* Alerta e Sincronização de Valor com Financeiro */}
              {contaVinculada && item.valor && Math.abs(contaVinculada.valor - item.valor) > 0.01 && (
                <div style={{
                  marginTop: 10,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#EF4444' }}>
                    <AlertTriangle size={15} />
                    <div>
                      <span style={{ fontWeight: 800, display: 'block' }}>Divergência com Financeiro Detectada</span>
                      <span style={{ color: C.inkSoft }}>
                        Financeiro: <strong>R$ {contaVinculada.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> | Suprimentos: <strong>R$ {item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSalvarValor(String(contaVinculada.valor))}
                    style={{
                      background: '#EF4444',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Atualizar valor no Suprimentos para igualar ao Financeiro"
                  >
                    Sincronizar Valor
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── 2. ABAS DE NAVEGAÇÃO DA GAVETA ─────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgCard, padding: '0 16px' }}>
          <button
            onClick={() => setTabAtiva('checklist')}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tabAtiva === 'checklist' ? 800 : 600,
              color: tabAtiva === 'checklist' ? C.amber : C.inkSoft,
              borderBottom: `2px solid ${tabAtiva === 'checklist' ? C.amber : 'transparent'}`,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <CheckSquare size={13} />
            Checklist ({itensConcluidos}/{totalItens})
          </button>

          <button
            onClick={() => setTabAtiva('dgenny')}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tabAtiva === 'dgenny' ? 800 : 600,
              color: tabAtiva === 'dgenny' ? C.amber : C.inkSoft,
              borderBottom: `2px solid ${tabAtiva === 'dgenny' ? C.amber : 'transparent'}`,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Bot size={13} />
            Cotação IA (WhatsApp)
          </button>

          <button
            onClick={() => setTabAtiva('anexos')}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tabAtiva === 'anexos' ? 800 : 600,
              color: tabAtiva === 'anexos' ? C.amber : C.inkSoft,
              borderBottom: `2px solid ${tabAtiva === 'anexos' ? C.amber : 'transparent'}`,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Paperclip size={13} />
            Anexos ({anexosList.length})
          </button>

          <button
            onClick={() => setTabAtiva('chat')}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tabAtiva === 'chat' ? 800 : 600,
              color: tabAtiva === 'chat' ? C.amber : C.inkSoft,
              borderBottom: `2px solid ${tabAtiva === 'chat' ? C.amber : 'transparent'}`,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <MessageSquare size={13} />
            Chat do Card ({chatList.length})
          </button>

          <button
            onClick={() => setTabAtiva('historico')}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: tabAtiva === 'historico' ? 800 : 600,
              color: tabAtiva === 'historico' ? C.amber : C.inkSoft,
              borderBottom: `2px solid ${tabAtiva === 'historico' ? C.amber : 'transparent'}`,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <History size={13} />
            Histórico ({historicoList.length})
          </button>
        </div>

        {/* ─── 3. CONTEÚDO DA ABA ATIVA ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ════ ABA 1: CHECKLIST DE ITENS & CONFERÊNCIA PARCIAL ═══════════════ */}
          {tabAtiva === 'checklist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', display: 'block' }}>
                    Itens do Pedido & Quantidades Entregues
                  </span>
                  <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>
                    {totalItens === 0 ? 'Nenhum item cadastrado' : (
                      <>
                        <strong style={{ color: '#10B981' }}>{itensConcluidos}</strong> entregues · <strong style={{ color: '#3B82F6' }}>{itensComprados}</strong> comprados · <strong style={{ color: C.inkSoft }}>{itensPendentes}</strong> pendentes
                      </>
                    )}
                  </div>
                </div>

                {itensChecklist.length > 0 && itensPendentes > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarTodosComprados}
                    style={{
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#3B82F6',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Marcar todos os itens pendentes deste pedido como comprados"
                  >
                    <CheckCheck size={12} />
                    <span>Marcar todos como Comprados</span>
                  </button>
                )}
              </div>

              {/* Lista de Itens */}
              {itensChecklist.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: C.inkSoft, background: C.bgCard, border: `1px dashed ${C.border}`, borderRadius: 6, fontSize: 12 }}>
                  Nenhum item específico cadastrado. Adicione abaixo os materiais para conferência de canteiro.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itensChecklist.map(chk => (
                    <div
                      key={chk.id}
                      style={{
                        background: C.bgCard,
                        border: `1px solid ${
                          chk.status === 'entregue'
                            ? 'rgba(16, 185, 129, 0.4)'
                            : chk.status === 'comprado'
                            ? 'rgba(59, 130, 246, 0.4)'
                            : chk.status === 'parcial'
                            ? 'rgba(245, 158, 11, 0.4)'
                            : C.border
                        }`,
                        borderRadius: 6,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10
                      }}
                    >
                      {editandoChecklistId === chk.id ? (
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <input
                            value={editChecklistDesc}
                            onChange={e => setEditChecklistDesc(e.target.value)}
                            placeholder="Descrição do material..."
                            autoFocus
                            style={{ flex: 1, minWidth: 140, background: C.bgPanel, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 12, padding: '4px 8px', borderRadius: 4, outline: 'none' }}
                          />
                          <input
                            type="number"
                            value={editChecklistQtd}
                            onChange={e => setEditChecklistQtd(e.target.value)}
                            placeholder="Qtd"
                            style={{ width: 60, background: C.bgPanel, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 12, padding: '4px 6px', borderRadius: 4, textAlign: 'center', outline: 'none' }}
                          />
                          <select
                            value={editChecklistUnidade}
                            onChange={e => setEditChecklistUnidade(e.target.value)}
                            style={{ background: C.bgPanel, border: `1px solid ${C.amber}`, color: C.ink, fontSize: 11, padding: '4px 6px', borderRadius: 4, outline: 'none' }}
                          >
                            <option value="un">un</option>
                            <option value="saco">saco</option>
                            <option value="barra">barra</option>
                            <option value="m">m</option>
                            <option value="m²">m²</option>
                            <option value="m³">m³</option>
                            <option value="kg">kg</option>
                            <option value="litro">litro</option>
                            <option value="caixa">caixa</option>
                            <option value="rolo">rolo</option>
                            <option value="peça">peça</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSalvarEdicaoItemChecklist(chk.id)}
                            style={{ background: C.amber, border: 'none', borderRadius: 4, padding: '4px 8px', color: '#0A0A0A', cursor: 'pointer', fontWeight: 800 }}
                            title="Salvar alterações no item"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoChecklistId(null)}
                            style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', color: C.inkSoft, cursor: 'pointer' }}
                            title="Cancelar edição"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Checkbox rápido */}
                          <button
                            onClick={() => handleAtualizarQtdItem(chk.id, chk.status === 'entregue' ? 0 : chk.qtd_pedida)}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              border: `1.5px solid ${chk.status === 'entregue' ? '#10B981' : chk.status === 'comprado' ? '#3B82F6' : chk.status === 'parcial' ? C.amber : C.inkSoft}`,
                              background: chk.status === 'entregue' ? '#10B981' : chk.status === 'comprado' ? 'rgba(59, 130, 246, 0.15)' : chk.status === 'parcial' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                              color: '#0A0A0A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {chk.status === 'entregue' && <Check size={13} color="#FFF" />}
                            {chk.status === 'comprado' && <div style={{ width: 6, height: 6, background: '#3B82F6', borderRadius: 1 }} />}
                            {chk.status === 'parcial' && <div style={{ width: 6, height: 6, background: C.amber, borderRadius: 1 }} />}
                          </button>

                          {/* Descrição */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textDecoration: chk.status === 'entregue' ? 'line-through' : 'none', opacity: chk.status === 'entregue' ? 0.7 : 1 }}>
                              {chk.descricao}
                            </div>
                            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                              Pedido: <strong style={{ color: C.ink }}>{chk.qtd_pedida} {chk.unidade}</strong>
                            </div>
                          </div>

                          {/* Controle de Quantidade Entregue (Parcial) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10.5, color: C.inkSoft }}>Entregue:</span>
                            <input
                              type="number"
                              value={chk.qtd_entregue}
                              onChange={e => handleAtualizarQtdItem(chk.id, parseFloat(e.target.value) || 0)}
                              style={{
                                width: 55,
                                background: C.bgPanel,
                                border: `1px solid ${C.border}`,
                                color: C.ink,
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '3px 6px',
                                borderRadius: 4,
                                textAlign: 'center'
                              }}
                            />
                            <span style={{ fontSize: 11, color: C.inkSoft }}>{chk.unidade}</span>
                          </div>

                          {/* Seletor Rápido de Status */}
                          <select
                            value={chk.status}
                            onChange={e => handleMudarStatusItemChecklist(chk.id, e.target.value as any)}
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '3px 6px',
                              borderRadius: 4,
                              border: `1px solid ${
                                chk.status === 'entregue'
                                  ? 'rgba(16, 185, 129, 0.5)'
                                  : chk.status === 'comprado'
                                  ? 'rgba(59, 130, 246, 0.5)'
                                  : chk.status === 'parcial'
                                  ? 'rgba(245, 158, 11, 0.5)'
                                  : C.border
                              }`,
                              background:
                                chk.status === 'entregue'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : chk.status === 'comprado'
                                  ? 'rgba(59, 130, 246, 0.15)'
                                  : chk.status === 'parcial'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              color:
                                chk.status === 'entregue'
                                  ? '#10B981'
                                  : chk.status === 'comprado'
                                  ? '#3B82F6'
                                  : chk.status === 'parcial'
                                  ? C.amber
                                  : C.inkSoft,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                            title="Alterar status do material (Pendente, Comprado, Parcial, Entregue)"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="comprado">Comprado</option>
                            <option value="parcial">Parcial</option>
                            <option value="entregue">Entregue</option>
                          </select>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {/* Editar Item */}
                            <button
                              onClick={() => iniciarEdicaoChecklist(chk)}
                              style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 3, borderRadius: 3 }}
                              title="Editar este material do pedido"
                            >
                              <Edit2 size={12} />
                            </button>

                            {/* Excluir Item */}
                            <button
                              onClick={() => handleRemoverItemChecklist(chk.id)}
                              style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 3, borderRadius: 3 }}
                              title="Remover item"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário Novo Item */}
              <form onSubmit={handleAdicionarItemChecklist} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <input
                  placeholder="Novo item (ex: Cimento CP-II, Ferragem 1/2...)"
                  value={novoItemDesc}
                  onChange={e => setNovoItemDesc(e.target.value)}
                  style={{ flex: 1, background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 12, padding: '6px 10px', borderRadius: 4, outline: 'none' }}
                />
                <input
                  placeholder="Qtd"
                  type="number"
                  value={novoItemQtd}
                  onChange={e => setNovoItemQtd(e.target.value)}
                  style={{ width: 60, background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 12, padding: '6px 8px', borderRadius: 4, textAlign: 'center', outline: 'none' }}
                />
                <input
                  placeholder="Un"
                  value={novoItemUnidade}
                  onChange={e => setNovoItemUnidade(e.target.value)}
                  style={{ width: 45, background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 12, padding: '6px 8px', borderRadius: 4, textAlign: 'center', outline: 'none' }}
                />
                <button
                  type="submit"
                  style={{ background: C.amber, color: '#0A0A0A', border: 'none', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={13} /> Adicionar
                </button>
              </form>
            </div>
          )}

          {/* ════ ABA DGENNY: COTAÇÃO IA NO WHATSAPP ═══════════════════════════ */}
          {tabAtiva === 'dgenny' && (
            <DgennyCotacaoTab
              suprimento={item}
              obra={obras.find(o => o.id === item.obra_id)}
              fornecedoresDisponiveis={fornecedores}
              onSuprimentoUpdated={(updated) => {
                onUpdateItem(updated)
              }}
            />
          )}

          {/* ════ ABA 2: ANEXOS (DOCUMENTOS, NOTAS FISCAIS, COMPROVANTES) ═══════ */}
          {tabAtiva === 'anexos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Botão de Upload */}
              <div
                style={{
                  border: `2px dashed ${C.border}`,
                  borderRadius: 8,
                  padding: '20px 16px',
                  textAlign: 'center',
                  background: C.bgCard,
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <input
                  type="file"
                  onChange={handleUploadAnexo}
                  disabled={fazendoUpload}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
                <UploadCloud size={24} color={C.amber} style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                  {fazendoUpload ? 'Fazendo upload...' : 'Clique ou arraste um arquivo para anexar'}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.inkSoft }}>
                  Orçamentos, Cotações, NF-e, fotos da entrega no canteiro ou recibos
                </p>
              </div>

              {/* Lista de Anexos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {anexosList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: C.inkSoft, fontSize: 12 }}>
                    Nenhum anexo registrado neste card.
                  </div>
                ) : (
                  anexosList.map(att => (
                    <div
                      key={att.id}
                      style={{
                        background: C.bgCard,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <FileText size={18} color={C.amber} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {att.nome}
                          </a>
                          <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>
                            {att.tamanho || 'Arquivo'} • Anexado por {att.autor} em {new Date(att.data).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: C.inkSoft, padding: 4 }}
                          title="Visualizar anexo"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={() => handleRemoverAnexo(att.id)}
                          style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 4 }}
                          title="Remover anexo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ════ ABA 3: CHAT INTERNO DA DEMANDA ═════════════════════════════════ */}
          {tabAtiva === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 380, justifyContent: 'space-between' }}>
              {/* Feed de Mensagens */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 4, flex: 1 }}>
                {chatList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: C.inkSoft, fontSize: 12 }}>
                    Nenhuma mensagem ainda. Inicie a conversa abaixo com sua equipe.
                  </div>
                ) : (
                  chatList.map(msg => {
                    const isMinha = msg.autor_id === colaboradorAtivo?.id
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMinha ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: isMinha ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isMinha ? C.amber : C.ink }}>
                            {msg.autor_nome}
                          </span>
                          <span style={{ fontSize: 9.5, color: C.inkSoft }}>
                            {new Date(msg.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          style={{
                            background: isMinha ? 'rgba(245, 158, 11, 0.12)' : C.bgCard,
                            border: `1px solid ${isMinha ? 'rgba(245, 158, 11, 0.3)' : C.border}`,
                            color: C.ink,
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontSize: 12.5,
                            lineHeight: 1.4,
                            wordBreak: 'break-word'
                          }}
                        >
                          {msg.mensagem}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input de Mensagem */}
              <form onSubmit={handleEnviarMensagem} style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <input
                  placeholder="Escreva uma mensagem ou observação interna..."
                  value={novaMensagem}
                  onChange={e => setNovaMensagem(e.target.value)}
                  style={{
                    flex: 1,
                    background: C.bgCard,
                    border: `1px solid ${C.border}`,
                    color: C.ink,
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  title="Enviar mensagem"
                  aria-label="Enviar mensagem"
                  disabled={enviandoMsg || !novaMensagem.trim()}
                  style={{
                    background: C.amber,
                    color: '#0A0A0A',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          )}

          {/* ════ ABA 4: HISTÓRICO DE AUDITORIA COMPLETO ════════════════════════ */}
          {tabAtiva === 'historico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>
                  Linha do Tempo de Auditoria ("Quem, O Que e Pra Quem")
                </span>
                <span style={{ fontSize: 10, color: C.inkSoft, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 10, border: `1px solid ${C.border}` }}>
                  {historicoList.length} registro(s) auditado(s)
                </span>
              </div>

              {/* Registro Manual de Nota de Auditoria / Parecer Formal */}
              <form onSubmit={handleAdicionarNotaAuditoria} style={{ display: 'flex', gap: 8, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: C.amber, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
                    + Registrar Nota / Parecer Formal de Auditoria
                  </span>
                  <input
                    placeholder="Adicione um parecer formal ou observação de segurança para registro eterno..."
                    value={novaNotaAuditoria}
                    onChange={e => setNovaNotaAuditoria(e.target.value)}
                    style={{ width: '100%', background: C.bgPanel, border: `1px solid ${C.border}`, color: C.ink, fontSize: 11.5, padding: '6px 8px', borderRadius: 4, outline: 'none' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={salvandoNotaAuditoria || !novaNotaAuditoria.trim()}
                  style={{
                    background: C.amber,
                    color: '#0A0A0A',
                    border: 'none',
                    borderRadius: 4,
                    padding: '7px 12px',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    alignSelf: 'flex-end',
                    opacity: salvandoNotaAuditoria || !novaNotaAuditoria.trim() ? 0.6 : 1
                  }}
                >
                  <ShieldCheck size={12} />
                  {salvandoNotaAuditoria ? 'Gravando...' : 'Assinar & Gravar'}
                </button>
              </form>

              {historicoList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: C.inkSoft, fontSize: 12 }}>
                  Nenhum registro de atividade ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                  {/* Linha vertical */}
                  <div style={{ position: 'absolute', top: 10, bottom: 10, left: 13, width: 2, background: C.border }} />

                  {historicoList.map(act => {
                    const isMudancaResp = act.acao.includes('responsavel')
                    const isEdicaoFicha = act.acao.includes('edicao')
                    const isEtapa = act.acao.includes('etapa') || act.acao.includes('aprovacao') || act.acao.includes('entrega')
                    const isNota = act.acao === 'nota_auditoria'

                    const dotCor = isNota ? '#8B5CF6' : isMudancaResp ? C.amber : isEtapa ? '#10B981' : '#3B82F6'

                    return (
                      <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
                        {/* Ponto na timeline */}
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: dotCor,
                            border: `3px solid ${C.bgPanel}`,
                            marginTop: 5,
                            zIndex: 2,
                            flexShrink: 0
                          }}
                        />

                        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${isNota ? 'rgba(139, 92, 246, 0.3)' : C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: 12, color: C.ink }}>{act.autor_nome}</strong>
                              <span style={{
                                fontSize: 8.5,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: `${dotCor}18`,
                                color: dotCor,
                                border: `1px solid ${dotCor}40`
                              }}>
                                {isNota ? 'Parecer Formal' : isMudancaResp ? 'Responsável' : isEdicaoFicha ? 'Edição Ficha' : isEtapa ? 'Etapa' : 'Ação'}
                              </span>
                            </div>
                            <span style={{ fontSize: 10, color: C.inkSoft }}>
                              {new Date(act.data).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: C.ink, lineHeight: 1.4 }}>
                            {act.detalhe}
                          </p>
                          {act.de && act.para && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10.5, color: C.amber }}>
                              <span>De: <strong>{act.de}</strong></span>
                              <span>➔</span>
                              <span>Para: <strong>{act.para}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>

    {/* ════ MODAL DE EXPORTAÇÃO: ORDEM DE COMPRA (OC) OFICIAL ════ */}
    {modalExportarOC && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}
        onClick={() => setModalExportarOC(false)}
      >
        <div
          style={{
            background: '#FFFFFF',
            color: '#111827',
            width: '100%',
            maxWidth: 780,
            maxHeight: '92vh',
            overflowY: 'auto',
            borderRadius: 8,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Barra de Ações Superior (Não sai na impressão) */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderBottom: '1px solid #E5E7EB',
              background: '#F9FAFB'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={16} color="#374151" />
              <strong style={{ fontSize: 13, color: '#111827' }}>Ordem de Compra Oficial</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleCopiarOCWhatsApp}
                style={{
                  background: copiadoWhats ? '#10B981' : '#2563EB',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Copiar texto pronto para envio via WhatsApp"
              >
                {copiadoWhats ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiadoWhats ? 'Copiado p/ WhatsApp' : 'Copiar p/ WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: '#111827',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Imprimir ou Salvar em PDF"
              >
                <Printer size={13} />
                <span>Imprimir / Salvar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setModalExportarOC(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #D1D5DB',
                  color: '#4B5563',
                  borderRadius: 4,
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
                title="Fechar visualização"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Folha de Impressão (id="area-ordem-compra") */}
          <div id="area-ordem-compra" style={{ padding: '32px 36px', background: '#FFFFFF', color: '#111827', fontFamily: 'Arial, sans-serif' }}>
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                #area-ordem-compra, #area-ordem-compra * { visibility: visible !important; }
                #area-ordem-compra {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  padding: 20mm !important;
                  margin: 0 !important;
                  background: #FFF !important;
                  color: #000 !important;
                }
                .no-print { display: none !important; }
              }
            `}</style>

            {/* Cabeçalho Oficial */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: -0.5, color: '#111827' }}>
                  JWA ENGENHARIA & CONSTRUÇÃO
                </h2>
                <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>
                  Departamento de Suprimentos & Compras
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>
                  ORDEM DE COMPRA
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#2563EB', fontFamily: 'monospace' }}>
                  {item.codigo || ('OC-' + item.id.slice(0, 8).toUpperCase())}
                </div>
                <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 2 }}>
                  Emissão: {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>

            {/* Grid de Informações da Compra */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: 12, marginBottom: 18, fontSize: 11.5, color: '#111827' }}>
              <div>
                <div style={{ color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Obra / Destino:</div>
                <strong style={{ color: '#111827', fontSize: 12, display: 'block' }}>
                  {item.obra_nome_manual || obras.find(o => o.id === item.obra_id)?.nome || 'Não informada'}
                </strong>
                {obras.find(o => o.id === item.obra_id)?.endereco && (
                  <div style={{ color: '#374151', fontSize: 10.5, marginTop: 2 }}>
                    📍 {obras.find(o => o.id === item.obra_id)?.endereco}
                  </div>
                )}
              </div>
              <div>
                <div style={{ color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Fornecedor:</div>
                <strong style={{ color: '#111827', fontSize: 12, display: 'block' }}>
                  {item.fornecedor || 'A definir'}
                </strong>
                {(() => {
                  const fornMatch = fornecedores.find(
                    f =>
                      (f.nome_fantasia && f.nome_fantasia.toLowerCase() === item.fornecedor?.toLowerCase()) ||
                      (f.razao_social && f.razao_social.toLowerCase() === item.fornecedor?.toLowerCase())
                  )
                  if (!fornMatch) return null
                  return (
                    <div style={{ color: '#374151', fontSize: 10.5, marginTop: 2 }}>
                      {fornMatch.cnpj ? `CNPJ: ${fornMatch.cnpj}` : ''}
                      {fornMatch.telefone ? ` · Tel: ${fornMatch.telefone}` : ''}
                    </div>
                  )
                })()}
              </div>
              <div>
                <div style={{ color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Solicitante / Origem:</div>
                <span style={{ color: '#111827', fontWeight: 700 }}>{item.solicitante || 'Não informado'}</span>
              </div>
              <div>
                <div style={{ color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Engenheiro / Responsável:</div>
                <span style={{ color: '#111827', fontWeight: 700 }}>{item.responsavel_nome || 'Não informado'}</span>
              </div>
              <div>
                <div style={{ color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Previsão de Entrega:</div>
                <span style={{ color: '#111827', fontWeight: 800 }}>
                  {item.data_previsao_entrega ? new Date(item.data_previsao_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'A combinar'}
                </span>
              </div>
              <div>
                <div style={{ color: '#4B5563', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>Vencimento / Pagamento:</div>
                <span style={{ color: '#111827', fontWeight: 800 }}>
                  {item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'A combinar'}
                </span>
              </div>
            </div>

            {/* Tabela de Itens e Materiais Solicitados */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#111827', marginBottom: 6 }}>
                Materiais Solicitados
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#111827', background: '#FFFFFF' }}>
                <thead>
                  <tr style={{ background: '#F3F4F6', borderBottom: '1px solid #D1D5DB', textAlign: 'left', color: '#111827' }}>
                    <th style={{ padding: '7px 8px', width: 35, color: '#111827', fontWeight: 800 }}>#</th>
                    <th style={{ padding: '7px 8px', color: '#111827', fontWeight: 800 }}>Descrição do Material</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', width: 90, color: '#111827', fontWeight: 800 }}>Qtd Pedida</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', width: 70, color: '#111827', fontWeight: 800 }}>Unidade</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', width: 90, color: '#111827', fontWeight: 800 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itensChecklist.length > 0 ? (
                    itensChecklist.map((chk, idx) => (
                      <tr key={chk.id} style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFFFF', color: '#111827' }}>
                        <td style={{ padding: '7px 8px', color: '#374151', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 800, color: '#111827' }}>{chk.descricao}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 900, color: '#111827' }}>{chk.qtd_pedida}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>{chk.unidade}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', color: '#111827' }}>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: chk.status === 'entregue' ? '#D1FAE5' : chk.status === 'comprado' ? '#DBEAFE' : chk.status === 'parcial' ? '#FEF3C7' : '#E5E7EB',
                            color: chk.status === 'entregue' ? '#065F46' : chk.status === 'comprado' ? '#1E40AF' : chk.status === 'parcial' ? '#92400E' : '#1F2937'
                          }}>
                            {chk.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFFFF', color: '#111827' }}>
                      <td style={{ padding: '7px 8px', color: '#374151', fontWeight: 700 }}>1</td>
                      <td style={{ padding: '7px 8px', fontWeight: 800, color: '#111827' }}>{item.titulo}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 900, color: '#111827' }}>{item.quantidade || '1'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>{item.unidade || 'un'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: '#111827' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: '#DBEAFE', color: '#1E40AF' }}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Financeiro Sempre Visível */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '10px 14px', marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#065F46', textTransform: 'uppercase' }}>Valor Total da Ordem de Compra:</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#047857', fontFamily: 'monospace' }}>
                {item.valor
                  ? `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Em cotação / A definir'}
              </span>
            </div>

            {/* Instruções / Observações */}
            <div style={{ fontSize: 10.5, color: '#4B5563', border: '1px dashed #D1D5DB', borderRadius: 4, padding: '8px 12px', marginBottom: 30 }}>
              <strong>Instruções de Entrega:</strong> O material deve ser entregue acompanhado de Nota Fiscal com indicação do número desta Ordem de Compra ({item.codigo || ('OC-' + item.id.slice(0, 8).toUpperCase())}). Horário de recebimento em canteiro das 07:30 às 17:00.
            </div>

            {/* Assinatura Eletrônica & Autenticação por Login (Dispensa assinatura manual) */}
            {(() => {
              const hist = Array.isArray(item.historico_atividades) ? item.historico_atividades : []
              const aprovAct = hist.find((a: any) => a.acao === 'aprovacao_compra' || a.acao === 'aprovacao_sem_financeiro')
              const recebAct = hist.find((a: any) => a.acao === 'recebimento_obra' || (a.acao === 'mudanca_etapa' && a.para === 'Entregue'))
              const assinanteCompra = aprovAct?.autor_nome || autorAtual
              const dataAssinaturaCompra = aprovAct?.data ? new Date(aprovAct.data).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
              const hashAutenticacao = `JWA-${item.id.slice(0, 6).toUpperCase()}-${(colaboradorAtivo?.id || 'AUTH').slice(0, 4).toUpperCase()}`

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
                  {/* Coluna 1: Assinatura Digital de Emissão / Aprovação pelo Login */}
                  <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 6, padding: '10px 14px', color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 900, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        ✔ Assinado Digitalmente (Login JWA)
                      </span>
                      <span style={{ fontSize: 8.5, fontFamily: 'monospace', fontWeight: 800, color: '#166534', background: '#DCFCE7', padding: '1px 5px', borderRadius: 3 }}>
                        {hashAutenticacao}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 900, color: '#111827' }}>
                      {assinanteCompra}
                    </div>
                    <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>
                      <strong>Exportado / Emitido por:</strong> {autorAtual} {colaboradorAtivo?.email ? `(${colaboradorAtivo.email})` : ''}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#4B5563', marginTop: 2 }}>
                      Data/Hora da Autenticação: <strong>{dataAssinaturaCompra}</strong>
                    </div>
                    <div style={{ fontSize: 8.5, color: '#15803D', marginTop: 4, fontWeight: 700 }}>
                      Documento validado eletronicamente via sessão autenticada no Sistema JWA Engenharia. Dispensa assinatura física.
                    </div>
                  </div>

                  {/* Coluna 2: Conferência / Recebimento no Canteiro */}
                  <div style={{ background: '#F9FAFB', border: '1px solid #D1D5DB', borderRadius: 6, padding: '10px 14px', color: '#111827', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 9.5, fontWeight: 900, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Conferência & Recebimento no Canteiro
                      </span>
                      {recebAct ? (
                        <>
                          <div style={{ fontSize: 11.5, fontWeight: 900, color: '#111827' }}>
                            ✔ Recebido por: {recebAct.autor_nome}
                          </div>
                          <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>
                            Conferido digitalmente em: <strong>{new Date(recebAct.data).toLocaleString('pt-BR')}</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
                            Responsável Obra: {item.responsavel_nome || 'Engenheiro / Almoxarifado'}
                          </div>
                          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>
                            Status atual na esteira: <strong>{item.status}</strong>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ borderTop: '1px dashed #D1D5DB', paddingTop: 6, marginTop: 8, fontSize: 9, color: '#6B7280' }}>
                      Conferência vinculada ao pedido {item.codigo || ('OC-' + item.id.slice(0, 8).toUpperCase())} — JWA Engenharia
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    )}
  </>
  )
}
