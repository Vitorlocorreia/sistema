'use client'

import { useState, useCallback, ReactNode } from 'react'
import { ConfirmModal } from '@/components/ConfirmModal'

export function useConfirm() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<{
    title: string
    description: string
    confirmLabel?: string
    confirmColor?: string
    resolve?: (value: boolean) => void
    children?: ReactNode
  } | null>(null)

  const confirm = useCallback((title: string, description: string, options?: { confirmLabel?: string, confirmColor?: string, children?: ReactNode }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig({
        title,
        description,
        confirmLabel: options?.confirmLabel,
        confirmColor: options?.confirmColor,
        children: options?.children,
        resolve
      })
      setOpen(true)
    })
  }, [])

  const handleConfirm = () => {
    setOpen(false)
    if (config?.resolve) config.resolve(true)
  }

  const handleCancel = () => {
    setOpen(false)
    if (config?.resolve) config.resolve(false)
  }

  const ConfirmDialog = config ? (
    <ConfirmModal
      open={open}
      title={config.title}
      description={config.description}
      confirmLabel={config.confirmLabel}
      confirmColor={config.confirmColor}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    >
      {config.children}
    </ConfirmModal>
  ) : null

  return { confirm, ConfirmDialog }
}
