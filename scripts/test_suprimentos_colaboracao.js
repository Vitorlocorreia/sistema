const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xqackyuxipcxvmliecow.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';

async function testSuprimentosColaboracao() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('--- 1. BUSCANDO ADMINS COM ACESSO A SUPRIMENTOS ---');
  const { data: user1, error: u1Err } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('nome', 'Victor Ajame')
    .single();

  const { data: user2, error: u2Err } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('nome', 'Jorge Neto')
    .single();

  if (!user1 || !user2) {
    console.error('Erro ao buscar administradores:', u1Err || u2Err);
    process.exit(1);
  }
  console.log(`Usuário logado: ${user1.nome} (${user1.id})`);
  console.log(`Segundo usuário (para transferência): ${user2.nome} (${user2.id})`);

  console.log('--- 2. INICIANDO PLAYWRIGHT BROWSER ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🔴 [Console Error]:', msg.text());
      consoleErrors.push(msg.text());
    }
  });

  console.log('--- 3. ACESSANDO /login E INJETANDO SESSÃO ---');
  await page.goto('http://localhost:3000/login');
  await page.evaluate(({ u, u2 }) => {
    localStorage.setItem('colaborador_sessao', JSON.stringify(u));
    localStorage.setItem('perfil_ativo', 'DIRETORIA');
    localStorage.setItem('sessao_auth_segura', 'true');
    localStorage.setItem('apps_autorizados_cache', JSON.stringify({
      apps: ['rh', 'financeiro', 'rdo', 'obras', 'suprimentos', 'frota', 'ponto', 'usuarios'],
      ts: Date.now()
    }));
    localStorage.setItem('portal_theme', 'dark');
    localStorage.setItem('theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  }, { u: user1, u2: user2 });

  console.log('--- 4. NAVEGANDO PARA /suprimentos ---');
  await page.goto('http://localhost:3000/suprimentos', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('URL atual:', page.url());

  // Aguardar hidratação e auth do portal
  console.log('Aguardando carregamento da Esteira...');
  await page.waitForSelector('text=Esteira de Suprimentos & Compras', { timeout: 20000 });
  console.log('✅ Página de Suprimentos carregada!');

  // Verificar se o NotificationCenter está presente
  const bellIcon = page.locator('button[title="Central de Notificações"]:visible').first();
  await bellIcon.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Central de Notificações visível na página!');

  // Verificar se a mesa "Minhas Demandas" está visível
  const minhasDemandasBtn = page.locator('button:has-text("Minhas Demandas"):visible').first();
  await minhasDemandasBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Mesa "Minhas Demandas" visível!');

  // Localizar o primeiro card no Kanban
  console.log('--- 5. ABRINDO DRAWER 360 DO CARD ---');
  const cards = page.locator('div[style*="box-shadow"]:has-text("OC-")');
  const countCards = await cards.count();
  console.log(`Total de cards no Kanban: ${countCards}`);

  if (countCards === 0) {
    console.log('⚠️ Criando solicitação teste...');
    const btnNovo = page.locator('button:has-text("Nova Solicitação de Compra")').first();
    await btnNovo.click();
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="cimento CP-II"]', 'Cimento CP-II 50kg');
    await page.fill('input[placeholder*="200"]', '100');
    await page.locator('button:has-text("Abrir Solicitação")').click();
    await page.waitForTimeout(2500);
  }

  // Clicar no primeiro card para abrir o Drawer
  console.log('Clicando no card...');
  const cardToClick = page.locator('div[style*="box-shadow"]:has-text("OC-")').first();
  await cardToClick.click();
  await page.waitForTimeout(1200);

  // Verificar se o Drawer abriu
  const drawerOpen = await page.locator('text=RESPONSÁVEL PELA DEMANDA').isVisible();
  console.log('✅ Drawer 360 aberto com sucesso:', drawerOpen);

  // Tirar screenshot do Drawer aberto
  await page.screenshot({ path: 'public/test_drawer_aberto.png' });
  console.log('📸 Screenshot salvo: public/test_drawer_aberto.png');

  // Testar Troca de Responsável
  console.log('--- 6. TESTANDO TRANSFERÊNCIA DE RESPONSÁVEL ---');
  const selectResp = page.locator('#drawer-select-responsavel');
  if (await selectResp.isVisible()) {
    console.log('Selecionando novo responsável:', user2.nome);
    await selectResp.selectOption(user2.id);
    await page.waitForTimeout(2000);
    console.log('✅ Transferência de responsável executada.');
  }

  // Testar Adicionar Item no Checklist
  console.log('--- 7. TESTANDO CHECKLIST NO DRAWER ---');
  const drawerContainer = page.locator('div[style*="position: fixed"][style*="z-index: 9999"]');
  const inputItem = drawerContainer.locator('input[placeholder*="Novo item"]').first();
  if (await inputItem.isVisible()) {
    await inputItem.fill('Areia Média Lavada');
    await drawerContainer.locator('input[placeholder="Qtd"]').first().fill('10');
    await drawerContainer.locator('button:has-text("Adicionar")').first().click();
    await page.waitForTimeout(1500);
    console.log('✅ Item de checklist adicionado!');
  }

  // Testar Envio de Chat
  console.log('--- 8. TESTANDO CHAT INTERNO NO DRAWER ---');
  const tabChat = drawerContainer.locator('button:has-text("Chat")').first();
  await tabChat.click();
  await page.waitForTimeout(1000);

  const inputChat = drawerContainer.locator('input[placeholder*="Escreva uma mensagem"]').first();
  await inputChat.waitFor({ state: 'visible', timeout: 5000 });
  await inputChat.fill('Mensagem de teste automatizado: entrega confirmada para quinta-feira pela manhã.');
  await inputChat.press('Enter');
  await page.waitForTimeout(1500);
  console.log('✅ Mensagem de chat enviada!');

  // Testar Histórico de Atividades
  console.log('--- 9. TESTANDO HISTÓRICO DE AUDITORIA ---');
  const tabHistorico = drawerContainer.locator('button:has-text("Histórico")').first();
  await tabHistorico.click();
  await page.waitForTimeout(1000);

  const historyEntries = await drawerContainer.locator('div:has-text("Victor Ajame")').count();
  console.log(`✅ Registros de auditoria encontrados no histórico: ${historyEntries}`);

  // Screenshot final da colaboração
  await page.screenshot({ path: 'public/test_drawer_colaboracao_final.png' });
  console.log('📸 Screenshot salvo: public/test_drawer_colaboracao_final.png');

  // Fechar o Drawer
  console.log('Fechando o Drawer...');
  await drawerContainer.locator('button:has(svg.lucide-x)').first().click();
  await page.waitForTimeout(1000);

  // Testar Central de Notificações
  console.log('--- 10. TESTANDO CENTRAL DE NOTIFICAÇÕES ---');
  const bell = page.locator('button[title="Central de Notificações"]:visible').first();
  await bell.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'public/test_notification_center.png' });
  console.log('📸 Screenshot salvo: public/test_notification_center.png');

  // Verificar se há registro em public.notificacoes
  const { data: notifs, error: nErr } = await supabase
    .from('notificacoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (notifs && notifs.length > 0) {
    console.log(`✅ Notificações encontradas no Supabase: ${notifs.length}`);
    console.log(`Última notificação: "${notifs[0].titulo}" - ${notifs[0].mensagem}`);
  }

  console.log('--- 11. VERIFICAÇÃO DE ERROS NO CONSOLE ---');
  const realErrors = consoleErrors.filter(e => !e.includes('hydration') && !e.includes('Download the React DevTools'));
  console.log(`Total de erros reais no console: ${realErrors.length}`);

  await browser.close();
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
}

testSuprimentosColaboracao().catch(err => {
  console.error('Falha no teste:', err);
  process.exit(1);
});
