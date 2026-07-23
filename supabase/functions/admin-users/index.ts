import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function findAuthUserByEmail(email: string) {
  try {
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) break
      const user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase())
      if (user) return user
      if (data.users.length < 1000) break
    }
  } catch (err) {
    console.warn('findAuthUserByEmail error:', err)
  }
  return null
}

// Verifica se o admin_id enviado no payload é um admin_geral na tabela colaboradores
async function isAdmin(payload: Record<string, unknown>) {
  const adminId = String(payload.admin_id || '').trim()
  if (!adminId) return false
  const { data } = await admin.from('colaboradores').select('cargo').eq('id', adminId).maybeSingle()
  return data?.cargo === 'admin_geral' || data?.cargo === 'admin_empresa'
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const payload = await request.json()

    if (!(await isAdmin(payload))) return json({ error: 'Acesso negado. Apenas o Administrador pode executar esta ação.' }, 403)

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

      if (collaborator.email) {
        try {
          const authUser = await findAuthUserByEmail(collaborator.email)
          if (authUser) {
            await admin.auth.admin.deleteUser(authUser.id)
          }
        } catch (e) {
          console.warn('deleteAuthUser warning:', e)
        }
      }
      const { error: deleteProfileError } = await admin.from('colaboradores').delete().eq('id', collaboratorId)
      if (deleteProfileError) return json({ error: deleteProfileError.message }, 400)
      return json({ ok: true })
    }

    if (payload.action === 'reject_user') {
      const solId = String(payload.solicitacao_id || '').trim()
      const adminId = String(payload.admin_id || '').trim()
      if (!solId) return json({ error: 'Informe a solicitacao para rejeicao.' }, 400)
      
      const { error: rejectError } = await admin.from('solicitacoes_acesso').update({
        status: 'rejeitado',
        aprovado_por: adminId,
        aprovado_em: new Date().toISOString()
      }).eq('id', solId)
      
      if (rejectError) return json({ error: rejectError.message }, 400)
      return json({ ok: true })
    }

    if (payload.action !== 'create_user' && payload.action !== 'approve_user') return json({ error: 'Ação inválida.' }, 400)

    const nome = String(payload.nome || '').trim()
    const email = String(payload.email || '').trim().toLowerCase()
    const rawSenha = String(payload.senha || '').trim()
    const senha = rawSenha ? (rawSenha.length < 6 ? rawSenha.padEnd(6, '0') : rawSenha) : '123456'
    const cargo = String(payload.cargo || 'operador').trim()

    if (!nome || !email) return json({ error: 'Informe nome e e-mail.' }, 400)

    let authUserId: string | undefined = undefined
    try {
      const existingAuth = await findAuthUserByEmail(email)
      authUserId = existingAuth?.id
      if (existingAuth) {
        await admin.auth.admin.updateUserById(existingAuth.id, { password: senha, email_confirm: true, user_metadata: { nome } })
      } else {
        const { data: authUser } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } })
        if (authUser?.user) authUserId = authUser.user.id
      }
    } catch (authErr) {
      console.warn('Auth admin operation warning:', authErr)
    }

    const { data: config } = await admin
      .from('config_permissoes')
      .select('apps,pode_empresas,pode_fornecedores,pode_lancar,pode_pagar,pode_aprovar,limite_valor,abas_financeiro,pode_alterar_status,pode_excluir_lancamento')
      .eq('cargo', cargo)
      .maybeSingle()

    const isGlobalAdmin = cargo === 'admin_geral'
    const allApps = 'rh,ponto,financeiro,suprimentos,obras,rdo,frota,usuarios'

    // Suporte a multi-empresa
    const empresasIds: string[] | null = Array.isArray(payload.empresas_ids) && payload.empresas_ids.length > 0
      ? payload.empresas_ids as string[]
      : null

    const profile = {
      nome,
      email,
      cargo,
      empresa_id: isGlobalAdmin ? null : (payload.empresa_id || (empresasIds?.[0] ?? null)),
      empresas_ids: isGlobalAdmin ? null : empresasIds,
      senha: senha,
      override_permissoes: isGlobalAdmin,
      apps: isGlobalAdmin ? allApps : (config?.apps || cargo),
      pode_empresas: isGlobalAdmin || Boolean(config?.pode_empresas),
      pode_fornecedores: isGlobalAdmin || Boolean(config?.pode_fornecedores),
      pode_lancar: isGlobalAdmin || Boolean(config?.pode_lancar),
      pode_pagar: isGlobalAdmin || Boolean(config?.pode_pagar),
      pode_aprovar: isGlobalAdmin || Boolean(config?.pode_aprovar),
      limite_valor: isGlobalAdmin ? null : (config?.limite_valor ?? 0),
      abas_financeiro: isGlobalAdmin ? null : (config?.abas_financeiro ?? null),
      pode_alterar_status: isGlobalAdmin ? true : (config?.pode_alterar_status ?? true),
      pode_excluir_lancamento: isGlobalAdmin ? true : (config?.pode_excluir_lancamento ?? false),
    }

    const { data: existing } = await admin.from('colaboradores').select('id').ilike('email', email).maybeSingle()
    const profileResult = existing
      ? await admin.from('colaboradores').update(profile).eq('id', existing.id)
      : await admin.from('colaboradores').insert(profile)

    if (profileResult.error) {
      return json({ error: profileResult.error.message }, 400)
    }

    // Se estiver aprovando uma solicitação, atualiza a tabela de solicitações
    if (payload.action === 'approve_user' && payload.solicitacao_id) {
      const solId = String(payload.solicitacao_id).trim()
      const adminId = String(payload.admin_id || '').trim()
      await admin.from('solicitacoes_acesso').update({
        status: 'aprovado',
        aprovado_por: adminId,
        aprovado_em: new Date().toISOString()
      }).eq('id', solId)
    }

    return json({ ok: true, user_id: authUserId })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
