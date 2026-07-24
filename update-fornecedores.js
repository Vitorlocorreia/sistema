const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const empresa_id = 'eaeedfef-3488-4d74-938f-11a21a5e570a';
    
    // 1. Fetch all contas without fornecedor for this empresa
    console.log('Fetching contas...');
    const { data: contas, error: errContas } = await supabase
        .from('contas')
        .select('id, descricao')
        .eq('empresa_id', empresa_id)
        .eq('possui_fornecedor', false);

    if (errContas) {
        console.error('Error fetching contas:', errContas);
        return;
    }

    console.log(`Found ${contas.length} contas without fornecedor.`);

    // 2. Fetch all existing fornecedores
    console.log('Fetching fornecedores...');
    const { data: fornecedores, error: errForn } = await supabase
        .from('fornecedores')
        .select('id, razao_social')
        .eq('empresa_id', empresa_id);

    if (errForn) {
        console.error('Error fetching fornecedores:', errForn);
        return;
    }

    const fornecedorMap = {};
    fornecedores.forEach(f => {
        fornecedorMap[f.razao_social.toUpperCase()] = f.id;
    });

    // 3. Extract suppliers from contas descriptions
    // As we know the description is formatted as "FORNECEDOR NAME - NF ..." or just "FORNECEDOR NAME"
    const uniqueSupplierNames = new Set();
    const contaToSupplierMap = {};

    for (const conta of contas) {
        let name = conta.descricao;
        if (name.includes(' - NF ')) {
            name = name.split(' - NF ')[0];
        }
        name = name.trim();
        if (name && name !== 'Importação') {
            uniqueSupplierNames.add(name);
            contaToSupplierMap[conta.id] = name;
        }
    }

    console.log(`Found ${uniqueSupplierNames.size} unique supplier names from descriptions.`);

    // 4. Create missing suppliers
    for (const name of uniqueSupplierNames) {
        const upperName = name.toUpperCase();
        if (!fornecedorMap[upperName]) {
            console.log(`Creating missing fornecedor: ${name}`);
            const { data: newForn, error: insErr } = await supabase.from('fornecedores').insert({
                empresa_id,
                razao_social: name,
                tipo: 'PJ'
            }).select('id').single();

            if (insErr) {
                console.error(`Error inserting ${name}`, insErr);
            } else {
                fornecedorMap[upperName] = newForn.id;
            }
        }
    }

    // 5. Update contas with the corresponding fornecedor_id
    console.log('Updating contas...');
    let updatedCount = 0;
    const updatePromises = [];

    for (const conta of contas) {
        const supplierName = contaToSupplierMap[conta.id];
        if (supplierName) {
            const supplierId = fornecedorMap[supplierName.toUpperCase()];
            if (supplierId) {
                updatePromises.push(
                    supabase.from('contas')
                        .update({
                            possui_fornecedor: true,
                            fornecedor_id: supplierId
                        })
                        .eq('id', conta.id)
                );
                updatedCount++;
            }
        }
    }

    // Await all updates in chunks of 50 to avoid rate limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < updatePromises.length; i += CHUNK_SIZE) {
        await Promise.all(updatePromises.slice(i, i + CHUNK_SIZE));
        console.log(`Updated ${Math.min(i + CHUNK_SIZE, updatePromises.length)} / ${updatePromises.length} contas`);
    }

    console.log(`Finished updating ${updatedCount} contas with their respective fornecedores!`);
}

main();
