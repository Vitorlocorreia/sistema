# 🗺️ Mapa Completo do Sistema, Telas, Fluxos e Diretrizes de UI/UX

> **Objetivo deste documento:** Servir como o guia definitivo de arquitetura de informação, jornadas de usuário, matriz de permissões e especificações técnicas para embasar a etapa de **UI/UX Design, Redesign e Prototipação no Figma**.

---

## 1. Visão Geral da Arquitetura do Sistema

O sistema é um **ERP / Portal Operacional e Financeiro Multi-Tenant e Multi-Obra** voltado para Construtoras e Incorporadoras. Ele é dividido em duas camadas principais:

1. **Camada Pública / Autenticação:** Login com partículas interativas, recuperação de senha, redefinição com Supabase Auth e formulário público de auto-admissão de colaboradores.
2. **Camada Autenticada (Portal / Carteira de Apps):** Layout lateral unificado com *drag & drop* de aplicativos, troca de tema claro/escuro, multi-empresa e matriz dinâmica de permissões por cargo e por obra.

```mermaid
graph TD
    A[Visitante / Usuário] --> B{Autenticado?}
    B -- Não --> C[Tela de Login / Solicitar / Recuperar]
    B -- Link Externo --> D[Formulário de Auto-Admissão /admissao/:token]
    C -- Recuperar Senha --> E[E-mail com Token]
    E --> F[Tela de Redefinir Senha /redefinir-senha]
    F --> C
    
    B -- Sim --> G[Portal Master Layout /(portal)]
    G --> H[Dashboard Geral /]
    G --> I[1. Módulo Financeiro /financeiro]
    G --> J[2. Módulo RH & Admissões /rh]
    G --> K[3. Módulo Suprimentos /suprimentos]
    G --> L[4. Módulo Obras & Galerias /obras]
    G --> M[5. Módulo RDO - Diário de Obra /rdo]
    G --> N[6. Módulo Gestão de Frotas /frota]
    G --> O[7. Módulo Ponto Eletrônico /ponto]
```

---

## 2. Mapa Detalhado de Telas e Submódulos

---

### 🌐 ÁREA PÚBLICA & AUTENTICAÇÃO

#### 2.1. Tela de Login (`/login`)
* **Propósito:** Ponto de entrada com animação de partículas em canvas, efeito dark moderno e 3 abas de navegação.
* **Componentes & Abas:**
  1. **Aba "Entrar":** E-mail, senha, alternar visualização de senha, botão de login e atalho *"Esqueceu a senha?"*.
  2. **Aba "Solicitar Acesso":** Nome completo, e-mail corporativo, senha desejada e justificativa/mensagem de acesso.
  3. **Aba "Recuperar Senha":** Campo de e-mail e botão para envio automático de link de redefinição via Supabase Auth.
* **Fluxos & Regras:**
  * Login com fallback inteligente (Supabase Auth Seguro + Sincronização de perfil na tabela `colaboradores`).
  * Interceptador automático de links de recuperação com hash `#access_token` ou PKCE `?code`.

#### 2.2. Tela de Redefinição de Senha (`/redefinir-senha`)
* **Propósito:** Formulário seguro de definição de nova senha acionado pelo link do e-mail.
* **Componentes:**
  * Validador de token e sessão ativa do Supabase.
  * Inputs: Nova Senha e Confirmação de Senha (com verificação de força e mínimo de 6 caracteres).
  * Feedback visual de sucesso e redirecionamento direto para o login.

#### 2.3. Formulário Público de Auto-Admissão (`/admissao/[token]`)
* **Propósito:** Link gerado pelo RH para o novo funcionário preencher seus dados e enviar documentos antes do primeiro dia.
* **Componentes:**
  * Formulário passo a passo: Dados Pessoais (CPF, RG, PIS/PASEP, CTPS, Título, Reservista), Endereço, Dependentes, Dados Bancários/PIX e Upload de Documentos/Comprovantes em PDF/Imagem.

---

### 🏢 PORTAL PRINCIPAL (`/(portal)`)

#### 2.4. Layout Principal & Carteira de Apps (`/(portal)/layout.tsx`)
* **Propósito:** Header responsivo, barra lateral retrátil e carteira de aplicativos personalizada por usuário.
* **Componentes:**
  * **Seletor de Tema:** Alternância rápida entre Dark Mode (âmbar/zinc escuro) e Light Mode.
  * **Menu Lateral / Carteira:** Ícones coloridos dos módulos com reordenação via **Drag & Drop** salva no `localStorage`.
  * **Perfil do Usuário:** Foto/iniciais, nome, cargo com badge colorido e botão de logout.
  * **Auth Guard Otimista:** Leitura em 0ms do cache local com validação em segundo plano.

---

#### 2.5. Dashboard Geral Consolidado (`/(portal)/page.tsx`)
* **Propósito:** Painel executivo de controle com visão 360º de todas as obras, atividades e alertas.
* **Componentes:**
  * **KPI Cards:** Total de Obras Ativas, RDOs do Mês, Suprimentos Pendentes, Galeria de Fotos Recentes.
  * **Gráfico de Evolução:** Gráfico de linha/área mostrando avanço físico e relatórios diários.
  * **Feed de Fotos Recentes:** Timeline com fotos de evolução das obras filtradas por permissão de acesso.
  * **Tabela de Obras:** Lista de obras ativas com barra de progresso (%) e status de execução.

---

#### 2.6. Módulo Financeiro Multi-Empresa (`/(portal)/financeiro/page.tsx`)
* **Propósito:** O coração financeiro da construtora, suportando múltiplas empresas (SPEs), fornecedores centralizados e aprovação em cascata.
* **Sub-Abas:**
  1. **Dashboard & Métricas:**
     * Cards de Total Recebido, Total Pago, Saldo do Mês, Contas Vencidas e Previsão para os próximos 7 e 30 dias.
     * Gráfico comparativo de Entradas vs Saídas dos últimos 6 meses.
  2. **Histórico & Fluxo de Caixa (Principal):**
     * **Barra de Busca Inteligente:** Busca instantânea por descrição, obra, fornecedor ou código exato (`PAG-01770` / `1770`).
     * **Drawer de Filtros Avançados:**
       * **Faixa de Valor (R$):** Mínimo e Máximo + Chips rápidos (`Até R$ 1k`, `R$ 1k-5k`, `R$ 5k-20k`, `R$ 20k-50k`, `+ R$ 50k`).
       * **Filtro de Empresa:** Multi-tenant / seleção por empresa.
       * **Filtro de Fornecedor:** Lista de fornecedores centralizados.
       * **Filtro de Status:** Todos, Lançado, Bloqueado, Aguardando aprovação, Liberado/OK, A pagar, Pago Parcial, Pago, Paga S/NF, Negado.
       * **Filtro por Tipo de Data:** Previsão/Vencimento, Vencimento Real, Previsão de Pagamento, Pagamento Efetivo, Criação.
       * **Intervalo de Datas:** Data inicial e final.
       * **Ordenação:** Recentes, Antigos, Vencimento Próximo/Distante, Maior/Menor Valor, A-Z.
     * **Ações em Lote:** Seleção múltipla para alteração de status em lote (ex: aprovar 10 contas de uma vez).
     * **Exportação:** Exportação customizada em formato CSV/Excel.
     * **Modal de Edição & Histórico:** Registro de todas as negociações, alterações de valor, justificativas e upload/visualização de comprovantes.
     * **Modal de Pagamento Parcial:** Abatimento de parcelas parciais mantendo o saldo remanescente.
  3. **Lançar Contas:**
     * Cadastro individual ou em parcelas recorrentes (mensal/semanal).
     * Seleção de Empresa, Fornecedor (com cadastro rápido no modal), Obra, Categoria, Valor, Vencimento, Previsão, Observações e Anexo.
     * Configuração de **Conta Privada / Confidencial** com lista de usuários autorizados.
  4. **Empresas (Multi-Tenant / SPEs):**
     * Cadastro e gestão de empresas do grupo, CNPJ, razão social, nome fantasia e cor de identificação no grid.
  5. **Fornecedores Centralizados:**
     * Gestão de fornecedores PJ/PF, chave PIX em destaque, banco/agência/conta, categoria e endereço.
     * Card com resumo financeiro automático: **Total em Aberto** e **Total Pago**.
  6. **Medições & Obras:**
     * Vinculação de contratos, faturamento previsto e acompanhamento de boletins de medição por obra.
  7. **Usuários & Matriz de Permissões:**
     * Gestão de acessos: Administrador Geral, Admin da Empresa, Operador, Visualizador, RH.
     * Liberação granular: Pode Criar Empresas, Pode Criar Fornecedores, Pode Lançar, Pode Pagar, Pode Aprovar, Limite Máximo de Valor (R$) e Acesso a Obras Específicas.

---

#### 2.7. Módulo RH & Gestão de Colaboradores (`/(portal)/rh/page.tsx`)
* **Propósito:** Gestão de quadro de funcionários, admissões e links públicos.
* **Componentes:**
  * Lista de Colaboradores Ativos com filtros por cargo, obra e status.
  * Gerador de Link de Auto-Admissão com token único para envio por WhatsApp/E-mail.
  * Visualizador e aprovador de documentos enviados pelo candidato.
  * Matriz de permissões internas de RH.

---

#### 2.8. Módulo de Suprimentos & Compras (`/(portal)/suprimentos/page.tsx`)
* **Propósito:** Controle de solicitações de compra da obra até a entrega no canteiro.
* **Componentes:**
  * Kanban / Lista de Pedidos: Solicitado ➔ Em Cotação ➔ Aprovado ➔ Comprado ➔ Em Trânsito ➔ Entregue na Obra.
  * Vinculação direta com Obra e Centro de Custo.

---

#### 2.9. Módulo de Obras & Galerias Fotográficas (`/(portal)/obras/page.tsx`)
* **Propósito:** Painel de engenharia e arquivo fotográfico de evolução física.
* **Componentes:**
  * Cadastro de Obras, endereço, responsável técnico e percentual de evolução.
  * Pastas de Galerias: Fotos organizadas por data, etapa construtiva e pasta de medição.
  * Visualizador de fotos em alta resolução (Lightbox).

---

#### 2.10. Módulo RDO - Diário de Obra (`/(portal)/rdo/page.tsx`)
* **Propósito:** Emissão do Relatório Diário de Obra com validade jurídica e operacional.
* **Componentes:**
  * Condições Climáticas (Manhã, Tarde, Noite - Chuva/Sol/Impraticável).
  * Efetivo da Obra (Mão de obra própria e terceirizada por função).
  * Equipamentos em Operação / Parados.
  * Descrição detalhada das atividades executadas no dia.
  * Fotos de evidência do dia e campo para assinatura digital do Engenheiro Responsável.

---

#### 2.11. Módulos de Frota e Ponto (`/(portal)/frota` e `/(portal)/ponto`)
* **Frota:** Cadastro de veículos, manutenções preventivas, controle de combustível e motoristas.
* **Ponto:** Registro de folha de ponto e espelho de ponto eletrônico dos funcionários do canteiro.

---

## 3. Matriz de Cargos e Permissões (RBAC)

| Cargo | Acesso aos Módulos | Pode Lançar Contas? | Pode Aprovar Contas? | Pode Pagar Contas? | Acesso a Obras |
|---|---|:---:|:---:|:---:|---|
| **`admin_geral`** | Todos os 7 Apps | ✅ Sim | ✅ Sim | ✅ Sim (Sem Limite) | Todas as Obras |
| **`admin_empresa`** | Financeiro, RH, Suprimentos, Obras | ✅ Sim | ✅ Sim | ✅ Sim (Até o limite) | Obras da Empresa |
| **`operador`** | Apps liberados no cadastro | ✅ Sim | ❌ Não | ❌ Não | Obras Vinculadas |
| **`visualizador`** | Leitura apenas | ❌ Não | ❌ Não | ❌ Não | Obras Vinculadas |
| **`rh` / `rh_adm`** | RH, Ponto, Documentos | ❌ Não | ❌ Não | ❌ Não | Obras Vinculadas |

---

## 4. Guia de UI/UX, Design Tokens e Padrões Visuais

Para iniciar a fase de design no Figma, utilize a estrutura de tokens padronizada no código:

### 🎨 Paleta de Cores (Design Tokens):
* **Fundo Principal (Dark):** `#090A0E` / `#0B0C0E` (Preto grafite profundo).
* **Fundo dos Cards & Painéis:** `#12141C` / `#13151A` (Cinza carvão com borda sutil).
* **Bordas & Divisores:** `#222530` / `#272A37`.
* **Cor Primária / Destaque:** `#F59E0B` (Âmbar / Laranja Ouro Construtora) — usado em botões principais, status ativos e foco.
* **Cores Semânticas:**
  * 🟢 **Sucesso / Pago:** `#10B981` / `#34D399` (Emerald).
  * 🔴 **Erro / Vencido / Perigo:** `#EF4444` / `#F87171` (Red Coral).
  * 🔵 **Em Andamento / Info:** `#3B82F6` / `#60A5FA` (Blue).
  * 🟡 **Aguardando Aprovação:** `#F59E0B` (Amber).
* **Tipografia:**
  * Família: `Inter`, `-apple-system`, `BlinkMacSystemFont`, sans-serif.
  * Hierarquia:
    * `h1` (Títulos de Página): `18px - 22px`, font-weight `900`.
    * `h2` / `h3` (Seções e Cards): `13px - 15px`, font-weight `800`.
    * `body` / `labels`: `11px - 13px`, font-weight `500` - `700`.
    * `micro` / `tags`: `9px - 10px`, font-weight `800`, uppercase tracking `0.5px`.

---

## 5. Próximos Passos Sugeridos para a Fase de UI/UX:

1. **Design System no Figma:** Montar biblioteca com os componentes base (Botões, Inputs com máscara, Dropdown com chips rápidos, Badges de Status e Cards de KPIs).
2. **Refinamento do Fluxo de Aprovação Financeira:** Criar tela de aprovação rápida com visualização de comprovante lado a lado (*Split View*).
3. **App Mobile do RDO / Canteiro de Obras:** Versão compacta e rápida para o engenheiro preencher no celular mesmo offline ou com conexão 3G.
4. **Dashboard Executivo:** Layout com gráficos interativos e visão consolidada de fluxo de caixa projetado.
