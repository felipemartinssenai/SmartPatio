
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT PÁTIOLOG v19.0 (User Sync & Infrastructure)

-- 1. CRIAÇÃO DE TIPOS E TABELAS BASE (CASO NÃO EXISTAM)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'motorista');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    full_name text,
    avatar_url text,
    cargo public.user_role DEFAULT 'motorista'::public.user_role,
    permissions text[] DEFAULT '{}',
    lat double precision,
    lng double precision,
    last_seen timestamp with time zone
);

-- 2. FUNÇÃO DE SINCRONIZAÇÃO DE USUÁRIOS (O CORAÇÃO DO SISTEMA)
-- Esta função corrige o erro "Database error saving new user"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_perms text[];
BEGIN
  -- Define permissões padrão baseadas no cargo se não vierem no metadata
  IF (new.raw_user_meta_data->>'cargo' = 'motorista') THEN
    default_perms := ARRAY['collections'];
  ELSE
    default_perms := ARRAY['dashboard', 'patio', 'solicitacao_coleta'];
  END IF;

  INSERT INTO public.profiles (id, full_name, cargo, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'cargo', 'motorista')::public.user_role,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'permissions')),
      default_perms
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECRIAR O TRIGGER DE AUTOMAÇÃO
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ATUALIZAÇÃO DA FUNÇÃO DE COLETA (V18 REVISADA)
CREATE OR REPLACE FUNCTION public.create_new_vehicle_collection(
  p_ano integer,
  p_chassi text,
  p_cor text,
  p_modelo text,
  p_observacoes text,
  p_placa text,
  p_proprietario_bairro text,
  p_proprietario_cep text,
  p_proprietario_cpf text,
  p_proprietario_nome text,
  p_proprietario_numero text,
  p_proprietario_rua text,
  p_proprietario_telefone text,
  p_renavam text,
  p_fotos_avaria_url text[],
  p_documentos_url text[] DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.veiculos (
    placa, modelo, cor, ano, chassi, renavam, observacoes,
    proprietario_nome, proprietario_telefone, proprietario_cpf,
    proprietario_cep, proprietario_rua, proprietario_bairro, proprietario_numero,
    fotos_avaria_url, documentos_url, status
  ) VALUES (
    p_placa, p_modelo, p_cor, p_ano, p_chassi, p_renavam, p_observacoes,
    p_proprietario_nome, p_proprietario_telefone, p_proprietario_cpf,
    p_proprietario_cep, p_proprietario_rua, p_proprietario_bairro, p_proprietario_numero,
    p_fotos_avaria_url, p_documentos_url, 'aguardando_coleta'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. POLÍTICAS DE RLS (GARANTIR ACESSO DOS USUÁRIOS AOS PRÓPRIOS PERFIS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Usuários podem ver todos os perfis" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Usuários podem editar o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem editar o próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. CONFIRMAÇÃO RETROATIVA E COMENTÁRIO
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
COMMENT ON TABLE public.profiles IS 'v19.0: Sincronização automática e correção de erro de cadastro.';`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v19.0');
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v19.0'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white italic">PátioLog Setup <span className="text-blue-500">v19.0</span></h2>
            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] text-blue-400 font-black uppercase tracking-widest">Correção de Cadastro</div>
        </div>
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2 text-xs text-gray-300">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-200">
                <p className="font-bold">Este script corrige o erro de salvamento de novos usuários.</p>
                <p className="mt-1 opacity-70">Ele cria um "Trigger" que vincula automaticamente a conta de e-mail ao perfil do sistema.</p>
            </div>
            <ul className="list-disc ml-4 space-y-1 text-gray-400">
                <li><strong className="text-white">Ação:</strong> Copie o código abaixo.</li>
                <li><strong className="text-white">Onde:</strong> Vá no painel do Supabase &gt; SQL Editor.</li>
                <li><strong className="text-white">Executar:</strong> Cole e clique em "Run".</li>
            </ul>
            <pre className="bg-black p-4 rounded-xl overflow-auto text-[10px] font-mono text-green-400 border border-gray-700"><code>{SQL_SCRIPT}</code></pre>
        </div>
        <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 rounded-xl text-sm font-bold transition-colors hover:bg-gray-600">Fechar</button>
            <button onClick={handleCopy} className="px-6 py-2.5 bg-blue-600 rounded-xl font-black text-sm transition-all hover:bg-blue-500 shadow-lg shadow-blue-900/20">{copyButtonText}</button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
