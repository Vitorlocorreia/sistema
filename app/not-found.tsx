'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  useEffect(() => {
    // Se o usuário caiu em uma página inexistente (como /**) mas o link contém token de recuperação do Supabase
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash.includes('type=recovery') || (hash.includes('access_token') && hash.includes('refresh_token'))) {
        router.replace('/redefinir-senha' + hash)
      }
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[#090A0E] text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-4 bg-[#12141C] border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-50">404</h1>
        <h2 className="text-base font-bold text-zinc-200">Página Não Encontrada</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          O endereço que você tentou acessar não existe ou foi movido.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors mt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para o Login</span>
        </Link>
      </div>
    </div>
  )
}
