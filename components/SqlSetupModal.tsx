
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT PÁTIOLOG v17.0 (Fix Generated Column & Auto-Confirm)

-- 1. CONFIRMAÇÃO RETROATIVA: Ativa todos os usuários atuais pendentes
-- Removido 'confirmed_at' por ser uma coluna gerada/gerenciada pelo sistema
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    updated_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- 2. FUNÇÃO DE AUTOMAÇÃO PARA NOVOS USUÁRIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- A) CRIA O PERFIL AUTOMATICAMENTE NA TABELA PUBLIC.PROFILES
  INSERT INTO public.profiles (id, full_name, cargo, permissions)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'cargo', 'motorista')::public.user_role,
    COALESCE((new.raw_user_meta_data->>'permissions')::jsonb, '["collections"]'::jsonb)
  );

  -- B) AUTO-CONFIRMA O E-MAIL NO ATO DO CADASTRO (Bypass total de envio de e-mail)
  -- Apenas email_confirmed_at é necessário para validar a conta
  UPDATE auth.users 
  SET email_confirmed_at = NOW()
  WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REINSTALAÇÃO DA TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. CONFIGURAÇÕES DE REALTIME
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.veiculos REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.profiles, public.veiculos, public.financeiro, public.movimentacoes;

-- 5. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Perfis visíveis por todos" ON public.profiles;
CREATE POLICY "Perfis visíveis por todos" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Atualização própria" ON public.profiles;
CREATE POLICY "Atualização própria" ON public.profiles FOR UPDATE USING (auth.uid() = id);

COMMENT ON TABLE public.profiles IS 'v17.0: Correção de coluna gerada e auto-confirm ativado.';`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v17.0');
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v17.0'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white italic">PátioLog Setup <span className="text-blue-500">v17.0</span></h2>
            <div className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-[10px] text-green-400 font-black uppercase">Correção de Erro SQL</div>
        </div>
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2 text-xs text-gray-300">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-200">
                <p className="font-bold">Esta versão corrige o erro "column confirmed_at can only be updated to DEFAULT".</p>
            </div>
            <ul className="list-disc ml-4 space-y-1 text-gray-400">
                <li><strong className="text-white">Email Confirmed Only:</strong> Foca na coluna correta para liberar o acesso.</li>
                <li><strong className="text-white">Auto-Confirm:</strong> Garante que novos usuários entrem sem e-mail.</li>
                <li><strong className="text-white">Retroativo:</strong> Ativa todas as contas pendentes no banco.</li>
            </ul>
            <pre className="bg-black p-4 rounded-xl overflow-auto text-[10px] font-mono text-green-400 border border-gray-700"><code>{SQL_SCRIPT}</code></pre>
            
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500">
                <p className="font-black uppercase text-[10px]">Aviso Importante:</p>
                <p className="mt-1">
                  Algumas versões do Supabase geram o campo "confirmed_at" automaticamente. O script v17.0 remove a tentativa de escrita manual nesse campo, resolvendo o conflito.
                </p>
            </div>
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
