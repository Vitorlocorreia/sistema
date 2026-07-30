const XLSX = require('xlsx');
const { randomUUID: uuidv4 } = require('crypto');
const fs = require('fs');

// ─── FORNECEDORES JÁ EXISTENTES NO BANCO ───────────────────────────────────
const existingSuppliers = [
  { id: '5cde0fa4-a7c9-4e85-a965-f818740f5f15', razao_social: 'CASIRA EMPREENDIMENTOS E ADMINISTRAÇÃO LTDA' },
  { id: '0e338aec-27a0-4d5d-8031-afb1be3978a0', razao_social: 'COMERCIAL ELETRICA P.J. LTDA' },
  { id: '5e362c16-977a-42e0-90c2-4e4bf3c91bc9', razao_social: 'JASON DOS SANTOS SILVA ME ( J S ALUGUEL DE EQUIP )' },
];

// ─── PREFIXOS QUE FICAM COMO GERAL (NULL) ──────────────────────────────────
const generalPrefixes = [
  'VALE REFEIÇÃO',
  'VALE TRANSPORTE',
  'SALÁRIO',
  'DIÁRIAS',
  'FGTS',
  'DCTF WEB',
  'INSS TOMADOR',
  'COFINS-PIS-CSLL',
  'PARCELAMENTO',
  'IPTU',
  'PPI PMSP',
  'PRESTAÇÃO DE SERVIÇO',
];

function isGeneral(name) {
  const upper = (name || '').toUpperCase();
  return generalPrefixes.some(p => upper.startsWith(p.toUpperCase()));
}

// ─── LER EXCEL ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile('ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
const ws = wb.Sheets['PÓS 25.07.2026'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

// Fornecedores únicos da planilha
const uniqueExcelSuppliers = [...new Set(rows.map(r => r[0]).filter(Boolean))];

// ─── CATEGORIZAR ───────────────────────────────────────────────────────────
const toCreate = [];
const toSkip = [];

for (const name of uniqueExcelSuppliers) {
  if (isGeneral(name)) {
    toSkip.push(name);
    continue;
  }
  // Verificar se já existe
  const exists = existingSuppliers.find(e =>
    e.razao_social.toUpperCase().includes(name.toUpperCase().trim()) ||
    name.toUpperCase().trim().includes(e.razao_social.toUpperCase())
  );
  if (exists) {
    // já existe, só linkar
    toSkip.push(`[JÁ EXISTE] ${name} → ${exists.id}`);
  } else {
    toCreate.push(name.trim());
  }
}

console.log(`\n✅ Deixar como GERAL (${toSkip.length}):`);
toSkip.forEach(s => console.log('  -', s));
console.log(`\n🆕 Criar no banco (${toCreate.length}):`);
toCreate.forEach(s => console.log('  -', s));

// ─── GERAR IDs PARA NOVOS FORNECEDORES ────────────────────────────────────
const newSuppliers = toCreate.map(razao => ({
  id: uuidv4(),
  razao_social: razao,
}));

// ─── MAPA COMPLETO Excel name → fornecedor_id ──────────────────────────────
// Inclui existentes + novos
const allMapping = [
  // Existentes com variações de nome do Excel
  { excelPattern: 'ACORDO TRABALHISTA / CASIRA', id: '5cde0fa4-a7c9-4e85-a965-f818740f5f15' },
  { excelPattern: 'COMERCIAL ELÉTRICA PJ LTDA', id: '0e338aec-27a0-4d5d-8031-afb1be3978a0' },
  { excelPattern: 'JASON DOS SANTOS SILVA ME', id: '5e362c16-977a-42e0-90c2-4e4bf3c91bc9' },
  { excelPattern: 'JASON DOS SANTOS SILVA', id: '5e362c16-977a-42e0-90c2-4e4bf3c91bc9' },
  // Novos
  ...newSuppliers.map(s => ({ excelPattern: s.razao_social, id: s.id })),
];

// ─── SQL: INSERT FORNECEDORES ───────────────────────────────────────────────
function esc(s) { return (s || '').replace(/'/g, "''"); }

let insertSql = '-- Inserir novos fornecedores\n';
insertSql += 'INSERT INTO public.fornecedores (id, empresa_id, razao_social) VALUES\n';
insertSql += newSuppliers.map(s =>
  `('${s.id}', 'eaeedfef-3488-4d74-938f-11a21a5e570a', '${esc(s.razao_social)}')`
).join(',\n');
insertSql += ';\n';

fs.writeFileSync('insert_fornecedores_pos.sql', insertSql, 'utf8');
console.log('\n✅ Gerado: insert_fornecedores_pos.sql');

// ─── SQL: UPDATE CONTAS ────────────────────────────────────────────────────
let updateSql = '-- Atualizar fornecedor_id nas contas importadas\n';

for (const mapping of allMapping) {
  const escaped = esc(mapping.excelPattern);
  updateSql += `UPDATE public.contas SET fornecedor_id = '${mapping.id}', possui_fornecedor = TRUE WHERE criado_por = 'Importação Excel PÓS 25.07.2026' AND descricao ILIKE '${escaped}%';\n`;
}

fs.writeFileSync('update_contas_fornecedor.sql', updateSql, 'utf8');
console.log('✅ Gerado: update_contas_fornecedor.sql');

// ─── RESUMO ────────────────────────────────────────────────────────────────
console.log('\n=== RESUMO ===');
console.log(`Novos fornecedores a criar: ${newSuppliers.length}`);
console.log(`UPDATEs a executar: ${allMapping.length}`);
