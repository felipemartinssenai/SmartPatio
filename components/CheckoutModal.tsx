
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Veiculo, Movimentacao, FormaPagamento } from '../types';
import { supabase } from '../services/supabase';
import { calcularTotalDiarias } from '../utils/calculations';
import { AsaasService } from '../services/asaas';

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

    // Estados de Pagamento Externo
    const [paymentData, setPaymentData] = useState<any>(null);
    const [qrCodeData, setQrCodeData] = useState<any>(null);
    const [isWaitingPayment, setIsWaitingPayment] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
    const pollInterval = useRef<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!vehicle) return;
            setLoading(true);
            setError(null);
            try {
                const [movResponse, paymentResponse] = await Promise.all([
                    supabase.from('movimentacoes').select('*').eq('veiculo_id', vehicle.id).is('data_saida', null).order('created_at', { ascending: false }).limit(1).single(),
                    supabase.from('formas_pagamento').select('*').eq('ativa', true).order('nome')
                ]);
                
                if (movResponse.error || !movResponse.data) {
                    setError('Movimentação ativa não encontrada para este veículo.');
                } else {
                    setMovimentacao(movResponse.data as Movimentacao);
                }
                
                if (!paymentResponse.error && paymentResponse.data) {
                    const methods = paymentResponse.data as FormaPagamento[];
                    setPaymentMethods(methods);
                    if (methods.length > 0) setSelectedPaymentMethod(methods[0].nome);
                }
            } catch (err) {
                setError('Erro ao carregar dados de checkout.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [vehicle]);

    useEffect(() => {
        return () => { 
            if (pollInterval.current) {
                window.clearInterval(pollInterval.current);
                pollInterval.current = null;
            }
        };
    }, []);

    const checkoutData = useMemo(() => {
        if (!movimentacao || !movimentacao.data_entrada) return { totalPagar: 0, diarias: 0, entrada: null, saida: null };
        const dataSaida = new Date().toISOString();
        const total = calcularTotalDiarias(movimentacao.data_entrada, dataSaida, movimentacao.valor_diaria);
        const diarias = total > 0 ? total / movimentacao.valor_diaria : 0;
        return { 
            totalPagar: total, 
            diarias: Math.round(diarias),
            entrada: new Date(movimentacao.data_entrada),
            saida: new Date(dataSaida)
        };
    }, [movimentacao]);

    const isAutomatedMethod = selectedPaymentMethod.toLowerCase() === 'pix' || selectedPaymentMethod.toLowerCase() === 'boleto';

    const handleExternalCheckout = async () => {
        if (!vehicle || !movimentacao) return;
        setIsConfirming(true);
        setError(null);

        try {
            const customer = await AsaasService.createCustomer(
                vehicle.proprietario_nome || `Cliente Placa ${vehicle.placa}`,
                vehicle.proprietario_cpf || '00000000000',
                vehicle.proprietario_telefone || '00000000000'
            );

            const billingType = selectedPaymentMethod.toUpperCase() as 'PIX' | 'BOLETO';
            const payment = await AsaasService.createPayment(
                customer.id,
                checkoutData.totalPagar,
                billingType,
                `Estadia Pátio - Placa ${vehicle.placa}`
            );

            setPaymentData(payment);

            if (billingType === 'PIX') {
                const qr = await AsaasService.getPixQrCode(payment.id);
                setQrCodeData(qr);
            }

            setIsWaitingPayment(true);
            
            // Polling Otimizado (10s) para evitar bloqueios
            pollInterval.current = window.setInterval(async () => {
                setIsPolling(true);
                try {
                    const status = await AsaasService.checkPaymentStatus(payment.id);
                    console.log(`[Verificação Status ${payment.id}]:`, status);
                    
                    const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
                    if (paidStatuses.includes(status)) {
                        // 1. Limpa o polling imediatamente
                        if (pollInterval.current) {
                            window.clearInterval(pollInterval.current);
                            pollInterval.current = null;
                        }
                        
                        // 2. Notifica o usuário visualmente
                        setIsPaymentConfirmed(true);
                        
                        // 3. Aguarda 3 segundos de confirmação visual antes de gravar no banco e fechar
                        setTimeout(() => {
                            handleFinalConfirm();
                        }, 3000);
                    }
                } catch (e) { 
                    console.error('Erro na verificação automática:', e); 
                } finally {
                    setTimeout(() => setIsPolling(false), 2000);
                }
            }, 10000);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsConfirming(false);
        }
    };

    const handleFinalConfirm = async () => {
        if (!movimentacao) return;
        setIsConfirming(true);
        try {
            await onConfirm(movimentacao, checkoutData.totalPagar, selectedPaymentMethod);
            onClose();
        } catch (e: any) {
            setError(e.message);
            setIsPaymentConfirmed(false); // Volta ao estado anterior se houver erro na gravação final
        } finally {
            setIsConfirming(false);
        }
    };

    if (!vehicle) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={isPaymentConfirmed ? undefined : onClose}>
            <div className={`bg-gray-800 rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] border transition-all duration-500 overflow-hidden animate-in zoom-in-95 ${isPaymentConfirmed ? 'border-green-500 scale-105' : 'border-gray-700'}`} onClick={(e) => e.stopPropagation()}>
                
                {/* View de Pagamento Confirmado (Notificação) */}
                {isPaymentConfirmed ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-b from-green-900/20 to-gray-900 space-y-8 min-h-[400px]">
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                            <div className="relative w-32 h-32 bg-green-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)]">
                                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Pagamento Confirmado!</h2>
                            <p className="text-green-400 font-bold uppercase tracking-widest text-xs">Recebimento identificado com sucesso via {selectedPaymentMethod}</p>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-3 bg-gray-800 rounded-2xl border border-gray-700 animate-pulse">
                            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Finalizando Liberação do Pátio...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header Regular */}
                        <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                    <span className="bg-white text-black px-3 py-1 rounded-lg font-mono">{vehicle.placa}</span>
                                    Finalizar Checkout
                                </h2>
                                <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                    {isWaitingPayment ? (
                                        <>
                                            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                                            Sincronizando com o Banco...
                                        </>
                                    ) : 'Conferência de Estadia'}
                                </p>
                            </div>
                            {!isWaitingPayment && (
                                <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            )}
                        </div>
                        
                        {/* Content Regular */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gray-900">
                            
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-bold leading-relaxed">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}

                            {isWaitingPayment ? (
                                <div className="flex flex-col items-center py-8 text-center space-y-6">
                                     <div className="relative w-24 h-24">
                                        <div className="absolute inset-0 bg-blue-600/20 rounded-full animate-ping"></div>
                                        <div className="relative w-full h-full bg-gray-800 border-4 border-blue-500 rounded-full flex items-center justify-center shadow-2xl">
                                            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Aguardando {selectedPaymentMethod}</h3>
                                        {isPolling && <p className="text-[10px] text-blue-400 font-black animate-pulse">VERIFICANDO STATUS NO BANCO...</p>}
                                    </div>
                                    
                                    {selectedPaymentMethod.toLowerCase() === 'pix' && qrCodeData && (
                                        <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border-4 border-blue-500">
                                            <img src={`data:image/png;base64,${qrCodeData.encodedImage}`} alt="QR Code" className="w-56 h-56" />
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(qrCodeData.payload); alert('Código Copiado!'); }}
                                                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-black text-[10px] uppercase tracking-widest border border-gray-200 shadow-sm"
                                            >
                                                Copiar Código Pix
                                            </button>
                                        </div>
                                    )}

                                    {selectedPaymentMethod.toLowerCase() === 'boleto' && paymentData && (
                                        <div className="w-full max-w-sm space-y-4">
                                            <a href={paymentData.bankSlipUrl} target="_blank" className="w-full block py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase tracking-widest text-center shadow-xl transition-all active:scale-95">
                                                Visualizar Boleto
                                            </a>
                                        </div>
                                    )}

                                    <button onClick={() => { 
                                        if(pollInterval.current) window.clearInterval(pollInterval.current); 
                                        pollInterval.current = null;
                                        setIsWaitingPayment(false); 
                                    }} className="text-gray-500 text-[10px] font-black uppercase hover:text-white transition-colors tracking-widest pt-4">Cancelar e Alterar Pagamento</button>
                                </div>
                            ) : (
                                <>
                                    {/* Datas e Estadia */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-xl">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Entrada (Check-in)</p>
                                            <p className="text-base font-bold text-white">
                                                {checkoutData.entrada?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '---'}
                                            </p>
                                        </div>
                                        <div className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-xl">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Saída (Checkout)</p>
                                            <p className="text-base font-bold text-blue-400">
                                                {checkoutData.saida?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '---'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700 shadow-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Resumo da Estadia</p>
                                            <p className="text-3xl font-black text-white">{checkoutData.diarias} <span className="text-sm text-gray-500">Diárias</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Valor Unitário</p>
                                            <p className="text-xl font-bold text-gray-300">
                                                {movimentacao?.valor_diaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Seleção de Pagamento */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Forma de Recebimento</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {paymentMethods.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setSelectedPaymentMethod(m.nome)}
                                                    className={`p-5 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all border-2 flex flex-col items-center gap-1 ${selectedPaymentMethod === m.nome ? 'bg-blue-600 border-blue-400 text-white shadow-xl scale-105' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                                >
                                                    {m.nome}
                                                    {(m.nome.toLowerCase() === 'pix' || m.nome.toLowerCase() === 'boleto') && (
                                                        <span className="text-[8px] opacity-60">Automático</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Footer Regular */}
                        {!isWaitingPayment && (
                            <div className="p-6 border-t border-gray-700 bg-gray-900/80 backdrop-blur-md space-y-4">
                                <div className="flex justify-between items-center bg-blue-600 p-6 rounded-[32px] shadow-2xl">
                                    <span className="text-xs font-black text-blue-100 uppercase tracking-widest">Valor Final</span>
                                    <span className="text-4xl font-black text-white tabular-nums">
                                        {checkoutData.totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={onClose} className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 rounded-3xl text-white font-black uppercase tracking-widest text-xs transition-all border border-gray-700 active:scale-95">Sair</button>
                                    <button
                                        onClick={isAutomatedMethod ? handleExternalCheckout : handleFinalConfirm}
                                        disabled={isConfirming || loading || !movimentacao || !selectedPaymentMethod}
                                        className="flex-[2] py-5 bg-green-600 hover:bg-green-500 rounded-3xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                                    >
                                        {isConfirming ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                {isAutomatedMethod ? 'Gerar Cobrança' : 'Finalizar Checkout'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CheckoutModal;
