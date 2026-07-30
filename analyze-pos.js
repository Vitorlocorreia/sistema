const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
const workbook = xlsx.readFile(filePath);

const sheetName = 'PÓS 25.07.2026';
const sheet = workbook.Sheets[sheetName];

// Get raw header row
const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
console.log('--- ALL HEADERS (ROW 0) ---');
rawRows[0].forEach((col, idx) => {
  if (col !== "") console.log(`Col [${idx}]: "${col}"`);
});

// JSON object format
const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
console.log('\nTotal rows:', data.length);
console.log('\n--- FIRST 5 ROWS ---');
data.slice(0, 5).forEach((row, i) => {
  console.log(`\n--- ROW ${i} ---`);
  Object.keys(row).forEach(k => {
    if (row[k] !== "" && !k.startsWith('__EMPTY')) {
      console.log(`  ${k}: ${JSON.stringify(row[k])}`);
    }
  });
});
