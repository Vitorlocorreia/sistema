'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Image as ImageIcon, Calendar, Eye, Sliders, Zap, X, Plus, Trash2, Edit3, MapPin, User, DollarSign, Check } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { PageTitle } from '@/components/PageTitle'
import { C } from '@/lib/tokens'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/Toast'
import { motion, AnimatePresence } from 'motion/react'
import type { Obra } from '@/lib/types'

// Estilos de formulários nativos do sistema
const inputStyle: React.CSSProperties = {
  background: '#0B0C0E',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.ink,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: C.inkSoft,
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 4,
}

const btn = (accent = C.amber): React.CSSProperties => ({
  background: accent, color: '#0B0C0E', border: 'none', borderRadius: 4,
  padding: '8px 18px', fontSize: 11, fontWeight: 900, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  textTransform: 'uppercase' as const, letterSpacing: .4,
})

const btnGhost: React.CSSProperties = {
  background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
  padding: '8px 16px', fontSize: 11, fontWeight: 700, color: C.inkSoft, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6
}

export default function Obras() {
  const [fotosList, setFotosList] = useState<any[]>([])
  const [obrasList, setObrasList] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)

  const [sliderPos, setSliderPos] = useState(50)
  const [obraSelecionada, setObraSelecionada] = useState<string>('')
  const [filtroObra, setFiltroObra] = useState<string>('Todas')
  const [lightboxFoto, setLightboxFoto] = useState<any | null>(null)

  // Controle do Gerenciador de Obras
  const [isGerenciarOpen, setIsGerenciarOpen] = useState(false)
  const [showFormNova, setShowFormNova] = useState(false)
  const [savingObra, setSavingObra] = useState(false)
  const [colaboradorLogado, setColaboradorLogado] = useState<any>(null)

  // Form State
  const [formObra, setFormObra] = useState({
    id: '', // preenchido apenas na edição
    nome: '',
    cliente: '',
    endereco: '',
    valor_contrato: '',
    data_inicio: '',
    data_fim: '',
    progresso: 0,
    status: 'Em dia'
  })

  // Carrega dados da sessão
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessao = localStorage.getItem('colaborador_sessao')
      if (sessao) {
        try { setColaboradorLogado(JSON.parse(sessao)) } catch { }
      }
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      { data: f },
      { data: o }
    ] = await Promise.all([
      supabase.from('fotos').select('*, obra:obras(nome)').order('data_iso'),
      supabase.from('obras').select('*').order('nome')
    ])

    const list = f ?? []
    setFotosList(list)
    setObrasList(o ?? [])

    // Seleciona automaticamente a primeira obra com fotos se nada estiver selecionado
    const obrasWithPhotos = [...new Set(list.map((item: any) => item.obra?.nome).filter(Boolean))] as string[]
    if (obrasWithPhotos.length > 0 && !obraSelecionada) {
      setObraSelecionada(obrasWithPhotos[0])
    } else if (o && o.length > 0 && !obraSelecionada) {
      setObraSelecionada(o[0].nome)
    }
    setLoading(false)
  }, [obraSelecionada])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Salvar ou Atualizar Obra
  const handleSaveObra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formObra.nome.trim()) return
    setSavingObra(true)

    const payload = {
      nome: formObra.nome.trim(),
      cliente: formObra.cliente.trim() || null,
      endereco: formObra.endereco.trim() || null,
      valor_contrato: formObra.valor_contrato ? parseFloat(formObra.valor_contrato) : null,
      data_inicio: formObra.data_inicio || null,
      data_fim: formObra.data_fim || null,
      progresso: Number(formObra.progresso),
      status: formObra.status
    }

    try {
      if (formObra.id) {
        // Modo Edição
        const { error } = await supabase.from('obras').update(payload).eq('id', formObra.id)
        if (error) throw error
        toast('Obra atualizada com sucesso!', 'success')
      } else {
        // Novo cadastro
        const { error } = await supabase.from('obras').insert(payload)
        if (error) throw error
        toast('Nova obra cadastrada com sucesso!', 'success')
      }

      setFormObra({
        id: '',
        nome: '',
        cliente: '',
        endereco: '',
        valor_contrato: '',
        data_inicio: '',
        data_fim: '',
        progresso: 0,
        status: 'Em dia'
      })
      setShowFormNova(false)
      loadData()
    } catch (err: any) {
      toast('Erro ao salvar obra: ' + err.message, 'error')
    } finally {
      setSavingObra(false)
    }
  }

  // Deletar Obra
  const handleDeleteObra = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir a obra "${nome}"? Isso removerá as tarefas, diários e solicitações vinculados.`)) return
    try {
      const { error } = await supabase.from('obras').delete().eq('id', id)
      if (error) throw error
      toast('Obra removida.', 'success')
      loadData()
    } catch (err: any) {
      toast('Erro ao remover obra: ' + err.message, 'error')
    }
  }

  // Prepara formulário para Edição
  const startEditObra = (obra: Obra) => {
    setFormObra({
      id: obra.id,
      nome: obra.nome,
      cliente: obra.cliente || '',
      endereco: obra.endereco || '',
      valor_contrato: obra.valor_contrato ? String(obra.valor_contrato) : '',
      data_inicio: obra.data_inicio || '',
      data_fim: obra.data_fim || '',
      progresso: obra.progresso || 0,
      status: obra.status || 'Em dia'
    })
    setShowFormNova(true)
  }

  // Auto-detect before/after
  const { antes, depois } = useMemo(() => {
    if (!obraSelecionada) return { antes: null, depois: null }
    const filtered = fotosList
      .filter((f) => f.obra?.nome === obraSelecionada)
      .sort((a, b) => a.data_iso.localeCompare(b.data_iso))
    return {
      antes: filtered[0] ?? null,
      depois: filtered[filtered.length - 1] ?? null,
    }
  }, [obraSelecionada, fotosList])

  // Unique list of obras that have photos
  const obrasComFotos = useMemo(() => {
    return [...new Set(fotosList.map((f) => f.obra?.nome).filter(Boolean))] as string[]
  }, [fotosList])

  // Close lightbox on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxFoto(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fotosFiltradas = filtroObra === 'Todas'
    ? fotosList
    : fotosList.filter((f) => f.obra?.nome === filtroObra)

  // Calculate elapsed days
  const diasDecorridos = useMemo(() => {
    if (!antes || !depois) return 0
    const d1 = new Date(antes.data_iso).getTime()
    const d2 = new Date(depois.data_iso).getTime()
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
  }, [antes, depois])

  const fmtDate = (d: string) => {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  const pularParaObraComFotos = (nome: string) => {
    setObraSelecionada(nome)
    setSliderPos(50)
  }

  // Apenas Administradores e Operadores podem gerenciar obras
  const podeGerenciar = colaboradorLogado?.cargo === 'admin_geral' || colaboradorLogado?.cargo === 'admin_empresa' || colaboradorLogado?.cargo === 'operador'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle modulo="Integração Google Drive" titulo="Galeria de Obras" />
        
        {podeGerenciar && (
          <button 
            onClick={() => setIsGerenciarOpen(true)}
            style={{ ...btn(C.amber), gap: 6 }}
          >
            <Sliders size={14} /> Gerenciar Obras ({obrasList.length})
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: C.inkSoft, fontSize: 13 }}>Carregando fotos e evoluções...</p>
      ) : (
        <>
          {/* Before / After Progress Slider */}
          {obrasComFotos.length > 0 ? (
            <Panel
              title="Evolução de Obra — Antes & Depois"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: `${C.amber}18`, border: `1px solid ${C.amber}44`,
                    padding: '4px 10px', borderRadius: 2, fontSize: 10, fontWeight: 800, color: C.amber
                  }}>
                    <Zap size={10} />
                    Auto-detectado pelo sistema
                  </div>
                </div>
              }
            >
              {/* Obra Selector row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Obra:
                </span>
                {obrasComFotos.map((obra) => (
                  <button
                    key={obra}
                    onClick={() => pularParaObraComFotos(obra)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      padding: '5px 12px', borderRadius: 2, fontSize: 11, fontWeight: 800,
                      border: `1px solid ${obraSelecionada === obra ? C.amber : C.border}`,
                      background: obraSelecionada === obra ? `${C.amber}18` : C.bgCard,
                      color: obraSelecionada === obra ? C.amber : C.inkSoft,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {obra}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3 items-stretch">
                {/* Interactive Slider */}
                <div 
                  className="h-[220px] sm:h-[300px]"
                  style={{
                    position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 2,
                    border: `1px solid ${C.border}`, background: '#0B0C0E', boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
                  }}
                >
                  {/* DEPOIS */}
                  {depois && (
                    <img
                      src={depois.imagem_url ?? '/obra_finalizada.png'}
                      alt={`Depois — ${depois.legenda}`}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                  )}
                  <div style={{
                    position: 'absolute', bottom: 14, right: 14, zIndex: 10,
                    background: 'rgba(11,12,14,0.88)', border: `1px solid ${C.green}55`,
                    padding: '5px 11px', fontSize: 9, fontWeight: 900, color: C.green,
                    textTransform: 'uppercase', borderRadius: 2, letterSpacing: 0.5
                  }}>
                    DEPOIS — {depois ? fmtDate(depois.data_iso) : '—'}
                  </div>

                  {/* ANTES */}
                  {antes && (
                    <img
                      src={antes.imagem_url ?? '/obra_fundacao.png'}
                      alt={`Antes — ${antes.legenda}`}
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        objectFit: 'cover', pointerEvents: 'none',
                        clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                      }}
                    />
                  )}
                  <div style={{
                    position: 'absolute', bottom: 14, left: 14, zIndex: 10,
                    background: 'rgba(11,12,14,0.88)', border: `1px solid ${C.amber}55`,
                    padding: '5px 11px', fontSize: 9, fontWeight: 900, color: C.amber,
                    textTransform: 'uppercase', borderRadius: 2, letterSpacing: 0.5
                  }}>
                    ANTES — {antes ? fmtDate(antes.data_iso) : '—'}
                  </div>

                  {/* Slider bar */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`,
                    width: 2, background: C.amber, pointerEvents: 'none',
                    transform: 'translateX(-50%)', zIndex: 20,
                    boxShadow: '0 0 12px rgba(245,158,11,0.6)'
                  }}>
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      width: 34, height: 34, borderRadius: 2, background: '#12141C', border: `1px solid ${C.amber}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
                    }}>
                      <span style={{ fontSize: 14, color: C.amber, fontWeight: 900 }}>↔</span>
                    </div>
                  </div>

                  <input
                    type="range" min="0" max="100" value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 30 }}
                  />
                </div>

                {/* Info Panel */}
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '8px 10px' }}>
                    <Zap size={11} color={C.amber} />
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Automático — sem ação manual
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                        O portal detecta a primeira e a última foto sincronizada da obra no Google Drive.
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Obra Selecionada
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: C.ink, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
                      {obraSelecionada || 'Nenhuma obra com fotos'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    <Row label="Foto Inicial (Antes):" value={antes ? fmtDate(antes.data_iso) : '—'} color={C.amber} />
                    <Row label="Foto Recente (Depois):" value={depois ? fmtDate(depois.data_iso) : '—'} color={C.green} />
                    <Row label="Intervalo registrado:" value={`${diasDecorridos} dias`} />
                    <Row label="Total de fotos:" value={`${fotosList.filter(f => f.obra?.nome === obraSelecionada).length} registros`} />
                  </div>

                  <div style={{ marginTop: 'auto', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 2, padding: '8px 10px', fontSize: 10, color: C.green, fontWeight: 700 }}>
                    ✓ Integrado e sincronizado com a pasta da construtora no Google Drive.
                  </div>
                </div>
              </div>
            </Panel>
          ) : (
            <div style={{ ...card, padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
              <ImageIcon size={32} color={C.inkSoft} style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: C.ink, margin: '0 0 6px 0' }}>Sem Imagens de Evolução</h3>
              <p style={{ fontSize: 12, color: C.inkSoft, maxWidth: 360, margin: '0 auto 18px', lineHeight: 1.5 }}>
                Para visualizar a linha do tempo "Antes e Depois", envie fotos vinculadas às obras no portal ou cadastre sua primeira obra ativa no sistema.
              </p>
            </div>
          )}

          {/* Photo Gallery */}
          <Panel
            title="Fotos do Canteiro — Google Drive"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFiltroObra('Todas')}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 800,
                    border: `1px solid ${filtroObra === 'Todas' ? C.amber : C.border}`,
                    background: filtroObra === 'Todas' ? `${C.amber}18` : 'transparent',
                    color: filtroObra === 'Todas' ? C.amber : C.inkSoft,
                    transition: 'all 0.15s ease'
                  }}
                >
                  Todas
                </button>
                {obrasComFotos.map((op) => (
                  <button
                    key={op}
                    onClick={() => setFiltroObra(op)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 800,
                      border: `1px solid ${filtroObra === op ? C.amber : C.border}`,
                      background: filtroObra === op ? `${C.amber}18` : 'transparent',
                      color: filtroObra === op ? C.amber : C.inkSoft,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {fotosFiltradas.map((foto) => (
                <motion.div
                  key={foto.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setLightboxFoto(foto)}
                  style={{
                    borderRadius: 2, overflow: 'hidden', border: `1px solid ${C.border}`,
                    background: C.bgCard, cursor: 'pointer', position: 'relative'
                  }}
                >
                  <div style={{ height: 130, overflow: 'hidden', position: 'relative' }}>
                    <img
                      src={foto.imagem_url ?? '/obra_fundacao.png'}
                      alt={foto.legenda ?? 'Foto do Canteiro'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(11,12,14,0.7)', borderRadius: 2, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Eye size={10} color={C.ink} />
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {foto.legenda}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.inkSoft, marginTop: 4, fontWeight: 700 }}>
                      <span>{foto.obra?.nome ?? 'Sem Obra'}</span>
                      <span>{fmtDate(foto.data_iso)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {fotosFiltradas.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px 16px', textAlign: 'center', color: C.inkSoft, fontSize: 12 }}>
                  Nenhuma foto cadastrada nesta visualização.
                </div>
              )}
            </div>
          </Panel>
        </>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxFoto && (
          <div 
            onClick={() => setLightboxFoto(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 20
            }}
          >
            <button 
              onClick={() => setLightboxFoto(null)}
              style={{ all: 'unset', cursor: 'pointer', position: 'absolute', top: 20, right: 20, color: '#fff', padding: 8, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}
            >
              <X size={20} />
            </button>

            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 740, background: '#12141C',
                border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
              }}
            >
              <img 
                src={lightboxFoto.imagem_url ?? '/obra_finalizada.png'} 
                alt={lightboxFoto.legenda ?? 'Visualização'} 
                style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', background: '#07080a', display: 'block' }}
              />
              <div style={{ padding: 18, borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {lightboxFoto.obra?.nome ?? 'Sem Obra'} · {fmtDate(lightboxFoto.data_iso)}
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: C.ink, margin: '4px 0 2px' }}>
                  {lightboxFoto.legenda}
                </h3>
                <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  ✓ Arquivo original mantido na pasta sincronizada do Google Drive.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: GERENCIAR OBRAS */}
      <AnimatePresence>
        {isGerenciarOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              style={{
                background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
                width: '100%', maxWidth: 740, maxHeight: '85vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: C.ink, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Gerenciamento de Obras Ativas
                </h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button 
                    onClick={() => {
                      setFormObra({
                        id: '', nome: '', cliente: '', endereco: '',
                        valor_contrato: '', data_inicio: '', data_fim: '',
                        progresso: 0, status: 'Em dia'
                      })
                      setShowFormNova(p => !p)
                    }}
                    style={{ ...btn(showFormNova ? '#EF4444' : C.amber), padding: '6px 12px', fontSize: 10 }}
                  >
                    {showFormNova ? <X size={12} /> : <Plus size={12} />}
                    {showFormNova ? 'Fechar Formulário' : 'Nova Obra'}
                  </button>
                  <button onClick={() => { setIsGerenciarOpen(false); setShowFormNova(false) }} style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft }}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Form Cadastro/Edição */}
                {showFormNova && (
                  <form onSubmit={handleSaveObra} style={{ background: '#12141C', border: `1px solid ${C.border}`, borderRadius: 6, padding: 18 }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: 12, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {formObra.id ? 'Editar Dados da Obra' : 'Cadastrar Nova Obra'}
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>Nome da Obra *</label>
                        <input style={inputStyle} value={formObra.nome} onChange={e => setFormObra(o => ({ ...o, nome: e.target.value }))} required placeholder="Ex: Edifício Bela Vista" />
                      </div>
                      <div>
                        <label style={labelStyle}>Cliente / Contratante</label>
                        <input style={inputStyle} value={formObra.cliente} onChange={e => setFormObra(o => ({ ...o, cliente: e.target.value }))} placeholder="Ex: Incorporadora Alfa" />
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Endereço da Obra</label>
                      <input style={inputStyle} value={formObra.endereco} onChange={e => setFormObra(o => ({ ...o, endereco: e.target.value }))} placeholder="Ex: Av. Paulista, 1000 - São Paulo/SP" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>Valor do Contrato (R$)</label>
                        <input type="number" style={inputStyle} value={formObra.valor_contrato} onChange={e => setFormObra(o => ({ ...o, valor_contrato: e.target.value }))} placeholder="Ex: 1500000" />
                      </div>
                      <div>
                        <label style={labelStyle}>Data Início</label>
                        <input type="date" style={inputStyle} value={formObra.data_inicio} onChange={e => setFormObra(o => ({ ...o, data_inicio: e.target.value }))} />
                      </div>
                      <div>
                        <label style={labelStyle}>Data Conclusão</label>
                        <input type="date" style={inputStyle} value={formObra.data_fim} onChange={e => setFormObra(o => ({ ...o, data_fim: e.target.value }))} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 18 }}>
                      <div>
                        <label style={labelStyle}>Progresso Geral da Obra ({formObra.progresso}%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input 
                            type="range" min="0" max="100" 
                            value={formObra.progresso} 
                            onChange={e => setFormObra(o => ({ ...o, progresso: Number(e.target.value) }))}
                            style={{ flex: 1, accentColor: C.amber }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 900, color: C.ink, width: 30 }}>{formObra.progresso}%</span>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Status da Operação</label>
                        <select 
                          style={inputStyle} 
                          value={formObra.status} 
                          onChange={e => setFormObra(o => ({ ...o, status: e.target.value }))}
                        >
                          <option value="Em dia">Em dia</option>
                          <option value="Atrasada">Atrasada</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="submit" disabled={savingObra} style={btn(C.amber)}>
                        {savingObra ? 'Salvando...' : formObra.id ? 'Salvar Edição' : 'Criar Obra'}
                      </button>
                      <button type="button" onClick={() => { setShowFormNova(false); setFormObra({ id:'', nome:'', cliente:'', endereco:'', valor_contrato:'', data_inicio:'', data_fim:'', progresso:0, status:'Em dia' }) }} style={btnGhost}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {/* Tabela de Obras */}
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Obras Cadastradas ({obrasList.length})
                  </h4>
                  
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#12141C', borderBottom: `1px solid ${C.border}`, color: C.inkSoft }}>
                          <th style={{ padding: '10px 14px', fontWeight: 800 }}>Nome da Obra</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800 }}>Cliente</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Progresso</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obrasList.map(o => (
                          <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}`, background: C.bgCard }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: C.ink }}>{o.nome}</td>
                            <td style={{ padding: '10px 14px', color: C.inkSoft }}>{o.cliente || '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: C.amber }}>{o.progresso}%</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                                background: o.status === 'Em dia' ? `${C.green}18` : `${C.amber}18`,
                                color: o.status === 'Em dia' ? C.green : C.amber,
                                border: `1px solid ${o.status === 'Em dia' ? C.green : C.amber}33`
                              }}>{o.status}</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button 
                                  onClick={() => startEditObra(o)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft }}
                                  title="Editar Obra"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteObra(o.id, o.nome)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft }}
                                  title="Deletar Obra"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {obrasList.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '24px 14px', color: C.inkSoft, textAlign: 'center' }}>
                              Nenhuma obra cadastrada no sistema. Clique em "+ Nova Obra" para iniciar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
      <span style={{ color: C.inkSoft, fontWeight: 700 }}>{label}</span>
      <span style={{ color: color || C.ink, fontWeight: 800 }}>{value}</span>
    </div>
  )
}
