
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT DEFINITIVO PÁTIOLOG v8.0 (Incluindo Formas de Pagamento)
-- ⚠️ INSTRUÇÃO OBRIGATÓRIA:
-- Além deste script, verifique se o bucket existe no painel do Supabase:
-- 1. Vá em Storage
-- 2. Localize ou crie o bucket: avarias
-- 3. Certifique-se que ele é "PUBLIC"

-- 0. CONFIRMAR TODOS OS USUÁRIOS ATUAIS
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- 1. TIPOS E ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'motorista');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
        CREATE TYPE public.vehicle_status AS ENUM ('aguardando_coleta', 'em_transito', 'no_patio', 'finalizado');
    END IF;
END $$;

-- 2. TABELA DE PERFIS
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    cargo public.user_role NOT NULL DEFAULT 'motorista',
    permissions text[] DEFAULT ARRAY['collections']::text[]
);

-- 3. TABELA DE VEÍCULOS
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

-- 4. TABELA DE FORMAS DE PAGAMENTO
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text NOT NULL UNIQUE,
    ativa boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Inserir formas padrão se não existirem
INSERT INTO public.formas_pagamento (nome) 
VALUES ('Dinheiro'), ('Pix'), ('Cartão de Crédito'), ('Cartão de Débito'), ('Transferência')
ON CONFLICT (nome) DO NOTHING;

-- 5. FUNÇÃO RPC PARA CRIAR COLETA
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
    p_proprietario_numero text DEFAULT NULL,
    p_fotos_avaria_url text[] DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO public.veiculos (
        placa, modelo, cor, ano, chassi, renavam, observacoes,
        proprietario_nome, proprietario_telefone, proprietario_cpf,
        proprietario_cep, proprietario_rua, proprietario_bairro, proprietario_numero,
        fotos_avaria_url, status
    ) VALUES (
        p_placa, p_modelo, p_cor, p_ano, p_chassi, p_renavam, p_observacoes,
        p_proprietario_nome, p_proprietario_telefone, p_proprietario_cpf,
        p_proprietario_cep, p_proprietario_rua, p_proprietario_bairro, p_proprietario_numero,
        p_fotos_avaria_url, 'aguardando_coleta'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. MOVIMENTAÇÕES E FINANCEIRO
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

-- 7. TRIGGER DE AUTOMATIZAÇÃO DE PERFIL
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
            ARRAY['dashboard', 'collections', 'financials', 'solicitacao_coleta', 'patio', 'fechamentos', 'user_management', 'payment_methods']::text[]
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

-- 8. CONFIGURAÇÃO FORÇADA DO SEU USUÁRIO ADMIN
UPDATE public.profiles 
SET cargo = 'admin', 
    permissions = ARRAY['dashboard', 'collections', 'financials', 'solicitacao_coleta', 'patio', 'fechamentos', 'user_management', 'payment_methods']::text[]
WHERE id IN (SELECT id FROM auth.users WHERE email = 'felipemartinssenai@gmail.com');

-- 9. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total perfis" ON public.profiles;
CREATE POLICY "Acesso total perfis" ON public.profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso total veiculos" ON public.veiculos;
CREATE POLICY "Acesso total veiculos" ON public.veiculos FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acesso total movs" ON public.movimentacoes;
CREATE POLICY "Acesso total movs" ON public.movimentacoes FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acesso total fin" ON public.financeiro;
CREATE POLICY "Acesso total fin" ON public.financeiro FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acesso total formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Acesso total formas_pagamento" ON public.formas_pagamento FOR ALL USING (auth.role() = 'authenticated');`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v8.0');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v8.0'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col">
                <h2 className="text-xl font-bold text-white">Configuração do Sistema</h2>
                <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">Setup do Banco e Storage</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-amber-500/10 border-2 border-amber-500/50 p-4 rounded-xl">
                <h3 className="text-amber-400 font-bold flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    PASSO OBRIGATÓRIO: Storage
                </h3>
                <p className="text-amber-200/80 text-xs leading-relaxed">
                    Utilizamos o bucket de armazenamento para as fotos dos veículos:
                </p>
                <ol className="list-decimal list-inside text-xs text-amber-100 mt-2 space-y-1 ml-1">
                    <li>No Dashboard do Supabase, clique em <b>Storage</b>.</li>
                    <li>Certifique-se que o bucket se chama: <code className="bg-black/50 px-1 rounded text-white select-all">avarias</code></li>
                    <li>O bucket <b>deve</b> estar marcado como <b>Public bucket</b> para exibição das imagens.</li>
                </ol>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-xs text-blue-200">
                <b>Script SQL:</b> Copie o código abaixo e execute-o no <b>SQL Editor</b> do seu Supabase para criar as tabelas e permissões.
            </div>

            <pre className="bg-black p-4 rounded-xl overflow-auto text-[10px] font-mono text-green-400 border border-gray-700">
              <code>{SQL_SCRIPT}</code>
            </pre>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold transition-all">Fechar</button>
          <button onClick={handleCopy} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-sm shadow-xl transition-all">{copyButtonText}</button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
