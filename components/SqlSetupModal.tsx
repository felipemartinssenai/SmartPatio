
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- 0. RESET COMPLETO DO BANCO DE DADOS
-- CUIDADO: As instruções abaixo apagarão TODAS as tabelas, tipos, funções e dados existentes.
-- Execute este script apenas para começar do zero em um ambiente de desenvolvimento.

-- Remove o gatilho da tabela de autenticação
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove as funções usando CASCADE para remover objetos dependentes (como RLS policies)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.create_new_vehicle_collection(text, text, text, text, text, integer, text, text, text, text, text, text, text, text) CASCADE;


-- Remove as tabelas. O 'CASCADE' remove objetos dependentes (como policies).
DROP TABLE IF EXISTS public.financeiro CASCADE;
DROP TABLE IF EXISTS public.movimentacoes CASCADE;
DROP TABLE IF EXISTS public.veiculos CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Remove os tipos customizados (ENUMs)
DROP TYPE IF EXISTS public.vehicle_status;
DROP TYPE IF EXISTS public.user_role;

-- AVISO: A partir daqui, o script recria toda a estrutura do zero.


-- 1. CRIAÇÃO DAS TABELAS E TIPOS

-- Enum para cargos de usuário
CREATE TYPE public.user_role AS ENUM (
    'admin',
    'operador',
    'motorista'
);

-- Enum para status de veículos
CREATE TYPE public.vehicle_status AS ENUM (
    'aguardando_coleta',
    'em_transito',
    'no_patio',
    'finalizado'
);

-- Tabela de Perfis, integrada com o sistema de autenticação do Supabase
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    cargo public.user_role NOT NULL
);
COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';

-- Tabela de Veículos
CREATE TABLE public.veiculos (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    placa text NOT NULL UNIQUE,
    modelo text,
    cor text,
    ano int,
    chassi text,
    renavam text,
    observacoes text,
    status public.vehicle_status NOT NULL DEFAULT 'aguardando_coleta',
    lat double precision,
    lng double precision,
    codigo_infracao_ctb text,
    fotos_avaria_url text[],
    proprietario_nome text,
    proprietario_telefone text,
    proprietario_cpf text,
    proprietario_cep text,
    proprietario_rua text,
    proprietario_bairro text,
    proprietario_numero text,
    motorista_id uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.veiculos IS 'Stores information about collected vehicles.';

-- Tabela de Movimentações (Entrada/Saída do pátio)
CREATE TABLE public.movimentacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    veiculo_id uuid NOT NULL REFERENCES public.veiculos(id),
    data_entrada timestamp with time zone DEFAULT now(),
    data_saida timestamp with time zone,
    valor_diaria numeric NOT NULL,
    total_pago numeric,
    forma_pagamento text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.movimentacoes IS 'Tracks vehicle movements in and out of the yard.';

-- Tabela Financeiro
CREATE TABLE public.financeiro (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor numeric NOT NULL,
    descricao text,
    data timestamp with time zone NOT NULL DEFAULT now(),
    movimentacao_id uuid REFERENCES public.movimentacoes(id)
);
COMMENT ON TABLE public.financeiro IS 'Records all financial transactions.';

-- 2. HABILITAR REALTIME (via UI do Supabase)
-- Vá para a seção "Database" -> "Replication".
-- Clique em "0 tables" sob "Source" e ative o toggle para a tabela "veiculos".
-- Isso fará com que o mapa e o dashboard do motorista recebam atualizações em tempo real.

-- 3. GATILHO PARA SINCRONIZAR AUTH COM PROFILES
-- Função que será chamada pelo gatilho para criar um perfil quando um novo usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, cargo)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    (new.raw_user_meta_data->>'cargo')::public.user_role
  );
  RETURN new;
END;
$$;

-- Gatilho que executa a função acima após a criação de um novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para buscar o cargo do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT cargo::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Políticas para a tabela 'profiles'
CREATE POLICY "Usuários podem ver todos os perfis" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas para a tabela 'veiculos'
CREATE POLICY "Admins e operadores podem gerenciar todos os veículos" ON public.veiculos FOR ALL USING (get_my_role() IN ('admin', 'operador'));
CREATE POLICY "Motoristas podem ver coletas disponíveis ou atribuídas a eles" ON public.veiculos FOR SELECT USING (get_my_role() = 'motorista' AND (status = 'aguardando_coleta' OR motorista_id = auth.uid()));
CREATE POLICY "Motoristas podem atualizar suas próprias coletas" ON public.veiculos FOR UPDATE USING (get_my_role() = 'motorista' AND motorista_id = auth.uid());

-- Políticas para 'movimentacoes' e 'financeiro'
CREATE POLICY "Admins e operadores podem gerenciar movimentações" ON public.movimentacoes FOR ALL USING (get_my_role() IN ('admin', 'operador'));
CREATE POLICY "Admins e operadores podem gerenciar o financeiro" ON public.financeiro FOR ALL USING (get_my_role() IN ('admin', 'operador'));


-- 5. FUNÇÕES CUSTOMIZADAS (RPC)

-- Função para criar uma nova solicitação de coleta.
-- Isso ajuda a encapsular a lógica de inserção e a contornar problemas de cache do lado do cliente.
CREATE OR REPLACE FUNCTION public.create_new_vehicle_collection(
    p_placa text,
    p_modelo text,
    p_cor text,
    p_proprietario_nome text,
    p_proprietario_telefone text,
    p_ano int,
    p_chassi text,
    p_renavam text,
    p_observacoes text,
    p_proprietario_cpf text,
    p_proprietario_cep text,
    p_proprietario_rua text,
    p_proprietario_bairro text,
    p_proprietario_numero text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com os privilégios do criador da função (owner)
SET search_path = public
AS $$
BEGIN
  -- A RLS para admins/operadores já permite a inserção, mas a função RPC
  -- garante que a lógica de negócio esteja centralizada e segura.
  INSERT INTO public.veiculos (
      placa, modelo, cor, proprietario_nome, proprietario_telefone, status,
      ano, chassi, renavam, observacoes, proprietario_cpf, proprietario_cep,
      proprietario_rua, proprietario_bairro, proprietario_numero
  )
  VALUES (
      upper(p_placa), p_modelo, p_cor, p_proprietario_nome, p_proprietario_telefone, 'aguardando_coleta',
      p_ano, p_chassi, p_renavam, p_observacoes, p_proprietario_cpf, p_proprietario_cep,
      p_proprietario_rua, p_proprietario_bairro, p_proprietario_numero
  );
END;
$$;

-- Conceder permissão para que usuários autenticados possam chamar esta função
GRANT EXECUTE ON FUNCTION public.create_new_vehicle_collection(text, text, text, text, text, integer, text, text, text, text, text, text, text, text) TO authenticated;
`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => {
      setCopyButtonText('Copiar Script');
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[2000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Script de Setup do Banco de Dados</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Copie e execute no <strong>SQL Editor</strong> do Supabase. <strong>Atenção:</strong> ele apagará todos os dados existentes para criar uma estrutura limpa.
        </p>
        <pre className="bg-gray-900 text-gray-300 p-4 rounded-md overflow-auto flex-1 text-xs font-mono">
          <code>{SQL_SCRIPT}</code>
        </pre>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-semibold transition-colors"
          >
            {copyButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
