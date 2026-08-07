'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ClipboardPlus,
  Download,
  FileUp,
  FileSpreadsheet,
  FileText,
  Plus,
  RotateCcw,
  Stethoscope,
  Stethoscope as MedIcon,
  Trash2,
  CreditCard,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { PageTitle } from '@/components/PageTitle'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/Toast'
import { C } from '@/lib/tokens'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

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

type ChecklistItem = { id: string; label: string; obrigatorio: boolean; concluido?: boolean }

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
type DocumentoCadastro = { id: string; modelo_id: string; item_id: string; nome: string; storage_path: string; status: string; observacao_rh: string | null; enviado_em: string | null; created_at?: string | null; revisado_em?: string | null; modelo?: { id: string; ordem: number; nome: string } }
type Convite = { id: string; nome_destinatario: string; email_destinatario: string | null; telefone_destinatario: string | null; cpf: string | null; matricula: string | null; endereco: string | null; data_admissao: string | null; data_inicio_efetivo: string | null; inicio_efetivo: boolean; cargo: string | null; obra: string | null; etapa_atual: number; expires_at: string; status: string; token_code: string | null; justificativa_devolucao: string | null; created_at: string; revogado_em: string | null; aprovado_em: string | null; funcionario_id: string | null; criado_por?: string | null; documentos: DocumentoCadastro[] }

const emptyDetails: Details = { historico: [], documentos: [], exames: [], etapas: [] }
const emptyForm = { nome: '', cpf: '', matricula: '', cargo: '', data_admissao: '', telefone: '', email: '', endereco: '' }

const input: React.CSSProperties = {
  background: '#0B0C0E',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.ink,
  padding: '9px 11px',
  fontSize: 12,
  width: '100%',
}

const btn: React.CSSProperties = {
  background: C.amber,
  color: '#0B0C0E',
  border: 0,
  borderRadius: 4,
  padding: '9px 13px',
  fontWeight: 900,
  fontSize: 11,
  cursor: 'pointer',
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  justifyContent: 'center',
}

const outlineBtn: React.CSSProperties = {
  ...btn,
  background: 'transparent',
  color: C.ink,
  border: `1px solid ${C.border}`,
}

const statusColors: Record<EtapaStatus, { bg: string; color: string }> = {
  Pendente: { bg: '#64748B20', color: '#94A3B8' },
  'Em preenchimento': { bg: '#3B82F620', color: '#60A5FA' },
  'Aguardando conferência': { bg: '#F59E0B20', color: C.amber },
  Concluída: { bg: '#22C55E20', color: '#4ADE80' },
  Dispensada: { bg: '#A855F720', color: '#C084FC' },
}

function actionFor(status: EtapaStatus) {
  if (status === 'Pendente') return { label: 'Iniciar etapa', next: 'Em preenchimento' as EtapaStatus }
  if (status === 'Em preenchimento') return { label: 'Enviar para conferência', next: 'Aguardando conferência' as EtapaStatus }
  if (status === 'Aguardando conferência') return { label: 'Concluir etapa', next: 'Concluída' as EtapaStatus }
  return { label: 'Reabrir etapa', next: 'Em preenchimento' as EtapaStatus }
}

function ArchivePanel({ person, details, onBack, onDelete, onOpen, onUpload }: { person: Funcionario; details: Details; onBack: () => void; onDelete: () => void; onOpen: (documento: Record<string, string | null>) => void; onUpload?: (order: number, files: FileList) => void }) {
  const [filter, setFilter] = useState('')
  const documents = details.documentos.filter(documento => `${documento.nome || ''} ${documento.tipo || ''}`.toLowerCase().includes(filter.toLowerCase()))
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', flexWrap: 'wrap', marginBottom: 14 }}><div><strong style={{ fontSize: 14 }}>{person.nome}</strong><p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0' }}>{person.cargo || 'Cargo não informado'} · {person.cpf || 'CPF não informado'} · <span style={{ color: C.amber }}>✉️ {person.email || 'E-mail não informado'}</span> {(person as any).telefone ? `· 📞 ${(person as any).telefone}` : ''}</p></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><button style={outlineBtn} onClick={onBack}>← Voltar</button><button style={{ ...outlineBtn, color: '#F87171' }} onClick={onDelete}><Trash2 size={12} />Excluir</button></div></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}><div><strong style={{ fontSize: 12 }}>Baú documental</strong><p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0' }}>Arquivo permanente, organizado nas quatro pastas de admissão.</p></div><input style={{ ...input, width: 210 }} placeholder="Buscar documento" value={filter} onChange={event => setFilter(event.target.value)} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 9 }}>{[1, 2, 3, 4].map(order => { 
      const etapa = details.etapas.find(item => item.modelo.ordem === order); 
      const docs = documents.filter(documento => {
        if (documento.etapa_id) {
          return etapa?.id ? documento.etapa_id === etapa.id : false;
        }
        if (documento.ordem_pasta) {
          return String(documento.ordem_pasta) === String(order);
        }
        return order === 1; // Fallback: documentos sem etapa ou ordem caem na pasta 1
      }); 
      return <article key={order} style={{ background: '#0B0C0E', border: `1px solid ${C.border}`, borderRadius: 5, padding: 11 }}><span style={{ color: C.amber, fontSize: 9, fontWeight: 900 }}>PASTA {order}</span><h4 style={{ margin: '5px 0 9px', fontSize: 11 }}>{etapa?.modelo.nome || `Etapa ${order}`}</h4>{docs.length ? docs.map(documento => <button key={documento.id} onClick={() => onOpen(documento)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderTop: `1px solid ${C.border}`, padding: '8px 0', background: 'transparent', color: C.amber, fontSize: 9, cursor: 'pointer' }}>↗ {documento.nome || 'Documento'}<span style={{ display: 'block', color: C.inkSoft, marginTop: 2 }}>{documento.status || 'Arquivado'}</span></button>) : <p style={{ color: C.inkSoft, fontSize: 9 }}>Nenhum arquivo nesta pasta.</p>}
        {onUpload && (
          <label style={{ display: 'block', width: '100%', textAlign: 'center', border: `1px dashed ${C.border}`, padding: '6px 0', background: 'transparent', color: C.inkSoft, fontSize: 9, cursor: 'pointer', marginTop: 8, borderRadius: 4 }}>
            + Anexar arquivo
            <input type="file" multiple style={{ display: 'none' }} onChange={e => {
              if (e.target.files?.length) {
                onUpload(order, e.target.files)
                e.target.value = ''
              }
            }} />
          </label>
        )}
      </article> 
    })}</div>
  </div>
}

// item_id usado para a guia do RH e laudo do candidato (compátivel com o checklist do Supabase)
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

function CadastroTable({ invite, modelos, onOpen, onReview, onApprove, onRevoke, onRegenerate, onCopy, onDelete, onRefresh, colaboradorAtivo, colaboradores = [] }: {
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
  // Guia enviada pelo RH
  const guiaRH = modeloEtapa4 ? invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && (d.item_id === GUIA_ITEM_ID || d.item_id === '__guia_rh__')) : null
  // Laudo de retorno enviado pelo candidato
  const laudoCandidato = modeloEtapa4 ? invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && (d.item_id === LAUDO_ITEM_ID || d.item_id === '__laudo_candidato__')) : null
  // Dados Bancários e PIX cadastrados pelo funcionário
  const docPix = invite.documentos.find(d => d.item_id === 'pix' || d.item_id?.includes('pix') || d.nome?.includes('PIX') || d.nome?.includes('Dados Bancários'))

  const [editPixOpen, setEditPixOpen] = useState(false)
  const [inputPix, setInputPix] = useState('')
  const [inputBanco, setInputBanco] = useState('')
  const [inputAgenciaConta, setInputAgenciaConta] = useState('')
  const [savingPix, setSavingPix] = useState(false)

  const [editEmailOpen, setEditEmailOpen] = useState(false)
  const [inputEmail, setInputEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

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
        .update({
          email_destinatario: inputEmail.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', invite.id)

      if (error) throw error
      toast('E-mail do candidato atualizado com sucesso!', 'success')
      setEditEmailOpen(false)
      await onRefresh?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar e-mail'
      toast(msg, 'error')
    } finally {
      setSavingEmail(false)
    }
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
      const msg = err instanceof Error ? err.message : 'Erro ao salvar PIX'
      toast(msg, 'error')
    } finally {
      setSavingPix(false)
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
      // Remove guia anterior se existir
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
      toast('Guia médica enviada ao candidato!', 'success')
      await onRefresh?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar guia'
      toast('Erro: ' + msg, 'error')
    } finally {
      setUploadingGuia(false)
    }
  }

  const [editIniciandoOpen, setEditIniciandoOpen] = useState(false)
  const [dataEfetivaInput, setDataEfetivaInput] = useState('')
  const [isEfetivoCheck, setIsEfetivoCheck] = useState(false)
  const [savingEfetivo, setSavingEfetivo] = useState(false)

  function openModalEfetivo() {
    setDataEfetivaInput(invite.data_inicio_efetivo || '')
    setIsEfetivoCheck(!!invite.inicio_efetivo)
    setEditIniciandoOpen(true)
  }

  async function handleSaveEfetivo() {
    setSavingEfetivo(true)
    try {
      const { error } = await supabase
        .from('rh_admissao_convites')
        .update({
          data_inicio_efetivo: dataEfetivaInput || null,
          // badge automático: true se a data estiver preenchida
          inicio_efetivo: !!dataEfetivaInput,
          updated_at: new Date().toISOString()
        })
        .eq('id', invite.id)

      if (error) throw error
      toast('Início efetivo atualizado com sucesso!', 'success')
      setEditIniciandoOpen(false)
      await onRefresh?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar início efetivo'
      toast(msg, 'error')
    } finally {
      setSavingEfetivo(false)
    }
  }

  return <div>
    {/* Cabeçalho com ações do convite */}
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'start', marginBottom: 13 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>{invite.nome_destinatario}</strong>
          {invite.inicio_efetivo && (
            <span style={{ fontSize: 9, fontWeight: 900, background: '#3B82F625', color: '#60A5FA', border: '1px solid #3B82F666', padding: '2px 6px', borderRadius: 4 }}>
              🚀 Início Efetivo na Empresa
            </span>
          )}
        </div>
        <p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: C.amber, fontWeight: 700 }}>✉️ {invite.email_destinatario || 'E-mail não informado'}</span>
          <span>·</span>
          <span>{invite.cpf ? `CPF: ${invite.cpf}` : 'CPF não informado'}</span>
          {invite.telefone_destinatario && <><span>·</span><span>📞 {invite.telefone_destinatario}</span></>}
          <span>·</span>
          <span style={{ color: C.ink, fontWeight: 700 }}>Profissão: {invite.cargo || 'Não informada'}</span>
          {invite.obra && <><span>·</span><span>Obra: <strong>{invite.obra}</strong></span></>}
          {invite.data_inicio_efetivo && (
            <>
              <span>·</span>
              <span style={{ color: '#60A5FA', fontWeight: 800 }}>
                📅 Início Efetivo: {new Date(invite.data_inicio_efetivo + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </>
          )}
        </p>
        <button style={{ ...linkButton, marginTop: 6 }} onClick={onCopy}>Copiar link do candidato</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          style={{ ...outlineBtn, borderColor: C.amber, color: C.amber }}
          onClick={openModalEfetivo}
        >
          ✏️ Alterar Início Efetivo
        </button>
        <button style={outlineBtn} onClick={onRegenerate}>Novo link</button>
        <button style={outlineBtn} onClick={onRevoke}>Revogar</button>
        <button style={{ ...outlineBtn, color: '#F87171' }} onClick={onDelete}><Trash2 size={12} />Excluir</button>
        {invite.status !== 'aprovado' && (
          <button
            style={{ ...btn, background: '#10B981', color: '#0B0C0E', fontWeight: 900, padding: '7px 12px', fontSize: 10 }}
            onClick={onApprove}
            title="Aprovar cadastro e transferir para lista de funcionários"
          >
            <CheckCircle2 size={13} /> Aprovar & Criar Funcionário
          </button>
        )}
      </div>
    </div>

    {/* MODAL REACT DE ALTERAÇÃO DE INÍCIO EFETIVO */}
    {editIniciandoOpen && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}>
        <div style={{
          background: '#12141C',
          border: `1px solid ${C.amber}`,
          borderRadius: 8,
          padding: 20,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✏️ Alterar Início Efetivo
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 16px', lineHeight: 1.4 }}>
            Informe a data de início efetivo do funcionário. O badge 🚀 é ativado automaticamente ao preencher a data.
          </p>

          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ fontSize: 11, color: C.inkSoft, display: 'block' }}>
              Data de Início Efetivo:
              <input
                type="date"
                style={{ ...input, marginTop: 6 }}
                value={dataEfetivaInput}
                onChange={e => setDataEfetivaInput(e.target.value)}
              />
              <span style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginTop: 3 }}>
                Deixe em branco para remover o início efetivo
              </span>
            </label>

            {/* Preview automático do badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11, fontWeight: 700, background: '#0B0C0E', padding: '10px 12px', borderRadius: 6, border: `1px solid ${dataEfetivaInput ? C.amber + '66' : C.border}`, color: dataEfetivaInput ? C.amber : C.inkSoft }}>
              {dataEfetivaInput ? '🚀 Badge "Início Efetivo" será ativado' : '⏸ Badge inativo — preencha a data para ativar'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button
              style={{ ...outlineBtn, fontSize: 11, padding: '8px 14px' }}
              onClick={() => setEditIniciandoOpen(false)}
              disabled={savingEfetivo}
            >
              Cancelar
            </button>
            <button
              style={{ ...btn, fontSize: 11, padding: '8px 14px' }}
              onClick={() => void handleSaveEfetivo()}
              disabled={savingEfetivo}
            >
              {savingEfetivo ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL REACT DE ALTERAÇÃO DE E-MAIL DO CANDIDATO */}
    {editEmailOpen && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#12141C', border: `1px solid ${C.amber}`, borderRadius: 8, maxWidth: 420, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✉️ E-mail do Candidato (Etapa 1)
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, lineHeight: 1.4 }}>
            Digite ou atualize o e-mail principal do candidato para a ficha de admissão.
          </p>
          <input
            style={input}
            placeholder="exemplo@email.com"
            value={inputEmail}
            onChange={e => setInputEmail(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button style={outlineBtn} onClick={() => setEditEmailOpen(false)} disabled={savingEmail}>Cancelar</button>
            <button style={{ ...btn, background: C.amber, color: '#0B0C0E' }} disabled={savingEmail} onClick={() => void handleSaveEmailRH()}>
              {savingEmail ? 'Salvando...' : 'Salvar E-mail'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ETAPA 4 — GUIA MÉDICA BIDIRECIONAL */}
    {modeloEtapa4 && (
      <div style={{ marginBottom: 14, background: '#0B0C0E', border: `1px solid ${laudoCandidato?.status === 'aprovado' ? '#22C55E55' : guiaRH ? C.amber + '44' : C.border}`, borderRadius: 6, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <MedIcon size={14} color={C.amber} />
          <strong style={{ fontSize: 11, color: C.amber }}>ETAPA 4 — GUIA DE EXAME ADMISSIONAL</strong>
        </div>

        {/* FASE 1: RH envia a guia preenchida */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.ink }}>1. Guia preenchida pelo RH <span style={{ fontSize: 8, background: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F644', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>[Empresa / RH]</span></span>
            <p style={{ fontSize: 9, color: C.inkSoft, margin: '3px 0 0' }}>
              {guiaRH ? `✓ ${guiaRH.nome} — o candidato já pode baixar no link` : 'Preencha a guia com os dados do candidato e anexe aqui.'}
            </p>
            {guiaRH && (
              <button onClick={() => onOpen(guiaRH)} style={{ ...linkButton, display: 'block', marginTop: 5, fontSize: 9 }}>↗ Abrir guia enviada</button>
            )}
          </div>
          <label style={{ ...outlineBtn, cursor: uploadingGuia ? 'wait' : 'pointer', opacity: uploadingGuia ? 0.6 : 1, borderColor: C.amber, color: C.amber, fontSize: 9, padding: '7px 10px' }}>
            <FileUp size={12} />{uploadingGuia ? 'Enviando...' : guiaRH ? 'Substituir guia' : 'Enviar guia preenchida'}
            <input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" disabled={uploadingGuia} onChange={e => void uploadGuiaMedica(e.target.files?.[0])} />
          </label>
        </div>

        {/* FASE 2: Candidato retorna o laudo */}
        <div style={{ paddingTop: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: C.ink }}>2. Laudo/Resultado retornado pelo candidato <span style={{ fontSize: 8, background: '#F59E0B20', color: C.amber, border: '1px solid #F59E0B44', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>[Funcionário]</span></span>
          {laudoCandidato ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => onOpen(laudoCandidato)} style={{ ...linkButton, fontSize: 9 }}>↗ {laudoCandidato.nome}</button>
                <span style={{ fontSize: 9, fontWeight: 800, color: laudoCandidato.status === 'aprovado' ? '#4ADE80' : laudoCandidato.status === 'devolvido' ? '#F87171' : C.amber }}>
                  {laudoCandidato.status === 'aprovado' ? '✓ Aprovado' : laudoCandidato.status === 'devolvido' ? 'Devolvido' : 'Aguardando análise'}
                </span>
              </div>
              {laudoCandidato.status !== 'aprovado' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={{ ...outlineBtn, padding: '5px 8px', fontSize: 9 }} onClick={() => onReview(laudoCandidato, 'aprovado')}>✓ Aprovar laudo</button>
                  <button style={{ ...outlineBtn, padding: '5px 8px', fontSize: 9, color: '#F87171' }} onClick={() => onReview(laudoCandidato, 'devolvido')}>Solicitar reenvio</button>
                </div>
              )}
              {laudoCandidato.observacao_rh && (
                <p style={{ fontSize: 9, color: '#F87171', marginTop: 5 }}>{laudoCandidato.observacao_rh}</p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 9, color: C.inkSoft, margin: '5px 0 0' }}>
              {guiaRH ? '⏳ Aguardando o candidato retornar com o laudo médico.' : '⚠️ Envie a guia ao candidato primeiro.'}
            </p>
          )}
        </div>
      </div>
    )}

    {/* Abas das etapas 1–3 */}
    <div style={{ display: 'grid', gridTemplateColumns: '145px minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <nav style={{ display: 'grid', gap: 6, padding: 8, background: '#0B0C0E', border: `1px solid ${C.border}`, borderRadius: 5 }}>
        {modelos.filter(m => m.ordem <= 3).slice().sort((a, b) => a.ordem - b.ordem).map(modelo => (
          <button key={modelo.id} onClick={() => setActiveFolder(modelo.ordem)} style={{ ...outlineBtn, width: '100%', justifyContent: 'flex-start', padding: '9px 10px', fontSize: 9, color: activeFolder === modelo.ordem ? C.amber : C.inkSoft, borderColor: activeFolder === modelo.ordem ? C.amber : C.border }}>
            📁 Etapa {modelo.ordem}<span style={{ marginLeft: 'auto', fontSize: 8 }}>{modelo.ordem === 2 || modelo.ordem === 3 ? 1 : modelo.checklist.length + (modelo.ordem === 1 ? 1 : 0)}</span>
          </button>
        ))}
      </nav>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 1.2fr', gap: 0, border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden' }}>
          <div style={tableHead}>Documento obrigatório</div>
          <div style={tableHead}>Arquivo recebido</div>
          <div style={tableHead}>Status</div>
          <div style={tableHead}>Ações</div>
          {modelos.filter(modelo => modelo.ordem === activeFolder).flatMap(modelo => {
            // Nas Etapas 2 e 3: Apenas 1 linha (1 documento preenchido)
            if (modelo.ordem === 2 || modelo.ordem === 3) {
              const itemUnico = modelo.checklist[0] || { id: `etapa_${modelo.ordem}`, label: modelo.nome, obrigatorio: true }
              const docs = invite.documentos.filter(d => d.modelo_id === modelo.id)
              const doc = docs[docs.length - 1]
              return [{
                key: `${modelo.id}-unico`,
                modelo,
                itemId: itemUnico.id,
                isPixItem: false,
                isEmailItem: false,
                label: `Documento Preenchido: ${modelo.nome}`,
                doc,
              }]
            }
            // Na Etapa 1: Renderiza cada item da checklist + Item de E-mail do Candidato
            const items = [
              ...modelo.checklist.map(item => {
                const docs = invite.documentos.filter(d => d.modelo_id === modelo.id && d.item_id === item.id)
                const doc = docs[docs.length - 1]
                const isPixItem = item.id === 'pix' || item.id?.includes('pix') || item.label.toLowerCase().includes('pix')
                return {
                  key: `${modelo.id}-${item.id}`,
                  modelo,
                  itemId: item.id,
                  isPixItem,
                  isEmailItem: false,
                  label: item.label + (item.obrigatorio ? ' *' : ''),
                  doc,
                }
              }),
              {
                key: `${modelo.id}-email-candidato`,
                modelo,
                itemId: 'email_destinatario',
                isPixItem: false,
                isEmailItem: true,
                label: 'E-mail do Candidato *',
                doc: null,
              }
            ]
            return items
          }).map(({ key, modelo, isPixItem, isEmailItem, label, doc }) => {
            const parsedPix = isPixItem ? parseDadosBancarios(doc?.nome) : null
            return (
              <div key={key} style={{ display: 'contents' }}>
                <div style={tableCell}>
                  <span style={{ color: C.amber, fontWeight: 900 }}>ETAPA {modelo.ordem}</span>
                  <small style={{ display: 'block', color: C.inkSoft, marginTop: 3 }}>{modelo.nome}</small>
                </div>
                <div style={tableCell}>
                  <div>{label}</div>
                  {isPixItem && (
                    <span style={{ fontSize: 8, background: '#F59E0B20', color: C.amber, border: '1px solid #F59E0B44', padding: '1px 5px', borderRadius: 3, marginTop: 4, display: 'inline-block', fontWeight: 800 }}>
                      [Caixa de Texto · Dados Bancários]
                    </span>
                  )}
                  {isEmailItem && (
                    <span style={{ fontSize: 8, background: '#F59E0B20', color: C.amber, border: '1px solid #F59E0B44', padding: '1px 5px', borderRadius: 3, marginTop: 4, display: 'inline-block', fontWeight: 800 }}>
                      [Caixa de Texto · E-mail do Candidato]
                    </span>
                  )}
                </div>
                <div style={tableCell}>
                  {isPixItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {doc && parsedPix ? (
                        <div style={{ fontSize: 11, background: '#12141C', padding: '8px 10px', borderRadius: 5, border: `1px solid ${C.amber}44`, display: 'grid', gap: 3 }}>
                          <div><span style={{ color: C.inkSoft, fontSize: 10 }}>🔑 Chave PIX: </span><strong style={{ color: C.amber }}>{parsedPix.pix || 'Não informada'}</strong></div>
                          <div><span style={{ color: C.inkSoft, fontSize: 10 }}>🏦 Banco: </span><strong style={{ color: C.ink }}>{parsedPix.banco || 'Não informado'}</strong></div>
                          <div><span style={{ color: C.inkSoft, fontSize: 10 }}>🔢 Agência/Conta: </span><strong style={{ color: C.ink }}>{parsedPix.agenciaConta || 'Não informada'}</strong></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic', background: '#0B0C0E', padding: '6px 8px', borderRadius: 4, border: `1px dashed ${C.border}` }}>
                          💬 Caixa de texto pendente (o candidato digitará pelo link ou o RH pode preencher pelo botão ao lado)
                        </div>
                      )}
                    </div>
                  ) : isEmailItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {invite.email_destinatario ? (
                        <div style={{ fontSize: 11, background: '#12141C', padding: '8px 10px', borderRadius: 5, border: `1px solid ${C.amber}44`, display: 'grid', gap: 3 }}>
                          <div><span style={{ color: C.inkSoft, fontSize: 10 }}>✉️ E-mail Cadastrado: </span><strong style={{ color: C.amber }}>{invite.email_destinatario}</strong></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic', background: '#0B0C0E', padding: '6px 8px', borderRadius: 4, border: `1px dashed ${C.border}` }}>
                          💬 E-mail pendente (o candidato digitará na Etapa 1 pelo link ou o RH pode preencher pelo botão ao lado)
                        </div>
                      )}
                    </div>
                  ) : doc ? (
                    <button onClick={() => onOpen(doc)} style={linkButton}>↗ {doc.nome}</button>
                  ) : (
                    <span style={{ color: C.inkSoft }}>Ainda não enviado</span>
                  )}
                </div>
                <div style={tableCell}>
                  <span style={{ color: (isPixItem && doc) || (isEmailItem && invite.email_destinatario) ? '#4ADE80' : doc?.status === 'aprovado' ? '#4ADE80' : doc?.status === 'devolvido' ? '#F87171' : doc ? C.amber : C.inkSoft, fontWeight: 800 }}>
                    {isPixItem && doc ? '✓ Preenchido' : isEmailItem && invite.email_destinatario ? '✓ Preenchido' : doc?.status === 'aprovado' ? 'Aprovado' : doc?.status === 'devolvido' ? 'Devolvido' : doc ? 'Aguardando análise' : 'Pendente'}
                  </span>
                  {doc?.observacao_rh && <small style={{ display: 'block', color: '#F87171', marginTop: 4 }}>{doc.observacao_rh}</small>}
                </div>
                <div style={{ ...tableCell, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {isPixItem ? (
                    <button
                      style={{ ...outlineBtn, borderColor: C.amber, color: C.amber, padding: '5px 9px', fontSize: 9, fontWeight: 800 }}
                      onClick={openModalPix}
                    >
                      ✏️ {doc ? 'Editar Caixa de Texto' : 'Preencher Caixa de Texto'}
                    </button>
                  ) : isEmailItem ? (
                    <button
                      style={{ ...outlineBtn, borderColor: C.amber, color: C.amber, padding: '5px 9px', fontSize: 9, fontWeight: 800 }}
                      onClick={openModalEmail}
                    >
                      ✏️ {invite.email_destinatario ? 'Editar E-mail' : 'Preencher E-mail'}
                    </button>
                  ) : doc ? (
                    <>
                      <button style={{ ...outlineBtn, padding: '5px 7px', fontSize: 8 }} onClick={() => onReview(doc, 'aprovado')}>Aprovar</button>
                      <button style={{ ...outlineBtn, padding: '5px 7px', fontSize: 8, color: '#F87171' }} onClick={() => onReview(doc, 'devolvido')}>Negar</button>
                    </>
                  ) : (
                    <span style={{ color: C.inkSoft, fontSize: 9 }}>Aguardando envio</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── REGISTRO DE ATIVIDADES E LOG DE ANEXOS (RH + CANDIDATO) ── */}
      <div style={{ marginTop: 14, background: '#0B0C0E', border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
          <strong style={{ fontSize: 11, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
            📜 Log de Registro & Histórico de Anexos (Rastreabilidade)
          </strong>
          <span style={{ fontSize: 9, color: C.inkSoft }}>
            {invite.documentos.length + 1} registro(s) auditado(s)
          </span>
        </div>

        <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {/* Evento 1: Criação do Convite pelo RH */}
          {(() => {
            const nomeCriador = resolveNomeCriador(invite.criado_por, colaboradores)
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '7px 9px', background: '#12141C', borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div>
                  <span style={{ fontSize: 8, background: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F644', padding: '1px 5px', borderRadius: 3, marginRight: 6, fontWeight: 800 }}>[Empresa / RH]</span>
                  <strong style={{ color: C.ink }}>Convite de Admissão Gerado</strong>
                  <span style={{ color: C.amber, fontWeight: 700, marginLeft: 6 }}>· Gerado por: {nomeCriador}</span>
                  <span style={{ color: C.inkSoft, marginLeft: 6 }}>({invite.cargo || 'Cargo n/i'}{invite.obra ? ` · Obra: ${invite.obra}` : ''})</span>
                </div>
                <span style={{ color: C.inkSoft, fontSize: 9 }}>
                  📅 {new Date(invite.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            )
          })()}

          {/* Eventos dos Documentos Enviados pelo Candidato ou pelo RH */}
          {invite.documentos.slice().sort((a, b) => new Date(b.enviado_em || b.created_at || 0).getTime() - new Date(a.enviado_em || a.created_at || 0).getTime()).map(doc => {
            const isRH = doc.item_id === '__guia_rh__' || doc.storage_path?.includes('pix') || doc.nome?.includes('Dados Bancários')
            const autorBadge = isRH ? '[Empresa / RH]' : '[Candidato / Funcionário]'
            const badgeColor = isRH ? '#3B82F6' : '#F59E0B'
            const dataAnexo = doc.enviado_em || doc.created_at || invite.created_at

            let nomeAutorAnexo = invite.nome_destinatario || 'Candidato'
            if (isRH) {
              const criador = resolveNomeCriador(invite.criado_por, colaboradores)
              if (criador !== 'Gestor RH') {
                nomeAutorAnexo = criador
              } else if (doc.observacao_rh) {
                const match = doc.observacao_rh.match(/Aprovado por (.*)/) || doc.observacao_rh.match(/\[(.*)\]:/) || doc.observacao_rh.match(/Devolvido por (.*)/)
                if (match) {
                  nomeAutorAnexo = match[1]
                } else {
                  nomeAutorAnexo = 'Gestor RH'
                }
              } else {
                nomeAutorAnexo = 'Gestor RH'
              }
            }

            return (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 10, padding: '7px 9px', background: '#12141C', borderRadius: 4, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, background: `${badgeColor}20`, color: badgeColor === '#3B82F6' ? '#60A5FA' : C.amber, border: `1px solid ${badgeColor}44`, padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                    {autorBadge}
                  </span>
                  <strong style={{ color: C.ink }}>{doc.nome}</strong>
                  <span style={{ fontSize: 9, color: C.inkSoft }}>
                    · Por: <strong style={{ color: C.ink }}>{nomeAutorAnexo}</strong>
                  </span>
                  <span style={{ fontSize: 9, color: doc.status === 'aprovado' ? '#4ADE80' : doc.status === 'devolvido' ? '#F87171' : C.amber, fontWeight: 700 }}>
                    · {doc.status === 'aprovado' ? '✓ Aprovado' : doc.status === 'devolvido' ? '⚠️ Devolvido' : '⏳ Aguardando análise'}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: C.inkSoft, textAlign: 'right' }}>
                  <div>Anexado em: <strong>{new Date(dataAnexo).toLocaleString('pt-BR')}</strong></div>
                  {doc.revisado_em && (
                    <div style={{ color: C.amber, fontSize: 8, marginTop: 2 }}>
                      {doc.observacao_rh || 'Analisado pelo RH'} em: {new Date(doc.revisado_em).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  </div>
}

const tableHead: React.CSSProperties = { background: '#16181C', color: C.inkSoft, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', padding: '9px 8px', borderBottom: `1px solid ${C.border}` }
const tableCell: React.CSSProperties = { minWidth: 0, padding: '9px 8px', borderBottom: `1px solid ${C.border}`, fontSize: 9, color: C.ink, background: '#0B0C0E' }
const linkButton: React.CSSProperties = { border: 0, background: 'transparent', color: C.amber, padding: 0, cursor: 'pointer', fontSize: 9, textAlign: 'left' }

import { useConfirm } from '@/hooks/useConfirm'
import { usePrompt } from '@/hooks/usePrompt'

export default function RhPage() {
  const { confirm, ConfirmDialog } = useConfirm()
  const { prompt, PromptDialog } = usePrompt()
  const [activeTab, setActiveTab] = useState<'ativos' | 'admissao'>('ativos')
  const [pessoas, setPessoas] = useState<Funcionario[]>([])
  const [modelos, setModelos] = useState<ModeloAdmissao[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [selectedInvite, setSelectedInvite] = useState<Convite>(null as unknown as Convite)
  const [selected, setSelected] = useState<Funcionario | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [form, setForm] = useState(emptyForm)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ nome: '', cpf: '', matricula: '', email: '', telefone: '', endereco: '', cargo: '', obra: '', data_inicio_efetivo: '', inicio_efetivo: false, validade: '72', pix: '', banco: '', agencia_conta: '' })
  const [inviteSaving, setInviteSaving] = useState(false)
  const [archiveFilter, setArchiveFilter] = useState('')

  const [buscaConvite, setBuscaConvite] = useState('')
  const [filtroStatusConvite, setFiltroStatusConvite] = useState<'todos' | 'expirados' | 'ativos' | 'aguardando' | 'devolvidos' | 'efetivos' | 'nao_efetivos'>('todos')
  const [ordemConvite, setOrdemConvite] = useState<'novo' | 'velho'>('novo')

  const [buscaPessoas, setBuscaPessoas] = useState('')
  const [ordemPessoas, setOrdemPessoas] = useState<'alfabetica' | 'novo' | 'velho'>('alfabetica')

  // Bulk selection states (Idêntico ao Financeiro)
  const [modoExportacao, setModoExportacao] = useState(false)
  const [modoExclusao, setModoExclusao] = useState(false)
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([])
  const [selectedPessoaIds, setSelectedPessoaIds] = useState<string[]>([])

  const convitesFiltrados = useMemo(() => {
    let arr = [...convites]
    if (buscaConvite.trim()) {
      const q = buscaConvite.toLowerCase()
      arr = arr.filter(c => c.nome_destinatario.toLowerCase().includes(q) || (c.cpf && c.cpf.includes(q)) || (c.cargo && c.cargo.toLowerCase().includes(q)) || (c.obra && c.obra.toLowerCase().includes(q)))
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
    } else if (filtroStatusConvite === 'nao_efetivos') {
      arr = arr.filter(c => !c.inicio_efetivo)
    }
    arr.sort((a, b) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return ordemConvite === 'novo' ? db - da : da - db
    })
    return arr
  }, [convites, buscaConvite, filtroStatusConvite, ordemConvite])

  const pessoasFiltradas = useMemo(() => {
    let arr = [...pessoas]
    if (buscaPessoas.trim()) {
      const q = buscaPessoas.toLowerCase()
      arr = arr.filter(p => p.nome.toLowerCase().includes(q) || (p.cpf && p.cpf.includes(q)) || (p.cargo && p.cargo.toLowerCase().includes(q)) || ((p as any).obra && (p as any).obra.toLowerCase().includes(q)))
    }
    arr.sort((a, b) => {
      if (ordemPessoas === 'alfabetica') return a.nome.localeCompare(b.nome)
      const da = a.data_admissao ? new Date(a.data_admissao).getTime() : 0
      const db = b.data_admissao ? new Date(b.data_admissao).getTime() : 0
      return ordemPessoas === 'novo' ? db - da : da - db
    })
    return arr
  }, [pessoas, buscaPessoas, ordemPessoas])

  const [colaboradorAtivo, setColaboradorAtivo] = useState<any>(null)
  const [colaboradores, setColaboradores] = useState<Array<{ id: string; nome: string; email?: string }>>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('colaborador_sessao')
      if (raw) {
        try { setColaboradorAtivo(JSON.parse(raw)) } catch (e) {}
      }
    }
  }, [])

  const load = useCallback(async (isBackground = false) => {
    const [{ data: peopleData, error: peopleError }, { data: modelData, error: modelError }, { data: inviteData, error: inviteError }, { data: colabsData }] = await Promise.all([
      supabase.from('funcionarios').select('*').order('nome').limit(5000),
      supabase.from('rh_modelos_admissao').select('*').eq('ativo', true).order('ordem'),
      supabase.from('rh_admissao_convites').select('*, documentos:rh_admissao_documentos(*, modelo:rh_modelos_admissao(id,ordem,nome))').neq('status', 'aprovado').order('created_at', { ascending: false }).limit(5000),
      supabase.from('colaboradores').select('*'),
    ])

    if (peopleData) setPessoas(peopleData as Funcionario[])
    if (modelData) setModelos(modelData as ModeloAdmissao[])
    if (colabsData) setColaboradores(colabsData as any[])
    if (inviteData) {
      setConvites(inviteData as Convite[])
      setSelectedInvite(current => current ? ((inviteData).find(item => item.id === current.id) as Convite | undefined) ?? (null as unknown as Convite) : (null as unknown as Convite))
    }

    if (peopleError || modelError || inviteError) {
      console.warn('RH Load warnings:', { peopleError, modelError, inviteError })
    }
  }, [])

  useRealtimeSync(load, 'rh-sync', ['funcionarios', 'rh_modelos_admissao', 'rh_admissao_convites', 'funcionario_historico', 'exames_ocupacionais'])
  useEffect(() => { load() }, [load])

  async function loadDetails(person: Funcionario) {
    setSelected(person)
    const [{ data: historico }, { data: documentos }, { data: exames }, { data: etapas, error }, { data: convitesRelacionados }] = await Promise.all([
      supabase.from('funcionario_historico').select('*').eq('funcionario_id', person.id).order('data_evento', { ascending: false }),
      supabase.from('funcionario_documentos').select('*').eq('funcionario_id', person.id).order('created_at', { ascending: false }),
      supabase.from('exames_ocupacionais').select('*').eq('funcionario_id', person.id).order('created_at', { ascending: false }),
      supabase
        .from('funcionario_admissao_etapas')
        .select('*, modelo:rh_modelos_admissao(*)')
        .eq('funcionario_id', person.id)
        .order('modelo(ordem)', { ascending: true }),
      supabase.from('rh_admissao_convites').select('id, documentos:rh_admissao_documentos(*)').eq('funcionario_id', person.id),
    ])
    if (error) toast(error.message, 'error')
    const orderedStages = ((etapas ?? []) as unknown as EtapaAdmissao[]).sort((a, b) => a.modelo.ordem - b.modelo.ordem)

    // Agrega documentos anexados durante o processo de admissão para a gaveta de arquivos do funcionário
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

    const todosDocumentos = [...(documentos ?? []), ...docsAdmissao]
    setDetails({ historico: historico ?? [], documentos: todosDocumentos, exames: exames ?? [], etapas: orderedStages })
  }

  async function save() {
    if (saving) return
    if (!form.nome.trim()) return toast('Informe o nome do funcionário.', 'error')

    // Prevenção de duplicidade por Nome ou CPF
    const nomeNorm = form.nome.trim().toLowerCase()
    const cpfNorm = form.cpf.trim().replace(/\D/g, '')
    const existente = pessoas.find(p => {
      const pNome = p.nome.trim().toLowerCase()
      const pCpf = (p.cpf || '').replace(/\D/g, '')
      return pNome === nomeNorm || (cpfNorm && pCpf && pCpf === cpfNorm)
    })
    if (existente) {
      return toast(`Já existe um funcionário cadastrado com este nome/CPF (${existente.nome}).`, 'error')
    }

    setSaving(true)
    const { data: person, error } = await supabase
      .from('funcionarios')
      .insert({ ...form, data_admissao: form.data_admissao || null })
      .select('*')
      .single()
    if (error || !person) {
      setSaving(false)
      return toast(error?.message || 'Não foi possível criar a ficha.', 'error')
    }
    if (modelos.length) {
      const { error: stageError } = await supabase.from('funcionario_admissao_etapas').insert(
      modelos.map(modelo => ({ funcionario_id: person.id, modelo_id: modelo.id, status: 'Pendente', checklist: modelo.checklist }))
      )
      if (stageError) toast(`Ficha criada, mas as etapas falharam: ${stageError.message}`, 'error')
    }
    await supabase.from('funcionario_historico').insert({
      funcionario_id: person.id,
      tipo: 'Admissão',
      descricao: 'Fluxo de admissão iniciado com quatro etapas.',
    })
    setOpen(false)
    setForm(emptyForm)
    setSaving(false)
    await load()
    await loadDetails(person as Funcionario)
    toast('Funcionário e fluxo de admissão criados.', 'success')
  }

  async function createInvite() {
    if (inviteSaving) return
    if (!inviteForm.nome.trim()) return toast('Informe o nome do candidato.', 'error')

    // Prevenção de duplicidade de convite por Nome ou CPF em andamento
    const nomeNorm = inviteForm.nome.trim().toLowerCase()
    const cpfNorm = inviteForm.cpf.trim().replace(/\D/g, '')
    const conviteExistente = convites.find(c => {
      if (['aprovado', 'revogado', 'expirado'].includes(c.status)) return false
      const cNome = c.nome_destinatario.trim().toLowerCase()
      const cCpf = (c.cpf || '').replace(/\D/g, '')
      return cNome === nomeNorm || (cpfNorm && cCpf && cCpf === cpfNorm)
    })
    if (conviteExistente) {
      return toast(`Já existe um cadastro em andamento para "${conviteExistente.nome_destinatario}".`, 'error')
    }

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return toast('Sua sessão segura do Supabase não está ativa. Por favor, faça login novamente.', 'error')
    const hours = Math.min(168, Math.max(1, Number(inviteForm.validade) || 72))
    setInviteSaving(true)
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
      inicio_efetivo: inviteForm.inicio_efetivo,
      token_hash: tokenHash,
      token_code: token,
      expires_at: expiresAt,
      status: 'ativo',
      etapa_atual: 1,
      criado_por: authData.user.id
    }).select().single()

    if (error) {
      setInviteSaving(false)
      return toast(`Não foi possível gerar o convite: ${error.message}`, 'error')
    }

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

    setInviteSaving(false)
    const link = `${window.location.origin}/admissao/${token}`
    await navigator.clipboard?.writeText(link)
    setInviteOpen(false)
    setInviteForm({ nome: '', cpf: '', matricula: '', email: '', telefone: '', endereco: '', cargo: '', obra: '', data_inicio_efetivo: '', inicio_efetivo: false, validade: '72', pix: '', banco: '', agencia_conta: '' })
    await load()
    toast(`Link criado e copiado. Expira em ${hours} hora(s).`, 'success')
  }

  async function revokeInvite(invite: Convite) {
    if (!(await confirm('Revogar Convite', `Revogar o convite de ${invite.nome_destinatario}?`, { confirmLabel: 'Revogar', confirmColor: '#EF4444' }))) return
    const { error } = await supabase.from('rh_admissao_convites').update({ status: 'revogado', revogado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', invite.id)
    if (error) return toast(error.message, 'error')
    await load()
    toast('Convite revogado.', 'success')
  }

  async function deleteInvite(invite: Convite) {
    if (!(await confirm('Excluir Cadastro', `Excluir definitivamente o cadastro de ${invite.nome_destinatario}? Os documentos enviados também serão excluídos.`, { confirmLabel: 'Excluir', confirmColor: '#EF4444' }))) return
    const paths = invite.documentos.map(documento => documento.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('rh-documentos').remove(paths)
    const { error } = await supabase.from('rh_admissao_convites').delete().eq('id', invite.id)
    if (error) return toast(error.message, 'error')
    setSelectedInvite(null as unknown as Convite)
    await load()
    toast('Cadastro temporário excluído.', 'success')
  }

  async function deleteEmployee(person: Funcionario) {
    if (!(await confirm('Excluir Funcionário', `Excluir definitivamente ${person.nome} e todos os documentos do baú? Esta ação não pode ser desfeita.`, { confirmLabel: 'Excluir', confirmColor: '#EF4444' }))) return
    const { data: documents } = await supabase.from('funcionario_documentos').select('storage_path').eq('funcionario_id', person.id)
    const paths = (documents ?? []).map(documento => documento.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('rh-documentos').remove(paths)
    const { error } = await supabase.from('funcionarios').delete().eq('id', person.id)
    if (error) return toast(error.message, 'error')
    setSelected(null)
    setDetails(emptyDetails)
    await load()
    toast('Funcionário e arquivo documental excluídos.', 'success')
  }

  async function regenerateInvite(invite: Convite) {
    const hoursStr = await prompt('Validade do novo link', { description: 'Informe o número de horas de validade do novo link:', defaultValue: '72' })
    if (hoursStr === null) return
    const hours = Number(hoursStr) || 72
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const { error } = await supabase.from('rh_admissao_convites').update({ token_hash: tokenHash, token_code: token, expires_at: new Date(Date.now() + Math.min(168, Math.max(1, hours)) * 3600000).toISOString(), status: 'ativo', revogado_em: null, updated_at: new Date().toISOString() }).eq('id', invite.id)
    if (error) return toast(error.message, 'error')
    await navigator.clipboard.writeText(`${window.location.origin}/admissao/${token}`)
    await load()
    toast('Novo link gerado e copiado.', 'success')
  }

  async function copyInviteCode(invite: Convite) {
    if (!invite.token_code) return regenerateInvite(invite)
    await navigator.clipboard.writeText(`${window.location.origin}/admissao/${invite.token_code}`)
    toast('Código e link copiados novamente.', 'success')
  }

  async function openCadastroDocument(documento: DocumentoCadastro) {
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('rh-documentos').createSignedUrl(documento.storage_path, 3600)
    if (error || !data?.signedUrl) {
      if (w) w.close()
      return toast(error?.message || 'Não foi possível abrir o documento.', 'error')
    }
    if (w) {
      w.location.href = data.signedUrl
      w.focus()
    }
  }

  async function reviewCadastroDocument(invite: Convite, documento: DocumentoCadastro, status: 'aprovado' | 'devolvido' | 'pendencia') {
    const devolvendo = status === 'devolvido' || status === 'pendencia'
    let observacao: string | null = null
    if (devolvendo) {
      observacao = await prompt('Solicitar correção', { description: 'Explique ao candidato o que precisa ser corrigido neste documento:' })
      if (observacao === null) return
      observacao = observacao.trim()
    }
    const nomeUsuario = colaboradorAtivo?.nome || 'RH'
    const obsComUsuario = devolvendo 
      ? (observacao ? `[${nomeUsuario}]: ${observacao}` : `Devolvido por ${nomeUsuario}`)
      : `Aprovado por ${nomeUsuario}`

    const { error } = await supabase.from('rh_admissao_documentos').update({ status, observacao_rh: obsComUsuario, revisado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', documento.id)
    if (error) return toast(error.message, 'error')
    await supabase.from('rh_admissao_convites').update(devolvendo ? { status: 'devolvido', justificativa_devolucao: obsComUsuario, updated_at: new Date().toISOString() } : { justificativa_devolucao: null, updated_at: new Date().toISOString() }).eq('id', invite.id)
    await load()
    toast(status === 'aprovado' ? 'Documento aprovado.' : 'Pendência enviada ao candidato.', 'success')
  }

  function checkPendingItems(invite: Convite, modelosList: ModeloAdmissao[]) {
    const pendencias: string[] = []

    if (!invite.cpf) pendencias.push('CPF do candidato não informado')
    if (!invite.email_destinatario) pendencias.push('E-mail do candidato não informado')
    if (!invite.cargo) pendencias.push('Cargo/Profissão não informada')

    modelosList.forEach(modelo => {
      if (modelo.ordem <= 3) {
        if (modelo.ordem === 2 || modelo.ordem === 3) {
          const docs = invite.documentos.filter(d => d.modelo_id === modelo.id)
          const doc = docs[docs.length - 1]
          if (!doc || doc.status !== 'aprovado') {
            pendencias.push(`Etapa ${modelo.ordem} (${modelo.nome}) pendente de envio/aprovação`)
          }
        } else {
          modelo.checklist.forEach(item => {
            if (item.id === 'pix' || item.id?.includes('pix')) {
              const docPix = invite.documentos.find(d => d.modelo_id === modelo.id && (d.item_id === 'pix' || d.storage_path?.includes('pix')))
              if (!docPix) pendencias.push('Dados Bancários / PIX pendentes')
            } else {
              const docs = invite.documentos.filter(d => d.modelo_id === modelo.id && d.item_id === item.id)
              const doc = docs[docs.length - 1]
              if (!doc) {
                if (item.obrigatorio) pendencias.push(`${item.label} (Pendente de envio)`)
              } else if (doc.status !== 'aprovado') {
                pendencias.push(`${item.label} (Aguardando aprovação do RH)`)
              }
            }
          })
        }
      }
    })

    const modeloEtapa4 = modelosList.find(m => m.ordem === 4)
    if (modeloEtapa4) {
      const laudoCandidato = invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && d.item_id !== '__guia_rh__')
      if (!laudoCandidato || laudoCandidato.status !== 'aprovado') {
        pendencias.push('Etapa 4 (Laudo de Exame Admissional não retornado/aprovado)')
      }
    }

    return pendencias
  }

  async function approveInvite(invite: Convite) {
    const pendencias = checkPendingItems(invite, modelos)

    if (pendencias.length > 0) {
      const pendenciasTexto = pendencias.map(p => `• ${p}`).join('\n')
      const mensagem = `⚠️ ATENÇÃO: O cadastro de ${invite.nome_destinatario} possui pendências incompletas:\n\n${pendenciasTexto}\n\nDeseja aprovar e criar o funcionário mesmo assim?`

      if (!(await confirm('Aprovação com Pendências Incompletas', mensagem, { confirmLabel: 'Aprovar Mesmo Assim ⚠️', confirmColor: '#F59E0B' }))) {
        return
      }
    } else {
      if (!(await confirm('Aprovar Colaborador', `Todos os documentos e dados estão completos!\n\nDeseja aprovar ${invite.nome_destinatario} e criar o funcionário definitivamente?`, { confirmLabel: '✓ Confirmar Aprovação', confirmColor: '#10B981' }))) {
        return
      }
    }
    
    // Invoca Edge Function para aprovação
    await supabase.auth.getSession()
    let funcSuccess = false
    try {
      const { data, error } = await supabase.functions.invoke('rh-admissao', { body: { action: 'approve', convite_id: invite.id } })
      if (!error && !data?.error) {
        funcSuccess = true
      }
    } catch {
      funcSuccess = false
    }

    if (!funcSuccess) {
      // Fallback direto garantido no banco de dados
      let funcId = invite.funcionario_id
      if (!funcId) {
        const { data: newFunc } = await supabase.from('funcionarios').insert({
          nome: invite.nome_destinatario,
          cpf: invite.cpf,
          matricula: invite.matricula,
          cargo: invite.cargo,
          email: invite.email_destinatario,
          telefone: invite.telefone_destinatario,
          endereco: invite.endereco,
          data_admissao: invite.data_inicio_efetivo || new Date().toISOString().split('T')[0]
        }).select('id').single()

        if (newFunc) funcId = newFunc.id
      }

      await supabase.from('rh_admissao_convites').update({
        status: 'aprovado',
        aprovado_em: new Date().toISOString(),
        funcionario_id: funcId || null,
        updated_at: new Date().toISOString()
      }).eq('id', invite.id)
    }

    setSelectedInvite(null as unknown as Convite)
    await load()
    toast(`Cadastro de ${invite.nome_destinatario} aprovado e transferido para a lista de Funcionários com sucesso!`, 'success')
  }

  async function updateStage(stage: EtapaAdmissao, status: EtapaStatus) {
    const now = new Date().toISOString()
    const patch = {
      status,
      iniciado_em: stage.iniciado_em || now,
      concluido_em: status === 'Concluída' ? now : null,
      updated_at: now,
    }
    const { error } = await supabase.from('funcionario_admissao_etapas').update(patch).eq('id', stage.id)
    if (error) return toast(error.message, 'error')
    if (selected) await loadDetails(selected)
    toast(`Etapa atualizada para “${status}”.`, 'success')
  }

  async function toggleChecklist(stage: EtapaAdmissao, itemId: string) {
    const checklist = (stage.checklist ?? []).map(item => item.id === itemId ? { ...item, concluido: !item.concluido } : item)
    const requiredPending = checklist.some(item => item.obrigatorio && !item.concluido)
    const nextStatus: EtapaStatus = requiredPending
      ? (stage.status === 'Pendente' ? 'Em preenchimento' : stage.status)
      : (stage.status === 'Em preenchimento' || stage.status === 'Pendente' ? 'Aguardando conferência' : stage.status)
    const { error } = await supabase.from('funcionario_admissao_etapas').update({ checklist, status: nextStatus, iniciado_em: stage.iniciado_em || new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', stage.id)
    if (error) return toast(error.message, 'error')
    if (selected) await loadDetails(selected)
  }

  async function uploadDocuments(stage: EtapaAdmissao, files: FileList | null) {
    if (!selected || !files?.length) return
    setUploading(stage.id)
    let uploaded = 0
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) {
        toast(`${file.name} ultrapassa o limite de 15 MB.`, 'error')
        continue
      }
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const path = `${selected.id}/${stage.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('rh-documentos').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (uploadError) {
        toast(`Falha ao enviar ${file.name}: ${uploadError.message}`, 'error')
        continue
      }
      const { error: rowError } = await supabase.from('funcionario_documentos').insert({
        funcionario_id: selected.id,
        etapa_id: stage.id,
        tipo: 'Admissão',
        nome: file.name,
        arquivo_url: path,
        storage_path: path,
        tamanho_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
        status: 'Recebido',
      })
      if (rowError) {
        await supabase.storage.from('rh-documentos').remove([path])
        toast(`Arquivo enviado, mas não foi vinculado: ${rowError.message}`, 'error')
        continue
      }
      uploaded += 1
    }
    setUploading(null)
    if (uploaded) {
      toast(`${uploaded} documento(s) capturado(s) em ${stage.modelo.nome}.`, 'success')
      await loadDetails(selected)
    }
  }

  async function openDocument(documento: Record<string, string | null>) {
    const path = documento.storage_path || documento.arquivo_url
    if (!path) return toast('Este registro ainda não possui arquivo.', 'error')
    
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('rh-documentos').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      if (w) w.close()
      return toast(error?.message || 'Não foi possível abrir o arquivo.', 'error')
    }
    if (w) {
      w.location.href = data.signedUrl
      w.focus()
    }
  }

  async function addHistory() {
    if (!selected) return
    let descricao = await prompt('Adicionar histórico', { description: 'Descrição do evento no histórico:' })
    if (descricao === null) return
    descricao = descricao.trim()
    if (!descricao) return
    const { error } = await supabase.from('funcionario_historico').insert({ funcionario_id: selected.id, tipo: 'Registro', descricao })
    if (error) return toast(error.message, 'error')
    await loadDetails(selected)
  }

  async function addDocument() {
    if (!selected) return
    let nome = await prompt('Adicionar documento extra', { description: 'Nome do documento:' })
    if (nome === null) return
    nome = nome.trim()
    if (!nome) return
    const { error } = await supabase.from('funcionario_documentos').insert({ funcionario_id: selected.id, tipo: 'Documento', nome, status: 'Pendente' })
    if (error) return toast(error.message, 'error')
    await loadDetails(selected)
  }

  async function uploadToArchiveFolder(order: number, files: FileList) {
    if (!selected || !files.length) return
    let etapa = details.etapas.find(item => item.modelo.ordem === order)
    
    let etapaId = etapa?.id
    if (!etapaId) {
      const modelo = modelos.find(m => m.ordem === order)
      if (modelo) {
        const { data: newStage } = await supabase.from('funcionario_admissao_etapas')
          .insert({ funcionario_id: selected.id, modelo_id: modelo.id, status: 'Pendente', checklist: modelo.checklist })
          .select('id').single()
        if (newStage) etapaId = newStage.id
      }
    }

    setUploading(order.toString())
    let uploaded = 0
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) {
        toast(`${file.name} ultrapassa o limite de 15 MB.`, 'error')
        continue
      }
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const path = `${selected.id}/archive-${order}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('rh-documentos').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (uploadError) {
        toast(`Falha ao enviar ${file.name}: ${uploadError.message}`, 'error')
        continue
      }
      
      const { error: rowError } = await supabase.from('funcionario_documentos').insert({
        funcionario_id: selected.id,
        etapa_id: etapaId || null,
        tipo: 'Documento Adicional',
        nome: file.name,
        arquivo_url: path,
        storage_path: path,
        tamanho_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
        status: 'Recebido'
      })
      if (rowError) {
        toast(`Falha no banco: ${rowError.message}`, 'error')
        continue
      }
      uploaded++
    }
    setUploading(null)
    if (uploaded) {
      toast(`${uploaded} arquivo(s) anexado(s) à Pasta ${order}.`, 'success')
      await loadDetails(selected)
    }
  }

  async function addExam() {
    if (!selected) return
    let tipo = await prompt('Adicionar exame', { description: 'Tipo do exame (ex: admissional, periódico, demissional):' })
    if (tipo === null) return
    tipo = tipo.trim()
    if (!tipo) return
    const { error } = await supabase.from('exames_ocupacionais').insert({ funcionario_id: selected.id, tipo, status: 'A agendar' })
    if (error) return toast(error.message, 'error')
    await loadDetails(selected)
  }

  const exportarFuncionarios = (tipo: 'todos' | 'filtrados' | 'selecionados' = 'todos', formato: 'csv' | 'xlsx' = 'csv') => {
    let targetInvites: Convite[] = []
    let targetPessoas: Funcionario[] = []

    if (tipo === 'selecionados') {
      targetInvites = convites.filter(c => selectedInviteIds.includes(c.id))
      targetPessoas = pessoas.filter(p => selectedPessoaIds.includes(p.id))
    } else if (tipo === 'filtrados') {
      targetInvites = convitesFiltrados
      targetPessoas = pessoasFiltradas
    } else {
      targetInvites = convites
      targetPessoas = pessoas
    }

    if (targetInvites.length === 0 && targetPessoas.length === 0) {
      toast('Nenhum registro selecionado para exportar.', 'error')
      return
    }

    const rows: string[][] = []
    const headers = [
      'Nome Completo',
      'CPF',
      'Matrícula',
      'Cargo',
      'Obra / Local',
      'Situação no Sistema',
      'E-mail',
      'Telefone',
      'Endereço',
      'Data Admissão / Início',
      'Chave PIX / Dados Bancários'
    ]

    targetInvites.forEach(c => {
      const docPix = c.documentos?.find(d => d.item_id === 'pix' || d.nome?.includes('PIX') || d.nome?.includes('Dados Bancários'))
      const dadosBancarios = docPix?.nome || ''
      const expired = new Date(c.expires_at).getTime() <= Date.now() && ['ativo', 'em_preenchimento'].includes(c.status)
      const situacao = c.inicio_efetivo
        ? 'Efetivado em Campo (Sem Registro)'
        : expired
        ? 'Link Expirado'
        : c.status === 'aguardando_aprovacao'
        ? 'Aguardando Aprovação RH'
        : c.status === 'em_preenchimento'
        ? `Preenchendo Etapa ${c.etapa_atual}/4`
        : 'Em Admissão'

      rows.push([
        `"${(c.nome_destinatario || '').replace(/"/g, '""')}"`,
        `"${(c.cpf || '').replace(/"/g, '""')}"`,
        `"${(c.matricula || '').replace(/"/g, '""')}"`,
        `"${(c.cargo || '').replace(/"/g, '""')}"`,
        `"${(c.obra || '').replace(/"/g, '""')}"`,
        `"${situacao}"`,
        `"${(c.email_destinatario || '').replace(/"/g, '""')}"`,
        `"${(c.telefone_destinatario || '').replace(/"/g, '""')}"`,
        `"${(c.endereco || '').replace(/"/g, '""')}"`,
        `"${c.data_admissao || c.data_inicio_efetivo || ''}"`,
        `"${dadosBancarios.replace(/"/g, '""')}"`
      ])
    })

    targetPessoas.forEach(p => {
      const jaExiste = targetInvites.some(c => c.funcionario_id === p.id || (c.cpf && p.cpf && c.cpf.replace(/\D/g, '') === p.cpf.replace(/\D/g, '')))
      if (!jaExiste) {
        rows.push([
          `"${(p.nome || '').replace(/"/g, '""')}"`,
          `"${(p.cpf || '').replace(/"/g, '""')}"`,
          `"${(p.matricula || '').replace(/"/g, '""')}"`,
          `"${(p.cargo || '').replace(/"/g, '""')}"`,
          '""',
          `"${p.status || 'Ativo'}"`,
          `"${(p.email || '').replace(/"/g, '""')}"`,
          '""',
          '""',
          `"${p.data_admissao || ''}"`,
          '""'
        ])
      }
      }
    })

    if (formato === 'xlsx') {
      // Remove as aspas duplas dos campos para o Excel e cria array 2D
      const dataXLSX = [
        headers,
        ...rows.map(row => row.map(cell => {
          if (cell === '""') return ''
          if (cell.startsWith('"') && cell.endsWith('"')) return cell.slice(1, -1)
          return cell
        }))
      ]
      const ws = XLSX.utils.aoa_to_sheet(dataXLSX)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório RH')
      XLSX.writeFile(wb, `relatorio_rh_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } else {
      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio_rh_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    setModoExportacao(false)
    toast(`${rows.length} registro(s) exportado(s) com sucesso!`, 'success')
  }

  async function excluirEmMassa(tipo: 'selecionados' | 'filtrados' | 'todos') {
    let targetInvites: Convite[] = []
    let targetPessoas: Funcionario[] = []

    const temFiltroAtivo = !!buscaConvite.trim() || !!buscaPessoas.trim() || filtroStatusConvite !== 'todos'

    if (tipo === 'selecionados') {
      targetInvites = convites.filter(c => selectedInviteIds.includes(c.id))
      targetPessoas = pessoas.filter(p => selectedPessoaIds.includes(p.id))
    } else if (tipo === 'filtrados' || temFiltroAtivo) {
      targetInvites = convitesFiltrados
      targetPessoas = pessoasFiltradas
    } else {
      targetInvites = convites
      targetPessoas = pessoas
    }

    const total = targetInvites.length + targetPessoas.length
    if (total === 0) {
      toast('Nenhum registro selecionado para excluir.', 'error')
      return
    }

    const mensgDesc = (tipo === 'filtrados' || temFiltroAtivo)
      ? `Tem certeza que deseja excluir os ${total} registro(s) FILTRADOS NA TELA (${targetInvites.length} convite(s) e ${targetPessoas.length} funcionário(s))?`
      : `Tem certeza que deseja excluir permanentemente TODOS os ${total} registro(s) do sistema (${targetInvites.length} convite(s) e ${targetPessoas.length} funcionário(s))? Esta ação não pode ser desfeita.`

    const ok = await confirm('Excluir Registros', mensgDesc, {
      confirmLabel: `Excluir ${total} registro(s)`,
      confirmColor: '#EF4444'
    })
    if (!ok) return

    let deletedCount = 0
    if (targetInvites.length > 0) {
      const ids = targetInvites.map(c => c.id)
      const { error } = await supabase.from('rh_admissao_convites').delete().in('id', ids)
      if (!error) deletedCount += targetInvites.length
    }
    if (targetPessoas.length > 0) {
      const ids = targetPessoas.map(p => p.id)
      const { error } = await supabase.from('funcionarios').delete().in('id', ids)
      if (!error) deletedCount += targetPessoas.length
    }

    setSelectedInviteIds([])
    setSelectedPessoaIds([])
    setModoExclusao(false)
    await load()
    toast(`${deletedCount} registro(s) excluído(s) com sucesso!`, 'success')
  }

  const completed = useMemo(() => details.etapas.filter(etapa => etapa.status === 'Concluída' || etapa.status === 'Dispensada').length, [details.etapas])
  const progress = details.etapas.length ? Math.round((completed / details.etapas.length) * 100) : 0
  const selectedInviteForRender = selectedInvite as Convite
  const selectedPersonForRender = selected as Funcionario

  if (false && Boolean(selected)) {
    const archivePerson = selected as Funcionario
    const documentos = details.documentos.filter(documento => {
      const text = `${documento.nome || ''} ${documento.tipo || ''}`.toLowerCase()
      return !archiveFilter.trim() || text.includes(archiveFilter.toLowerCase())
    })
    return <>
      <PageTitle modulo="Arquivo de RH" titulo="Documentos do funcionário" />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div><strong>{archivePerson.nome}</strong><p style={{ color: C.inkSoft, fontSize: 11, margin: '4px 0 0' }}>{archivePerson.cargo || 'Cargo não informado'} · {archivePerson.cpf || 'CPF não informado'}</p></div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><button style={outlineBtn} onClick={() => { setSelected(null); setDetails(emptyDetails); setArchiveFilter('') }}>← Voltar para funcionários</button><button style={{ ...outlineBtn, color: '#F87171' }} onClick={() => void deleteEmployee(archivePerson)}><Trash2 size={12} />Excluir funcionário</button></div>
      </div>
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}><div><strong style={{ fontSize: 12 }}>Baú documental</strong><p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0' }}>Arquivo definitivo para consulta futura. Nenhuma etapa de admissão é alterada aqui.</p></div><input style={{ ...input, width: 220 }} placeholder="Buscar documento" value={archiveFilter} onChange={event => setArchiveFilter(event.target.value)} /></div>
        {documentos.length ? <div style={{ display: 'grid', gap: 7 }}>{documentos.map(documento => { const etapa = details.etapas.find(item => item.id === documento.etapa_id); return <div key={documento.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 5, background: '#0B0C0E', padding: '10px 12px' }}><div><strong style={{ fontSize: 10 }}>{documento.nome || 'Documento sem nome'}</strong><div style={{ color: C.inkSoft, fontSize: 9, marginTop: 3 }}>{etapa?.modelo.nome || documento.tipo || 'Arquivo'} · {documento.status || 'Arquivado'}</div></div><button style={{ ...outlineBtn, padding: '6px 9px', fontSize: 9 }} onClick={() => void openDocument(documento)}>Abrir documento</button></div> })}</div> : <p style={{ color: C.inkSoft, fontSize: 11 }}>Nenhum documento arquivado para este funcionário.</p>}
      </section>
    </>
  }

  return (
    <>
      <PageTitle modulo="Pessoas" titulo="Gestão de RH" />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <p style={{ color: C.inkSoft, fontSize: 12, margin: 0 }}>Admissão em quatro etapas, ficha de registro, histórico, documentos e exames ocupacionais.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (modoExportacao) {
                setModoExportacao(false)
                setSelectedInviteIds([])
                setSelectedPessoaIds([])
              } else {
                setModoExportacao(true)
                setModoExclusao(false)
                setSelectedInviteIds([])
                setSelectedPessoaIds([])
              }
            }}
            style={{
              ...btn,
              background: modoExportacao ? '#EF4444' : 'transparent',
              color: modoExportacao ? '#FFFFFF' : '#34D399',
              border: `1px solid ${modoExportacao ? '#EF4444' : '#34D39966'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <FileSpreadsheet size={14} /> {modoExportacao ? 'Cancelar Exportação' : 'Exportar Excel'}
          </button>

          <button
            onClick={() => {
              if (modoExclusao) {
                setModoExclusao(false)
                setSelectedInviteIds([])
                setSelectedPessoaIds([])
              } else {
                setModoExclusao(true)
                setModoExportacao(false)
                setSelectedInviteIds([])
                setSelectedPessoaIds([])
              }
            }}
            style={{
              ...btn,
              background: modoExclusao ? '#EF4444' : 'transparent',
              color: modoExclusao ? '#FFFFFF' : '#F87171',
              border: `1px solid ${modoExclusao ? '#EF4444' : '#F8717166'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Trash2 size={14} /> {modoExclusao ? 'Cancelar Exclusão' : 'Excluir em Massa'}
          </button>

          <button style={outlineBtn} onClick={() => setInviteOpen(value => !value)}>
            <ClipboardPlus size={14} /> Gerar link de admissão
          </button>
        </div>
      </div>

      {/* ── CARD DE AÇÃO: MODO EXPORTAÇÃO (Igual ao Financeiro) ── */}
      {modoExportacao && (
        <div style={{
          background: '#1A1D26',
          border: `1px solid ${C.amber}`,
          borderRadius: 8,
          padding: '12px 18px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileSpreadsheet size={16} /> Modo Exportação Ativo
            </span>
            <span style={{ fontSize: 12, color: C.ink, fontWeight: 700, background: 'rgba(245, 158, 11, 0.1)', padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.amber}44` }}>
              {selectedInviteIds.length + selectedPessoaIds.length} selecionado(s) de {convitesFiltrados.length + pessoasFiltradas.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const totalVisiveis = convitesFiltrados.length + pessoasFiltradas.length
                const todosMarcados = (selectedInviteIds.length + selectedPessoaIds.length) === totalVisiveis
                if (todosMarcados) {
                  setSelectedInviteIds([])
                  setSelectedPessoaIds([])
                } else {
                  setSelectedInviteIds(convitesFiltrados.map(c => c.id))
                  setSelectedPessoaIds(pessoasFiltradas.map(p => p.id))
                }
              }}
              style={{ ...outlineBtn, padding: '7px 14px', fontSize: 11, color: C.ink }}
            >
              {(selectedInviteIds.length + selectedPessoaIds.length) === (convitesFiltrados.length + pessoasFiltradas.length)
                ? 'Desmarcar Todos'
                : `Selecionar Todos (${convitesFiltrados.length + pessoasFiltradas.length})`}
            </button>

            {selectedInviteIds.length + selectedPessoaIds.length > 0 && (
              <>
                <button
                  onClick={() => exportarFuncionarios('selecionados', 'csv')}
                  style={{ ...btn, background: '#34D399', color: '#0B0C0E', padding: '7px 16px', fontSize: 11 }}
                >
                  Baixar Selecionados CSV ({selectedInviteIds.length + selectedPessoaIds.length}) 📥
                </button>
                <button
                  onClick={() => exportarFuncionarios('selecionados', 'xlsx')}
                  style={{ ...btn, background: '#10B981', color: '#0B0C0E', padding: '7px 16px', fontSize: 11 }}
                >
                  Baixar Selecionados Excel ({selectedInviteIds.length + selectedPessoaIds.length}) 📊
                </button>
              </>
            )}

            <button
              onClick={() => exportarFuncionarios('filtrados', 'csv')}
              style={{ ...btn, background: C.amber, color: '#0B0C0E', padding: '7px 16px', fontSize: 11 }}
              title="Baixar todos visíveis em CSV"
            >
              Baixar Filtrados CSV ({convitesFiltrados.length + pessoasFiltradas.length}) 📥
            </button>
            <button
              onClick={() => exportarFuncionarios('filtrados', 'xlsx')}
              style={{ ...btn, background: '#F59E0B', color: '#0B0C0E', padding: '7px 16px', fontSize: 11 }}
              title="Baixar todos visíveis em Excel"
            >
              Baixar Filtrados Excel ({convitesFiltrados.length + pessoasFiltradas.length}) 📊
            </button>
          </div>
        </div>
      )}

      {/* ── CARD DE AÇÃO: MODO EXCLUSÃO EM MASSA (Igual ao Financeiro) ── */}
      {modoExclusao && (
        <div style={{
          background: '#1A1D26',
          border: '1px solid #EF4444',
          borderRadius: 8,
          padding: '12px 18px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#F87171', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={16} /> Modo Exclusão em Massa Ativo
            </span>
            <span style={{ fontSize: 12, color: '#F87171', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '3px 10px', borderRadius: 4, border: '1px solid #EF444444' }}>
              {selectedInviteIds.length + selectedPessoaIds.length} selecionado(s) de {convitesFiltrados.length + pessoasFiltradas.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const totalVisiveis = convitesFiltrados.length + pessoasFiltradas.length
                const todosMarcados = (selectedInviteIds.length + selectedPessoaIds.length) === totalVisiveis
                if (todosMarcados) {
                  setSelectedInviteIds([])
                  setSelectedPessoaIds([])
                } else {
                  setSelectedInviteIds(convitesFiltrados.map(c => c.id))
                  setSelectedPessoaIds(pessoasFiltradas.map(p => p.id))
                }
              }}
              style={{ ...outlineBtn, padding: '7px 14px', fontSize: 11, color: C.ink }}
            >
              {(selectedInviteIds.length + selectedPessoaIds.length) === (convitesFiltrados.length + pessoasFiltradas.length)
                ? 'Desmarcar Todos'
                : `Selecionar Todos (${convitesFiltrados.length + pessoasFiltradas.length})`}
            </button>

            {selectedInviteIds.length + selectedPessoaIds.length > 0 && (
              <button
                onClick={() => void excluirEmMassa('selecionados')}
                style={{ ...btn, background: '#EF4444', color: '#FFFFFF', padding: '7px 16px', fontSize: 11 }}
              >
                Excluir Selecionados ({selectedInviteIds.length + selectedPessoaIds.length}) 🗑️
              </button>
            )}

            <button
              onClick={() => void excluirEmMassa('filtrados')}
              style={{ ...btn, background: '#DC2626', color: '#FFFFFF', padding: '7px 16px', fontSize: 11 }}
              title="Excluir todos os funcionários e candidatos visíveis no filtro atual"
            >
              Excluir Todos os Filtrados ({convitesFiltrados.length + pessoasFiltradas.length}) ⚠️
            </button>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div style={{ ...card, marginBottom: 14 }}>
          <strong style={{ fontSize: 12 }}>Pré-cadastro e convite temporário</strong>
          <p style={{ color: C.inkSoft, fontSize: 10, margin: '6px 0 12px' }}>Preencha os dados que o RH já possui. O candidato receberá o link apenas para enviar os documentos das quatro etapas.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {([
              ['nome', 'Nome do candidato *'], ['cpf', 'CPF'], ['matricula', 'Matrícula'],
              ['email', 'E-mail'], ['telefone', 'Telefone'], ['endereco', 'Endereço'],
              ['cargo', 'Cargo / Profissão'], ['obra', 'Obra'],
              ['pix', 'Chave PIX (opcional)'], ['banco', 'Banco (opcional)'], ['agencia_conta', 'Agência e Conta (opcional)']
            ] as const).map(([key, placeholder]) => (
              <input
                key={key}
                style={input}
                placeholder={placeholder}
                value={inviteForm[key as keyof typeof inviteForm] as string || ''}
                onChange={event => setInviteForm({ ...inviteForm, [key]: event.target.value })}
              />
            ))}
            <label style={{ fontSize: 10, color: C.inkSoft }}>
              Data de início efetivo
              {inviteForm.data_inicio_efetivo && (
                <span style={{ marginLeft: 6, fontSize: 10, color: C.amber, fontWeight: 700 }}>🚀 badge ativo</span>
              )}
              <input
                style={{ ...input, marginTop: 4 }}
                type="date"
                value={inviteForm.data_inicio_efetivo}
                onChange={event => setInviteForm({
                  ...inviteForm,
                  data_inicio_efetivo: event.target.value,
                  // badge automático ao preencher a data
                  inicio_efetivo: !!event.target.value
                })}
              />
              <span style={{ fontSize: 9, color: C.inkSoft, display: 'block', marginTop: 3 }}>Ao preencher a data, o badge 🚀 Início Efetivo é ativado automaticamente</span>
            </label>
            <label style={{ fontSize: 10, color: C.inkSoft }}>Validade do link (horas)<input style={{ ...input, marginTop: 4 }} type="number" min={1} max={168} value={inviteForm.validade} onChange={event => setInviteForm({ ...inviteForm, validade: event.target.value })} /></label>
          </div>
          <button disabled={inviteSaving} style={{ ...btn, marginTop: 12, opacity: inviteSaving ? 0.6 : 1 }} onClick={() => void createInvite()}><ClipboardPlus size={14} />{inviteSaving ? 'Gerando...' : 'Gerar e copiar link'}</button>
        </div>
      )}

      {false && convites.length > 0 && (
        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><strong style={{ fontSize: 12 }}>Em cadastro</strong><span style={{ color: C.inkSoft, fontSize: 10 }}>{convites.length} pessoas aguardando documentação/aprovação</span></div>
          <div style={{ display: 'grid', gap: 7 }}>
            {convites.map(invite => {
              const expired = new Date(invite.expires_at).getTime() <= Date.now() && ['ativo', 'em_preenchimento'].includes(invite.status)
              const status = invite.status === 'revogado' ? 'Revogado' : expired ? 'Expirado' : invite.status === 'aguardando_aprovacao' ? 'Aguardando aprovação do RH' : invite.status === 'em_preenchimento' ? `Enviando documentos · etapa ${invite.etapa_atual}/4` : 'Link gerado · ainda não acessado'
              const sent = invite.documentos.filter(documento => ['enviado', 'aprovado'].includes(documento.status)).length
              return <button key={invite.id} onClick={() => setSelectedInvite(invite)} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: 10, alignItems: 'center', padding: '10px', background: selectedInvite?.id === invite.id ? '#F59E0B12' : '#0B0C0E', color: C.ink, border: `1px solid ${selectedInvite?.id === invite.id ? '#F59E0B66' : C.border}`, borderRadius: 5, fontSize: 10, textAlign: 'left', cursor: 'pointer' }}><div><strong>{invite.nome_destinatario}</strong><div style={{ color: C.inkSoft, marginTop: 3 }}>{invite.cargo || 'Cargo não informado'}{invite.obra ? ` · ${invite.obra}` : ''}</div></div><div style={{ color: C.inkSoft }}>{sent} documento(s)<br />Etapa {invite.etapa_atual} de 4</div><div><span style={{ color: expired || invite.status === 'revogado' ? '#F87171' : invite.status === 'aguardando_aprovacao' ? '#4ADE80' : C.amber, fontWeight: 800 }}>{status}</span><div style={{ color: C.inkSoft, marginTop: 3 }}>Expira {new Date(invite.expires_at).toLocaleString('pt-BR')}</div></div><span style={{ color: C.amber }}>Abrir →</span></button>
            })}
          </div>
        </section>
      )}

      {false && selectedInvite && <section style={{ ...card, marginBottom: 14 }}><CadastroTable invite={selectedInvite} modelos={modelos} onOpen={documento => void openCadastroDocument(documento)} onReview={(documento, status) => void reviewCadastroDocument(selectedInvite, documento, status)} onApprove={() => void approveInvite(selectedInvite)} onRevoke={() => void revokeInvite(selectedInvite)} onRegenerate={() => void regenerateInvite(selectedInvite)} onCopy={() => void copyInviteCode(selectedInvite)} onDelete={() => void deleteInvite(selectedInvite)} /></section>}

      {convites.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 14, alignItems: 'start' }}>
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 12 }}>Em cadastro</strong>
            <span style={{ color: C.inkSoft, fontSize: 10 }}>{convitesFiltrados.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input style={{...input, flex: 1, minWidth: 140}} placeholder="Buscar candidato (nome, CPF, cargo)..." value={buscaConvite} onChange={e => setBuscaConvite(e.target.value)} />
            <select style={{...input, width: 'auto'}} value={filtroStatusConvite} onChange={e => setFiltroStatusConvite(e.target.value as any)}>
              <option value="todos">Todos os status</option>
              <option value="expirados">⏰ Expirados</option>
              <option value="ativos">🟢 Ativos / Em Preenchimento</option>
              <option value="aguardando">⏳ Aguardando aprovação</option>
              <option value="devolvidos">⚠️ Devolvidos / Correção</option>
              <option value="efetivos">🚀 Com Início Efetivo</option>
              <option value="nao_efetivos">Sem Início Efetivo</option>
            </select>
            <select style={{...input, width: 'auto'}} value={ordemConvite} onChange={e => setOrdemConvite(e.target.value as any)}>
              <option value="novo">Mais novos primeiro</option>
              <option value="velho">Mais antigos primeiro</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {convitesFiltrados.map(invite => {
              const expired = new Date(invite.expires_at).getTime() <= Date.now() && ['ativo', 'em_preenchimento'].includes(invite.status);
              const label = invite.status === 'devolvido' ? 'Devolvido' : invite.status === 'revogado' ? 'Revogado' : expired ? 'Expirado' : invite.status === 'aguardando_aprovacao' ? 'Aguardando aprovação' : invite.status === 'em_preenchimento' ? `Etapa ${invite.etapa_atual}/4` : 'Link gerado';
              const isChecked = selectedInviteIds.includes(invite.id);
              const exibirCheckbox = modoExportacao || modoExclusao || selectedInviteIds.length > 0 || selectedPessoaIds.length > 0;
              return (
                <div key={invite.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {exibirCheckbox && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        e.stopPropagation()
                        setSelectedInviteIds(prev => prev.includes(invite.id) ? prev.filter(x => x !== invite.id) : [...prev, invite.id])
                      }}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.amber, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <button
                      onClick={() => setSelectedInvite(selectedInvite?.id === invite.id ? (null as unknown as Convite) : invite)}
                      style={{
                        width: '100%',
                        display: 'block',
                        textAlign: 'left',
                        padding: '12px 13px',
                        background: selectedInvite?.id === invite.id ? '#F59E0B18' : '#0B0C0E',
                    color: C.ink,
                    border: `1px solid ${selectedInvite?.id === invite.id ? '#F59E0B66' : invite.inicio_efetivo ? '#3B82F6AA' : C.border}`,
                    borderBottomColor: selectedInvite?.id === invite.id ? 'transparent' : undefined,
                    borderRadius: 5,
                    borderBottomLeftRadius: selectedInvite?.id === invite.id ? 0 : 5,
                    borderBottomRightRadius: selectedInvite?.id === invite.id ? 0 : 5,
                    cursor: 'pointer',
                    minHeight: 78,
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.nome_destinatario}</strong>
                    {invite.inicio_efetivo && (
                      <span style={{ fontSize: 9, fontWeight: 900, background: '#3B82F625', color: '#60A5FA', border: '1px solid #3B82F666', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        🚀 Início Efetivo
                      </span>
                    )}
                  </div>
                  <div style={{ color: C.inkSoft, fontSize: 10, marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(() => {
                      const nomeGerador = resolveNomeCriador(invite.criado_por, colaboradores)
                      return (
                        <span style={{ color: C.amber, fontWeight: 700 }}>👤 Gerado por: {nomeGerador}</span>
                      )
                    })()}
                    <span>·</span>
                    <span style={{ color: C.amber, fontWeight: 700 }}>✉️ {invite.email_destinatario || 'E-mail não informado'}</span>
                    <span>·</span>
                    <span style={{ color: C.ink, fontWeight: 700 }}>Profissão: {invite.cargo || 'Não informada'}</span>
                    {invite.obra && <span>· Obra: <strong>{invite.obra}</strong></span>}
                    {invite.data_inicio_efetivo && (
                      <span style={{ color: '#60A5FA', fontWeight: 800 }}>
                        · Início Efetivo: {new Date(invite.data_inicio_efetivo + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const docPix = invite.documentos?.find(d => d.item_id === 'pix' || d.item_id?.includes('pix') || d.nome?.includes('PIX') || d.nome?.includes('Dados Bancários'))
                    if (!docPix) return null
                    return (
                      <div style={{ fontSize: 9, color: C.amber, fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        💳 {docPix.nome}
                      </div>
                    )
                  })()}
                  {(() => {
                    const msLeft = new Date(invite.expires_at).getTime() - Date.now()
                    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60))
                    const minLeft = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))
                    let timeLeftStr = ''
                    if (msLeft > 0) {
                      timeLeftStr = hoursLeft > 0 ? `${hoursLeft}h ${minLeft}m restantes` : `${minLeft}m restantes`
                    }

                    return (
                      <div style={{ color: invite.status === 'devolvido' || expired ? '#F87171' : C.amber, fontSize: 10, fontWeight: 800, marginTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {expired && <AlertTriangle size={12} />}
                          {label}
                          {msLeft > 0 && ['ativo', 'em_preenchimento'].includes(invite.status) && (
                            <span style={{ color: C.inkSoft, fontWeight: 500 }}>· ⏳ {timeLeftStr}</span>
                          )}
                        </div>
                        {['ativo', 'em_preenchimento', 'revogado'].includes(invite.status) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); void regenerateInvite(invite) }} 
                            style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.ink, borderRadius: 4, padding: '3px 8px', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                            title="Prorrogar tempo do link"
                          >
                            <Clock size={10} /> Prorrogar
                          </button>
                        )}
                      </div>
                    )
                  })()}
                  {invite.status === 'devolvido' && invite.justificativa_devolucao && (
                    <div style={{ color: '#FCA5A5', fontSize: 9, marginTop: 4, lineHeight: 1.35 }}>{invite.justificativa_devolucao}</div>
                  )}
                </button>
                  {selectedInvite?.id === invite.id && (
                    <div style={{ background: '#0B0C0E', border: `1px solid ${C.border}`, borderTop: 0, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, padding: 16, marginTop: -6 }}>
                      <CadastroTable invite={selectedInvite} modelos={modelos} onOpen={documento => void openCadastroDocument(documento)} onReview={(documento, status) => void reviewCadastroDocument(selectedInvite, documento, status)} onApprove={() => void approveInvite(selectedInvite)} onRevoke={() => void revokeInvite(selectedInvite)} onRegenerate={() => void regenerateInvite(selectedInvite)} onCopy={() => void copyInviteCode(selectedInvite)} onDelete={() => void deleteInvite(selectedInvite)} onRefresh={() => load()} colaboradorAtivo={colaboradorAtivo} colaboradores={colaboradores} />
                    </div>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        </section>
      </div>}

      {false && selectedInviteForRender && (
        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}><div><strong>{selectedInviteForRender.nome_destinatario}</strong><p style={{ color: C.inkSoft, fontSize: 10, margin: '5px 0 0' }}>Perfil temporário · {selectedInviteForRender.cpf || 'CPF não informado'} · {selectedInviteForRender.cargo || 'Cargo não informado'}</p></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><button style={outlineBtn} onClick={() => void regenerateInvite(selectedInviteForRender)}>Gerar novo link</button><button style={outlineBtn} onClick={() => void revokeInvite(selectedInviteForRender)}>Revogar convite</button><button style={{ ...outlineBtn, color: '#F87171' }} onClick={() => void deleteInvite(selectedInviteForRender)}><Trash2 size={12} />Excluir cadastro</button>{selectedInviteForRender.status === 'aguardando_aprovacao' && <button style={btn} onClick={() => void approveInvite(selectedInviteForRender)}><CheckCircle2 size={13} />Aprovar e criar funcionário</button>}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 9, marginTop: 14 }}>
            {modelos.map(modelo => { const docs = selectedInviteForRender.documentos.filter(documento => documento.modelo_id === modelo.id); return <article key={modelo.id} style={{ background: '#0B0C0E', border: `1px solid ${docs.length ? '#F59E0B44' : C.border}`, borderRadius: 5, padding: 11 }}><span style={{ color: C.amber, fontSize: 9, fontWeight: 900 }}>ETAPA {modelo.ordem}</span><h4 style={{ margin: '5px 0', fontSize: 11 }}>{modelo.nome}</h4><p style={{ color: C.inkSoft, fontSize: 9, lineHeight: 1.45 }}>{modelo.descricao}</p><div style={{ display: 'grid', gap: 4, margin: '9px 0' }}>{modelo.checklist.map(item => { const doc = docs.find(documento => documento.item_id === item.id && ['enviado', 'aprovado'].includes(documento.status)); return <div key={item.id} style={{ color: doc ? '#86EFAC' : C.inkSoft, fontSize: 9 }}> {doc ? '✓' : '○'} {item.label}{item.obrigatorio ? ' *' : ''}</div> })}</div>{docs.length ? docs.map(documento => <div key={documento.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 7, marginTop: 7 }}><button onClick={() => void openCadastroDocument(documento)} style={{ border: 0, padding: 0, background: 'transparent', color: C.amber, fontSize: 9, cursor: 'pointer', textAlign: 'left' }}>↗ {documento.nome}</button><div style={{ display: 'flex', gap: 5, marginTop: 6 }}><button style={{ ...outlineBtn, padding: '5px 7px', fontSize: 8 }} onClick={() => void reviewCadastroDocument(selectedInviteForRender, documento, 'aprovado')}>Aprovar</button><button style={{ ...outlineBtn, padding: '5px 7px', fontSize: 8, color: '#F87171' }} onClick={() => void reviewCadastroDocument(selectedInviteForRender, documento, 'pendencia')}>Solicitar correção</button></div></div>) : <p style={{ color: C.inkSoft, fontSize: 9 }}>Nenhum documento enviado.</p>}</article> })}
          </div>
        </section>
      )}

      {open && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {Object.entries({ nome: 'Nome completo *', cpf: 'CPF', matricula: 'Matrícula', cargo: 'Cargo', telefone: 'Telefone', email: 'E-mail', endereco: 'Endereço' }).map(([key, placeholder]) => (
              <input key={key} style={input} placeholder={placeholder} value={form[key as keyof typeof form]} onChange={event => setForm({ ...form, [key]: event.target.value })} />
            ))}
            <input title="Admissão" aria-label="Data de admissão" style={input} type="date" value={form.data_admissao} onChange={event => setForm({ ...form, data_admissao: event.target.value })} />
          </div>
          <button disabled={saving} style={{ ...btn, marginTop: 12, opacity: saving ? 0.6 : 1 }} onClick={save}><ClipboardPlus size={14} />{saving ? 'Criando...' : 'Criar ficha e etapas'}</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, alignItems: 'start' }}>
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 12 }}>Funcionários aprovados</strong>
            <span style={{ fontSize: 10, color: C.inkSoft }}>{pessoasFiltradas.length} registros</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input style={{...input, flex: 1, minWidth: 140}} placeholder="Buscar funcionário (nome, CPF, cargo)..." value={buscaPessoas} onChange={e => setBuscaPessoas(e.target.value)} />
            <select style={{...input, width: 'auto'}} value={ordemPessoas} onChange={e => setOrdemPessoas(e.target.value as any)}>
              <option value="alfabetica">A-Z (Alfabética)</option>
              <option value="novo">Admissão: Mais novos</option>
              <option value="velho">Admissão: Mais antigos</option>
            </select>
          </div>
          {pessoasFiltradas.map(person => {
            const isChecked = selectedPessoaIds.includes(person.id);
            const exibirCheckbox = modoExportacao || modoExclusao || selectedInviteIds.length > 0 || selectedPessoaIds.length > 0;
            return (
              <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {exibirCheckbox && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={e => {
                      e.stopPropagation()
                      setSelectedPessoaIds(prev => prev.includes(person.id) ? prev.filter(x => x !== person.id) : [...prev, person.id])
                    }}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.amber, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <button onClick={() => selected?.id === person.id ? setSelected(null) : void loadDetails(person)} style={{ width: '100%', display: 'block', textAlign: 'left', background: selected?.id === person.id ? '#F59E0B18' : 'transparent', border: 0, borderBottom: selected?.id === person.id ? 0 : `1px solid ${C.border}`, padding: '12px 14px', color: C.ink, cursor: 'pointer' }}>
                    <strong>{person.nome}</strong>
                    <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 3 }}>
                      {person.cargo || 'Sem cargo'} · <span style={{ color: C.amber }}>✉️ {person.email || 'Sem e-mail'}</span> · {person.cpf || 'Sem CPF'} · {person.status}
                    </div>
                  </button>
                  {selected?.id === person.id && (
                    <div style={{ background: '#0B0C0E', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '16px 14px' }}>
                      <ArchivePanel person={selected} details={details} onBack={() => { setSelected(null); setDetails(emptyDetails) }} onDelete={() => void deleteEmployee(selected)} onOpen={documento => void openDocument(documento)} onUpload={uploadToArchiveFolder} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      </div>



      {ConfirmDialog}
      {PromptDialog}
    </>
  )
}

const card: React.CSSProperties = {
  background: C.bgPanel,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: 15,
}
