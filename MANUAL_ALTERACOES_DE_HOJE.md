# Manual das alterações realizadas hoje

## 1. Ajuste visual do RH — Em cadastro

O painel **Em cadastro** foi reorganizado para facilitar a conferência dos candidatos:

- A coluna lateral ficou mais larga.
- Os nomes passaram a aparecer com mais espaço e melhor leitura.
- Cada candidato aparece em um cartão próprio.
- O status do candidato fica destacado logo abaixo do nome.
- A justificativa de devolução aparece no próprio cartão quando existir.
- O painel de documentos fica aberto ao lado da lista.
- A lista lateral não exibe mais o código/link do convite, evitando excesso de informação.

## 2. Código e link do convite

O código do convite continua disponível no painel do cadastro selecionado.

Para copiar novamente:

1. Clique no nome do candidato em **Em cadastro**.
2. No painel de detalhes, clique em **Copiar código/link do convite**.
3. Cole o link no canal seguro usado para falar com o candidato.

O código não fica mais misturado na lista lateral.

## 3. Organização das quatro etapas

Dentro do cadastro selecionado, as etapas ficam organizadas como pastas laterais:

1. Etapa 1.
2. Etapa 2.
3. Etapa 3.
4. Etapa 4.

Ao clicar em uma pasta, o RH visualiza o checklist e os arquivos somente daquela etapa. Isso deixa a conferência mais limpa e reduz a necessidade de rolagem horizontal.

## 4. Limpeza do banco de dados

Os registros fictícios usados para demonstração foram removidos das tabelas operacionais, incluindo:

- Obras.
- Funcionários.
- Fornecedores.
- Contas.
- Faturamentos.
- Suprimentos.
- Tarefas.
- RDO.
- Medições.
- Quadros e cartões.
- Convites de admissão.
- Empresas de teste.

O banco ficou sem dados de povoamento para começar a receber os dados reais do cliente.

## 5. O que foi preservado

Foram preservados:

- Os dois logins existentes.
- Os cargos e configurações de permissão existentes.
- Os quatro modelos oficiais do RH.
- A estrutura das tabelas e relacionamentos do sistema.
- O fluxo de admissão digital já implementado.

## 6. Novo login do RH

O usuário RH ainda não foi criado automaticamente. O motivo é que a tabela legada de colaboradores possui senha armazenada diretamente, enquanto o uso real deve ser feito pelo **Supabase Auth**, com senha protegida e controle de sessão.

Para criar o usuário RH corretamente:

1. Abrir o Supabase Dashboard.
2. Acessar **Authentication > Users**.
3. Criar um usuário com o e-mail real do RH.
4. Confirmar o e-mail conforme a política da empresa.
5. Associar o usuário ao cargo `rh` na tabela de colaboradores/perfil.
6. Testar acesso ao menu RH.

Não foram alterados os logins existentes.

## 7. Situação após as alterações de hoje

O sistema está com a interface do RH mais organizada e o banco limpo para receber dados reais. Antes de liberar para uso definitivo, ainda é necessário criar o usuário RH no Supabase Auth e concluir a configuração de segurança da autenticação.

