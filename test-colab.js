import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('colaboradores').select('id, obras_ids').limit(1).single()
  if (error) {
    console.error("SELECT ERROR:", error)
    return
  }
  console.log("Got id:", data.id)
  console.log("Current obras_ids:", data.obras_ids)
  const { data: updateData, error: updateError } = await supabase.from('colaboradores').update({ obras_ids: ["test"] }).eq('id', data.id)
  if (updateError) {
    console.error("UPDATE ERROR:", updateError)
  } else {
    console.log("UPDATE SUCCESS")
  }
}
test()
