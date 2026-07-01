'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid, Wallet, DollarSign, Clock, Package,
  Camera, FileText, Truck, ChevronRight, GripVertical, Settings, X
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { apps as defaultApps } from '@/lib/mock'
import { StatusBadge } from '@/components/StatusBadge'

const iconMap: Record<string, any> = {
  DollarSign, Clock, Package, Camera, FileText, Truck
}

const STORAGE_KEY = 'sidebar_order'

function loadOrder(): string[] {
  if (typeof window === 'undefined') return defaultApps.map(a => a.id)
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const ids: string[] = JSON.parse(saved)
      // Make sure all apps are included (handles new apps added after save)
      const allIds = defaultApps.map(a => a.id)
      const merged = [...ids.filter(id => allIds.includes(id)), ...allIds.filter(id => !ids.includes(id))]
      return merged
    }
  } catch { }
  return defaultApps.map(a => a.id)
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [order, setOrder] = useState<string[]>(() => defaultApps.map(a => a.id))
  const [editMode, setEditMode] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setOrder(loadOrder())
  }, [])

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  }, [order])

  const sortedApps = order.map(id => defaultApps.find(a => a.id === id)!).filter(Boolean)

  // ── Drag handlers ─────────────────────────────────────────────
  const handleDragStart = (index: number) => { dragItem.current = index }
  const handleDragEnter = (index: number) => { dragOver.current = index }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    if (dragItem.current === dragOver.current) { dragItem.current = null; dragOver.current = null; return }
    const next = [...order]
    const [moved] = next.splice(dragItem.current, 1)
    next.splice(dragOver.current, 0, moved)
    setOrder(next)
    dragItem.current = null
    dragOver.current = null
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-sans)' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside style={{
        width: 280,
        background: C.bgPanel,
        borderRight: `1px solid ${C.border}`,
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 28 }}>
          <div style={{ width: 34, height: 34, borderRadius: 2, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={18} color="#0B0C0E" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, letterSpacing: -0.2, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Carteira de Apps</div>
            <div style={{ fontSize: 9.5, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Construtora · Portal</div>
          </div>
        </div>

        {/* Dashboard link */}
        <button
          onClick={() => router.push('/')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            borderRadius: 2,
            marginBottom: 6,
            background: pathname === '/' ? '#1E2230' : 'transparent',
            border: `1px solid ${pathname === '/' ? C.border : 'transparent'}`,
            color: pathname === '/' ? C.ink : C.inkSoft,
            fontSize: 13,
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
          className="hover:text-brand-amber hover:border-brand-border hover:bg-brand-card/50"
        >
          <LayoutGrid size={16} /> Visão Geral
        </button>

        {/* Section header + edit toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Meus Aplicativos
          </div>
          <button
            onClick={() => setEditMode(prev => !prev)}
            title={editMode ? 'Sair do modo edição' : 'Personalizar ordem'}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 2,
              border: `1px solid ${editMode ? C.amber : C.border}`,
              background: editMode ? `${C.amber}18` : 'transparent',
              fontSize: 9, fontWeight: 800, color: editMode ? C.amber : C.inkSoft,
              textTransform: 'uppercase', letterSpacing: 0.5,
              transition: 'all 0.15s',
            }}
          >
            {editMode ? <X size={10} /> : <Settings size={10} />}
            {editMode ? 'Pronto' : 'Ordem'}
          </button>
        </div>

        {/* App cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedApps.map((app, index) => {
            const Icon = iconMap[app.icone]
            const active = pathname.startsWith(`/${app.id}`)
            return (
              <div
                key={app.id}
                draggable={editMode}
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 2,
                  background: active ? '#1E2230' : 'transparent',
                  border: `1px solid ${active ? C.amber : editMode ? C.border : 'transparent'}`,
                  transition: 'all 0.15s',
                  cursor: editMode ? 'grab' : 'pointer',
                  userSelect: 'none',
                  opacity: 1,
                }}
                onClick={() => { if (!editMode) router.push(`/${app.id}`) }}
                className={editMode ? '' : 'hover:bg-brand-card/50 hover:border-brand-border'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Grip handle in edit mode */}
                    {editMode && (
                      <GripVertical size={14} color={C.inkSoft} style={{ flexShrink: 0, marginLeft: -4 }} />
                    )}
                    <div style={{
                      width: 32, height: 32, borderRadius: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? `${C.amber}22` : C.border
                    }}>
                      <Icon size={16} color={active ? C.amber : C.inkSoft} strokeWidth={2} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{app.nome}</div>
                      <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 1 }}>substitui {app.sub}</div>
                    </div>
                  </div>
                  {!editMode && <ChevronRight size={14} color={active ? C.amber : '#4B5563'} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <StatusBadge status={app.status as any} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Edit mode hint */}
        {editMode && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 2,
            background: `${C.amber}10`, border: `1px solid ${C.amber}25`,
            fontSize: 10, color: C.amber, fontWeight: 700, textAlign: 'center'
          }}>
            Arraste os itens para reordenar
          </div>
        )}

        {/* User Block */}
        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 2,
              background: `${C.gold}33`, border: `1px solid ${C.gold}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, color: '#F59E0B'
            }}>
              RC
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>Roberto Construtor</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diretor de Operações</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main style={{ flex: 1, padding: '32px 40px', minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
