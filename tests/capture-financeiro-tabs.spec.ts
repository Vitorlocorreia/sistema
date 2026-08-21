import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const adminUser = {
  id: 'admin-master-id',
  nome: 'Vitor Correia',
  email: 'vitor@empresa.com',
  cargo: 'admin_geral',
  apps: 'financeiro,rh,suprimentos,obras,rdo,frota,ponto',
  empresa_id: null,
  empresas_ids: [],
  obras_ids: ['obra-1', 'obra-2', 'obra-3']
};

const mockEmpresas = [
  { id: 'emp-1', razao_social: 'Construtora & Incorporadora Matriz Ltda', nome_fantasia: 'Matriz Engenharia', cnpj: '12.345.678/0001-90', cor: '#F59E0B', created_at: '2025-01-01T00:00:00Z' },
  { id: 'emp-2', razao_social: 'SPE Residencial Horizon Empreendimentos', nome_fantasia: 'SPE Horizon', cnpj: '98.765.432/0001-11', cor: '#3B82F6', created_at: '2025-06-01T00:00:00Z' },
  { id: 'emp-3', razao_social: 'SPE Prime Plaza Incorporação Imobiliária', nome_fantasia: 'SPE Prime Plaza', cnpj: '55.666.777/0001-22', cor: '#10B981', created_at: '2025-09-01T00:00:00Z' }
];

const mockFornecedores = [
  { id: 'f-1', razao_social: 'Polimix Concreto Ltda', nome_fantasia: 'Polimix Concreto', cnpj: '12.345.678/0001-90', categoria: 'Concreto & Usinagem', contato_nome: 'Marcelo Vendas', telefone: '(11) 98888-7777', email: 'vendas@polimix.com.br', banco: 'Banco Itaú', agencia: '0455', conta: '12345-6', pix: '12.345.678/0001-90', empresa_id: null },
  { id: 'f-2', razao_social: 'Gerdau Comercial de Aços S.A.', nome_fantasia: 'Gerdau Aços', cnpj: '33.444.555/0001-12', categoria: 'Aço & Ferragens', contato_nome: 'Juliana Castro', telefone: '(11) 97777-6666', email: 'corporativo@gerdau.com.br', banco: 'Banco Bradesco', agencia: '1200', conta: '98765-4', pix: 'corporativo@gerdau.com.br', empresa_id: null },
  { id: 'f-3', razao_social: 'Locar Guindastes e Equipamentos S.A.', nome_fantasia: 'Locar Equipamentos', cnpj: '44.555.666/0001-88', categoria: 'Locação de Maquinário', contato_nome: 'Carlos Locação', telefone: '(11) 96666-5555', email: 'contato@locar.com.br', banco: 'Banco Santander', agencia: '3320', conta: '45678-9', pix: 'financeiro@locar.com.br', empresa_id: null },
  { id: 'f-4', razao_social: 'Tigre Tubos e Conexões S.A.', nome_fantasia: 'Tigre Hidráulica', cnpj: '77.888.999/0001-33', categoria: 'Material Hidráulico', contato_nome: 'Amanda Rios', telefone: '(11) 95555-4444', email: 'pedidos@tigre.com.br', banco: 'Banco do Brasil', agencia: '0019', conta: '11223-4', pix: '77.888.999/0001-33', empresa_id: null }
];

const mockContas = [
  {
    id: 'c-1',
    codigo_sequencial: 1042,
    tipo: 'pagar',
    descricao: 'Concretagem Laje 6º Pavimento - Bloco A',
    valor: 68400,
    status: 'Pago',
    data_vencimento: '2026-08-10',
    data_previsao: '2026-08-10',
    categoria: 'Material de Construção',
    empresa_id: 'emp-2',
    fornecedor_id: 'f-1',
    obra_id: 'obra-1',
    empresa: mockEmpresas[1],
    fornecedor: mockFornecedores[0],
    obra: { nome: 'Residencial Horizon Tower' },
    observacoes: 'Faturamento conforme Nota Fiscal 4589.',
    created_at: '2026-08-01T10:00:00Z'
  },
  {
    id: 'c-2',
    codigo_sequencial: 1043,
    tipo: 'pagar',
    descricao: 'Aço CA-50 16mm Cortado e Dobrado (18 Toneladas)',
    valor: 112000,
    status: 'Liberado/OK',
    data_vencimento: '2026-08-25',
    data_previsao: '2026-08-25',
    categoria: 'Material de Construção',
    empresa_id: 'emp-2',
    fornecedor_id: 'f-2',
    obra_id: 'obra-1',
    empresa: mockEmpresas[1],
    fornecedor: mockFornecedores[1],
    obra: { nome: 'Residencial Horizon Tower' },
    observacoes: 'Entrega programada no canteiro em 2 lotes.',
    created_at: '2026-08-05T14:30:00Z'
  },
  {
    id: 'c-3',
    codigo_sequencial: 1044,
    tipo: 'pagar',
    descricao: 'Locação Mensal de Grua Ascensional 45m',
    valor: 24500,
    status: 'Aguardando aprovação',
    data_vencimento: '2026-08-30',
    data_previsao: '2026-08-30',
    categoria: 'Equipamento',
    empresa_id: 'emp-3',
    fornecedor_id: 'f-3',
    obra_id: 'obra-2',
    empresa: mockEmpresas[2],
    fornecedor: mockFornecedores[2],
    obra: { nome: 'Centro Comercial Prime Plaza' },
    observacoes: 'Aguardando medição de horas do operador.',
    created_at: '2026-08-10T09:15:00Z'
  },
  {
    id: 'c-4',
    codigo_sequencial: 2018,
    tipo: 'receber',
    descricao: 'Medição Contratual Nº 06 - Estrutura Concluída',
    valor: 485000,
    status: 'Pago',
    data_vencimento: '2026-08-15',
    data_previsao: '2026-08-15',
    categoria: 'Medição Recebida',
    empresa_id: 'emp-2',
    obra_id: 'obra-1',
    empresa: mockEmpresas[1],
    obra: { nome: 'Residencial Horizon Tower' },
    fornecedor: { razao_social: 'Incorporadora Alphaville', nome_fantasia: 'Alphaville' },
    observacoes: 'Boletim de medição homologado pelo cliente.',
    created_at: '2026-08-02T11:00:00Z'
  },
  {
    id: 'c-5',
    codigo_sequencial: 2019,
    tipo: 'receber',
    descricao: 'Aporte de Capital - SPE Prime Plaza (Parcela 08/24)',
    valor: 320000,
    status: 'Liberado/OK',
    data_vencimento: '2026-08-28',
    data_previsao: '2026-08-28',
    categoria: 'Medição Recebida',
    empresa_id: 'emp-3',
    obra_id: 'obra-2',
    empresa: mockEmpresas[2],
    obra: { nome: 'Centro Comercial Prime Plaza' },
    fornecedor: { razao_social: 'Vinci Real Estate FII', nome_fantasia: 'Vinci Real Estate' },
    observacoes: 'Repasse programado via TED.',
    created_at: '2026-08-12T16:20:00Z'
  }
];

const mockColaboradores = [
  { id: 'admin-master-id', nome: 'Vitor Correia', email: 'vitor@empresa.com', cargo: 'admin_geral', apps: 'financeiro,rh,suprimentos,obras,rdo,frota,ponto', empresa_id: null },
  { id: 'colab-2', nome: 'Eng. Roberto Mendonça', email: 'roberto.eng@construtora.com.br', cargo: 'engenheiro', apps: 'financeiro,obras,rdo,suprimentos', empresa_id: 'emp-2', obras_ids: ['obra-1'] },
  { id: 'colab-3', nome: 'Mariana Silva (Financeiro)', email: 'mariana.fin@construtora.com.br', cargo: 'operador', apps: 'financeiro', empresa_id: 'emp-1' },
  { id: 'colab-4', nome: 'Beatriz Costa (Gestão RH)', email: 'beatriz.rh@construtora.com.br', cargo: 'rh', apps: 'rh', empresa_id: 'emp-1' }
];

test.describe('Captura Detalhada de Todas as Abas do Módulo Financeiro', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);

    const outputDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Intercepta todas as rotas REST do Supabase com verificação exata de tabela no path
    await page.route('**/*supabase.co/rest/v1/*', async route => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');

      if (pathname.endsWith('/contas')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockContas) });
      }

      if (pathname.endsWith('/empresas')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEmpresas) });
      }

      if (pathname.endsWith('/fornecedores')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockFornecedores) });
      }

      if (pathname.endsWith('/colaboradores')) {
        if (isSingle) {
          const match = url.search.match(/id=eq\.([^&]+)/);
          const found = match ? mockColaboradores.find(c => c.id === match[1]) : adminUser;
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(found || adminUser) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockColaboradores) });
      }

      if (pathname.endsWith('/config_permissoes')) {
        const perms = [
          { cargo: 'admin_geral', apps: 'financeiro,rh,suprimentos,obras,rdo,frota,ponto' },
          { cargo: 'engenheiro', apps: 'financeiro,obras,rdo,suprimentos' },
          { cargo: 'operador', apps: 'financeiro' },
          { cargo: 'rh', apps: 'rh' }
        ];
        if (isSingle) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(perms[0]) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(perms) });
      }

      if (pathname.endsWith('/obras')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'obra-1', nome: 'Residencial Horizon Tower', cliente: 'Incorporadora Alphaville', valor_contrato: 12500000, progresso: 58, status: 'Em andamento' },
            { id: 'obra-2', nome: 'Centro Comercial Prime Plaza', cliente: 'Vinci Real Estate', valor_contrato: 24800000, progresso: 74, status: 'Em andamento' }
          ])
        });
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  async function injectAuth(page: any) {
    await page.goto('/login');
    await page.evaluate(({ user }: { user: any }) => {
      localStorage.setItem('colaborador_sessao', JSON.stringify(user));
      localStorage.setItem('apps_autorizados_cache', JSON.stringify({ apps: ['financeiro', 'rh', 'suprimentos', 'obras', 'rdo', 'frota', 'ponto'], ts: Date.now() }));
      localStorage.setItem('perfil_ativo', 'admin_geral');
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    }, { user: adminUser });
  }

  test('05_1 - Financeiro: Histórico & Fluxo de Caixa', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/financeiro');
    await page.waitForTimeout(2000);
    const tabHistorico = page.getByRole('button', { name: /Histórico & Fluxo/i }).or(page.getByText('Histórico & Fluxo'));
    if (await tabHistorico.isVisible()) {
      await tabHistorico.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: 'screenshots/05_financeiro_01_historico_fluxo.png' });
  });

  test('05_2 - Financeiro: Empresas Cadastradas (Multi-Tenant)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/financeiro');
    await page.waitForTimeout(2000);
    const tabEmpresas = page.getByRole('button', { name: /Empresas/i }).or(page.getByText('Empresas'));
    if (await tabEmpresas.isVisible()) {
      await tabEmpresas.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'screenshots/05_financeiro_02_empresas.png' });
  });

  test('05_3 - Financeiro: Fornecedores & Dados Bancários / PIX', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/financeiro');
    await page.waitForTimeout(2000);
    const tabFornecedores = page.getByRole('button', { name: /Fornecedores/i }).or(page.getByText('Fornecedores'));
    if (await tabFornecedores.isVisible()) {
      await tabFornecedores.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'screenshots/05_financeiro_03_fornecedores.png' });
  });

  test('05_4 - Financeiro: Formulário de Lançar Conta Preenchido', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/financeiro');
    await page.waitForTimeout(2000);
    const tabLancar = page.getByRole('button', { name: /Lançar Conta/i }).or(page.getByText('Lançar Conta'));
    if (await tabLancar.isVisible()) {
      await tabLancar.click();
      await page.waitForTimeout(1500);
    }

    try {
      const inputs = page.locator('input');
      const textareas = page.locator('textarea');

      const descInput = page.locator('input[placeholder*="Ex:"]').first();
      if (await descInput.isVisible()) {
        await descInput.fill('Fornecimento de Concreto Usinado FCK 35 (45m³)');
      }

      const valorInput = page.locator('input[type="text"]').filter({ hasText: '' }).nth(1);
      if (await valorInput.isVisible()) {
        await valorInput.fill('34500,00');
      }

      if (await textareas.first().isVisible()) {
        await textareas.first().fill('Concretagem programada para a Laje do 7º Pavimento. Nota fiscal vinculada ao pedido de compras.');
      }
    } catch {}

    await page.screenshot({ path: 'screenshots/05_financeiro_04_lancar_conta.png' });
  });

  test('05_5 - Financeiro: Usuários & Acessos / Permissões de Funcionários', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/financeiro');
    await page.waitForTimeout(2000);
    const tabPermissoes = page.getByRole('button', { name: /Usuários & Acessos/i }).or(page.getByText('Usuários & Acessos'));
    if (await tabPermissoes.isVisible()) {
      await tabPermissoes.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'screenshots/05_financeiro_05_usuarios_acessos.png' });
  });
});
