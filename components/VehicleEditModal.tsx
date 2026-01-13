
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';

interface VehicleEditModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
    onSave: () => void;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <input
          {...props}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
    </div>
);

const VehicleEditModal: React.FC<VehicleEditModalProps> = ({ vehicle, onClose, onSave }) => {
    const [formData, setFormData] = useState<any>({});
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (vehicle) {
            setFormData({
                placa: vehicle.placa || '',
                modelo: vehicle.modelo || '',
                cor: vehicle.cor || '',
                ano: vehicle.ano?.toString() || '',
                chassi: vehicle.chassi || '',
                renavam: vehicle.renavam || '',
                observacoes: vehicle.observacoes || '',
                proprietarioNome: vehicle.proprietario_nome || '',
                proprietarioTelefone: vehicle.proprietario_telefone || '',
                proprietarioCpf: vehicle.proprietario_cpf || '',
                proprietarioCep: vehicle.proprietario_cep || '',
                proprietarioRua: vehicle.proprietario_rua || '',
                proprietarioBairro: vehicle.proprietario_bairro || '',
                proprietarioNumero: vehicle.proprietario_numero || '',
            });
            setExistingPhotos(vehicle.fotos_avaria_url || []);
            setPreviews([]);
            setSelectedFiles([]);
            setError(null);
        }
    }, [vehicle]);

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
            setFormData((prev: any) => ({ ...prev, [name]: maskPhone(value) }));
        } else {
            setFormData((prev: any) => ({ ...prev, [name]: value }));
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const totalPhotos = existingPhotos.length + previews.length + files.length;
        
        if (totalPhotos > 6) {
            setError('Limite máximo de 6 fotos por veículo.');
            return;
        }

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setSelectedFiles(prev => [...prev, ...files]);
        setPreviews(prev => [...prev, ...newPreviews]);
        setError(null);
    };

    const removeNewFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingFile = (index: number) => {
        setExistingPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const uploadNewImages = async (placa: string): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        for (const file of selectedFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${placa}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('veiculos_fotos').upload(fileName, file);
            if (uploadError) {
                console.error("Erro no upload:", uploadError);
                continue;
            }
            const { data: { publicUrl } } = supabase.storage.from('veiculos_fotos').getPublicUrl(fileName);
            uploadedUrls.push(publicUrl);
        }
        return uploadedUrls;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicle) return;
        setLoading(true);
        setError(null);

        try {
            const placaFormatada = formData.placa.toUpperCase().trim();
            const newUploadedUrls = await uploadNewImages(placaFormatada);
            const finalPhotoUrls = [...existingPhotos, ...newUploadedUrls];

            const { error: updateError } = await supabase
                .from('veiculos')
                .update({
                    placa: placaFormatada,
                    modelo: formData.modelo,
                    cor: formData.cor,
                    ano: formData.ano ? parseInt(formData.ano, 10) : null,
                    chassi: formData.chassi,
                    renavam: formData.renavam,
                    observacoes: formData.observacoes,
                    proprietario_nome: formData.proprietarioNome,
                    proprietario_telefone: formData.proprietarioTelefone,
                    proprietario_cpf: formData.proprietarioCpf,
                    proprietario_cep: formData.proprietarioCep,
                    proprietario_rua: formData.proprietarioRua,
                    proprietario_bairro: formData.proprietarioBairro,
                    proprietario_numero: formData.proprietarioNumero,
                    fotos_avaria_url: finalPhotoUrls
                })
                .eq('id', vehicle.id);

            if (updateError) throw updateError;
            onSave();
            onClose();
        } catch (err: any) {
            setError(`Erro ao salvar: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!vehicle) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-[32px] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header idêntico à tela de Solicitação */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="bg-white text-black px-3 py-1 rounded-lg font-mono">{vehicle.placa}</span>
                        Editar Veículo
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Corpo do Modal - Reutilizando visual de SolicitaçãoColeta */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-900">
                    <form onSubmit={handleSave} id="edit-vehicle-form" className="space-y-8 pb-10">
                        {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-xl text-center border border-red-500/50 font-bold">{error}</div>}

                        {/* Seção: Dados do Veículo */}
                        <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
                            <legend className="px-4 text-xl font-bold text-blue-400">Dados do Veículo</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField label="Placa*" name="placa" value={formData.placa} onChange={handleChange} required />
                                <InputField label="Modelo" name="modelo" value={formData.modelo} onChange={handleChange} />
                                <InputField label="Cor" name="cor" value={formData.cor} onChange={handleChange} />
                                <InputField label="Ano" name="ano" type="number" value={formData.ano} onChange={handleChange} />
                                <InputField label="Chassi" name="chassi" value={formData.chassi} onChange={handleChange} />
                                <InputField label="Renavam" name="renavam" value={formData.renavam} onChange={handleChange} />
                            </div>

                            {/* Área de Fotos (Idêntica à Solicitação) */}
                            <div className="pt-4 border-t border-gray-700/50">
                                <label className="block text-sm font-medium text-gray-300 mb-4">Fotos de Avaria / Estado do Veículo (Máx. 6)</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                    {/* Fotos já salvas */}
                                    {existingPhotos.map((url, index) => (
                                        <div key={`existing-${index}`} className="relative aspect-square group">
                                            <img src={url} alt="Salva" className="w-full h-full object-cover rounded-xl border-2 border-blue-500/50 shadow-lg" />
                                            <button 
                                                type="button"
                                                onClick={() => removeExistingFile(index)}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {/* Novas fotos (previews) */}
                                    {previews.map((preview, index) => (
                                        <div key={`new-${index}`} className="relative aspect-square group">
                                            <img src={preview} alt="Nova" className="w-full h-full object-cover rounded-xl border-2 border-green-500/50 shadow-lg" />
                                            <button 
                                                type="button"
                                                onClick={() => removeNewFile(index)}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {(existingPhotos.length + previews.length) < 6 && (
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center hover:border-blue-500 text-gray-500 hover:text-blue-400 transition-all shadow-inner"
                                        >
                                            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                            <span className="text-[10px] font-black uppercase">Adicionar</span>
                                        </button>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300">Observações Gerais</label>
                                <textarea 
                                    name="observacoes" 
                                    value={formData.observacoes} 
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                                    rows={3}
                                />
                            </div>
                        </fieldset>

                        {/* Seção: Dados do Proprietário */}
                        <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
                            <legend className="px-4 text-xl font-bold text-blue-400">Dados do Proprietário</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField label="Nome Completo" name="proprietarioNome" value={formData.proprietarioNome} onChange={handleChange} />
                                <InputField label="Telefone" name="proprietarioTelefone" value={formData.proprietarioTelefone} onChange={handleChange} />
                                <InputField label="CPF/CNPJ" name="proprietarioCpf" value={formData.proprietarioCpf} onChange={handleChange} />
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
                    </form>
                </div>

                {/* Footer Modal */}
                <div className="p-6 border-t border-gray-700 flex gap-3 bg-gray-900/80 backdrop-blur-md">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        form="edit-vehicle-form"
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleEditModal;
