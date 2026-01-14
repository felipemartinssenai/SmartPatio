
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT DEFINITIVO PÁTIOLOG v9.0
-- 1. TABELA DE CONFIGURAÇÕES SISTEMAS
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chave text NOT NULL UNIQUE,
    valor jsonb,
    created_at timestamptz DEFAULT now()
);

-- Inserir config asaas padrão
INSERT INTO public.configuracoes (chave, valor) 
VALUES ('asaas_config', '{"api_key": "", "environment": "sandbox"}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- 2. TIPOS E ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'motorista');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
        CREATE TYPE public.vehicle_status AS ENUM ('aguardando_coleta', 'em_transito', 'no_patio', 'finalizado');
    END IF;
END $$;

-- 3. TABELA DE PERFIS
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    cargo public.user_role NOT NULL DEFAULT 'motorista',
    permissions text[] DEFAULT ARRAY['collections']::text[]
);

-- 4. TABELA DE VEÍCULOS
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

-- 5. TABELA DE FORMAS DE PAGAMENTO
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text NOT NULL UNIQUE,
    ativa boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

INSERT INTO public.formas_pagamento (nome) 
VALUES ('Dinheiro'), ('Pix'), ('Cartão de Crédito'), ('Cartão de Débito'), ('Boleto')
ON CONFLICT (nome) DO NOTHING;

-- 6. MOVIMENTAÇÕES E FINANCEIRO
CREATE TABLE IF NOT EXISTS public.movimentacoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    veiculo_id uuid REFERENCES public.veiculos(id),
    data_entrada timestamptz,
    data_saida timestamptz,
    valor_diaria numeric(10,2) DEFAULT 0,
    total_pago numeric(10,2),
    forma_pagamento text,
    asaas_id text,
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

-- 7. TRIGGER DE PERFIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, cargo, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    CASE WHEN new.email = 'felipemartinssenai@gmail.com' THEN 'admin'::public.user_role ELSE 'motorista'::public.user_role END,
    CASE WHEN new.email = 'felipemartinssenai@gmail.com' THEN ARRAY['dashboard', 'collections', 'financials', 'solicitacao_coleta', 'patio', 'fechamentos', 'user_management', 'payment_methods', 'settings']::text[] ELSE ARRAY['collections']::text[] END
  ) ON CONFLICT (id) DO UPDATE SET cargo = EXCLUDED.cargo, permissions = EXCLUDED.permissions;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. POLÍTICAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total" ON public.profiles; CREATE POLICY "Acesso total" ON public.profiles FOR ALL USING (true);
DROP POLICY IF EXISTS "Acesso total" ON public.veiculos; CREATE POLICY "Acesso total" ON public.veiculos FOR ALL USING (true);
DROP POLICY IF EXISTS "Acesso total" ON public.movimentacoes; CREATE POLICY "Acesso total" ON public.movimentacoes FOR ALL USING (true);
DROP POLICY IF EXISTS "Acesso total" ON public.financeiro; CREATE POLICY "Acesso total" ON public.financeiro FOR ALL USING (true);
DROP POLICY IF EXISTS "Acesso total" ON public.formas_pagamento; CREATE POLICY "Acesso total" ON public.formas_pagamento FOR ALL USING (true);
DROP POLICY IF EXISTS "Acesso total" ON public.configuracoes; CREATE POLICY "Acesso total" ON public.configuracoes FOR ALL USING (true);`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v9.0');
  if (!isOpen) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v9.0'), 2000);
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Configuração v9.0 (Asaas)</h2>
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2">
            <p className="text-xs text-blue-200">Execute este script no SQL Editor para habilitar a tabela de configurações e os novos campos de integração.</p>
            <pre className="bg-black p-4 rounded-xl overflow-auto text-[10px] font-mono text-green-400 border border-gray-700"><code>{SQL_SCRIPT}</code></pre>
        </div>
        <div className="flex justify-end gap-3"><button onClick={onClose} className="px-6 py-2.5 bg-gray-700 rounded-xl text-sm font-bold">Fechar</button><button onClick={handleCopy} className="px-6 py-2.5 bg-blue-600 rounded-xl font-black text-sm">{copyButtonText}</button></div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
