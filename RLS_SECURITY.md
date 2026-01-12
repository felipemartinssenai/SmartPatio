
# Explicação das Políticas de Segurança (Row Level Security - RLS)

As políticas de RLS são um recurso poderoso do PostgreSQL (e do Supabase) que permite controlar o acesso aos dados em um nível de linha. Em vez de apenas controlar quem pode acessar uma tabela, você pode definir regras sobre *quais linhas* um usuário pode ver ou modificar.

Neste sistema, usamos RLS para garantir que cada tipo de usuário (admin, operador, motorista) tenha acesso apenas às informações pertinentes à sua função.

## 1. Tabela `profiles`

- **Permissão de Leitura (SELECT):** Qualquer usuário autenticado pode ver os perfis de outros usuários. Isso é útil para, por exemplo, um administrador associar um nome de motorista a um veículo.
- **Permissão de Escrita (UPDATE):** Um usuário só pode atualizar o seu próprio perfil. A condição `auth.uid() = id` garante que o ID do usuário logado seja o mesmo que o ID da linha do perfil que ele está tentando alterar.

## 2. Tabela `veiculos`

Esta tabela tem duas políticas que trabalham em conjunto:

- **Política para Admins/Operadores:** Se o `cargo` do usuário logado for `admin` ou `operador`, ele tem permissão total (ver, inserir, atualizar, deletar) sobre *todas as linhas* da tabela `veiculos`.
- **Política para Motoristas:**
  - Um motorista pode ver e atualizar um veículo se ele for o motorista designado (`motorista_id = auth.uid()`).
  - Além disso, para permitir que qualquer motorista pegue uma nova coleta, ele também pode ver veículos com o status `aguardando_coleta`.
  - Esta regra impede que um motorista veja ou modifique os detalhes da coleta de outro motorista que já está em andamento.

## 3. Tabela `movimentacoes`

- **Acesso Restrito:** Apenas usuários com `cargo` de `admin` ou `operador` podem acessar ou modificar qualquer registro nesta tabela. Motoristas não têm nenhuma permissão sobre os dados de movimentação do pátio.

## 4. Tabela `financeiro`

- **Acesso Mais Restrito (Core da Regra de Negócio):** Assim como na tabela `movimentacoes`, o acesso à tabela `financeiro` é estritamente limitado a usuários com `cargo` de `admin` ou `operador`.
- **Segurança:** Esta é a política mais crítica. Ela garante que motoristas **nunca** possam ver ou manipular os registros financeiros, protegendo a integridade e a confidencialidade dos dados financeiros da empresa. A função `(SELECT cargo FROM public.profiles WHERE id = auth.uid())` busca dinamicamente o cargo do usuário que está fazendo a requisição e verifica se ele está na lista permitida (`'admin'`, `'operador'`).

## Como Funciona na Prática?

Quando um motorista logado tenta fazer uma consulta como `supabase.from('financeiro').select('*')`, o Supabase primeiro executa a política de RLS. A política verifica o cargo do motorista, vê que não é `admin` nem `operador`, e a consulta falha, retornando uma lista vazia ou um erro de permissão, como se a tabela estivesse vazia ou não existisse para ele.
