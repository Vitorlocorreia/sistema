const xlsx = require('xlsx');

function main() {
    const workbook = xlsx.readFile('dia 24.07 importar sistema.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    console.log("Rows with number in SITUAÇÃO:");
    data.filter(row => typeof row['SITUAÇÃO'] === 'number').slice(0, 5).forEach(row => {
        console.log(row);
    });
}

main();
