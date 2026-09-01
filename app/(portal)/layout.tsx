'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  DollarSign,
  Clock,
  Package,
  Camera,
  Building2,
  FileText,
  Truck,
  ChevronRight,
  ChevronDown,
  X,
  Menu,
  LogOut,
  Users,
  Sun,
  Moon,
  Search,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Folder,
  Calendar,
  Stethoscope,
  Shield,
  Layers,
  TrendingUp,
  ExternalLink
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { useTheme } from '@/components/ThemeProvider'
import type { Colaborador } from '@/lib/types'
import { motion, AnimatePresence } from 'motion/react'
import { EmbeddedBrowser } from '@/components/EmbeddedBrowser'
import { ConnectionStatusBanner } from '@/components/ConnectionStatusBanner'
import { supabase } from '@/lib/supabase'

// ─── TIPAGEM DA ÁRVORE MULTI-NÍVEL COLLAPSIBLE ──────────────────────────────
export type NavItem = {
  id: string
  name: string
  icon?: any
  path?: string
  tabKey?: string
  badge?: string
  appId?: string // Identificador do app para controle de permissões
  items?: NavItem[]
}

// ─── ESTRUTURA UNIFICADA DE NAVEGAÇÃO DO SISTEMA ─────────────────────────────
const systemNavigation: NavItem[] = [
  {
    id: 'rh',
    name: 'Gestão de RH',
    icon: Users,
    appId: 'rh',
    items: [
      { id: 'rh-gestao', name: 'Gestão de RH / Pessoas', path: '/rh', icon: Users },
      { id: 'rh-ponto', name: 'FacePonto', path: '/ponto', icon: Clock },
    ]
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    icon: DollarSign,
    appId: 'financeiro',
    items: [
      { id: 'fin-historico', name: 'Histórico & Fluxo', path: '/financeiro?tab=historico', tabKey: 'historico', icon: FileText },
      { id: 'fin-contas', name: 'Lançar Conta', path: '/financeiro?tab=contas', tabKey: 'contas', icon: Plus },
      { id: 'fin-obras', name: 'Obras & Métricas', path: '/financeiro?tab=obras', tabKey: 'obras', icon: Building2 },
      { id: 'fin-fornecedores', name: 'Fornecedores', path: '/financeiro?tab=fornecedores', tabKey: 'fornecedores', icon: Users },
      { id: 'fin-empresas', name: 'Empresas', path: '/financeiro?tab=empresas', tabKey: 'empresas', icon: Building2 },
      { id: 'fin-permissoes', name: 'Usuários & Permissões', path: '/financeiro?tab=permissoes', tabKey: 'permissoes', icon: Shield },
    ]
  },
  {
    id: 'rdo',
    name: 'Diário de Obra (RDO)',
    icon: FileText,
    path: '/rdo',
    appId: 'rdo'
  },
  {
    id: 'suprimentos',
    name: 'Suprimentos',
    icon: Package,
    path: '/suprimentos',
    appId: 'suprimentos'
  },
  {
    id: 'frota',
    name: 'Frota & GPS',
    icon: Truck,
    path: '/frota',
    appId: 'frota'
  }
]

// ─── COMPONENTE RECURSIVO: NAV MENU ITEM ────────────────────────────────────
function NavMenuItem({
  item,
  level = 0,
  currentPath,
  currentTab,
  onNavigate
}: {
  item: NavItem
  level?: number
  currentPath: string
  currentTab: string | null
  onNavigate: (path: string) => void
}) {
  const isFolder = Boolean(item.items && item.items.length > 0)

  // Verifica recursivamente se este nó ou qualquer descendente está ativo
  const isNodeActive = useCallback((node: NavItem): boolean => {
    if (node.tabKey) {
      return currentPath.startsWith('/financeiro') && (currentTab === node.tabKey || (!currentTab && node.tabKey === 'historico'))
    }
    if (node.path) {
      if (node.path === '/ponto') return currentPath.startsWith('/ponto')
      if (node.path === '/rh') return currentPath.startsWith('/rh')
      if (node.path === '/rdo') return currentPath.startsWith('/rdo')
      if (node.path === '/obras') return currentPath.startsWith('/obras')
      if (node.path === '/suprimentos') return currentPath.startsWith('/suprimentos')
      if (node.path === '/frota') return currentPath.startsWith('/frota')
      return currentPath === node.path
    }
    if (node.items) {
      return node.items.some(isNodeActive)
    }
    return false
  }, [currentPath, currentTab])

  const hasActiveChild = useMemo(() => {
    if (!item.items) return false
    return item.items.some(isNodeActive)
  }, [item.items, isNodeActive])

  // Por padrão, pastas que contêm a rota atual começam abertas
  const [isOpen, setIsOpen] = useState<boolean>(() => hasActiveChild || level === 0)

  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true)
    }
  }, [hasActiveChild])

  const isDirectlySelected = useMemo(() => {
    if (isFolder) return false
    if (item.tabKey) {
      return currentPath.startsWith('/financeiro') && (currentTab === item.tabKey || (!currentTab && item.tabKey === 'historico'))
    }
    if (item.path) {
      if (item.path.includes('?')) return `${currentPath}${typeof window !== 'undefined' ? window.location.search : ''}` === item.path
      return currentPath === item.path
    }
    return false
  }, [isFolder, item.tabKey, item.path, currentPath, currentTab])

  const IconComponent = item.icon

  // CASO 1: SEÇÃO / PASTA COM SUB-ITENS (EXPANSÍVEL)
  if (isFolder) {
    return (
      <div className="flex flex-col w-full my-0.5">
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            textAlign: 'left',
            paddingTop: level === 0 ? 8 : 6,
            paddingBottom: level === 0 ? 8 : 6,
            paddingRight: 10,
            paddingLeft: level * 12 + 10,
            borderRadius: 6,
            fontSize: level === 0 ? 12 : 11.5,
            fontWeight: level === 0 ? 800 : (isOpen || hasActiveChild ? 750 : 600),
            background: hasActiveChild && level === 0 ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
            color: hasActiveChild ? (level === 0 ? C.ink : '#F59E0B') : C.inkSoft,
            border: hasActiveChild && level === 0 ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s cubic-bezier(0.25, 1.1, 0.4, 1)'
          }}
          className="hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-amber-500 select-none group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {IconComponent && (
              <div style={{
                width: level === 0 ? 24 : 18,
                height: level === 0 ? 24 : 18,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hasActiveChild && level === 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                flexShrink: 0
              }}>
                <IconComponent
                  size={level === 0 ? 15 : 13}
                  color={hasActiveChild ? C.amber : undefined}
                  className={hasActiveChild ? '' : 'text-zinc-400 group-hover:text-amber-500'}
                  strokeWidth={hasActiveChild ? 2.2 : 1.8}
                />
              </div>
            )}
            <span className="truncate">{item.name}</span>
          </div>

          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.16, ease: 'easeInOut' }}
            className="flex items-center justify-center flex-shrink-0 ml-1"
          >
            <ChevronRight size={13} className="text-zinc-400 group-hover:text-zinc-200" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && item.items && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="overflow-hidden flex flex-col gap-0.5 mt-0.5 border-l border-zinc-200 dark:border-zinc-800 ml-4 pl-1"
            >
              {item.items.map(child => (
                <NavMenuItem
                  key={child.id}
                  item={child}
                  level={level + 1}
                  currentPath={currentPath}
                  currentTab={currentTab}
                  onNavigate={onNavigate}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // CASO 2: ITEM ÚNICO / AÇÃO DIRETA (CLICÁVEL)
  return (
    <button
      type="button"
      onClick={() => {
        if (item.path) onNavigate(item.path)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        textAlign: 'left',
        paddingTop: level === 0 ? 8 : 6,
        paddingBottom: level === 0 ? 8 : 6,
        paddingRight: 10,
        paddingLeft: level * 12 + 10,
        borderRadius: 6,
        fontSize: level === 0 ? 12 : 11.5,
        fontWeight: isDirectlySelected ? 800 : 600,
        background: isDirectlySelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
        color: isDirectlySelected ? C.ink : C.inkSoft,
        border: `1px solid ${isDirectlySelected ? 'rgba(245, 158, 11, 0.35)' : 'transparent'}`,
        borderLeft: isDirectlySelected ? '3px solid #F59E0B' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.12s ease'
      }}
      className="hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-amber-500 select-none group my-0.5"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {IconComponent && (
          <div style={{
            width: level === 0 ? 24 : 18,
            height: level === 0 ? 24 : 18,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDirectlySelected && level === 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            flexShrink: 0
          }}>
            <IconComponent
              size={level === 0 ? 15 : 13}
              color={isDirectlySelected ? C.amber : C.inkSoft}
              className={isDirectlySelected ? '' : 'text-zinc-400 group-hover:text-amber-500'}
              strokeWidth={isDirectlySelected ? 2.2 : 1.8}
            />
          </div>
        )}
        <span className="truncate">{item.name}</span>
      </div>

      {item.badge ? (
        <span style={{ fontSize: 8.5, fontWeight: 800, color: C.amber, background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          {item.badge}
        </span>
      ) : (
        <ChevronRight size={11} color={C.inkSoft} style={{ opacity: 0.4 }} />
      )}
    </button>
  )
}

const APPS_CACHE_KEY = 'apps_autorizados_cache'
const SESSION_KEY = 'colaborador_sessao'

function readAppsCache(): string[] | null {
  try {
    const raw = localStorage.getItem(APPS_CACHE_KEY)
    if (!raw) return null
    const { apps, ts } = JSON.parse(raw)
    if (Date.now() - ts < 5 * 60 * 1000) return apps
    return null
  } catch { return null }
}

function writeAppsCache(apps: string[]) {
  try { localStorage.setItem(APPS_CACHE_KEY, JSON.stringify({ apps, ts: Date.now() })) } catch { }
}

function invalidateAppsCache() {
  try { localStorage.removeItem(APPS_CACHE_KEY) } catch { }
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
    rh:            'RH / Admissões',
  }
  return labels[cargo] || cargo
}

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [appsAutorizados, setAppsAutorizados] = useState<string[]>([])
  const [authChecked, setAuthChecked] = useState(false)
  const { theme, toggleTheme } = useTheme()

  // Safety timeout para nunca travar tela
  useEffect(() => {
    const timer = setTimeout(() => { setAuthChecked(true) }, 2000)
    return () => clearTimeout(timer)
  }, [])

  // ── Auth guard Otimista ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      router.replace('/redefinir-senha' + window.location.hash)
      return
    }

    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      router.replace('/login')
      return
    }

    let sessao: Colaborador | null = null
    try { sessao = JSON.parse(raw) } catch {
      localStorage.removeItem(SESSION_KEY)
      router.replace('/login')
      return
    }

    if (!sessao || !sessao.id) {
      localStorage.removeItem(SESSION_KEY)
      router.replace('/login')
      return
    }

    setColaborador(sessao)

    const cachedApps = readAppsCache()
    if (cachedApps && cachedApps.length > 0) {
      setAppsAutorizados(cachedApps)
    } else {
      const initialApps = sessao.cargo === 'admin_geral'
        ? ['rh', 'financeiro', 'rdo', 'obras', 'suprimentos', 'frota', 'ponto']
        : (sessao.apps ? sessao.apps.split(',').map((a: string) => a.trim()).filter(Boolean) : ['rh', 'financeiro', 'rdo', 'suprimentos'])
      setAppsAutorizados(initialApps)
      writeAppsCache(initialApps)
    }
    setAuthChecked(true)

    // Validação background
    const validarEmBackground = async () => {
      try {
        const { data: c, error } = await supabase
          .from('colaboradores')
          .select('*')
          .eq('id', sessao!.id)
          .maybeSingle()

        if (error || !c) {
          if (!c) {
            localStorage.removeItem(SESSION_KEY)
            invalidateAppsCache()
            router.replace('/login')
          }
          return
        }

        setColaborador(c)
        localStorage.setItem(SESSION_KEY, JSON.stringify(c))
        localStorage.setItem('perfil_ativo', c.cargo)

        let listaApps: string[]
        if (c.override_permissoes) {
          listaApps = c.apps ? c.apps.split(',').map((a: string) => a.trim()).filter(Boolean) : ['rh']
        } else {
          const { data: perm } = await supabase.from('config_permissoes').select('apps').eq('cargo', c.cargo).maybeSingle()
          listaApps = perm?.apps ? perm.apps.split(',').map((a: string) => a.trim()).filter(Boolean) : (c.cargo === 'admin_geral' ? ['rh', 'financeiro', 'rdo', 'obras', 'suprimentos', 'frota', 'ponto'] : ['rh'])
        }

        setAppsAutorizados(listaApps)
        writeAppsCache(listaApps)
      } catch (err) {
        console.warn('Background sync error:', err)
      } finally {
        setAuthChecked(true)
      }
    }

    validarEmBackground()
  }, [router])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Route guard
  useEffect(() => {
    if (!authChecked || appsAutorizados.length === 0) return
    if (pathname === '/') {
      const fallback = appsAutorizados.includes('rh') ? '/rh'
        : appsAutorizados.includes('financeiro') ? '/financeiro'
        : appsAutorizados.includes('rdo') ? '/rdo'
        : appsAutorizados.includes('suprimentos') ? '/suprimentos'
        : '/rh'
      router.replace(fallback)
      return
    }
  }, [pathname, authChecked, appsAutorizados, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('perfil_ativo')
    invalidateAppsCache()
    router.replace('/login')
  }

  // Filtra itens de acordo com as permissões do colaborador
  const authorizedNavItems = useMemo(() => {
    return systemNavigation.filter(item => {
      if (!item.appId) return true
      if (item.appId === 'rh') {
        return appsAutorizados.includes('rh') || appsAutorizados.includes('ponto')
      }
      return appsAutorizados.includes(item.appId)
    })
  }, [appsAutorizados])

  // Filtro de busca na árvore
  const filteredNavItems = useMemo(() => {
    if (!searchFilter.trim()) return authorizedNavItems

    const q = searchFilter.toLowerCase()

    function filterItem(item: NavItem): NavItem | null {
      const nameMatches = item.name.toLowerCase().includes(q)
      if (item.items && item.items.length > 0) {
        const matchingChildren = item.items.map(filterItem).filter((c): c is NavItem => c !== null)
        if (matchingChildren.length > 0 || nameMatches) {
          return {
            ...item,
            items: matchingChildren.length > 0 ? matchingChildren : item.items
          }
        }
        return null
      }
      return nameMatches ? item : null
    }

    return authorizedNavItems.map(filterItem).filter((i): i is NavItem => i !== null)
  }, [authorizedNavItems, searchFilter])

  const currentTabParam = searchParams.get('tab')
  const isEmbedded = ['/frota', '/ponto'].some(p => pathname.startsWith(p))

  const handleNavigation = useCallback((path: string) => {
    if (path.startsWith('http')) {
      window.open(path, '_blank')
    } else {
      router.push(path)
      setMobileOpen(false)
    }
  }, [router])

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0C0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #F59E0B', borderTopColor: 'transparent',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-[#FFFFFF] dark:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#FFFFFF] font-sans selection:bg-[#FFE500] selection:text-[#0A0A0A]">
      <ConnectionStatusBanner />

      {/* ── MOBILE TOP BAR ─────────────────────────────────────────── */}
      <header className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[#FFFFFF] dark:bg-[#252525] border-b border-[#E4E4E7] dark:border-[#383838] z-40 shadow-sm">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/financeiro')}>
          <img src="/logo-jwa.png" alt="JWA Engenharia" className="h-6 w-auto object-contain flex-shrink-0" style={{ filter: theme === 'dark' ? 'none' : 'brightness(0)' }} />
          <div className="border-l border-[#E4E4E7] dark:border-[#383838] pl-2">
            <span className="font-bold text-xs uppercase tracking-wider block text-[#0A0A0A] dark:text-[#FFFFFF]">
              Portal Construtora
            </span>
            <span className="text-[9px] text-[#F59E0B] font-extrabold uppercase tracking-widest block">
              JWA Engenharia
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            aria-label="Alternar tema"
            title={theme === 'dark' ? 'Tema Escuro Ativo 🌙 (Clique para Modo Claro)' : 'Tema Claro Ativo ☀️ (Clique para Modo Escuro)'}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 6, color: C.amber }}
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label="Abrir menu de navegação"
            className="p-1.5 rounded-lg border border-[#E4E4E7] dark:border-[#383838] bg-[#F4F4F5] dark:bg-[#2E2E2E] text-[#0A0A0A] dark:text-[#FFFFFF] focus:outline-none"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ── BACKDROP MOBILE ───────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SIDEBAR TOTAL MULTI-LEVEL COLLAPSIBLE (UNIFIED NAVBAR) ──── */}
      <aside
        style={{ background: C.bgPanel, borderColor: C.border }}
        className={`
          fixed inset-y-0 left-0 z-50 md:static md:h-full flex flex-col flex-shrink-0
          w-[270px] border-r select-none
          transform transition-transform duration-250 ease-out md:translate-x-0
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Top Header: Logo JWA Oficial */}
        <div style={{ borderColor: C.border }} className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0">
          <div
            onClick={() => {
              router.push('/financeiro')
              setMobileOpen(false)
            }}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <img
              src="/logo-jwa.png"
              alt="JWA Engenharia"
              className="h-7 w-auto object-contain flex-shrink-0"
              style={{ filter: theme === 'dark' ? 'none' : 'brightness(0)' }}
            />
            <div style={{ borderColor: C.border }} className="border-l pl-2.5">
              <span style={{ color: C.ink }} className="font-bold text-xs uppercase tracking-wider block">Portal Construtora</span>
              <span style={{ color: C.amber }} className="text-[9.5px] font-extrabold uppercase tracking-widest block">JWA Engenharia</span>
            </div>
          </div>

          {/* Botão fechar no mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            style={{ color: C.inkSoft, borderColor: C.border }}
            className="md:hidden p-1.5 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={15} />
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="px-3.5 pt-3.5 pb-2 flex-shrink-0">
          <div className="relative">
            <Search size={12} color={C.inkSoft} className="absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              style={{
                background: C.bgWhite,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                color: C.ink,
                padding: '6px 8px 6px 26px',
                fontSize: 11,
                width: '100%',
                outline: 'none'
              }}
              placeholder="Buscar no sistema..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                style={{ color: C.inkSoft }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-amber-500"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Árvore de Menus Multi-Nível */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1 flex flex-col gap-0.5 pr-1.5">
          {filteredNavItems.map(item => (
            <NavMenuItem
              key={item.id}
              item={item}
              level={0}
              currentPath={pathname}
              currentTab={currentTabParam}
              onNavigate={handleNavigation}
            />
          ))}

          {filteredNavItems.length === 0 && (
            <div style={{ color: C.inkSoft }} className="py-8 text-center text-xs">
              Nenhuma seção encontrada.
            </div>
          )}
        </div>

        {/* Rodapé: Usuário + Tema + Sair */}
        <div style={{ background: C.bgPanel, borderTop: `1px solid ${C.border}` }} className="p-3 flex-shrink-0">
          <div style={{ background: C.bgWhite, border: `1px solid ${C.border}` }} className="flex items-center gap-2.5 p-2 rounded-md">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${C.amber}88`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 900,
                color: C.amber,
                flexShrink: 0
              }}
            >
              {colaborador ? getInitials(colaborador.nome) : '?'}
            </div>

            <div className="flex-1 min-w-0">
              <div style={{ color: C.ink }} className="text-xs font-bold truncate">
                {colaborador?.nome || 'Usuário'}
              </div>
              <div style={{ color: C.inkSoft }} className="text-[9.5px] uppercase font-semibold tracking-wider truncate">
                {cargoLabel(colaborador?.cargo || '')}
              </div>
            </div>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Tema Escuro Ativo 🌙 (Clique para Modo Claro)' : 'Tema Claro Ativo ☀️ (Clique para Modo Escuro)'}
              style={{ color: C.amber, background: 'transparent', border: 'none', cursor: 'pointer' }}
              className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-[#2E2E2E] transition-colors flex items-center justify-center"
            >
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <button
              onClick={handleLogout}
              title="Sair do Sistema"
              style={{ color: C.inkSoft, background: 'transparent', border: 'none', cursor: 'pointer' }}
              className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors flex items-center justify-center"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTAINER PRINCIPAL DE CONTEÚDO ────────────────────────── */}
      <main
        className="flex-1 min-w-0 overflow-y-auto pb-6"
        style={isEmbedded ? { padding: 0, display: 'flex', flexDirection: 'column' } : undefined}
      >
        {/* Embedded browsers */}
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
            accentColor={C.amber}
          />
        </div>

        {/* Conteúdo das páginas com transição suave */}
        <AnimatePresence mode="wait" initial={false}>
          {!isEmbedded && (
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-7"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', color: '#F59E0B', fontSize: 13, fontWeight: 700 }}>Carregando Portal...</div>}>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </React.Suspense>
  )
}
