const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xqackyuxipcxvmliecow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseDateStr(str) {
    if (typeof str === 'number') {
        // Fallback for weird values
        return '2023-01-01';
    }
    if (!str) return '2022-01-01';
    
    // usually "DE DD/MM/YY" or "DD/MM/YY"
    const match = String(str).match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (match) {
        const d = match[1];
        const m = match[2];
        const y = match[3];
        return `20${y}-${m}-${d}`;
    }
    return '2023-01-01';
}

async function main() {
    const { data: empresas } = await supabase.from('empresas').select('id').limit(1);
    if (!empresas || empresas.length === 0) {
        console.error("Nenhuma empresa encontrada no banco!");
        return;
    }
    const empresa_id = empresas[0].id;
    console.log("Usando empresa_id:", empresa_id);

    const workbook = xlsx.readFile('dia 24.07 importar sistema.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const contasToInsert = data.map((row) => {
        let descricao = row['FORNECEDOR'] || 'Importação';
        if (row['NF Nº'] && row['NF Nº'] !== '-') {
            descricao = `${descricao} - NF ${row['NF Nº']}`;
        }

        const obsParts = [];
        if (row['PAGAMENTO']) obsParts.push(row['PAGAMENTO']);
        if (row['__EMPTY_1']) obsParts.push(row['__EMPTY_1']);
        if (row['__EMPTY_2']) obsParts.push(row['__EMPTY_2']);
        
        return {
            empresa_id: empresa_id,
            tipo: 'pagar',
            descricao: descricao.substring(0, 200), // limit length just in case
            valor: Number(row[' VALOR ']) || 0,
            categoria: String(row['NATUREZA'] || 'Desconhecida'),
            data_vencimento: parseDateStr(row['SITUAÇÃO']),
            status: 'Pago',
            observacoes: obsParts.join(' | '),
            possui_fornecedor: false,
            pagamento_antecipado: false,
            recorrencia: 'unico'
        };
    });

    console.log("Total to insert:", contasToInsert.length);
    console.log("Sample first 2:");
    console.log(JSON.stringify(contasToInsert.slice(0, 2), null, 2));

    // await supabase.from('contas').insert(contasToInsert);
    // console.log("Done!");
}

main();
