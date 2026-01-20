
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
    
    const [selectedDocs, setSelectedDocs] = useState<File[]>([]);
    const [existingDocs, setExistingDocs] = useState<string[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
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
            setExistingDocs(vehicle.documentos_url || []);
            setPreviews([]);
            setSelectedFiles([]);
            setSelectedDocs([]);
            setError(null);
        }
    }, [vehicle]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (existingPhotos.length + previews.length + files.length > 6) {
            setError('Limite máximo de 6 fotos.');
            return;
        }
        const newPreviews = files.map(file => URL.createObjectURL(file as Blob));
        setSelectedFiles(prev => [...prev, ...files]);
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (existingDocs.length + selectedDocs.length + files.length > 5) {
            setError('Limite máximo de 5 documentos.');
            return;
        }
        setSelectedDocs(prev => [...prev, ...files]);
    };

    const removeNewFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingFile = (index: number) => setExistingPhotos(prev => prev.filter((_, i) => i !== index));
    const removeExistingDoc = (index: number) => setExistingDocs(prev => prev.filter((_, i) => i !== index));
    const removeNewDoc = (index: number) => setSelectedDocs(prev => prev.filter((_, i) => i !== index));

    const uploadFiles = async (placa: string, files: File[], bucket: 'avarias' | 'documentos'): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${placa}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
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
            const anoInt = formData.ano ? parseInt(formData.ano, 10) : null;

            const newUploadedPhotos = await uploadFiles(placaFormatada, selectedFiles, 'avarias');
            const newUploadedDocs = await uploadFiles(placaFormatada, selectedDocs, 'documentos');

            const { error: updateError } = await supabase
                .from('veiculos')
                .update({
                    placa: placaFormatada,
                    modelo: formData.modelo,
                    cor: formData.cor,
                    ano: (anoInt && !isNaN(anoInt)) ? anoInt : null,
                    chassi: formData.chassi,
                    renavam: formData.renavam,
                    observacoes: formData.observacoes,
                    proprietario_nome: formData.proprietarioNome,
                    proprietario_telefone: formData.proprietarioTelefone,
                    fotos_avaria_url: [...existingPhotos, ...newUploadedPhotos],
                    documentos_url: [...existingDocs, ...newUploadedDocs]
                })
                .eq('id', vehicle.id);

            if (updateError) throw updateError;
            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar alterações.');
        } finally {
            setLoading(false);
        }
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
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full text-gray-400"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-900">
                    <form onSubmit={handleSave} id="edit-vehicle-form" className="space-y-8">
                        {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-xl text-center border border-red-500/50 font-bold">{error}</div>}

                        <fieldset className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-6">
                            <legend className="px-4 text-xl font-bold text-blue-400">Dados Gerais</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField label="Placa" name="placa" value={formData.placa} onChange={handleChange} />
                                <InputField label="Modelo" name="modelo" value={formData.modelo} onChange={handleChange} />
                                <InputField label="Cor" name="cor" value={formData.cor} onChange={handleChange} />
                            </div>

                            {/* Fotos */}
                            <div className="pt-4 border-t border-gray-700/50">
                                <label className="block text-sm font-medium text-gray-300 mb-4">Fotos (Avarias)</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                    {existingPhotos.map((url, idx) => (
                                        <div key={`ex-${idx}`} className="relative aspect-square">
                                            <img src={url} className="w-full h-full object-cover rounded-xl border border-blue-500/50" />
                                            <button type="button" onClick={() => removeExistingFile(idx)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                        </div>
                                    ))}
                                    {previews.map((preview, idx) => (
                                        <div key={`new-${idx}`} className="relative aspect-square">
                                            <img src={preview} className="w-full h-full object-cover rounded-xl border border-green-500/50" />
                                            <button type="button" onClick={() => removeNewFile(idx)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                        </div>
                                    ))}
                                    {(existingPhotos.length + previews.length) < 6 && (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center text-gray-500 hover:border-blue-500"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg></button>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                            </div>

                            {/* Documentos */}
                            <div className="pt-4 border-t border-gray-700/50">
                                <label className="block text-sm font-medium text-gray-300 mb-4">Documentos</label>
                                <div className="space-y-3">
                                    {existingDocs.map((url, idx) => (
                                        <div key={`exd-${idx}`} className="flex items-center justify-between p-3 bg-gray-900 rounded-xl border border-blue-500/20">
                                            <span className="text-xs font-bold text-gray-400 truncate">Documento Salvo #{idx + 1}</span>
                                            <div className="flex gap-2">
                                                <a href={url} target="_blank" className="p-2 text-blue-400 hover:bg-blue-600/10 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></a>
                                                <button type="button" onClick={() => removeExistingDoc(idx)} className="p-2 text-red-500 hover:bg-red-600/10 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                            </div>
                                        </div>
                                    ))}
                                    {selectedDocs.map((doc, idx) => (
                                        <div key={`newd-${idx}`} className="flex items-center justify-between p-3 bg-green-500/5 rounded-xl border border-green-500/20">
                                            <span className="text-xs font-bold text-green-400 truncate">{doc.name}</span>
                                            <button type="button" onClick={() => removeNewDoc(idx)} className="p-2 text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                        </div>
                                    ))}
                                    {(existingDocs.length + selectedDocs.length) < 5 && (
                                        <button type="button" onClick={() => docInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 text-[10px] font-black uppercase hover:border-blue-500">Adicionar Documento</button>
                                    )}
                                </div>
                                <input type="file" ref={docInputRef} onChange={handleDocChange} accept=".pdf,image/*" multiple className="hidden" />
                            </div>
                        </fieldset>
                    </form>
                </div>

                <div className="p-6 border-t border-gray-700 flex gap-3 bg-gray-900/80">
                    <button onClick={onClose} className="flex-1 py-4 bg-gray-700 rounded-2xl text-white font-black uppercase text-xs">Cancelar</button>
                    <button form="edit-vehicle-form" type="submit" disabled={loading} className="flex-1 py-4 bg-blue-600 rounded-2xl text-white font-black uppercase text-xs shadow-xl shadow-blue-900/20">
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleEditModal;
