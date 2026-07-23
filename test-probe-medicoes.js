const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqackyuxipcxvmliecow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Try to select with empresa_id
  let res = await supabase.from('medicoes').select('empresa_id').limit(1);
  console.log("Select empresa_id:", res.error ? res.error.message : "Success");
  
  // Try to select with a fake column to see the exact error format
  res = await supabase.from('medicoes').select('fake_column_xyz').limit(1);
  console.log("Select fake_column_xyz:", res.error ? res.error.message : "Success");
}

check();
