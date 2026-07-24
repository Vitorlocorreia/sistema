import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('colaboradores').select('nome, email, cargo, abas_financeiro, override_permissoes')
  if (error) {
    console.error(error)
    return
  }
  console.log(data)
}

check()
