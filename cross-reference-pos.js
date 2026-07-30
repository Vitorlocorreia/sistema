const xlsx = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xqackyuxipcxvmliecow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function excelDateToISO(excelSerial) {
  if (!excelSerial) return null;
  if (typeof excelSerial === 'string' && excelSerial.includes('/')) {
    const parts = excelSerial.split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const num = Number(excelSerial);
  if (isNaN(num) || num <= 0) return null;
  // Excel epoch is 1899-12-30 due to 1900 leap year bug
  const utc_days = Math.floor(num - 25569);
  const date_info = new Date(utc_days * 86400 * 1000);
  return date_info.toISOString().slice(0, 10);
}

async function main() {
  const filePath = path.join(__dirname, 'ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['PÓS 25.07.2026'];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`Analyzing ${data.length} rows from "PÓS 25.07.2026"...`);

  // Fetch DB references
  const { data: dbObras } = await supabase.from('obras').select('id, nome');
  const { data: dbFornecedores } = await supabase.from('fornecedores').select('id, razao_social, nome_fantasia, cnpj, pix');
  const { data: dbEmpresas } = await supabase.from('empresas').select('id, razao_social, nome_fantasia');

  console.log(`\nLoaded DB References:`);
  console.log(` - Obras: ${dbObras?.length || 0}`);
  console.log(` - Fornecedores: ${dbFornecedores?.length || 0}`);
  console.log(` - Empresas: ${dbEmpresas?.length || 0}`);

  // Mapping statistics
  let obrasMatched = 0;
  let fornecedoresMatched = 0;
  const unmappedObras = new Set();
  const unmappedFornecedores = new Set();

  const mappedContas = data.map((row, idx) => {
    const fornecedorNome = String(row['FORNECEDOR'] || '').trim();
    const nf = String(row['NF Nº'] || '').trim();
    const centroCusto = String(row['CENTRO DE CUSTO'] || '').trim();
    const formaPgto = String(row['FORMA DE PAGAMENTO'] || '').trim();
    const valor = Number(row[' VALOR '] || row['VALOR'] || 0);
    const rawVenc = row['VENCIMENTO_1'] || row['VENCIMENTO'] || row['SITUAÇÃO'];
    const dataVencimento = excelDateToISO(rawVenc);

    // Match Obra
    let obraId = null;
    let obraNomeMatched = null;
    if (centroCusto) {
      const ccNorm = centroCusto.toLowerCase();
      const matchedObra = (dbObras || []).find(o => {
        const oNorm = o.nome.toLowerCase();
        return oNorm.includes(ccNorm) || ccNorm.includes(oNorm) ||
               (ccNorm.includes('lote 10b') && oNorm.includes('lote 10b')) ||
               (ccNorm.includes('lote 7') && oNorm.includes('lote 07')) ||
               (ccNorm.includes('hr') && oNorm.includes('hr')) ||
               (ccNorm.includes('igarassu') && oNorm.includes('igarassu')) ||
               (ccNorm.includes('reservatório') && oNorm.includes('reservatório')) ||
               (ccNorm.includes('cais') && oNorm.includes('cais')) ||
               (ccNorm.includes('basílica') && oNorm.includes('basílica'));
      });
      if (matchedObra) {
        obraId = matchedObra.id;
        obraNomeMatched = matchedObra.nome;
        obrasMatched++;
      } else {
        unmappedObras.add(centroCusto);
      }
    }

    // Match Fornecedor
    let fornecedorId = null;
    let fornecedorNomeMatched = null;
    if (fornecedorNome) {
      const fNorm = fornecedorNome.toLowerCase();
      const matchedForn = (dbFornecedores || []).find(f => {
        const rNorm = (f.razao_social || '').toLowerCase();
        const nNorm = (f.nome_fantasia || '').toLowerCase();
        return rNorm === fNorm || nNorm === fNorm || rNorm.includes(fNorm) || fNorm.includes(rNorm);
      });
      if (matchedForn) {
        fornecedorId = matchedForn.id;
        fornecedorNomeMatched = matchedForn.razao_social || matchedForn.nome_fantasia;
        fornecedoresMatched++;
      } else {
        unmappedFornecedores.add(fornecedorNome);
      }
    }

    // Description composition
    let descricao = fornecedorNome || 'Lançamento a Pagar';
    if (nf && nf !== '-' && nf !== 'NF À EMITIR') {
      descricao = `${descricao} - NF ${nf}`;
    } else if (nf === 'NF À EMITIR') {
      descricao = `${descricao} (NF à emitir)`;
    }

    // Observations
    const obs = [];
    if (formaPgto) obs.push(`Forma de Pagamento: ${formaPgto}`);
    if (centroCusto && !obraId) obs.push(`Centro de Custo Excel: ${centroCusto}`);

    return {
      excelRowIndex: idx + 2, // 1-indexed header + 1
      excel: {
        fornecedor: fornecedorNome,
        nf,
        centroCusto,
        formaPgto,
        valor,
        vencimento: rawVenc,
      },
      mapped: {
        tipo: 'pagar',
        descricao,
        valor,
        data_vencimento: dataVencimento,
        data_previsao: dataVencimento,
        status: 'Lançado',
        obra_id: obraId,
        obra_nome: obraNomeMatched,
        fornecedor_id: fornecedorId,
        fornecedor_nome: fornecedorNomeMatched,
        observacoes: obs.join(' | '),
      }
    };
  });

  console.log('\n=== MAPPING SUMMARY ===');
  console.log(`Total rows mapped: ${mappedContas.length}`);
  console.log(`Obras matched: ${obrasMatched} / ${mappedContas.length}`);
  console.log(`Fornecedores matched: ${fornecedoresMatched} / ${mappedContas.length}`);

  console.log('\nUnmapped Centros de Custo (Obras):', Array.from(unmappedObras));
  console.log(`Unmapped Fornecedores count: ${unmappedFornecedores.size}`);
  console.log('Sample Unmapped Fornecedores:', Array.from(unmappedFornecedores).slice(0, 10));

  console.log('\n=== SAMPLE MAPPED ROW 0 ===');
  console.log(JSON.stringify(mappedContas[0], null, 2));

  console.log('\n=== SAMPLE MAPPED ROW 1 ===');
  console.log(JSON.stringify(mappedContas[1], null, 2));
}

main();
