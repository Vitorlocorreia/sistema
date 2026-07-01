'use client'
import { DollarSign } from 'lucide-react'
import { EmbeddedBrowser } from '@/components/EmbeddedBrowser'
import { C } from '@/lib/tokens'

export default function Financeiro() {
  return (
    <EmbeddedBrowser
      defaultUrl="https://totalerp.com.br"
      shortcutLabel="Total ERP"
      shortcutIcon={<DollarSign size={13} />}
      accentColor={C.amber}
    />
  )
}
