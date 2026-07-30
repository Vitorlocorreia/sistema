const xlsx = require('xlsx');
const path = require('path');

const obras = [
  {"id":"3cd4e878-b21d-4b59-881b-af32aca9a278","nome":"URB LOTE 10B"},
  {"id":"1b9e7411-f1ee-4de1-a72b-2bd0856188c0","nome":"URB BASÍICA"},
  {"id":"ec6a92d8-348f-4867-9365-57942cd1e7ec","nome":"SEPE RESERVATÓRIOS"},
  {"id":"bbd50a2b-dec0-4bb8-81ec-305f198a41c6","nome":"URB CAIS"},
  {"id":"6f6daefb-b9aa-4b41-9fd1-5728197d08d7","nome":"CEHAB IGARASSU"},
  {"id":"619a9026-d903-4d64-9db0-922b29d8e27b","nome":"CEHAB HR"},
  {"id":"63489f67-5c9c-45de-906b-6a96007af2ac","nome":"URB LOTE 07"},
  {"id":"4a05d794-ddc0-425b-b752-5f69489ed05d","nome":"URB LOTE 09"}
];

const fornecedores = [
  {"id":"ce105d93-234d-48ca-a8cd-fd97e8304a4a","razao_social":"FRANCISCO RISOMAR DA SILVA ME","nome_fantasia":"GUARARAPES CONSTRUÇÃO"},
  {"id":"e29d0007-df70-4601-a316-8d4da5a12eee","razao_social":"GILMAR PIERRI FERREIRA WANDERLEY","nome_fantasia":"Gilmar Refeição"},
  {"id":"5e4666af-7a8f-47b3-9d66-5fb96359b0cd","razao_social":"NOVO NORDESTE COM DE MATERIAIS DE CONSTRUÇÃO LTDA","nome_fantasia":"NOVO NORDESTE"},
  {"id":"0a43bd56-778d-4d80-99bb-2707fd5ea341","razao_social":"ITALO JOSE CAMILO PESSOA XAVIER 10785110470","nome_fantasia":"SHALOM REFRIGERAÇÃO E ELÉTRICA"},
  {"id":"dc37884a-5e94-4520-acbb-85bc07c25731","razao_social":"VM EMPRRENDIMENTOS & SOLUÇÕES","nome_fantasia":"VM EMPREENDIMENTOS"},
  {"id":"9ddf6bec-2363-45d3-9841-da03035587b0","razao_social":"JOSÉ BARBOSA NETO","nome_fantasia":"JOSÉ BARBOSA"},
  {"id":"e25e96b4-003e-4ad9-8e61-035c1f710fc5","razao_social":"POSTO CASSINO LTDA","nome_fantasia":"POSTO CASSINO LTDA"},
  {"id":"88eb2528-85fa-4490-8504-870a7cde5977","razao_social":"P M COSTA NETO CONSTRUÇÕES E INCORPORADORA LTDA","nome_fantasia":"P M COSTA NETO CONSTRUÇÕES E INCORPORADORA LTDA"},
  {"id":"a84d195b-8656-4a44-93b5-0f02a1399f7e","razao_social":"ITALO JOSE CAMILO PESSOA XAVIER 10785110470","nome_fantasia":"ITALO JOSE CAMILO"},
  {"id":"806793a3-f3bc-47e1-afac-46091bf51437","razao_social":"Neobetel Epi, Equipamentos de Protecao Individual LTDA","nome_fantasia":"Neobetel Epi, Equipamentos de Protecao Individual LTDA"},
  {"id":"e20ad9ee-2278-4914-befd-9c08a563c142","razao_social":"GERDAU AÇOS LONGOS S/A","nome_fantasia":"GERDAU"},
  {"id":"ca8c3658-af53-4030-bae1-1391f521c646","razao_social":"A.M. COMERCIAL E DISTRIBUIDORA LTDA","nome_fantasia":"AM COMERCIAL"},
  {"id":"f66d6d51-98fa-4022-a211-a449817cfc8c","razao_social":"CONCRETECH SERVICOS DE CONCRETAGEM LTDA","nome_fantasia":"CONCRETECH"},
  {"id":"76feec0d-65a7-4e23-b45b-f47daced4b4f","razao_social":"ANA PAULA BATISTA DE ALMEIDA","nome_fantasia":"PREMOFORTE"},
  {"id":"5e362c16-977a-42e0-90c2-4e4bf3c91bc9","razao_social":"JASON DOS SANTOS SILVA ME ( J S ALUGUEL DE EQUIP )","nome_fantasia":""},
  {"id":"01e87325-4a91-4867-92b8-e71446db28ea","razao_social":"E&F CONSTRUÇÕES DE EDIFÍCIOS LTDA","nome_fantasia":""},
  {"id":"8aab7052-5aa9-4803-9c6e-cb7a5e602966","razao_social":"GDM LOCAÇÃO DE MÁQUINA E EQUIP","nome_fantasia":""}
];

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
  const utc_days = Math.floor(num - 25569);
  const date_info = new Date(utc_days * 86400 * 1000);
  return date_info.toISOString().slice(0, 10);
}

function normalize(s) {
  return String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function matchObra(centroCusto) {
  if (!centroCusto) return null;
  const cc = normalize(centroCusto);
  if (cc.includes('adm')) return null; // Despesa administrativa geral
  return obras.find(o => {
    const no = normalize(o.nome);
    if (cc.includes('lote 10b') && no.includes('lote 10b')) return true;
    if (cc.includes('lote 7') && no.includes('lote 07')) return true;
    if (cc.includes('lote 9') && no.includes('lote 09')) return true;
    if (cc.includes('hr') && no.includes('hr')) return true;
    if (cc.includes('igarassu') && no.includes('igarassu')) return true;
    if (cc.includes('reservatorio') && no.includes('reservatorio')) return true;
    if (cc.includes('cais') && no.includes('cais')) return true;
    if ((cc.includes('basilica') || cc.includes('carmo')) && (no.includes('basi') || no.includes('carmo'))) return true;
    return cc.includes(no) || no.includes(cc);
  });
}

function matchFornecedor(fornNome) {
  if (!fornNome) return null;
  const fn = normalize(fornNome);
  return fornecedores.find(f => {
    const r = normalize(f.razao_social);
    const n = normalize(f.nome_fantasia);
    if (r && (r === fn || fn.includes(r) || r.includes(fn))) return true;
    if (n && (n === fn || fn.includes(n) || n.includes(fn))) return true;
    return false;
  });
}

const filePath = path.join(__dirname, 'ATÉ 24.07.2026 E PÓS 25.07.2026 - importar sistema.xlsx');
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['PÓS 25.07.2026'];
const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

let matchedObraCount = 0;
let matchedFornCount = 0;

const processed = data.map((row, idx) => {
  const forn = String(row['FORNECEDOR'] || '').trim();
  const nf = String(row['NF Nº'] || '').trim();
  const cc = String(row['CENTRO DE CUSTO'] || '').trim();
  const val = Number(row[' VALOR '] || row['VALOR'] || 0);
  const rawVenc = row['VENCIMENTO_1'] || row['VENCIMENTO'] || row['SITUAÇÃO'];
  const vencIso = excelDateToISO(rawVenc);
  const formaPgto = String(row['FORMA DE PAGAMENTO'] || '').trim();

  const o = matchObra(cc);
  if (o) matchedObraCount++;

  const f = matchFornecedor(forn);
  if (f) matchedFornCount++;

  let desc = forn || 'Lançamento a Pagar';
  if (nf && nf !== '-' && nf !== 'NF À EMITIR') {
    desc = `${desc} - NF ${nf}`;
  } else if (nf === 'NF À EMITIR') {
    desc = `${desc} (NF à emitir)`;
  }

  return {
    linhaExcel: idx + 2,
    fornecedorOriginal: forn,
    fornecedorIdSistema: f?.id || null,
    fornecedorNomeSistema: f?.razao_social || f?.nome_fantasia || null,
    centroCustoOriginal: cc,
    obraIdSistema: o?.id || null,
    obraNomeSistema: o?.nome || null,
    descricaoSistema: desc,
    valorSistema: val,
    vencimentoSistema: vencIso,
    statusSistema: 'Lançado',
    observacoesSistema: formaPgto ? `Forma de Pagamento: ${formaPgto}` : ''
  };
});

console.log('=== MAPPING METRICS ===');
console.log(`Total rows in "PÓS 25.07.2026": ${processed.length}`);
console.log(`Obras matched: ${matchedObraCount} / ${processed.length} (${(matchedObraCount/processed.length*100).toFixed(1)}%)`);
console.log(`Fornecedores matched with DB: ${matchedFornCount} / ${processed.length}`);

console.log('\n=== FIRST 5 PROCESSED ROWS FOR SYSTEM DISPLAY ===');
console.log(JSON.stringify(processed.slice(0, 5), null, 2));
