import { test, expect } from '@playwright/test';

// Mocks de usuários para os testes
const adminGeral = {
  id: 'admin-123',
  nome: 'Admin Geral',
  email: 'admin@teste.com',
  cargo: 'admin_geral',
};

const engenheiro = {
  id: 'eng-123',
  nome: 'Engenheiro Teste',
  email: 'eng@teste.com',
  cargo: 'engenheiro',
  empresa_id: 'empresa-a',
};

const adminEmpresaA = {
  id: 'admin-empresa-123',
  nome: 'Admin Empresa A',
  email: 'admA@teste.com',
  cargo: 'admin_empresa',
  empresa_id: 'empresa-a',
};

test.describe('Controle de Acesso Baseado em Funções (RBAC)', () => {

  test.beforeEach(async ({ page }) => {
    // Intercepta as rotas do Supabase para não depender do banco de dados real
    await page.route('**/rest/v1/contas*', async route => {
      const url = route.request().url();
      // Retorna uma lista moca de contas
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'conta-1', empresa_id: 'empresa-a', descricao: 'Conta Empresa A', valor: 100, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-12-01' },
          { id: 'conta-2', empresa_id: 'empresa-b', descricao: 'Conta Empresa B', valor: 200, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-12-01' },
        ])
      });
    });

    await page.route('**/rest/v1/*', async route => {
      const url = route.request().url();
      if (url.includes('contas')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'conta-1', empresa_id: 'empresa-a', descricao: 'Conta Empresa A', valor: 100, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-07-22', data_previsao: '2026-07-22' },
            { id: 'conta-2', empresa_id: 'empresa-b', descricao: 'Conta Empresa B', valor: 200, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-07-22', data_previsao: '2026-07-22' },
          ])
        });
      }
      if (url.includes('empresas')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'empresa-a', razao_social: 'Empresa A', cor: '#fff' },
            { id: 'empresa-b', razao_social: 'Empresa B', cor: '#000' },
          ])
        });
      }
      if (url.includes('auth/v1/user') || url.includes('auth/v1/session')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'mock-auth-id' }, session: { access_token: 'mock-token' } })
        });
      }
      if (url.includes('colaboradores')) {
        const colabs = [
          { id: 'admin-123', nome: 'Admin', cargo: 'admin_geral', apps: 'financeiro' },
          { id: 'eng-123', nome: 'Eng', cargo: 'engenheiro', apps: 'financeiro', empresa_id: 'empresa-a' },
          { id: 'admin-empresa-123', nome: 'Admin Emp', cargo: 'admin_empresa', apps: 'financeiro', empresa_id: 'empresa-a' }
        ];

        const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');
        
        if (isSingle) {
          const match = url.match(/id=eq\.([^&]+)/);
          const colab = match ? colabs.find(c => c.id === match[1]) : colabs[0];
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(colab)
          });
        }
        
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(colabs)
        });
      }
      if (url.includes('config_permissoes')) {
        const perms = [
          { cargo: 'admin_geral', apps: 'financeiro,rh,suprimentos,obras,rdo' },
          { cargo: 'engenheiro', apps: 'financeiro,obras,rdo' },
          { cargo: 'admin_empresa', apps: 'financeiro,rh' }
        ];
        
        const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');

        if (isSingle) {
          const match = url.match(/cargo=eq\.([^&]+)/);
          const p = match ? perms.find(c => c.cargo === match[1]) : perms[0];
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(p)
          });
        }
        
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(perms)
        });
      }
      // Outras tabelas: retorna array vazio
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.route('**/functions/v1/admin-financeiro', async route => {
      // Mock da função edge.
      const postData = route.request().postDataJSON();
      if (postData?.admin_id === 'admin-123') {
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      } else {
        await route.fulfill({ status: 403, body: JSON.stringify({ error: 'Acesso negado' }) });
      }
    });
  });

  test('Teste 1: Acesso Restrito (Engenheiro não vê aprovações nem negociações)', async ({ page }) => {
    // Acessa uma página genérica para inicializar o origin
    await page.goto('/');
    
    // Injeta a sessão do Engenheiro no localStorage
    await page.evaluate((usr) => {
      localStorage.setItem('colaborador_sessao', JSON.stringify(usr));
    }, engenheiro);

    // Navega para o financeiro
    await page.goto('/financeiro');

    // Verifica se as abas exclusivas não existem
    await expect(page.getByText('Usuários & Acessos')).not.toBeVisible();
    await expect(page.getByText('Painel Gerencial')).not.toBeVisible();
    
    // Verifica que o painel de negociação também não existe no detalhe da conta
    // Clica na primeira conta da listagem para abrir os detalhes
    await expect(page.locator('text=Conta Empresa A')).toBeVisible({ timeout: 5000 });
    await page.getByText('Conta Empresa A').click();
    
    // O formulário de negociação não deve estar visível
    await expect(page.getByText('Registrar Nova Negociação')).not.toBeVisible();
  });

  test('Teste 2: Acesso Multi-Tenant (Isolamento de listagem)', async ({ page }) => {
    await page.goto('/');
    
    // Injeta a sessão do Admin Empresa A
    await page.evaluate((usr) => {
      localStorage.setItem('colaborador_sessao', JSON.stringify(usr));
    }, adminEmpresaA);

    // Navega para o financeiro
    await page.goto('/financeiro');

    // Espera a listagem carregar
    await expect(page.locator('text=Conta Empresa A')).toBeVisible({ timeout: 5000 });

    // A URL que a página tenta acessar tem o filtro `empresa_id=in.(empresa-a)` na URL da API?
    // Como estamos mocando as requisições, vamos interceptar a URL requisitada
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/rest/v1/contas') && req.method() === 'GET'),
      page.reload()
    ]);

    expect(request.url()).toContain('empresa_id=in');
    expect(request.url()).toContain('empresa-a');
  });

  test('Teste 3: Acesso Total (Admin Geral visualizando painéis restritos)', async ({ page }) => {
    await page.goto('/');
    
    // Injeta a sessão do Admin Geral
    await page.evaluate((usr) => {
      localStorage.setItem('colaborador_sessao', JSON.stringify(usr));
    }, adminGeral);

    await page.goto('/financeiro');

    // Verifica se as abas restritas estão disponíveis
    await expect(page.getByText('Usuários & Acessos', { exact: true })).toBeVisible();

    // Expande uma conta para verificar o formulário de negociação
    await expect(page.locator('text=Conta Empresa A')).toBeVisible({ timeout: 5000 });
    await page.getByText('Conta Empresa A').click();

    await expect(page.getByText('Registrar Nova Negociação')).toBeVisible();
  });
});
