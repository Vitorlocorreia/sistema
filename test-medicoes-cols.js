const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqackyuxipcxvmliecow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const response = await fetch(`${supabaseUrl}/rest/v1/medicoes?limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  // To get columns, we can check the headers or error when we query an invalid filter.
  const badResponse = await fetch(`${supabaseUrl}/rest/v1/medicoes?select=invalid_column`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const text = await badResponse.text();
  console.log("Error details:", text);
}

check();
