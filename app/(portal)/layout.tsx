'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid, Wallet, DollarSign, Clock, Package,
  Camera, FileText, Truck, ChevronRight, GripVertical, Settings, X, Menu, LogOut
} from 'lucide-react'
import { C } from '@/lib/tokens'
import type { Colaborador } from '@/lib/types'

const defaultApps = [
  { id: 'financeiro',   nome: 'Financeiro',       sub: 'Módulo Nativo',  status: 'novo',      icone: 'DollarSign' },
  { id: 'ponto',        nome: 'Ponto & RH',       sub: 'FacePonto',      status: 'atalho',    icone: 'Clock',     url: 'https://faceponto.com.br' },
  { id: 'suprimentos',  nome: 'Suprimentos',      sub: 'Portal Nativo',  status: 'novo',      icone: 'Package'    },
  { id: 'obras',        nome: 'Galeria de Obras', sub: 'Google Drive',   status: 'integrado', icone: 'Camera'     },
  { id: 'rdo',          nome: 'Diário de Obra',   sub: 'Escout',         status: 'novo',      icone: 'FileText'   },
  { id: 'frota',        nome: 'Frota & GPS',      sub: 'Infleet',        status: 'atalho',    icone: 'Truck',     url: 'https://app.infleet.com.br' },
]

import { StatusBadge } from '@/components/StatusBadge'
import { EmbeddedBrowser } from '@/components/EmbeddedBrowser'
import { supabase } from '@/lib/supabase'

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
      const allIds = defaultApps.map(a => a.id)
      return [...ids.filter(id => allIds.includes(id)), ...allIds.filter(id => !ids.includes(id))]
    }
  } catch { }
  return defaultApps.map(a => a.id)
}

function getInitials(nome: string): string {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function cargoLabel(cargo: string): string {
  const labels: Record<string, string> = {
    admin_geral:   'Administrador Geral',
    admin_empresa: 'Admin da Empresa',
    operador:      'Operador',
    visualizador:  'Visualizador',
  }
  return labels[cargo] || cargo
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [order, setOrder] = useState<string[]>(() => defaultApps.map(a => a.id))
  const [editMode, setEditMode] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [appsAutorizados, setAppsAutorizados] = useState<string[]>(['financeiro'])
  const [authChecked, setAuthChecked] = useState(false)

  // ── Auth guard: verifica sessão no localStorage e no Supabase ───────────────────
  useEffect(() => {
    async function verificarAuth() {
      const raw = localStorage.getItem('colaborador_sessao')
      if (!raw) {
        router.replace('/login')
        return
      }
      try {
        const sessao: Colaborador = JSON.parse(raw)
        // Busca colaborador atualizado no banco
        const { data: c, error } = await supabase
          .from('colaboradores')
          .select('*')
          .eq('id', sessao.id)
          .single()

        if (error || !c) {
          router.replace('/login')
          return
        }

        setColaborador(c)
        localStorage.setItem('colaborador_sessao', JSON.stringify(c))
        localStorage.setItem('perfil_ativo', c.cargo)

        // Resolve lista de apps permitidos (dinamicamente do banco)
        if (c.override_permissoes) {
          const listaApps = c.apps ? c.apps.split(',').map((a: string) => a.trim()).filter(Boolean) : ['financeiro']
          setAppsAutorizados(listaApps)
        } else {
          // Busca permissões do cargo
          const { data: perm } = await supabase
            .from('config_permissoes')
            .select('apps')
            .eq('cargo', c.cargo)
            .single()

          const listaApps = perm?.apps ? perm.apps.split(',').map((a: string) => a.trim()).filter(Boolean) : ['financeiro']
          setAppsAutorizados(listaApps)
        }
      } catch {
        router.replace('/login')
        return
      }
      setAuthChecked(true)
    }

    verificarAuth()
  }, [router])

  // Escuta mudanças de sessão (login em outra aba, logout)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'colaborador_sessao') {
        if (!e.newValue) {
          router.replace('/login')
        } else {
          try { setColaborador(JSON.parse(e.newValue)) } catch { }
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [router])

  // Hydrate sidebar order after mount
  useEffect(() => { setOrder(loadOrder()) }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)) }, [order])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ── Route guard: impede acesso via URL direta a apps não autorizados
  useEffect(() => {
    if (!authChecked || !colaborador) return
    const appAcessado = defaultApps.find(app => pathname.startsWith(`/${app.id}`))
    if (appAcessado && !appsAutorizados.includes(appAcessado.id)) {
      router.replace('/')
    }
  }, [pathname, colaborador, authChecked, appsAutorizados, router])

  function handleLogout() {
    localStorage.removeItem('colaborador_sessao')
    localStorage.removeItem('perfil_ativo')
    router.replace('/login')
  }

  const sortedApps = order
    .filter(id => appsAutorizados.includes(id))
    .map(id => defaultApps.find(a => a.id === id)!)
    .filter(Boolean)

  // ── Drag handlers ─────────────────────────────────────────────────
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

  // Aguarda verificação de auth antes de renderizar
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0B0C0E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #F59E0B', borderTopColor: 'transparent',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0B0C0E] text-[#F3F4F6] font-sans selection:bg-[#F59E0B] selection:text-[#0B0C0E]">

      {/* ── MOBILE HEADER ────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-[#12141C] border-b border-[#222530] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#F59E0B] flex items-center justify-center">
            <Wallet size={16} color="#0B0C0E" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-bold text-xs uppercase tracking-wider text-[#F3F4F6] block">Carteira de Apps</span>
            <span className="text-[9px] text-[#9CA3AF] uppercase tracking-widest block">Portal Construtora</span>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 text-[#9CA3AF] hover:text-[#F3F4F6] focus:outline-none"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ── BACKDROP ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/75 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 md:static md:flex flex-col flex-shrink-0
          w-[280px] bg-[#12141C] border-r border-[#222530] p-6
          transform transition-transform duration-300 ease-out md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile close button */}
        <div className="md:hidden flex justify-end mb-4">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] border border-[#222530] rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-7">
          <div className="w-[34px] h-[34px] rounded bg-[#F59E0B] flex items-center justify-center">
            <Wallet size={18} color="#0B0C0E" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, letterSpacing: -0.2, textTransform: 'uppercase' }}>Carteira de Apps</div>
            <div style={{ fontSize: 9.5, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Construtora · Portal</div>
          </div>
        </div>

        {/* Dashboard link */}
        <button
          onClick={() => { router.push('/'); setMobileOpen(false) }}
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', borderRadius: 2, marginBottom: 6,
            background: pathname === '/' ? '#1E2230' : 'transparent',
            border: `1px solid ${pathname === '/' ? C.border : 'transparent'}`,
            color: pathname === '/' ? C.ink : C.inkSoft,
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
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
              textTransform: 'uppercase', letterSpacing: 0.5, transition: 'all 0.15s',
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
                  display: 'flex', flexDirection: 'column', gap: 10,
                  padding: '12px 14px', borderRadius: 2,
                  background: active ? '#1E2230' : 'transparent',
                  border: `1px solid ${active ? C.amber : editMode ? C.border : 'transparent'}`,
                  transition: 'all 0.15s',
                  cursor: editMode ? 'grab' : 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => {
                  if (!editMode) { router.push(`/${app.id}`); setMobileOpen(false) }
                }}
                className={editMode ? '' : 'hover:bg-brand-card/50 hover:border-brand-border'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {editMode && <GripVertical size={14} color={C.inkSoft} style={{ flexShrink: 0, marginLeft: -4 }} />}
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
              width: 34, height: 34, borderRadius: 2, flexShrink: 0,
              background: `${C.gold}33`, border: `1px solid ${C.gold}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, color: '#F59E0B',
            }}>
              {colaborador ? getInitials(colaborador.nome) : '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {colaborador?.nome || 'Usuário'}
              </div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {cargoLabel(colaborador?.cargo || '')}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              style={{
                all: 'unset', cursor: 'pointer',
                width: 28, height: 28, borderRadius: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #1E2230', color: '#4B5563', transition: 'all 0.15s',
              }}
              className="hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main
        className="flex-1 min-w-0 overflow-y-auto"
        style={
          ['/frota', '/ponto'].some(p => pathname.startsWith(p))
            ? { padding: 0, display: 'flex', flexDirection: 'column' }
            : undefined
        }
      >
        <div style={{ display: pathname === '/frota' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
          <EmbeddedBrowser
            defaultUrl="https://app.infleet.com.br"
            shortcutLabel="Infleet"
            shortcutIcon={<Truck size={13} />}
            accentColor={C.amber}
          />
        </div>
        <div style={{ display: pathname === '/ponto' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
          <EmbeddedBrowser
            defaultUrl="https://faceponto.com.br"
            shortcutLabel="FacePonto"
            shortcutIcon={<Clock size={13} />}
            accentColor={C.green}
          />
        </div>
        <div
          style={{ display: !['/frota', '/ponto'].some(p => pathname.startsWith(p)) ? 'block' : 'none' }}
          className="px-4 py-6 md:px-10 md:py-8"
        >
          {children}
        </div>
      </main>
    </div>
  )
}
