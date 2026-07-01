'use client'
import { useState, useRef, ReactNode } from 'react'
import { RotateCcw, ArrowLeft, ArrowRight, ExternalLink, Globe, AlertTriangle } from 'lucide-react'
import { C } from '@/lib/tokens'

interface EmbeddedBrowserProps {
  defaultUrl: string
  shortcutLabel: string
  shortcutIcon: ReactNode
  accentColor?: string
}

export function EmbeddedBrowser({ defaultUrl, shortcutLabel, shortcutIcon, accentColor = C.amber }: EmbeddedBrowserProps) {
  const [url, setUrl] = useState(defaultUrl)
  const [inputUrl, setInputUrl] = useState(defaultUrl)
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function navigate(target: string) {
    let full = target.trim()
    if (!full.startsWith('http://') && !full.startsWith('https://')) {
      full = 'https://' + full
    }
    setUrl(full)
    setInputUrl(full)
    setBlocked(false)
    setLoading(true)
    setKey(k => k + 1)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(inputUrl)
  }

  function handleLoad() {
    setLoading(false)
  }

  function handleError() {
    setLoading(false)
    setBlocked(true)
  }

  const accent = accentColor

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px',
        background: C.bgPanel,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>

        {/* Nav */}
        {(['back', 'fwd', 'reload'] as const).map(action => (
          <button
            key={action}
            title={action === 'back' ? 'Voltar' : action === 'fwd' ? 'Avançar' : 'Atualizar'}
            onClick={() => {
              if (action === 'back')   iframeRef.current?.contentWindow?.history.back()
              if (action === 'fwd')    iframeRef.current?.contentWindow?.history.forward()
              if (action === 'reload') { setBlocked(false); setLoading(true); setKey(k => k + 1) }
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.inkSoft, padding: '4px 7px', borderRadius: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            {action === 'back'   && <ArrowLeft  size={15} />}
            {action === 'fwd'    && <ArrowRight size={15} />}
            {action === 'reload' && <RotateCcw  size={14} />}
          </button>
        ))}

        {/* URL bar */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: '#0B0C0E',
            border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '5px 12px',
          }}>
            <Globe size={13} color={C.inkSoft} style={{ flexShrink: 0 }} />
            <input
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: C.ink, fontSize: 12,
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              }}
              placeholder="https://..."
            />
          </div>
        </form>

        {/* App shortcut */}
        <button
          onClick={() => navigate(defaultUrl)}
          title={`Ir para ${shortcutLabel}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: accent + '18', border: `1px solid ${accent}44`,
            color: accent, fontSize: 11, fontWeight: 800,
            padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
            letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}
        >
          {shortcutIcon}
          {shortcutLabel}
        </button>

        {/* Open in tab */}
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          title="Abrir em nova aba"
          style={{
            display: 'flex', alignItems: 'center',
            border: `1px solid ${C.border}`, borderRadius: 5,
            color: C.inkSoft, padding: '5px 8px',
          }}
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, position: 'relative', background: '#fff' }}>

        {/* Loading bar */}
        {loading && !blocked && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 3, zIndex: 10,
            background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
          }} />
        )}

        {blocked ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: C.bgPanel, gap: 16, padding: 32, textAlign: 'center',
          }}>
            <AlertTriangle size={40} color={accent} />
            <div style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>
              Este site não permite abertura em frame
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, maxWidth: 380, lineHeight: 1.65 }}>
              O site <strong style={{ color: C.ink }}>{url}</strong> bloqueia a incorporação
              por questões de segurança (X-Frame-Options). Use o botão abaixo para abrir em nova aba.
            </div>
            <a
              href={url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', borderRadius: 6,
                background: accent, color: '#0B0C0E',
                fontSize: 12, fontWeight: 900,
                textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 0.5,
              }}
            >
              Abrir em Nova Aba <ExternalLink size={14} />
            </a>
            <p style={{ fontSize: 11, color: C.inkSoft }}>
              Você também pode digitar qualquer endereço na barra acima.
            </p>
          </div>
        ) : (
          <iframe
            key={key}
            ref={iframeRef}
            src={url}
            onLoad={handleLoad}
            onError={handleError}
            style={{ width: '100%', height: '100%', border: 'none', minHeight: 'calc(100vh - 108px)' }}
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
            title="Navegador embutido"
          />
        )}
      </div>
    </div>
  )
}
