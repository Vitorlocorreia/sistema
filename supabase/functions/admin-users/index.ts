import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase())
    if (user) return user
    if (data.users.length < 1000) break
  }
  return null
}

async function isAdmin(request: Request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  const email = data.user?.email
  if (!email) return false
  const { data: profile } = await admin.from('colaboradores').select('cargo').ilike('email', email).maybeSingle()
  return profile?.cargo === 'admin_geral'
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!(await isAdmin(request))) return json({ error: 'Apenas o Administrador Geral pode criar usuários.' }, 403)
    const payload = await request.json()
    if (payload.action === 'delete_user') {
      const collaboratorId = String(payload.collaborator_id || '').trim()
      if (!collaboratorId) return json({ error: 'Informe o colaborador para exclusao.' }, 400)
      const { data: collaborator, error: collaboratorError } = await admin
        .from('colaboradores')
        .select('id, email')
        .eq('id', collaboratorId)
        .maybeSingle()
      if (collaboratorError) return json({ error: collaboratorError.message }, 400)
      if (!collaborator) return json({ error: 'Colaborador nao encontrado.' }, 404)

      // Auth e tabela de colaboradores sao fontes separadas: removemos os dois.
      if (collaborator.email) {
        const authUser = await findAuthUserByEmail(collaborator.email)
        if (authUser) {
          const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUser.id)
          if (deleteAuthError) return json({ error: deleteAuthError.message }, 400)
        }
      }
      const { error: deleteProfileError } = await admin.from('colaboradores').delete().eq('id', collaboratorId)
      if (deleteProfileError) return json({ error: deleteProfileError.message }, 400)
      return json({ ok: true })
    }
    if (payload.action !== 'create_user') return json({ error: 'Ação inválida.' }, 400)
    const nome = String(payload.nome || '').trim()
    const email = String(payload.email || '').trim().toLowerCase()
    const senha = String(payload.senha || '')
    const cargo = String(payload.cargo || 'operador').trim()
    if (!nome || !email || senha.length < 8) return json({ error: 'Informe nome, e-mail e uma senha com no mínimo 8 caracteres.' }, 400)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } })
    if (authError || !authUser.user) return json({ error: authError?.message || 'Não foi possível criar o usuário Auth.' }, 400)
    const { data: config } = await admin.from('config_permissoes').select('apps').eq('cargo', cargo).maybeSingle()
    const profile = { nome, email, cargo, empresa_id: payload.empresa_id || null, senha: null, override_permissoes: false, apps: config?.apps || cargo }
    const { data: existing } = await admin.from('colaboradores').select('id').ilike('email', email).maybeSingle()
    const profileResult = existing ? await admin.from('colaboradores').update(profile).eq('id', existing.id) : await admin.from('colaboradores').insert(profile)
    if (profileResult.error) {
      await admin.auth.admin.deleteUser(authUser.user.id)
      return json({ error: profileResult.error.message }, 400)
    }
    return json({ ok: true, user_id: authUser.user.id })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
