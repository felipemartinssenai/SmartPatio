
import React, { useState } from 'react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- SCRIPT PÁTIOLOG v18.0 (Documentos & RPC Update)

-- 1. ADIÇÃO DA COLUNA DE DOCUMENTOS NA TABELA VEICULOS
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS documentos_url text[] DEFAULT '{}';

-- 2. ATUALIZAÇÃO DA FUNÇÃO RPC PARA ACEITAR DOCUMENTOS
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

-- 3. PERMISSÕES DE STORAGE (Certifique-se de criar o bucket 'documentos' como PUBLIC no painel)
-- O Supabase exige que os buckets sejam criados via UI para melhor gestão de políticas.

-- 4. CONFIRMAÇÃO RETROATIVA DE USUÁRIOS
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

COMMENT ON TABLE public.veiculos IS 'v18.0: Suporte a upload de documentos e RPC atualizado.';`;

const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copiar Script v18.0');
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopyButtonText('Copiado!');
    setTimeout(() => setCopyButtonText('Copiar Script v18.0'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white italic">PátioLog Setup <span className="text-blue-500">v18.0</span></h2>
            <div className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-[10px] text-green-400 font-black uppercase">Documentos Ativados</div>
        </div>
        <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar pr-2 text-xs text-gray-300">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-200">
                <p className="font-bold">Esta versão habilita o anexo de PDFs e documentos oficiais aos veículos.</p>
            </div>
            <ul className="list-disc ml-4 space-y-1 text-gray-400">
                <li><strong className="text-white">Storage:</strong> Crie um bucket chamado 'documentos' no Supabase e deixe como PUBLIC.</li>
                <li><strong className="text-white">RPC:</strong> A função de criação agora suporta o parâmetro p_documentos_url.</li>
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
