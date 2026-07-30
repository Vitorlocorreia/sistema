const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
const workbook = xlsx.readFile(filePath);

console.log('=== WORKBOOK SHEETS ===');
console.log(workbook.SheetNames);

workbook.SheetNames.forEach((name, idx) => {
  console.log(`\n========================================`);
  console.log(`SHEET [${idx}]: "${name}"`);
  const sheet = workbook.Sheets[name];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log(`Total raw rows: ${rawRows.length}`);
  
  if (rawRows.length > 0) {
    console.log('Row 0 (Header?):', rawRows[0].filter(x => x !== "").slice(0, 15));
    if (rawRows.length > 1) {
      console.log('Row 1:', rawRows[1].filter(x => x !== "").slice(0, 15));
    }
    if (rawRows.length > 2) {
      console.log('Row 2:', rawRows[2].filter(x => x !== "").slice(0, 15));
    }
  }
});
