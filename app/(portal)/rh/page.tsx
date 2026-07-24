'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
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
} from 'lucide-react'
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
type DocumentoCadastro = { id: string; modelo_id: string; item_id: string; nome: string; storage_path: string; status: string; observacao_rh: string | null; enviado_em: string | null; modelo?: { id: string; ordem: number; nome: string } }
type Convite = { id: string; nome_destinatario: string; email_destinatario: string | null; telefone_destinatario: string | null; cpf: string | null; matricula: string | null; endereco: string | null; data_admissao: string | null; data_inicio_efetivo: string | null; inicio_efetivo: boolean; cargo: string | null; obra: string | null; etapa_atual: number; expires_at: string; status: string; token_code: string | null; justificativa_devolucao: string | null; created_at: string; revogado_em: string | null; aprovado_em: string | null; funcionario_id: string | null; documentos: DocumentoCadastro[] }

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

function ArchivePanel({ person, details, onBack, onDelete, onOpen }: { person: Funcionario; details: Details; onBack: () => void; onDelete: () => void; onOpen: (documento: Record<string, string | null>) => void }) {
  const [filter, setFilter] = useState('')
  const documents = details.documentos.filter(documento => `${documento.nome || ''} ${documento.tipo || ''}`.toLowerCase().includes(filter.toLowerCase()))
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', flexWrap: 'wrap', marginBottom: 14 }}><div><strong style={{ fontSize: 14 }}>{person.nome}</strong><p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0' }}>{person.cargo || 'Cargo não informado'} · {person.cpf || 'CPF não informado'}</p></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><button style={outlineBtn} onClick={onBack}>← Voltar</button><button style={{ ...outlineBtn, color: '#F87171' }} onClick={onDelete}><Trash2 size={12} />Excluir</button></div></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}><div><strong style={{ fontSize: 12 }}>Baú documental</strong><p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0' }}>Arquivo permanente, organizado nas quatro pastas de admissão.</p></div><input style={{ ...input, width: 210 }} placeholder="Buscar documento" value={filter} onChange={event => setFilter(event.target.value)} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 9 }}>{[1, 2, 3, 4].map(order => { const etapa = details.etapas.find(item => item.modelo.ordem === order); const docs = documents.filter(documento => documento.etapa_id === etapa?.id); return <article key={order} style={{ background: '#0B0C0E', border: `1px solid ${C.border}`, borderRadius: 5, padding: 11 }}><span style={{ color: C.amber, fontSize: 9, fontWeight: 900 }}>PASTA {order}</span><h4 style={{ margin: '5px 0 9px', fontSize: 11 }}>{etapa?.modelo.nome || `Etapa ${order}`}</h4>{docs.length ? docs.map(documento => <button key={documento.id} onClick={() => onOpen(documento)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderTop: `1px solid ${C.border}`, padding: '8px 0', background: 'transparent', color: C.amber, fontSize: 9, cursor: 'pointer' }}>↗ {documento.nome || 'Documento'}<span style={{ display: 'block', color: C.inkSoft, marginTop: 2 }}>{documento.status || 'Arquivado'}</span></button>) : <p style={{ color: C.inkSoft, fontSize: 9 }}>Nenhum arquivo nesta pasta.</p>}</article> })}</div>
  </div>
}

// item_id especial usado para a guia que o RH envia ao candidato (distingue da devolucao)
const GUIA_ITEM_ID = '__guia_rh__'
const LAUDO_ITEM_ID = '__laudo_candidato__'

function CadastroTable({ invite, modelos, onOpen, onReview, onApprove, onRevoke, onRegenerate, onCopy, onDelete, onRefresh }: {
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
}) {
  const [activeFolder, setActiveFolder] = useState(1)
  const [uploadingGuia, setUploadingGuia] = useState(false)

  const modeloEtapa4 = modelos.find(m => m.ordem === 4)
  // Guia enviada pelo RH
  const guiaRH = modeloEtapa4 ? invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && d.item_id === GUIA_ITEM_ID) : null
  // Laudo de retorno enviado pelo candidato
  const laudoCandidato = modeloEtapa4 ? invite.documentos.find(d => d.modelo_id === modeloEtapa4.id && d.item_id === LAUDO_ITEM_ID) : null

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
    setDataEfetivaInput(invite.data_inicio_efetivo || new Date().toISOString().slice(0, 10))
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
        <p style={{ color: C.inkSoft, fontSize: 10, margin: '4px 0 0' }}>
          Perfil temporário · {invite.cpf || 'CPF não informado'} · {invite.cargo || 'Cargo não informado'}
          {invite.data_inicio_efetivo && ` · Data de Início Efetivo: ${new Date(invite.data_inicio_efetivo + 'T00:00:00').toLocaleDateString('pt-BR')}`}
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
        {invite.status === 'aguardando_aprovacao' && <button style={btn} onClick={onApprove}><CheckCircle2 size={12} />Aprovar cadastro</button>}
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
            📁 Etapa {modelo.ordem}<span style={{ marginLeft: 'auto', fontSize: 8 }}>{modelo.ordem === 2 || modelo.ordem === 3 ? 1 : modelo.checklist.length}</span>
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
                label: `Documento Preenchido: ${modelo.nome}`,
                doc,
              }]
            }
            // Na Etapa 1: Renderiza cada item da checklist (incluindo PIX)
            return modelo.checklist.map(item => {
              const docs = invite.documentos.filter(d => d.modelo_id === modelo.id && d.item_id === item.id)
              const doc = docs[docs.length - 1]
              return {
                key: `${modelo.id}-${item.id}`,
                modelo,
                label: item.label + (item.obrigatorio ? ' *' : ''),
                doc,
              }
            })
          }).map(({ key, modelo, label, doc }) => {
            return (
              <div key={key} style={{ display: 'contents' }}>
                <div style={tableCell}>
                  <span style={{ color: C.amber, fontWeight: 900 }}>ETAPA {modelo.ordem}</span>
                  <small style={{ display: 'block', color: C.inkSoft, marginTop: 3 }}>{modelo.nome}</small>
                </div>
                <div style={tableCell}>{label}</div>
                <div style={tableCell}>{doc ? <button onClick={() => onOpen(doc)} style={linkButton}>↗ {doc.nome}</button> : <span style={{ color: C.inkSoft }}>Ainda não enviado</span>}</div>
                <div style={tableCell}>
                  <span style={{ color: doc?.status === 'aprovado' ? '#4ADE80' : doc?.status === 'devolvido' ? '#F87171' : doc ? C.amber : C.inkSoft, fontWeight: 800 }}>
                    {doc?.status === 'aprovado' ? 'Aprovado' : doc?.status === 'devolvido' ? 'Devolvido' : doc ? 'Aguardando análise' : 'Pendente'}
                  </span>
                  {doc?.observacao_rh && <small style={{ display: 'block', color: '#F87171', marginTop: 4 }}>{doc.observacao_rh}</small>}
                </div>
                <div style={{ ...tableCell, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {doc ? <>
                    <button style={{ ...outlineBtn, padding: '5px 7px', fontSize: 8 }} onClick={() => onReview(doc, 'aprovado')}>Aprovar</button>
                    <button style={{ ...outlineBtn, padding: '5px 7px', fontSize: 8, color: '#F87171' }} onClick={() => onReview(doc, 'devolvido')}>Negar</button>
                  </> : <span style={{ color: C.inkSoft, fontSize: 9 }}>Aguardando envio</span>}
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

export default function RhPage() {
  const { confirm, ConfirmDialog } = useConfirm()
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
  const [inviteForm, setInviteForm] = useState({ nome: '', cpf: '', matricula: '', email: '', telefone: '', endereco: '', cargo: '', obra: '', data_inicio_efetivo: '', inicio_efetivo: false, validade: '72' })
  const [inviteSaving, setInviteSaving] = useState(false)
  const [archiveFilter, setArchiveFilter] = useState('')

  const load = useCallback(async (isBackground = false) => {
    const [{ data: peopleData, error: peopleError }, { data: modelData, error: modelError }, { data: inviteData, error: inviteError }] = await Promise.all([
      supabase.from('funcionarios').select('*').order('nome'),
      supabase.from('rh_modelos_admissao').select('*').eq('ativo', true).order('ordem'),
      supabase.from('rh_admissao_convites').select('*, documentos:rh_admissao_documentos(*, modelo:rh_modelos_admissao(id,ordem,nome))').neq('status', 'aprovado').order('created_at', { ascending: false }).limit(50),
    ])
    if (peopleError || modelError || inviteError) {
      toast(peopleError?.message || modelError?.message || 'Não foi possível carregar o RH.', 'error')
      return
    }
    setPessoas((peopleData ?? []) as Funcionario[])
    setModelos((modelData ?? []) as ModeloAdmissao[])
    setConvites((inviteData ?? []) as Convite[])
    setSelectedInvite(current => current ? ((inviteData ?? []).find(item => item.id === current.id) as Convite | undefined) ?? (null as unknown as Convite) : (null as unknown as Convite))
  }, [])

  useRealtimeSync(load, 'rh-sync', ['funcionarios', 'rh_modelos_admissao', 'rh_admissao_convites', 'funcionario_historico', 'exames_ocupacionais'])
  useEffect(() => { load() }, [load])

  async function loadDetails(person: Funcionario) {
    setSelected(person)
    const [{ data: historico }, { data: documentos }, { data: exames }, { data: etapas, error }] = await Promise.all([
      supabase.from('funcionario_historico').select('*').eq('funcionario_id', person.id).order('data_evento', { ascending: false }),
      supabase.from('funcionario_documentos').select('*').eq('funcionario_id', person.id).order('created_at', { ascending: false }),
      supabase.from('exames_ocupacionais').select('*').eq('funcionario_id', person.id).order('created_at', { ascending: false }),
      supabase
        .from('funcionario_admissao_etapas')
        .select('*, modelo:rh_modelos_admissao(*)')
        .eq('funcionario_id', person.id)
        .order('modelo(ordem)', { ascending: true }),
    ])
    if (error) toast(error.message, 'error')
    const orderedStages = ((etapas ?? []) as unknown as EtapaAdmissao[]).sort((a, b) => a.modelo.ordem - b.modelo.ordem)
    setDetails({ historico: historico ?? [], documentos: documentos ?? [], exames: exames ?? [], etapas: orderedStages })
  }

  async function save() {
    if (!form.nome.trim()) return toast('Informe o nome do funcionário.', 'error')
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
    if (!inviteForm.nome.trim()) return toast('Informe o nome do candidato.', 'error')
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
    const { error } = await supabase.from('rh_admissao_convites').insert({
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
      etapa_atual: 1
    })
    setInviteSaving(false)
    if (error) return toast(`Não foi possível gerar o convite: ${error.message}`, 'error')
    const link = `${window.location.origin}/admissao/${token}`
    await navigator.clipboard?.writeText(link)
    setInviteOpen(false)
    setInviteForm({ nome: '', cpf: '', matricula: '', email: '', telefone: '', endereco: '', cargo: '', obra: '', data_inicio_efetivo: '', inicio_efetivo: false, validade: '72' })
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
    const hours = Number(prompt('Validade do novo link em horas:', '72') || 72)
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
    const observacao = devolvendo ? prompt('Explique ao candidato o que precisa corrigir:')?.trim() : null
    if (devolvendo && !observacao) return
    const { error } = await supabase.from('rh_admissao_documentos').update({ status, observacao_rh: observacao, revisado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', documento.id)
    if (error) return toast(error.message, 'error')
    await supabase.from('rh_admissao_convites').update(devolvendo ? { status: 'devolvido', justificativa_devolucao: observacao, updated_at: new Date().toISOString() } : { justificativa_devolucao: null, updated_at: new Date().toISOString() }).eq('id', invite.id)
    await load()
    toast(status === 'aprovado' ? 'Documento aprovado.' : 'Pendência enviada ao candidato.', 'success')
  }

  async function approveInvite(invite: Convite) {
    if (!(await confirm('Aprovar Colaborador', `Aprovar ${invite.nome_destinatario} e criar o funcionário definitivamente?`, { confirmLabel: 'Aprovar', confirmColor: '#10B981' }))) return
    
    // Força a renovação ou verificação do Token para evitar falha 401/403 na Edge Function
    await supabase.auth.getSession()

    const { data, error } = await supabase.functions.invoke('rh-admissao', { body: { action: 'approve', convite_id: invite.id } })
    if (error || data?.error) return toast(data?.error || error?.message || 'Não foi possível aprovar.', 'error')
    setSelectedInvite(null as unknown as Convite)
    await load()
    toast('Cadastro aprovado e transferido para Funcionários.', 'success')
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
    const descricao = prompt('Descrição do evento no histórico:')?.trim()
    if (!descricao) return
    const { error } = await supabase.from('funcionario_historico').insert({ funcionario_id: selected.id, tipo: 'Registro', descricao })
    if (error) return toast(error.message, 'error')
    await loadDetails(selected)
  }

  async function addDocument() {
    if (!selected) return
    const nome = prompt('Nome do documento:')?.trim()
    if (!nome) return
    const { error } = await supabase.from('funcionario_documentos').insert({ funcionario_id: selected.id, tipo: 'Documento', nome, status: 'Pendente' })
    if (error) return toast(error.message, 'error')
    await loadDetails(selected)
  }

  async function addExam() {
    if (!selected) return
    const tipo = prompt('Tipo do exame (admissional, periódico, demissional):')?.trim()
    if (!tipo) return
    const { error } = await supabase.from('exames_ocupacionais').insert({ funcionario_id: selected.id, tipo, status: 'A agendar' })
    if (error) return toast(error.message, 'error')
    await loadDetails(selected)
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
          <button style={outlineBtn} onClick={() => setInviteOpen(value => !value)}><ClipboardPlus size={14} />Gerar link de admissão</button>
        </div>
      </div>

      {inviteOpen && (
        <div style={{ ...card, marginBottom: 14 }}>
          <strong style={{ fontSize: 12 }}>Pré-cadastro e convite temporário</strong>
          <p style={{ color: C.inkSoft, fontSize: 10, margin: '6px 0 12px' }}>Preencha os dados que o RH já possui. O candidato receberá o link apenas para enviar os documentos das quatro etapas.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {([['nome', 'Nome do candidato *'], ['cpf', 'CPF'], ['matricula', 'Matrícula'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['endereco', 'Endereço'], ['cargo', 'Cargo'], ['obra', 'Obra']] as const).map(([key, placeholder]) => <input key={key} style={input} placeholder={placeholder} value={inviteForm[key]} onChange={event => setInviteForm({ ...inviteForm, [key]: event.target.value })} />)}
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
            <span style={{ color: C.inkSoft, fontSize: 10 }}>{convites.length}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {convites.map(invite => {
              const expired = new Date(invite.expires_at).getTime() <= Date.now() && ['ativo', 'em_preenchimento'].includes(invite.status);
              const label = invite.status === 'devolvido' ? 'Devolvido' : invite.status === 'revogado' ? 'Revogado' : expired ? 'Expirado' : invite.status === 'aguardando_aprovacao' ? 'Aguardando aprovação' : invite.status === 'em_preenchimento' ? `Etapa ${invite.etapa_atual}/4` : 'Link gerado';
              return (
                <button
                  key={invite.id}
                  onClick={() => setSelectedInvite(invite)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 13px',
                    background: selectedInvite?.id === invite.id ? '#F59E0B18' : '#0B0C0E',
                    color: C.ink,
                    border: `1px solid ${selectedInvite?.id === invite.id ? '#F59E0B66' : invite.inicio_efetivo ? '#3B82F6AA' : C.border}`,
                    borderRadius: 5,
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
                  <div style={{ color: C.inkSoft, fontSize: 10, marginTop: 5 }}>
                    {invite.cargo || 'Cargo não informado'}
                    {invite.obra ? ` · ${invite.obra}` : ''}
                    {invite.data_inicio_efetivo && ` · Início: ${new Date(invite.data_inicio_efetivo + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                  </div>
                  <div style={{ color: invite.status === 'devolvido' || expired ? '#F87171' : C.amber, fontSize: 10, fontWeight: 800, marginTop: 7 }}>
                    {label}
                  </div>
                  {invite.status === 'devolvido' && invite.justificativa_devolucao && (
                    <div style={{ color: '#FCA5A5', fontSize: 9, marginTop: 4, lineHeight: 1.35 }}>{invite.justificativa_devolucao}</div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
        <section style={card}>{selectedInvite ? <CadastroTable invite={selectedInvite} modelos={modelos} onOpen={documento => void openCadastroDocument(documento)} onReview={(documento, status) => void reviewCadastroDocument(selectedInvite, documento, status)} onApprove={() => void approveInvite(selectedInvite)} onRevoke={() => void revokeInvite(selectedInvite)} onRegenerate={() => void regenerateInvite(selectedInvite)} onCopy={() => void copyInviteCode(selectedInvite)} onDelete={() => void deleteInvite(selectedInvite)} onRefresh={() => load()} /> : <p style={{ color: C.inkSoft, fontSize: 11 }}>Selecione um cadastro para revisar documentos, copiar o código do convite e acompanhar as quatro etapas.</p>}</section>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, alignItems: 'start' }}>
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 12 }}>Funcionários aprovados</strong>
            <span style={{ fontSize: 10, color: C.inkSoft }}>{pessoas.length} registros</span>
          </div>
          {pessoas.map(person => (
            <button key={person.id} onClick={() => void loadDetails(person)} style={{ width: '100%', textAlign: 'left', background: selected?.id === person.id ? '#F59E0B18' : 'transparent', border: 0, borderBottom: `1px solid ${C.border}`, padding: 12, color: C.ink, cursor: 'pointer' }}>
              <strong>{person.nome}</strong>
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 3 }}>{person.cargo || 'Sem cargo'} · {person.matricula || 'Sem matrícula'} · {person.status}</div>
            </button>
          ))}
        </section>

        <section style={{ ...card, gridColumn: 'span 2' }}>
          {false && selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedPersonForRender.nome}</h3>
                  <p style={{ margin: '5px 0 0', fontSize: 11, color: C.inkSoft }}>{selectedPersonForRender.cargo || 'Cargo não informado'} · {selectedPersonForRender.cpf || 'CPF não informado'}</p>
                </div>
                <div style={{ minWidth: 190 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}><span>Progresso da admissão</span><strong>{progress}%</strong></div>
                  <div style={{ height: 7, borderRadius: 99, background: '#FFFFFF0D', overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#22C55E' : C.amber }} /></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 18px' }}>
                <button style={outlineBtn} onClick={addHistory}><ClipboardPlus size={13} />Histórico</button>
                <button style={outlineBtn} onClick={addDocument}><FileText size={13} />Documento</button>
                <button style={outlineBtn} onClick={addExam}><Stethoscope size={13} />Guia/Exame</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><ClipboardCheck size={16} color={C.amber} /><strong style={{ fontSize: 12 }}>Fluxo de admissão</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 10px', flexWrap: 'wrap' }}>
                <p style={{ fontSize: 10, color: C.inkSoft, margin: 0 }}>Envie vários arquivos de uma vez e mantenha cada documento vinculado à etapa correta.</p>
                {details.etapas[0] && <label style={{ ...btn, cursor: uploading === details.etapas[0].id ? 'wait' : 'pointer', opacity: uploading === details.etapas[0].id ? 0.6 : 1 }}><FileUp size={13} />{uploading === details.etapas[0].id ? 'Enviando...' : 'Captura rápida'}<input hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" disabled={!!uploading} onChange={event => void uploadDocuments(details.etapas[0], event.target.files)} /></label>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
                {details.etapas.map(stage => {
                  const action = actionFor(stage.status)
                  const colors = statusColors[stage.status]
                  const SpreadsheetIcon = stage.modelo.tipo_arquivo === 'XLSX' ? FileSpreadsheet : FileText
                  return (
                    <article key={stage.id} style={{ background: '#0B0C0E', border: `1px solid ${stage.status === 'Concluída' ? '#22C55E55' : C.border}`, borderRadius: 6, padding: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                        <span style={{ fontSize: 10, color: C.amber, fontWeight: 900 }}>ETAPA {stage.modelo.ordem}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, background: colors.bg, color: colors.color, padding: '4px 7px', borderRadius: 99 }}>{stage.status}</span>
                      </div>
                      <h4 style={{ margin: '9px 0 6px', fontSize: 13 }}>{stage.modelo.nome}</h4>
                      <p style={{ margin: 0, color: C.inkSoft, fontSize: 10, lineHeight: 1.5, minHeight: 45 }}>{stage.modelo.descricao}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0', color: C.inkSoft, fontSize: 9 }}><SpreadsheetIcon size={13} />{stage.modelo.tipo_arquivo} · {stage.modelo.campos.length} grupos de informação</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0', color: C.inkSoft, fontSize: 9 }}><SpreadsheetIcon size={13} />{stage.modelo.tipo_arquivo} · {stage.modelo.campos.length} grupos de informação · {details.documentos.filter(documento => documento.etapa_id === stage.id).length} anexos</div>
                      {stage.observacoes && <p style={{ fontSize: 9, color: C.amber, margin: '0 0 10px' }}>{stage.observacoes}</p>}
                      <div style={{ background: '#FFFFFF05', borderRadius: 4, padding: 9, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.inkSoft, marginBottom: 6 }}><span>Checklist de conferência</span><strong>{(stage.checklist ?? []).filter(item => item.concluido).length}/{(stage.checklist ?? []).length}</strong></div>
                        {(stage.checklist ?? []).map(item => <label key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'start', fontSize: 9, color: item.concluido ? '#86EFAC' : C.inkSoft, marginTop: 5, cursor: 'pointer' }}><input type="checkbox" checked={!!item.concluido} onChange={() => void toggleChecklist(stage, item.id)} /> <span>{item.label}{item.obrigatorio ? ' *' : ''}</span></label>)}
                      </div>
                      <label style={{ ...outlineBtn, width: '100%', marginBottom: 8, cursor: uploading === stage.id ? 'wait' : 'pointer', opacity: uploading === stage.id ? 0.6 : 1 }}><FileUp size={12} />{uploading === stage.id ? 'Enviando arquivos...' : 'Anexar documentos'}<input hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" disabled={!!uploading} onChange={event => void uploadDocuments(stage, event.target.files)} /></label>
                      {details.documentos.filter(documento => documento.etapa_id === stage.id).slice(0, 4).map(documento => <button key={documento.id} onClick={() => void openDocument(documento)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: C.amber, border: 0, padding: '3px 0', fontSize: 9, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↗ {documento.nome}</button>)}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                        <a href={stage.modelo.arquivo_url} download style={{ ...outlineBtn, textDecoration: 'none', padding: '8px 9px' }}><Download size={12} />Baixar modelo</a>
                        <button style={{ ...btn, padding: '8px 9px' }} onClick={() => void updateStage(stage, action.next)}>
                          {stage.status === 'Concluída' ? <RotateCcw size={12} /> : <CheckCircle2 size={12} />}{action.label}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginTop: 20 }}>
                {([
                  ['Histórico', details.historico],
                  ['Documentos anexados', details.documentos],
                  ['Exames ocupacionais', details.exames],
                ] as const).map(([title, list]) => (
                  <div key={title}>
                    <strong style={{ fontSize: 10, textTransform: 'uppercase', color: C.inkSoft }}>{title}</strong>
                    {list.length ? list.slice(0, 6).map(item => (
                      <div key={item.id ?? `${title}-${item.nome}-${item.tipo}`} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 10 }}>
                        {item.descricao || item.nome || item.tipo}
                        <span style={{ color: C.amber }}> · {item.status || item.data_evento}</span>
                      </div>
                    )) : <p style={{ fontSize: 10, color: C.inkSoft }}>Nenhum registro.</p>}
                  </div>
                ))}
              </div>
            </>
          ) : selected ? (
            <ArchivePanel person={selected} details={details} onBack={() => { setSelected(null); setDetails(emptyDetails) }} onDelete={() => void deleteEmployee(selected)} onOpen={documento => void openDocument(documento)} />
          ) : (
            <p style={{ color: C.inkSoft }}>Selecione um funcionário aprovado para abrir suas quatro pastas documentais.</p>
          )}
        </section>
      </div>

      {ConfirmDialog}
    </>
  )
}

const card: React.CSSProperties = {
  background: C.bgPanel,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: 15,
}
