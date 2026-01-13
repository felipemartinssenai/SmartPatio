
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- 0. RESET COMPLETO DO BANCO DE DADOS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_new_vehicle_collection CASCADE;
DROP TABLE IF EXISTS public.financeiro CASCADE;
DROP TABLE IF EXISTS public.movimentacoes CASCADE;
DROP TABLE IF EXISTS public.veiculos CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.vehicle_status;
DROP TYPE IF EXISTS public.user_role;

-- 1. TIPOS ENUM
CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'motorista');
CREATE TYPE public.vehicle_status AS ENUM ('aguardando_coleta', 'em_transito', 'no_patio', 'finalizado');

-- 2. TABELA DE PERFIS
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    cargo public.user_role NOT NULL DEFAULT 'motorista'
);

-- 3. TABELA DE VEÍCULOS
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

-- 4. TABELA DE MOVIMENTAÇÕES
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

-- 5. TABELA FINANCEIRA
CREATE TABLE public.financeiro (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor numeric NOT NULL,
    descricao text,
    data timestamp with time zone NOT NULL DEFAULT now(),
    movimentacao_id uuid REFERENCES public.movimentacoes(id)
);

-- 6. FUNÇÃO DE GESTÃO DE NOVOS USUÁRIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, cargo)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    COALESCE((new.raw_user_meta_data->>'cargo')::public.user_role, 'motorista'::public.user_role)
  );
  RETURN new;
END;
$$;

-- 7. TRIGGER DE AUTOMAÇÃO
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. RPC PARA CRIAÇÃO DE COLETA
CREATE OR REPLACE FUNCTION public.create_new_vehicle_collection(p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placa text;
BEGIN
  v_placa := upper(trim(p_data->>'p_placa'));
  
  INSERT INTO public.veiculos (
      placa, modelo, cor, ano, chassi, renavam, observacoes,
      proprietario_nome, proprietario_telefone, proprietario_cpf, 
      proprietario_cep, proprietario_rua, proprietario_bairro, 
      proprietario_numero, status
  )
  VALUES (
      v_placa,
      p_data->>'p_modelo',
      p_data->>'p_cor',
      (p_data->>'p_ano')::int,
      p_data->>'p_chassi',
      p_data->>'p_renavam',
      p_data->>'p_observacoes',
      p_data->>'p_proprietario_nome',
      p_data->>'p_proprietario_telefone',
      p_data->>'p_proprietario_cpf',
      p_data->>'p_proprietario_cep',
      p_data->>'p_proprietario_rua',
      p_data->>'p_proprietario_bairro',
      p_data->>'p_proprietario_numero',
      'aguardando_coleta'
  );
END;
$$;

-- 9. SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

GRANT EXECUTE ON FUNCTION public.create_new_vehicle_collection TO authenticated;

CREATE POLICY "Profiles view all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Veiculos access all" ON public.veiculos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Movimentacoes access all" ON public.movimentacoes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Financeiro access all" ON public.financeiro FOR ALL USING (auth.role() = 'authenticated');

-- 10. SINCRONIZAÇÃO DE USUÁRIOS EXISTENTES (REPARO DE PERFIL)
-- Este bloco recria perfis para quem já está logado mas perdeu a linha no profiles
INSERT INTO public.profiles (id, full_name, cargo)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', 'Usuário Restaurado'),
  COALESCE((raw_user_meta_data->>'cargo')::public.user_role, 'motorista'::public.user_role)
FROM auth.users
ON CONFLICT (id) DO NOTHING;
`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-white">Setup e Reparo do Banco</h2>
            <div className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-1 rounded uppercase">v2.0 - Auto-Repair</div>
        </div>
        <p className="text-sm text-gray-400 mb-4">
            Se você estiver recebendo o erro "Perfil não encontrado", copie este script e execute-o no **SQL Editor** do Supabase. 
            Ele irá recriar as tabelas e restaurar os perfis dos usuários que já existem.
        </p>
        <pre className="bg-black p-4 rounded overflow-auto flex-1 text-xs font-mono text-green-400 border border-gray-700">
          <code>{SQL_SCRIPT}</code>
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded text-sm font-bold">Fechar</button>
          <button onClick={handleCopy} className="px-4 py-2 bg-blue-600 rounded font-bold text-sm shadow-lg shadow-blue-900/20">{copyButtonText}</button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
