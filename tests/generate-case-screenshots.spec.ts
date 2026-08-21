import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const adminUser = {
  id: 'admin-master-id',
  nome: 'Vitor Correia',
  email: 'vitor@empresa.com',
  cargo: 'admin_geral',
  apps: 'financeiro,rh,suprimentos,obras,rdo,frota,ponto',
  empresa_id: 'empresa-matriz',
  obras_ids: ['obra-1', 'obra-2', 'obra-3']
};

const authorizedApps = ['financeiro', 'rh', 'suprimentos', 'obras', 'rdo', 'frota', 'ponto'];

test.describe('Captura Visual do Sistema (Case Study & Portfólio)', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);

    const outputDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Intercepta todas as rotas de API / Edge Functions
    await page.route('**/*rh-admissao*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          convite: {
            nome_destinatario: 'Carlos Eduardo Oliveira',
            cargo: 'Encarregado de Obras',
            obra: 'Residencial Horizon Tower',
            status: 'em_cadastro',
            expires_at: '2026-08-25T23:59:59Z'
          },
          modelos: [
            {
              id: 'mod-1',
              codigo: 'DOCS_PESSOAIS',
              ordem: 1,
              nome: '1. Relação de Documentos para Registro',
              descricao: 'RG, CPF, Carteira de Trabalho, Comprovante de Residência e Foto',
              tipo_arquivo: 'checklist',
              checklist: [
                { id: 'item-rg', label: 'Documento de Identidade (RG ou CNH)', obrigatorio: true },
                { id: 'item-cpf', label: 'Comprovante de CPF Regularizado', obrigatorio: true },
                { id: 'item-comp', label: 'Comprovante de Residência Atualizado', obrigatorio: true },
                { id: 'item-foto', label: 'Foto 3x4 Nítida', obrigatorio: true }
              ]
            },
            {
              id: 'mod-2',
              codigo: 'AUTODECLARACAO',
              ordem: 2,
              nome: '2. Autodeclaração Étnico-Racial (eSocial)',
              descricao: 'Conformidade legal e estatística do eSocial',
              tipo_arquivo: 'checklist',
              checklist: [{ id: 'item-raca', label: 'Declaração Étnico-Racial Assinada', obrigatorio: true }]
            },
            {
              id: 'mod-3',
              codigo: 'FICHA_REGISTRO',
              ordem: 3,
              nome: '3. Ficha de Registro de Colaborador',
              descricao: 'Informações complementares e dependentes',
              tipo_arquivo: 'checklist',
              checklist: [{ id: 'item-ficha', label: 'Ficha Cadastral Preenchida', obrigatorio: true }]
            },
            {
              id: 'mod-4',
              codigo: 'EXAME_ASO',
              ordem: 4,
              nome: '4. Guia de Encaminhamento & ASO Admissional',
              descricao: 'Atestado de Saúde Ocupacional com aptidão',
              tipo_arquivo: 'checklist',
              checklist: [{ id: 'item-aso', label: 'ASO com carimbo do médico', obrigatorio: true }]
            }
          ],
          documentos: [
            { id: 'd-1', modelo_id: 'mod-1', item_id: 'item-rg', nome: 'RG_Carlos_Eduardo.pdf', status: 'aprovado', tamanho_bytes: 420000, enviado_em: '2026-08-18' },
            { id: 'd-2', modelo_id: 'mod-1', item_id: 'item-cpf', nome: 'CPF_Digital_Oficial.pdf', status: 'aprovado', tamanho_bytes: 180000, enviado_em: '2026-08-18' },
            { id: 'd-3', modelo_id: 'mod-1', item_id: 'item-comp', nome: 'Comprovante_Enel_Agosto.jpg', status: 'pendente', tamanho_bytes: 650000, enviado_em: '2026-08-18' }
          ],
          progresso: {
            etapa_atual: 1,
            completo: false,
            etapas: [
              { modelo_id: 'mod-1', concluida: false, enviados: 3, obrigatorios: 4 },
              { modelo_id: 'mod-2', concluida: false, enviados: 0, obrigatorios: 1 },
              { modelo_id: 'mod-3', concluida: false, enviados: 0, obrigatorios: 1 },
              { modelo_id: 'mod-4', concluida: false, enviados: 0, obrigatorios: 1 }
            ]
          }
        })
      });
    });

    // Intercepta todas as rotas REST do Supabase
    await page.route('**/*supabase.co/rest/v1/*', async route => {
      const url = route.request().url();
      const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');

      if (url.includes('colaboradores')) {
        if (isSingle) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminUser) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([adminUser]) });
      }

      if (url.includes('config_permissoes')) {
        const perms = [{ cargo: 'admin_geral', apps: 'financeiro,rh,suprimentos,obras,rdo,frota,ponto' }];
        if (isSingle) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(perms[0]) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(perms) });
      }

      if (url.includes('obras')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'obra-1',
              nome: 'Residencial Horizon Tower',
              cliente: 'Incorporadora Alphaville',
              endereco: 'Av. Paulista, 1800 - Jardins, SP',
              status: 'Em andamento',
              valor_contrato: 12500000,
              data_inicio: '2026-01-15',
              data_previsao: '2027-06-30',
              progresso: 58,
              created_at: '2026-01-15T08:00:00Z'
            },
            {
              id: 'obra-2',
              nome: 'Centro Comercial Prime Plaza',
              cliente: 'Vinci Real Estate',
              endereco: 'Av. Brigadeiro Faria Lima, 3400 - Itaim Bibi, SP',
              status: 'Em andamento',
              valor_contrato: 24800000,
              data_inicio: '2025-09-01',
              data_previsao: '2027-11-15',
              progresso: 74,
              created_at: '2025-09-01T08:00:00Z'
            },
            {
              id: 'obra-3',
              nome: 'Condomínio Reserva das Palmeiras',
              cliente: 'Cyrela Partners',
              endereco: 'Al. dos Anapurus, 920 - Moema, SP',
              status: 'Planejamento',
              valor_contrato: 8900000,
              data_inicio: '2026-09-01',
              data_previsao: '2027-12-20',
              progresso: 20,
              created_at: '2026-02-10T08:00:00Z'
            }
          ])
        });
      }

      if (url.includes('rdos')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'rdo-1',
              data: '2026-08-18',
              obra_id: 'obra-1',
              responsavel: 'Eng. Roberto Mendonça',
              resumo: 'Concretagem do 6º pavimento e avanço na armação das vigas',
              clima_manha: 'Ensolarado',
              clima_tarde: 'Parcialmente Nublado',
              efetivo_total: 42,
              atividades: 'Concluída concretagem da laje L-6. Armação de pilares P-1 a P-12.',
              status: 'Aprovado',
              obra: { nome: 'Residencial Horizon Tower' }
            },
            {
              id: 'rdo-2',
              data: '2026-08-17',
              obra_id: 'obra-2',
              responsavel: 'Vitor Correia',
              resumo: 'Instalação da fachada de vidro pele de vidro',
              clima_manha: 'Nublado',
              clima_tarde: 'Chuvoso',
              efetivo_total: 28,
              atividades: 'Instalação dos painéis de vidro termoacústico no bloco norte.',
              status: 'Aprovado',
              obra: { nome: 'Centro Comercial Prime Plaza' }
            }
          ])
        });
      }

      if (url.includes('quadros')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'q-1', nome: 'Suprimentos & Aquisições - Obras', descricao: 'Gestão visual de compras de materiais e contratos', ordem: 1, arquivado: false, cor: '#F59E0B' }
          ])
        });
      }

      if (url.includes('quadro_colunas')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'col-1', quadro_id: 'q-1', titulo: 'Cotações', ordem: 1, cor: '#9CA3AF' },
            { id: 'col-2', quadro_id: 'q-1', titulo: 'Em Aprovação', ordem: 2, cor: '#3B82F6' },
            { id: 'col-3', quadro_id: 'q-1', titulo: 'Pedido Feito', ordem: 3, cor: '#F59E0B' },
            { id: 'col-4', quadro_id: 'q-1', titulo: 'Entregue na Obra', ordem: 4, cor: '#10B981' }
          ])
        });
      }

      if (url.includes('quadro_cartoes')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'card-1', coluna_id: 'col-1', titulo: 'Aço CA-50 16mm (20 Toneladas)', descricao: 'Cotação com Gerdau e ArcelorMittal', responsavel: 'Eng. Roberto', prioridade: 'Urgente', prazo: '2026-08-25', etiquetas: ['Estrutural', 'Urgente'], ordem: 1 },
            { id: 'card-2', coluna_id: 'col-2', titulo: 'Concreto Usinado FCK 35 (60m³)', descricao: 'Aprovação para concretagem da Laje 7', responsavel: 'Vitor Correia', prioridade: 'Alta', prazo: '2026-08-22', etiquetas: ['Concreto', 'Horizon'], ordem: 2 },
            { id: 'card-3', coluna_id: 'col-3', titulo: 'Tubulação PVC Tigre Predial 100mm', descricao: 'Faturamento feito, entrega prevista para sexta-feira', responsavel: 'Mariana Silva', prioridade: 'Média', prazo: '2026-08-21', etiquetas: ['Hidráulica'], ordem: 3 },
            { id: 'card-4', coluna_id: 'col-4', titulo: 'EPIs e Capacetes Classe B (50 un)', descricao: 'Recebido pelo encarregado de almoxarifado', responsavel: 'Carlos Almoxarifado', prioridade: 'Baixa', prazo: '2026-08-15', etiquetas: ['Segurança'], ordem: 4 }
          ])
        });
      }

      if (url.includes('contas')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'c-1', descricao: 'Fornecimento de Concreto Usinado Laje 6', valor: 68400, status: 'Pago', tipo: 'pagar', data_vencimento: '2026-08-10', data_previsao: '2026-08-10', fornecedor_nome: 'Polimix Concreto Ltda', obra_id: 'obra-1' },
            { id: 'c-2', descricao: 'Aço CA-50 Cortado e Dobrado 18 Toneladas', valor: 112000, status: 'Liberado', tipo: 'pagar', data_vencimento: '2026-08-25', data_previsao: '2026-08-25', fornecedor_nome: 'Gerdau Comercial de Aços', obra_id: 'obra-1' },
            { id: 'c-3', descricao: 'Locação Mensal de Grua Ascensional', valor: 24500, status: 'Aguardando aprovação', tipo: 'pagar', data_vencimento: '2026-08-30', data_previsao: '2026-08-30', fornecedor_nome: 'Locar Guindastes & Equipamentos', obra_id: 'obra-2' },
            { id: 'c-4', descricao: 'Medição Contratual Nº 06 - Estrutura Concluída', valor: 485000, status: 'Pago', tipo: 'receber', data_vencimento: '2026-08-15', data_previsao: '2026-08-15', fornecedor_nome: 'Incorporadora Alphaville', obra_id: 'obra-1' }
          ])
        });
      }

      if (url.includes('fornecedores')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'f-1', razao_social: 'Polimix Concreto Ltda', cnpj: '12.345.678/0001-90', categoria: 'Concreto', contato_nome: 'Marcelo Vendas', telefone: '(11) 98888-7777', email: 'vendas@polimix.com.br' },
            { id: 'f-2', razao_social: 'Gerdau Comercial de Aços S.A.', cnpj: '33.444.555/0001-12', categoria: 'Aço & Ferragens', contato_nome: 'Juliana Castro', telefone: '(11) 97777-6666', email: 'corporativo@gerdau.com.br' }
          ])
        });
      }

      if (url.includes('rh_modelos_admissao')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'm-1', ordem: 1, nome: '1. Relação de Documentos para Registro', descricao: 'RG, CPF, CTPS, Residência', ativo: true },
            { id: 'm-2', ordem: 2, nome: '2. Autodeclaração Étnico-Racial', descricao: 'eSocial', ativo: true },
            { id: 'm-3', ordem: 3, nome: '3. Ficha de Registro', descricao: 'Dados cadastrais', ativo: true },
            { id: 'm-4', ordem: 4, nome: '4. Guia & ASO Admissional', descricao: 'Exame de aptidão', ativo: true }
          ])
        });
      }

      if (url.includes('rh_admissao_convites')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'conv-1',
              nome_destinatario: 'Carlos Eduardo Oliveira',
              cpf: '345.678.901-22',
              cargo: 'Encarregado de Obras',
              obra: 'Residencial Horizon Tower',
              etapa_atual: 1,
              status: 'em_cadastro',
              created_at: '2026-08-18T10:00:00Z',
              expires_at: '2026-08-25T23:59:59Z',
              matricula: 'MAT-2026-089',
              documentos: [
                { id: 'd-1', modelo_id: 'm-1', item_id: 'item-rg', nome: 'RG_Carlos_FrenteVerso.pdf', status: 'aprovado', modelo: { id: 'm-1', ordem: 1, nome: 'Documentos Pessoais' } },
                { id: 'd-2', modelo_id: 'm-1', item_id: 'item-cpf', nome: 'CPF_Digital.pdf', status: 'aprovado', modelo: { id: 'm-1', ordem: 1, nome: 'Documentos Pessoais' } },
                { id: 'd-3', modelo_id: 'm-1', item_id: 'item-comp', nome: 'Comprovante_Residencia.jpg', status: 'pendente', modelo: { id: 'm-1', ordem: 1, nome: 'Documentos Pessoais' } }
              ]
            }
          ])
        });
      }

      if (url.includes('funcionarios')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'func-1', nome: 'Antônio Ferreira Silva', cpf: '123.456.789-00', matricula: 'MAT-2025-012', cargo: 'Mestre de Obras Geral', data_admissao: '2025-02-10', status: 'Ativo', email: 'antonio.mestre@construtora.com.br' },
            { id: 'func-2', nome: 'Beatriz Almeida Costa', cpf: '987.654.321-11', matricula: 'MAT-2025-045', cargo: 'Engenheira Residente', data_admissao: '2025-05-15', status: 'Ativo', email: 'beatriz.eng@construtora.com.br' }
          ])
        });
      }

      // Default fallback
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  async function injectAuth(page: any) {
    await page.goto('/login');
    await page.evaluate(({ user, apps }: { user: any; apps: any }) => {
      localStorage.setItem('colaborador_sessao', JSON.stringify(user));
      localStorage.setItem('apps_autorizados_cache', JSON.stringify({ apps, ts: Date.now() }));
      localStorage.setItem('perfil_ativo', 'admin_geral');
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    }, { user: adminUser, apps: authorizedApps });
  }

  test('00 - Login do Portal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/00_tela_login.png' });
  });

  test('01 - Dashboard Geral', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/01_dashboard_geral.png' });
  });

  test('02 - Gestão de Obras', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/obras');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/02_obras_gestao.png' });
  });

  test('03 - Relatório Diário de Obra (RDO)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/rdo');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/03_rdo_diario_obra.png' });
  });

  test('04 - Suprimentos em Kanban', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/suprimentos');
    await page.waitForTimeout(1500);
    const abrirBtn = page.getByText('ABRIR QUADRO');
    if (await abrirBtn.isVisible()) {
      await abrirBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'screenshots/04_suprimentos_kanban.png' });
  });

  test('05 - Financeiro & Fornecedores', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/financeiro');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/05_financeiro_fornecedores.png' });
  });

  test('06 - RH & Esteira de Admissão', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectAuth(page);
    await page.goto('/rh');
    await page.waitForTimeout(2000);
    const candBtn = page.getByText('Carlos Eduardo Oliveira');
    if (await candBtn.isVisible()) {
      await candBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'screenshots/06_rh_painel_admissao.png' });
  });

  test('07 - Portal do Candidato Mobile (iPhone 14)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admissao/demo-candidato-token');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/07_admissao_mobile_candidato.png' });
  });
});
