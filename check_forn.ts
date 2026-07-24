import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: forns } = await supabase
    .from('fornecedores')
    .select('id, razao_social, created_at')
    .gte('created_at', yesterday);
    
  console.log("Fornecedores criados nas ultimas 24h:", forns?.length);
  console.log(forns?.slice(0, 10));
}
run();
