import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const bucket = "rh-documentos";
const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function hash(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase().slice(-120);
}

async function getInvite(token: string) {
  if (!token || token.length < 32) return { error: "Convite inválido.", status: 400 };
  const tokenHash = await hash(token);
  const { data, error } = await admin.from("rh_admissao_convites").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (error || !data) return { error: "Convite não encontrado.", status: 404 };
  if (data.status === "revogado") return { error: "Este convite foi revogado pelo RH.", status: 410 };
  if (data.status === "aprovado") return { error: "Este cadastro já foi aprovado.", status: 410 };
  if (new Date(data.expires_at).getTime() <= Date.now() && !["aguardando_aprovacao", "aprovado"].includes(data.status)) {
    await admin.from("rh_admissao_convites").update({ status: "expirado", updated_at: new Date().toISOString() }).eq("id", data.id);
    return { error: "Este convite expirou. Solicite um novo link ao RH.", status: 410 };
  }
  return { data };
}

async function loadFlow(inviteId: string) {
  const [{ data: modelos }, { data: documentos }] = await Promise.all([
    admin.from("rh_modelos_admissao").select("id,codigo,ordem,nome,descricao,tipo_arquivo,arquivo_nome,arquivo_url,checklist").eq("ativo", true).order("ordem"),
    admin.from("rh_admissao_documentos").select("id,modelo_id,item_id,nome,storage_path,mime_type,tamanho_bytes,status,observacao_rh,enviado_em").eq("convite_id", inviteId).neq("status", "aguardando_upload").order("created_at"),
  ]);
  return { modelos: modelos || [], documentos: documentos || [] };
}

function progress(modelos: any[], documentos: any[]) {
  // A Etapa 3 (Documentos Admissionais) é preenchida internamente pelo DP/RH e não é exigida do candidato
  const modelosCandidato = modelos.filter(m => m.ordem !== 3);
  const etapas = modelosCandidato.map(modelo => {
    const required = (modelo.checklist || []).filter((item: any) => item.obrigatorio);
    const complete = required.every((item: any) => documentos.some((doc: any) => doc.modelo_id === modelo.id && doc.item_id === item.id && ["enviado", "aprovado"].includes(doc.status)));
    const count = documentos.filter((doc: any) => doc.modelo_id === modelo.id && doc.status !== "pendencia").length;
    return { modelo_id: modelo.id, ordem: modelo.ordem, concluida: complete, enviados: count, obrigatorios: required.length };
  });
  const firstPending = etapas.find((etapa: any) => !etapa.concluida);
  return { etapas, etapa_atual: firstPending?.ordem || 4, completo: etapas.length === 3 && etapas.every((etapa: any) => etapa.concluida) };
}

async function requireRh(req: Request) {
  const bearer = req.headers.get("Authorization") || "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!jwt) return null;
  const { data: userData } = await admin.auth.getUser(jwt);
  const email = userData.user?.email;
  if (!email) return null;
  const { data: colaborador } = await admin.from("colaboradores").select("id,cargo").ilike("email", email).maybeSingle();
  return colaborador && ["rh", "admin_geral"].includes(String(colaborador.cargo || "").toLowerCase()) ? colaborador : null;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const payload = req.method === "POST" ? await req.json() : {};
    const action = payload.action || (req.method === "GET" ? "view" : "submit");

    if (action === "approve") {
      const rh = await requireRh(req);
      if (!rh) return json({ error: "Apenas RH ou administrador geral pode aprovar." }, 403);
      const { data: convite } = await admin.from("rh_admissao_convites").select("*").eq("id", payload.convite_id).maybeSingle();
      if (!convite) return json({ error: "Cadastro temporário não encontrado." }, 404);
      if (convite.funcionario_id) return json({ ok: true, funcionario_id: convite.funcionario_id });
      const flow = await loadFlow(convite.id);
      const state = progress(flow.modelos, flow.documentos);
      if (!state.completo) return json({ error: "Ainda existem documentos obrigatórios pendentes." }, 400);
      const { data: funcionario, error: employeeError } = await admin.from("funcionarios").insert({
        nome: convite.nome_destinatario, cpf: convite.cpf, matricula: convite.matricula, cargo: convite.cargo,
        data_admissao: convite.data_admissao, telefone: convite.telefone_destinatario, email: convite.email_destinatario,
        endereco: convite.endereco, status: "Ativo", dados_registro: { obra: convite.obra, origem: "cadastro_temporario", convite_id: convite.id },
      }).select("*").single();
      if (employeeError || !funcionario) return json({ error: employeeError?.message || "Falha ao criar funcionário." }, 400);
      const stagesPayload = flow.modelos.map((modelo: any) => ({
        funcionario_id: funcionario.id, modelo_id: modelo.id, status: "Concluída",
        checklist: (modelo.checklist || []).map((item: any) => ({ ...item, concluido: flow.documentos.some((doc: any) => doc.modelo_id === modelo.id && doc.item_id === item.id && ["enviado", "aprovado"].includes(doc.status)) })),
        iniciado_em: convite.created_at, concluido_em: new Date().toISOString(),
      }));
      const { data: stages, error: stagesError } = await admin.from("funcionario_admissao_etapas").insert(stagesPayload).select("id,modelo_id");
      if (stagesError) return json({ error: stagesError.message }, 400);
      const stageByModel = new Map((stages || []).map((stage: any) => [stage.modelo_id, stage.id]));
      if (flow.documentos.length) {
        const { error: docsError } = await admin.from("funcionario_documentos").insert(flow.documentos.map((doc: any) => ({
          funcionario_id: funcionario.id, etapa_id: stageByModel.get(doc.modelo_id), tipo: "Admissão",
          nome: doc.nome, arquivo_url: doc.storage_path, storage_path: doc.storage_path,
          tamanho_bytes: doc.tamanho_bytes, mime_type: doc.mime_type, status: "Recebido",
        })));
        if (docsError) return json({ error: docsError.message }, 400);
      }
      await admin.from("funcionario_historico").insert({ funcionario_id: funcionario.id, tipo: "Admissão", descricao: "Cadastro e quatro etapas documentais aprovados pelo RH." });
      await admin.from("rh_admissao_convites").update({ status: "aprovado", funcionario_id: funcionario.id, aprovado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", convite.id);
      return json({ ok: true, funcionario_id: funcionario.id });
    }

    const token = url.searchParams.get("token") || payload.token;
    const found = await getInvite(token);
    if ("error" in found) return json({ error: found.error }, found.status);
    const convite = found.data!;
    const flow = await loadFlow(convite.id);
    const state = progress(flow.modelos, flow.documentos);

    if (action === "view") {
      if (convite.status === "ativo") await admin.from("rh_admissao_convites").update({ status: "em_preenchimento", updated_at: new Date().toISOString() }).eq("id", convite.id);
      return json({
        convite: { id: convite.id, nome_destinatario: convite.nome_destinatario, email_destinatario: convite.email_destinatario, telefone_destinatario: convite.telefone_destinatario, cargo: convite.cargo, obra: convite.obra, expires_at: convite.expires_at, status: convite.status === "ativo" ? "em_preenchimento" : convite.status },
        modelos: flow.modelos.filter((m: any) => m.ordem !== 3),
        documentos: flow.documentos,
        progresso: state
      });
    }

    if (action === "request_upload") {
      if (convite.status === "aguardando_aprovacao") return json({ error: "O cadastro já foi enviado ao RH." }, 409);
      const modelo = flow.modelos.find((item: any) => item.id === payload.modelo_id);
      const checklistItem = modelo?.checklist?.find((item: any) => item.id === payload.item_id);
      if (!modelo || !checklistItem) return json({ error: "Documento não pertence a uma etapa válida." }, 400);
      const size = Number(payload.tamanho_bytes || 0);
      const mime = String(payload.mime_type || "application/octet-stream");
      if (!size || size > 15728640) return json({ error: "O arquivo deve ter no máximo 15 MB." }, 400);
      if (!allowedTypes.has(mime)) return json({ error: "Formato de arquivo não permitido." }, 400);
      const path = `cadastros/${convite.id}/etapa-${modelo.ordem}/${crypto.randomUUID()}-${safeName(String(payload.nome || "documento"))}`;
      const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUploadUrl(path);
      if (signedError || !signed) return json({ error: signedError?.message || "Falha ao preparar upload." }, 400);
      const { data: document, error: documentError } = await admin.from("rh_admissao_documentos").insert({
        convite_id: convite.id, modelo_id: modelo.id, item_id: checklistItem.id, nome: String(payload.nome || "documento"),
        storage_path: path, mime_type: mime, tamanho_bytes: size, status: "aguardando_upload",
      }).select("id").single();
      if (documentError) return json({ error: documentError.message }, 400);
      return json({ document_id: document.id, path, upload_token: signed.token });
    }

    if (action === "confirm_upload") {
      const { data: document } = await admin.from("rh_admissao_documentos").select("id").eq("id", payload.document_id).eq("convite_id", convite.id).maybeSingle();
      if (!document) return json({ error: "Documento não encontrado." }, 404);
      await admin.from("rh_admissao_documentos").update({ status: "enviado", enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", document.id);
      const refreshed = await loadFlow(convite.id);
      const refreshedState = progress(refreshed.modelos, refreshed.documentos);
      await admin.from("rh_admissao_convites").update({ etapa_atual: refreshedState.etapa_atual, status: "em_preenchimento", updated_at: new Date().toISOString() }).eq("id", convite.id);
      return json({ ok: true, modelos: refreshed.modelos.filter((m: any) => m.ordem !== 3), documentos: refreshed.documentos, progresso: refreshedState });
    }

    if (action === "delete_document") {
      if (convite.status === "aguardando_aprovacao") return json({ error: "O cadastro já foi enviado ao RH." }, 409);
      if (convite.status === "aprovado") return json({ error: "O cadastro já foi aprovado." }, 409);
      const { data: document } = await admin.from("rh_admissao_documentos").select("*").eq("id", payload.document_id).eq("convite_id", convite.id).maybeSingle();
      if (!document) return json({ error: "Documento não encontrado." }, 404);
      if (document.storage_path) {
        try {
          await admin.storage.from(bucket).remove([document.storage_path]);
        } catch (_) {}
      }
      await admin.from("rh_admissao_documentos").delete().eq("id", document.id);
      const refreshed = await loadFlow(convite.id);
      const refreshedState = progress(refreshed.modelos, refreshed.documentos);
      await admin.from("rh_admissao_convites").update({ etapa_atual: refreshedState.etapa_atual, status: "em_preenchimento", updated_at: new Date().toISOString() }).eq("id", convite.id);
      return json({ ok: true, modelos: refreshed.modelos.filter((m: any) => m.ordem !== 3), documentos: refreshed.documentos, progresso: refreshedState });
    }

    if (action === "submit") {
      if (!state.completo) return json({ error: "Envie todos os documentos obrigatórios antes de finalizar." }, 400);
      await admin.from("rh_admissao_convites").update({ status: "aguardando_aprovacao", etapa_atual: 4, usado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", convite.id);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Não foi possível processar o convite." }, 500);
  }
});
