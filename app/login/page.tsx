'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, User, Briefcase, Building2, CheckCircle2, ChevronLeft } from 'lucide-react'
import type { Empresa } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'solicitar'>('login')
  
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
  const [cargoSol, setCargoSol] = useState('operador')
  const [empresaSol, setEmpresaSol] = useState('')
  const [mensagemSol, setMensagemSol] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [sucessoSol, setSucessoSol] = useState(false)

  // Carrega as empresas para a solicitação de conta
  useEffect(() => {
    async function carregarEmpresas() {
      const { data } = await supabase.from('empresas').select('*').order('razao_social')
      if (data) setEmpresas(data)
    }
    if (modo === 'solicitar') {
      carregarEmpresas()
    }
  }, [modo])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: senha })

      // Contas criadas pelo Administrador Geral usam o Supabase Auth e deixam
      // a senha nula na tabela de colaboradores. Nesses casos, o Auth valida a senha.
      if (!authError && authData.user) {
        const profileResult = await supabase
          .from('colaboradores')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (profileResult.error || !profileResult.data) {
          await supabase.auth.signOut()
          setErro('Usuario autenticado, mas o perfil de colaborador nao foi encontrado.')
          setLoading(false)
          return
        }
        localStorage.setItem('sessao_auth_segura', 'true')
        localStorage.setItem('colaborador_sessao', JSON.stringify(profileResult.data))
        localStorage.setItem('perfil_ativo', profileResult.data.cargo)
        router.replace('/')
        return
      }

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

      // Usuários antigos continuam entrando sem disparar signUp/e-mails.
      // Quando o mesmo e-mail existir no Supabase Auth, a sessão segura será
      // usada automaticamente; até lá, mantemos a sessão legada do protótipo.
      localStorage.setItem('sessao_auth_segura', authError ? 'false' : 'true')

      // Salva sessão no localStorage
      localStorage.setItem('colaborador_sessao', JSON.stringify(data))
      localStorage.setItem('perfil_ativo', data.cargo)

      router.replace('/')
    } catch {
      setErro('Erro ao conectar. Tente novamente.')
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

    try {
      // Verifica se o e-mail já existe na tabela de colaboradores ou solicitações
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
          cargo_solicitado: cargoSol,
          empresa_id: cargoSol !== 'admin_geral' && empresaSol ? empresaSol : null,
          mensagem: mensagemSol.trim() || null,
          status: 'pendente'
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0C0E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans, Inter, sans-serif)',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(circle at 50% 10%, #F59E0B08 0%, transparent 60%), linear-gradient(180deg,#0B0C0E 0%,#0F1018 100%)',
        backgroundSize: 'cover',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>

        {/* Logo / header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'linear-gradient(135deg, #F59E0B, #B45309)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 0 40px #F59E0B30',
          }}>
            <Lock size={24} color="#0B0C0E" strokeWidth={2.5} />
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 900, color: '#F3F4F6',
            letterSpacing: -0.5, margin: 0,
          }}>Portal da Construtora</h1>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>
            {modo === 'login' ? 'Faça login com suas credenciais' : 'Solicitar criação de conta no sistema'}
          </p>
        </div>

        {/* MODO: LOGIN */}
        {modo === 'login' && (
          <form
            onSubmit={handleLogin}
            style={{
              background: '#12141C',
              border: '1px solid #1E2230',
              borderRadius: 12,
              padding: '36px 32px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            {/* E-mail */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 800,
                color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
              }}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  style={{
                    width: '100%',
                    background: '#0B0C0E',
                    border: `1px solid ${erro ? '#EF444450' : '#1E2230'}`,
                    borderRadius: 8,
                    padding: '12px 14px 12px 42px',
                    color: '#F3F4F6',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#F59E0B55'}
                  onBlur={e => e.currentTarget.style.borderColor = erro ? '#EF444450' : '#1E2230'}
                />
              </div>
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 28 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 800,
                color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
              }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: '#0B0C0E',
                    border: `1px solid ${erro ? '#EF444450' : '#1E2230'}`,
                    borderRadius: 8,
                    padding: '12px 44px 12px 42px',
                    color: '#F3F4F6',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#F59E0B55'}
                  onBlur={e => e.currentTarget.style.borderColor = erro ? '#EF444450' : '#1E2230'}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(p => !p)}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    color: '#4B5563',
                  }}
                >
                  {showSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#EF444415', border: '1px solid #EF444440',
                borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              }}>
                <AlertCircle size={14} color="#EF4444" />
                <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{erro}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#78350F' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                border: 'none',
                borderRadius: 8,
                padding: '14px',
                color: '#0B0C0E',
                fontSize: 14,
                fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                letterSpacing: 0.3,
                transition: 'opacity 0.15s',
                opacity: loading ? 0.8 : 1,
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar no Portal'}
            </button>

            <button
              type="button"
              onClick={() => { setModo('solicitar'); setErro(null) }}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid #1E2230',
                borderRadius: 8,
                padding: '12px',
                color: '#F3F4F6',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#F59E0B44'
                e.currentTarget.style.background = '#F59E0B08'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#1E2230'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Criar Conta
            </button>
          </form>
        )}

        {/* MODO: SOLICITAR ACESSO */}
        {modo === 'solicitar' && (
          <div
            style={{
              background: '#12141C',
              border: '1px solid #1E2230',
              borderRadius: 12,
              padding: '36px 32px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            {sucessoSol ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#10B98115', color: '#10B981',
                  display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <CheckCircle2 size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#F3F4F6', margin: '0 0 8px 0' }}>
                  Solicitação Enviada!
                </h3>
                <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                  Sua solicitação de cadastro foi registrada com sucesso. Ela está pendente de aprovação pelo Administrador Geral ou pelo Administrador da Empresa correspondente.
                </p>
                <button
                  onClick={() => {
                    setSucessoSol(false)
                    setModo('login')
                    setNomeSol('')
                    setEmailSol('')
                    setSenhaSol('')
                    setMensagemSol('')
                    setEmpresaSol('')
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 24px',
                    color: '#0B0C0E',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSolicitar}>
                {/* Voltar link */}
                <button
                  type="button"
                  onClick={() => { setModo('login'); setErro(null) }}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: '#9CA3AF', fontSize: 12, fontWeight: 700,
                    marginBottom: 20,
                  }}
                  className="hover:text-brand-amber"
                >
                  <ChevronLeft size={14} /> Voltar ao login
                </button>

                {/* Nome */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 800,
                    color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
                  }}>Nome Completo *</label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={nomeSol}
                      onChange={e => setNomeSol(e.target.value)}
                      required
                      placeholder="Ex: Vitor Silva"
                      style={{
                        width: '100%',
                        background: '#0B0C0E',
                        border: '1px solid #1E2230',
                        borderRadius: 8,
                        padding: '10px 14px 10px 42px',
                        color: '#F3F4F6',
                        fontSize: 13.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 800,
                    color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
                  }}>E-mail de Acesso *</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      value={emailSol}
                      onChange={e => setEmailSol(e.target.value)}
                      required
                      placeholder="seu@email.com"
                      style={{
                        width: '100%',
                        background: '#0B0C0E',
                        border: '1px solid #1E2230',
                        borderRadius: 8,
                        padding: '10px 14px 10px 42px',
                        color: '#F3F4F6',
                        fontSize: 13.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Senha provisória */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 800,
                    color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
                  }}>Senha Desejada *</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showSenhaSol ? 'text' : 'password'}
                      value={senhaSol}
                      onChange={e => setSenhaSol(e.target.value)}
                      required
                      placeholder="Mínimo 6 caracteres"
                      style={{
                        width: '100%',
                        background: '#0B0C0E',
                        border: '1px solid #1E2230',
                        borderRadius: 8,
                        padding: '10px 44px 10px 42px',
                        color: '#F3F4F6',
                        fontSize: 13.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaSol(p => !p)}
                      style={{
                        all: 'unset', cursor: 'pointer',
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        color: '#4B5563',
                      }}
                    >
                      {showSenhaSol ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Cargo */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 800,
                    color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
                  }}>Cargo Solicitado</label>
                  <div style={{ position: 'relative' }}>
                    <Briefcase size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                    <select
                      value={cargoSol}
                      onChange={e => setCargoSol(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#0B0C0E',
                        border: '1px solid #1E2230',
                        borderRadius: 8,
                        padding: '10px 14px 10px 42px',
                        color: '#F3F4F6',
                        fontSize: 13.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                        appearance: 'none',
                      }}
                    >
                      <option value="operador">Operador Financeiro</option>
                      <option value="admin_empresa">Administrador por Empresa</option>
                      <option value="visualizador">Visualizador</option>
                      <option value="admin_geral">Administrador Geral</option>
                    </select>
                  </div>
                </div>

                {/* Empresa (Se não for Admin Geral) */}
                {cargoSol !== 'admin_geral' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{
                      display: 'block', fontSize: 11, fontWeight: 800,
                      color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
                    }}>Sua Empresa / Filial *</label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={15} color="#4B5563" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                      <select
                        value={empresaSol}
                        onChange={e => setEmpresaSol(e.target.value)}
                        required={cargoSol !== 'admin_geral'}
                        style={{
                          width: '100%',
                          background: '#0B0C0E',
                          border: '1px solid #1E2230',
                          borderRadius: 8,
                          padding: '10px 14px 10px 42px',
                          color: '#F3F4F6',
                          fontSize: 13.5,
                          outline: 'none',
                          boxSizing: 'border-box',
                          appearance: 'none',
                        }}
                      >
                        <option value="">Selecione a empresa...</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.nome_fantasia ?? emp.razao_social}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Mensagem / Justificativa */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 800,
                    color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
                  }}>Justificativa do Acesso (Opcional)</label>
                  <textarea
                    value={mensagemSol}
                    onChange={e => setMensagemSol(e.target.value)}
                    placeholder="Escreva brevemente o motivo da solicitação..."
                    rows={3}
                    style={{
                      width: '100%',
                      background: '#0B0C0E',
                      border: '1px solid #1E2230',
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: '#F3F4F6',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'none',
                    }}
                  />
                </div>

                {/* Erro */}
                {erro && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#EF444415', border: '1px solid #EF444440',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                  }}>
                    <AlertCircle size={14} color="#EF4444" />
                    <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{erro}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading ? '#78350F' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '14px',
                    color: '#0B0C0E',
                    fontSize: 13.5,
                    fontWeight: 900,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    letterSpacing: 0.3,
                    transition: 'opacity 0.15s',
                    opacity: loading ? 0.8 : 1,
                    boxSizing: 'border-box',
                  }}
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </form>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#374151', fontSize: 11, marginTop: 24 }}>
          Desenvolvido com foco em segurança de dados corporativos.
        </p>
      </div>
    </div>
  )
}
