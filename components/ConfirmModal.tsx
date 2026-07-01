'use client'

import { ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { C } from '@/lib/tokens'
import { motion, AnimatePresence } from 'motion/react'

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmModal({
  open, title, description, confirmLabel = 'Confirmar',
  confirmColor = C.amber, onConfirm, onCancel, children
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1A1D26', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: 24, maxWidth: 420, width: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 2,
                  background: `${confirmColor}18`, border: `1px solid ${confirmColor}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={18} color={confirmColor} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 900, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {title}
                </span>
              </div>
              <button
                onClick={onCancel}
                style={{ all: 'unset', cursor: 'pointer', color: C.inkSoft, padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Description */}
            <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, marginBottom: children ? 16 : 24 }}>
              {description}
            </p>

            {/* Optional extra content (e.g. review summary) */}
            {children && (
              <div style={{ marginBottom: 24 }}>{children}</div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                style={{
                  all: 'unset', cursor: 'pointer',
                  padding: '9px 18px', borderRadius: 2,
                  border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 800,
                  color: C.inkSoft, background: C.bgCard,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                style={{
                  all: 'unset', cursor: 'pointer',
                  padding: '9px 18px', borderRadius: 2, fontSize: 12, fontWeight: 900,
                  background: confirmColor, color: '#0B0C0E', letterSpacing: 0.3,
                  textTransform: 'uppercase',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
