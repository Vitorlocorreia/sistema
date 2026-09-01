'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardPlus,
  FileSpreadsheet,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  Users,
  Search,
  X,
  Copy,
  ExternalLink,
  Stethoscope as MedIcon,
  FileUp,
  CreditCard,
  Building,
  Mail,
  Calendar,
  Edit3,
  RefreshCw,
  Folder
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { PageTitle } from '@/components/PageTitle'
import { Panel } from '@/components/Panel'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { motion } from 'motion/react'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useConfirm } from '@/hooks/useConfirm'
import { usePrompt } from '@/hooks/usePrompt'

// ─── TIPAGEM ─────────────────────────────────────────────────────────────────
type Funcionario = {
  id: string
  nome: string
  cpf: string | null
  matricula: string | null
  cargo: string | null
  data_admissao: string | null
  status: string
  email: string | null
}

type ChecklistItem = { id: string; label: string; obrigatorio: boolean; concluido?: boolean }

type ModeloAdmissao = {
  id: string
  codigo: string
  ordem: number
  nome: string
  descricao: string
  arquivo_nome: string
  arquivo_url: string
  tipo_arquivo: 'DOCX' | 'XLSX'
  campos: string[]
  checklist: ChecklistItem[]
}

type EtapaStatus = 'Pendente' | 'Em preenchimento' | 'Aguardando conferência' | 'Concluída' | 'Dispensada'

type EtapaAdmissao = {
  id: string
  funcionario_id: string
  modelo_id: string
  status: EtapaStatus
  observacoes: string | null
  iniciado_em: string | null
  concluido_em: string | null
  dados: Record<string, unknown>
  modelo: ModeloAdmissao
  checklist: ChecklistItem[]
}

type Details = {
  historico: Array<Record<string, string | null>>
  documentos: Array<Record<string, string | null>>
  exames: Array<Record<string, string | null>>
  etapas: EtapaAdmissao[]
}

type DocumentoCadastro = {
  id: string
  modelo_id: string
  item_id: string
  nome: string
  storage_path: string
  status: string
  observacao_rh: string | null
  enviado_em: string | null
  created_at?: string | null
  revisado_em?: string | null
  modelo?: { id: string; ordem: number; nome: string }
}

type Convite = {
  id: string
  nome_destinatario: string
  email_destinatario: string | null
  telefone_destinatario: string | null
  cpf: string | null
  matricula: string | null
  endereco: string | null
  data_admissao: string | null
  data_inicio_efetivo: string | null
  inicio_efetivo: boolean
  cargo: string | null
  obra: string | null
  etapa_atual: number
  expires_at: string
  status: string
  token_code: string | null
  justificativa_devolucao: string | null
  created_at: string
  revogado_em: string | null
  aprovado_em: string | null
  funcionario_id: string | null
  criado_por?: string | null
  documentos: DocumentoCadastro[]
}

const emptyDetails: Details = { historico: [], documentos: [], exames: [], etapas: [] }

// ─── ESTILOS EMPRESARIAIS & DESIGN TOKENS ───────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.ink,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: C.inkSoft,
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 5,
  letterSpacing: '0.05em',
}

const btnBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '8px 14px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  transition: 'all 0.15s ease',
}

const GUIA_ITEM_ID = 'identificacao'
const LAUDO_ITEM_ID = 'responsavel'

function resolveNomeCriador(criadoPor: string | null | undefined, colaboradoresList: any[]) {
  if (!criadoPor) return 'Gestor RH'
  if (!criadoPor.includes('-')) return criadoPor

  const colab = (colaboradoresList || []).find(c =>
    c.id === criadoPor ||
    c.email === criadoPor ||
    c.nome === criadoPor ||
    (c as any).auth_user_id === criadoPor ||
    (c as any).user_id === criadoPor ||
    (c as any).usuario_id === criadoPor ||
    (c as any).auth_id === criadoPor
  )

  if (colab?.nome) return colab.nome
  if (colab?.email) return colab.email

  return 'Gestor RH'
}

function parseDadosBancarios(nome?: string | null) {
  if (!nome) return { pix: '', banco: '', agenciaConta: '' }
  if (nome.startsWith('Dados Bancários:')) {
    const parts = nome.replace('Dados Bancários:', '').split(' | ')
    return {
      pix: parts[0]?.replace('PIX:', '').trim() || '',
      banco: parts[1]?.replace('Banco:', '').trim() || '',
      agenciaConta: parts[2]?.replace('Agência/Conta:', '').trim() || ''
    }
  }
  if (nome.startsWith('Chave PIX:')) {
    return { pix: nome.replace('Chave PIX:', '').trim(), banco: '', agenciaConta: '' }
  }
  return { pix: nome, banco: '', agenciaConta: '' }
}

// ─── COMPONENTE: PAINEL DE ARQUIVO DOCUMENTAL DO FUNCIONÁRIO ────────────────
function ArchivePanel({
  person,
  details,
  onDelete,
  onOpen,
  onUpload
}: {
  person: Funcionario
  details: Details
  onDelete: () => void
  onOpen: (documento: Record<string, string | null>) => void
  onUpload?: (order: number, files: FileList) => void
}) {
  const [filter, setFilter] = useState('')
  const documents = details.documentos.filter(doc =>
    `${doc.nome || ''} ${doc.tipo || ''}`.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header do Baú Documental */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Folder size={15} color={C.amber} />
            <h4 style={{ fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
              Baú Documental Permanente
            </h4>
          </div>
          <p style={{ color: C.inkSoft, fontSize: 11, margin: '3px 0 0' }}>
            Arquivo definitivo do funcionário distribuído nas 4 pastas de admissão.
          </p>
        </div>
        <div style={{ width: 220, position: 'relative' }}>
          <Search size={12} color={C.inkSoft} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            style={{ ...inputStyle, paddingLeft: 26, fontSize: 11, padding: '6px 10px 6px 26px' }}
            placeholder="Filtrar documento..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Grid das 4 Pastas Documentais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {[1, 2, 3, 4].map(order => {
          const etapa = details.etapas.find(item => item.modelo?.ordem === order)
          const docs = documents.filter(doc => {
            if (doc.etapa_id) return etapa?.id ? doc.etapa_id === etapa.id : false
            if (doc.ordem_pasta) return String(doc.ordem_pasta) === String(order)
            return order === 1
          })

          const pastaTitulos: Record<number, string> = {
            1: 'Identificação & Pessoal',
            2: 'Ficha Cadastral',
            3: 'Declarações & Termos',
            4: 'Saúde & ASO'
          }

          return (
            <div
              key={order}
              style={{
                background: C.bgWhite,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9.5, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  PASTA {order}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, background: C.bgPanel, padding: '2px 6px', borderRadius: 3, border: `1px solid ${C.border}` }}>
                  {docs.length} arq.
                </span>
              </div>
              <h5 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>
                {etapa?.modelo?.nome || pastaTitulos[order]}
              </h5>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                {docs.length > 0 ? (
                  docs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => onOpen(doc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        textAlign: 'left',
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        padding: '6px 8px',
                        background: C.bgPanel,
                        color: C.ink,
                        fontSize: 10,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease'
                      }}
                      className="hover:border-amber-500"
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        📄 {doc.nome || 'Documento'}
                      </span>
                      <ExternalLink size={11} color={C.amber} />
                    </button>
                  ))
                ) : (
                  <p style={{ color: C.inkSoft, fontSize: 10, fontStyle: 'italic', margin: '4px 0' }}>
                    Nenhum arquivo nesta pasta.
                  </p>
                )}
              </div>

              {onUpload && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    width: '100%',
                    textAlign: 'center',
                    border: `1px dashed ${C.border}`,
                    padding: '6px 0',
                    background: 'transparent',
                    color: C.inkSoft,
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 'auto',
                    borderRadius: 4,
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:text-amber-500 hover:border-amber-500"
                >
                  <Plus size={11} /> Anexar arquivo
                  <input
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files?.length) {
                        onUpload(order, e.target.files)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>

      {/* Histórico & Ocorrências */}
      {details.historico.length > 0 && (
        <div style={{ marginTop: 8, background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Histórico de Ocorrências
          </span>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {details.historico.map((h, i) => (
              <div key={i} style={{ fontSize: 11, color: C.ink, display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: C.bgPanel, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <span>{h.descricao || h.tipo}</span>
                <span style={{ color: C.inkSoft, fontSize: 10 }}>{h.data_evento ? new Date(h.data_evento).toLocaleDateString('pt-BR') : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTE: VISUALIZADOR DE ETAPAS DO CANDIDATO ─────────────────────────
function CadastroTable({
  invite,
  modelos,
  onOpen,
  onReview,
  onApprove,
  onRevoke,
  onRegenerate,
  onCopy,
  onDelete,
  onRefresh,
}: {
  invite: Convite
  modelos: ModeloAdmissao[]
  onOpen: (documento: DocumentoCadastro) => void
  onReview: (documento: DocumentoCadastro, status: 'aprovado' | 'devolvido') => void
  onApprove: () => void
  onRevoke: () => void
  onRegenerate: () => void
  onCopy: () => void
  onDelete: () => void
  onRefresh?: () => Promise<void> | void
  colaboradorAtivo?: any
  colaboradores?: Array<{ id: string; nome: string; email?: string }>
}) {
  const [activeFolder, setActiveFolder] = useState(1)
  const [uploadingGuia, setUploadingGuia] = useState(false)

  const modeloEtapa4 = modelos.find(m => m.ordem === 4)
  const guiaRH = modeloEtapa4 ? invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && (d.item_id === GUIA_ITEM_ID || d.item_id === '__guia_rh__')) : null
  const laudoCandidato = modeloEtapa4 ? invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && (d.item_id === LAUDO_ITEM_ID || d.item_id === '__laudo_candidato__')) : null
  const docPix = invite.documentos.find(d => d.item_id === 'pix' || d.item_id?.includes('pix') || d.nome?.includes('PIX') || d.nome?.includes('Dados Bancários'))

  // Modais de Edição
  const [editPixOpen, setEditPixOpen] = useState(false)
  const [inputPix, setInputPix] = useState('')
  const [inputBanco, setInputBanco] = useState('')
  const [inputAgenciaConta, setInputAgenciaConta] = useState('')
  const [savingPix, setSavingPix] = useState(false)

  const [editEmailOpen, setEditEmailOpen] = useState(false)
  const [inputEmail, setInputEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const [editIniciandoOpen, setEditIniciandoOpen] = useState(false)
  const [dataEfetivaInput, setDataEfetivaInput] = useState('')
  const [savingEfetivo, setSavingEfetivo] = useState(false)

  function openModalEmail() {
    setInputEmail(invite.email_destinatario || '')
    setEditEmailOpen(true)
  }

  async function handleSaveEmailRH() {
    if (!inputEmail.trim() || !inputEmail.includes('@')) {
      return toast('Informe um e-mail válido.', 'error')
    }
    setSavingEmail(true)
    try {
      const { error } = await supabase
        .from('rh_admissao_convites')
        .update({ email_destinatario: inputEmail.trim(), updated_at: new Date().toISOString() })
        .eq('id', invite.id)
      if (error) throw error
      toast('E-mail atualizado com sucesso!', 'success')
      setEditEmailOpen(false)
      await onRefresh?.()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar e-mail', 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  function openModalPix() {
    const parsed = parseDadosBancarios(docPix?.nome)
    setInputPix(parsed.pix)
    setInputBanco(parsed.banco)
    setInputAgenciaConta(parsed.agenciaConta)
    setEditPixOpen(true)
  }

  async function handleSavePixRH() {
    if (!inputPix.trim() && !inputBanco.trim() && !inputAgenciaConta.trim()) {
      return toast('Preencha ao menos a chave PIX ou banco/conta', 'error')
    }
    setSavingPix(true)
    try {
      const modeloEtapa1 = modelos.find(m => m.ordem === 1) || modelos[0]
      if (!modeloEtapa1) throw new Error('Modelo de admissão não encontrado')

      const formattedNome = `Dados Bancários: PIX: ${inputPix.trim()} | Banco: ${inputBanco.trim()} | Agência/Conta: ${inputAgenciaConta.trim()}`

      if (docPix) {
        const { error } = await supabase
          .from('rh_admissao_documentos')
          .update({
            nome: formattedNome,
            storage_path: docPix.storage_path || 'pix-dados-bancarios',
            status: 'aprovado',
            revisado_em: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', docPix.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rh_admissao_documentos').insert({
          convite_id: invite.id,
          modelo_id: modeloEtapa1.id,
          item_id: 'pix',
          nome: formattedNome,
          storage_path: 'pix-dados-bancarios',
          mime_type: 'text/plain',
          tamanho_bytes: 10,
          status: 'aprovado'
        })
        if (error) throw error
      }
      toast('Dados bancários e PIX salvos com sucesso!', 'success')
      setEditPixOpen(false)
      await onRefresh?.()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar PIX', 'error')
    } finally {
      setSavingPix(false)
    }
  }

  function openModalEfetivo() {
    setDataEfetivaInput(invite.data_inicio_efetivo || '')
    setEditIniciandoOpen(true)
  }

  async function handleSaveEfetivo() {
    setSavingEfetivo(true)
    try {
      const { error } = await supabase
        .from('rh_admissao_convites')
        .update({
          data_inicio_efetivo: dataEfetivaInput || null,
          inicio_efetivo: !!dataEfetivaInput,
          updated_at: new Date().toISOString()
        })
        .eq('id', invite.id)

      if (error) throw error
      toast('Início efetivo atualizado com sucesso!', 'success')
      setEditIniciandoOpen(false)
      await onRefresh?.()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Falha ao atualizar início efetivo', 'error')
    } finally {
      setSavingEfetivo(false)
    }
  }

  async function uploadGuiaMedica(file: File | undefined) {
    if (!file || !modeloEtapa4) return
    setUploadingGuia(true)
    try {
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const path = `guias/${invite.id}-${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('rh-documentos').upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw uploadError
      if (guiaRH) {
        await supabase.from('rh_admissao_documentos').delete().eq('id', guiaRH.id)
      }
      const { error: rowError } = await supabase.from('rh_admissao_documentos').insert({
        convite_id: invite.id,
        modelo_id: modeloEtapa4.id,
        item_id: GUIA_ITEM_ID,
        nome: file.name,
        storage_path: path,
        tamanho_bytes: file.size,
        mime_type: file.type,
        status: 'enviado',
      })
      if (rowError) throw rowError
      toast('Guia médica anexada com sucesso!', 'success')
      await onRefresh?.()
    } catch (err: unknown) {
      toast('Erro: ' + (err instanceof Error ? err.message : 'falha no envio'), 'error')
    } finally {
      setUploadingGuia(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumo do Candidato & Ações Superiores */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>
              {invite.nome_destinatario}
            </h3>
            {invite.inicio_efetivo && (
              <span style={{ fontSize: 9.5, fontWeight: 900, background: 'rgba(245, 158, 11, 0.15)', color: C.amber, border: `1px solid ${C.amber}55`, padding: '2px 8px', borderRadius: 4 }}>
                🚀 Início Efetivo na Empresa
              </span>
            )}
          </div>
          <div style={{ color: C.inkSoft, fontSize: 11, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Cargo: <strong style={{ color: C.ink }}>{invite.cargo || 'Não informado'}</strong></span>
            <span>·</span>
            <span>CPF: <strong style={{ color: C.ink }}>{invite.cpf || 'Não informado'}</strong></span>
            <span>·</span>
            <span>Obra: <strong style={{ color: C.ink }}>{invite.obra || 'Geral / Não definida'}</strong></span>
            {invite.data_inicio_efetivo && (
              <>
                <span>·</span>
                <span style={{ color: C.amber, fontWeight: 800 }}>
                  📅 Início: {new Date(invite.data_inicio_efetivo + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={openModalEfetivo}
            style={{ ...btnBase, background: C.bgCard, color: C.ink, border: `1px solid ${C.border}` }}
          >
            <Calendar size={12} color={C.amber} /> Início Efetivo
          </button>
          <button
            onClick={onCopy}
            style={{ ...btnBase, background: C.bgCard, color: C.ink, border: `1px solid ${C.border}` }}
          >
            <Copy size={12} /> Copiar Link
          </button>
          <button
            onClick={onRegenerate}
            style={{ ...btnBase, background: C.bgCard, color: C.ink, border: `1px solid ${C.border}` }}
          >
            <RefreshCw size={12} /> Prorrogar
          </button>
          <button
            onClick={onRevoke}
            style={{ ...btnBase, background: 'rgba(239, 68, 68, 0.08)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}
          >
            Revogar
          </button>
          <button
            onClick={onDelete}
            style={{ ...btnBase, background: 'rgba(239, 68, 68, 0.08)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}
          >
            <Trash2 size={12} /> Excluir
          </button>
          {invite.status !== 'aprovado' && (
            <button
              onClick={onApprove}
              style={{
                ...btnBase,
                background: '#10B981',
                color: '#0A0A0A',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
              }}
            >
              <CheckCircle2 size={13} strokeWidth={2.5} /> Aprovar & Efetivar
            </button>
          )}
        </div>
      </div>

      {/* ETAPA 4 — GUIA DE EXAME MÉDICO (BIDIRECIONAL) */}
      {modeloEtapa4 && (
        <div style={{ background: C.bgWhite, border: `1px solid ${laudoCandidato?.status === 'aprovado' ? '#10B98155' : C.border}`, borderRadius: 6, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MedIcon size={14} color={C.amber} />
              <span style={{ fontSize: 11, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Etapa 4 — Controle de Exame Admissional (ASO)
              </span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, color: laudoCandidato?.status === 'aprovado' ? '#10B981' : C.amber }}>
              {laudoCandidato?.status === 'aprovado' ? '✓ ASO APROVADO' : 'EM ANDAMENTO'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {/* 1. RH Envia a Guia */}
            <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.ink }}>1. Guia Emitida pelo RH</span>
                <span style={{ fontSize: 8.5, background: 'rgba(245, 158, 11, 0.12)', color: C.amber, padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>RH</span>
              </div>
              <p style={{ fontSize: 10, color: C.inkSoft, margin: '2px 0 8px' }}>
                {guiaRH ? `✓ ${guiaRH.nome}` : 'Anexe a guia médica para o candidato.'}
              </p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {guiaRH && (
                  <button onClick={() => onOpen(guiaRH)} style={{ ...btnBase, padding: '4px 8px', fontSize: 9.5, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}>
                    <ExternalLink size={10} color={C.amber} /> Ver Guia
                  </button>
                )}
                <label style={{ ...btnBase, padding: '4px 10px', fontSize: 9.5, background: C.amber, color: '#0A0A0A', cursor: 'pointer' }}>
                  <FileUp size={11} /> {uploadingGuia ? 'Enviando...' : guiaRH ? 'Substituir Guia' : 'Enviar Guia'}
                  <input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" disabled={uploadingGuia} onChange={e => void uploadGuiaMedica(e.target.files?.[0])} />
                </label>
              </div>
            </div>

            {/* 2. Candidato Retorna o Laudo */}
            <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.ink }}>2. Laudo / ASO Retornado</span>
                <span style={{ fontSize: 8.5, background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>Candidato</span>
              </div>
              {laudoCandidato ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
                    <button onClick={() => onOpen(laudoCandidato)} style={{ border: 'none', background: 'none', color: C.amber, fontSize: 10, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                      📄 {laudoCandidato.nome}
                    </button>
                    <span style={{ fontSize: 9, fontWeight: 800, color: laudoCandidato.status === 'aprovado' ? '#10B981' : '#F59E0B' }}>
                      {laudoCandidato.status === 'aprovado' ? '✓ Aprovado' : 'Aguardando Análise'}
                    </span>
                  </div>
                  {laudoCandidato.status !== 'aprovado' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onReview(laudoCandidato, 'aprovado')} style={{ ...btnBase, padding: '4px 8px', fontSize: 9.5, background: '#10B981', color: '#0A0A0A' }}>
                        ✓ Aprovar Laudo
                      </button>
                      <button onClick={() => onReview(laudoCandidato, 'devolvido')} style={{ ...btnBase, padding: '4px 8px', fontSize: 9.5, background: 'rgba(239, 68, 68, 0.12)', color: '#F87171' }}>
                        Solicitar Correção
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic', margin: '6px 0 0' }}>
                  {guiaRH ? '⏳ Aguardando envio do laudo pelo candidato.' : '⚠️ Envie a guia médica primeiro.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABAS DAS ETAPAS 1 A 3 */}
      <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgWhite }}>
          {modelos.filter(m => m.ordem <= 3).map(m => (
            <button
              key={m.id}
              onClick={() => setActiveFolder(m.ordem)}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 800,
                color: activeFolder === m.ordem ? C.ink : C.inkSoft,
                background: activeFolder === m.ordem ? C.bgPanel : 'transparent',
                border: 'none',
                borderBottom: activeFolder === m.ordem ? `2px solid ${C.amber}` : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <span>📁 Etapa {m.ordem}</span>
              <span style={{ fontSize: 9, color: activeFolder === m.ordem ? C.amber : C.inkSoft }}>
                ({m.nome})
              </span>
            </button>
          ))}
        </div>

        <div style={{ padding: 14 }}>
          {modelos.filter(m => m.ordem === activeFolder).map(modelo => (
            <div key={modelo.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Etapas 2 e 3 (Documento Único) */}
              {(modelo.ordem === 2 || modelo.ordem === 3) && (() => {
                const docs = invite.documentos.filter(d => d.modelo_id === modelo.id)
                const doc = docs[docs.length - 1]
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{modelo.nome}</span>
                      <p style={{ fontSize: 10, color: C.inkSoft, margin: '2px 0 0' }}>{modelo.descricao}</p>
                      {doc && (
                        <button onClick={() => onOpen(doc)} style={{ border: 'none', background: 'none', color: C.amber, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={10} /> 📄 {doc.nome}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: doc?.status === 'aprovado' ? '#10B981' : doc ? C.amber : C.inkSoft }}>
                        {doc?.status === 'aprovado' ? '✓ Aprovado' : doc ? 'Aguardando Análise' : 'Pendente de Envio'}
                      </span>
                      {doc && doc.status !== 'aprovado' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => onReview(doc, 'aprovado')} style={{ ...btnBase, padding: '4px 8px', fontSize: 9, background: '#10B981', color: '#0A0A0A' }}>
                            Aprovar
                          </button>
                          <button onClick={() => onReview(doc, 'devolvido')} style={{ ...btnBase, padding: '4px 8px', fontSize: 9, background: 'rgba(239, 68, 68, 0.12)', color: '#F87171' }}>
                            Devolver
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Etapa 1: Checklist de Itens Básicos + PIX + E-mail */}
              {modelo.ordem === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Caixa de Texto: Dados Bancários / PIX */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={13} color={C.amber} /> Dados Bancários / Chave PIX
                      </span>
                      {docPix ? (
                        <p style={{ fontSize: 10, color: C.inkSoft, margin: '3px 0 0' }}>{docPix.nome}</p>
                      ) : (
                        <p style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic', margin: '3px 0 0' }}>Não informado pelo candidato.</p>
                      )}
                    </div>
                    <button
                      onClick={openModalPix}
                      style={{ ...btnBase, padding: '5px 10px', fontSize: 9.5, background: C.bgPanel, color: C.ink, border: `1px solid ${C.border}` }}
                    >
                      <Edit3 size={11} color={C.amber} /> {docPix ? 'Editar PIX' : 'Informar PIX'}
                    </button>
                  </div>

                  {/* Caixa de Texto: E-mail do Candidato */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={13} color={C.amber} /> E-mail de Notificação do Candidato
                      </span>
                      <p style={{ fontSize: 10, color: C.inkSoft, margin: '3px 0 0' }}>
                        {invite.email_destinatario || 'E-mail não informado.'}
                      </p>
                    </div>
                    <button
                      onClick={openModalEmail}
                      style={{ ...btnBase, padding: '5px 10px', fontSize: 9.5, background: C.bgPanel, color: C.ink, border: `1px solid ${C.border}` }}
                    >
                      <Edit3 size={11} color={C.amber} /> {invite.email_destinatario ? 'Alterar E-mail' : 'Cadastrar E-mail'}
                    </button>
                  </div>

                  {/* Lista de Documentos da Etapa 1 */}
                  {modelo.checklist.filter(item => !item.id?.includes('pix')).map(item => {
                    const docs = invite.documentos.filter(d => d.modelo_id === modelo.id && d.item_id === item.id)
                    const doc = docs[docs.length - 1]
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>
                            {item.label} {item.obrigatorio && <strong style={{ color: '#EF4444' }}>*</strong>}
                          </span>
                          {doc && (
                            <button onClick={() => onOpen(doc)} style={{ border: 'none', background: 'none', color: C.amber, fontSize: 10, cursor: 'pointer', padding: 0, display: 'block', marginTop: 2 }}>
                              ↗ {doc.nome}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: doc?.status === 'aprovado' ? '#10B981' : doc ? C.amber : C.inkSoft }}>
                            {doc?.status === 'aprovado' ? '✓ Aprovado' : doc ? 'Em Análise' : 'Pendente'}
                          </span>
                          {doc && doc.status !== 'aprovado' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => onReview(doc, 'aprovado')} style={{ ...btnBase, padding: '3px 7px', fontSize: 8.5, background: '#10B981', color: '#0A0A0A' }}>
                                Aprovar
                              </button>
                              <button onClick={() => onReview(doc, 'devolvido')} style={{ ...btnBase, padding: '3px 7px', fontSize: 8.5, background: 'rgba(239, 68, 68, 0.12)', color: '#F87171' }}>
                                Recusar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL REACT: ALTERAR INÍCIO EFETIVO */}
      {editIniciandoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 20, maxWidth: 400, width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>
              Data de Início Efetivo na Empresa
            </h4>
            <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 14px' }}>
              Ao definir a data de início, o colaborador é identificado com o badge 🚀 Início Efetivo.
            </p>
            <input
              type="date"
              style={inputStyle}
              value={dataEfetivaInput}
              onChange={e => setDataEfetivaInput(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditIniciandoOpen(false)} style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={() => void handleSaveEfetivo()} disabled={savingEfetivo} style={{ ...btnBase, background: C.amber, color: '#0A0A0A' }}>
                {savingEfetivo ? 'Salvando...' : 'Salvar Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REACT: EDITAR E-MAIL */}
      {editEmailOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 20, maxWidth: 400, width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>
              E-mail do Candidato
            </h4>
            <input
              type="email"
              style={inputStyle}
              placeholder="exemplo@email.com"
              value={inputEmail}
              onChange={e => setInputEmail(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditEmailOpen(false)} style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={() => void handleSaveEmailRH()} disabled={savingEmail} style={{ ...btnBase, background: C.amber, color: '#0A0A0A' }}>
                {savingEmail ? 'Salvando...' : 'Salvar E-mail'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REACT: EDITAR PIX / DADOS BANCÁRIOS */}
      {editPixOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 20, maxWidth: 420, width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>
              Dados Bancários & PIX
            </h4>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <span style={labelStyle}>Chave PIX</span>
                <input style={inputStyle} placeholder="CPF, e-mail, telefone ou aleatória" value={inputPix} onChange={e => setInputPix(e.target.value)} />
              </div>
              <div>
                <span style={labelStyle}>Banco</span>
                <input style={inputStyle} placeholder="Ex: Itaú, Bradesco, Nubank" value={inputBanco} onChange={e => setInputBanco(e.target.value)} />
              </div>
              <div>
                <span style={labelStyle}>Agência e Conta</span>
                <input style={inputStyle} placeholder="Ex: Ag 0001 Conta 12345-6" value={inputAgenciaConta} onChange={e => setInputAgenciaConta(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditPixOpen(false)} style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={() => void handleSavePixRH()} disabled={savingPix} style={{ ...btnBase, background: C.amber, color: '#0A0A0A' }}>
                {savingPix ? 'Salvando...' : 'Salvar Dados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL DO RH ──────────────────────────────────────────────────
export default function RhPage() {
  const { confirm, ConfirmDialog } = useConfirm()
  const { prompt, PromptDialog } = usePrompt()
  const [activeTab, setActiveTab] = useState<'admissao' | 'ativos'>('admissao')
  const [pessoas, setPessoas] = useState<Funcionario[]>([])
  const [modelos, setModelos] = useState<ModeloAdmissao[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [selectedInvite, setSelectedInvite] = useState<Convite | null>(null)
  const [selected, setSelected] = useState<Funcionario | null>(null)
  const [details, setDetails] = useState<Details>(emptyDetails)

  // Modais de Criação
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    nome: '', cpf: '', matricula: '', email: '', telefone: '', endereco: '',
    cargo: '', obra: '', data_inicio_efetivo: '', inicio_efetivo: false,
    validade: '72', pix: '', banco: '', agencia_conta: ''
  })
  const [inviteSaving, setInviteSaving] = useState(false)

  // Filtros & Busca
  const [buscaConvite, setBuscaConvite] = useState('')
  const [filtroStatusConvite, setFiltroStatusConvite] = useState<'todos' | 'expirados' | 'ativos' | 'aguardando' | 'devolvidos' | 'efetivos'>('todos')
  const [buscaPessoas, setBuscaPessoas] = useState('')

  const [colaboradorAtivo, setColaboradorAtivo] = useState<any>(null)
  const [colaboradores, setColaboradores] = useState<Array<{ id: string; nome: string; email?: string }>>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('colaborador_sessao')
      if (raw) {
        try { setColaboradorAtivo(JSON.parse(raw)) } catch {}
      }
    }
  }, [])

  const load = useCallback(async () => {
    const [
      { data: peopleData },
      { data: modelData },
      { data: inviteData },
      { data: colabsData }
    ] = await Promise.all([
      supabase.from('funcionarios').select('*').order('nome').limit(5000),
      supabase.from('rh_modelos_admissao').select('*').eq('ativo', true).order('ordem'),
      supabase.from('rh_admissao_convites').select('*, documentos:rh_admissao_documentos(*, modelo:rh_modelos_admissao(id,ordem,nome))').neq('status', 'aprovado').order('created_at', { ascending: false }).limit(5000),
      supabase.from('colaboradores').select('*'),
    ])

    if (peopleData) setPessoas(peopleData as Funcionario[])
    if (modelData) setModelos(modelData as ModeloAdmissao[])
    if (colabsData) setColaboradores(colabsData as any[])
    if (inviteData) {
      const inviteList = inviteData as Convite[]
      setConvites(inviteList)
      setSelectedInvite(prev => {
        if (!prev) return inviteList[0] || null
        return inviteList.find(i => i.id === prev.id) || inviteList[0] || null
      })
    }
    if (peopleData && peopleData.length > 0 && !selected) {
      setSelected(peopleData[0] as Funcionario)
    }
  }, [selected])

  useRealtimeSync(load, 'rh-sync', ['funcionarios', 'rh_modelos_admissao', 'rh_admissao_convites', 'funcionario_historico', 'exames_ocupacionais'])
  useEffect(() => { load() }, [load])

  // Carrega Baú Documental do Funcionário
  const loadDetails = useCallback(async (person: Funcionario) => {
    setSelected(person)
    const [
      { data: historico },
      { data: documentos },
      { data: exames },
      { data: etapas },
      { data: convitesRelacionados }
    ] = await Promise.all([
      supabase.from('funcionario_historico').select('*').eq('funcionario_id', person.id).order('data_evento', { ascending: false }),
      supabase.from('funcionario_documentos').select('*').eq('funcionario_id', person.id).order('created_at', { ascending: false }),
      supabase.from('exames_ocupacionais').select('*').eq('funcionario_id', person.id).order('created_at', { ascending: false }),
      supabase.from('funcionario_admissao_etapas').select('*, modelo:rh_modelos_admissao(*)').eq('funcionario_id', person.id).order('modelo(ordem)', { ascending: true }),
      supabase.from('rh_admissao_convites').select('id, documentos:rh_admissao_documentos(*)').eq('funcionario_id', person.id),
    ])

    const docsAdmissao: Array<Record<string, string | null>> = []
    if (convitesRelacionados) {
      convitesRelacionados.forEach((c: any) => {
        if (c.documentos && Array.isArray(c.documentos)) {
          c.documentos.forEach((d: any) => {
            let ordemDoc = null
            if (d.modelo_id) {
              const mod = modelos.find(m => m.id === d.modelo_id)
              if (mod) ordemDoc = mod.ordem
            } else if (d.item_id === '__guia_rh__' || (d.nome || '').toLowerCase().includes('guia') || (d.nome || '').toLowerCase().includes('pix')) {
              ordemDoc = 1
            }

            docsAdmissao.push({
              id: d.id,
              nome: d.nome,
              tipo: 'Documento de Admissão',
              storage_path: d.storage_path,
              status: d.status === 'aprovado' ? 'Aprovado na Admissão' : d.status,
              created_at: d.enviado_em || d.created_at,
              observacao_rh: d.observacao_rh,
              ordem_pasta: ordemDoc?.toString() || null
            })
          })
        }
      })
    }

    setDetails({
      historico: historico ?? [],
      documentos: [...(documentos ?? []), ...docsAdmissao],
      exames: exames ?? [],
      etapas: ((etapas ?? []) as unknown as EtapaAdmissao[]).sort((a, b) => a.modelo.ordem - b.modelo.ordem)
    })
  }, [modelos])

  useEffect(() => {
    if (selected && activeTab === 'ativos') {
      loadDetails(selected)
    }
  }, [selected, activeTab, loadDetails])

  // KPIs Executivos
  const stats = useMemo(() => {
    const totalPessoas = pessoas.length + convites.length
    const emAdmissao = convites.length
    const aguardandoAprovacao = convites.filter(c => c.status === 'aguardando_aprovacao' || c.documentos.some(d => d.status === 'enviado')).length
    const efetivados = convites.filter(c => c.inicio_efetivo).length + pessoas.length
    return { totalPessoas, emAdmissao, aguardandoAprovacao, efetivados }
  }, [pessoas, convites])

  // Filtros
  const convitesFiltrados = useMemo(() => {
    let arr = [...convites]
    if (buscaConvite.trim()) {
      const q = buscaConvite.toLowerCase()
      arr = arr.filter(c =>
        c.nome_destinatario.toLowerCase().includes(q) ||
        (c.cpf && c.cpf.includes(q)) ||
        (c.cargo && c.cargo.toLowerCase().includes(q)) ||
        (c.obra && c.obra.toLowerCase().includes(q))
      )
    }
    if (filtroStatusConvite === 'expirados') {
      arr = arr.filter(c => new Date(c.expires_at).getTime() <= Date.now() && ['ativo', 'em_preenchimento'].includes(c.status))
    } else if (filtroStatusConvite === 'ativos') {
      arr = arr.filter(c => new Date(c.expires_at).getTime() > Date.now() && ['ativo', 'em_preenchimento'].includes(c.status))
    } else if (filtroStatusConvite === 'aguardando') {
      arr = arr.filter(c => c.status === 'aguardando_aprovacao')
    } else if (filtroStatusConvite === 'devolvidos') {
      arr = arr.filter(c => c.status === 'devolvido')
    } else if (filtroStatusConvite === 'efetivos') {
      arr = arr.filter(c => c.inicio_efetivo)
    }
    return arr
  }, [convites, buscaConvite, filtroStatusConvite])

  const pessoasFiltradas = useMemo(() => {
    let arr = [...pessoas]
    if (buscaPessoas.trim()) {
      const q = buscaPessoas.toLowerCase()
      arr = arr.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        (p.cpf && p.cpf.includes(q)) ||
        (p.cargo && p.cargo.toLowerCase().includes(q))
      )
    }
    return arr
  }, [pessoas, buscaPessoas])

  // Ações Principais
  async function createInvite() {
    if (inviteSaving) return
    if (!inviteForm.nome.trim()) return toast('Informe o nome do candidato.', 'error')

    const authData = await supabase.auth.getUser()
    const hours = Math.min(168, Math.max(1, Number(inviteForm.validade) || 72))
    setInviteSaving(true)

    try {
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

      const { data: createdConvite, error } = await supabase.from('rh_admissao_convites').insert({
        nome_destinatario: inviteForm.nome.trim(),
        cpf: inviteForm.cpf.trim() || null,
        matricula: inviteForm.matricula.trim() || null,
        email_destinatario: inviteForm.email.trim() || null,
        telefone_destinatario: inviteForm.telefone.trim() || null,
        endereco: inviteForm.endereco.trim() || null,
        cargo: inviteForm.cargo.trim() || null,
        obra: inviteForm.obra.trim() || null,
        data_inicio_efetivo: inviteForm.data_inicio_efetivo || null,
        inicio_efetivo: !!inviteForm.data_inicio_efetivo,
        token_hash: tokenHash,
        token_code: token,
        expires_at: expiresAt,
        status: 'ativo',
        etapa_atual: 1,
        criado_por: authData.data.user?.id || null
      }).select().single()

      if (error) throw error

      if (createdConvite && (inviteForm.pix.trim() || inviteForm.banco.trim() || inviteForm.agencia_conta.trim())) {
        const modeloEtapa1 = modelos.find(m => m.ordem === 1) || modelos[0]
        if (modeloEtapa1) {
          const formattedNome = `Dados Bancários: PIX: ${inviteForm.pix.trim()} | Banco: ${inviteForm.banco.trim()} | Agência/Conta: ${inviteForm.agencia_conta.trim()}`
          await supabase.from('rh_admissao_documentos').insert({
            convite_id: createdConvite.id,
            modelo_id: modeloEtapa1.id,
            item_id: 'pix',
            nome: formattedNome,
            storage_path: 'pix-dados-bancarios',
            mime_type: 'text/plain',
            tamanho_bytes: 10,
            status: 'aprovado'
          })
        }
      }

      const link = `${window.location.origin}/admissao/${token}`
      await navigator.clipboard?.writeText(link)
      setInviteOpen(false)
      setInviteForm({ nome: '', cpf: '', matricula: '', email: '', telefone: '', endereco: '', cargo: '', obra: '', data_inicio_efetivo: '', inicio_efetivo: false, validade: '72', pix: '', banco: '', agencia_conta: '' })
      await load()
      toast(`Link de admissão gerado e copiado! Expira em ${hours}h.`, 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao gerar convite', 'error')
    } finally {
      setInviteSaving(false)
    }
  }

  async function openCadastroDocument(documento: DocumentoCadastro | Record<string, string | null>) {
    const path = documento.storage_path || (documento as any).arquivo_url
    if (!path) return toast('Documento sem arquivo vinculado.', 'error')

    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('rh-documentos').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      if (w) w.close()
      return toast('Não foi possível abrir o documento.', 'error')
    }
    if (w) {
      w.location.href = data.signedUrl
      w.focus()
    }
  }

  async function reviewCadastroDocument(invite: Convite, documento: DocumentoCadastro, status: 'aprovado' | 'devolvido') {
    let observacao: string | null = null
    if (status === 'devolvido') {
      observacao = await prompt('Solicitar Correção', { description: 'Informe o motivo da devolução ao candidato:' })
      if (observacao === null) return
    }

    const nomeUsuario = colaboradorAtivo?.nome || 'RH'
    const obsComUsuario = status === 'devolvido'
      ? (observacao ? `[${nomeUsuario}]: ${observacao}` : `Devolvido por ${nomeUsuario}`)
      : `Aprovado por ${nomeUsuario}`

    const { error } = await supabase.from('rh_admissao_documentos').update({
      status,
      observacao_rh: obsComUsuario,
      revisado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', documento.id)

    if (error) return toast(error.message, 'error')
    await supabase.from('rh_admissao_convites').update(
      status === 'devolvido'
        ? { status: 'devolvido', justificativa_devolucao: obsComUsuario, updated_at: new Date().toISOString() }
        : { justificativa_devolucao: null, updated_at: new Date().toISOString() }
    ).eq('id', invite.id)

    await load()
    toast(status === 'aprovado' ? 'Documento aprovado!' : 'Pendência enviada ao candidato.', 'success')
  }

  async function approveInvite(invite: Convite) {
    if (!(await confirm('Aprovar e Efetivar', `Deseja aprovar o cadastro de ${invite.nome_destinatario} e transferi-lo para a lista de funcionários?`, { confirmLabel: 'Aprovar Funcionário', confirmColor: '#10B981' }))) return

    const { data: newFunc, error: funcError } = await supabase.from('funcionarios').insert({
      nome: invite.nome_destinatario,
      cpf: invite.cpf,
      matricula: invite.matricula,
      cargo: invite.cargo,
      email: invite.email_destinatario,
      telefone: invite.telefone_destinatario,
      endereco: invite.endereco,
      obra: invite.obra,
      data_admissao: invite.data_inicio_efetivo || new Date().toISOString().split('T')[0]
    }).select('id').single()

    if (funcError) return toast('Erro ao criar funcionário: ' + funcError.message, 'error')

    await supabase.from('rh_admissao_convites').update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
      funcionario_id: newFunc.id,
      updated_at: new Date().toISOString()
    }).eq('id', invite.id)

    setSelectedInvite(null)
    await load()
    toast(`Funcionário ${invite.nome_destinatario} aprovado com sucesso!`, 'success')
  }

  async function uploadToArchiveFolder(order: number, files: FileList) {
    if (!selected || !files.length) return
    let uploaded = 0
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) continue
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const path = `${selected.id}/archive-${order}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('rh-documentos').upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (!uploadError) {
        await supabase.from('funcionario_documentos').insert({
          funcionario_id: selected.id,
          tipo: 'Documento Adicional',
          nome: file.name,
          arquivo_url: path,
          storage_path: path,
          tamanho_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
          status: 'Recebido'
        })
        uploaded++
      }
    }
    if (uploaded) {
      toast(`${uploaded} arquivo(s) anexado(s) à Pasta ${order}.`, 'success')
      await loadDetails(selected)
    }
  }

  const exportarExcel = () => {
    const data = (activeTab === 'admissao' ? convitesFiltrados : pessoasFiltradas).map((item: any) => ({
      Nome: item.nome_destinatario || item.nome,
      CPF: item.cpf || '',
      Cargo: item.cargo || '',
      Obra: item.obra || '',
      Email: item.email_destinatario || item.email || '',
      Status: item.status || 'Ativo',
      Data: item.data_admissao || item.data_inicio_efetivo || item.created_at || ''
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RH')
    XLSX.writeFile(wb, `relatorio_rh_${activeTab}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast('Relatório exportado com sucesso!', 'success')
  }

  return (
    <>
      <PageTitle
        modulo="Pessoas"
        titulo="Gestão de RH & Admissões"
        subtitle="Fluxo de admissão digital em 4 etapas, baú documental permanente e controle de efetivo."
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={exportarExcel}
              style={{ ...btnBase, background: C.bgPanel, color: C.ink, border: `1px solid ${C.border}` }}
            >
              <FileSpreadsheet size={14} color="#10B981" /> Exportar Excel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setInviteOpen(true)}
              style={{
                ...btnBase,
                background: C.amber,
                color: '#0A0A0A',
                fontWeight: 900,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
              }}
            >
              <ClipboardPlus size={15} strokeWidth={2.5} /> Novo Convite de Admissão
            </motion.button>
          </div>
        }
      />

      {/* TOP BAR DE KPIS EXECUTIVOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: `1px solid ${C.amber}44`, padding: 10, borderRadius: 6 }}>
            <Users size={20} color={C.amber} />
          </div>
          <div>
            <span style={labelStyle}>Total Geral</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{stats.totalPessoas}</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: `1px solid ${C.amber}44`, padding: 10, borderRadius: 6 }}>
            <Clock size={20} color={C.amber} />
          </div>
          <div>
            <span style={labelStyle}>Em Admissão</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{stats.emAdmissao}</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: 10, borderRadius: 6 }}>
            <CheckCircle2 size={20} color="#10B981" />
          </div>
          <div>
            <span style={labelStyle}>Aguardando RH</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: stats.aguardandoAprovacao > 0 ? C.amber : '#10B981', lineHeight: 1.2 }}>{stats.aguardandoAprovacao}</div>
          </div>
        </div>

        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: `1px solid ${C.amber}44`, padding: 10, borderRadius: 6 }}>
            <Building size={20} color={C.amber} />
          </div>
          <div>
            <span style={labelStyle}>Efetivados em Campo</span>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{stats.efetivados}</div>
          </div>
        </div>
      </div>

      {/* MODAL REACT: NOVO PRÉ-CADASTRO E CONVITE */}
      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase' }}>
                  Novo Convite de Admissão Digital
                </h3>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                  Preencha os dados preliminares. O candidato receberá o link seguro para envio das 4 etapas.
                </p>
              </div>
              <button onClick={() => setInviteOpen(false)} style={{ border: 'none', background: 'none', color: C.inkSoft, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={labelStyle}>Nome Completo do Candidato *</span>
                <input style={inputStyle} placeholder="Ex: João da Silva" value={inviteForm.nome} onChange={e => setInviteForm({ ...inviteForm, nome: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>CPF</span>
                <input style={inputStyle} placeholder="000.000.000-00" value={inviteForm.cpf} onChange={e => setInviteForm({ ...inviteForm, cpf: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>Matrícula</span>
                <input style={inputStyle} placeholder="Ex: JWA-102" value={inviteForm.matricula} onChange={e => setInviteForm({ ...inviteForm, matricula: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>E-mail</span>
                <input style={inputStyle} placeholder="candidato@email.com" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>Telefone / WhatsApp</span>
                <input style={inputStyle} placeholder="(11) 99999-9999" value={inviteForm.telefone} onChange={e => setInviteForm({ ...inviteForm, telefone: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>Cargo / Profissão</span>
                <input style={inputStyle} placeholder="Ex: Encarregado de Obras" value={inviteForm.cargo} onChange={e => setInviteForm({ ...inviteForm, cargo: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>Obra / Alocação</span>
                <input style={inputStyle} placeholder="Ex: Obra Shopping Cidade" value={inviteForm.obra} onChange={e => setInviteForm({ ...inviteForm, obra: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>Data de Início Efetivo</span>
                <input type="date" style={inputStyle} value={inviteForm.data_inicio_efetivo} onChange={e => setInviteForm({ ...inviteForm, data_inicio_efetivo: e.target.value })} />
              </div>
              <div>
                <span style={labelStyle}>Validade do Link (Horas)</span>
                <input type="number" min={1} max={168} style={inputStyle} value={inviteForm.validade} onChange={e => setInviteForm({ ...inviteForm, validade: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setInviteOpen(false)} style={{ ...btnBase, background: C.bgWhite, color: C.ink, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={() => void createInvite()} disabled={inviteSaving} style={{ ...btnBase, background: C.amber, color: '#0A0A0A', fontWeight: 900 }}>
                {inviteSaving ? 'Gerando...' : 'Gerar e Copiar Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTER-DETAIL ASSIMÉTRICO (5 COLS / 7 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Mestre (Esquerda - 5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Panel
            title={activeTab === 'admissao' ? `Admissões em Andamento (${convitesFiltrados.length})` : `Funcionários Ativos (${pessoasFiltradas.length})`}
            action={
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setActiveTab('admissao')}
                  style={{
                    background: activeTab === 'admissao' ? C.amber : C.bgWhite,
                    color: activeTab === 'admissao' ? '#0A0A0A' : C.inkSoft,
                    border: `1px solid ${activeTab === 'admissao' ? C.amber : C.border}`,
                    borderRadius: 3,
                    padding: '3px 8px',
                    fontSize: 9.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Admissões ({convites.length})
                </button>
                <button
                  onClick={() => setActiveTab('ativos')}
                  style={{
                    background: activeTab === 'ativos' ? C.amber : C.bgWhite,
                    color: activeTab === 'ativos' ? '#0A0A0A' : C.inkSoft,
                    border: `1px solid ${activeTab === 'ativos' ? C.amber : C.border}`,
                    borderRadius: 3,
                    padding: '3px 8px',
                    fontSize: 9.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Ativos ({pessoas.length})
                </button>
              </div>
            }
          >
            {/* Filtros e Busca */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 32 }}
                  placeholder={activeTab === 'admissao' ? 'Buscar por candidato, CPF, cargo, obra...' : 'Buscar funcionário por nome, CPF...'}
                  value={activeTab === 'admissao' ? buscaConvite : buscaPessoas}
                  onChange={e => activeTab === 'admissao' ? setBuscaConvite(e.target.value) : setBuscaPessoas(e.target.value)}
                />
                {(activeTab === 'admissao' ? buscaConvite : buscaPessoas) && (
                  <button
                    onClick={() => activeTab === 'admissao' ? setBuscaConvite('') : setBuscaPessoas('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {activeTab === 'admissao' && (
                <select
                  value={filtroStatusConvite}
                  onChange={e => setFiltroStatusConvite(e.target.value as any)}
                  style={inputStyle}
                >
                  <option value="todos">Todos os Status</option>
                  <option value="ativos">🟢 Em Preenchimento / Ativos</option>
                  <option value="aguardando">⏳ Aguardando Aprovação do RH</option>
                  <option value="efetivos">🚀 Com Início Efetivo</option>
                  <option value="devolvidos">⚠️ Com Devoluções / Correção</option>
                  <option value="expirados">⏰ Links Expirados</option>
                </select>
              )}
            </div>

            {/* Listagem de Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 280px)', minHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
              {activeTab === 'admissao' ? (
                convitesFiltrados.map(invite => {
                  const active = selectedInvite?.id === invite.id
                  const expired = new Date(invite.expires_at).getTime() <= Date.now() && ['ativo', 'em_preenchimento'].includes(invite.status)
                  const label = invite.status === 'devolvido' ? 'Devolvido' : invite.status === 'revogado' ? 'Revogado' : expired ? 'Expirado' : invite.status === 'aguardando_aprovacao' ? 'Aguardando Aprovação' : invite.status === 'em_preenchimento' ? `Etapa ${invite.etapa_atual}/4` : 'Link Gerado'

                  return (
                    <motion.div
                      key={invite.id}
                      whileHover={{ x: 2, scale: 1.005 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => setSelectedInvite(invite)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        borderRadius: 6,
                        background: active ? 'rgba(245, 158, 11, 0.08)' : C.bgCard,
                        border: `1px solid ${active ? C.amber : C.border}`,
                        borderLeft: `4px solid ${active ? C.amber : invite.status === 'aguardando_aprovacao' ? '#10B981' : invite.status === 'devolvido' || expired ? '#EF4444' : C.amber}`,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 0 0 1px rgba(245, 158, 11, 0.2), 0 4px 16px rgba(0, 0, 0, 0.06)' : '0 1px 3px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>
                          {invite.nome_destinatario}
                        </strong>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 900,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: invite.status === 'aguardando_aprovacao' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: invite.status === 'aguardando_aprovacao' ? '#10B981' : C.amber,
                          border: `1px solid ${invite.status === 'aguardando_aprovacao' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          {label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.inkSoft }}>
                        <span>Cargo: <strong style={{ color: C.ink }}>{invite.cargo || 'Não informado'}</strong></span>
                        {invite.obra && <span>· Obra: <strong style={{ color: C.ink }}>{invite.obra}</strong></span>}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9.5, color: C.inkSoft, marginTop: 2 }}>
                        <span>👤 Por: {resolveNomeCriador(invite.criado_por, colaboradores)}</span>
                        {invite.inicio_efetivo && (
                          <span style={{ color: C.amber, fontWeight: 800 }}>
                            🚀 Início Efetivo
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })
              ) : (
                pessoasFiltradas.map(person => {
                  const active = selected?.id === person.id
                  return (
                    <motion.div
                      key={person.id}
                      whileHover={{ x: 2, scale: 1.005 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => loadDetails(person)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        borderRadius: 6,
                        background: active ? 'rgba(245, 158, 11, 0.08)' : C.bgCard,
                        border: `1px solid ${active ? C.amber : C.border}`,
                        borderLeft: `4px solid ${active ? C.amber : '#10B981'}`,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{person.nome}</strong>
                        <span style={{ fontSize: 9, fontWeight: 900, color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          ✓ ATIVO
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: C.inkSoft }}>
                        {person.cargo || 'Cargo não informado'} · CPF: {person.cpf || 'Não informado'}
                      </div>
                    </motion.div>
                  )
                })
              )}

              {((activeTab === 'admissao' && convitesFiltrados.length === 0) || (activeTab === 'ativos' && pessoasFiltradas.length === 0)) && (
                <div style={{ padding: '40px 15px', textAlign: 'center', color: C.inkSoft, fontSize: 12, background: C.bgCard, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                  Nenhum registro encontrado com os filtros selecionados.
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Painel Detalhe Executivo (Direita - 7 Cols) */}
        <div className="lg:col-span-7">
          {activeTab === 'admissao' ? (
            selectedInvite ? (
              <Panel title={`Ficha de Admissão: ${selectedInvite.nome_destinatario}`}>
                <CadastroTable
                  invite={selectedInvite}
                  modelos={modelos}
                  onOpen={openCadastroDocument}
                  onReview={(doc, st) => void reviewCadastroDocument(selectedInvite, doc, st)}
                  onApprove={() => void approveInvite(selectedInvite)}
                  onRevoke={() => {}}
                  onRegenerate={() => {}}
                  onCopy={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/admissao/${selectedInvite.token_code}`)
                    toast('Link copiado com sucesso!', 'success')
                  }}
                  onDelete={() => {}}
                  onRefresh={() => load()}
                  colaboradorAtivo={colaboradorAtivo}
                  colaboradores={colaboradores}
                />
              </Panel>
            ) : (
              <div style={{ background: C.bgPanel, border: `1px dashed ${C.border}`, borderRadius: 6, padding: '80px 20px', textAlign: 'center', color: C.inkSoft }}>
                <Users size={32} color={C.inkSoft} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 900, color: C.ink }}>Nenhum candidato selecionado</h4>
                <p style={{ margin: 0, fontSize: 11 }}>Selecione um candidato na lista à esquerda para conferir e aprovar os documentos.</p>
              </div>
            )
          ) : (
            selected ? (
              <Panel title={`Ficha do Colaborador: ${selected.nome}`}>
                <ArchivePanel
                  person={selected}
                  details={details}
                  onDelete={() => {}}
                  onOpen={openCadastroDocument}
                  onUpload={uploadToArchiveFolder}
                />
              </Panel>
            ) : (
              <div style={{ background: C.bgPanel, border: `1px dashed ${C.border}`, borderRadius: 6, padding: '80px 20px', textAlign: 'center', color: C.inkSoft }}>
                <Users size={32} color={C.inkSoft} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 900, color: C.ink }}>Nenhum funcionário selecionado</h4>
                <p style={{ margin: 0, fontSize: 11 }}>Selecione um funcionário ativo para visualizar o baú documental permanente.</p>
              </div>
            )
          )}
        </div>
      </div>

      {ConfirmDialog}
      {PromptDialog}
    </>
  )
}
