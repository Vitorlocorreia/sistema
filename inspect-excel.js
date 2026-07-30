const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
console.log('Reading file:', filePath);

const workbook = xlsx.readFile(filePath);
console.log('Sheet names:', workbook.SheetNames);

workbook.SheetNames.forEach(name => {
  console.log(`\n--- SHEET: ${name} ---`);
  const sheet = workbook.Sheets[name];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`Total rows: ${data.length}`);
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample row 0:', JSON.stringify(data[0], null, 2));
    if (data.length > 1) {
      console.log('Sample row 1:', JSON.stringify(data[1], null, 2));
    }
  }
});
