
import React, { useState, useEffect, useMemo } from 'react';
import { Veiculo, Movimentacao, FormaPagamento } from '../types';
import { supabase } from '../services/supabase';
import { calcularTotalDiarias } from '../utils/calculations';

interface CheckoutModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
    onConfirm: (movimentacao: Movimentacao, totalPago: number, formaPagamento: string) => Promise<void>;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ vehicle, onClose, onConfirm }) => {
    const [movimentacao, setMovimentacao] = useState<Movimentacao | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<FormaPagamento[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!vehicle) return;

            setLoading(true);
            setError(null);
            setMovimentacao(null);

            // Fetch Movimentação and Payment Methods in parallel
            const [movResponse, paymentResponse] = await Promise.all([
                supabase
                    .from('movimentacoes')
                    .select('*')
                    .eq('veiculo_id', vehicle.id)
                    .is('data_saida', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single(),
                supabase
                    .from('formas_pagamento')
                    .select('*')
                    .eq('ativa', true)
                    .order('nome')
            ]);

            if (movResponse.error || !movResponse.data) {
                setError('Não foi possível encontrar a movimentação de entrada para este veículo.');
            } else {
                setMovimentacao(movResponse.data as Movimentacao);
            }

            if (!paymentResponse.error && paymentResponse.data) {
                const methods = paymentResponse.data as FormaPagamento[];
                setPaymentMethods(methods);
                if (methods.length > 0) setSelectedPaymentMethod(methods[0].nome);
            }

            setLoading(false);
        };

        fetchData();
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
        if (!selectedPaymentMethod) {
            setError('Selecione uma forma de pagamento.');
            return;
        }

        setIsConfirming(true);
        setError(null);
        try {
            await onConfirm(movimentacao, checkoutData.totalPagar, selectedPaymentMethod);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Ocorreu um erro inesperado.');
        } finally {
            setIsConfirming(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="bg-white text-black px-3 py-1 rounded-lg font-mono">{vehicle.placa}</span>
                            Confirmar Checkout
                        </h2>
                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Finalização de Estadia e Cobrança</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gray-900">
                    
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="font-black text-xs uppercase tracking-widest text-white">Calculando diárias...</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="bg-red-500/20 text-red-300 p-4 rounded-xl text-center border border-red-500/50 font-bold animate-pulse">
                            {error}
                        </div>
                    )}

                    {movimentacao && !loading && (
                        <>
                            {/* Resumo do Veículo e Proprietário */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-xl">
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Dados do Veículo</h3>
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-white uppercase">{vehicle.modelo || 'N/A'}</p>
                                        <div className="flex gap-4 text-xs text-gray-400">
                                            <span>Cor: <b className="text-gray-200">{vehicle.cor || '---'}</b></span>
                                            <span>Ano: <b className="text-gray-200">{vehicle.ano || '---'}</b></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-xl">
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Proprietário</h3>
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-white uppercase truncate">{vehicle.proprietario_nome || 'N/A'}</p>
                                        <p className="text-xs text-gray-400">{vehicle.proprietario_telefone || 'Sem contato'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detalhes do Período */}
                            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl space-y-4">
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Linha do Tempo</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-green-500 uppercase">Check-in</p>
                                        <p className="text-lg font-bold text-white">
                                            {new Date(movimentacao.data_entrada!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-red-500 uppercase">Checkout (Agora)</p>
                                        <p className="text-lg font-bold text-white">
                                            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-gray-700 flex justify-between items-center">
                                    <div className="text-center bg-gray-900 px-6 py-3 rounded-2xl border border-gray-700">
                                        <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Valor Unitário</p>
                                        <p className="text-xl font-bold text-white">{movimentacao.valor_diaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                    <div className="text-6xl text-gray-700 font-black">×</div>
                                    <div className="text-center bg-gray-900 px-6 py-3 rounded-2xl border border-gray-700">
                                        <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Total Diárias</p>
                                        <p className="text-xl font-bold text-white">{checkoutData.diarias}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Forma de Pagamento */}
                            <div className="bg-blue-600/5 p-6 rounded-2xl border border-blue-500/20 space-y-4">
                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Selecione a Forma de Pagamento</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {paymentMethods.map(method => (
                                        <button
                                            key={method.id}
                                            onClick={() => setSelectedPaymentMethod(method.nome)}
                                            className={`py-3 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all border-2 ${selectedPaymentMethod === method.nome ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                        >
                                            {method.nome}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-6 border-t border-gray-700 bg-gray-900/80 backdrop-blur-md flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-blue-600 p-4 rounded-2xl shadow-xl">
                        <span className="text-xs font-black text-blue-100 uppercase tracking-widest">Total a Receber</span>
                        <span className="text-3xl font-black text-white tabular-nums">
                            {checkoutData.totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
                            disabled={isConfirming}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-[2] py-4 bg-green-600 hover:bg-green-500 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-green-900/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                            disabled={isConfirming || loading || !movimentacao}
                        >
                            {isConfirming ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    Finalizar Checkout
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
