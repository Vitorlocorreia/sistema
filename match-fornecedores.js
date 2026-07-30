const XLSX = require('xlsx');

// DB suppliers from Supabase
const dbSuppliers = [
  { id: 'e03dba6c-4efd-4b92-9bdf-cad5487e1d23', razao_social: 'ALUÍSIO PONTUAL MORAES ENGENHARIA EPP' },
  { id: 'f2d075a3-7d90-4cdc-acaf-c0fc944d552a', razao_social: 'Amilton Nei Soares Ribeiro' },
  { id: '5cde0fa4-a7c9-4e85-a965-f818740f5f15', razao_social: 'CASIRA EMPREENDIMENTOS E ADMINISTRAÇÃO LTDA' },
  { id: '0e338aec-27a0-4d5d-8031-afb1be3978a0', razao_social: 'COMERCIAL ELETRICA P.J. LTDA' },
  { id: '8d997d4b-ba23-4307-926d-ef0c297a66d2', razao_social: 'CONCRETECH SERVIÇOS DE CONCRETAGEM LTDA' },
  { id: '6909df1f-884f-475f-8736-5c6dc770c545', razao_social: 'CUNHA DERIVADOS DE PETRÓLEO LTDA' },
  { id: 'bdc56a76-adbe-4fc5-94eb-08260fb7848a', razao_social: 'D. M. MIX CONCRETO LTDA' },
  { id: 'd417ffb7-f443-4c75-99aa-c8f1fc4751ba', razao_social: 'DRS SOLUÇÕES E EQUIPAMENTOS DE PROTEÇÃO EIRELI' },
  { id: '494dbfd3-1a79-4d8d-9259-07cf4b89f807', razao_social: 'DUAS TORRES EMPREENDIMENTOS E ADMINISTRAÇÃO  LTDA' },
  { id: 'badfc783-93c4-4218-99e5-bae8d3100dd1', razao_social: 'E L ALMEIDA CONSTRUCOES E LOCACOES' },
  { id: '01e87325-4a91-4867-92b8-e71446db28ea', razao_social: 'E&F CONSTRUÇÕES DE EDIFÍCIOS LTDA' },
  { id: '7b1b1762-9501-4a09-82ee-13e394a6ce0a', razao_social: 'ELISANGELA PALMIERI DA SILVA COMÉRCIO DE PREMOLDADOS ME' },
  { id: '7ad64fda-74fa-417f-a832-4dc8fa6fe785', razao_social: 'ENGSERV SERVIÇO DE LOCAÇÃO DE MÁQUINAS E EQUIPAMENTOS LTDA' },
  { id: 'c4a03a87-2e1c-4987-a1d4-042cd4d106bc', razao_social: 'FELIPE DE FREITAS E SILVA BRANDÃO' },
  { id: 'e3621fad-ef09-454f-b006-91b809b3bb91', razao_social: 'FERNANDES DA SILVA & FERREIRA LTDA ( R & K CONSTUÇÕES )' },
  { id: '1e241c8a-22c0-44d4-9eaa-20b6cce8da5b', razao_social: 'FIV TRANSPORTES LTDA' },
  { id: '9d464ea3-9e21-4fe5-a4eb-d6575b8a56d6', razao_social: 'FLÁVIO SANTOS DALTRO DOS SANTOS' },
  { id: '2fe7e437-0e83-4322-8d8d-bf5d1ec0dd11', razao_social: 'FORTIS PRÉ-FABRICADOS LTDA' },
  { id: '55c70784-c8f7-47e6-800b-b9a425aa5cd5', razao_social: 'FRANCISCO RISOMAR DA SILVA' },
  { id: '2e24db90-d27a-47f4-b976-5215b3e64df2', razao_social: 'FRANCISCO RISOMAR DA SILVA ME (GUARARAPES CONSTRUÇÃO)' },
  { id: '05606a44-e54a-43b5-beeb-60b27d5cda12', razao_social: 'G R CONSTRUÇÕES PREMOLDADOS LTDA' },
  { id: 'e2785b21-fcc1-4478-94b4-232ac5030c3c', razao_social: 'GILMAR PIERRI FERREIRA WANDERLEY' },
  { id: '196e70f5-2178-4384-a7ef-398564adffd0', razao_social: 'HOLANDA CAVALCANTE SINALIZAÇÃO LTDA' },
  { id: 'b9d05ae1-840d-403b-8b29-7e537ee18070', razao_social: 'ISS TOMADOR / CONCREARTE SERVIÇOS DE CONCRETAGENS LTDA' },
  { id: 'b9d553dd-99c9-4393-903f-2e784215da25', razao_social: 'ISS TOMADOR / D. M. MIX CONCRETO LTDA' },
  { id: 'dc4ad63c-7350-4eb6-a43c-18d546884234', razao_social: 'ISS TOMADOR / F. N. CRESPO NETO E CIA LTDA' },
  { id: 'e8cd3cf7-40c4-4c13-8028-148a83f420eb', razao_social: 'ISS TOMADOR / HOLANDA CAVALCANTE SINALIZAÇÃO LTDA' },
  { id: '0a43bd56-778d-4d80-99bb-2707fd5ea341', razao_social: 'ITALO JOSE CAMILO PESSOA XAVIER 10785110470', nome_fantasia: 'SHALOM REFRIGERAÇÃO E ELÉTRICA' },
  { id: '5e362c16-977a-42e0-90c2-4e4bf3c91bc9', razao_social: 'JASON DOS SANTOS SILVA ME ( J S ALUGUEL DE EQUIP )' },
  { id: 'bb295d38-f007-4947-b087-f728766d9d03', razao_social: 'JC GRAFICA E COMERCIO LTDA', nome_fantasia: 'JCGRAFICAECOMERCIO' },
  { id: '73adabda-258a-42e2-b53e-ff9f00b7405d', razao_social: 'JOÃO JOSÉ DE OLIVEIRA' },
  { id: '953726a1-738a-4b3c-9cd8-810c1133dfdb', razao_social: 'JOSÉ ANTÔNIO DA SILVA' },
  { id: '9ddf6bec-2363-45d3-9841-da03035587b0', razao_social: 'JOSÉ BARBOSA NETO', nome_fantasia: 'JOSÉ BARBOSA' },
  { id: '16de0731-6647-476d-b874-d0ebe7899917', razao_social: 'JPM' },
  { id: '541bce73-83b9-4c92-a5fb-75d62c688e0e', razao_social: 'JUCELINO SOUZA DOS SANTOS ( PREMOL CONSTRUTORA E COMÉRCIO )' },
  { id: 'b7d84e74-8325-4ef4-8f4a-fdabd8faf9a8', razao_social: 'L L SILVA OBRAS' },
  { id: '36fe9989-7940-43c4-9d07-b78095ed4836', razao_social: 'M & J ENGENHARIA LTDA' },
  { id: 'b9f3598a-4c03-4d90-bf37-128727e6a3ba', razao_social: 'MADECON DISTRIBUIDORA DE MADEIRAS LTDA' },
  { id: 'c86597dd-4d1f-4c78-909d-7bb4857a1cdd', razao_social: 'MANCAS INDÚSTRIA E COMÉRCIO DE PRÉ MOLDADOS EIRELI' },
  { id: 'fce1945e-8902-4fae-b87f-35f9766bfa66', razao_social: 'MOISÉS GABRIEL GONZAGA ME ( M2 LOCAÇÃO E PRESTAÇÃO DE SERVIÇOS )' },
  { id: '571c0532-24b4-4ed1-a62d-7f720458ace7', razao_social: 'N. DOS SANTOS SOARES MATERIAL DE CONSTRUÇÃO' },
  { id: '806793a3-f3bc-47e1-afac-46091bf51437', razao_social: 'Neobetel Epi, Equipamentos de Protecao Individual LTDA' },
  { id: '5e4666af-7a8f-47b3-9d66-5fb96359b0cd', razao_social: 'NOVO NORDESTE COM DE MATERIAIS DE CONSTRUÇÃO LTDA', nome_fantasia: 'NOVO NORDESTE' },
  { id: 'e7c6cbd7-07d6-411a-8685-0b20688b2932', razao_social: 'PAULO HENRIQUE COSTA SILVA' },
  { id: 'e25e96b4-003e-4ad9-8e61-035c1f710fc5', razao_social: 'POSTO CASSINO LTDA' },
  { id: 'ced36224-c9eb-400b-8b18-307d050bda05', razao_social: 'R S CONSTRUTORA E LOCAÇÕES DE MÁQUINAS EIRELI' },
  { id: 'b4adcb65-1df4-4538-8532-94e0c0a1ee70', razao_social: 'REGINALDO PEREIRA DA SILVA' },
  { id: 'a9016275-ae8f-4d00-9af3-22d3e4d8185a', razao_social: 'RM REBOQUE' },
  { id: '4a54deb0-b4f2-4687-9b84-d492531e02d3', razao_social: 'S M CONSTRUÇÃO E LIMPEZA EIRELI' },
  { id: 'cef6779c-3de6-46d4-87e7-edb3f22968bc', razao_social: 'W. G. LEMOS BATISTA ( WM CONSTRUÇÕES E PAVIMENTAÇÃO ASFÁLTICA / MARIA BARROS GALLIZA GOMES )' },
];

// Normalize string for comparison
function norm(s) {
  return (s || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Read Excel
const wb = XLSX.readFile('ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
const ws = wb.Sheets['PÓS 25.07.2026'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header

// Get unique Excel suppliers
const excelSuppliers = [...new Set(rows.map(r => r[0]).filter(Boolean))];

// Match function
function findMatch(excelName) {
  const normExcel = norm(excelName);
  
  // Try exact match first
  for (const db of dbSuppliers) {
    if (norm(db.razao_social) === normExcel) return db;
    if (db.nome_fantasia && norm(db.nome_fantasia) === normExcel) return db;
  }
  
  // Try contains match (excel contains db or db contains excel)
  for (const db of dbSuppliers) {
    const normDb = norm(db.razao_social);
    if (normExcel.includes(normDb) || normDb.includes(normExcel)) return db;
    if (db.nome_fantasia) {
      const normNF = norm(db.nome_fantasia);
      if (normExcel.includes(normNF) || normNF.includes(normExcel)) return db;
    }
  }

  // Word overlap score
  const excelWords = normExcel.split(' ').filter(w => w.length > 3);
  let best = null, bestScore = 0;
  for (const db of dbSuppliers) {
    const dbWords = norm(db.razao_social).split(' ').filter(w => w.length > 3);
    const matches = excelWords.filter(w => dbWords.includes(w)).length;
    const score = matches / Math.max(excelWords.length, dbWords.length);
    if (score > bestScore && score >= 0.5) { bestScore = score; best = db; }
  }
  return best ? { ...best, score: bestScore } : null;
}

console.log('\n=== CRUZAMENTO EXCEL x BANCO ===\n');
const matched = [];
const unmatched = [];

for (const excelName of excelSuppliers) {
  const match = findMatch(excelName);
  if (match) {
    matched.push({ excelName, dbId: match.id, dbName: match.razao_social });
    console.log(`✅ "${excelName}"\n   → "${match.razao_social}" (${match.id})\n`);
  } else {
    unmatched.push(excelName);
    console.log(`❌ SEM MATCH: "${excelName}"\n`);
  }
}

console.log(`\nTotal: ${matched.length} encontrados, ${unmatched.length} sem match`);
if (unmatched.length > 0) {
  console.log('\nSem match:');
  unmatched.forEach(u => console.log('  -', u));
}
