'use client'
import { Truck } from 'lucide-react'
import { EmbeddedBrowser } from '@/components/EmbeddedBrowser'
import { C } from '@/lib/tokens'

export default function Frota() {
  return (
    <EmbeddedBrowser
      defaultUrl="https://app.infleet.com.br"
      shortcutLabel="Infleet"
      shortcutIcon={<Truck size={13} />}
      accentColor={C.amber}
    />
  )
}
