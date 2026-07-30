const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
const workbook = xlsx.readFile(filePath);

const sheetName = 'PÓS 25.07.2026';
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

console.log('=== SUMMARY OF SHEET "PÓS 25.07.2026" ===');
console.log('Total rows:', data.length);

const centrosDeCusto = new Set();
const fornecedores = new Set();
const colunasComDados = new Set();
const sampleDates = [];

data.forEach((row, idx) => {
  Object.keys(row).forEach(k => {
    if (row[k] !== "" && row[k] !== null && row[k] !== undefined) {
      colunasComDados.add(k);
    }
  });

  if (row['CENTRO DE CUSTO']) centrosDeCusto.add(row['CENTRO DE CUSTO']);
  if (row['FORNECEDOR']) fornecedores.add(row['FORNECEDOR']);
  
  if (idx < 5) {
    const rawDate = row['VENCIMENTO_1'] || row['VENCIMENTO'] || row['SITUAÇÃO'];
    sampleDates.push({ idx, rawDate });
  }
});

console.log('\nColumns containing data:', Array.from(colunasComDados));
console.log('\nUnique Centros de Custo (Obras):');
Array.from(centrosDeCusto).forEach(c => console.log(' -', c));

console.log(`\nTotal unique Fornecedores in Excel: ${fornecedores.size}`);
console.log('Sample Fornecedores (first 10):');
Array.from(fornecedores).slice(0, 10).forEach(f => console.log(' -', f));

console.log('\nSample date values:', sampleDates);
