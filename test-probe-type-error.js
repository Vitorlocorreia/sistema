const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqackyuxipcxvmliecow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const res = await supabase.from('medicoes').insert({
    obra_id: '123e4567-e89b-12d3-a456-426614174000', // valid format uuid
    numero: 'BM-TEST2',
    periodo_inicio: 'invalid_date', // test date error
    periodo_fim: '2023-01-31',
    valor_medido: 'invalid_number', // test number error
    percentual: 10,
    observacoes: 'Test',
    status: 'Rascunho'
  });
  console.log("Insert Error:", res.error);
}

check();
