const fs = require('fs');
const path = require('path');

// We can read import_pos_25_07.sql and split the VALUES into chunks of 30 items
const sqlText = fs.readFileSync(path.join(__dirname, 'import_pos_25_07.sql'), 'utf-8');

// Extract the header and value blocks
const match = sqlText.match(/INSERT INTO public\.contas \([s\S]*?\) VALUES\s*([\s\S]*);/);
if (!match) {
  console.error("Could not parse SQL file");
  process.exit(1);
}

const header = `INSERT INTO public.contas (
  empresa_id,
  obra_id,
  fornecedor_id,
  tipo,
  descricao,
  valor,
  data_vencimento,
  data_previsao,
  status,
  observacoes,
  possui_fornecedor,
  pagamento_antecipado,
  recorrencia,
  criado_por
) VALUES\n`;

// Split by value tuples: (\n ( ... )\n)
const rawValuesStr = match[1].trim();
// Split values by "),\n(" or "),\r\n("
const tuples = rawValuesStr.split(/\),\s*\(/g).map((t, idx, arr) => {
  let clean = t.trim();
  if (!clean.startsWith('(')) clean = '(' + clean;
  if (!clean.endsWith(')')) clean = clean + ')';
  return clean;
});

// Skip item 0 which we inserted in the test call above
const remainingTuples = tuples.slice(1);
console.log(`Total remaining tuples to insert: ${remainingTuples.length}`);

const CHUNK_SIZE = 35;
const chunks = [];
for (let i = 0; i < remainingTuples.length; i += CHUNK_SIZE) {
  const chunk = remainingTuples.slice(i, i + CHUNK_SIZE);
  const sql = header + chunk.join(',\n') + ';';
  chunks.push(sql);
}

console.log(`Generated ${chunks.length} SQL chunks.`);

chunks.forEach((chunkSql, idx) => {
  fs.writeFileSync(path.join(__dirname, `import_chunk_${idx}.sql`), chunkSql);
});

console.log("Chunk SQL files created!");
