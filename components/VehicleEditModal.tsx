
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';

interface VehicleEditModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
    onSave: () => void;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
        <input
            {...props}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-sm shadow-inner"
        />
    </div>
);

const VehicleEditModal: React.FC<VehicleEditModalProps> = ({ vehicle, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Veiculo>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (vehicle) {
            setFormData({ ...vehicle });
            setError(null);
        }
    }, [vehicle]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!vehicle) return;
        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('veiculos')
                .update({
                    modelo: formData.modelo,
                    cor: formData.cor,
                    ano: formData.ano,
                    chassi: formData.chassi,
                    renavam: formData.renavam,
                    observacoes: formData.observacoes,
                    proprietario_nome: formData.proprietario_nome,
                    proprietario_telefone: formData.proprietario_telefone,
                    proprietario_cpf: formData.proprietario_cpf,
                    proprietario_cep: formData.proprietario_cep,
                    proprietario_rua: formData.proprietario_rua,
                    proprietario_bairro: formData.proprietario_bairro,
                    proprietario_numero: formData.proprietario_numero,
                })
                .eq('id', vehicle.id);

            if (updateError) throw updateError;
            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar dados.');
        } finally {
            setLoading(false);
        }
    };

    if (!vehicle) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-[32px] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header Fixo */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="bg-white text-black px-3 py-1 rounded-lg font-mono">{vehicle.placa}</span>
                            Detalhes do Veículo
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-bold uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    {/* Galeria de Fotos */}
                    {vehicle.fotos_avaria_url && vehicle.fotos_avaria_url.length > 0 && (
                        <section>
                            <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Galeria de Fotos</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {vehicle.fotos_avaria_url.map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-2xl overflow-hidden border-2 border-gray-700 hover:border-blue-500 transition-all shadow-lg group">
                                        <img src={url} alt={`Avaria ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Dados Técnicos */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Informações Técnicas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputField label="Modelo" name="modelo" value={formData.modelo || ''} onChange={handleChange} />
                            <InputField label="Cor" name="cor" value={formData.cor || ''} onChange={handleChange} />
                            <InputField label="Ano" name="ano" type="number" value={formData.ano || ''} onChange={handleChange} />
                            <InputField label="Chassi" name="chassi" value={formData.chassi || ''} onChange={handleChange} />
                            <InputField label="Renavam" name="renavam" value={formData.renavam || ''} onChange={handleChange} />
                        </div>
                    </section>

                    {/* Proprietário */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Dados do Proprietário</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputField label="Nome Completo" name="proprietario_nome" value={formData.proprietario_nome || ''} onChange={handleChange} />
                            <InputField label="Telefone" name="proprietario_telefone" value={formData.proprietario_telefone || ''} onChange={handleChange} />
                            <InputField label="CPF/CNPJ" name="proprietario_cpf" value={formData.proprietario_cpf || ''} onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <InputField label="CEP" name="proprietario_cep" value={formData.proprietario_cep || ''} onChange={handleChange} />
                            <div className="md:col-span-2">
                                <InputField label="Rua / Logradouro" name="proprietario_rua" value={formData.proprietario_rua || ''} onChange={handleChange} />
                            </div>
                            <InputField label="Número" name="proprietario_numero" value={formData.proprietario_numero || ''} onChange={handleChange} />
                        </div>
                    </section>

                    {/* Observações */}
                    <section>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Observações Gerais</label>
                        <textarea
                            name="observacoes"
                            value={formData.observacoes || ''}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all text-sm shadow-inner resize-none"
                            placeholder="Descreva aqui detalhes sobre o estado do veículo no momento da coleta..."
                        />
                    </section>
                </div>

                {/* Footer Fixo */}
                <div className="p-6 border-t border-gray-700 flex gap-3 bg-gray-900/50">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all"
                    >
                        Fechar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleEditModal;
