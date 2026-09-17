-- ==============================================================================
-- ATUALIZAÇÃO DA RESTRIÇÃO DE STATUS: PERMITIR 'apto' EM rh_admissao_convites
-- Executar no SQL Editor do Supabase para permitir o status 'apto' nativamente
-- ==============================================================================

-- 1. Remove a restrição antiga que bloqueava o valor 'apto'
ALTER TABLE public.rh_admissao_convites 
  DROP CONSTRAINT IF EXISTS rh_admissao_convites_status_check;

-- 2. Adiciona a restrição atualizada contendo o status 'apto'
ALTER TABLE public.rh_admissao_convites 
  ADD CONSTRAINT rh_admissao_convites_status_check 
  CHECK (status IN (
    'ativo',
    'em_preenchimento',
    'aguardando_aprovacao',
    'apto',
    'aprovado',
    'devolvido',
    'revogado',
    'expirado'
  ));
