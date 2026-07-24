DO $$
DECLARE
    forn_name text;
    forn_id uuid;
    rec record;
BEGIN
    -- Itera sobre todas as contas da planilha que ainda não tem fornecedor
    FOR rec IN (
        SELECT DISTINCT trim(split_part(descricao, ' - NF', 1)) as nome 
        FROM contas 
        WHERE empresa_id = 'eaeedfef-3488-4d74-938f-11a21a5e570a' 
          AND possui_fornecedor = false
    )
    LOOP
        forn_name := rec.nome;
        
        IF forn_name IS NULL OR forn_name = '' OR forn_name = 'Importação' THEN
            CONTINUE;
        END IF;

        -- Verifica se o fornecedor já existe para não duplicar
        SELECT id INTO forn_id 
        FROM fornecedores 
        WHERE empresa_id = 'eaeedfef-3488-4d74-938f-11a21a5e570a' 
          AND razao_social = forn_name 
        LIMIT 1;
        
        IF forn_id IS NULL THEN
            -- Cria o fornecedor e captura o ID gerado
            INSERT INTO fornecedores (empresa_id, razao_social, tipo) 
            VALUES ('eaeedfef-3488-4d74-938f-11a21a5e570a', forn_name, 'PJ') 
            RETURNING id INTO forn_id;
        END IF;

        -- Atualiza todas as contas desse fornecedor com o ID dele
        UPDATE contas 
        SET possui_fornecedor = true, 
            fornecedor_id = forn_id 
        WHERE empresa_id = 'eaeedfef-3488-4d74-938f-11a21a5e570a' 
          AND possui_fornecedor = false 
          AND descricao LIKE forn_name || '%';
          
    END LOOP;
END $$;
