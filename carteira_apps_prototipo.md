# Carteira de Apps — Protótipo de Apresentação

> Stack: Next.js 15 · Tailwind CSS · shadcn/ui  
> Objetivo: protótipo navegável para apresentação ao cliente construtora  
> Dados: fictícios (Obra A, Obra B, Obra C)  
> Sem backend — tudo em memória/mock

---

## 1. Dependências

```bash
npx create-next-app@latest carteira-prototipo --typescript --tailwind --app
cd carteira-prototipo
npm install lucide-react recharts
npx shadcn@latest init
npx shadcn@latest add card badge button
```

Adicione ao `app/layout.tsx` a fonte Archivo:

```tsx
import { Archivo, Inter } from 'next/font/google'

const archivo = Archivo({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-archivo' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
```

---

## 2. Dados Mock

Crie o arquivo `lib/mock.ts`:

```typescript
export const obras = [
  { id: '1', nome: 'Residencial Bela Vista', progresso: 68, status: 'Em dia' },
  { id: '2', nome: 'Edifício Horizonte',     progresso: 34, status: 'Atenção' },
  { id: '3', nome: 'Condomínio Parque Sul',  progresso: 91, status: 'Em dia'  },
]

export const lancamentos = [
  { descricao: 'Fornecedor — Cimento Bela Vista',     valor: -12400, tipo: 'despesa' },
  { descricao: 'Medição — Edifício Horizonte',         valor: 38000,  tipo: 'receita' },
  { descricao: 'Folha de pagamento — Equipe campo',   valor: -54200, tipo: 'despesa' },
  { descricao: 'Adiantamento cliente — Parque Sul',   valor: 60000,  tipo: 'receita' },
]

export const suprimentos = [
  { titulo: 'Cimento CP-II — 200 sacos',    lista: 'Pedido',    obra: 'Bela Vista' },
  { titulo: 'Aço CA-50 — 3 ton',            lista: 'Aprovação', obra: 'Horizonte'  },
  { titulo: 'Tijolo cerâmico — 15.000 un',  lista: 'Entregue',  obra: 'Parque Sul' },
]

export const equipe = [
  { nome: 'Carlos Eduardo',  funcao: 'Mestre de obras', ponto: '07:02 — entrada' },
  { nome: 'João Pedro',      funcao: 'Pedreiro',        ponto: '06:58 — entrada' },
  { nome: 'Marcos Vinícius', funcao: 'Eletricista',     ponto: 'Ausente'         },
]

export const rdos = [
  { obra: 'Residencial Bela Vista', data: '30/06', resumo: 'Concretagem do bloco B finalizada. Clima firme. 12 colaboradores em campo.' },
  { obra: 'Edifício Horizonte',     data: '29/06', resumo: 'Atraso na entrega de aço. Estrutura do 8º pavimento aguardando material.' },
  { obra: 'Condomínio Parque Sul',  data: '29/06', resumo: 'Início do acabamento da fachada lateral. Sem intercorrências.' },
]

export const fotos = [
  { obra: 'Bela Vista', legenda: 'Fundação — Bloco B',        quando: 'Hoje, 14:20'    },
  { obra: 'Horizonte',  legenda: 'Estrutura — 8º pavimento',  quando: 'Hoje, 11:05'    },
  { obra: 'Parque Sul', legenda: 'Acabamento — Fachada',      quando: 'Ontem, 16:40'   },
  { obra: 'Bela Vista', legenda: 'Instalações elétricas',     quando: 'Ontem, 09:15'   },
]

export const apps = [
  { id: 'financeiro',   nome: 'Financeiro',      sub: 'Total ERP',    status: 'novo',      icone: 'DollarSign' },
  { id: 'ponto',        nome: 'Ponto & RH',      sub: 'FacePonto',    status: 'novo',      icone: 'Clock'      },
  { id: 'suprimentos',  nome: 'Suprimentos',     sub: 'Trello',       status: 'integrado', icone: 'Package'    },
  { id: 'obras',        nome: 'Galeria de Obras', sub: 'Google Drive', status: 'integrado', icone: 'Camera'     },
  { id: 'rdo',          nome: 'Diário de Obra',  sub: 'Escout',       status: 'novo',      icone: 'FileText'   },
  { id: 'frota',        nome: 'Frota & GPS',     sub: 'Infleet',      status: 'atalho',    icone: 'Truck'      },
]
```

---

## 3. Tokens de Design

Crie `lib/tokens.ts`:

```typescript
export const C = {
  bg:       '#1C1F26',   // fundo geral (grafite escuro)
  bgPanel:  '#23272F',   // sidebar
  bgCard:   '#F5F3EF',   // cards claros
  bgWhite:  '#FFFFFF',
  ink:      '#22252B',   // texto principal
  inkSoft:  '#6B7280',   // texto suave
  border:   '#2E323C',   // bordas escuras
  amber:    '#E8862C',   // acento principal
  amberDim: '#3A2E1F',   // fundo badge amber
  green:    '#3D8361',   // positivo
  greenDim: '#1B2E24',   // fundo badge verde
  red:      '#C4523B',   // negativo
  gold:     '#C9A14A',   // avatar/detalhe
}
```

---

## 4. Componentes Base

### `components/StatusBadge.tsx`

```tsx
import { C } from '@/lib/tokens'

type Status = 'novo' | 'integrado' | 'atalho'

const map: Record<Status, { label: string; bg: string; fg: string }> = {
  novo:      { label: 'Novo módulo',   bg: C.amberDim,  fg: C.amber   },
  integrado: { label: 'API conectada', bg: C.greenDim,  fg: C.green   },
  atalho:    { label: 'Atalho direto', bg: '#2A2D35',   fg: C.inkSoft },
}

export function StatusBadge({ status }: { status: Status }) {
  const s = map[status]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
      textTransform: 'uppercase', padding: '3px 8px',
      borderRadius: 20, background: s.bg, color: s.fg,
    }}>
      {s.label}
    </span>
  )
}
```

---

### `components/KpiCard.tsx`

```tsx
import { LucideIcon } from 'lucide-react'
import { C } from '@/lib/tokens'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Props {
  label: string
  valor: string
  delta?: string
  positivo?: boolean
  icon: LucideIcon
}

export function KpiCard({ label, valor, delta, positivo, icon: Icon }: Props) {
  return (
    <div style={{
      background: C.bgWhite, borderRadius: 16, padding: '18px 20px',
      border: '1px solid #EAE7E0', flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
        <Icon size={16} color={C.inkSoft} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: -0.5 }}>
        {valor}
      </div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {positivo
            ? <ArrowUpRight size={13} color={C.green} />
            : <ArrowDownRight size={13} color={C.red} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: positivo ? C.green : C.red }}>
            {delta}
          </span>
        </div>
      )}
    </div>
  )
}
```

---

### `components/Panel.tsx`

```tsx
import { C } from '@/lib/tokens'
import { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  children: ReactNode
}

export function Panel({ title, action, children }: Props) {
  return (
    <div style={{ background: C.bgWhite, borderRadius: 16, border: '1px solid #EAE7E0', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid #F0EDE6',
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}
```

---

### `components/ApiBadge.tsx`

```tsx
import { C } from '@/lib/tokens'

export function ApiBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: C.green,
      background: C.greenDim, padding: '3px 8px', borderRadius: 20,
    }}>
      API ativa
    </span>
  )
}
```

---

## 5. Layout com Sidebar

### `app/(portal)/layout.tsx`

```tsx
'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid, Wallet, DollarSign, Clock, Package,
  Camera, FileText, Truck, ChevronRight,
} from 'lucide-react'
import { C } from '@/lib/tokens'
import { apps } from '@/lib/mock'
import { StatusBadge } from '@/components/StatusBadge'

const iconMap: Record<string, any> = {
  DollarSign, Clock, Package, Camera, FileText, Truck,
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: 'Inter, sans-serif' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 260, background: C.bgPanel, borderRight: `1px solid ${C.border}`,
        padding: '24px 16px', display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 28 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={18} color={C.bg} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#F0EEE9', letterSpacing: -0.2 }}>Carteira de Apps</div>
            <div style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 600 }}>Construtora · Portal</div>
          </div>
        </div>

        {/* Dashboard link */}
        <button
          onClick={() => router.push('/')}
          style={{
            all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', borderRadius: 10, marginBottom: 4,
            background: pathname === '/' ? '#2A2E38' : 'transparent',
            color: pathname === '/' ? '#F0EEE9' : '#9A9DA5',
            fontSize: 13, fontWeight: 700,
          }}
        >
          <LayoutGrid size={16} /> Visão Geral
        </button>

        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#5A5E68', textTransform: 'uppercase', letterSpacing: 0.8, margin: '18px 8px 10px' }}>
          Meus Aplicativos
        </div>

        {/* App cards */}
        {apps.map(app => {
          const Icon = iconMap[app.icone]
          const active = pathname.startsWith(`/${app.id}`)
          return (
            <button
              key={app.id}
              onClick={() => router.push(`/${app.id}`)}
              style={{
                all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                gap: 10, padding: '16px 14px', borderRadius: 14, marginBottom: 2,
                background: active ? '#2A2E38' : 'transparent',
                border: `1px solid ${active ? C.amber + '55' : 'transparent'}`,
                transition: 'all .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.amber + '22' }}>
                  <Icon size={19} color={C.amber} strokeWidth={2} />
                </div>
                <ChevronRight size={15} color="#4A4E58" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F0EEE9' }}>{app.nome}</div>
                <div style={{ fontSize: 11.5, color: '#80848D', marginTop: 1 }}>substitui {app.sub}</div>
              </div>
              <StatusBadge status={app.status as any} />
            </button>
          )
        })}

        {/* Usuário */}
        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.gold + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: C.gold }}>
              RC
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F0EEE9' }}>Roberto Construtor</div>
              <div style={{ fontSize: 10.5, color: C.inkSoft }}>Diretor de Operações</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: '24px 32px', minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
```

---

## 6. Páginas

### `app/(portal)/page.tsx` — Dashboard

```tsx
import { DollarSign, Building2, HardHat, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Panel } from '@/components/Panel'
import { ApiBadge } from '@/components/ApiBadge'
import { obras, suprimentos, fotos } from '@/lib/mock'
import { C } from '@/lib/tokens'

export default function Dashboard() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Painel principal</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#F0EEE9' }}>Visão Geral</div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <KpiCard label="Saldo do mês"     valor="R$ 184.2k" delta="+12% vs. mês anterior" positivo icon={DollarSign} />
        <KpiCard label="Obras ativas"     valor="3"                                               icon={Building2}  />
        <KpiCard label="Equipe em campo"  valor="42"        delta="98% presença hoje"    positivo icon={HardHat}    />
        <KpiCard label="Pendências"       valor="5"         delta="2 urgentes"                    icon={AlertCircle}/>
      </div>

      {/* Obras + Suprimentos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginBottom: 16 }}>
        <Panel title="Andamento das obras">
          <div style={{ display: 'grid', gap: 14 }}>
            {obras.map(o => (
              <div key={o.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{o.nome}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: o.status === 'Em dia' ? C.greenDim : '#3A2A20',
                    color: o.status === 'Em dia' ? C.green : C.amber,
                  }}>{o.status}</span>
                </div>
                <div style={{ height: 7, borderRadius: 20, background: '#EFEDE7', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${o.progresso}%`, borderRadius: 20, background: o.status === 'Em dia' ? C.green : C.amber }} />
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>{o.progresso}% concluído</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Suprimentos — Trello" action={<ApiBadge />}>
          <div style={{ display: 'grid', gap: 10 }}>
            {suprimentos.map((s, i) => (
              <div key={i} style={{ padding: '10px 12px', background: '#FAF9F6', borderRadius: 10, border: '1px solid #F0EDE6' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{s.titulo}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.inkSoft }}>{s.obra}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber }}>{s.lista}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Fotos */}
      <Panel title="Fotos recentes — Google Drive" action={<ApiBadge />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {fotos.map((f, i) => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #F0EDE6' }}>
              <div style={{ height: 90, background: `linear-gradient(135deg,${C.amber}33,${C.ink}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={22} color={C.amber} />
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{f.legenda}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>{f.obra} · {f.quando}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
```

---

### `app/(portal)/financeiro/page.tsx`

```tsx
import { DollarSign, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Panel } from '@/components/Panel'
import { lancamentos } from '@/lib/mock'
import { C } from '@/lib/tokens'

export default function Financeiro() {
  return (
    <>
      <PageTitle modulo="Módulo" titulo="Financeiro" />
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <KpiCard label="A pagar (mês)"    valor="R$ 96.4k"  icon={ArrowDownRight} />
        <KpiCard label="A receber (mês)"  valor="R$ 142.0k" icon={ArrowUpRight}   />
        <KpiCard label="Saldo projetado"  valor="R$ 45.6k"  delta="+8% vs. previsto" positivo icon={TrendingUp} />
      </div>
      <Panel title="Lançamentos recentes">
        <div style={{ display: 'grid', gap: 8 }}>
          {lancamentos.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 10 }}>
              <span style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{l.descricao}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: l.valor < 0 ? C.red : C.green }}>
                {l.valor < 0 ? '- ' : '+ '}R$ {Math.abs(l.valor).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
```

---

### `app/(portal)/ponto/page.tsx`

```tsx
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Panel } from '@/components/Panel'
import { equipe } from '@/lib/mock'
import { C } from '@/lib/tokens'

export default function Ponto() {
  return (
    <>
      <PageTitle modulo="Módulo" titulo="Ponto & RH" />
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <KpiCard label="Presentes hoje"   valor="41 / 42" delta="98%"  positivo icon={CheckCircle2} />
        <KpiCard label="Horas extras"     valor="186h"                          icon={Clock}        />
        <KpiCard label="Faltas no mês"    valor="3"                             icon={AlertCircle}  />
      </div>
      <Panel title="Equipe — registro de hoje">
        <div style={{ display: 'grid', gap: 8 }}>
          {equipe.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#FAF9F6', borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.nome}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft }}>{p.funcao}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: p.ponto === 'Ausente' ? C.red : C.green }}>{p.ponto}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
```

---

### `app/(portal)/suprimentos/page.tsx`

```tsx
import { Panel } from '@/components/Panel'
import { ApiBadge } from '@/components/ApiBadge'
import { suprimentos } from '@/lib/mock'
import { C } from '@/lib/tokens'

const colunas = ['Pedido', 'Aprovação', 'Entregue']

export default function Suprimentos() {
  return (
    <>
      <PageTitle modulo="Integração Trello" titulo="Suprimentos" />
      <Panel title="Kanban de suprimentos" action={<ApiBadge />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {colunas.map(col => (
            <div key={col}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.inkSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {suprimentos.filter(s => s.lista === col).map((s, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: '#FAF9F6', borderRadius: 10, border: '1px solid #F0EDE6' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{s.titulo}</div>
                    <div style={{ fontSize: 10.5, color: C.inkSoft }}>{s.obra}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
```

---

### `app/(portal)/obras/page.tsx`

```tsx
import { Image as ImageIcon } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { ApiBadge } from '@/components/ApiBadge'
import { fotos } from '@/lib/mock'
import { C } from '@/lib/tokens'

export default function Obras() {
  return (
    <>
      <PageTitle modulo="Integração Google Drive" titulo="Galeria de Obras" />
      <Panel title="Fotos por obra" action={<ApiBadge />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[...fotos, ...fotos].map((f, i) => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #F0EDE6' }}>
              <div style={{ height: 100, background: `linear-gradient(135deg,${C.amber}33,${C.ink}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={22} color={C.amber} />
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{f.legenda}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>{f.obra} · {f.quando}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
```

---

### `app/(portal)/rdo/page.tsx`

```tsx
import { Plus } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { rdos } from '@/lib/mock'
import { C } from '@/lib/tokens'

export default function RDO() {
  return (
    <>
      <PageTitle modulo="Módulo" titulo="Diário de Obra" />
      <Panel
        title="Registros recentes"
        action={
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: C.amber, cursor: 'pointer' }}>
            <Plus size={14} /> Novo RDO
          </span>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {rdos.map((r, i) => (
            <div key={i} style={{ padding: '14px 16px', background: '#FAF9F6', borderRadius: 10, border: '1px solid #F0EDE6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{r.obra}</span>
                <span style={{ fontSize: 11.5, color: C.inkSoft }}>{r.data}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#4A4E58', lineHeight: 1.5 }}>{r.resumo}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
```

---

### `app/(portal)/frota/page.tsx`

```tsx
import { Truck, ExternalLink } from 'lucide-react'
import { C } from '@/lib/tokens'

export default function Frota() {
  return (
    <>
      <PageTitle modulo="Atalho direto" titulo="Frota & GPS" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: '#FFFFFF', borderRadius: 16, border: '1px solid #EAE7E0', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#EFEDE7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Truck size={28} color={C.inkSoft} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 6 }}>Acesso direto ao Infleet</div>
        <div style={{ fontSize: 13, color: C.inkSoft, maxWidth: 340, lineHeight: 1.5, marginBottom: 18 }}>
          O Infleet continua sendo usado normalmente. O portal centraliza o acesso — clique para abrir em uma nova aba, sem precisar guardar outro link.
        </div>
        <a
          href="https://app.infleet.com.br"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: C.ink, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
        >
          Abrir Infleet <ExternalLink size={14} />
        </a>
      </div>
    </>
  )
}
```

---

## 7. Componente auxiliar PageTitle

Crie `components/PageTitle.tsx` e use em todas as páginas:

```tsx
import { C } from '@/lib/tokens'

export function PageTitle({ modulo, titulo }: { modulo: string; titulo: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {modulo}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#F0EEE9' }}>{titulo}</div>
    </div>
  )
}
```

> Lembre de importar `PageTitle` em todas as páginas acima onde ele é referenciado.

---

## 8. Deploy no Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Seguir as instruções no terminal
# O link gerado pode ser enviado ao cliente diretamente
```

---

## Resumo do que o protótipo entrega

| Tela | O que mostra |
|---|---|
| Visão Geral | KPIs, andamento de obras, widget Trello, widget Drive |
| Financeiro | KPIs financeiros, lista de lançamentos |
| Ponto & RH | Presença, horas extras, registro do dia |
| Suprimentos | Kanban sincronizado com Trello (mock) |
| Galeria de Obras | Grid de fotos por obra (mock Drive) |
| Diário de Obra | Lista de RDOs por data |
| Frota & GPS | Atalho direto para Infleet |
