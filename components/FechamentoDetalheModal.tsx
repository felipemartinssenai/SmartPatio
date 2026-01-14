
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { FechamentoDetalhe } from '../types';
import { calcularTotalDiarias } from '../utils/calculations';

interface FechamentoDetalheModalProps {
    movimentacaoId: string | null;
    onClose: () => void;
    onUpdate: () => void;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input {...props} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all" />
    </div>
);

const FechamentoDetalheModal: React.FC<FechamentoDetalheModalProps> = ({ movimentacaoId, onClose, onUpdate }) => {
    const [details, setDetails] = useState<FechamentoDetalhe | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Gestão de Fotos
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const allPhotos = [...existingPhotos, ...previews];

    const fetchDetails = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        setDetails(null);

        const { data, error } = await supabase
            .from('movimentacoes')
            .select('*, veiculos(*)')
            .eq('id', id)
            .single();

        if (error || !data || !data.veiculos) {
            setError('Falha ao carregar os detalhes da movimentação.');
            setLoading(false);
            return;
        }
        
        const v = data.veiculos;
        const m = data;

        setDetails({
            movimentacao_id: m.id,
            veiculo_id: v.id,
            placa: v.placa,
            modelo: v.modelo || '',
            cor: v.cor || '',
            ano: v.ano,
            chassi: v.chassi || '',
            renavam: v.renavam || '',
            observacoes: v.observacoes || '',
            proprietario_nome: v.proprietario_nome || '',
            proprietario_telefone: v.proprietario_telefone || '',
            proprietario_cpf: v.proprietario_cpf || '',
            proprietario_cep: v.proprietario_cep || '',
            proprietario_rua: v.proprietario_rua || '',
            proprietario_bairro: v.proprietario_bairro || '',
            proprietario_numero: v.proprietario_numero || '',
            data_entrada: m.data_entrada ? new Date(m.data_entrada).toISOString().slice(0, 16) : '',
            data_saida: m.data_saida ? new Date(m.data_saida).toISOString().slice(0, 16) : '',
            valor_diaria: m.valor_diaria,
            total_pago: m.total_pago || 0,
        });
        setExistingPhotos(v.fotos_avaria_url || []);
        setPreviews([]);
        setSelectedFiles([]);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (movimentacaoId) {
            fetchDetails(movimentacaoId);
        }
    }, [movimentacaoId, fetchDetails]);

    // Recalcula o total a pagar automaticamente ao mudar datas ou valor diária
    useEffect(() => {
        if (!details) return;

        const { data_entrada, data_saida, valor_diaria } = details;
        if (data_entrada && data_saida && valor_diaria > 0) {
            const total = calcularTotalDiarias(
                new Date(data_entrada).toISOString(),
                new Date(data_saida).toISOString(),
                valor_diaria
            );
            setDetails(d => d ? { ...d, total_pago: total } : null);
        }
    }, [details?.data_entrada, details?.data_saida, details?.valor_diaria]);

    const calculatedDays = useMemo(() => {
        if (!details || !details.valor_diaria || details.valor_diaria <= 0 || details.total_pago <= 0) {
            return 0;
        }
        return Math.round(details.total_pago / details.valor_diaria);
    }, [details?.total_pago, details?.valor_diaria]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setDetails(prev => {
            if (!prev) return null;
            const newValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
            return { ...prev, [name]: newValue };
        });
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
    };

    const removeExistingFile = (index: number) => {
        setExistingPhotos(prev => prev.filter((_, i) => i !== index));
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

    const handleSave = async () => {
        if (!details) return;
        setSaving(true);
        setError(null);

        try {
            const placaFormatada = details.placa.toUpperCase().trim();
            const newUploadedUrls = await uploadNewImages(placaFormatada);
            const finalPhotoUrls = [...existingPhotos, ...newUploadedUrls];

            const vehicleUpdate = {
                placa: placaFormatada,
                modelo: details.modelo,
                cor: details.cor,
                ano: details.ano,
                chassi: details.chassi,
                renavam: details.renavam,
                observacoes: details.observacoes,
                proprietario_nome: details.proprietario_nome,
                proprietario_telefone: details.proprietario_telefone,
                proprietario_cpf: details.proprietario_cpf,
                proprietario_cep: details.proprietario_cep,
                proprietario_rua: details.proprietario_rua,
                proprietario_bairro: details.proprietario_bairro,
                proprietario_numero: details.proprietario_numero,
                fotos_avaria_url: finalPhotoUrls
            };

            const movementUpdate = {
                data_entrada: new Date(details.data_entrada).toISOString(),
                data_saida: new Date(details.data_saida).toISOString(),
                valor_diaria: details.valor_diaria,
                total_pago: details.total_pago,
            };

            await supabase
                .from('financeiro')
                .update({ valor: details.total_pago })
                .eq('movimentacao_id', details.movimentacao_id);

            const [vehicleResult, movementResult] = await Promise.all([
                supabase.from('veiculos').update(vehicleUpdate).eq('id', details.veiculo_id),
                supabase.from('movimentacoes').update(movementUpdate).eq('id', details.movimentacao_id)
            ]);

            if (vehicleResult.error) throw new Error(`Veículo: ${vehicleResult.error.message}`);
            if (movementResult.error) throw new Error(`Movimentação: ${movementResult.error.message}`);
            
            onUpdate();
        } catch(e: any) {
            setError(`Erro ao salvar: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };
    
    if (!movimentacaoId) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-[32px] w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            {details && <span className="bg-white text-black px-3 py-1 rounded-lg font-mono">{details.placa}</span>}
                            Detalhes do Fechamento
                        </h2>
                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Gestão Completa de Dados e Movimentação</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-900">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="font-black text-xs uppercase tracking-widest text-white">Carregando detalhes...</p>
                        </div>
                    )}

                    {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-xl text-center border border-red-500/50 font-bold">{error}</div>}

                    {details && !loading && (
                        <div className="space-y-8">
                            {/* Dados do Veículo (Igual SolicitacaoColeta) */}
                            <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
                                <legend className="px-4 text-xl font-bold text-blue-400">Dados do Veículo</legend>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Placa*" name="placa" value={details.placa} onChange={handleChange} required />
                                    <InputField label="Modelo" name="modelo" value={details.modelo} onChange={handleChange} />
                                    <InputField label="Cor" name="cor" value={details.cor} onChange={handleChange} />
                                    <InputField label="Ano" name="ano" type="number" value={details.ano || ''} onChange={handleChange} />
                                    <InputField label="Chassi" name="chassi" value={details.chassi} onChange={handleChange} />
                                    <InputField label="Renavam" name="renavam" value={details.renavam} onChange={handleChange} />
                                </div>

                                {/* Upload de Fotos (Igual SolicitacaoColeta / VehicleEditModal) */}
                                <div className="pt-4 border-t border-gray-700/50">
                                    <label className="block text-sm font-medium text-gray-300 mb-4 flex justify-between items-center">
                                        <span>Fotos de Avaria / Estado (Máx. 6)</span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Clique para ampliar</span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
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
                                        value={details.observacoes} 
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                                        rows={3}
                                    />
                                </div>
                            </fieldset>

                            {/* Dados do Proprietário (Igual SolicitacaoColeta) */}
                            <fieldset className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 space-y-6">
                                <legend className="px-4 text-xl font-bold text-blue-400">Dados do Proprietário</legend>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Nome Completo" name="proprietario_nome" value={details.proprietario_nome} onChange={handleChange} />
                                    <InputField label="Telefone" name="proprietario_telefone" value={details.proprietario_telefone} onChange={handleChange} />
                                    <InputField label="CPF/CNPJ" name="proprietario_cpf" value={details.proprietario_cpf} onChange={handleChange} />
                                </div>
                                <div className="border-t border-gray-700 pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <InputField label="CEP" name="proprietario_cep" value={details.proprietario_cep} onChange={handleChange} />
                                    <div className="md:col-span-2">
                                        <InputField label="Rua / Logradouro" name="proprietario_rua" value={details.proprietario_rua} onChange={handleChange} />
                                    </div>
                                    <InputField label="Número" name="proprietario_numero" value={details.proprietario_numero} onChange={handleChange} />
                                    <div className="md:col-span-4">
                                        <InputField label="Bairro" name="proprietario_bairro" value={details.proprietario_bairro} onChange={handleChange} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Dados da Movimentação */}
                            <fieldset className="bg-blue-600/5 p-6 rounded-2xl shadow-xl border border-blue-500/20 space-y-6">
                                <legend className="px-4 text-xl font-bold text-blue-400">Dados da Movimentação</legend>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField label="Data de Entrada" name="data_entrada" type="datetime-local" value={details.data_entrada} onChange={handleChange} />
                                    <InputField label="Data de Saída" name="data_saida" type="datetime-local" value={details.data_saida} onChange={handleChange} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-blue-500/10">
                                    <InputField label="Valor da Diária (R$)" name="valor_diaria" type="number" step="0.01" value={details.valor_diaria} onChange={handleChange} />
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Total de Diárias</label>
                                        <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-bold">{calculatedDays}</div>
                                    </div>
                                    <InputField label="Total Pago (R$)" name="total_pago" type="number" step="0.01" value={details.total_pago} onChange={handleChange} />
                                </div>
                            </fieldset>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-6 border-t border-gray-700 bg-gray-900/80 backdrop-blur-md flex gap-3">
                    <button onClick={onClose} disabled={saving} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={loading || saving || !details} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Visualizador de Imagens Overlay (Igual VehicleEditModal) */}
            {viewerIndex !== null && (
                <div className="fixed inset-0 z-[6000] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewerIndex(null)}>
                    <button 
                        onClick={() => setViewerIndex(null)}
                        className="absolute top-6 right-6 p-4 bg-gray-800/50 hover:bg-gray-700 rounded-full text-white transition-all z-10"
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <div className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img src={allPhotos[viewerIndex]} alt="Visualização" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                        {allPhotos.length > 1 && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex - 1 + allPhotos.length) % allPhotos.length); }} className="absolute left-0 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all -ml-2 sm:-ml-12">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex + 1) % allPhotos.length); }} className="absolute right-0 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all -mr-2 sm:-mr-12">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FechamentoDetalheModal;
