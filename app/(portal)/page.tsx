'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPortalPage() {
  const router = useRouter()

  useEffect(() => {
    // Redireciona diretamente para o módulo ativo (/financeiro)
    router.replace('/financeiro')
  }, [router])

  return null
}
