-- ==============================================================================
-- AJUSTE DE STORAGE PARA O BUCKET rdo-fotos (SUPABASE)
-- Motivo:
-- 1. Permitir qualquer MIME type (PDF, HEIC, JPEG, PNG, WEBP) no bucket rdo-fotos.
-- 2. Garantir políticas de leitura e escrita públicas (anon e authenticated)
--    para que anexos de campo do RDO nunca sejam bloqueados por 415 ou 403.
-- ==============================================================================

-- 1. Libera restrição de tipos de arquivo no bucket rdo-fotos
UPDATE storage.buckets
SET allowed_mime_types = NULL,
    public = true,
    file_size_limit = 52428800
WHERE id = 'rdo-fotos';

-- 2. Recria políticas de segurança (RLS) na tabela storage.objects para rdo-fotos
DROP POLICY IF EXISTS "Permitir leitura pública rdo-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload público rdo-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update público rdo-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delete público rdo-fotos" ON storage.objects;

CREATE POLICY "Permitir leitura pública rdo-fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'rdo-fotos');

CREATE POLICY "Permitir upload público rdo-fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rdo-fotos');

CREATE POLICY "Permitir update público rdo-fotos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'rdo-fotos')
WITH CHECK (bucket_id = 'rdo-fotos');

CREATE POLICY "Permitir delete público rdo-fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'rdo-fotos');

SELECT 'BUCKET rdo-fotos CONFIGURADO COM SUCESSO!' AS status;
