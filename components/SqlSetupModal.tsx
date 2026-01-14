
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT PÁTIOLOG v15.0 (Automação de Usuários e Correção de Bounces)

-- 1. FUNÇÃO PARA CRIAR PERFIL E CONFIRMAR EMAIL AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Cria o perfil na tabela public.profiles
  INSERT INTO public.profiles (id, full_name, cargo, permissions)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'cargo', 'motorista')::public.user_role,
    COALESCE((new.raw_user_meta_data->>'permissions')::jsonb, '["collections"]'::jsonb)
  );

  -- AUTO-CONFIRMA O E-MAIL (Evita o envio de e-mail de confirmação e os bounces)
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER PARA EXECUTAR A FUNÇÃO SEMPRE QUE UM USUÁRIO FOR CRIADO NO AUTH
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. GARANTIR QUE AS TABELAS ENVIEM DADOS COMPLETOS NO REALTIME
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.veiculos REPLICA IDENTITY FULL;

-- 4. RECONSTRUIR PUBLICAÇÃO
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.profiles, public.veiculos, public.financeiro, public.movimentacoes;

-- 5. CORREÇÃO DE SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Perfis visíveis por todos" ON public.profiles;
CREATE POLICY "Perfis visíveis por todos" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Motoristas atualizam próprio GPS" ON public.profiles;
CREATE POLICY "Motoristas atualizam próprio GPS" ON public.profiles FOR UPDATE USING (auth.uid() = id);

COMMENT ON TABLE public.profiles IS 'Configurado para v15.0: Auto-Profile e Auto-Confirm ativados.';`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v15.0');
  if (!isOpen) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v15.0'), 2000);
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white italic">PátioLog Setup <span className="text-blue-500">v15.0</span></h2>
            <div className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-[10px] text-green-400 font-black uppercase">Correção Crítica</div>
        </div>
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2 text-xs text-gray-300">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-200">
                <p className="font-bold">Este script resolve o erro [object Object] e os avisos do Supabase.</p>
            </div>
            <ul className="list-disc ml-4 space-y-1 text-gray-400">
                <li><strong className="text-white">Auto-Confirmação:</strong> Para de enviar e-mails de confirmação (resolve os Bounces).</li>
                <li><strong className="text-white">Auto-Profile:</strong> Cria o perfil do usuário no banco assim que ele se cadastra.</li>
                <li><strong className="text-white">Full Identity:</strong> Garante que o rastreamento GPS apareça no mapa.</li>
            </ul>
            <pre className="bg-black p-4 rounded-xl overflow-auto text-[10px] font-mono text-green-400 border border-gray-700"><code>{SQL_SCRIPT}</code></pre>
            
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500">
                <p className="font-black uppercase text-[10px]">⚠️ AÇÃO MANUAL OBRIGATÓRIA:</p>
                <p className="mt-1">No painel do Supabase, vá em <strong>Authentication -> Providers -> Email</strong> e DESATIVE a opção "Confirm Email". Isso garantirá que o Supabase pare de tentar enviar e-mails para contas de teste.</p>
            </div>
        </div>
        <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 bg-gray-700 rounded-xl text-sm font-bold">Fechar</button>
            <button onClick={handleCopy} className="px-6 py-2.5 bg-blue-600 rounded-xl font-black text-sm">{copyButtonText}</button>
        </div>
      </div>
    </div>
  );
};

export default SqlSetupModal;
