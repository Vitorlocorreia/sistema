-- ============================================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES E RLS (SUPABASE)
-- Antigravity / Vitor - Sistema
-- ============================================================

-- 1. Atualizar ambos os logins do Jorge para Administrador Geral (acesso total)
UPDATE colaboradores
SET cargo = 'admin_geral',
    pode_empresas = true,
    pode_fornecedores = true,
    pode_lancar = true,
    pode_pagar = true,
    pode_aprovar = true,
    limite_valor = 99999999,
    apps = 'rh,ponto,financeiro,suprimentos,obras,rdo,frota,usuarios',
    abas_financeiro = 'dashboard,historico,contas,empresas,fornecedores,obras,permissoes'
WHERE email ILIKE '%jorge%' OR nome ILIKE '%jorge%';

-- 2. Liberar leitura da tabela de Colaboradores (resolve o sumiço dos nomes no Modal Confidencial)
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de colaboradores" ON colaboradores;
CREATE POLICY "Permitir leitura de colaboradores"
ON colaboradores FOR SELECT
USING (true);

-- 3. Liberar acesso à tabela de Convites de Admissão do RH (resolve o "sumiço" de links gerados)
ALTER TABLE rh_admissao_convites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura total de convites de admissao" ON rh_admissao_convites;
DROP POLICY IF EXISTS "Permitir escrita total de convites de admissao" ON rh_admissao_convites;

CREATE POLICY "Permitir leitura total de convites de admissao"
ON rh_admissao_convites FOR SELECT
USING (true);

CREATE POLICY "Permitir escrita total de convites de admissao"
ON rh_admissao_convites FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Liberar acesso aos Documentos de Admissão do RH
ALTER TABLE rh_admissao_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura e escrita de documentos de admissao" ON rh_admissao_documentos;

CREATE POLICY "Permitir leitura e escrita de documentos de admissao"
ON rh_admissao_documentos FOR ALL
USING (true)
WITH CHECK (true);
