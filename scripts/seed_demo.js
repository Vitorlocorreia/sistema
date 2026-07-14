const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Auxiliares
const demoIds = {};
const addId = (table, id) => {
  if (!demoIds[table]) demoIds[table] = [];
  demoIds[table].push(id);
};

async function seed() {
  console.log('🌱 Iniciando Povoamento Massivo da Demonstração...');

  // --- 1. OBRAS ---
  const obras = [
    { nome: 'Residencial Aurora', progresso: 85, status: 'Em dia', cliente: 'Investimentos Alpha', endereco: 'Av. Paulista, 1000' },
    { nome: 'Edifício Belvedere', progresso: 40, status: 'Atenção', cliente: 'Beta Imóveis', endereco: 'Rua Faria Lima, 200' },
    { nome: 'Condomínio Vista Linda', progresso: 15, status: 'Atrasado', cliente: 'Gama Construtora', endereco: 'Rodovia Sul, Km 15' },
    { nome: 'Shopping Central', progresso: 100, status: 'Concluído', cliente: 'Shopping Group', endereco: 'Praça Central, 1' }
  ];
  const { data: oData, error: oErr } = await supabase.from('obras').insert(obras).select();
  if (oErr) return console.error('Erro obras:', oErr);
  oData.forEach(o => addId('obras', o.id));
  const [obra1, obra2, obra3, obra4] = oData.map(o => o.id);

  // --- 2. FOTOS DA GALERIA ---
  // Algumas URLs mockadas realistas de construção
  const fotos = [
    { obra_id: obra1, legenda: 'Fachada concluída (Pintura)', imagem_url: 'https://images.unsplash.com/photo-1541888081622-19e340c21345?q=80&w=800&auto=format&fit=crop', data_iso: new Date().toISOString() },
    { obra_id: obra1, legenda: 'Acabamento Interno', imagem_url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=800&auto=format&fit=crop', data_iso: new Date(Date.now() - 86400000).toISOString() },
    { obra_id: obra2, legenda: 'Concretagem da Laje', imagem_url: 'https://images.unsplash.com/photo-1504307651254-35680f356f27?q=80&w=800&auto=format&fit=crop', data_iso: new Date(Date.now() - 86400000 * 2).toISOString() },
    { obra_id: obra3, legenda: 'Terraplanagem (Em Atraso)', imagem_url: 'https://images.unsplash.com/photo-1574621100236-d25b64dcda76?q=80&w=800&auto=format&fit=crop', data_iso: new Date(Date.now() - 86400000 * 3).toISOString() }
  ];
  const { data: ptData, error: ptErr } = await supabase.from('fotos').insert(fotos).select();
  if (ptErr) return console.error('Erro fotos:', ptErr);
  ptData.forEach(p => addId('fotos', p.id));

  // --- 3. EMPRESA E FORNECEDORES ---
  const { data: eData } = await supabase.from('empresas').insert([{ razao_social: 'Construtora Tech S/A', nome_fantasia: 'Tech Construtora', cor: '#3B82F6' }]).select();
  const empresaId = eData[0].id;
  addId('empresas', empresaId);

  const fornecedores = [
    { empresa_id: empresaId, razao_social: 'Gerdau Aço', nome_fantasia: 'Gerdau', tipo: 'PJ', prazo_pagamento: 30, categoria: 'Materiais' },
    { empresa_id: empresaId, razao_social: 'Cimentos Votorantim', nome_fantasia: 'Votorantim', tipo: 'PJ', prazo_pagamento: 15, categoria: 'Materiais' },
    { empresa_id: empresaId, razao_social: 'Locações Pesadas', nome_fantasia: 'LocaPesada', tipo: 'PJ', prazo_pagamento: 10, categoria: 'Equipamentos' }
  ];
  const { data: fData } = await supabase.from('fornecedores').insert(fornecedores).select();
  fData.forEach(f => addId('fornecedores', f.id));
  const [fornA, fornB, fornC] = fData.map(f => f.id);

  // --- 4. CONTAS (FINANCEIRO FERVENDO) ---
  const hoje = new Date();
  const hStr = hoje.toISOString().split('T')[0];
  const mesP = new Date(hoje); mesP.setMonth(hoje.getMonth() - 1);
  const mesPStr = mesP.toISOString().split('T')[0];
  const prox = new Date(hoje); prox.setDate(hoje.getDate() + 4);
  const proxStr = prox.toISOString().split('T')[0];
  const atrasada = new Date(hoje); atrasada.setDate(hoje.getDate() - 3);
  const atrStr = atrasada.toISOString().split('T')[0];

  const contas = [
    // Contas Pagas (DRE)
    { empresa_id: empresaId, obra_id: obra1, tipo: 'receber', categoria: 'Medição (Cliente)', descricao: 'Medição Fase 1 - Aurora', valor: 250000.00, data_vencimento: mesPStr, status: 'Pago', pago_em: mesP.toISOString(), recorrencia: 'unico' },
    { empresa_id: empresaId, obra_id: obra2, tipo: 'receber', categoria: 'Medição (Cliente)', descricao: 'Adiantamento Belvedere', valor: 120000.00, data_vencimento: hStr, status: 'Pago', pago_em: hoje.toISOString(), recorrencia: 'unico' },
    { empresa_id: empresaId, obra_id: obra1, fornecedor_id: fornA, tipo: 'pagar', categoria: 'Aço/Ferragens', descricao: 'Armações Fundação', valor: 35000.00, data_vencimento: mesPStr, status: 'Pago', pago_em: mesP.toISOString(), recorrencia: 'unico' },
    { empresa_id: empresaId, obra_id: obra2, fornecedor_id: fornB, tipo: 'pagar', categoria: 'Concreto', descricao: 'Cimento CP-II', valor: 18000.00, data_vencimento: hStr, status: 'Pago', pago_em: hoje.toISOString(), recorrencia: 'unico' },
    // Pendentes e Vencidas (Gráficos KPIs e Alertas)
    { empresa_id: empresaId, obra_id: obra3, fornecedor_id: fornC, tipo: 'pagar', categoria: 'Locação Máquinas', descricao: 'Trator Esteira', valor: 12500.00, data_vencimento: proxStr, status: 'Pendente', recorrencia: 'unico' },
    { empresa_id: empresaId, obra_id: obra3, fornecedor_id: fornA, tipo: 'pagar', categoria: 'Estruturas', descricao: 'Vigas', valor: 8900.00, data_vencimento: atrStr, status: 'Pendente', recorrencia: 'unico' },
    { empresa_id: empresaId, obra_id: obra2, fornecedor_id: fornB, tipo: 'pagar', categoria: 'Cimento', descricao: 'Areia + Cimento Lote 3', valor: 4500.00, data_vencimento: proxStr, status: 'Pendente', recorrencia: 'unico' }
  ];
  const { data: cData, error: cErr } = await supabase.from('contas').insert(contas).select();
  if (cErr || !cData) return console.error('Erro contas:', cErr);
  cData.forEach(c => addId('contas', c.id));

  // --- 5. SUPRIMENTOS ---
  const suprimentos = [
    { obra_id: obra3, titulo: 'Cimento CP-II', quantidade: '250', unidade: 'Sacos', status: 'Aprovação', solicitante: 'Carlos Eng', fornecedor: 'Votorantim', valor: 7500.00 },
    { obra_id: obra2, titulo: 'Aço CA50', quantidade: '3', unidade: 'Ton', status: 'Aprovação', solicitante: 'Maria Arq', fornecedor: 'Gerdau', valor: 18000.00 },
    { obra_id: obra1, titulo: 'Tinta Acrílica Premium', quantidade: '50', unidade: 'Latas', status: 'Em Trânsito', solicitante: 'João Mestre' },
    { obra_id: obra1, titulo: 'Pisos Porcelanato', quantidade: '400', unidade: 'm²', status: 'Solicitado', solicitante: 'João Mestre' }
  ];
  const { data: sData, error: sErr } = await supabase.from('suprimentos').insert(suprimentos).select();
  if (sErr || !sData) return console.error('Erro suprimentos:', sErr);
  sData.forEach(s => addId('suprimentos', s.id));

  // --- 6. EQUIPE (MEMBROS) ---
  const equipe = [
    { nome: 'Carlos Silva', funcao: 'Engenheiro Civil', ativo: true },
    { nome: 'José Alencar', funcao: 'Mestre de Obras', ativo: true },
    { nome: 'Mariana Costa', funcao: 'Arquiteta', ativo: true }
  ];
  const { data: eqData, error: eqErr } = await supabase.from('equipe').insert(equipe).select();
  if (eqErr || !eqData) return console.error('Erro equipe:', eqErr);
  eqData.forEach(eq => addId('equipe', eq.id));

  // --- 7. TAREFAS ---
  const tarefas = [
    { obra_id: obra1, titulo: 'Vistoria Final Acabamento', categoria: 'Qualidade', status: 'Em Andamento', responsavel: 'Mariana Costa' },
    { obra_id: obra2, titulo: 'Aprovação Concreto Usinado', categoria: 'Engenharia', status: 'Em Andamento', responsavel: 'Carlos Silva' },
    { obra_id: obra3, titulo: 'Drenagem do Terreno (Atraso Chuva)', categoria: 'Manutenção', status: 'A Fazer', responsavel: 'José Alencar' }
  ];
  const { data: tData, error: tErr } = await supabase.from('tarefas').insert(tarefas).select();
  if (tErr || !tData) return console.error('Erro tarefas:', tErr);
  tData.forEach(t => addId('tarefas', t.id));

  // --- 8. RDOs & ATIVIDADES/EQUIPAMENTOS ---
  const rdos = [
    { obra_id: obra1, data: hStr, responsavel: 'Carlos Silva', clima_manha: '☀️ Ensolarado', clima_tarde: '☀️ Ensolarado', condicao_solo: 'Seco', efetivo_proprio: 22, efetivo_terceiros: 8, resumo: 'Pintura e acabamentos finos procedendo dentro do cronograma.', status: 'Aprovado' },
    { obra_id: obra3, data: hStr, responsavel: 'José Alencar', clima_manha: '🌧️ Chuvoso', clima_tarde: '🌧️ Tempestade', condicao_solo: 'Lama', efetivo_proprio: 5, efetivo_terceiros: 0, resumo: 'Devido às fortes chuvas, houve alagamento no canteiro. Obra em alerta vermelho de atraso.', status: 'Rascunho' }
  ];
  const { data: rData, error: rErr } = await supabase.from('rdos').insert(rdos).select();
  if (rErr || !rData) return console.error('Erro rdos:', rErr);
  rData.forEach(r => addId('rdos', r.id));

  const [rdo1, rdo2] = rData.map(r => r.id);

  // Atividades
  const rdoAtividades = [
    { rdo_id: rdo1, descricao: 'Aplicação de massa corrida', quantidade: '120', unidade: 'm²' },
    { rdo_id: rdo1, descricao: 'Instalação de Janelas (Torre A)', quantidade: '15', unidade: 'un' },
    { rdo_id: rdo2, descricao: 'Drenagem emergencial (Bombas)', quantidade: '1', unidade: 'dia' }
  ];
  const { data: raData, error: raErr } = await supabase.from('rdo_atividades').insert(rdoAtividades).select();
  if (raErr || !raData) return console.error('Erro rdo_atividades:', raErr);
  raData.forEach(r => addId('rdo_atividades', r.id));

  // Equipamentos
  const rdoEquip = [
    { rdo_id: rdo1, nome: 'Elevador Cremalheira', status: 'OPERANDO' },
    { rdo_id: rdo2, nome: 'Retroescavadeira', status: 'PARADO' },
    { rdo_id: rdo2, nome: 'Motobomba Submersível', status: 'MANUTENÇÃO' }
  ];
  const { data: reData, error: reErr } = await supabase.from('rdo_equipamentos').insert(rdoEquip).select();
  if (reErr || !reData) return console.error('Erro rdo_equip:', reErr);
  reData.forEach(r => addId('rdo_equipamentos', r.id));

  // Salvar IDS para limpeza futura
  fs.writeFileSync(path.resolve(__dirname, '.demo-ids.json'), JSON.stringify(demoIds, null, 2));
  console.log('✅ Povoamento MASSIVO concluído! Dashboard recheado de insights, alertas e relatórios.');
}

seed();
