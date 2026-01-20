
import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Page } from '../types';

interface SolicitacaoColetaProps {
    setCurrentPage: (page: Page) => void;
}

const initialFormState = {
  placa: '',
  modelo: '',
  cor: '',
  ano: '',
  chassi: '',
  renavam: '',
  observacoes: '',
  proprietarioNome: '',
  proprietarioTelefone: '',
  proprietarioCpf: '',
  proprietarioCep: '',
  proprietarioRua: '',
  proprietarioBairro: '',
  proprietarioNumero: '',
};

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <input
          {...props}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
    </div>
);

const SolicitacaoColeta: React.FC<SolicitacaoColetaProps> = ({ setCurrentPage }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  const [selectedDocs, setSelectedDocs] = useState<File[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'proprietarioTelefone') {
      setFormData(prev => ({ ...prev, [name]: maskPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 6) {
        setError('Limite máximo de 6 fotos por veículo.');
        return;
    }

    const newPreviews = files.map(file => URL.createObjectURL(file as Blob));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setError(null);
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedDocs.length > 5) {
        setError('Limite máximo de 5 documentos por veículo.');
        return;
    }
    setSelectedDocs(prev => [...prev, ...files]);
    setError(null);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeDoc = (index: number) => {
    setSelectedDocs(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (placa: string, files: File[], bucket: 'avarias' | 'documentos'): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    const subfolder = bucket === 'avarias' ? 'fotos' : 'docs';
    
    for (const file of files) {
        try {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0]; // YYYYMMDDHHMMSS
            const randomId = Math.random().toString(36).substring(2, 7);
            const fileExt = file.name.split('.').pop();
            
            // Ex: ABC1234/fotos/ABC1234_20231027_153045_a1b2c.jpg
            const fileName = `${placa}/${subfolder}/${placa}_${timestamp}_${randomId}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);
            
            uploadedUrls.push(publicUrl);
        } catch (err: any) {
            throw err;
        }
    }
    return uploadedUrls;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa) {
        setError('A placa é obrigatória.');
        return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
        const placaFormatada = formData.placa.toUpperCase().trim();
        const anoInt = formData.ano ? parseInt(formData.ano, 10) : null;

        let fotoUrls: string[] = [];
        let docUrls: string[] = [];
        
        if (selectedFiles.length > 0) {
            fotoUrls = await uploadFiles(placaFormatada, selectedFiles, 'avarias');
        }

        if (selectedDocs.length > 0) {
            docUrls = await uploadFiles(placaFormatada, selectedDocs, 'documentos');
        }

        const payload = {
          p_ano: (anoInt !== null && !isNaN(anoInt)) ? anoInt : null,
          p_chassi: formData.chassi || null,
          p_cor: formData.cor || null,
          p_modelo: formData.modelo || null,
          p_observacoes: formData.observacoes || null,
          p_placa: placaFormatada,
          p_proprietario_bairro: formData.proprietarioBairro || null,
          p_proprietario_cep: formData.proprietarioCep || null,
          p_proprietario_cpf: formData.proprietarioCpf || null,
          p_proprietario_nome: formData.proprietarioNome || null,
          p_proprietario_numero: formData.proprietarioNumero || null,
          p_proprietario_rua: formData.proprietarioRua || null,
          p_proprietario_telefone: formData.proprietarioTelefone || null,
          p_renavam: formData.renavam || null,
          p_fotos_avaria_url: fotoUrls.length > 0 ? fotoUrls : [],
          p_documentos_url: docUrls.length > 0 ? docUrls : []
        };

        const { error: rpcError } = await supabase.rpc('create_new_vehicle_collection', payload);

        if (rpcError) throw rpcError;

        setSuccess(`Coleta para ${placaFormatada} solicitada com sucesso!`);
        setFormData(initialFormState);
        setSelectedFiles([]);
        setSelectedDocs([]);
        setPreviews([]);
        setTimeout(() => setCurrentPage('patio'), 2000);
    } catch (err: any) {
        setError(err.message || 'Erro ao processar solicitação.');
    } finally {
        setLoading(false);
    }
  }, [formData, selectedFiles, selectedDocs, setCurrentPage]);

  return (
    <div className="p-4 sm:p-8 h-full bg-gray-900 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Solicitar Nova Coleta</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8 pb-20">
          {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-xl text-center border border-red-500/50 font-bold">{error}</div>}
          {success && <div className="bg-green-500/20 text-green-300 p-4 rounded-xl text-center border border-green-500/50 font-bold">{success}</div>}

          {/* Seção: Dados do Veículo */}
          <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
            <legend className="px-4 text-xl font-bold text-blue-400">Dados do Veículo</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField label="Placa*" name="placa" value={formData.placa} onChange={handleChange} required placeholder="ABC-1234" />
              <InputField label="Modelo" name="modelo" value={formData.modelo} onChange={handleChange} placeholder="Ex: Onix" />
              <InputField label="Cor" name="cor" value={formData.cor} onChange={handleChange} placeholder="Ex: Branco" />
              <InputField label="Ano" name="ano" type="number" value={formData.ano} onChange={handleChange} placeholder="2024" />
              <InputField label="Chassi" name="chassi" value={formData.chassi} onChange={handleChange} />
              <InputField label="Renavam" name="renavam" value={formData.renavam} onChange={handleChange} />
            </div>

            {/* Upload de Fotos */}
            <div className="pt-4 border-t border-gray-700/50">
                <label className="block text-sm font-medium text-gray-300 mb-4">Fotos de Avaria / Estado do Veículo (Máx. 6)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {previews.map((preview, index) => (
                        <div key={index} className="relative aspect-square">
                            <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-xl border-2 border-gray-700" />
                            <button type="button" onClick={() => removeFile(index)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    ))}
                    {previews.length < 6 && (
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center hover:border-blue-500 hover:bg-gray-850 transition-all text-gray-500 hover:text-blue-400">
                            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            <span className="text-[10px] font-black uppercase">Adicionar Foto</span>
                        </button>
                    )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
            </div>

            {/* Upload de Documentos */}
            <div className="pt-4 border-t border-gray-700/50">
                <label className="block text-sm font-medium text-gray-300 mb-4">Documentos Oficiais (PDF / CNH / CRLV) (Máx. 5)</label>
                <div className="space-y-3">
                    {selectedDocs.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-700 group transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
                                    {doc.type.includes('pdf') ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-200 truncate">{doc.name}</p>
                                    <p className="text-[9px] text-gray-500 uppercase font-black">{(doc.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => removeDoc(index)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    ))}
                    
                    {selectedDocs.length < 5 && (
                        <button type="button" onClick={() => docInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl flex items-center justify-center gap-3 text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-all active:scale-[0.99]">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                             <span className="text-[10px] font-black uppercase tracking-widest">Anexar Documento</span>
                        </button>
                    )}
                </div>
                <input type="file" ref={docInputRef} onChange={handleDocChange} accept=".pdf,image/*" multiple className="hidden" />
            </div>

            <div className="space-y-2 mt-6">
                <label className="block text-sm font-medium text-gray-300">Observações Gerais</label>
                <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Informações adicionais..." />
            </div>
          </fieldset>
          
          <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
            <legend className="px-4 text-xl font-bold text-blue-400">Dados do Proprietário</legend>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <InputField label="Nome Completo" name="proprietarioNome" value={formData.proprietarioNome} onChange={handleChange} />
                 <InputField label="Telefone" name="proprietarioTelefone" value={formData.proprietarioTelefone} onChange={handleChange} placeholder="(00) 00000-0000" />
                 <InputField label="CPF" name="proprietarioCpf" value={formData.proprietarioCpf} onChange={handleChange} />
             </div>
             <div className="border-t border-gray-700 pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <InputField label="CEP" name="proprietarioCep" value={formData.proprietarioCep} onChange={handleChange} />
                <div className="md:col-span-2">
                    <InputField label="Rua / Logradouro" name="proprietarioRua" value={formData.proprietarioRua} onChange={handleChange} />
                </div>
                <InputField label="Número" name="proprietarioNumero" value={formData.proprietarioNumero} onChange={handleChange} />
                <div className="md:col-span-4">
                    <InputField label="Bairro" name="proprietarioBairro" value={formData.proprietarioBairro} onChange={handleChange} />
                </div>
             </div>
          </fieldset>

          <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Criar Solicitação de Coleta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SolicitacaoColeta;
