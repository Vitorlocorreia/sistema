'use client'

import { useState, useMemo, useEffect } from 'react'
import { Image as ImageIcon, Calendar, Eye, Download, Sliders, ChevronRight, Zap, FolderOpen, X } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { ApiBadge } from '@/components/ApiBadge'
import { PageTitle } from '@/components/PageTitle'
import { fotos } from '@/lib/mock'
import { C } from '@/lib/tokens'
import { motion } from 'motion/react'

// ─── Automatic Before/After logic ──────────────────────────────────────────
// Sort photos by dataISO → oldest = ANTES, newest = DEPOIS
// Zero manual work from the manager — the system detects automatically.
function getBeforeAfter(obra: string) {
  const filtered = fotos
    .filter((f) => f.obra === obra)
    .sort((a, b) => a.dataISO.localeCompare(b.dataISO))
  return {
    antes: filtered[0] ?? null,
    depois: filtered[filtered.length - 1] ?? null,
  }
}

// Get the unique list of obras that have photos
const obrasComFotos = [...new Set(fotos.map((f) => f.obra))]

export default function Obras() {
  const [sliderPos, setSliderPos] = useState(50)
  const [obraSelecionada, setObraSelecionada] = useState(obrasComFotos[0])
  const [filtroObra, setFiltroObra] = useState<string>('Todas')
  const [lightboxFoto, setLightboxFoto] = useState<typeof fotos[0] | null>(null)

  const { antes, depois } = useMemo(() => getBeforeAfter(obraSelecionada), [obraSelecionada])

  // Close lightbox on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxFoto(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fotosFiltradas = filtroObra === 'Todas'
    ? fotos
    : fotos.filter((f) => f.obra === filtroObra)

  const countFor = (obra: string) => fotos.filter(f => f.obra === obra).length

  // Calculate how many days elapsed between before and after
  const diasDecorridos = useMemo(() => {
    if (!antes || !depois) return 0
    const d1 = new Date(antes.dataISO).getTime()
    const d2 = new Date(depois.dataISO).getTime()
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
  }, [antes, depois])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageTitle modulo="Integração Google Drive" titulo="Galeria de Obras" />

      {/* ── Before / After Progress Slider ──────────────────────────── */}
      <Panel
        title="Evolução de Obra — Antes & Depois"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* AI Badge */}
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
              onClick={() => { setObraSelecionada(obra); setSliderPos(50) }}
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
              position: 'relative',
              width: '100%',
              overflow: 'hidden',
              borderRadius: 2,
              border: `1px solid ${C.border}`,
              background: '#0B0C0E',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
            }}
          >
            {/* DEPOIS (behind) */}
            {depois && (
              <img
                src={depois.imagem}
                alt={`Depois — ${depois.legenda}`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              />
            )}
            {/* Label DEPOIS */}
            <div style={{
              position: 'absolute', bottom: 14, right: 14, zIndex: 10,
              background: 'rgba(11,12,14,0.88)', border: `1px solid ${C.green}55`,
              padding: '5px 11px', fontSize: 9, fontWeight: 900, color: C.green,
              textTransform: 'uppercase', borderRadius: 2, letterSpacing: 0.5
            }}>
              DEPOIS — {depois?.quando ?? '—'}
            </div>

            {/* ANTES (clipped on top) */}
            {antes && (
              <img
                src={antes.imagem}
                alt={`Antes — ${antes.legenda}`}
                style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  objectFit: 'cover', pointerEvents: 'none',
                  clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                }}
              />
            )}
            {/* Label ANTES */}
            <div style={{
              position: 'absolute', bottom: 14, left: 14, zIndex: 10,
              background: 'rgba(11,12,14,0.88)', border: `1px solid ${C.amber}55`,
              padding: '5px 11px', fontSize: 9, fontWeight: 900, color: C.amber,
              textTransform: 'uppercase', borderRadius: 2, letterSpacing: 0.5
            }}>
              ANTES — {antes?.quando ?? '—'}
            </div>

            {/* Divider line + handle */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`,
              width: 2, background: C.amber, pointerEvents: 'none',
              transform: 'translateX(-50%)', zIndex: 20,
              boxShadow: '0 0 12px rgba(245,158,11,0.6)'
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 34, height: 34, borderRadius: 2,
                background: '#12141C', border: `1px solid ${C.amber}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
              }}>
                <span style={{ fontSize: 14, color: C.amber, fontWeight: 900 }}>↔</span>
              </div>
            </div>

            {/* Transparent range input over the whole image */}
            <input
              type="range" min="0" max="100" value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 30 }}
            />
          </div>

          {/* Info Panel */}
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 2, padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10
          }}>
            {/* Auto-detect badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: `${C.amber}10`, border: `1px solid ${C.amber}30`,
              borderRadius: 2, padding: '8px 10px'
            }}>
              <Zap size={11} color={C.amber} />
              <div>
                <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Automático — sem ação do gestor
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                  Sistema detecta a foto mais antiga (antes) e a mais recente (depois) da obra no Drive.
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Obra Selecionada
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
                {obraSelecionada}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <Row label="Foto Inicial (Antes):" value={antes?.quando ?? '—'} color={C.amber} />
              <Row label="Foto Recente (Depois):" value={depois?.quando ?? '—'} color={C.green} />
              <Row label="Intervalo registrado:" value={`${diasDecorridos} dias`} />
              <Row label="Total de fotos:" value={`${fotos.filter(f => f.obra === obraSelecionada).length} registros`} />
            </div>

            <div style={{
              marginTop: 'auto',
              background: `${C.green}10`, border: `1px solid ${C.green}30`,
              borderRadius: 2, padding: '8px 10px', fontSize: 10, color: C.green, fontWeight: 700
            }}>
              ✓ Fotos sincronizadas automaticamente do Google Drive da construtora.
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Photo Gallery ─────────────────────────────────────────── */}
      <Panel
        title="Fotos do Canteiro — Google Drive"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Filter chips */}
            {['Todas', ...obrasComFotos].map((op) => (
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
                {op}{op !== 'Todas' ? ` (${countFor(op)})` : ` (${fotos.length})`}
              </button>
            ))}
            <ApiBadge />
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {fotosFiltradas.map((f, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -3, borderColor: C.amber }}
              style={{
                borderRadius: 2, overflow: 'hidden',
                border: `1px solid ${C.border}`,
                background: C.bgCard,
                transition: 'border-color 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              className="group"
            >
              {/* Photo */}
              <div style={{ height: 105, background: '#0B0C0E', position: 'relative', overflow: 'hidden' }}>
                <img src={f.imagem} alt={f.legenda} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* Hover overlay */}
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(11,12,14,0.78)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    opacity: 0, transition: 'opacity 0.2s ease', backdropFilter: 'blur(2px)'
                  }}
                  className="group-hover:opacity-100"
                >
                  <button
                    onClick={() => setLightboxFoto(f)}
                    style={{ all: 'unset', cursor: 'pointer', width: 30, height: 30, borderRadius: 2, background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Eye size={13} />
                  </button>
                  <button style={{ all: 'unset', cursor: 'pointer', width: 30, height: 30, borderRadius: 2, background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Download size={13} />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div style={{ padding: '7px 10px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: C.ink, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.legenda}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9.5, color: C.inkSoft, fontWeight: 700 }}>
                  <span style={{ color: C.amber, textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>{f.obra}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Calendar size={9} />
                    <span>{f.dataISO}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Lightbox */}
      {lightboxFoto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setLightboxFoto(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxFoto(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 8000,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 32,
            cursor: 'zoom-out',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxFoto(null)}
            style={{
              position: 'absolute', top: 20, right: 24,
              all: 'unset', cursor: 'pointer',
              width: 36, height: 36, borderRadius: 2,
              background: '#1A1D26', border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.inkSoft,
            }}
          >
            <X size={18} />
          </button>

          {/* Image */}
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            src={lightboxFoto.imagem}
            alt={lightboxFoto.legenda}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '80vh',
              objectFit: 'contain', borderRadius: 2,
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
              cursor: 'default',
            }}
          />

          {/* Caption */}
          <div style={{
            marginTop: 20, textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: 4
          }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>{lightboxFoto.legenda}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
              {lightboxFoto.obra} &middot; {lightboxFoto.dataISO}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Small helper ────────────────────────────────────────────────────────────
function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
      <span style={{ color: C.inkSoft, fontWeight: 700 }}>{label}</span>
      <span style={{ color: color ?? C.ink, fontWeight: 800 }}>{value}</span>
    </div>
  )
}
