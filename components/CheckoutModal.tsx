
import React, { useState, useEffect, useMemo } from 'react';
import { Veiculo, Movimentacao } from '../types';
import { supabase } from '../services/supabase';
import { calcularTotalDiarias } from '../utils/calculations';

interface CheckoutModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
    onConfirm: (movimentacao: Movimentacao, totalPago: number) => Promise<void>;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ vehicle, onClose, onConfirm }) => {
    const [movimentacao, setMovimentacao] = useState<Movimentacao | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        const fetchMovimentacao = async () => {
            if (!vehicle) return;

            setLoading(true);
            setError(null);
            setMovimentacao(null);

            const { data, error } = await supabase
                .from('movimentacoes')
                .select('*')
                .eq('veiculo_id', vehicle.id)
                .is('data_saida', null) // Apenas movimentações abertas
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                setError('Não foi possível encontrar a movimentação de entrada para este veículo.');
            } else {
                setMovimentacao(data as Movimentacao);
            }
            setLoading(false);
        };

        fetchMovimentacao();
    }, [vehicle]);

    const checkoutData = useMemo(() => {
        if (!movimentacao || !movimentacao.data_entrada) {
            return { totalPagar: 0, diarias: 0 };
        }
        const dataSaida = new Date().toISOString();
        const total = calcularTotalDiarias(movimentacao.data_entrada, dataSaida, movimentacao.valor_diaria);
        const diarias = total > 0 ? total / movimentacao.valor_diaria : 0;
        return { totalPagar: total, diarias: Math.round(diarias) };
    }, [movimentacao]);

    if (!vehicle) return null;

    const handleConfirm = async () => {
        if (!movimentacao) return;

        setIsConfirming(true);
        setError(null);
        try {
            await onConfirm(movimentacao, checkoutData.totalPagar);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Ocorreu um erro inesperado.');
        } finally {
            setIsConfirming(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">Confirmar Checkout</h2>
                <div className="mb-4 bg-gray-700 p-3 rounded-md">
                    <p className="text-gray-400">Placa: <span className="font-mono text-lg bg-white text-black rounded-md px-2 py-1 inline-block mt-1">{vehicle.placa}</span></p>
                    <p className="text-gray-400 mt-2">Veículo: <span className="font-semibold text-white">{vehicle.modelo || 'Não informado'}</span></p>
                </div>
                
                {loading && <div className="text-center p-4">Buscando dados da movimentação...</div>}
                {error && !loading && <div className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</div>}

                {movimentacao && !loading && (
                    <div className="space-y-3 text-white">
                       <div className="flex justify-between p-3 bg-gray-900/50 rounded-md">
                            <span className="text-gray-400">Data de Check-in:</span>
                            <span className="font-semibold">{new Date(movimentacao.data_entrada!).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-900/50 rounded-md">
                            <span className="text-gray-400">Data de Checkout:</span>
                            <span className="font-semibold">{new Date().toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-900/50 rounded-md">
                            <span className="text-gray-400">Valor da Diária:</span>
                            <span className="font-semibold">{movimentacao.valor_diaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                         <div className="flex justify-between p-3 bg-gray-900/50 rounded-md">
                            <span className="text-gray-400">Total de Diárias a Cobrar:</span>
                            <span className="font-semibold">{checkoutData.diarias}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-blue-900/50 rounded-md text-lg border-t-2 border-blue-400">
                            <span className="font-bold">TOTAL A PAGAR:</span>
                            <span className="font-bold text-xl">{checkoutData.totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                )}
                
                {error && <p className="text-red-400 text-sm text-center pt-2">{error}</p>}
                
                <div className="mt-6 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold transition-colors"
                        disabled={isConfirming}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold transition-colors disabled:bg-red-800 disabled:cursor-not-allowed"
                        disabled={isConfirming || loading || !movimentacao}
                    >
                        {isConfirming ? 'Confirmando...' : 'Confirmar Checkout'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
