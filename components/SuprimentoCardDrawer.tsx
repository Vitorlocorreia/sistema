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
  Bot
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
  status: 'pendente' | 'parcial' | 'entregue'
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
  obras: Array<{ id: string; nome: string }>
  fornecedores: Array<{ id: string; razao_social: string; nome_fantasia?: string | null }>
  colaboradorAtivo: any
  contaVinculada?: any
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
  contaVinculada
}: SuprimentoCardDrawerProps) {
  // Aba ativa: 'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico'
  const [tabAtiva, setTabAtiva] = useState<'checklist' | 'dgenny' | 'anexos' | 'chat' | 'historico'>('checklist')

  // Estados de edição inline
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Chat
  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviandoMsg, setEnviandoMsg] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Checklist
  const [novoItemDesc, setNovoItemDesc] = useState('')
  const [novoItemQtd, setNovoItemQtd] = useState('')
  const [novoItemUnidade, setNovoItemUnidade] = useState('un')

  // Upload anexo
  const [fazendoUpload, setFazendoUpload] = useState(false)

  useEffect(() => {
    if (item) {
      setNovoTitulo(item.titulo || '')
      setEditandoTitulo(false)
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
  const historicoList: AtividadeHistorico[] = Array.isArray(item.historico_atividades) ? item.historico_atividades : []
  const anexosList: AnexoItem[] = Array.isArray(item.anexos) ? item.anexos : []
  const chatList: MensagemChat[] = Array.isArray(item.chat_mensagens) ? item.chat_mensagens : []

  return (
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
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: C.amber,
                    padding: '2px 8px',
                    borderRadius: 4
                  }}
                >
                  OC-{item.id.slice(0, 6).toUpperCase()}
                </span>

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

          {/* ─── BARRA DE TRANSFERÊNCIA DE RESPONSÁVEL ──────────────────────── */}
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
                  Responsável pela Demanda
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

          {/* ─── GRID DE PROPRIEDADES RÁPIDAS ─────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11 }}>
            {/* Obra */}
            <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
              <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Obra</span>
              <select
                value={item.obra_id || ''}
                onChange={e => handleAtualizarPropriedade('obra_id', e.target.value, 'Obra')}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 11, fontWeight: 600, outline: 'none', cursor: 'pointer', padding: 0 }}
              >
                <option value="">Sem Obra</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>

            {/* Prioridade */}
            <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
              <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Prioridade</span>
              <select
                value={item.prioridade || 'media'}
                onChange={e => handleAtualizarPropriedade('prioridade', e.target.value, 'Prioridade')}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 11, fontWeight: 700, outline: 'none', cursor: 'pointer', padding: 0, textTransform: 'capitalize' }}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            {/* Valor */}
            <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
              <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Valor Total</span>
              <div style={{ color: '#10B981', fontWeight: 800, fontFamily: 'monospace', fontSize: 11.5 }}>
                {item.valor ? `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Em cotação'}
              </div>
            </div>

            {/* Previsão de Entrega */}
            <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
              <span style={{ fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Previsão Entrega</span>
              <input
                type="date"
                value={item.data_previsao_entrega || ''}
                onChange={e => handleAtualizarPropriedade('data_previsao_entrega', e.target.value, 'Previsão de Entrega')}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.ink, fontSize: 10.5, outline: 'none', cursor: 'pointer', padding: 0 }}
              />
            </div>
          </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>
                  Itens do Pedido & Quantidades Entregues
                </span>
                <span style={{ fontSize: 11, color: C.inkSoft }}>
                  {totalItens === 0 ? 'Nenhum item avulso' : `${itensConcluidos} de ${totalItens} entregues`}
                </span>
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
                        border: `1px solid ${chk.status === 'entregue' ? 'rgba(16, 185, 129, 0.4)' : chk.status === 'parcial' ? 'rgba(245, 158, 11, 0.4)' : C.border}`,
                        borderRadius: 6,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10
                      }}
                    >
                      {/* Checkbox rápido */}
                      <button
                        onClick={() => handleAtualizarQtdItem(chk.id, chk.status === 'entregue' ? 0 : chk.qtd_pedida)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: `1.5px solid ${chk.status === 'entregue' ? '#10B981' : chk.status === 'parcial' ? C.amber : C.inkSoft}`,
                          background: chk.status === 'entregue' ? '#10B981' : chk.status === 'parcial' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                          color: '#0A0A0A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        {chk.status === 'entregue' && <Check size={13} color="#FFF" />}
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

                      {/* Badge de Status */}
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: chk.status === 'entregue' ? 'rgba(16, 185, 129, 0.15)' : chk.status === 'parcial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                          color: chk.status === 'entregue' ? '#10B981' : chk.status === 'parcial' ? C.amber : C.inkSoft
                        }}
                      >
                        {chk.status}
                      </span>

                      {/* Excluir */}
                      <button
                        onClick={() => handleRemoverItemChecklist(chk.id)}
                        style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', padding: 2 }}
                        title="Remover item"
                      >
                        <Trash2 size={13} />
                      </button>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>
                Linha do Tempo de Auditoria ("Quem, O Que e Pra Quem")
              </div>

              {historicoList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: C.inkSoft, fontSize: 12 }}>
                  Nenhum registro de atividade ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                  {/* Linha vertical */}
                  <div style={{ position: 'absolute', top: 10, bottom: 10, left: 13, width: 2, background: C.border }} />

                  {historicoList.map(act => (
                    <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
                      {/* Ponto na timeline */}
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: act.acao.includes('responsavel') ? C.amber : '#3B82F6',
                          border: `3px solid ${C.bgPanel}`,
                          marginTop: 5,
                          zIndex: 2,
                          flexShrink: 0
                        }}
                      />

                      <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 12, color: C.ink }}>{act.autor_nome}</strong>
                          <span style={{ fontSize: 10, color: C.inkSoft }}>
                            {new Date(act.data).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
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
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
