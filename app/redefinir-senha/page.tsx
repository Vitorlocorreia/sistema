'use client'

import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  ShieldCheck,
  ArrowRight,
  KeyRound
} from 'lucide-react'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [sessaoValida, setSessaoValida] = useState(false)
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  // Canvas de partículas animadas em background
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const setSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    setSize()

    type Particle = { x: number; y: number; v: number; o: number }
    let particles: Particle[] = []
    let raf = 0

    const makeParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    })

    const init = () => {
      particles = []
      const count = Math.floor((canvas.width * canvas.height) / 9000)
      for (let i = 0; i < count; i++) particles.push(makeParticle())
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.y -= p.v
        if (p.y < 0) {
          p.x = Math.random() * canvas.width
          p.y = canvas.height + Math.random() * 40
          p.v = Math.random() * 0.25 + 0.05
          p.o = Math.random() * 0.35 + 0.15
        }
        ctx.fillStyle = `rgba(245, 158, 11, ${p.o * 0.7})`
        ctx.fillRect(p.x, p.y, 0.8, 2.2)
      })
      raf = requestAnimationFrame(draw)
    }

    const onResize = () => {
      setSize()
      init()
    }

    window.addEventListener('resize', onResize)
    init()
    raf = requestAnimationFrame(draw)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Verifica se o usuário chegou pelo link de recuperação do Supabase
  useEffect(() => {
    async function checarSessao() {
      setVerificandoSessao(true)

      // 0. Se vier via PKCE (?code=...)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error && data?.session?.user) {
              setSessaoValida(true)
              setEmailUsuario(data.session.user.email || null)
              setVerificandoSessao(false)
              return
            }
          } catch { }
        }
      }

      // 1. Escuta o evento PASSWORD_RECOVERY ou sessão ativa
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (session && session.user)) {
          setSessaoValida(true)
          setEmailUsuario(session?.user?.email || null)
          setVerificandoSessao(false)
        }
      })

      // 2. Checa se já existe sessão ativa
      const { data: { session } } = await supabase.auth.getSession()
      if (session && session.user) {
        setSessaoValida(true)
        setEmailUsuario(session.user.email || null)
        setVerificandoSessao(false)
      } else {
        // Se a URL tiver hash com tokens de recuperação, o Supabase processa automaticamente em instantes
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          if (s2 && s2.user) {
            setSessaoValida(true)
            setEmailUsuario(s2.user.email || null)
          } else {
            setSessaoValida(false)
          }
          setVerificandoSessao(false)
        }, 1500)
      }

      return () => {
        authListener.subscription.unsubscribe()
      }
    }

    checarSessao()
  }, [])

  async function handleRedefinirSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!novaSenha.trim() || novaSenha.length < 6) {
      setErro('A nova senha deve conter no mínimo 6 caracteres.')
      return
    }

    if (novaSenha !== confirmaSenha) {
      setErro('As senhas digitadas não coincidem.')
      return
    }

    setLoading(true)

    try {
      // 1. Atualiza diretamente a senha no Supabase Auth
      const { data: userData, error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (updateError) {
        setErro(updateError.message || 'Erro ao redefinir a senha no Supabase.')
        setLoading(false)
        return
      }

      // 2. Atualiza também a tabela legada 'colaboradores' para manter consistência total
      const userEmail = userData.user?.email || emailUsuario
      if (userEmail) {
        try {
          await supabase
            .from('colaboradores')
            .update({ senha: novaSenha })
            .eq('email', userEmail.toLowerCase())
        } catch {
          // Fallback silencioso caso a tabela use apenas o Auth
        }
      }

      // 3. Desconecta a sessão temporária de recuperação para forçar novo login limpo
      await supabase.auth.signOut()

      setSucesso(true)
      setLoading(false)
    } catch {
      setErro('Ocorreu um erro inesperado ao conectar com o Supabase.')
      setLoading(false)
    }
  }

  return (
    <section className="fixed inset-0 bg-[#090A0E] text-zinc-100 flex flex-col justify-between overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200">
      <style>{`
        .card-animate {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.7s cubic-bezier(.22,.61,.36,1) 0.2s forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .accent-lines { position: absolute; inset: 0; pointer-events: none; opacity: .45; }
        .hline, .vline { position: absolute; background: #1F2430; will-change: transform, opacity; }
        .hline { left: 0; right: 0; height: 1px; transform: scaleX(0); transform-origin: 50% 50%; animation: drawX .8s cubic-bezier(.22,.61,.36,1) forwards; }
        .vline { top: 0; bottom: 0; width: 1px; transform: scaleY(0); transform-origin: 50% 0%; animation: drawY .9s cubic-bezier(.22,.61,.36,1) forwards; }
        .hline:nth-child(1) { top: 15%; animation-delay: .08s; }
        .hline:nth-child(2) { top: 50%; animation-delay: .18s; }
        .hline:nth-child(3) { top: 85%; animation-delay: .28s; }
        .vline:nth-child(4) { left: 18%; animation-delay: .15s; }
        .vline:nth-child(5) { left: 50%; animation-delay: .25s; }
        .vline:nth-child(6) { left: 82%; animation-delay: .35s; }
        @keyframes drawX { 0% { transform: scaleX(0); opacity: 0; } 60% { opacity: .9; } 100% { transform: scaleX(1); opacity: .45; } }
        @keyframes drawY { 0% { transform: scaleY(0); opacity: 0; } 60% { opacity: .9; } 100% { transform: scaleY(1); opacity: .45; } }
      `}</style>

      {/* Background glow e grid */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(70%_55%_at_50%_25%,rgba(245,158,11,0.07),transparent_70%)]" />
      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen pointer-events-none"
      />

      {/* Header bar */}
      <header className="relative z-10 w-full flex items-center justify-between px-6 py-5 border-b border-zinc-800/60 bg-[#090A0E]/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-4 h-4 text-zinc-950 font-bold" />
          </div>
          <span className="text-xs font-bold tracking-[0.18em] uppercase text-zinc-300">
            Portal da Construtora
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          <span>Redefinição Segura</span>
        </div>
      </header>

      {/* Center Card */}
      <div className="relative z-10 w-full my-auto flex items-center justify-center p-4 py-8">
        <div className="card-animate w-full max-w-md bg-[#12141C]/85 border border-[#1E2230] rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/80 backdrop-blur-xl">
          
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-amber-500/10">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-50">
              Redefinir Senha
            </h1>
            <p className="text-xs text-zinc-400 mt-1.5">
              {emailUsuario ? (
                <>Defina a nova senha para o usuário <strong className="text-amber-400">{emailUsuario}</strong></>
              ) : (
                'Crie uma nova senha de acesso segura para a sua conta'
              )}
            </p>
          </div>

          {verificandoSessao ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-zinc-400">Validando link de recuperação...</p>
            </div>
          ) : sucesso ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Senha Alterada com Sucesso!</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Sua senha foi atualizada no Supabase. Você já pode fazer login com suas novas credenciais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ir para o Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : !sessaoValida ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Link Expirado ou Inválido</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  O token de recuperação de senha não foi encontrado ou expirou. Por favor, solicite um novo link de recuperação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="w-full py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Voltar para o Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRedefinirSenha} className="space-y-4">
              {/* Nova Senha */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Nova Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#090A0E] border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Nova Senha */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Confirmar Nova Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    required
                    placeholder="Repita a nova senha"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#090A0E] border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                  />
                </div>
              </div>

              {erro && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-semibold text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Atualizando Senha no Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Salvar Nova Senha</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <footer className="relative z-10 w-full py-4 text-center text-[11px] text-zinc-500 border-t border-zinc-800/40">
        Portal de Engenharia & Gestão Corporativa · Redefinição Segura de Credenciais
      </footer>
    </section>
  )
}
