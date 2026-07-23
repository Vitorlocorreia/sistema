const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqackyuxipcxvmliecow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: obras } = await supabase.from('obras').select('id, empresa_id').limit(1);
  const obra = obras && obras[0] ? obras[0] : { id: '00000000-0000-0000-0000-000000000000' };
  console.log("Obra encontrada:", obra);
  
  // Try a dummy insert
  const res = await supabase.from('medicoes').insert({
    obra_id: obra.id,
    numero: 'BM-TEST2',
    periodo_inicio: '2023-01-01',
    periodo_fim: '2023-01-31',
    valor_medido: 1000,
    percentual: 10,
    observacoes: 'Test',
    status: 'Rascunho'
  });
  console.log("Insert Error:", res.error);
}

check();
