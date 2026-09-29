'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Bell, Check, Trash2, ExternalLink, X, Clock, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/tokens'
import { useRouter } from 'next/navigation'

export interface NotificacaoItem {
  id: string
  destinatario_id: string
  remetente_id?: string | null
  remetente_nome?: string | null
  tipo: string
  titulo: string
  mensagem: string
  link?: string | null
  lida: boolean
  created_at: string
}

function tempoRelativo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'agora'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `há ${diffMin} min`
    const diffHoras = Math.floor(diffMin / 60)
    if (diffHoras < 24) return `há ${diffHoras}h`
    const diffDias = Math.floor(diffHoras / 24)
    if (diffDias === 1) return 'ontem'
    return `há ${diffDias} dias`
  } catch {
    return ''
  }
}

export function NotificationCenter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const [colaboradorId, setColaboradorId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. Obter colaborador logado da sessão
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('colaborador_sessao')
        if (raw) {
          const user = JSON.parse(raw)
          if (user?.id) setColaboradorId(user.id)
        }
      } catch {}
    }
  }, [])

  // 2. Carregar notificações do banco
  const carregarNotificacoes = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('destinatario_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        setNotificacoes(data as NotificacaoItem[])
      }
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
    }
  }, [])

  useEffect(() => {
    if (!colaboradorId) return
    carregarNotificacoes(colaboradorId)

    // 3. Listener Realtime para novas notificações (nome único por instância para evitar colisão)
    const channelName = `notificacoes-${colaboradorId}-${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `destinatario_id=eq.${colaboradorId}`
        },
        () => {
          carregarNotificacoes(colaboradorId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [colaboradorId, carregarNotificacoes])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Marcar individual como lida
  async function marcarComoLida(notif: NotificacaoItem) {
    if (!notif.lida) {
      setNotificacoes(prev => prev.map(n => n.id === notif.id ? { ...n, lida: true } : n))
      await supabase.from('notificacoes').update({ lida: true }).eq('id', notif.id)
    }
    if (notif.link) {
      setOpen(false)
      if (notif.link.startsWith('http')) {
        window.open(notif.link, '_blank')
      } else {
        router.push(notif.link)
      }
    }
  }

  // Marcar todas como lidas
  async function marcarTodasLidas() {
    if (!colaboradorId) return
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
    await supabase.from('notificacoes').update({ lida: true }).eq('destinatario_id', colaboradorId).eq('lida', false)
  }

  // Excluir notificação
  async function excluirNotificacao(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotificacoes(prev => prev.filter(n => n.id !== id))
    await supabase.from('notificacoes').delete().eq('id', id)
  }

  const naoLidas = notificacoes.filter(n => !n.lida).length

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* BOTÃO DO SINO */}
      <button
        onClick={() => setOpen(prev => !prev)}
        title={naoLidas > 0 ? `${naoLidas} notificações não lidas` : 'Central de Notificações'}
        style={{
          position: 'relative',
          background: 'transparent',
          border: `1px solid ${open ? C.amber : C.border}`,
          borderRadius: 6,
          padding: '7px 9px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: open ? C.amber : C.ink,
          transition: 'all 0.15s ease'
        }}
      >
        <Bell size={16} />
        {naoLidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: 9.5,
              fontWeight: 800,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '2px solid var(--theme-bg, #0A0A0A)',
              boxShadow: '0 1px 4px rgba(239, 68, 68, 0.4)'
            }}
          >
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {/* DROPDOWN FLUTUANTE */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxWidth: '90vw',
            background: C.bgPanel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Top Header do Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: `1px solid ${C.border}`,
              background: C.bgCard
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={14} color={C.amber} />
              <strong style={{ fontSize: 13, color: C.ink }}>Notificações</strong>
              {naoLidas > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#EF4444',
                    padding: '1px 6px',
                    borderRadius: 10
                  }}
                >
                  {naoLidas} novas
                </span>
              )}
            </div>

            {naoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.inkSoft,
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Marcar todas como lidas"
              >
                <Check size={12} /> Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {notificacoes.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: C.inkSoft, fontSize: 12 }}>
                Nenhuma notificação no momento.
              </div>
            ) : (
              notificacoes.map(n => (
                <div
                  key={n.id}
                  onClick={() => marcarComoLida(n)}
                  style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${C.border}`,
                    background: n.lida ? 'transparent' : 'rgba(245, 158, 11, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    transition: 'background 0.1s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgWhite }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.lida ? 'transparent' : 'rgba(245, 158, 11, 0.05)' }}
                >
                  {/* Ponto indicador de não lida */}
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: n.lida ? 'transparent' : C.amber,
                      marginTop: 6,
                      flexShrink: 0
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                      <h5 style={{ margin: 0, fontSize: 12, fontWeight: n.lida ? 600 : 800, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.titulo}
                      </h5>
                      <span style={{ fontSize: 10, color: C.inkSoft, whiteSpace: 'nowrap' }}>
                        {tempoRelativo(n.created_at)}
                      </span>
                    </div>

                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
                      {n.mensagem}
                    </p>

                    {n.remetente_nome && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: C.inkSoft }}>
                        <User size={10} /> Por: {n.remetente_nome}
                      </div>
                    )}
                  </div>

                  {/* Ação rápida excluir */}
                  <button
                    onClick={e => excluirNotificacao(n.id, e)}
                    title="Excluir notificação"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: C.inkSoft,
                      cursor: 'pointer',
                      padding: 2,
                      opacity: 0.6
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
