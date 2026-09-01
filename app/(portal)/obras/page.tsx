'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ObrasPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/financeiro?tab=obras')
  }, [router])
  return null
}

