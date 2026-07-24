const xlsx = require('xlsx');
const fs = require('fs');

function parseDateStr(str) {
    if (typeof str === 'number') {
        return '2023-01-01';
    }
    if (!str) return '2022-01-01';
    
    const match = String(str).match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (match) {
        const d = match[1];
        const m = match[2];
        const y = match[3];
        return `20${y}-${m}-${d}`;
    }
    return '2023-01-01';
}

function escapeSqlString(str) {
    if (!str) return "''";
    return "'" + String(str).replace(/'/g, "''") + "'";
}

async function main() {
    const empresa_id = 'eaeedfef-3488-4d74-938f-11a21a5e570a';
    const workbook = xlsx.readFile('dia 24.07 importar sistema.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const CHUNK_SIZE = 50;
    
    let chunkIndex = 0;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        
        let sql = `INSERT INTO contas (empresa_id, tipo, descricao, valor, categoria, data_vencimento, status, observacoes, possui_fornecedor, pagamento_antecipado, recorrencia) VALUES\n`;

        const values = chunk.map((row) => {
            let descricao = row['FORNECEDOR'] || 'Importação';
            if (row['NF Nº'] && row['NF Nº'] !== '-') {
                descricao = `${descricao} - NF ${row['NF Nº']}`;
            }

            const obsParts = [];
            if (row['PAGAMENTO']) obsParts.push(row['PAGAMENTO']);
            if (row['__EMPTY_1']) obsParts.push(row['__EMPTY_1']);
            if (row['__EMPTY_2']) obsParts.push(row['__EMPTY_2']);
            
            const valor = Number(row[' VALOR ']) || 0;
            const categoria = escapeSqlString(String(row['NATUREZA'] || 'Desconhecida'));
            const dt_venc = escapeSqlString(parseDateStr(row['SITUAÇÃO']));
            const status = escapeSqlString('Pago');
            const observacoes = escapeSqlString(obsParts.join(' | '));
            const desc = escapeSqlString(descricao.substring(0, 200));

            return `('${empresa_id}', 'pagar', ${desc}, ${valor}, ${categoria}, ${dt_venc}, ${status}, ${observacoes}, false, false, 'unico')`;
        });

        sql += values.join(',\n') + ';';
        fs.writeFileSync(`insert_${chunkIndex}.sql`, sql);
        chunkIndex++;
    }
    console.log("Created", chunkIndex, "chunk files.");
}

main();
