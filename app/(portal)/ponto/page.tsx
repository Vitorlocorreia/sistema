'use client'
import { Clock } from 'lucide-react'
import { EmbeddedBrowser } from '@/components/EmbeddedBrowser'
import { C } from '@/lib/tokens'

export default function Ponto() {
  return (
    <EmbeddedBrowser
      defaultUrl="https://faceponto.com.br"
      shortcutLabel="FacePonto"
      shortcutIcon={<Clock size={13} />}
      accentColor={C.green}
    />
  )
}
