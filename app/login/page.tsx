'use client'

import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  ArrowLeft
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'solicitar' | 'recuperar'>('login')

  // Login States
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Solicitar Acesso States
  const [nomeSol, setNomeSol] = useState('')
  const [emailSol, setEmailSol] = useState('')
  const [senhaSol, setSenhaSol] = useState('')
  const [showSenhaSol, setShowSenhaSol] = useState(false)
  const [mensagemSol, setMensagemSol] = useState('')
  const [sucessoSol, setSucessoSol] = useState(false)

  // Recuperar Senha States
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [sucessoRecuperar, setSucessoRecuperar] = useState(false)

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: senha,
      })

      if (!authError && authData.user) {
        const profileResult = await supabase
          .from('colaboradores')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (profileResult.error || !profileResult.data) {
          await supabase.auth.signOut()
          setErro('Usuário autenticado, mas o perfil de colaborador não foi encontrado.')
          setLoading(false)
          return
        }
        localStorage.setItem('sessao_auth_segura', 'true')
        localStorage.setItem('colaborador_sessao', JSON.stringify(profileResult.data))
        localStorage.setItem('perfil_ativo', profileResult.data.cargo)
        router.replace('/')
        return
      }

      // Autenticação legada / protótipo
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('senha', senha)
        .single()

      if (error || !data) {
        setErro('E-mail ou senha inválidos.')
        setLoading(false)
        return
      }

      localStorage.setItem('sessao_auth_segura', authError ? 'false' : 'true')
      localStorage.setItem('colaborador_sessao', JSON.stringify(data))
      localStorage.setItem('perfil_ativo', data.cargo)
      router.replace('/')
    } catch {
      setErro('Erro ao conectar. Verifique sua conexão e tente novamente.')
      setLoading(false)
    }
  }

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)

    if (!nomeSol.trim() || !emailSol.trim() || !senhaSol.trim()) {
      setErro('Preencha os campos obrigatórios (*).')
      setLoading(false)
      return
    }

    if (senhaSol.trim().length < 6) {
      setErro('A senha deve conter no mínimo 6 caracteres.')
      setLoading(false)
      return
    }

    try {
      const { data: colExistente } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('email', emailSol.trim().toLowerCase())
        .maybeSingle()

      if (colExistente) {
        setErro('Este e-mail já está cadastrado no sistema.')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('solicitacoes_acesso')
        .insert({
          nome: nomeSol.trim(),
          email: emailSol.trim().toLowerCase(),
          senha_provisoria: senhaSol,
          cargo_solicitado: 'operador',
          empresa_id: null,
          mensagem: mensagemSol.trim() || null,
          status: 'pendente',
        })

      if (error) {
        setErro('Erro ao enviar solicitação: ' + error.message)
        setLoading(false)
        return
      }

      setSucessoSol(true)
      setLoading(false)
    } catch {
      setErro('Erro de rede ao processar solicitação.')
      setLoading(false)
    }
  }

  async function handleRecuperarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!emailRecuperar.trim()) {
      setErro('Informe o seu e-mail cadastrado.')
      return
    }

    setLoading(true)

    try {
      const redirectUrl = `${window.location.origin}/redefinir-senha`
      const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperar.trim().toLowerCase(), {
        redirectTo: redirectUrl,
      })

      if (error) {
        setErro('Erro ao solicitar redefinição: ' + error.message)
        setLoading(false)
        return
      }

      setSucessoRecuperar(true)
      setLoading(false)
    } catch {
      setErro('Erro ao conectar com o serviço de autenticação.')
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
        .tab-panel { transition: opacity .24s ease, transform .24s ease; }
      `}</style>

      {/* Subtle vignette radial & Amber glow */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(70%_55%_at_50%_25%,rgba(245,158,11,0.07),transparent_70%)]" />

      {/* Animated accent grid lines */}
      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      {/* Particles canvas */}
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
          <span>Ambiente Seguro</span>
        </div>
      </header>

      {/* Center Container */}
      <div className="relative z-10 w-full my-auto flex items-center justify-center p-4 py-8">
        <div className="card-animate w-full max-w-md bg-[#12141C]/85 border border-[#1E2230] rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/80 backdrop-blur-xl">
          
          {/* Card Title & Desc */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight text-zinc-50">
              {tab === 'login' && 'Acessar o Sistema'}
              {tab === 'solicitar' && 'Solicitar Conta'}
              {tab === 'recuperar' && 'Recuperar Senha'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1.5">
              {tab === 'login' && 'Informe suas credenciais para gerenciar obras e finanças'}
              {tab === 'solicitar' && 'Preencha seus dados para análise do Administrador Geral'}
              {tab === 'recuperar' && 'Enviaremos um link direto para você cadastrar uma nova senha'}
            </p>
          </div>

          {/* Switch Tabs com 3 opções: Entrar, Criar Conta e Esqueci Senha */}
          <div className="grid grid-cols-3 p-1 bg-[#090A0E] border border-zinc-800/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); setErro(null); setSucessoRecuperar(false) }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setTab('solicitar'); setErro(null); setSucessoRecuperar(false) }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'solicitar'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => { setTab('recuperar'); setErro(null); setSucessoRecuperar(false) }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'recuperar'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Recuperar
            </button>
          </div>

          {/* TAB: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="tab-panel space-y-4">
              {/* E-mail */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu.email@construtora.com.br"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#090A0E] border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailRecuperar(email)
                      setTab('recuperar')
                      setErro(null)
                      setSucessoRecuperar(false)
                    }}
                    className="text-[11px] text-amber-500 hover:text-amber-400 transition-colors cursor-pointer font-medium"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    placeholder="••••••••"
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

              {/* Erro */}
              {erro && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-semibold text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB: RECUPERAR SENHA */}
          {tab === 'recuperar' && (
            <div className="tab-panel">
              {sucessoRecuperar ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">E-mail Enviado!</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Enviamos as instruções para <strong className="text-amber-400">{emailRecuperar}</strong>. Acesse o link no seu e-mail para cadastrar sua nova senha.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login')
                      setSucessoRecuperar(false)
                      setErro(null)
                    }}
                    className="mt-2 w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecuperarSenha} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      E-mail Cadastrado *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        value={emailRecuperar}
                        onChange={(e) => setEmailRecuperar(e.target.value)}
                        required
                        placeholder="seu.email@construtora.com.br"
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
                        <span>Enviando Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar Link de Recuperação</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTab('login')
                      setErro(null)
                    }}
                    className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para o Login</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB: SOLICITAR CONTA */}
          {tab === 'solicitar' && (
            <div className="tab-panel">
              {sucessoSol ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">Solicitação Enviada!</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Seu pedido de cadastro foi registrado. Assim que o Administrador Geral aprovar, você poderá realizar seu login.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSucessoSol(false)
                      setTab('login')
                      setNomeSol('')
                      setEmailSol('')
                      setSenhaSol('')
                      setMensagemSol('')
                    }}
                    className="mt-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Voltar para o Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSolicitar} className="space-y-3.5">
                  {/* Nome Completo */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Nome Completo *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={nomeSol}
                        onChange={(e) => setNomeSol(e.target.value)}
                        required
                        placeholder="Ex: Vitor Correia"
                        className="w-full pl-10 pr-3.5 py-2 bg-[#090A0E] border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* E-mail */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      E-mail de Acesso *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        value={emailSol}
                        onChange={(e) => setEmailSol(e.target.value)}
                        required
                        placeholder="seu.email@construtora.com.br"
                        className="w-full pl-10 pr-3.5 py-2 bg-[#090A0E] border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Senha Desejada */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Senha Desejada *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showSenhaSol ? 'text' : 'password'}
                        value={senhaSol}
                        onChange={(e) => setSenhaSol(e.target.value)}
                        required
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-10 py-2 bg-[#090A0E] border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenhaSol((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showSenhaSol ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Justificativa */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Justificativa / Motivo (Opcional)
                    </label>
                    <textarea
                      value={mensagemSol}
                      onChange={(e) => setMensagemSol(e.target.value)}
                      placeholder="Ex: Engenheiro responsável pela obra Horizon Tower..."
                      rows={2}
                      className="w-full p-2.5 bg-[#090A0E] border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors resize-none"
                    />
                  </div>

                  {erro && (
                    <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-semibold text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{erro}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs tracking-wide shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar Solicitação</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-[11px] text-zinc-500 border-t border-zinc-800/40">
        Portal de Engenharia & Gestão Corporativa · Todos os direitos reservados
      </footer>
    </section>
  )
}
