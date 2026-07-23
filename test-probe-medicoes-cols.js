const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqackyuxipcxvmliecow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const cols = ['colaborador_id', 'autor_id', 'criado_por', 'user_id', 'responsavel'];
  for (const c of cols) {
    const res = await supabase.from('medicoes').select(c).limit(1);
    console.log(`Select ${c}:`, res.error ? res.error.message : "Success");
  }
}
check();
