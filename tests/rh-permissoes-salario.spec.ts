import { test, expect } from '@playwright/test';

// Mocks de Usuários para Teste de Permissão
const usuarioComPermissaoSalario = {
  id: 'user-admin-rh-1',
  nome: 'Diretora Silvia RH',
  email: 'silvia.rh@empresa.com',
  cargo: 'admin_geral',
  pode_ver_salario: true,
  override_permissoes: true,
  abas_rh: 'admissao,aptos,ativos',
  apps: 'rh,salarios'
};

const usuarioSemPermissaoSalario = {
  id: 'user-assistente-rh-2',
  nome: 'Assistente Lucas Campo',
  email: 'lucas.campo@empresa.com',
  cargo: 'assistente_rh',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: 'admissao,aptos,ativos',
  apps: 'rh'
};

// Matriz dos 9 Cenários de Permissões de Abas (Opção 2)
// 1 Aba
const userApenasAdmissao = {
  id: 'user-aba-admissao',
  nome: 'Mestre Gilberto Obra',
  cargo: 'operador',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: 'admissao',
  apps: 'rh'
};

const userApenasAptos = {
  id: 'user-aba-aptos',
  nome: 'Conferente Aptos',
  cargo: 'auxiliar_dp',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: 'aptos',
  apps: 'rh'
};

const userApenasAtivos = {
  id: 'user-aba-ativos',
  nome: 'Auditor de Ativos',
  cargo: 'auditor',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: 'ativos',
  apps: 'rh'
};

// 2 Abas
const userAdmissaoEAptos = {
  id: 'user-aba-adm-aptos',
  nome: 'Analista RH Geral',
  cargo: 'analista_rh',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: 'admissao,aptos',
  apps: 'rh'
};

const userAdmissaoEAtivos = {
  id: 'user-aba-adm-ativos',
  nome: 'Supervisor Campo e Ativos',
  cargo: 'supervisor',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: 'admissao,ativos',
  apps: 'rh'
};

const userAptosEAtivos = {
  id: 'user-aba-aptos-ativos',
  nome: 'Especialista RH SP',
  cargo: 'especialista_dp',
  pode_ver_salario: true,
  override_permissoes: true,
  abas_rh: 'aptos,ativos',
  apps: 'rh'
};

// 3 Abas
const userTodasAbas = {
  id: 'user-aba-todas',
  nome: 'Diretora Geral',
  cargo: 'diretora',
  pode_ver_salario: true,
  override_permissoes: true,
  abas_rh: 'admissao,aptos,ativos',
  apps: 'rh'
};

// Herança do cargo (override_permissoes: false)
const userHerancaCargo = {
  id: 'user-aba-heranca',
  nome: 'Operador Sem Override',
  cargo: 'cargo_apenas_admissao',
  pode_ver_salario: false,
  override_permissoes: false,
  abas_rh: null,
  apps: 'rh'
};

// Fallback de segurança (sem abas configuradas / string vazia)
const userSemAbas = {
  id: 'user-aba-vazia',
  nome: 'Usuário Vazio',
  cargo: 'visitante',
  pode_ver_salario: false,
  override_permissoes: true,
  abas_rh: '',
  apps: 'rh'
};

const mockModelos = [
  { id: 'm-1', ordem: 1, nome: '1. Documentos & PIX', codigo: 'M1', checklist: [] },
  { id: 'm-2', ordem: 2, nome: '2. Ficha Cadastral', codigo: 'M2', checklist: [] },
  { id: 'm-3', ordem: 3, nome: '3. Declarações', codigo: 'M3', checklist: [] },
  { id: 'm-4', ordem: 4, nome: '4. Guia & ASO Admissional', codigo: 'M4', checklist: [] }
];

const mockConvites = [
  {
    id: 'conv-apto-1',
    nome_destinatario: 'Marcos Vinicius da Silva',
    cpf: '123.456.789-00',
    cargo: 'Encarregado Geral',
    obra: 'Obra Central SP',
    matricula: 'MAT-2026-001',
    status: 'apto',
    etapa_atual: 4,
    created_at: '2026-09-01T10:00:00Z',
    expires_at: '2026-10-01T10:00:00Z',
    documentos: [
      {
        id: 'doc-salario-1',
        item_id: 'salario_registro',
        modelo_id: 'm-1',
        nome: 'Salário Contratual: R$ 4.500,00',
        observacao_rh: '4.500,00',
        status: 'aprovado'
      },
      {
        id: 'doc-resumo-1',
        item_id: 'ficha_resumo',
        modelo_id: 'm-1',
        nome: 'Ficha_Resumo_Marcos.pdf',
        storage_path: 'fichas/ficha-marcos.pdf',
        status: 'aprovado'
      }
    ]
  },
  {
    id: 'conv-admissao-1',
    nome_destinatario: 'Ana Paula Rocha',
    cpf: '987.654.321-99',
    cargo: 'Almoxarife',
    obra: 'Obra Central SP',
    matricula: 'MAT-2026-002',
    status: 'aguardando_aprovacao',
    etapa_atual: 4,
    created_at: '2026-09-02T10:00:00Z',
    expires_at: '2026-10-02T10:00:00Z',
    documentos: []
  }
];

test.describe('RH - Controle de Permissão de Visualização e Edição de Salário', () => {

  test.beforeEach(async ({ page }) => {
    // Intercepta e mocka todas as chamadas Supabase REST com Regex universal
    await page.route(/\/rest\/v1\//, async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');

      if (pathname.includes('rh_modelos_admissao')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockModelos)
        });
      }

      if (pathname.includes('rh_admissao_convites')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConvites)
        });
      }

      if (pathname.includes('funcionarios')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'f-1',
              nome: 'Funcionario Ativo 1',
              cpf: '111.222.333-44',
              cargo: 'Operador',
              status: 'Ativo',
              data_admissao: '2026-01-15',
              dados_registro: { salario: '3.200,00' }
            }
          ])
        });
      }

      if (pathname.includes('obras')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'ob-1', nome: 'Obra Central SP' }
          ])
        });
      }

      if (pathname.includes('colaboradores')) {
        const colabs = [
          usuarioComPermissaoSalario,
          usuarioSemPermissaoSalario,
          userApenasAdmissao,
          userApenasAptos,
          userApenasAtivos,
          userAdmissaoEAptos,
          userAdmissaoEAtivos,
          userAptosEAtivos,
          userTodasAbas,
          userHerancaCargo,
          userSemAbas
        ];
        if (isSingle || url.search.includes('id=eq.')) {
          const match = url.search.match(/id=eq\.([^&]+)/);
          const colab = match ? colabs.find(c => c.id === decodeURIComponent(match[1])) : colabs[0];
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(colab || colabs[0])
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(colabs)
        });
      }

      if (pathname.includes('config_permissoes')) {
        const perms = [
          { cargo: 'admin_geral', pode_ver_salario: true, apps: 'rh,financeiro,salarios', abas_rh: 'admissao,aptos,ativos' },
          { cargo: 'assistente_rh', pode_ver_salario: false, apps: 'rh', abas_rh: 'admissao,aptos,ativos' },
          { cargo: 'operador', pode_ver_salario: false, apps: 'rh', abas_rh: 'admissao' },
          { cargo: 'auxiliar_dp', pode_ver_salario: false, apps: 'rh', abas_rh: 'aptos' },
          { cargo: 'auditor', pode_ver_salario: false, apps: 'rh', abas_rh: 'ativos' },
          { cargo: 'analista_rh', pode_ver_salario: false, apps: 'rh', abas_rh: 'admissao,aptos' },
          { cargo: 'supervisor', pode_ver_salario: false, apps: 'rh', abas_rh: 'admissao,ativos' },
          { cargo: 'especialista_dp', pode_ver_salario: true, apps: 'rh', abas_rh: 'aptos,ativos' },
          { cargo: 'diretora', pode_ver_salario: true, apps: 'rh', abas_rh: 'admissao,aptos,ativos' },
          { cargo: 'cargo_apenas_admissao', pode_ver_salario: false, apps: 'rh', abas_rh: 'admissao' },
          { cargo: 'visitante', pode_ver_salario: false, apps: 'rh', abas_rh: '' }
        ];
        if (isSingle || url.search.includes('cargo=eq.')) {
          const match = url.search.match(/cargo=eq\.([^&]+)/);
          const p = match ? perms.find(c => c.cargo === decodeURIComponent(match[1])) : perms[0];
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(p || perms[0])
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(perms)
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]'
      });
    });
  });

  async function loginAs(page: any, user: any) {
    await page.addInitScript((usr: any) => {
      localStorage.setItem('colaborador_sessao', JSON.stringify(usr));
      localStorage.setItem('perfil_ativo', usr.cargo);
      localStorage.setItem('apps_autorizados_cache', JSON.stringify({ apps: ['rh', 'financeiro'], ts: Date.now() }));
    }, user);
  }

  test('Cenário 1: Usuário COM permissão visualiza e pode editar o salário', async ({ page }) => {
    await loginAs(page, usuarioComPermissaoSalario);
    await page.goto('/rh');

    // 1. Aguarda a página carregar e clica na aba de Aptos
    const tabAptos = page.getByRole('button', { name: /2\. Aptos p\/ Registro/i });
    await expect(tabAptos).toBeVisible({ timeout: 15000 });
    await tabAptos.click();

    // 2. No card do candidato 'Marcos Vinicius da Silva', o valor do salário DEVE ser visível
    const cardCandidato = page.locator('text=Marcos Vinicius da Silva').first();
    await expect(cardCandidato).toBeVisible();

    // Verifica que o badge de salário mostra o valor com ícone 💰
    await expect(page.getByText(/4\.500,00/i).first()).toBeVisible();

    // Garante que o alerta de restrição NÃO aparece para este usuário
    await expect(page.locator('text=Salário Restrito')).not.toBeVisible();

    // 3. Clica no candidato para abrir o painel de detalhes à direita
    await cardCandidato.click();

    // 4. Clica na pasta Etapa 5 (Registro & Salário)
    const abaEtapa5 = page.getByRole('button', { name: /📁 Etapa 5/i });
    await expect(abaEtapa5).toBeVisible();
    await abaEtapa5.click();

    // 5. Verifica se o badge de 'Acesso Autorizado' está visível
    await expect(page.getByText('✓ Acesso Autorizado')).toBeVisible();

    // 6. Verifica que o valor da remuneração registrada está explícito na tela
    await expect(page.getByText('4.500,00').first()).toBeVisible();

    // 7. O botão 'Alterar Salário' deve estar presente e clicável
    const btnAlterar = page.getByRole('button', { name: /Alterar Salário/i });
    await expect(btnAlterar).toBeVisible();
    await btnAlterar.click();

    // 8. O modal de edição deve se abrir com o campo para preenchimento
    await expect(page.getByRole('heading', { name: /Salário Contratual para Registro/i })).toBeVisible();
    await expect(page.getByPlaceholder('Ex: 3.500,00')).toBeVisible();
  });

  test('Cenário 2: Usuário SEM permissão tem visualização bloqueada e sigilo preservado', async ({ page }) => {
    await loginAs(page, usuarioSemPermissaoSalario);
    await page.goto('/rh');

    // 1. Aguarda a página carregar e clica na aba de Aptos
    const tabAptos = page.getByRole('button', { name: /2\. Aptos p\/ Registro/i });
    await expect(tabAptos).toBeVisible({ timeout: 15000 });
    await tabAptos.click();

    // 2. No card do candidato na lista mestre:
    const cardCandidato = page.locator('text=Marcos Vinicius da Silva').first();
    await expect(cardCandidato).toBeVisible();

    // DEVE exibir o badge de sigilo 'Salário Restrito' com cadeado
    await expect(page.getByText('Salário Restrito').first()).toBeVisible();

    // NÃO deve exibir o valor do salário (4.500,00) em nenhum lugar do card
    await expect(page.locator('text=💰 R$ 4.500,00')).not.toBeVisible();

    // 3. Abre o painel de detalhes do candidato
    await cardCandidato.click();

    // 4. Clica na pasta Etapa 5 (Registro & Salário)
    const abaEtapa5 = page.getByRole('button', { name: /📁 Etapa 5/i });
    await expect(abaEtapa5).toBeVisible();
    await abaEtapa5.click();

    // 5. Verifica que o badge de 'Acesso Autorizado' NÃO EXISTE
    await expect(page.getByText('✓ Acesso Autorizado')).not.toBeVisible();

    // 6. Verifica que o card de bloqueio confidencial está ATIVO
    await expect(page.getByText('Salário Confidencial (Restrito ao RH e Diretoria)')).toBeVisible();
    await expect(page.getByText(/Seu perfil não possui a permissão/i)).toBeVisible();

    // 7. O botão 'Alterar Salário' ou 'Definir Salário' NÃO DEVE existir
    await expect(page.getByRole('button', { name: /Alterar Salário/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Definir Salário/i })).not.toBeVisible();

    // 8. O valor confidencial do salário não pode aparecer no DOM desta visualização
    await expect(page.locator('text=R$ 4.500,00')).not.toBeVisible();
  });

  test('Cenário 3: Fluxo de Transição e Ações por Fase (Admissão x Apto)', async ({ page }) => {
    await loginAs(page, usuarioComPermissaoSalario);
    await page.goto('/rh');

    // 1. Na aba '1. Admissões':
    const tabAdmissao = page.getByRole('button', { name: /1\. Admissões/i });
    await expect(tabAdmissao).toBeVisible({ timeout: 15000 });
    await tabAdmissao.click();

    const candidatoAdmissao = page.locator('text=Ana Paula Rocha').first();
    await expect(candidatoAdmissao).toBeVisible();
    await candidatoAdmissao.click();

    // Na fase de Admissão, deve exibir o botão de transição para a 2ª fase
    await expect(page.getByRole('button', { name: /Declarar Apto para Registro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Concluir Registro & Efetivar/i })).not.toBeVisible();

    // 2. Na aba '2. Aptos p/ Registro':
    const tabAptos = page.getByRole('button', { name: /2\. Aptos p\/ Registro/i });
    await tabAptos.click();

    const candidatoApto = page.locator('text=Marcos Vinicius da Silva').first();
    await expect(candidatoApto).toBeVisible();
    await candidatoApto.click();

    // Na fase de Apto, as opções de ação mudam para Concluir/Efetivar ou Voltar p/ Admissão
    await expect(page.getByRole('button', { name: /Voltar p\/ Admissão/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Concluir Registro & Efetivar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Declarar Apto para Registro/i })).not.toBeVisible();
  });

  test('Cenário 4: Edição Ágil de Salário pelo Card de Aptos e Ficha do Colaborador', async ({ page }) => {
    await loginAs(page, usuarioComPermissaoSalario);
    await page.goto('/rh');

    // 1. Vai para a aba Aptos
    const tabAptos = page.getByRole('button', { name: /2\. Aptos p\/ Registro/i });
    await expect(tabAptos).toBeVisible({ timeout: 15000 });
    await tabAptos.click();

    // 2. O botão interativo de salário no card do candidato deve estar presente
    const btnSalarioCard = page.getByRole('button', { name: /💰 Salário: R\$ 4\.500,00/i });
    await expect(btnSalarioCard).toBeVisible();

    // Clica diretamente no botão de salário do card -> deve disparar o modal imediatamente
    await btnSalarioCard.click();
    await expect(page.getByRole('heading', { name: /Salário Contratual para Registro/i })).toBeVisible();
    await page.getByRole('button', { name: /Cancelar/i }).click();

    // 3. Na barra superior de ações de CadastroTable, o botão direto de salário também deve existir
    const btnSalarioTopBar = page.getByTitle(/Definir ou alterar salário contratual para registro/i);
    await expect(btnSalarioTopBar).toBeVisible();

    // 4. Vai para a aba de Registrados (Ativos)
    const tabAtivos = page.getByRole('button', { name: /3\. Registrados/i });
    await tabAtivos.click();

    const funcCard = page.locator('text=Funcionario Ativo 1').first();
    await expect(funcCard).toBeVisible();

    // No card do colaborador na lista de Registrados, deve ter o botão de deslocamento rápido para Aptos
    const btnDeslocarCard = page.locator('button[title="Deslocar de volta para Aptos p/ Registro"]').first();
    await expect(btnDeslocarCard).toBeVisible();

    await funcCard.click();

    // Na ficha do colaborador registrado, deve ter o badge REGISTRADO (ATIVO) e o botão 'Voltar p/ Aptos'
    await expect(page.getByText('✓ REGISTRADO (ATIVO)')).toBeVisible();
    const btnVoltarAptos = page.getByRole('button', { name: /Voltar p\/ Aptos/i });
    await expect(btnVoltarAptos).toBeVisible();

    // Deve mostrar o salário registrado e o botão 'Editar Salário'
    await expect(page.getByText(/3\.200,00/i).first()).toBeVisible();
    const btnEditSalarioFunc = page.getByRole('button', { name: /Editar Salário/i });
    await expect(btnEditSalarioFunc).toBeVisible();
    await btnEditSalarioFunc.click();

    // O modal de edição do salário do colaborador ativo deve abrir
    await expect(page.getByRole('heading', { name: /Editar Salário Registrado/i })).toBeVisible();
  });

  test('Cenário 5: Seleção Múltipla de Cards e Ações em Lote (Bulk Actions)', async ({ page }) => {
    await loginAs(page, usuarioComPermissaoSalario);
    await page.goto('/rh');

    // 1. Na Aba 1 (Admissões), a barra de controle deve estar visível
    await expect(page.getByText(/Selecionar todos/i)).toBeVisible({ timeout: 15000 });

    // 2. Localiza os checkboxes de lote
    const checkboxes = page.locator('input[type="checkbox"][title="Selecionar para ações em lote"]');
    await expect(checkboxes.first()).toBeVisible();

    // 3. Marca o primeiro candidato
    await checkboxes.first().click();

    // 4. A barra de ações em lote deve surgir com os botões específicos da Aba 1
    await expect(page.getByText(/✓ 1 selecionado/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Declarar Aptos \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Revogar \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Excluir \(1\)/i })).toBeVisible();

    // 5. Clica no botão "Limpar"
    await page.getByRole('button', { name: /Limpar/i }).click();
    await expect(page.getByText(/✓ 1 selecionado/i)).not.toBeVisible();

    // 6. Muda para a Aba 2 (Aptos p/ Registro)
    const tabAptos = page.getByRole('button', { name: /2\. Aptos p\/ Registro/i });
    await tabAptos.click();

    // Marca o candidato em Aptos
    const checkApto = page.locator('input[type="checkbox"][title="Selecionar para ações em lote"]').first();
    await checkApto.click();

    // Na Aba 2, deve exibir ações de Efetivar, Voltar p/ Admissão e Excluir
    await expect(page.getByText(/✓ 1 selecionado/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Concluir & Efetivar \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Voltar p\/ Admissão \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Excluir \(1\)/i })).toBeVisible();

    // 7. Muda para a Aba 3 (Registrados)
    const tabRegistrados = page.getByRole('button', { name: /3\. Registrados/i });
    await tabRegistrados.click();

    // Marca o colaborador registrado
    const checkRegistrado = page.locator('input[type="checkbox"][title="Selecionar para ações em lote"]').first();
    await checkRegistrado.click();

    // Na Aba 3, deve exibir ações de Deslocar p/ Aptos, Deslocar p/ Admissão e Excluir
    await expect(page.getByText(/✓ 1 selecionado/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Deslocar p\/ Aptos \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Deslocar p\/ Admissão \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Excluir \(1\)/i })).toBeVisible();
  });

  // ─── MATRIZ COMPLETA DE PERMISSÕES DE ABAS DO RH (9 CENÁRIOS) ──────────────────

  // GRUPO 1: USUÁRIOS COM APENAS 1 ABA LIBERADA (3 CENÁRIOS)
  test('Cenário 6.1: 1 Aba - Apenas "admissao" (Perfil Obra/Canteiro)', async ({ page }) => {
    await loginAs(page, userApenasAdmissao);
    await page.goto('/rh');

    // Aba 1 visível
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).toBeVisible({ timeout: 15000 });
    // Abas 2 e 3 NÃO visíveis
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).not.toBeVisible();
  });

  test('Cenário 6.2: 1 Aba - Apenas "aptos"', async ({ page }) => {
    await loginAs(page, userApenasAptos);
    await page.goto('/rh');

    // Aba 2 visível e redirecionada
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).toBeVisible({ timeout: 15000 });
    // Abas 1 e 3 NÃO visíveis
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).not.toBeVisible();
  });

  test('Cenário 6.3: 1 Aba - Apenas "ativos" (Registrados)', async ({ page }) => {
    await loginAs(page, userApenasAtivos);
    await page.goto('/rh');

    // Aba 3 visível
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).toBeVisible({ timeout: 15000 });
    // Abas 1 e 2 NÃO visíveis
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).not.toBeVisible();
  });

  // GRUPO 2: USUÁRIOS COM 2 ABAS LIBERADAS (3 CENÁRIOS)
  test('Cenário 6.4: 2 Abas - "admissao,aptos" (RH Geral / Validação)', async ({ page }) => {
    await loginAs(page, userAdmissaoEAptos);
    await page.goto('/rh');

    // Abas 1 e 2 visíveis
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).toBeVisible();
    // Aba 3 NÃO visível
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).not.toBeVisible();
  });

  test('Cenário 6.5: 2 Abas - "admissao,ativos"', async ({ page }) => {
    await loginAs(page, userAdmissaoEAtivos);
    await page.goto('/rh');

    // Abas 1 e 3 visíveis
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).toBeVisible();
    // Aba 2 (Aptos) NÃO visível
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).not.toBeVisible();
  });

  test('Cenário 6.6: 2 Abas - "aptos,ativos" (RH SP / Escritório Registro)', async ({ page }) => {
    await loginAs(page, userAptosEAtivos);
    await page.goto('/rh');

    // Abas 2 e 3 visíveis
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).toBeVisible();
    // Aba 1 (Obra) NÃO visível
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).not.toBeVisible();
  });

  // GRUPO 3: USUÁRIO COM AS 3 ABAS LIBERADAS (1 CENÁRIO)
  test('Cenário 6.7: 3 Abas - "admissao,aptos,ativos" (Acesso Total / Diretoria)', async ({ page }) => {
    await loginAs(page, userTodasAbas);
    await page.goto('/rh');

    // Todas as 3 abas visíveis
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).toBeVisible();
  });

  // GRUPO 4: HERANÇA DO CARGO & FALLBACK DE SEGURANÇA (2 CENÁRIOS)
  test('Cenário 6.8: Herança por Cargo - override_permissoes = false herda abas do cargo', async ({ page }) => {
    await loginAs(page, userHerancaCargo);
    await page.goto('/rh');

    // O cargo cargo_apenas_admissao está mockado com abas_rh = 'admissao'
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).not.toBeVisible();
  });

  test('Cenário 6.9: Fallback de Segurança - Sem abas configuradas (restringe a Admissão)', async ({ page }) => {
    await loginAs(page, userSemAbas);
    await page.goto('/rh');

    // Fallback de segurança para 'admissao'
    await expect(page.getByRole('button', { name: /1\. Admissões/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /2\. Aptos p\/ Registro/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /3\. Registrados/i })).not.toBeVisible();
  });

});
