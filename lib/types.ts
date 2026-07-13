// ─── AUTO-GENERATED TYPES FROM SUPABASE SCHEMA ─────────────────────────────
// Run: npx supabase gen types typescript --project-id xqackyuxipcxvmliecow

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      obras: {
        Row: Obra
        Insert: Omit<Obra, 'id' | 'created_at'>
        Update: Partial<Omit<Obra, 'id' | 'created_at'>>
      }
      rdos: {
        Row: Rdo
        Insert: Omit<Rdo, 'id' | 'created_at'>
        Update: Partial<Omit<Rdo, 'id' | 'created_at'>>
      }
      rdo_atividades: {
        Row: RdoAtividade
        Insert: Omit<RdoAtividade, 'id'>
        Update: Partial<Omit<RdoAtividade, 'id'>>
      }
      rdo_equipamentos: {
        Row: RdoEquipamento
        Insert: Omit<RdoEquipamento, 'id'>
        Update: Partial<Omit<RdoEquipamento, 'id'>>
      }
      suprimentos: {
        Row: Suprimento
        Insert: Omit<Suprimento, 'id' | 'created_at'>
        Update: Partial<Omit<Suprimento, 'id' | 'created_at'>>
      }
      tarefas: {
        Row: Tarefa
        Insert: Omit<Tarefa, 'id' | 'created_at'>
        Update: Partial<Omit<Tarefa, 'id' | 'created_at'>>
      }
      equipe: {
        Row: Membro
        Insert: Omit<Membro, 'id' | 'created_at'>
        Update: Partial<Omit<Membro, 'id' | 'created_at'>>
      }
      fotos: {
        Row: Foto
        Insert: Omit<Foto, 'id' | 'created_at'>
        Update: Partial<Omit<Foto, 'id' | 'created_at'>>
      }
      empresas: {
        Row: Empresa
        Insert: Omit<Empresa, 'id' | 'created_at'>
        Update: Partial<Omit<Empresa, 'id' | 'created_at'>>
      }
      fornecedores: {
        Row: Fornecedor
        Insert: Omit<Fornecedor, 'id' | 'created_at'>
        Update: Partial<Omit<Fornecedor, 'id' | 'created_at'>>
      }
      contas: {
        Row: Conta
        Insert: Omit<Conta, 'id' | 'created_at'>
        Update: Partial<Omit<Conta, 'id' | 'created_at'>>
      }
    }
  }
}

// ─── DOMAIN TYPES ────────────────────────────────────────────────────────────

export interface Obra {
  id: string
  nome: string
  progresso: number
  status: 'Em dia' | 'Atenção' | 'Atrasado' | 'Concluído'
  cliente: string | null
  data_inicio: string | null
  data_fim: string | null
  valor_contrato: number | null
  endereco: string | null
  created_at: string
}

export interface Rdo {
  id: string
  obra_id: string | null
  data: string
  responsavel: string
  cargo: string | null
  crea: string | null
  clima_manha: string
  clima_tarde: string
  condicao_solo: string
  efetivo_proprio: number
  efetivo_terceiros: number
  resumo: string | null
  ocorrencias: string | null
  status: 'Rascunho' | 'Aprovado'
  assinatura_ip: string | null
  assinatura_at: string | null
  created_at: string
}

export interface RdoAtividade {
  id: string
  rdo_id: string
  descricao: string
  quantidade: string | null
  unidade: string | null
}

export interface RdoEquipamento {
  id: string
  rdo_id: string
  nome: string
  status: 'OPERANDO' | 'PARADO' | 'MANUTENÇÃO'
}

export interface Suprimento {
  id: string
  obra_id: string | null
  titulo: string
  quantidade: string | null
  unidade: string | null
  fornecedor: string | null
  valor: number | null
  status: 'Solicitado' | 'Em Cotação' | 'Aprovação' | 'Em Trânsito' | 'Entregue'
  data_vencimento: string | null
  solicitante: string | null
  prioridade: string | null
  created_at: string
}

export interface Tarefa {
  id: string
  obra_id: string | null
  titulo: string
  descricao: string | null
  responsavel: string | null
  status: 'A Fazer' | 'Em Andamento' | 'Em Revisão' | 'Concluído'
  categoria: 'Manutenção' | 'Segurança' | 'Engenharia' | 'Administrativo' | 'Qualidade'
  prazo: string | null
  created_at: string
}

export interface Membro {
  id: string
  nome: string
  funcao: string | null
  ponto: string | null
  ativo: boolean
  created_at: string
}

export interface Foto {
  id: string
  obra_id: string | null
  legenda: string | null
  imagem_url: string | null
  data_iso: string
  created_at: string
}

// ─── FINANCIAL MODULE ────────────────────────────────────────────────────────

export interface Empresa {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  cor: string
  logo_url: string | null
  created_at: string
}

export interface Fornecedor {
  id: string
  empresa_id: string | null
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  tipo: 'PJ' | 'PF'
  telefone: string | null
  email: string | null
  responsavel: string | null
  endereco: string | null
  prazo_pagamento: number
  banco: string | null
  agencia: string | null
  conta: string | null
  pix: string | null
  categoria: string | null
  created_at: string
}

export interface Conta {
  id: string
  empresa_id: string
  obra_id: string | null
  fornecedor_id: string | null
  tipo: 'pagar' | 'receber'
  categoria: string | null
  descricao: string
  valor: number
  data_vencimento: string
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Aguardando Aprovação'
  recorrencia: 'unico' | 'mensal' | 'semanal'
  comprovante_url: string | null
  pago_em: string | null
  aprovado_por: string | null
  aprovado_em: string | null
  created_at: string
}

// ─── JOINED / EXTENDED ───────────────────────────────────────────────────────

export type RdoCompleto = Rdo & {
  obra?: Pick<Obra, 'nome'>
  atividades?: RdoAtividade[]
  equipamentos?: RdoEquipamento[]
}

export type ContaComRelacoes = Conta & {
  empresa?: Pick<Empresa, 'nome_fantasia' | 'razao_social' | 'cor'>
  fornecedor?: Pick<Fornecedor, 'razao_social' | 'nome_fantasia'>
  obra?: Pick<Obra, 'nome'>
}

export type SuprimentoComObra = Suprimento & {
  obra?: Pick<Obra, 'nome'>
}

export interface Colaborador {
  id: string
  nome: string
  cargo: string
  empresa_id: string | null
  email: string | null
  senha?: string | null
  created_at?: string
  override_permissoes: boolean
  pode_empresas: boolean
  pode_fornecedores: boolean
  pode_lancar: boolean
  pode_pagar: boolean
  pode_aprovar: boolean
  limite_valor: number
  apps: string
}

export interface ConfigPermissao {
  cargo: string
  pode_empresas: boolean
  pode_fornecedores: boolean
  pode_lancar: boolean
  pode_pagar: boolean
  pode_aprovar: boolean
  limite_valor: number
  apps: string
}

export interface SolicitacaoAcesso {
  id: string
  nome: string
  email: string
  cargo_solicitado: string
  empresa_id: string | null
  mensagem: string | null
  status: 'pendente' | 'aprovado' | 'rejeitado'
  aprovado_por: string | null
  aprovado_em: string | null
  senha_provisoria: string | null
  created_at: string
}

