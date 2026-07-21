'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ChevronLeft, ChevronRight, Clock3, History, MoreHorizontal, Plus, Save, Trash2, X } from 'lucide-react'
import { PageTitle } from '@/components/PageTitle'
import { toast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/tokens'
import type { HistoricoEdicao, Quadro, QuadroCartao, QuadroColuna } from '@/lib/types'

const field: React.CSSProperties = { width: '100%', background: '#0B0C0E', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 4, padding: '9px 11px', outline: 'none', fontSize: 12 }
const button: React.CSSProperties = { border: 0, borderRadius: 4, background: C.amber, color: '#090A0C', padding: '9px 13px', fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const ghost: React.CSSProperties = { ...button, background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}` }
const priorityColor: Record<string, string> = { Baixa: '#9CA3AF', Média: '#3B82F6', Alta: '#F59E0B', Urgente: '#EF4444' }

type CardDraft = { id?: string; coluna_id: string; titulo: string; descricao: string; responsavel: string; prioridade: string; prazo: string; etiquetas: string; anexos: Array<{ nome: string; url: string }> }
const emptyCard = (coluna_id = ''): CardDraft => ({ coluna_id, titulo: '', descricao: '', responsavel: '', prioridade: 'Média', prazo: '', etiquetas: '', anexos: [] })
type QuadroComentario = { id: string; cartao_id: string; autor_nome: string; texto: string; created_at: string }
type QuadroCampo = { id: string; quadro_id: string; nome: string; tipo: string; opcoes: string[]; ordem: number }
type QuadroAutomacao = { id: string; quadro_id: string; nome: string; gatilho: string; acao: string; ativo: boolean }

export default function QuadrosPage() {
  const [boards, setBoards] = useState<Quadro[]>([])
  const [boardId, setBoardId] = useState('')
  const [columns, setColumns] = useState<QuadroColuna[]>([])
  const [cards, setCards] = useState<QuadroCartao[]>([])
  const [history, setHistory] = useState<HistoricoEdicao[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [draft, setDraft] = useState<CardDraft | null>(null)
  const [draggingCard, setDraggingCard] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('todas')
  const [view, setView] = useState<'board' | 'table' | 'calendar'>('board')
  const [comments, setComments] = useState<QuadroComentario[]>([])
  const [commentText, setCommentText] = useState('')
  const [checklistText, setChecklistText] = useState('')
  const [customFields, setCustomFields] = useState<QuadroCampo[]>([])
  const [automations, setAutomations] = useState<QuadroAutomacao[]>([])

  const loadBoards = useCallback(async () => {
    const { data, error } = await supabase.from('quadros').select('*').eq('arquivado', false).order('ordem')
    if (error) { toast('Entre com Supabase Auth para acessar os quadros.', 'error'); setLoading(false); return }
    const result = (data ?? []) as Quadro[]
    setBoards(result)
    setBoardId(current => current)
    setLoading(false)
  }, [])

  const loadBoard = useCallback(async () => {
    if (!boardId) { setColumns([]); setCards([]); return }
    const [{ data: fieldData }, { data: automationData }] = await Promise.all([
      supabase.from('quadro_campos').select('*').eq('quadro_id', boardId).order('ordem'),
      supabase.from('quadro_automacoes').select('*').eq('quadro_id', boardId).order('created_at', { ascending: false }),
    ])
    setCustomFields((fieldData ?? []) as QuadroCampo[])
    setAutomations((automationData ?? []) as QuadroAutomacao[])
    const { data: cols } = await supabase.from('quadro_colunas').select('*').eq('quadro_id', boardId).order('ordem')
    const typedCols = (cols ?? []) as QuadroColuna[]
    setColumns(typedCols)
    if (!typedCols.length) { setCards([]); return }
    const { data: cs } = await supabase.from('quadro_cartoes').select('*').in('coluna_id', typedCols.map(c => c.id)).eq('arquivado', false).order('ordem')
    setCards((cs ?? []) as QuadroCartao[])
  }, [boardId])

  useEffect(() => { loadBoards() }, [loadBoards])
  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => {
    if (!draft?.id) { setComments([]); return }
    supabase.from('quadro_comentarios').select('*').eq('cartao_id', draft.id).order('created_at', { ascending: true }).then(({ data }) => setComments((data ?? []) as QuadroComentario[]))
  }, [draft?.id])

  const selectedBoard = boards.find(b => b.id === boardId)
  const filteredCards = useMemo(() => cards.filter(card => {
    const term = search.trim().toLowerCase()
    const matchesText = !term || card.titulo.toLowerCase().includes(term) || (card.descricao || '').toLowerCase().includes(term) || (card.responsavel || '').toLowerCase().includes(term)
    const matchesPriority = priorityFilter === 'todas' || card.prioridade === priorityFilter
    return matchesText && matchesPriority
  }), [cards, search, priorityFilter])
  const cardsByColumn = useMemo(() => Object.fromEntries(columns.map(c => [c.id, filteredCards.filter(x => x.coluna_id === c.id)])), [columns, filteredCards])

  async function createBoard() {
    const nome = prompt('Nome do novo quadro:')?.trim()
    if (!nome) return
    const { data, error } = await supabase.from('quadros').insert({ nome, ordem: boards.length }).select().single()
    if (error) return toast(error.message, 'error')
    setBoards(v => [...v, data as Quadro]); setBoardId(data.id); toast('Quadro criado.', 'success')
  }

  async function renameBoard() {
    if (!selectedBoard) return
    const nome = prompt('Novo nome do quadro:', selectedBoard.nome)?.trim()
    if (!nome) return
    const { error } = await supabase.from('quadros').update({ nome, updated_at: new Date().toISOString() }).eq('id', boardId)
    if (error) return toast(error.message, 'error')
    setBoards(v => v.map(b => b.id === boardId ? { ...b, nome } : b))
  }

  async function archiveBoard() {
    if (!selectedBoard || !confirm(`Arquivar o quadro “${selectedBoard.nome}”?`)) return
    const { error } = await supabase.from('quadros').update({ arquivado: true }).eq('id', boardId)
    if (error) return toast(error.message, 'error')
    const next = boards.filter(b => b.id !== boardId); setBoards(next); setBoardId(next[0]?.id || '')
  }

  async function addColumn() {
    const titulo = prompt('Título da coluna:')?.trim()
    if (!titulo || !boardId) return
    const { data, error } = await supabase.from('quadro_colunas').insert({ quadro_id: boardId, titulo, ordem: columns.length }).select().single()
    if (error) return toast(error.message, 'error')
    setColumns(v => [...v, data as QuadroColuna])
  }

  async function editColumn(col: QuadroColuna) {
    const titulo = prompt('Título da coluna:', col.titulo)?.trim()
    if (!titulo) return
    const { error } = await supabase.from('quadro_colunas').update({ titulo, updated_at: new Date().toISOString() }).eq('id', col.id)
    if (error) return toast(error.message, 'error')
    setColumns(v => v.map(c => c.id === col.id ? { ...c, titulo } : c))
  }

  async function deleteColumn(col: QuadroColuna) {
    if (!confirm(`Excluir a coluna “${col.titulo}” e seus cartões?`)) return
    const { error } = await supabase.from('quadro_colunas').delete().eq('id', col.id)
    if (error) return toast(error.message, 'error')
    setColumns(v => v.filter(c => c.id !== col.id)); setCards(v => v.filter(c => c.coluna_id !== col.id))
  }

  async function moveColumn(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= columns.length) return
    const reordered = [...columns]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setColumns(reordered)
    await Promise.all(reordered.map((c, ordem) => supabase.from('quadro_colunas').update({ ordem }).eq('id', c.id)))
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault(); if (!draft?.titulo.trim()) return
    let anexos = draft.anexos || []
    if (attachment) {
      const path = `quadros/${Date.now()}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('rdo-fotos').upload(path, attachment, { upsert: false })
      if (uploadError) return toast(`Não foi possível anexar a imagem: ${uploadError.message}`, 'error')
      const { data: urlData } = supabase.storage.from('rdo-fotos').getPublicUrl(path)
      anexos = [...anexos, { nome: attachment.name, url: urlData.publicUrl }]
    }
    const payload = { coluna_id: draft.coluna_id, titulo: draft.titulo.trim(), descricao: draft.descricao || null, responsavel: draft.responsavel || null, prioridade: draft.prioridade, prazo: draft.prazo || null, etiquetas: draft.etiquetas.split(',').map(x => x.trim()).filter(Boolean), anexos, updated_at: new Date().toISOString() }
    const query = draft.id ? supabase.from('quadro_cartoes').update(payload).eq('id', draft.id) : supabase.from('quadro_cartoes').insert({ ...payload, ordem: cardsByColumn[draft.coluna_id]?.length ?? 0 })
    const { error } = await query
    if (error) return toast(error.message, 'error')
    setDraft(null); setAttachment(null); await loadBoard(); toast('Cartão salvo.', 'success')
  }

  async function moveCard(card: QuadroCartao, direction: number) {
    const index = columns.findIndex(c => c.id === card.coluna_id); const target = columns[index + direction]
    if (!target) return
    setCards(v => v.map(c => c.id === card.id ? { ...c, coluna_id: target.id } : c))
    const { error } = await supabase.from('quadro_cartoes').update({ coluna_id: target.id, ordem: cardsByColumn[target.id]?.length ?? 0, updated_at: new Date().toISOString() }).eq('id', card.id)
    if (error) { toast(error.message, 'error'); loadBoard() }
  }

  async function dropCard(targetColumnId: string) {
    if (!draggingCard) return
    const card = cards.find(item => item.id === draggingCard)
    if (!card || card.coluna_id === targetColumnId) return
    const ordem = cards.filter(item => item.coluna_id === targetColumnId).length
    setCards(items => items.map(item => item.id === card.id ? { ...item, coluna_id: targetColumnId, ordem } : item))
    const { error } = await supabase.from('quadro_cartoes').update({ coluna_id: targetColumnId, ordem, updated_at: new Date().toISOString() }).eq('id', card.id)
    if (error) { toast(error.message, 'error'); await loadBoard() }
    setDraggingCard(null)
  }

  async function deleteCard(id: string) {
    if (!confirm('Excluir este cartão?')) return
    const { error } = await supabase.from('quadro_cartoes').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    setCards(v => v.filter(c => c.id !== id)); setDraft(null)
  }

  async function addComment() {
    if (!draft?.id || !commentText.trim()) return
    const { data, error } = await supabase.from('quadro_comentarios').insert({ cartao_id: draft.id, autor_nome: 'Usuário conectado', texto: commentText.trim() }).select().single()
    if (error) return toast(error.message, 'error')
    setComments(items => [...items, data as QuadroComentario]); setCommentText('')
  }

  async function addChecklistItem() {
    if (!draft?.id || !checklistText.trim()) return
    const card = cards.find(item => item.id === draft.id)
    if (!card) return
    const checklist = [...(card.checklist || []), { texto: checklistText.trim(), concluido: false }]
    const { error } = await supabase.from('quadro_cartoes').update({ checklist, updated_at: new Date().toISOString() }).eq('id', card.id)
    if (error) return toast(error.message, 'error')
    setCards(items => items.map(item => item.id === card.id ? { ...item, checklist } : item)); setChecklistText('')
  }

  async function addCustomField() {
    if (!boardId) return
    const nome = prompt('Nome do campo personalizado:')?.trim()
    if (!nome) return
    const { data, error } = await supabase.from('quadro_campos').insert({ quadro_id: boardId, nome, tipo: 'texto', ordem: customFields.length }).select().single()
    if (error) return toast(error.message, 'error')
    setCustomFields(items => [...items, data as QuadroCampo])
  }

  async function addAutomation() {
    if (!boardId) return
    const nome = prompt('Nome da automação:', 'Ao mover para concluído')?.trim()
    if (!nome) return
    const { data, error } = await supabase.from('quadro_automacoes').insert({ quadro_id: boardId, nome, gatilho: 'card_moved', acao: 'notify', configuracao: {} }).select().single()
    if (error) return toast(error.message, 'error')
    setAutomations(items => [data as QuadroAutomacao, ...items]); toast('Automação criada.', 'success')
  }

  async function openHistory() {
    if (!boardId) return
    const cardIds = cards.map(c => c.id); const ids = [boardId, ...columns.map(c => c.id), ...cardIds]
    const { data } = await supabase.from('historico_edicoes').select('*').in('entidade_id', ids).order('created_at', { ascending: false }).limit(100)
    setHistory((data ?? []) as HistoricoEdicao[]); setShowHistory(true)
  }

  return <>
    <PageTitle modulo="Gestão Visual" titulo="Quadros & Suprimentos" />
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
      <select style={{ ...field, width: 260 }} value={boardId} onChange={e => setBoardId(e.target.value)}><option value="">Selecione um quadro</option>{boards.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}</select>
      {selectedBoard && <><input style={{ ...field, width: 190 }} placeholder="Buscar cartões..." value={search} onChange={e => setSearch(e.target.value)} /><select style={{ ...field, width: 140 }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="todas">Todas prioridades</option>{['Baixa','Média','Alta','Urgente'].map(item => <option key={item}>{item}</option>)}</select><button style={ghost} onClick={() => setView('board')}>Quadro</button><button style={ghost} onClick={() => setView('table')}>Tabela</button><button style={ghost} onClick={() => setView('calendar')}>Calendário</button><button style={ghost} onClick={addCustomField}>+ Campo</button><button style={ghost} onClick={addAutomation}>⚡ Automação</button></>}
      <button style={button} onClick={createBoard}><Plus size={14}/> Novo quadro</button>
      {selectedBoard && <><button style={ghost} onClick={renameBoard}>Renomear</button><button style={ghost} onClick={addColumn}><Plus size={14}/> Coluna</button><button style={ghost} onClick={openHistory}><History size={14}/> Histórico</button><button style={ghost} onClick={archiveBoard}><Archive size={14}/> Arquivar</button></>}
    </div>
    {loading ? <p style={{ color: C.inkSoft }}>Carregando quadros…</p> : !selectedBoard ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {boards.length === 0 ? <div style={{ border: `1px dashed ${C.border}`, padding: 36, color: C.inkSoft }}>Nenhum quadro criado. Use “Novo quadro” para começar.</div> : boards.map(board => <button key={board.id} onClick={() => setBoardId(board.id)} style={{ textAlign: 'left', minHeight: 130, padding: 18, borderRadius: 6, border: `1px solid ${C.border}`, borderTop: `4px solid ${board.cor || C.amber}`, background: C.bgCard, color: C.ink, cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: 15 }}>{board.nome}</strong><span style={{ display: 'block', marginTop: 10, color: C.inkSoft, fontSize: 11 }}>{board.descricao || 'Quadro editável de projetos'}</span><span style={{ display: 'block', marginTop: 18, color: C.amber, fontSize: 10, fontWeight: 800 }}>ABRIR QUADRO →</span></button>)}
    </div> :
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 18, alignItems: 'flex-start' }}>
        {columns.map((col, index) => <section key={col.id} onDragOver={e => e.preventDefault()} onDrop={() => void dropCard(col.id)} style={{ width: 300, minWidth: 300, background: '#11131A', border: `1px solid ${C.border}`, borderTop: `3px solid ${col.cor}`, borderRadius: 5, padding: 11 }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><strong style={{ flex: 1, fontSize: 12, textTransform: 'uppercase' }}>{col.titulo} <span style={{ color: C.inkSoft }}>({cardsByColumn[col.id]?.length || 0})</span></strong><button title="Mover para esquerda" style={iconButton} onClick={() => moveColumn(index, -1)}><ChevronLeft size={14}/></button><button title="Mover para direita" style={iconButton} onClick={() => moveColumn(index, 1)}><ChevronRight size={14}/></button><button title="Editar título" style={iconButton} onClick={() => editColumn(col)}><MoreHorizontal size={15}/></button><button title="Excluir coluna" style={iconButton} onClick={() => deleteColumn(col)}><Trash2 size={13}/></button></header>
          <div style={{ display: 'grid', gap: 9, minHeight: 70 }}>{cardsByColumn[col.id]?.map(card => <article key={card.id} draggable onDragStart={e => { e.stopPropagation(); setDraggingCard(card.id) }} onDragEnd={() => setDraggingCard(null)} onClick={() => setDraft({ id: card.id, coluna_id: card.coluna_id, titulo: card.titulo, descricao: card.descricao || '', responsavel: card.responsavel || '', prioridade: card.prioridade, prazo: card.prazo || '', etiquetas: card.etiquetas.join(', '), anexos: card.anexos || [] })} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `3px solid ${priorityColor[card.prioridade]}`, borderRadius: 4, padding: 11, cursor: 'grab', opacity: draggingCard === card.id ? .55 : 1 }}>
            <strong style={{ fontSize: 12 }}>{card.titulo}</strong>{card.descricao && <p style={{ color: C.inkSoft, fontSize: 11, lineHeight: 1.45, margin: '7px 0' }}>{card.descricao}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{card.etiquetas.map(tag => <span key={tag} style={{ fontSize: 8, background: '#F59E0B18', color: C.amber, padding: '2px 5px' }}>{tag}</span>)}</div>
            <footer style={{ display: 'flex', marginTop: 9, alignItems: 'center', gap: 5, color: C.inkSoft, fontSize: 9 }}><span style={{ flex: 1 }}>{card.responsavel || 'Sem responsável'}</span>{card.prazo && <><Clock3 size={11}/>{new Date(card.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</>}<button style={iconButton} onClick={e => { e.stopPropagation(); moveCard(card, -1) }}><ChevronLeft size={13}/></button><button style={iconButton} onClick={e => { e.stopPropagation(); moveCard(card, 1) }}><ChevronRight size={13}/></button></footer>
          </article>)}</div>
          <button style={{ ...ghost, width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => setDraft(emptyCard(col.id))}><Plus size={13}/> Adicionar cartão</button>
        </section>)}
        <button style={{ ...ghost, minWidth: 180, justifyContent: 'center' }} onClick={addColumn}><Plus size={14}/> Nova coluna</button>
      </div>}
    {draft && <div style={overlay}><form onSubmit={saveCard} style={modal}><header style={modalHeader}><strong>{draft.id ? 'Editar cartão' : 'Novo cartão'}</strong><button type="button" style={iconButton} onClick={() => setDraft(null)}><X size={17}/></button></header><label style={label}>Título<input autoFocus style={field} value={draft.titulo} onChange={e => setDraft({ ...draft, titulo: e.target.value })}/></label><label style={label}>Descrição<textarea rows={5} style={field} value={draft.descricao} onChange={e => setDraft({ ...draft, descricao: e.target.value })}/></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={label}>Responsável<input style={field} value={draft.responsavel} onChange={e => setDraft({ ...draft, responsavel: e.target.value })}/></label><label style={label}>Prioridade<select style={field} value={draft.prioridade} onChange={e => setDraft({ ...draft, prioridade: e.target.value })}>{['Baixa','Média','Alta','Urgente'].map(x => <option key={x}>{x}</option>)}</select></label></div><label style={label}>Prazo<input type="date" style={field} value={draft.prazo} onChange={e => setDraft({ ...draft, prazo: e.target.value })}/></label><label style={label}>Etiquetas separadas por vírgula<input style={field} value={draft.etiquetas} onChange={e => setDraft({ ...draft, etiquetas: e.target.value })}/></label><label style={label}>Imagem/anexo<input type="file" accept="image/*" style={field} onChange={e => setAttachment(e.target.files?.[0] || null)}/>{draft.anexos?.map(anexo => <a key={anexo.url} href={anexo.url} target="_blank" rel="noreferrer" style={{ color: C.amber, fontSize: 10 }}>{anexo.nome}</a>)}</label><footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>{draft.id ? <button type="button" style={{ ...ghost, color: C.red }} onClick={() => deleteCard(draft.id!)}><Trash2 size={14}/> Excluir</button> : <span/>}<button style={button}><Save size={14}/> Salvar</button></footer></form></div>}
    {draft?.id && <div style={{ ...overlay, zIndex: 99 }}><div style={{ ...modal, width: 'min(620px, 100%)' }}><header style={modalHeader}><strong>Colaboração: {draft.titulo}</strong><button style={iconButton} onClick={() => setDraft(null)}><X size={17}/></button></header><section><label style={label}>Checklist avançado</label><div style={{ display: 'grid', gap: 5, marginBottom: 8 }}>{(cards.find(item => item.id === draft.id)?.checklist || []).map((item, index) => <label key={index} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 11, color: C.ink }}><input type="checkbox" checked={item.concluido} onChange={async e => { const card = cards.find(item => item.id === draft.id); if (!card) return; const checklist = (card.checklist || []).map((x, i) => i === index ? { ...x, concluido: e.target.checked } : x); await supabase.from('quadro_cartoes').update({ checklist }).eq('id', card.id); setCards(items => items.map(x => x.id === card.id ? { ...x, checklist } : x)) }} />{item.texto}</label>)}</div><div style={{ display: 'flex', gap: 7 }}><input style={field} placeholder="Novo item" value={checklistText} onChange={e => setChecklistText(e.target.value)} /><button style={button} onClick={() => void addChecklistItem()}>Adicionar</button></div></section><section><label style={label}>Comentários</label><div style={{ maxHeight: 170, overflow: 'auto', display: 'grid', gap: 6, marginBottom: 8 }}>{comments.map(comment => <div key={comment.id} style={{ border: `1px solid ${C.border}`, padding: 8, fontSize: 11 }}><strong>{comment.autor_nome}</strong><div style={{ color: C.inkSoft, marginTop: 3 }}>{comment.texto}</div></div>)}</div><div style={{ display: 'flex', gap: 7 }}><input style={field} placeholder="Escreva um comentário" value={commentText} onChange={e => setCommentText(e.target.value)} /><button style={button} onClick={() => void addComment()}>Enviar</button></div></section><section><label style={label}>Campos personalizados</label>{customFields.length ? customFields.map(fieldItem => <div key={fieldItem.id} style={{ fontSize: 11, color: C.inkSoft, padding: 5, borderBottom: `1px solid ${C.border}` }}>{fieldItem.nome} <span style={{ float: 'right' }}>{fieldItem.tipo}</span></div>) : <p style={{ color: C.inkSoft, fontSize: 11 }}>Nenhum campo. Use “+ Campo” no cabeçalho.</p>}</section></div></div>}
    {showHistory && <div style={overlay}><div style={{ ...modal, width: 650 }}><header style={modalHeader}><strong>Histórico de edição</strong><button style={iconButton} onClick={() => setShowHistory(false)}><X size={17}/></button></header><div style={{ maxHeight: '65vh', overflow: 'auto', display: 'grid', gap: 8 }}>{history.length ? history.map(h => <div key={h.id} style={{ border: `1px solid ${C.border}`, padding: 10 }}><strong style={{ fontSize: 11 }}>{h.acao} · {h.entidade}</strong><div style={{ color: C.inkSoft, fontSize: 10, marginTop: 4 }}>{h.usuario_nome} · {new Date(h.created_at).toLocaleString('pt-BR')}</div></div>) : <p style={{ color: C.inkSoft }}>Nenhuma alteração registrada.</p>}</div></div></div>}
  </>
}

const iconButton: React.CSSProperties = { background: 'transparent', border: 0, color: C.inkSoft, padding: 3, cursor: 'pointer', display: 'inline-flex' }
const label: React.CSSProperties = { display: 'grid', gap: 5, color: C.inkSoft, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: '#000B', zIndex: 90, display: 'grid', placeItems: 'center', padding: 16 }
const modal: React.CSSProperties = { width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 18, display: 'grid', gap: 12 }
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15 }
