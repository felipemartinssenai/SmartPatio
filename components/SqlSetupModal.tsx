
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT DEFINITIVO PÁTIOLOG v14.0 (Correção de Rastreamento)

-- 1. GARANTIR QUE AS TABELAS ENVIEM TODOS OS DADOS NO REALTIME
-- Sem isso, o Admin não consegue saber se o perfil atualizado é um 'motorista'
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.veiculos REPLICA IDENTITY FULL;

-- 2. RECONSTRUIR PUBLICAÇÃO (Força o Supabase a atualizar as tabelas monitoradas)
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.profiles, public.veiculos, public.financeiro, public.movimentacoes;

-- 3. GARANTIR COLUNAS DE GPS NA TABELA PROFILES
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='lat') THEN
        ALTER TABLE public.profiles ADD COLUMN lat double precision;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='lng') THEN
        ALTER TABLE public.profiles ADD COLUMN lng double precision;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='last_seen') THEN
        ALTER TABLE public.profiles ADD COLUMN last_seen timestamptz;
    END IF;
END $$;

-- 4. POLÍTICAS DE ACESSO (RLS) - Garantir que todos possam ver localizações para o mapa
DROP POLICY IF EXISTS "Perfis visíveis por todos" ON public.profiles;
CREATE POLICY "Perfis visíveis por todos" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Motoristas atualizam próprio GPS" ON public.profiles;
CREATE POLICY "Motoristas atualizam próprio GPS" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5. NOTIFICAÇÃO DE SUCESSO
COMMENT ON TABLE public.profiles IS 'Configurado para Realtime v14.0 com Full Identity';`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v14.0');
  if (!isOpen) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v14.0'), 2000);
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white italic">PátioLog Setup <span className="text-blue-500">v14.0</span></h2>
            <div className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-[10px] text-green-400 font-black uppercase">Correção de GPS</div>
        </div>
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2 text-xs text-gray-300">
            <p>Este script corrige o problema do motorista não aparecer no mapa.</p>
            <ul className="list-disc ml-4 space-y-1 text-blue-200">
                <li>Ativa o envio de 100% dos dados da tabela (Replica Identity Full).</li>
                <li>Garante que o Admin consiga ler as coordenadas.</li>
                <li>Recria o canal de comunicação em tempo real.</li>
            </ul>
            <pre className="bg-black p-4 rounded-xl overflow-auto text-[10px] font-mono text-green-400 border border-gray-700"><code>{SQL_SCRIPT}</code></pre>
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
