const XLSX = require('xlsx');
const fs = require('fs');

// Read DB Output
const fileContent = fs.readFileSync('C:/Users/Adels/.gemini/antigravity/brain/1d3c95ce-bcc7-461f-82f7-13d0abd451d8/.system_generated/steps/552/output.txt', 'utf8');
const dataObj = JSON.parse(fileContent);
const dbRecords = JSON.parse(dataObj.result.match(/\[[\s\S]*\]/)[0]);

console.log('Total de registros atualmente no banco:', dbRecords.length);

// Read Excel
const wb = XLSX.readFile('dia 24.07 importar sistema.xlsx');
const ws = wb.Sheets['Planilha1'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

console.log('Total de linhas na planilha dia 24.07:', rows.length);

// Supplier mapping
const GRF_ID = '38b45c2b-9a71-4d4f-a27c-7fc79d163aa7';

// Escaping
function esc(str) {
  if (str === null || str === undefined) return '';
  return str.toString()
    .replace(/\\/g, '')
    .replace(/'/g, "''")
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

// Obras map
const obrasMap = {
  'CEHAB - HR': '619a9026-d903-4d64-9db0-922b29d8e27b',
  'CEHAB HR': '619a9026-d903-4d64-9db0-922b29d8e27b',
  'CEHAB - IGARASSU': '6f6daefb-b9aa-4b41-9fd1-5728197d08d7',
  'SEPE - RESERVATÓRIOS': 'ec6a92d8-348f-4867-9365-57942cd1e7ec',
  'URB RECIFE - BASÍLICA DO CARMO': '1b9e7411-f1ee-4de1-a72b-2bd0856188c0',
  'URB RECIFE - CAIS DA IMPERATRIZ': 'bbd50a2b-dec0-4bb8-81ec-305f198a41c6',
  'URB RECIFE - LOTE 7': '63489f67-5c9c-45de-906b-6a96007af2ac',
  'URB RECIFE - LOTE 9': '4a05d794-ddc0-425b-b752-5f69489ed05d',
  'URB RECIFE - LOTE 10B': '3cd4e878-b21d-4b59-881b-af32aca9a278',
};

function getObraId(nat) {
  if (!nat) return null;
  const key = nat.toString().trim().toUpperCase();
  for (const [pattern, id] of Object.entries(obrasMap)) {
    if (key.includes(pattern.toUpperCase())) return id;
  }
  return null;
}

const missingToInsert = [];
const alreadyInDb = [];

rows.forEach((r, idx) => {
  const lineNo = idx + 2;
  const fornecedorStr = esc(r[0]);
  const nf = esc(r[1]);
  const natureza = esc(r[2]);
  const pagamentoObs = esc(r[3]);
  let val = parseFloat(r[4]);
  if (isNaN(val) || val < 0) val = 0;

  // Build description
  let desc = fornecedorStr;
  if (nf && nf !== '-' && nf !== 'SEM NOTA FISCAL' && nf !== 'NF À EMITIR') {
    desc += ` - NF ${nf}`;
  } else if (nf === 'NF À EMITIR' || nf === 'SEM NOTA FISCAL') {
    desc += ` (NF à emitir)`;
  }

  // Deduplication check against DB
  const exists = dbRecords.some(db => {
    const dbDesc = (db.descricao || '').toUpperCase();
    const excelDesc = desc.toUpperCase();
    const dbVal = parseFloat(db.valor) || 0;
    return dbDesc === excelDesc && Math.abs(dbVal - val) < 0.01;
  });

  if (exists) {
    alreadyInDb.push({ lineNo, desc, val });
  } else {
    // Missing! We need to insert this record
    const status = val > 30000 ? 'Bloqueado' : 'Lançado';
    let obs = pagamentoObs ? `Forma de Pagamento: ${pagamentoObs}` : null;
    const obraId = getObraId(natureza);
    
    // Check if GRF
    const isGRF = fornecedorStr.toUpperCase().includes('GRF');
    const fornId = isGRF ? GRF_ID : null;

    missingToInsert.push({
      lineNo,
      fornecedorStr,
      desc,
      val,
      status,
      obs,
      obraId,
      fornId,
      isGRF
    });
  }
});

console.log(`\n=== RESULTADO DA COMPARAÇÃO ===`);
console.log(`Já estão no banco: ${alreadyInDb.length}`);
console.log(`Faltando no banco (a serem inseridos): ${missingToInsert.length}`);

const grfMissing = missingToInsert.filter(m => m.isGRF);
console.log(`Linhas do GRF COMÉRCIO a inserir: ${grfMissing.length}`);
grfMissing.forEach(g => {
  console.log(`  - Linha ${g.lineNo}: [${g.desc}] Valor: R$ ${g.val}`);
});

// Generate SQL for missing items
if (missingToInsert.length > 0) {
  const sqlValues = missingToInsert.map(item => {
    const obraVal = item.obraId ? `'${item.obraId}'` : 'NULL';
    const fornVal = item.fornId ? `'${item.fornId}'` : 'NULL';
    const obsVal = item.obs ? `'${item.obs}'` : 'NULL';
    const possuiForn = item.fornId ? 'TRUE' : 'FALSE';

    return `(
    'eaeedfef-3488-4d74-938f-11a21a5e570a',
    ${obraVal},
    ${fornVal},
    'pagar',
    '${item.desc}',
    ${item.val},
    '2026-07-24',
    '2026-07-24',
    '${item.status}',
    ${obsVal},
    ${possuiForn},
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

  fs.writeFileSync('smart_insert_missing_24_07.sql', sql, 'utf8');
  console.log('\n✅ Gerado: smart_insert_missing_24_07.sql');
}
