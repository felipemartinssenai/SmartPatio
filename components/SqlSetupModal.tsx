
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT DEFINITIVO PÁTIOLOG v7.0
-- IMPORTANTE: Para desativar a confirmação de e-mail, vá no painel do Supabase em:
-- Auth -> Providers -> Email -> DESATIVE "Confirm Email"

-- 1. TIPOS E ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'motorista');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
        CREATE TYPE public.vehicle_status AS ENUM ('aguardando_coleta', 'em_transito', 'no_patio', 'finalizado');
    END IF;
END $$;

-- 2. TABELA DE PERFIS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    cargo public.user_role NOT NULL DEFAULT 'motorista',
    permissions text[] DEFAULT ARRAY['collections']::text[]
);

-- Garantir que a coluna permissions existe
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='permissions') THEN
        ALTER TABLE public.profiles ADD COLUMN permissions text[] DEFAULT ARRAY['collections']::text[];
    END IF;
END $$;

-- 3. TABELA DE VEÍCULOS (ESTRUTURA COMPLETA)
CREATE TABLE IF NOT EXISTS public.veiculos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    placa text NOT NULL,
    modelo text,
    cor text,
    status public.vehicle_status DEFAULT 'aguardando_coleta',
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
    ano integer,
    chassi text,
    renavam text,
    observacoes text,
    created_at timestamptz DEFAULT now()
);

-- 4. MOVIMENTAÇÕES E FINANCEIRO
CREATE TABLE IF NOT EXISTS public.movimentacoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    veiculo_id uuid REFERENCES public.veiculos(id),
    data_entrada timestamptz,
    data_saida timestamptz,
    valor_diaria numeric(10,2) DEFAULT 0,
    total_pago numeric(10,2),
    forma_pagamento text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo text CHECK (tipo IN ('entrada', 'saida')),
    valor numeric(10,2) NOT NULL,
    descricao text,
    data timestamptz DEFAULT now(),
    movimentacao_id uuid REFERENCES public.movimentacoes(id)
);

-- 5. FUNÇÃO RPC PARA CRIAR COLETA (USADA NO FRONTEND)
CREATE OR REPLACE FUNCTION public.create_new_vehicle_collection(
    p_placa text,
    p_modelo text DEFAULT NULL,
    p_cor text DEFAULT NULL,
    p_ano integer DEFAULT NULL,
    p_chassi text DEFAULT NULL,
    p_renavam text DEFAULT NULL,
    p_observacoes text DEFAULT NULL,
    p_proprietario_nome text DEFAULT NULL,
    p_proprietario_telefone text DEFAULT NULL,
    p_proprietario_cpf text DEFAULT NULL,
    p_proprietario_cep text DEFAULT NULL,
    p_proprietario_rua text DEFAULT NULL,
    p_proprietario_bairro text DEFAULT NULL,
    p_proprietario_numero text DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO public.veiculos (
        placa, modelo, cor, ano, chassi, renavam, observacoes,
        proprietario_nome, proprietario_telefone, proprietario_cpf,
        proprietario_cep, proprietario_rua, proprietario_bairro, proprietario_numero,
        status
    ) VALUES (
        p_placa, p_modelo, p_cor, p_ano, p_chassi, p_renavam, p_observacoes,
        p_proprietario_nome, p_proprietario_telefone, p_proprietario_cpf,
        p_proprietario_cep, p_proprietario_rua, p_proprietario_bairro, p_proprietario_numero,
        'aguardando_coleta'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGER DE AUTOMATIZAÇÃO DE PERFIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, cargo, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    CASE 
        WHEN new.email = 'felipemartinssenai@gmail.com' THEN 'admin'::public.user_role
        ELSE 'motorista'::public.user_role
    END,
    CASE 
        WHEN new.email = 'felipemartinssenai@gmail.com' THEN 
            ARRAY['dashboard', 'collections', 'financials', 'solicitacao_coleta', 'patio', 'fechamentos', 'user_management']::text[]
        ELSE ARRAY['collections']::text[]
    END
  ) ON CONFLICT (id) DO UPDATE SET
    cargo = EXCLUDED.cargo,
    permissions = EXCLUDED.permissions;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. CONFIGURAÇÃO FORÇADA DO SEU USUÁRIO ADMIN E AUTO-CONFIRMAÇÃO
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'felipemartinssenai@gmail.com';

UPDATE public.profiles 
SET cargo = 'admin', 
    permissions = ARRAY['dashboard', 'collections', 'financials', 'solicitacao_coleta', 'patio', 'fechamentos', 'user_management']::text[]
WHERE id IN (SELECT id FROM auth.users WHERE email = 'felipemartinssenai@gmail.com');

-- 8. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total perfis" ON public.profiles;
CREATE POLICY "Acesso total perfis" ON public.profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso total veiculos" ON public.veiculos;
CREATE POLICY "Acesso total veiculos" ON public.veiculos FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acesso total movs" ON public.movimentacoes;
CREATE POLICY "Acesso total movs" ON public.movimentacoes FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acesso total fin" ON public.financeiro;
CREATE POLICY "Acesso total fin" ON public.financeiro FOR ALL USING (auth.role() = 'authenticated');`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v7.0 (Completo)');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v7.0 (Completo)'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col">
                <h2 className="text-xl font-bold text-white">Setup Geral do Sistema</h2>
                <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">Versão 7.0 Definitiva</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        
        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-4 text-xs text-blue-200">
            Este script configura <b>todas as tabelas, funções e o seu usuário Administrador Root</b>. Execute-o no SQL Editor do Supabase para o sistema funcionar corretamente.
        </div>

        <pre className="bg-black p-4 rounded-xl overflow-auto flex-1 text-[10px] font-mono text-green-400 border border-gray-700 custom-scrollbar">
          <code>{SQL_SCRIPT}</code>
        </pre>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold transition-all">Fechar</button>
          <button onClick={handleCopy} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-sm shadow-xl transition-all">{copyButtonText}</button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
