import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Verifica se o admin_id enviado no payload possui autorização financeira
async function isAuthorizedUser(payload: Record<string, unknown>) {
  const adminId = String(payload.admin_id || '').trim()
  if (!adminId) return false
  const { data } = await admin.from('colaboradores').select('cargo, pode_pagar, pode_lancar, pode_aprovar').eq('id', adminId).maybeSingle()
  if (!data) return false
  return data.cargo === 'admin_geral' || data.cargo === 'admin_empresa' || Boolean(data.pode_pagar) || Boolean(data.pode_lancar) || Boolean(data.pode_aprovar)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const payload = await request.json()

    if (!(await isAuthorizedUser(payload))) return json({ error: 'Acesso negado. Perfil sem permissão para executar esta ação.' }, 403)

    if (payload.action === 'save_negotiation') {
      const contaId = String(payload.conta_id || '').trim()
      const novoItem = payload.novo_item
      
      if (!contaId || !novoItem) {
        return json({ error: 'Dados insuficientes para salvar a negociação.' }, 400)
      }

      // 1. Busca a conta atual para obter o histórico
      const { data: conta, error: contaError } = await admin.from('contas').select('historico_negociacao').eq('id', contaId).maybeSingle()
      if (contaError || !conta) {
        return json({ error: 'Conta não encontrada ou erro ao acessar.' }, 404)
      }

      const historicoAtual = conta.historico_negociacao || []
      const novoHistorico = [...historicoAtual, novoItem]

      // 2. Atualiza a conta com o novo histórico
      const { error: updateError } = await admin.from('contas').update({
        historico_negociacao: novoHistorico
      }).eq('id', contaId)

      if (updateError) {
        return json({ error: updateError.message }, 400)
      }

      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
