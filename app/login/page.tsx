'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
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
  ArrowLeft,
  Check,
  ExternalLink
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

  // Detecção de link de recuperação caso o Supabase redirecione para /login
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      router.replace('/redefinir-senha' + window.location.hash)
      return
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/redefinir-senha')
      }
    })
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

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
    <main data-theme="dark" className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-[#1E1E1E] text-white selection:bg-[#FFE500] selection:text-[#0A0A0A] font-sans">
      
      {/* ── LEFT HERO BANNER (CLEAN ARCHITECTURAL IMAGE SIDE - FIXED RATIO) */}
      <section className="relative hidden lg:flex lg:w-[50%] xl:w-[55%] h-full flex-shrink-0 flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-[#2E2E2E]">
        {/* Background Image: Full photo with subtle dark gradient */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('/login-bg.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1E1E1E]/85 via-transparent to-[#1E1E1E]/90 pointer-events-none" />

        {/* Top Header on Hero */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-jwa.png" alt="JWA Engenharia" className="h-8 w-auto object-contain drop-shadow" />
            <div className="border-l border-white/20 pl-3">
              <span className="font-extrabold text-xs tracking-wider uppercase text-white block">
                Portal Construtora
              </span>
              <span className="text-[9.5px] text-[#FFE500] font-black tracking-widest uppercase block">
                JWA Engenharia
              </span>
            </div>
          </div>
        </div>

        {/* Center Space: completely clean to highlight the photo & JWA mark */}
        <div className="my-auto pointer-events-none" />

        {/* Hero Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-300 pt-5 border-t border-white/20">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} JWA Engenharia.</span>
            <span className="text-zinc-400">Todos os direitos reservados.</span>
          </div>
          <a 
            href="https://www.jwasa.com.br" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[#FFE500] hover:text-white font-bold transition-colors"
          >
            <span>www.jwasa.com.br</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* ── RIGHT FORM CONTAINER (CLEAN CANVAS - NO BOXES - FIXED HEIGHT) ─ */}
      <section className="flex-1 h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 overflow-y-auto bg-[#1E1E1E]">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between pb-6 border-b border-[#2E2E2E]">
          <div className="flex items-center gap-2.5">
            <img src="/logo-jwa.png" alt="JWA Engenharia" className="h-7 w-auto object-contain" />
            <div className="border-l border-[#2E2E2E] pl-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-white block">Portal Construtora</span>
              <span className="text-[9px] text-[#FFE500] font-black uppercase tracking-widest block">JWA Engenharia</span>
            </div>
          </div>
        </div>

        {/* Center Form Section (No Outer Box - Clean Style) */}
        <div className="my-auto w-full max-w-md mx-auto py-6">
          
          {/* Header & Title */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-1.5 bg-[#FFE500] rounded-sm" />
              <div className="w-5 h-1.5 bg-white rounded-sm" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#FFE500]">
                JWA Engenharia
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-display">
              {tab === 'login' && 'Acessar o Sistema'}
              {tab === 'solicitar' && 'Solicitar Acesso'}
              {tab === 'recuperar' && 'Recuperar Senha'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              {tab === 'login' && 'Informe suas credenciais corporativas para gerenciar obras e finanças.'}
              {tab === 'solicitar' && 'Preencha seus dados para solicitação de cadastro junto à diretoria.'}
              {tab === 'recuperar' && 'Enviaremos um link de redefinição direto para o seu e-mail.'}
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-3 p-1 bg-[#252525] border border-[#333333] rounded-xl mb-7">
            <button
              type="button"
              onClick={() => { setTab('login'); setErro(null); setSucessoRecuperar(false) }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-[#FFE500] text-[#0A0A0A] font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setTab('solicitar'); setErro(null); setSucessoRecuperar(false) }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'solicitar'
                  ? 'bg-[#FFE500] text-[#0A0A0A] font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => { setTab('recuperar'); setErro(null); setSucessoRecuperar(false) }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'recuperar'
                  ? 'bg-[#FFE500] text-[#0A0A0A] font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Recuperar
            </button>
          </div>

          {/* ── TAB 1: LOGIN ────────────────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu.nome@jwasa.com.br"
                    className="w-full pl-10 pr-3.5 py-3.5 bg-[#252525] border border-[#383838] rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
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
                    className="text-[11px] text-[#F59E0B] hover:text-[#FFE500] transition-colors cursor-pointer font-bold"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3.5 bg-[#252525] border border-[#383838] rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1 cursor-pointer"
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {erro && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3.5 rounded-xl bg-[#FFE500] hover:bg-[#F59E0B] text-[#0A0A0A] font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#0A0A0A]" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── TAB 2: RECUPERAR SENHA ───────────────────────────────── */}
          {tab === 'recuperar' && (
            <div>
              {sucessoRecuperar ? (
                <div className="text-center py-6 space-y-4 bg-[#252525] border border-[#383838] rounded-xl p-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">E-mail Enviado!</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Enviamos as instruções para <strong className="text-[#FFE500]">{emailRecuperar}</strong>. Acesse o link no seu e-mail para cadastrar sua nova senha.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login')
                      setSucessoRecuperar(false)
                      setErro(null)
                    }}
                    className="mt-2 w-full py-3 rounded-xl bg-[#2E2E2E] hover:bg-[#383838] text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecuperarSenha} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      E-mail Cadastrado *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="email"
                        value={emailRecuperar}
                        onChange={(e) => setEmailRecuperar(e.target.value)}
                        required
                        placeholder="seu.nome@jwasa.com.br"
                        className="w-full pl-10 pr-3.5 py-3.5 bg-[#252525] border border-[#383838] rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors"
                      />
                    </div>
                  </div>

                  {erro && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{erro}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-3.5 rounded-xl bg-[#FFE500] hover:bg-[#F59E0B] text-[#0A0A0A] font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#0A0A0A]" />
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
                    className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para o Login</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── TAB 3: SOLICITAR CONTA ───────────────────────────────── */}
          {tab === 'solicitar' && (
            <div>
              {sucessoSol ? (
                <div className="text-center py-6 space-y-4 bg-[#252525] border border-[#383838] rounded-xl p-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Solicitação Registrada!</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Seu pedido de cadastro foi enviado com sucesso. Assim que a diretoria autorizar, você poderá realizar seu login.
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
                    className="mt-2 px-6 py-3 rounded-xl bg-[#FFE500] hover:bg-[#F59E0B] text-[#0A0A0A] font-black text-xs uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSolicitar} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      Nome Completo *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={nomeSol}
                        onChange={(e) => setNomeSol(e.target.value)}
                        required
                        placeholder="Ex: Engenheiro Carlos Silva"
                        className="w-full pl-10 pr-3.5 py-3 bg-[#252525] border border-[#383838] rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      E-mail de Acesso *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="email"
                        value={emailSol}
                        onChange={(e) => setEmailSol(e.target.value)}
                        required
                        placeholder="seu.email@jwasa.com.br"
                        className="w-full pl-10 pr-3.5 py-3 bg-[#252525] border border-[#383838] rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      Senha Desejada *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type={showSenhaSol ? 'text' : 'password'}
                        value={senhaSol}
                        onChange={(e) => setSenhaSol(e.target.value)}
                        required
                        placeholder="Mínimo 6 dígitos"
                        className="w-full pl-10 pr-10 py-3 bg-[#252525] border border-[#383838] rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenhaSol((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1 cursor-pointer"
                      >
                        {showSenhaSol ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      Função / Obra (Opcional)
                    </label>
                    <textarea
                      value={mensagemSol}
                      onChange={(e) => setMensagemSol(e.target.value)}
                      placeholder="Ex: Engenheiro residente da Obra Horizon..."
                      rows={2}
                      className="w-full p-2.5 bg-[#252525] border border-[#383838] rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FFE500] focus:ring-1 focus:ring-[#FFE500]/50 transition-colors resize-none"
                    />
                  </div>

                  {erro && (
                    <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{erro}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-3 rounded-xl bg-[#FFE500] hover:bg-[#F59E0B] text-[#0A0A0A] font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#0A0A0A]" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar Pedido de Acesso</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* ── FOOTER: LINHA DIVISÓRIA COM TEXTO EM BAIXO ───────────── */}
        <div className="pt-6 border-t border-[#2E2E2E] text-center text-xs text-zinc-500">
          <span>Portal de Engenharia & Gestão Corporativa · Todos os direitos reservados</span>
        </div>
      </section>

    </main>
  )
}


