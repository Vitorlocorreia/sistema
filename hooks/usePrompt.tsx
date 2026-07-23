'use client'

import { useState, useCallback } from 'react'
import { C } from '@/lib/tokens'

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const panel: React.CSSProperties = {
  background: '#13151A', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: 24, width: 400, maxWidth: '90vw',
  display: 'grid', gap: 16,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0B0C0E', color: C.ink,
  border: `1px solid ${C.border}`, borderRadius: 5,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  resize: 'vertical', minHeight: 72, fontFamily: 'inherit',
}
const btn = (primary?: boolean): React.CSSProperties => ({
  border: primary ? 0 : `1px solid ${C.border}`,
  borderRadius: 5, padding: '9px 16px', fontSize: 12, fontWeight: 700,
  cursor: 'pointer',
  background: primary ? C.red : 'transparent',
  color: primary ? '#fff' : C.inkSoft,
})

/**
 * Modal React substituto do window.prompt() — compatível com Firefox e
 * bloqueadores de pop-up. Retorna a string digitada ou null se cancelado.
 */
export function usePrompt() {
  const [state, setState] = useState<{
    title: string
    description?: string
    placeholder?: string
    confirmLabel?: string
    value: string
    resolve: (v: string | null) => void
  } | null>(null)

  const prompt = useCallback(
    (title: string, options?: { description?: string; placeholder?: string; confirmLabel?: string }): Promise<string | null> => {
      return new Promise((resolve) => {
        setState({
          title,
          description: options?.description,
          placeholder: options?.placeholder ?? 'Digite aqui…',
          confirmLabel: options?.confirmLabel ?? 'Confirmar',
          value: '',
          resolve,
        })
      })
    },
    [],
  )

  const handleConfirm = () => {
    if (!state) return
    const v = state.value.trim()
    if (!v) return // não fecha sem texto
    state.resolve(v)
    setState(null)
  }

  const handleCancel = () => {
    if (!state) return
    state.resolve(null)
    setState(null)
  }

  const PromptDialog = state ? (
    <div style={overlay} onClick={handleCancel}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.ink }}>{state.title}</p>
          {state.description && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{state.description}</p>
          )}
        </div>
        <textarea
          autoFocus
          style={inputStyle}
          placeholder={state.placeholder}
          value={state.value}
          onChange={e => setState(s => s ? { ...s, value: e.target.value } : s)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleConfirm() }}
        />
        <p style={{ margin: 0, fontSize: 10, color: C.inkSoft }}>Ctrl + Enter para confirmar</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={btn()} onClick={handleCancel}>Cancelar</button>
          <button style={btn(true)} disabled={!state.value.trim()} onClick={handleConfirm}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { prompt, PromptDialog }
}
