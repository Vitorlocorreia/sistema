const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanup() {
  const idsFile = path.resolve(__dirname, '.demo-ids.json');
  if (!fs.existsSync(idsFile)) {
    return console.log('Nenhum dado de demonstração encontrado para limpar.');
  }

  const demoIds = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
  console.log('🧹 Iniciando Limpeza Geral dos dados de Demonstração...');

  // Ordem reversa baseada nas FKs (Filhos primeiro, pais por último)
  const tables = [
    'rdo_atividades',
    'rdo_equipamentos',
    'fotos',
    'equipe',
    'tarefas',
    'suprimentos',
    'contas',
    'fornecedores',
    'rdos',
    'obras',
    'empresas'
  ];

  for (const table of tables) {
    if (demoIds[table] && demoIds[table].length > 0) {
      console.log(`Deletando ${demoIds[table].length} registros de ${table}...`);
      
      // Supabase só aceita .in com arrays limitados, mas para demo a qtde é ok.
      const { error } = await supabase.from(table).delete().in('id', demoIds[table]);
      
      if (error) {
        console.error(`Erro ao limpar ${table}:`, error);
      }
    }
  }

  fs.unlinkSync(idsFile);
  console.log('✅ Sistema limpo! Nenhum vestígio da demonstração.');
}

cleanup();
