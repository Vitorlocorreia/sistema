# Manual de uso — Portal da Construtora

## 1. Objetivo do sistema

O Portal da Construtora centraliza a operação da empresa em módulos integrados:

- Gestão de obras, galerias e indicadores de custo, receita e lucro.
- Boletins de medição e faturamentos vinculados às obras.
- RDO (relatório diário de obra), ocorrências, atividades e equipamentos.
- Suprimentos com quadros editáveis no estilo Trello.
- Financeiro com fornecedores, contas, previsões, lançamentos e pagamentos.
- Gestão de RH e admissão digital em quatro etapas.
- Frota e ponto, conforme as permissões liberadas para cada usuário.

O acesso é controlado por cargo e por módulo. O Administrador Geral deve revisar os cargos e permissões antes do início da operação.

## 2. Primeiro acesso

1. Abra a URL oficial do portal.
2. Informe e-mail e senha fornecidos pelo administrador.
3. Não compartilhe sua senha.
4. Ao trocar de computador, encerre a sessão anterior.
5. Se o login apresentar erro de limite de e-mail ou autenticação, o administrador deve verificar o usuário no Supabase Auth e as variáveis de ambiente da aplicação.

### Perfis principais

- **Administrador Geral:** configura cargos, permissões, empresas e aprova solicitações de acesso.
- **RH / Admissões:** cadastra candidatos, acompanha documentos, devolve pendências e aprova admissões.
- **Administrador de Empresa:** administra os dados da empresa autorizada.
- **Financeiro:** controla fornecedores, contas, lançamentos, aprovações e pagamentos.
- **Obras:** acompanha obras, medições, faturamentos, galerias e indicadores.
- **Operador:** executa as tarefas liberadas pelo administrador.

## 3. Administrador Geral

No módulo de usuários e acessos, o Administrador Geral pode:

1. Criar um cargo personalizado.
2. Definir o nome e a descrição do cargo.
3. Selecionar os módulos disponíveis para o cargo.
4. Configurar permissões específicas.
5. Aprovar ou rejeitar solicitações de acesso.
6. Editar usuários e alterar o cargo atribuído.

Recomenda-se criar cargos com o menor conjunto de permissões necessário. O cargo administrador geral deve ser reservado a poucas pessoas.

## 4. Gestão de Obras

### Criar uma obra

1. Acesse **Obras**.
2. Clique em **Nova obra**.
3. Informe nome, cliente, endereço, valor do contrato, datas e status.
4. Salve o cadastro.

### Métricas, custos e lucro

Dentro da obra, a área de métricas consolida:

- Valor contratado.
- Custos pagos.
- Custos em aberto.
- Receita recebida.
- Valor medido.
- Valor faturado.
- Resultado econômico da obra.

Os valores dependem de lançamentos corretos no Financeiro e de medições aprovadas.

### Boletim de medição

1. Abra a obra.
2. Na seção **Métricas, custos e medições**, clique em **Nova medição**.
3. Informe período, valor medido, percentual executado e observações.
4. Salve como rascunho.
5. Avance para **Aprovada** quando conferida.
6. Avance para **Faturada** quando o faturamento estiver registrado.

### Galeria de obras

1. Crie uma pasta dentro da obra.
2. Informe o nome da pasta.
3. Opcionalmente, vincule a URL de uma pasta do Google Drive.
4. Organize subpastas por etapa, ambiente, data ou tipo de evidência.
5. Use a galeria para localizar fotos e documentos da obra.

## 5. RDO — Relatório Diário de Obra

1. Acesse **RDO**.
2. Crie um novo relatório com data, obra e responsável.
3. Registre atividades executadas, equipe, equipamentos e condições do dia.
4. Cadastre ocorrências com descrição e providência.
5. Anexe fotos e documentos quando necessário.
6. Salve como rascunho.
7. Revise e aprove o relatório.

Um RDO aprovado deve representar fielmente o que ocorreu na obra. Evite editar informações depois da aprovação sem registrar a justificativa.

## 6. Suprimentos — quadros editáveis

O módulo de Suprimentos possui quadros, colunas e cartões editáveis.

### Criar um quadro

1. Acesse **Suprimentos**.
2. Clique em **Novo quadro**.
3. Informe o nome do processo, por exemplo: Compras, Contratações ou Entregas.

### Editar colunas

1. Selecione o quadro.
2. Crie uma coluna ou edite uma coluna existente.
3. Reordene as colunas conforme o fluxo da empresa.
4. Arquive o quadro quando ele não for mais utilizado.

### Trabalhar com cartões

Cada cartão pode representar uma compra, fornecedor ou tarefa. Informe título, descrição, prioridade, responsável e prazo. Arraste o cartão entre colunas para atualizar o andamento. O histórico de edição registra as alterações relevantes.

## 7. Financeiro

### Cadastro de fornecedor

1. Acesse **Financeiro > Fornecedores**.
2. Clique em **Novo fornecedor**.
3. Preencha os dados disponíveis.
4. Marque cada campo como **possui** ou **não possui** quando essa informação fizer parte do quadro.
5. Salve o cadastro.

Não é mais necessário trabalhar com prazo fixo de pagamento do fornecedor. O lançamento deve registrar a previsão e a condição real acordada.

### Lançamento financeiro

Informe fornecedor, obra, tipo, valor, data de previsão, observações e se o pagamento foi antecipado. Use os status:

1. **Lançado:** registro criado.
2. **Aguardando aprovação:** aguardando conferência.
3. **Liberado / OK / A pagar:** aprovado para pagamento.
4. **Pago:** pagamento concluído.

Utilize os filtros por data para localizar previsões, lançamentos e pagamentos.

## 8. Gestão de RH e admissão digital

O processo possui quatro etapas configuradas com os modelos oficiais enviados pelo RH:

1. Relação de documentos para registro.
2. Autodeclaração étnico-racial.
3. Ficha de registro.
4. Guia de encaminhamento para exame.

### Gerar um convite

1. Acesse **RH**.
2. Clique em **Gerar link de admissão**.
3. Preencha o pré-cadastro: nome, CPF, matrícula, contato, cargo, obra e previsão de admissão.
4. Defina a validade do link em horas.
5. Gere e copie o link.
6. Envie o link ao candidato por um canal seguro.

O convite é temporário e pode ser revogado ou regenerado. O código do convite pode ser copiado novamente no painel do cadastro selecionado.

### Acompanhar candidatos em cadastro

1. A lista lateral **Em cadastro** mostra os nomes e o andamento de cada pessoa.
2. Selecione um candidato para abrir o painel de conferência.
3. Use as quatro pastas laterais para navegar entre as etapas.
4. Confira cada item do checklist.
5. Abra o arquivo recebido para análise.
6. Clique em **Aprovar** quando estiver correto.
7. Clique em **Negar** para devolver o documento e informe uma justificativa clara.

Ao devolver um documento, o candidato verá o status **Devolvido**, a justificativa e poderá anexar uma nova versão. O RH acompanha novamente o item até a aprovação.

### Aprovar a admissão

Quando todos os documentos obrigatórios estiverem aprovados:

1. Clique em **Aprovar cadastro**.
2. Confirme a operação.
3. O candidato será transferido para **Funcionários aprovados**.
4. Os documentos passam a integrar o arquivo permanente do funcionário.

### Arquivo de funcionários aprovados

O arquivo de funcionários é apenas para consulta e guarda documental. Ao abrir um funcionário, as pastas das quatro etapas ficam disponíveis no mesmo painel. É possível pesquisar e abrir os arquivos arquivados.

## 9. Dados, segurança e boas práticas

- Não use dados fictícios em produção.
- Não envie senhas por grupos ou mensagens abertas.
- Use usuários individuais, nunca uma conta compartilhada.
- Revogue convites que não forem mais necessários.
- Verifique o destinatário antes de enviar documentos de RH.
- Faça backup e teste de restauração antes do uso diário.
- Revise as políticas RLS do Supabase antes de expor o sistema publicamente.
- Habilite proteção contra senhas vazadas no Supabase Auth.
- Não mantenha senhas em texto puro na tabela legada de colaboradores.

## 10. Checklist antes da produção

- [ ] Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no ambiente de execução.
- [ ] Criar os usuários reais no Supabase Auth.
- [ ] Migrar o login legado para autenticação segura.
- [ ] Criar o usuário real do RH.
- [ ] Revisar cargos e permissões.
- [ ] Confirmar políticas RLS das tabelas públicas.
- [ ] Revisar políticas de Storage e bucket de documentos.
- [ ] Configurar domínio e HTTPS.
- [ ] Validar envio de e-mail e links de admissão.
- [ ] Fazer teste completo: convite, upload, devolução, correção e aprovação.
- [ ] Configurar backup e rotina de suporte.
- [ ] Treinar os responsáveis de RH, Financeiro e Obras.

## 11. Situação atual do projeto

O sistema está adequado para demonstração e piloto controlado. O código está publicado no branch `agent/rh-admissao-workflow` do GitHub e o banco foi limpo dos dados de povoamento, mantendo apenas os logins existentes e os modelos oficiais do RH.

Para declarar o sistema pronto para operação real, ainda é obrigatório concluir o checklist de segurança, principalmente autenticação segura, variáveis de ambiente, RLS e criação do usuário real do RH.

