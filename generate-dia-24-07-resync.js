const XLSX = require('xlsx');
const fs = require('fs');

// Read Obras map
const obrasMap = {
  'CEHAB - HR': '619a9026-d903-4d64-9db0-922b29d8e27b',
  'CEHAB HR': '619a9026-d903-4d64-9db0-922b29d8e27b',
  'CEHAB - IGARASSU': '6f6daefb-b9aa-4b41-9fd1-5728197d08d7',
  'CEHAB IGARASSU': '6f6daefb-b9aa-4b41-9fd1-5728197d08d7',
  'SEPE - RESERVATÓRIOS': 'ec6a92d8-348f-4867-9365-57942cd1e7ec',
  'SEPE RESERVATÓRIOS': 'ec6a92d8-348f-4867-9365-57942cd1e7ec',
  'URB RECIFE - BASÍLICA DO CARMO': '1b9e7411-f1ee-4de1-a72b-2bd0856188c0',
  'URB BASÍLICA': '1b9e7411-f1ee-4de1-a72b-2bd0856188c0',
  'URB RECIFE - CAIS DA IMPERATRIZ': 'bbd50a2b-dec0-4bb8-81ec-305f198a41c6',
  'URB CAIS': 'bbd50a2b-dec0-4bb8-81ec-305f198a41c6',
  'URB RECIFE - LOTE 7': '63489f67-5c9c-45de-906b-6a96007af2ac',
  'URB RECIFE - LOTE 9': '4a05d794-ddc0-425b-b752-5f69489ed05d',
  'URB RECIFE - LOTE 10B': '3cd4e878-b21d-4b59-881b-af32aca9a278',
  'URB LOTE 10B': '3cd4e878-b21d-4b59-881b-af32aca9a278',
};

function getObraId(nat) {
  if (!nat) return null;
  const key = nat.toString().trim().toUpperCase();
  for (const [pattern, id] of Object.entries(obrasMap)) {
    if (key.includes(pattern.toUpperCase())) return id;
  }
  return null;
}

// Escaping
function esc(str) {
  if (str === null || str === undefined) return '';
  return str.toString()
    .replace(/\\/g, '')
    .replace(/'/g, "''")
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

// Read Excel file
const wb = XLSX.readFile('dia 24.07 importar sistema.xlsx');
const ws = wb.Sheets['Planilha1'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

console.log('Total de linhas para resincronizar:', rows.length);

const parsed = [];

rows.forEach((r, idx) => {
  const lineNo = idx + 2;
  const fornecedorStr = esc(r[0]);
  const nf = esc(r[1]);
  const natureza = esc(r[2]);
  const pagamentoObs = esc(r[3]);
  let val = parseFloat(r[4]);
  if (isNaN(val) || val < 0) val = 0;
  
  // Status rule > 30000 -> Bloqueado, else Lançado
  const status = val > 30000 ? 'Bloqueado' : 'Lançado';

  // Description building
  let desc = fornecedorStr;
  if (nf && nf !== '-' && nf !== 'SEM NOTA FISCAL' && nf !== 'NF À EMITIR') {
    desc += ` - NF ${nf}`;
  } else if (nf === 'NF À EMITIR' || nf === 'SEM NOTA FISCAL') {
    desc += ` (NF à emitir)`;
  }

  // Obs building
  let obs = '';
  if (pagamentoObs) obs += `Forma de Pagamento: ${pagamentoObs}`;

  const obraId = getObraId(natureza);

  parsed.push({
    lineNo,
    fornecedorStr,
    desc,
    val,
    status,
    obs,
    obraId,
    natureza
  });
});

console.log('Total processado:', parsed.length);
console.log('Bloqueados (> 30k):', parsed.filter(p => p.status === 'Bloqueado').length);
console.log('Lançados (<= 30k):', parsed.filter(p => p.status === 'Lançado').length);
console.log('GRF COMÉRCIO entries:', parsed.filter(p => p.fornecedorStr.includes('GRF')).length);

// Generate SQL batches of ~30 items
const BATCH_SIZE = 30;
const batches = [];
for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
  batches.push(parsed.slice(i, i + BATCH_SIZE));
}

batches.forEach((batch, bIdx) => {
  const sqlValues = batch.map(item => {
    const obraVal = item.obraId ? `'${item.obraId}'` : 'NULL';
    const obsVal = item.obs ? `'${item.obs}'` : 'NULL';
    
    return `(
    'eaeedfef-3488-4d74-938f-11a21a5e570a',
    ${obraVal},
    NULL,
    'pagar',
    '${item.desc}',
    ${item.val},
    '2026-07-24',
    '2026-07-24',
    '${item.status}',
    ${obsVal},
    FALSE,
    FALSE,
    'unico',
    'Importação Excel ATÉ 24.07.2026'
  )`;
  }).join(',\n');

  const sql = `INSERT INTO public.contas (
  empresa_id,
  obra_id,
  fornecedor_id,
  tipo,
  descricao,
  valor,
  data_vencimento,
  data_previsao,
  status,
  observacoes,
  possui_fornecedor,
  pagamento_antecipado,
  recorrencia,
  criado_por
) VALUES
${sqlValues};`;

  fs.writeFileSync(`clean_batch_24_07_${bIdx}.sql`, sql, 'utf8');
  console.log(`Gerado batch ${bIdx} (${batch.length} registros)`);
});
