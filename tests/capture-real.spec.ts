import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Captura com Login Real e Banco de Dados Oficial', () => {

  test('Capturar todas as telas com usuário real', async ({ page }) => {
    // Aumenta o timeout para garantir carregamento de todas as páginas
    test.setTimeout(120000);

    const outputDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Acessa a tela de Login
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 2. Tira print da tela de Login
    await page.screenshot({ path: 'screenshots/00_tela_login.png' });

    // 3. Preenche as credenciais reais
    await page.fill('input[type="email"]', 'vitor@empresa.com');
    await page.fill('input[type="password"]', 'Vitor@2024');
    
    // Clica no botão de entrar
    await page.click('button[type="submit"]');

    // Aguarda redirecionamento para o dashboard principal
    await page.waitForURL('**/', { timeout: 15000 }).catch(async () => {
      console.log('Tentando rota alternativa pós login...');
    });
    await page.waitForTimeout(3000);

    // 4. Captura 01 - Dashboard Geral
    console.log('Capturando Dashboard...');
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/01_dashboard_geral.png', fullPage: false });

    // 5. Captura 02 - Obras
    console.log('Capturando Obras...');
    await page.goto('/obras');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/02_obras_gestao.png', fullPage: false });

    // 6. Captura 03 - RDO
    console.log('Capturando RDO...');
    await page.goto('/rdo');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/03_rdo_diario_obra.png', fullPage: false });

    // 7. Captura 04 - Suprimentos
    console.log('Capturando Suprimentos...');
    await page.goto('/suprimentos');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/04_suprimentos_kanban.png', fullPage: false });

    // 8. Captura 05 - Financeiro
    console.log('Capturando Financeiro...');
    await page.goto('/financeiro');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/05_financeiro_fornecedores.png', fullPage: false });

    // 9. Captura 06 - RH & Admissão
    console.log('Capturando RH...');
    await page.goto('/rh');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/06_rh_painel_admissao.png', fullPage: false });

    // 10. Captura 07 - Frota
    console.log('Capturando Frota...');
    await page.goto('/frota');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/07_frota.png', fullPage: false });

    // 11. Captura 08 - Ponto
    console.log('Capturando Ponto...');
    await page.goto('/ponto');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/08_ponto.png', fullPage: false });

    console.log('Todas as telas foram capturadas com sucesso!');
  });
});
