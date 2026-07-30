const XLSX = require('xlsx');
const fs = require('fs');

// Read DB Output
const fileContent = fs.readFileSync('C:/Users/Adels/.gemini/antigravity/brain/1d3c95ce-bcc7-461f-82f7-13d0abd451d8/.system_generated/steps/510/output.txt', 'utf8');
const dataObj = JSON.parse(fileContent);
const dbRecords = JSON.parse(dataObj.result.match(/\[[\s\S]*\]/)[0]);

console.log('Total de registros no banco (24/07):', dbRecords.length);

// Read Excel
const wb = XLSX.readFile('dia 24.07 importar sistema.xlsx');
const ws = wb.Sheets['Planilha1'];
const excelRows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

console.log('Total de linhas na planilha (24/07):', excelRows.length);

// Let's match each Excel row against DB records
const missingRows = [];
const matchedRows = [];

excelRows.forEach((row, idx) => {
  const lineNo = idx + 2; // Excel line number (1-based header)
  const fornecedor = (row[0] || '').toString().trim();
  const nf = (row[1] || '').toString().trim();
  const val = parseFloat(row[4]) || 0;

  // Try to find matching DB record
  const match = dbRecords.find(db => {
    const desc = (db.descricao || '').toUpperCase();
    const obs = (db.observacoes || '').toUpperCase();
    const fornUpper = fornecedor.toUpperCase();
    const nfUpper = nf.toUpperCase();

    // Check if description or obs contains fornecedor name or NF
    const fornMatch = desc.includes(fornUpper) || obs.includes(fornUpper);
    const valMatch = Math.abs(parseFloat(db.valor) - val) < 0.01;

    return fornMatch && (valMatch || val === 0);
  });

  if (match) {
    matchedRows.push({ lineNo, fornecedor, nf, val });
  } else {
    missingRows.push({ lineNo, fornecedor, nf, val, natureza: row[2], pagamento: row[3] });
  }
});

console.log(`\nMatched: ${matchedRows.length} | Faltando: ${missingRows.length}`);

console.log('\n=== LINHAS FALTANDO NO BANCO ===');
missingRows.forEach(m => {
  console.log(`Linha ${m.lineNo}: [${m.fornecedor}] NF: ${m.nf} | Valor: R$ ${m.val} | Natureza: ${m.natureza}`);
});
