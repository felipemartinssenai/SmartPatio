
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setError(null);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (placa: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${placa}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error: uploadError } = await supabase.storage
            .from('veiculos_fotos')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('Erro no upload de foto:', uploadError);
            continue;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('veiculos_fotos')
            .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrl);
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
        let fotoUrls: string[] = [];
        
        // 1. Upload das Fotos se houverem
        if (selectedFiles.length > 0) {
            fotoUrls = await uploadImages(placaFormatada);
        }

        // 2. Chamada RPC com URLs das fotos
        const payload = {
          p_ano: formData.ano ? parseInt(formData.ano, 10) : null,
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
          p_fotos_avaria_url: fotoUrls.length > 0 ? fotoUrls : null
        };

        const { error: rpcError } = await supabase.rpc('create_new_vehicle_collection', payload);

        if (rpcError) throw rpcError;

        setSuccess(`Coleta para ${placaFormatada} solicitada com sucesso!`);
        setFormData(initialFormState);
        setSelectedFiles([]);
        setPreviews([]);
        setTimeout(() => setCurrentPage('patio'), 2000);
    } catch (err: any) {
        console.error('Erro na solicitação:', err);
        setError(`Erro ao salvar: ${err.message}`);
    } finally {
        setLoading(false);
    }
  }, [formData, selectedFiles, setCurrentPage]);

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
                        <div key={index} className="relative aspect-square group">
                            <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-xl border-2 border-gray-700" />
                            <button 
                                type="button"
                                onClick={() => removeFile(index)}
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    ))}
                    
                    {previews.length < 6 && (
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center hover:border-blue-500 hover:bg-gray-850 transition-all text-gray-500 hover:text-blue-400"
                        >
                            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            <span className="text-[10px] font-black uppercase">Adicionar</span>
                        </button>
                    )}
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Observações Gerais</label>
                <textarea 
                    name="observacoes" 
                    value={formData.observacoes} 
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Informações adicionais sobre o estado do veículo ou local da coleta..."
                />
            </div>
          </fieldset>
          
          {/* Seção: Dados do Proprietário */}
          <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
            <legend className="px-4 text-xl font-bold text-blue-400">Dados do Proprietário</legend>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <InputField label="Nome Completo" name="proprietarioNome" value={formData.proprietarioNome} onChange={handleChange} />
                 <InputField label="Telefone" name="proprietarioTelefone" value={formData.proprietarioTelefone} onChange={handleChange} placeholder="(00) 00000-0000" />
                 <InputField label="CPF" name="proprietarioCpf" value={formData.proprietarioCpf} onChange={handleChange} placeholder="000.000.000-00" />
             </div>

             <div className="border-t border-gray-700 pt-6">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                        <InputField label="CEP" name="proprietarioCep" value={formData.proprietarioCep} onChange={handleChange} placeholder="00000-000" />
                    </div>
                    <div className="md:col-span-2">
                        <InputField label="Rua / Logradouro" name="proprietarioRua" value={formData.proprietarioRua} onChange={handleChange} />
                    </div>
                    <div className="md:col-span-1">
                        <InputField label="Número" name="proprietarioNumero" value={formData.proprietarioNumero} onChange={handleChange} />
                    </div>
                    <div className="md:col-span-4">
                        <InputField label="Bairro" name="proprietarioBairro" value={formData.proprietarioBairro} onChange={handleChange} />
                    </div>
                </div>
             </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
                <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enviando Dados e Fotos...
                </>
            ) : 'Criar Solicitação de Coleta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SolicitacaoColeta;
