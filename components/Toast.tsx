'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react'
import { C } from '@/lib/tokens'
import { motion, AnimatePresence } from 'motion/react'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

// Global queue
let _listeners: ((items: ToastItem[]) => void)[] = []
let _items: ToastItem[] = []

export function toast(message: string, type: ToastType = 'success') {
  const id = Math.random().toString(36).slice(2)
  _items = [..._items, { id, message, type }]
  _listeners.forEach(fn => fn(_items))
  setTimeout(() => {
    _items = _items.filter(t => t.id !== id)
    _listeners.forEach(fn => fn(_items))
  }, 3500)
}

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: X,
  info: Info,
}

const colorMap = {
  success: C.green,
  warning: C.amber,
  error: '#EF4444',
  info: '#3B82F6',
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    _listeners.push(setItems)
    return () => { _listeners = _listeners.filter(fn => fn !== setItems) }
  }, [])

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none'
    }}>
      <AnimatePresence>
        {items.map(item => {
          const Icon = iconMap[item.type]
          const color = colorMap[item.type]
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#1A1D26', border: `1px solid ${color}44`,
                borderLeft: `3px solid ${color}`,
                padding: '12px 16px', borderRadius: 2,
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}11`,
                pointerEvents: 'auto', minWidth: 280, maxWidth: 380,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Icon size={16} color={color} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', lineHeight: 1.4 }}>
                {item.message}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
