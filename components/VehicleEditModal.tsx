
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
    
    // Estados para o Visualizador de Imagens
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    const allPhotos = [...existingPhotos, ...previews];

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

        const newPreviews = files.map(file => URL.createObjectURL(file as Blob));
        setSelectedFiles(prev => [...prev, ...files]);
        setPreviews(prev => [...prev, ...newPreviews]);
        setError(null);
    };

    const removeNewFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
        if (viewerIndex !== null) setViewerIndex(null);
    };

    const removeExistingFile = (index: number) => {
        setExistingPhotos(prev => prev.filter((_, i) => i !== index));
        if (viewerIndex !== null) setViewerIndex(null);
    };

    const uploadNewImages = async (placa: string): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        for (const file of selectedFiles) {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${placa}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avarias').upload(fileName, file);
                
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = supabase.storage.from('avarias').getPublicUrl(fileName);
                uploadedUrls.push(publicUrl);
            } catch (err: any) {
                throw err;
            }
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
            const anoInt = formData.ano ? parseInt(formData.ano, 10) : null;
            const anoValido = (anoInt !== null && !isNaN(anoInt)) ? anoInt : null;

            const newUploadedUrls = await uploadNewImages(placaFormatada);
            const finalPhotoUrls = [...existingPhotos, ...newUploadedUrls];

            const { error: updateError } = await supabase
                .from('veiculos')
                .update({
                    placa: placaFormatada,
                    modelo: formData.modelo || null,
                    cor: formData.cor || null,
                    ano: anoValido,
                    chassi: formData.chassi || null,
                    renavam: formData.renavam || null,
                    observacoes: formData.observacoes || null,
                    proprietario_nome: formData.proprietarioNome || null,
                    proprietario_telefone: formData.proprietario_telefone || null,
                    proprietario_cpf: formData.proprietarioCpf || null,
                    proprietario_cep: formData.proprietarioCep || null,
                    proprietario_rua: formData.proprietarioRua || null,
                    proprietario_bairro: formData.proprietarioBairro || null,
                    proprietario_numero: formData.proprietarioNumero || null,
                    fotos_avaria_url: finalPhotoUrls
                })
                .eq('id', vehicle.id);

            if (updateError) throw updateError;
            onSave();
            onClose();
        } catch (err: any) {
            let message = 'Erro ao salvar veículo.';
            if (typeof err === 'string') message = err;
            else if (err.message) message = err.message;
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const nextImage = () => {
        if (viewerIndex === null) return;
        setViewerIndex((viewerIndex + 1) % allPhotos.length);
    };

    const prevImage = () => {
        if (viewerIndex === null) return;
        setViewerIndex((viewerIndex - 1 + allPhotos.length) % allPhotos.length);
    };

    if (!vehicle) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-[32px] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
                
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="bg-white text-black px-3 py-1 rounded-lg font-mono">{vehicle.placa}</span>
                        Editar Veículo
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-900">
                    <form onSubmit={handleSave} id="edit-vehicle-form" className="space-y-8 pb-10">
                        {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-xl text-center border border-red-500/50 font-bold">{error}</div>}

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

                            <div className="pt-4 border-t border-gray-700/50">
                                <label className="block text-sm font-medium text-gray-300 mb-4 flex justify-between items-center">
                                    <span>Fotos de Avaria / Estado (Máx. 6)</span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Clique para ampliar</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                    {/* Fotos já salvas */}
                                    {existingPhotos.map((url, index) => (
                                        <div key={`existing-${index}`} className="relative aspect-square group cursor-pointer">
                                            <img 
                                                src={url} 
                                                alt="Salva" 
                                                onClick={() => setViewerIndex(index)}
                                                className="w-full h-full object-cover rounded-xl border-2 border-blue-500/50 shadow-lg hover:border-blue-400 transition-all" 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => removeExistingFile(index)}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors z-10"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {/* Novas fotos */}
                                    {previews.map((preview, index) => (
                                        <div key={`new-${index}`} className="relative aspect-square group cursor-pointer">
                                            <img 
                                                src={preview} 
                                                alt="Nova" 
                                                onClick={() => setViewerIndex(existingPhotos.length + index)}
                                                className="w-full h-full object-cover rounded-xl border-2 border-green-500/50 shadow-lg hover:border-green-400 transition-all" 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => removeNewFile(index)}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors z-10"
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

            {/* Image Viewer Overlay */}
            {viewerIndex !== null && (
                <div className="fixed inset-0 z-[6000] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewerIndex(null)}>
                    
                    {/* Botão Fechar */}
                    <button 
                        onClick={() => setViewerIndex(null)}
                        className="absolute top-6 right-6 p-4 bg-gray-800/50 hover:bg-gray-700 rounded-full text-white transition-all z-10"
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    {/* Imagem Principal */}
                    <div className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img 
                            src={allPhotos[viewerIndex]} 
                            alt="Visualização" 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />

                        {/* Setas de Navegação */}
                        {allPhotos.length > 1 && (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all -ml-2 sm:-ml-12"
                                >
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all -mr-2 sm:-mr-12"
                                >
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Indicador de Posição */}
                    <div className="mt-8 px-6 py-2 bg-gray-800 rounded-full text-white font-black text-sm uppercase tracking-widest border border-gray-700 shadow-xl">
                        Foto {viewerIndex + 1} de {allPhotos.length}
                    </div>

                    {/* Miniaturas Inferiores para Navegação Rápida */}
                    <div className="mt-6 flex gap-2 overflow-x-auto p-2 max-w-full no-scrollbar" onClick={e => e.stopPropagation()}>
                        {allPhotos.map((url, idx) => (
                            <button
                                key={idx}
                                onClick={() => setViewerIndex(idx)}
                                className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${viewerIndex === idx ? 'border-blue-500 scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}
                            >
                                <img src={url} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleEditModal;
