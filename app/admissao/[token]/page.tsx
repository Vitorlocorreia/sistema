'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, FileCheck2, FileUp, ShieldCheck, CreditCard, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/tokens'

type ChecklistItem = { id: string; label: string; obrigatorio: boolean }
type Modelo = { id: string; codigo: string; ordem: number; nome: string; descricao: string; tipo_arquivo: string; arquivo_nome: string | null; arquivo_url: string | null; checklist: ChecklistItem[] }
type Documento = { id: string; modelo_id: string; item_id: string; nome: string; tamanho_bytes: number; status: string; observacao_rh: string | null; enviado_em: string | null; storage_path?: string }
type Convite = { nome_destinatario: string; email_destinatario: string | null; telefone_destinatario: string | null; cargo: string | null; obra: string | null; expires_at: string; status: string; justificativa_devolucao: string | null }
type Fluxo = { convite: Convite; modelos: Modelo[]; documentos: Documento[]; progresso: { etapa_atual: number; completo: boolean; etapas: Array<{ modelo_id: string; concluida: boolean; enviados: number; obrigatorios: number }> } }

export default function AdmissaoPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [fluxo, setFluxo] = useState<Fluxo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState('')
  const [pixInput, setPixInput] = useState('')
  const [bancoInput, setBancoInput] = useState('')
  const [agenciaContaInput, setAgenciaContaInput] = useState('')
  const [finalizado, setFinalizado] = useState(false)
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rh-admissao`

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const response = await fetch(`${endpoint}?token=${encodeURIComponent(token)}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Convite inválido.')
      setFluxo(body)
      // Carrega valor do PIX salvo previamente se existir
      const docPix = (body.documentos as Documento[] | undefined)?.find(d => d.item_id === 'pix')
      if (docPix?.nome?.startsWith('Dados Bancários:')) {
        const parts = docPix.nome.replace('Dados Bancários:', '').split(' | ')
        setPixInput(parts[0]?.replace('PIX:', '').trim() || '')
        setBancoInput(parts[1]?.replace('Banco:', '').trim() || '')
        setAgenciaContaInput(parts[2]?.replace('Agência/Conta:', '').trim() || '')
      } else if (docPix?.nome?.startsWith('Chave PIX:')) {
        setPixInput(docPix.nome.replace('Chave PIX:', '').trim())
      }
      setErro('')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível validar o convite.')
    } finally {
      setCarregando(false)
    }
  }, [endpoint, token])

  useEffect(() => { void carregar() }, [carregar])

  async function enviarArquivo(modelo: Modelo, item: ChecklistItem, file: File | undefined) {
    if (!file) return
    const uploadId = `${modelo.id}:${item.id}`
    setEnviando(uploadId)
    setErro('')
    try {
      const request = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request_upload', token, modelo_id: modelo.id, item_id: item.id, nome: file.name, mime_type: file.type, tamanho_bytes: file.size }) })
      const prepared = await request.json()
      if (!request.ok) throw new Error(prepared.error || 'Não foi possível preparar o envio.')
      const { error: uploadError } = await supabase.storage.from('rh-documentos').uploadToSignedUrl(prepared.path, prepared.upload_token, file, { contentType: file.type })
      if (uploadError) throw uploadError
      const confirm = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm_upload', token, document_id: prepared.document_id }) })
      const confirmed = await confirm.json()
      if (!confirm.ok) throw new Error(confirmed.error || 'Arquivo enviado, mas não foi confirmado.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao enviar documento.')
    } finally {
      setEnviando('')
    }
  }

  async function salvarChavePix(modelo: Modelo, item: ChecklistItem) {
    if (!pixInput.trim()) return
    const uploadId = `${modelo.id}:${item.id}`
    setEnviando(uploadId)
    setErro('')
    try {
      const request = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_upload',
          token,
          modelo_id: modelo.id,
          item_id: item.id,
          nome: `Dados Bancários: PIX: ${pixInput.trim()} | Banco: ${bancoInput.trim()} | Agência/Conta: ${agenciaContaInput.trim()}`,
          mime_type: 'text/plain',
          tamanho_bytes: 10,
        }),
      })
      const prepared = await request.json()
      if (!request.ok) throw new Error(prepared.error || 'Não foi possível preparar o salvamento.')
      const confirm = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_upload', token, document_id: prepared.document_id }),
      })
      if (!confirm.ok) throw new Error('Não foi possível confirmar a chave PIX.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao salvar PIX.')
    } finally {
      setEnviando('')
    }
  }

  async function finalizar() {
    setEnviando('finalizar')
    setErro('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível finalizar.')
      setFinalizado(true)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível finalizar.')
    } finally {
      setEnviando('')
    }
  }

  const enviados = fluxo?.documentos.filter(documento => ['enviado', 'aprovado'].includes(documento.status)).length ?? 0
  const totalObrigatorios = useMemo(() => fluxo?.modelos.reduce((total, modelo) => {
    if (modelo.ordem === 2 || modelo.ordem === 3) return total + 1
    if (modelo.ordem === 4) return total
    return total + modelo.checklist.filter(item => item.obrigatorio).length
  }, 0) ?? 0, [fluxo])

  return <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, padding: '28px 16px' }}>
    <section style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <header style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><ShieldCheck size={27} color={C.amber} /><div><h1 style={{ margin: 0, fontSize: 19 }}>Documentação para admissão</h1><p style={{ color: C.inkSoft, fontSize: 11, margin: '4px 0 0' }}>Ambiente seguro e temporário para envio ao RH</p></div></div>
        {fluxo && <div style={{ fontSize: 10, color: C.inkSoft, textAlign: 'right' }}><Clock3 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Expira em<br /><strong style={{ color: C.ink }}>{new Date(fluxo.convite.expires_at).toLocaleString('pt-BR')}</strong></div>}
      </header>

      {carregando ? <div style={card}>Validando convite…</div> : erro && !fluxo ? <div style={{ ...card, color: '#F87171', textAlign: 'center' }}><h2>Convite indisponível</h2><p>{erro}</p></div> : finalizado || fluxo?.convite.status === 'aguardando_aprovacao' ? <div style={{ ...card, textAlign: 'center', padding: 42 }}><CheckCircle2 size={46} color="#4ADE80" /><h2>Documentação enviada ao RH</h2><p style={{ color: C.inkSoft }}>Seu cadastro está aguardando conferência. O RH entrará em contato caso exista alguma pendência.</p></div> : fluxo && <>
        <section style={{ ...card, marginBottom: 14 }}>
          <strong style={{ fontSize: 13 }}>{fluxo.convite.nome_destinatario}</strong>
          <div style={{ color: C.inkSoft, fontSize: 10, marginTop: 5 }}>{fluxo.convite.cargo || 'Cargo não informado'}{fluxo.convite.obra ? ` · ${fluxo.convite.obra}` : ''}{fluxo.convite.telefone_destinatario ? ` · ${fluxo.convite.telefone_destinatario}` : ''}</div>
          <p style={{ color: C.inkSoft, fontSize: 11, lineHeight: 1.6, margin: '12px 0 0' }}>O RH já realizou seu pré-cadastro. Siga as etapas abaixo para concluir sua admissão.</p>
          {fluxo.convite.status === 'devolvido' && <div style={{ marginTop: 12, padding: 10, borderRadius: 5, border: '1px solid #EF444466', background: '#EF444412', color: '#FCA5A5', fontSize: 10 }}><strong>Documentação devolvida pelo RH</strong><div style={{ marginTop: 4 }}>{fluxo.convite.justificativa_devolucao || 'Revise os itens marcados e envie novamente.'}</div></div>}
          <div style={{ marginTop: 12, height: 7, borderRadius: 99, background: '#FFFFFF0D', overflow: 'hidden' }}><div style={{ width: `${totalObrigatorios ? Math.min(100, Math.round((enviados / totalObrigatorios) * 100)) : 0}%`, height: '100%', background: C.amber }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.inkSoft, fontSize: 9, marginTop: 5 }}><span>{enviados} documento(s) enviados</span><span>Etapa atual: {fluxo.progresso.etapa_atual} de 4</span></div>
        </section>

        <div style={{ display: 'grid', gap: 12 }}>
          {fluxo.modelos.map(modelo => {
            const etapa = fluxo.progresso.etapas.find(item => item.modelo_id === modelo.id)

            // ── ETAPA 1: Caixas de upload normais + Input de texto na última box (Chave PIX) ──────
            if (modelo.ordem === 1) {
              return (
                <article key={modelo.id} style={{ ...card, borderColor: etapa?.concluida ? '#22C55E66' : C.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                    <div>
                      <span style={{ color: C.amber, fontSize: 9, fontWeight: 900 }}>ETAPA 1 DE 4</span>
                      <span style={{ fontSize: 8, background: '#F59E0B20', color: C.amber, border: '1px solid #F59E0B44', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>[Preenchido pelo Funcionário]</span>
                      <h2 style={{ fontSize: 14, margin: '5px 0' }}>{modelo.nome}</h2>
                      <p style={{ color: C.inkSoft, fontSize: 10, lineHeight: 1.5, margin: 0 }}>{modelo.descricao}</p>
                    </div>
                    {etapa?.concluida && <span style={{ color: '#4ADE80', fontSize: 10, whiteSpace: 'nowrap' }}><FileCheck2 size={14} /> Completa</span>}
                  </div>

                  <div style={{ display: 'grid', gap: 7, marginTop: 13 }}>
                    {modelo.checklist.map(item => {
                      const docs = fluxo.documentos.filter(documento => documento.modelo_id === modelo.id && documento.item_id === item.id)
                      const accepted = docs.find(documento => ['enviado', 'aprovado'].includes(documento.status))
                      const pending = docs.find(documento => documento.status === 'devolvido')
                      const id = `${modelo.id}:${item.id}`
                      const isPix = item.id === 'pix' || item.label.toLowerCase().includes('pix')

                      // Última box: Campo de texto para digitar Chave PIX
                      if (isPix) {
                        return (
                          <div key={item.id} style={{ padding: 12, background: '#0B0C0E', border: `1px solid ${accepted ? '#22C55E55' : C.border}`, borderRadius: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <CreditCard size={14} color={C.amber} />
                              <strong style={{ fontSize: 11 }}>{item.label}{item.obrigatorio ? ' *' : ''}</strong>
                            </div>
                            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                              <input
                                style={{ background: '#12141C', border: `1px solid ${C.border}`, borderRadius: 4, padding: '7px 10px', color: C.ink, fontSize: 11 }}
                                placeholder="Chave PIX (obrigatório)"
                                value={pixInput}
                                onChange={e => setPixInput(e.target.value)}
                              />
                              <input
                                style={{ background: '#12141C', border: `1px solid ${C.border}`, borderRadius: 4, padding: '7px 10px', color: C.ink, fontSize: 11 }}
                                placeholder="Banco (ex: Itaú, Nubank)"
                                value={bancoInput}
                                onChange={e => setBancoInput(e.target.value)}
                              />
                              <input
                                style={{ gridColumn: '1 / -1', background: '#12141C', border: `1px solid ${C.border}`, borderRadius: 4, padding: '7px 10px', color: C.ink, fontSize: 11 }}
                                placeholder="Agência e Conta (obrigatório) ex: Ag 0000 / Cc 00000-0"
                                value={agenciaContaInput}
                                onChange={e => setAgenciaContaInput(e.target.value)}
                              />
                              <button
                                disabled={enviando === id || !pixInput.trim() || !agenciaContaInput.trim()}
                                onClick={() => void salvarChavePix(modelo, item)}
                                style={{ gridColumn: '1 / -1', padding: '9px 14px', background: C.amber, color: '#0B0C0E', border: 0, borderRadius: 4, fontSize: 10, fontWeight: 900, cursor: 'pointer', opacity: (pixInput.trim() && agenciaContaInput.trim()) ? 1 : 0.5 }}
                              >
                                {enviando === id ? 'Salvando...' : accepted ? 'Atualizar Dados Bancários' : 'Salvar Dados Bancários'}
                              </button>
                            </div>
                            {accepted && <div style={{ color: '#4ADE80', fontSize: 9, marginTop: 6 }}>✓ {accepted.nome}</div>}
                          </div>
                        )
                      }

                      // Demais boxes: Upload normal de arquivo
                      return (
                        <div key={item.id} style={{ padding: 10, background: '#0B0C0E', border: `1px solid ${accepted ? '#22C55E55' : pending ? '#EF444455' : C.border}`, borderRadius: 5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div>
                              <strong style={{ fontSize: 10 }}>{item.label}{item.obrigatorio ? ' *' : ''}</strong>
                              {accepted && <div style={{ color: '#4ADE80', fontSize: 9, marginTop: 4 }}>✓ {accepted.nome}</div>}
                              {pending && <div style={{ color: '#F87171', fontSize: 9, marginTop: 4 }}>Pendência: {pending.observacao_rh || 'envie novamente com melhor qualidade'}</div>}
                            </div>
                            <label style={{ ...uploadButton, opacity: enviando === id ? 0.6 : 1 }}>
                              <FileUp size={12} />{enviando === id ? 'Enviando…' : accepted ? 'Substituir' : 'Anexar'}
                              <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" disabled={!!enviando} onChange={event => void enviarArquivo(modelo, item, event.target.files?.[0])} />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            }

            // ── ETAPA 2 (Autodeclaração) & ETAPA 3 (Ficha de Registro): Apenas 1 box de upload ────
            if (modelo.ordem === 2 || modelo.ordem === 3) {
              const itemUnico = modelo.checklist[0] || { id: `etapa_${modelo.ordem}`, label: modelo.nome, obrigatorio: true }
              const docs = fluxo.documentos.filter(documento => documento.modelo_id === modelo.id)
              const accepted = docs.find(documento => ['enviado', 'aprovado'].includes(documento.status))
              const pending = docs.find(documento => documento.status === 'devolvido')
              const id = `${modelo.id}:${itemUnico.id}`

              return (
                <article key={modelo.id} style={{ ...card, borderColor: accepted ? '#22C55E66' : C.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                    <div>
                      <span style={{ color: C.amber, fontSize: 9, fontWeight: 900 }}>ETAPA {modelo.ordem} DE 4</span>
                      <span style={{ fontSize: 8, background: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F644', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>[Modelo da Empresa · Assinatura do Funcionário]</span>
                      <h2 style={{ fontSize: 14, margin: '5px 0' }}>{modelo.nome}</h2>
                      <p style={{ color: C.inkSoft, fontSize: 10, lineHeight: 1.5, margin: 0 }}>{modelo.descricao}</p>
                      {modelo.arquivo_url && (
                        <a href={modelo.arquivo_url} download style={{ color: C.amber, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, marginTop: 8, fontWeight: 800 }}>
                          <Download size={12} /> Baixar modelo {modelo.arquivo_nome || modelo.tipo_arquivo}
                        </a>
                      )}
                    </div>
                    {accepted && <span style={{ color: '#4ADE80', fontSize: 10, whiteSpace: 'nowrap' }}><FileCheck2 size={14} /> Anexado</span>}
                  </div>

                  {/* Única box de upload do modelo preenchido */}
                  <div style={{ marginTop: 13, padding: 12, background: '#0B0C0E', border: `1px solid ${accepted ? '#22C55E55' : pending ? '#EF444455' : C.border}`, borderRadius: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div>
                        <strong style={{ fontSize: 11 }}>Anexar {modelo.nome} Preenchida *</strong>
                        {accepted && <div style={{ color: '#4ADE80', fontSize: 9, marginTop: 4 }}>✓ Arquivo enviado: {accepted.nome}</div>}
                        {pending && <div style={{ color: '#F87171', fontSize: 9, marginTop: 4 }}>Pendência: {pending.observacao_rh || 'envie novamente com melhor qualidade'}</div>}
                        {!accepted && <div style={{ color: C.inkSoft, fontSize: 9, marginTop: 2 }}>Baixe o modelo acima, preencha, assine e anexe o arquivo final aqui.</div>}
                      </div>

                      <label style={{ ...uploadButton, opacity: enviando === id ? 0.6 : 1 }}>
                        <FileUp size={12} />{enviando === id ? 'Enviando…' : accepted ? 'Substituir' : 'Anexar Arquivo'}
                        <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" disabled={!!enviando} onChange={event => void enviarArquivo(modelo, itemUnico, event.target.files?.[0])} />
                      </label>
                    </div>
                  </div>
                </article>
              )
            }

            // ── ETAPA 4: Guia de Exame Admissional (Baixar guia do RH + Anexar laudo médico) ──────
            if (modelo.ordem === 4) {
              const guiaRH = fluxo.documentos.find(d => d.modelo_id === modelo.id && d.item_id === '__guia_rh__')
              const laudoCandidato = fluxo.documentos.find(d => d.modelo_id === modelo.id && d.item_id === '__laudo_candidato__')
              const uploadId = `${modelo.id}:__laudo_candidato__`

              return (
                <article key={modelo.id} style={{ ...card, borderColor: laudoCandidato ? '#22C55E66' : C.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                    <div>
                      <span style={{ color: C.amber, fontSize: 9, fontWeight: 900 }}>ETAPA 4 DE 4</span>
                      <span style={{ fontSize: 8, background: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F644', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>[Guia do RH · Laudo do Funcionário]</span>
                      <h2 style={{ fontSize: 14, margin: '5px 0' }}>{modelo.nome}</h2>
                      <p style={{ color: C.inkSoft, fontSize: 10, lineHeight: 1.5, margin: 0 }}>
                        Baixe sua guia médica personalizada, realize os exames na clínica informada e anexe o laudo/resultado de retorno abaixo.
                      </p>
                    </div>
                    {laudoCandidato && <span style={{ color: '#4ADE80', fontSize: 10, whiteSpace: 'nowrap' }}><FileCheck2 size={14} /> Laudo Enviado</span>}
                  </div>

                  <div style={{ marginTop: 12, padding: 12, background: '#0B0C0E', borderRadius: 5, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Bloco 1: Download da Guia do RH */}
                    <div>
                      <strong style={{ fontSize: 11, color: C.ink, display: 'block', marginBottom: 4 }}>1. Sua Guia Médica Personalizada</strong>
                      {guiaRH ? (
                        <a
                          href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/rh-documentos/${guiaRH.storage_path || guiaRH.nome}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: C.amber, color: '#0B0C0E', fontWeight: 900, fontSize: 10, borderRadius: 4, textDecoration: 'none', marginTop: 4 }}
                        >
                          <FileCheck2 size={13} /> Baixar Guia Médica ({guiaRH.nome})
                        </a>
                      ) : (
                        <p style={{ fontSize: 10, color: C.inkSoft, margin: 0 }}>
                          ⏳ O RH ainda está preenchendo sua guia de exame. Ela estará disponível aqui em breve.
                        </p>
                      )}
                    </div>

                    {/* Bloco 2: Upload do Laudo pelo Candidato */}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div>
                          <strong style={{ fontSize: 11, color: C.ink }}>2. Resultado / Laudo do Exame Admissional *</strong>
                          {laudoCandidato && (
                            <div style={{ color: laudoCandidato.status === 'aprovado' ? '#4ADE80' : laudoCandidato.status === 'devolvido' ? '#F87171' : C.amber, fontSize: 9, marginTop: 4 }}>
                              {laudoCandidato.status === 'aprovado' ? '✓ Aprovado pelo RH' : laudoCandidato.status === 'devolvido' ? `Pendência: ${laudoCandidato.observacao_rh || 'Reenvie com melhor qualidade'}` : `✓ Enviado: ${laudoCandidato.nome}`}
                            </div>
                          )}
                          {!laudoCandidato && (
                            <div style={{ color: C.inkSoft, fontSize: 9, marginTop: 2 }}>Anexe a folha de laudo/ASO entregue pelo médico após a consulta.</div>
                          )}
                        </div>

                        <label style={{ ...uploadButton, opacity: enviando === uploadId ? 0.6 : 1 }}>
                          <FileUp size={12} />{enviando === uploadId ? 'Enviando…' : laudoCandidato ? 'Substituir Laudo' : 'Anexar Laudo'}
                          <input
                            hidden
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            disabled={!!enviando}
                            onChange={event => {
                              const dummyItem = { id: '__laudo_candidato__', label: 'Laudo / ASO Admissional', obrigatorio: true }
                              void enviarArquivo(modelo, dummyItem, event.target.files?.[0])
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </article>
              )
            }

            return null
          })}
        </div>
        {erro && <p style={{ color: '#F87171', fontSize: 11 }}>{erro}</p>}
        <button disabled={!fluxo.progresso.completo || !!enviando} onClick={() => void finalizar()} style={{ ...primaryButton, opacity: fluxo.progresso.completo && !enviando ? 1 : 0.5, marginTop: 14 }}>{enviando === 'finalizar' ? 'Enviando…' : fluxo.progresso.completo ? 'Enviar tudo para aprovação do RH' : 'Envie todos os documentos obrigatórios'}</button>
      </>}
    </section>
  </main>
}

const card: React.CSSProperties = { background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 7, padding: 17 }
const uploadButton: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 4, padding: '7px 9px', color: C.ink, fontSize: 9, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center', whiteSpace: 'nowrap' }
const primaryButton: React.CSSProperties = { width: '100%', border: 0, borderRadius: 5, padding: 13, background: C.amber, color: '#0B0C0E', fontWeight: 900, cursor: 'pointer' }
