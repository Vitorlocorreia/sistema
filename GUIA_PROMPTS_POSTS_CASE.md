# 📋 Guia de Prompts para Geração de Posts (Case Study & Portfólio)

> **Instruções de Uso:** Copie o bloco de prompt abaixo e envie diretamente para o ChatGPT, Claude ou qualquer IA de sua preferência. O documento já contém o contexto técnico, o problema de negócio resolvido, o tom de voz e a **tabela completa de mapeamento de imagens** para a IA saber exatamente o que colocar em cada slide ou post.

---

```markdown
# PROMPT PARA A IA: Criação de Conteúdo para Redes Sociais (Case Study de Engenharia de Software & Construtech)

Você é um estrategista de conteúdo sênior e copywriter B2B especializado no mercado de tecnologia, SaaS e construção civil.
Seu objetivo é transformar as informações e imagens abaixo em postagens de alto impacto e autoridade para o **LinkedIn**, **Carrossel do Instagram** e **Roteiro de Vídeo Demo**.

---

## 🏢 CONTEXTO DO PROJETO & SISTEMA DESENVOLVIDO

- **Nome da Solução:** Portal da Construtora (ERP & Hub Operacional Construtech)
- **Autor / Desenvolvedor:** Vitor Correia
- **Proposta de Valor:** Plataforma unificada que eliminou mais de 4 softwares desconectados (Trello, FacePonto, Escout, Infleet e planilhas paralelas de Excel), centralizando finanças, canteiro de obras, compras, frota e RH em um ambiente único, seguro e com governança multi-tenant.
- **Stack Tecnológica:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth com RLS, Storage), Playwright.
- **Diferenciais Chave:**
  1. Experiência Dark Mode moderna e minimalista (Glassmorphism, foco em usabilidade e produtividade).
  2. Multi-Tenant nativo: controle por Matriz, Filiais e SPEs (Sociedades de Propósito Específico).
  3. Governança Granular: Matriz de permissões por cargo (Admin Geral, Engenheiro, Operador Financeiro, RH).
  4. Auto-Admissão Mobile: link onde o próprio candidato envia seus dados e fotos dos documentos sem burocracia.
  5. RDO (Diário de Obra) em Tempo Real: registro de clima, efetivo, equipamentos, ocorrências e fotos do canteiro.

---

## 🖼️ TABELA OFICIAL DE MAPEAMENTO DAS IMAGENS (PRINTS DO SISTEMA)

Use esta tabela como referência obrigatória para citar ou descrever os recursos em cada imagem:

| Imagem / Arquivo | Módulo / Tela | O que a Imagem Mostra | Benefício de Negócio / Dor Solvida |
|---|---|---|---|
| **00_tela_login.png** | **Tela de Login** | Interface dark com partículas animadas, autenticação segura via Supabase Auth e aba de solicitação de acesso. | Primeira impressão premium; controle seguro de acesso por perfil corporativo. |
| **01_dashboard_geral.png** | **Hub Principal (Carteira de Apps)** | Sidebar lateral com os módulos integrados (Financeiro, RH, Ponto, Suprimentos, RDO, Frota) e status dos sistemas. | Elimina o caos de ferramentas desconectadas; acesso em 1 clique a toda a construtora. |
| **02_obras_gestao.png** | **Gestão de Obras** | Visão geral dos empreendimentos (*Horizon Tower*, *Prime Plaza*), progresso físico (%), prazos e valores contratuais. | Previsibilidade de cronograma e acompanhamento executivo para diretoria e investidores. |
| **03_rdo_diario_obra.png** | **Diário de Obra (RDO)** | Registro diário com condições climáticas (Sol/Chuva), contagem de mão de obra própria/terceira, máquinas e galeria de fotos. | Segurança jurídica e conformidade técnica; histórico diário rastreável do canteiro. |
| **04_suprimentos_kanban.png** | **Suprimentos & Compras** | Pipeline Kanban de pedidos (Requisição ➔ Em Cotação ➔ Aprovado ➔ Entregue na Obra) com valores e etiquetas. | Substitui quadros manuais do Trello; evita atrasos no envio de materiais para a obra. |
| **05_financeiro_01_historico_fluxo.png** | **Financeiro: Histórico & Fluxo** | Tabela com lançamentos (`REC-02019`, `PAG-01044`), totais pagos/recebidos, status (*LIBERADO/OK*, *AGUARDANDO APROVAÇÃO*), dados bancários e PIX. | Controle rigoroso de fluxo de caixa; histórico de auditoria e prestação de contas. |
| **05_financeiro_02_empresas.png** | **Financeiro: Empresas (Multi-Tenant)** | Cards da Matriz e das SPEs (*SPE Horizon*, *SPE Prime Plaza*), com cores corporativas, CNPJ e contagem de usuários. | Separação contábil e fiscal de cada empreendimento imobiliário sem misturar finanças. |
| **05_financeiro_03_fornecedores.png** | **Financeiro: Fornecedores** | Cadastro de fornecedores (*Polimix*, *Gerdau*, *Locar*) com categoria, dados bancários, chave PIX em destaque e saldos abertos. | Agilidade nas cotações e pagamentos; centralização de contatos e chaves PIX validadas. |
| **05_financeiro_04_lancar_conta.png** | **Financeiro: Lançar Conta** | Formulário de contas a pagar/receber com vinculação a obra/empresa, tipo de recorrência e anexo de notas fiscais/boletos. | Fim de notas fiscais perdidas em e-mails; rastreabilidade de comprovantes no Supabase Storage. |
| **05_financeiro_05_usuarios_acessos.png** | **Financeiro: Usuários & Permissões** | Matriz de governança por perfil de colaborador com toggles de permissões para aprovação, visualização e limites de valor. | Governança corporativa: engenheiro só vê sua obra, operador lança e admin aprova. |
| **06_rh_painel_admissao.png** | **Gestão de RH: Painel de Admissões** | Funil de contratação de colaboradores para os canteiros, com status de documentos, exames admissionais e aprovação. | Agilidade na contratação de equipes de obra; redução de turnover e tempo de admissão. |
| **07_admissao_mobile_candidato.png** | **Gestão de RH: Link Mobile do Candidato** | Tela mobile responsiva onde o próprio trabalhador preenche seus dados e envia fotos dos documentos (RG, CNH, CTPS). | Elimina formulários físicos em papel e retrabalho de digitação pelo time de escritório. |

---

## 🎯 SEUS ENTREGÁVEIS (O QUE VOCÊ DEVE GERAR):

### Entregável 1: Post Longo para o LinkedIn (Foco em Autoridade & Engenharia)
- **Estrutura:**
  - **Hook Poderoso:** Comece questionando o problema de gerenciar obras e finanças em 5 softwares diferentes + planilhas que quebram.
  - **A Dor Real do Setor:** Descreva o canteiro de obras desintegrado do escritório financeiro.
  - **A Solução Construída:** Explique como foi arquitetado o sistema em Next.js e Supabase.
  - **Destaques dos Módulos:** Cite o Financeiro Multi-Tenant, o RDO digital e o RH com auto-admissão mobile.
  - **Resultados & Impacto:** Centralização, redução de custos de SaaS, compliance e velocidade de tomada de decisão.
  - **Chamada para Ação (CTA):** Convite para conexões, feedbacks ou troca de ideias sobre arquitetura de software.

### Entregável 2: Carrossel de 10 Slides (Para LinkedIn Document / PDF ou Instagram)
- Gere o conteúdo de cada um dos 10 slides, indicando qual imagem da tabela usar de fundo ou exemplo:
  - **Slide 1 (Capa):** Título magnético sobre como centralizar a gestão de uma construtora.
  - **Slide 2 (O Problema):** O pesadelo do software fragmentado.
  - **Slide 3 (Hub Geral):** Apresentação do portal (Usa `01_dashboard_geral.png`).
  - **Slide 4 (Financeiro & Fluxo de Caixa):** Gestão de lançamentos e aprovações (Usa `05_financeiro_01_historico_fluxo.png`).
  - **Slide 5 (Multi-Tenant & SPEs):** Separação de empresas e obras (Usa `05_financeiro_02_empresas.png` e `05_financeiro_03_fornecedores.png`).
  - **Slide 6 (Governança & Permissões):** Quem pode ver o quê (Usa `05_financeiro_05_usuarios_acessos.png`).
  - **Slide 7 (Canteiro em Tempo Real - RDO):** O Diário de Obra na prática (Usa `03_rdo_diario_obra.png`).
  - **Slide 8 (Suprimentos Kanban):** Do pedido à entrega no canteiro (Usa `04_suprimentos_kanban.png`).
  - **Slide 9 (RH & Auto-Admissão Mobile):** Contratação ágil na ponta (Usa `06_rh_painel_admissao.png` e `07_admissao_mobile_candidato.png`).
  - **Slide 10 (Conclusão & CTA):** Resumo da stack (Next.js + Supabase) e chamada para contato.

### Entregável 3: Roteiro de Vídeo Demo (Reels / Shorts / Loom de 60 segundos)
- Roteiro com marcação de tempo (ex: `00:00 - 00:10`), o que falar (áudio) e o que mostrar na tela (print/gravação).
```
