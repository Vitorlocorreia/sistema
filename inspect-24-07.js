const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel
const wb = XLSX.readFile('dia 24.07 importar sistema.xlsx');
const ws = wb.Sheets['Planilha1'];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
const headers = rawData[0];
const rows = rawData.slice(1);

console.log('Headers:', headers);
console.log('Total rows:', rows.length);

// Print summary of columns
rows.forEach((r, idx) => {
  const fornecedor = r[0];
  const nf = r[1];
  const natureza = r[2];
  const pagamento = r[3];
  const valor = r[4];
  const situacao = r[5];
  
  if (fornecedor && fornecedor.toString().includes('GRF')) {
    console.log(`Linha ${idx + 2}: [${fornecedor}] NF: ${nf} | Valor: ${valor} | Natureza: ${natureza}`);
  }
});
