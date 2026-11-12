-- ==============================================================================
-- ATUALIZAÇÃO DA RESTRIÇÃO DE STATUS: PERMITIR 'Arquivado' EM suprimentos
-- Executar no SQL Editor do Supabase para permitir o status 'Arquivado' nativamente
-- ==============================================================================

-- 1. Remove a restrição antiga que bloqueava o valor 'Arquivado'
ALTER TABLE public.suprimentos 
  DROP CONSTRAINT IF EXISTS suprimentos_status_check;

-- 2. Adiciona a restrição atualizada contendo todos os status válidos incluindo 'Arquivado'
ALTER TABLE public.suprimentos 
  ADD CONSTRAINT suprimentos_status_check 
  CHECK (status IN (
    'Solicitado',
    'Em Cotação',
    'Aprovação',
    'Em Trânsito',
    'Entregue',
    'Arquivado'
  ));
