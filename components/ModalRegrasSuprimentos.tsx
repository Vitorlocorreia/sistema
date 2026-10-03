'use client'

import React from 'react'
import {
  X,
  BookOpen,
  Clock,
  ShieldCheck,
  Truck,
  DollarSign,
  FileCheck2,
  AlertTriangle,
  Layers,
  Bot
} from 'lucide-react'
import { C } from '@/lib/tokens'

interface ModalRegrasSuprimentosProps {
  isOpen: boolean
  onClose: () => void
}

export function ModalRegrasSuprimentos({ isOpen, onClose }: ModalRegrasSuprimentosProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Topo do Modal */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bgWhite,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.12)',
                color: C.amber,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.amber }}>
                Manual de Boas Práticas & Compliance
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: C.ink }}>
                Regras de Operação de Suprimentos
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              color: C.inkSoft,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          {/* Card 1: Prazos e Antecedência */}
          <div
            style={{
              padding: '14px 16px',
              background: C.bgWhite,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.amber, fontWeight: 800, fontSize: 13 }}>
              <Clock size={16} />
              <span>1. Prazos de Antecedência (SLA do Canteiro)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
              <li>
                <strong style={{ color: C.ink }}>Insumos Básicos (Areia, Brita, Cimento):</strong> Solicitar com no mínimo <strong style={{ color: C.ink }}>3 a 5 dias úteis</strong> de antecedência.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Materiais Sob Encomenda / Acabamento:</strong> Pisos, esquadrias e ferragens devem ser solicitados com <strong style={{ color: C.ink }}>15 a 30 dias</strong> de margem do cronograma.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Prioridade Urgente:</strong> Reservada estritamente para paralisação iminente de obra, exigindo justificativa clara no chat do card.
              </li>
            </ul>
          </div>

          {/* Card 2: Regras de Cotação */}
          <div
            style={{
              padding: '14px 16px',
              background: C.bgWhite,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3B82F6', fontWeight: 800, fontSize: 13 }}>
              <Layers size={16} />
              <span>2. Regras de Cotação & Fornecedores</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
              <li>
                <strong style={{ color: C.ink }}>Mínimo de 3 Cotações:</strong> Compras acima de R$ 1.000,00 devem conter 3 propostas comparadas (lançadas manualmente ou geradas via IA dgenny).
              </li>
              <li>
                <strong style={{ color: C.ink }}>Preferência de Frete CIF:</strong> O frete deve preferencialmente estar incluso na proposta com descarga garantida no canteiro.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Condição de Pagamento:</strong> O padrão negociado pela construtora é boleto faturado para 28 dias após a emissão da NF.
              </li>
            </ul>
          </div>

          {/* Card 3: Alçadas de Aprovação */}
          <div
            style={{
              padding: '14px 16px',
              background: C.bgWhite,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B5CF6', fontWeight: 800, fontSize: 13 }}>
              <ShieldCheck size={16} />
              <span>3. Alçadas de Aprovação da Diretoria</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 4 }}>
              <div style={{ background: C.bgCard, padding: '10px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft }}>ATÉ R$ 5.000,00</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginTop: 2 }}>Engenheiro Residente / Comprador</div>
              </div>
              <div style={{ background: C.bgCard, padding: '10px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft }}>R$ 5.000 A R$ 20.000</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginTop: 2 }}>Gestor de Suprimentos</div>
              </div>
              <div style={{ background: C.bgCard, padding: '10px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft }}>ACIMA DE R$ 20.000</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginTop: 2 }}>Diretoria Geral</div>
              </div>
            </div>
          </div>

          {/* Card 4: Recebimento Físico no Canteiro */}
          <div
            style={{
              padding: '14px 16px',
              background: C.bgWhite,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10B981', fontWeight: 800, fontSize: 13 }}>
              <Truck size={16} />
              <span>4. Conferência Física & Recebimento na Obra</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
              <li>
                <strong style={{ color: C.ink }}>Conferência Quantitativa e Qualitativa:</strong> É expressamente proibido dar como &ldquo;Entregue&rdquo; antes de inspecionar a carga na presença do motorista.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Evidência Obrigatória:</strong> Anexar foto da carga descarregada ou do canhoto assinado da Nota Fiscal no modal de recebimento.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Entregas Fracionadas:</strong> Dar baixa parcial no Checklist do card (ex: 20 de 50 sacos entregues) até a conclusão integral.
              </li>
            </ul>
          </div>

          {/* Card 5: Conexão Financeira */}
          <div
            style={{
              padding: '14px 16px',
              background: C.bgWhite,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#06B6D4', fontWeight: 800, fontSize: 13 }}>
              <DollarSign size={16} />
              <span>5. Integração com o Financeiro</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
              Ao aprovar a compra, o sistema gera o título no <strong style={{ color: C.ink }}>Contas a Pagar</strong> com vínculo rastreável. Quando o Financeiro liquidar a conta, o card recebe automaticamente a tarja verde de confirmação de pagamento com o link para o comprovante.
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${C.border}`,
            background: C.bgWhite,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: 11, color: C.inkSoft }}>
            Diretrizes corporativas aplicadas a todas as obras ativas.
          </span>
          <button
            onClick={onClose}
            style={{
              background: C.amber,
              color: '#0A0A0A',
              border: 0,
              borderRadius: 5,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
