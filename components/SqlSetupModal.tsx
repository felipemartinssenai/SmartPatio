
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- 0. PREPARAÇÃO DE TIPOS (Executar apenas se necessário)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'motorista');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
        CREATE TYPE public.vehicle_status AS ENUM ('aguardando_coleta', 'em_transito', 'no_patio', 'finalizado');
    END IF;
END $$;

-- 1. TABELA DE PERFIS (NÃO DESTRUTIVA)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    cargo public.user_role NOT NULL DEFAULT 'motorista'
);

-- 2. TABELA DE VEÍCULOS
CREATE TABLE IF NOT EXISTS public.veiculos (
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

-- 3. TABELA DE MOVIMENTAÇÕES
CREATE TABLE IF NOT EXISTS public.movimentacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    veiculo_id uuid NOT NULL REFERENCES public.veiculos(id),
    data_entrada timestamp with time zone DEFAULT now(),
    data_saida timestamp with time zone,
    valor_diaria numeric NOT NULL,
    total_pago numeric,
    forma_pagamento text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. TABELA FINANCEIRA
CREATE TABLE IF NOT EXISTS public.financeiro (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor numeric NOT NULL,
    descricao text,
    data timestamp with time zone NOT NULL DEFAULT now(),
    movimentacao_id uuid REFERENCES public.movimentacoes(id)
);

-- 5. FUNÇÃO DE GESTÃO DE NOVOS USUÁRIOS
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
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    cargo = EXCLUDED.cargo;
  RETURN new;
END;
$$;

-- 6. TRIGGER DE AUTOMAÇÃO
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. RPC PARA CRIAÇÃO DE COLETA
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

-- 8. SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

GRANT EXECUTE ON FUNCTION public.create_new_vehicle_collection TO authenticated;

-- Limpeza de políticas antigas para evitar erros de duplicidade
DROP POLICY IF EXISTS "Profiles view all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self update" ON public.profiles;
DROP POLICY IF EXISTS "Veiculos access all" ON public.veiculos;
DROP POLICY IF EXISTS "Movimentacoes access all" ON public.movimentacoes;
DROP POLICY IF EXISTS "Financeiro access all" ON public.financeiro;

CREATE POLICY "Profiles view all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Veiculos access all" ON public.veiculos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Movimentacoes access all" ON public.movimentacoes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Financeiro access all" ON public.financeiro FOR ALL USING (auth.role() = 'authenticated');

-- 9. REPARO IMEDIATO DE PERFIS ÓRFÃOS
-- Este comando restaura o acesso para usuários já logados que perderam o perfil
INSERT INTO public.profiles (id, full_name, cargo)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', 'Admin Restaurado'),
  'admin' -- Forçamos admin no reparo manual para o primeiro acesso
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
  cargo = EXCLUDED.cargo;
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
            <div className="flex flex-col">
                <h2 className="text-xl font-bold text-white">Setup e Reparo do Banco</h2>
                <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">v3.0 - Resgate de Emergência</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        
        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-4">
            <p className="text-sm text-blue-200 leading-relaxed">
                Este script irá criar as tabelas que faltam e **restaurar seu acesso de administrador**. 
                Copie o código abaixo e cole no seu **SQL Editor** do Supabase.
            </p>
        </div>

        <pre className="bg-black p-4 rounded-xl overflow-auto flex-1 text-xs font-mono text-green-400 border border-gray-700 custom-scrollbar">
          <code>{SQL_SCRIPT}</code>
        </pre>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold transition-all">Cancelar</button>
          <button onClick={handleCopy} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-sm shadow-xl shadow-blue-900/40 transition-all active:scale-95">{copyButtonText}</button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
