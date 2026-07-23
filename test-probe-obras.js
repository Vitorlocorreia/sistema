const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqackyuxipcxvmliecow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const res = await supabase.from('obras').select('empresa_id').limit(1);
  console.log("Select empresa_id on obras:", res.error ? res.error.message : "Success");
}
check();
