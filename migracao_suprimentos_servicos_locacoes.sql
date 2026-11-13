-- ==============================================================================
-- MIGRAÇÃO DE SUPRIMENTOS: SERVIÇOS & LOCAÇÕES COM ACOMPANHAMENTO MENSAL
-- Executar no SQL Editor do Supabase para suporte nativo às colunas dedicadas
-- ==============================================================================

-- 1. Coluna de tipo da demanda ('material', 'servico', 'locacao')
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS tipo_demanda TEXT DEFAULT 'material';

-- 2. Dados da Empresa Contratante (JWA, etc.)
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS empresa_id UUID,
  ADD COLUMN IF NOT EXISTS empresa_nome TEXT;

-- 3. Período e Vigência da Contratação / Locação
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS data_termino DATE;

-- 4. Valores Contratados e Mensais
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS valor_mensal NUMERIC;

-- 5. Acompanhamento Mensal e Medições (JSONB)
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS acompanhamento_mensal JSONB DEFAULT '[]'::jsonb;

-- 6. Encerramento de Contrato / Desmobilização
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS contrato_encerrado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_encerrado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contrato_encerrado_motivo TEXT;

-- 7. Dados extras e flexíveis de contrato
ALTER TABLE public.suprimentos 
  ADD COLUMN IF NOT EXISTS dados_contrato JSONB DEFAULT '{}'::jsonb;

-- 8. Classificar demandas existentes que contenham termos de serviço ou locação no título
UPDATE public.suprimentos 
SET tipo_demanda = 'servico'
WHERE (tipo_demanda IS NULL OR tipo_demanda = 'material')
  AND (
    titulo ILIKE '%serviço%' 
    OR titulo ILIKE '%servico%' 
    OR titulo ILIKE '%mão de obra%' 
    OR titulo ILIKE '%mao de obra%'
    OR titulo ILIKE '%execução%'
    OR titulo ILIKE '%execucao%'
    OR titulo ILIKE '%montagem%'
    OR titulo ILIKE '%instalação%'
    OR titulo ILIKE '%instalacao%'
    OR titulo ILIKE '%pintura%'
    OR titulo ILIKE '%manutenção%'
    OR titulo ILIKE '%manutencao%'
  );

UPDATE public.suprimentos 
SET tipo_demanda = 'locacao'
WHERE (tipo_demanda IS NULL OR tipo_demanda = 'material')
  AND (
    titulo ILIKE '%locação%' 
    OR titulo ILIKE '%locacao%' 
    OR titulo ILIKE '%aluguel%'
    OR titulo ILIKE '%caçamba%'
    OR titulo ILIKE '%cacamba%'
    OR titulo ILIKE '%andaime%'
    OR titulo ILIKE '%betoneira%'
    OR titulo ILIKE '%retroescavadeira%'
    OR titulo ILIKE '%gerador%'
  );

UPDATE public.suprimentos 
SET tipo_demanda = 'material'
WHERE tipo_demanda IS NULL;
