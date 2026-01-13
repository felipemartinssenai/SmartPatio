
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { FechamentoDetalhe } from '../types';
import { calcularTotalDiarias } from '../utils/calculations';

interface FechamentoDetalheModalProps {
    movimentacaoId: string | null;
    onClose: () => void;
    onUpdate: () => void;
}

// FIX: Moved InputField outside of the main component to prevent it from being
// recreated on every render, which was causing the input fields to lose focus.
const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input {...props} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed" />
    </div>
);

const FechamentoDetalheModal: React.FC<FechamentoDetalheModalProps> = ({ movimentacaoId, onClose, onUpdate }) => {
    const [details, setDetails] = useState<FechamentoDetalhe | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        setLoading(false);
    }, []);

    useEffect(() => {
        if (movimentacaoId) {
            fetchDetails(movimentacaoId);
        }
    }, [movimentacaoId, fetchDetails]);

    // Recalcula o total a pagar
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
        // Use Math.round to handle potential floating point inaccuracies from division
        return Math.round(details.total_pago / details.valor_diaria);
    }, [details?.total_pago, details?.valor_diaria]);


    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setDetails(prev => {
            if (!prev) return null;
            // Handle empty number field gracefully
            const newValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
            return { ...prev, [name]: newValue };
        });
    }, []);

    const handleSave = async () => {
        if (!details) return;
        setSaving(true);
        setError(null);

        try {
            const vehicleUpdate = {
                placa: details.placa, modelo: details.modelo, cor: details.cor, ano: details.ano,
                chassi: details.chassi, renavam: details.renavam, observacoes: details.observacoes,
                proprietario_nome: details.proprietario_nome, proprietario_telefone: details.proprietario_telefone,
                proprietario_cpf: details.proprietario_cpf, proprietario_cep: details.proprietario_cep,
                proprietario_rua: details.proprietario_rua, proprietario_bairro: details.proprietario_bairro,
                proprietario_numero: details.proprietario_numero,
            };

            const movementUpdate = {
                data_entrada: new Date(details.data_entrada).toISOString(),
                data_saida: new Date(details.data_saida).toISOString(),
                valor_diaria: details.valor_diaria,
                total_pago: details.total_pago,
            };

            // Update financial record if total_pago changed
            // FIX: Removed the incorrect comparison (details.total_pago !== movimentacaoId).
            // We'll update the financial record to match the new total_pago value whenever saving.
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-4">Detalhes do Fechamento</h2>
                {loading && <div className="text-center p-8">Carregando...</div>}
                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md text-center my-4">{error}</div>}
                
                {details && (
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                        {/* Dados do Veículo */}
                        <fieldset className="border border-gray-700 p-4 rounded-lg">
                            <legend className="px-2 text-lg font-semibold text-white">Dados do Veículo</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <InputField label="Placa" id="placa" name="placa" value={details.placa} onChange={handleChange} />
                                <InputField label="Modelo" id="modelo" name="modelo" value={details.modelo} onChange={handleChange} />
                                <InputField label="Cor" id="cor" name="cor" value={details.cor} onChange={handleChange} />
                                <InputField label="Ano" id="ano" name="ano" type="number" value={details.ano || ''} onChange={handleChange} />
                                <InputField label="Chassi" id="chassi" name="chassi" value={details.chassi} onChange={handleChange} />
                                <InputField label="Renavam" id="renavam" name="renavam" value={details.renavam} onChange={handleChange} />
                                <div className="md:col-span-3">
                                    <label htmlFor="observacoes" className="block text-sm font-medium text-gray-300 mb-1">Observações</label>
                                    <textarea
                                        id="observacoes"
                                        name="observacoes"
                                        value={details.observacoes}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </fieldset>

                        {/* Dados do Proprietário */}
                        <fieldset className="border border-gray-700 p-4 rounded-lg">
                            <legend className="px-2 text-lg font-semibold text-white">Dados do Proprietário</legend>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <InputField label="Nome" id="proprietario_nome" name="proprietario_nome" value={details.proprietario_nome} onChange={handleChange} />
                                <InputField label="Telefone" id="proprietario_telefone" name="proprietario_telefone" value={details.proprietario_telefone} onChange={handleChange} />
                                <InputField label="CPF" id="proprietario_cpf" name="proprietario_cpf" value={details.proprietario_cpf} onChange={handleChange} />
                                <InputField label="CEP" id="proprietario_cep" name="proprietario_cep" value={details.proprietario_cep} onChange={handleChange} />
                                <InputField label="Rua" id="proprietario_rua" name="proprietario_rua" value={details.proprietario_rua} onChange={handleChange} />
                                <InputField label="Bairro" id="proprietario_bairro" name="proprietario_bairro" value={details.proprietario_bairro} onChange={handleChange} />
                                <InputField label="Nº" id="proprietario_numero" name="proprietario_numero" value={details.proprietario_numero} onChange={handleChange} />
                            </div>
                        </fieldset>

                        {/* Detalhes da Movimentação */}
                        <fieldset className="border border-gray-700 p-4 rounded-lg">
                            <legend className="px-2 text-lg font-semibold text-white">Detalhes da Movimentação</legend>
                            <div className="space-y-4 mt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField label="Check-in" id="data_entrada" name="data_entrada" type="datetime-local" value={details.data_entrada} onChange={handleChange} />
                                    <InputField label="Checkout" id="data_saida" name="data_saida" type="datetime-local" value={details.data_saida} onChange={handleChange} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <InputField label="Valor Diária (R$)" id="valor_diaria" name="valor_diaria" type="number" step="0.01" value={details.valor_diaria} onChange={handleChange} />
                                    <InputField label="Total de Diárias" id="diarias" name="diarias" type="number" value={calculatedDays} disabled />
                                    <InputField label="Total Pago (R$)" id="total_pago" name="total_pago" type="number" step="0.01" value={details.total_pago} onChange={handleChange} />
                                </div>
                            </div>
                        </fieldset>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-4 border-t border-gray-700 pt-4">
                    <button onClick={onClose} disabled={saving} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={loading || saving || !details} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-semibold transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FechamentoDetalheModal;
