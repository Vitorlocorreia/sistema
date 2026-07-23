# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rbac.spec.ts >> Controle de Acesso Baseado em Funções (RBAC) >> Teste 1: Acesso Restrito (Engenheiro não vê aprovações nem negociações)
- Location: tests\rbac.spec.ts:113:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Conta Empresa A')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Conta Empresa A')

```

```yaml
- heading "Portal da Construtora" [level=1]
- paragraph: Faça login com suas credenciais
- text: E-mail
- textbox "seu@email.com"
- text: Senha
- textbox "••••••••"
- button
- button "Entrar no Portal"
- button "Criar Conta"
- paragraph: Desenvolvido com foco em segurança de dados corporativos.
- alert
```

# Test source

```ts
  31  |     await page.route('**/rest/v1/contas*', async route => {
  32  |       const url = route.request().url();
  33  |       // Retorna uma lista moca de contas
  34  |       await route.fulfill({
  35  |         status: 200,
  36  |         contentType: 'application/json',
  37  |         body: JSON.stringify([
  38  |           { id: 'conta-1', empresa_id: 'empresa-a', descricao: 'Conta Empresa A', valor: 100, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-12-01' },
  39  |           { id: 'conta-2', empresa_id: 'empresa-b', descricao: 'Conta Empresa B', valor: 200, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-12-01' },
  40  |         ])
  41  |       });
  42  |     });
  43  | 
  44  |     await page.route('**/rest/v1/*', async route => {
  45  |       const url = route.request().url();
  46  |       if (url.includes('contas')) {
  47  |         return route.fulfill({
  48  |           status: 200,
  49  |           contentType: 'application/json',
  50  |           body: JSON.stringify([
  51  |             { id: 'conta-1', empresa_id: 'empresa-a', descricao: 'Conta Empresa A', valor: 100, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-07-22', data_previsao: '2026-07-22' },
  52  |             { id: 'conta-2', empresa_id: 'empresa-b', descricao: 'Conta Empresa B', valor: 200, status: 'A pagar', tipo: 'pagar', data_vencimento: '2026-07-22', data_previsao: '2026-07-22' },
  53  |           ])
  54  |         });
  55  |       }
  56  |       if (url.includes('empresas')) {
  57  |         return route.fulfill({
  58  |           status: 200,
  59  |           contentType: 'application/json',
  60  |           body: JSON.stringify([
  61  |             { id: 'empresa-a', razao_social: 'Empresa A', cor: '#fff' },
  62  |             { id: 'empresa-b', razao_social: 'Empresa B', cor: '#000' },
  63  |           ])
  64  |         });
  65  |       }
  66  |       if (url.includes('auth/v1/user') || url.includes('auth/v1/session')) {
  67  |         return route.fulfill({
  68  |           status: 200,
  69  |           contentType: 'application/json',
  70  |           body: JSON.stringify({ user: { id: 'mock-auth-id' }, session: { access_token: 'mock-token' } })
  71  |         });
  72  |       }
  73  |       if (url.includes('colaboradores')) {
  74  |         return route.fulfill({
  75  |           status: 200,
  76  |           contentType: 'application/json',
  77  |           body: JSON.stringify([
  78  |             { id: 'admin-123', nome: 'Admin', cargo: 'admin_geral', apps: 'financeiro' },
  79  |             { id: 'eng-123', nome: 'Eng', cargo: 'engenheiro', apps: 'financeiro', empresa_id: 'empresa-a' },
  80  |             { id: 'admin-empresa-123', nome: 'Admin Emp', cargo: 'admin_empresa', apps: 'financeiro', empresa_id: 'empresa-a' }
  81  |           ])
  82  |         });
  83  |       }
  84  |       if (url.includes('config_permissoes')) {
  85  |         return route.fulfill({
  86  |           status: 200,
  87  |           contentType: 'application/json',
  88  |           body: JSON.stringify([
  89  |             { cargo: 'admin_geral', apps: 'financeiro,rh,suprimentos' },
  90  |             { cargo: 'engenheiro', apps: 'financeiro' },
  91  |             { cargo: 'admin_empresa', apps: 'financeiro' }
  92  |           ])
  93  |         });
  94  |       }
  95  |       // Outras tabelas: retorna array vazio
  96  |       await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  97  |     });
  98  |     
  99  |     page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  100 |     page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  101 | 
  102 |     await page.route('**/functions/v1/admin-financeiro', async route => {
  103 |       // Mock da função edge.
  104 |       const postData = route.request().postDataJSON();
  105 |       if (postData?.admin_id === 'admin-123') {
  106 |         await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  107 |       } else {
  108 |         await route.fulfill({ status: 403, body: JSON.stringify({ error: 'Acesso negado' }) });
  109 |       }
  110 |     });
  111 |   });
  112 | 
  113 |   test('Teste 1: Acesso Restrito (Engenheiro não vê aprovações nem negociações)', async ({ page }) => {
  114 |     // Acessa uma página genérica para inicializar o origin
  115 |     await page.goto('/');
  116 |     
  117 |     // Injeta a sessão do Engenheiro no localStorage
  118 |     await page.evaluate((usr) => {
  119 |       localStorage.setItem('usuario', JSON.stringify(usr));
  120 |     }, engenheiro);
  121 | 
  122 |     // Navega para o financeiro
  123 |     await page.goto('/financeiro');
  124 | 
  125 |     // Verifica se as abas exclusivas não existem
  126 |     await expect(page.getByText('Usuários & Acessos')).not.toBeVisible();
  127 |     await expect(page.getByText('Painel Gerencial')).not.toBeVisible();
  128 |     
  129 |     // Verifica que o painel de negociação também não existe no detalhe da conta
  130 |     // Clica na primeira conta da listagem para abrir os detalhes
> 131 |     await expect(page.locator('text=Conta Empresa A')).toBeVisible({ timeout: 5000 });
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  132 |     await page.getByText('Conta Empresa A').click();
  133 |     
  134 |     // O formulário de negociação não deve estar visível
  135 |     await expect(page.getByText('Nova Negociação / Acordo')).not.toBeVisible();
  136 |   });
  137 | 
  138 |   test('Teste 2: Acesso Multi-Tenant (Isolamento de listagem)', async ({ page }) => {
  139 |     await page.goto('/');
  140 |     
  141 |     // Injeta a sessão do Admin Empresa A
  142 |     await page.evaluate((usr) => {
  143 |       localStorage.setItem('usuario', JSON.stringify(usr));
  144 |     }, adminEmpresaA);
  145 | 
  146 |     // Navega para o financeiro
  147 |     await page.goto('/financeiro');
  148 | 
  149 |     // Espera a listagem carregar
  150 |     await expect(page.locator('text=Conta Empresa A')).toBeVisible({ timeout: 5000 });
  151 | 
  152 |     // A URL que a página tenta acessar tem o filtro `empresa_id=in.(empresa-a)` na URL da API?
  153 |     // Como estamos mocando as requisições, vamos interceptar a URL requisitada
  154 |     const [request] = await Promise.all([
  155 |       page.waitForRequest(req => req.url().includes('/rest/v1/contas') && req.method() === 'GET'),
  156 |       page.reload(),
  157 |       page.evaluate((usr) => { localStorage.setItem('usuario', JSON.stringify(usr)); }, adminEmpresaA)
  158 |     ]);
  159 | 
  160 |     expect(request.url()).toContain('empresa_id=in');
  161 |     expect(request.url()).toContain('empresa-a');
  162 |   });
  163 | 
  164 |   test('Teste 3: Acesso Total (Admin Geral visualizando painéis restritos)', async ({ page }) => {
  165 |     await page.goto('/');
  166 |     
  167 |     // Injeta a sessão do Admin Geral
  168 |     await page.evaluate((usr) => {
  169 |       localStorage.setItem('usuario', JSON.stringify(usr));
  170 |     }, adminGeral);
  171 | 
  172 |     await page.goto('/financeiro');
  173 | 
  174 |     // Verifica se as abas restritas estão disponíveis
  175 |     await expect(page.getByText('Usuários & Acessos', { exact: true })).toBeVisible();
  176 | 
  177 |     // Expande uma conta para verificar o formulário de negociação
  178 |     await expect(page.locator('text=Conta Empresa A')).toBeVisible({ timeout: 5000 });
  179 |     await page.getByText('Conta Empresa A').click();
  180 | 
  181 |     await expect(page.getByText('Nova Negociação / Acordo')).toBeVisible();
  182 |   });
  183 | });
  184 | 
```